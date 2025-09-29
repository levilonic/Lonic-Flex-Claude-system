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

        console.log('🔐 REAL Slack Authenticator initialized');
    }

    /**
     * Initialize and validate REAL Slack authentication
     */
    async initialize() {
        console.log('🚀 Initializing REAL Slack authentication...');

        // Step 1: Check if integration is enabled
        if (!this.config.enableIntegration) {
            console.log('⚠️ Slack integration is DISABLED (ENABLE_SLACK_INTEGRATION=false)');
            this.authStatus.errors.push('Integration disabled in environment configuration');
            return this.authStatus;
        }

        // Step 2: Validate token presence and format
        const tokenValidation = this.validateTokens();
        if (!tokenValidation.hasRealTokens) {
            console.log('❌ REAL Slack tokens not configured');
            this.showTokenSetupInstructions();
            return this.authStatus;
        }

        // Step 3: Test REAL Slack API connectivity
        try {
            await this.testSlackConnectivity();
            console.log('✅ REAL Slack authentication successful');
            this.authStatus.isAuthenticated = true;
        } catch (error) {
            console.error('❌ REAL Slack authentication failed:', error.message);
            this.authStatus.errors.push(error.message);
            this.showTroubleshootingSteps();
        }

        return this.authStatus;
    }

    /**
     * Validate token formats and detect real vs placeholder tokens
     */
    validateTokens() {
        console.log('🔍 Validating Slack token configuration...');

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
            console.log('✅ Bot token format valid');
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
            console.log('✅ App token format appears valid');
        }

        // Validate Signing Secret
        if (!this.config.signingSecret) {
            validation.issues.push('Signing secret is missing');
        } else if (this.config.signingSecret.length < 32) {
            validation.issues.push('Signing secret appears invalid (too short)');
        } else {
            validation.signingSecretValid = true;
            console.log('✅ Signing secret present');
        }

        // Determine if we have sufficient real tokens
        validation.hasRealTokens = validation.botTokenValid && validation.signingSecretValid;

        this.authStatus.hasRealTokens = validation.hasRealTokens;

        if (validation.issues.length > 0) {
            console.log('⚠️ Token validation issues:');
            validation.issues.forEach(issue => console.log(`   - ${issue}`));
        }

        return validation;
    }

    /**
     * Test REAL Slack API connectivity
     */
    async testSlackConnectivity() {
        console.log('🧪 Testing REAL Slack API connectivity...');

        // Initialize Slack Web API client
        this.slackClient = new WebClient(this.config.botToken);

        // Test 1: Bot authentication
        console.log('   Testing bot authentication...');
        const authTest = await this.slackClient.auth.test();

        this.authStatus.botInfo = {
            userId: authTest.user_id,
            botId: authTest.bot_id,
            teamId: authTest.team_id,
            teamName: authTest.team
        };

        console.log(`   ✅ Bot authenticated as: ${authTest.user} in ${authTest.team}`);

        // Test 2: Workspace information
        console.log('   Fetching workspace information...');
        const teamInfo = await this.slackClient.team.info();

        this.authStatus.workspaceInfo = {
            id: teamInfo.team.id,
            name: teamInfo.team.name,
            domain: teamInfo.team.domain,
            icon: teamInfo.team.icon?.image_68
        };

        console.log(`   ✅ Workspace: ${teamInfo.team.name} (${teamInfo.team.domain})`);

        // Test 3: Bot permissions
        console.log('   Checking bot permissions...');
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
                console.log(`   ✅ Can read ${channels.channels.length} public channels`);

                // Test posting capability (if possible)
                const testChannel = channels.channels.find(ch =>
                    ch.name.includes('test') || ch.name.includes('bot') || ch.name.includes('general')
                );

                if (testChannel) {
                    console.log(`   Testing message posting to #${testChannel.name}...`);
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
                        console.log(`   ✅ Successfully posted test message (ts: ${message.ts})`);

                    } catch (postError) {
                        console.log(`   ⚠️ Cannot post messages: ${postError.message}`);
                        this.authStatus.errors.push(`Message posting failed: ${postError.message}`);
                    }
                }
            }

        } catch (permError) {
            console.log(`   ⚠️ Limited permissions: ${permError.message}`);
            this.authStatus.errors.push(`Permission check failed: ${permError.message}`);
        }

        // Test 4: Socket Mode (if app token available)
        if (this.config.appToken && !this.config.appToken.includes('[REDACTED_SECRET]')) {
            console.log('   Testing Socket Mode connectivity...');
            try {
                // Initialize Slack Bolt App for Socket Mode
                this.slackApp = new App({
                    token: this.config.botToken,
                    appToken: this.config.appToken,
                    socketMode: true,
                    logLevel: 'error' // Suppress debug logs
                });

                console.log('   ✅ Socket Mode app initialized');
                this.authStatus.permissions.push('socket:mode');

            } catch (socketError) {
                console.log(`   ⚠️ Socket Mode unavailable: ${socketError.message}`);
                this.authStatus.errors.push(`Socket Mode failed: ${socketError.message}`);
            }
        }

        return this.authStatus;
    }

    /**
     * Show setup instructions for getting REAL Slack tokens
     */
    showTokenSetupInstructions() {
        console.log('\n📋 REAL Slack Integration Setup Instructions:');
        console.log('=' .repeat(60));
        console.log('');
        console.log('To enable REAL Slack-GitHub integration, you need to:');
        console.log('');
        console.log('1️⃣ **Create a Slack App:**');
        console.log('   • Go to https://api.slack.com/apps');
        console.log('   • Click "Create New App" → "From scratch"');
        console.log('   • App Name: "LonicFLex GitHub Automation"');
        console.log('   • Pick your Slack workspace');
        console.log('');
        console.log('2️⃣ **Configure OAuth Scopes:**');
        console.log('   • Go to OAuth & Permissions');
        console.log('   • Add Bot Token Scopes:');
        console.log('     - channels:read');
        console.log('     - chat:write');
        console.log('     - commands');
        console.log('     - files:write');
        console.log('     - users:read');
        console.log('');
        console.log('3️⃣ **Install App to Workspace:**');
        console.log('   • Click "Install to Workspace"');
        console.log('   • Copy the Bot User OAuth Token (starts with xoxb-)');
        console.log('');
        console.log('4️⃣ **Enable Socket Mode (for slash commands):**');
        console.log('   • Go to Socket Mode → Enable');
        console.log('   • Generate App-Level Token with connections:write scope');
        console.log('   • Copy the App Token (starts with xapp-)');
        console.log('');
        console.log('5️⃣ **Update .env file:**');
        console.log('   SLACK_BOT_TOKEN=xoxb-your-real-token-here');
        console.log('   SLACK_APP_TOKEN=xapp-your-real-token-here');
        console.log('   ENABLE_SLACK_INTEGRATION=true');
        console.log('');
        console.log('6️⃣ **Test the integration:**');
        console.log('   node services/real-slack-authenticator.js');
        console.log('');
        console.log('=' .repeat(60));
    }

    /**
     * Show troubleshooting steps for authentication failures
     */
    showTroubleshootingSteps() {
        console.log('\n🔧 Slack Authentication Troubleshooting:');
        console.log('=' .repeat(50));
        console.log('');
        console.log('Common issues and solutions:');
        console.log('');
        console.log('❌ "invalid_auth" error:');
        console.log('   → Check if Bot Token is correct and not expired');
        console.log('   → Ensure app is installed to workspace');
        console.log('');
        console.log('❌ "missing_scope" error:');
        console.log('   → Add required OAuth scopes to your Slack app');
        console.log('   → Reinstall app to workspace after adding scopes');
        console.log('');
        console.log('❌ "not_in_channel" error:');
        console.log('   → Invite the bot to channels where it needs to post');
        console.log('   → Use /invite @LonicFLex in the channel');
        console.log('');
        console.log('❌ Connection timeout:');
        console.log('   → Check internet connectivity');
        console.log('   → Verify Slack service status');
        console.log('');
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

            console.log(`✅ Test message posted to #${channelName} (ts: ${result.ts})`);
            return result;

        } catch (error) {
            console.error(`❌ Failed to post to #${channelName}:`, error.message);
            throw error;
        }
    }
}

