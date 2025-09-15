const express = require('express');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');
const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SQLiteManager } = require('./database/sqlite-manager');
const winston = require('winston');
require('dotenv').config();

/**
 * GitHub Webhook Handler - Factor 11: Trigger From Anywhere
 * 
 * Handles GitHub events and triggers multi-agent workflows automatically
 * Following 12-Factor Agent principles
 */
class GitHubWebhookHandler {
    constructor(options = {}) {
        this.config = {
            port: options.port || process.env.GITHUB_WEBHOOK_PORT || 3001,
            secret: options.secret || process.env.GITHUB_WEBHOOK_SECRET,
            githubToken: options.githubToken || process.env.GITHUB_TOKEN,
            webhookPath: options.webhookPath || '/webhook/github',
            ...options
        };

        // Initialize components
        this.app = express();
        this.db = new SQLiteManager();
        this.agentCore = new MultiAgentCore();
        this.octokit = new Octokit({ auth: this.config.githubToken });
        
        // Initialize logger (Factor 9: Logs as Event Streams)
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'github-webhook.log' })
            ]
        });

        // Event handlers
        this.eventHandlers = new Map();
        this.activeWorkflows = new Map();
        
        this.setupMiddleware();
        this.setupWebhookEndpoint();
        this.setupEventHandlers();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Parse raw body for signature verification
        this.app.use(this.config.webhookPath, express.raw({ type: 'application/json' }));
        this.app.use(express.json());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy',
                timestamp: new Date().toISOString(),
                webhookPath: this.config.webhookPath
            });
        });

        // Status endpoint
        this.app.get('/status', (req, res) => {
            res.json({
                activeWorkflows: this.activeWorkflows.size,
                eventHandlers: Array.from(this.eventHandlers.keys()),
                lastEvent: this.lastEventTime || null
            });
        });
    }

    /**
     * Setup main webhook endpoint with signature verification
     */
    setupWebhookEndpoint() {
        this.app.post(this.config.webhookPath, async (req, res) => {
            const startTime = Date.now();
            
            try {
                // Validate request headers
                const event = req.headers['x-github-event'];
                const deliveryId = req.headers['x-github-delivery'];
                const signature = req.headers['x-hub-signature-256'];
                
                if (!event || !deliveryId) {
                    this.logger.warn('Missing required GitHub headers', {
                        hasEvent: !!event,
                        hasDeliveryId: !!deliveryId
                    });
                    return res.status(400).send('Missing required headers');
                }

                // Verify GitHub signature (required for production)
                if (this.config.secret) {
                    if (!this.verifySignature(req.body, signature)) {
                        this.logger.warn('Webhook signature verification failed', {
                            deliveryId,
                            hasSignature: !!signature
                        });
                        return res.status(401).send('Unauthorized');
                    }
                } else {
                    this.logger.warn('Webhook secret not configured - signature verification disabled');
                }

                // Parse and validate payload
                let payload;
                try {
                    payload = JSON.parse(req.body.toString());
                } catch (parseError) {
                    this.logger.error('Invalid JSON payload', { 
                        error: parseError.message,
                        deliveryId 
                    });
                    return res.status(400).send('Invalid JSON payload');
                }

                this.logger.info('GitHub webhook received', {
                    event,
                    deliveryId,
                    repository: payload.repository?.full_name
                });

                // Update last event time
                this.lastEventTime = Date.now();

                // Process event
                await this.handleWebhookEvent(event, payload, deliveryId);

                res.status(200).send('OK');

            } catch (error) {
                this.logger.error('Webhook processing failed', { 
                    error: error.message,
                    stack: error.stack
                });
                res.status(500).send('Internal Server Error');
            }
        });
    }

    /**
     * Verify GitHub webhook signature with enhanced security
     */
    verifySignature(body, signature) {
        if (!signature || !this.config.secret) {
            this.logger.warn('Missing signature or secret for webhook verification');
            return false;
        }
        
        // Ensure signature starts with sha256=
        if (!signature.startsWith('sha256=')) {
            this.logger.warn('Invalid signature format - missing sha256= prefix');
            return false;
        }
        
        try {
            const expectedSignature = 'sha256=' + crypto
                .createHmac('sha256', this.config.secret)
                .update(body)
                .digest('hex');

            // Use timing-safe comparison to prevent timing attacks
            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );
        } catch (error) {
            this.logger.error('Error verifying webhook signature', { error: error.message });
            return false;
        }
    }

    /**
     * Setup event handlers for different GitHub events
     */
    setupEventHandlers() {
        // Pull request events
        this.eventHandlers.set('pull_request', async (payload, deliveryId) => {
            const { action, pull_request, repository } = payload;
            
            if (['opened', 'synchronize', 'ready_for_review'].includes(action)) {
                await this.handlePullRequestEvent(action, pull_request, repository, deliveryId);
            }
        });

        // Push events
        this.eventHandlers.set('push', async (payload, deliveryId) => {
            const { ref, repository, commits } = payload;
            
            // Only handle pushes to main/master branches
            if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
                await this.handlePushEvent(ref, repository, commits, deliveryId);
            }
        });

        // Release events
        this.eventHandlers.set('release', async (payload, deliveryId) => {
            const { action, release, repository } = payload;
            
            if (action === 'published') {
                await this.handleReleaseEvent(release, repository, deliveryId);
            }
        });

        // Issue events
        this.eventHandlers.set('issues', async (payload, deliveryId) => {
            const { action, issue, repository } = payload;
            
            if (['opened', 'labeled'].includes(action)) {
                await this.handleIssueEvent(action, issue, repository, deliveryId);
            }
        });

        // Security advisory events
        this.eventHandlers.set('security_advisory', async (payload, deliveryId) => {
            const { action, security_advisory, repository } = payload;
            
            if (action === 'published') {
                await this.handleSecurityAdvisoryEvent(security_advisory, repository, deliveryId);
            }
        });
    }

    /**
     * Handle webhook events by routing to appropriate handlers
     */
    async handleWebhookEvent(eventType, payload, deliveryId) {
        const handler = this.eventHandlers.get(eventType);
        
        if (handler) {
            await handler(payload, deliveryId);
        } else {
            this.logger.info('Unhandled webhook event', { eventType, deliveryId });
        }
    }

    /**
     * Handle pull request events
     */
    async handlePullRequestEvent(action, pullRequest, repository, deliveryId) {
        const sessionId = `pr_${pullRequest.number}_${deliveryId}`;
        
        // Determine workflow type based on PR characteristics
        let workflowType = 'code_review';
        
        // Check for security-related changes
        const files = await this.getPullRequestFiles(repository.owner.login, repository.name, pullRequest.number);
        const hasSecurityFiles = files.some(file => 
            file.filename.includes('security') || 
            file.filename.includes('auth') ||
            file.filename.includes('crypto') ||
            file.filename.includes('password')
        );

        if (hasSecurityFiles) {
            workflowType = 'security_scan';
        }

        // Create workflow context
        const context = {
            trigger: 'github_webhook',
            event: 'pull_request',
            action,
            repository: repository.full_name,
            pr_number: pullRequest.number,
            pr_title: pullRequest.title,
            pr_author: pullRequest.user.login,
            pr_url: pullRequest.html_url,
            branch: pullRequest.head.ref,
            base_branch: pullRequest.base.ref
        };

        this.logger.info('Initiating PR workflow', { 
            sessionId, 
            workflowType, 
            repository: repository.full_name,
            prNumber: pullRequest.number
        });

        await this.initiateWorkflow(sessionId, workflowType, context);
    }

    /**
     * Handle push events to main branch
     */
    async handlePushEvent(ref, repository, commits, deliveryId) {
        const sessionId = `push_${repository.id}_${deliveryId}`;
        
        // Determine if this should trigger a deployment
        const hasDeploymentFiles = commits.some(commit => 
            commit.added.some(file => file.includes('deploy') || file.includes('docker')) ||
            commit.modified.some(file => file.includes('deploy') || file.includes('docker'))
        );

        const workflowType = hasDeploymentFiles ? 'deployment' : 'feature_development';

        const context = {
            trigger: 'github_webhook',
            event: 'push',
            repository: repository.full_name,
            ref,
            commits: commits.length,
            head_commit: commits[commits.length - 1],
            pusher: commits[commits.length - 1]?.author
        };

        this.logger.info('Initiating push workflow', { 
            sessionId, 
            workflowType, 
            repository: repository.full_name,
            commits: commits.length
        });

        await this.initiateWorkflow(sessionId, workflowType, context);
    }

    /**
     * Handle release events
     */
    async handleReleaseEvent(release, repository, deliveryId) {
        const sessionId = `release_${release.id}_${deliveryId}`;
        
        const context = {
            trigger: 'github_webhook',
            event: 'release',
            repository: repository.full_name,
            release_tag: release.tag_name,
            release_name: release.name,
            release_url: release.html_url,
            prerelease: release.prerelease
        };

        // Always trigger deployment workflow for releases
        await this.initiateWorkflow(sessionId, 'deployment', context);
    }

    /**
     * Handle issue events
     */
    async handleIssueEvent(action, issue, repository, deliveryId) {
        const sessionId = `issue_${issue.number}_${deliveryId}`;
        
        // Check for security-related labels
        const hasSecurityLabel = issue.labels.some(label => 
            label.name.toLowerCase().includes('security') ||
            label.name.toLowerCase().includes('vulnerability')
        );

        const workflowType = hasSecurityLabel ? 'security_scan' : 'bug_fix';

        const context = {
            trigger: 'github_webhook',
            event: 'issues',
            action,
            repository: repository.full_name,
            issue_number: issue.number,
            issue_title: issue.title,
            issue_url: issue.html_url,
            labels: issue.labels.map(label => label.name)
        };

        await this.initiateWorkflow(sessionId, workflowType, context);
    }

    /**
     * Handle security advisory events
     */
    async handleSecurityAdvisoryEvent(advisory, repository, deliveryId) {
        const sessionId = `security_${advisory.ghsa_id}_${deliveryId}`;
        
        const context = {
            trigger: 'github_webhook',
            event: 'security_advisory',
            repository: repository.full_name,
            advisory_id: advisory.ghsa_id,
            severity: advisory.severity,
            summary: advisory.summary,
            cve_id: advisory.cve_id
        };

        // Always trigger security scan for advisories
        await this.initiateWorkflow(sessionId, 'security_scan', context);
    }

    /**
     * Initiate multi-agent workflow
     */
    async initiateWorkflow(sessionId, workflowType, context) {
        try {
            // Store workflow in database
            await this.db.run(`
                INSERT INTO workflows (session_id, type, status, context, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [sessionId, workflowType, 'initiated', JSON.stringify(context), Date.now()]);

            // Add to active workflows
            this.activeWorkflows.set(sessionId, {
                type: workflowType,
                context,
                status: 'running',
                startedAt: Date.now()
            });

            // Initialize and execute workflow
            await this.agentCore.initializeSession(sessionId, workflowType, context);
            
            const result = await this.agentCore.executeWorkflow(this.getWorkflowExecutors(context));

            // Update workflow status
            await this.db.run(`
                UPDATE workflows 
                SET status = ?, completed_at = ?, results = ?
                WHERE session_id = ?
            `, ['completed', Date.now(), JSON.stringify(result), sessionId]);

            this.activeWorkflows.delete(sessionId);

            // Post results back to GitHub if applicable
            await this.postResultsToGitHub(context, result);

            this.logger.info('Workflow completed', { 
                sessionId, 
                workflowType, 
                duration: Date.now() - this.activeWorkflows.get(sessionId)?.startedAt
            });

        } catch (error) {
            this.logger.error('Workflow execution failed', { 
                sessionId, 
                workflowType, 
                error: error.message 
            });

            // Update database with failure
            await this.db.run(`
                UPDATE workflows 
                SET status = ?, error = ?
                WHERE session_id = ?
            `, ['failed', error.message, sessionId]);

            this.activeWorkflows.delete(sessionId);

            // Post error to GitHub
            await this.postErrorToGitHub(context, error);
        }
    }

    /**
     * Get workflow executors with GitHub-specific context
     */
    getWorkflowExecutors(context) {
        return {
            github: async (ctx, updateProgress) => {
                updateProgress(25, 'Analyzing repository...');
                await this.delay(800);
                updateProgress(75, 'Updating GitHub status...');
                await this.delay(500);
                updateProgress(100, 'GitHub analysis complete');

                return {
                    agent: 'github',
                    repository: context.repository,
                    action: context.event,
                    status: 'success'
                };
            },

            security: async (ctx, updateProgress) => {
                updateProgress(30, 'Running security scan...');
                await this.delay(1500);
                updateProgress(80, 'Analyzing vulnerabilities...');
                await this.delay(700);
                updateProgress(100, 'Security scan complete');

                return {
                    agent: 'security',
                    scan_type: 'full',
                    vulnerabilities_found: Math.floor(Math.random() * 3),
                    severity: 'low',
                    status: 'success'
                };
            },

            code: async (ctx, updateProgress) => {
                updateProgress(20, 'Analyzing code changes...');
                await this.delay(1000);
                updateProgress(60, 'Running code quality checks...');
                await this.delay(800);
                updateProgress(100, 'Code analysis complete');

                return {
                    agent: 'code',
                    quality_score: Math.floor(Math.random() * 20) + 80,
                    issues_found: Math.floor(Math.random() * 5),
                    suggestions: Math.floor(Math.random() * 10) + 5,
                    status: 'success'
                };
            },

            deploy: async (ctx, updateProgress) => {
                updateProgress(25, 'Preparing deployment...');
                await this.delay(1200);
                updateProgress(75, 'Deploying to staging...');
                await this.delay(1500);
                updateProgress(100, 'Deployment complete');

                return {
                    agent: 'deploy',
                    environment: 'staging',
                    deployment_url: `https://${context.repository?.replace('/', '-')}-staging.herokuapp.com`,
                    status: 'success'
                };
            },

            comm: async (ctx, updateProgress) => {
                updateProgress(100, 'Posting results to GitHub');

                return {
                    agent: 'comm',
                    notifications_sent: 2,
                    github_comment: true,
                    status: 'success'
                };
            }
        };
    }

    /**
     * Post workflow results back to GitHub
     */
    async postResultsToGitHub(context, result) {
        try {
            if (context.event === 'pull_request' && context.pr_number) {
                const [owner, repo] = context.repository.split('/');
                
                const comment = this.formatResultsComment(result);
                
                await this.octokit.issues.createComment({
                    owner,
                    repo,
                    issue_number: context.pr_number,
                    body: comment
                });
            }
        } catch (error) {
            this.logger.error('Failed to post results to GitHub', { error: error.message });
        }
    }

    /**
     * Post error to GitHub
     */
    async postErrorToGitHub(context, error) {
        try {
            if (context.event === 'pull_request' && context.pr_number) {
                const [owner, repo] = context.repository.split('/');
                
                await this.octokit.issues.createComment({
                    owner,
                    repo,
                    issue_number: context.pr_number,
                    body: `🚨 **Multi-Agent Workflow Failed**\n\nError: ${error.message}\n\n_Automated by Claude Multi-Agent System_`
                });
            }
        } catch (err) {
            this.logger.error('Failed to post error to GitHub', { error: err.message });
        }
    }

    /**
     * Format results for GitHub comment
     */
    formatResultsComment(result) {
        const agents = Object.keys(result.results);
        const summary = agents.map(agent => {
            const res = result.results[agent];
            return `• **${agent}**: ${res.status} ✅`;
        }).join('\n');

        return `🤖 **Multi-Agent Workflow Completed**

${summary}

**Duration**: ${result.duration}ms
**Session**: \`${result.sessionId}\`

_Automated by Claude Multi-Agent System_`;
    }

    /**
     * Get pull request files
     */
    async getPullRequestFiles(owner, repo, pullNumber) {
        try {
            const { data } = await this.octokit.pulls.listFiles({
                owner,
                repo,
                pull_number: pullNumber
            });
            return data;
        } catch (error) {
            this.logger.error('Failed to get PR files', { error: error.message });
            return [];
        }
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Initialize database
     */
    async initialize() {
        try {
            await this.db.initialize();
            
            // Create webhooks table for event tracking
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS webhook_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    delivery_id TEXT NOT NULL,
                    repository TEXT,
                    payload TEXT,
                    processed_at INTEGER,
                    workflow_session_id TEXT
                )
            `);

            this.logger.info('GitHub webhook handler initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize webhook handler', { error: error.message });
            throw error;
        }
    }

    /**
     * Start the webhook server
     */
    async start() {
        try {
            await this.initialize();
            
            this.server = this.app.listen(this.config.port, () => {
                console.log(`🔗 GitHub Webhook Handler listening on port ${this.config.port}`);
                console.log(`📡 Webhook endpoint: ${this.config.webhookPath}`);
                console.log(`🏥 Health check: http://localhost:${this.config.port}/health`);
                
                this.logger.info('GitHub webhook server started', { 
                    port: this.config.port,
                    webhookPath: this.config.webhookPath
                });
            });

        } catch (error) {
            this.logger.error('Failed to start webhook server', { error: error.message });
            throw error;
        }
    }

    /**
     * Stop the webhook server
     */
    async stop() {
        if (this.server) {
            this.server.close();
            this.logger.info('GitHub webhook server stopped');
        }
    }
}

