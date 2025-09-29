/**
 * Claude Error Handler - SESSION 5: Production Reliability
 * Circuit breaker pattern implementation for external services
 * Phase 8.1: Implement production error handling and circuit breakers
 */

const EventEmitter = require('events');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');

class CircuitBreakerError extends Error {
    constructor(message, service, state) {
        super(message);
        this.name = 'CircuitBreakerError';
        this.service = service;
        this.state = state;
        this.timestamp = new Date();
    }
}

class ServiceUnavailableError extends Error {
    constructor(message, service, originalError) {
        super(message);
        this.name = 'ServiceUnavailableError';
        this.service = service;
        this.originalError = originalError;
        this.timestamp = new Date();
    }
}

/**
 * Circuit Breaker Implementation
 * States: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
 */
class CircuitBreaker extends EventEmitter {
    constructor(name, options = {}) {
        super();
        this.name = name;
        this.options = {
            failureThreshold: options.failureThreshold || 5,
            recoveryTimeout: options.recoveryTimeout || 30000,
            monitoringWindow: options.monitoringWindow || 60000,
            expectedErrors: options.expectedErrors || [],
            ...options
        };
        
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.nextAttempt = Date.now();
        this.successCount = 0;
        this.requestCount = 0;
        this.lastFailureTime = null;
        this.halfOpenSuccessCount = 0;
        
        // Statistics tracking
        this.stats = {
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0,
            circuitOpenTime: 0,
            averageResponseTime: 0,
            lastExecutionTime: null
        };
        
        // Reset monitoring window
        this.resetInterval = setInterval(() => {
            this.resetMonitoringWindow();
        }, this.options.monitoringWindow);
        
        // Factor 3 context tracking
        this.contextManager = new Factor3ContextManager();
        this.contextManager.addAgentEvent('circuit_breaker', 'created', {
            name: this.name,
            options: this.options,
            state: this.state
        });
    }
    
