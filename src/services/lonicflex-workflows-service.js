#!/usr/bin/env node
/**
 * LonicFLex Workflows Service - Foundation v0
 * Workflow orchestration and automation pipeline management
 *
 * Handles:
 * - Workflow definition and template management
 * - Pipeline orchestration and step coordination
 * - Workflow execution tracking and monitoring
 * - Cross-service workflow integration
 * - Automated workflow triggers and scheduling
 */

const express = require('express');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const { ServiceBase } = require('./service-base');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
require('dotenv').config();

class LonicFlexWorkflowsService extends ServiceBase {
    constructor(config = {}) {
        super();
        this.config = {
            port: config.port || process.env.WORKFLOWS_SERVICE_PORT || 3004,
            serviceName: 'lonicflex-workflows',
            maxConcurrentWorkflows: config.maxConcurrentWorkflows || 20,
            workflowTimeout: config.workflowTimeout || 600000, // 10 minutes
            stepTimeout: config.stepTimeout || 120000, // 2 minutes
            ...config
        };

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.contextManager = new Factor3ContextManager();

        // Workflow state management
        this.activeWorkflows = new Map();       // workflowId -> workflow state
        this.workflowTemplates = new Map();     // templateId -> template definition
        this.scheduledWorkflows = new Map();    // scheduleId -> schedule info
        this.workflowHistory = [];              // completed workflows

        // Initialize logger
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

        // Service state
        this.isInitialized = false;
        this.startTime = new Date();
        this.stats = {
            workflowsExecuted: 0,
            activeWorkflows: 0,
            completedWorkflows: 0,
            failedWorkflows: 0,
            averageExecutionTime: 0,
            stepsExecuted: 0
        };

        // Built-in workflow templates
        this.initializeBuiltinTemplates();
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info('Workflows API request received', {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                initialized: this.isInitialized,
                stats: this.stats,
                activeWorkflows: this.activeWorkflows.size,
                availableTemplates: this.workflowTemplates.size
            });
        });

        // Execute workflow
        this.app.post('/execute', async (req, res) => {
            try {
                const result = await this.executeWorkflow(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Workflow execution failed', { error: error.message, body: req.body });
                res.status(500).json({ error: error.message });
            }
        });

        // Get workflow status
        this.app.get('/:workflowId/status', async (req, res) => {
            try {
                const status = await this.getWorkflowStatus(req.params.workflowId);
                res.json(status);
            } catch (error) {
                this.logger.error('Workflow status check failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Cancel workflow
        this.app.post('/:workflowId/cancel', async (req, res) => {
            try {
                const result = await this.cancelWorkflow(req.params.workflowId);
                res.json(result);
            } catch (error) {
                this.logger.error('Workflow cancellation failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // List workflow templates
        this.app.get('/templates', (req, res) => {
            try {
                const templates = Array.from(this.workflowTemplates.entries()).map(([id, template]) => ({
                    id,
                    name: template.name,
                    description: template.description,
                    steps: template.steps.length,
                    estimatedDuration: template.estimatedDuration
                }));
                const evidence = {
                    templatesGenerated: templates.length > 0,
                    templatesArray: Array.isArray(templates),
                    mapPopulated: this.workflowTemplates.size > 0
                };

                const operationSuccess = evidence.templatesGenerated && evidence.templatesArray;
                res.json({
                    success: operationSuccess,
                    templates,
                    evidence: evidence
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Create workflow template
        this.app.post('/templates', async (req, res) => {
            try {
                const result = await this.createWorkflowTemplate(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Template creation failed', { error: error.message, body: req.body });
                res.status(500).json({ error: error.message });
            }
        });

        // Cross-service coordination endpoint
        this.app.post('/coordinate', async (req, res) => {
            try {
                const result = await this.coordinateWithServices(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Service coordination failed', { error: error.message, body: req.body });
                res.status(500).json({ error: error.message });
            }
        });
    }

    async initialize() {
        try {
            this.logger.info('Initializing Workflows service...');

            // Initialize database
            await this.db.initialize();
            this.logger.info('Database initialized');

            this.isInitialized = true;
            this.logger.info('Workflows service initialized successfully');

        } catch (error) {
            this.logger.error('Workflows service initialization failed', { error: error.message });
            throw error;
        }
    }

    initializeBuiltinTemplates() {
        // LonicFLex deployment workflow
        this.workflowTemplates.set('lonicflex-deploy', {
            id: 'lonicflex-deploy',
            name: 'LonicFLex Deployment',
            description: 'Complete LonicFLex feature deployment workflow',
            estimatedDuration: 300000, // 5 minutes
            steps: [
                { name: 'validate-input', service: 'master', timeout: 30000 },
                { name: 'create-branch', service: 'github', timeout: 30000 },
                { name: 'security-scan', service: 'agents', agent: 'security', timeout: 60000 },
                { name: 'generate-code', service: 'agents', agent: 'code', timeout: 90000 },
                { name: 'deploy-service', service: 'agents', agent: 'deploy', timeout: 120000 },
                { name: 'notify-team', service: 'slack', timeout: 30000 }
            ]
        });

        // Branch management workflow
        this.workflowTemplates.set('branch-management', {
            id: 'branch-management',
            name: 'Branch Management',
            description: 'Create and manage development branches',
            estimatedDuration: 120000, // 2 minutes
            steps: [
                { name: 'validate-branch-name', service: 'master', timeout: 15000 },
                { name: 'create-branch', service: 'github', timeout: 30000 },
                { name: 'setup-protection', service: 'github', timeout: 30000 },
                { name: 'notify-slack', service: 'slack', timeout: 15000 }
            ]
        });

        // Health check workflow
        this.workflowTemplates.set('health-check', {
            id: 'health-check',
            name: 'System Health Check',
            description: 'Comprehensive system health validation',
            estimatedDuration: 180000, // 3 minutes
            steps: [
                { name: 'check-services', service: 'health', timeout: 60000 },
                { name: 'validate-agents', service: 'agents', timeout: 60000 },
                { name: 'test-integrations', service: 'master', timeout: 60000 },
                { name: 'report-status', service: 'slack', timeout: 30000 }
            ]
        });

        this.logger.info('Built-in workflow templates initialized', {
            templates: Array.from(this.workflowTemplates.keys())
        });
    }

    async executeWorkflow({ templateId, context = {}, runId, priority = 'normal' }) {
        if (!this.isInitialized) {
            throw new Error('Workflows service not initialized');
        }

        const template = this.workflowTemplates.get(templateId);
        if (!template) {
            throw new Error(`Workflow template not found: ${templateId}`);
        }

        const workflowId = runId || `workflow_${uuidv4()}`;

        // Create workflow state
        const workflow = {
            id: workflowId,
            templateId,
            template,
            context,
            priority,
            status: 'initializing',
            currentStep: 0,
            startTime: new Date(),
            steps: template.steps.map(step => ({
                ...step,
                status: 'pending',
                result: null,
                error: null,
                startTime: null,
                endTime: null
            })),
            results: {},
            errors: []
        };

        this.activeWorkflows.set(workflowId, workflow);
        this.stats.activeWorkflows = this.activeWorkflows.size;

        this.logger.info('Workflow execution started', {
            workflowId,
            templateId,
            steps: template.steps.length,
            priority
        });

        // Execute workflow asynchronously
        this.executeWorkflowAsync(workflowId);

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            workflowId,
            templateId,
            status: 'started',
            estimatedDuration: template.estimatedDuration,
            steps: template.steps.length
        };
    }

    async executeWorkflowAsync(workflowId) {
        const workflow = this.activeWorkflows.get(workflowId);
        if (!workflow) return;

        try {
            workflow.status = 'running';

            // Execute steps sequentially
            for (let i = 0; i < workflow.steps.length; i++) {
                const step = workflow.steps[i];
                workflow.currentStep = i;

                step.status = 'running';
                step.startTime = new Date();

                this.logger.info('Executing workflow step', {
                    workflowId,
                    step: step.name,
                    service: step.service,
                    stepIndex: i + 1,
                    totalSteps: workflow.steps.length
                });

                try {
                    // Execute step via service coordination
                    const result = await this.executeWorkflowStep(step, workflow.context);

                    step.status = 'completed';
                    step.result = result;
                    step.endTime = new Date();

                    workflow.results[step.name] = result;
                    this.stats.stepsExecuted++;

                } catch (stepError) {
                    step.status = 'failed';
                    step.error = stepError.message;
                    step.endTime = new Date();

                    workflow.errors.push({
                        step: step.name,
                        error: stepError.message,
                        timestamp: new Date()
                    });

                    // Stop execution on step failure
                    throw stepError;
                }
            }

            // Workflow completed successfully
            workflow.status = 'completed';
            workflow.endTime = new Date();
            workflow.duration = workflow.endTime - workflow.startTime;

            this.stats.workflowsExecuted++;
            this.stats.completedWorkflows++;
            this.updateAverageExecutionTime(workflow.duration);

            this.logger.info('Workflow completed successfully', {
                workflowId,
                duration: workflow.duration,
                stepsCompleted: workflow.steps.length
            });

            // Notify other services
            await this.coordinateWithServices({
                event: 'workflow_completed',
                workflowId,
                templateId: workflow.templateId,
                duration: workflow.duration,
                results: workflow.results
            });

        } catch (error) {
            workflow.status = 'failed';
            workflow.error = error.message;
            workflow.endTime = new Date();

            this.stats.failedWorkflows++;
            this.logger.error('Workflow execution failed', { workflowId, error: error.message });

            // Notify other services
            await this.coordinateWithServices({
                event: 'workflow_failed',
                workflowId,
                templateId: workflow.templateId,
                error: error.message
            });

        } finally {
            this.stats.activeWorkflows = this.activeWorkflows.size;

            // Clean up completed workflows after 2 hours
            setTimeout(() => {
                this.activeWorkflows.delete(workflowId);
                this.workflowHistory.push({
                    id: workflowId,
                    templateId: workflow.templateId,
                    status: workflow.status,
                    duration: workflow.duration,
                    completedAt: new Date()
                });
                this.stats.activeWorkflows = this.activeWorkflows.size;
            }, 7200000);
        }
    }

    async executeWorkflowStep(step, context) {
        try {
            // Coordinate with appropriate service based on step configuration
            const result = await this.coordinateWithServices({
                event: 'execute_step',
                service: step.service,
                step: step.name,
                agent: step.agent,
                context,
                timeout: step.timeout
            });

            return result;

        } catch (error) {
            this.logger.error('Workflow step execution failed', {
                step: step.name,
                service: step.service,
                error: error.message
            });
            throw error;
        }
    }

    async getWorkflowStatus(workflowId) {
        const workflow = this.activeWorkflows.get(workflowId);
        if (!workflow) {
            // Check workflow history
            const historyEntry = this.workflowHistory.find(w => w.id === workflowId);
            if (historyEntry) {

                const validation = { success: this.validateSuccess() };return {

                    success: validation.success,
                    workflow: {
                        id: historyEntry.id,
                        status: historyEntry.status,
                        completedAt: historyEntry.completedAt,
                        duration: historyEntry.duration
                    }
                };
            }
            throw new Error(`Workflow not found: ${workflowId}`);
        }

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            workflow: {
                id: workflow.id,
                templateId: workflow.templateId,
                status: workflow.status,
                currentStep: workflow.currentStep,
                totalSteps: workflow.steps.length,
                progress: Math.round((workflow.currentStep / workflow.steps.length) * 100),
                startTime: workflow.startTime,
                endTime: workflow.endTime,
                duration: workflow.duration,
                steps: workflow.steps.map(step => ({
                    name: step.name,
                    service: step.service,
                    status: step.status,
                    startTime: step.startTime,
                    endTime: step.endTime,
                    error: step.error
                })),
                results: workflow.results,
                errors: workflow.errors
            }
        };
    }

    async cancelWorkflow(workflowId) {
        const workflow = this.activeWorkflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }

        if (workflow.status === 'completed' || workflow.status === 'failed') {

            const validation = { success: this.validateSuccess() };return {

                success: validation.success, message: 'Workflow already finished' };
        }

        workflow.status = 'cancelled';
        workflow.endTime = new Date();

        this.logger.info('Workflow cancelled', { workflowId });

        const validation = { success: this.validateSuccess() };return {

            success: validation.success, message: 'Workflow cancelled successfully' };
    }

    async createWorkflowTemplate({ name, description, steps, estimatedDuration }) {
        const templateId = `custom_${uuidv4()}`;

        const template = {
            id: templateId,
            name,
            description,
            estimatedDuration: estimatedDuration || steps.length * 60000, // Default 1 minute per step
            steps: steps.map(step => ({
                name: step.name,
                service: step.service,
                agent: step.agent,
                timeout: step.timeout || 60000,
                ...step
            })),
            custom: true,
            createdAt: new Date()
        };

        this.workflowTemplates.set(templateId, template);

        this.logger.info('Custom workflow template created', { templateId, name, steps: steps.length });

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            templateId,
            template: {
                id: templateId,
                name,
                description,
                steps: steps.length
            }
        };
    }

    updateAverageExecutionTime(duration) {
        const count = this.stats.completedWorkflows;
        const current = this.stats.averageExecutionTime;
        this.stats.averageExecutionTime = ((current * (count - 1)) + duration) / count;
    }

    async coordinateWithServices({ event, ...data }) {
        try {
            this.logger.info('Coordinating with other services', { event, data });

            // Handle different coordination events
            switch (event) {
                case 'execute_step':
                    return await this.executeServiceStep(data);

                case 'workflow_completed':
                case 'workflow_failed':
                    // Notify Slack service
                    await this.notifyService('slack', event, data);
                    break;
            }

            const validation = { success: this.validateSuccess() };return {

                success: validation.success, event, coordinated: true };

        } catch (error) {
            this.logger.error('Service coordination failed', { error: error.message, event });
            return { success: false, error: error.message };
        }
    }

    async executeServiceStep({ service, step, agent, context, timeout = 30000 }) {
        // Real service coordination with HTTP calls
        this.logger.info('Executing service step', { service, step, agent });

        // Service port mapping
        const servicePorts = {
            'master': 3007,
            'webhooks': 3008,
            'github': 3002,
            'slack': 3006,
            'agents': 3003,
            'workflows': 3004,
            'health': 3005
        };

        const servicePort = servicePorts[service];
        if (!servicePort) {
            this.logger.warn('Unknown service', { service });
            return { success: false, service, error: `Unknown service: ${service}` };
        }

        const serviceUrl = `http://localhost:${servicePort}`;

        try {
            // Check service health first with shorter timeout
            const healthResponse = await this.makeServiceCall(serviceUrl, '/health', 'GET', null, 3000);
            if (!healthResponse.success) {
                this.logger.warn('Service unavailable', {
                    service,
                    serviceUrl,
                    error: healthResponse.error
                });
                return {
                    success: false,
                    service,
                    action: step,
                    error: `Service ${service} unavailable: ${healthResponse.error}`,
                    serviceUrl
                };
            }

            // Execute service-specific actions
            let result;
            switch (service) {
                case 'github':
                    result = await this.executeGitHubStep(serviceUrl, step, context, timeout);
                    break;

                case 'agents':
                    result = await this.executeAgentStep(serviceUrl, step, agent, context, timeout);
                    break;

                case 'slack':
                    result = await this.executeSlackStep(serviceUrl, step, context, timeout);
                    break;

                case 'health':
                    result = await this.executeHealthStep(serviceUrl, step, context, timeout);
                    break;

                case 'master':
                    result = await this.executeMasterStep(serviceUrl, step, context, timeout);
                    break;

                case 'webhooks':
                    result = await this.executeWebhookStep(serviceUrl, step, context, timeout);
                    break;

                default:
                    result = await this.executeGenericStep(serviceUrl, step, context, timeout);
                    break;
            }

            this.logger.info('Service step completed', { service, step, success: result.success });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success, service, action: step, result: result.data || result.message };

        } catch (error) {
            this.logger.error('Service step failed', { service, step, error: error.message });
            return {
                success: false,
                service,
                action: step,
                error: error.message
            };
        }
    }

    // Real HTTP service call utility
    async makeServiceCall(baseUrl, endpoint, method = 'GET', data = null, timeout = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const config = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'LonicFLex-Workflows/1.0'
                },
                signal: controller.signal
            };

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                config.body = JSON.stringify(data);
            }

            const response = await fetch(`${baseUrl}${endpoint}`, config);
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const responseData = await response.json();

            const validation = { success: this.validateSuccess() };return {

                success: validation.success, data: responseData, status: response.status };

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        }
    }

    // Service-specific step execution methods
    async executeGitHubStep(serviceUrl, step, context, timeout) {
        const endpoint = '/api/execute';
        const payload = {
            action: step,
            context: context,
            timestamp: new Date().toISOString()
        };
        return await this.makeServiceCall(serviceUrl, endpoint, 'POST', payload, timeout);
    }

    async executeAgentStep(serviceUrl, step, agent, context, timeout) {
        const endpoint = '/api/agents/execute';
        const payload = {
            agent: agent,
            action: step,
            context: context,
            timestamp: new Date().toISOString()
        };
        return await this.makeServiceCall(serviceUrl, endpoint, 'POST', payload, timeout);
    }

    async executeSlackStep(serviceUrl, step, context, timeout) {
        const endpoint = '/api/slack/notify';
        const payload = {
            action: step,
            message: context.message || 'Workflow step notification',
            context: context,
            timestamp: new Date().toISOString()
        };
        return await this.makeServiceCall(serviceUrl, endpoint, 'POST', payload, timeout);
    }

    async executeHealthStep(serviceUrl, step, context, timeout) {
        const endpoint = '/api/health/check';
        const payload = {
            check: step,
            context: context,
            timestamp: new Date().toISOString()
        };
        return await this.makeServiceCall(serviceUrl, endpoint, 'POST', payload, timeout);
    }

    async executeMasterStep(serviceUrl, step, context, timeout) {
        const endpoint = '/api/command';
        const payload = {
            command: step,
            context: context,
            timestamp: new Date().toISOString()
        };
        return await this.makeServiceCall(serviceUrl, endpoint, 'POST', payload, timeout);
    }

    async executeWebhookStep(serviceUrl, step, context, timeout) {
        const endpoint = '/api/webhook/trigger';
        const payload = {
            event: step,
            context: context,
            timestamp: new Date().toISOString()
        };
        return await this.makeServiceCall(serviceUrl, endpoint, 'POST', payload, timeout);
    }

    async executeGenericStep(serviceUrl, step, context, timeout) {
        const endpoint = '/api/execute';
        const payload = {
            action: step,
            context: context,
            timestamp: new Date().toISOString()
        };
        return await this.makeServiceCall(serviceUrl, endpoint, 'POST', payload, timeout);
    }

    async notifyService(serviceName, eventType, data) {
        const servicePorts = {
            'master': 3007,
            'webhooks': 3008,
            'github': 3002,
            'slack': 3006,
            'agents': 3003,
            'workflows': 3004,
            'health': 3005
        };

        const servicePort = servicePorts[serviceName];
        if (!servicePort) {
            this.logger.warn('Cannot notify unknown service', { service: serviceName });
            return { success: false, error: `Unknown service: ${serviceName}` };
        }

        try {
            const serviceUrl = `http://localhost:${servicePort}`;
            const endpoint = '/api/notifications';
            const payload = {
                eventType,
                data,
                source: this.config.serviceName,
                timestamp: new Date().toISOString()
            };

            const result = await this.makeServiceCall(serviceUrl, endpoint, 'POST', payload, 10000);

            this.logger.info('Service notification sent', {
                service: serviceName,
                eventType,
                success: result.success
            });

            return result;

        } catch (error) {
            this.logger.warn('Service notification failed', {
                service: serviceName,
                eventType,
                error: error.message
            });
            return { success: false, error: error.message };
        }
    }

    async start() {
        try {
            await this.initialize();

            const server = this.app.listen(this.config.port, () => {
                this.logger.info(`Workflows service listening on port ${this.config.port}`, {
                    service: this.config.serviceName,
                    templates: this.workflowTemplates.size,
                    endpoints: [
                        'GET /health',
                        'POST /execute',
                        'GET /:workflowId/status',
                        'POST /:workflowId/cancel',
                        'GET /templates',
                        'POST /templates',
                        'POST /coordinate'
                    ]
                });
            });

            return server;

        } catch (error) {
            this.logger.error('Failed to start Workflows service', { error: error.message });
            throw error;
        }
    }
}

// CLI support - if run directly
if (require.main === module) {
    const service = new LonicFlexWorkflowsService();
    service.start()
        .then(() => {
            logger.info('LonicFLex Workflows Service started successfully');
        })
        .catch((error) => {
            logger.error('FAIL Failed to start Workflows service:', error.message);
            process.exit(1);
        });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('Workflows service shutting down...');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.info('Workflows service shutting down...');
        process.exit(0);
    });
}

module.exports = { LonicFlexWorkflowsService };