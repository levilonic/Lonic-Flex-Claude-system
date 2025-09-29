const { logger } = require('./logger');
/**
 * Resource Manager - Phase 3C Implementation
 * Comprehensive resource management with circuit breakers and health monitoring
 * Prevents resource exhaustion and provides intelligent resource allocation
 *
 * PROVIDES: Memory management, connection pooling, circuit breakers, health monitoring
 * SOLVES: Resource exhaustion, cascading failures, performance degradation
 */

const { EventEmitter } = require('events');
const os = require('os');

/**
 * Resource Manager - Central resource management and monitoring
 */
class ResourceManager extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Memory management
            memoryThreshold: config.memoryThreshold || 0.85,    // 85% memory threshold
            memoryWarningThreshold: config.memoryWarningThreshold || 0.75, // 75% warning
            gcThreshold: config.gcThreshold || 0.80,            // 80% trigger GC
            heapSizeLimit: config.heapSizeLimit || null,        // Auto-detect if null

            // CPU management
            cpuThreshold: config.cpuThreshold || 0.90,          // 90% CPU threshold
            cpuAverageWindow: config.cpuAverageWindow || 5,     // 5-minute average

            // Connection pooling
            maxDatabaseConnections: config.maxDatabaseConnections || 20,
            maxHttpConnections: config.maxHttpConnections || 50,
            connectionTimeout: config.connectionTimeout || 30000,

            // Circuit breaker configuration
            circuitBreakerThreshold: config.circuitBreakerThreshold || 5,   // Failures
            circuitBreakerTimeout: config.circuitBreakerTimeout || 30000,   // 30 seconds
            circuitBreakerResetTimeout: config.circuitBreakerResetTimeout || 60000, // 1 minute

            // Monitoring
            monitoringInterval: config.monitoringInterval || 10000,  // 10 seconds
            healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
            enableAlerts: config.enableAlerts !== false,

            ...config
        };

        // Resource tracking
        this.resourceUsage = {
            memory: { current: 0, peak: 0, average: 0 },
            cpu: { current: 0, peak: 0, average: 0 },
            connections: { database: 0, http: 0, total: 0 },
            agents: { active: 0, pooled: 0, total: 0 }
        };

        // Circuit breakers
        this.circuitBreakers = new Map();

        // Connection pools
        this.connectionPools = new Map();

        // Performance metrics
        this.metrics = {
            totalRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            resourceAllocations: 0,
            resourceDenials: 0
        };

        // Monitoring state
        this.isMonitoring = false;
        this.monitoringTimer = null;
        this.healthCheckTimer = null;
        this.cpuSamples = [];

        // Alert state
        this.alertHistory = [];
        this.lastAlerts = new Map();

        logger.info('🎛️ ResourceManager created with intelligent resource management');
    }

    /**
     * Initialize resource manager
     */
    async initialize() {
        try {
            // Auto-detect heap size limit if not specified
            if (!this.config.heapSizeLimit) {
                this.config.heapSizeLimit = os.totalmem() * 0.4; // 40% of total RAM
            }

            // Initialize circuit breakers for critical services
            this.initializeCircuitBreakers();

            // Initialize connection pools
            await this.initializeConnectionPools();

            // Start monitoring
            this.startMonitoring();

            logger.info('ResourceManager initialized with monitoring and circuit breakers');
            return this;

        } catch (error) {
            logger.error('❌ ResourceManager initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Check if resources are available for allocation
     */
    async checkResourceAvailability(resourceType, estimatedUsage = {}) {
        const currentUsage = await this.getCurrentResourceUsage();

        // Check memory availability
        if (estimatedUsage.memory) {
            const projectedMemoryUsage = currentUsage.memory.percentage + (estimatedUsage.memory / os.totalmem());
            if (projectedMemoryUsage > this.config.memoryThreshold) {
                this.emit('resourceDenied', {
                    type: 'memory',
                    current: currentUsage.memory.percentage,
                    projected: projectedMemoryUsage,
                    threshold: this.config.memoryThreshold
                });
                return {
                    available: false,
                    reason: 'memory_threshold_exceeded',
                    current: currentUsage.memory.percentage,
                    threshold: this.config.memoryThreshold
                };
            }
        }

        // Check CPU availability
        if (estimatedUsage.cpu) {
            if (currentUsage.cpu.percentage > this.config.cpuThreshold) {
                return {
                    available: false,
                    reason: 'cpu_threshold_exceeded',
                    current: currentUsage.cpu.percentage,
                    threshold: this.config.cpuThreshold
                };
            }
        }

        // Check connection pool availability
        if (resourceType === 'database_connection') {
            const dbPool = this.connectionPools.get('database');
            if (dbPool && dbPool.activeConnections >= this.config.maxDatabaseConnections) {
                return {
                    available: false,
                    reason: 'database_connection_pool_exhausted',
                    active: dbPool.activeConnections,
                    limit: this.config.maxDatabaseConnections
                };
            }
        }

        this.metrics.resourceAllocations++;
        return { available: true, currentUsage };
    }

    /**
     * Allocate resources for a specific operation
     */
    async allocateResources(resourceType, amount, metadata = {}) {
        const availability = await this.checkResourceAvailability(resourceType, { [resourceType]: amount });

        if (!availability.available) {
            this.metrics.resourceDenials++;
            throw new Error(`Resource allocation denied: ${availability.reason}`);
        }

        // Track resource allocation
        const allocation = {
            id: this.generateAllocationId(),
            type: resourceType,
            amount,
            metadata,
            allocatedAt: Date.now(),
            status: 'allocated'
        };

        // Update connection pool tracking
        if (resourceType === 'database_connection') {
            const dbPool = this.connectionPools.get('database');
            if (dbPool) {
                dbPool.activeConnections++;
            }
        }

        this.emit('resourceAllocated', allocation);
        return allocation;
    }

    /**
     * Release allocated resources
     */
    async releaseResources(allocation) {
        if (!allocation || !allocation.id) {
            console.warn('⚠️ Invalid resource allocation for release');
            return false;
        }

        // Update connection pool tracking
        if (allocation.type === 'database_connection') {
            const dbPool = this.connectionPools.get('database');
            if (dbPool && dbPool.activeConnections > 0) {
                dbPool.activeConnections--;
            }
        }

        allocation.status = 'released';
        allocation.releasedAt = Date.now();

        this.emit('resourceReleased', allocation);
        return true;
    }

    /**
     * Get circuit breaker for a service
     */
    getCircuitBreaker(serviceName) {
        let breaker = this.circuitBreakers.get(serviceName);
        if (!breaker) {
            breaker = new CircuitBreaker(serviceName, this.config);
            this.circuitBreakers.set(serviceName, breaker);
        }
        return breaker;
    }

    /**
     * Execute operation with circuit breaker protection
     */
    async executeWithCircuitBreaker(serviceName, operation, fallback = null) {
        const breaker = this.getCircuitBreaker(serviceName);
        const startTime = Date.now();

        try {
            this.metrics.totalRequests++;

            if (breaker.isOpen()) {
                if (fallback) {
                    logger.info(`🔄 Circuit breaker open for ${serviceName}, using fallback`);
                    return await fallback();
                } else {
                    throw new Error(`Circuit breaker open for ${serviceName}`);
                }
            }

            const result = await operation();

            // Record success
            breaker.recordSuccess();

            // Update metrics
            const responseTime = Date.now() - startTime;
            this.updateAverageResponseTime(responseTime);

            return result;

        } catch (error) {
            // Record failure
            breaker.recordFailure();
            this.metrics.failedRequests++;

            logger.error(`❌ Operation failed for ${serviceName}:`, error.message);

            if (fallback && breaker.isOpen()) {
                logger.info(`🔄 Using fallback for ${serviceName}`);
                return await fallback();
            }

            throw error;
        }
    }

    /**
     * Get current resource usage
     */
    async getCurrentResourceUsage() {
        const memoryUsage = process.memoryUsage();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        // Calculate CPU usage (simplified)
        const cpuUsage = await this.calculateCpuUsage();

        const usage = {
            memory: {
                used: memoryUsage.rss,
                total: totalMemory,
                percentage: usedMemory / totalMemory,
                heap: {
                    used: memoryUsage.heapUsed,
                    total: memoryUsage.heapTotal
                }
            },
            cpu: {
                percentage: cpuUsage,
                loadAverage: os.loadavg()
            },
            connections: this.getConnectionUsage(),
            timestamp: Date.now()
        };

        // Update tracking
        this.updateResourceTracking(usage);

        return usage;
    }

    /**
     * Get system health status
     */
    async getSystemHealth() {
        const usage = await this.getCurrentResourceUsage();

        const health = {
            status: 'healthy',
            timestamp: Date.now(),
            resources: usage,
            circuit_breakers: this.getCircuitBreakerStatus(),
            connection_pools: this.getConnectionPoolStatus(),
            metrics: { ...this.metrics },
            alerts: this.getRecentAlerts()
        };

        // Determine overall health status
        if (usage.memory.percentage > this.config.memoryThreshold) {
            health.status = 'critical';
        } else if (usage.memory.percentage > this.config.memoryWarningThreshold) {
            health.status = 'warning';
        }

        if (usage.cpu.percentage > this.config.cpuThreshold) {
            health.status = 'critical';
        }

        // Check circuit breaker states
        for (const breaker of this.circuitBreakers.values()) {
            if (breaker.isOpen()) {
                health.status = health.status === 'critical' ? 'critical' : 'degraded';
            }
        }

        return health;
    }

    /**
     * Force garbage collection if threshold exceeded
     */
    async performGarbageCollection() {
        const usage = await this.getCurrentResourceUsage();

        if (usage.memory.percentage > this.config.gcThreshold) {
            if (global.gc) {
                logger.info(`🧹 Performing garbage collection (memory: ${(usage.memory.percentage * 100).toFixed(1)}%)`);
                global.gc();

                // Emit GC event
                this.emit('garbageCollected', {
                    beforeUsage: usage.memory.percentage,
                    timestamp: Date.now()
                });

                return true;
            } else {
                console.warn('⚠️ Garbage collection not available (use --expose-gc flag)');
            }
        }

        return false;
    }

    /**
     * Initialize circuit breakers for critical services
     */
    initializeCircuitBreakers() {
        const criticalServices = [
            'database',
            'github_api',
            'slack_api',
            'docker_engine',
            'external_service'
        ];

        for (const service of criticalServices) {
            const breaker = new CircuitBreaker(service, this.config);
            this.circuitBreakers.set(service, breaker);
        }

        logger.info(`🔒 Initialized ${criticalServices.length} circuit breakers`);
    }

    /**
     * Initialize connection pools
     */
    async initializeConnectionPools() {
        // Database connection pool
        this.connectionPools.set('database', {
            type: 'database',
            maxConnections: this.config.maxDatabaseConnections,
            activeConnections: 0,
            queuedRequests: 0,
            totalRequests: 0
        });

        // HTTP connection pool
        this.connectionPools.set('http', {
            type: 'http',
            maxConnections: this.config.maxHttpConnections,
            activeConnections: 0,
            queuedRequests: 0,
            totalRequests: 0
        });

        logger.info('🏊 Initialized connection pools');
    }

    /**
     * Start resource monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) return;

        // Resource usage monitoring
        this.monitoringTimer = setInterval(async () => {
            try {
                await this.performMonitoringCycle();
            } catch (error) {
                logger.error('❌ Monitoring cycle error:', error.message);
            }
        }, this.config.monitoringInterval);

        // Health check monitoring
        this.healthCheckTimer = setInterval(async () => {
            try {
                const health = await this.getSystemHealth();
                this.emit('healthCheck', health);

                if (health.status === 'critical' && this.config.enableAlerts) {
                    await this.sendAlert('critical', 'System health critical', health);
                }
            } catch (error) {
                logger.error('❌ Health check error:', error.message);
            }
        }, this.config.healthCheckInterval);

        this.isMonitoring = true;
        logger.info('👁️ Resource monitoring started');
    }

    /**
     * Perform monitoring cycle
     */
    async performMonitoringCycle() {
        const usage = await this.getCurrentResourceUsage();

        // Check for automatic garbage collection
        await this.performGarbageCollection();

        // Check for alerts
        if (this.config.enableAlerts) {
            await this.checkResourceAlerts(usage);
        }

        // Emit monitoring event
        this.emit('monitoring', usage);
    }

    /**
     * Check for resource alerts
     */
    async checkResourceAlerts(usage) {
        // Memory alerts
        if (usage.memory.percentage > this.config.memoryThreshold) {
            await this.sendAlert('critical', 'Memory usage critical', {
                current: usage.memory.percentage,
                threshold: this.config.memoryThreshold
            });
        } else if (usage.memory.percentage > this.config.memoryWarningThreshold) {
            await this.sendAlert('warning', 'Memory usage high', {
                current: usage.memory.percentage,
                threshold: this.config.memoryWarningThreshold
            });
        }

        // CPU alerts
        if (usage.cpu.percentage > this.config.cpuThreshold) {
            await this.sendAlert('critical', 'CPU usage critical', {
                current: usage.cpu.percentage,
                threshold: this.config.cpuThreshold
            });
        }
    }

    /**
     * Send alert
     */
    async sendAlert(level, message, data = {}) {
        const alert = {
            level,
            message,
            data,
            timestamp: Date.now(),
            id: this.generateAlertId()
        };

        // Prevent duplicate alerts within short time window
        const alertKey = `${level}_${message}`;
        const lastAlert = this.lastAlerts.get(alertKey);
        if (lastAlert && (alert.timestamp - lastAlert.timestamp) < 60000) { // 1 minute
            return;
        }

        this.lastAlerts.set(alertKey, alert);
        this.alertHistory.unshift(alert);

        // Keep only recent alerts
        if (this.alertHistory.length > 100) {
            this.alertHistory = this.alertHistory.slice(0, 100);
        }

        this.emit('alert', alert);
        logger.info(`🚨 Resource Alert [${level.toUpperCase()}]: ${message}`, data);
    }

    /**
     * Helper methods
     */
    calculateCpuUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();

            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const totalTime = (endUsage.user + endUsage.system) / 1000; // Convert to ms
                const cpuPercent = (totalTime / 100) * 100; // Simplified calculation

                // Add to sample history
                this.cpuSamples.push(cpuPercent);
                if (this.cpuSamples.length > this.config.cpuAverageWindow) {
                    this.cpuSamples.shift();
                }

                // Return average of recent samples
                const avgCpu = this.cpuSamples.reduce((a, b) => a + b, 0) / this.cpuSamples.length;
                resolve(Math.min(avgCpu, 100)); // Cap at 100%
            }, 100);
        });
    }

    updateResourceTracking(usage) {
        // Update memory tracking
        this.resourceUsage.memory.current = usage.memory.percentage;
        this.resourceUsage.memory.peak = Math.max(this.resourceUsage.memory.peak, usage.memory.percentage);

        // Update CPU tracking
        this.resourceUsage.cpu.current = usage.cpu.percentage;
        this.resourceUsage.cpu.peak = Math.max(this.resourceUsage.cpu.peak, usage.cpu.percentage);

        // Calculate averages (simple moving average)
        this.resourceUsage.memory.average = (this.resourceUsage.memory.average + usage.memory.percentage) / 2;
        this.resourceUsage.cpu.average = (this.resourceUsage.cpu.average + usage.cpu.percentage) / 2;
    }

    updateAverageResponseTime(responseTime) {
        if (this.metrics.totalRequests === 1) {
            this.metrics.averageResponseTime = responseTime;
        } else {
            this.metrics.averageResponseTime = (
                (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1)) + responseTime
            ) / this.metrics.totalRequests;
        }
    }

    getConnectionUsage() {
        const usage = { total: 0 };

        for (const [poolName, pool] of this.connectionPools) {
            usage[poolName] = {
                active: pool.activeConnections,
                max: pool.maxConnections,
                utilization: pool.activeConnections / pool.maxConnections
            };
            usage.total += pool.activeConnections;
        }

        return usage;
    }

    getCircuitBreakerStatus() {
        const status = {};

        for (const [serviceName, breaker] of this.circuitBreakers) {
            status[serviceName] = {
                state: breaker.getState(),
                failureCount: breaker.failureCount,
                lastFailureTime: breaker.lastFailureTime,
                nextAttemptTime: breaker.nextAttemptTime
            };
        }

        return status;
    }

    getConnectionPoolStatus() {
        const status = {};

        for (const [poolName, pool] of this.connectionPools) {
            status[poolName] = { ...pool };
        }

        return status;
    }

    getRecentAlerts(limit = 10) {
        return this.alertHistory.slice(0, limit);
    }

    generateAllocationId() {
        return `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Shutdown resource manager
     */
    async shutdown() {
        logger.info('🛑 Shutting down ResourceManager...');

        // Stop monitoring
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        this.isMonitoring = false;

        // Clear circuit breakers
        this.circuitBreakers.clear();
        this.connectionPools.clear();

        this.emit('shutdown');
        logger.info('ResourceManager shutdown complete');
    }
}

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker {
    constructor(serviceName, config = {}) {
        this.serviceName = serviceName;
        this.failureThreshold = config.circuitBreakerThreshold || 5;
        this.timeout = config.circuitBreakerTimeout || 30000;
        this.resetTimeout = config.circuitBreakerResetTimeout || 60000;

        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
    }

    /**
     * Check if circuit breaker is open
     */
    isOpen() {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttemptTime) {
                this.state = 'HALF_OPEN';
                logger.info(`🔄 Circuit breaker ${this.serviceName} moving to HALF_OPEN`);
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Record successful operation
     */
    recordSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            this.failureCount = 0;
            logger.info(`Circuit breaker ${this.serviceName} reset to CLOSED`);
        }
    }

    /**
     * Record failed operation
     */
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttemptTime = Date.now() + this.resetTimeout;
            logger.info(`🔒 Circuit breaker ${this.serviceName} opened after ${this.failureCount} failures`);
        }
    }

    /**
     * Get current state
     */
    getState() {
        return this.state;
    }

    /**
     * Reset circuit breaker
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
    }
}

module.exports = {
    ResourceManager,
    CircuitBreaker
};