    /**
     * Execute function with circuit breaker protection
     */
    async execute(fn, ...args) {
        this.stats.totalRequests++;
        this.requestCount++;
        
        // Check circuit state
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                const waitTime = Math.ceil((this.nextAttempt - Date.now()) / 1000);
                const error = new CircuitBreakerError(
                    `Circuit breaker is OPEN. Service '${this.name}' unavailable. Try again in ${waitTime}s`,
                    this.name,
                    'OPEN'
                );
                this.emit('circuitOpen', { service: this.name, waitTime });
                throw error;
            } else {
                // Transition to HALF_OPEN for testing
                this.state = 'HALF_OPEN';
                this.halfOpenSuccessCount = 0;
                this.contextManager.addAgentEvent('circuit_breaker', 'state_transition', {
                    service: this.name,
                    from: 'OPEN',
                    to: 'HALF_OPEN',
                    reason: 'recovery_timeout_elapsed'
                });
                this.emit('stateChange', { service: this.name, newState: 'HALF_OPEN' });
            }
        }
        
        const startTime = Date.now();
        
        try {
            const result = await fn(...args);
            
            // Success handling
            const executionTime = Date.now() - startTime;
            this.onSuccess(executionTime);
            
            return result;
        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.onFailure(error, executionTime);
            throw error;
        }
    }
    
    /**
     * Handle successful execution
     */
    onSuccess(executionTime) {
        this.stats.totalSuccesses++;
        this.successCount++;
        this.stats.lastExecutionTime = executionTime;
        
        // Update average response time
        if (this.stats.averageResponseTime === 0) {
            this.stats.averageResponseTime = executionTime;
        } else {
            this.stats.averageResponseTime = (this.stats.averageResponseTime + executionTime) / 2;
        }
        
        if (this.state === 'HALF_OPEN') {
            this.halfOpenSuccessCount++;
            
            // Require multiple successes to close circuit
            if (this.halfOpenSuccessCount >= 3) {
                this.state = 'CLOSED';
                this.failureCount = 0;
                this.contextManager.addAgentEvent('circuit_breaker', 'state_transition', {
                    service: this.name,
                    from: 'HALF_OPEN',
                    to: 'CLOSED',
                    reason: 'sufficient_successes'
                });
                this.emit('stateChange', { service: this.name, newState: 'CLOSED' });
            }
        }
        
        this.contextManager.addAgentEvent('circuit_breaker', 'execution_success', {
            service: this.name,
            state: this.state,
            executionTime,
            successCount: this.successCount,
            failureCount: this.failureCount
        });
    }
    
    /**
     * Handle failed execution
     */
    onFailure(error, executionTime) {
        this.stats.totalFailures++;
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.stats.lastExecutionTime = executionTime;
        
        // Check if error is expected (shouldn't count towards circuit breaking)
        const isExpectedError = this.options.expectedErrors.some(expectedError => {
            if (typeof expectedError === 'string') {
                return error.message.includes(expectedError);
            } else if (expectedError instanceof RegExp) {
                return expectedError.test(error.message);
            } else if (typeof expectedError === 'function') {
                return error instanceof expectedError;
            }
            return false;
        });
        
        if (isExpectedError) {
            this.contextManager.addAgentEvent('circuit_breaker', 'expected_error', {
                service: this.name,
                error: error.message,
                state: this.state,
                executionTime
            });
            return;
        }
        
        this.contextManager.addAgentEvent('circuit_breaker', 'execution_failure', {
            service: this.name,
            error: error.message,
            state: this.state,
            executionTime,
            failureCount: this.failureCount,
            threshold: this.options.failureThreshold
        });
        
        // Check if we should open the circuit
        if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
            if (this.failureCount >= this.options.failureThreshold) {
                this.state = 'OPEN';
                this.nextAttempt = Date.now() + this.options.recoveryTimeout;
                this.stats.circuitOpenTime += this.options.recoveryTimeout;
                
                this.contextManager.addAgentEvent('circuit_breaker', 'state_transition', {
                    service: this.name,
                    from: this.state === 'HALF_OPEN' ? 'HALF_OPEN' : 'CLOSED',
                    to: 'OPEN',
                    reason: 'failure_threshold_exceeded',
                    failureCount: this.failureCount,
                    nextAttempt: new Date(this.nextAttempt).toISOString()
                });
                
                this.emit('stateChange', { service: this.name, newState: 'OPEN', error });
                this.emit('circuitOpen', { 
                    service: this.name, 
                    error, 
                    failureCount: this.failureCount,
                    nextAttempt: new Date(this.nextAttempt)
                });
            }
        }
    }
    
    /**
     * Reset monitoring window counters
     */
    resetMonitoringWindow() {
        if (this.state === 'CLOSED') {
            this.failureCount = Math.max(0, this.failureCount - 1);
            this.successCount = Math.max(0, this.successCount - 1);
        }
        this.requestCount = 0;
    }
    
    /**
     * Get circuit breaker status
     */
    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            requestCount: this.requestCount,
            nextAttempt: new Date(this.nextAttempt),
            lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
            stats: {
                ...this.stats,
                successRate: this.stats.totalRequests > 0 ? 
                    (this.stats.totalSuccesses / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
                failureRate: this.stats.totalRequests > 0 ? 
                    (this.stats.totalFailures / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%'
            }
        };
    }
    
    /**
     * Force circuit state (for testing)
     */
    forceState(newState) {
        const oldState = this.state;
        this.state = newState;
        
        if (newState === 'OPEN') {
            this.nextAttempt = Date.now() + this.options.recoveryTimeout;
        } else if (newState === 'CLOSED') {
            this.failureCount = 0;
            this.halfOpenSuccessCount = 0;
        }
        
        this.contextManager.addAgentEvent('circuit_breaker', 'forced_state_change', {
            service: this.name,
            from: oldState,
            to: newState,
            reason: 'manual_override'
        });
        
        this.emit('stateChange', { service: this.name, newState, forced: true });
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.resetInterval) {
            clearInterval(this.resetInterval);
        }
        this.removeAllListeners();
    }
}

/**
 * Error Category Classifications
 */
