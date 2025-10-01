/**
 * LonicFLex Central Logging Service
 * Replaces 4,613 console.log statements with structured Winston logging
 *
 * Features:
 * - Environment-based log levels
 * - Context-aware logging (agent ID, session ID, workflow ID)
 * - Structured metadata support
 * - Multiple transports (console, file, error file)
 * - Log rotation and performance optimization
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

class LonicFlexLogger {
    constructor() {
        this.logger = null;
        this.loggers = new Map(); // Category-specific loggers
        this.initialize();
    }

    initialize() {
        // Ensure logs directory exists
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Configure log format
        const logFormat = winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                let msg = `${timestamp} [${level.toUpperCase()}]`;

                // Add context information if available
                if (metadata.category) msg += ` [${metadata.category}]`;
                if (metadata.agentId) msg += ` [Agent:${metadata.agentId}]`;
                if (metadata.sessionId) msg += ` [Session:${metadata.sessionId}]`;
                if (metadata.workflowId) msg += ` [Workflow:${metadata.workflowId}]`;

                msg += `: ${message}`;

                // Add metadata if present
                const metaKeys = Object.keys(metadata).filter(key =>
                    !['category', 'agentId', 'sessionId', 'workflowId'].includes(key)
                );
                if (metaKeys.length > 0) {
                    const metaStr = metaKeys.map(key => `${key}=${JSON.stringify(metadata[key])}`).join(', ');
                    msg += ` | ${metaStr}`;
                }

                return msg;
            })
        );

        // Configure transports based on environment
        const transports = [];

        // Console transport (always enabled for development)
        transports.push(new winston.transports.Console({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }));

        // File transport for general logs
        transports.push(new winston.transports.File({
            filename: path.join(logsDir, 'lonicflex.log'),
            level: 'info',
            format: logFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        }));

        // Error file transport
        transports.push(new winston.transports.File({
            filename: path.join(logsDir, 'lonicflex-error.log'),
            level: 'error',
            format: logFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 3,
            tailable: true
        }));

        // Create main logger
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            transports,
            exitOnError: false
        });

        // Initialize category-specific loggers
        this.initializeCategoryLoggers();
    }

    initializeCategoryLoggers() {
        const categories = [
            'system',      // Core system operations
            'agent',       // Agent-specific operations
            'workflow',    // Workflow execution
            'integration', // External service integration
            'database',    // Database operations
            'auth',        // Authentication/authorization
            'test'         // Test operations
        ];

        categories.forEach(category => {
            this.loggers.set(category, this.createCategoryLogger(category));
        });
    }

    createCategoryLogger(category) {
        return {
            debug: (message, metadata = {}) => this.log('debug', message, { category, ...metadata }),
            info: (message, metadata = {}) => this.log('info', message, { category, ...metadata }),
            warn: (message, metadata = {}) => this.log('warn', message, { category, ...metadata }),
            error: (message, metadata = {}) => this.log('error', message, { category, ...metadata })
        };
    }

    log(level, message, metadata = {}) {
        this.logger.log(level, message, metadata);
    }

    // Convenience methods for common logging patterns
    system(level, message, metadata = {}) {
        this.loggers.get('system')[level](message, metadata);
    }

    agent(level, message, agentId, metadata = {}) {
        this.loggers.get('agent')[level](message, { agentId, ...metadata });
    }

    workflow(level, message, workflowId, metadata = {}) {
        this.loggers.get('workflow')[level](message, { workflowId, ...metadata });
    }

    integration(level, message, service, metadata = {}) {
        this.loggers.get('integration')[level](message, { service, ...metadata });
    }

    database(level, message, operation, metadata = {}) {
        this.loggers.get('database')[level](message, { operation, ...metadata });
    }

    auth(level, message, userId, metadata = {}) {
        this.loggers.get('auth')[level](message, { userId, ...metadata });
    }

    test(level, message, testName, metadata = {}) {
        this.loggers.get('test')[level](message, { testName, ...metadata });
    }

    // Error handling with automatic stack trace capture
    logError(error, context = {}) {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            ...context
        };
        this.logger.error('Error occurred', errorInfo);
    }

    // Performance timing logger
    time(label, metadata = {}) {
        const startTime = Date.now();
        return {
            end: () => {
                const duration = Date.now() - startTime;
                this.logger.info(`Timer: ${label}`, { duration, ...metadata });
                return duration;
            }
        };
    }

    // Get category-specific logger
    getLogger(category) {
        if (!this.loggers.has(category)) {
            // Create logger for new category
            this.loggers.set(category, this.createCategoryLogger(category));
        }
        return this.loggers.get(category);
    }

    // Utility method to create context-aware logger for agents/workflows
    createContextLogger(context = {}) {
        return {
            debug: (message, metadata = {}) => this.log('debug', message, { ...context, ...metadata }),
            info: (message, metadata = {}) => this.log('info', message, { ...context, ...metadata }),
            warn: (message, metadata = {}) => this.log('warn', message, { ...context, ...metadata }),
            error: (message, metadata = {}) => this.log('error', message, { ...context, ...metadata }),
            time: (label) => this.time(label, context),
            logError: (error, metadata = {}) => this.logError(error, { ...context, ...metadata })
        };
    }

    // Shutdown method for graceful cleanup
    async shutdown() {
        if (!this.logger) {
            return;
        }

        if (typeof this.logger.close === 'function') {
            this.logger.close();
        }

        for (const transport of this.logger.transports ?? []) {
            if (typeof transport.close === 'function') {
                try {
                    transport.close();
                } catch (err) {
                    // Ignore transport close errors during shutdown
                }
            }
        }

        this.loggers.clear();
    }
}

// Create singleton instance
const lonicFlexLogger = new LonicFlexLogger();

// Export convenience functions for easy migration from console.log
module.exports = {
    // Main logger instance
    logger: lonicFlexLogger,

    // Direct logging functions for easy console.log replacement
    debug: (message, metadata = {}) => lonicFlexLogger.log('debug', message, metadata),
    info: (message, metadata = {}) => lonicFlexLogger.log('info', message, metadata),
    warn: (message, metadata = {}) => lonicFlexLogger.log('warn', message, metadata),
    error: (message, metadata = {}) => lonicFlexLogger.log('error', message, metadata),

    // Category-specific loggers
    system: lonicFlexLogger.getLogger('system'),
    agent: lonicFlexLogger.getLogger('agent'),
    workflow: lonicFlexLogger.getLogger('workflow'),
    integration: lonicFlexLogger.getLogger('integration'),
    database: lonicFlexLogger.getLogger('database'),
    auth: lonicFlexLogger.getLogger('auth'),
    test: lonicFlexLogger.getLogger('test'),

    // Utility functions
    logError: (error, context = {}) => lonicFlexLogger.logError(error, context),
    time: (label, metadata = {}) => lonicFlexLogger.time(label, metadata),
    createContextLogger: (context = {}) => lonicFlexLogger.createContextLogger(context),

    // For ServiceContainer integration
    LonicFlexLogger
};