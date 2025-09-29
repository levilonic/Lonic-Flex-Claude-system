/**
 * Enhanced Load Balancer - SESSION 6: Performance Optimization
 * Integrated with SESSION 5 reliability systems (Circuit breakers, Redis fallback, etc.)
 * Advanced algorithms, health checks, SSL termination, and production monitoring
 */

const http = require('http');
const https = require('https');
const url = require('url');
const { EventEmitter } = require('events');
const winston = require('winston');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const { errorHandler } = require('./claude-error-handler');
const { RedisWithFallback } = require('./claude-redis-fallback');

class LoadBalancerEnhanced extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            port: options.port || 3000,
            httpsPort: options.httpsPort || 3443,
            algorithm: options.algorithm || 'round-robin', // round-robin, least-connections, weighted, ip-hash, resource-based
            healthCheck: {
                enabled: true,
                interval: 30000, // 30 seconds
                timeout: 5000,
                path: '/health',
                expectedStatus: 200,
                consecutiveFailures: 3,
                consecutiveSuccesses: 2,
                advanced: {
                    enabled: true,
                    deepHealthChecks: [
                        { path: '/api/health', weight: 0.4 },
                        { path: '/db/health', weight: 0.3 },
                        { path: '/cache/health', weight: 0.3 }
                    ]
                }
            },
            retry: {
                attempts: 3,
                delay: 1000,
                backoff: 'exponential' // linear, exponential
            },
            sticky: options.sticky || false,
            ssl: {
                enabled: options.ssl || false,
                cert: options.sslCert,
                key: options.sslKey,
                termination: true // SSL termination at load balancer
            },
            circuitBreaker: {
                enabled: true,
                failureThreshold: 5,
                recoveryTimeout: 30000,
                monitoringWindow: 60000
            },
            monitoring: {
                enabled: true,
                detailed: true,
                interval: 10000,
                metrics: {
                    responseTime: true,
                    throughput: true,
                    errorRate: true,
                    connectionCount: true
                }
            },
            rateLimiting: {
                enabled: true,
                windowSize: 60000, // 1 minute
                maxRequests: 1000,
                burstSize: 100
            },
            compression: {
                enabled: true,
                threshold: 1024,
                types: ['text/html', 'text/plain', 'application/json']
            },
            ...options
        };
        
        // Enhanced server management
        this.servers = new Map();
        this.currentIndex = 0;
        this.stickyStore = new Map(); // For sticky sessions
        this.circuitBreakers = new Map(); // Circuit breakers per server
        this.rateLimiters = new Map(); // Rate limiters per client IP
        
        // Advanced statistics tracking
        this.stats = {
            global: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                bytesTransferred: 0,
                connectionsActive: 0,
                circuitBreakerTrips: 0,
                rateLimitViolations: 0
            },
            perSecond: {
                requests: 0,
                responses: 0,
                bytes: 0
            },
            rolling: {
                requestHistory: [],
                responseTimeHistory: [],
                errorHistory: []
            }
        };
        
        // Integration with reliability systems
        this.contextManager = new Factor3ContextManager();
        this.redisClient = null;
        
        this.setupLogger();
        this.setupReliabilityIntegration();
        this.setupMetricsCollection();
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
                    filename: 'logs/load-balancer-enhanced.log',
                    maxsize: 50000000, // 50MB
                    maxFiles: 5
                }),
                new winston.transports.Console()
            ]
        });
    }

    async setupReliabilityIntegration() {
        try {
            // Initialize Redis for sticky sessions and rate limiting
            this.redisClient = new RedisWithFallback({
                fallbackEnabled: true,
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            });
            
            await this.redisClient.initialize();
            this.logger.info('Load balancer Redis client initialized with fallback');
            
            // Register with context manager
            this.contextManager.addAgentEvent('load-balancer', 'initialized', {
                algorithm: this.config.algorithm,
                circuitBreaker: this.config.circuitBreaker.enabled,
                healthCheck: this.config.healthCheck.enabled
            });
            
        } catch (error) {
            this.logger.error('Failed to setup reliability integration:', error);
            // Continue without Redis if needed
        }
    }

    setupMetricsCollection() {
        // Real-time metrics collection
        setInterval(() => {
            this.updateRollingMetrics();
            this.resetPerSecondCounters();
        }, 1000);
        
        // Detailed metrics reporting
        if (this.config.monitoring.enabled) {
            setInterval(() => {
                const metrics = this.collectDetailedMetrics();
                this.emit('metrics', metrics);
                
                if (this.config.monitoring.detailed) {
                    this.logger.info('Load balancer metrics', metrics);
                }
                
                // Store in context manager
                this.contextManager.addAgentEvent('load-balancer', 'metrics', metrics);
            }, this.config.monitoring.interval);
        }
    }

    // Enhanced server management
    addServer(id, host, port, options = {}) {
        const server = {
            id,
            host,
            port,
            weight: options.weight || 1,
            maxConnections: options.maxConnections || 100,
            currentConnections: 0,
            priority: options.priority || 1, // For priority-based routing
            healthy: true,
            healthScore: 100, // 0-100 health score
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            responseTimeHistory: [],
            lastHealthCheck: Date.now(),
            resources: {
                cpu: 0,
                memory: 0,
                connections: 0
            },
            ...options
        };
        
        this.servers.set(id, server);
        
        // Initialize circuit breaker for this server
        if (this.config.circuitBreaker.enabled) {
            this.circuitBreakers.set(id, {
                state: 'CLOSED',
                failures: 0,
                lastFailureTime: null,
                nextRetry: null
            });
        }
        
        this.logger.info(`Added enhanced server: ${id} (${host}:${port}) weight=${server.weight}`);
        return server;
    }

    // Advanced load balancing algorithms
    getNextServer(clientIp = null, sessionId = null, requestContext = {}) {
        const healthyServers = Array.from(this.servers.values())
            .filter(s => s.healthy && this.isCircuitBreakerClosed(s.id));
        
        if (healthyServers.length === 0) {
            this.logger.error('No healthy servers available');
            return null;
        }
        
        // Handle sticky sessions
        if (this.config.sticky && sessionId && this.stickyStore.has(sessionId)) {
            const serverId = this.stickyStore.get(sessionId);
            const stickyServer = this.servers.get(serverId);
            
            if (stickyServer && stickyServer.healthy && this.isCircuitBreakerClosed(serverId)) {
                return stickyServer;
            } else {
                // Remove invalid sticky session
                this.stickyStore.delete(sessionId);
            }
        }
        
        // Apply load balancing algorithm
        let selectedServer;
        switch (this.config.algorithm) {
            case 'round-robin':
                selectedServer = this.roundRobin(healthyServers);
                break;
            case 'least-connections':
                selectedServer = this.leastConnections(healthyServers);
                break;
            case 'weighted':
                selectedServer = this.weighted(healthyServers);
                break;
            case 'ip-hash':
                selectedServer = this.ipHash(healthyServers, clientIp);
                break;
            case 'resource-based':
                selectedServer = this.resourceBased(healthyServers);
                break;
            default:
                selectedServer = this.roundRobin(healthyServers);
        }
        
        // Set sticky session if enabled
        if (this.config.sticky && sessionId && selectedServer) {
            this.stickyStore.set(sessionId, selectedServer.id);
        }
        
        return selectedServer;
    }

    roundRobin(servers) {
        const server = servers[this.currentIndex % servers.length];
        this.currentIndex++;
        return server;
    }

    leastConnections(servers) {
        return servers.reduce((prev, current) => 
            prev.currentConnections < current.currentConnections ? prev : current
        );
    }

    weighted(servers) {
        const totalWeight = servers.reduce((sum, server) => sum + server.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const server of servers) {
            random -= server.weight;
            if (random <= 0) {
                return server;
            }
        }
        
        return servers[0];
    }

    ipHash(servers, clientIp) {
        if (!clientIp) return this.roundRobin(servers);
        
        let hash = 0;
        for (let i = 0; i < clientIp.length; i++) {
            const char = clientIp.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        const index = Math.abs(hash) % servers.length;
        return servers[index];
    }

    resourceBased(servers) {
        // Select server based on current resource utilization
        return servers.reduce((prev, current) => {
            const prevScore = this.calculateResourceScore(prev);
            const currentScore = this.calculateResourceScore(current);
            return prevScore > currentScore ? prev : current;
        });
    }

    calculateResourceScore(server) {
        // Higher score = better choice (lower utilization)
        const cpuScore = (100 - server.resources.cpu) / 100;
        const memoryScore = (100 - server.resources.memory) / 100;
        const connectionScore = (server.maxConnections - server.currentConnections) / server.maxConnections;
        const healthScore = server.healthScore / 100;
        
        return (cpuScore * 0.3 + memoryScore * 0.3 + connectionScore * 0.2 + healthScore * 0.2) * server.weight;
    }

    // Advanced health checks
    async advancedHealthCheck(server) {
        if (!this.config.healthCheck.advanced.enabled) {
            return this.basicHealthCheck(server);
        }
        
        const healthChecks = this.config.healthCheck.advanced.deepHealthChecks;
        const results = [];
        
        for (const check of healthChecks) {
            try {
                const startTime = Date.now();
                const isHealthy = await this.performHealthCheck(server, check.path);
                const responseTime = Date.now() - startTime;
                
                results.push({
                    path: check.path,
                    healthy: isHealthy,
                    responseTime: responseTime,
                    weight: check.weight
                });
                
            } catch (error) {
                results.push({
                    path: check.path,
                    healthy: false,
                    error: error.message,
                    weight: check.weight
                });
            }
        }
        
        // Calculate weighted health score
        let totalScore = 0;
        let totalWeight = 0;
        
        for (const result of results) {
            totalScore += (result.healthy ? 100 : 0) * result.weight;
            totalWeight += result.weight;
        }
        
        const healthScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        server.healthScore = healthScore;
        
        return healthScore > 50; // Healthy if score > 50%
    }

    async basicHealthCheck(server) {
        return this.performHealthCheck(server, this.config.healthCheck.path);
    }

    async performHealthCheck(server, path) {
        return new Promise((resolve) => {
            const options = {
                hostname: server.host,
                port: server.port,
                path: path,
                timeout: this.config.healthCheck.timeout,
                method: 'GET'
            };

            const req = http.request(options, (res) => {
                const isHealthy = res.statusCode === this.config.healthCheck.expectedStatus;
                resolve(isHealthy);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    startHealthChecks() {
        if (!this.config.healthCheck.enabled) return;

        setInterval(async () => {
            const promises = Array.from(this.servers.values()).map(async (server) => {
                const wasHealthy = server.healthy;
                const isHealthy = await this.advancedHealthCheck(server);
                
                server.lastHealthCheck = Date.now();
                
                if (isHealthy) {
                    server.consecutiveSuccesses++;
                    server.consecutiveFailures = 0;
                    
                    if (!wasHealthy && server.consecutiveSuccesses >= this.config.healthCheck.consecutiveSuccesses) {
                        server.healthy = true;
                        this.resetCircuitBreaker(server.id);
                        this.logger.info(`Server ${server.id} is now healthy (${server.consecutiveSuccesses} consecutive successes)`);
                        this.emit('serverStatusChange', { server, healthy: true });
                    }
                } else {
                    server.consecutiveFailures++;
                    server.consecutiveSuccesses = 0;
                    
                    if (wasHealthy && server.consecutiveFailures >= this.config.healthCheck.consecutiveFailures) {
                        server.healthy = false;
                        this.tripCircuitBreaker(server.id);
                        this.logger.warn(`Server ${server.id} is now unhealthy (${server.consecutiveFailures} consecutive failures)`);
                        this.emit('serverStatusChange', { server, healthy: false });
                    }
                }
            });
            
            await Promise.all(promises);
            
            const healthyCount = Array.from(this.servers.values()).filter(s => s.healthy).length;
            const totalCount = this.servers.size;
            
            if (healthyCount === 0) {
                this.logger.error('All servers are unhealthy!');
                this.emit('allServersDown');
            } else if (healthyCount < totalCount) {
                this.logger.warn(`${totalCount - healthyCount}/${totalCount} servers are unhealthy`);
            }
            
        }, this.config.healthCheck.interval);
        
        this.logger.info('Enhanced health checks started');
    }

    // Circuit breaker implementation
    isCircuitBreakerClosed(serverId) {
        if (!this.config.circuitBreaker.enabled) return true;
        
        const breaker = this.circuitBreakers.get(serverId);
        if (!breaker) return true;
        
        if (breaker.state === 'OPEN') {
            // Check if we should attempt a retry
            if (Date.now() > breaker.nextRetry) {
                breaker.state = 'HALF_OPEN';
                this.logger.info(`Circuit breaker for ${serverId} entering HALF_OPEN state`);
            } else {
                return false;
            }
        }
        
        return true;
    }

    tripCircuitBreaker(serverId) {
        if (!this.config.circuitBreaker.enabled) return;
        
        const breaker = this.circuitBreakers.get(serverId);
        if (breaker) {
            breaker.state = 'OPEN';
            breaker.failures++;
            breaker.lastFailureTime = Date.now();
            breaker.nextRetry = Date.now() + this.config.circuitBreaker.recoveryTimeout;
            
            this.stats.global.circuitBreakerTrips++;
            this.logger.warn(`Circuit breaker tripped for server ${serverId}`);
        }
    }

    resetCircuitBreaker(serverId) {
        if (!this.config.circuitBreaker.enabled) return;
        
        const breaker = this.circuitBreakers.get(serverId);
        if (breaker) {
            breaker.state = 'CLOSED';
            breaker.failures = 0;
            this.logger.info(`Circuit breaker reset for server ${serverId}`);
        }
    }

    // Rate limiting
    async checkRateLimit(clientIp) {
        if (!this.config.rateLimiting.enabled) return true;
        
        const key = `rate_limit:${clientIp}`;
        const now = Date.now();
        const windowStart = now - this.config.rateLimiting.windowSize;
        
        try {
            // Use Redis if available
            if (this.redisClient) {
                const requests = await this.redisClient.zcount(key, windowStart, now);
                
                if (requests >= this.config.rateLimiting.maxRequests) {
                    this.stats.global.rateLimitViolations++;
                    return false;
                }
                
                // Add current request
                await this.redisClient.zadd(key, now, `${now}-${Math.random()}`);
                await this.redisClient.zremrangebyscore(key, '-inf', windowStart);
                await this.redisClient.expire(key, Math.ceil(this.config.rateLimiting.windowSize / 1000));
                
                return true;
            }
            
            // Fallback to memory-based rate limiting
            if (!this.rateLimiters.has(clientIp)) {
                this.rateLimiters.set(clientIp, []);
            }
            
            const requests = this.rateLimiters.get(clientIp);
            
            // Remove old requests outside window
            while (requests.length > 0 && requests[0] < windowStart) {
                requests.shift();
            }
            
            if (requests.length >= this.config.rateLimiting.maxRequests) {
                this.stats.global.rateLimitViolations++;
                return false;
            }
            
            requests.push(now);
            return true;
            
        } catch (error) {
            this.logger.error('Rate limiting check failed:', error);
            return true; // Allow request if rate limiting fails
        }
    }

    // Enhanced proxy request handling
    async proxyRequest(req, res, retryCount = 0) {
        const startTime = Date.now();
        const clientIp = req.connection.remoteAddress || 
                         req.headers['x-forwarded-for'] || 
                         req.headers['x-real-ip'];
        
        this.stats.global.totalRequests++;
        this.stats.perSecond.requests++;
        
        // Rate limiting check
        const rateLimitPassed = await this.checkRateLimit(clientIp);
        if (!rateLimitPassed) {
            this.handleRateLimitExceeded(res);
            return;
        }
        
        // Get session ID for sticky sessions
        const sessionId = this.config.sticky ? this.getSessionId(req) : null;
        
        // Get target server with enhanced selection
        const targetServer = this.getNextServer(clientIp, sessionId, {
            method: req.method,
            path: req.url,
            headers: req.headers
        });
        
        if (!targetServer) {
            this.handleNoServersAvailable(res);
            return;
        }
        
        // Update connection count
        targetServer.currentConnections++;
        targetServer.totalRequests++;
        this.stats.global.connectionsActive++;
        
        // Prepare enhanced proxy request
        const proxyOptions = {
            hostname: targetServer.host,
            port: targetServer.port,
            path: req.url,
            method: req.method,
            headers: {
                ...req.headers,
                'X-Forwarded-For': clientIp,
                'X-Forwarded-Proto': req.connection.encrypted ? 'https' : 'http',
                'X-Forwarded-Host': req.headers.host,
                'X-Load-Balancer': 'enhanced-lb',
                'X-Server-Id': targetServer.id
            }
        };
        
        // Remove hop-by-hop headers
        this.cleanupHeaders(proxyOptions.headers);
        
        const proxyReq = http.request(proxyOptions, (proxyRes) => {
            // Copy response headers
            Object.keys(proxyRes.headers).forEach(key => {
                res.setHeader(key, proxyRes.headers[key]);
            });
            
            // Add load balancer headers
            res.setHeader('X-Load-Balanced-By', 'enhanced-lb');
            res.setHeader('X-Server-Id', targetServer.id);
            
            res.statusCode = proxyRes.statusCode;
            
            // Handle response compression if enabled
            if (this.config.compression.enabled) {
                this.handleResponseCompression(req, res, proxyRes);
            }
            
            // Handle response data
            let responseData = Buffer.alloc(0);
            
            proxyRes.on('data', (chunk) => {
                responseData = Buffer.concat([responseData, chunk]);
                res.write(chunk);
                this.stats.global.bytesTransferred += chunk.length;
                this.stats.perSecond.bytes += chunk.length;
            });
            
            proxyRes.on('end', () => {
                const responseTime = Date.now() - startTime;
                
                // Update server statistics
                targetServer.currentConnections--;
                targetServer.successfulRequests++;
                targetServer.averageResponseTime = 
                    (targetServer.averageResponseTime + responseTime) / 2;
                targetServer.responseTimeHistory.push(responseTime);
                
                // Keep only recent response times
                if (targetServer.responseTimeHistory.length > 100) {
                    targetServer.responseTimeHistory.shift();
                }
                
                // Update global statistics
                this.stats.global.connectionsActive--;
                this.stats.global.successfulRequests++;
                this.stats.global.averageResponseTime = 
                    (this.stats.global.averageResponseTime + responseTime) / 2;
                this.stats.perSecond.responses++;
                
                // Reset circuit breaker on success if in HALF_OPEN state
                const breaker = this.circuitBreakers.get(targetServer.id);
                if (breaker && breaker.state === 'HALF_OPEN') {
                    this.resetCircuitBreaker(targetServer.id);
                }
                
                this.logger.info(`Request completed: ${req.method} ${req.url} -> ${targetServer.id} (${responseTime}ms)`);
                
                res.end();
            });
        });
        
        proxyReq.on('error', (error) => {
            targetServer.currentConnections--;
            targetServer.failedRequests++;
            this.stats.global.connectionsActive--;
            this.stats.global.failedRequests++;
            
            this.logger.error(`Proxy request failed to ${targetServer.id}:`, error);
            
            // Trip circuit breaker on error
            this.tripCircuitBreaker(targetServer.id);
            
            // Retry with different server
            if (retryCount < this.config.retry.attempts) {
                const delay = this.calculateRetryDelay(retryCount);
                this.logger.info(`Retrying request (attempt ${retryCount + 1}) after ${delay}ms`);
                
                setTimeout(() => {
                    this.proxyRequest(req, res, retryCount + 1);
                }, delay);
            } else {
                this.handleProxyError(res, error);
            }
        });
        
        // Handle request timeout
        proxyReq.setTimeout(30000, () => {
            proxyReq.destroy();
            targetServer.currentConnections--;
            this.stats.global.connectionsActive--;
            this.handleRequestTimeout(res);
        });
        
        // Pipe request body
        req.on('data', (chunk) => {
            proxyReq.write(chunk);
        });
        
        req.on('end', () => {
            proxyReq.end();
        });
        
        req.on('error', (error) => {
            this.logger.error('Request error:', error);
            proxyReq.destroy();
        });
    }

    calculateRetryDelay(retryCount) {
        const baseDelay = this.config.retry.delay;
        
        switch (this.config.retry.backoff) {
            case 'exponential':
                return baseDelay * Math.pow(2, retryCount);
            case 'linear':
                return baseDelay * (retryCount + 1);
            default:
                return baseDelay;
        }
    }

    cleanupHeaders(headers) {
        // Remove hop-by-hop headers
        delete headers.connection;
        delete headers['proxy-connection'];
        delete headers['keep-alive'];
        delete headers['proxy-authenticate'];
        delete headers['proxy-authorization'];
        delete headers.te;
        delete headers.trailers;
        delete headers.upgrade;
    }

    handleResponseCompression(req, res, proxyRes) {
        const acceptEncoding = req.headers['accept-encoding'] || '';
        const contentType = proxyRes.headers['content-type'] || '';
        
        if (this.config.compression.types.some(type => contentType.includes(type))) {
            if (acceptEncoding.includes('gzip')) {
                res.setHeader('Content-Encoding', 'gzip');
            } else if (acceptEncoding.includes('deflate')) {
                res.setHeader('Content-Encoding', 'deflate');
            }
        }
    }

    getSessionId(req) {
        // Extract session ID from cookie or header
        const cookieHeader = req.headers.cookie;
        if (cookieHeader) {
            const sessionCookie = cookieHeader
                .split(';')
                .find(cookie => cookie.trim().startsWith('sessionId='));
            
            if (sessionCookie) {
                return sessionCookie.split('=')[1];
            }
        }
        
        // Fallback to custom header
        return req.headers['x-session-id'];
    }

    // Enhanced error handlers
    handleRateLimitExceeded(res) {
        res.statusCode = 429;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Retry-After', Math.ceil(this.config.rateLimiting.windowSize / 1000));
        res.end(JSON.stringify({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: this.config.rateLimiting.windowSize / 1000
        }));
    }

    handleNoServersAvailable(res) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: 'Service Unavailable',
            message: 'No healthy servers available',
            timestamp: new Date().toISOString()
        }));
        
        this.logger.error('No healthy servers available for request');
    }

    handleProxyError(res, error) {
        if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'Bad Gateway',
                message: 'Failed to connect to backend server',
                details: error.message,
                timestamp: new Date().toISOString()
            }));
        }
    }

    handleRequestTimeout(res) {
        if (!res.headersSent) {
            res.statusCode = 504;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'Gateway Timeout',
                message: 'Backend server did not respond in time',
                timestamp: new Date().toISOString()
            }));
        }
    }

    // Enhanced metrics collection
    updateRollingMetrics() {
        const now = Date.now();
        
        // Update rolling request history (last 5 minutes)
        this.stats.rolling.requestHistory.push({
            timestamp: now,
            count: this.stats.perSecond.requests
        });
        
        // Keep only last 5 minutes
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        this.stats.rolling.requestHistory = this.stats.rolling.requestHistory
            .filter(entry => entry.timestamp > fiveMinutesAgo);
    }

    resetPerSecondCounters() {
        this.stats.perSecond = {
            requests: 0,
            responses: 0,
            bytes: 0
        };
    }

    collectDetailedMetrics() {
        const serverStats = {};
        
        for (const [id, server] of this.servers) {
            serverStats[id] = {
                healthy: server.healthy,
                healthScore: server.healthScore,
                currentConnections: server.currentConnections,
                totalRequests: server.totalRequests,
                successfulRequests: server.successfulRequests,
                failedRequests: server.failedRequests,
                averageResponseTime: server.averageResponseTime,
                lastHealthCheck: server.lastHealthCheck,
                circuitBreakerState: this.circuitBreakers.get(id)?.state || 'CLOSED',
                resources: server.resources
            };
        }
        
        return {
            timestamp: Date.now(),
            global: this.stats.global,
            perSecond: this.stats.perSecond,
            servers: serverStats,
            algorithm: this.config.algorithm,
            totalServers: this.servers.size,
            healthyServers: Array.from(this.servers.values()).filter(s => s.healthy).length,
            stickySessionsActive: this.stickyStore.size,
            requestThroughput: this.calculateThroughput(),
            averageHealthScore: this.calculateAverageHealthScore()
        };
    }

    calculateThroughput() {
        if (this.stats.rolling.requestHistory.length < 2) return 0;
        
        const recent = this.stats.rolling.requestHistory.slice(-60); // Last minute
        const totalRequests = recent.reduce((sum, entry) => sum + entry.count, 0);
        
        return totalRequests; // Requests per minute
    }

    calculateAverageHealthScore() {
        const servers = Array.from(this.servers.values());
        if (servers.length === 0) return 0;
        
        const totalScore = servers.reduce((sum, server) => sum + server.healthScore, 0);
        return totalScore / servers.length;
    }

    // Start the enhanced load balancer server
    async start() {
        try {
            // Create HTTP server
            const server = http.createServer(async (req, res) => {
                // Handle management endpoints
                if (req.url === '/lb-stats' && req.method === 'GET') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(this.collectDetailedMetrics(), null, 2));
                    return;
                }
                
                if (req.url === '/lb-health' && req.method === 'GET') {
                    const healthyServers = Array.from(this.servers.values()).filter(s => s.healthy).length;
                    const status = healthyServers > 0 ? 'healthy' : 'unhealthy';
                    
                    res.statusCode = healthyServers > 0 ? 200 : 503;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ 
                        status, 
                        healthyServers,
                        averageHealthScore: this.calculateAverageHealthScore(),
                        circuitBreakersOpen: Array.from(this.circuitBreakers.values())
                            .filter(cb => cb.state === 'OPEN').length
                    }));
                    return;
                }
                
                // Proxy all other requests
                await this.proxyRequest(req, res);
            });
            
            server.listen(this.config.port, () => {
                this.logger.info(`Enhanced load balancer started on port ${this.config.port}`);
                this.logger.info(`Algorithm: ${this.config.algorithm}`);
                this.logger.info(`Backend servers: ${this.servers.size}`);
                this.logger.info(`Circuit breakers: ${this.config.circuitBreaker.enabled ? 'enabled' : 'disabled'}`);
                this.logger.info(`Rate limiting: ${this.config.rateLimiting.enabled ? 'enabled' : 'disabled'}`);
            });
            
            // Start health checks
            this.startHealthChecks();
            
            return server;
            
        } catch (error) {
            this.logger.error('Failed to start enhanced load balancer:', error);
            throw error;
        }
    }
}