const ErrorCategories = {
    NETWORK: 'network',
    AUTHENTICATION: 'authentication', 
    RATE_LIMIT: 'rate_limit',
    SERVICE_UNAVAILABLE: 'service_unavailable',
    VALIDATION: 'validation',
    UNKNOWN: 'unknown'
};

/**
 * Main Error Handler Class
 */
class ErrorHandler extends EventEmitter {
    constructor() {
        super();
        this.circuitBreakers = new Map();
        this.errorStats = new Map();
        this.contextManager = new Factor3ContextManager();
        
        // Default circuit breaker configurations for different services
        this.defaultConfigs = {
            github: {
                failureThreshold: 3,
                recoveryTimeout: 30000,
                expectedErrors: ['API rate limit', /rate limit/i, /abuse/i]
            },
            slack: {
                failureThreshold: 3,
                recoveryTimeout: 20000,
                expectedErrors: ['rate_limited', /rate limit/i]
            },
            docker: {
                failureThreshold: 5,
                recoveryTimeout: 45000,
                expectedErrors: ['Container not found', /connect ENOENT/]
            },
            database: {
                failureThreshold: 2,
                recoveryTimeout: 10000,
                expectedErrors: []
            }
        };
        
        this.contextManager.addAgentEvent('error_handler', 'initialized', {
            defaultConfigs: Object.keys(this.defaultConfigs),
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Get or create circuit breaker for service
     */
    getCircuitBreaker(serviceName, customConfig = {}) {
        if (!this.circuitBreakers.has(serviceName)) {
            const config = {
                ...this.defaultConfigs[serviceName] || {},
                ...customConfig
            };
            
            const breaker = new CircuitBreaker(serviceName, config);
            
            // Set up event listeners for monitoring
            breaker.on('stateChange', (data) => {
                this.emit('circuitBreakerStateChange', data);
                this.contextManager.addAgentEvent('error_handler', 'circuit_breaker_state_change', data);
            });
            
            breaker.on('circuitOpen', (data) => {
                this.emit('circuitBreakerOpen', data);
                this.contextManager.addAgentEvent('error_handler', 'circuit_breaker_opened', data);
            });
            
            this.circuitBreakers.set(serviceName, breaker);
            
            this.contextManager.addAgentEvent('error_handler', 'circuit_breaker_created', {
                serviceName,
                config
            });
        }
        
        return this.circuitBreakers.get(serviceName);
    }
    
    /**
     * Execute function with circuit breaker protection
     */
    async executeWithCircuitBreaker(serviceName, fn, customConfig = {}) {
        const breaker = this.getCircuitBreaker(serviceName, customConfig);
        return breaker.execute(fn);
    }
    
    /**
     * Categorize error type
     */
    categorizeError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('rate limit') || message.includes('too many requests')) {
            return ErrorCategories.RATE_LIMIT;
        }
        if (message.includes('unauthorized') || message.includes('authentication') || message.includes('token')) {
            return ErrorCategories.AUTHENTICATION;
        }
        if (message.includes('network') || message.includes('connect') || message.includes('timeout')) {
            return ErrorCategories.NETWORK;
        }
        if (message.includes('service unavailable') || message.includes('502') || message.includes('503')) {
            return ErrorCategories.SERVICE_UNAVAILABLE;
        }
        if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
            return ErrorCategories.VALIDATION;
        }
        
        return ErrorCategories.UNKNOWN;
    }
    
    /**
     * Handle error with intelligent routing
     */
    async handleError(error, context = {}) {
        const category = this.categorizeError(error);
        const serviceName = context.service || 'unknown';
        
        // Update error statistics
        if (!this.errorStats.has(serviceName)) {
            this.errorStats.set(serviceName, {
                total: 0,
                categories: Object.fromEntries(Object.values(ErrorCategories).map(cat => [cat, 0]))
            });
        }
        
        const stats = this.errorStats.get(serviceName);
        stats.total++;
        stats.categories[category]++;
        
        this.contextManager.addAgentEvent('error_handler', 'error_handled', {
            error: error.message,
            category,
            serviceName,
            context,
            stats: stats.total
        });
        
        // Emit categorized error event
        this.emit('errorCategorized', { error, category, serviceName, context });
        
        // Return enhanced error with category and recommendations
        const enhancedError = new Error(error.message);
        enhancedError.originalError = error;
        enhancedError.category = category;
        enhancedError.serviceName = serviceName;
        enhancedError.recommendations = this.getErrorRecommendations(category, serviceName);
        enhancedError.context = context;
        
        return enhancedError;
    }
    
