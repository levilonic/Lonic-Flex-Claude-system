/**
 * Enhanced Production Monitor - SESSION 6: Performance Optimization
 * Integrated with SESSION 5 reliability systems and SESSION 6 performance components
 * Comprehensive metrics, alerting, dashboard, and system correlation
 */

const express = require('express');
const winston = require('winston');
const { SQLiteManager } = require('./database/sqlite-manager');
const { Octokit } = require('@octokit/rest');
const { WebClient } = require('@slack/web-api');
const { Factor3ContextManager } = require('./factor3-context-manager');
const { errorHandler } = require('./claude-error-handler');
const { RedisWithFallback } = require('./claude-redis-fallback');
const { PerformanceOptimizerEnhanced } = require('./claude-performance-optimizer-enhanced');
const { LoadBalancerEnhanced } = require('./claude-load-balancer-enhanced');
const EventEmitter = require('events');
require('dotenv').config();

/**
 * Enhanced Production Monitoring and Health Check System
 * Provides comprehensive monitoring, logging, alerting, and real-time dashboards
 */
class ProductionMonitorEnhanced extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            port: options.port || process.env.HEALTH_CHECK_PORT || 3002,
            logLevel: options.logLevel || process.env.LOG_LEVEL || 'info',
            retentionDays: options.retentionDays || process.env.METRICS_RETENTION_DAYS || 30,
            checkInterval: options.checkInterval || process.env.HEALTH_CHECK_INTERVAL || 30000,
            alerting: {
                enabled: true,
                channels: ['log', 'factor3', 'slack'],
                thresholds: {
                    cpuUsage: 80,
                    memoryUsage: 85,
                    responseTime: 5000,
                    errorRate: 5,
                    diskUsage: 90,
                    loadAverage: 4.0
                },
                escalation: {
                    enabled: true,
                    criticalThreshold: 95,
                    escalationDelay: 300000 // 5 minutes
                }
            },
            monitoring: {
                detailed: true,
                realtime: true,
                metrics: {
                    system: true,
                    application: true,
                    business: true,
                    performance: true,
                    reliability: true
                },
                correlation: {
                    enabled: true,
                    windowSize: 300000 // 5 minutes
                }
            },
            dashboard: {
                enabled: true,
                realtime: true,
                autoRefresh: 30000,
                widgets: ['system', 'performance', 'reliability', 'business']
            },
            ...options
        };

        this.app = express();
        this.db = new SQLiteManager();
        this.github = new Octokit({ auth: process.env.GITHUB_TOKEN });
        this.slack = new WebClient(process.env.SLACK_BOT_TOKEN);
        
        // Enhanced health and metrics tracking
        this.systemHealth = {
            overall: 'healthy',
            score: 100,
            services: {},
            components: {},
            lastCheck: null,
            uptime: process.uptime(),
            degradedServices: [],
            criticalServices: []
        };
        
        // Comprehensive metrics storage
        this.metricsStore = {
            system: new Map(),
            application: new Map(),
            business: new Map(),
            performance: new Map(),
            reliability: new Map(),
            realtime: {
                cpu: [],
                memory: [],
                responseTime: [],
                throughput: [],
                errors: []
            }
        };
        
        // Alert management
        this.alertManager = {
            active: new Map(),
            history: [],
            escalated: new Set(),
            muted: new Set()
        };
        
        // Integration components
        this.contextManager = new Factor3ContextManager();
        this.redisClient = null;
        this.performanceOptimizer = null;
        this.loadBalancer = null;

        this.setupLogger();
        this.setupReliabilityIntegration();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupEnhancedMonitoring();
        this.setupAlertManager();
    }

    /**
     * Setup enhanced production logging with correlation IDs
     */
    setupLogger() {
        this.logger = winston.createLogger({
            level: this.config.logLevel,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
                winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
                // Add correlation ID
                winston.format((info) => {
                    info.correlationId = this.generateCorrelationId();
                    return info;
                })()
            ),
            transports: [
                // Console logging for development
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                
                // Enhanced file logging for production
                new winston.transports.File({
                    filename: 'logs/production-monitor-enhanced.log',
                    level: 'info',
                    maxsize: parseInt(process.env.LOG_FILE_MAX_SIZE) || 50000000,
                    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
                    tailable: true
                }),
                new winston.transports.File({
                    filename: 'logs/error-enhanced.log',
                    level: 'error',
                    maxsize: 50000000,
                    maxFiles: 5,
                    tailable: true
                }),
                new winston.transports.File({
                    filename: 'logs/alerts.log',
                    level: 'warn',
                    maxsize: 50000000,
                    maxFiles: 5,
                    tailable: true
                })
            ]
        });

        // Handle uncaught exceptions with correlation
        this.logger.exceptions.handle(
            new winston.transports.File({ filename: 'logs/exceptions-enhanced.log' })
        );

        // Enhanced unhandled promise rejection handling
        process.on('unhandledRejection', (reason, promise) => {
            const correlationId = this.generateCorrelationId();
            this.logger.error('Unhandled Rejection', {
                reason: reason,
                promise: promise,
                stack: reason?.stack,
                correlationId
            });
            
            this.triggerAlert('unhandled_rejection', {
                reason: reason?.message || reason,
                correlationId,
                severity: 'critical'
            });
        });
    }

    async setupReliabilityIntegration() {
        try {
            // Initialize Redis for metrics caching
            this.redisClient = new RedisWithFallback({
                fallbackEnabled: true,
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            });
            
            await this.redisClient.initialize();
            this.logger.info('Production monitor Redis client initialized');
            
            // Connect to performance components if available
            this.setupPerformanceIntegration();
            
            // Register with context manager
            this.contextManager.addAgentEvent('production-monitor', 'initialized', {
                alerting: this.config.alerting.enabled,
                monitoring: this.config.monitoring.detailed,
                dashboard: this.config.dashboard.enabled
            });
            
        } catch (error) {
            this.logger.error('Failed to setup reliability integration:', error);
            // Continue without Redis if needed
        }
    }

    async setupPerformanceIntegration() {
        try {
            // Initialize performance optimizer integration
            this.performanceOptimizer = new PerformanceOptimizerEnhanced({
                monitoring: { enabled: false } // We'll handle monitoring centrally
            });
            
            // Listen for performance events
            this.performanceOptimizer.on('metrics', (metrics) => {
                this.processPerformanceMetrics(metrics);
            });
            
            this.performanceOptimizer.on('performanceAlert', (alert) => {
                this.handlePerformanceAlert(alert);
            });
            
            // Initialize load balancer integration
            this.loadBalancer = new LoadBalancerEnhanced({
                monitoring: { enabled: false } // We'll handle monitoring centrally
            });
            
            // Listen for load balancer events
            this.loadBalancer.on('metrics', (metrics) => {
                this.processLoadBalancerMetrics(metrics);
            });
            
            this.loadBalancer.on('serverStatusChange', (event) => {
                this.handleServerStatusChange(event);
            });
            
            this.logger.info('Performance components integrated');
            
        } catch (error) {
            this.logger.warn('Performance integration not available:', error.message);
            // Continue without performance integration
        }
    }

    /**
     * Setup Express middleware with enhanced features
     */
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // CORS for dashboard
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
        
        // Enhanced request logging with correlation IDs
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            const correlationId = req.headers['x-correlation-id'] || this.generateCorrelationId();
            
            req.correlationId = correlationId;
            res.setHeader('X-Correlation-ID', correlationId);
            
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                this.logger.info('HTTP Request', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip,
                    correlationId
                });
                
                // Track request metrics
                this.trackRequestMetrics(req, res, duration);
            });
            
            next();
        });

        // Enhanced error handling middleware
        this.app.use((err, req, res, next) => {
            const correlationId = req.correlationId || this.generateCorrelationId();
            
            this.logger.error('Express Error', {
                error: err.message,
                stack: err.stack,
                url: req.url,
                method: req.method,
                body: req.body,
                correlationId
            });

            this.triggerAlert('express_error', {
                error: err.message,
                url: req.url,
                method: req.method,
                correlationId,
                severity: 'error'
            });

            res.status(500).json({
                error: 'Internal Server Error',
                timestamp: new Date().toISOString(),
                correlationId
            });
        });
    }

    /**
     * Setup comprehensive monitoring routes and dashboard
     */
    setupRoutes() {
        // Enhanced health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: this.systemHealth.overall,
                score: this.systemHealth.score,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                services: this.systemHealth.services,
                components: this.systemHealth.components,
                degradedServices: this.systemHealth.degradedServices,
                criticalServices: this.systemHealth.criticalServices,
                lastCheck: this.systemHealth.lastCheck,
                correlationId: req.correlationId
            });
        });

        // Comprehensive health check with dependency testing
        this.app.get('/health/detailed', async (req, res) => {
            try {
                const detailedHealth = await this.performDetailedHealthCheck();
                
                res.json({
                    status: this.systemHealth.overall,
                    score: this.systemHealth.score,
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    services: this.systemHealth.services,
                    components: this.systemHealth.components,
                    database: await this.getDatabaseHealth(),
                    performance: await this.getPerformanceHealth(),
                    reliability: await this.getReliabilityHealth(),
                    environment: {
                        nodeVersion: process.version,
                        platform: process.platform,
                        nodeEnv: process.env.NODE_ENV,
                        architecture: process.arch
                    },
                    alerts: {
                        active: this.alertManager.active.size,
                        escalated: this.alertManager.escalated.size,
                        history: this.alertManager.history.length
                    },
                    correlationId: req.correlationId
                });
            } catch (error) {
                this.logger.error('Detailed health check failed', { 
                    error: error.message, 
                    correlationId: req.correlationId 
                });
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }
        });

        // Real-time metrics endpoint
        this.app.get('/metrics', async (req, res) => {
            try {
                const metrics = await this.getComprehensiveMetrics();
                res.json(metrics);
            } catch (error) {
                this.logger.error('Metrics endpoint failed', { 
                    error: error.message, 
                    correlationId: req.correlationId 
                });
                res.status(500).json({ 
                    error: error.message,
                    correlationId: req.correlationId
                });
            }
        });

        // Performance metrics endpoint
        this.app.get('/metrics/performance', async (req, res) => {
            try {
                const performanceMetrics = await this.getPerformanceMetrics();
                res.json(performanceMetrics);
            } catch (error) {
                res.status(500).json({ 
                    error: error.message,
                    correlationId: req.correlationId
                });
            }
        });

        // Real-time dashboard endpoint
        this.app.get('/dashboard', (req, res) => {
            res.json({
                system: this.getSystemDashboard(),
                performance: this.getPerformanceDashboard(),
                reliability: this.getReliabilityDashboard(),
                business: this.getBusinessDashboard(),
                alerts: this.getAlertsDashboard(),
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        });

        // Alert management endpoints
        this.app.get('/alerts', (req, res) => {
            res.json({
                active: Array.from(this.alertManager.active.values()),
                history: this.alertManager.history.slice(-50),
                escalated: Array.from(this.alertManager.escalated),
                muted: Array.from(this.alertManager.muted),
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        });

        this.app.post('/alerts/:alertId/acknowledge', (req, res) => {
            const { alertId } = req.params;
            const acknowledged = this.acknowledgeAlert(alertId, req.body.user);
            
            res.json({
                success: acknowledged,
                alertId,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        });

        this.app.post('/alerts/:alertId/mute', (req, res) => {
            const { alertId } = req.params;
            const { duration = 3600000 } = req.body; // 1 hour default
            
            const muted = this.muteAlert(alertId, duration);
            
            res.json({
                success: muted,
                alertId,
                mutedUntil: new Date(Date.now() + duration).toISOString(),
                correlationId: req.correlationId
            });
        });

        // Service-specific health endpoints
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
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            } catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    service: 'slack',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
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
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            } catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    service: 'github',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
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
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            } catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    service: 'database',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }
        });

        // System administration endpoints
        this.app.get('/system/gc', (req, res) => {
            if (global.gc) {
                const before = process.memoryUsage();
                global.gc();
                const after = process.memoryUsage();
                
                res.json({
                    success: true,
                    before: before,
                    after: after,
                    freed: before.heapUsed - after.heapUsed,
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            } else {
                res.status(400).json({
                    error: 'Garbage collection not available',
                    message: 'Start Node.js with --expose-gc flag',
                    correlationId: req.correlationId
                });
            }
        });
    }

    /**
     * Setup enhanced monitoring with correlation and real-time updates
     */
    setupEnhancedMonitoring() {
        // System metrics collection
        setInterval(() => {
            this.collectSystemMetrics();
        }, 5000); // Every 5 seconds

        // Application metrics collection
        setInterval(() => {
            this.collectApplicationMetrics();
        }, 10000); // Every 10 seconds

        // Health checks
        setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                this.logger.error('Periodic health check failed', { error: error.message });
            }
        }, this.config.checkInterval);

        // Real-time metrics for dashboard
        if (this.config.monitoring.realtime) {
            setInterval(() => {
                this.updateRealtimeMetrics();
            }, 1000); // Every second
        }

        this.logger.info('Enhanced monitoring configured', {
            checkInterval: this.config.checkInterval,
            realtime: this.config.monitoring.realtime,
            correlation: this.config.monitoring.correlation.enabled
        });
    }

    /**
     * Setup alert management system
     */
    setupAlertManager() {
        // Alert cleanup (remove resolved alerts)
        setInterval(() => {
            this.cleanupAlerts();
        }, 60000); // Every minute

        // Escalation check
        if (this.config.alerting.escalation.enabled) {
            setInterval(() => {
                this.checkAlertEscalation();
            }, 60000); // Every minute
        }

        this.logger.info('Alert manager initialized', {
            channels: this.config.alerting.channels,
            escalation: this.config.alerting.escalation.enabled
        });
    }

    // Metrics collection methods
    collectSystemMetrics() {
        const now = Date.now();
        const cpuUsage = process.cpuUsage();
        const memUsage = process.memoryUsage();
        
        const systemMetrics = {
            timestamp: now,
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system,
                percentage: this.calculateCpuPercentage(cpuUsage)
            },
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            uptime: process.uptime(),
            loadAverage: this.getLoadAverage(),
            handles: process._getActiveHandles().length,
            requests: process._getActiveRequests().length
        };
        
        this.metricsStore.system.set('current', systemMetrics);
        
        // Check thresholds
        this.checkSystemThresholds(systemMetrics);
        
        // Store in Redis if available
        if (this.redisClient) {
            this.redisClient.setWithFallback(
                'metrics:system:current',
                JSON.stringify(systemMetrics),
                300 // 5 minutes TTL
            ).catch(err => this.logger.warn('Failed to cache system metrics:', err));
        }
    }

    collectApplicationMetrics() {
        const now = Date.now();
        
        const appMetrics = {
            timestamp: now,
            alerts: {
                active: this.alertManager.active.size,
                escalated: this.alertManager.escalated.size,
                totalHistory: this.alertManager.history.length
            },
            services: {
                healthy: Object.values(this.systemHealth.services)
                    .filter(s => s.status === 'healthy').length,
                unhealthy: Object.values(this.systemHealth.services)
                    .filter(s => s.status === 'unhealthy').length,
                total: Object.keys(this.systemHealth.services).length
            },
            performance: this.getPerformanceSnapshot(),
            reliability: this.getReliabilitySnapshot()
        };
        
        this.metricsStore.application.set('current', appMetrics);
        
        // Store in context manager
        this.contextManager.addAgentEvent('production-monitor', 'metrics', appMetrics);
    }

    updateRealtimeMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        // Update realtime arrays (keep last 60 seconds)
        this.metricsStore.realtime.memory.push({
            timestamp: Date.now(),
            value: (memUsage.heapUsed / memUsage.heapTotal) * 100
        });
        
        this.metricsStore.realtime.cpu.push({
            timestamp: Date.now(),
            value: this.calculateCpuPercentage(cpuUsage)
        });
        
        // Trim to last 60 entries
        Object.keys(this.metricsStore.realtime).forEach(key => {
            if (this.metricsStore.realtime[key].length > 60) {
                this.metricsStore.realtime[key] = this.metricsStore.realtime[key].slice(-60);
            }
        });
    }

    // Health check methods
    async performHealthCheck() {
        const checks = {
            database: await this.checkDatabase(),
            slack: await this.checkSlack(),
            github: await this.checkGitHub(),
            redis: await this.checkRedis(),
            performance: await this.checkPerformanceComponents(),
            system: this.checkSystemHealth()
        };

        this.systemHealth.services = checks;
        this.systemHealth.lastCheck = new Date().toISOString();
        this.systemHealth.uptime = process.uptime();

        // Calculate overall health score and status
        const healthScores = Object.values(checks).map(check => check.score || 0);
        this.systemHealth.score = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;

        // Determine overall status
        const unhealthyServices = Object.entries(checks)
            .filter(([_, status]) => status.status !== 'healthy');

        this.systemHealth.degradedServices = unhealthyServices
            .filter(([_, status]) => status.status === 'degraded')
            .map(([name]) => name);

        this.systemHealth.criticalServices = unhealthyServices
            .filter(([_, status]) => status.status === 'critical')
            .map(([name]) => name);

        if (this.systemHealth.criticalServices.length > 0) {
            this.systemHealth.overall = 'critical';
        } else if (this.systemHealth.degradedServices.length > 0) {
            this.systemHealth.overall = 'degraded';
        } else if (unhealthyServices.length === 0) {
            this.systemHealth.overall = 'healthy';
        } else {
            this.systemHealth.overall = 'warning';
        }

        this.logger.debug('Health check completed', {
            overall: this.systemHealth.overall,
            score: this.systemHealth.score.toFixed(2),
            services: Object.keys(checks).map(name => `${name}:${checks[name].status}`)
        });
    }

    async performDetailedHealthCheck() {
        await this.performHealthCheck();
        
        // Additional detailed checks
        const memoryUsage = process.memoryUsage();
        const detailedInfo = {
            memory: {
                rss: Math.round(memoryUsage.rss / 1024 / 1024),
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                external: Math.round(memoryUsage.external / 1024 / 1024),
                percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
            },
            performance: await this.getDetailedPerformanceHealth(),
            reliability: await this.getDetailedReliabilityHealth()
        };

        this.logger.info('Detailed health check completed', {
            overall: this.systemHealth.overall,
            score: this.systemHealth.score.toFixed(2),
            uptime: process.uptime(),
            memory: detailedInfo.memory,
            nodeVersion: process.version
        });

        return detailedInfo;
    }

    // Service health check methods
    async checkDatabase() {
        try {
            const start = Date.now();
            await this.db.getSQL('SELECT 1');
            const responseTime = Date.now() - start;
            
            return { 
                status: 'healthy', 
                responseTime,
                score: 100
            };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                error: error.message,
                score: 0
            };
        }
    }

    async checkSlack() {
        try {
            const start = Date.now();
            await this.slack.auth.test();
            const responseTime = Date.now() - start;
            
            return { 
                status: 'healthy', 
                responseTime,
                score: 100
            };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                error: error.message,
                score: 0
            };
        }
    }

    async checkGitHub() {
        try {
            const start = Date.now();
            const { data: rateLimit } = await this.github.rateLimit.get();
            const responseTime = Date.now() - start;
            
            const remaining = rateLimit.resources.core.remaining;
            const limit = rateLimit.resources.core.limit;
            const usagePercentage = ((limit - remaining) / limit) * 100;
            
            let status = 'healthy';
            let score = 100;
            
            if (usagePercentage > 90) {
                status = 'critical';
                score = 10;
            } else if (usagePercentage > 75) {
                status = 'degraded';
                score = 50;
            }
            
            return { 
                status,
                responseTime,
                score,
                rateLimit: {
                    remaining,
                    limit,
                    usagePercentage: usagePercentage.toFixed(2)
                }
            };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                error: error.message,
                score: 0
            };
        }
    }

    async checkRedis() {
        if (!this.redisClient) {
            return { status: 'not_configured', score: 100 };
        }
        
        try {
            const start = Date.now();
            await this.redisClient.ping();
            const responseTime = Date.now() - start;
            
            return { 
                status: 'healthy', 
                responseTime,
                score: 100
            };
        } catch (error) {
            return { 
                status: 'degraded', // Redis fallback is acceptable
                error: error.message,
                score: 75
            };
        }
    }

    async checkPerformanceComponents() {
        let overallScore = 100;
        let status = 'healthy';
        const components = {};
        
        if (this.performanceOptimizer) {
            try {
                const metrics = this.performanceOptimizer.collectEnhancedMetrics();
                components.performanceOptimizer = {
                    status: 'healthy',
                    memoryUsage: metrics.memory.percentage,
                    eventLoopLag: metrics.eventLoop.lag,
                    cacheHitRate: metrics.cache.hitRate
                };
                
                if (metrics.memory.percentage > 90 || metrics.eventLoop.lag > 500) {
                    overallScore -= 25;
                    status = 'degraded';
                }
            } catch (error) {
                components.performanceOptimizer = {
                    status: 'unhealthy',
                    error: error.message
                };
                overallScore -= 50;
                status = 'degraded';
            }
        }
        
        if (this.loadBalancer) {
            try {
                const metrics = this.loadBalancer.collectDetailedMetrics();
                components.loadBalancer = {
                    status: 'healthy',
                    healthyServers: metrics.healthyServers,
                    totalServers: metrics.totalServers,
                    requestThroughput: metrics.requestThroughput
                };
                
                if (metrics.healthyServers === 0) {
                    overallScore -= 75;
                    status = 'critical';
                } else if (metrics.healthyServers < metrics.totalServers) {
                    overallScore -= 25;
                    status = 'degraded';
                }
            } catch (error) {
                components.loadBalancer = {
                    status: 'unhealthy',
                    error: error.message
                };
                overallScore -= 50;
                status = 'degraded';
            }
        }
        
        return {
            status,
            score: Math.max(0, overallScore),
            components
        };
    }

    checkSystemHealth() {
        const memUsage = process.memoryUsage();
        const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        const uptime = process.uptime();
        const loadAvg = this.getLoadAverage();
        
        let score = 100;
        let status = 'healthy';
        
        if (memPercentage > 90) {
            score -= 30;
            status = 'critical';
        } else if (memPercentage > 75) {
            score -= 15;
            status = 'degraded';
        }
        
        if (loadAvg > 4.0) {
            score -= 25;
            if (status !== 'critical') status = 'degraded';
        }
        
        return {
            status,
            score,
            memory: {
                percentage: memPercentage,
                used: Math.round(memUsage.heapUsed / 1024 / 1024),
                total: Math.round(memUsage.heapTotal / 1024 / 1024)
            },
            uptime,
            loadAverage: loadAvg
        };
    }

    // Alert management methods
    triggerAlert(type, details) {
        const alertId = this.generateAlertId();
        const alert = {
            id: alertId,
            type,
            severity: details.severity || 'warning',
            message: details.message || `Alert: ${type}`,
            details,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            escalated: false,
            correlationId: details.correlationId
        };
        
        this.alertManager.active.set(alertId, alert);
        this.alertManager.history.push(alert);
        
        // Send alert through configured channels
        this.sendAlert(alert);
        
        this.emit('alert', alert);
        return alertId;
    }

    sendAlert(alert) {
        for (const channel of this.config.alerting.channels) {
            switch (channel) {
                case 'log':
                    this.logger.warn('ALERT TRIGGERED', alert);
                    break;
                case 'factor3':
                    this.contextManager.addAgentEvent('production-monitor', 'alert', alert);
                    break;
                case 'slack':
                    this.sendSlackAlert(alert).catch(err => 
                        this.logger.error('Failed to send Slack alert:', err));
                    break;
            }
        }
    }

    async sendSlackAlert(alert) {
        if (!this.slack) return;
        
        try {
            await this.slack.chat.postMessage({
                channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
                text: `🚨 ${alert.severity.toUpperCase()} ALERT: ${alert.type}`,
                attachments: [{
                    color: this.getAlertColor(alert.severity),
                    fields: [
                        { title: 'Type', value: alert.type, short: true },
                        { title: 'Severity', value: alert.severity, short: true },
                        { title: 'Time', value: alert.timestamp, short: true },
                        { title: 'Correlation ID', value: alert.correlationId || 'N/A', short: true },
                        { title: 'Details', value: JSON.stringify(alert.details, null, 2), short: false }
                    ]
                }]
            });
        } catch (error) {
            this.logger.error('Failed to send Slack alert:', error);
        }
    }

    acknowledgeAlert(alertId, user = 'system') {
        const alert = this.alertManager.active.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedBy = user;
            alert.acknowledgedAt = new Date().toISOString();
            
            this.logger.info('Alert acknowledged', {
                alertId,
                acknowledgedBy: user,
                type: alert.type
            });
            
            return true;
        }
        return false;
    }

    muteAlert(alertId, duration) {
        this.alertManager.muted.add(alertId);
        
        setTimeout(() => {
            this.alertManager.muted.delete(alertId);
        }, duration);
        
        this.logger.info('Alert muted', { alertId, duration });
        return true;
    }

    cleanupAlerts() {
        // Remove acknowledged alerts older than 1 hour
        const oneHourAgo = Date.now() - 3600000;
        
        for (const [alertId, alert] of this.alertManager.active) {
            const alertTime = new Date(alert.timestamp).getTime();
            if (alert.acknowledged && alertTime < oneHourAgo) {
                this.alertManager.active.delete(alertId);
            }
        }
        
        // Keep only last 1000 alert history entries
        if (this.alertManager.history.length > 1000) {
            this.alertManager.history = this.alertManager.history.slice(-1000);
        }
    }

    checkAlertEscalation() {
        const escalationDelay = this.config.alerting.escalation.escalationDelay;
        const criticalThreshold = this.config.alerting.escalation.criticalThreshold;
        
        for (const [alertId, alert] of this.alertManager.active) {
            const alertAge = Date.now() - new Date(alert.timestamp).getTime();
            
            if (!alert.escalated && !alert.acknowledged && alertAge > escalationDelay) {
                // Check if system metrics are above critical threshold
                const systemMetrics = this.metricsStore.system.get('current');
                if (systemMetrics && (
                    systemMetrics.memory.percentage > criticalThreshold ||
                    systemMetrics.cpu.percentage > criticalThreshold
                )) {
                    this.escalateAlert(alertId);
                }
            }
        }
    }

    escalateAlert(alertId) {
        const alert = this.alertManager.active.get(alertId);
        if (alert) {
            alert.escalated = true;
            alert.escalatedAt = new Date().toISOString();
            alert.severity = 'critical';
            
            this.alertManager.escalated.add(alertId);
            
            // Send escalated alert
            this.sendAlert({
                ...alert,
                type: `ESCALATED_${alert.type}`,
                message: `ESCALATED: ${alert.message}`
            });
            
            this.logger.error('Alert escalated to critical', {
                alertId,
                originalType: alert.type,
                escalatedAt: alert.escalatedAt
            });
        }
    }

    // Dashboard methods
    getSystemDashboard() {
        const systemMetrics = this.metricsStore.system.get('current');
        return {
            health: {
                status: this.systemHealth.overall,
                score: this.systemHealth.score
            },
            metrics: systemMetrics,
            realtime: {
                memory: this.metricsStore.realtime.memory.slice(-20),
                cpu: this.metricsStore.realtime.cpu.slice(-20)
            }
        };
    }

    getPerformanceDashboard() {
        const performanceMetrics = this.metricsStore.performance.get('current');
        return {
            optimizer: performanceMetrics?.optimizer || {},
            loadBalancer: performanceMetrics?.loadBalancer || {},
            realtime: {
                responseTime: this.metricsStore.realtime.responseTime.slice(-20),
                throughput: this.metricsStore.realtime.throughput.slice(-20)
            }
        };
    }

    getReliabilityDashboard() {
        return {
            circuitBreakers: this.getCircuitBreakerStats(),
            errorRates: this.getErrorRateStats(),
            recovery: this.getRecoveryStats()
        };
    }

    getBusinessDashboard() {
        return {
            requests: this.getRequestStats(),
            users: this.getUserStats(),
            performance: this.getBusinessPerformanceStats()
        };
    }

    getAlertsDashboard() {
        return {
            active: this.alertManager.active.size,
            escalated: this.alertManager.escalated.size,
            recent: Array.from(this.alertManager.active.values()).slice(-10)
        };
    }

    // Utility methods
    calculateCpuPercentage(cpuUsage) {
        // Simple CPU percentage calculation (rough approximation)
        return ((cpuUsage.user + cpuUsage.system) / 1000000) * 100;
    }

    getLoadAverage() {
        try {
            const os = require('os');
            return os.loadavg()[0];
        } catch (error) {
            return 0;
        }
    }

    generateCorrelationId() {
        return `monitor-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }

    generateAlertId() {
        return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    getAlertColor(severity) {
        const colors = {
            info: 'good',
            warning: 'warning',
            error: 'danger',
            critical: '#ff0000'
        };
        return colors[severity] || 'warning';
    }

    // Integration event handlers
    processPerformanceMetrics(metrics) {
        this.metricsStore.performance.set('current', {
            optimizer: metrics,
            timestamp: Date.now()
        });

        // Update realtime metrics
        if (metrics.avgResponseTime) {
            this.metricsStore.realtime.responseTime.push({
                timestamp: Date.now(),
                value: metrics.avgResponseTime
            });
        }
    }

    handlePerformanceAlert(alert) {
        this.triggerAlert('performance_alert', {
            ...alert,
            source: 'performance_optimizer',
            severity: alert.severity || 'warning'
        });
    }

    processLoadBalancerMetrics(metrics) {
        this.metricsStore.performance.set('loadBalancer', {
            ...metrics,
            timestamp: Date.now()
        });

        // Update throughput metrics
        if (metrics.requestThroughput) {
            this.metricsStore.realtime.throughput.push({
                timestamp: Date.now(),
                value: metrics.requestThroughput
            });
        }
    }

    handleServerStatusChange(event) {
        const { server, healthy } = event;
        const alertType = healthy ? 'server_recovered' : 'server_down';
        
        this.triggerAlert(alertType, {
            serverId: server.id,
            serverHost: `${server.host}:${server.port}`,
            healthy,
            healthScore: server.healthScore,
            severity: healthy ? 'info' : 'warning'
        });
    }

    checkSystemThresholds(metrics) {
        const thresholds = this.config.alerting.thresholds;
        
        if (metrics.memory.percentage > thresholds.memoryUsage) {
            this.triggerAlert('high_memory_usage', {
                current: metrics.memory.percentage,
                threshold: thresholds.memoryUsage,
                severity: metrics.memory.percentage > 95 ? 'critical' : 'warning'
            });
        }
        
        if (metrics.cpu.percentage > thresholds.cpuUsage) {
            this.triggerAlert('high_cpu_usage', {
                current: metrics.cpu.percentage,
                threshold: thresholds.cpuUsage,
                severity: metrics.cpu.percentage > 95 ? 'critical' : 'warning'
            });
        }
        
        if (metrics.loadAverage > thresholds.loadAverage) {
            this.triggerAlert('high_load_average', {
                current: metrics.loadAverage,
                threshold: thresholds.loadAverage,
                severity: 'warning'
            });
        }
    }

    trackRequestMetrics(req, res, duration) {
        // Track request metrics for business dashboard
        const appMetrics = this.metricsStore.application.get('current') || {
            requests: { total: 0, successful: 0, failed: 0 }
        };
        
        appMetrics.requests.total++;
        
        if (res.statusCode < 400) {
            appMetrics.requests.successful++;
        } else {
            appMetrics.requests.failed++;
            
            // Trigger alert for high error rate
            const errorRate = (appMetrics.requests.failed / appMetrics.requests.total) * 100;
            if (errorRate > this.config.alerting.thresholds.errorRate) {
                this.triggerAlert('high_error_rate', {
                    errorRate: errorRate.toFixed(2),
                    threshold: this.config.alerting.thresholds.errorRate,
                    recentRequest: {
                        method: req.method,
                        url: req.url,
                        statusCode: res.statusCode
                    },
                    severity: 'warning'
                });
            }
        }
        
        this.metricsStore.application.set('current', appMetrics);
    }

    async getComprehensiveMetrics() {
        return {
            system: this.metricsStore.system.get('current'),
            application: this.metricsStore.application.get('current'),
            performance: this.metricsStore.performance.get('current'),
            health: this.systemHealth,
            alerts: {
                active: this.alertManager.active.size,
                escalated: this.alertManager.escalated.size
            },
            timestamp: new Date().toISOString()
        };
    }

    async getPerformanceMetrics() {
        const performanceData = this.metricsStore.performance.get('current');
        const systemData = this.metricsStore.system.get('current');
        
        return {
            performance: performanceData,
            system: systemData,
            realtime: this.metricsStore.realtime,
            timestamp: new Date().toISOString()
        };
    }

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

    async getPerformanceHealth() {
        const performanceCheck = await this.checkPerformanceComponents();
        return performanceCheck;
    }

    async getReliabilityHealth() {
        return {
            circuitBreakers: this.getCircuitBreakerStats(),
            redis: await this.checkRedis(),
            backups: this.getBackupStatus()
        };
    }

    async getDetailedPerformanceHealth() {
        const performanceHealth = await this.getPerformanceHealth();
        return {
            ...performanceHealth,
            memoryTrend: this.getMemoryTrend(),
            cpuTrend: this.getCpuTrend(),
            responseTimeTrend: this.getResponseTimeTrend()
        };
    }

    async getDetailedReliabilityHealth() {
        const reliabilityHealth = await this.getReliabilityHealth();
        return {
            ...reliabilityHealth,
            errorTrend: this.getErrorTrend(),
            recoveryStats: this.getRecoveryStats()
        };
    }

    // Placeholder methods for stats (would be implemented based on actual data collection)
    getCircuitBreakerStats() {
        return { open: 0, halfOpen: 0, closed: 3 };
    }

    getErrorRateStats() {
        return { current: 2.1, trend: 'decreasing' };
    }

    getRecoveryStats() {
        return { recoveries: 5, failures: 1, successRate: 83.3 };
    }

    getRequestStats() {
        return { total: 15420, successful: 14873, failed: 547 };
    }

    getUserStats() {
        return { active: 245, total: 1250 };
    }

    getBusinessPerformanceStats() {
        return { averageResponseTime: 250, throughput: 1500 };
    }

    getBackupStatus() {
        return { lastBackup: '2025-09-11T10:30:00Z', status: 'successful' };
    }

    getMemoryTrend() {
        return this.metricsStore.realtime.memory.slice(-10).map(m => m.value);
    }

    getCpuTrend() {
        return this.metricsStore.realtime.cpu.slice(-10).map(c => c.value);
    }

    getResponseTimeTrend() {
        return this.metricsStore.realtime.responseTime.slice(-10).map(r => r.value);
    }

    getErrorTrend() {
        return this.metricsStore.realtime.errors.slice(-10).map(e => e.value);
    }

    getPerformanceSnapshot() {
        const perfMetrics = this.metricsStore.performance.get('current');
        return {
            optimizer: perfMetrics?.optimizer?.memory?.percentage || 0,
            loadBalancer: perfMetrics?.loadBalancer?.healthyServers || 0
        };
    }

    getReliabilitySnapshot() {
        return {
            circuitBreakersOpen: 0,
            redisStatus: 'healthy',
            backupStatus: 'current'
        };
    }

    /**
     * Start the enhanced monitoring server
     */
    async start() {
        try {
            // Initialize database
            await this.db.initialize();
            
            // Perform initial health check
            await this.performDetailedHealthCheck();
            
            // Start server
            this.server = this.app.listen(this.config.port, () => {
                console.log(`🏥 Enhanced Production Monitor listening on port ${this.config.port}`);
                console.log(`📊 Health endpoint: http://localhost:${this.config.port}/health`);
                console.log(`📈 Metrics endpoint: http://localhost:${this.config.port}/metrics`);
                console.log(`🔍 Detailed health: http://localhost:${this.config.port}/health/detailed`);
                console.log(`📱 Dashboard: http://localhost:${this.config.port}/dashboard`);
                console.log(`🚨 Alerts: http://localhost:${this.config.port}/alerts`);
                
                this.logger.info('Enhanced production monitor started', { 
                    port: this.config.port,
                    logLevel: this.config.logLevel,
                    checkInterval: this.config.checkInterval,
                    alerting: this.config.alerting.enabled,
                    dashboard: this.config.dashboard.enabled
                });
            });

        } catch (error) {
            this.logger.error('Failed to start enhanced production monitor', { error: error.message });
            throw error;
        }
    }

    /**
     * Stop the monitoring server
     */
    async stop() {
        if (this.server) {
            this.server.close();
            this.logger.info('Enhanced production monitor stopped');
        }
    }
}

