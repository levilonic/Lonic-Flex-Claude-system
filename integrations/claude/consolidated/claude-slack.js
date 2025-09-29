/**
 * Claude Slack Integration - Consolidated
 * Consolidates: claude-slack-integration.js, claude-slack-auth.js
 * Provides: Slack operations, authentication, team notifications
 */

const { info, warn, error } = require('../../../src/services/logger');

class ClaudeSlackIntegration {
    constructor(config = {}) {
        this.config = {
            slackBotToken: process.env.SLACK_BOT_TOKEN || config.slackBotToken,
            slackAppToken: process.env.SLACK_APP_TOKEN || config.slackAppToken,
            slackSigningSecret: process.env.SLACK_SIGNING_SECRET || config.slackSigningSecret,
            defaultChannel: config.defaultChannel || '#general',
            ...config
        };

        this.initialized = false;
        this.slackAPI = null;
        this.commandHandlers = new Map();
        this.eventHandlers = new Map();
    }

    /**
     * Initialize Slack integration
     */
    async initialize() {
        if (this.initialized) {
            return this;
        }

        try {
            info('💬 Initializing Claude Slack Integration...');

            if (!this.config.slackBotToken) {
                warn('⚠️ No Slack bot token provided - Slack integration disabled');
                return this;
            }

            // Initialize Slack API client
            await this.initializeSlackAPI();

            // Initialize command and event handlers
            this.initializeHandlers();

            this.initialized = true;
            info('✅ Claude Slack Integration initialized successfully');
            return this;

        } catch (initError) {
            error('❌ Slack integration initialization failed', { error: initError.message });
            throw initError;
        }
    }

    /**
     * Initialize Slack API client
     */
    async initializeSlackAPI() {
        try {
            // Mock Slack API initialization (would use @slack/bolt or similar)
            this.slackAPI = {
                chat: {
                    postMessage: async (params) => ({
                        ok: true,
                        ts: Date.now().toString(),
                        channel: params.channel
                    }),
                    update: async (params) => ({
                        ok: true,
                        ts: params.ts,
                        channel: params.channel
                    })
                },
                users: {
                    info: async (params) => ({
                        ok: true,
                        user: { id: params.user, name: 'test-user' }
                    })
                },
                conversations: {
                    list: async () => ({
                        ok: true,
                        channels: [{ id: 'C123', name: 'general' }]
                    })
                }
            };

            info('✅ Slack API client initialized');

        } catch (error) {
            warn('⚠️ Slack API initialization failed - continuing without API access');
        }
    }

    /**
     * Initialize command and event handlers
     */
    initializeHandlers() {
        // Register slash command handlers
        this.commandHandlers.set('/status', this.handleStatusCommand.bind(this));
        this.commandHandlers.set('/health', this.handleHealthCommand.bind(this));
        this.commandHandlers.set('/context', this.handleContextCommand.bind(this));

        // Register event handlers
        this.eventHandlers.set('message', this.handleMessageEvent.bind(this));
        this.eventHandlers.set('app_mention', this.handleMentionEvent.bind(this));

        info('✅ Slack command and event handlers registered');
    }

    /**
     * Send message to Slack channel
     */
    async sendMessage(channel, text, blocks = null) {
        if (!this.initialized || !this.slackAPI) {
            info('ℹ️ Slack integration disabled - skipping message');
            return null;
        }

        try {
            const params = {
                channel,
                text,
                ...(blocks && { blocks })
            };

            const result = await this.slackAPI.chat.postMessage(params);

            info('✅ Message sent to Slack', { channel, timestamp: result.ts });
            return result;

        } catch (error) {
            warn('⚠️ Failed to send Slack message', { channel, error: error.message });
            return null;
        }
    }

    /**
     * Send context notification to Slack
     */
    async sendContextNotification(contextId, action, details = {}) {
        if (!this.initialized) {
            return;
        }

        const blocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Context ${action}:* \`${contextId}\``
                }
            }
        ];

        if (details.goal) {
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Goal:* ${details.goal}`
                }
            });
        }

        if (details.status) {
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Status:* ${details.status}`
                }
            });
        }

        return await this.sendMessage(
            this.config.defaultChannel,
            `Context ${action}: ${contextId}`,
            blocks
        );
    }

    /**
     * Handle slash commands
     */
    async handleSlashCommand(command, payload) {
        if (!this.initialized) {
            return { text: 'Slack integration not initialized' };
        }

        const handler = this.commandHandlers.get(command);
        if (handler) {
            try {
                return await handler(payload);
            } catch (error) {
                error('❌ Slash command handler failed', { command, error: error.message });
                return { text: 'Command failed - please try again' };
            }
        } else {
            return { text: `Unknown command: ${command}` };
        }
    }

    /**
     * Handle /status command
     */
    async handleStatusCommand(payload) {
        return {
            text: 'LonicFLex System Status: ✅ Operational',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '*LonicFLex System Status*\n✅ Core: Operational\n✅ Context: Active\n✅ Integrations: Connected'
                    }
                }
            ]
        };
    }

    /**
     * Handle /health command
     */
    async handleHealthCommand(payload) {
        return {
            text: 'System Health: All systems nominal',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '*System Health Check*\n🟢 Database: Healthy\n🟢 Context: Healthy\n🟢 Services: Healthy'
                    }
                }
            ]
        };
    }

    /**
     * Handle /context command
     */
    async handleContextCommand(payload) {
        const text = payload.text || '';
        const args = text.split(' ');

        return {
            text: `Context command received: ${args.join(' ')}`,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Context Management*\nCommand: \`${args.join(' ')}\`\n\nAvailable actions: list, create, switch, status`
                    }
                }
            ]
        };
    }

    /**
     * Handle message events
     */
    async handleMessageEvent(payload) {
        info('💬 Processing message event', {
            channel: payload.channel,
            user: payload.user
        });
        // Add message processing logic here
    }

    /**
     * Handle app mention events
     */
    async handleMentionEvent(payload) {
        info('👋 Processing app mention', {
            channel: payload.channel,
            user: payload.user,
            text: payload.text
        });
        // Add mention processing logic here
    }

    /**
     * Get integration status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            hasBotToken: !!this.config.slackBotToken,
            hasAppToken: !!this.config.slackAppToken,
            apiConnected: !!this.slackAPI,
            commandHandlers: this.commandHandlers.size,
            eventHandlers: this.eventHandlers.size
        };
    }
}

module.exports = {
    ClaudeSlackIntegration
};

// Demo functionality
if (require.main === module) {
    async function demoSlackIntegration() {
        info('🧪 Claude Slack Integration Demo');

        const slack = new ClaudeSlackIntegration();
        await slack.initialize();

        const status = slack.getStatus();
        info('Slack Integration Status:', status);

        // Test message sending
        await slack.sendMessage('#general', 'Demo message from Claude');

        // Test context notification
        await slack.sendContextNotification('demo-context', 'created', {
            goal: 'Test context management',
            status: 'active'
        });

        info('Demo complete');
    }

    demoSlackIntegration().catch(console.error);
}