    /**
     * Get error handling recommendations
     */
    getErrorRecommendations(category, serviceName) {
        const recommendations = {
            [ErrorCategories.RATE_LIMIT]: [
                'Implement exponential backoff',
                'Check service rate limits',
                'Consider caching responses',
                'Distribute requests over time'
            ],
            [ErrorCategories.AUTHENTICATION]: [
                'Verify API tokens are valid',
                'Check token expiration',
                'Refresh authentication credentials',
                'Validate service permissions'
            ],
            [ErrorCategories.NETWORK]: [
                'Retry with exponential backoff',
                'Check network connectivity',
                'Verify service endpoints',
                'Consider timeout adjustments'
            ],
            [ErrorCategories.SERVICE_UNAVAILABLE]: [
                'Use circuit breaker pattern',
                'Implement graceful degradation',
                'Check service status pages',
                'Consider alternative services'
            ],
            [ErrorCategories.VALIDATION]: [
                'Validate input parameters',
                'Check required fields',
                'Verify data formats',
                'Review API documentation'
            ],
            [ErrorCategories.UNKNOWN]: [
                'Log error for investigation',
                'Check service documentation',
                'Review error patterns',
                'Consider contacting support'
            ]
        };
        
        return recommendations[category] || recommendations[ErrorCategories.UNKNOWN];
    }
    
    /**
     * Get graceful degradation strategy
     */
    getGracefulDegradationStrategy(serviceName, error) {
        const strategies = {
            github: {
                description: 'Use cached data, disable PR creation, show read-only mode',
                fallbacks: ['cached_repository_data', 'read_only_mode', 'offline_operation']
            },
            slack: {
                description: 'Queue messages, use console logging, disable notifications',
                fallbacks: ['message_queuing', 'console_logging', 'email_fallback']
            },
            docker: {
                description: 'Use local development mode, disable deployments',
                fallbacks: ['local_development', 'deployment_disabled', 'simulation_mode']
            },
            database: {
                description: 'Use memory storage, enable recovery mode',
                fallbacks: ['memory_storage', 'recovery_mode', 'backup_restore']
            }
        };
        
        return strategies[serviceName] || {
            description: 'Default degradation: Log error and continue with limited functionality',
            fallbacks: ['error_logging', 'limited_functionality']
        };
    }
    
    /**
     * Get all circuit breaker statuses
     */
    getAllCircuitBreakerStatuses() {
        const statuses = {};
        for (const [serviceName, breaker] of this.circuitBreakers.entries()) {
            statuses[serviceName] = breaker.getStatus();
        }
        return statuses;
    }
    
    /**
     * Get error statistics
     */
    getErrorStatistics() {
        const stats = {};
        for (const [serviceName, serviceStats] of this.errorStats.entries()) {
            stats[serviceName] = serviceStats;
        }
        return stats;
    }
    
