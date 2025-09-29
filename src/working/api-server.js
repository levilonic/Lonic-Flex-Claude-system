/**
 * LonicFLex API Server - Production Express Server
 * Real API endpoints exposing working agent functionality
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import working components
const { AgentCoordinator } = require('./agent-coordinator');
const { GitHubReal } = require('./github-real');
const { CodeAgentWorking } = require('./code-agent-working');
const { SecurityAgentWorking } = require('./security-agent-working');
const { PRReviewWorkflow } = require('./pr-review-workflow');
const { DatabaseSimple } = require('./database-simple');

class LonicFLexAPI {
    constructor(options = {}) {
        this.app = express();
        this.port = options.port || 3000;

        // Initialize working agents
        this.github = new GitHubReal();
        this.codeAgent = new CodeAgentWorking({ outputDir: './generated' });
        this.securityAgent = new SecurityAgentWorking();
        this.coordinator = new AgentCoordinator({ outputDir: './generated' });
        this.prWorkflow = new PRReviewWorkflow();
        this.db = new DatabaseSimple();

        // Request context
        this.activeRequests = new Map();

        // Initialize Slack webhook URL
        this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.SLACK_BOT_TOKEN;

        // Initialize job queue
        this.jobQueue = [];
        this.processing = false;
        this.completedJobs = new Map(); // Store last 100 completed jobs

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Request ID tracking
        this.app.use((req, res, next) => {
            req.id = uuidv4();
            req.startTime = Date.now();
            res.setHeader('X-Request-ID', req.id);

            console.log(`[${req.id}] ${req.method} ${req.url} - Started`);

            // Track request
            this.activeRequests.set(req.id, {
                method: req.method,
                url: req.url,
                startTime: req.startTime
            });

            // Cleanup on response end
            res.on('finish', () => {
                const duration = Date.now() - req.startTime;
                console.log(`[${req.id}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
                this.activeRequests.delete(req.id);
            });

            next();
        });

        // CORS
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
            credentials: true
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            if (req.body && Object.keys(req.body).length > 0) {
                console.log(`[${req.id}] Body:`, JSON.stringify(req.body, null, 2));
            }
            next();
        });
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: {
                    used: Math.round(process.memoryUsage().rss / 1024 / 1024),
                    heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
                },
                activeRequests: this.activeRequests.size,
                version: require('../../package.json').version
            });
        });

        // System status endpoint
        this.app.get('/api/system/status', this.asyncHandler(async (req, res) => {
            const status = {
                api: { status: 'working', port: this.port },
                github: this.github.getStatus(),
                codeAgent: this.codeAgent.getStatus(),
                securityAgent: this.securityAgent.getStatus(),
                coordinator: this.coordinator.getStatus()
            };

            // Test database
            try {
                await this.db.initialize();
                status.database = { status: 'working', type: 'sqlite' };
                await this.db.close();
            } catch (error) {
                status.database = { status: 'error', error: error.message };
            }

            const workingCount = Object.values(status)
                .filter(s => s.status === 'working' || s.connected === true).length;

            const totalCount = Object.keys(status).length;
            const healthPercentage = Math.round((workingCount / totalCount) * 100);

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                components: status,
                summary: {
                    working: workingCount,
                    total: totalCount,
                    health: `${healthPercentage}%`
                }
            });
        }));

        // GitHub endpoints
        this.app.get('/api/github/status', this.asyncHandler(async (req, res) => {
            const status = this.github.getStatus();
            res.json({
                success: true,
                data: status
            });
        }));

        // GitHub Webhook endpoint
        this.app.post('/webhooks/github', this.asyncHandler(async (req, res) => {
            const signature = req.headers['x-hub-signature-256'];
            const event = req.headers['x-github-event'];
            const delivery = req.headers['x-github-delivery'];

            console.log(`[${req.id}] GitHub webhook received:`);
            console.log(`  Event: ${event}`);
            console.log(`  Delivery: ${delivery}`);
            console.log(`  Payload keys: ${Object.keys(req.body).join(', ')}`);

            // Verify signature if webhook secret is set
            const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
            if (webhookSecret && signature) {
                const crypto = require('crypto');
                const expectedSignature = 'sha256=' + crypto
                    .createHmac('sha256', webhookSecret)
                    .update(JSON.stringify(req.body))
                    .digest('hex');

                if (signature !== expectedSignature) {
                    console.log(`[${req.id}] Webhook signature verification failed`);
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid signature'
                    });
                }
            }

            // Process different event types
            const result = await this.processGitHubWebhook(event, req.body, req.id);

            res.json({
                success: true,
                event,
                delivery,
                processed: result,
                timestamp: new Date().toISOString()
            });
        }));

        // Slack notification test endpoint
        this.app.post('/api/slack/notify', this.asyncHandler(async (req, res) => {
            const { message, options } = req.body;

            if (!message) {
                return res.status(400).json({
                    success: false,
                    error: 'message is required'
                });
            }

            console.log(`[${req.id}] Sending Slack notification: ${message.substring(0, 50)}...`);

            await this.notifySlack(message, options);

            res.json({
                success: true,
                message: 'Slack notification sent',
                timestamp: new Date().toISOString(),
                hasSlackUrl: !!this.slackWebhookUrl
            });
        }));

        // Job Queue endpoints
        this.app.post('/api/jobs', this.asyncHandler(async (req, res) => {
            const { type, payload } = req.body;

            if (!type) {
                return res.status(400).json({
                    success: false,
                    error: 'job type is required'
                });
            }

            const job = {
                id: uuidv4(),
                type,
                payload: payload || {},
                status: 'pending',
                createdAt: new Date().toISOString(),
                requestId: req.id
            };

            this.jobQueue.push(job);
            console.log(`[${req.id}] Job ${job.id} queued: ${type}`);

            // Start processing if not already running
            this.processJobs();

            res.json({
                success: true,
                jobId: job.id,
                status: 'queued',
                position: this.jobQueue.length,
                timestamp: new Date().toISOString()
            });
        }));

        this.app.get('/api/jobs/:id', this.asyncHandler(async (req, res) => {
            const { id } = req.params;

            // Check completed jobs first
            const completedJob = this.completedJobs.get(id);
            if (completedJob) {
                return res.json({
                    success: true,
                    job: completedJob
                });
            }

            // Check pending queue
            const pendingJob = this.jobQueue.find(job => job.id === id);
            if (pendingJob) {
                return res.json({
                    success: true,
                    job: pendingJob
                });
            }

            // Job not found
            res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }));

        this.app.get('/api/jobs', this.asyncHandler(async (req, res) => {
            const { limit = 20, status } = req.query;

            let jobs = [];

            // Add pending jobs
            jobs.push(...this.jobQueue.map(job => ({ ...job, source: 'queue' })));

            // Add completed jobs (last 20)
            const completed = Array.from(this.completedJobs.values())
                .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
                .slice(0, parseInt(limit))
                .map(job => ({ ...job, source: 'completed' }));

            jobs.push(...completed);

            // Filter by status if provided
            if (status) {
                jobs = jobs.filter(job => job.status === status);
            }

            res.json({
                success: true,
                jobs: jobs.slice(0, parseInt(limit)),
                stats: {
                    pending: this.jobQueue.length,
                    completed: this.completedJobs.size,
                    processing: this.processing
                }
            });
        }));

        // PR Review endpoint
        this.app.post('/api/pr-review', this.asyncHandler(async (req, res) => {
            const { prNumber } = req.body;

            if (!prNumber || !Number.isInteger(prNumber)) {
                return res.status(400).json({
                    success: false,
                    error: 'prNumber is required and must be an integer'
                });
            }

            console.log(`[${req.id}] Starting PR review for #${prNumber}`);
            const review = await this.prWorkflow.execute(prNumber);

            res.json({
                success: true,
                data: review,
                metadata: {
                    requestId: req.id,
                    timestamp: new Date().toISOString()
                }
            });
        }));

        // Code generation endpoint
        this.app.post('/api/code/generate', this.asyncHandler(async (req, res) => {
            const { type, name, description, ...options } = req.body;

            if (!type || !name) {
                return res.status(400).json({
                    success: false,
                    error: 'type and name are required'
                });
            }

            if (!['function', 'class', 'module'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    error: 'type must be one of: function, class, module'
                });
            }

            console.log(`[${req.id}] Generating ${type}: ${name}`);

            let context = { action: `generate-${type}`, name, description };

            if (type === 'function') {
                context.params = options.params || ['input'];
                context.body = options.body || 'return input;';
            } else if (type === 'class') {
                context.methods = options.methods || [
                    { name: 'process', params: ['data'], body: 'return data;' }
                ];
                context.properties = options.properties || ['data'];
                context.generateTests = options.generateTests !== false;
            }

            const result = await this.codeAgent.executeWorkflow(context);

            res.json({
                success: true,
                data: result,
                metadata: {
                    requestId: req.id,
                    timestamp: new Date().toISOString()
                }
            });
        }));

        // Security scan endpoint
        this.app.post('/api/security/scan', this.asyncHandler(async (req, res) => {
            const { path, action } = req.body;

            if (!path) {
                return res.status(400).json({
                    success: false,
                    error: 'path is required'
                });
            }

            const context = {
                action: action || 'scan-file',
                path,
                filePath: path // For scan-file action
            };

            console.log(`[${req.id}] Security scanning: ${path}`);
            const result = await this.securityAgent.executeWorkflow(context);

            res.json({
                success: true,
                data: result,
                metadata: {
                    requestId: req.id,
                    timestamp: new Date().toISOString()
                }
            });
        }));

        // Multi-agent workflow endpoint
        this.app.post('/api/workflows/run', this.asyncHandler(async (req, res) => {
            const { workflow, ...params } = req.body;

            if (!workflow) {
                return res.status(400).json({
                    success: false,
                    error: 'workflow is required'
                });
            }

            console.log(`[${req.id}] Running workflow: ${workflow}`);

            let result;
            switch (workflow) {
                case 'review-fix':
                    result = await this.coordinator.executeWorkflow_ReviewAndFix(
                        params.prNumber,
                        params.description
                    );
                    break;

                case 'generate-scan':
                    result = await this.coordinator.executeWorkflow_GenerateAndScan(
                        params.codeType,
                        params.codeName,
                        params.description
                    );
                    break;

                case 'full-feature':
                    result = await this.coordinator.executeWorkflow_FullFeature(
                        params.featureName,
                        params.codeSpecs
                    );
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        error: `Unknown workflow: ${workflow}. Available: review-fix, generate-scan, full-feature`
                    });
            }

            res.json({
                success: true,
                data: result,
                metadata: {
                    requestId: req.id,
                    timestamp: new Date().toISOString()
                }
            });
        }));

        // API documentation endpoint
        this.app.get('/api/docs', (req, res) => {
            res.json({
                name: 'LonicFLex API',
                version: require('../../package.json').version,
                endpoints: {
                    'GET /health': 'Server health check',
                    'GET /api/system/status': 'System component status',
                    'GET /api/github/status': 'GitHub integration status',
                    'POST /api/pr-review': 'Review a GitHub PR',
                    'POST /api/code/generate': 'Generate code (function/class/module)',
                    'POST /api/security/scan': 'Security scan files',
                    'POST /api/workflows/run': 'Run multi-agent workflows'
                },
                examples: {
                    prReview: { prNumber: 123 },
                    codeGenerate: { type: 'class', name: 'UserService', description: 'User management service' },
                    securityScan: { path: './src/example.js' },
                    workflow: { workflow: 'generate-scan', codeType: 'class', codeName: 'PaymentService' }
                }
            });
        });
    }

    /**
     * Setup error handling middleware
     */
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                availableEndpoints: [
                    'GET /health',
                    'GET /api/docs',
                    'GET /api/system/status',
                    'GET /api/github/status',
                    'POST /webhooks/github',
                    'POST /api/slack/notify',
                    'POST /api/jobs',
                    'GET /api/jobs',
                    'GET /api/jobs/:id',
                    'POST /api/pr-review',
                    'POST /api/code/generate',
                    'POST /api/security/scan',
                    'POST /api/workflows/run'
                ]
            });
        });

        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error(`[${req.id}] Error:`, error);

            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
                requestId: req.id,
                timestamp: new Date().toISOString()
            });
        });
    }

    /**
     * Process GitHub webhook events
     */
    async processGitHubWebhook(event, payload, requestId) {
        try {
            switch (event) {
                case 'pull_request':
                    return await this.handlePullRequestWebhook(payload, requestId);

                case 'push':
                    return await this.handlePushWebhook(payload, requestId);

                case 'issues':
                    return await this.handleIssueWebhook(payload, requestId);

                case 'ping':
                    console.log(`[${requestId}] GitHub webhook ping received`);
                    return { type: 'ping', message: 'pong' };

                default:
                    console.log(`[${requestId}] Unhandled GitHub event: ${event}`);
                    return { type: 'unhandled', event };
            }
        } catch (error) {
            console.error(`[${requestId}] Error processing GitHub webhook:`, error);
            return { type: 'error', message: error.message };
        }
    }

    /**
     * Handle pull request webhooks
     */
    async handlePullRequestWebhook(payload, requestId) {
        const { action, pull_request } = payload;
        const prNumber = pull_request.number;

        console.log(`[${requestId}] PR #${prNumber} ${action}: ${pull_request.title}`);

        // Auto-review on PR opened or synchronize (new commits)
        if (action === 'opened' || action === 'synchronize') {
            console.log(`[${requestId}] Auto-reviewing PR #${prNumber}`);

            try {
                const review = await this.prWorkflow.execute(prNumber);
                console.log(`[${requestId}] PR #${prNumber} auto-review completed: ${review.overallScore}/100`);

                // Send Slack notification
                const score = review.overallScore;
                const emoji = score >= 90 ? ':white_check_mark:' : score >= 70 ? ':warning:' : ':x:';
                await this.notifySlack(
                    `${emoji} PR #${prNumber} auto-reviewed: ${score}/100\n` +
                    `*${pull_request.title}*\n` +
                    `Author: ${pull_request.user?.login || 'unknown'}\n` +
                    `Action: ${action}`
                );

                return {
                    type: 'pr_auto_reviewed',
                    prNumber,
                    action,
                    score: review.overallScore,
                    title: pull_request.title
                };
            } catch (error) {
                console.error(`[${requestId}] Failed to auto-review PR #${prNumber}:`, error);
                return {
                    type: 'pr_review_failed',
                    prNumber,
                    action,
                    error: error.message
                };
            }
        }

        return {
            type: 'pr_event',
            prNumber,
            action,
            title: pull_request.title
        };
    }

    /**
     * Handle push webhooks
     */
    async handlePushWebhook(payload, requestId) {
        const { ref, commits, repository } = payload;
        const branch = ref.replace('refs/heads/', '');

        console.log(`[${requestId}] Push to ${branch}: ${commits.length} commits`);

        return {
            type: 'push',
            branch,
            commits: commits.length,
            repository: repository.name
        };
    }

    /**
     * Handle issue webhooks
     */
    async handleIssueWebhook(payload, requestId) {
        const { action, issue } = payload;

        console.log(`[${requestId}] Issue #${issue.number} ${action}: ${issue.title}`);

        return {
            type: 'issue',
            number: issue.number,
            action,
            title: issue.title
        };
    }

    /**
     * Async error handler wrapper
     */
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Process jobs from the queue
     */
    async processJobs() {
        if (this.processing || this.jobQueue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.jobQueue.length > 0) {
            const job = this.jobQueue.shift();
            job.status = 'processing';
            job.startedAt = new Date().toISOString();

            console.log(`Processing job ${job.id}: ${job.type}`);

            try {
                const result = await this.executeJob(job);

                job.status = 'completed';
                job.completedAt = new Date().toISOString();
                job.result = result;

                console.log(`Job ${job.id} completed successfully`);

                // Send completion notification
                if (result && result.notify) {
                    await this.notifySlack(`✅ Job completed: ${job.type} (${job.id})`);
                }

            } catch (error) {
                job.status = 'failed';
                job.completedAt = new Date().toISOString();
                job.error = error.message;

                console.error(`Job ${job.id} failed:`, error);

                // Send failure notification
                await this.notifySlack(`❌ Job failed: ${job.type} (${job.id}) - ${error.message}`);
            }

            // Store completed job (keep last 100)
            this.completedJobs.set(job.id, job);
            if (this.completedJobs.size > 100) {
                const oldest = Array.from(this.completedJobs.keys())[0];
                this.completedJobs.delete(oldest);
            }
        }

        this.processing = false;
    }

    /**
     * Execute a specific job based on its type
     */
    async executeJob(job) {
        switch (job.type) {
            case 'pr-review':
                const prNumber = job.payload.prNumber;
                const review = await this.prWorkflow.execute(prNumber);
                return {
                    type: 'pr-review',
                    prNumber,
                    score: review.overallScore,
                    analysis: review.analysis,
                    notify: true
                };

            case 'code-generate':
                const { type, name, description } = job.payload;
                const context = {
                    action: `generate-${type}`,
                    name,
                    description,
                    params: job.payload.params || ['input'],
                    body: job.payload.body || 'return input;'
                };
                const codeResult = await this.codeAgent.executeWorkflow(context);
                return {
                    type: 'code-generate',
                    codeType: type,
                    name,
                    files: codeResult.files,
                    notify: false
                };

            case 'security-scan':
                const scanPath = job.payload.path || './src';
                const scanContext = {
                    action: 'scan-directory',
                    path: scanPath
                };
                const scanResult = await this.securityAgent.executeWorkflow(scanContext);
                return {
                    type: 'security-scan',
                    path: scanPath,
                    issues: scanResult.scan?.issues || 0,
                    files: scanResult.scan?.files?.length || 0,
                    notify: scanResult.scan?.issues > 0
                };

            case 'workflow':
                const workflowName = job.payload.workflow;
                const workflowResult = await this.coordinator.executeWorkflow_GenerateAndScan(
                    job.payload.codeType || 'function',
                    job.payload.codeName || 'defaultName',
                    job.payload.description || 'Generated workflow'
                );
                return {
                    type: 'workflow',
                    workflow: workflowName,
                    steps: workflowResult.steps?.length || 0,
                    notify: true
                };

            default:
                throw new Error(`Unknown job type: ${job.type}`);
        }
    }

    /**
     * Send notification to Slack
     */
    async notifySlack(message, options = {}) {
        if (!this.slackWebhookUrl) {
            console.log('Slack notification skipped (no webhook URL configured)');
            return;
        }

        try {
            const payload = {
                text: message,
                username: 'LonicFLex API',
                icon_emoji: ':robot_face:',
                ...options
            };

            const response = await fetch(this.slackWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error('Slack notification failed:', response.status, response.statusText);
            } else {
                console.log('Slack notification sent successfully');
            }
        } catch (error) {
            console.error('Slack notification error:', error.message);
        }
    }

    /**
     * Start the server
     */
    async start() {
        try {
            // Initialize database
            await this.db.initialize();
            console.log('✅ Database initialized');

            // Start server
            return new Promise((resolve) => {
                this.server = this.app.listen(this.port, () => {
                    console.log(`\n🚀 LonicFLex API Server running on port ${this.port}`);
                    console.log(`   Health: http://localhost:${this.port}/health`);
                    console.log(`   Docs:   http://localhost:${this.port}/api/docs`);
                    console.log(`   Status: http://localhost:${this.port}/api/system/status`);
                    resolve();
                });
            });
        } catch (error) {
            console.error('❌ Failed to start API server:', error);
            throw error;
        }
    }

    /**
     * Stop the server
     */
    async stop() {
        if (this.server) {
            await new Promise(resolve => this.server.close(resolve));
            console.log('🛑 API Server stopped');
        }

        if (this.db) {
            await this.db.close();
            console.log('🛑 Database closed');
        }
    }
}

module.exports = { LonicFLexAPI };

// Start server if run directly
if (require.main === module) {
    const api = new LonicFLexAPI();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, shutting down gracefully');
        await api.stop();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('SIGINT received, shutting down gracefully');
        await api.stop();
        process.exit(0);
    });

    api.start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}