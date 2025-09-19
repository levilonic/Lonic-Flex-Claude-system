/**
 * LonicFLex Governance Middleware - Window 3 Enterprise Integration
 * Universal governance middleware for integration across all LonicFLex services
 *
 * Provides:
 * - Role-based access control (RBAC) enforcement
 * - Policy validation and compliance checking
 * - Audit logging for all governance events
 * - Cost attribution and budget enforcement
 * - Rate limiting and resource controls
 * - Cross-service governance coordination
 * - Compliance reporting and evidence collection
 */

const axios = require('axios');
const crypto = require('crypto');
const winston = require('winston');

class GovernanceMiddleware {
    constructor(config = {}) {
        this.config = {
            governanceServiceUrl: config.governanceServiceUrl || 'http://localhost:3030',
            permissionsServiceUrl: config.permissionsServiceUrl || 'http://localhost:3031',
            costManagementServiceUrl: config.costManagementServiceUrl || 'http://localhost:3032',
            enableAuditLogging: config.enableAuditLogging !== false,
            enableCostTracking: config.enableCostTracking !== false,
            enablePolicyEnforcement: config.enablePolicyEnforcement !== false,
            enableRateLimiting: config.enableRateLimiting !== false,
            requestTimeout: config.requestTimeout || 5000,
            cacheTimeout: config.cacheTimeout || 300000, // 5 minutes
            ...config
        };

        // Caching for performance
        this.permissionsCache = new Map();
        this.policyCache = new Map();
        this.userRoleCache = new Map();
        this.rateLimitCache = new Map();

        // Statistics tracking
        this.stats = {
            requestsProcessed: 0,
            permissionChecks: 0,
            policyViolations: 0,
            auditEventsLogged: 0,
            costTrackingEvents: 0,
            cacheHits: 0,
            cacheMisses: 0,
            rateLimitViolations: 0
        };

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.label({ label: 'GovernanceMiddleware' })
            ),
            transports: [
                new winston.transports.Console({ level: 'info' }),
                new winston.transports.File({
                    filename: './logs/governance-middleware.log'
                })
            ]
        });
    }

    /**
     * Main middleware function for Express applications
     */
    middleware() {
        return async (req, res, next) => {
            const startTime = Date.now();
            const requestId = req.requestId || crypto.randomUUID();

            try {
                // Extract governance context
                const governanceContext = this.extractGovernanceContext(req);

                // Attach governance context to request
                req.governanceContext = governanceContext;
                req.requestId = requestId;

                // Apply governance controls
                const governanceResult = await this.applyGovernanceControls(governanceContext, req, res);

                if (!governanceResult.allowed) {
                    return this.handleGovernanceDenial(governanceResult, res);
                }

                // Track costs if enabled
                if (this.config.enableCostTracking) {
                    await this.trackRequestCost(governanceContext, req);
                }

                // Set up response handling for audit logging
                this.setupResponseHandling(req, res, startTime);

                this.stats.requestsProcessed++;
                next();

            } catch (error) {
                this.logger.error('Governance middleware error:', {
                    requestId,
                    error: error.message,
                    stack: error.stack
                });

                // Don't block requests on governance errors in non-critical mode
                if (this.config.failOpen !== false) {
                    next();
                } else {
                    res.status(503).json({
                        success: false,
                        error: 'Governance service unavailable',
                        requestId
                    });
                }
            }
        };
    }

    /**
     * Extract governance context from request
     */
    extractGovernanceContext(req) {
        return {
            userId: req.headers['x-user-id'] || req.query.userId || null,
            teamId: req.headers['x-team-id'] || req.query.teamId || null,
            roleId: req.headers['x-role-id'] || req.query.roleId || null,
            projectId: req.headers['x-project-id'] || req.query.projectId || null,
            serviceId: req.headers['x-service-id'] || 'unknown',
            sessionId: req.headers['x-session-id'] || null,
            clientId: req.headers['x-client-id'] || null,
            requestPath: req.path,
            requestMethod: req.method,
            requestParams: req.params,
            requestQuery: req.query,
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip || req.connection.remoteAddress,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Apply comprehensive governance controls
     */
    async applyGovernanceControls(context, req, res) {
        const checks = [];

        try {
            // 1. Permission/RBAC check
            if (context.userId && this.config.enablePolicyEnforcement) {
                const permissionCheck = await this.checkPermissions(context);
                checks.push({ type: 'permissions', ...permissionCheck });
            }

            // 2. Rate limiting check
            if (this.config.enableRateLimiting) {
                const rateLimitCheck = await this.checkRateLimit(context);
                checks.push({ type: 'rate_limit', ...rateLimitCheck });
            }

            // 3. Policy compliance check
            if (this.config.enablePolicyEnforcement) {
                const policyCheck = await this.checkPolicyCompliance(context, req);
                checks.push({ type: 'policy', ...policyCheck });
            }

            // 4. Resource access check
            const resourceCheck = await this.checkResourceAccess(context, req);
            checks.push({ type: 'resource', ...resourceCheck });

            // Evaluate all checks
            const overallResult = {
                allowed: checks.every(check => check.allowed),
                checks,
                context,
                timestamp: new Date().toISOString()
            };

            // Log any violations
            const violations = checks.filter(check => !check.allowed);
            if (violations.length > 0) {
                this.stats.policyViolations += violations.length;
                await this.logPolicyViolations(violations, context);
            }

            return overallResult;

        } catch (error) {
            this.logger.error('Governance controls application failed:', {
                context,
                error: error.message
            });

            return {
                allowed: this.config.failOpen !== false,
                error: error.message,
                context
            };
        }
    }

    /**
     * Check user permissions via permissions service
     */
    async checkPermissions(context) {
        try {
            const cacheKey = `permissions:${context.userId}:${context.roleId}:${context.requestPath}:${context.requestMethod}`;

            // Check cache first
            const cached = this.getCachedResult(cacheKey);
            if (cached) {
                this.stats.cacheHits++;
                return cached;
            }

            // Query permissions service
            const response = await axios.post(
                `${this.config.permissionsServiceUrl}/permissions/check`,
                {
                    userId: context.userId,
                    roleId: context.roleId,
                    resource: context.requestPath,
                    action: context.requestMethod.toLowerCase(),
                    context: {
                        teamId: context.teamId,
                        projectId: context.projectId,
                        serviceId: context.serviceId
                    }
                },
                { timeout: this.config.requestTimeout }
            );

            const result = {
                allowed: response.data.allowed,
                permissions: response.data.permissions,
                reason: response.data.reason,
                roleId: context.roleId
            };

            // Cache result
            this.setCachedResult(cacheKey, result);
            this.stats.permissionChecks++;
            this.stats.cacheMisses++;

            return result;

        } catch (error) {
            this.logger.error('Permission check failed:', {
                context,
                error: error.message
            });

            return {
                allowed: this.config.failOpen !== false,
                error: error.message
            };
        }
    }

    /**
     * Check rate limits
     */
    async checkRateLimit(context) {
        try {
            const rateLimitKey = `rate_limit:${context.userId || context.ipAddress}:${context.serviceId}`;
            const now = Date.now();
            const windowMs = 60000; // 1 minute window
            const maxRequests = 100; // Default limit

            const rateLimitData = this.rateLimitCache.get(rateLimitKey) || {
                requests: [],
                windowStart: now
            };

            // Clean old requests outside the window
            rateLimitData.requests = rateLimitData.requests.filter(
                timestamp => now - timestamp < windowMs
            );

            // Check if limit exceeded
            if (rateLimitData.requests.length >= maxRequests) {
                this.stats.rateLimitViolations++;
                return {
                    allowed: false,
                    reason: 'Rate limit exceeded',
                    limit: maxRequests,
                    remaining: 0,
                    resetTime: rateLimitData.windowStart + windowMs
                };
            }

            // Add current request
            rateLimitData.requests.push(now);
            this.rateLimitCache.set(rateLimitKey, rateLimitData);

            return {
                allowed: true,
                limit: maxRequests,
                remaining: maxRequests - rateLimitData.requests.length,
                resetTime: rateLimitData.windowStart + windowMs
            };

        } catch (error) {
            this.logger.error('Rate limit check failed:', error);
            return {
                allowed: this.config.failOpen !== false,
                error: error.message
            };
        }
    }

    /**
     * Check policy compliance
     */
    async checkPolicyCompliance(context, req) {
        try {
            const response = await axios.post(
                `${this.config.governanceServiceUrl}/policies/validate`,
                {
                    context,
                    requestData: {
                        method: req.method,
                        path: req.path,
                        headers: this.sanitizeHeaders(req.headers),
                        body: this.sanitizeBody(req.body)
                    }
                },
                { timeout: this.config.requestTimeout }
            );

            return {
                allowed: response.data.compliant,
                policies: response.data.policies,
                violations: response.data.violations,
                score: response.data.complianceScore
            };

        } catch (error) {
            this.logger.error('Policy compliance check failed:', error);
            return {
                allowed: this.config.failOpen !== false,
                error: error.message
            };
        }
    }

    /**
     * Check resource access permissions
     */
    async checkResourceAccess(context, req) {
        // Basic resource access check
        // This can be extended with more sophisticated logic

        const sensitiveEndpoints = ['/admin', '/config', '/secrets'];
        const requiresHighPrivileges = sensitiveEndpoints.some(endpoint =>
            context.requestPath.startsWith(endpoint)
        );

        if (requiresHighPrivileges && !context.roleId?.includes('admin')) {
            return {
                allowed: false,
                reason: 'Insufficient privileges for sensitive resource'
            };
        }

        return {
            allowed: true,
            reason: 'Resource access granted'
        };
    }

    /**
     * Track request costs
     */
    async trackRequestCost(context, req) {
        try {
            // Estimate request cost based on various factors
            const estimatedCost = this.estimateRequestCost(context, req);

            await axios.post(
                `${this.config.costManagementServiceUrl}/track-cost`,
                {
                    entityType: 'user',
                    entityId: context.userId,
                    cost: estimatedCost,
                    context: {
                        serviceId: context.serviceId,
                        endpoint: context.requestPath,
                        method: context.requestMethod,
                        timestamp: context.timestamp
                    }
                },
                { timeout: this.config.requestTimeout }
            );

            this.stats.costTrackingEvents++;

        } catch (error) {
            this.logger.error('Cost tracking failed:', error);
        }
    }

    /**
     * Estimate request cost
     */
    estimateRequestCost(context, req) {
        // Basic cost estimation logic
        let baseCost = 0.001; // Base cost per request

        // Adjust based on method complexity
        const methodMultipliers = {
            'GET': 1,
            'POST': 2,
            'PUT': 2,
            'DELETE': 1.5,
            'PATCH': 1.5
        };

        baseCost *= methodMultipliers[context.requestMethod] || 1;

        // Adjust based on payload size
        if (req.body) {
            const payloadSize = JSON.stringify(req.body).length;
            baseCost += payloadSize * 0.000001; // Small cost per byte
        }

        return baseCost;
    }

    /**
     * Handle governance denial
     */
    handleGovernanceDenial(governanceResult, res) {
        const deniedChecks = governanceResult.checks.filter(check => !check.allowed);

        const response = {
            success: false,
            error: 'Governance controls denied access',
            violations: deniedChecks,
            timestamp: new Date().toISOString()
        };

        // Determine appropriate HTTP status code
        let statusCode = 403; // Forbidden by default

        if (deniedChecks.some(check => check.type === 'permissions')) {
            statusCode = 401; // Unauthorized
        } else if (deniedChecks.some(check => check.type === 'rate_limit')) {
            statusCode = 429; // Too Many Requests
        }

        res.status(statusCode).json(response);
    }

    /**
     * Setup response handling for audit logging
     */
    setupResponseHandling(req, res, startTime) {
        const originalSend = res.send;

        res.send = function(data) {
            const duration = Date.now() - startTime;

            // Log audit event (async, don't block response)
            setImmediate(() => {
                this.logAuditEvent(req, res, data, duration).catch(error => {
                    this.logger.error('Audit logging failed:', error);
                });
            });

            // Call original send
            return originalSend.call(this, data);
        }.bind(this);
    }

    /**
     * Log audit event
     */
    async logAuditEvent(req, res, responseData, duration) {
        if (!this.config.enableAuditLogging) return;

        try {
            const auditEvent = {
                requestId: req.requestId,
                context: req.governanceContext,
                request: {
                    method: req.method,
                    path: req.path,
                    headers: this.sanitizeHeaders(req.headers),
                    body: this.sanitizeBody(req.body)
                },
                response: {
                    statusCode: res.statusCode,
                    headers: this.sanitizeHeaders(res.getHeaders()),
                    body: this.sanitizeBody(responseData)
                },
                duration,
                timestamp: new Date().toISOString()
            };

            // Send to governance service for audit logging
            await axios.post(
                `${this.config.governanceServiceUrl}/audit/log`,
                auditEvent,
                { timeout: this.config.requestTimeout }
            );

            this.stats.auditEventsLogged++;

        } catch (error) {
            this.logger.error('Audit event logging failed:', error);
        }
    }

    /**
     * Log policy violations
     */
    async logPolicyViolations(violations, context) {
        try {
            for (const violation of violations) {
                await axios.post(
                    `${this.config.governanceServiceUrl}/violations/log`,
                    {
                        violationType: violation.type,
                        violation,
                        context,
                        timestamp: new Date().toISOString()
                    },
                    { timeout: this.config.requestTimeout }
                );
            }
        } catch (error) {
            this.logger.error('Policy violation logging failed:', error);
        }
    }

    /**
     * Get cached result
     */
    getCachedResult(key) {
        const cached = this.permissionsCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    /**
     * Set cached result
     */
    setCachedResult(key, data) {
        this.permissionsCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Sanitize headers for logging (remove sensitive data)
     */
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

        sensitiveHeaders.forEach(header => {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    /**
     * Sanitize request/response body for logging
     */
    sanitizeBody(data) {
        if (!data) return null;

        try {
            const sanitized = JSON.parse(JSON.stringify(data));

            // Remove sensitive fields
            const sensitiveFields = ['password', 'token', 'key', 'secret'];
            this.recursiveSanitize(sanitized, sensitiveFields);

            return sanitized;
        } catch (error) {
            return '[NON_JSON_DATA]';
        }
    }

    /**
     * Recursively sanitize object
     */
    recursiveSanitize(obj, sensitiveFields) {
        if (typeof obj !== 'object' || obj === null) return;

        for (const key in obj) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object') {
                this.recursiveSanitize(obj[key], sensitiveFields);
            }
        }
    }

    /**
     * Get middleware statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.permissionsCache.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Clear caches (for maintenance)
     */
    clearCaches() {
        this.permissionsCache.clear();
        this.policyCache.clear();
        this.userRoleCache.clear();
        this.rateLimitCache.clear();
    }
}

// Convenience function to create middleware with config
function createGovernanceMiddleware(config) {
    const middleware = new GovernanceMiddleware(config);
    return middleware.middleware();
}

module.exports = {
    GovernanceMiddleware,
    createGovernanceMiddleware
};