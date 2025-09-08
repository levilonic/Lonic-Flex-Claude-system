const http = require('http');
const https = require('https');
const url = require('url');
const { EventEmitter } = require('events');
const winston = require('winston');

class LoadBalancer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            port: options.port || 3000,
            httpsPort: options.httpsPort || 3443,
            algorithm: options.algorithm || 'round-robin', // round-robin, least-connections, weighted, ip-hash
            healthCheck: {
                enabled: true,
                interval: 30000, // 30 seconds
                timeout: 5000,
                path: '/health',
                expectedStatus: 200
            },
            retry: {
                attempts: 3,
                delay: 1000
            },
            sticky: options.sticky || false,
            ssl: options.ssl || false,
            ...options
        };
        
        this.servers = new Map();
        this.currentIndex = 0;
        this.stickyStore = new Map(); // For sticky sessions
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            bytesTransferred: 0
        };
        
        this.setupLogger();
    }

    setupLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/load-balancer.log' }),
                new winston.transports.Console()
            ]
        });
    }

    // Add a backend server
    addServer(id, host, port, options = {}) {
        const server = {
            id,
            host,
            port,
            weight: options.weight || 1,
            maxConnections: options.maxConnections || 100,
            currentConnections: 0,
            healthy: true,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastHealthCheck: Date.now(),
            ...options
        };
        
        this.servers.set(id, server);
        this.logger.info(`Added server: ${id} (${host}:${port})`);
        
        return server;
    }

    // Remove a backend server
    removeServer(id) {
        if (this.servers.has(id)) {
            this.servers.delete(id);
            this.logger.info(`Removed server: ${id}`);
            return true;
        }
        return false;
    }

    // Get next server based on load balancing algorithm
    getNextServer(clientIp = null, sessionId = null) {
        const healthyServers = Array.from(this.servers.values()).filter(s => s.healthy);
        
        if (healthyServers.length === 0) {
            return null;
        }
        
        switch (this.config.algorithm) {
            case 'round-robin':
                return this.roundRobin(healthyServers);
            case 'least-connections':
                return this.leastConnections(healthyServers);
            case 'weighted':
                return this.weighted(healthyServers);
            case 'ip-hash':
                return this.ipHash(healthyServers, clientIp);
            default:
                return this.roundRobin(healthyServers);
        }
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
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < clientIp.length; i++) {
            const char = clientIp.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        const index = Math.abs(hash) % servers.length;
        return servers[index];
    }

    // Health check for servers
    async healthCheck(server) {
        return new Promise((resolve) => {
            const options = {
                hostname: server.host,
                port: server.port,
                path: this.config.healthCheck.path,
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

    // Start health checking all servers
    startHealthChecks() {
        if (!this.config.healthCheck.enabled) return;

        setInterval(async () => {
            const promises = Array.from(this.servers.values()).map(async (server) => {
                const wasHealthy = server.healthy;
                server.healthy = await this.healthCheck(server);
                server.lastHealthCheck = Date.now();
                
                if (wasHealthy !== server.healthy) {
                    const status = server.healthy ? 'healthy' : 'unhealthy';
                    this.logger.warn(`Server ${server.id} is now ${status}`);
                    this.emit('serverStatusChange', { server, healthy: server.healthy });
                }
            });
            
            await Promise.all(promises);
            
            const healthyCount = Array.from(this.servers.values()).filter(s => s.healthy).length;
            const totalCount = this.servers.size;
            
            if (healthyCount === 0) {
                this.logger.error('All servers are unhealthy!');
                this.emit('allServersDown');
            } else if (healthyCount < totalCount) {
                this.logger.warn(`${totalCount - healthyCount} servers are unhealthy`);
            }
            
        }, this.config.healthCheck.interval);
        
        this.logger.info('Health checks started');
    }

    // Proxy request to backend server
    async proxyRequest(req, res, retryCount = 0) {
        const startTime = Date.now();
        const clientIp = req.connection.remoteAddress || req.headers['x-forwarded-for'];
        
        this.stats.totalRequests++;
        
        // Get session ID for sticky sessions
        const sessionId = this.config.sticky ? this.getSessionId(req) : null;
        
        // Get target server
        let targetServer;
        if (this.config.sticky && sessionId && this.stickyStore.has(sessionId)) {
            const serverId = this.stickyStore.get(sessionId);
            targetServer = this.servers.get(serverId);
            
            // Fallback if sticky server is unhealthy
            if (!targetServer || !targetServer.healthy) {
                targetServer = this.getNextServer(clientIp, sessionId);
                if (targetServer && sessionId) {
                    this.stickyStore.set(sessionId, targetServer.id);
                }
            }
        } else {
            targetServer = this.getNextServer(clientIp, sessionId);
            if (targetServer && sessionId && this.config.sticky) {
                this.stickyStore.set(sessionId, targetServer.id);
            }
        }
        
        if (!targetServer) {
            this.handleNoServersAvailable(res);
            return;
        }
        
        // Update connection count
        targetServer.currentConnections++;
        targetServer.totalRequests++;
        
        // Prepare proxy request
        const proxyOptions = {
            hostname: targetServer.host,
            port: targetServer.port,
            path: req.url,
            method: req.method,
            headers: {
                ...req.headers,
                'X-Forwarded-For': clientIp,
                'X-Forwarded-Proto': req.connection.encrypted ? 'https' : 'http',
                'X-Forwarded-Host': req.headers.host
            }
        };
        
        // Remove hop-by-hop headers
        delete proxyOptions.headers.connection;
        delete proxyOptions.headers['proxy-connection'];
        delete proxyOptions.headers['keep-alive'];
        delete proxyOptions.headers['proxy-authenticate'];
        delete proxyOptions.headers['proxy-authorization'];
        delete proxyOptions.headers.te;
        delete proxyOptions.headers.trailers;
        delete proxyOptions.headers.upgrade;
        
        const proxyReq = http.request(proxyOptions, (proxyRes) => {
            // Copy response headers
            Object.keys(proxyRes.headers).forEach(key => {
                res.setHeader(key, proxyRes.headers[key]);
            });
            
            res.statusCode = proxyRes.statusCode;
            
            // Handle response data
            let responseData = Buffer.alloc(0);
            
            proxyRes.on('data', (chunk) => {
                responseData = Buffer.concat([responseData, chunk]);
                res.write(chunk);
                this.stats.bytesTransferred += chunk.length;
            });
            
            proxyRes.on('end', () => {
                const responseTime = Date.now() - startTime;
                
                // Update statistics
                targetServer.currentConnections--;
                targetServer.successfulRequests++;
                targetServer.averageResponseTime = 
                    (targetServer.averageResponseTime + responseTime) / 2;
                
                this.stats.successfulRequests++;
                this.stats.averageResponseTime = 
                    (this.stats.averageResponseTime + responseTime) / 2;
                
                this.logger.info(`Request completed: ${req.method} ${req.url} -> ${targetServer.id} (${responseTime}ms)`);
                
                res.end();
            });
        });
        
        proxyReq.on('error', (error) => {
            targetServer.currentConnections--;
            targetServer.failedRequests++;
            this.stats.failedRequests++;
            
            this.logger.error(`Proxy request failed to ${targetServer.id}:`, error);
            
            // Retry with different server
            if (retryCount < this.config.retry.attempts) {
                this.logger.info(`Retrying request (attempt ${retryCount + 1})`);
                setTimeout(() => {
                    this.proxyRequest(req, res, retryCount + 1);
                }, this.config.retry.delay);
            } else {
                this.handleProxyError(res, error);
            }
        });
        
        // Handle request timeout
        proxyReq.setTimeout(30000, () => {
            proxyReq.destroy();
            targetServer.currentConnections--;
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

    handleNoServersAvailable(res) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: 'Service Unavailable',
            message: 'No healthy servers available'
        }));
        
        this.logger.error('No healthy servers available for request');
    }

    handleProxyError(res, error) {
        if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'Bad Gateway',
                message: 'Failed to connect to backend server'
            }));
        }
    }

    handleRequestTimeout(res) {
        if (!res.headersSent) {
            res.statusCode = 504;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'Gateway Timeout',
                message: 'Backend server did not respond in time'
            }));
        }
    }

    // Get load balancer statistics
    getStats() {
        const serverStats = {};
        
        for (const [id, server] of this.servers) {
            serverStats[id] = {
                healthy: server.healthy,
                currentConnections: server.currentConnections,
                totalRequests: server.totalRequests,
                successfulRequests: server.successfulRequests,
                failedRequests: server.failedRequests,
                averageResponseTime: server.averageResponseTime,
                lastHealthCheck: server.lastHealthCheck
            };
        }
        
        return {
            global: this.stats,
            servers: serverStats,
            algorithm: this.config.algorithm,
            totalServers: this.servers.size,
            healthyServers: Array.from(this.servers.values()).filter(s => s.healthy).length
        };
    }

    // Start the load balancer server
    start() {
        // Create HTTP server
        const server = http.createServer((req, res) => {
            // Handle stats endpoint
            if (req.url === '/lb-stats' && req.method === 'GET') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(this.getStats(), null, 2));
                return;
            }
            
            // Handle health endpoint
            if (req.url === '/lb-health' && req.method === 'GET') {
                const healthyServers = Array.from(this.servers.values()).filter(s => s.healthy).length;
                const status = healthyServers > 0 ? 'healthy' : 'unhealthy';
                
                res.statusCode = healthyServers > 0 ? 200 : 503;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ status, healthyServers }));
                return;
            }
            
            // Proxy all other requests
            this.proxyRequest(req, res);
        });
        
        server.listen(this.config.port, () => {
            this.logger.info(`Load balancer started on port ${this.config.port}`);
            this.logger.info(`Algorithm: ${this.config.algorithm}`);
            this.logger.info(`Backend servers: ${this.servers.size}`);
        });
        
        // Start health checks
        this.startHealthChecks();
        
        return server;
    }
}

module.exports = { LoadBalancer };

if (require.main === module) {
    // Demo configuration
    const lb = new LoadBalancer({
        port: 8080,
        algorithm: 'round-robin',
        healthCheck: {
            enabled: true,
            interval: 10000,
            timeout: 3000,
            path: '/health'
        }
    });
    
    // Add backend servers
    lb.addServer('app1', 'localhost', 3000, { weight: 2 });
    lb.addServer('app2', 'localhost', 3001, { weight: 1 });
    lb.addServer('app3', 'localhost', 3002, { weight: 1 });
    
    // Event handlers
    lb.on('serverStatusChange', ({ server, healthy }) => {
        console.log(`Server ${server.id} is now ${healthy ? 'healthy' : 'unhealthy'}`);
    });
    
    lb.on('allServersDown', () => {
        console.error('All servers are down! Please check your backend services.');
    });
    
    // Start the load balancer
    const server = lb.start();
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Shutting down load balancer...');
        server.close(() => {
            console.log('Load balancer stopped');
            process.exit(0);
        });
    });
    
    console.log('Load balancer demo started');
    console.log('Statistics available at: http://localhost:8080/lb-stats');
    console.log('Health check available at: http://localhost:8080/lb-health');
}