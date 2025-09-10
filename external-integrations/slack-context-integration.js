#!/usr/bin/env node
/**
 * Slack Context Integration - Phase 3A
 * Automatic channel creation and notification management based on Universal Context System
 * Part of LonicFLex Project Window System Phase 3: Integration & Production Readiness
 */

const { CommunicationAgent } = require('../agents/comm-agent');
const { ContextScopeManager } = require('../context-management/context-scope-manager');
const path = require('path');

class SlackContextIntegration {
    constructor(config = {}) {
        this.config = {
            // Slack configuration
            defaultWorkspace: config.workspace || 'lonicflex',
            channelPrefix: config.channelPrefix || 'ctx-',
            
            // Auto-creation settings
            autoCreateChannel: config.autoCreateChannel === true, // false by default for Slack
            autoNotifyChannel: config.autoNotifyChannel !== false,
            mainNotificationChannel: config.mainNotificationChannel || '#all-lonixflex',
            
            // Channel naming patterns
            sessionChannelPattern: config.sessionChannelPattern || 'ctx-session-{shortId}',
            projectChannelPattern: config.projectChannelPattern || 'ctx-project-{shortId}',
            
            // Notification settings
            notificationLevels: config.notificationLevels || ['context_created', 'context_completed', 'context_error'],
            mentionOnError: config.mentionOnError !== false,
            useThreads: config.useThreads !== false,
            richFormatting: config.richFormatting !== false,
            
            ...config
        };
        
        this.commAgent = null;
        this.contextScope = new ContextScopeManager();
        this.activeChannels = new Map(); // contextId -> channelInfo
        this.contextMetadata = new Map(); // contextId -> metadata
        this.notificationHistory = new Map(); // contextId -> notifications[]
    }

    /**
     * Initialize Slack integration with authentication
     */
    async initialize() {
        try {
            console.log('🔧 Initializing Slack Context Integration...');
            
            // Initialize Communication agent
            const sessionId = `slack-context-${Date.now()}`;
            this.commAgent = new CommunicationAgent(sessionId, {
                default_channel: this.config.mainNotificationChannel
            });
            
            // Initialize without database for external integration mode
            await this.commAgent.initialize();
            
            console.log(`✅ Slack Context Integration initialized`);
            console.log(`   Main channel: ${this.config.mainNotificationChannel}`);
            console.log(`   Auto-create channels: ${this.config.autoCreateChannel}`);
            console.log(`   Auto-notify: ${this.config.autoNotifyChannel}`);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Slack Context Integration:', error.message);
            return false;
        }
    }

    /**
     * Handle context creation - automatically set up Slack resources
     */
    async onContextCreated(contextData) {
        try {
            const { contextId, contextType, task, metadata = {} } = contextData;
            
            console.log(`📢 Setting up Slack integration for context: ${contextId}`);
            console.log(`   Type: ${contextType}, Task: ${task}`);
            
            // Store context metadata
            this.contextMetadata.set(contextId, {
                contextId,
                contextType,
                task,
                createdAt: new Date().toISOString(),
                ...metadata
            });
            
            const result = {
                contextId,
                slackResources: [],
                notifications: [],
                errors: []
            };
            
            // Create channel if enabled (usually only for long-term projects)
            if (this.config.autoCreateChannel && contextType === 'project') {
                const channelResult = await this.createContextChannel(contextData);
                if (channelResult.success) {
                    result.slackResources.push({
                        type: 'channel',
                        name: channelResult.channelName,
                        id: channelResult.channelId,
                        url: channelResult.url
                    });
                    
                    // Store channel info
                    this.activeChannels.set(contextId, {
                        channelName: channelResult.channelName,
                        channelId: channelResult.channelId,
                        url: channelResult.url,
                        createdAt: new Date().toISOString()
                    });
                } else {
                    result.errors.push(channelResult.error);
                }
            }
            
            // Send notification if enabled
            if (this.config.autoNotifyChannel) {
                const notifyResult = await this.notifyContextCreated(contextData);
                if (notifyResult.success) {
                    result.notifications.push({
                        type: 'context_created',
                        timestamp: notifyResult.timestamp,
                        messageTs: notifyResult.messageTs
                    });
                } else {
                    result.errors.push(notifyResult.error);
                }
            }
            
            console.log(`✅ Slack setup complete for ${contextId}: ${result.slackResources.length} resources, ${result.notifications.length} notifications`);
            return result;
            
        } catch (error) {
            console.error(`❌ Failed to set up Slack resources for context ${contextData.contextId}:`, error.message);
            return {
                contextId: contextData.contextId,
                slackResources: [],
                notifications: [],
                errors: [error.message]
            };
        }
    }

