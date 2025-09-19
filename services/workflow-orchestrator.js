/**
 * Workflow Orchestrator - Phase 3B Implementation
 * Intelligent coordination of multi-agent workflows with ServiceContainer integration
 * Eliminates Sequential Blocking Anti-Pattern through smart orchestration
 *
 * SOLVES: Direct agent-to-agent communication chaos
 * PROVIDES: Centralized workflow coordination, context handoff management, resource optimization
 */

const { EventEmitter } = require('events');
// REMOVED: Direct import that causes circular dependency
// const { AgentPoolManager } = require('./agent-pool-manager');

/**
 * Workflow Orchestrator - Central coordination system for multi-agent workflows
 */
class WorkflowOrchestrator extends EventEmitter {
    constructor(serviceContainer, config = {}) {
        super();

        if (!serviceContainer) {
            throw new Error('ServiceContainer is required for WorkflowOrchestrator');
        }

        this.serviceContainer = serviceContainer;
        this.config = {
            // Orchestration configuration
            maxConcurrentWorkflows: config.maxConcurrentWorkflows || 5,
            workflowTimeout: config.workflowTimeout || 600000, // 10 minutes
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 5000,

            // Performance optimization
            enableParallelization: config.enableParallelization !== false,
            contextHandoffTimeout: config.contextHandoffTimeout || 30000,
            resourceOptimization: config.resourceOptimization !== false,

            // Monitoring and logging
            enableMetrics: config.enableMetrics !== false,
            logLevel: config.logLevel || 'info',

            ...config
        };

        // Core components
        this.poolManager = null;
        this.activeWorkflows = new Map(); // workflowId -> WorkflowExecution
        this.workflowQueue = []; // Queued workflows waiting for resources
        this.completedWorkflows = new Map(); // Recent completions for analysis

        // Workflow templates and patterns
        this.workflowTemplates = new Map();
        this.executionPatterns = new Map();

        // Performance and monitoring
        this.metrics = {
            totalWorkflows: 0,
            completedWorkflows: 0,
            failedWorkflows: 0,
            averageExecutionTime: 0,
            resourceUtilization: 0
        };

        this.isInitialized = false;
        this.isShuttingDown = false;

        console.log('🎭 WorkflowOrchestrator created with intelligent coordination');
    }

