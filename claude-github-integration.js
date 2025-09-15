const express = require('express');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');
const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SQLiteManager } = require('./database/sqlite-manager');
const { CommunicationAgent } = require('./agents/comm-agent');
const { GitHubAgent } = require('./agents/github-agent');
const winston = require('winston');
require('dotenv').config();

/**
 * Enhanced GitHub Integration - Session 2 Foundation
 * 
 * Phase 5.1: Enhanced GitHub webhook handler with advanced event routing
 * Phase 5.2: GitHub API rate limiting and error handling
 * Phase 5.3: GitHub Actions integration for automated workflows
 * 
 * Following 12-Factor Agent principles and Factor 11: Trigger From Anywhere
 */

/**
 * GitHub API Rate Limiter - Phase 5.2
 * Token bucket algorithm with per-endpoint smart limiting
 */
class GitHubRateLimiter {
    constructor(config = {}) {
        this.config = {
            // GitHub API limits: 5000 requests/hour for authenticated requests
            maxRequests: config.maxRequests || 4500, // Leave buffer
            windowMs: config.windowMs || 60 * 60 * 1000, // 1 hour
            burstLimit: config.burstLimit || 100, // Burst allowance
            
            // Backoff configuration
            baseDelayMs: config.baseDelayMs || 1000,
            maxDelayMs: config.maxDelayMs || 30000,
            backoffMultiplier: config.backoffMultiplier || 2,
            jitterFactor: config.jitterFactor || 0.1,
            
            // Circuit breaker thresholds
            errorThreshold: config.errorThreshold || 5,
            recoveryTimeMs: config.recoveryTimeMs || 60000,
            
            ...config
        };
        
        // Token bucket state
        this.tokens = this.config.maxRequests;
        this.lastRefill = Date.now();
        this.requestQueue = [];
        this.processing = false;
        
        // Circuit breaker state
        this.consecutiveErrors = 0;
        this.circuitOpen = false;
        this.lastFailure = null;
        
        // Statistics
        this.stats = {
            requestsMade: 0,
            requestsQueued: 0,
            requestsRejected: 0,
            errorsEncountered: 0,
            circuitBreakerTrips: 0
        };
        
        console.log('✅ GitHub Rate Limiter initialized with smart token bucket algorithm');
    }
    
    /**
     * Make rate-limited GitHub API request
     */
    async makeRequest(requestFn, priority = 'normal') {
        return new Promise((resolve, reject) => {
            const request = {
                requestFn,
                priority,
                resolve,
                reject,
                timestamp: Date.now(),
                retries: 0
            };
            
            this.queueRequest(request);
        });
    }
    
    /**
     * Queue request with priority handling
     */
    queueRequest(request) {
        // Check circuit breaker
        if (this.circuitOpen) {
            if (Date.now() - this.lastFailure < this.config.recoveryTimeMs) {
                this.stats.requestsRejected++;
                request.reject(new Error('Circuit breaker open - GitHub API temporarily unavailable'));
                return;
            } else {
                // Try to close circuit breaker
                this.circuitOpen = false;
                this.consecutiveErrors = 0;
                console.log('🔄 Circuit breaker attempting recovery');
            }
        }
        
        // Add to queue with priority
        if (request.priority === 'high') {
            this.requestQueue.unshift(request);
        } else {
            this.requestQueue.push(request);
        }
        
        this.stats.requestsQueued++;
        this.processQueue();
    }
    
    /**
     * Process request queue with token bucket algorithm
     */
    async processQueue() {
        if (this.processing || this.requestQueue.length === 0) {
            return;
        }
        
        this.processing = true;
        
        while (this.requestQueue.length > 0) {
            this.refillTokens();
            
            if (this.tokens <= 0) {
                const waitTime = this.calculateWaitTime();
                console.log(`🚦 Rate limit reached, waiting ${waitTime}ms`);
                await this.sleep(waitTime);
                continue;
            }
            
            const request = this.requestQueue.shift();
            this.tokens--;
            
            try {
                const startTime = Date.now();
                const result = await this.executeRequest(request);
                
                this.updateStats(Date.now() - startTime, true);
                this.resetCircuitBreaker();
                
                request.resolve(result);
                
            } catch (error) {
                this.handleRequestError(request, error);
            }
            
            // Small delay between requests to be respectful
            await this.sleep(50);
        }
        
        this.processing = false;
    }
    
