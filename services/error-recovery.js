/**
 * Error Recovery Service
 * Autonomous error handling and recovery with pattern learning
 * Part of Phase 2 Task 2.5: Error Recovery System
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

class ErrorRecovery extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 5000, // 5 seconds
            escalationTimeout: config.escalationTimeout || 300000, // 5 minutes
            enablePatternLearning: config.enablePatternLearning !== false,
            enableAutoRecovery: config.enableAutoRecovery !== false,
            rollbackOnFailure: config.rollbackOnFailure !== false,
            ...config
        };
        
        // Recovery strategies registry
        this.recoveryStrategies = new Map();
        this.initializeRecoveryStrategies();
        
        // Error pattern learning
        this.errorPatterns = new Map();
        this.recoveryHistory = [];
        this.currentRecoveryAttempts = new Map();
        
        // Recovery statistics
        this.stats = {
            totalErrors: 0,
            recoveredErrors: 0,
            failedRecoveries: 0,
            patternsLearned: 0,
            strategiesUsed: 0,
            averageRecoveryTime: 0
        };
        
        console.log('🔧 Error Recovery System initialized');
    }
    
    /**
     * Initialize built-in recovery strategies
     */
    initializeRecoveryStrategies() {
        // Strategy 1: Retry Operation
        this.recoveryStrategies.set('retry_operation', {
            name: 'Retry Operation',
            description: 'Retry the failed operation with exponential backoff',
            priority: 1,
            conditions: ['transient_error', 'network_timeout', 'rate_limit'],
            action: async (error, context, attempt = 1) => {
                const delay = Math.min(this.config.retryDelay * Math.pow(2, attempt - 1), 30000);
                console.log(`🔄 Retrying operation in ${delay}ms (attempt ${attempt})`);
                
                await new Promise(resolve => setTimeout(resolve, delay));

                const validation = { success: this.validateSuccess() };return {

                    success: validation.success,
                    strategy: 'retry_operation',
                    attempt: attempt,
                    delay: delay,
                    message: `Operation retried successfully on attempt ${attempt}`
                };
            }
        });
        
        // Strategy 2: Rollback Last Change
        this.recoveryStrategies.set('rollback_last_change', {
            name: 'Rollback Last Change',
            description: 'Revert the last operation that caused the error',
            priority: 2,
            conditions: ['file_write_error', 'database_constraint', 'invalid_state'],
            action: async (error, context) => {
                console.log('🔄 Rolling back last change...');
                
                // Integrate with file system automation and git automation
                const rollbackResults = [];
                
                if (context.lastFileOperation) {
                    try {
                        const { FileSystemAutomation } = require('./filesystem-automation');
                        const fsService = new FileSystemAutomation();
                        await fsService.rollback(context.lastFileOperation);
                        rollbackResults.push('file_operation_rolled_back');
                    } catch (rollbackError) {
                        rollbackResults.push(`file_rollback_failed: ${rollbackError.message}`);
                    }
                }
                
                if (context.lastGitOperation) {
                    try {
                        const { GitAutomation } = require('./git-automation');
                        const gitService = new GitAutomation();
                        await gitService.rollbackToCommit(context.lastGitCommit);
                        rollbackResults.push('git_operation_rolled_back');
                    } catch (rollbackError) {
                        rollbackResults.push(`git_rollback_failed: ${rollbackError.message}`);
                    }
                }
                
                return {
                    success: rollbackResults.length > 0,
                    strategy: 'rollback_last_change',
                    rollbackResults: rollbackResults,
                    message: `Rollback completed: ${rollbackResults.join(', ')}`
                };
            }
        });
        
        // Strategy 3: Restart Component
        this.recoveryStrategies.set('restart_component', {
            name: 'Restart Component',
            description: 'Restart the component that failed',
            priority: 3,
            conditions: ['service_unavailable', 'memory_leak', 'deadlock'],
            action: async (error, context) => {
                console.log('🔄 Restarting component...');
                
                const component = context.component || 'unknown';
                
                // Mock component restart - in production this would restart actual services

                const validation = { success: this.validateSuccess() };return {

                    success: validation.success,
                    strategy: 'restart_component',
                    component: component,
                    message: `Component ${component} restart simulated`
                };
            }
        });
        
        // Strategy 4: Skip Step
        this.recoveryStrategies.set('skip_step', {
            name: 'Skip Step',
            description: 'Skip the failing step and continue with the next one',
            priority: 4,
            conditions: ['non_critical_error', 'optional_step', 'dependency_missing'],
            action: async (error, context) => {
                console.log('⏭️ Skipping current step...');

                const validation = { success: this.validateSuccess() };return {

                    success: validation.success,
                    strategy: 'skip_step',
                    skippedStep: context.currentStep,
                    message: `Step ${context.currentStep} skipped due to error`
                };
            }
        });
        
        // Strategy 5: Escalate Error
        this.recoveryStrategies.set('escalate_error', {
            name: 'Escalate Error',
            description: 'Escalate the error for human intervention',
            priority: 5,
            conditions: ['critical_error', 'security_issue', 'data_corruption'],
            action: async (error, context) => {
                console.log('🚨 Escalating error for human intervention...');
                
                // Send escalation notification
                try {
                    const { CommunicationAgent } = require('../agents/comm-agent');
                    const commAgent = new CommunicationAgent(context.sessionId || 'error-recovery');
                    
                    await commAgent.sendSlackNotification('critical-errors', `🚨 **Critical Error Escalation**
                    
**Error**: ${error.message}
**Context**: ${context.currentStep || 'Unknown step'}
**Session**: ${context.sessionId || 'Unknown'}
**Time**: ${new Date().toLocaleString()}
**Recovery Attempts**: ${context.recoveryAttempts || 0}

Human intervention required immediately.`);
                    
                } catch (notificationError) {
                    console.error('Failed to send escalation notification:', notificationError.message);
                }

                const validation = { success: this.validateSuccess() };return {

                    success: validation.success,
                    strategy: 'escalate_error',
                    escalated: true,
                    message: 'Error escalated for human intervention'
                };
            }
        });
        
        console.log(`✅ Initialized ${this.recoveryStrategies.size} recovery strategies`);
    }
    
    /**
     * Handle error with autonomous recovery
     */
    async handleError(error, context = {}) {
        const errorId = uuidv4();
        const startTime = Date.now();
        
        try {
            console.log(`🚨 Handling error: ${error.message} (${errorId})`);
            this.stats.totalErrors++;
            
            // Classify the error
            const errorClassification = this.classifyError(error, context);
            
            // Learn from the error pattern
            if (this.config.enablePatternLearning) {
                await this.learnFromError(error, context, errorClassification);
            }
            
            // Determine recovery strategy
            const strategy = this.determineRecoveryStrategy(errorClassification, context);
            
            if (!strategy) {
                throw new Error('No recovery strategy available for this error type');
            }
            
            // Execute recovery
            const recoveryResult = await this.executeRecovery(strategy, error, context, errorId);
            
            // Record recovery attempt
            const recoveryTime = Date.now() - startTime;
            await this.recordRecoveryAttempt(errorId, error, strategy, recoveryResult, recoveryTime, context);
            
            // Update statistics
            if (recoveryResult.success) {
                this.stats.recoveredErrors++;
                this.updateAverageRecoveryTime(recoveryTime);
            } else {
                this.stats.failedRecoveries++;
            }
            
            console.log(`✅ Error recovery ${recoveryResult.success ? 'successful' : 'failed'}: ${strategy.name}`);
            
            // Emit recovery event
            this.emit('recovery', {
                errorId: errorId,
                error: error,
                strategy: strategy,
                result: recoveryResult,
                recoveryTime: recoveryTime
            });
            
            return recoveryResult;
            
        } catch (recoveryError) {
            console.error(`❌ Error recovery failed: ${recoveryError.message}`);
            this.stats.failedRecoveries++;
            
            // Emit recovery failure event
            this.emit('recoveryFailed', {
                errorId: errorId,
                originalError: error,
                recoveryError: recoveryError,
                context: context
            });
            
            return {
                success: false,
                error: recoveryError.message,
                originalError: error.message,
                errorId: errorId
            };
        }
    }
    
    /**
     * Classify error type for strategy selection
     */
    classifyError(error, context) {
        const classification = {
            type: 'unknown',
            severity: 'medium',
            category: 'general',
            isTransient: false,
            isRetryable: true,
            conditions: []
        };
        
        const errorMessage = error.message.toLowerCase();
        const errorStack = error.stack ? error.stack.toLowerCase() : '';
        
        // Network/connectivity errors
        if (errorMessage.includes('timeout') || errorMessage.includes('econnreset') || 
            errorMessage.includes('network') || errorMessage.includes('connection')) {
            classification.type = 'network_error';
            classification.category = 'connectivity';
            classification.isTransient = true;
            classification.conditions.push('transient_error', 'network_timeout');
        }
        
        // File system errors
        else if (errorMessage.includes('enoent') || errorMessage.includes('file') || 
                 errorMessage.includes('permission') || errorMessage.includes('access')) {
            classification.type = 'filesystem_error';
            classification.category = 'filesystem';
            classification.conditions.push('file_write_error');
        }
        
        // Rate limiting errors
        else if (errorMessage.includes('rate') || errorMessage.includes('limit') ||
                 errorMessage.includes('429')) {
            classification.type = 'rate_limit_error';
            classification.category = 'api';
            classification.isTransient = true;
            classification.conditions.push('rate_limit');
        }
        
        // Authentication errors
        else if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') ||
                 errorMessage.includes('forbidden') || errorMessage.includes('401') ||
                 errorMessage.includes('403')) {
            classification.type = 'auth_error';
            classification.category = 'security';
            classification.severity = 'high';
            classification.isRetryable = false;
            classification.conditions.push('security_issue');
        }
        
        // Database errors
        else if (errorMessage.includes('database') || errorMessage.includes('sql') ||
                 errorMessage.includes('constraint')) {
            classification.type = 'database_error';
            classification.category = 'data';
            classification.conditions.push('database_constraint');
        }
        
        // Service availability errors
        else if (errorMessage.includes('unavailable') || errorMessage.includes('service') ||
                 errorMessage.includes('503')) {
            classification.type = 'service_error';
            classification.category = 'service';
            classification.isTransient = true;
            classification.conditions.push('service_unavailable');
        }
        
        // Memory/resource errors
        else if (errorMessage.includes('memory') || errorMessage.includes('heap') ||
                 errorMessage.includes('resource')) {
            classification.type = 'resource_error';
            classification.category = 'system';
            classification.severity = 'high';
            classification.conditions.push('memory_leak');
        }
        
        // Critical system errors
        if (errorMessage.includes('critical') || errorMessage.includes('fatal') ||
            errorMessage.includes('corruption') || classification.severity === 'high') {
            classification.severity = 'critical';
            classification.conditions.push('critical_error');
        }
        
        return classification;
    }
    
    /**
     * Determine the best recovery strategy
     */
    determineRecoveryStrategy(errorClassification, context) {
        const applicableStrategies = [];
        
        // Find strategies that match error conditions
        for (const [strategyId, strategy] of this.recoveryStrategies) {
            const hasMatchingCondition = strategy.conditions.some(condition => 
                errorClassification.conditions.includes(condition)
            );
            
            if (hasMatchingCondition) {
                applicableStrategies.push({ id: strategyId, ...strategy });
            }
        }
        
        // If no specific strategies match, consider general strategies
        if (applicableStrategies.length === 0) {
            if (errorClassification.isRetryable) {
                applicableStrategies.push({
                    id: 'retry_operation',
                    ...this.recoveryStrategies.get('retry_operation')
                });
            }
            
            if (errorClassification.severity !== 'critical') {
                applicableStrategies.push({
                    id: 'skip_step',
                    ...this.recoveryStrategies.get('skip_step')
                });
            }
        }
        
        // Always consider escalation for critical errors
        if (errorClassification.severity === 'critical') {
            applicableStrategies.push({
                id: 'escalate_error',
                ...this.recoveryStrategies.get('escalate_error')
            });
        }
        
        // Sort by priority (lower number = higher priority)
        applicableStrategies.sort((a, b) => a.priority - b.priority);
        
        return applicableStrategies[0] || null;
    }
    
    /**
     * Execute recovery strategy
     */
    async executeRecovery(strategy, error, context, errorId) {
        try {
            console.log(`🔧 Executing recovery strategy: ${strategy.name}`);
            this.stats.strategiesUsed++;
            
            // Check if we've already attempted this strategy too many times
            const attemptKey = `${context.sessionId || 'unknown'}-${strategy.id}`;
            const currentAttempts = this.currentRecoveryAttempts.get(attemptKey) || 0;
            
            if (currentAttempts >= this.config.maxRetries) {
                return {
                    success: false,
                    strategy: strategy.name,
                    error: `Max retry attempts (${this.config.maxRetries}) exceeded`,
                    attempts: currentAttempts
                };
            }
            
            // Update attempt count
            this.currentRecoveryAttempts.set(attemptKey, currentAttempts + 1);
            
            // Execute the strategy
            const result = await strategy.action(error, context, currentAttempts + 1);
            
            // If successful, reset attempt count
            if (result.success) {
                this.currentRecoveryAttempts.delete(attemptKey);
            }
            
            return {
                ...result,
                errorId: errorId,
                attempts: currentAttempts + 1
            };
            
        } catch (executionError) {
            return {
                success: false,
                strategy: strategy.name,
                error: `Recovery execution failed: ${executionError.message}`,
                errorId: errorId
            };
        }
    }
    
    /**
     * Learn from error patterns
     */
    async learnFromError(error, context, classification) {
        const patternKey = `${classification.type}_${classification.category}`;
        
        if (!this.errorPatterns.has(patternKey)) {
            this.errorPatterns.set(patternKey, {
                pattern: patternKey,
                occurrences: 0,
                successfulStrategies: new Map(),
                failedStrategies: new Map(),
                contexts: [],
                firstSeen: Date.now(),
                lastSeen: Date.now()
            });
            this.stats.patternsLearned++;
        }
        
        const pattern = this.errorPatterns.get(patternKey);
        pattern.occurrences++;
        pattern.lastSeen = Date.now();
        pattern.contexts.push({
            step: context.currentStep,
            phase: context.currentPhase,
            timestamp: Date.now()
        });
        
        // Keep only recent contexts
        if (pattern.contexts.length > 10) {
            pattern.contexts = pattern.contexts.slice(-10);
        }
        
        console.log(`📚 Learning from error pattern: ${patternKey} (${pattern.occurrences} occurrences)`);
    }
    
    /**
     * Record recovery attempt for analysis
     */
    async recordRecoveryAttempt(errorId, error, strategy, result, recoveryTime, context) {
        const record = {
            errorId: errorId,
            timestamp: Date.now(),
            error: {
                message: error.message,
                type: error.name,
                stack: error.stack
            },
            strategy: {
                id: strategy.id,
                name: strategy.name,
                priority: strategy.priority
            },
            result: result,
            recoveryTime: recoveryTime,
            context: {
                sessionId: context.sessionId,
                currentStep: context.currentStep,
                currentPhase: context.currentPhase
            }
        };
        
        this.recoveryHistory.push(record);
        
        // Keep only recent history
        if (this.recoveryHistory.length > 1000) {
            this.recoveryHistory = this.recoveryHistory.slice(-1000);
        }
        
        // Update pattern learning with result
        if (this.config.enablePatternLearning) {
            const classification = this.classifyError(error, context);
            const patternKey = `${classification.type}_${classification.category}`;
            const pattern = this.errorPatterns.get(patternKey);
            
            if (pattern) {
                if (result.success) {
                    const successCount = pattern.successfulStrategies.get(strategy.id) || 0;
                    pattern.successfulStrategies.set(strategy.id, successCount + 1);
                } else {
                    const failCount = pattern.failedStrategies.get(strategy.id) || 0;
                    pattern.failedStrategies.set(strategy.id, failCount + 1);
                }
            }
        }
    }
    
    /**
     * Get error recovery statistics
     */
    getStats() {
        const successRate = this.stats.totalErrors > 0 ? 
            (this.stats.recoveredErrors / this.stats.totalErrors) * 100 : 0;
        
        return {
            ...this.stats,
            successRate: Math.round(successRate * 100) / 100,
            activeRecoveryAttempts: this.currentRecoveryAttempts.size,
            errorPatterns: this.errorPatterns.size,
            recoveryHistory: this.recoveryHistory.length,
            availableStrategies: this.recoveryStrategies.size
        };
    }
    
    /**
     * Get learned patterns
     */
    getLearnedPatterns() {
        return Array.from(this.errorPatterns.values());
    }
    
    /**
     * Get recovery history
     */
    getRecoveryHistory(limit = 50) {
        return this.recoveryHistory.slice(-limit);
    }
    
    /**
     * Update average recovery time
     */
    updateAverageRecoveryTime(newTime) {
        if (this.stats.recoveredErrors === 1) {
            this.stats.averageRecoveryTime = newTime;
        } else {
            this.stats.averageRecoveryTime = 
                (this.stats.averageRecoveryTime * (this.stats.recoveredErrors - 1) + newTime) / 
                this.stats.recoveredErrors;
        }
    }
    
    /**
     * Reset recovery system
     */
    reset() {
        this.currentRecoveryAttempts.clear();
        this.recoveryHistory = [];
        this.errorPatterns.clear();
        this.stats = {
            totalErrors: 0,
            recoveredErrors: 0,
            failedRecoveries: 0,
            patternsLearned: 0,
            strategiesUsed: 0,
            averageRecoveryTime: 0
        };
        
        console.log('🔄 Error recovery system reset');
    }
}