    /**
     * Create a Slack channel for the context (usually projects only)
     */
    async createContextChannel(contextData) {
        try {
            const { contextId, contextType, task } = contextData;
            
            // Generate channel name (must be lowercase, no spaces, limited chars)
            const shortId = contextId.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase().substring(0, 15);
            const pattern = contextType === 'session' 
                ? this.config.sessionChannelPattern 
                : this.config.projectChannelPattern;
            const channelName = pattern.replace('{shortId}', shortId);
            
            console.log(`📢 Creating channel: #${channelName}`);
            
            // Use Communication agent to create channel
            const actionContext = {
                action: 'create_channel',
                channel_name: channelName,
                purpose: `Context channel for: ${task}`,
                topic: `Context ID: ${contextId} | Type: ${contextType}`,
                is_private: false, // Public by default for team visibility
                context_metadata: {
                    contextId,
                    contextType,
                    task,
                    createdBy: 'LonicFLex-Universal-Context-System'
                }
            };
            
            await this.commAgent.executeStep('authenticate_slack');
            await this.commAgent.executeStep('validate_channels');
            
            // Set the context for channel creation
            this.commAgent.executionContext = actionContext;
            const result = await this.commAgent.executeStep('execute_communication_action');
            
            if (result.success && result.channel_id) {
                const channelUrl = `https://${this.config.defaultWorkspace}.slack.com/channels/${channelName}`;
                
                console.log(`✅ Channel created successfully: #${channelName}`);
                console.log(`   ID: ${result.channel_id}`);
                console.log(`   URL: ${channelUrl}`);
                
                return {
                    success: true,
                    channelName,
                    channelId: result.channel_id,
                    url: channelUrl
                };
            } else {
                throw new Error(result.error || 'Channel creation failed');
            }
            
        } catch (error) {
            console.error(`❌ Failed to create channel for context ${contextData.contextId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send notification about context creation
     */
    async notifyContextCreated(contextData) {
        try {
            const { contextId, contextType, task, metadata = {} } = contextData;
            
            console.log(`📢 Sending context creation notification for: ${contextId}`);
            
            // Create rich Slack message
            const message = this.createContextNotificationMessage(contextData, 'created');
            
            const actionContext = {
                action: 'send_notification',
                channel: this.config.mainNotificationChannel,
                message: message.text,
                blocks: this.config.richFormatting ? message.blocks : undefined,
                thread_ts: this.config.useThreads ? this.getThreadTs(contextId) : undefined,
                context_metadata: {
                    contextId,
                    contextType,
                    notificationType: 'context_created'
                }
            };
            
            await this.commAgent.executeStep('authenticate_slack');
            
            this.commAgent.executionContext = actionContext;
            const result = await this.commAgent.executeStep('execute_communication_action');
            
            if (result.success) {
                console.log(`✅ Context creation notification sent`);
                
                // Store notification info
                const notifications = this.notificationHistory.get(contextId) || [];
                notifications.push({
                    type: 'context_created',
                    timestamp: new Date().toISOString(),
                    messageTs: result.message_ts,
                    channel: this.config.mainNotificationChannel
                });
                this.notificationHistory.set(contextId, notifications);
                
                return {
                    success: true,
                    timestamp: new Date().toISOString(),
                    messageTs: result.message_ts
                };
            } else {
                throw new Error(result.error || 'Notification failed');
            }
            
        } catch (error) {
            console.error(`❌ Failed to send context creation notification for ${contextData.contextId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create a rich Slack notification message
     */
    createContextNotificationMessage(contextData, action = 'created') {
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
            }
        ];
        
        // Add description if available
        if (metadata.description) {
            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `*Description:*\n${metadata.description}`
                }
            });
        }
        
