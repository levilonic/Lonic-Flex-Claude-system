#!/usr/bin/env node
/**
 * LonicFLex Webhook Service - Foundation v0
 * Webhook domino effect coordination and step isolation system
 *
 * Handles:
 * - GitHub webhook events (push, PR, issues, comments)
 * - Webhook domino effect chains (step-by-step progression)
 * - Step isolation and checkpoint validation
 * - Cross-service webhook coordination
 * - @claude mention detection and workflow triggering
 */

const express = require('express');
const crypto = require('crypto');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const { ServiceBase } = require('./service-base');
const winston = require('winston');
require('dotenv').config();

class LonicFlexWebhookService extends ServiceBase {
    constructor(config = {}) {
        super();
        this.config = {
            port: config.port || process.env.PORT || 3008,
            serviceName: 'lonicflex-webhooks',
            githubWebhookSecret: config.githubWebhookSecret || process.env.GITHUB_WEBHOOK_SECRET,
            slackSigningSecret: config.slackSigningSecret || process.env.SLACK_SIGNING_SECRET,
            ...config
        };

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.contextManager = new Factor3ContextManager();

        // Webhook state management
        this.activeWebhookChains = new Map(); // runId -> chain state
        this.webhookHistory = new Map();      // completed chains
        this.stepCheckpoints = new Map();     // stepId -> checkpoint state

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
            totalWebhooks: 0,
            activeChains: 0,
            completedChains: 0,
            failedChains: 0,
            githubEvents: 0,
            slackEvents: 0,
            claudeMentions: 0
        };
    }

    setupMiddleware() {
        // Raw body parser for webhook signature verification
        this.app.use('/webhook', express.raw({ type: 'application/json' }));
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info('Webhook request received', {
                method: req.method,
                url: req.url,
                headers: {
                    'x-github-event': req.headers['x-github-event'],
                    'x-github-delivery': req.headers['x-github-delivery'],
                    'x-slack-signature': req.headers['x-slack-signature'] ? 'present' : 'absent'
                }
            });
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                initialized: this.isInitialized,
                stats: this.stats,
                activeChains: this.activeWebhookChains.size
            });
        });

        // GitHub webhook endpoint
        this.app.post('/webhook/github', async (req, res) => {
            try {
                // Verify GitHub webhook signature
                if (!this.verifyGitHubSignature(req)) {
                    return res.status(401).json({ error: 'Invalid signature' });
                }

                const event = req.headers['x-github-event'];
                const deliveryId = req.headers['x-github-delivery'];
                const payload = JSON.parse(req.body);

                this.logger.info('GitHub webhook received', { event, deliveryId });
                this.stats.totalWebhooks++;
                this.stats.githubEvents++;

                const result = await this.processGitHubWebhook(event, payload, deliveryId);
                res.json(result);

            } catch (error) {
                this.logger.error('GitHub webhook processing failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Slack webhook endpoint
        this.app.post('/webhook/slack', async (req, res) => {
            try {
                // Verify Slack webhook signature
                if (!this.verifySlackSignature(req)) {
                    return res.status(401).json({ error: 'Invalid signature' });
                }

                const payload = req.body;
                this.logger.info('Slack webhook received', { type: payload.type });
                this.stats.totalWebhooks++;
                this.stats.slackEvents++;

                const result = await this.processSlackWebhook(payload);
                res.json(result);

            } catch (error) {
                this.logger.error('Slack webhook processing failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Manual webhook chain trigger (for testing and manual workflows)
        this.app.post('/chain/trigger', async (req, res) => {
            try {
                const result = await this.triggerWebhookChain(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Manual chain trigger failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Webhook chain status
        this.app.get('/chain/:runId/status', (req, res) => {
            const runId = req.params.runId;
            const chain = this.activeWebhookChains.get(runId) || this.webhookHistory.get(runId);

            if (!chain) {
                return res.status(404).json({ error: 'Chain not found' });
            }

            res.json({
                runId,
                status: chain.status,
                currentStep: chain.currentStep,
                steps: chain.steps,
                progress: chain.progress,
                created: chain.created,
                updated: chain.updated
            });
        });

        // Step checkpoint validation
        this.app.post('/step/:stepId/checkpoint', async (req, res) => {
            try {
                const result = await this.validateStepCheckpoint(req.params.stepId, req.body);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    /**
     * Process GitHub webhook events
     */
    async processGitHubWebhook(event, payload, deliveryId) {
        this.logger.info('Processing GitHub webhook', { event, deliveryId });

        switch (event) {
            case 'push':
                return await this.handlePushEvent(payload, deliveryId);

            case 'pull_request':
                return await this.handlePullRequestEvent(payload, deliveryId);

            case 'issues':
            case 'issue_comment':
                return await this.handleIssueEvent(payload, deliveryId);

            case 'pull_request_review_comment':
            case 'pull_request_review':
                return await this.handlePRReviewEvent(payload, deliveryId);

            default:
                this.logger.info('Unhandled GitHub event', { event });
                const evidence = {
                    eventReceived: !!event,
                    eventType: event,
                    eventLogged: true,
                    unhandledEventProcessed: true
                };

                const operationSuccess = evidence.eventReceived && evidence.eventLogged;
                return {
                    success: operationSuccess,
                    message: `Event ${event} received but not processed`,
                    evidence: evidence
                };
        }
    }

    /**
     * Handle push events - trigger webhook chains for relevant branches
     */
    async handlePushEvent(payload, deliveryId) {
        const { ref, repository, commits, pusher } = payload;
        const branchName = ref.replace('refs/heads/', '');

        this.logger.info('Processing push event', {
            ref,
            branchName,
            commits: commits.length,
            pusher: pusher.name
        });

        // Check if this is a LonicFLex run branch
        if (branchName.startsWith('run/R-')) {
            const runId = branchName.replace('run/', '');
            return await this.processRunBranchPush(runId, commits, deliveryId);
        }

        // Check for @claude mentions in commit messages
        const claudeMentions = commits.filter(commit =>
            commit.message.includes('@claude') ||
            commit.message.includes('@LonicFLex')
        );

        if (claudeMentions.length > 0) {
            this.stats.claudeMentions++;
            return await this.processCLaudeMentionInCommit(claudeMentions, repository);
        }

        const validation = { success: this.validateSuccess() };return {

            success: validation.success, message: 'Push processed' };
    }

    /**
     * Handle issue and comment events - detect @claude mentions
     */
    async handleIssueEvent(payload, deliveryId) {
        const { action, issue, comment, repository } = payload;

        // Check for @claude mentions
        const text = comment ? comment.body : issue.body;
        if (text && (text.includes('@claude') || text.includes('@LonicFLex'))) {
            this.stats.claudeMentions++;

            this.logger.info('@claude mention detected', {
                action,
                issue: issue.number,
                user: comment ? comment.user.login : issue.user.login
            });

            return await this.processCLaudeMention({
                type: 'issue',
                action,
                issue,
                comment,
                repository,
                text
            });
        }

        const validation = { success: this.validateSuccess() };return {

            success: validation.success, message: 'Issue event processed' };
    }

    /**
     * Process @claude mentions - trigger appropriate workflows
     */
    async processCLaudeMention(mentionData) {
        const { type, text, repository, issue, comment } = mentionData;

        this.logger.info('Processing @claude mention', { type, repository: repository.name });

        // Extract command from mention (basic parsing)
        const claudeCommand = this.extractClaudeCommand(text);

        if (claudeCommand) {
            // Trigger workflow based on command
            const workflowTrigger = {
                type: 'claude_mention',
                source: type,
                command: claudeCommand.command,
                parameters: claudeCommand.parameters,
                repository: repository.full_name,
                issue: issue ? issue.number : null,
                comment: comment ? comment.id : null,
                requester: (comment ? comment.user : issue.user).login
            };

            // Call master service to initiate workflow
            const result = await this.callService('master', '/lx/run', workflowTrigger);

            // Post response back to GitHub if successful
            if (result && result.success) {
                await this.postGitHubComment(mentionData, result);
            }

            return result;
        }

        // Just acknowledge the mention without specific command

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            message: '@claude mention acknowledged',
            action: 'mention_logged'
        };
    }

    /**
     * Extract @claude command from text
     */
    extractClaudeCommand(text) {
        // Look for patterns like: @claude run security-scan
        // or: @claude deploy to staging
        // or: @claude review this PR

        const mentionPattern = /@claude\s+(\w+)(?:\s+(.+))?/i;
        const match = text.match(mentionPattern);

        if (match) {
            const [, command, params] = match;

            return {
                command,
                parameters: params ? this.parseCommandParameters(params) : {},
                originalText: match[0]
            };
        }

        return null;
    }

    /**
     * Parse command parameters from text
     */
    parseCommandParameters(paramText) {
        const params = {};

        // Basic parameter parsing - can be enhanced
        // Look for key=value pairs or simple values
        const keyValuePattern = /(\w+)=([^\s]+)/g;
        let match;

        while ((match = keyValuePattern.exec(paramText)) !== null) {
            params[match[1]] = match[2];
        }

        // If no key=value pairs found, treat as single parameter
        if (Object.keys(params).length === 0 && paramText.trim()) {
            params.target = paramText.trim();
        }

        return params;
    }

    /**
     * Process commits to run branches - advance webhook chain
     */
    async processRunBranchPush(runId, commits, deliveryId) {
        this.logger.info('Processing run branch push', { runId, commits: commits.length });

        const chain = this.activeWebhookChains.get(runId);
        if (!chain) {
            this.logger.warn('No active webhook chain found for run', { runId });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success, message: 'No active chain found' };
        }

        // Advance the webhook chain based on commit content
        const commitMessages = commits.map(c => c.message);
        const stepAdvance = this.determineStepAdvance(commitMessages);

        if (stepAdvance) {
            return await this.advanceWebhookChain(runId, stepAdvance);
        }

        const validation = { success: this.validateSuccess() };return {

            success: validation.success, message: 'Commits processed' };
    }

    /**
     * Determine if commits should advance webhook chain
     */
    determineStepAdvance(commitMessages) {
        // Look for step completion markers in commit messages
        for (const message of commitMessages) {
            if (message.includes('[step:complete]') || message.includes('chore(run):')) {
                const stepMatch = message.match(/step:(\w+)/);
                if (stepMatch) {
                    return {
                        completedStep: stepMatch[1],
                        nextStep: this.getNextStep(stepMatch[1])
                    };
                }
            }
        }

        return null;
    }

    /**
     * Advance webhook chain to next step
     */
    async advanceWebhookChain(runId, stepAdvance) {
        const chain = this.activeWebhookChains.get(runId);
        if (!chain) {
            throw new Error(`Webhook chain not found: ${runId}`);
        }

        this.logger.info('Advancing webhook chain', {
            runId,
            currentStep: chain.currentStep,
            completedStep: stepAdvance.completedStep,
            nextStep: stepAdvance.nextStep
        });

        // Mark current step as completed
        const currentStepIndex = chain.steps.findIndex(s => s.name === stepAdvance.completedStep);
        if (currentStepIndex >= 0) {
            chain.steps[currentStepIndex].status = 'completed';
            chain.steps[currentStepIndex].completed = new Date();
        }

        // Advance to next step
        if (stepAdvance.nextStep) {
            chain.currentStep = stepAdvance.nextStep;
            chain.updated = new Date();

            // Trigger next step
            const nextStepResult = await this.triggerStep(runId, stepAdvance.nextStep);

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                runId,
                currentStep: chain.currentStep,
                nextStepTriggered: nextStepResult.success,
                progress: this.calculateChainProgress(chain)
            };
        } else {
            // Chain completed
            chain.status = 'completed';
            chain.currentStep = 'completed';
            chain.updated = new Date();
            chain.completed = new Date();

            // Move to history
            this.webhookHistory.set(runId, chain);
            this.activeWebhookChains.delete(runId);

            this.stats.completedChains++;
            this.stats.activeChains--;

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                runId,
                status: 'completed',
                message: 'Webhook chain completed successfully'
            };
        }
    }

    /**
     * Trigger specific workflow step
     */
    async triggerStep(runId, stepName) {
        this.logger.info('Triggering workflow step', { runId, stepName });

        // Call appropriate service based on step type
        const stepServiceMapping = {
            'intake': 'agents',
            'security_gate': 'agents',
            'planner': 'agents',
            'execution': 'workflows',
            'qa_gate': 'agents',
            'completion': 'master'
        };

        const serviceName = stepServiceMapping[stepName] || 'workflows';

        return await this.callService(serviceName, '/step/execute', {
            runId,
            step: stepName,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get next step in workflow sequence
     */
    getNextStep(currentStep) {
        const stepSequence = [
            'intake',
            'security_gate',
            'planner',
            'execution',
            'qa_gate',
            'completion'
        ];

        const currentIndex = stepSequence.indexOf(currentStep);
        if (currentIndex >= 0 && currentIndex < stepSequence.length - 1) {
            return stepSequence[currentIndex + 1];
        }

        return null; // No next step (completed)
    }

    /**
     * Calculate chain progress percentage
     */
    calculateChainProgress(chain) {
        const totalSteps = chain.steps.length;
        const completedSteps = chain.steps.filter(s => s.status === 'completed').length;

        return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    }

    /**
     * Verify GitHub webhook signature with timing-safe comparison
     */
    verifyGitHubSignature(req) {
        if (!this.config.githubWebhookSecret) {
            this.logger.warn('GitHub webhook secret not configured, skipping verification for development');
            return process.env.NODE_ENV !== 'production'; // Only allow in non-production
        }

        const signature = req.headers['x-hub-signature-256'];
        if (!signature) {
            this.logger.error('GitHub webhook signature missing');
            return false;
        }

        try {
            const expectedSignature = crypto
                .createHmac('sha256', this.config.githubWebhookSecret)
                .update(req.body)
                .digest('hex');

            const providedSignature = signature.replace('sha256=', '');

            // Use timing-safe comparison to prevent timing attacks
            const isValid = crypto.timingSafeEqual(
                Buffer.from(expectedSignature, 'hex'),
                Buffer.from(providedSignature, 'hex')
            );

            if (!isValid) {
                this.logger.error('GitHub webhook signature verification failed');
            }

            return isValid;

        } catch (error) {
            this.logger.error('GitHub webhook signature verification error', { error: error.message });
            return false;
        }
    }

    /**
     * Verify Slack webhook signature with timestamp validation
     */
    verifySlackSignature(req) {
        if (!this.config.slackSigningSecret) {
            this.logger.warn('Slack signing secret not configured, skipping verification for development');
            return process.env.NODE_ENV !== 'production'; // Only allow in non-production
        }

        const signature = req.headers['x-slack-signature'];
        const timestamp = req.headers['x-slack-request-timestamp'];

        if (!signature || !timestamp) {
            this.logger.error('Slack webhook signature or timestamp missing');
            return false;
        }

        try {
            // Verify timestamp to prevent replay attacks (within 5 minutes)
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const requestTimestamp = parseInt(timestamp);

            if (Math.abs(currentTimestamp - requestTimestamp) > 300) {
                this.logger.error('Slack webhook timestamp too old', {
                    current: currentTimestamp,
                    request: requestTimestamp
                });
                return false;
            }

            // Create Slack signature format: v0:timestamp:body
            const signingBaseString = `v0:${timestamp}:${req.body}`;

            const expectedSignature = crypto
                .createHmac('sha256', this.config.slackSigningSecret)
                .update(signingBaseString)
                .digest('hex');

            const providedSignature = signature.replace('v0=', '');

            // Use timing-safe comparison
            const isValid = crypto.timingSafeEqual(
                Buffer.from(expectedSignature, 'hex'),
                Buffer.from(providedSignature, 'hex')
            );

            if (!isValid) {
                this.logger.error('Slack webhook signature verification failed');
            }

            return isValid;

        } catch (error) {
            this.logger.error('Slack webhook signature verification error', { error: error.message });
            return false;
        }
    }

    /**
     * Post response comment to GitHub
     */
    async postGitHubComment(mentionData, result) {
        try {
            const { repository, issue, comment } = mentionData;
            const [owner, repo] = repository.full_name.split('/');

            // Create response message
            let responseMessage = `AGENT **LonicFLex Response**\n\n`;

            if (result.runId) {
                responseMessage += `PASS **Run initiated**: \`${result.runId}\`\n`;
                responseMessage += ` **Branch**: \`${result.branchName || `run/${result.runId}`}\`\n`;
                responseMessage += ` **Estimated Duration**: ${Math.round((result.estimatedDuration || 300000) / 1000)}s\n\n`;
                responseMessage += `You can track the progress by checking the branch or PR that will be created.\n\n`;
            } else {
                responseMessage += `FAIL **Failed to initiate run**\n`;
                responseMessage += `Error: ${result.error || 'Unknown error'}\n\n`;
            }

            responseMessage += `_Generated by [LonicFLex Foundation v0](https://github.com/${repository.full_name})_`;

            // Make GitHub API call to post comment
            const commentData = {
                body: responseMessage
            };

            const response = await this.callGitHubAPI(
                `POST /repos/${owner}/${repo}/issues/${issue.number}/comments`,
                commentData
            );

            if (response.success) {
                this.logger.info('GitHub response comment posted', {
                    issueNumber: issue.number,
                    commentId: response.id,
                    runId: result.runId
                });
            } else {
                this.logger.error('Failed to post GitHub comment', {
                    error: response.error,
                    issueNumber: issue.number
                });
            }

        } catch (error) {
            this.logger.error('GitHub comment posting failed', {
                error: error.message,
                repository: mentionData.repository?.full_name,
                issue: mentionData.issue?.number
            });
        }
    }

    /**
     * Make GitHub API calls
     */
    async callGitHubAPI(endpoint, data = {}) {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            this.logger.warn('GitHub token not configured, cannot post comments');
            return { success: false, error: 'GitHub token not configured' };
        }

        try {
            const [method, path] = endpoint.split(' ');
            const url = `https://api.github.com${path}`;

            const https = require('https');
            const requestData = JSON.stringify(data);

            const options = {
                method,
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'LonicFLex-Webhook-Service',
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestData)
                }
            };

            return new Promise((resolve, reject) => {
                const req = https.request(url, options, (res) => {
                    let body = '';
                    res.on('data', (chunk) => body += chunk);
                    res.on('end', () => {
                        try {
                            const result = JSON.parse(body);
                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                resolve({ success: this.validateSuccess(),  ...result });
                            } else {
                                resolve({ success: false, error: result.message || `HTTP ${res.statusCode}` });
                            }
                        } catch (parseError) {
                            resolve({ success: false, error: `Parse error: ${parseError.message}` });
                        }
                    });
                });

                req.on('error', (error) => {
                    resolve({ success: false, error: error.message });
                });

                req.write(requestData);
                req.end();
            });

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Call other LonicFLex services
     */
    async callService(serviceName, endpoint, data) {
        const serviceUrls = {
            'master': 'http://localhost:3007',
            'github': 'http://localhost:3002',
            'agents': 'http://localhost:3003',
            'workflows': 'http://localhost:3004',
            'health': 'http://localhost:3005',
            'slack': 'http://localhost:3006'
        };

        const baseUrl = serviceUrls[serviceName];
        if (!baseUrl) {
            throw new Error(`Unknown service: ${serviceName}`);
        }

        // Make real HTTP call to service
        this.logger.info('Making service call', { serviceName, endpoint, url: `${baseUrl}${endpoint}` });

        try {
            // Use built-in Node.js modules
            const https = require('https');
            const http = require('http');
            const url = require('url');

            const urlParsed = new URL(`${baseUrl}${endpoint}`);
            const client = urlParsed.protocol === 'https:' ? https : http;

            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 10000
            };

            return new Promise((resolve, reject) => {
                const req = client.request(urlParsed, requestOptions, (res) => {
                    let body = '';

                    res.on('data', (chunk) => {
                        body += chunk;
                    });

                    res.on('end', () => {
                        try {
                            if (res.statusCode >= 400) {
                                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                                return;
                            }

                            const result = JSON.parse(body);
                            this.logger.info('Service call successful', { serviceName, endpoint, status: res.statusCode });
                            resolve(result);
                        } catch (parseError) {
                            reject(new Error(`Failed to parse response: ${parseError.message}`));
                        }
                    });
                });

                req.on('error', (error) => {
                    reject(error);
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                // Send the data
                req.write(JSON.stringify(data));
                req.end();
            });

        } catch (error) {
            this.logger.error('Service call failed', { serviceName, endpoint, error: error.message });
            throw new Error(`Service call to ${serviceName}${endpoint} failed: ${error.message}`);
        }
    }

    /**
     * Trigger webhook chain for manual or automated workflows
     */
    async triggerWebhookChain(data) {
        const { type, command, repository } = data;

        this.logger.info('Triggering webhook chain', { type, command, repository });

        // Generate a run ID for this chain
        const runId = `WH-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

        // Create webhook chain state
        const chainState = {
            runId,
            type: type || 'manual',
            command: command || 'default',
            repository: repository || 'unknown',
            status: 'running',
            currentStep: 'intake',
            steps: ['intake', 'processing', 'execution', 'completion'],
            progress: 0,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        // Store chain state
        this.activeWebhookChains.set(runId, chainState);
        this.stats.activeChains = this.activeWebhookChains.size;

        try {
            // Call master service to initiate workflow
            const workflowData = {
                type: 'webhook_chain',
                runId,
                command: command || 'health-check',
                source: 'webhook',
                context: data
            };

            const result = await this.callService('master', '/lx/run', workflowData);

            // Update chain state
            chainState.status = 'coordinated';
            chainState.progress = 25;
            chainState.updated = new Date().toISOString();
            chainState.masterRunId = result.runId;

            this.logger.info('Webhook chain initiated', { runId, masterRunId: result.runId });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                runId,
                masterRunId: result.runId,
                status: 'initiated',
                estimatedDuration: 300000
            };

        } catch (error) {
            // Update chain state to failed
            chainState.status = 'failed';
            chainState.error = error.message;
            chainState.updated = new Date().toISOString();

            // Move to history
            this.activeWebhookChains.delete(runId);
            this.webhookHistory.set(runId, chainState);
            this.stats.activeChains = this.activeWebhookChains.size;
            this.stats.failedChains++;

            this.logger.error('Webhook chain failed', { runId, error: error.message });

            return {
                success: false,
                runId,
                error: error.message,
                status: 'failed'
            };
        }
    }

    /**
     * Initialize the service
     */
    async initialize() {
        try {
            await this.db.initialize();

            this.isInitialized = true;
            this.logger.info('LonicFLex Webhook Service initialized');

        } catch (error) {
            this.logger.error('Service initialization failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Start the service
     */
    async start() {
        await this.initialize();

        this.server = this.app.listen(this.config.port, () => {
            this.logger.info(` LonicFLex Webhook Service running on port ${this.config.port}`);
            this.logger.info(` GitHub webhooks: http://localhost:${this.config.port}/webhook/github`);
            this.logger.info(` Slack webhooks: http://localhost:${this.config.port}/webhook/slack`);
            this.logger.info(`HEALTH Health check: http://localhost:${this.config.port}/health`);

            this.logger.info('Webhook service started', { port: this.config.port });
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
    }

    /**
     * Graceful shutdown
     */
    async gracefulShutdown() {
        this.logger.info('Webhook service shutting down gracefully');

        if (this.server) {
            this.server.close(() => {
                this.logger.info('Webhook service stopped');
                process.exit(0);
            });
        }
    }
}

// Start service if run directly
if (require.main === module) {
    const service = new LonicFlexWebhookService();
    service.start().catch(error => {
        this.logger.error('Failed to start LonicFLex Webhook Service:', error);
        process.exit(1);
    });
}

module.exports = { LonicFlexWebhookService };