#!/usr/bin/env node
/**
 * LonicFLex DataDog Integration Service - Window 2
 * Real DataDog HTTP API integration for monitoring and observability
 *
 * Handles:
 * - DataDog HTTP API v1/v2 integration with API key authentication
 * - Metrics, logs, and traces collection
 * - Custom dashboard creation
 * - Alert management and routing
 * - Cross-system workflow coordination
 */

const express = require('express');
const axios = require('axios');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');
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
        this.contextManager = new Factor3ContextManager();

        // DataDog state management
        this.metrics = new Map();                   // metricName -> metric info
        this.dashboards = new Map();                // dashboardId -> dashboard data
        this.monitors = new Map();                  // monitorId -> monitor data
        this.logs = [];                            // Recent log entries
        this.alerts = [];                          // Recent alerts
        this.stats = {
            metricsSubmitted: 0,
            logsSubmitted: 0,
            dashboardsCreated: 0,
            monitorsCreated: 0,
            alertsReceived: 0,
            apiCalls: 0,
            failedCalls: 0,
            averageResponseTime: 0
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

                res.json({
                    success: true,
                    submitted: series.length,
                    result
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
                    success: true,
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
                    success: true,
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
                    success: true,
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
                    success: true,
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
                    success: true,
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

        // Service statistics
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
                recentAlerts: this.alerts.slice(-5)
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

        return {
            success: true,
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