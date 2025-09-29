const { info, warn, error } = require('./logger');
/**
 * REAL Slack Authentication Manager
 * Handles actual Slack API authentication and token validation
 * NO DEMOS - REAL IMPLEMENTATION ONLY
 * Following BE ALL AND END ALL protocol
 */

const { WebClient } = require('@slack/web-api');
const { App } = require('@slack/bolt');
const fs = require('fs').promises;
require('dotenv').config();

class RealSlackAuthenticator {
    constructor() {
        this.slackClient = null;
        this.slackApp = null;
        this.authStatus = {
            isAuthenticated: false,
            hasRealTokens: false,
            botInfo: null,
            workspaceInfo: null,
            permissions: [],
            errors: []
        };

        this.config = {
            botToken: process.env.SLACK_BOT_TOKEN,
            appToken: process.env.SLACK_APP_TOKEN,
            signingSecret: process.env.SLACK_SIGNING_SECRET,
            enableIntegration: process.env.ENABLE_SLACK_INTEGRATION === 'true'
        };

        info('🔐 REAL Slack Authenticator initialized');
    }

    /**
     * Initialize and validate REAL Slack authentication
     */
    async initialize() {
        info('Initializing REAL Slack authentication...');

        // Step 1: Check if integration is enabled
        if (!this.config.enableIntegration) {
            warn('Slack integration is DISABLED (ENABLE_SLACK_INTEGRATION=false)');
            this.authStatus.errors.push('Integration disabled in environment configuration');
            return this.authStatus;
        }

        // Step 2: Validate token presence and format
        const tokenValidation = this.validateTokens();
        if (!tokenValidation.hasRealTokens) {
            error(');
            this.showTokenSetupInstructions();
            return this.authStatus;
        }

        // Step 3: Test REAL Slack API connectivity
        try {
            await this.testSlackConnectivity();
            info('REAL Slack authentication successful');
            this.authStatus.isAuthenticated = true;
        } catch (error) {
            error('❌ REAL Slack authentication failed:', error.message);
            this.authStatus.errors.push(error.message);
            this.showTroubleshootingSteps();
        }

        return this.authStatus;
    }

    /**
     * Validate token formats and detect real vs placeholder tokens
     */
    validateTokens() {
        info('🔍 Validating Slack token configuration...');

        const validation = {
            hasRealTokens: false,
            botTokenValid: false,
            appTokenValid: false,
            signingSecretValid: false,
            issues: []
        };

        // Validate Bot Token
        if (!this.config.botToken || this.config.botToken === 'YOUR_SLACK_TOKEN_HERE') {
            validation.issues.push('Bot token is placeholder or missing');
        } else if (!this.config.botToken.startsWith('xoxb-')) {
            validation.issues.push('Bot token format invalid (should start with xoxb-)');
        } else if (this.config.botToken.length < 50) {
            validation.issues.push('Bot token appears truncated or invalid');
        } else {
            validation.botTokenValid = true;
            info('Bot token format valid');
        }

        // Validate App Token (for Socket Mode)
        if (!this.config.appToken || this.config.appToken === 'YOUR_SLACK_APP_TOKEN_HERE') {
            validation.issues.push('App token is placeholder or missing');
        } else if (!this.config.appToken.startsWith('xapp-')) {
            validation.issues.push('App token format invalid (should start with xapp-)');
        } else if (this.config.appToken.includes('[REDACTED_SECRET]')) {
            validation.issues.push('App token appears to be redacted/sanitized');
        } else {
            validation.appTokenValid = true;
            info('App token format appears valid');
        }

        // Validate Signing Secret
        if (!this.config.signingSecret) {
            validation.issues.push('Signing secret is missing');
        } else if (this.config.signingSecret.length < 32) {
            validation.issues.push('Signing secret appears invalid (too short)');
        } else {
            validation.signingSecretValid = true;
            info('Signing secret present');
        }

        // Determine if we have sufficient real tokens
        validation.hasRealTokens = validation.botTokenValid && validation.signingSecretValid;

        this.authStatus.hasRealTokens = validation.hasRealTokens;

        if (validation.issues.length > 0) {
            warn('Token validation issues:');
            validation.issues.forEach(issue => info(`   - ${issue}`));
        }

        return validation;
    }

    /**
     * Test REAL Slack API connectivity
     */
    async testSlackConnectivity() {
        info('🧪 Testing REAL Slack API connectivity...');

        // Initialize Slack Web API client
        this.slackClient = new WebClient(this.config.botToken);

        // Test 1: Bot authentication
        info('   Testing bot authentication...');
        const authTest = await this.slackClient.auth.test();

        this.authStatus.botInfo = {
            userId: authTest.user_id,
            botId: authTest.bot_id,
            teamId: authTest.team_id,
            teamName: authTest.team
        };

        info(`   ✅ Bot authenticated as: ${authTest.user} in ${authTest.team}`);

        // Test 2: Workspace information
        info('   Fetching workspace information...');
        const teamInfo = await this.slackClient.team.info();

        this.authStatus.workspaceInfo = {
            id: teamInfo.team.id,
            name: teamInfo.team.name,
            domain: teamInfo.team.domain,
            icon: teamInfo.team.icon?.image_68
        };

        info(`   ✅ Workspace: ${teamInfo.team.name} (${teamInfo.team.domain})`);

        // Test 3: Bot permissions
        info('   Checking bot permissions...');
        try {
            const channels = await this.slackClient.conversations.list({
                types: 'public_channel',
                limit: 5
            });

            this.authStatus.permissions = [
                'conversations:read',
                'auth:test'
            ];

            if (channels.channels && channels.channels.length > 0) {
                info(`   ✅ Can read ${channels.channels.length} public channels`);

                // Test posting capability (if possible)
                const testChannel = channels.channels.find(ch =>
                    ch.name.includes('test') || ch.name.includes('bot') || ch.name.includes('general')
                );

                if (testChannel) {
                    info(`   Testing message posting to #${testChannel.name}...`);
                    try {
                        const message = await this.slackClient.chat.postMessage({
                            channel: testChannel.id,
                            text: '🤖 LonicFLex Slack integration test - REAL API authentication successful!',
                            blocks: [
                                {
                                    type: 'section',
                                    text: {
                                        type: 'mrkdwn',
                                        text: '🎉 *LonicFLex REAL Slack Integration Test*\n\n✅ Authentication successful\n✅ API connectivity verified\n✅ Message posting functional\n\n*System ready for GitHub integration*'
                                    }
                                }
                            ]
                        });

                        this.authStatus.permissions.push('chat:write');
                        info(`   ✅ Successfully posted test message (ts: ${message.ts})`);

                    } catch (postError) {
                        info(`   ⚠️ Cannot post messages: ${postError.message}`);
                        this.authStatus.errors.push(`Message posting failed: ${postError.message}`);
                    }
                }
            }

        } catch (permError) {
            info(`   ⚠️ Limited permissions: ${permError.message}`);
            this.authStatus.errors.push(`Permission check failed: ${permError.message}`);
        }

        // Test 4: Socket Mode (if app token available)
        if (this.config.appToken && !this.config.appToken.includes('[REDACTED_SECRET]')) {
            info('   Testing Socket Mode connectivity...');
            try {
                // Initialize Slack Bolt App for Socket Mode
                this.slackApp = new App({
                    token: this.config.botToken,
                    appToken: this.config.appToken,
                    socketMode: true,
                    logLevel: 'error' // Suppress debug logs
                });

                info('   ✅ Socket Mode app initialized');
                this.authStatus.permissions.push('socket:mode');

            } catch (socketError) {
                info(`   ⚠️ Socket Mode unavailable: ${socketError.message}`);
                this.authStatus.errors.push(`Socket Mode failed: ${socketError.message}`);
            }
        }

        return this.authStatus;
    }

    /**
     * Show setup instructions for getting REAL Slack tokens
     */
    showTokenSetupInstructions() {
        info('\n📋 REAL Slack Integration Setup Instructions:');
        info('=' .repeat(60));
        info('');
        info('To enable REAL Slack-GitHub integration, you need to:');
        info('');
        info('1️⃣ **Create a Slack App:**');
        info('   • Go to https://api.slack.com/apps');
        info('   • Click "Create New App" → "From scratch"');
        info('   • App Name: "LonicFLex GitHub Automation"');
        info('   • Pick your Slack workspace');
        info('');
        info('2️⃣ **Configure OAuth Scopes:**');
        info('   • Go to OAuth & Permissions');
        info('   • Add Bot Token Scopes:');
        info('     - channels:read');
        info('     - chat:write');
        info('     - commands');
        info('     - files:write');
        info('     - users:read');
        info('');
        info('3️⃣ **Install App to Workspace:**');
        info('   • Click "Install to Workspace"');
        info('   • Copy the Bot User OAuth Token (starts with xoxb-)');
        info('');
        info('4️⃣ **Enable Socket Mode (for slash commands):**');
        info('   • Go to Socket Mode → Enable');
        info('   • Generate App-Level Token with connections:write scope');
        info('   • Copy the App Token (starts with xapp-)');
        info('');
        info('5️⃣ **Update .env file:**');
        info('   SLACK_BOT_TOKEN=xoxb-your-real-token-here');
        info('   SLACK_APP_TOKEN=xapp-your-real-token-here');
        info('   ENABLE_SLACK_INTEGRATION=true');
        info('');
        info('6️⃣ **Test the integration:**');
        info('   node services/real-slack-authenticator.js');
        info('');
        info('=' .repeat(60));
    }

    /**
     * Show troubleshooting steps for authentication failures
     */
    showTroubleshootingSteps() {
        info('\n🔧 Slack Authentication Troubleshooting:');
        info('=' .repeat(50));
        info('');
        info('Common issues and solutions:');
        info('');
        info('❌ "invalid_auth" error:');
        info('   → Check if Bot Token is correct and not expired');
        info('   → Ensure app is installed to workspace');
        info('');
        info('❌ "missing_scope" error:');
        info('   → Add required OAuth scopes to your Slack app');
        info('   → Reinstall app to workspace after adding scopes');
        info('');
        info('❌ "not_in_channel" error:');
        info('   → Invite the bot to channels where it needs to post');
        info('   → Use /invite @LonicFLex in the channel');
        info('');
        error(');
        info('   → Check internet connectivity');
        info('   → Verify Slack service status');
        info('');
    }

    /**
     * Get current authentication status
     */
    getAuthStatus() {
        return this.authStatus;
    }

    /**
     * Get authenticated Slack clients
     */
    getSlackClients() {
        if (!this.authStatus.isAuthenticated) {
            throw new Error('Slack not authenticated. Call initialize() first.');
        }

        return {
            webClient: this.slackClient,
            boltApp: this.slackApp
        };
    }

    /**
     * Test message posting to specific channel
     */
    async testChannelPost(channelName, message = 'Test message from LonicFLex') {
        if (!this.slackClient) {
            throw new Error('Slack client not initialized');
        }

        try {
            // Find channel by name
            const channels = await this.slackClient.conversations.list({
                types: 'public_channel,private_channel'
            });

            const channel = channels.channels.find(ch =>
                ch.name === channelName || ch.name === channelName.replace('#', '')
            );

            if (!channel) {
                throw new Error(`Channel ${channelName} not found`);
            }

            // Post test message
            const result = await this.slackClient.chat.postMessage({
                channel: channel.id,
                text: message,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `🧪 *LonicFLex Test Message*\n\n${message}\n\n*Channel*: #${channel.name}\n*Time*: ${new Date().toLocaleTimeString()}`
                        }
                    }
                ]
            });

            info(`Test message posted to #${channelName} (ts: ${result.ts})`);
            return result;

        } catch (error) {
            error(`❌ Failed to post to #${channelName}:`, error.message);
            throw error;
        }
    }
}

