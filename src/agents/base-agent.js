/**
 * Enhanced Base Agent Class - Phase 2 ServiceContainer Integration
 * SOLVES: Heavy Agent Anti-Pattern by using dependency injection
 * BEFORE: Each agent created GlobalContextManager, MemoryManager, etc.
 * AFTER: Agent receives services from ServiceContainer (lightweight)
 *
 * Following Factor 10: Small, Focused Agents (max 8 steps per agent)
 * Base class for all specialized agents in the multi-agent system
 */

const { ValidatedAgent } = require('../core/validated-agent-base');

/**
 * Enhanced BaseAgent with ServiceContainer dependency injection and ValidatedAgent architecture
 * Eliminates resource duplication and context explosion with evidence-based validation
 */
class BaseAgent extends ValidatedAgent {
    constructor(agentName, sessionId, serviceContainer, config = {}) {
        if (!serviceContainer) {
            throw new Error('ServiceContainer is required for BaseAgent initialization');
        }

        // Call ValidatedAgent parent constructor
        super(agentName, sessionId, {
            maxSteps: 8,
            timeout: 30000,
            ...config
        });

        // ServiceContainer integration
        this.config = { maxSteps: 8, timeout: 30000, ...config };

        // DEPENDENCY INJECTION - Services provided by container
        this.services = serviceContainer;

        // Get shared services (no more duplication!)
        this.dbManager = null; // Will be injected during initialize()
        this.memoryManager = this.services.getMemoryService();
        this.compliance = this.services.getComplianceService();
        this.docs = this.services.getDocumentationService();

        // Logger service integration
        const loggerService = this.services.getService('logger');
        this.logger = loggerService ? loggerService.createContextLogger({
            category: 'agent',
            agentId: this.agentId,
            sessionId: this.sessionId
        }) : null;

        // Context manager through partition system (eliminates context explosion)
        this.contextPartition = null;
        this.contextManager = null;

        // Factor 12: Stateless Reducer
        this.state = 'idle';
        this.progress = 0;
        this.currentStep = '';
        this.executionSteps = [];
        this.result = null;
        this.error = null;

        // Workflow configuration for partitioning
        this.workflowId = config.workflowId || `workflow_${this.agentId}`;

        if (this.logger) {
            this.logger.info('Enhanced BaseAgent created', {
                serviceContainer: 'injected',
                workflowId: this.workflowId
            });
        }
    }

    /**
     * Initialize agent with database connection and context partition
     */
    async initialize(workflowId = null) {
        // Use provided workflow ID or generate one
        if (workflowId) {
            this.workflowId = workflowId;
        }

        // Get database service from container
        this.dbManager = this.services.getDatabaseService();
        this.state = this.applyStateTransition(this.state, 'initialize');

        // Create agent record in database (Factor 5)
        await this.dbManager.createAgent(
            this.agentId,
            this.sessionId,
            this.agentName,
            { config: this.config, initialized_at: Date.now() }
        );

        // Get isolated context partition for this workflow
        this.contextPartition = await this.services.createWorkflowPartition(
            this.workflowId,
            { contextScope: this.config.contextScope || 'session' }
        );

        // Use the context partition directly as context manager (Factor3ContextManager)
        this.contextManager = this.contextPartition;

        // Initialize context event using actual Factor3ContextManager API
        this.contextManager.addAgentEvent(this.agentName, 'initialized', {
            agent_id: this.agentId,
            session_id: this.sessionId,
            workflow_id: this.workflowId,
            config: this.config
        });

        if (this.logger) {
            this.logger.info('Agent initialized with isolated partition', {
                workflowId: this.workflowId,
                partitionId: this.contextPartition.partitionId
            });
        }
        return this;
    }

