#!/usr/bin/env node
/**
 * LonicFLex Jira Integration Service - Window 2
 * Real Jira API integration for ITSM workflow automation
 *
 * Handles:
 * - Jira REST API v3 integration with OAuth/token authentication
 * - Issue management (create, update, transition, comment)
 * - Project and sprint management
 * - Webhook handling for real-time updates
 * - Cross-system workflow coordination
 */

const express = require('express');
const axios = require('axios');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');
require('dotenv').config();

class LonicFlexJiraService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.JIRA_SERVICE_PORT || 3021,
            serviceName: 'lonicflex-jira',
            jiraUrl: config.jiraUrl || process.env.JIRA_URL || 'https://your-domain.atlassian.net',
            email: config.email || process.env.JIRA_EMAIL,
            apiToken: config.apiToken || process.env.JIRA_API_TOKEN,
            webhook: config.webhook || process.env.JIRA_WEBHOOK_SECRET,
            defaultProject: config.defaultProject || process.env.JIRA_DEFAULT_PROJECT || 'LONIC',
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

        // Jira state management
        this.projects = new Map();              // projectKey -> project info
        this.issues = new Map();                // issueKey -> issue data
        this.webhookEvents = [];                // Recent webhook events
        this.stats = {
            issuesCreated: 0,
            issuesUpdated: 0,
            issuesTransitioned: 0,
            commentsAdded: 0,
            webhooksReceived: 0,
            apiCalls: 0,
            failedCalls: 0,
            averageResponseTime: 0
        };

        // Initialize Jira API client
        this.jiraClient = null;
        this.authenticated = false;

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: './logs/lonicflex-jira.log'
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
        this.app.get('/health', (req, res) => {
            const uptime = Date.now() - this.startTime.getTime();
            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime,
                initialized: true,
                authenticated: this.authenticated,
                jiraUrl: this.config.jiraUrl,
                stats: this.stats,
                projectsLoaded: this.projects.size,
                recentIssues: this.issues.size
            });
        });

        // Create Jira issue
        this.app.post('/issues/create', async (req, res) => {
            try {
                const issue = await this.createIssue(req.body);
                res.json({
                    success: true,
                    issue,
                    message: `Issue ${issue.key} created successfully`
                });
            } catch (error) {
                this.logger.error('Issue creation failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Update Jira issue
        this.app.put('/issues/:issueKey', async (req, res) => {
            try {
                const { issueKey } = req.params;
                const updatedIssue = await this.updateIssue(issueKey, req.body);
                res.json({
                    success: true,
                    issue: updatedIssue,
                    message: `Issue ${issueKey} updated successfully`
                });
            } catch (error) {
                this.logger.error('Issue update failed', {
                    issueKey: req.params.issueKey,
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Transition issue
        this.app.post('/issues/:issueKey/transition', async (req, res) => {
            try {
                const { issueKey } = req.params;
                const { transitionId, comment } = req.body;
                const result = await this.transitionIssue(issueKey, transitionId, comment);
                res.json({
                    success: true,
                    result,
                    message: `Issue ${issueKey} transitioned successfully`
                });
            } catch (error) {
                this.logger.error('Issue transition failed', {
                    issueKey: req.params.issueKey,
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Add comment to issue
        this.app.post('/issues/:issueKey/comment', async (req, res) => {
            try {
                const { issueKey } = req.params;
                const { body } = req.body;
                const comment = await this.addComment(issueKey, body);
                res.json({
                    success: true,
                    comment,
                    message: `Comment added to ${issueKey} successfully`
                });
            } catch (error) {
                this.logger.error('Comment addition failed', {
                    issueKey: req.params.issueKey,
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Get issue details
        this.app.get('/issues/:issueKey', async (req, res) => {
            try {
                const { issueKey } = req.params;
                const issue = await this.getIssue(issueKey);
                res.json({
                    success: true,
                    issue
                });
            } catch (error) {
                this.logger.error('Issue retrieval failed', {
                    issueKey: req.params.issueKey,
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Search issues
        this.app.post('/issues/search', async (req, res) => {
            try {
                const { jql, maxResults = 50 } = req.body;
                const results = await this.searchIssues(jql, maxResults);
                res.json({
                    success: true,
                    results,
                    count: results.issues ? results.issues.length : 0
                });
            } catch (error) {
                this.logger.error('Issue search failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Get project information
        this.app.get('/projects/:projectKey', async (req, res) => {
            try {
                const { projectKey } = req.params;
                const project = await this.getProject(projectKey);
                res.json({
                    success: true,
                    project
                });
            } catch (error) {
                this.logger.error('Project retrieval failed', {
                    projectKey: req.params.projectKey,
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Cross-system coordination endpoint
        this.app.post('/coordinate', async (req, res) => {
            try {
                const result = await this.coordinateWithServices(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Service coordination failed', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Webhook endpoint for Jira events
        this.app.post('/webhooks/jira', (req, res) => {
            try {
                this.handleWebhook(req.body);
                this.stats.webhooksReceived++;
                res.json({ success: true, message: 'Webhook processed' });
            } catch (error) {
                this.logger.error('Webhook processing failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Service statistics
        this.app.get('/stats', (req, res) => {
            res.json({
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                authenticated: this.authenticated,
                jiraUrl: this.config.jiraUrl,
                projectsLoaded: this.projects.size,
                recentWebhooks: this.webhookEvents.slice(-10)
            });
        });
    }

    async createIssue(issueData) {
        const startTime = Date.now();

        try {
            this.logger.info('Creating Jira issue', {
                project: issueData.project || this.config.defaultProject,
                issueType: issueData.issueType,
                summary: issueData.summary
            });

            const payload = {
                fields: {
                    project: { key: issueData.project || this.config.defaultProject },
                    summary: issueData.summary,
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        text: issueData.description || issueData.summary,
                                        type: 'text'
                                    }
                                ]
                            }
                        ]
                    },
                    issuetype: { name: issueData.issueType || 'Task' },
                    ...issueData.customFields || {}
                }
            };

            // Add priority if specified
            if (issueData.priority) {
                payload.fields.priority = { name: issueData.priority };
            }

            // Add assignee if specified
            if (issueData.assignee) {
                payload.fields.assignee = { emailAddress: issueData.assignee };
            }

            // Add labels if specified
            if (issueData.labels && Array.isArray(issueData.labels)) {
                payload.fields.labels = issueData.labels;
            }

            const response = await this.makeJiraRequest('POST', '/issue', payload);

            const issue = {
                key: response.key,
                id: response.id,
                url: `${this.config.jiraUrl}/browse/${response.key}`,
                project: issueData.project || this.config.defaultProject,
                summary: issueData.summary,
                issueType: issueData.issueType || 'Task',
                status: 'Open',
                created: new Date()
            };

            // Cache the issue
            this.issues.set(response.key, issue);
            this.stats.issuesCreated++;

            this.logger.info('Jira issue created successfully', {
                issueKey: response.key,
                duration: Date.now() - startTime
            });

            return issue;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('Jira issue creation failed', {
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async updateIssue(issueKey, updateData) {
        const startTime = Date.now();

        try {
            this.logger.info('Updating Jira issue', { issueKey });

            const payload = { fields: {} };

            // Map common update fields
            if (updateData.summary) {
                payload.fields.summary = updateData.summary;
            }

            if (updateData.description) {
                payload.fields.description = {
                    type: 'doc',
                    version: 1,
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                {
                                    text: updateData.description,
                                    type: 'text'
                                }
                            ]
                        }
                    ]
                };
            }

            if (updateData.priority) {
                payload.fields.priority = { name: updateData.priority };
            }

            if (updateData.assignee) {
                payload.fields.assignee = { emailAddress: updateData.assignee };
            }

            if (updateData.labels && Array.isArray(updateData.labels)) {
                payload.fields.labels = updateData.labels;
            }

            // Add custom fields
            if (updateData.customFields) {
                Object.assign(payload.fields, updateData.customFields);
            }

            await this.makeJiraRequest('PUT', `/issue/${issueKey}`, payload);

            // Get updated issue details
            const updatedIssue = await this.getIssue(issueKey);

            this.stats.issuesUpdated++;

            this.logger.info('Jira issue updated successfully', {
                issueKey,
                duration: Date.now() - startTime
            });

            return updatedIssue;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('Jira issue update failed', {
                issueKey,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async transitionIssue(issueKey, transitionId, comment) {
        const startTime = Date.now();

        try {
            this.logger.info('Transitioning Jira issue', { issueKey, transitionId });

            const payload = {
                transition: { id: transitionId }
            };

            // Add comment if provided
            if (comment) {
                payload.update = {
                    comment: [
                        {
                            add: {
                                body: {
                                    type: 'doc',
                                    version: 1,
                                    content: [
                                        {
                                            type: 'paragraph',
                                            content: [
                                                {
                                                    text: comment,
                                                    type: 'text'
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                };
            }

            await this.makeJiraRequest('POST', `/issue/${issueKey}/transitions`, payload);

            this.stats.issuesTransitioned++;

            this.logger.info('Jira issue transitioned successfully', {
                issueKey,
                transitionId,
                duration: Date.now() - startTime
            });

            return {
                issueKey,
                transitionId,
                success: true
            };

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('Jira issue transition failed', {
                issueKey,
                transitionId,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async addComment(issueKey, commentBody) {
        const startTime = Date.now();

        try {
            this.logger.info('Adding comment to Jira issue', { issueKey });

            const payload = {
                body: {
                    type: 'doc',
                    version: 1,
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                {
                                    text: commentBody,
                                    type: 'text'
                                }
                            ]
                        }
                    ]
                }
            };

            const response = await this.makeJiraRequest('POST', `/issue/${issueKey}/comment`, payload);

            this.stats.commentsAdded++;

            this.logger.info('Comment added to Jira issue successfully', {
                issueKey,
                commentId: response.id,
                duration: Date.now() - startTime
            });

            return {
                id: response.id,
                body: commentBody,
                created: response.created,
                author: response.author
            };

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('Jira comment addition failed', {
                issueKey,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async getIssue(issueKey) {
        const startTime = Date.now();

        try {
            // Check cache first
            if (this.issues.has(issueKey)) {
                const cached = this.issues.get(issueKey);
                if (Date.now() - cached.lastUpdated < 300000) { // 5 minutes
                    return cached;
                }
            }

            this.logger.info('Fetching Jira issue', { issueKey });

            const response = await this.makeJiraRequest('GET', `/issue/${issueKey}`);

            const issue = {
                key: response.key,
                id: response.id,
                url: `${this.config.jiraUrl}/browse/${response.key}`,
                summary: response.fields.summary,
                description: this.extractTextFromADF(response.fields.description),
                status: response.fields.status.name,
                issueType: response.fields.issuetype.name,
                priority: response.fields.priority ? response.fields.priority.name : null,
                assignee: response.fields.assignee ? response.fields.assignee.emailAddress : null,
                reporter: response.fields.reporter ? response.fields.reporter.emailAddress : null,
                project: response.fields.project.key,
                labels: response.fields.labels || [],
                created: response.fields.created,
                updated: response.fields.updated,
                lastUpdated: Date.now()
            };

            // Cache the issue
            this.issues.set(issueKey, issue);

            this.logger.info('Jira issue fetched successfully', {
                issueKey,
                duration: Date.now() - startTime
            });

            return issue;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('Jira issue fetch failed', {
                issueKey,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async searchIssues(jql, maxResults = 50) {
        const startTime = Date.now();

        try {
            this.logger.info('Searching Jira issues', { jql, maxResults });

            const response = await this.makeJiraRequest('GET', `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`);

            this.logger.info('Jira issue search completed', {
                total: response.total,
                returned: response.issues ? response.issues.length : 0,
                duration: Date.now() - startTime
            });

            return response;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('Jira issue search failed', {
                jql,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async getProject(projectKey) {
        const startTime = Date.now();

        try {
            // Check cache first
            if (this.projects.has(projectKey)) {
                const cached = this.projects.get(projectKey);
                if (Date.now() - cached.lastUpdated < 3600000) { // 1 hour
                    return cached;
                }
            }

            this.logger.info('Fetching Jira project', { projectKey });

            const response = await this.makeJiraRequest('GET', `/project/${projectKey}`);

            const project = {
                key: response.key,
                id: response.id,
                name: response.name,
                description: response.description,
                projectTypeKey: response.projectTypeKey,
                lead: response.lead ? response.lead.emailAddress : null,
                url: response.self,
                lastUpdated: Date.now()
            };

            // Cache the project
            this.projects.set(projectKey, project);

            this.logger.info('Jira project fetched successfully', {
                projectKey,
                duration: Date.now() - startTime
            });

            return project;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('Jira project fetch failed', {
                projectKey,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async makeJiraRequest(method, endpoint, data = null) {
        const startTime = Date.now();

        if (!this.authenticated) {
            throw new Error('Jira service not authenticated');
        }

        this.stats.apiCalls++;

        try {
            const config = {
                method,
                url: `${this.config.jiraUrl}/rest/api/3${endpoint}`,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                auth: {
                    username: this.config.email,
                    password: this.config.apiToken
                },
                timeout: this.config.requestTimeout
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                config.data = data;
            }

            const response = await axios(config);

            this.logger.debug('Jira API call successful', {
                method,
                endpoint,
                status: response.status,
                duration: Date.now() - startTime
            });

            return response.data;

        } catch (error) {
            this.stats.failedCalls++;

            this.logger.error('Jira API call failed', {
                method,
                endpoint,
                error: error.message,
                status: error.response?.status,
                duration: Date.now() - startTime
            });

            throw new Error(`Jira API error: ${error.message}`);
        }
    }

    extractTextFromADF(adfDocument) {
        if (!adfDocument || !adfDocument.content) {
            return '';
        }

        let text = '';

        const extractText = (node) => {
            if (node.type === 'text') {
                text += node.text;
            } else if (node.content) {
                node.content.forEach(extractText);
            }
        };

        adfDocument.content.forEach(extractText);
        return text.trim();
    }

    async coordinateWithServices({ event, ...data }) {
        this.logger.info('Coordinating with other services', { event, data });

        try {
            switch (event) {
                case 'github_pr_created':
                    return await this.handleGitHubPRCreated(data);

                case 'servicenow_incident_created':
                    return await this.handleServiceNowIncident(data);

                case 'workflow_step':
                    return await this.handleWorkflowStep(data);

                default:
                    this.logger.warn('Unknown coordination event', { event });
                    return { success: false, error: `Unknown event: ${event}` };
            }

        } catch (error) {
            this.logger.error('Service coordination failed', {
                event,
                error: error.message
            });
            return { success: false, error: error.message };
        }
    }

    async handleGitHubPRCreated(data) {
        try {
            const issue = await this.createIssue({
                summary: `Code Review: ${data.title}`,
                description: `Pull Request created: ${data.url}\n\nDescription: ${data.description || 'No description provided'}`,
                issueType: 'Task',
                labels: ['code-review', 'github', 'automation'],
                priority: 'Medium'
            });

            return {
                success: true,
                action: 'issue_created',
                issue,
                message: `Jira issue ${issue.key} created for GitHub PR`
            };

        } catch (error) {
            throw new Error(`Failed to create Jira issue for GitHub PR: ${error.message}`);
        }
    }

    async handleServiceNowIncident(data) {
        try {
            const issue = await this.createIssue({
                summary: `ServiceNow Incident: ${data.short_description}`,
                description: `ServiceNow Incident: ${data.number}\n\nDescription: ${data.description}`,
                issueType: 'Bug',
                labels: ['servicenow', 'incident', 'automation'],
                priority: data.urgency === '1' ? 'Highest' : 'High',
                customFields: {
                    'customfield_10001': data.number // ServiceNow incident number
                }
            });

            return {
                success: true,
                action: 'issue_created',
                issue,
                message: `Jira issue ${issue.key} created for ServiceNow incident`
            };

        } catch (error) {
            throw new Error(`Failed to create Jira issue for ServiceNow incident: ${error.message}`);
        }
    }

    async handleWorkflowStep(data) {
        try {
            if (data.step === 'create_issue') {
                return await this.createIssue(data.issueData);
            } else if (data.step === 'update_issue') {
                return await this.updateIssue(data.issueKey, data.updateData);
            } else if (data.step === 'transition_issue') {
                return await this.transitionIssue(data.issueKey, data.transitionId, data.comment);
            } else {
                throw new Error(`Unknown workflow step: ${data.step}`);
            }

        } catch (error) {
            throw new Error(`Workflow step execution failed: ${error.message}`);
        }
    }

    handleWebhook(webhookData) {
        this.logger.info('Processing Jira webhook', {
            eventType: webhookData.webhookEvent,
            issueKey: webhookData.issue?.key
        });

        const event = {
            eventType: webhookData.webhookEvent,
            timestamp: new Date(),
            issueKey: webhookData.issue?.key,
            data: webhookData
        };

        this.webhookEvents.push(event);

        // Keep only last 100 webhook events
        if (this.webhookEvents.length > 100) {
            this.webhookEvents.shift();
        }

        // Invalidate cache for updated issue
        if (webhookData.issue?.key) {
            this.issues.delete(webhookData.issue.key);
        }

        // Here you could trigger notifications to other services
        // e.g., notify Slack about issue updates
    }

    async testConnection() {
        try {
            this.logger.info('Testing Jira connection');

            if (!this.config.email || !this.config.apiToken) {
                throw new Error('Jira email or API token not configured');
            }

            // Test connection by fetching user info
            await this.makeJiraRequest('GET', '/myself');

            this.authenticated = true;

            this.logger.info('Jira connection test successful', {
                jiraUrl: this.config.jiraUrl,
                email: this.config.email
            });

            return true;

        } catch (error) {
            this.authenticated = false;
            this.logger.error('Jira connection test failed', { error: error.message });
            throw error;
        }
    }

    async initialize() {
        try {
            this.logger.info('Initializing Jira Service', {
                port: this.config.port,
                serviceName: this.config.serviceName,
                jiraUrl: this.config.jiraUrl
            });

            // Initialize database connection
            await this.db.initialize();

            // Test Jira connection
            await this.testConnection();

            // Load default project if specified
            if (this.config.defaultProject) {
                try {
                    await this.getProject(this.config.defaultProject);
                    this.logger.info('Default project loaded', {
                        project: this.config.defaultProject
                    });
                } catch (error) {
                    this.logger.warn('Default project not accessible', {
                        project: this.config.defaultProject,
                        error: error.message
                    });
                }
            }

            this.logger.info('Jira Service initialized successfully');

        } catch (error) {
            this.logger.error('Jira Service initialization failed', {
                error: error.message
            });
            throw error;
        }
    }

    async start() {
        try {
            await this.initialize();

            const server = this.app.listen(this.config.port, () => {
                this.logger.info('Jira Service started', {
                    port: this.config.port,
                    serviceName: this.config.serviceName,
                    pid: process.pid,
                    jiraUrl: this.config.jiraUrl
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
            this.logger.error('Failed to start Jira Service', {
                error: error.message
            });
            throw error;
        }
    }
}

// Start service if called directly
if (require.main === module) {
    const service = new LonicFlexJiraService();
    service.start().catch(error => {
        console.error('Failed to start Jira Service:', error.message);
        process.exit(1);
    });
}

module.exports = { LonicFlexJiraService };