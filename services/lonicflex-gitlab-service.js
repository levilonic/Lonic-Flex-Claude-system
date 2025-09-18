#!/usr/bin/env node
/**
 * LonicFLex GitLab Integration Service - Window 2
 * Real GitLab REST API v4 integration for CI/CD workflow automation
 *
 * Handles:
 * - GitLab REST API v4 integration with OAuth/token authentication
 * - Pipeline management and monitoring
 * - Environment and deployment tracking
 * - Merge request automation
 * - Cross-system workflow coordination
 */

const express = require('express');
const axios = require('axios');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');
require('dotenv').config();

class LonicFlexGitLabService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.GITLAB_SERVICE_PORT || 3025,
            serviceName: 'lonicflex-gitlab',
            gitlabUrl: config.gitlabUrl || process.env.GITLAB_URL || 'https://gitlab.com',
            accessToken: config.accessToken || process.env.GITLAB_ACCESS_TOKEN,
            webhookSecret: config.webhookSecret || process.env.GITLAB_WEBHOOK_SECRET,
            defaultProjectId: config.defaultProjectId || process.env.GITLAB_DEFAULT_PROJECT,
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

        // GitLab state management
        this.projects = new Map();                  // projectId -> project info
        this.pipelines = new Map();                 // pipelineId -> pipeline data
        this.mergeRequests = new Map();             // mrId -> merge request data
        this.deployments = new Map();               // deploymentId -> deployment data
        this.environments = new Map();              // environmentId -> environment data
        this.webhookEvents = [];                    // Recent webhook events
        this.stats = {
            pipelinesTriggered: 0,
            pipelinesCompleted: 0,
            pipelinesFailed: 0,
            mergeRequestsCreated: 0,
            mergeRequestsMerged: 0,
            deploymentsCreated: 0,
            deploymentsCompleted: 0,
            webhooksReceived: 0,
            apiCalls: 0,
            failedCalls: 0,
            averageResponseTime: 0
        };

        // GitLab API client configuration
        this.authenticated = false;
        this.rateLimitRemaining = 2000;
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
                    filename: './logs/lonicflex-gitlab.log'
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

        // GitLab webhook signature verification middleware
        this.app.use('/webhooks', (req, res, next) => {
            if (!this.config.webhookSecret) {
                return next();
            }

            const token = req.get('X-Gitlab-Token');
            if (!token || token !== this.config.webhookSecret) {
                return res.status(401).json({ error: 'Invalid webhook token' });
            }

            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            const uptime = Date.now() - this.startTime.getTime();

            // Check GitLab connectivity
            let gitlabHealth = 'unknown';
            try {
                if (this.authenticated) {
                    await this.getCurrentUser();
                    gitlabHealth = 'connected';
                }
            } catch (error) {
                gitlabHealth = 'disconnected';
            }

            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime,
                initialized: true,
                authenticated: this.authenticated,
                gitlabHealth,
                stats: this.stats,
                projects: this.projects.size,
                pipelines: this.pipelines.size,
                mergeRequests: this.mergeRequests.size,
                rateLimitRemaining: this.rateLimitRemaining,
                timestamp: new Date().toISOString()
            });
        });

        // Trigger GitLab pipeline
        this.app.post('/pipelines/trigger', async (req, res) => {
            try {
                const { projectId, ref = 'main', variables = {} } = req.body;

                if (!projectId) {
                    return res.status(400).json({ error: 'projectId required' });
                }

                const pipeline = await this.triggerPipeline(projectId, ref, variables);

                this.stats.pipelinesTriggered++;
                this.pipelines.set(pipeline.id, pipeline);

                this.logger.info('GitLab pipeline triggered', {
                    projectId,
                    pipelineId: pipeline.id,
                    ref,
                    variables
                });

                res.json({
                    success: true,
                    pipeline: {
                        id: pipeline.id,
                        projectId,
                        ref: pipeline.ref,
                        status: pipeline.status,
                        webUrl: pipeline.web_url,
                        createdAt: pipeline.created_at
                    }
                });

            } catch (error) {
                this.logger.error('Failed to trigger GitLab pipeline', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Get pipeline status
        this.app.get('/pipelines/:projectId/:pipelineId', async (req, res) => {
            try {
                const { projectId, pipelineId } = req.params;

                const pipeline = await this.getPipeline(projectId, pipelineId);

                res.json({
                    success: true,
                    pipeline: {
                        id: pipeline.id,
                        projectId: parseInt(projectId),
                        ref: pipeline.ref,
                        status: pipeline.status,
                        webUrl: pipeline.web_url,
                        duration: pipeline.duration,
                        createdAt: pipeline.created_at,
                        updatedAt: pipeline.updated_at,
                        finishedAt: pipeline.finished_at
                    }
                });

            } catch (error) {
                this.logger.error('Failed to get GitLab pipeline', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Create merge request
        this.app.post('/merge-requests/create', async (req, res) => {
            try {
                const {
                    projectId,
                    sourceBranch,
                    targetBranch = 'main',
                    title,
                    description,
                    assigneeId
                } = req.body;

                if (!projectId || !sourceBranch || !title) {
                    return res.status(400).json({
                        error: 'projectId, sourceBranch, and title required'
                    });
                }

                const mergeRequest = await this.createMergeRequest({
                    projectId,
                    sourceBranch,
                    targetBranch,
                    title,
                    description,
                    assigneeId
                });

                this.stats.mergeRequestsCreated++;
                this.mergeRequests.set(mergeRequest.iid, mergeRequest);

                this.logger.info('GitLab merge request created', {
                    projectId,
                    mergeRequestId: mergeRequest.iid,
                    title
                });

                res.json({
                    success: true,
                    mergeRequest: {
                        id: mergeRequest.id,
                        iid: mergeRequest.iid,
                        projectId,
                        title: mergeRequest.title,
                        state: mergeRequest.state,
                        webUrl: mergeRequest.web_url,
                        sourceBranch: mergeRequest.source_branch,
                        targetBranch: mergeRequest.target_branch
                    }
                });

            } catch (error) {
                this.logger.error('Failed to create GitLab merge request', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Create deployment
        this.app.post('/deployments/create', async (req, res) => {
            try {
                const {
                    projectId,
                    environment,
                    ref = 'main',
                    tag = false,
                    deployable
                } = req.body;

                if (!projectId || !environment) {
                    return res.status(400).json({ error: 'projectId and environment required' });
                }

                const deployment = await this.createDeployment({
                    projectId,
                    environment,
                    ref,
                    tag,
                    deployable
                });

                this.stats.deploymentsCreated++;
                this.deployments.set(deployment.id, deployment);

                this.logger.info('GitLab deployment created', {
                    projectId,
                    deploymentId: deployment.id,
                    environment,
                    ref
                });

                res.json({
                    success: true,
                    deployment: {
                        id: deployment.id,
                        projectId,
                        environment: deployment.environment.name,
                        ref: deployment.ref,
                        status: deployment.status,
                        deployable: deployment.deployable
                    }
                });

            } catch (error) {
                this.logger.error('Failed to create GitLab deployment', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // List project environments
        this.app.get('/projects/:projectId/environments', async (req, res) => {
            try {
                const projectId = req.params.projectId;

                const environments = await this.getProjectEnvironments(projectId);

                res.json({
                    success: true,
                    environments: environments.map(env => ({
                        id: env.id,
                        name: env.name,
                        slug: env.slug,
                        externalUrl: env.external_url,
                        state: env.state,
                        lastDeployment: env.last_deployment
                    }))
                });

            } catch (error) {
                this.logger.error('Failed to get GitLab environments', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // List projects
        this.app.get('/projects', async (req, res) => {
            try {
                const { owned = false, starred = false } = req.query;

                const projects = await this.getProjects({ owned, starred });

                res.json({
                    success: true,
                    projects: projects.map(project => ({
                        id: project.id,
                        name: project.name,
                        nameWithNamespace: project.name_with_namespace,
                        webUrl: project.web_url,
                        defaultBranch: project.default_branch,
                        visibility: project.visibility,
                        lastActivity: project.last_activity_at
                    }))
                });

            } catch (error) {
                this.logger.error('Failed to get GitLab projects', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // GitLab webhook endpoint
        this.app.post('/webhooks', async (req, res) => {
            try {
                const event = req.body;
                const eventType = req.get('X-Gitlab-Event');

                this.webhookEvents.push({
                    ...event,
                    eventType,
                    receivedAt: new Date()
                });

                // Keep only last 100 webhook events
                if (this.webhookEvents.length > 100) {
                    this.webhookEvents = this.webhookEvents.slice(-100);
                }

                this.stats.webhooksReceived++;

                this.logger.info('GitLab webhook received', {
                    eventType,
                    objectKind: event.object_kind,
                    projectId: event.project?.id,
                    ref: event.ref || event.merge_request?.source_branch
                });

                // Process webhook asynchronously
                this.processWebhook(eventType, event).catch(error => {
                    this.logger.error('Webhook processing failed', { error: error.message });
                });

                res.json({ success: true, message: 'Webhook processed' });

            } catch (error) {
                this.logger.error('GitLab webhook processing failed', { error: error.message });
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
                projects: this.projects.size,
                pipelines: this.pipelines.size,
                mergeRequests: this.mergeRequests.size,
                deployments: this.deployments.size,
                rateLimitRemaining: this.rateLimitRemaining,
                recentWebhooks: this.webhookEvents.slice(-10)
            });
        });
    }

    async triggerPipeline(projectId, ref, variables = {}) {
        const variablesArray = Object.entries(variables).map(([key, value]) => ({
            key,
            value: String(value)
        }));

        return await this.makeGitLabRequest(
            `projects/${projectId}/pipeline`,
            'POST',
            {
                ref,
                variables: variablesArray
            }
        );
    }

    async getPipeline(projectId, pipelineId) {
        return await this.makeGitLabRequest(`projects/${projectId}/pipelines/${pipelineId}`);
    }

    async createMergeRequest({ projectId, sourceBranch, targetBranch, title, description, assigneeId }) {
        return await this.makeGitLabRequest(
            `projects/${projectId}/merge_requests`,
            'POST',
            {
                source_branch: sourceBranch,
                target_branch: targetBranch,
                title,
                description,
                assignee_id: assigneeId
            }
        );
    }

    async createDeployment({ projectId, environment, ref, tag, deployable }) {
        return await this.makeGitLabRequest(
            `projects/${projectId}/deployments`,
            'POST',
            {
                environment,
                ref,
                tag,
                deployable
            }
        );
    }

    async getProjectEnvironments(projectId) {
        return await this.makeGitLabRequest(`projects/${projectId}/environments`);
    }

    async getProjects({ owned = false, starred = false } = {}) {
        let endpoint = 'projects';
        const params = [];

        if (owned) params.push('owned=true');
        if (starred) params.push('starred=true');

        if (params.length > 0) {
            endpoint += '?' + params.join('&');
        }

        return await this.makeGitLabRequest(endpoint);
    }

    async getCurrentUser() {
        return await this.makeGitLabRequest('user');
    }

    async makeGitLabRequest(endpoint, method = 'GET', data = null) {
        const startTime = Date.now();
        this.stats.apiCalls++;

        try {
            if (!this.config.accessToken) {
                throw new Error('GitLab access token not configured');
            }

            const config = {
                method,
                url: `${this.config.gitlabUrl}/api/v4/${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.config.accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.config.requestTimeout
            };

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                config.data = data;
            }

            const response = await axios(config);

            // Update rate limit info from headers
            if (response.headers['ratelimit-remaining']) {
                this.rateLimitRemaining = parseInt(response.headers['ratelimit-remaining']);
            }
            if (response.headers['ratelimit-reset']) {
                this.rateLimitReset = new Date(response.headers['ratelimit-reset'] * 1000);
            }

            this.logger.info('GitLab API call successful', {
                endpoint,
                method,
                status: response.status,
                duration: Date.now() - startTime
            });

            return response.data;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('GitLab API call failed', {
                endpoint,
                method,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async processWebhook(eventType, event) {
        try {
            this.logger.info('Processing GitLab webhook', { eventType, objectKind: event.object_kind });

            switch (eventType) {
                case 'Pipeline Hook':
                    await this.processPipelineWebhook(event);
                    break;
                case 'Merge Request Hook':
                    await this.processMergeRequestWebhook(event);
                    break;
                case 'Deployment Hook':
                    await this.processDeploymentWebhook(event);
                    break;
                case 'Push Hook':
                    await this.processPushWebhook(event);
                    break;
                default:
                    this.logger.info('Unhandled webhook event type', { eventType });
            }

            // Notify Integration Hub about the webhook event
            await this.notifyIntegrationHub(`gitlab_${eventType.toLowerCase().replace(' ', '_')}`, event);

        } catch (error) {
            this.logger.error('Webhook processing failed', { error: error.message });
        }
    }

    async processPipelineWebhook(event) {
        const pipeline = event.object_attributes;

        this.pipelines.set(pipeline.id, pipeline);

        switch (pipeline.status) {
            case 'success':
                this.stats.pipelinesCompleted++;
                break;
            case 'failed':
            case 'canceled':
                this.stats.pipelinesFailed++;
                break;
        }

        this.logger.info('Pipeline webhook processed', {
            pipelineId: pipeline.id,
            status: pipeline.status,
            ref: pipeline.ref,
            duration: pipeline.duration
        });
    }

    async processMergeRequestWebhook(event) {
        const mergeRequest = event.object_attributes;

        this.mergeRequests.set(mergeRequest.iid, mergeRequest);

        if (mergeRequest.action === 'merge') {
            this.stats.mergeRequestsMerged++;
        }

        this.logger.info('Merge request webhook processed', {
            action: mergeRequest.action,
            mergeRequestId: mergeRequest.iid,
            state: mergeRequest.state,
            sourceBranch: mergeRequest.source_branch,
            targetBranch: mergeRequest.target_branch
        });
    }

    async processDeploymentWebhook(event) {
        const deployment = event.deployment;

        this.deployments.set(deployment.id, deployment);

        if (deployment.status === 'success') {
            this.stats.deploymentsCompleted++;
        }

        this.logger.info('Deployment webhook processed', {
            deploymentId: deployment.id,
            environment: deployment.environment,
            status: deployment.status,
            ref: deployment.ref
        });
    }

    async processPushWebhook(event) {
        this.logger.info('Push webhook processed', {
            projectId: event.project_id,
            ref: event.ref,
            commits: event.commits?.length || 0,
            totalCommits: event.total_commits_count
        });
    }

    async coordinateWithServices({ event, ...data }) {
        try {
            this.logger.info('GitLab service coordinating with services', { event, data });

            switch (event) {
                case 'trigger_pipeline':
                    return await this.triggerPipeline(
                        data.projectId,
                        data.ref || 'main',
                        data.variables || {}
                    );

                case 'create_merge_request':
                    return await this.createMergeRequest(data);

                case 'create_deployment':
                    return await this.createDeployment(data);

                case 'get_pipeline':
                    return await this.getPipeline(data.projectId, data.pipelineId);

                case 'process_event':
                    // Handle events from Integration Hub
                    if (data.eventType === 'deploy_to_staging') {
                        return await this.handleStagingDeployment(data);
                    } else if (data.eventType === 'automated_mr_creation') {
                        return await this.handleAutomatedMR(data);
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

    async handleStagingDeployment(data) {
        const { projectId, ref, version } = data;

        return await this.createDeployment({
            projectId,
            environment: 'staging',
            ref,
            deployable: {
                name: `Deploy ${version} to staging`,
                ref
            }
        });
    }

    async handleAutomatedMR(data) {
        const { projectId, sourceBranch, title, description, assigneeId } = data;

        return await this.createMergeRequest({
            projectId,
            sourceBranch,
            targetBranch: 'main',
            title,
            description,
            assigneeId
        });
    }

    async notifyIntegrationHub(eventType, data) {
        try {
            await axios.post('http://localhost:3020/events/route', {
                sourceSystem: 'gitlab',
                targetSystems: ['integration-hub'],
                event: eventType,
                data
            }, { timeout: 5000 });

        } catch (error) {
            this.logger.warn('Failed to notify Integration Hub', { error: error.message });
        }
    }

    async initialize() {
        try {
            this.logger.info('Initializing GitLab Service', {
                port: this.config.port,
                serviceName: this.config.serviceName,
                gitlabUrl: this.config.gitlabUrl
            });

            // Initialize database connection
            await this.db.initialize();

            // Test GitLab API connection
            if (this.config.accessToken) {
                await this.testApiConnection();
            } else {
                this.logger.warn('GitLab access token not configured - service will run in limited mode');
            }

            this.logger.info('GitLab Service initialized successfully');

        } catch (error) {
            this.logger.error('GitLab Service initialization failed', {
                error: error.message
            });
            throw error;
        }
    }

    async testApiConnection() {
        try {
            const user = await this.getCurrentUser();
            this.authenticated = true;

            // Load projects
            const projects = await this.getProjects({ owned: true });
            projects.forEach(project => {
                this.projects.set(project.id, project);
            });

            this.logger.info('GitLab API connection established', {
                user: user.username,
                projects: projects.length,
                rateLimitRemaining: this.rateLimitRemaining
            });

        } catch (error) {
            this.authenticated = false;
            this.logger.error('GitLab API connection failed', { error: error.message });
            throw error;
        }
    }

    async start() {
        try {
            await this.initialize();

            const server = this.app.listen(this.config.port, () => {
                this.logger.info('GitLab Service started', {
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
            this.logger.error('Failed to start GitLab Service', {
                error: error.message
            });
            throw error;
        }
    }
}

// Start service if called directly
if (require.main === module) {
    const service = new LonicFlexGitLabService();
    service.start().catch(error => {
        console.error('Failed to start GitLab Service:', error.message);
        process.exit(1);
    });
}

module.exports = { LonicFlexGitLabService };