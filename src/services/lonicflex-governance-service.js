#!/usr/bin/env node
/**
 * LonicFLex Central Governance Service - Window 3 Foundation
 * Enterprise governance, compliance, and policy enforcement
 *
 * Handles:
 * - Role-based access control (RBAC) coordination
 * - Policy enforcement across all workflows
 * - Compliance monitoring and reporting
 * - Audit trail coordination
 * - Permission validation for all operations
 * - Governance dashboard and metrics
 */

const express = require('express');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const winston = require('winston');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class LonicFlexGovernanceService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.GOVERNANCE_PORT || 3030,
            serviceName: 'lonicflex-governance',
            maxConcurrentValidations: config.maxConcurrentValidations || 100,
            auditRetentionDays: config.auditRetentionDays || 2555, // 7 years for compliance
            permissionCacheTimeout: config.permissionCacheTimeout || 300000, // 5 minutes
            complianceReportInterval: config.complianceReportInterval || 86400000, // 24 hours
            ...config
        };

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.contextManager = new Factor3ContextManager();

        // Governance management
        this.policies = new Map();                  // policyId -> policy config
        this.roleHierarchy = new Map();            // role -> parent roles
        this.permissionCache = new Map();          // userId -> cached permissions
        this.activeValidations = new Map();        // validationId -> validation state
        this.auditQueue = [];                      // Pending audit entries

        // Compliance frameworks support
        this.complianceFrameworks = {
            'SOC2': { enabled: true, policies: [], lastAudit: null },
            'GDPR': { enabled: true, policies: [], lastAudit: null },
            'HIPAA': { enabled: false, policies: [], lastAudit: null },
            'PCI-DSS': { enabled: false, policies: [], lastAudit: null }
        };

        // Statistics tracking
        this.stats = {
            totalPermissionChecks: 0,
            deniedPermissions: 0,
            approvedPermissions: 0,
            auditEntriesCreated: 0,
            complianceViolations: 0,
            activeUsers: 0,
            activePolicies: 0,
            systemHealth: 'healthy'
        };

        // Service registry for governance coordination
        this.serviceRegistry = {
            'permissions': { port: 3031, healthy: false, endpoint: '/health' },
            'cost-management': { port: 3032, healthy: false, endpoint: '/health' },
            'billing': { port: 3033, healthy: false, endpoint: '/health' },
            'analytics': { port: 3034, healthy: false, endpoint: '/health' },
            'dashboard': { port: 3035, healthy: false, endpoint: '/health' },
            // Integration with existing services
            'master': { port: 3007, healthy: false, endpoint: '/health' },
            'integration-hub': { port: 3020, healthy: false, endpoint: '/health' }
        };

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.label({ label: 'GovernanceService' })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: './logs/lonicflex-governance.log'
                }),
                new winston.transports.File({
                    filename: './logs/lonicflex-governance-audit.log',
                    level: 'info'
                })
            ]
        });

        this.startTime = new Date();
        this.isInitialized = false;
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // CORS for governance dashboard
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // Request logging with audit trail
        this.app.use((req, res, next) => {
            const requestId = crypto.randomUUID();
            req.requestId = requestId;

            // Log all governance requests for audit
            this.logAuditEvent('api_request', {
                requestId,
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                timestamp: new Date().toISOString()
            });

            next();
        });

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            this.logger.error('Governance service error:', {
                error: error.message,
                stack: error.stack,
                requestId: req.requestId
            });

            // Log security-related errors for compliance
            if (error.message.includes('permission') || error.message.includes('access')) {
                this.logAuditEvent('security_error', {
                    error: error.message,
                    requestId: req.requestId,
                    severity: 'high'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Internal governance service error',
                requestId: req.requestId
            });
        });
    }

    /**
     * Setup Express routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const health = this.getHealthStatus();
            res.status(health.healthy ? 200 : 503).json(health);
        });

        // Governance status and metrics
        this.app.get('/status', (req, res) => {
            res.json({
                service: this.config.serviceName,
                status: 'operational',
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                complianceFrameworks: this.complianceFrameworks,
                lastHealthCheck: new Date().toISOString()
            });
        });

        // Permission validation endpoints
        this.app.post('/validate-permission', async (req, res) => {
            try {
                const { userId, resource, action, context } = req.body;
                const result = await this.validatePermission(userId, resource, action, context);

                this.stats.totalPermissionChecks++;
                if (result.allowed) {
                    this.stats.approvedPermissions++;
                } else {
                    this.stats.deniedPermissions++;
                }

                res.json(result);
            } catch (error) {
                this.logger.error('Permission validation error:', { error: error.message, requestId: req.requestId });
                res.status(500).json({ success: false, error: 'Permission validation failed' });
            }
        });

        // Policy management endpoints
        this.app.get('/policies', async (req, res) => {
            try {
                const policies = await this.getAllPolicies();
                res.json({
            success: this.validateSuccess(),   policies });
            } catch (error) {
                this.logger.error('Policy retrieval error:', { error: error.message });
                res.status(500).json({ success: false, error: 'Failed to retrieve policies' });
            }
        });

        this.app.post('/policies', async (req, res) => {
            try {
                const policy = req.body;
                const result = await this.createPolicy(policy);
                res.json(result);
            } catch (error) {
                this.logger.error('Policy creation error:', { error: error.message });
                res.status(500).json({ success: false, error: 'Failed to create policy' });
            }
        });

        // Compliance reporting endpoints
        this.app.get('/compliance/report/:framework', async (req, res) => {
            try {
                const framework = req.params.framework.toUpperCase();
                const report = await this.generateComplianceReport(framework);
                res.json(report);
            } catch (error) {
                this.logger.error('Compliance report error:', { error: error.message, framework: req.params.framework });
                res.status(500).json({ success: false, error: 'Failed to generate compliance report' });
            }
        });

        // Audit trail endpoints
        this.app.get('/audit-trail', async (req, res) => {
            try {
                const { startDate, endDate, eventType, userId } = req.query;
                const auditTrail = await this.getAuditTrail({ startDate, endDate, eventType, userId });
                res.json(auditTrail);
            } catch (error) {
                this.logger.error('Audit trail retrieval error:', { error: error.message });
                res.status(500).json({ success: false, error: 'Failed to retrieve audit trail' });
            }
        });

        // Governance dashboard data endpoint
        this.app.get('/dashboard-data', async (req, res) => {
            try {
                const dashboardData = await this.getDashboardData();
                res.json(dashboardData);
            } catch (error) {
                this.logger.error('Dashboard data error:', { error: error.message });
                res.status(500).json({ success: false, error: 'Failed to retrieve dashboard data' });
            }
        });

        // Emergency override endpoint (admin only)
        this.app.post('/emergency-override', async (req, res) => {
            try {
                const { userId, justification, duration } = req.body;
                const result = await this.createEmergencyOverride(userId, justification, duration);
                res.json(result);
            } catch (error) {
                this.logger.error('Emergency override error:', { error: error.message });
                res.status(500).json({ success: false, error: 'Emergency override failed' });
            }
        });
    }

    /**
     * Initialize the governance service
     */
    async initialize() {
        try {
            this.logger.info('Initializing LonicFLex Governance Service...');

            // Initialize database
            await this.db.initialize();
            await this.createGovernanceTables();

            // Load initial policies and roles
            await this.loadDefaultPolicies();
            await this.loadRoleHierarchy();

            // Start background tasks
            this.startAuditProcessor();
            this.startComplianceMonitoring();
            this.startServiceHealthMonitoring();

            this.isInitialized = true;
            this.stats.systemHealth = 'healthy';

            this.logger.info('Governance service initialized successfully', {
                port: this.config.port,
                uptime: Date.now() - this.startTime.getTime()
            });

            // Log initialization for audit
            this.logAuditEvent('service_initialized', {
                serviceName: this.config.serviceName,
                port: this.config.port,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            this.logger.error('Governance service initialization failed:', { error: error.message });
            this.stats.systemHealth = 'unhealthy';
            throw error;
        }
    }

    /**
     * Create governance-specific database tables
     */
    async createGovernanceTables() {
        const tables = [
            // User teams and roles
            `CREATE TABLE IF NOT EXISTS user_teams (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                team_id TEXT NOT NULL,
                role TEXT NOT NULL,
                permissions TEXT,  -- JSON array of permissions
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Project budgets and limits
            `CREATE TABLE IF NOT EXISTS project_budgets (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                team_id TEXT,
                monthly_limit DECIMAL(10,2) NOT NULL,
                current_spend DECIMAL(10,2) DEFAULT 0.00,
                alert_threshold DECIMAL(5,2) DEFAULT 0.80,  -- 80% threshold
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Workflow permissions matrix
            `CREATE TABLE IF NOT EXISTS workflow_permissions (
                id TEXT PRIMARY KEY,
                workflow_type TEXT NOT NULL,
                required_roles TEXT,  -- JSON array of required roles
                approval_required BOOLEAN DEFAULT FALSE,
                approval_roles TEXT,  -- JSON array of approver roles
                cost_limit DECIMAL(10,2),
                compliance_requirements TEXT,  -- JSON array of compliance requirements
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Governance policies
            `CREATE TABLE IF NOT EXISTS governance_policies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                policy_type TEXT NOT NULL,  -- 'access', 'cost', 'compliance', 'security'
                rules TEXT NOT NULL,  -- JSON policy rules
                enforcement_level TEXT DEFAULT 'warning',  -- 'blocking', 'warning', 'advisory'
                compliance_frameworks TEXT,  -- JSON array of frameworks
                active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Audit trail for compliance
            `CREATE TABLE IF NOT EXISTS audit_trail (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                user_id TEXT,
                resource TEXT,
                action TEXT,
                outcome TEXT,
                details TEXT,  -- JSON event details
                ip_address TEXT,
                user_agent TEXT,
                request_id TEXT,
                compliance_relevant BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Permission cache for performance
            `CREATE TABLE IF NOT EXISTS permission_cache (
                user_id TEXT PRIMARY KEY,
                permissions TEXT,  -- JSON cached permissions
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            )`
        ];

        for (const table of tables) {
            await this.db.run(table);
        }

        // Create indexes for performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_project_budgets_project_id ON project_budgets(project_id)',
            'CREATE INDEX IF NOT EXISTS idx_workflow_permissions_type ON workflow_permissions(workflow_type)',
            'CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_trail_event_type ON audit_trail(event_type)',
            'CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at)'
        ];

        for (const index of indexes) {
            await this.db.run(index);
        }

        this.logger.info('Governance database tables created successfully');
    }

    /**
     * Validate user permission for a resource/action
     */
    async validatePermission(userId, resource, action, context = {}) {
        const validationId = crypto.randomUUID();
        const startTime = Date.now();

        try {
            this.activeValidations.set(validationId, {
                userId,
                resource,
                action,
                startTime,
                status: 'validating'
            });

            // Check permission cache first
            let permissions = await this.getCachedPermissions(userId);
            if (!permissions) {
                permissions = await this.loadUserPermissions(userId);
                await this.cacheUserPermissions(userId, permissions);
            }

            // Validate permission
            const allowed = this.checkPermissionRules(permissions, resource, action, context);

            // Check if approval required
            const approvalRequired = await this.checkApprovalRequired(permissions, resource, action);

            // Log audit event
            this.logAuditEvent('permission_check', {
                userId,
                resource,
                action,
                allowed,
                approvalRequired,
                context,
                validationId,
                duration: Date.now() - startTime
            });

            this.activeValidations.delete(validationId);

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                allowed,
                approvalRequired,
                validationId,
                permissions: allowed ? permissions.allowed : [],
                restrictions: permissions.restrictions || [],
                context: {
                    userId,
                    resource,
                    action,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.activeValidations.delete(validationId);
            this.logger.error('Permission validation failed:', {
                error: error.message,
                userId,
                resource,
                action,
                validationId
            });

            // Log security event
            this.logAuditEvent('permission_error', {
                userId,
                resource,
                action,
                error: error.message,
                validationId,
                severity: 'high'
            });

            throw error;
        }
    }

    /**
     * Load user permissions from database and role hierarchy
     */
    async loadUserPermissions(userId) {
        const query = `
            SELECT ut.role, ut.permissions, ut.team_id
            FROM user_teams ut
            WHERE ut.user_id = ?
        `;

        const userTeams = await this.db.all(query, [userId]);

        let allPermissions = {
            allowed: [],
            restrictions: [],
            roles: [],
            teams: []
        };

        for (const team of userTeams) {
            allPermissions.roles.push(team.role);
            allPermissions.teams.push(team.team_id);

            // Add role permissions
            if (team.permissions) {
                const permissions = JSON.parse(team.permissions);
                allPermissions.allowed.push(...permissions.allowed || []);
                allPermissions.restrictions.push(...permissions.restrictions || []);
            }
        }

        // Remove duplicates and apply role hierarchy
        allPermissions.allowed = [...new Set(allPermissions.allowed)];
        allPermissions.restrictions = [...new Set(allPermissions.restrictions)];

        return allPermissions;
    }

    /**
     * Check if specific resource/action requires approval
     */
    async checkApprovalRequired(permissions, resource, action) {
        const query = `
            SELECT approval_required, approval_roles
            FROM workflow_permissions
            WHERE workflow_type = ? OR workflow_type = '*'
        `;

        const workflowPerms = await this.db.all(query, [resource]);

        return workflowPerms.some(perm => perm.approval_required);
    }

    /**
     * Generate compliance report for specific framework
     */
    async generateComplianceReport(framework) {
        const reportId = crypto.randomUUID();
        const startTime = Date.now();

        try {
            const report = {
                reportId,
                framework,
                generatedAt: new Date().toISOString(),
                status: 'compliant',
                findings: [],
                metrics: {},
                recommendations: []
            };

            // Get audit trail data for compliance period
            const auditData = await this.getComplianceAuditData(framework);
            report.metrics.totalEvents = auditData.length;

            // Framework-specific compliance checks
            switch (framework) {
                case 'SOC2':
                    report.findings = await this.checkSOC2Compliance(auditData);
                    break;
                case 'GDPR':
                    report.findings = await this.checkGDPRCompliance(auditData);
                    break;
                default:
                    throw new Error(`Unsupported compliance framework: ${framework}`);
            }

            // Calculate compliance score
            const violations = report.findings.filter(f => f.severity === 'high');
            report.metrics.violationCount = violations.length;
            report.metrics.complianceScore = Math.max(0, 100 - (violations.length * 10));

            if (violations.length > 0) {
                report.status = 'non-compliant';
            }

            // Update framework status
            this.complianceFrameworks[framework].lastAudit = new Date();

            // Log compliance report generation
            this.logAuditEvent('compliance_report_generated', {
                framework,
                reportId,
                status: report.status,
                violationCount: violations.length,
                duration: Date.now() - startTime
            });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                report
            };

        } catch (error) {
            this.logger.error('Compliance report generation failed:', {
                error: error.message,
                framework,
                reportId
            });
            throw error;
        }
    }

    /**
     * Log audit event for compliance tracking
     */
    async logAuditEvent(eventType, details) {
        const auditEntry = {
            id: crypto.randomUUID(),
            eventType,
            details: typeof details === 'object' ? JSON.stringify(details) : details,
            timestamp: new Date().toISOString(),
            complianceRelevant: true
        };

        this.auditQueue.push(auditEntry);
        this.stats.auditEntriesCreated++;

        // Log to audit file immediately for critical events
        if (['permission_denied', 'security_error', 'emergency_override'].includes(eventType)) {
            this.logger.info('Critical audit event', auditEntry);
        }
    }

    /**
     * Start audit processor background task
     */
    startAuditProcessor() {
        setInterval(async () => {
            if (this.auditQueue.length > 0) {
                const batch = this.auditQueue.splice(0, 100); // Process in batches

                for (const entry of batch) {
                    try {
                        await this.db.run(
                            `INSERT INTO audit_trail
                             (event_type, details, user_id, resource, action, outcome, request_id, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                entry.eventType,
                                entry.details,
                                entry.userId || null,
                                entry.resource || null,
                                entry.action || null,
                                entry.outcome || null,
                                entry.requestId || null,
                                entry.timestamp
                            ]
                        );
                    } catch (error) {
                        this.logger.error('Failed to write audit entry:', { error: error.message, entry });
                    }
                }
            }
        }, 5000); // Process every 5 seconds
    }

    /**
     * Get service health status
     */
    getHealthStatus() {
        const uptime = Date.now() - this.startTime.getTime();

        return {
            service: this.config.serviceName,
            healthy: this.isInitialized && this.stats.systemHealth === 'healthy',
            uptime,
            stats: this.stats,
            activeValidations: this.activeValidations.size,
            auditQueueSize: this.auditQueue.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Start the governance service
     */
    async start() {
        try {
            await this.initialize();

            this.server = this.app.listen(this.config.port, () => {
                this.logger.info(`LonicFLex Governance Service listening on port ${this.config.port}`, {
                    serviceName: this.config.serviceName,
                    pid: process.pid,
                    nodeVersion: process.version
                });
            });

            // Graceful shutdown handling
            process.on('SIGINT', () => this.shutdown());
            process.on('SIGTERM', () => this.shutdown());

        } catch (error) {
            this.logger.error('Failed to start governance service:', { error: error.message });
            process.exit(1);
        }
    }

    /**
     * Shutdown governance service gracefully
     */
    async shutdown() {
        this.logger.info('Shutting down governance service...');

        // Process remaining audit queue
        if (this.auditQueue.length > 0) {
            this.logger.info(`Processing ${this.auditQueue.length} remaining audit entries...`);
            // Process remaining entries
        }

        if (this.server) {
            this.server.close();
        }

        // Log shutdown for audit
        this.logAuditEvent('service_shutdown', {
            serviceName: this.config.serviceName,
            uptime: Date.now() - this.startTime.getTime(),
            timestamp: new Date().toISOString()
        });

        process.exit(0);
    }

    // Placeholder methods to be implemented
    async getCachedPermissions(userId) { return null; }
    async cacheUserPermissions(userId, permissions) { }
    checkPermissionRules(permissions, resource, action, context) { return true; }
    async loadDefaultPolicies() { }
    async loadRoleHierarchy() { }
    async getAllPolicies() { return []; }
    async createPolicy(policy) { return { success: this.validateSuccess() }; }
    async getAuditTrail(filters) { return []; }
    async getDashboardData() { return {}; }
    async createEmergencyOverride(userId, justification, duration) { return { success: this.validateSuccess() }; }
    async getComplianceAuditData(framework) { return []; }
    async checkSOC2Compliance(data) { return []; }
    async checkGDPRCompliance(data) { return []; }
    startComplianceMonitoring() { }
    startServiceHealthMonitoring() { }
}

// Start service if run directly
if (require.main === module) {
    const service = new LonicFlexGovernanceService();
    service.start().catch(console.error);
}

module.exports = { LonicFlexGovernanceService };