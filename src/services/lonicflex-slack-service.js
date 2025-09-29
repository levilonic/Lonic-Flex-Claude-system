#!/usr/bin/env node
/**
 * LonicFLex Slack Service - Foundation v0
 * Slack Socket Mode service for team communication, notifications, and bot interactions
 *
 * Handles:
 * - Slack Socket Mode connection and event handling
 * - Team notifications and rich message formatting
 * - Bot commands and interactive responses
 * - Cross-service Slack integration
 * - Real-time communication coordination
 */

const express = require('express');
const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const { getAuthManager } = require('../auth/auth-manager');
const winston = require('winston');
require('dotenv').config();

class LonicFlexSlackService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.SLACK_SERVICE_PORT || 3006,
            serviceName: 'lonicflex-slack',
            defaultChannel: config.defaultChannel || '#all-lonicflex',
            botUserOAuthToken: config.botToken || process.env.SLACK_BOT_TOKEN,
            signingSecret: config.signingSecret || process.env.SLACK_SIGNING_SECRET,
            appToken: config.appToken || process.env.SLACK_APP_TOKEN,
            ...config
        };

        // Initialize Express app for health checks
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.contextManager = new Factor3ContextManager();
        this.authManager = null;

        // Initialize Slack App with Socket Mode
        this.slackApp = new App({
            token: this.config.botUserOAuthToken,
            signingSecret: this.config.signingSecret,
            appToken: this.config.appToken,
            socketMode: true,
            logLevel: 'INFO'
        });

        // Slack Web API client for additional functionality
        this.webClient = new WebClient(this.config.botUserOAuthToken);

        // Slack state management
        this.activeChannels = new Map();      // channelId -> channel info
        this.activeThreads = new Map();       // threadId -> thread context
        this.messageQueue = [];               // pending messages
        this.botInfo = null;                  // bot user info

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
        this.isConnected = false;
        this.startTime = new Date();
        this.stats = {
            messagesReceived: 0,
            messagesSent: 0,
            commandsProcessed: 0,
            eventsHandled: 0,
            threadsCreated: 0,
            notificationsSent: 0
        };
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info('Slack service HTTP request', {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent')
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
                connected: this.isConnected,
                stats: this.stats,
                bot: this.botInfo ? this.botInfo.user : null
            });
        });

        // Send notification endpoint
        this.app.post('/notify', async (req, res) => {
            try {
                const result = await this.sendNotification(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Notification failed', { error: error.message, body: req.body });
                res.status(500).json({ error: error.message });
            }
        });

        // Send message endpoint
        this.app.post('/message', async (req, res) => {
            try {
                const result = await this.sendMessage(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Message sending failed', { error: error.message, body: req.body });
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
            this.logger.info('Initializing Slack service...');

            // Initialize database
            await this.db.initialize();
            this.logger.info('Database initialized');

            // Initialize authentication
            this.authManager = getAuthManager();
            await this.authManager.initialize();

            // Get bot info
            this.botInfo = await this.webClient.auth.test();
            this.logger.info('Slack authentication successful', {
                user: this.botInfo.user,
                teamName: this.botInfo.team,
                botId: this.botInfo.bot_id
            });

            // Set up Slack event handlers
            this.setupSlackHandlers();

            this.isInitialized = true;
            this.logger.info('Slack service initialized successfully');

        } catch (error) {
            this.logger.error('Slack service initialization failed', { error: error.message });
            throw error;
        }
    }

    setupSlackHandlers() {
        // Message event handler
        this.slackApp.message(async ({ message, say }) => {
            this.stats.messagesReceived++;

            this.logger.info('Message received', {
                user: message.user,
                channel: message.channel,
                text: message.text?.substring(0, 100),
                hasThread: !!message.thread_ts
            });

            // Check for @claude mentions or LonicFLex commands
            if (message.text && (
                message.text.includes('@claude') ||
                message.text.includes('/lx') ||
                message.text.toLowerCase().includes('lonicflex')
            )) {
                await this.handleLonicFlexMention(message, say);
            }
        });

        // App mention handler
        this.slackApp.event('app_mention', async ({ event, say }) => {
            this.stats.eventsHandled++;

            this.logger.info('App mention received', {
                user: event.user,
                channel: event.channel,
                text: event.text?.substring(0, 100)
            });

            await this.handleAppMention(event, say);
        });

        // Slash command handlers
        this.slackApp.command('/lx', async ({ command, ack, respond }) => {
            await ack();
            this.stats.commandsProcessed++;

            this.logger.info('Slash command received', {
                user: command.user_name,
                channel: command.channel_name,
                text: command.text
            });

            await this.handleLxCommand(command, respond);
        });

        // Interactive component handlers
        this.slackApp.action('lonicflex_button', async ({ body, ack }) => {
            await ack();
            this.logger.info('Button interaction received', {
                user: body.user.name,
                value: body.actions[0].value
            });

            // Handle button interactions
            await this.handleButtonInteraction(body);
        });

        // Socket mode connection events
        // Note: receiver.on may not be available in all Slack App configurations
        try {
            this.slackApp.receiver.on('slack_event', (event) => {
                this.logger.debug('Slack event received', { type: event.type });
            });
        } catch (error) {
            this.logger.warn('Slack receiver events not available', { error: error.message });
        }
    }

    async handleLonicFlexMention(message, say) {
        try {
            // Parse the mention for LonicFLex commands
            const text = message.text.toLowerCase();
            let response = '';

            if (text.includes('status') || text.includes('health')) {
                response = await this.generateStatusResponse();
            } else if (text.includes('help')) {
                response = this.generateHelpResponse();
            } else if (text.includes('/lx run')) {
                response = '🚀 Detected `/lx run` command! Coordinating with Master service...';
                // Coordinate with master service
                await this.coordinateWithServices({
                    event: 'lx_command_detected',
                    message: message.text,
                    channel: message.channel,
                    user: message.user
                });
            } else {
                response = '👋 Hello! I\'m LonicFLex bot. Try `/lx help` for available commands.';
            }

            await say({
                text: response,
                thread_ts: message.thread_ts || message.ts
            });

        } catch (error) {
            this.logger.error('Failed to handle LonicFLex mention', { error: error.message });
        }
    }

    async handleAppMention(event, say) {
        try {
            await say({
                text: `Hi <@${event.user}>! LonicFLex is ready to assist. Use \`/lx help\` to see available commands.`,
                thread_ts: event.ts
            });

        } catch (error) {
            this.logger.error('Failed to handle app mention', { error: error.message });
        }
    }

    async handleLxCommand(command, respond) {
        try {
            const args = command.text.split(' ');
            const subcommand = args[0];

            let response = '';

            switch (subcommand) {
                case 'help':
                    response = this.generateHelpResponse();
                    break;

                case 'status':
                    response = await this.generateStatusResponse();
                    break;

                case 'run':
                    // Coordinate with master service for /lx run commands
                    await this.coordinateWithServices({
                        event: 'lx_run_command',
                        args: args.slice(1),
                        user: command.user_name,
                        channel: command.channel_name
                    });
                    response = '🚀 LonicFLex run initiated! Check status in thread.';
                    break;

                default:
                    response = `Unknown command: ${subcommand}. Use \`/lx help\` for available commands.`;
            }

            await respond({
                response_type: 'in_channel',
                text: response
            });

        } catch (error) {
            this.logger.error('Failed to handle /lx command', { error: error.message });
            await respond({
                response_type: 'ephemeral',
                text: '❌ Command failed. Please try again.'
            });
        }
    }

    async handleButtonInteraction(body) {
        try {
            const action = body.actions[0];
            const value = action.value;

            // Handle different button types
            switch (value) {
                case 'approve_deployment':
                    await this.coordinateWithServices({
                        event: 'deployment_approved',
                        user: body.user.name,
                        channel: body.channel.id
                    });
                    break;

                case 'cancel_run':
                    await this.coordinateWithServices({
                        event: 'run_cancelled',
                        user: body.user.name,
                        channel: body.channel.id
                    });
                    break;
            }

        } catch (error) {
            this.logger.error('Failed to handle button interaction', { error: error.message });
        }
    }

    generateHelpResponse() {
        return `🤖 *LonicFLex Commands*

\`/lx help\` - Show this help message
\`/lx status\` - Show system status
\`/lx run <workflow>\` - Execute a LonicFLex workflow

*Examples:*
• \`/lx run deploy-feature\` - Deploy a feature
• \`/lx run create-branch feature-xyz\` - Create a new branch
• \`@claude implement authentication\` - Trigger AI assistance

*Need help?* Mention @claude or use the commands above!`;
    }

    async generateStatusResponse() {
        try {
            // Get system status from other services
            const status = {
                slack: this.isConnected ? '✅ Connected' : '❌ Disconnected',
                github: '⏳ Checking...',
                webhooks: '⏳ Checking...',
                agents: '⏳ Checking...'
            };

            return `🏗️ *LonicFLex System Status*

**Services:**
• Slack: ${status.slack}
• GitHub: ${status.github}
• Webhooks: ${status.webhooks}
• Agents: ${status.agents}

**Stats:**
• Messages: ${this.stats.messagesSent} sent, ${this.stats.messagesReceived} received
• Commands: ${this.stats.commandsProcessed} processed
• Uptime: ${Math.floor((Date.now() - this.startTime.getTime()) / 1000 / 60)} minutes

*Last updated: ${new Date().toLocaleTimeString()}*`;

        } catch (error) {
            return '❌ Failed to get system status. Please try again.';
        }
    }

    async sendNotification({ channel, message, thread_ts, blocks, urgency = 'medium' }) {
        try {
            const channelId = channel.startsWith('#') ? channel : `#${channel}`;

            const result = await this.webClient.chat.postMessage({
                channel: channelId,
                text: message,
                blocks: blocks,
                thread_ts: thread_ts,
                unfurl_links: false,
                unfurl_media: false
            });

            this.stats.notificationsSent++;
            this.logger.info('Notification sent successfully', {
                channel: channelId,
                message: message.substring(0, 100),
                urgency,
                ts: result.ts
            });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                ts: result.ts,
                channel: result.channel
            };

        } catch (error) {
            this.logger.error('Failed to send notification', { error: error.message, channel });
            throw error;
        }
    }

    async sendMessage({ channel, text, blocks, thread_ts }) {
        try {
            const result = await this.webClient.chat.postMessage({
                channel,
                text,
                blocks,
                thread_ts
            });

            this.stats.messagesSent++;
            this.logger.info('Message sent successfully', {
                channel,
                text: text?.substring(0, 100),
                ts: result.ts
            });

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                ts: result.ts,
                channel: result.channel
            };

        } catch (error) {
            this.logger.error('Failed to send message', { error: error.message, channel });
            throw error;
        }
    }

    async coordinateWithServices({ event, ...data }) {
        try {
            this.logger.info('Coordinating with other services', { event, data });

            // Send notifications based on event type
            switch (event) {
                case 'lx_command_detected':
                case 'lx_run_command':
                    // Notify master service about command
                    await this.notifyService('master', event, data);
                    break;

                case 'github_event':
                    // Send notification about GitHub events
                    await this.sendGitHubNotification(data);
                    break;

                case 'deployment_status':
                    // Send deployment status updates
                    await this.sendDeploymentNotification(data);
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
            this.logger.info('Service notification sent', {
                service: serviceName,
                eventType,
                data
            });

            // In a real implementation, this would make HTTP calls to other services
            // For now, just log the coordination attempt

        } catch (error) {
            this.logger.warn('Service notification failed', {
                service: serviceName,
                error: error.message
            });
        }
    }

    async sendGitHubNotification({ event, repository, branch, pr, user }) {
        try {
            let message = '';
            let blocks = [];

            switch (event) {
                case 'branch_created':
                    message = `🌿 New branch created: \`${branch}\` in ${repository}`;
                    break;

                case 'pr_created':
                    message = `🔄 Pull request created: #${pr.number} in ${repository}`;
                    blocks = [{
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*PR #${pr.number}*: ${pr.title}\n<${pr.url}|View Pull Request>`
                        }
                    }];
                    break;
            }

            if (message) {
                await this.sendNotification({
                    channel: this.config.defaultChannel,
                    message,
                    blocks
                });
            }

        } catch (error) {
            this.logger.error('Failed to send GitHub notification', { error: error.message });
        }
    }

    async sendDeploymentNotification({ status, environment, version, user }) {
        try {
            const emoji = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⏳';
            const message = `${emoji} Deployment ${status}: ${environment} (${version})`;

            const blocks = [{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: message
                }
            }];

            if (status === 'pending') {
                blocks.push({
                    type: 'actions',
                    elements: [{
                        type: 'button',
                        text: { type: 'plain_text', text: 'Approve' },
                        style: 'primary',
                        action_id: 'lonicflex_button',
                        value: 'approve_deployment'
                    }, {
                        type: 'button',
                        text: { type: 'plain_text', text: 'Cancel' },
                        style: 'danger',
                        action_id: 'lonicflex_button',
                        value: 'cancel_run'
                    }]
                });
            }

            await this.sendNotification({
                channel: this.config.defaultChannel,
                message,
                blocks
            });

        } catch (error) {
            this.logger.error('Failed to send deployment notification', { error: error.message });
        }
    }

    async start() {
        try {
            await this.initialize();

            // Start Socket Mode connection
            await this.slackApp.start();
            this.isConnected = true;
            this.logger.info('Slack Socket Mode connected');

            // Start HTTP server for health checks and coordination
            const server = this.app.listen(this.config.port, () => {
                this.logger.info(`Slack service HTTP server listening on port ${this.config.port}`, {
                    service: this.config.serviceName,
                    socketMode: true,
                    bot: this.botInfo ? this.botInfo.user : 'unknown',
                    endpoints: [
                        'GET /health',
                        'POST /notify',
                        'POST /message',
                        'POST /coordinate'
                    ]
                });
            });

            return server;

        } catch (error) {
            this.logger.error('Failed to start Slack service', { error: error.message });
            throw error;
        }
    }
}

// CLI support - if run directly
if (require.main === module) {
    const service = new LonicFlexSlackService();
    service.start()
        .then(() => {
            logger.info('LonicFLex Slack Service started successfully');
        })
        .catch((error) => {
            logger.error('❌ Failed to start Slack service:', error.message);
            process.exit(1);
        });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('Slack service shutting down...');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.info('Slack service shutting down...');
        process.exit(0);
    });
}

module.exports = { LonicFlexSlackService };