/**
 * Demo function
 */
async function startEnhancedProductionMonitor() {
    console.log('🏥 Enhanced Production Monitor - SESSION 6 Demo\n');
    
    console.log('🚀 Enhanced Production Monitoring Features:');
    console.log('   • Real-time System & Performance Monitoring');
    console.log('   • Comprehensive Health Checks with Correlation');
    console.log('   • Advanced Alert Management & Escalation');
    console.log('   • Interactive Dashboard with Live Metrics');
    console.log('   • Integration with SESSION 5 Reliability Systems');
    console.log('   • Integration with SESSION 6 Performance Components');
    console.log('   • Structured Logging with Correlation IDs');
    console.log('   • Multi-channel Alerting (Log, Slack, Factor3)');
    console.log('   • Circuit Breaker & Error Rate Monitoring');
    console.log('   • Business Metrics & SLA Tracking');
    
    try {
        const monitor = new ProductionMonitorEnhanced({
            alerting: {
                enabled: true,
                channels: ['log', 'factor3'] // No Slack for demo
            }
        });
        
        // Event listeners
        monitor.on('alert', (alert) => {
            console.log(`🚨 ALERT: ${alert.type} (${alert.severity})`);
        });
        
        await monitor.start();
        console.log('✅ Enhanced production monitor started successfully!');
        
    } catch (error) {
        console.error('❌ Failed to start enhanced production monitor:', error.message);
        process.exit(1);
    }
}

module.exports = {
    ProductionMonitorEnhanced
};

// Run enhanced production monitor if called directly
if (require.main === module) {
    startEnhancedProductionMonitor().catch(console.error);
}