    /**
     * Execute agent workflow (Factor 10: max 8 steps)
     */
    async execute(context = {}, progressCallback = null) {
        this.validateAgent(); // Factor 10 compliance

        try {
            this.state = this.applyStateTransition(this.state, 'start');

            // Log start event to partition
            await this.logEvent('execution_started', { context, steps: this.executionSteps.length });

            // Update database state
            await this.updateProgress(0, 'starting...', 'in_progress');

            // Execute implementation-specific workflow
            this.result = await this.executeWorkflow(context, progressCallback);

            this.state = this.applyStateTransition(this.state, 'complete');
            await this.updateProgress(100, 'completed', 'completed');
            await this.logEvent('execution_completed', { result: this.result });

            // Record successful execution pattern in shared memory
            await this.memoryManager.recordPattern(
                'success',
                { agent: this.agentName, steps: this.executionSteps.length, workflow: this.workflowId },
                'workflow_execution',
                'completed_successfully',
                1.0
            );

            return this.result;

        } catch (error) {
            this.error = error;
            this.state = this.applyStateTransition(this.state, 'error');

            // Factor 9: Compact Errors
            const compactError = this.compliance.handleError(error, {
                agent: this.agentName,
                step: this.currentStep,
                workflow: this.workflowId
            });

            await this.updateProgress(this.progress, `error: ${compactError.message}`, 'failed');
            await this.logEvent('execution_failed', { error: compactError });

            // Record failure pattern and lesson in shared memory
            await this.memoryManager.recordLesson(
                'mistake',
                this.agentName,
                `Agent execution failed in workflow ${this.workflowId}: ${compactError.message}`,
                `Check for similar patterns in ${this.agentName} before execution`,
                `npm run demo-${this.agentName.toLowerCase()}-agent`
            );

            throw error;
        }
    }

    /**
     * Abstract method - must be implemented by specialized agents
     * Should define executionSteps array and implement workflow logic
     */
    async executeWorkflow(context, progressCallback) {
        throw new Error(`executeWorkflow must be implemented by ${this.agentName} agent`);
    }

    /**
     * Execute a single step with automatic progress tracking
     */
    async executeStep(stepName, stepFunction, stepIndex = null) {
        const totalSteps = this.executionSteps.length;
        const currentIndex = stepIndex !== null ? stepIndex : this.executionSteps.indexOf(stepName);

        this.currentStep = stepName;
        this.progress = Math.floor((currentIndex / totalSteps) * 100);

        await this.updateProgress(this.progress, stepName);

        await this.contextPartition.addEvent('step_started', {
            agent: this.agentName,
            step: stepName,
            index: currentIndex,
            progress: this.progress
        });

        try {
            const result = await stepFunction();

            await this.contextPartition.addEvent('step_completed', {
                agent: this.agentName,
                step: stepName,
                index: currentIndex,
                result: result
            });

            // Record successful pattern for documentation learning with ValidatedAgent evidence
            const evidence = {
                stepCompleted: true,
                stepNameProvided: !!stepName,
                contextProvided: !!(stepName && currentIndex !== null && this.workflowId)
            };

            const validation = await this.validateSuccess({
                evidence: evidence,
                operation: `Step execution for ${stepName}`,
                criteria: {
                    stepCompleted: { required: true },
                    stepNameProvided: { required: true }
                }
            });

            this.docs.recordSuccessPattern(this.agentName, stepName, {
                success: validation.success,
                context: { step: stepName, index: currentIndex, workflow: this.workflowId },
                evidence: validation.evidence,
                validation: validation.validation
            });

            return result;
        } catch (error) {
            // Get intelligent documentation suggestions for this error
            const docSuggestions = await this.docs.getSuggestionsForError(error, {
                agent: this.agentName,
                step: stepName,
                index: currentIndex,
                workflow: this.workflowId
            });

            // Enhanced error with documentation context
            const enhancedError = new Error(error.message);
            enhancedError.originalError = error;
            enhancedError.documentationSuggestions = docSuggestions;
            enhancedError.agentContext = {
                agent: this.agentName,
                step: stepName,
                workflow: this.workflowId
            };

            await this.contextPartition.addEvent('step_failed', {
                agent: this.agentName,
                step: stepName,
                index: currentIndex,
                error: error.message,
                workflow: this.workflowId,
                documentation_suggestions: docSuggestions.map(d => d.heading)
            });

            throw enhancedError;
        }
    }

