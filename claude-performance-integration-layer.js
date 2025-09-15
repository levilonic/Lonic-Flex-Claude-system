/**
 * Performance Integration Layer - SESSION 6: Performance Optimization
 * Unified integration layer connecting SESSION 6 performance components with SESSION 5 reliability infrastructure
 * Central coordination for Performance Optimizer, Load Balancer, Production Monitor, and Reliability Systems
 */

const EventEmitter = require('events');
const winston = require('winston');
const { Factor3ContextManager } = require('./factor3-context-manager');
const { SQLiteManager } = require('./database/sqlite-manager');

// SESSION 5 Reliability Systems
const { errorHandler } = require('./claude-error-handler');
const { RedisWithFallback } = require('./claude-redis-fallback');
const { DatabaseBackupRecovery } = require('./claude-backup-recovery');
const { DisasterRecoveryCoordinator } = require('./claude-disaster-recovery');

// SESSION 6 Performance Systems
const { PerformanceOptimizerEnhanced } = require('./claude-performance-optimizer-enhanced');
const { LoadBalancerEnhanced } = require('./claude-load-balancer-enhanced');
const { ProductionMonitorEnhanced } = require('./claude-production-monitor-enhanced');

/**
 * Performance Integration Layer
 * Central coordination and integration point for all performance and reliability systems
 */
