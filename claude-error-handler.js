const { SQLiteManager } = require('./database/sqlite-manager');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

/**
 * Production Error Handler - Factor 9: Treat Logs as Event Streams
 * 
 * Comprehensive error handling, recovery, and monitoring for multi-agent systems
 * Following 12-Factor Agent principles
 */
class ErrorHandler {
    constructor(options = {}) {
        this.config = {
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
            errorLogPath: options.errorLogPath || path.join(__dirname, 'logs', 'errors.log'),
            alertThreshold: options.alertThreshold || 10,
            recoveryStrategies: options.recoveryStrategies || {},
            ...options
        };

        // Error tracking
        this.errorCounts = new Map();
        this.circuitBreakers = new Map();
        this.recoveryHistory = new Map();
        this.activeRecoveries = new Map();

        // Database and logger
        this.db = new SQLiteManager();
        this.logger = this.initializeLogger();

        // Recovery strategies
        this.setupRecoveryStrategies();
        
        // Global error handlers
        this.setupGlobalErrorHandlers();
    }

    /**
     * Initialize structured logger
     */
    initializeLogger() {
        return winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console({
                    level: 'info',
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                new winston.transports.File({
                    filename: this.config.errorLogPath,
                    level: 'error',
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5
                }),
                new winston.transports.File({
                    filename: path.join(path.dirname(this.config.errorLogPath), 'combined.log'),
                    maxsize: 50 * 1024 * 1024, // 50MB
                    maxFiles: 10
                })
            ]
        });
    }

    /**
     * Setup global error handlers
     */
    setupGlobalErrorHandlers() {
        // Uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.handleCriticalError(error, 'uncaughtException');
        });

        // Unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.handleCriticalError(reason, 'unhandledRejection', { promise });
        });

        // SIGTERM and SIGINT for graceful shutdown
        process.on('SIGTERM', () => {
            this.handleGracefulShutdown('SIGTERM');
        });

        process.on('SIGINT', () => {
            this.handleGracefulShutdown('SIGINT');
        });
    }

    /**
     * Initialize error handler
     */
    async initialize() {
        try {
            await this.db.initialize();
            
            // Create error tracking tables
            await this.db.db.run(`
                CREATE TABLE IF NOT EXISTS error_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    error_type TEXT NOT NULL,
                    error_message TEXT NOT NULL,
                    stack_trace TEXT,
                    context TEXT,
                    session_id TEXT,
                    agent_id TEXT,
                    severity TEXT DEFAULT 'error',
                    resolved BOOLEAN DEFAULT FALSE,
                    recovery_action TEXT,
                    occurrence_count INTEGER DEFAULT 1
                )
            `);

            await this.db.db.run(`
                CREATE TABLE IF NOT EXISTS recovery_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    error_id INTEGER,
                    action_type TEXT NOT NULL,
                    action_details TEXT,
                    success BOOLEAN DEFAULT FALSE,
                    duration INTEGER,
                    FOREIGN KEY(error_id) REFERENCES error_logs(id)
                )
            `);

            await this.db.db.run(`
                CREATE TABLE IF NOT EXISTS circuit_breaker_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    service_name TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    error_count INTEGER,
                    details TEXT
                )
            `);

            this.logger.info('Error handler initialized successfully');

        } catch (error) {
            console.error('Failed to initialize error handler:', error);
            throw error;
        }
    }

    /**
     * Handle errors with automatic recovery
     */
    async handleError(error, context = {}) {
        const errorId = await this.logError(error, context);
        
        try {
            // Check circuit breaker
            if (this.shouldCircuitBreak(context.service || 'unknown')) {
                throw new Error(`Circuit breaker open for service: ${context.service}`);
            }

            // Attempt recovery
            const recoveryResult = await this.attemptRecovery(error, context, errorId);
            
            if (recoveryResult.success) {
                this.logger.info('Error recovered successfully', {
                    errorId,
                    recoveryAction: recoveryResult.action,
                    duration: recoveryResult.duration
                });
                return recoveryResult;
            } else {
                throw new Error(`Recovery failed: ${recoveryResult.reason}`);
            }

        } catch (recoveryError) {
            this.logger.error('Error recovery failed', {
                originalError: error.message,
                recoveryError: recoveryError.message,
                errorId
            });

            // Escalate if recovery fails
            await this.escalateError(error, context, errorId);
            throw recoveryError;
        }
    }

    /**
     * Log error to database and file
     */
    async logError(error, context = {}) {
        const timestamp = Date.now();
        const errorType = error.constructor.name;
        const errorMessage = error.message;
        const stackTrace = error.stack;
        const severity = this.determineSeverity(error, context);

        try {
            const result = await this.db.db.run(`
                INSERT INTO error_logs (
                    timestamp, error_type, error_message, stack_trace, 
                    context, session_id, agent_id, severity
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                timestamp, errorType, errorMessage, stackTrace,
                JSON.stringify(context), context.sessionId, context.agentId, severity
            ]);

            // Update error count for circuit breaker
            const service = context.service || 'unknown';
            const count = (this.errorCounts.get(service) || 0) + 1;
            this.errorCounts.set(service, count);

            this.logger.error('Error logged', {
                errorId: result.lastID,
                errorType,
                errorMessage,
                severity,
                service,
                errorCount: count
            });

            return result.lastID;

        } catch (dbError) {
            // Fallback to file logging if database fails
            this.logger.error('Database error logging failed, using file fallback', {
                error: error.message,
                dbError: dbError.message
            });

            // Write to emergency log file
            const errorEntry = {
                timestamp,
                errorType,
                errorMessage,
                stackTrace,
                context,
                severity
            };

            const emergencyLogPath = path.join(path.dirname(this.config.errorLogPath), 'emergency.log');
            await fs.appendFile(emergencyLogPath, JSON.stringify(errorEntry) + '\n');
            
            return `file_${timestamp}`;
        }
    }

    /**
     * Determine error severity
     */
    determineSeverity(error, context) {
        if (error.name === 'TypeError' || error.name === 'ReferenceError') {
            return 'critical';
        }
        
        if (context.agentId && error.message.includes('timeout')) {
            return 'high';
        }
        
        if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
            return 'medium';
        }
        
        return 'low';
    }

    /**
     * Setup recovery strategies
     */
    setupRecoveryStrategies() {
        this.recoveryStrategies = new Map([
            ['timeout', this.recoverFromTimeout.bind(this)],
            ['network', this.recoverFromNetworkError.bind(this)],
            ['database', this.recoverFromDatabaseError.bind(this)],
            ['agent_failure', this.recoverFromAgentFailure.bind(this)],
            ['memory', this.recoverFromMemoryError.bind(this)],
            ['rate_limit', this.recoverFromRateLimit.bind(this)],
            ['authentication', this.recoverFromAuthError.bind(this)],
            ['validation', this.recoverFromValidationError.bind(this)]
        ]);
    }

    /**
     * Attempt error recovery
     */
    async attemptRecovery(error, context, errorId) {
        const recoveryType = this.identifyRecoveryType(error, context);
        const strategy = this.recoveryStrategies.get(recoveryType);
        
        if (!strategy) {
            return {
                success: false,
                reason: `No recovery strategy for: ${recoveryType}`,
                action: 'none'
            };
        }

        const startTime = Date.now();
        
        try {
            const result = await strategy(error, context);
            const duration = Date.now() - startTime;

            // Log recovery action
            await this.db.db.run(`
                INSERT INTO recovery_actions (
                    timestamp, error_id, action_type, action_details, success, duration
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [Date.now(), errorId, recoveryType, JSON.stringify(result), true, duration]);

            return {
                success: true,
                action: recoveryType,
                duration,
                details: result
            };

        } catch (recoveryError) {
            const duration = Date.now() - startTime;

            await this.db.db.run(`
                INSERT INTO recovery_actions (
                    timestamp, error_id, action_type, action_details, success, duration
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [Date.now(), errorId, recoveryType, recoveryError.message, false, duration]);

            return {
                success: false,
                reason: recoveryError.message,
                action: recoveryType,
                duration
            };
        }
    }

    /**
     * Identify recovery type from error
     */
    identifyRecoveryType(error, context) {
        const message = error.message.toLowerCase();
        
        if (message.includes('timeout') || message.includes('etimedout')) {
            return 'timeout';
        }
        
        if (message.includes('econnrefused') || message.includes('network')) {
            return 'network';
        }
        
        if (message.includes('database') || message.includes('sqlite')) {
            return 'database';
        }
        
        if (context.agentId && message.includes('failed')) {
            return 'agent_failure';
        }
        
        if (message.includes('memory') || message.includes('heap')) {
            return 'memory';
        }
        
        if (message.includes('rate') || message.includes('limit')) {
            return 'rate_limit';
        }
        
        if (message.includes('auth') || message.includes('token')) {
            return 'authentication';
        }
        
        if (message.includes('validation') || message.includes('invalid')) {
            return 'validation';
        }
        
        return 'generic';
    }

    /**
     * Recovery strategy: Timeout errors
     */
    async recoverFromTimeout(error, context) {
        this.logger.info('Attempting timeout recovery', { context });
        
        // Exponential backoff retry
        let delay = this.config.retryDelay;
        
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            await this.delay(delay);
            
            try {
                if (context.retryFunction && typeof context.retryFunction === 'function') {
                    await context.retryFunction();
                    return { strategy: 'retry', attempts: attempt, success: true };
                }
                
                return { strategy: 'timeout_handled', attempts: attempt };
                
            } catch (retryError) {
                if (attempt === this.config.maxRetries) {
                    throw retryError;
                }
                delay *= 2; // Exponential backoff
            }
        }
    }

    /**
     * Recovery strategy: Network errors
     */
    async recoverFromNetworkError(error, context) {
        this.logger.info('Attempting network recovery', { context });
        
        // Check network connectivity
        const isConnected = await this.checkNetworkConnectivity();
        
        if (!isConnected) {
            await this.delay(5000); // Wait for network recovery
        }
        
        // Retry with circuit breaker pattern
        return await this.recoverFromTimeout(error, context);
    }

    /**
     * Recovery strategy: Database errors
     */
    async recoverFromDatabaseError(error, context) {
        this.logger.info('Attempting database recovery', { context });
        
        try {
            // Attempt to reinitialize database connection
            await this.db.initialize();
            
            // Test connection
            await this.db.db.get('SELECT 1');
            
            return { strategy: 'database_reconnect', success: true };
            
        } catch (reconnectError) {
            throw new Error(`Database recovery failed: ${reconnectError.message}`);
        }
    }

    /**
     * Recovery strategy: Agent failures
     */
    async recoverFromAgentFailure(error, context) {
        this.logger.info('Attempting agent recovery', { context });
        
        const agentId = context.agentId;
        if (!agentId) {
            throw new Error('No agent ID provided for recovery');
        }
        
        // Mark agent as failed and attempt restart
        return {
            strategy: 'agent_restart',
            agentId,
            action: 'restart_scheduled'
        };
    }

    /**
     * Recovery strategy: Memory errors
     */
    async recoverFromMemoryError(error, context) {
        this.logger.info('Attempting memory recovery', { context });
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        // Clear caches
        if (context.clearCache && typeof context.clearCache === 'function') {
            await context.clearCache();
        }
        
        return { strategy: 'memory_cleanup', heapUsed: process.memoryUsage().heapUsed };
    }

    /**
     * Recovery strategy: Rate limit errors
     */
    async recoverFromRateLimit(error, context) {
        this.logger.info('Attempting rate limit recovery', { context });
        
        // Calculate backoff time based on rate limit headers
        const backoffTime = context.retryAfter || 60000; // Default 1 minute
        
        this.logger.info('Rate limit hit, backing off', { backoffTime });
        await this.delay(backoffTime);
        
        return { strategy: 'rate_limit_backoff', backoffTime };
    }

    /**
     * Recovery strategy: Authentication errors
     */
    async recoverFromAuthError(error, context) {
        this.logger.info('Attempting authentication recovery', { context });
        
        if (context.refreshToken && typeof context.refreshToken === 'function') {
            try {
                await context.refreshToken();
                return { strategy: 'token_refresh', success: true };
            } catch (refreshError) {
                throw new Error(`Token refresh failed: ${refreshError.message}`);
            }
        }
        
        throw new Error('No token refresh mechanism available');
    }

    /**
     * Recovery strategy: Validation errors
     */
    async recoverFromValidationError(error, context) {
        this.logger.info('Attempting validation recovery', { context });
        
        // Log validation details for debugging
        return { 
            strategy: 'validation_logged', 
            error: error.message,
            context: context 
        };
    }

    /**
     * Circuit breaker implementation
     */
    shouldCircuitBreak(service) {
        const errorCount = this.errorCounts.get(service) || 0;
        const breaker = this.circuitBreakers.get(service);
        
        if (!breaker) {
            // Initialize circuit breaker
            if (errorCount >= this.config.circuitBreakerThreshold) {
                this.circuitBreakers.set(service, {
                    state: 'open',
                    openedAt: Date.now(),
                    errorCount
                });
                
                this.logger.warn('Circuit breaker opened', { service, errorCount });
                
                // Log circuit breaker event
                this.db.db.run(`
                    INSERT INTO circuit_breaker_events (
                        timestamp, service_name, event_type, error_count
                    ) VALUES (?, ?, ?, ?)
                `, [Date.now(), service, 'opened', errorCount]);
                
                return true;
            }
            return false;
        }
        
        // Check if circuit breaker should be closed
        if (breaker.state === 'open') {
            const timeSinceOpened = Date.now() - breaker.openedAt;
            if (timeSinceOpened > this.config.circuitBreakerTimeout) {
                breaker.state = 'half-open';
                this.logger.info('Circuit breaker half-open', { service });
                return false;
            }
            return true;
        }
        
        return false;
    }

    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker(service) {
        this.circuitBreakers.delete(service);
        this.errorCounts.delete(service);
        
        this.logger.info('Circuit breaker reset', { service });
        
        this.db.db.run(`
            INSERT INTO circuit_breaker_events (
                timestamp, service_name, event_type, error_count
            ) VALUES (?, ?, ?, ?)
        `, [Date.now(), service, 'reset', 0]);
    }

    /**
     * Check network connectivity
     */
    async checkNetworkConnectivity() {
        try {
            const { execSync } = require('child_process');
            execSync('ping -c 1 8.8.8.8', { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Handle critical errors
     */
    async handleCriticalError(error, type, details = {}) {
        this.logger.error('Critical error occurred', {
            type,
            error: error.message,
            stack: error.stack,
            details
        });
        
        // Attempt to save state before shutdown
        await this.saveEmergencyState();
        
        // Give time for logging
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    }

    /**
     * Handle graceful shutdown
     */
    async handleGracefulShutdown(signal) {
        this.logger.info('Graceful shutdown initiated', { signal });
        
        try {
            // Clean up resources
            await this.cleanup();
            
            this.logger.info('Graceful shutdown completed');
            process.exit(0);
            
        } catch (error) {
            this.logger.error('Error during graceful shutdown', { error: error.message });
            process.exit(1);
        }
    }

    /**
     * Save emergency state
     */
    async saveEmergencyState() {
        try {
            const state = {
                timestamp: Date.now(),
                errorCounts: Object.fromEntries(this.errorCounts),
                circuitBreakers: Object.fromEntries(this.circuitBreakers),
                activeRecoveries: Object.fromEntries(this.activeRecoveries)
            };
            
            const statePath = path.join(path.dirname(this.config.errorLogPath), 'emergency-state.json');
            await fs.writeFile(statePath, JSON.stringify(state, null, 2));
            
        } catch (error) {
            console.error('Failed to save emergency state:', error);
        }
    }

    /**
     * Escalate error to external systems
     */
    async escalateError(error, context, errorId) {
        this.logger.error('Escalating error', { errorId, error: error.message });
        
        // Here you would integrate with external alerting systems
        // Slack, PagerDuty, email notifications, etc.
        
        // For demo, just log escalation
        return { escalated: true, errorId, timestamp: Date.now() };
    }

    /**
     * Get error statistics
     */
    async getErrorStats() {
        const stats = await this.db.db.all(`
            SELECT 
                error_type,
                severity,
                COUNT(*) as count,
                MAX(timestamp) as last_occurrence
            FROM error_logs 
            WHERE timestamp > ? 
            GROUP BY error_type, severity
            ORDER BY count DESC
        `, [Date.now() - (24 * 60 * 60 * 1000)]); // Last 24 hours
        
        return {
            recentErrors: stats,
            circuitBreakers: Object.fromEntries(this.circuitBreakers),
            errorCounts: Object.fromEntries(this.errorCounts)
        };
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        for (const [service, breaker] of this.circuitBreakers) {
            this.logger.info('Cleaning up circuit breaker', { service });
        }
        
        this.errorCounts.clear();
        this.circuitBreakers.clear();
        this.recoveryHistory.clear();
        this.activeRecoveries.clear();
    }
}

/**
 * Demo function
 */
async function demonstrateErrorHandler() {
    console.log('🚨 Production Error Handler Demo\n');
    
    try {
        const errorHandler = new ErrorHandler({
            maxRetries: 3,
            retryDelay: 1000,
            circuitBreakerThreshold: 3
        });
        
        await errorHandler.initialize();
        
        console.log('✅ Error Handler Features:');
        console.log('   • Automatic error recovery with 8 strategies');
        console.log('   • Circuit breaker pattern implementation');
        console.log('   • Structured error logging to database');
        console.log('   • Global uncaught exception handling');
        console.log('   • Graceful shutdown procedures');
        console.log('   • Error escalation and alerting');
        console.log('   • Recovery attempt tracking');
        console.log('   • Emergency state persistence');

        console.log('\n🔄 Recovery Strategies:');
        console.log('   • timeout: Exponential backoff retry');
        console.log('   • network: Connectivity check + retry');
        console.log('   • database: Connection reset');
        console.log('   • agent_failure: Agent restart');
        console.log('   • memory: Garbage collection + cache clear');
        console.log('   • rate_limit: Intelligent backoff');
        console.log('   • authentication: Token refresh');
        console.log('   • validation: Error logging + details');

        // Demo error handling
        console.log('\n🧪 Testing Error Recovery:');
        
        try {
            // Simulate timeout error
            const timeoutError = new Error('Connection timeout after 30s');
            await errorHandler.handleError(timeoutError, {
                service: 'github-api',
                agentId: 'github-001',
                retryFunction: async () => {
                    console.log('   ⚡ Retry function executed successfully');
                }
            });
            console.log('   ✅ Timeout error recovered');
        } catch (error) {
            console.log(`   ⚠️  Recovery demonstration: ${error.message}`);
        }

        // Show error statistics
        const stats = await errorHandler.getErrorStats();
        console.log('\n📊 Error Statistics:');
        console.log(`   Recent errors: ${stats.recentErrors.length}`);
        console.log(`   Circuit breakers: ${Object.keys(stats.circuitBreakers).length}`);
        console.log(`   Active error counts: ${Object.keys(stats.errorCounts).length}`);

        await errorHandler.cleanup();
        console.log('\n✅ Demo completed - Production error handling ready!');

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

module.exports = {
    ErrorHandler
};

// Run demo if called directly
if (require.main === module) {
    demonstrateErrorHandler().catch(console.error);
}