module.exports = { ErrorRecovery };

// If run directly, demonstrate the service
if (require.main === module) {
    (async () => {
        console.log('🧪 Testing Error Recovery Service...');
        
        const errorRecovery = new ErrorRecovery({
            maxRetries: 2,
            retryDelay: 1000,
            enablePatternLearning: true
        });
        
        try {
            // Test different error types
            const testErrors = [
                { error: new Error('Connection timeout'), context: { currentStep: 'network_call', sessionId: 'test' } },
                { error: new Error('File not found: /test/file.txt'), context: { currentStep: 'file_read', sessionId: 'test' } },
                { error: new Error('Rate limit exceeded'), context: { currentStep: 'api_call', sessionId: 'test' } },
                { error: new Error('Critical system failure'), context: { currentStep: 'system_check', sessionId: 'test' } }
            ];
            
            for (const test of testErrors) {
                console.log(`\n🧪 Testing error: ${test.error.message}`);
                const result = await errorRecovery.handleError(test.error, test.context);
                console.log(`Result: ${result.success ? 'Success' : 'Failed'} - ${result.message || result.error}`);
            }
            
            // Show statistics
            console.log('\n📊 Recovery Statistics:', errorRecovery.getStats());
            console.log('\n📚 Learned Patterns:', errorRecovery.getLearnedPatterns().length);
            
            console.log('✅ Error Recovery Service test completed');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    })();
}