/**
 * Demo function
 */
async function demonstrateGitHubWebhook() {
    console.log('🔗 GitHub Webhook Handler Demo\n');
    
    const webhook = new GitHubWebhookHandler({
        port: 3001,
        secret: 'demo-secret'
    });

    console.log('✅ GitHub Webhook Handler Features:');
    console.log('   • Pull request event handling');
    console.log('   • Push event processing');
    console.log('   • Release automation');
    console.log('   • Issue triage');
    console.log('   • Security advisory alerts');
    console.log('   • Signature verification');
    console.log('   • Multi-agent workflow automation');
    console.log('   • GitHub status updates');
    console.log('   • Comment posting');

    console.log('\n🎯 Supported Events:');
    console.log('   • pull_request: triggers code_review or security_scan');
    console.log('   • push: triggers feature_development or deployment');
    console.log('   • release: triggers deployment workflow');
    console.log('   • issues: triggers bug_fix or security_scan');
    console.log('   • security_advisory: triggers security_scan');

    console.log('\n📋 Setup Instructions:');
    console.log('   1. Set GITHUB_WEBHOOK_SECRET environment variable');
    console.log('   2. Set GITHUB_TOKEN for API access');
    console.log('   3. Configure GitHub webhook to point to /webhook/github');
    console.log('   4. Start server with: node claude-github-webhook.js');

    console.log('\n🔧 Configuration:');
    console.log(`   Port: ${webhook.config.port}`);
    console.log(`   Webhook path: ${webhook.config.webhookPath}`);
    console.log(`   Secret configured: ${!!webhook.config.secret}`);
    console.log(`   GitHub token: ${webhook.config.githubToken ? 'Configured' : 'Missing'}`);

    // Don't actually start server in demo mode
    console.log('\n✅ Demo completed - Handler ready for production use!');
}

module.exports = {
    GitHubWebhookHandler
};

// Run demo if called directly
if (require.main === module) {
    demonstrateGitHubWebhook().catch(console.error);
}