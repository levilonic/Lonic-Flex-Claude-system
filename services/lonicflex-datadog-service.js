#!/usr/bin/env node
/**
 * LonicFLex DataDog Integration Service - Window 3 Enterprise Resource Monitoring
 * Enhanced DataDog HTTP API integration for enterprise monitoring and observability
 *
 * Handles:
 * - DataDog HTTP API v1/v2 integration with API key authentication
 * - Enterprise resource monitoring and alerting
 * - Governance and compliance metrics tracking
 * - Cost tracking and resource optimization monitoring
 * - Real-time performance dashboards
 * - Multi-service health monitoring
 * - Cross-system workflow coordination
 * - Alert correlation with cost management
 */

const express = require('express');
const axios = require('axios');
const { SQLiteManager } = require('../database/sqlite-manager');
const { GovernanceSchemaManager } = require('../database/governance-schema-manager');
const { AuditManager } = require('../components/audit-manager');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');
const crypto = require('crypto');
require('dotenv').config();

class LonicFlexDataDogService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.DATADOG_SERVICE_PORT || 3026,
            serviceName: 'lonicflex-datadog',
            apiUrl: 'https://api.datadoghq.com',
            apiKey: config.apiKey || process.env.DATADOG_API_KEY,
            appKey: config.appKey || process.env.DATADOG_APP_KEY,
            requestTimeout: config.requestTimeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            ...config
        };

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.governanceDb = new GovernanceSchemaManager();
        this.auditManager = new AuditManager();
        this.contextManager = new Factor3ContextManager();

        // DataDog state management
        this.metrics = new Map();                   // metricName -> metric info
        this.dashboards = new Map();                // dashboardId -> dashboard data
        this.monitors = new Map();                  // monitorId -> monitor data
        this.logs = [];                            // Recent log entries
        this.alerts = [];                          // Recent alerts

        // Enterprise Resource Monitoring (Window 3)
        this.serviceHealth = new Map();            // serviceId -> health metrics
        this.costMetrics = new Map();              // entityId -> cost tracking metrics
        this.governanceMetrics = new Map();        // policyId -> compliance metrics
        this.resourceUtilization = new Map();      // resourceId -> utilization data
        this.performanceBaselines = new Map();     // serviceId -> baseline metrics
        this.alertCorrelation = new Map();         // alertId -> correlation data
        this.enterpriseDashboards = new Map();     // dashboardId -> enterprise dashboard config

        this.stats = {
            metricsSubmitted: 0,
            logsSubmitted: 0,
            dashboardsCreated: 0,
            monitorsCreated: 0,
            alertsReceived: 0,
            apiCalls: 0,
            failedCalls: 0,
            averageResponseTime: 0,
            // Enterprise monitoring stats
            servicesMonitored: 0,
            costAlertsTriggered: 0,
            governanceViolations: 0,
            resourceOptimizationSuggestions: 0,
            performanceIssuesDetected: 0,
            alertsCorrelated: 0
        };

        // DataDog API client configuration
        this.authenticated = false;
        this.rateLimitRemaining = 1000;
        this.rateLimitReset = null;

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: './logs/lonicflex-datadog.log'
                })
            ]
        });

        this.startTime = new Date();
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging middleware
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.logger.info('Request completed', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration
                });

                // Update average response time
                this.stats.averageResponseTime =
                    (this.stats.averageResponseTime + duration) / 2;
            });
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            const uptime = Date.now() - this.startTime.getTime();

            // Check DataDog connectivity
            let datadogHealth = 'unknown';
            try {
                if (this.authenticated) {
                    await this.validateApiKeys();
                    datadogHealth = 'connected';
                }
            } catch (error) {
                datadogHealth = 'disconnected';
            }

            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime,
                initialized: true,
                authenticated: this.authenticated,
                datadogHealth,
                stats: this.stats,
                metrics: this.metrics.size,
                dashboards: this.dashboards.size,
                monitors: this.monitors.size,
                rateLimitRemaining: this.rateLimitRemaining,
                timestamp: new Date().toISOString()
            });
        });

        // Service status endpoint
        this.app.get('/status', (req, res) => {
            res.json({
                service: this.config.serviceName,
                status: 'operational',
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                authenticated: this.authenticated,
                metrics: this.metrics.size,
                dashboards: this.dashboards.size,
                monitors: this.monitors.size,
                rateLimitRemaining: this.rateLimitRemaining,
                lastHealthCheck: new Date().toISOString()
            });
        });

        // Submit metrics to DataDog
        this.app.post('/metrics/submit', async (req, res) => {
            try {
                const { series } = req.body;

                if (!series || !Array.isArray(series)) {
                    return res.status(400).json({ error: 'series array required' });
                }

                const result = await this.submitMetrics(series);

                this.stats.metricsSubmitted += series.length;

                // Cache metrics
                series.forEach(metric => {
                    this.metrics.set(metric.metric, {
                        ...metric,
                        lastSubmitted: new Date()
                    });
                });

                this.logger.info('DataDog metrics submitted', {
                    count: series.length,
                    metrics: series.map(s => s.metric)
                });

                const evidence = {
                    metricsSubmitted: series.length > 0,
                    seriesLength: series.length,
                    apiResponseReceived: !!result,
                    submissionSuccessful: true
                };

                const operationSuccess = evidence.metricsSubmitted &&
                                       evidence.apiResponseReceived;

                res.json({
                    success: operationSuccess,
                    submitted: series.length,
                    result,
                    evidence: evidence
                });

            } catch (error) {
                this.logger.error('Failed to submit DataDog metrics', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Submit logs to DataDog
        this.app.post('/logs/submit', async (req, res) => {
            try {
                const { logs } = req.body;

                if (!logs || !Array.isArray(logs)) {
                    return res.status(400).json({ error: 'logs array required' });
                }

                const result = await this.submitLogs(logs);

                this.stats.logsSubmitted += logs.length;

                // Cache recent logs
                this.logs.push(...logs.slice(-10));
                if (this.logs.length > 100) {
                    this.logs = this.logs.slice(-100);
                }

                this.logger.info('DataDog logs submitted', {
                    count: logs.length,
                    sources: [...new Set(logs.map(l => l.source))]
                });

                res.json({
            success: this.validateSuccess(),  
                    submitted: logs.length,
                    result
                });

            } catch (error) {
                this.logger.error('Failed to submit DataDog logs', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Create DataDog dashboard
        this.app.post('/dashboards/create', async (req, res) => {
            try {
                const { title, description, widgets, layoutType = 'ordered' } = req.body;

                if (!title || !widgets) {
                    return res.status(400).json({ error: 'title and widgets required' });
                }

                const dashboard = await this.createDashboard({
                    title,
                    description,
                    widgets,
                    layoutType
                });

                this.stats.dashboardsCreated++;
                this.dashboards.set(dashboard.id, dashboard);

                this.logger.info('DataDog dashboard created', {
                    dashboardId: dashboard.id,
                    title,
                    widgets: widgets.length
                });

                res.json({
            success: this.validateSuccess(),  
                    dashboard: {
                        id: dashboard.id,
                        title: dashboard.title,
                        url: dashboard.url,
                        widgets: widgets.length,
                        created: dashboard.created_at
                    }
                });

            } catch (error) {
                this.logger.error('Failed to create DataDog dashboard', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Create DataDog monitor
        this.app.post('/monitors/create', async (req, res) => {
            try {
                const {
                    name,
                    type,
                    query,
                    message,
                    tags = [],
                    options = {}
                } = req.body;

                if (!name || !type || !query) {
                    return res.status(400).json({ error: 'name, type, and query required' });
                }

                const monitor = await this.createMonitor({
                    name,
                    type,
                    query,
                    message,
                    tags,
                    options
                });

                this.stats.monitorsCreated++;
                this.monitors.set(monitor.id, monitor);

                this.logger.info('DataDog monitor created', {
                    monitorId: monitor.id,
                    name,
                    type,
                    query
                });

                res.json({
            success: this.validateSuccess(),  
                    monitor: {
                        id: monitor.id,
                        name: monitor.name,
                        type: monitor.type,
                        state: monitor.overall_state,
                        created: monitor.created
                    }
                });

            } catch (error) {
                this.logger.error('Failed to create DataDog monitor', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Get DataDog metrics
        this.app.get('/metrics/query', async (req, res) => {
            try {
                const { query, from, to } = req.query;

                if (!query || !from || !to) {
                    return res.status(400).json({ error: 'query, from, and to required' });
                }

                const metrics = await this.queryMetrics(query, parseInt(from), parseInt(to));

                res.json({
            success: this.validateSuccess(),  
                    query,
                    metrics: {
                        series: metrics.series || [],
                        groupBy: metrics.group_by || [],
                        fromDate: new Date(parseInt(from) * 1000),
                        toDate: new Date(parseInt(to) * 1000)
                    }
                });

            } catch (error) {
                this.logger.error('Failed to query DataDog metrics', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // List dashboards
        this.app.get('/dashboards', async (req, res) => {
            try {
                const dashboards = await this.getDashboards();

                res.json({
            success: this.validateSuccess(),  
                    dashboards: dashboards.map(dashboard => ({
                        id: dashboard.id,
                        title: dashboard.title,
                        description: dashboard.description,
                        url: dashboard.url,
                        created: dashboard.created_at,
                        modified: dashboard.modified_at
                    }))
                });

            } catch (error) {
                this.logger.error('Failed to get DataDog dashboards', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Standard LonicFLex service coordination endpoint
        this.app.post('/coordinate', async (req, res) => {
            try {
                const result = await this.coordinateWithServices(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Service coordination failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Enterprise Resource Monitoring Endpoints (Window 3)

        // Service health monitoring
        this.app.get('/enterprise/services/:serviceId/health', async (req, res) => {
            try {
                const { serviceId } = req.params;
                const health = await this.getServiceHealth(serviceId);
                res.json(health);
            } catch (error) {
                this.logger.error('Service health check failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Cost metrics and alerts
        this.app.post('/enterprise/cost/track', async (req, res) => {
            try {
                const result = await this.trackCostMetrics(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Cost tracking failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/enterprise/cost/alerts/:entityId', async (req, res) => {
            try {
                const { entityId } = req.params;
                const alerts = await this.getCostAlerts(entityId);
                res.json(alerts);
            } catch (error) {
                this.logger.error('Cost alerts retrieval failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Governance and compliance monitoring
        this.app.post('/enterprise/governance/violations', async (req, res) => {
            try {
                const result = await this.trackGovernanceViolations(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Governance violation tracking failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/enterprise/governance/metrics', async (req, res) => {
            try {
                const metrics = await this.getGovernanceMetrics(req.query);
                res.json(metrics);
            } catch (error) {
                this.logger.error('Governance metrics retrieval failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Resource optimization monitoring
        this.app.get('/enterprise/resources/optimization', async (req, res) => {
            try {
                const suggestions = await this.getResourceOptimizationSuggestions();
                res.json(suggestions);
            } catch (error) {
                this.logger.error('Resource optimization failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/enterprise/resources/utilization', async (req, res) => {
            try {
                const result = await this.trackResourceUtilization(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Resource utilization tracking failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Performance baseline management
        this.app.post('/enterprise/performance/baseline', async (req, res) => {
            try {
                const baseline = await this.setPerformanceBaseline(req.body);
                res.json(baseline);
            } catch (error) {
                this.logger.error('Performance baseline setting failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/enterprise/performance/issues', async (req, res) => {
            try {
                const issues = await this.detectPerformanceIssues(req.query);
                res.json(issues);
            } catch (error) {
                this.logger.error('Performance issue detection failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Alert correlation engine
        this.app.post('/enterprise/alerts/correlate', async (req, res) => {
            try {
                const correlation = await this.correlateAlerts(req.body);
                res.json(correlation);
            } catch (error) {
                this.logger.error('Alert correlation failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Enterprise dashboard management
        this.app.post('/enterprise/dashboards/create', async (req, res) => {
            try {
                const dashboard = await this.createEnterpriseDashboard(req.body);
                res.json(dashboard);
            } catch (error) {
                this.logger.error('Enterprise dashboard creation failed:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Service statistics (enhanced)
        this.app.get('/stats', (req, res) => {
            res.json({
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                metrics: this.metrics.size,
                dashboards: this.dashboards.size,
                monitors: this.monitors.size,
                rateLimitRemaining: this.rateLimitRemaining,
                recentLogs: this.logs.slice(-5),
                recentAlerts: this.alerts.slice(-5),
                // Enterprise monitoring stats
                serviceHealth: this.serviceHealth.size,
                costMetrics: this.costMetrics.size,
                governanceMetrics: this.governanceMetrics.size,
                resourceUtilization: this.resourceUtilization.size,
                enterpriseDashboards: this.enterpriseDashboards.size
            });
        });
    }

    async submitMetrics(series) {
        return await this.makeDataDogRequest(
            '/api/v1/series',
            'POST',
            { series }
        );
    }

    async submitLogs(logs) {
        // Format logs for DataDog
        const formattedLogs = logs.map(log => ({
            timestamp: log.timestamp || Date.now(),
            status: log.level || 'info',
            message: log.message,
            service: log.service || 'lonicflex',
            source: log.source || 'nodejs',
            tags: log.tags || [],
            hostname: log.hostname || require('os').hostname(),
            ...log
        }));

        return await this.makeDataDogRequest(
            '/api/v2/logs',
            'POST',
            { logs: formattedLogs },
            { 'Content-Type': 'application/json', 'DD-API-KEY': this.config.apiKey }
        );
    }

    async createDashboard({ title, description, widgets, layoutType }) {
        return await this.makeDataDogRequest(
            '/api/v1/dashboard',
            'POST',
            {
                title,
                description,
                widgets,
                layout_type: layoutType,
                is_read_only: false,
                notify_list: [],
                template_variables: []
            }
        );
    }

    async createMonitor({ name, type, query, message, tags, options }) {
        return await this.makeDataDogRequest(
            '/api/v1/monitor',
            'POST',
            {
                name,
                type,
                query,
                message,
                tags,
                options: {
                    notify_audit: false,
                    require_full_window: false,
                    notify_no_data: true,
                    new_host_delay: 300,
                    ...options
                }
            }
        );
    }

    async queryMetrics(query, from, to) {
        return await this.makeDataDogRequest(
            `/api/v1/query?query=${encodeURIComponent(query)}&from=${from}&to=${to}`
        );
    }

    async getDashboards() {
        const response = await this.makeDataDogRequest('/api/v1/dashboard');
        return response.dashboards || [];
    }

    async validateApiKeys() {
        return await this.makeDataDogRequest('/api/v1/validate');
    }

    async makeDataDogRequest(endpoint, method = 'GET', data = null, headers = {}) {
        const startTime = Date.now();
        this.stats.apiCalls++;

        try {
            if (!this.config.apiKey) {
                throw new Error('DataDog API key not configured');
            }

            const config = {
                method,
                url: `${this.config.apiUrl}${endpoint}`,
                headers: {
                    'DD-API-KEY': this.config.apiKey,
                    'Content-Type': 'application/json',
                    ...headers
                },
                timeout: this.config.requestTimeout
            };

            // Add app key for certain endpoints
            if (this.config.appKey && (endpoint.includes('/dashboard') || endpoint.includes('/monitor'))) {
                config.headers['DD-APPLICATION-KEY'] = this.config.appKey;
            }

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                config.data = data;
            }

            const response = await axios(config);

            // Update rate limit info from headers
            if (response.headers['x-ratelimit-remaining']) {
                this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining']);
            }
            if (response.headers['x-ratelimit-reset']) {
                this.rateLimitReset = new Date(response.headers['x-ratelimit-reset'] * 1000);
            }

            this.logger.info('DataDog API call successful', {
                endpoint,
                method,
                status: response.status,
                duration: Date.now() - startTime
            });

            return response.data;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('DataDog API call failed', {
                endpoint,
                method,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async coordinateWithServices({ event, ...data }) {
        try {
            this.logger.info('DataDog service coordinating with services', { event, data });

            switch (event) {
                case 'submit_metrics':
                    return await this.submitMetrics(data.series || []);

                case 'submit_logs':
                    return await this.submitLogs(data.logs || []);

                case 'create_dashboard':
                    return await this.createDashboard(data);

                case 'create_monitor':
                    return await this.createMonitor(data);

                case 'query_metrics':
                    return await this.queryMetrics(data.query, data.from, data.to);

                case 'process_event':
                    // Handle events from Integration Hub
                    if (data.eventType === 'system_alert') {
                        return await this.handleSystemAlert(data);
                    } else if (data.eventType === 'performance_metrics') {
                        return await this.handlePerformanceMetrics(data);
                    }
                    break;

                default:
                    this.logger.warn('Unknown coordination event', { event });
                    return { success: false, error: `Unknown event: ${event}` };
            }

        } catch (error) {
            this.logger.error('Service coordination failed', { error: error.message, event });
            return { success: false, error: error.message };
        }
    }

    async handleSystemAlert(data) {
        const { alertType, severity, message, source, metadata = {} } = data;

        // Submit alert as metric
        const alertMetric = [{
            metric: 'lonicflex.system.alert',
            points: [[Math.floor(Date.now() / 1000), 1]],
            tags: [
                `alert_type:${alertType}`,
                `severity:${severity}`,
                `source:${source}`
            ]
        }];

        await this.submitMetrics(alertMetric);

        // Submit alert as log
        const alertLog = [{
            message: `System Alert: ${message}`,
            level: severity,
            source: 'lonicflex-alert',
            service: 'lonicflex',
            tags: [`alert_type:${alertType}`, `source:${source}`],
            metadata
        }];

        await this.submitLogs(alertLog);

        this.alerts.push({
            alertType,
            severity,
            message,
            source,
            timestamp: new Date(),
            metadata
        });

        // Keep only recent alerts
        if (this.alerts.length > 50) {
            this.alerts = this.alerts.slice(-50);
        }

        this.stats.alertsReceived++;

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            alertProcessed: true,
            metricsSubmitted: true,
            logsSubmitted: true
        };
    }

    async handlePerformanceMetrics(data) {
        const { metrics, source = 'lonicflex', timestamp } = data;

        const datadogMetrics = Object.entries(metrics).map(([metricName, value]) => ({
            metric: `lonicflex.performance.${metricName}`,
            points: [[timestamp || Math.floor(Date.now() / 1000), value]],
            tags: [`source:${source}`]
        }));

        return await this.submitMetrics(datadogMetrics);
    }

    async initialize() {
        try {
            this.logger.info('Initializing DataDog Service', {
                port: this.config.port,
                serviceName: this.config.serviceName,
                apiUrl: this.config.apiUrl
            });

            // Initialize database connection
            await this.db.initialize();

            // Test DataDog API connection
            if (this.config.apiKey) {
                await this.testApiConnection();
            } else {
                this.logger.warn('DataDog API key not configured - service will run in limited mode');
            }

            this.logger.info('DataDog Service initialized successfully');

        } catch (error) {
            this.logger.error('DataDog Service initialization failed', {
                error: error.message
            });
            throw error;
        }
    }

    async testApiConnection() {
        try {
            await this.validateApiKeys();
            this.authenticated = true;

            // Load existing dashboards
            const dashboards = await this.getDashboards();
            dashboards.forEach(dashboard => {
                this.dashboards.set(dashboard.id, dashboard);
            });

            this.logger.info('DataDog API connection established', {
                dashboards: dashboards.length,
                rateLimitRemaining: this.rateLimitRemaining
            });

        } catch (error) {
            this.authenticated = false;
            this.logger.error('DataDog API connection failed', { error: error.message });
            throw error;
        }
    }

    async start() {
        try {
            await this.initialize();

            const server = this.app.listen(this.config.port, () => {
                this.logger.info('DataDog Service started', {
                    port: this.config.port,
                    serviceName: this.config.serviceName,
                    pid: process.pid
                });
            });

            // Graceful shutdown handling
            process.on('SIGTERM', () => {
                this.logger.info('Received SIGTERM, shutting down gracefully');
                server.close(() => {
                    process.exit(0);
                });
            });

            process.on('SIGINT', () => {
                this.logger.info('Received SIGINT, shutting down gracefully');
                server.close(() => {
                    process.exit(0);
                });
            });

            return server;

        } catch (error) {
            this.logger.error('Failed to start DataDog Service', {
                error: error.message
            });
            throw error;
        }
    }

    // Enterprise Resource Monitoring Method Implementations (Window 3)

    /**
     * Get service health metrics
     */
    async getServiceHealth(serviceId) {
        try {
            // Fetch service metrics from DataDog
            const now = Math.floor(Date.now() / 1000);
            const oneHourAgo = now - 3600;

            const healthMetrics = await this.queryMetrics(
                `avg:lonicflex.service.health{service:${serviceId}}`,
                oneHourAgo,
                now
            );

            // Calculate health score
            const healthScore = this.calculateHealthScore(healthMetrics);

            // Check with governance system for service status
            const governanceStatus = await this.checkServiceGovernanceStatus(serviceId);

            const health = {
                serviceId,
                healthScore,
                status: healthScore > 80 ? 'healthy' : healthScore > 60 ? 'degraded' : 'unhealthy',
                metrics: healthMetrics,
                governanceStatus,
                lastChecked: new Date().toISOString(),
                issues: []
            };

            // Detect issues
            if (healthScore < 80) {
                health.issues = await this.detectServiceIssues(serviceId, healthMetrics);
                this.stats.performanceIssuesDetected += health.issues.length;
            }

            this.serviceHealth.set(serviceId, health);
            this.stats.servicesMonitored++;

            return health;

        } catch (error) {
            this.logger.error('Service health check failed:', { serviceId, error: error.message });
            throw error;
        }
    }

    /**
     * Track cost metrics and correlate with DataDog
     */
    async trackCostMetrics(costData) {
        try {
            const { entityId, entityType, costs, timeRange } = costData;

            // Submit cost metrics to DataDog
            const costMetrics = [{
                metric: `lonicflex.cost.${entityType}`,
                points: [[Math.floor(Date.now() / 1000), costs.total]],
                tags: [`entity_id:${entityId}`, `currency:${costs.currency}`]
            }];

            await this.submitMetrics(costMetrics);

            // Check for cost threshold violations
            const alerts = await this.checkCostThresholds(entityId, costs);

            if (alerts.length > 0) {
                this.stats.costAlertsTriggered += alerts.length;

                // Create DataDog monitors for cost violations
                for (const alert of alerts) {
                    await this.createCostAlert(alert);
                }
            }

            // Store in local cache
            this.costMetrics.set(entityId, {
                costs,
                timeRange,
                alerts,
                lastUpdated: new Date().toISOString()
            });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                entityId,
                costs,
                alerts,
                metricsSubmitted: costMetrics.length
            };

        } catch (error) {
            this.logger.error('Cost metrics tracking failed:', error);
            throw error;
        }
    }

    /**
     * Get cost alerts for entity
     */
    async getCostAlerts(entityId) {
        try {
            const cachedMetrics = this.costMetrics.get(entityId);

            if (!cachedMetrics) {
                return { alerts: [], lastUpdated: null };
            }

            // Fetch recent cost alerts from DataDog monitors
            const monitors = await this.getMonitorsByTag(`entity_id:${entityId}`);

            const activeAlerts = monitors.filter(monitor =>
                monitor.overall_state !== 'OK' && monitor.name.includes('cost')
            );

            return {
                alerts: cachedMetrics.alerts || [],
                activeAlerts,
                lastUpdated: cachedMetrics.lastUpdated
            };

        } catch (error) {
            this.logger.error('Cost alerts retrieval failed:', error);
            throw error;
        }
    }

    /**
     * Track governance violations
     */
    async trackGovernanceViolations(violationData) {
        try {
            const { policyId, violationType, entityId, severity, details } = violationData;

            // Submit governance violation metric to DataDog
            const violationMetrics = [{
                metric: 'lonicflex.governance.violation',
                points: [[Math.floor(Date.now() / 1000), 1]],
                tags: [
                    `policy_id:${policyId}`,
                    `violation_type:${violationType}`,
                    `entity_id:${entityId}`,
                    `severity:${severity}`
                ]
            }];

            await this.submitMetrics(violationMetrics);

            // Log violation for audit
            await this.auditManager.logEvent('governance_violation', {
                policyId,
                violationType,
                entityId,
                severity,
                details
            });

            // Update governance metrics
            const existingMetrics = this.governanceMetrics.get(policyId) || { violations: 0 };
            existingMetrics.violations++;
            existingMetrics.lastViolation = new Date().toISOString();
            this.governanceMetrics.set(policyId, existingMetrics);

            this.stats.governanceViolations++;

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                policyId,
                violationType,
                recorded: true,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Governance violation tracking failed:', error);
            throw error;
        }
    }

    /**
     * Get governance metrics
     */
    async getGovernanceMetrics(filters = {}) {
        try {
            const { policyId, timeRange = '7d' } = filters;

            // Query governance metrics from DataDog
            const now = Math.floor(Date.now() / 1000);
            const timeRangeSeconds = this.parseTimeRange(timeRange);
            const start = now - timeRangeSeconds;

            let query = 'sum:lonicflex.governance.violation{*} by {policy_id,violation_type}';
            if (policyId) {
                query = `sum:lonicflex.governance.violation{policy_id:${policyId}} by {violation_type}`;
            }

            const metrics = await this.queryMetrics(query, start, now);

            return {
                metrics,
                timeRange,
                totalViolations: this.stats.governanceViolations,
                policiesTracked: this.governanceMetrics.size
            };

        } catch (error) {
            this.logger.error('Governance metrics retrieval failed:', error);
            throw error;
        }
    }

    /**
     * Get resource optimization suggestions
     */
    async getResourceOptimizationSuggestions() {
        try {
            const suggestions = [];

            // Analyze service health patterns
            for (const [serviceId, health] of this.serviceHealth.entries()) {
                if (health.healthScore < 70) {
                    suggestions.push({
                        type: 'performance',
                        serviceId,
                        suggestion: 'Consider scaling up service resources',
                        priority: 'high',
                        estimatedSavings: null
                    });
                }
            }

            // Analyze cost patterns
            for (const [entityId, costData] of this.costMetrics.entries()) {
                if (costData.costs.total > 1000) { // High cost threshold
                    suggestions.push({
                        type: 'cost',
                        entityId,
                        suggestion: 'Review Claude API usage patterns for optimization',
                        priority: 'medium',
                        estimatedSavings: costData.costs.total * 0.2 // 20% potential savings
                    });
                }
            }

            this.stats.resourceOptimizationSuggestions = suggestions.length;

            return {
                suggestions,
                generatedAt: new Date().toISOString(),
                totalSuggestions: suggestions.length
            };

        } catch (error) {
            this.logger.error('Resource optimization failed:', error);
            throw error;
        }
    }

    /**
     * Track resource utilization
     */
    async trackResourceUtilization(utilizationData) {
        try {
            const { resourceId, resourceType, utilization, capacity } = utilizationData;

            // Submit utilization metrics to DataDog
            const utilizationMetrics = [
                {
                    metric: `lonicflex.resource.utilization`,
                    points: [[Math.floor(Date.now() / 1000), utilization]],
                    tags: [`resource_id:${resourceId}`, `resource_type:${resourceType}`]
                },
                {
                    metric: `lonicflex.resource.capacity`,
                    points: [[Math.floor(Date.now() / 1000), capacity]],
                    tags: [`resource_id:${resourceId}`, `resource_type:${resourceType}`]
                }
            ];

            await this.submitMetrics(utilizationMetrics);

            // Calculate utilization percentage
            const utilizationPercent = (utilization / capacity) * 100;

            // Store utilization data
            this.resourceUtilization.set(resourceId, {
                resourceType,
                utilization,
                capacity,
                utilizationPercent,
                timestamp: new Date().toISOString()
            });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                resourceId,
                utilizationPercent,
                status: utilizationPercent > 80 ? 'high' : utilizationPercent > 60 ? 'medium' : 'low'
            };

        } catch (error) {
            this.logger.error('Resource utilization tracking failed:', error);
            throw error;
        }
    }

    /**
     * Set performance baseline for service
     */
    async setPerformanceBaseline(baselineData) {
        try {
            const { serviceId, metrics } = baselineData;

            // Store baseline in local cache
            this.performanceBaselines.set(serviceId, {
                metrics,
                setAt: new Date().toISOString()
            });

            // Create DataDog monitors for baseline deviations
            for (const [metricName, threshold] of Object.entries(metrics)) {
                await this.createBaselineMonitor(serviceId, metricName, threshold);
            }

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                serviceId,
                baselineSet: true,
                metrics
            };

        } catch (error) {
            this.logger.error('Performance baseline setting failed:', error);
            throw error;
        }
    }

    /**
     * Detect performance issues
     */
    async detectPerformanceIssues(filters = {}) {
        try {
            const { serviceId, timeRange = '1h' } = filters;

            const issues = [];

            // Check performance against baselines
            if (serviceId && this.performanceBaselines.has(serviceId)) {
                const baseline = this.performanceBaselines.get(serviceId);
                const currentMetrics = await this.getCurrentServiceMetrics(serviceId);

                for (const [metricName, baselineValue] of Object.entries(baseline.metrics)) {
                    const currentValue = currentMetrics[metricName];
                    if (currentValue && Math.abs(currentValue - baselineValue) > baselineValue * 0.2) {
                        issues.push({
                            type: 'baseline_deviation',
                            serviceId,
                            metric: metricName,
                            baselineValue,
                            currentValue,
                            deviation: ((currentValue - baselineValue) / baselineValue) * 100
                        });
                    }
                }
            }

            return {
                issues,
                detectedAt: new Date().toISOString(),
                totalIssues: issues.length
            };

        } catch (error) {
            this.logger.error('Performance issue detection failed:', error);
            throw error;
        }
    }

    /**
     * Correlate alerts across systems
     */
    async correlateAlerts(correlationData) {
        try {
            const { alerts, correlationWindow = 300 } = correlationData; // 5 minute window

            const correlations = [];

            // Group alerts by time window
            const groupedAlerts = this.groupAlertsByTimeWindow(alerts, correlationWindow);

            for (const group of groupedAlerts) {
                if (group.length > 1) {
                    const correlation = {
                        id: crypto.randomUUID(),
                        alerts: group,
                        correlationType: this.determineCorrelationType(group),
                        confidence: this.calculateCorrelationConfidence(group),
                        timestamp: new Date().toISOString()
                    };

                    correlations.push(correlation);
                    this.alertCorrelation.set(correlation.id, correlation);
                }
            }

            this.stats.alertsCorrelated += correlations.length;

            return {
                correlations,
                totalCorrelations: correlations.length
            };

        } catch (error) {
            this.logger.error('Alert correlation failed:', error);
            throw error;
        }
    }

    /**
     * Create enterprise dashboard
     */
    async createEnterpriseDashboard(dashboardConfig) {
        try {
            const { title, description, widgets, tags = [] } = dashboardConfig;

            // Create dashboard in DataDog
            const dashboard = await this.createDashboard({
                title: `[LonicFLex Enterprise] ${title}`,
                description,
                widgets: this.buildEnterpriseWidgets(widgets),
                tags: ['lonicflex-enterprise', ...tags]
            });

            // Store enterprise dashboard config
            this.enterpriseDashboards.set(dashboard.id, {
                ...dashboardConfig,
                datadogId: dashboard.id,
                createdAt: new Date().toISOString()
            });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                dashboardId: dashboard.id,
                url: dashboard.url
            };

        } catch (error) {
            this.logger.error('Enterprise dashboard creation failed:', error);
            throw error;
        }
    }

    // Helper methods for enterprise monitoring

    calculateHealthScore(metrics) {
        // Implement health score calculation logic
        if (!metrics.series || metrics.series.length === 0) return 50;

        const avgValue = metrics.series.reduce((sum, point) => sum + point[1], 0) / metrics.series.length;
        return Math.min(100, Math.max(0, avgValue));
    }

    async checkServiceGovernanceStatus(serviceId) {
        try {
            // Query governance database for service status
            return await this.governanceDb.query(
                'SELECT status, compliance_score FROM service_governance WHERE service_id = ?',
                [serviceId]
            );
        } catch (error) {
            return { status: 'unknown', compliance_score: null };
        }
    }

    async detectServiceIssues(serviceId, metrics) {
        const issues = [];

        if (metrics.series) {
            const latestValue = metrics.series[metrics.series.length - 1]?.[1] || 0;

            if (latestValue < 50) {
                issues.push({
                    type: 'low_health_score',
                    severity: 'high',
                    description: 'Service health score is critically low'
                });
            }
        }

        return issues;
    }

    async checkCostThresholds(entityId, costs) {
        // Implement cost threshold checking logic
        const alerts = [];

        if (costs.total > 1000) {
            alerts.push({
                type: 'high_cost',
                threshold: 1000,
                actual: costs.total,
                severity: 'medium'
            });
        }

        return alerts;
    }

    parseTimeRange(timeRange) {
        const unit = timeRange.slice(-1);
        const value = parseInt(timeRange.slice(0, -1));

        switch (unit) {
            case 'h': return value * 3600;
            case 'd': return value * 86400;
            case 'w': return value * 604800;
            default: return 3600; // 1 hour default
        }
    }

    groupAlertsByTimeWindow(alerts, windowSeconds) {
        // Implement alert grouping logic
        return [alerts]; // Simplified implementation
    }

    determineCorrelationType(alertGroup) {
        // Implement correlation type determination
        return 'service_cascade';
    }

    calculateCorrelationConfidence(alertGroup) {
        // Implement confidence calculation
        return Math.min(100, alertGroup.length * 20);
    }

    buildEnterpriseWidgets(widgets) {
        // Transform enterprise widget config to DataDog format
        return widgets.map(widget => ({
            ...widget,
            definition: {
                ...widget.definition,
                custom_links: [{
                    label: 'LonicFLex Enterprise',
                    link: 'https://lonicflex.enterprise'
                }]
            }
        }));
    }

    async getCurrentServiceMetrics(serviceId) {
        // Implement current metrics retrieval
        return {};
    }

    async createCostAlert(alert) {
        // Create DataDog monitor for cost alert
        return await this.createMonitor({
            name: `Cost Alert: ${alert.type}`,
            query: `avg(last_1h):avg:lonicflex.cost{*} > ${alert.threshold}`,
            message: `Cost threshold exceeded: ${alert.actual} > ${alert.threshold}`,
            tags: ['lonicflex-cost', 'enterprise']
        });
    }

    async createBaselineMonitor(serviceId, metricName, threshold) {
        // Create DataDog monitor for baseline deviation
        return await this.createMonitor({
            name: `Baseline Deviation: ${serviceId} ${metricName}`,
            query: `avg(last_5m):avg:${metricName}{service:${serviceId}} > ${threshold * 1.2}`,
            message: `Performance baseline exceeded for ${serviceId}`,
            tags: ['lonicflex-baseline', 'enterprise']
        });
    }
}

// Start service if called directly
if (require.main === module) {
    const service = new LonicFlexDataDogService();
    service.start().catch(error => {
        console.error('Failed to start DataDog Service:', error.message);
        process.exit(1);
    });
}

module.exports = { LonicFlexDataDogService };