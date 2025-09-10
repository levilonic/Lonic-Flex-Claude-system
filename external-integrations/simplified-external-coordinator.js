#!/usr/bin/env node
/**
 * Simplified External System Coordinator - Phase 3A
 * Direct API integration without complex agent dependencies
 * Part of LonicFLex Project Window System Phase 3: Integration & Production Readiness
 */

const { Octokit } = require('@octokit/rest');
const { WebClient } = require('@slack/web-api');
const fs = require('fs').promises;

class SimplifiedExternalCoordinator {
    constructor(config = {}) {
        this.config = {
            // Integration toggles
            enableGitHub: config.enableGitHub !== false,
            enableSlack: config.enableSlack !== false,
            
            // GitHub settings
            github: {
                token: process.env.GITHUB_TOKEN,
                owner: config.github?.owner || 'levilonic',
                repo: config.github?.repo || 'Lonic-Flex-Claude-system',
                autoCreateBranch: config.github?.autoCreateBranch !== false,
                autoCreatePR: config.github?.autoCreatePR === true,
                branchPrefix: 'context/',
                ...config.github
            },
            
            // Slack settings
            slack: {
                token: process.env.SLACK_BOT_TOKEN,
                channel: config.slack?.channel || '#all-lonixflex',
                autoNotify: config.slack?.autoNotify !== false,
                richFormatting: config.slack?.richFormatting !== false,
                ...config.slack
            },
            
            ...config
        };
        
        this.octokit = null;
        this.slackClient = null;
        this.activeContexts = new Map(); // contextId -> resources
        this.initialized = false;
    }

    /**
     * Initialize external system connections
     */
    async initialize() {
        console.log('🚀 Initializing Simplified External System Coordinator...');
        
        const results = {
            github: { enabled: false, initialized: false, error: null },
            slack: { enabled: false, initialized: false, error: null }
        };
        
        // Initialize GitHub
        if (this.config.enableGitHub && this.config.github.token) {
            try {
                this.octokit = new Octokit({
                    auth: this.config.github.token
                });
                
                // Test GitHub connection
                await this.octokit.rest.repos.get({
                    owner: this.config.github.owner,
                    repo: this.config.github.repo
                });
                
                results.github = { enabled: true, initialized: true, error: null };
                console.log('✅ GitHub integration ready');
            } catch (error) {
                results.github = { enabled: true, initialized: false, error: error.message };
                console.log('❌ GitHub integration failed:', error.message);
            }
        } else {
            console.log('ℹ️ GitHub integration disabled or no token');
        }
        
        // Initialize Slack
        if (this.config.enableSlack && this.config.slack.token) {
            try {
                this.slackClient = new WebClient(this.config.slack.token);
                
                // Test Slack connection
                await this.slackClient.auth.test();
                
                results.slack = { enabled: true, initialized: true, error: null };
                console.log('✅ Slack integration ready');
            } catch (error) {
                results.slack = { enabled: true, initialized: false, error: error.message };
                console.log('❌ Slack integration failed:', error.message);
            }
        } else {
            console.log('ℹ️ Slack integration disabled or no token');
        }
        
        this.initialized = true;
        const totalReady = (results.github.initialized ? 1 : 0) + (results.slack.initialized ? 1 : 0);
        const totalEnabled = (results.github.enabled ? 1 : 0) + (results.slack.enabled ? 1 : 0);
        
        console.log(`🎯 Simplified External Coordinator ready: ${totalReady}/${totalEnabled} systems`);
        
        return {
            success: totalReady > 0 || totalEnabled === 0,
            results,
            summary: { totalEnabled, totalInitialized: totalReady, ready: true }
        };
    }

    /**
     * Handle context creation with external systems
     */
    async onContextCreated(contextData) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        console.log(`🎯 Setting up external systems for context: ${contextData.contextId}`);
        
        const results = {
            contextId: contextData.contextId,
            github: { resources: [], errors: [] },
            slack: { notifications: [], errors: [] },
            summary: { success: true, errors: [], totalResources: 0 }
        };
        
        // GitHub operations
        if (this.octokit && this.config.github.autoCreateBranch) {
            try {
                const branchResult = await this.createGitHubBranch(contextData);
                if (branchResult.success) {
                    results.github.resources.push(branchResult);
                } else {
                    results.github.errors.push(branchResult.error);
                }
            } catch (error) {
                results.github.errors.push(`GitHub: ${error.message}`);
            }
        }
        
        // Slack operations
        if (this.slackClient && this.config.slack.autoNotify) {
            try {
                const slackResult = await this.sendSlackNotification(contextData, 'created');
                if (slackResult.success) {
                    results.slack.notifications.push(slackResult);
                } else {
                    results.slack.errors.push(slackResult.error);
                }
            } catch (error) {
                results.slack.errors.push(`Slack: ${error.message}`);
            }
        }
        
        // Store context resources
        this.activeContexts.set(contextData.contextId, {
            contextData,
            github: results.github,
            slack: results.slack,
            createdAt: new Date().toISOString()
        });
        
        // Update summary
        results.summary.totalResources = results.github.resources.length + results.slack.notifications.length;
        results.summary.errors = [...results.github.errors, ...results.slack.errors];
        results.summary.success = results.summary.errors.length === 0;
        
        console.log(`✅ External system setup complete:`);
        console.log(`   GitHub resources: ${results.github.resources.length}`);
        console.log(`   Slack notifications: ${results.slack.notifications.length}`);
        console.log(`   Errors: ${results.summary.errors.length}`);
        
