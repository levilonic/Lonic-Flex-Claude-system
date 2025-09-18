#!/usr/bin/env node
/**
 * LonicFLex Central Integration Hub Service - Window 2 Foundation
 * Cross-system integration orchestration and event routing
 *
 * Handles:
 * - Integration registry for all external systems
 * - Cross-system workflow orchestration
 * - Event routing and transformation between systems
 * - Unified configuration management
 * - Health monitoring for all integrations
 */

const express = require('express');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');
const axios = require('axios');
require('dotenv').config();

class LonicFlexIntegrationHubService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.INTEGRATION_HUB_PORT || 3020,
            serviceName: 'lonicflex-integration-hub',
            maxConcurrentWorkflows: config.maxConcurrentWorkflows || 50,
            eventTimeout: config.eventTimeout || 30000, // 30 seconds
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

        // Integration management
        this.integrations = new Map();           // systemId -> integration config
        this.activeWorkflows = new Map();       // workflowId -> workflow state
        this.eventQueue = [];                   // Pending cross-system events
        this.stats = {
            totalWorkflows: 0,
            activeWorkflows: 0,
            completedWorkflows: 0,
            failedWorkflows: 0,
            eventsRouted: 0,
            integrationsActive: 0
        };

        // Service registry for internal LonicFLex services
        this.serviceRegistry = {
            'master': { port: 3007, healthy: false },
            'webhooks': { port: 3008, healthy: false },
            'github': { port: 3002, healthy: false },
            'slack': { port: 3006, healthy: false },
            'agents': { port: 3003, healthy: false },
            'workflows': { port: 3004, healthy: false },
            'health': { port: 3005, healthy: false }
        };

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: './logs/lonicflex-integration-hub.log'
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
                this.logger.info('Request completed', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration: Date.now() - start
                });
            });
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const uptime = Date.now() - this.startTime.getTime();
            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime,
                initialized: true,
                stats: this.stats,
                activeWorkflows: this.activeWorkflows.size,
                registeredIntegrations: this.integrations.size,
                serviceRegistry: Object.keys(this.serviceRegistry).map(name => ({
                    name,
                    port: this.serviceRegistry[name].port,
                    healthy: this.serviceRegistry[name].healthy
                }))
            });
        });

        // Register external integration
        this.app.post('/integrations/register', async (req, res) => {
            try {
                const { systemId, config } = req.body;

                if (!systemId || !config) {
                    return res.status(400).json({ error: 'systemId and config required' });
                }

                const integration = {
                    systemId,
                    ...config,
                    registeredAt: new Date(),
                    healthy: false,
                    lastHealthCheck: null,
                    stats: {
                        apiCalls: 0,
                        successfulCalls: 0,
                        failedCalls: 0,
                        averageResponseTime: 0
                    }
                };

                this.integrations.set(systemId, integration);
                this.stats.integrationsActive = this.integrations.size;

                // Perform initial health check
                await this.checkIntegrationHealth(systemId);

                this.logger.info('Integration registered', { systemId, config: config.name });

                res.json({
                    success: true,
                    message: `Integration ${systemId} registered successfully`,
                    integration: {
                        systemId,
                        name: config.name,
                        registered: true,
                        healthy: integration.healthy
                    }
                });
            } catch (error) {
                this.logger.error('Integration registration failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Execute cross-system workflow
        this.app.post('/workflows/execute', async (req, res) => {
            try {
                const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const { workflowType, systems, data, metadata = {} } = req.body;

                if (!workflowType || !systems || !Array.isArray(systems)) {
                    return res.status(400).json({ error: 'workflowType and systems array required' });
                }

                const workflow = {
                    workflowId,
                    workflowType,
                    systems,
                    data,
                    metadata,
                    status: 'running',
                    startTime: new Date(),
                    steps: [],
                    currentStep: 0,
                    errors: []
                };

                this.activeWorkflows.set(workflowId, workflow);
                this.stats.totalWorkflows++;
                this.stats.activeWorkflows = this.activeWorkflows.size;

                this.logger.info('Cross-system workflow started', {
                    workflowId,
                    workflowType,
                    systems: systems.length
                });

                // Execute workflow asynchronously
                this.executeWorkflow(workflow).catch(error => {
                    this.logger.error('Workflow execution failed', {
                        workflowId,
                        error: error.message
                    });
                });

                res.json({
                    success: true,
                    workflowId,
                    status: 'running',
                    message: `Cross-system workflow ${workflowType} initiated`,
                    estimatedDuration: systems.length * 5000 // 5 seconds per system
                });
            } catch (error) {
                this.logger.error('Workflow initiation failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Route event between systems
        this.app.post('/events/route', async (req, res) => {
            try {
                const { sourceSystem, targetSystems, event, data, priority = 'normal' } = req.body;

                if (!sourceSystem || !targetSystems || !event) {
                    return res.status(400).json({ error: 'sourceSystem, targetSystems, and event required' });
                }

                const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const eventData = {
                    eventId,
                    sourceSystem,
                    targetSystems: Array.isArray(targetSystems) ? targetSystems : [targetSystems],
                    event,
                    data,
                    priority,
                    timestamp: new Date(),
                    status: 'pending',
                    results: []
                };

                this.eventQueue.push(eventData);
                this.stats.eventsRouted++;

                this.logger.info('Event queued for routing', {
                    eventId,
                    sourceSystem,
                    targetSystems: eventData.targetSystems,
                    event
                });

                // Process event asynchronously
                this.processEvent(eventData).catch(error => {
                    this.logger.error('Event processing failed', {
                        eventId,
                        error: error.message
                    });
                });

                res.json({
                    success: true,
                    eventId,
                    message: `Event ${event} queued for routing to ${eventData.targetSystems.length} systems`,
                    targets: eventData.targetSystems
                });
            } catch (error) {
                this.logger.error('Event routing failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Get workflow status
        this.app.get('/workflows/:workflowId/status', (req, res) => {
            const workflowId = req.params.workflowId;
            const workflow = this.activeWorkflows.get(workflowId);

            if (!workflow) {
                return res.status(404).json({ error: 'Workflow not found' });
            }

            res.json({
                workflowId,
                status: workflow.status,
                currentStep: workflow.currentStep,
                totalSteps: workflow.systems.length,
                steps: workflow.steps,
                startTime: workflow.startTime,
                duration: Date.now() - workflow.startTime.getTime(),
                errors: workflow.errors
            });
        });

        // List all integrations
        this.app.get('/integrations', (req, res) => {
            const integrationsList = Array.from(this.integrations.entries()).map(([systemId, integration]) => ({
                systemId,
                name: integration.name,
                type: integration.type,
                healthy: integration.healthy,
                lastHealthCheck: integration.lastHealthCheck,
                stats: integration.stats
            }));

            res.json({
                success: true,
                integrations: integrationsList,
                total: integrationsList.length
            });
        });

        // Service statistics
        this.app.get('/stats', (req, res) => {
            res.json({
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                activeWorkflows: this.activeWorkflows.size,
                registeredIntegrations: this.integrations.size,
                queuedEvents: this.eventQueue.length
            });
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

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            this.logger.error('Unhandled error', { error: error.message, stack: error.stack });
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    async executeWorkflow(workflow) {
        try {
            this.logger.info('Executing cross-system workflow', {
                workflowId: workflow.workflowId,
                systems: workflow.systems
            });

            for (let i = 0; i < workflow.systems.length; i++) {
                const system = workflow.systems[i];
                workflow.currentStep = i;

                const stepResult = await this.executeWorkflowStep(workflow, system, i);
                workflow.steps.push(stepResult);

                if (!stepResult.success) {
                    workflow.errors.push(stepResult.error);
                    // Continue or fail based on workflow configuration
                    if (workflow.metadata.failFast !== false) {
                        throw new Error(`Workflow step ${i} failed: ${stepResult.error}`);
                    }
                }
            }

            workflow.status = 'completed';
            workflow.completedAt = new Date();
            this.stats.completedWorkflows++;

        } catch (error) {
            workflow.status = 'failed';
            workflow.completedAt = new Date();
            workflow.errors.push(error.message);
            this.stats.failedWorkflows++;

            this.logger.error('Workflow execution failed', {
                workflowId: workflow.workflowId,
                error: error.message
            });
        } finally {
            // Move to completed workflows after delay
            setTimeout(() => {
                this.activeWorkflows.delete(workflow.workflowId);
                this.stats.activeWorkflows = this.activeWorkflows.size;
            }, 300000); // 5 minutes
        }
    }

    async executeWorkflowStep(workflow, system, stepIndex) {
        const stepStart = Date.now();

        try {
            this.logger.info('Executing workflow step', {
                workflowId: workflow.workflowId,
                stepIndex,
                system: system.id || system.name
            });

            let result;

            // Route to appropriate system
            if (this.integrations.has(system.id)) {
                // External system integration
                result = await this.callExternalSystem(system, workflow.data);
            } else if (this.serviceRegistry[system.id]) {
                // Internal LonicFLex service
                result = await this.callLonicFlexService(system, workflow.data);
            } else {
                throw new Error(`Unknown system: ${system.id}`);
            }

            return {
                stepIndex,
                system: system.id,
                success: true,
                result,
                duration: Date.now() - stepStart,
                timestamp: new Date()
            };

        } catch (error) {
            return {
                stepIndex,
                system: system.id,
                success: false,
                error: error.message,
                duration: Date.now() - stepStart,
                timestamp: new Date()
            };
        }
    }

    async callExternalSystem(system, data) {
        const integration = this.integrations.get(system.id);
        if (!integration) {
            throw new Error(`Integration not found: ${system.id}`);
        }

        const startTime = Date.now();

        try {
            // Build request based on system type
            const requestConfig = {
                method: system.method || 'POST',
                url: `${integration.baseUrl}${system.endpoint || ''}`,
                headers: {
                    'Content-Type': 'application/json',
                    ...integration.headers
                },
                data: {
                    ...data,
                    ...system.data
                },
                timeout: this.config.eventTimeout
            };

            // Add authentication
            if (integration.auth) {
                if (integration.auth.type === 'bearer') {
                    requestConfig.headers['Authorization'] = `Bearer ${integration.auth.token}`;
                } else if (integration.auth.type === 'basic') {
                    requestConfig.auth = {
                        username: integration.auth.username,
                        password: integration.auth.password
                    };
                }
            }

            const response = await axios(requestConfig);

            // Update stats
            integration.stats.apiCalls++;
            integration.stats.successfulCalls++;
            const duration = Date.now() - startTime;
            integration.stats.averageResponseTime =
                (integration.stats.averageResponseTime + duration) / 2;

            this.logger.info('External system call successful', {
                system: system.id,
                status: response.status,
                duration
            });

            return {
                success: true,
                status: response.status,
                data: response.data,
                system: system.id
            };

        } catch (error) {
            integration.stats.apiCalls++;
            integration.stats.failedCalls++;

            this.logger.error('External system call failed', {
                system: system.id,
                error: error.message
            });

            throw error;
        }
    }

    async callLonicFlexService(system, data) {
        const service = this.serviceRegistry[system.id];
        if (!service) {
            throw new Error(`LonicFLex service not found: ${system.id}`);
        }

        try {
            const url = `http://localhost:${service.port}${system.endpoint || '/coordinate'}`;
            const response = await axios.post(url, {
                event: system.event || 'workflow_step',
                ...data,
                ...system.data
            }, {
                timeout: this.config.eventTimeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            this.logger.info('LonicFLex service call successful', {
                service: system.id,
                port: service.port,
                status: response.status
            });

            return response.data;

        } catch (error) {
            this.logger.error('LonicFLex service call failed', {
                service: system.id,
                port: service.port,
                error: error.message
            });

            throw error;
        }
    }

    async processEvent(eventData) {
        try {
            this.logger.info('Processing cross-system event', {
                eventId: eventData.eventId,
                event: eventData.event,
                targets: eventData.targetSystems.length
            });

            const promises = eventData.targetSystems.map(async (targetSystem) => {
                try {
                    let result;

                    if (this.integrations.has(targetSystem)) {
                        result = await this.callExternalSystem({
                            id: targetSystem,
                            endpoint: `/events/${eventData.event}`,
                            method: 'POST',
                            data: eventData.data
                        });
                    } else if (this.serviceRegistry[targetSystem]) {
                        result = await this.callLonicFlexService({
                            id: targetSystem,
                            event: eventData.event,
                            data: eventData.data
                        });
                    } else {
                        throw new Error(`Unknown target system: ${targetSystem}`);
                    }

                    return {
                        targetSystem,
                        success: true,
                        result
                    };

                } catch (error) {
                    return {
                        targetSystem,
                        success: false,
                        error: error.message
                    };
                }
            });

            const results = await Promise.allSettled(promises);
            eventData.results = results.map(r => r.value);
            eventData.status = 'completed';
            eventData.completedAt = new Date();

            this.logger.info('Event processing completed', {
                eventId: eventData.eventId,
                successCount: eventData.results.filter(r => r.success).length,
                failedCount: eventData.results.filter(r => !r.success).length
            });

        } catch (error) {
            eventData.status = 'failed';
            eventData.error = error.message;
            eventData.completedAt = new Date();

            this.logger.error('Event processing failed', {
                eventId: eventData.eventId,
                error: error.message
            });
        }
    }

    async checkIntegrationHealth(systemId) {
        const integration = this.integrations.get(systemId);
        if (!integration) return;

        try {
            const healthEndpoint = integration.healthEndpoint || '/health';
            const response = await axios.get(
                `${integration.baseUrl}${healthEndpoint}`,
                {
                    timeout: 5000,
                    headers: integration.headers || {}
                }
            );

            integration.healthy = response.status === 200;
            integration.lastHealthCheck = new Date();

            this.logger.info('Integration health check', {
                systemId,
                healthy: integration.healthy,
                status: response.status
            });

        } catch (error) {
            integration.healthy = false;
            integration.lastHealthCheck = new Date();

            this.logger.warn('Integration health check failed', {
                systemId,
                error: error.message
            });
        }
    }

    async checkServiceRegistry() {
        // Check health of internal LonicFLex services
        for (const [serviceName, serviceInfo] of Object.entries(this.serviceRegistry)) {
            try {
                const response = await axios.get(
                    `http://localhost:${serviceInfo.port}/health`,
                    { timeout: 3000 }
                );
                serviceInfo.healthy = response.status === 200;
            } catch (error) {
                serviceInfo.healthy = false;
            }
        }
    }

    async coordinateWithServices({ event, ...data }) {
        try {
            this.logger.info('Integration Hub coordinating with services', { event, data });

            switch (event) {
                case 'cross_system_workflow':
                    return await this.executeWorkflow({
                        workflowType: data.workflowType,
                        systems: data.systems,
                        data: data.data,
                        metadata: data.metadata
                    });

                case 'route_event':
                    return await this.processEvent({
                        eventId: `coord-${Date.now()}`,
                        sourceSystem: data.sourceSystem || 'integration-hub',
                        targetSystems: data.targetSystems,
                        event: data.eventType,
                        data: data.data,
                        priority: data.priority || 'normal',
                        timestamp: new Date(),
                        status: 'pending',
                        results: []
                    });

                case 'register_integration':
                    return await this.registerIntegration(data.systemId, data.config);

                case 'check_integration_health':
                    if (data.systemId) {
                        await this.checkIntegrationHealth(data.systemId);
                        const integration = this.integrations.get(data.systemId);
                        return {
                            success: true,
                            systemId: data.systemId,
                            healthy: integration?.healthy || false,
                            lastCheck: integration?.lastHealthCheck
                        };
                    }
                    return { success: false, error: 'systemId required' };

                case 'get_integrations_status':
                    const integrations = Array.from(this.integrations.values());
                    return {
                        success: true,
                        integrations: integrations.map(int => ({
                            systemId: int.systemId,
                            name: int.name,
                            type: int.type,
                            healthy: int.healthy,
                            lastHealthCheck: int.lastHealthCheck
                        })),
                        totalIntegrations: integrations.length
                    };

                default:
                    this.logger.warn('Unknown coordination event', { event });
                    return { success: false, error: `Unknown event: ${event}` };
            }

        } catch (error) {
            this.logger.error('Service coordination failed', { error: error.message, event });
            return { success: false, error: error.message };
        }
    }

    async initialize() {
        try {
            this.logger.info('Initializing Integration Hub Service', {
                port: this.config.port,
                serviceName: this.config.serviceName
            });

            // Initialize database connection
            await this.db.initialize();

            // Check internal service registry
            await this.checkServiceRegistry();

            // Set up health check interval
            setInterval(() => {
                this.checkServiceRegistry();
                // Health check integrations every 5 minutes
                this.integrations.forEach((_, systemId) => {
                    this.checkIntegrationHealth(systemId);
                });
            }, 300000); // 5 minutes

            this.logger.info('Integration Hub Service initialized successfully');

        } catch (error) {
            this.logger.error('Integration Hub Service initialization failed', {
                error: error.message
            });
            throw error;
        }
    }

    async start() {
        try {
            await this.initialize();

            const server = this.app.listen(this.config.port, () => {
                this.logger.info('Integration Hub Service started', {
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
            this.logger.error('Failed to start Integration Hub Service', {
                error: error.message
            });
            throw error;
        }
    }
}

// Start service if called directly
if (require.main === module) {
    const service = new LonicFlexIntegrationHubService();
    service.start().catch(error => {
        console.error('Failed to start Integration Hub Service:', error.message);
        process.exit(1);
    });
}

module.exports = { LonicFlexIntegrationHubService };