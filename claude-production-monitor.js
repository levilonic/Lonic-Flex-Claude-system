const express = require('express');
const winston = require('winston');
const { SQLiteManager } = require('./database/sqlite-manager');
const { Octokit } = require('@octokit/rest');
const { WebClient } = require('@slack/web-api');
require('dotenv').config();

/**
 * Production Monitoring and Health Check System
 * Provides comprehensive monitoring, logging, and health endpoints
 */
class ProductionMonitor {
    constructor(options = {}) {
        this.config = {
            port: options.port || process.env.HEALTH_CHECK_PORT || 3002,
            logLevel: options.logLevel || process.env.LOG_LEVEL || 'info',
            retentionDays: options.retentionDays || process.env.METRICS_RETENTION_DAYS || 30,
            checkInterval: options.checkInterval || process.env.HEALTH_CHECK_INTERVAL || 30000,
            ...options
        };

        this.app = express();
        this.db = new SQLiteManager();
        this.github = new Octokit({ auth: process.env.GITHUB_TOKEN });
        this.slack = new WebClient(process.env.SLACK_BOT_TOKEN);
        
        this.healthStatus = {
            overall: 'healthy',
            services: {},
            lastCheck: null,
            uptime: process.uptime()
        };

        this.setupLogger();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupHealthChecks();
    }