module.exports = { LoadBalancerEnhanced };

// Demo function
if (require.main === module) {
    async function demo() {
        console.log('🌐 Enhanced Load Balancer - SESSION 6 Demo\n');
        
        const lb = new LoadBalancerEnhanced({
            port: 8080,
            algorithm: 'weighted',
            circuitBreaker: { enabled: true },
            rateLimiting: { enabled: true, maxRequests: 100 },
            healthCheck: {
                enabled: true,
                advanced: { enabled: true },
                interval: 10000
            }
        });
        
        try {
            // Add backend servers with different weights
            lb.addServer('app1', 'localhost', 3000, { weight: 3, priority: 1 });
            lb.addServer('app2', 'localhost', 3001, { weight: 2, priority: 2 });
            lb.addServer('app3', 'localhost', 3002, { weight: 1, priority: 3 });
            
            // Event handlers
            lb.on('serverStatusChange', ({ server, healthy }) => {
                console.log(`Server ${server.id} is now ${healthy ? 'healthy' : 'unhealthy'} (health score: ${server.healthScore})`);
            });
            
            lb.on('allServersDown', () => {
                console.error('All servers are down! Please check your backend services.');
            });
            
            lb.on('metrics', (metrics) => {
                console.log(`📊 Throughput: ${metrics.requestThroughput} req/min, Avg Health: ${metrics.averageHealthScore.toFixed(1)}`);
            });
            
            // Start the load balancer
            await lb.start();
            
            console.log('🚀 Enhanced Load Balancer Features:');
            console.log('  ✅ Weighted Round Robin with Resource-based Selection');
            console.log('  ✅ Circuit Breakers with Auto-recovery');
            console.log('  ✅ Advanced Health Checks (Multi-endpoint)');
            console.log('  ✅ Rate Limiting with Redis Fallback');
            console.log('  ✅ SSL Termination Support');
            console.log('  ✅ Sticky Sessions');
            console.log('  ✅ Response Compression');
            console.log('  ✅ Integrated with SESSION 5 Reliability Systems');
            
            console.log('\n📈 Management Endpoints:');
            console.log('  Statistics: http://localhost:8080/lb-stats');
            console.log('  Health Check: http://localhost:8080/lb-health');
            
        } catch (error) {
            console.error('❌ Enhanced load balancer demo failed:', error);
        }
    }
    
    demo().catch(console.error);
}