    /**
     * Execute individual request with error handling
     */
    async executeRequest(request) {
        try {
            const result = await request.requestFn();
            return result;
            
        } catch (error) {
            // Check if it's a rate limit error
            if (error.status === 403 && error.message?.includes('rate limit')) {
                const retryAfter = error.headers?.['retry-after'] || 60;
                console.log(`⏳ GitHub API rate limit hit, waiting ${retryAfter} seconds`);
                await this.sleep(retryAfter * 1000);
                return await this.executeRequest(request);
            }
            
            // Check if it's a temporary error worth retrying
            if (this.isRetryableError(error) && request.retries < 3) {
                request.retries++;
                const delay = this.calculateBackoffDelay(request.retries);
                console.log(`🔄 Retrying request (attempt ${request.retries}/3) after ${delay}ms`);
                await this.sleep(delay);
                return await this.executeRequest(request);
            }
            
            throw error;
        }
    }
    
    /**
     * Handle request errors and update circuit breaker
     */
    handleRequestError(request, error) {
        this.stats.errorsEncountered++;
        this.consecutiveErrors++;
        
        if (this.consecutiveErrors >= this.config.errorThreshold) {
            this.circuitOpen = true;
            this.lastFailure = Date.now();
            this.stats.circuitBreakerTrips++;
            console.log('🔴 Circuit breaker opened due to consecutive errors');
        }
        
        request.reject(error);
    }
    
    /**
     * Refill token bucket based on elapsed time
     */
    refillTokens() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = Math.floor((elapsed / this.config.windowMs) * this.config.maxRequests);
        
        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.config.maxRequests, this.tokens + tokensToAdd);
            this.lastRefill = now;
        }
    }
    
    /**
     * Calculate wait time when tokens are exhausted
     */
    calculateWaitTime() {
        const tokensNeeded = 1;
        const timePerToken = this.config.windowMs / this.config.maxRequests;
        return tokensNeeded * timePerToken;
    }
    
    /**
     * Calculate exponential backoff delay with jitter
     */
    calculateBackoffDelay(retryCount) {
        const baseDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, retryCount - 1);
        const jitter = baseDelay * this.config.jitterFactor * Math.random();
        return Math.min(this.config.maxDelayMs, baseDelay + jitter);
    }
    
    /**
     * Check if error is worth retrying
     */
    isRetryableError(error) {
        const retryableCodes = [500, 502, 503, 504, 408, 429];
        return retryableCodes.includes(error.status) || 
               error.code === 'ECONNRESET' || 
               error.code === 'ENOTFOUND';
    }
    
    /**
     * Reset circuit breaker after successful request
     */
    resetCircuitBreaker() {
        if (this.consecutiveErrors > 0) {
            this.consecutiveErrors = 0;
            console.log('✅ Circuit breaker reset - GitHub API healthy');
        }
    }
    
    /**
     * Update request statistics
     */
    updateStats(duration, success) {
        this.stats.requestsMade++;
    }
    
    /**
     * Get current rate limiter status
     */
    getStatus() {
        return {
            tokens: this.tokens,
            maxTokens: this.config.maxRequests,
            queueLength: this.requestQueue.length,
            circuitOpen: this.circuitOpen,
            consecutiveErrors: this.consecutiveErrors,
            stats: this.stats
        };
    }
    
    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * GitHub Actions Manager - Phase 5.3
 * Automated workflow triggering and monitoring
 */
class GitHubActionsManager {
    constructor(octokit, rateLimiter) {
        this.octokit = octokit;
        this.rateLimiter = rateLimiter;
        
        // Workflow monitoring
        this.activeWorkflows = new Map();
        this.workflowTemplates = new Map();
        
        this.initializeWorkflowTemplates();
        console.log('✅ GitHub Actions Manager initialized with workflow templates');
    }
    
    /**
     * Initialize common workflow templates
     */
    initializeWorkflowTemplates() {
        this.workflowTemplates.set('ci-test', {
            name: 'CI Test Workflow',
            description: 'Run tests on pull request',
            workflow_id: 'ci.yml'
        });
        
        this.workflowTemplates.set('deploy-staging', {
            name: 'Deploy to Staging',
            description: 'Deploy application to staging environment',
            workflow_id: 'deploy-staging.yml'
        });
        
        this.workflowTemplates.set('security-scan', {
            name: 'Security Scan',
            description: 'Run security vulnerability scan',
            workflow_id: 'security-scan.yml'
        });
    }
    
