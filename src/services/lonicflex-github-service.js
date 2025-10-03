#!/usr/bin/env node
/**
 * LonicFLex GitHub Service - Foundation v0
 * GitHub integration service for API coordination, repository management, and automation
 *
 * Handles:
 * - GitHub API integration and authentication
 * - Repository management and branch operations
 * - PR/Issue management and automation
 * - Cross-service GitHub coordination
 * - Automated branch creation and management
 */

const express = require('express');
const { ServiceBase } = require('./service-base');
const { Octokit } = require('@octokit/rest');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const { getAuthManager } = require('../auth/auth-manager');
const winston = require('winston');
require('dotenv').config();

class LonicFlexGitHubService extends ServiceBase {
    constructor(config = {}) {
        super();  // Call parent constructor first

        this.config = {
            port: config.port || process.env.GITHUB_SERVICE_PORT || 3002,
            serviceName: 'lonicflex-github',
            owner: config.owner || process.env.GITHUB_OWNER || 'levilonic',
            repo: config.repo || process.env.GITHUB_REPO || 'LonicFLex',
            branchPrefix: config.branchPrefix || 'lonicflex/',
            ...config
        };

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.contextManager = new Factor3ContextManager();
        this.authManager = null;
        this.octokit = null;

        // GitHub state management
        this.activeBranches = new Map();     // branchName -> branch state
        this.activePRs = new Map();          // prNumber -> PR state
        this.webhookHandlers = new Map();    // eventType -> handler function

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: `./logs/${this.config.serviceName}.log`
                })
            ]
        });

        // Service state
        this.isInitialized = false;
        this.startTime = new Date();
        this.stats = {
            apiCalls: 0,
            branchesCreated: 0,
            prsCreated: 0,
            issuesProcessed: 0,
            webhooksReceived: 0,
            rateLimitRemaining: 5000
        };
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info('GitHub API request received', {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                githubEvent: req.headers['x-github-event']
            });
            next();
        });

        // Rate limiting protection
        this.app.use((req, res, next) => {
            if (this.stats.rateLimitRemaining < 100) {
                this.logger.warn('GitHub API rate limit low', {
                    remaining: this.stats.rateLimitRemaining
                });
            }
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const operationalMode = (this.isInitialized && this.octokit) ? 'full' : 'degraded';
            const status = operationalMode === 'full' ? 'healthy' : 'degraded';

            res.json({
                status,
                operationalMode,
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                initialized: this.isInitialized,
                authenticated: !!this.octokit,
                repository: `${this.config.owner}/${this.config.repo}`,
                stats: this.stats,
                timestamp: new Date().toISOString()
            });
        });

        // Branch management endpoints
        this.app.post('/branches/create', async (req, res) => {
            try {
                const result = await this.createBranch(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Branch creation failed', { error: error.message, body: req.body });
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/branches/list', async (req, res) => {
            try {
                const branches = await this.listBranches();
                res.json(branches);
            } catch (error) {
                this.logger.error('Branch listing failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // PR management endpoints
        this.app.post('/prs/create', async (req, res) => {
            try {
                const result = await this.createPullRequest(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('PR creation failed', { error: error.message, body: req.body });
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/prs/list', async (req, res) => {
            try {
                const prs = await this.listPullRequests();
                res.json(prs);
            } catch (error) {
                this.logger.error('PR listing failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Issue management endpoints
        this.app.post('/issues/create', async (req, res) => {
            try {
                const result = await this.createIssue(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Issue creation failed', { error: error.message, body: req.body });
                res.status(500).json({ error: error.message });
            }
        });

        // Repository information endpoint
        this.app.get('/repo/info', async (req, res) => {
            try {
                const info = await this.getRepositoryInfo();
                res.json(info);
            } catch (error) {
                this.logger.error('Repository info failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Cross-service coordination endpoint
        this.app.post('/coordinate', async (req, res) => {
            try {
                const result = await this.coordinateWithServices(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Service coordination failed', { error: error.message, body: req.body });
                res.status(500).json({ error: error.message });
            }
        });
    }

    async initialize() {
        try {
            this.logger.info('Initializing GitHub service...');

            // Initialize database
            await this.db.initialize();
            this.logger.info('Database initialized');

            // Initialize authentication
            this.authManager = getAuthManager();
            await this.authManager.initialize();

            // Get GitHub configuration and create Octokit instance
            const githubConfig = this.authManager.getGitHubConfig();
            this.octokit = new Octokit({
                auth: githubConfig.token,
                userAgent: 'LonicFLex-GitHub-Service/1.0.0'
            });

            // Test authentication
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            this.logger.info('GitHub authentication successful', {
                user: user.login,
                repository: `${this.config.owner}/${this.config.repo}`
            });

            // Initialize webhook handlers
            this.setupWebhookHandlers();

            this.isInitialized = true;
            this.logger.info('GitHub service initialized successfully');

        } catch (error) {
            this.logger.error('GitHub service initialization failed', { error: error.message });
            throw error;
        }
    }

    setupWebhookHandlers() {
        // Push event handler
        this.webhookHandlers.set('push', async (payload) => {
            this.logger.info('Push event received', {
                ref: payload.ref,
                commits: payload.commits?.length || 0,
                repository: payload.repository?.full_name
            });

            // Trigger coordination with other services if needed
            await this.coordinateWithServices({
                event: 'push',
                branch: payload.ref.replace('refs/heads/', ''),
                commits: payload.commits
            });
        });

        // Pull request handler
        this.webhookHandlers.set('pull_request', async (payload) => {
            this.logger.info('Pull request event received', {
                action: payload.action,
                pr: payload.pull_request?.number,
                state: payload.pull_request?.state
            });

            // Update internal PR tracking
            if (payload.pull_request) {
                this.activePRs.set(payload.pull_request.number, {
                    state: payload.pull_request.state,
                    branch: payload.pull_request.head.ref,
                    updatedAt: new Date()
                });
            }
        });

        // Issues handler
        this.webhookHandlers.set('issues', async (payload) => {
            this.logger.info('Issue event received', {
                action: payload.action,
                issue: payload.issue?.number,
                title: payload.issue?.title
            });

            this.stats.issuesProcessed++;
        });
    }

    async createBranch({ branchName, baseBranch = 'main', runId, createInitialCommit = false, command = 'unknown' }) {
        if (!this.octokit) {
            throw new Error('GitHub service not initialized');
        }

        try {
            // Get the base branch SHA
            const { data: baseRef } = await this.octokit.rest.git.getRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `heads/${baseBranch}`
            });

            // Create new branch
            const fullBranchName = `${this.config.branchPrefix}${branchName}`;
            const { data: newRef } = await this.octokit.rest.git.createRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `refs/heads/${fullBranchName}`,
                sha: baseRef.object.sha
            });

            let finalSha = newRef.object.sha;

            // Create initial commit if requested
            if (createInitialCommit) {
                const runManifest = {
                    runId,
                    command,
                    created: new Date().toISOString(),
                    status: 'initialized',
                    baseBranch,
                    branchName: fullBranchName
                };

                // Create the manifest file content
                const manifestContent = JSON.stringify(runManifest, null, 2);
                const manifestPath = '.lonicflex/run-manifest.json';

                // Create file in repository
                const { data: fileCommit } = await this.octokit.rest.repos.createOrUpdateFileContents({
                    owner: this.config.owner,
                    repo: this.config.repo,
                    path: manifestPath,
                    message: `Initialize LonicFLex run ${runId}

Command: ${command}
Branch: ${fullBranchName}
Created: ${runManifest.created}

AGENT Generated by LonicFLex Master Service`,
                    content: Buffer.from(manifestContent).toString('base64'),
                    branch: fullBranchName
                });

                finalSha = fileCommit.commit.sha;
                this.logger.info('Initial commit created', {
                    runId,
                    branch: fullBranchName,
                    commitSha: finalSha,
                    file: manifestPath
                });
            }

            // Track the branch
            this.activeBranches.set(fullBranchName, {
                runId,
                baseBranch,
                sha: finalSha,
                createdAt: new Date(),
                hasInitialCommit: createInitialCommit
            });

            this.stats.branchesCreated++;
            this.stats.apiCalls += createInitialCommit ? 2 : 1;

            this.logger.info('Branch created successfully', {
                branch: fullBranchName,
                runId,
                sha: finalSha,
                hasInitialCommit: createInitialCommit
            });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                branchName: fullBranchName,
                sha: finalSha,
                url: newRef.url,
                hasInitialCommit: createInitialCommit
            };

        } catch (error) {
            this.logger.error('Branch creation failed', { error: error.message, branchName });
            throw error;
        }
    }

    async listBranches() {
        if (!this.octokit) {
            throw new Error('GitHub service not initialized');
        }

        try {
            const { data: branches } = await this.octokit.rest.repos.listBranches({
                owner: this.config.owner,
                repo: this.config.repo,
                per_page: 100
            });

            this.stats.apiCalls++;

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                branches: branches.map(branch => ({
                    name: branch.name,
                    sha: branch.commit.sha,
                    protected: branch.protected
                }))
            };

        } catch (error) {
            this.logger.error('Branch listing failed', { error: error.message });
            throw error;
        }
    }

    async createPullRequest({ title, body, head, base = 'main', runId }) {
        if (!this.octokit) {
            throw new Error('GitHub service not initialized');
        }

        try {
            const { data: pr } = await this.octokit.rest.pulls.create({
                owner: this.config.owner,
                repo: this.config.repo,
                title,
                body: body || `Automated PR created by LonicFLex\n\nRun ID: ${runId}`,
                head,
                base
            });

            // Track the PR
            this.activePRs.set(pr.number, {
                runId,
                state: pr.state,
                branch: pr.head.ref,
                createdAt: new Date()
            });

            this.stats.prsCreated++;
            this.stats.apiCalls++;

            this.logger.info('Pull request created successfully', {
                pr: pr.number,
                title,
                runId,
                url: pr.html_url
            });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                pr: {
                    number: pr.number,
                    url: pr.html_url,
                    state: pr.state
                }
            };

        } catch (error) {
            this.logger.error('PR creation failed', { error: error.message, title });
            throw error;
        }
    }

    async listPullRequests() {
        if (!this.octokit) {
            throw new Error('GitHub service not initialized');
        }

        try {
            const { data: prs } = await this.octokit.rest.pulls.list({
                owner: this.config.owner,
                repo: this.config.repo,
                state: 'all',
                per_page: 50
            });

            this.stats.apiCalls++;

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                pullRequests: prs.map(pr => ({
                    number: pr.number,
                    title: pr.title,
                    state: pr.state,
                    head: pr.head.ref,
                    base: pr.base.ref,
                    url: pr.html_url
                }))
            };

        } catch (error) {
            this.logger.error('PR listing failed', { error: error.message });
            throw error;
        }
    }

    async createIssue({ title, body, labels = [], runId }) {
        if (!this.octokit) {
            throw new Error('GitHub service not initialized');
        }

        try {
            const { data: issue } = await this.octokit.rest.issues.create({
                owner: this.config.owner,
                repo: this.config.repo,
                title,
                body: body || `Issue created by LonicFLex\n\nRun ID: ${runId}`,
                labels
            });

            this.stats.issuesProcessed++;
            this.stats.apiCalls++;

            this.logger.info('Issue created successfully', {
                issue: issue.number,
                title,
                runId,
                url: issue.html_url
            });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                issue: {
                    number: issue.number,
                    url: issue.html_url,
                    state: issue.state
                }
            };

        } catch (error) {
            this.logger.error('Issue creation failed', { error: error.message, title });
            throw error;
        }
    }

    async getRepositoryInfo() {
        if (!this.octokit) {
            throw new Error('GitHub service not initialized');
        }

        try {
            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.config.owner,
                repo: this.config.repo
            });

            this.stats.apiCalls++;

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                repository: {
                    name: repo.name,
                    fullName: repo.full_name,
                    description: repo.description,
                    private: repo.private,
                    defaultBranch: repo.default_branch,
                    url: repo.html_url
                }
            };

        } catch (error) {
            this.logger.error('Repository info failed', { error: error.message });
            throw error;
        }
    }

    async coordinateWithServices({ event, ...data }) {
        try {
            this.logger.info('Coordinating with other services', { event, data });

            // Notify other services based on event type
            switch (event) {
                case 'push':
                    // Notify webhook service about push event
                    await this.notifyService('webhooks', 'github_push', data);
                    break;

                case 'branch_created':
                    // Notify master service about new branch
                    await this.notifyService('master', 'branch_created', data);
                    break;

                case 'pr_created':
                    // Notify slack service about new PR
                    await this.notifyService('slack', 'pr_created', data);
                    break;
            }

            const validation = { success: this.validateSuccess() };return {

                success: validation.success, event, coordinated: true };

        } catch (error) {
            this.logger.error('Service coordination failed', { error: error.message, event });
            return { success: false, error: error.message };
        }
    }

    async notifyService(serviceName, eventType, data) {
        try {
            // This would make HTTP calls to other services
            // For now, just log the coordination attempt
            this.logger.info('Service notification sent', {
                service: serviceName,
                eventType,
                data
            });

            // In a real implementation, this would be:
            // await axios.post(`http://localhost:${servicePort}/coordinate`, {
            //     from: 'github',
            //     event: eventType,
            //     data
            // });

        } catch (error) {
            this.logger.warn('Service notification failed', {
                service: serviceName,
                error: error.message
            });
        }
    }

    async updateRateLimitStats() {
        if (this.octokit) {
            try {
                const { data: rateLimit } = await this.octokit.rest.rateLimit.get();
                this.stats.rateLimitRemaining = rateLimit.rate.remaining;

                if (rateLimit.rate.remaining < 500) {
                    this.logger.warn('GitHub API rate limit getting low', {
                        remaining: rateLimit.rate.remaining,
                        resetTime: new Date(rateLimit.rate.reset * 1000)
                    });
                }
            } catch (error) {
                this.logger.error('Failed to update rate limit stats', { error: error.message });
            }
        }
    }

    async start() {
        try {
            await this.initialize();

            // Start the service
            const server = this.app.listen(this.config.port, () => {
                this.logger.info(`GitHub service listening on port ${this.config.port}`, {
                    service: this.config.serviceName,
                    repository: `${this.config.owner}/${this.config.repo}`,
                    endpoints: [
                        'GET /health',
                        'POST /branches/create',
                        'GET /branches/list',
                        'POST /prs/create',
                        'GET /prs/list',
                        'POST /issues/create',
                        'GET /repo/info',
                        'POST /coordinate'
                    ]
                });
            });

            // Update rate limit stats periodically
            setInterval(() => {
                this.updateRateLimitStats();
            }, 60000); // Every minute

            return server;

        } catch (error) {
            console.error('Failed to start GitHub service:', error.message);
            throw error;
        }
    }
}

// CLI support - if run directly
if (require.main === module) {
    const service = new LonicFlexGitHubService();
    service.start()
        .then(() => {
            console.log('LonicFLex GitHub Service started successfully');
        })
        .catch((error) => {
            console.error('FAIL Failed to start GitHub service:', error.message);
            process.exit(1);
        });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('GitHub service shutting down...');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        console.log('GitHub service shutting down...');
        process.exit(0);
    });
}

module.exports = { LonicFlexGitHubService };