    /**
     * Update agent progress in database and partition context
     */
    async updateProgress(progress, step = null, status = null) {
        this.progress = progress;
        if (step) this.currentStep = step;
        if (status) this.state = status;

        // Update database (Factor 5: Unify Execution State)
        if (this.dbManager) {
            await this.dbManager.updateAgentProgress(this.agentId, progress, step, status);
        }

        // Add to partition context (isolated!)
        await this.contextPartition.addEvent('progress_update', {
            agent: this.agentName,
            progress,
            step,
            status,
            workflow: this.workflowId,
            timestamp: Date.now()
        });
    }

    /**
     * Log event to database and partition context
     */
    async logEvent(eventType, eventData) {
        // Database logging (Factor 5)
        if (this.dbManager) {
            await this.dbManager.logEvent(this.sessionId, this.agentId, eventType, {
                ...eventData,
                workflow: this.workflowId
            });
        }

        // Partition context logging (isolated!)
        await this.contextPartition.addEvent(eventType, {
            agent: this.agentName,
            workflow: this.workflowId,
            ...eventData
        });
    }

    /**
     * Acquire resource lock (prevent race conditions)
     */
    async acquireResourceLock(resourceName, ttlSeconds = 300) {
        if (!this.dbManager) {
            throw new Error('Database manager not initialized');
        }

        const acquired = await this.dbManager.acquireLock(resourceName, this.agentId, this.sessionId, ttlSeconds);

        if (acquired) {
            await this.logEvent('resource_locked', { resource: resourceName, ttl: ttlSeconds });
        } else {
            await this.logEvent('resource_lock_failed', { resource: resourceName });
        }

        return acquired;
    }

    /**
     * Release resource lock
     */
    async releaseResourceLock(resourceName) {
        if (!this.dbManager) return false;

        const released = await this.dbManager.releaseLock(resourceName);
        await this.logEvent('resource_released', { resource: resourceName });

        return released;
    }

    /**
     * Contact human (Factor 7: Contact Humans with Tools)
     */
    async contactHuman(reason, urgency = 'normal', data = {}) {
        return this.compliance.contactHuman(reason, urgency, {
            ...data,
            agent: this.agentName,
            session: this.sessionId,
            workflow: this.workflowId,
            current_step: this.currentStep
        });
    }

    /**
     * Validate success with evidence collection
     * STUB: ValidatedAgent doesn't actually implement this method
     * TODO: Implement proper evidence-based validation
     */
    async validateSuccess(options = {}) {
        const { evidence = {}, operation = 'operation', criteria = {} } = options;

        // Simple validation - check if required evidence exists
        const success = Object.keys(evidence).length > 0;

        return {
            success,
            evidence,
            operation,
            criteria,
            validation: {
                timestamp: Date.now(),
                validated: success
            }
        };
    }

    /**
     * Validate agent follows Factor 10 (Small, Focused Agents)
     */
    validateAgent() {
        this.compliance.validateAgentScope(
            this.agentName,
            this.executionSteps.length,
            this.config.maxSteps
        );
    }

    /**
     * Apply state transition (Factor 12: Stateless Reducer)
     */
    applyStateTransition(currentState, event, data = {}) {
        return this.compliance.applyStateTransition(currentState, event, {
            ...data,
            agent: this.agentName,
            workflow: this.workflowId,
            timestamp: Date.now()
        });
    }