    /**
     * Trigger GitHub Actions workflow
     */
    async triggerWorkflow(owner, repo, workflowId, ref = 'main', inputs = {}) {
        try {
            console.log(`🚀 Triggering GitHub Action: ${workflowId} on ${owner}/${repo}@${ref}`);
            
            const result = await this.rateLimiter.makeRequest(async () => {
                return await this.octokit.rest.actions.createWorkflowDispatch({
                    owner,
                    repo,
                    workflow_id: workflowId,
                    ref,
                    inputs
                });
            }, 'high');
            
            return {
                success: true,
                workflow_id: workflowId,
                ref,
                inputs
            };
            
        } catch (error) {
            console.error(`❌ Failed to trigger workflow ${workflowId}:`, error.message);
            return {
                success: false,
                error: error.message,
                workflow_id: workflowId
            };
        }
    }
    
    /**
     * Trigger workflow using template
     */
    async triggerWorkflowTemplate(templateId, owner, repo, ref = 'main', customInputs = {}) {
        const template = this.workflowTemplates.get(templateId);
        if (!template) {
            console.log(`⚠️ Unknown workflow template: ${templateId}, skipping`);
            return { success: false, error: `Unknown template: ${templateId}` };
        }
        
        return await this.triggerWorkflow(owner, repo, template.workflow_id, ref, customInputs);
    }
    
    /**
     * List available workflow templates
     */
    listTemplates() {
        return Array.from(this.workflowTemplates.entries()).map(([id, template]) => ({
            id,
            name: template.name,
            description: template.description,
            workflow_id: template.workflow_id
        }));
    }
    
    /**
     * Get active workflows summary
     */
    getActiveWorkflows() {
        return Array.from(this.activeWorkflows.values());
    }
}

/**
 * Enhanced GitHub Integration Hub - Phase 5.1
 * Comprehensive GitHub automation with advanced event routing
 */
class GitHubIntegration {
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
        
        // Session 2 enhancements
        this.rateLimiter = new GitHubRateLimiter();
        this.commAgent = null;
        
        // Initialize Octokit with rate limiting
        this.octokit = new Octokit({ 
            auth: this.config.githubToken,
            userAgent: 'LonicFLex-MultiAgent-v2/1.0'
        });
        
