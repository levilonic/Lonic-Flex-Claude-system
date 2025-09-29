/**
 * Enhanced Performance Optimizer - SESSION 6: Performance Optimization
 * Integrated with SESSION 5 reliability systems (Circuit breakers, Redis fallback, etc.)
 * Advanced clustering, caching, and connection pooling with production monitoring
 */

const cluster = require('cluster');
const os = require('os');
const { EventEmitter } = require('events');
const winston = require('winston');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const { errorHandler } = require('./claude-error-handler');
const { RedisWithFallback } = require('./claude-redis-fallback');
const fs = require('fs').promises;
const path = require('path');

class PerformanceOptimizerEnhanced extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            enabled: true,
            clustering: {
                enabled: true,
                workers: options.workers || os.cpus().length,
                respawnDelay: 5000,
                autoScaling: {
                    enabled: true,
                    minWorkers: Math.ceil(os.cpus().length / 2),
                    maxWorkers: os.cpus().length * 2,
                    scaleUpThreshold: 80, // CPU percentage
                    scaleDownThreshold: 20,
                    scaleInterval: 60000 // 1 minute
                }
            },
            caching: {
                enabled: true,
                ttl: 300000, // 5 minutes
                maxSize: 10000,
                strategy: 'lru', // lru, lfu, fifo
                compression: true,
                persistence: true,
                redis: {
                    enabled: true,
                    fallbackToMemory: true
                }
            },
            pooling: {
                enabled: true,
                maxConnections: 50,
                minConnections: 5,
                idleTimeout: 30000,
                acquireTimeout: 10000,
                pooling: {
                    database: { max: 20, min: 2 },
                    http: { max: 100, min: 10 },
                    redis: { max: 15, min: 3 }
                }
            },
            monitoring: {
                enabled: true,
                interval: 10000, // 10 seconds
                detailed: true,
                thresholds: {
                    cpu: 80,
                    memory: 85,
                    responseTime: 5000,
                    errorRate: 5, // percentage
                    queueSize: 1000
                },
                alerts: {
                    enabled: true,
                    channels: ['log', 'factor3'] // Add 'slack', 'email' in production
                }
            },
            optimization: {
                garbageCollection: {
                    enabled: true,
                    forceThreshold: 90, // memory percentage
                    interval: 300000 // 5 minutes
                },
                eventLoop: {
                    lagThreshold: 100, // milliseconds
                    monitoringEnabled: true
                },
                asyncOptimization: {
                    batchSize: 100,
                    maxConcurrency: 10
                }
            },
            ...options
        };
        
        // Enhanced caching system with multiple layers
        this.cacheSystem = {
            memory: new Map(),
            redis: null,
            stats: {
                hits: 0,
                misses: 0,
                evictions: 0,
                errors: 0
            }
        };
        
        // Advanced connection pools
        this.connectionPools = new Map();
        
        // Enhanced metrics collection
        this.metrics = {
            requests: 0,
            responses: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgResponseTime: 0,
            poolConnections: 0,
            workers: {
                active: 0,
                total: 0,
                restarts: 0
            },
            memory: {
                usage: 0,
                percentage: 0,
                gcCount: 0
            },
            eventLoop: {
                lag: 0,
                utilization: 0
            }
        };
        
        // Integration with reliability systems
        this.contextManager = new Factor3ContextManager();
        this.redisClient = null;
        
        this.setupLogger();
        this.setupReliabilityIntegration();
        this.setupEnhancedOptimizations();
    }

    setupLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/performance-enhanced.log',
                    maxsize: 50000000, // 50MB
                    maxFiles: 5
                }),
                new winston.transports.Console()
            ]
        });
    }

    async setupReliabilityIntegration() {
        try {
            // Initialize Redis with fallback capability
            if (this.config.caching.redis.enabled) {
                this.redisClient = new RedisWithFallback({
                    fallbackEnabled: this.config.caching.redis.fallbackToMemory,
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379
                });
                
                await this.redisClient.initialize();
                this.logger.info('Redis client initialized with fallback capability');
                
                // Listen for Redis events
                this.redisClient.on('fallback', (operation) => {
                    this.logger.warn('Redis fallback activated', { operation });
                    this.cacheSystem.stats.errors++;
                });
            }
            
            // Register with context manager
            this.contextManager.addAgentEvent('performance-optimizer', 'initialized', {
                clustering: this.config.clustering.enabled,
                caching: this.config.caching.enabled,
                monitoring: this.config.monitoring.enabled
            });
            
        } catch (error) {
            this.logger.error('Failed to setup reliability integration:', error);
            throw error;
        }
    }

    async initialize() {
        try {
            await this.loadConfiguration();
            
            if (this.config.clustering.enabled && cluster.isPrimary) {
                await this.setupAdvancedClustering();
            } else {
                await this.setupWorkerProcess();
            }
            
            if (this.config.monitoring.enabled) {
                this.startEnhancedMonitoring();
            }
            
            if (this.config.optimization.garbageCollection.enabled) {
                this.setupAdvancedGarbageCollection();
            }
            
            this.logger.info('Enhanced performance optimizer initialized');
            return true;
            
        } catch (error) {
            this.logger.error('Failed to initialize enhanced performance optimizer:', error);
            throw error;
        }
    }

    setupEnhancedOptimizations() {
        this.setupAdvancedCaching();
        this.setupConnectionPooling();
        this.setupAsyncOptimization();
        this.setupEventLoopMonitoring();
    }

    async setupAdvancedClustering() {
        const numWorkers = this.config.clustering.workers;
        
        this.logger.info(`Setting up ${numWorkers} worker processes with auto-scaling`);
        
        // Fork initial workers
        for (let i = 0; i < numWorkers; i++) {
            this.forkWorker();
        }
        
        this.metrics.workers.total = numWorkers;
        
        // Enhanced worker event handling
        cluster.on('exit', (worker, code, signal) => {
            this.logger.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
            this.metrics.workers.restarts++;
            this.metrics.workers.active--;
            
            // Circuit breaker pattern for worker failures
            setTimeout(() => {
                if (this.metrics.workers.restarts < 10) { // Prevent restart loops
                    this.forkWorker();
                } else {
                    this.logger.error('Too many worker restarts. Entering degraded mode.');
                    this.emit('degradedMode', { reason: 'worker_restart_loop' });
                }
            }, this.config.clustering.respawnDelay);
        });
        
        cluster.on('online', (worker) => {
            this.logger.info(`Worker ${worker.process.pid} is online`);
            this.metrics.workers.active++;
        });
        
        // Auto-scaling based on CPU usage
        if (this.config.clustering.autoScaling.enabled) {
            this.startAutoScaling();
        }
        
        // Graceful shutdown
        process.on('SIGTERM', this.shutdownGracefully.bind(this));
        process.on('SIGINT', this.shutdownGracefully.bind(this));
    }

    forkWorker() {
        const worker = cluster.fork();
        
        // Configure worker-specific optimizations
        worker.on('message', (msg) => {
            if (msg.type === 'metrics') {
                this.aggregateWorkerMetrics(msg.data);
            } else if (msg.type === 'worker_ready') {
                this.logger.info(`Worker ${msg.pid} ready with memory: ${Math.round(msg.memory.heapUsed / 1024 / 1024)}MB`);
            }
        });
        
        return worker;
    }

    async setupWorkerProcess() {
        this.logger.info('Setting up worker process with enhanced optimizations');
        
        // Worker-specific optimizations
        this.setupWorkerOptimizations();
        this.setupWorkerMetrics();
        
        // Report to master
        if (process.send) {
            process.send({
                type: 'worker_ready',
                pid: process.pid,
                memory: process.memoryUsage()
            });
        }
    }

    setupWorkerOptimizations() {
        // Worker-specific performance optimizations
        this.logger.info('Setting up worker-specific optimizations');
    }

    setupWorkerMetrics() {
        // Worker-specific metrics collection
        setInterval(() => {
            if (process.send) {
                process.send({
                    type: 'metrics',
                    data: {
                        requests: this.metrics.requests,
                        responses: this.metrics.responses,
                        errors: this.metrics.errors,
                        memory: process.memoryUsage()
                    }
                });
            }
        }, 30000); // Report every 30 seconds
    }

    startAutoScaling() {
        const scaleInterval = this.config.clustering.autoScaling.scaleInterval;
        
        setInterval(() => {
            // Simple CPU-based auto-scaling logic
            const cpuUsage = process.cpuUsage();
            const cpuPercentage = (cpuUsage.user + cpuUsage.system) / 10000; // Rough approximation
            
            const currentWorkers = this.metrics.workers.active;
            const { minWorkers, maxWorkers, scaleUpThreshold, scaleDownThreshold } = this.config.clustering.autoScaling;
            
            if (cpuPercentage > scaleUpThreshold && currentWorkers < maxWorkers) {
                this.logger.info(`Scaling up: CPU ${cpuPercentage.toFixed(2)}% > ${scaleUpThreshold}%`);
                this.forkWorker();
            } else if (cpuPercentage < scaleDownThreshold && currentWorkers > minWorkers) {
                this.logger.info(`Scaling down: CPU ${cpuPercentage.toFixed(2)}% < ${scaleDownThreshold}%`);
                this.terminateWorker();
            }
        }, scaleInterval);
    }

    terminateWorker() {
        const workers = Object.values(cluster.workers);
        if (workers.length > this.config.clustering.autoScaling.minWorkers) {
            const worker = workers[workers.length - 1];
            worker.disconnect();
            this.logger.info(`Terminating worker ${worker.process.pid} for scale-down`);
        }
    }

    aggregateWorkerMetrics(workerMetrics) {
        // Aggregate metrics from worker processes
        this.metrics.requests += workerMetrics.requests || 0;
        this.metrics.responses += workerMetrics.responses || 0;
        this.metrics.errors += workerMetrics.errors || 0;
    }

    setupAdvancedCaching() {
        // Multi-layer caching strategy
        this.cacheStrategies = {
            lru: new Map(), // Least Recently Used
            lfu: new Map(), // Least Frequently Used  
            fifo: new Map() // First In, First Out
        };
        
        this.cacheMetadata = new Map(); // Track access patterns
        
        // Cache compression for large objects
        this.compressCache = (data) => {
            if (!this.config.caching.compression) return data;
            
            try {
                const zlib = require('zlib');
                const compressed = zlib.gzipSync(JSON.stringify(data));
                return { compressed: true, data: compressed };
            } catch (error) {
                this.logger.warn('Cache compression failed', { error: error.message });
                return data;
            }
        };
        
        this.decompressCache = (cachedItem) => {
            if (!cachedItem.compressed) return cachedItem;
            
            try {
                const zlib = require('zlib');
                const decompressed = zlib.gunzipSync(cachedItem.data);
                return JSON.parse(decompressed.toString());
            } catch (error) {
                this.logger.warn('Cache decompression failed', { error: error.message });
                return null;
            }
        };
    }

    async setCacheItem(key, value, ttl = this.config.caching.ttl) {
        try {
            const item = {
                data: this.compressCache(value),
                timestamp: Date.now(),
                ttl: ttl,
                accessCount: 0
            };
            
            // Try Redis first
            if (this.redisClient) {
                await this.redisClient.setWithFallback(
                    `cache:${key}`,
                    JSON.stringify(item),
                    ttl / 1000 // Redis expects seconds
                );
            }
            
            // Always store in memory as backup
            this.cacheSystem.memory.set(key, item);
            this.cacheMetadata.set(key, {
                created: Date.now(),
                accessed: Date.now(),
                hits: 0
            });
            
            // Implement cache eviction if size limit reached
            if (this.cacheSystem.memory.size > this.config.caching.maxSize) {
                await this.evictCacheItems();
            }
            
        } catch (error) {
            this.logger.error('Cache set failed', { key, error: error.message });
            this.cacheSystem.stats.errors++;
        }
    }

    async getCacheItem(key) {
        try {
            let item = null;
            
            // Try Redis first
            if (this.redisClient) {
                const redisValue = await this.redisClient.getWithFallback(`cache:${key}`);
                if (redisValue) {
                    item = JSON.parse(redisValue);
                    this.cacheSystem.stats.hits++;
                }
            }
            
            // Fallback to memory cache
            if (!item && this.cacheSystem.memory.has(key)) {
                item = this.cacheSystem.memory.get(key);
                this.cacheSystem.stats.hits++;
            }
            
            if (item) {
                // Check TTL
                if (Date.now() - item.timestamp > item.ttl) {
                    await this.deleteCacheItem(key);
                    this.cacheSystem.stats.misses++;
                    return null;
                }
                
                // Update access metadata
                const metadata = this.cacheMetadata.get(key);
                if (metadata) {
                    metadata.accessed = Date.now();
                    metadata.hits++;
                }
                
                item.accessCount++;
                return this.decompressCache(item.data);
            }
            
            this.cacheSystem.stats.misses++;
            return null;
            
        } catch (error) {
            this.logger.error('Cache get failed', { key, error: error.message });
            this.cacheSystem.stats.errors++;
            return null;
        }
    }

    async deleteCacheItem(key) {
        try {
            // Remove from Redis
            if (this.redisClient) {
                await this.redisClient.deleteWithFallback(`cache:${key}`);
            }
            
            // Remove from memory
            this.cacheSystem.memory.delete(key);
            this.cacheMetadata.delete(key);
            
        } catch (error) {
            this.logger.error('Cache delete failed', { key, error: error.message });
        }
    }

    async evictCacheItems() {
        const strategy = this.config.caching.strategy;
        const evictCount = Math.floor(this.config.caching.maxSize * 0.1); // Evict 10%
        
        try {
            switch (strategy) {
                case 'lru':
                    await this.evictLRU(evictCount);
                    break;
                case 'lfu':
                    await this.evictLFU(evictCount);
                    break;
                case 'fifo':
                    await this.evictFIFO(evictCount);
                    break;
            }
            
            this.cacheSystem.stats.evictions += evictCount;
            this.logger.info(`Evicted ${evictCount} cache items using ${strategy} strategy`);
            
        } catch (error) {
            this.logger.error('Cache eviction failed', { error: error.message });
        }
    }

    async evictLRU(count) {
        // Sort by last accessed time
        const sortedKeys = Array.from(this.cacheMetadata.entries())
            .sort(([, a], [, b]) => a.accessed - b.accessed)
            .slice(0, count)
            .map(([key]) => key);
        
        for (const key of sortedKeys) {
            await this.deleteCacheItem(key);
        }
    }

    async evictLFU(count) {
        // Sort by hit count (least frequently used)
        const sortedKeys = Array.from(this.cacheMetadata.entries())
            .sort(([, a], [, b]) => a.hits - b.hits)
            .slice(0, count)
            .map(([key]) => key);
        
        for (const key of sortedKeys) {
            await this.deleteCacheItem(key);
        }
    }

    async evictFIFO(count) {
        // Sort by creation time (first in, first out)
        const sortedKeys = Array.from(this.cacheMetadata.entries())
            .sort(([, a], [, b]) => a.created - b.created)
            .slice(0, count)
            .map(([key]) => key);
        
        for (const key of sortedKeys) {
            await this.deleteCacheItem(key);
        }
    }

    setupConnectionPooling() {
        // Enhanced connection pool management
        this.createEnhancedPool = (name, factory, options = {}) => {
            const pool = {
                name,
                factory,
                connections: [],
                active: 0,
                waiting: [],
                maxConnections: options.max || this.config.pooling.maxConnections,
                minConnections: options.min || Math.ceil(options.max / 4),
                idleTimeout: options.idleTimeout || this.config.pooling.idleTimeout,
                acquireTimeout: options.acquireTimeout || this.config.pooling.acquireTimeout,
                stats: {
                    created: 0,
                    destroyed: 0,
                    acquired: 0,
                    released: 0,
                    timeouts: 0
                }
            };
            
            // Pre-populate with minimum connections
            this.warmupPool(pool);
            
            this.connectionPools.set(name, pool);
            return pool;
        };
        
        // Create enhanced pools for different services
        if (this.config.pooling.enabled) {
            // Database pool
            this.createEnhancedPool('database', async () => {
                // Database connection factory
                return { type: 'database', connected: true, created: Date.now() };
            }, this.config.pooling.pooling.database);
            
            // HTTP client pool
            this.createEnhancedPool('http', async () => {
                const http = require('http');
                return new http.Agent({
                    keepAlive: true,
                    maxSockets: 10
                });
            }, this.config.pooling.pooling.http);
        }
    }

    async warmupPool(pool) {
        try {
            const promises = [];
            for (let i = 0; i < pool.minConnections; i++) {
                promises.push(this.createPoolConnection(pool));
            }
            await Promise.all(promises);
            this.logger.info(`Warmed up ${pool.name} pool with ${pool.minConnections} connections`);
        } catch (error) {
            this.logger.error(`Failed to warm up ${pool.name} pool:`, error);
        }
    }

    async createPoolConnection(pool) {
        try {
            const connection = await pool.factory();
            connection.poolCreated = Date.now();
            connection.poolIdle = Date.now();
            pool.connections.push(connection);
            pool.stats.created++;
            return connection;
        } catch (error) {
            this.logger.error(`Failed to create connection for ${pool.name}:`, error);
            throw error;
        }
    }

    setupAsyncOptimization() {
        // Concurrency limiter
        this.concurrencyLimiter = {
            active: 0,
            queue: [],
            
            execute: async (fn, maxConcurrency = this.config.optimization.asyncOptimization.maxConcurrency) => {
                return new Promise((resolve, reject) => {
                    const executeTask = async () => {
                        this.concurrencyLimiter.active++;
                        try {
                            const result = await fn();
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        } finally {
                            this.concurrencyLimiter.active--;
                            this.processQueue();
                        }
                    };
                    
                    if (this.concurrencyLimiter.active < maxConcurrency) {
                        executeTask();
                    } else {
                        this.concurrencyLimiter.queue.push(executeTask);
                    }
                });
            },
            
            processQueue: () => {
                if (this.concurrencyLimiter.queue.length > 0 && 
                    this.concurrencyLimiter.active < this.config.optimization.asyncOptimization.maxConcurrency) {
                    const task = this.concurrencyLimiter.queue.shift();
                    task();
                }
            }
        };
    }

    setupEventLoopMonitoring() {
        if (!this.config.optimization.eventLoop.monitoringEnabled) return;
        
        let lastTime = process.hrtime();
        
        setInterval(() => {
            const currentTime = process.hrtime();
            const lag = (currentTime[0] - lastTime[0]) * 1000 + (currentTime[1] - lastTime[1]) / 1e6;
            
            this.metrics.eventLoop.lag = lag;
            
            if (lag > this.config.optimization.eventLoop.lagThreshold) {
                this.logger.warn('Event loop lag detected', { lag: `${lag.toFixed(2)}ms` });
                this.emit('eventLoopLag', { lag });
            }
            
            lastTime = currentTime;
        }, 1000);
    }

    startEnhancedMonitoring() {
        const interval = this.config.monitoring.interval;
        
        setInterval(() => {
            const metrics = this.collectEnhancedMetrics();
            this.emit('metrics', metrics);
            
            // Check performance thresholds with circuit breaker integration
            this.checkEnhancedThresholds(metrics);
            
            // Log detailed metrics
            if (this.config.monitoring.detailed) {
                this.logger.info('Enhanced performance metrics', metrics);
            }
            
            // Store metrics in context manager
            this.contextManager.addAgentEvent('performance-optimizer', 'metrics', metrics);
            
        }, interval);
        
        this.logger.info('Enhanced monitoring started', { interval: `${interval}ms` });
    }

    collectEnhancedMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            timestamp: Date.now(),
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            cache: {
                size: this.cacheSystem.memory.size,
                hitRate: this.cacheSystem.stats.hits / (this.cacheSystem.stats.hits + this.cacheSystem.stats.misses) * 100 || 0,
                hits: this.cacheSystem.stats.hits,
                misses: this.cacheSystem.stats.misses,
                evictions: this.cacheSystem.stats.evictions,
                errors: this.cacheSystem.stats.errors
            },
            connectionPools: this.getPoolMetrics(),
            workers: this.metrics.workers,
            eventLoop: this.metrics.eventLoop,
            requests: this.metrics.requests,
            responses: this.metrics.responses,
            errors: this.metrics.errors,
            avgResponseTime: this.metrics.avgResponseTime,
            uptime: process.uptime()
        };
    }

    getPoolMetrics() {
        const poolMetrics = {};
        
        for (const [name, pool] of this.connectionPools) {
            poolMetrics[name] = {
                total: pool.connections.length,
                active: pool.active,
                waiting: pool.waiting.length,
                stats: pool.stats
            };
        }
        
        return poolMetrics;
    }

    checkEnhancedThresholds(metrics) {
        const { thresholds } = this.config.monitoring;
        const alerts = [];
        
        if (metrics.memory.percentage > thresholds.memory) {
            alerts.push({
                type: 'high_memory',
                value: metrics.memory.percentage,
                threshold: thresholds.memory,
                severity: 'warning'
            });
        }
        
        if (metrics.avgResponseTime > thresholds.responseTime) {
            alerts.push({
                type: 'slow_response',
                value: metrics.avgResponseTime,
                threshold: thresholds.responseTime,
                severity: 'warning'
            });
        }
        
        if (metrics.eventLoop.lag > this.config.optimization.eventLoop.lagThreshold) {
            alerts.push({
                type: 'event_loop_lag',
                value: metrics.eventLoop.lag,
                threshold: this.config.optimization.eventLoop.lagThreshold,
                severity: 'critical'
            });
        }
        
        // Calculate error rate
        const totalRequests = metrics.requests + metrics.responses;
        const errorRate = totalRequests > 0 ? (metrics.errors / totalRequests) * 100 : 0;
        
        if (errorRate > thresholds.errorRate) {
            alerts.push({
                type: 'high_error_rate',
                value: errorRate,
                threshold: thresholds.errorRate,
                severity: 'critical'
            });
        }
        
        // Process alerts
        if (alerts.length > 0) {
            this.processAlerts(alerts);
        }
    }

    processAlerts(alerts) {
        for (const alert of alerts) {
            this.emit('performanceAlert', alert);
            
            if (this.config.monitoring.alerts.enabled) {
                for (const channel of this.config.monitoring.alerts.channels) {
                    this.sendAlert(alert, channel);
                }
            }
        }
    }

    sendAlert(alert, channel) {
        switch (channel) {
            case 'log':
                this.logger.warn('Performance alert', alert);
                break;
            case 'factor3':
                this.contextManager.addAgentEvent('performance-optimizer', 'alert', alert);
                break;
            // Add more alert channels as needed (slack, email, etc.)
        }
    }

    setupAdvancedGarbageCollection() {
        const gcInterval = this.config.optimization.garbageCollection.interval;
        const forceThreshold = this.config.optimization.garbageCollection.forceThreshold;
        
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const heapPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            
            if (heapPercentage > forceThreshold && global.gc) {
                const beforeGC = process.memoryUsage();
                global.gc();
                const afterGC = process.memoryUsage();
                
                this.metrics.memory.gcCount++;
                
                const freed = beforeGC.heapUsed - afterGC.heapUsed;
                this.logger.info('Garbage collection completed', {
                    freedMemory: `${Math.round(freed / 1024 / 1024)}MB`,
                    beforeHeap: `${Math.round(beforeGC.heapUsed / 1024 / 1024)}MB`,
                    afterHeap: `${Math.round(afterGC.heapUsed / 1024 / 1024)}MB`
                });
            }
        }, gcInterval);
    }

    async loadConfiguration() {
        try {
            const configPath = path.join(__dirname, 'config', 'performance-enhanced.json');
            const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
            Object.assign(this.config, config);
            this.logger.info('Enhanced performance configuration loaded');
        } catch (error) {
            this.logger.info('Using default enhanced performance configuration');
        }
    }

    // Enhanced middleware functions
    getEnhancedMiddleware() {
        return {
            // Advanced caching middleware
            caching: (options = {}) => {
                return async (req, res, next) => {
                    const cacheKey = `route:${req.method}:${req.url}:${JSON.stringify(req.query)}`;
                    const ttl = options.ttl || this.config.caching.ttl;
                    
                    try {
                        const cached = await this.getCacheItem(cacheKey);
                        
                        if (cached) {
                            res.json(cached);
                            return;
                        }
                        
                        // Override res.json to cache response
                        const originalJson = res.json;
                        res.json = async (data) => {
                            if (res.statusCode === 200) {
                                await this.setCacheItem(cacheKey, data, ttl);
                            }
                            return originalJson.call(res, data);
                        };
                        
                        next();
                        
                    } catch (error) {
                        this.logger.error('Caching middleware error:', error);
                        next();
                    }
                };
            },
            
            // Performance monitoring middleware
            monitoring: () => {
                return (req, res, next) => {
                    const startTime = process.hrtime.bigint();
                    this.metrics.requests++;
                    
                    res.on('finish', () => {
                        const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // Convert to milliseconds
                        this.metrics.responses++;
                        this.metrics.avgResponseTime = (this.metrics.avgResponseTime + duration) / 2;
                        
                        if (res.statusCode >= 400) {
                            this.metrics.errors++;
                        }
                        
                        // Log slow requests
                        if (duration > this.config.monitoring.thresholds.responseTime) {
                            this.logger.warn('Slow request detected', {
                                method: req.method,
                                url: req.url,
                                duration: `${duration.toFixed(2)}ms`,
                                statusCode: res.statusCode
                            });
                        }
                    });
                    
                    next();
                };
            }
        };
    }

    async shutdownGracefully() {
        this.logger.info('Shutting down enhanced performance optimizer gracefully...');
        
        try {
            if (cluster.isPrimary) {
                // Gracefully shutdown all workers
                const workers = Object.values(cluster.workers);
                await Promise.all(workers.map(worker => {
                    return new Promise(resolve => {
                        worker.disconnect(() => {
                            setTimeout(() => {
                                if (!worker.isDead()) {
                                    worker.kill();
                                }
                                resolve();
                            }, 5000); // 5 second grace period
                        });
                    });
                }));
            }
            
            // Close connection pools
            for (const [name, pool] of this.connectionPools) {
                this.logger.info(`Closing connection pool: ${name}`);
                await this.closePool(pool);
            }
            
            // Close Redis connection
            if (this.redisClient) {
                await this.redisClient.shutdown();
            }
            
            this.logger.info('Enhanced performance optimizer shutdown complete');
            process.exit(0);
            
        } catch (error) {
            this.logger.error('Error during graceful shutdown:', error);
            process.exit(1);
        }
    }

    async closePool(pool) {
        // Close all connections in the pool
        for (const connection of pool.connections) {
            if (connection.close) {
                await connection.close();
            } else if (connection.end) {
                connection.end();
            }
            pool.stats.destroyed++;
        }
        
        pool.connections.length = 0;
        pool.active = 0;
        pool.waiting.length = 0;
    }
}

