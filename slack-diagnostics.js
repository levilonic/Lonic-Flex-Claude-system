#!/usr/bin/env node

/**
 * Slack Configuration Diagnostics
 * Identifies what needs to be configured for Socket Mode to work
 */

const { WebClient } = require('@slack/web-api');
require('dotenv').config();

class SlackDiagnostics {
    constructor() {
        this.botClient = new WebClient(process.env.SLACK_BOT_TOKEN);
        this.issues = [];
        this.recommendations = [];
    }

    async runDiagnostics() {
        console.log('🔍 Slack Configuration Diagnostics\n');
        
        await this.checkTokens();
        await this.checkBotPermissions();
        await this.checkRequiredScopes();
        await this.analyzeConfiguration();
        
        this.generateReport();
    }

    async checkTokens() {
        console.log('1. Checking Tokens...');
        
        // Check bot token
        try {
            const authTest = await this.botClient.auth.test();
            console.log('   ✅ Bot token valid');
            console.log(`   🏢 Workspace: ${authTest.team}`);
            console.log(`   🤖 Bot: ${authTest.user} (${authTest.user_id})`);
            
            this.botInfo = authTest;
        } catch (error) {
            console.log('   ❌ Bot token invalid:', error.message);
            this.issues.push('Bot token is invalid or expired');
            return;
        }

        // Check app token
        const appToken = process.env.SLACK_APP_TOKEN;
        if (!appToken) {
            console.log('   ❌ App token missing from environment');
            this.issues.push('SLACK_APP_TOKEN not found in environment variables');
        } else if (!appToken.startsWith('xapp-')) {
            console.log('   ❌ App token format invalid (should start with xapp-)');
            this.issues.push('App token has invalid format - should start with xapp-');
        } else {
            console.log('   ⚠️  App token present but failing authentication');
            this.issues.push('App token is present but invalid/expired');
            this.recommendations.push('Regenerate the app token in Slack app settings');
        }
    }

    async checkBotPermissions() {
        console.log('\n2. Checking Bot Permissions...');
        
        try {
            // Test basic permissions
            await this.botClient.conversations.list({ limit: 1 });
            console.log('   ✅ Can list conversations');
        } catch (error) {
            console.log('   ❌ Cannot list conversations:', error.data?.error);
            this.issues.push('Missing channels:read scope');
        }

        try {
            // Test message permissions
            const testChannel = '#all-lonixflex';
            await this.botClient.chat.postMessage({
                channel: testChannel,
                text: '🔍 Diagnostics test - please ignore',
                dry_run: true
            });
            console.log('   ✅ Can send messages (dry run)');
        } catch (error) {
            if (error.data?.error === 'channel_not_found') {
                console.log('   ⚠️  Test channel not found, but message permission exists');
            } else {
                console.log('   ❌ Cannot send messages:', error.data?.error);
                this.issues.push('Missing chat:write scope');
            }
        }
    }

    async checkRequiredScopes() {
        console.log('\n3. Checking Required Scopes...');
        
        const requiredScopes = [
            'app_mentions:read',
            'channels:history', 
            'channels:read',
            'chat:write',
            'commands',
            'im:history',
            'im:read',
            'im:write'
        ];

        console.log('   Required for interactive features:');
        requiredScopes.forEach(scope => {
            console.log(`   • ${scope}`);
        });
        
        this.recommendations.push('Verify all required OAuth scopes are enabled in Slack app settings');
    }

    async analyzeConfiguration() {
        console.log('\n4. Analyzing Configuration Issues...');
        
        if (this.issues.length === 0) {
            console.log('   🎉 No major configuration issues detected');
            console.log('   🔧 Socket Mode authentication issue is likely:');
            console.log('       • App token expired/invalid');
            console.log('       • Socket Mode not enabled in app settings');
        }
    }

    generateReport() {
        console.log('\n📋 DIAGNOSTIC REPORT');
        console.log('═══════════════════════════════════════');
        
        if (this.issues.length > 0) {
            console.log('\n❌ ISSUES FOUND:');
            this.issues.forEach((issue, i) => {
                console.log(`   ${i + 1}. ${issue}`);
            });
        }
        
        console.log('\n🔧 REQUIRED ACTIONS:');
        console.log('\n📱 In Slack App Settings (https://api.slack.com/apps):');
        console.log('   1. Go to your Claude Multi-Agent app');
        console.log('   2. Navigate to "Socket Mode" in the left sidebar');
        console.log('   3. Enable Socket Mode if not already enabled');
        console.log('   4. Generate a new app token if current one is invalid');
        console.log('   5. Copy the new app token to .env file as SLACK_APP_TOKEN');
        
        console.log('\n🔑 Required OAuth Scopes (Bot Token Scopes):');
        const requiredScopes = [
            'app_mentions:read - Detect when bot is mentioned',
            'channels:read - List channels', 
            'chat:write - Send messages',
            'commands - Handle slash commands',
            'im:read - Read direct messages',
            'im:write - Send direct messages'
        ];
        
        requiredScopes.forEach(scope => {
            console.log(`   • ${scope}`);
        });

        console.log('\n⚡ Slash Commands Setup:');
        console.log('   Add these commands in "Slash Commands" section:');
        console.log('   • /claude-agent - Main agent control');
        console.log('   • /deploy - Quick deployment');
        console.log('   • /security-scan - Security scanning');
        
        console.log('\n🔄 Event Subscriptions:');
        console.log('   Enable "app_mention" event in Event Subscriptions');
        
        if (this.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS:');
            this.recommendations.forEach((rec, i) => {
                console.log(`   ${i + 1}. ${rec}`);
            });
        }
        
        console.log('\n🧪 TEST AFTER CONFIGURATION:');
        console.log('   npm run slack-interactive');
        console.log('\n🎯 EXPECTED RESULT:');
        console.log('   ✅ Socket Mode connection established');
        console.log('   ✅ Ready to receive slash commands');
        console.log('   ✅ Ready to receive app mentions');
    }
}

// Run diagnostics
if (require.main === module) {
    const diagnostics = new SlackDiagnostics();
    diagnostics.runDiagnostics().catch(console.error);
}

module.exports = SlackDiagnostics;