    /**
     * Setup production logging with rotation and structured format
     */
    setupLogger() {
        this.logger = winston.createLogger({
            level: this.config.logLevel,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
                winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
            ),
            transports: [
                // Console logging for development
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                
                // File logging for production
                new winston.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    maxsize: parseInt(process.env.LOG_FILE_MAX_SIZE) || 50000000, // 50MB
                    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
                    tailable: true
                }),
                new winston.transports.File({
                    filename: 'logs/combined.log',
                    maxsize: parseInt(process.env.LOG_FILE_MAX_SIZE) || 50000000,
                    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
                    tailable: true
                })
            ]
        });

        // Handle uncaught exceptions
        this.logger.exceptions.handle(
            new winston.transports.File({ filename: 'logs/exceptions.log' })
        );

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled Rejection', {
                reason: reason,
                promise: promise,
                stack: reason?.stack
            });
        });
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging middleware
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                this.logger.info('HTTP Request', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                });
            });
            
            next();
        });

        // Error handling middleware
        this.app.use((err, req, res, next) => {
            this.logger.error('Express Error', {
                error: err.message,
                stack: err.stack,
                url: req.url,
                method: req.method,
                body: req.body
            });

            res.status(500).json({
                error: 'Internal Server Error',
                timestamp: new Date().toISOString(),
                requestId: req.get('x-request-id') || 'unknown'
            });
        });
    }

    /**
     * Setup health check and monitoring routes
     */
    setupRoutes() {
        // Main health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: this.healthStatus.overall,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                services: this.healthStatus.services,
                lastCheck: this.healthStatus.lastCheck
            });
        });

        // Detailed health check with dependency testing
        this.app.get('/health/detailed', async (req, res) => {
            try {
                await this.performDetailedHealthCheck();
                
                res.json({
                    status: this.healthStatus.overall,
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    services: this.healthStatus.services,
                    database: await this.getDatabaseHealth(),
                    environment: {
                        nodeVersion: process.version,
                        platform: process.platform,
                        nodeEnv: process.env.NODE_ENV
                    }
                });
            } catch (error) {
                this.logger.error('Detailed health check failed', { error: error.message });
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Metrics endpoint
        this.app.get('/metrics', async (req, res) => {
            try {
                const metrics = await this.getSystemMetrics();
                res.json(metrics);
            } catch (error) {
                this.logger.error('Metrics endpoint failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Logs endpoint (last N entries)
        this.app.get('/logs', (req, res) => {
            const lines = parseInt(req.query.lines) || 100;
            const level = req.query.level || 'info';
            
            // This is a simple implementation - in production you'd use a log aggregation service
            res.json({
                message: `Last ${lines} log entries (level: ${level})`,
                note: 'In production, use a proper log aggregation service like ELK or Splunk',
                logFiles: ['logs/combined.log', 'logs/error.log'],
                timestamp: new Date().toISOString()
            });
        });

        // Service status endpoints
        this.app.get('/status/slack', async (req, res) => {
            try {
                const authTest = await this.slack.auth.test();
                res.json({
                    status: 'healthy',
                    service: 'slack',
                    details: {
                        user: authTest.user,
                        team: authTest.team,
                        url: authTest.url
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    service: 'slack',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/status/github', async (req, res) => {
            try {
                const { data: user } = await this.github.users.getAuthenticated();
                const { data: rateLimit } = await this.github.rateLimit.get();
                
                res.json({
                    status: 'healthy',
                    service: 'github',
                    details: {
                        user: user.login,
                        rateLimit: {
                            remaining: rateLimit.resources.core.remaining,
                            limit: rateLimit.resources.core.limit,
                            resetTime: new Date(rateLimit.resources.core.reset * 1000)
                        }
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    service: 'github',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/status/database', async (req, res) => {
            try {
                const dbHealth = await this.getDatabaseHealth();
                res.json({
                    status: 'healthy',
                    service: 'database',
                    details: dbHealth,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    service: 'database',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    /**
     * Setup periodic health checks
     */
    setupHealthChecks() {
        setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                this.logger.error('Periodic health check failed', { error: error.message });
            }
        }, this.config.checkInterval);

        this.logger.info('Health checks configured', {
            interval: `${this.config.checkInterval}ms`,
            port: this.config.port
        });
    }

    /**
     * Perform basic health check
     */
    async performHealthCheck() {
        const checks = {
            database: await this.checkDatabase(),
            slack: await this.checkSlack(),
            github: await this.checkGitHub()
        };

        this.healthStatus.services = checks;
        this.healthStatus.lastCheck = new Date().toISOString();
        this.healthStatus.uptime = process.uptime();

        // Determine overall health
        const unhealthyServices = Object.entries(checks)
            .filter(([_, status]) => status.status !== 'healthy');

        if (unhealthyServices.length === 0) {
            this.healthStatus.overall = 'healthy';
        } else if (unhealthyServices.length >= Object.keys(checks).length) {
            this.healthStatus.overall = 'critical';
        } else {
            this.healthStatus.overall = 'degraded';
        }

        this.logger.debug('Health check completed', {
            overall: this.healthStatus.overall,
            services: checks
        });
    }

    /**
     * Perform detailed health check with full dependency testing
     */
    async performDetailedHealthCheck() {
        await this.performHealthCheck();
        
        // Additional detailed checks
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024)
        };

        this.logger.info('Detailed health check completed', {
            overall: this.healthStatus.overall,
            uptime: process.uptime(),
            memory: memoryUsageMB,
            nodeVersion: process.version
        });
    }

    /**
     * Individual service health checks
     */
    async checkDatabase() {
        try {
            await this.db.getSQL('SELECT 1');
            return { status: 'healthy', responseTime: Date.now() };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }

    async checkSlack() {
        try {
            const start = Date.now();
            await this.slack.auth.test();
            return { status: 'healthy', responseTime: Date.now() - start };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }

    async checkGitHub() {
        try {
            const start = Date.now();
            await this.github.rateLimit.get();
            return { status: 'healthy', responseTime: Date.now() - start };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }

    /**
     * Get database health details
     */
    async getDatabaseHealth() {
        try {
            const stats = await this.db.getStats();
            return {
                status: 'connected',
                statistics: stats,
                path: this.db.dbPath
            };
        } catch (error) {
            throw new Error(`Database health check failed: ${error.message}`);
        }
    }

    /**
     * Get system metrics
     */
    async getSystemMetrics() {
        const memoryUsage = process.memoryUsage();
        
        return {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                rss: memoryUsage.rss,
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external
            },
            cpu: process.cpuUsage(),
            platform: {
                arch: process.arch,
                platform: process.platform,
                version: process.version,
                nodeEnv: process.env.NODE_ENV
            },
            healthStatus: this.healthStatus
        };
    }

    /**
     * Start the monitoring server
     */
    async start() {
        try {
            // Initialize database
            await this.db.initialize();
            
            // Perform initial health check
            await this.performDetailedHealthCheck();
            
            // Start server
            this.server = this.app.listen(this.config.port, () => {
                console.log(`🏥 Production Monitor listening on port ${this.config.port}`);
                console.log(`📊 Health endpoint: http://localhost:${this.config.port}/health`);
                console.log(`📈 Metrics endpoint: http://localhost:${this.config.port}/metrics`);
                console.log(`🔍 Detailed health: http://localhost:${this.config.port}/health/detailed`);
                
                this.logger.info('Production monitor started', { 
                    port: this.config.port,
                    logLevel: this.config.logLevel,
                    checkInterval: this.config.checkInterval
                });
            });

        } catch (error) {
            this.logger.error('Failed to start production monitor', { error: error.message });
            throw error;
        }
    }

    /**
     * Stop the monitoring server
     */
    async stop() {
        if (this.server) {
            this.server.close();
            this.logger.info('Production monitor stopped');
        }
    }
}

/**
 * Demo function
 */
async function startProductionMonitor() {
    console.log('🏥 Claude Production Monitor - Starting...\n');
    
    console.log('✅ Production Monitoring Features:');
    console.log('   • Health checks for all services');
    console.log('   • Structured logging with rotation');
    console.log('   • System metrics collection');
    console.log('   • Error tracking and reporting');
    console.log('   • Database health monitoring');
    console.log('   • External API status checks');
    console.log('   • Memory and performance monitoring');
    
    try {
        const monitor = new ProductionMonitor();
        await monitor.start();
        console.log('🚀 Production monitor started successfully!');
    } catch (error) {
        console.error('❌ Failed to start production monitor:', error.message);
        process.exit(1);
    }
}

module.exports = {
    ProductionMonitor
};

// Run production monitor if called directly
if (require.main === module) {
    startProductionMonitor().catch(console.error);
}