    /**
     * Initialize the orchestrator with agent pool manager
     */
    async initialize() {
        if (this.isInitialized) {
            return this;
        }

        try {
            // Get AgentPoolManager from ServiceContainer (should be available now)
            try {
                // Use internal getter to bypass initialization check during bootstrap
                this.poolManager = this.serviceContainer._getServiceInternal('agentPoolManager');
                console.log('✅ AgentPoolManager connected to WorkflowOrchestrator');
            } catch (error) {
                console.log(`⚠️ AgentPoolManager not available: ${error.message}, WorkflowOrchestrator operating without pool manager`);
                this.poolManager = null;
            }

            // Listen to pool manager events (if available)
            if (this.poolManager) {
                this.poolManager.on('agentAcquired', (data) => {
                    this.emit('agentAcquired', data);
                });

                this.poolManager.on('agentReturned', (data) => {
                    this.emit('agentReturned', data);
                });
            }

            // Register default workflow templates
            this.registerDefaultTemplates();

            this.isInitialized = true;
            this.emit('initialized');

            console.log('✅ WorkflowOrchestrator initialized with AgentPoolManager');
            return this;

        } catch (error) {
            console.error('❌ WorkflowOrchestrator initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute a workflow with intelligent orchestration
     */
    async executeWorkflow(workflowDefinition, sessionId, config = {}) {
        if (!this.isInitialized) {
            throw new Error('WorkflowOrchestrator must be initialized before executing workflows');
        }

        if (this.isShuttingDown) {
            throw new Error('WorkflowOrchestrator is shutting down');
        }

        // Check resource limits
        if (this.activeWorkflows.size >= this.config.maxConcurrentWorkflows) {
            if (config.queue !== false) {
                return this.queueWorkflow(workflowDefinition, sessionId, config);
            } else {
                throw new Error(`Maximum concurrent workflows limit reached: ${this.activeWorkflows.size}`);
            }
        }

        const workflowId = this.generateWorkflowId(sessionId, workflowDefinition);
        const execution = new WorkflowExecution(workflowId, workflowDefinition, sessionId, this, config);

        // Track active workflow
        this.activeWorkflows.set(workflowId, execution);
        this.metrics.totalWorkflows++;

        this.emit('workflowStarted', {
            workflowId,
            sessionId,
            definition: workflowDefinition,
            timestamp: Date.now()
        });

        try {
            console.log(`🎭 Starting workflow orchestration: ${workflowId}`);
            const result = await execution.execute();

            // Move to completed tracking
            this.activeWorkflows.delete(workflowId);
            this.completedWorkflows.set(workflowId, {
                result,
                completedAt: Date.now(),
                executionTime: Date.now() - execution.startedAt
            });

            // Update metrics
            this.metrics.completedWorkflows++;
            this.updateAverageExecutionTime(Date.now() - execution.startedAt);

            this.emit('workflowCompleted', {
                workflowId,
                result,
                executionTime: Date.now() - execution.startedAt
            });

            console.log(`✅ Workflow orchestration completed: ${workflowId}`);

            // Process any queued workflows
            this.processWorkflowQueue();

            return result;

        } catch (error) {
            this.activeWorkflows.delete(workflowId);
            this.metrics.failedWorkflows++;

            this.emit('workflowFailed', {
                workflowId,
                error: error.message,
                executionTime: Date.now() - execution.startedAt
            });

            console.error(`❌ Workflow orchestration failed: ${workflowId}`, error.message);
            throw error;
        }
    }

    /**
     * Execute workflow from template
     */
    async executeWorkflowFromTemplate(templateName, parameters, sessionId, config = {}) {
        const template = this.workflowTemplates.get(templateName);
        if (!template) {
            throw new Error(`Workflow template not found: ${templateName}`);
        }

        const workflowDefinition = template.generateDefinition(parameters);
        return this.executeWorkflow(workflowDefinition, sessionId, config);
    }

    /**
     * Register workflow template
     */
    registerWorkflowTemplate(name, template) {
        this.workflowTemplates.set(name, template);
        console.log(`📋 Registered workflow template: ${name}`);
    }

    /**
     * Get agent from pool (used by WorkflowExecution)
     */
    async getAgent(agentType, sessionId, workflowId, config = {}) {
        if (!this.poolManager) {
            throw new Error('AgentPoolManager not available - cannot allocate agents');
        }
        return this.poolManager.getAgent(agentType, sessionId, workflowId, config);
    }

    /**
     * Return agent to pool (used by WorkflowExecution)
     */
    async returnAgent(agentId) {
        if (!this.poolManager) {
            console.warn('⚠️ AgentPoolManager not available - cannot return agent');
            return false;
        }
        return this.poolManager.returnAgent(agentId);
    }

    /**
     * Get orchestrator statistics
     */
    getStats() {
        return {
            initialized: this.isInitialized,
            active_workflows: this.activeWorkflows.size,
            queued_workflows: this.workflowQueue.length,
            completed_workflows: this.completedWorkflows.size,
            workflow_templates: this.workflowTemplates.size,
            metrics: { ...this.metrics },
            pool_stats: this.poolManager ? this.poolManager.getPoolStats() : null
        };
    }

    /**
     * Get system health
     */
    async getSystemHealth() {
        const health = {
            status: 'healthy',
            orchestrator: 'operational',
            active_workflows: this.activeWorkflows.size,
            resource_utilization: this.calculateResourceUtilization(),
            pool_health: null
        };

        // Get pool manager health
        if (this.poolManager) {
            health.pool_health = await this.poolManager.getSystemHealth();
            if (health.pool_health.status !== 'healthy') {
                health.status = 'degraded';
            }
        }

        // Check workflow health
        const stuckWorkflows = this.detectStuckWorkflows();
        if (stuckWorkflows.length > 0) {
            health.status = 'degraded';
            health.stuck_workflows = stuckWorkflows.length;
        }

        return health;
    }

    /**
     * Queue workflow for later execution
     */
    async queueWorkflow(workflowDefinition, sessionId, config = {}) {
        const queueEntry = {
            workflowDefinition,
            sessionId,
            config,
            queuedAt: Date.now(),
            priority: config.priority || 0
        };

        // Insert in priority order
        const insertIndex = this.workflowQueue.findIndex(entry => entry.priority < queueEntry.priority);
        if (insertIndex === -1) {
            this.workflowQueue.push(queueEntry);
        } else {
            this.workflowQueue.splice(insertIndex, 0, queueEntry);
        }

        this.emit('workflowQueued', {
            sessionId,
            queuePosition: insertIndex === -1 ? this.workflowQueue.length : insertIndex + 1,
            definition: workflowDefinition
        });

        return {
            queued: true,
            position: insertIndex === -1 ? this.workflowQueue.length : insertIndex + 1,
            estimatedWaitTime: this.estimateQueueWaitTime()
        };
    }

    /**
     * Process queued workflows
     */
    async processWorkflowQueue() {
        while (this.workflowQueue.length > 0 && this.activeWorkflows.size < this.config.maxConcurrentWorkflows) {
            const queueEntry = this.workflowQueue.shift();

            try {
                // Execute without queuing again
                await this.executeWorkflow(queueEntry.workflowDefinition, queueEntry.sessionId, {
                    ...queueEntry.config,
                    queue: false
                });
            } catch (error) {
                console.error('❌ Error processing queued workflow:', error.message);
                // Could implement retry logic here
            }
        }
    }

    /**
     * Generate unique workflow ID
     */
    generateWorkflowId(sessionId, workflowDefinition) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        const definitionHash = this.hashWorkflowDefinition(workflowDefinition);
        return `wf_${sessionId}_${definitionHash}_${timestamp}_${random}`;
    }

    /**
     * Hash workflow definition for ID generation
     */
    hashWorkflowDefinition(definition) {
        const str = JSON.stringify(definition);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Register default workflow templates
     */
    registerDefaultTemplates() {
        // Multi-agent coordination template
        this.registerWorkflowTemplate('multi-agent', new MultiAgentWorkflowTemplate());

        // Security scan template
        this.registerWorkflowTemplate('security-scan', new SecurityScanTemplate());

        // Deployment workflow template
        this.registerWorkflowTemplate('deployment', new DeploymentWorkflowTemplate());

        // Code review template
        this.registerWorkflowTemplate('code-review', new CodeReviewTemplate());
    }

    /**
     * Calculate resource utilization
     */
    calculateResourceUtilization() {
        if (!this.poolManager) return 0;

        const poolStats = this.poolManager.getPoolStats();
        const totalAgents = poolStats.totalActiveAgents;
        const maxAgents = this.config.maxConcurrentWorkflows * 4; // Estimated avg

        return totalAgents / maxAgents;
    }

    /**
     * Detect stuck workflows
     */
    detectStuckWorkflows() {
        const now = Date.now();
        const stuckThreshold = this.config.workflowTimeout;

        return Array.from(this.activeWorkflows.values())
            .filter(execution => (now - execution.startedAt) > stuckThreshold)
            .map(execution => ({
                workflowId: execution.workflowId,
                stuckTime: now - execution.startedAt,
                currentStep: execution.currentStep
            }));
    }

    /**
     * Update average execution time metric
     */
    updateAverageExecutionTime(executionTime) {
        if (this.metrics.completedWorkflows === 1) {
            this.metrics.averageExecutionTime = executionTime;
        } else {
            this.metrics.averageExecutionTime = (
                (this.metrics.averageExecutionTime * (this.metrics.completedWorkflows - 1)) + executionTime
            ) / this.metrics.completedWorkflows;
        }
    }

    /**
     * Estimate queue wait time
     */
    estimateQueueWaitTime() {
        if (this.metrics.averageExecutionTime === 0) {
            return 60000; // Default 1 minute estimate
        }

        const queueLength = this.workflowQueue.length;
        const concurrentSlots = this.config.maxConcurrentWorkflows;
        const avgTime = this.metrics.averageExecutionTime;

        return Math.ceil(queueLength / concurrentSlots) * avgTime;
    }

    /**
     * Shutdown orchestrator
     */
    async shutdown() {
        console.log('🛑 Shutting down WorkflowOrchestrator...');
        this.isShuttingDown = true;

        // Wait for active workflows to complete (with timeout)
        const shutdownTimeout = 30000; // 30 seconds
        const startTime = Date.now();

        while (this.activeWorkflows.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
            console.log(`⏳ Waiting for ${this.activeWorkflows.size} workflows to complete...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Force cleanup remaining workflows
        for (const execution of this.activeWorkflows.values()) {
            try {
                await execution.forceStop();
            } catch (error) {
                console.warn(`⚠️ Error stopping workflow ${execution.workflowId}:`, error.message);
            }
        }

        // Shutdown pool manager
        if (this.poolManager) {
            await this.poolManager.shutdown();
        }

        // Clear state
        this.activeWorkflows.clear();
        this.workflowQueue = [];
        this.completedWorkflows.clear();
        this.isInitialized = false;

        this.emit('shutdown');
        console.log('✅ WorkflowOrchestrator shutdown complete');
    }
}

/**
 * Individual Workflow Execution - manages the execution of a single workflow
 */
class WorkflowExecution {
    constructor(workflowId, definition, sessionId, orchestrator, config = {}) {
        this.workflowId = workflowId;
        this.definition = definition;
        this.sessionId = sessionId;
        this.orchestrator = orchestrator;
        this.config = config;

        this.startedAt = Date.now();
        this.currentStep = 'initializing';
        this.context = new Map(); // Context data passed between agents
        this.agents = new Map(); // Active agents in this workflow
        this.results = new Map(); // Results from each step

        this.isCompleted = false;
        this.isFailed = false;
    }

    /**
     * Execute the workflow
     */
    async execute() {
        try {
            console.log(`🎬 Executing workflow: ${this.workflowId}`);

            // Initialize workflow context
            await this.initializeWorkflowContext();

            // Execute each step in the workflow definition
            for (let i = 0; i < this.definition.steps.length; i++) {
                const step = this.definition.steps[i];
                this.currentStep = step.name || `step_${i + 1}`;

                console.log(`🎯 Executing step: ${this.currentStep}`);

                const stepResult = await this.executeStep(step, i);
                this.results.set(this.currentStep, stepResult);

                // Add result to context for next steps
                this.context.set(`${this.currentStep}_result`, stepResult);
            }

            // Compile final results
            const finalResult = await this.compileFinalResult();

            this.isCompleted = true;
            return finalResult;

        } catch (error) {
            this.isFailed = true;
            await this.handleExecutionError(error);
            throw error;

        } finally {
            await this.cleanup();
        }
    }

    /**
     * Initialize workflow context partition
     */
    async initializeWorkflowContext() {
        // Create workflow-specific context through ServiceContainer
        // This is already handled by the agents when they get context partitions
        this.context.set('workflow_id', this.workflowId);
        this.context.set('session_id', this.sessionId);
        this.context.set('started_at', this.startedAt);
        this.context.set('initial_config', this.config);
    }

    /**
     * Execute a single workflow step
     */
    async executeStep(step, stepIndex) {
        const stepStartTime = Date.now();

        try {
            if (step.type === 'agent') {
                return await this.executeAgentStep(step, stepIndex);
            } else if (step.type === 'parallel') {
                return await this.executeParallelStep(step, stepIndex);
            } else if (step.type === 'condition') {
                return await this.executeConditionalStep(step, stepIndex);
            } else {
                throw new Error(`Unknown step type: ${step.type}`);
            }

        } catch (error) {
            console.error(`❌ Step execution failed: ${this.currentStep}`, error.message);
            throw error;

        } finally {
            const stepExecutionTime = Date.now() - stepStartTime;
            console.log(`⏱️ Step ${this.currentStep} completed in ${stepExecutionTime}ms`);
        }
    }

    /**
     * Execute agent step
     */
    async executeAgentStep(step, stepIndex) {
        const { agentType, config = {} } = step;

        // Get agent from pool
        const agent = await this.orchestrator.getAgent(
            agentType,
            this.sessionId,
            this.workflowId,
            config
        );

        this.agents.set(step.name || `agent_${stepIndex}`, agent);

        try {
            // Prepare context for agent execution
            const agentContext = this.prepareAgentContext(step);

            // Execute agent with context
            const result = await agent.execute(agentContext);

            // Return agent to pool for reuse
            await this.orchestrator.returnAgent(agent.agentId);

            return {
                agentType,
                agentId: agent.agentId,
                result,
                executionTime: Date.now() - this.startedAt
            };

        } catch (error) {
            // Agent execution failed, still return to pool if possible
            try {
                await this.orchestrator.returnAgent(agent.agentId);
            } catch (returnError) {
                console.warn(`⚠️ Failed to return agent ${agent.agentId} to pool:`, returnError.message);
            }
            throw error;
        }
    }

    /**
     * Execute parallel steps
     */
    async executeParallelStep(step, stepIndex) {
        const { steps: parallelSteps } = step;
        const parallelPromises = parallelSteps.map(async (subStep, i) => {
            try {
                return await this.executeStep(subStep, i);
            } catch (error) {
                return { error: error.message, step: subStep.name || `parallel_${i}` };
            }
        });

        const results = await Promise.all(parallelPromises);
        return {
            type: 'parallel',
            results,
            completedSteps: results.filter(r => !r.error).length,
            failedSteps: results.filter(r => r.error).length
        };
    }

    /**
     * Execute conditional step
     */
    async executeConditionalStep(step, stepIndex) {
        const { condition, ifTrue, ifFalse } = step;

        // Evaluate condition based on current context
        const conditionResult = await this.evaluateCondition(condition);

        if (conditionResult) {
            return await this.executeStep(ifTrue, stepIndex);
        } else if (ifFalse) {
            return await this.executeStep(ifFalse, stepIndex);
        } else {
            return { type: 'condition', result: 'skipped', condition: conditionResult };
        }
    }

    /**
     * Prepare context data for agent execution
     */
    prepareAgentContext(step) {
        const agentContext = {};

        // Add workflow context
        for (const [key, value] of this.context) {
            agentContext[key] = value;
        }

        // Add step-specific context
        if (step.context) {
            Object.assign(agentContext, step.context);
        }

        // Add previous results if specified
        if (step.dependencies) {
            for (const dep of step.dependencies) {
                const depResult = this.results.get(dep);
                if (depResult) {
                    agentContext[`${dep}_result`] = depResult;
                }
            }
        }

        return agentContext;
    }

    /**
     * Evaluate conditional logic
     */
    async evaluateCondition(condition) {
        // Simple condition evaluation based on context
        // Could be extended with more sophisticated logic

        if (typeof condition === 'function') {
            return condition(this.context, this.results);
        }

        if (typeof condition === 'string') {
            // Simple string-based conditions
            return this.context.has(condition);
        }

        if (typeof condition === 'object') {
            // Object-based conditions with operators
            const { field, operator, value } = condition;
            const contextValue = this.context.get(field);

            switch (operator) {
                case 'equals':
                    return contextValue === value;
                case 'exists':
                    return this.context.has(field);
                case 'not_exists':
                    return !this.context.has(field);
                default:
                    throw new Error(`Unknown condition operator: ${operator}`);
            }
        }

        return false;
    }

    /**
     * Compile final workflow result
     */
    async compileFinalResult() {
        const finalResult = {
            workflowId: this.workflowId,
            sessionId: this.sessionId,
            executionTime: Date.now() - this.startedAt,
            stepsCompleted: this.results.size,
            totalSteps: this.definition.steps.length,
            success: true,
            results: Object.fromEntries(this.results),
            context: Object.fromEntries(this.context)
        };

        return finalResult;
    }

    /**
     * Handle execution errors
     */
    async handleExecutionError(error) {
        console.error(`❌ Workflow execution failed: ${this.workflowId}`, error.message);

        // Could implement retry logic, partial recovery, etc.
        this.context.set('error', error.message);
        this.context.set('failed_at', this.currentStep);
        this.context.set('failure_time', Date.now());
    }

    /**
     * Force stop execution
     */
    async forceStop() {
        console.log(`🛑 Force stopping workflow: ${this.workflowId}`);
        await this.cleanup();
    }

    /**
     * Cleanup workflow resources
     */
    async cleanup() {
        // Return all agents to pool
        for (const [stepName, agent] of this.agents) {
            try {
                await this.orchestrator.returnAgent(agent.agentId);
            } catch (error) {
                console.warn(`⚠️ Error returning agent during cleanup: ${agent.agentId}`);
            }
        }

        this.agents.clear();
    }
}

/**
 * Workflow Template Base Class
 */
class WorkflowTemplate {
    constructor(name, description) {
        this.name = name;
        this.description = description;
    }

    generateDefinition(parameters) {
        throw new Error('generateDefinition must be implemented by template subclass');
    }
}

/**
 * Multi-Agent Workflow Template
 */
class MultiAgentWorkflowTemplate extends WorkflowTemplate {
    constructor() {
        super('multi-agent', 'Standard multi-agent workflow with GitHub, Security, Code, Deploy agents');
    }

    generateDefinition(parameters = {}) {
        return {
            name: 'Multi-Agent Workflow',
            steps: [
                {
                    name: 'github_analysis',
                    type: 'agent',
                    agentType: 'github',
                    config: parameters.github || {}
                },
                {
                    name: 'security_scan',
                    type: 'agent',
                    agentType: 'security',
                    dependencies: ['github_analysis'],
                    config: parameters.security || {}
                },
                {
                    name: 'code_generation',
                    type: 'agent',
                    agentType: 'code',
                    dependencies: ['github_analysis', 'security_scan'],
                    config: parameters.code || {}
                },
                {
                    name: 'deployment',
                    type: 'agent',
                    agentType: 'deploy',
                    dependencies: ['code_generation'],
                    config: parameters.deploy || {}
                }
            ]
        };
    }
}

/**
 * Security Scan Template
 */
class SecurityScanTemplate extends WorkflowTemplate {
    constructor() {
        super('security-scan', 'Focused security scanning workflow');
    }

    generateDefinition(parameters = {}) {
        return {
            name: 'Security Scan Workflow',
            steps: [
                {
                    name: 'repository_analysis',
                    type: 'agent',
                    agentType: 'github',
                    config: { focus: 'security', ...parameters.github }
                },
                {
                    name: 'vulnerability_scan',
                    type: 'agent',
                    agentType: 'security',
                    dependencies: ['repository_analysis'],
                    config: { deep_scan: true, ...parameters.security }
                }
            ]
        };
    }
}

/**
 * Deployment Workflow Template
 */
class DeploymentWorkflowTemplate extends WorkflowTemplate {
    constructor() {
        super('deployment', 'Deployment-focused workflow with quality gates');
    }

    generateDefinition(parameters = {}) {
        return {
            name: 'Deployment Workflow',
            steps: [
                {
                    name: 'pre_deployment_security',
                    type: 'agent',
                    agentType: 'security',
                    config: { deployment_check: true }
                },
                {
                    name: 'deployment_execution',
                    type: 'agent',
                    agentType: 'deploy',
                    dependencies: ['pre_deployment_security'],
                    config: parameters.deploy || {}
                },
                {
                    name: 'post_deployment_verification',
                    type: 'condition',
                    condition: { field: 'deployment_execution_result', operator: 'exists' },
                    ifTrue: {
                        name: 'verify_deployment',
                        type: 'agent',
                        agentType: 'github',
                        config: { verify_deployment: true }
                    }
                }
            ]
        };
    }
}

/**
 * Code Review Template
 */
class CodeReviewTemplate extends WorkflowTemplate {
    constructor() {
        super('code-review', 'Code review workflow with multiple validation steps');
    }

    generateDefinition(parameters = {}) {
        return {
            name: 'Code Review Workflow',
            steps: [
                {
                    name: 'parallel_analysis',
                    type: 'parallel',
                    steps: [
                        {
                            name: 'security_review',
                            type: 'agent',
                            agentType: 'security'
                        },
                        {
                            name: 'code_quality_review',
                            type: 'agent',
                            agentType: 'code',
                            config: { review_mode: true }
                        }
                    ]
                },
                {
                    name: 'github_integration',
                    type: 'agent',
                    agentType: 'github',
                    dependencies: ['parallel_analysis'],
                    config: { create_review: true, ...parameters.github }
                }
            ]
        };
    }
}

module.exports = {
    WorkflowOrchestrator,
    WorkflowExecution,
    WorkflowTemplate,
    MultiAgentWorkflowTemplate,
    SecurityScanTemplate,
    DeploymentWorkflowTemplate,
    CodeReviewTemplate
};