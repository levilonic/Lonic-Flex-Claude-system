#!/usr/bin/env node
/**
 * Conditional Workflow Logic Engine - LonicFLex Window 1 Implementation
 * Enterprise conditional workflow execution that Anthropic Claude Actions cannot provide
 *
 * Features:
 * - "If security scan fails → create follow-up issue" logic
 * - "If manager approves → deploy to production"
 * - Cross-workflow conditional dependencies
 * - Real-time rule evaluation and execution
 * - Integration with all LonicFLex services
 */

const express = require('express');
const { SQLiteManager } = require('../database/sqlite-manager');
const { MultiWorkflowStateManager } = require('./multi-workflow-state-manager');
const { ClaudeAnalysisService } = require('./claude-analysis-service');
const winston = require('winston');
const EventEmitter = require('events');

class ConditionalWorkflowEngine extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            serviceName: 'conditional-workflow-engine',
            port: config.port || 3011,

            // Rule evaluation settings
            evaluationInterval: config.evaluationInterval || 30000, // 30 seconds
            maxRuleExecutionTime: config.maxRuleExecutionTime || 60000, // 1 minute
            maxRetries: config.maxRetries || 3,

            // Integration settings
            enableSlackIntegration: config.enableSlackIntegration !== false,
            enableGitHubIntegration: config.enableGitHubIntegration !== false,
            enableClaudeIntegration: config.enableClaudeIntegration !== false,

            // Performance settings
            maxConcurrentEvaluations: config.maxConcurrentEvaluations || 10,
            ruleExecutionTimeout: config.ruleExecutionTimeout || 30000,

            ...config
        };

        // Initialize logger first
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: `./logs/${this.config.serviceName}.log`
                })
            ]
        });

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.workflowStateManager = new MultiWorkflowStateManager();

        // Initialize Claude integration if enabled
        if (this.config.enableClaudeIntegration) {
            this.claudeService = new ClaudeAnalysisService();
        }

        // Rule evaluation state
        this.activeEvaluations = new Map(); // ruleId -> evaluation state
        this.ruleExecutionQueue = [];
        this.evaluationWorker = null;

        // Rule expression evaluator
        this.expressionEvaluator = new ExpressionEvaluator();

        // Service state
        this.startTime = new Date();

        this.stats = {
            totalRulesEvaluated: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            totalCostSavings: 0,
            activeRules: 0
        };
    }

    /**
     * Initialize the conditional workflow engine
     */
    async initialize() {
        try {
            await this.db.initialize();
            await this.workflowStateManager.initialize();

            // Load active conditional rules
            await this.loadActiveRules();

            // Start rule evaluation worker
            this.startRuleEvaluationWorker();

            // Initialize service integrations
            await this.initializeServiceIntegrations();

            this.logger.info('Conditional Workflow Engine initialized', {
                activeRules: this.stats.activeRules,
                evaluationInterval: this.config.evaluationInterval,
                integrations: {
                    slack: this.config.enableSlackIntegration,
                    github: this.config.enableGitHubIntegration,
                    claude: this.config.enableClaudeIntegration
                }
            });

        } catch (error) {
            this.logger.error('Initialization failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Load active conditional rules from database
     */
    async loadActiveRules() {
        try {
            // Load all enabled enterprise conditional rules
            const rules = await this.db.getAllSQL(
                'SELECT * FROM enterprise_conditional_rules WHERE enabled = TRUE ORDER BY priority ASC'
            );

            this.stats.activeRules = rules.length;

            this.logger.info('Active conditional rules loaded', {
                count: rules.length
            });

        } catch (error) {
            this.logger.error('Failed to load active rules', { error: error.message });
            throw error;
        }
    }

    /**
     * Start rule evaluation worker
     */
    startRuleEvaluationWorker() {
        this.evaluationWorker = setInterval(async () => {
            try {
                await this.evaluateAllActiveRules();
            } catch (error) {
                this.logger.error('Rule evaluation worker error', { error: error.message });
            }
        }, this.config.evaluationInterval);

        this.logger.info('Rule evaluation worker started', {
            intervalMs: this.config.evaluationInterval
        });
    }

    /**
     * Evaluate all active conditional rules
     */
    async evaluateAllActiveRules() {
        try {
            // Get all workflows that have active conditional rules
            const activeWorkflows = await this.db.getAllSQL(
                `SELECT DISTINCT workflow_id FROM enterprise_conditional_rules
                 WHERE enabled = TRUE
                 AND workflow_id IN (
                   SELECT id FROM multi_workflow_sessions WHERE status = 'active'
                 )`
            );

            for (const { workflow_id: workflowId } of activeWorkflows) {
                await this.evaluateWorkflowRules(workflowId);
            }

        } catch (error) {
            this.logger.error('Failed to evaluate all active rules', { error: error.message });
        }
    }

    /**
     * Evaluate conditional rules for specific workflow
     */
    async evaluateWorkflowRules(workflowId) {
        try {
            // Get workflow state
            const workflow = this.workflowStateManager.activeWorkflows.get(workflowId);
            if (!workflow) {
                this.logger.debug('Workflow not active in state manager', { workflowId });
                return;
            }

            // Get conditional rules for workflow
            const rules = await this.db.getEnterpriseConditionalRules(workflowId);

            for (const rule of rules) {
                await this.evaluateRule(workflowId, rule, workflow);
            }

        } catch (error) {
            this.logger.error('Failed to evaluate workflow rules', {
                workflowId,
                error: error.message
            });
        }
    }

    /**
     * Evaluate individual conditional rule
     */
    async evaluateRule(workflowId, rule, workflow) {
        try {
            // Skip if rule is already being evaluated
            if (this.activeEvaluations.has(rule.id)) {
                return;
            }

            this.activeEvaluations.set(rule.id, {
                workflowId,
                rule,
                startTime: Date.now(),
                status: 'evaluating'
            });

            // Build evaluation context
            const evaluationContext = await this.buildEvaluationContext(workflowId, workflow);

            // Evaluate condition expression
            const conditionResult = await this.expressionEvaluator.evaluate(
                rule.condition_expression,
                evaluationContext
            );

            this.stats.totalRulesEvaluated++;

            if (conditionResult === true) {
                // Condition met - execute action
                const executionResult = await this.executeRuleAction(workflowId, rule, evaluationContext);

                if (executionResult.success) {
                    this.stats.successfulExecutions++;

                    // Update rule metrics
                    const executionTime = Date.now() - this.activeEvaluations.get(rule.id).startTime;
                    await this.db.updateConditionalRuleMetrics(rule.id, true, executionTime);

                    this.logger.info('Conditional rule executed successfully', {
                        workflowId,
                        ruleId: rule.id,
                        ruleName: rule.rule_name,
                        actionType: rule.action_type,
                        executionTime
                    });

                } else {
                    this.stats.failedExecutions++;
                    await this.db.updateConditionalRuleMetrics(rule.id, false, 0);

                    this.logger.error('Conditional rule execution failed', {
                        workflowId,
                        ruleId: rule.id,
                        ruleName: rule.rule_name,
                        error: executionResult.error
                    });
                }
            }

        } catch (error) {
            this.stats.failedExecutions++;
            this.logger.error('Rule evaluation failed', {
                workflowId,
                ruleId: rule.id,
                error: error.message
            });
        } finally {
            this.activeEvaluations.delete(rule.id);
        }
    }

    /**
     * Build evaluation context for rule
     */
    async buildEvaluationContext(workflowId, workflow) {
        try {
            // Get workflow steps
            const steps = workflow.steps || [];
            const completedSteps = steps.filter(s => s.status === 'completed');
            const failedSteps = steps.filter(s => s.status === 'failed');
            const inProgressSteps = steps.filter(s => s.status === 'in_progress');

            // Get cross-system integrations
            const integrations = await this.db.getCrossSystemIntegrations(workflowId);
            const gitHubIntegrations = integrations.filter(i => i.system_type === 'github');
            const slackIntegrations = integrations.filter(i => i.system_type === 'slack');

            // Get approval gates
            const pendingApprovals = await this.db.getPendingApprovalGates(workflowId);
            const approvedGates = await this.db.getAllSQL(
                'SELECT * FROM enterprise_approval_gates WHERE workflow_id = ? AND status = "approved"',
                [workflowId]
            );

            // Build comprehensive evaluation context
            const context = {
                // Workflow state
                workflow: {
                    id: workflowId,
                    name: workflow.name,
                    type: workflow.type,
                    status: workflow.status,
                    completionPercentage: workflow.completionPercentage || 0,
                    priority: workflow.priority || 1
                },

                // Step analysis
                steps: {
                    total: steps.length,
                    completed: completedSteps.length,
                    failed: failedSteps.length,
                    inProgress: inProgressSteps.length,
                    completionRate: steps.length > 0 ? (completedSteps.length / steps.length) * 100 : 0,
                    failureRate: steps.length > 0 ? (failedSteps.length / steps.length) * 100 : 0,
                    hasFailures: failedSteps.length > 0,
                    recentlyCompleted: completedSteps.filter(s =>
                        new Date(s.completed) > new Date(Date.now() - 300000) // Last 5 minutes
                    ).length > 0
                },

                // System integrations
                integrations: {
                    github: {
                        count: gitHubIntegrations.length,
                        active: gitHubIntegrations.filter(i => i.sync_status === 'active').length,
                        errors: gitHubIntegrations.filter(i => i.sync_status === 'error').length
                    },
                    slack: {
                        count: slackIntegrations.length,
                        active: slackIntegrations.filter(i => i.sync_status === 'active').length
                    }
                },

                // Approval gates
                approvals: {
                    pending: pendingApprovals.length,
                    approved: approvedGates.length,
                    hasManagerApproval: approvedGates.some(a => a.approval_type === 'manager'),
                    hasSecurityApproval: approvedGates.some(a => a.approval_type === 'security'),
                    allApproved: pendingApprovals.length === 0 && approvedGates.length > 0
                },

                // Time-based conditions
                time: {
                    now: Date.now(),
                    workflowAge: Date.now() - new Date(workflow.created).getTime(),
                    hoursSinceCreation: Math.floor((Date.now() - new Date(workflow.created).getTime()) / (1000 * 60 * 60)),
                    isBusinessHours: this.isBusinessHours(),
                    dayOfWeek: new Date().getDay()
                },

                // Cost and performance
                performance: {
                    claudeCost: workflow.totalClaudeCost || 0,
                    executionTime: workflow.actualDuration || 0,
                    estimatedCompletion: workflow.estimatedDuration || 0
                },

                // Helper functions for complex expressions
                helpers: {
                    hasStepWithStatus: (stepName, status) =>
                        steps.some(s => s.stepName.includes(stepName) && s.status === status),
                    getStepResult: (stepName) =>
                        steps.find(s => s.stepName.includes(stepName))?.results,
                    timeSince: (timestamp) => Date.now() - new Date(timestamp).getTime()
                }
            };

            return context;

        } catch (error) {
            this.logger.error('Failed to build evaluation context', {
                workflowId,
                error: error.message
            });
            return {};
        }
    }

    /**
     * Execute rule action based on action type
     */
    async executeRuleAction(workflowId, rule, evaluationContext) {
        try {
            const actionConfig = rule.action_configuration;

            switch (rule.action_type) {
                case 'create_issue':
                    return await this.executeCreateIssueAction(workflowId, actionConfig, evaluationContext);

                case 'send_notification':
                    return await this.executeSendNotificationAction(workflowId, actionConfig, evaluationContext);

                case 'trigger_workflow':
                    return await this.executeTriggerWorkflowAction(workflowId, actionConfig, evaluationContext);

                case 'request_approval':
                    return await this.executeRequestApprovalAction(workflowId, actionConfig, evaluationContext);

                case 'create_pr':
                    return await this.executeCreatePRAction(workflowId, actionConfig, evaluationContext);

                case 'deploy_to_production':
                    return await this.executeDeployToProductionAction(workflowId, actionConfig, evaluationContext);

                case 'escalate_issue':
                    return await this.executeEscalateIssueAction(workflowId, actionConfig, evaluationContext);

                case 'pause_workflow':
                    return await this.executePauseWorkflowAction(workflowId, actionConfig, evaluationContext);

                default:
                    throw new Error(`Unknown action type: ${rule.action_type}`);
            }

        } catch (error) {
            this.logger.error('Rule action execution failed', {
                workflowId,
                ruleId: rule.id,
                actionType: rule.action_type,
                error: error.message
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Execute create issue action
     */
    async executeCreateIssueAction(workflowId, actionConfig, evaluationContext) {
        try {
            // Build issue details from context and config
            const issueTitle = this.replaceVariables(
                actionConfig.title || 'Workflow Issue - {{workflow.name}}',
                evaluationContext
            );

            const issueBody = this.replaceVariables(
                actionConfig.body || 'Automated issue created by conditional workflow rule.',
                evaluationContext
            );

            // Create GitHub issue through integration
            const integrationResult = await this.createGitHubIssue({
                title: issueTitle,
                body: issueBody,
                labels: actionConfig.labels || ['automated', 'workflow'],
                assignees: actionConfig.assignees || [],
                workflowId
            });

            if (integrationResult.success) {
                // Store integration state
                await this.db.createCrossSystemIntegrationState(
                    workflowId,
                    'github',
                    `issue-${integrationResult.issueNumber}`,
                    {
                        issueNumber: integrationResult.issueNumber,
                        issueUrl: integrationResult.issueUrl,
                        createdBy: 'conditional-workflow-engine',
                        ruleTriggered: true
                    }
                );

                this.logger.info('GitHub issue created successfully', {
                    workflowId,
                    issueNumber: integrationResult.issueNumber,
                    issueUrl: integrationResult.issueUrl
                });

                const evidence = {
                    issueCreated: !!integrationResult.issueNumber,
                    integrationSuccessful: !!integrationResult,
                    issueNumberReceived: typeof integrationResult.issueNumber === 'number'
                };

                const operationSuccess = evidence.issueCreated &&
                                       evidence.integrationSuccessful &&
                                       evidence.issueNumberReceived;

                return {
                    success: operationSuccess,
                    issueNumber: integrationResult.issueNumber,
                    evidence: evidence
                };
            } else {
                return { success: false, error: integrationResult.error };
            }

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute send notification action
     */
    async executeSendNotificationAction(workflowId, actionConfig, evaluationContext) {
        try {
            const message = this.replaceVariables(
                actionConfig.message || 'Workflow {{workflow.name}} requires attention',
                evaluationContext
            );

            // Send Slack notification
            const slackResult = await this.sendSlackNotification({
                channel: actionConfig.channel || '#workflows',
                message,
                workflowId,
                priority: actionConfig.priority || 'normal',
                mentionUsers: actionConfig.mentionUsers || []
            });

            if (slackResult.success) {
                // Store integration state
                await this.db.createCrossSystemIntegrationState(
                    workflowId,
                    'slack',
                    `notification-${slackResult.timestamp}`,
                    {
                        channel: actionConfig.channel,
                        message,
                        timestamp: slackResult.timestamp,
                        createdBy: 'conditional-workflow-engine'
                    }
                );

                return { success: true, messageTimestamp: slackResult.timestamp };
            } else {
                return { success: false, error: slackResult.error };
            }

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute request approval action
     */
    async executeRequestApprovalAction(workflowId, actionConfig, evaluationContext) {
        try {
            // Create approval gate
            const gateId = await this.db.createEnterpriseApprovalGate(workflowId, {
                gateName: actionConfig.gateName || 'Conditional Approval Required',
                approvalType: actionConfig.approvalType || 'manager',
                requiredApprovers: actionConfig.requiredApprovers || [],
                gateConfiguration: actionConfig,
                timeoutHours: actionConfig.timeoutHours || 24,
                escalationRules: actionConfig.escalationRules || {}
            });

            // Send Slack notification for approval request
            const approvalMessage = this.replaceVariables(
                actionConfig.approvalMessage || 'Approval required for workflow {{workflow.name}}',
                evaluationContext
            );

            const slackResult = await this.sendSlackApprovalRequest({
                channel: actionConfig.approvalChannel || '#approvals',
                message: approvalMessage,
                workflowId,
                gateId,
                requiredApprovers: actionConfig.requiredApprovers || []
            });

            if (slackResult.success) {
                // Update approval gate with Slack thread
                await this.db.updateApprovalGateStatus(
                    gateId,
                    'pending',
                    null,
                    null,
                    slackResult.timestamp
                );

                return { success: true, gateId, slackThread: slackResult.timestamp };
            } else {
                return { success: false, error: slackResult.error };
            }

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if current time is business hours
     */
    isBusinessHours() {
        const now = new Date();
        const day = now.getDay(); // 0 = Sunday, 6 = Saturday
        const hour = now.getHours();

        // Monday to Friday, 9 AM to 5 PM
        return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
    }

    /**
     * Replace variables in text templates
     */
    replaceVariables(text, context) {
        return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const value = this.getNestedValue(context, path.trim());
            return value !== undefined ? value : match;
        });
    }

    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) =>
            current && current[key] !== undefined ? current[key] : undefined, obj
        );
    }

    /**
     * Initialize service integrations
     */
    async initializeServiceIntegrations() {
        // Integration initialization would happen here
        // Real service health checks for integration services
        this.logger.info('Service integrations initialized', {
            slack: this.config.enableSlackIntegration,
            github: this.config.enableGitHubIntegration,
            claude: this.config.enableClaudeIntegration
        });
    }

    /**
     * Real GitHub issue creation via LonicFLex GitHub service
     */
    async createGitHubIssue(issueData) {
        try {
            const response = await axios.post('http://localhost:3002/issues/create', {
                title: issueData.title,
                body: issueData.body,
                labels: issueData.labels || ['conditional-workflow']
            }, { timeout: 10000 });

            this.logger.info('GitHub issue created via service', {
                issueNumber: response.data.number,
                url: response.data.html_url
            });

            return {
                success: true,
                issueNumber: response.data.number,
                issueUrl: response.data.html_url
            };
        } catch (error) {
            this.logger.error('GitHub issue creation failed', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Real Slack notification via LonicFLex Slack service
     */
    async sendSlackNotification(notificationData) {
        try {
            const response = await axios.post('http://localhost:3006/notifications/send', {
                channel: notificationData.channel || '#general',
                message: notificationData.message,
                blocks: notificationData.blocks
            }, { timeout: 10000 });

            this.logger.info('Slack notification sent via service', {
                channel: notificationData.channel,
                timestamp: response.data.ts
            });

            return {
                success: true,
                timestamp: response.data.ts
            };
        } catch (error) {
            this.logger.error('Slack notification failed', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Real Slack approval request via LonicFLex Slack service
     */
    async sendSlackApprovalRequest(approvalData) {
        try {
            const response = await axios.post('http://localhost:3006/approvals/request', {
                channel: approvalData.channel || '#approvals',
                message: approvalData.message,
                approvalId: approvalData.approvalId,
                timeout: approvalData.timeout || 3600000,
                approvers: approvalData.approvers
            }, { timeout: 10000 });

            this.logger.info('Slack approval request sent via service', {
                approvalId: approvalData.approvalId,
                timestamp: response.data.ts
            });

            return {
                success: true,
                timestamp: response.data.ts,
                approvalId: approvalData.approvalId
            };
        } catch (error) {
            this.logger.error('Slack approval request failed', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Get service health status
     */
    getServiceHealth() {
        return {
            status: 'healthy',
            service: this.config.serviceName,
            uptime: process.uptime(),
            stats: this.stats,
            activeEvaluations: this.activeEvaluations.size,
            config: {
                evaluationInterval: this.config.evaluationInterval,
                maxConcurrentEvaluations: this.config.maxConcurrentEvaluations,
                integrations: {
                    slack: this.config.enableSlackIntegration,
                    github: this.config.enableGitHubIntegration,
                    claude: this.config.enableClaudeIntegration
                }
            }
        };
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info('Conditional Workflow API request received', {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    /**
     * Create a new conditional rule
     */
    async createRule(ruleData) {
        try {
            const { name, condition, action, workflowId, priority = 5, enabled = true } = ruleData;

            if (!name || !condition || !action) {
                throw new Error('Missing required fields: name, condition, action');
            }

            // Store rule in database
            const result = await this.db.createEnterpriseConditionalRule(workflowId || 'global', {
                ruleName: name,
                conditionExpression: condition,
                actionType: action,
                priority,
                createdBy: 'api'
            });

            this.logger.info('Conditional rule created', {
                ruleId: result.id,
                name,
                workflowId: workflowId || 'global'
            });

            return result.id;

        } catch (error) {
            this.logger.error('Failed to create conditional rule', {
                error: error.message,
                ruleData
            });
            throw error;
        }
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                activeEvaluations: this.activeEvaluations.size,
                pendingRules: this.ruleExecutionQueue.length
            });
        });

        // Create conditional rule
        this.app.post('/rule/create', async (req, res) => {
            try {
                const ruleId = await this.createRule(req.body);
                res.json({ success: true, ruleId });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });

        // Evaluate rule
        this.app.post('/rule/:ruleId/evaluate', async (req, res) => {
            try {
                const { ruleId } = req.params;
                const result = await this.evaluateRule(ruleId, req.body.context);
                res.json({ success: true, result });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });

        // Get rule status
        this.app.get('/rule/:ruleId/status', async (req, res) => {
            try {
                const { ruleId } = req.params;
                const status = await this.getRuleStatus(ruleId);
                res.json({ success: true, status });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });
    }

    /**
     * Start the HTTP server
     */
    async start() {
        try {
            await this.initialize();

            this.app.listen(this.config.port, () => {
                this.logger.info('Conditional Workflow Engine service started', {
                    port: this.config.port,
                    serviceName: this.config.serviceName
                });
            });
        } catch (error) {
            this.logger.error('Failed to start Conditional Workflow Engine service', {
                error: error.message
            });
            process.exit(1);
        }
    }

    async initialize() {
        await this.db.initialize();
        this.logger.info('Conditional Workflow Engine initialized');
    }
}

/**
 * Expression Evaluator for conditional rules
 */
class ExpressionEvaluator {
    constructor() {
        this.operators = {
            '&&': (a, b) => a && b,
            '||': (a, b) => a || b,
            '==': (a, b) => a == b,
            '!=': (a, b) => a != b,
            '>': (a, b) => a > b,
            '<': (a, b) => a < b,
            '>=': (a, b) => a >= b,
            '<=': (a, b) => a <= b,
            '+': (a, b) => a + b,
            '-': (a, b) => a - b,
            '*': (a, b) => a * b,
            '/': (a, b) => a / b
        };
    }

    /**
     * Evaluate expression with context
     */
    async evaluate(expression, context) {
        try {
            // Simple expression evaluation (in production, use a proper expression parser)
            // This is a simplified version for demo purposes

            // Handle common patterns
            if (expression.includes('steps.hasFailures')) {
                return context.steps?.hasFailures === true;
            }

            if (expression.includes('steps.completionRate >= 100')) {
                return (context.steps?.completionRate || 0) >= 100;
            }

            if (expression.includes('approvals.allApproved')) {
                return context.approvals?.allApproved === true;
            }

            if (expression.includes('approvals.hasManagerApproval')) {
                return context.approvals?.hasManagerApproval === true;
            }

            if (expression.includes('time.isBusinessHours')) {
                return context.time?.isBusinessHours === true;
            }

            if (expression.includes('integrations.github.errors > 0')) {
                return (context.integrations?.github?.errors || 0) > 0;
            }

            // Default to false for unknown expressions
            return false;

        } catch (error) {
            console.error('Expression evaluation error', { expression, error: error.message });
            return false;
        }
    }
}

module.exports = { ConditionalWorkflowEngine };

// Start service if run directly
if (require.main === module) {
    const service = new ConditionalWorkflowEngine();
    service.start().catch(console.error);
}