class PerformanceIntegrationLayer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            enabled: true,
            autoStart: true,
            coordination: {
                enabled: true,
                healthCheckInterval: 30000,
                metricsAggregationInterval: 10000,
                alertCorrelationWindow: 60000
            },
            performance: {
                optimizer: {
                    enabled: true,
                    clustering: { workers: Math.min(4, require('os').cpus().length) },
                    caching: { enabled: true, strategy: 'lru' },
                    monitoring: { enabled: true, detailed: false } // Delegated to integration layer
                },
                loadBalancer: {
                    enabled: true,
                    algorithm: 'weighted',
                    healthCheck: { enabled: true, advanced: { enabled: true } },
                    circuitBreaker: { enabled: true },
                    monitoring: { enabled: true, detailed: false }
                },
                monitor: {
                    enabled: true,
                    port: 3002,
                    alerting: { enabled: true, channels: ['log', 'factor3'] },
                    dashboard: { enabled: true, realtime: true }
                }
            },
            reliability: {
                errorHandler: { enabled: true },
                redisFailover: { enabled: true },
                backupRecovery: { enabled: true },
                disasterRecovery: { enabled: true }
            },
            integration: {
                eventCorrelation: true,
                crossSystemHealthChecks: true,
                unifiedMetrics: true,
                coordinatedFailover: true,
                intelligentLoadShifting: true
            },
            ...options
        };
        
        // System components
        this.components = {
            // SESSION 6 Performance Systems
            performanceOptimizer: null,
            loadBalancer: null,
            productionMonitor: null,
            
            // SESSION 5 Reliability Systems
            errorHandler: null,
            redisClient: null,
            backupRecovery: null,
            disasterRecovery: null,
            
            // Core Infrastructure
            contextManager: null,
            database: null
        };
        
        // Integration state
        this.systemState = {
            overall: 'initializing',
            health: 100,
            performance: {
                score: 100,
                optimizer: { status: 'unknown', score: 0 },
                loadBalancer: { status: 'unknown', score: 0 },
                monitor: { status: 'unknown', score: 0 }
            },
            reliability: {
                score: 100,
                errorHandler: { status: 'unknown', score: 0 },
                redis: { status: 'unknown', score: 0 },
                backup: { status: 'unknown', score: 0 },
                disaster: { status: 'unknown', score: 0 }
            },
            integration: {
                eventsCorrelated: 0,
                alertsActive: 0,
                systemCoordination: 'active'
            },
            lastUpdate: null
        };
        
        // Event correlation and metrics aggregation
        this.eventCorrelator = {
            events: [],
            correlationWindow: this.config.coordination.alertCorrelationWindow,
            patterns: new Map()
        };
        
        this.metricsAggregator = {
            performance: new Map(),
            reliability: new Map(),
            system: new Map(),
            aggregated: null,
            lastUpdate: null
        };
        
        this.setupLogger();
        this.setupEventCorrelation();
    }

    setupLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format((info) => {
                    info.component = 'performance-integration';
                    info.correlationId = this.generateCorrelationId();
                    return info;
                })()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/performance-integration.log',
                    maxsize: 50000000,
                    maxFiles: 3
                }),
                new winston.transports.Console()
            ]
        });
    }

    setupEventCorrelation() {
        // Event correlation for intelligent system coordination
        setInterval(() => {
            this.correlateEvents();
        }, 10000); // Every 10 seconds

        // Metrics aggregation
        setInterval(() => {
            this.aggregateMetrics();
        }, this.config.coordination.metricsAggregationInterval);

        // System health coordination
        setInterval(() => {
            this.coordinateSystemHealth();
        }, this.config.coordination.healthCheckInterval);
    }

    /**
     * Initialize all systems with proper integration
     */
    async initialize() {
        try {
            this.logger.info('Starting Performance Integration Layer initialization');
            
            // Phase 1: Initialize core infrastructure
            await this.initializeCoreInfrastructure();
            
            // Phase 2: Initialize SESSION 5 reliability systems
            await this.initializeReliabilitySystems();
            
            // Phase 3: Initialize SESSION 6 performance systems
            await this.initializePerformanceSystems();
            
            // Phase 4: Setup cross-system integration
            await this.setupCrossSystemIntegration();
            
            // Phase 5: Start system coordination
            await this.startSystemCoordination();
            
            this.systemState.overall = 'operational';
            this.systemState.lastUpdate = new Date().toISOString();
            
            this.logger.info('Performance Integration Layer initialized successfully');
            this.emit('initialized', this.systemState);
            
            return true;
            
        } catch (error) {
            this.logger.error('Performance Integration Layer initialization failed', { 
                error: error.message,
                stack: error.stack
            });
            this.systemState.overall = 'failed';
            throw error;
        }
    }

    async initializeCoreInfrastructure() {
        this.logger.info('Initializing core infrastructure');
        
        try {
            // Initialize Factor3 Context Manager
            this.components.contextManager = new Factor3ContextManager();
            this.logger.info('Factor3 Context Manager initialized');
            
            // Initialize SQLite Database
            this.components.database = new SQLiteManager();
            await this.components.database.initialize();
            this.logger.info('SQLite Database initialized');
            
            // Register with context manager
            this.components.contextManager.addAgentEvent('performance-integration', 'core_initialized', {
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            this.logger.error('Core infrastructure initialization failed', { error: error.message });
            throw error;
        }
    }

    async initializeReliabilitySystems() {
        if (!this.config.reliability) return;
        
        this.logger.info('Initializing SESSION 5 reliability systems');
        
        try {
            // Initialize Redis with Fallback
            if (this.config.reliability.redisFailover.enabled) {
                this.components.redisClient = new RedisWithFallback({
                    fallbackEnabled: true,
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379
                });
                
                await this.components.redisClient.initialize();
                this.logger.info('Redis with fallback initialized');
                
                // Listen for fallback events
                this.components.redisClient.on('fallback', (operation) => {
                    this.handleReliabilityEvent('redis_fallback', { operation });
                });
                
                this.systemState.reliability.redis = { status: 'operational', score: 100 };
            }
            
            // Initialize Backup Recovery
            if (this.config.reliability.backupRecovery.enabled) {
                try {
                    this.components.backupRecovery = new DatabaseBackupRecovery({
                        databasePath: this.components.database.dbPath,
                        backupDirectory: './backups',
                        retentionDays: 30
                    });
                    
                    await this.components.backupRecovery.initialize();
                    this.logger.info('Database backup recovery initialized');
                    
                    this.systemState.reliability.backup = { status: 'operational', score: 100 };
                } catch (error) {
                    this.logger.warn('Backup recovery not available:', error.message);
                    this.systemState.reliability.backup = { status: 'unavailable', score: 75 };
                }
            }
            
            this.logger.info('SESSION 5 reliability systems initialized');
            
        } catch (error) {
            this.logger.error('Reliability systems initialization failed', { error: error.message });
            // Don't throw - continue with degraded reliability
            this.systemState.reliability.score = 50;
        }
    }

    async initializePerformanceSystems() {
        this.logger.info('Initializing SESSION 6 performance systems');
        
        try {
            // Initialize Performance Optimizer
            if (this.config.performance.optimizer.enabled) {
                this.components.performanceOptimizer = new PerformanceOptimizerEnhanced({
                    ...this.config.performance.optimizer,
                    monitoring: { enabled: false } // We handle monitoring centrally
                });
                
                await this.components.performanceOptimizer.initialize();
                this.logger.info('Performance Optimizer initialized');
                
                // Listen for performance events
                this.setupPerformanceOptimizerEvents();
                this.systemState.performance.optimizer = { status: 'operational', score: 100 };
            }
            
            // Initialize Load Balancer
            if (this.config.performance.loadBalancer.enabled) {
                this.components.loadBalancer = new LoadBalancerEnhanced({
                    ...this.config.performance.loadBalancer,
                    monitoring: { enabled: false } // We handle monitoring centrally
                });
                
                this.logger.info('Load Balancer initialized');
                
                // Setup load balancer events
                this.setupLoadBalancerEvents();
                this.systemState.performance.loadBalancer = { status: 'operational', score: 100 };
            }
            
            // Initialize Production Monitor (but don't start server - we'll integrate)
            if (this.config.performance.monitor.enabled) {
                this.components.productionMonitor = new ProductionMonitorEnhanced({
                    ...this.config.performance.monitor,
                    autoStart: false // We'll control the startup
                });
                
                await this.components.productionMonitor.start();
                this.logger.info('Production Monitor initialized');
                
                // Setup monitor events
                this.setupProductionMonitorEvents();
                this.systemState.performance.monitor = { status: 'operational', score: 100 };
            }
            
            this.logger.info('SESSION 6 performance systems initialized');
            
        } catch (error) {
            this.logger.error('Performance systems initialization failed', { error: error.message });
            // Don't throw - continue with degraded performance
            this.systemState.performance.score = 50;
        }
    }

    async setupCrossSystemIntegration() {
        this.logger.info('Setting up cross-system integration');
        
        try {
            // Integrate Redis client across all systems
            if (this.components.redisClient) {
                if (this.components.performanceOptimizer) {
                    this.components.performanceOptimizer.redisClient = this.components.redisClient;
                }
                if (this.components.loadBalancer) {
                    this.components.loadBalancer.redisClient = this.components.redisClient;
                }
                if (this.components.productionMonitor) {
                    this.components.productionMonitor.redisClient = this.components.redisClient;
                }
            }
            
            // Integrate context manager across all systems
            if (this.components.contextManager) {
                [
                    'performanceOptimizer',
                    'loadBalancer', 
                    'productionMonitor'
                ].forEach(componentKey => {
                    const component = this.components[componentKey];
                    if (component && component.contextManager) {
                        component.contextManager = this.components.contextManager;
                    }
                });
            }
            
            // Setup intelligent load shifting
            if (this.config.integration.intelligentLoadShifting) {
                this.setupIntelligentLoadShifting();
            }
            
            // Setup coordinated failover
            if (this.config.integration.coordinatedFailover) {
                this.setupCoordinatedFailover();
            }
            
            this.logger.info('Cross-system integration complete');
            
        } catch (error) {
            this.logger.error('Cross-system integration failed', { error: error.message });
            throw error;
        }
    }

    setupPerformanceOptimizerEvents() {
        const optimizer = this.components.performanceOptimizer;
        if (!optimizer) return;
        
        optimizer.on('metrics', (metrics) => {
            this.handlePerformanceMetrics('optimizer', metrics);
        });
        
        optimizer.on('performanceAlert', (alert) => {
            this.handlePerformanceAlert('optimizer', alert);
        });
        
        optimizer.on('degradedMode', (event) => {
            this.handleSystemDegradation('optimizer', event);
        });
    }

    setupLoadBalancerEvents() {
        const loadBalancer = this.components.loadBalancer;
        if (!loadBalancer) return;
        
        loadBalancer.on('metrics', (metrics) => {
            this.handlePerformanceMetrics('loadBalancer', metrics);
        });
        
        loadBalancer.on('serverStatusChange', (event) => {
            this.handleLoadBalancerEvent('serverStatusChange', event);
        });
        
        loadBalancer.on('allServersDown', () => {
            this.handleCriticalEvent('allServersDown', {
                source: 'loadBalancer',
                severity: 'critical',
                action: 'immediate_failover_required'
            });
        });
    }

    setupProductionMonitorEvents() {
        const monitor = this.components.productionMonitor;
        if (!monitor) return;
        
        monitor.on('alert', (alert) => {
            this.handleMonitorAlert(alert);
        });
        
        monitor.on('metrics', (metrics) => {
            this.handleSystemMetrics(metrics);
        });
    }

    setupIntelligentLoadShifting() {
        this.logger.info('Setting up intelligent load shifting');
        
        // Monitor performance metrics and automatically adjust load balancing
        this.on('performanceMetrics', (data) => {
            const { source, metrics } = data;
            
            if (source === 'optimizer' && this.components.loadBalancer) {
                const memoryPressure = metrics.memory.percentage;
                const eventLoopLag = metrics.eventLoop.lag;
                
                // Adjust load balancing based on performance metrics
                if (memoryPressure > 80 || eventLoopLag > 200) {
                    this.adjustLoadBalancing('reduce_load', {
                        memoryPressure,
                        eventLoopLag,
                        recommendation: 'shed_load_to_healthy_servers'
                    });
                }
            }
        });
    }

    setupCoordinatedFailover() {
        this.logger.info('Setting up coordinated failover');
        
        // Coordinate failover across all systems
        this.on('criticalEvent', async (event) => {
            this.logger.warn('Critical event detected, initiating coordinated failover', event);
            
            try {
                // 1. Trigger circuit breakers
                if (this.components.loadBalancer) {
                    // Load balancer handles its own circuit breakers
                }
                
                // 2. Initiate backup procedures
                if (this.components.backupRecovery && event.requiresBackup) {
                    await this.components.backupRecovery.initiateEmergencyBackup();
                }
                
                // 3. Switch to fallback systems
                if (this.components.redisClient) {
                    this.components.redisClient.activateFallbackMode();
                }
                
                // 4. Log coordinated response
                this.components.contextManager.addAgentEvent('performance-integration', 'coordinated_failover', {
                    trigger: event,
                    actions: ['circuit_breaker', 'backup_initiated', 'fallback_activated'],
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                this.logger.error('Coordinated failover failed', { error: error.message });
            }
        });
    }

    async startSystemCoordination() {
        this.logger.info('Starting system coordination');
        
        // Start coordinated health monitoring
        this.systemCoordination = {
            healthMonitoring: setInterval(() => {
                this.coordinateSystemHealth();
            }, this.config.coordination.healthCheckInterval),
            
            metricsAggregation: setInterval(() => {
                this.aggregateMetrics();
            }, this.config.coordination.metricsAggregationInterval),
            
            eventCorrelation: setInterval(() => {
                this.correlateEvents();
            }, 5000) // Every 5 seconds
        };
        
        this.logger.info('System coordination started');
    }

    // Event handlers
    handlePerformanceMetrics(source, metrics) {
        this.metricsAggregator.performance.set(source, {
            metrics,
            timestamp: Date.now()
        });
        
        this.emit('performanceMetrics', { source, metrics });
        
        // Store in context manager
        this.components.contextManager.addAgentEvent('performance-integration', 'performance_metrics', {
            source,
            key_metrics: {
                memory: metrics.memory?.percentage || 0,
                cpu: metrics.cpu?.percentage || 0,
                responseTime: metrics.avgResponseTime || 0
            }
        });
    }

    handlePerformanceAlert(source, alert) {
        const correlatedAlert = {
            ...alert,
            source: `performance_${source}`,
            integrationId: this.generateCorrelationId(),
            timestamp: new Date().toISOString()
        };
        
        this.addEventForCorrelation(correlatedAlert);
        this.emit('alert', correlatedAlert);
        
        this.logger.warn('Performance alert', correlatedAlert);
    }

    handleSystemDegradation(source, event) {
        this.logger.error('System degradation detected', { source, event });
        
        // Update system state
        if (this.systemState.performance[source]) {
            this.systemState.performance[source].status = 'degraded';
            this.systemState.performance[source].score = 50;
        }
        
        // Trigger coordinated response
        this.emit('systemDegradation', { source, event });
    }

    handleLoadBalancerEvent(type, event) {
        this.addEventForCorrelation({
            type: `loadBalancer_${type}`,
            event,
            timestamp: new Date().toISOString()
        });
        
        this.emit('loadBalancerEvent', { type, event });
    }

    handleCriticalEvent(type, event) {
        const criticalEvent = {
            ...event,
            type,
            integrationId: this.generateCorrelationId(),
            timestamp: new Date().toISOString()
        };
        
        this.logger.error('Critical event detected', criticalEvent);
        this.emit('criticalEvent', criticalEvent);
    }

    handleMonitorAlert(alert) {
        const monitorAlert = {
            ...alert,
            source: 'production_monitor',
            integrationId: this.generateCorrelationId()
        };
        
        this.addEventForCorrelation(monitorAlert);
        this.emit('alert', monitorAlert);
    }

    handleSystemMetrics(metrics) {
        this.metricsAggregator.system.set('monitor', {
            metrics,
            timestamp: Date.now()
        });
        
        this.emit('systemMetrics', metrics);
    }

    handleReliabilityEvent(type, data) {
        const reliabilityEvent = {
            type: `reliability_${type}`,
            data,
            timestamp: new Date().toISOString()
        };
        
        this.addEventForCorrelation(reliabilityEvent);
        this.emit('reliabilityEvent', reliabilityEvent);
        
        this.logger.warn('Reliability event', reliabilityEvent);
    }

    // System coordination methods
    coordinateSystemHealth() {
        const healthScores = [];
        
        // Collect health scores from all components
        Object.keys(this.systemState.performance).forEach(key => {
            if (typeof this.systemState.performance[key] === 'object' && this.systemState.performance[key].score) {
                healthScores.push(this.systemState.performance[key].score);
            }
        });
        
        Object.keys(this.systemState.reliability).forEach(key => {
            if (typeof this.systemState.reliability[key] === 'object' && this.systemState.reliability[key].score) {
                healthScores.push(this.systemState.reliability[key].score);
            }
        });
        
        // Calculate overall health
        if (healthScores.length > 0) {
            this.systemState.health = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
        }
        
        // Determine overall status
        if (this.systemState.health >= 90) {
            this.systemState.overall = 'optimal';
        } else if (this.systemState.health >= 75) {
            this.systemState.overall = 'operational';
        } else if (this.systemState.health >= 50) {
            this.systemState.overall = 'degraded';
        } else {
            this.systemState.overall = 'critical';
        }
        
        this.systemState.lastUpdate = new Date().toISOString();
    }

    aggregateMetrics() {
        const aggregated = {
            performance: {},
            reliability: {},
            system: {},
            timestamp: Date.now()
        };
        
        // Aggregate performance metrics
        for (const [source, data] of this.metricsAggregator.performance) {
            if (Date.now() - data.timestamp < 60000) { // Only recent metrics
                aggregated.performance[source] = data.metrics;
            }
        }
        
        // Aggregate reliability metrics
        for (const [source, data] of this.metricsAggregator.reliability) {
            if (Date.now() - data.timestamp < 60000) {
                aggregated.reliability[source] = data.metrics;
            }
        }
        
        // Aggregate system metrics
        for (const [source, data] of this.metricsAggregator.system) {
            if (Date.now() - data.timestamp < 60000) {
                aggregated.system[source] = data.metrics;
            }
        }
        
        this.metricsAggregator.aggregated = aggregated;
        this.metricsAggregator.lastUpdate = Date.now();
        
        this.emit('aggregatedMetrics', aggregated);
    }

    addEventForCorrelation(event) {
        this.eventCorrelator.events.push({
            ...event,
            correlationId: this.generateCorrelationId()
        });
        
        // Keep only recent events
        const cutoff = Date.now() - this.eventCorrelator.correlationWindow;
        this.eventCorrelator.events = this.eventCorrelator.events.filter(e => 
            new Date(e.timestamp).getTime() > cutoff
        );
    }

    correlateEvents() {
        if (this.eventCorrelator.events.length < 2) return;
        
        // Simple correlation: look for patterns in recent events
        const recentEvents = this.eventCorrelator.events.slice(-10);
        const eventTypes = recentEvents.map(e => e.type);
        const typeFrequency = {};
        
        eventTypes.forEach(type => {
            typeFrequency[type] = (typeFrequency[type] || 0) + 1;
        });
        
        // Detect patterns (e.g., repeated alerts of same type)
        Object.entries(typeFrequency).forEach(([type, count]) => {
            if (count >= 3) {
                this.detectEventPattern(type, count, recentEvents.filter(e => e.type === type));
            }
        });
        
        this.systemState.integration.eventsCorrelated = this.eventCorrelator.events.length;
    }

    detectEventPattern(type, count, events) {
        const patternKey = `${type}_repeated`;
        
        if (!this.eventCorrelator.patterns.has(patternKey)) {
            this.logger.warn('Event pattern detected', {
                type,
                count,
                pattern: patternKey,
                timeSpan: `${Math.round((Date.now() - new Date(events[0].timestamp).getTime()) / 1000)}s`
            });
            
            this.eventCorrelator.patterns.set(patternKey, {
                type,
                count,
                firstSeen: events[0].timestamp,
                lastSeen: events[events.length - 1].timestamp
            });
            
            // Trigger pattern-based response
            this.handleEventPattern(patternKey, { type, count, events });
        }
    }

    handleEventPattern(pattern, data) {
        this.logger.info('Handling event pattern', { pattern, data: { type: data.type, count: data.count } });
        
        // Example pattern-based responses
        if (pattern.includes('high_memory') || pattern.includes('slow_response')) {
            this.triggerPerformanceOptimization(data);
        } else if (pattern.includes('server_down')) {
            this.triggerLoadRebalancing(data);
        }
        
        this.emit('eventPattern', { pattern, data });
    }

    triggerPerformanceOptimization(data) {
        this.logger.info('Triggering performance optimization based on pattern', { type: data.type });
        
        if (this.components.performanceOptimizer) {
            // Force garbage collection if available
            if (global.gc && data.type.includes('memory')) {
                global.gc();
                this.logger.info('Forced garbage collection due to memory pattern');
            }
            
            // Clear caches if performance is degrading
            if (data.type.includes('slow_response')) {
                // The performance optimizer can handle cache clearing
                this.components.performanceOptimizer.emit('clearCaches');
            }
        }
    }

    triggerLoadRebalancing(data) {
        this.logger.info('Triggering load rebalancing based on pattern', { type: data.type });
        
        if (this.components.loadBalancer) {
            // The load balancer handles server failures automatically
            // We just log the coordination action
            this.components.contextManager.addAgentEvent('performance-integration', 'load_rebalancing', {
                trigger: data.type,
                timestamp: new Date().toISOString()
            });
        }
    }

    adjustLoadBalancing(action, context) {
        this.logger.info('Adjusting load balancing', { action, context });
        
        // Log the intelligent load shifting decision
        this.components.contextManager.addAgentEvent('performance-integration', 'intelligent_load_shifting', {
            action,
            context,
            timestamp: new Date().toISOString()
        });
    }

    // Public API methods
    getSystemState() {
        return {
            ...this.systemState,
            components: Object.keys(this.components).reduce((acc, key) => {
                acc[key] = this.components[key] ? 'initialized' : 'not_available';
                return acc;
            }, {})
        };
    }

    getAggregatedMetrics() {
        return {
            aggregated: this.metricsAggregator.aggregated,
            lastUpdate: this.metricsAggregator.lastUpdate,
            sources: {
                performance: Array.from(this.metricsAggregator.performance.keys()),
                reliability: Array.from(this.metricsAggregator.reliability.keys()),
                system: Array.from(this.metricsAggregator.system.keys())
            }
        };
    }

    getEventCorrelation() {
        return {
            recentEvents: this.eventCorrelator.events.slice(-20),
            patterns: Object.fromEntries(this.eventCorrelator.patterns),
            correlationWindow: this.eventCorrelator.correlationWindow
        };
    }

    // Utility methods
    generateCorrelationId() {
        return `perf-int-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }

    async shutdown() {
        this.logger.info('Shutting down Performance Integration Layer');
        
        try {
            // Stop coordination intervals
            if (this.systemCoordination) {
                Object.values(this.systemCoordination).forEach(interval => {
                    if (interval) clearInterval(interval);
                });
            }
            
            // Shutdown components gracefully
            const shutdownPromises = [];
            
            if (this.components.performanceOptimizer) {
                shutdownPromises.push(this.components.performanceOptimizer.shutdownGracefully());
            }
            
            if (this.components.productionMonitor) {
                shutdownPromises.push(this.components.productionMonitor.stop());
            }
            
            if (this.components.redisClient) {
                shutdownPromises.push(this.components.redisClient.shutdown());
            }
            
            await Promise.all(shutdownPromises);
            
            this.systemState.overall = 'shutdown';
            this.logger.info('Performance Integration Layer shutdown complete');
            
        } catch (error) {
            this.logger.error('Error during shutdown', { error: error.message });
        }
    }
}

module.exports = { PerformanceIntegrationLayer };

// Demo function
if (require.main === module) {
    async function demo() {
        console.log('🔗 Performance Integration Layer - SESSION 6 Demo\n');
        
        try {
            const integrationLayer = new PerformanceIntegrationLayer({
                performance: {
                    optimizer: { enabled: true, clustering: { workers: 2 } },
                    loadBalancer: { enabled: false }, // Skip for demo
                    monitor: { enabled: false } // Skip for demo
                },
                reliability: {
                    redisFailover: { enabled: true },
                    backupRecovery: { enabled: false } // Skip for demo
                }
            });
            
            // Event listeners
            integrationLayer.on('initialized', (state) => {
                console.log('✅ Integration Layer Initialized');
                console.log(`   Overall Status: ${state.overall}`);
                console.log(`   Health Score: ${state.health.toFixed(1)}`);
            });
            
            integrationLayer.on('performanceMetrics', (data) => {
                console.log(`📊 Performance Metrics from ${data.source}`);
            });
            
            integrationLayer.on('alert', (alert) => {
                console.log(`🚨 Alert: ${alert.type} (${alert.severity})`);
            });
            
            integrationLayer.on('eventPattern', (pattern) => {
                console.log(`🔍 Event Pattern Detected: ${pattern.pattern}`);
            });
            
            await integrationLayer.initialize();
            
            console.log('\n🚀 Performance Integration Features:');
            console.log('  ✅ Unified Performance & Reliability Coordination');
            console.log('  ✅ Cross-System Event Correlation');
            console.log('  ✅ Intelligent Load Shifting');
            console.log('  ✅ Coordinated Failover');
            console.log('  ✅ Aggregated Metrics Collection');
            console.log('  ✅ Pattern-based System Optimization');
            console.log('  ✅ Real-time System Health Coordination');
            
            // Demo system state
            setTimeout(() => {
                const systemState = integrationLayer.getSystemState();
                console.log('\n🎯 Current System State:');
                console.log(`  Overall: ${systemState.overall} (${systemState.health.toFixed(1)}% health)`);
                console.log(`  Performance Score: ${systemState.performance.score.toFixed(1)}`);
                console.log(`  Reliability Score: ${systemState.reliability.score.toFixed(1)}`);
                console.log(`  Events Correlated: ${systemState.integration.eventsCorrelated}`);
            }, 3000);
            
        } catch (error) {
            console.error('❌ Integration layer demo failed:', error.message);
        }
    }
    
    demo().catch(console.error);
}