module.exports = { RealSlackAuthenticator };

// Execute REAL authentication test
if (require.main === module) {
    (async () => {
        info('REAL Slack Authentication Test Starting...\n');

        const authenticator = new RealSlackAuthenticator();

        try {
            const authStatus = await authenticator.initialize();

            info('\n📊 REAL Authentication Results:');
            info('=' .repeat(40));
            info(`Has Real Tokens: ${authStatus.hasRealTokens}`);
            info(`Is Authenticated: ${authStatus.isAuthenticated}`);

            if (authStatus.botInfo) {
                info(`Bot User: ${authStatus.botInfo.userId} in ${authStatus.botInfo.teamName}`);
            }

            if (authStatus.permissions.length > 0) {
                info(`✅ Permissions: ${authStatus.permissions.join(', ')}`);
            }

            if (authStatus.errors.length > 0) {
                warn(`Issues: ${authStatus.errors.length} errors`);
                authStatus.errors.forEach(error => info(`   - ${error}`));
            }

            if (authStatus.isAuthenticated) {
                info('\n🎉 REAL Slack integration ready for GitHub automation!');
            } else {
                info('\n⚠️ REAL tokens required for full functionality');
            }

        } catch (error) {
            error('\n❌ REAL authentication failed:', error.message);
            process.exit(1);
        }
    })();
}