        // Add context info
        blocks.push({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "🤖 LonicFLex Universal Context System - Phase 3A"
                }
            ]
        });
        
        return { text, blocks };
    }

    /**
     * Get thread timestamp for context (creates thread grouping)
     */
    getThreadTs(contextId) {
        const notifications = this.notificationHistory.get(contextId);
        if (notifications && notifications.length > 0) {
            return notifications[0].messageTs;
        }
        return undefined;
    }

    /**
     * Handle context completion - send completion notification
     */
    async onContextCompleted(contextData) {
        try {
            const { contextId } = contextData;
            
            console.log(`🎯 Context completed: ${contextId}`);
            console.log(`   Sending completion notification`);
            
            const message = this.createContextNotificationMessage(contextData, 'completed');
            
            const actionContext = {
                action: 'send_notification',
                channel: this.config.mainNotificationChannel,
                message: message.text,
                blocks: this.config.richFormatting ? message.blocks : undefined,
                thread_ts: this.config.useThreads ? this.getThreadTs(contextId) : undefined,
                context_metadata: {
                    contextId,
                    notificationType: 'context_completed'
                }
            };
            
            this.commAgent.executionContext = actionContext;
            const result = await this.commAgent.executeStep('execute_communication_action');
            
            if (result.success) {
                console.log(`✅ Context completion notification sent`);
                
                // Store notification info
                const notifications = this.notificationHistory.get(contextId) || [];
                notifications.push({
                    type: 'context_completed',
                    timestamp: new Date().toISOString(),
                    messageTs: result.message_ts,
                    channel: this.config.mainNotificationChannel
                });
                this.notificationHistory.set(contextId, notifications);
                
                return {
                    success: true,
                    timestamp: new Date().toISOString(),
                    messageTs: result.message_ts
                };
            } else {
                throw new Error(result.error || 'Completion notification failed');
            }
            
        } catch (error) {
            console.error(`❌ Failed to handle context completion for ${contextData.contextId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get status of all Slack integrations
     */
    async getStatus() {
        return {
            initialized: !!this.commAgent,
            activeChannels: this.activeChannels.size,
            contexts: this.contextMetadata.size,
            totalNotifications: Array.from(this.notificationHistory.values()).reduce((sum, arr) => sum + arr.length, 0),
            config: {
                workspace: this.config.defaultWorkspace,
                mainChannel: this.config.mainNotificationChannel,
                autoCreateChannel: this.config.autoCreateChannel,
                autoNotifyChannel: this.config.autoNotifyChannel,
                channelPrefix: this.config.channelPrefix
            },
            channels: Array.from(this.activeChannels.entries()).map(([contextId, info]) => ({
                contextId,
                channelName: info.channelName,
                channelId: info.channelId,
                url: info.url,
                createdAt: info.createdAt
            }))
        };
    }

    /**
     * Clean up resources for a context
     */
    async cleanupContext(contextId) {
        try {
            console.log(`🧹 Cleaning up Slack resources for context: ${contextId}`);
            
            this.activeChannels.delete(contextId);
            this.contextMetadata.delete(contextId);
            this.notificationHistory.delete(contextId);
            
            console.log(`✅ Cleanup complete for context: ${contextId}`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Failed to cleanup context ${contextId}:`, error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = { SlackContextIntegration };

// CLI testing if run directly
if (require.main === module) {
    async function testSlackContextIntegration() {
        console.log('🧪 Testing Slack Context Integration - Phase 3A\n');
        
        try {
            const integration = new SlackContextIntegration({
                autoCreateChannel: false, // Don't create channels in testing
                autoNotifyChannel: true,
                richFormatting: true,
                useThreads: true
            });
            
            console.log('🔧 Test 1: Initialize Slack Integration...');
            const initialized = await integration.initialize();
            if (!initialized) {
                throw new Error('Failed to initialize Slack integration');
            }
            console.log('✅ Slack integration initialized successfully\n');
            
            console.log('📢 Test 2: Context Creation with Notification...');
            const contextData = {
                contextId: 'test-context-slack-integration',
                contextType: 'session',
                task: 'Test Slack integration for Universal Context System',
                metadata: {
                    description: 'Testing Phase 3A Slack integration features',
                    requirements: 'Automatic notifications and channel management'
                }
            };
            
            const result = await integration.onContextCreated(contextData);
            if (result.errors.length > 0) {
                console.log('⚠️ Errors during setup:', result.errors);
            }
            console.log(`✅ Slack resources created: ${result.slackResources.length} resources, ${result.notifications.length} notifications\n`);
            
            console.log('📊 Test 3: Get Integration Status...');
            const status = await integration.getStatus();
            console.log('✅ Status retrieved:', JSON.stringify(status, null, 2));
            
            console.log('\n🎯 Slack Context Integration - Phase 3A: ✅ READY');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        }
    }
    
    testSlackContextIntegration().catch(console.error);
}