module.exports = { RealSlackAuthenticator };

// Execute REAL authentication test
if (require.main === module) {
    (async () => {
        console.log('🎯 REAL Slack Authentication Test Starting...\n');

        const authenticator = new RealSlackAuthenticator();

        try {
            const authStatus = await authenticator.initialize();

            console.log('\n📊 REAL Authentication Results:');
            console.log('=' .repeat(40));
            console.log(`✅ Has Real Tokens: ${authStatus.hasRealTokens}`);
            console.log(`✅ Is Authenticated: ${authStatus.isAuthenticated}`);

            if (authStatus.botInfo) {
                console.log(`✅ Bot User: ${authStatus.botInfo.userId} in ${authStatus.botInfo.teamName}`);
            }

            if (authStatus.permissions.length > 0) {
                console.log(`✅ Permissions: ${authStatus.permissions.join(', ')}`);
            }

            if (authStatus.errors.length > 0) {
                console.log(`⚠️ Issues: ${authStatus.errors.length} errors`);
                authStatus.errors.forEach(error => console.log(`   - ${error}`));
            }

            if (authStatus.isAuthenticated) {
                console.log('\n🎉 REAL Slack integration ready for GitHub automation!');
            } else {
                console.log('\n⚠️ REAL tokens required for full functionality');
            }

        } catch (error) {
            console.error('\n❌ REAL authentication failed:', error.message);
            process.exit(1);
        }
    })();
}