    /**
     * Reset all circuit breakers
     */
    resetAllCircuitBreakers() {
        for (const breaker of this.circuitBreakers.values()) {
            breaker.forceState('CLOSED');
        }
        
        this.contextManager.addAgentEvent('error_handler', 'all_circuit_breakers_reset', {
            services: Array.from(this.circuitBreakers.keys()),
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Health check for error handling system
     */
    getHealthStatus() {
        const circuitBreakerStatuses = this.getAllCircuitBreakerStatuses();
        const openCircuits = Object.values(circuitBreakerStatuses).filter(status => status.state === 'OPEN');
        const halfOpenCircuits = Object.values(circuitBreakerStatuses).filter(status => status.state === 'HALF_OPEN');
        
        return {
            healthy: openCircuits.length === 0,
            circuitBreakers: {
                total: this.circuitBreakers.size,
                open: openCircuits.length,
                halfOpen: halfOpenCircuits.length,
                closed: this.circuitBreakers.size - openCircuits.length - halfOpenCircuits.length
            },
            openServices: openCircuits.map(status => status.name),
            statistics: this.getErrorStatistics(),
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        for (const breaker of this.circuitBreakers.values()) {
            breaker.destroy();
        }
        this.circuitBreakers.clear();
        this.errorStats.clear();
        this.removeAllListeners();
    }
}

/**
 * Demo function to test error handler
 */
async function demonstrateErrorHandler() {
    console.log('🚨 Error Handler & Circuit Breaker Demo\n');
    
    try {
        const errorHandler = new ErrorHandler();
        
        console.log('✅ Error Handler Features:');
        console.log('   • Circuit breaker pattern for external services');
        console.log('   • Error categorization and intelligent routing');
        console.log('   • Graceful degradation strategies');
        console.log('   • Real-time error statistics and monitoring');
        console.log('   • Service-specific configurations');
        console.log('   • Factor 3 context tracking integration');
        
        console.log('\n🔧 Circuit Breaker Configurations:');
        console.log('   • GitHub: 3 failures, 30s recovery, rate limit aware');
        console.log('   • Slack: 3 failures, 20s recovery, rate limit aware');
        console.log('   • Docker: 5 failures, 45s recovery, connection aware');
        console.log('   • Database: 2 failures, 10s recovery');
        
        console.log('\n🧪 Testing Circuit Breaker:');
        
        // Create a GitHub service circuit breaker
        const githubBreaker = errorHandler.getCircuitBreaker('github');
        console.log('   ✅ GitHub circuit breaker created');
        
        // Simulate multiple failures
        for (let i = 1; i <= 4; i++) {
            try {
                await githubBreaker.execute(async () => {
                    throw new Error(`GitHub API failure ${i}`);
                });
            } catch (error) {
                console.log(`   ⚠️  Failure ${i}: ${error.message}`);
            }
        }
        
        const status = githubBreaker.getStatus();
        console.log(`   🔴 Circuit state: ${status.state} (${status.failureCount} failures)`);
        
        // Try to execute when circuit is open
        try {
            await githubBreaker.execute(async () => {
                return 'Should not execute';
            });
        } catch (error) {
            if (error instanceof CircuitBreakerError) {
                console.log(`   ✅ Circuit breaker prevented execution: ${error.message}`);
            }
        }
        
        // Show error statistics
        const errorStats = errorHandler.getErrorStatistics();
        console.log('\n📊 Error Statistics:');
        console.log(`   Services tracked: ${Object.keys(errorStats).length}`);
        if (errorStats.github) {
            console.log(`   GitHub total errors: ${errorStats.github.total}`);
        }
        
        // Health status
        const health = errorHandler.getHealthStatus();
        console.log('\n🩺 System Health:');
        console.log(`   Overall healthy: ${health.healthy}`);
        console.log(`   Circuit breakers - Open: ${health.circuitBreakers.open}, Closed: ${health.circuitBreakers.closed}`);
        
        // Test error categorization
        console.log('\n🏷️  Error Categorization:');
        const testErrors = [
            new Error('API rate limit exceeded'),
            new Error('Unauthorized: Invalid token'),
            new Error('Network timeout after 30s'),
            new Error('Service unavailable (503)')
        ];
        
        for (const error of testErrors) {
            const enhanced = await errorHandler.handleError(error, { service: 'test' });
            console.log(`   ${error.message} → ${enhanced.category}`);
        }
        
        errorHandler.destroy();
        console.log('\n✅ Demo completed - Circuit breakers ready for production!');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

module.exports = {
    ErrorHandler,
    CircuitBreaker,
    CircuitBreakerError,
    ServiceUnavailableError,
    ErrorCategories,
    errorHandler
};

// Run demo if called directly
if (require.main === module) {
    demonstrateErrorHandler().catch(console.error);
}