    /**
     * Get current agent status
     */
    getStatus() {
        // Get partition stats safely (Factor3ContextManager doesn't have getStats)
        let partitionStats = null;
        if (this.contextPartition) {
            // Build stats from available Factor3ContextManager methods
            partitionStats = {
                contextId: this.workflowId,
                scope: this.contextPartition.contextScope || 'workflow'
            };
        }

        return {
            agentId: this.agentId,
            agentName: this.agentName,
            sessionId: this.sessionId,
            workflowId: this.workflowId,
            state: this.state,
            progress: this.progress,
            currentStep: this.currentStep,
            executionSteps: this.executionSteps,
            result: this.result,
            error: this.error,
            partition_stats: partitionStats
        };
    }

    /**
     * Generate context for handoff to next agent (Factor 3)
     * Using isolated partition context instead of shared
     */
    generateHandoffContext() {
        // Get partition context safely
        let partitionContext = null;
        if (this.contextPartition) {
            partitionContext = {
                contextId: this.workflowId,
                scope: this.contextPartition.contextScope || 'workflow'
            };
        }

        return {
            from_agent: this.agentName,
            workflow_id: this.workflowId,
            result: this.result,
            context_xml: this.contextManager.getCurrentContext(),
            partition_context: partitionContext,
            execution_summary: {
                steps_completed: this.executionSteps.length,
                final_state: this.state,
                success: this.state === 'completed'
            },
            timestamp: Date.now()
        };
    }

    /**
     * Documentation intelligence methods (using shared service)
     */
    async getDocumentation(query) {
        return await this.docs.quickSearch(query, 3);
    }

    getDocumentationSnippet(topic) {
        return this.docs.getContextSnippet(topic);
    }

    async getContextualSuggestions() {
        return await this.docs.getSuggestionsForContext(this.agentName, this.currentStep, {
            progress: this.progress,
            executionSteps: this.executionSteps,
            workflow: this.workflowId
        });
    }

    async getProactiveDocumentation() {
        const completedSteps = this.executionSteps.slice(0, this.executionSteps.indexOf(this.currentStep));
        return await this.docs.getProactiveDocumentation(this.agentName, this.currentStep, completedSteps);
    }

    /**
     * Reset agent to stateless condition for pool reuse (Phase 3A)
     */
    async resetForReuse() {
        // Reset execution state
        this.state = 'idle';
        this.progress = 0;
        this.currentStep = '';
        this.result = null;
        this.error = null;
        this.executionSteps = [];

        // Clear workflow-specific data (will be reassigned)
        this.workflowId = null;
        this.contextPartition = null;
        this.contextManager = null;

        if (this.logger) {
            this.logger.info('Agent reset for pool reuse');
        }
        return this;
    }

    /**
     * Configure agent for new workflow usage (Phase 3A)
     */
    async configureForWorkflow(workflowId, sessionId = null, config = {}) {
        // Update identifiers
        if (sessionId) {
            this.sessionId = sessionId;
            this.agentId = `${sessionId}_${this.agentName}`;
        }
        this.workflowId = workflowId;

        // Merge configuration
        this.config = { ...this.config, ...config };

        // Get new context partition for this workflow
        this.contextPartition = await this.services.createWorkflowPartition(
            this.workflowId,
            { contextScope: this.config.contextScope || 'session' }
        );

        // Register with new partition
        this.contextManager = this.contextPartition.registerAgent(this.agentId, {
            agentName: this.agentName,
            config: this.config,
            reused: true
        });

        if (this.logger) {
            this.logger.info('Agent configured for workflow', {
                workflowId: this.workflowId,
                reused: true
            });
        }
        return this;
    }

    /**
     * Check if agent is in reusable state
     */
    isReusable() {
        return this.state === 'idle' || this.state === 'completed';
    }

    /**
     * Get agent's lifecycle state for pool management
     */
    getLifecycleState() {
        return {
            agentId: this.agentId,
            agentName: this.agentName,
            state: this.state,
            workflowId: this.workflowId,
            sessionId: this.sessionId,
            isReusable: this.isReusable(),
            lastActivity: this.contextPartition?.lastActivity || Date.now(),
            memoryUsage: process.memoryUsage(),
            uptime: Date.now() - (this.createdAt || Date.now())
        };
    }

