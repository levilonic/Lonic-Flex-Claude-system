const cluster = require('cluster');
const os = require('os');
const { EventEmitter } = require('events');
const winston = require('winston');

class PerformanceOptimizer extends EventEmitter {
    constructor() {
        super();
        this.config = {
            enabled: true,
            clustering: {
                enabled: true,
                workers: os.cpus().length,
                respawnDelay: 5000
            },
            caching: {
                enabled: true,
                ttl: 300000, // 5 minutes
                maxSize: 1000
            },
            pooling: {
                enabled: true,
                maxConnections: 10,
                idleTimeout: 30000
            },
            monitoring: {
                enabled: true,
                interval: 10000, // 10 seconds
                thresholds: {
                    cpu: 80,
                    memory: 85,
                    responseTime: 5000
                }
            }
        };
        
        this.cache = new Map();
        this.connectionPool = new Map();
        this.metrics = {
            requests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgResponseTime: 0,
            poolConnections: 0
        };
        
        this.setupLogger();
        this.setupOptimizations();
    }

    setupLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/performance.log' }),
                new winston.transports.Console()
            ]
        });
    }

    async initialize() {
        try {
            await this.loadConfiguration();
            
            if (this.config.clustering.enabled && cluster.isPrimary) {
                this.setupClustering();
            } else {
                this.setupSingleProcess();
            }
            
            if (this.config.monitoring.enabled) {
                this.startMonitoring();
            }
            
            this.logger.info('Performance optimizer initialized');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize performance optimizer:', error);
            throw error;
        }
    }

    setupOptimizations() {
        // Memory optimization
        this.setupMemoryManagement();
        
        // Request optimization
        this.setupRequestOptimization();
        
        // Database optimization
        this.setupDatabaseOptimization();
        
        // Asset optimization
        this.setupAssetOptimization();
    }

    setupClustering() {
        const numWorkers = this.config.clustering.workers;
        
        this.logger.info(`Setting up ${numWorkers} worker processes`);
        
        // Fork workers
        for (let i = 0; i < numWorkers; i++) {
            this.forkWorker();
        }
        
        // Handle worker events
        cluster.on('exit', (worker, code, signal) => {
            this.logger.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
            
            setTimeout(() => {
                this.forkWorker();
            }, this.config.clustering.respawnDelay);
        });
        
        cluster.on('online', (worker) => {
            this.logger.info(`Worker ${worker.process.pid} is online`);
        });
        
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
            }
        });
        
        return worker;
    }

    setupSingleProcess() {
        this.logger.info('Running in single process mode');
        
        // Setup process-level optimizations
        this.optimizeEventLoop();
        this.setupMemoryOptimization();
        this.setupGarbageCollection();
    }

    setupMemoryManagement() {
        // Memory leak detection
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const heapPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            
            if (heapPercentage > this.config.monitoring.thresholds.memory) {
                this.logger.warn(`High memory usage: ${heapPercentage.toFixed(2)}%`);
                this.emit('highMemoryUsage', { usage: memUsage, percentage: heapPercentage });
                
                // Trigger garbage collection if available
                if (global.gc) {
                    global.gc();
                    this.logger.info('Garbage collection triggered');
                }
            }
        }, 30000); // Check every 30 seconds
        
        // Clear cache when memory is high
        this.on('highMemoryUsage', () => {
            if (this.cache.size > 100) {
                const oldSize = this.cache.size;
                this.cache.clear();
                this.logger.info(`Cache cleared due to high memory usage (${oldSize} items removed)`);
            }
        });
    }

    setupRequestOptimization() {
        // Response compression middleware
        this.compressResponses = (req, res, next) => {
            const originalSend = res.send;
            const originalJson = res.json;
            
            res.send = function(data) {
                if (typeof data === 'string' && data.length > 1024) {
                    res.set('Content-Encoding', 'gzip');
                    // In production, use actual gzip compression
                    data = `[COMPRESSED: ${data.length} bytes]`;
                }
                return originalSend.call(this, data);
            };
            
            res.json = function(obj) {
                const data = JSON.stringify(obj);
                if (data.length > 1024) {
                    res.set('Content-Encoding', 'gzip');
                    // In production, use actual gzip compression
                }
                return originalJson.call(this, obj);
            };
            
            next();
        };
        
        // Request timeout middleware
        this.requestTimeout = (timeout = 30000) => {
            return (req, res, next) => {
                const timeoutId = setTimeout(() => {
                    if (!res.headersSent) {
                        res.status(408).json({ error: 'Request timeout' });
                    }
                }, timeout);
                
                res.on('finish', () => clearTimeout(timeoutId));
                res.on('close', () => clearTimeout(timeoutId));
                
                next();
            };
        };
    }

    setupDatabaseOptimization() {
        // Connection pooling
        this.createConnectionPool = (name, createConnection, maxConnections = 10) => {
            const pool = {
                connections: [],
                active: 0,
                maxConnections,
                createConnection
            };
            
            this.connectionPool.set(name, pool);
            return pool;
        };
        
        this.getPooledConnection = async (poolName) => {
            const pool = this.connectionPool.get(poolName);
            if (!pool) {
                throw new Error(`Connection pool not found: ${poolName}`);
            }
            
            // Try to get existing connection
            if (pool.connections.length > 0) {
                const connection = pool.connections.pop();
                pool.active++;
                return connection;
            }
            
            // Create new connection if under limit
            if (pool.active < pool.maxConnections) {
                const connection = await pool.createConnection();
                pool.active++;
                return connection;
            }
            
            // Wait for available connection
            return new Promise((resolve) => {
                const checkForConnection = () => {
                    if (pool.connections.length > 0) {
                        const connection = pool.connections.pop();
                        pool.active++;
                        resolve(connection);
                    } else {
                        setTimeout(checkForConnection, 100);
                    }
                };
                checkForConnection();
            });
        };
        
        this.releaseConnection = (poolName, connection) => {
            const pool = this.connectionPool.get(poolName);
            if (pool) {
                pool.connections.push(connection);
                pool.active--;
            }
        };
        
        // Query optimization
        this.optimizeQuery = (query, params) => {
            // Query caching
            const cacheKey = `query:${query}:${JSON.stringify(params)}`;
            
            if (this.cache.has(cacheKey)) {
                this.metrics.cacheHits++;
                return this.cache.get(cacheKey);
            }
            
            this.metrics.cacheMisses++;
            return null;
        };
        
        this.cacheQueryResult = (query, params, result) => {
            const cacheKey = `query:${query}:${JSON.stringify(params)}`;
            
            if (this.config.caching.enabled && this.cache.size < this.config.caching.maxSize) {
                this.cache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now(),
                    ttl: this.config.caching.ttl
                });
                
                // Set expiration
                setTimeout(() => {
                    this.cache.delete(cacheKey);
                }, this.config.caching.ttl);
            }
        };
    }

    setupAssetOptimization() {
        // Static file caching
        this.cacheStaticAsset = (path, content, contentType) => {
            if (!this.config.caching.enabled) return;
            
            const cacheKey = `asset:${path}`;
            this.cache.set(cacheKey, {
                content,
                contentType,
                timestamp: Date.now(),
                etag: this.generateETag(content)
            });
        };
        
        this.getStaticAsset = (path) => {
            const cacheKey = `asset:${path}`;
            return this.cache.get(cacheKey);
        };
        
        // Image optimization (placeholder)
        this.optimizeImage = async (imagePath, options = {}) => {
            // In production, use sharp or similar library
            this.logger.info(`Optimizing image: ${imagePath}`);
            return imagePath; // Return optimized path
        };
        
        // CSS/JS minification (placeholder)
        this.minifyAssets = async (content, type) => {
            // In production, use terser for JS and cssnano for CSS
            const originalSize = content.length;
            const minified = content.replace(/\s+/g, ' ').trim(); // Simple minification
            
            this.logger.info(`Minified ${type}: ${originalSize} -> ${minified.length} bytes`);
            return minified;
        };
    }

    optimizeEventLoop() {
        // Prevent blocking the event loop
        this.setImmediateRecursive = (fn, maxIterations = 1000) => {
            let iterations = 0;
            
            const iterate = (...args) => {
                if (iterations++ < maxIterations) {
                    const result = fn(...args);
                    if (result !== false) { // Continue if not explicitly stopped
                        setImmediate(() => iterate(...args));
                    }
                }
            };
            
            setImmediate(() => iterate());
        };
        
        // Process large arrays in chunks
        this.processArrayInChunks = async (array, processor, chunkSize = 100) => {
            const results = [];
            
            for (let i = 0; i < array.length; i += chunkSize) {
                const chunk = array.slice(i, i + chunkSize);
                const chunkResults = await processor(chunk);
                results.push(...chunkResults);
                
                // Yield to event loop
                await new Promise(resolve => setImmediate(resolve));
            }
            
            return results;
        };
    }

    setupGarbageCollection() {
        // Monitor garbage collection
        if (process.versions.v8) {
            const v8 = require('v8');
            
            setInterval(() => {
                const heapStats = v8.getHeapStatistics();
                const heapUsed = heapStats.used_heap_size;
                const heapTotal = heapStats.total_heap_size;
                const percentage = (heapUsed / heapTotal) * 100;
                
                this.metrics.heapUsage = percentage;
                
                if (percentage > 90 && global.gc) {
                    global.gc();
                    this.logger.info('Manual garbage collection triggered');
                }
            }, 60000); // Check every minute
        }
    }

    startMonitoring() {
        setInterval(() => {
            const metrics = this.collectMetrics();
            this.emit('metrics', metrics);
            
            // Check performance thresholds
            this.checkPerformanceThresholds(metrics);
            
            // Log metrics
            this.logger.info('Performance metrics', metrics);
        }, this.config.monitoring.interval);
    }

    collectMetrics() {
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
                size: this.cache.size,
                hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100 || 0
            },
            requests: this.metrics.requests,
            avgResponseTime: this.metrics.avgResponseTime,
            uptime: process.uptime()
        };
    }

    checkPerformanceThresholds(metrics) {
        const { thresholds } = this.config.monitoring;
        
        if (metrics.memory.percentage > thresholds.memory) {
            this.emit('performanceAlert', {
                type: 'high_memory',
                value: metrics.memory.percentage,
                threshold: thresholds.memory
            });
        }
        
        if (metrics.avgResponseTime > thresholds.responseTime) {
            this.emit('performanceAlert', {
                type: 'slow_response',
                value: metrics.avgResponseTime,
                threshold: thresholds.responseTime
            });
        }
    }

    aggregateWorkerMetrics(workerMetrics) {
        // Aggregate metrics from worker processes
        this.metrics.requests += workerMetrics.requests || 0;
        this.metrics.cacheHits += workerMetrics.cacheHits || 0;
        this.metrics.cacheMisses += workerMetrics.cacheMisses || 0;
    }

    generateETag(content) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(content).digest('hex');
    }

    async shutdownGracefully() {
        this.logger.info('Shutting down gracefully...');
        
        if (cluster.isPrimary) {
            // Close all workers
            for (const id in cluster.workers) {
                cluster.workers[id].kill();
            }
            
            // Wait for workers to exit
            await new Promise((resolve) => {
                let workersAlive = Object.keys(cluster.workers).length;
                
                if (workersAlive === 0) {
                    resolve();
                    return;
                }
                
                cluster.on('exit', () => {
                    workersAlive--;
                    if (workersAlive === 0) {
                        resolve();
                    }
                });
            });
        }
        
        // Close connection pools
        for (const [name, pool] of this.connectionPool) {
            this.logger.info(`Closing connection pool: ${name}`);
            // Close connections (implementation depends on connection type)
        }
        
        this.logger.info('Shutdown complete');
        process.exit(0);
    }

    // Middleware functions for Express
    getMiddleware() {
        return {
            compression: this.compressResponses,
            timeout: this.requestTimeout,
            
            caching: (ttl = this.config.caching.ttl) => {
                return (req, res, next) => {
                    const cacheKey = `route:${req.method}:${req.url}`;
                    const cached = this.cache.get(cacheKey);
                    
                    if (cached && Date.now() - cached.timestamp < ttl) {
                        this.metrics.cacheHits++;
                        return res.json(cached.data);
                    }
                    
                    this.metrics.cacheMisses++;
                    
                    // Override res.json to cache response
                    const originalJson = res.json;
                    res.json = (data) => {
                        if (res.statusCode === 200) {
                            this.cache.set(cacheKey, {
                                data,
                                timestamp: Date.now()
                            });
                        }
                        return originalJson.call(res, data);
                    };
                    
                    next();
                };
            },
            
            metrics: (req, res, next) => {
                const startTime = Date.now();
                this.metrics.requests++;
                
                res.on('finish', () => {
                    const duration = Date.now() - startTime;
                    this.metrics.avgResponseTime = 
                        (this.metrics.avgResponseTime + duration) / 2;
                });
                
                next();
            }
        };
    }

    async loadConfiguration() {
        try {
            const configPath = path.join(__dirname, 'config', 'performance.json');
            const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
            Object.assign(this.config, config);
            
            this.logger.info('Performance configuration loaded');
        } catch (error) {
            this.logger.info('Using default performance configuration');
        }
    }
}