module.exports = { PerformanceOptimizerEnhanced };

// Demo function for testing
if (require.main === module) {
    async function demo() {
        console.log('⚡ Enhanced Performance Optimizer - SESSION 6 Demo\n');
        
        const optimizer = new PerformanceOptimizerEnhanced({
            clustering: { workers: 2 }, // Reduced for demo
            monitoring: { detailed: true, interval: 5000 }
        });
        
        try {
            await optimizer.initialize();
            
            console.log('🚀 Enhanced Performance Features:');
            console.log(`  ✅ Advanced Clustering with Auto-scaling`);
            console.log(`  ✅ Multi-layer Caching (Memory + Redis fallback)`);
            console.log(`  ✅ Enhanced Connection Pooling`);
            console.log(`  ✅ Event Loop Monitoring`);
            console.log(`  ✅ Integrated with SESSION 5 Reliability Systems`);
            console.log(`  ✅ Advanced Metrics and Alerting`);
            
            // Demo caching
            await optimizer.setCacheItem('test-key', { demo: 'data', timestamp: Date.now() });
            const cached = await optimizer.getCacheItem('test-key');
            console.log(`  📊 Cache test: ${cached ? '✅ Success' : '❌ Failed'}`);
            
            // Demo metrics
            setTimeout(() => {
                const metrics = optimizer.collectEnhancedMetrics();
                console.log(`\n📈 Current Enhanced Metrics:`);
                console.log(`  Memory: ${metrics.memory.percentage.toFixed(2)}%`);
                console.log(`  Cache Hit Rate: ${metrics.cache.hitRate.toFixed(2)}%`);
                console.log(`  Event Loop Lag: ${metrics.eventLoop.lag?.toFixed(2) || 0}ms`);
                console.log(`  Uptime: ${metrics.uptime.toFixed(2)}s`);
            }, 2000);
            
        } catch (error) {
            console.error('❌ Enhanced optimizer demo failed:', error);
        }
    }
    
    demo().catch(console.error);
}