        return results;
    }

    /**
     * Create GitHub branch for context
     */
    async createGitHubBranch(contextData) {
        try {
            const branchName = `${this.config.github.branchPrefix}${contextData.contextType}-${contextData.contextId}`;
            
            console.log(`🌿 Creating GitHub branch: ${branchName}`);
            
            // Get the default branch SHA
            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.config.github.owner,
                repo: this.config.github.repo
            });
            
            const { data: ref } = await this.octokit.rest.git.getRef({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                ref: `heads/${repo.default_branch}`
            });
            
            // Create new branch
            await this.octokit.rest.git.createRef({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                ref: `refs/heads/${branchName}`,
                sha: ref.object.sha
            });
            
            const url = `https://github.com/${this.config.github.owner}/${this.config.github.repo}/tree/${branchName}`;
            
            console.log(`✅ Branch created: ${branchName}`);
            console.log(`   URL: ${url}`);
            
            return {
                success: true,
                type: 'branch',
                name: branchName,
                url: url,
                sha: ref.object.sha
            };
            
        } catch (error) {
            console.error(`❌ Failed to create branch:`, error.message);
            return {
                success: false,
                error: `Branch creation failed: ${error.message}`
            };
        }
    }

    /**
     * Send Slack notification for context
     */
    async sendSlackNotification(contextData, action = 'created') {
        try {
            console.log(`📢 Sending Slack notification for context ${action}`);
            
            const message = this.createSlackMessage(contextData, action);
            
            const result = await this.slackClient.chat.postMessage({
                channel: this.config.slack.channel,
                text: message.text,
                blocks: this.config.slack.richFormatting ? message.blocks : undefined
            });
            
            console.log(`✅ Slack notification sent to ${this.config.slack.channel}`);
            
            return {
                success: true,
                type: 'notification',
                channel: this.config.slack.channel,
                timestamp: result.ts,
                message: message.text
            };
            
        } catch (error) {
            console.error(`❌ Failed to send Slack notification:`, error.message);
            return {
                success: false,
                error: `Slack notification failed: ${error.message}`
            };
        }
    }

    /**
     * Create formatted Slack message
     */
    createSlackMessage(contextData, action) {
        const { contextId, contextType, task, metadata = {} } = contextData;
        
        // Simple text fallback
        let text = `🎯 Context ${action}: \`${contextId}\`\n`;
        text += `Type: ${contextType.charAt(0).toUpperCase() + contextType.slice(1)}\n`;
        text += `Task: ${task}`;
        
        // Rich blocks format
        const blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `🎯 Context ${action.charAt(0).toUpperCase() + action.slice(1)}`,
                    "emoji": true
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": `*Context ID:*\n\`${contextId}\``
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Type:*\n${contextType.charAt(0).toUpperCase() + contextType.slice(1)}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Task:*\n${task}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Created:*\n<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time_secs}|${new Date().toISOString()}>`
                    }
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "🤖 LonicFLex Universal Context System - Phase 3A"
                    }
                ]
            }
        ];
        
        return { text, blocks };
    }

    /**
     * Handle context completion
     */
    async onContextCompleted(contextData) {
        console.log(`🎯 Handling context completion: ${contextData.contextId}`);
        
        // Send completion notification if Slack is enabled
        if (this.slackClient && this.config.slack.autoNotify) {
            await this.sendSlackNotification(contextData, 'completed');
        }
        
        return { success: true };
    }

    /**
     * Get status of external systems
     */
    async getStatus() {
        return {
            coordinator: {
                initialized: this.initialized,
                activeContexts: this.activeContexts.size,
                config: {
                    enableGitHub: this.config.enableGitHub,
                    enableSlack: this.config.enableSlack,
                    githubRepo: `${this.config.github.owner}/${this.config.github.repo}`,
                    slackChannel: this.config.slack.channel
                }
            },
            contexts: Array.from(this.activeContexts.entries()).map(([contextId, info]) => ({
                contextId,
                createdAt: info.createdAt,
                githubResources: info.github.resources.length,
                slackNotifications: info.slack.notifications.length
            }))
        };
    }

    /**
     * Clean up context resources
     */
    async cleanupContext(contextId) {
        console.log(`🧹 Cleaning up resources for context: ${contextId}`);
        
        this.activeContexts.delete(contextId);
        
        console.log(`✅ Context cleanup complete: ${contextId}`);
        return { success: true };
    }
}

module.exports = { SimplifiedExternalCoordinator };

// CLI testing if run directly
if (require.main === module) {
    async function testSimplifiedExternalCoordinator() {
        console.log('🧪 Testing Simplified External System Coordinator\n');
        
        try {
            const coordinator = new SimplifiedExternalCoordinator({
                enableGitHub: true,
                enableSlack: true,
                github: {
                    autoCreateBranch: false, // Don't create branches in testing
                    autoCreatePR: false
                },
                slack: {
                    autoNotify: false, // Don't send notifications in testing
                    richFormatting: true
                }
            });
            
            console.log('🚀 Test 1: Initialize...');
            const initResult = await coordinator.initialize();
            console.log(`✅ Initialization: ${initResult.success}`);
            
            console.log('\n🎯 Test 2: Context Creation...');
            const contextData = {
                contextId: 'test-simplified-coordinator',
                contextType: 'session',
                task: 'Test simplified external coordinator',
                metadata: { description: 'Testing Phase 3A simplified integration' }
            };
            
            const result = await coordinator.onContextCreated(contextData);
            console.log(`✅ Context handled: ${result.summary.success}`);
            console.log(`   Resources: ${result.summary.totalResources}`);
            console.log(`   Errors: ${result.summary.errors.length}`);
            
            console.log('\n📊 Test 3: Status Check...');
            const status = await coordinator.getStatus();
            console.log(`✅ Status: ${status.coordinator.activeContexts} contexts`);
            
            console.log('\n🎯 Simplified External System Coordinator: ✅ READY');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        }
    }
    
    testSimplifiedExternalCoordinator().catch(console.error);
}