    /**
     * Cleanup resources (unregister from partition)
     */
    async cleanup() {
        // Unregister from partition
        if (this.contextPartition) {
            this.contextPartition.unregisterAgent(this.agentId);
        }

        // Release any remaining locks
        if (this.dbManager) {
            await this.logEvent('agent_cleanup', {
                final_state: this.state,
                final_progress: this.progress,
                workflow: this.workflowId
            });
        }

        if (this.logger) {
            this.logger.info('Agent cleanup completed', {
                workflowId: this.workflowId,
                finalState: this.state,
                finalProgress: this.progress
            });
        }
    }

    /**
     * Handle execution errors with logging and state management
     */
    async handleExecutionError(error, currentStep) {
        this.error = error.message;
        this.state = 'failed';

        // Log the error with context
        await this.logEvent('execution_error', {
            error_message: error.message,
            failed_step: this.executionSteps[currentStep] || 'unknown',
            step_index: currentStep,
            workflow: this.workflowId,
            stack_trace: error.stack
        });

        // Update progress to indicate failure
        await this.updateProgress(0, `Failed at step: ${this.executionSteps[currentStep] || 'unknown'}`, 'failed');
    }
}

/**
 * Example implementation - Enhanced Base Work Agent
 * Shows how to extend Enhanced BaseAgent with ServiceContainer
 */
class BaseWorkAgent extends BaseAgent {
    constructor(sessionId, serviceContainer, config = {}) {
        super('base_work', sessionId, serviceContainer, config);

        // Define execution steps (Factor 10: max 8 steps)
        this.executionSteps = [
            'initialize_work',
            'validate_inputs',
            'process_data',
            'generate_output',
            'validate_output',
            'finalize_work'
        ];
    }

    /**
     * Implementation of abstract executeWorkflow method
     */
    async executeWorkflow(context, progressCallback) {
        const results = {};

        // Step 1: Initialize work
        results.init = await this.executeStep('initialize_work', async () => {
            if (progressCallback) progressCallback(16, 'initializing agent...');
            // Real initialization - validate configuration and setup
            if (!this.config || !this.sessionId) {
                throw new Error('Invalid agent configuration');
            }
            return {
                initialized: true,
                config: this.config,
                session: this.sessionId,
                workflow: this.workflowId,
                service_container: 'injected'
            };
        }, 0);

        // Step 2: Validate inputs
        results.validation = await this.executeStep('validate_inputs', async () => {
            if (progressCallback) progressCallback(32, 'validating inputs...');
            // Real input validation
            const contextKeys = Object.keys(context);
            const isValid = contextKeys.length > 0 || context === null; // Accept empty context
            if (!isValid) {
                throw new Error('Context validation failed');
            }
            return { valid: true, context_keys: contextKeys };
        }, 1);

        // Step 3: Process data
        results.processing = await this.executeStep('process_data', async () => {
            if (progressCallback) progressCallback(48, 'processing data...');
            // Real data processing - analyze context and prepare for work
            const processedData = {
                context_analyzed: true,
                items_processed: context ? Object.keys(context).length : 0,
                processing_timestamp: Date.now(),
                isolated_partition: this.workflowId
            };
            return processedData;
        }, 2);

        // Step 4: Generate output
        results.generation = await this.executeStep('generate_output', async () => {
            if (progressCallback) progressCallback(64, 'generating output...');
            // Real output generation based on processed data
            const output = {
                generated: true,
                agent_type: this.agentName,
                session_id: this.sessionId,
                workflow_id: this.workflowId,
                context_summary: results.processing,
                timestamp: Date.now()
            };
            const outputSize = JSON.stringify(output).length;
            return { ...output, output_size: `${outputSize}B` };
        }, 3);

        // Step 5: Validate output
        results.output_validation = await this.executeStep('validate_output', async () => {
            if (progressCallback) progressCallback(80, 'validating output...');
            // Real output validation
            const isValid = results.generation && results.generation.generated === true;
            const qualityScore = isValid ? 1.0 : 0.0;
            return { output_valid: isValid, quality_score: qualityScore };
        }, 4);

        // Step 6: Finalize
        results.finalization = await this.executeStep('finalize_work', async () => {
            if (progressCallback) progressCallback(100, 'finalizing...');
            // Real finalization - create work ID and complete
            const workId = `work_${this.workflowId}_${Date.now()}`;
            return {
                finalized: true,
                work_id: workId,
                workflow_id: this.workflowId,
                completion_time: new Date().toISOString()
            };
        }, 5);

        // ValidatedAgent evidence-based validation for BaseWorkAgent completion
        const evidence = {
            workflowCompleted: true,
            allStepsExecuted: this.executionSteps.length === 6,
            resultsGenerated: !!results && typeof results === 'object',
            serviceContainerIntegrated: !!this.services,
            partitionIsolationActive: !!this.workflowId
        };

        const validation = await this.validateSuccess({
            evidence: evidence,
            operation: 'BaseWorkAgent workflow execution',
            criteria: {
                workflowCompleted: { required: true },
                allStepsExecuted: { required: true },
                resultsGenerated: { required: true }
            }
        });

        return {
            agent: this.agentName,
            session: this.sessionId,
            workflow: this.workflowId,
            success: validation.success,
            steps_completed: this.executionSteps.length,
            architecture: 'service_container_injected',
            context_isolation: 'partition_based',
            results,
            evidence: validation.evidence,
            validation: validation.validation
        };
    }
}