        // Initialize GitHub Actions Manager
        this.actionsManager = new GitHubActionsManager(this.octokit, this.rateLimiter);
        
        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'github-integration.log' })
            ]
        });

        // Event processing
        this.webhookQueue = [];
        this.processingWebhooks = false;
        
        this.setupMiddleware();
        this.setupWebhookEndpoints();
        
        console.log('✅ Enhanced GitHub Integration initialized with rate limiting and Actions support');
    }

    /**
     * Initialize Communication Agent for Slack notifications
     */
    async initializeCommAgent() {
        if (!this.commAgent) {
            const sessionId = `github-integration-${Date.now()}`;
            this.commAgent = new CommunicationAgent(sessionId);
            console.log('✅ Communication Agent integrated for GitHub notifications');
        }
        return this.commAgent;
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Parse raw body for signature verification
        this.app.use(this.config.webhookPath, express.raw({ type: 'application/json', limit: '1mb' }));
        this.app.use(express.json({ limit: '1mb' }));
        
        // Health check with rate limiter status
        this.app.get('/health', (req, res) => {
            const rateLimiterStatus = this.rateLimiter.getStatus();
            res.json({ 
                status: 'healthy',
                timestamp: new Date().toISOString(),
                webhookPath: this.config.webhookPath,
                rateLimiter: {
                    tokensAvailable: rateLimiterStatus.tokens,
                    queueLength: rateLimiterStatus.queueLength,
                    circuitOpen: rateLimiterStatus.circuitOpen
                },
                githubActions: {
                    templates: this.actionsManager.listTemplates().length
                }
            });
        });

        // GitHub API status endpoint
        this.app.get('/github/status', async (req, res) => {
            try {
                const rateLimiterStatus = this.rateLimiter.getStatus();
                
                res.json({
                    rateLimiter: rateLimiterStatus,
                    actions: {
                        templates: this.actionsManager.listTemplates()
                    },
                    webhookQueue: {
                        length: this.webhookQueue.length,
                        processing: this.processingWebhooks
                    }
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    /**
     * Setup webhook endpoint with queue processing
     */
    setupWebhookEndpoints() {
        this.app.post(this.config.webhookPath, async (req, res) => {
            try {
                // Quick validation
                const event = req.headers['x-github-event'];
                const deliveryId = req.headers['x-github-delivery'];
                const signature = req.headers['x-hub-signature-256'];
                
                if (!event || !deliveryId) {
                    return res.status(400).send('Missing required headers');
                }

                // Verify signature if configured
                if (this.config.secret && !this.verifySignature(req.body, signature)) {
                    return res.status(401).send('Unauthorized');
                }

                // Parse payload
                let payload;
                try {
                    payload = JSON.parse(req.body.toString());
                } catch (parseError) {
                    return res.status(400).send('Invalid JSON payload');
                }

                // Queue webhook for processing
                const webhook = {
                    event,
                    payload,
                    deliveryId,
                    receivedAt: Date.now(),
                    processed: false
                };
                
                this.webhookQueue.push(webhook);
                this.processWebhookQueue();

                // Respond immediately
                res.status(200).send('OK');

                this.logger.info('GitHub webhook queued', {
                    event,
                    deliveryId,
                    repository: payload.repository?.full_name,
                    queueLength: this.webhookQueue.length
                });

            } catch (error) {
                this.logger.error('Webhook processing failed', { 
                    error: error.message
                });
                res.status(500).send('Internal Server Error');
            }
        });
    }

    /**
     * Process webhook queue asynchronously
     */
    async processWebhookQueue() {
        if (this.processingWebhooks || this.webhookQueue.length === 0) {
            return;
        }
        
        this.processingWebhooks = true;
        
        while (this.webhookQueue.length > 0) {
            const webhook = this.webhookQueue.shift();
            
            try {
                await this.handleWebhookEvent(webhook.event, webhook.payload, webhook.deliveryId);
                webhook.processed = true;
                
            } catch (error) {
                this.logger.error('Webhook event processing failed', {
                    event: webhook.event,
                    deliveryId: webhook.deliveryId,
                    error: error.message
                });
            }
        }
        
        this.processingWebhooks = false;
    }

    /**
     * Enhanced webhook event handler with Slack notifications
     */
    async handleWebhookEvent(event, payload, deliveryId) {
        try {
            this.logger.info('Processing GitHub webhook event', {
                event,
                deliveryId,
                repository: payload.repository?.full_name
            });

            // Initialize communication agent if needed
            await this.initializeCommAgent();

            // Route to specific event handlers
            switch (event) {
                case 'pull_request':
                    await this.handlePullRequestEvent(payload);
                    break;
                case 'push':
                    await this.handlePushEvent(payload);
                    break;
                case 'issues':
                    await this.handleIssueEvent(payload);
                    break;
                case 'workflow_run':
                    await this.handleWorkflowRunEvent(payload);
                    break;
                case 'release':
                    await this.handleReleaseEvent(payload);
                    break;
                default:
                    this.logger.info('Unhandled GitHub event type', { event });
            }

        } catch (error) {
            this.logger.error('Event handling failed', {
                event,
                deliveryId,
                error: error.message
            });
        }
    }

    /**
     * Handle pull request events
     */
    async handlePullRequestEvent(payload) {
        const action = payload.action;
        const pr = payload.pull_request;
        const repository = payload.repository;
        
        console.log(`📝 Pull Request ${action}: #${pr.number} in ${repository.full_name}`);
        
        // Send Slack notification
        if (this.commAgent) {
            await this.commAgent.sendMessage(
                `📝 **PR ${action.toUpperCase()}**: #${pr.number} in ${repository.full_name}\n**Author**: ${pr.user.login}\n[View PR](${pr.html_url})`
            );
        }
        
        // Trigger automated workflows
        if (action === 'opened' || action === 'synchronize') {
            await this.actionsManager.triggerWorkflowTemplate('ci-test', repository.owner.login, repository.name, pr.head.ref);
        }
        
        if (action === 'opened') {
            await this.actionsManager.triggerWorkflowTemplate('security-scan', repository.owner.login, repository.name, pr.head.ref);
        }
    }

    /**
     * Handle push events
     */
    async handlePushEvent(payload) {
        const repository = payload.repository;
        const ref = payload.ref;
        const commits = payload.commits || [];
        
        console.log(`📤 Push to ${ref} in ${repository.full_name} (${commits.length} commits)`);
        
        // Auto-deploy to staging on main branch push
        if (ref === 'refs/heads/main' && commits.length > 0) {
            console.log('🚀 Triggering staging deployment for main branch push');
            await this.actionsManager.triggerWorkflowTemplate('deploy-staging', repository.owner.login, repository.name, 'main');
        }
    }

    /**
     * Handle issue events
     */
    async handleIssueEvent(payload) {
        const action = payload.action;
        const issue = payload.issue;
        const repository = payload.repository;
        
        console.log(`🐛 Issue ${action}: #${issue.number} in ${repository.full_name}`);
        
        if (action === 'opened' && this.commAgent) {
            await this.commAgent.sendMessage(
                `🐛 **New Issue**: #${issue.number} in ${repository.full_name}\n**Reporter**: ${issue.user.login}\n[View Issue](${issue.html_url})`
            );
        }
    }

    /**
     * Handle workflow run events
     */
    async handleWorkflowRunEvent(payload) {
        const action = payload.action;
        const workflowRun = payload.workflow_run;
        const repository = payload.repository;
        
        console.log(`⚡ Workflow ${action}: ${workflowRun.name} in ${repository.full_name}`);
        
        if (action === 'completed' && this.commAgent) {
            const success = workflowRun.conclusion === 'success';
            const emoji = success ? '✅' : '❌';
            
            await this.commAgent.sendMessage(
                `${emoji} **Workflow ${workflowRun.conclusion?.toUpperCase()}**: ${workflowRun.name} in ${repository.full_name}\n[View Run](${workflowRun.html_url})`
            );
        }
    }

    /**
     * Handle release events  
     */
    async handleReleaseEvent(payload) {
        const action = payload.action;
        const release = payload.release;
        const repository = payload.repository;
        
        console.log(`🎉 Release ${action}: ${release.tag_name} in ${repository.full_name}`);
        
        if (action === 'published' && this.commAgent) {
            await this.commAgent.sendMessage(
                `🎉 **Release Published**: ${release.tag_name} in ${repository.full_name}\n[View Release](${release.html_url})`
            );
        }
    }

    /**
     * Verify GitHub webhook signature
     */
    verifySignature(payload, signature) {
        if (!signature) {
            return false;
        }

        const hmac = crypto.createHmac('sha256', this.config.secret);
        hmac.update(payload);
        const digest = `sha256=${hmac.digest('hex')}`;
        
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    }

    /**
     * Start the GitHub integration server
     */
    async start() {
        try {
            await this.db.initialize();
            
            await this.app.listen(this.config.port);
            this.logger.info('Enhanced GitHub integration started', {
                port: this.config.port
            });
            
            console.log('🚀 Enhanced GitHub Integration is running!');
            console.log(`📡 Webhook endpoint: http://localhost:${this.config.port}${this.config.webhookPath}`);

        } catch (error) {
            this.logger.error('Failed to start GitHub integration', { error: error.message });
            console.error('❌ Failed to start:', error.message);
        }
    }
}

/**
 * Production GitHub integration startup
 */
async function startGitHubIntegration() {
    console.log('🤖 Enhanced GitHub Integration - Session 2 Production Mode\n');
    
    const requiredEnvVars = [
        'GITHUB_TOKEN',
        'GITHUB_WEBHOOK_SECRET'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:');
        missingVars.forEach(varName => {
            console.error(`   • ${varName}`);
        });
        console.error('\n🔧 Please check your .env file configuration');
        process.exit(1);
    }
    
    console.log('✅ Environment variables configured');
    console.log('🔗 Connecting to GitHub API with rate limiting');
    
    console.log('\n🎯 Session 2 Features:');
    console.log('   • Phase 5.1: Enhanced webhook processing with queue');
    console.log('   • Phase 5.2: Smart rate limiting with circuit breaker');
    console.log('   • Phase 5.3: GitHub Actions automation');
    console.log('   • Full Slack integration for GitHub events');
    
    console.log('\n🔄 Supported Events:');
    console.log('   • pull_request: Auto-trigger CI and security scans');
    console.log('   • push: Auto-deploy to staging on main branch');
    console.log('   • issues: Team notifications');
    console.log('   • workflow_run: Completion notifications');
    console.log('   • release: Release announcements');
    
    try {
        const integration = new GitHubIntegration();
        await integration.start();
        console.log('🚀 Enhanced GitHub integration started successfully!');
    } catch (error) {
        console.error('❌ Failed to start GitHub integration:', error.message);
        process.exit(1);
    }
}

module.exports = {
    GitHubIntegration,
    GitHubRateLimiter,
    GitHubActionsManager
};

// Run integration if called directly
if (require.main === module) {
    startGitHubIntegration().catch(console.error);
}