module.exports = { PerformanceOptimizer };

if (require.main === module) {
    const optimizer = new PerformanceOptimizer();

    async function demo() {
        console.log('⚡ Starting Performance Optimizer Demo...\n');
        
        await optimizer.initialize();
        
        console.log('🔧 Performance optimizations enabled:');
        console.log(`  Clustering: ${optimizer.config.clustering.enabled ? `✅ (${optimizer.config.clustering.workers} workers)` : '❌'}`);
        console.log(`  Caching: ${optimizer.config.caching.enabled ? '✅' : '❌'}`);
        console.log(`  Connection Pooling: ${optimizer.config.pooling.enabled ? '✅' : '❌'}`);
        console.log(`  Monitoring: ${optimizer.config.monitoring.enabled ? '✅' : '❌'}`);
        console.log();
        
        // Simulate some operations
        console.log('📊 Simulating performance optimizations...');
        
        // Test caching
        optimizer.cacheQueryResult('SELECT * FROM users', [], { users: [{ id: 1, name: 'Test' }] });
        const cached = optimizer.optimizeQuery('SELECT * FROM users', []);
        
        if (cached) {
            console.log('✅ Query cache hit');
        }
        
        // Test metrics collection
        const metrics = optimizer.collectMetrics();
        console.log(`📈 Current metrics:`);
        console.log(`  Memory: ${metrics.memory.percentage.toFixed(2)}%`);
        console.log(`  Cache size: ${metrics.cache.size}`);
        console.log(`  Cache hit rate: ${metrics.cache.hitRate.toFixed(2)}%`);
        console.log(`  Uptime: ${metrics.uptime.toFixed(2)}s`);
        
        // Test middleware
        console.log('\n🔌 Available middleware:');
        const middleware = optimizer.getMiddleware();
        console.log(`  Compression: ${middleware.compression ? '✅' : '❌'}`);
        console.log(`  Caching: ${middleware.caching ? '✅' : '❌'}`);
        console.log(`  Metrics: ${middleware.metrics ? '✅' : '❌'}`);
        console.log(`  Timeout: ${middleware.timeout ? '✅' : '❌'}`);
        
        console.log('\n✅ Performance optimizer demo completed');
        
        // Don't exit if clustering is enabled (workers will keep running)
        if (!optimizer.config.clustering.enabled || !cluster.isPrimary) {
            process.exit(0);
        }
    }

    demo().catch(console.error);
}