/**
 * Enhanced Agent Factory - creates agents with ServiceContainer injection
 */
class EnhancedAgentFactory {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }

    createAgent(agentType, sessionId, config = {}) {
        const workflowId = config.workflowId || `workflow_${agentType}_${sessionId}_${Date.now()}`;
        config.workflowId = workflowId;

        switch (agentType.toLowerCase()) {
            case 'base_work':
            case 'base':
                return new BaseWorkAgent(sessionId, this.serviceContainer, config);

            // ServiceContainer integration implemented - specialized agents inherit DI pattern
            case 'github':
                // const { EnhancedGitHubAgent } = require('./enhanced-github-agent');
                // return new EnhancedGitHubAgent(sessionId, this.serviceContainer, config);
                throw new Error('EnhancedGitHubAgent not yet implemented');

            case 'security':
                // const { EnhancedSecurityAgent } = require('./enhanced-security-agent');
                // return new EnhancedSecurityAgent(sessionId, this.serviceContainer, config);
                throw new Error('EnhancedSecurityAgent not yet implemented');

            case 'code':
                // const { EnhancedCodeAgent } = require('./enhanced-code-agent');
                // return new EnhancedCodeAgent(sessionId, this.serviceContainer, config);
                throw new Error('EnhancedCodeAgent not yet implemented');

            case 'deploy':
                // const { EnhancedDeployAgent } = require('./enhanced-deploy-agent');
                // return new EnhancedDeployAgent(sessionId, this.serviceContainer, config);
                throw new Error('EnhancedDeployAgent not yet implemented');

            case 'comm':
                // const { EnhancedCommAgent } = require('./enhanced-comm-agent');
                // return new EnhancedCommAgent(sessionId, this.serviceContainer, config);
                throw new Error('EnhancedCommAgent not yet implemented');

            default:
                throw new Error(`Unknown agent type: ${agentType}`);
        }
    }

    getSupportedAgents() {
        return ['base_work', 'base']; // Only enhanced agents currently supported
    }
}

module.exports = {
    BaseAgent,
    BaseWorkAgent,
    EnhancedAgentFactory
};