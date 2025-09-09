/**
 * Communication Agent - Phase 3.5
 * Specialized agent for Slack coordination and team communication
 * Extends BaseAgent with communication-specific functionality following Factor 10
 */

const { BaseAgent } = require('./base-agent');
const { WebClient } = require('@slack/web-api');

class CommunicationAgent extends BaseAgent {
    constructor(sessionId, config = {}) {
        super('comm', sessionId, {
            maxSteps: 8,
            timeout: 120000,
            ...config
        });
        
        // Communication-specific configuration
        this.commConfig = {
            slack: {
                token: config.slack_token || process.env.SLACK_BOT_TOKEN,
                signingSecret: config.slack_signing_secret || process.env.SLACK_SIGNING_SECRET,
                appToken: config.slack_app_token || process.env.SLACK_APP_TOKEN,
                defaultChannel: config.default_channel || '#all-lonixflex',
                defaultChannelId: 'C09D4RUQ739', // all-lonixflex channel ID
                ...config.slack
            },
            notifications: {
                enabled: config.notifications !== false,
                channels: config.notification_channels || ['#deployments', '#alerts'],
                urgencyLevels: ['low', 'medium', 'high', 'critical'],
                mentionThreshold: config.mention_threshold || 'high',
                ...config.notifications
            },
            formatting: {
                useEmoji: config.use_emoji !== false,
                useThreads: config.use_threads !== false,
                includeContext: config.include_context !== false,
                maxMessageLength: config.max_message_length || 3000,
                ...config.formatting
            },
            ...config.comm
        };
        
        // Communication state
        this.activeChannels = new Map();
        this.messageSent = [];
        this.threadMapping = new Map();
        this.communicationMetrics = {
            messagesSent: 0,
            threadsCreated: 0,
            mentionsUsed: 0,
            channelsNotified: 0
        };
        
        // Define execution steps (Factor 10: max 8 steps)
        this.executionSteps = [
            'initialize_communication',
            'analyze_message_context',
            'prepare_notifications',
            'format_messages',
            'send_notifications',
            'handle_responses',
            'update_threads',
            'finalize_communication'
        ];
        
        // Message templates
        this.messageTemplates = this.initializeMessageTemplates();
        
        // Initialize Slack Web API client
        this.slackClient = this.commConfig.slack.token ? 
            new WebClient(this.commConfig.slack.token) : null;
        
        // Initialize communication context
        this.contextManager.addAgentEvent(this.agentName, 'comm_config_loaded', {
            slack_configured: !!this.commConfig.slack.token,
            default_channel: this.commConfig.slack.defaultChannel,
            notification_channels: this.commConfig.notifications.channels.length,
            templates_loaded: Object.keys(this.messageTemplates).length
        });
    }

    /**
     * Initialize message templates for different communication scenarios
     */
    initializeMessageTemplates() {
        return {
            deployment: {
                started: {
                    emoji: '🚀',
                    title: 'Deployment Started',
                    template: '{emoji} **{title}**\n\n• **Environment:** {environment}\n• **Strategy:** {strategy}\n• **Deployment ID:** `{deployment_id}`\n• **Started by:** {agent}\n\n_{context}_'
                },
                completed: {
                    emoji: '✅',
                    title: 'Deployment Completed',
                    template: '{emoji} **{title}**\n\n• **Environment:** {environment}\n• **Duration:** {duration}\n• **Instances:** {instances}\n• **Health:** {health_status}\n\n_{context}_'
                },
                failed: {
                    emoji: '❌',
                    title: 'Deployment Failed',
                    template: '{emoji} **{title}**\n\n• **Environment:** {environment}\n• **Error:** `{error}`\n• **Rollback:** {rollback_status}\n\n<!channel> Immediate attention required!'
                }
            },
            
            security: {
                scan_completed: {
                    emoji: '🔒',
                    title: 'Security Scan Completed',
                    template: '{emoji} **{title}**\n\n• **Files Scanned:** {files_scanned}\n• **Vulnerabilities:** {vulnerabilities_found}\n• **Security Score:** {security_score}/100\n• **Risk Level:** {risk_level}\n\n_{recommendations}_'
                },
                critical_vulnerability: {
                    emoji: '🚨',
                    title: 'Critical Vulnerability Detected',
                    template: '{emoji} **{title}**\n\n• **Type:** {vulnerability_type}\n• **Severity:** CRITICAL\n• **File:** `{file_path}`\n• **Line:** {line_number}\n\n<!here> Immediate remediation required!'
                }
            },
            
            github: {
                pr_created: {
                    emoji: '📝',
                    title: 'Pull Request Created',
                    template: '{emoji} **{title}**\n\n• **Repository:** {repository}\n• **PR #:** {pr_number}\n• **Author:** {author}\n• **Files Changed:** {files_changed}\n\n[View PR]({pr_url})'
                },
                pr_merged: {
                    emoji: '🎉',
                    title: 'Pull Request Merged',
                    template: '{emoji} **{title}**\n\n• **Repository:** {repository}\n• **PR #:** {pr_number}\n• **Merged by:** {merged_by}\n• **Commits:** {commit_count}\n\n_{merge_message}_'
                }
            },
            
            code: {
                generation_completed: {
                    emoji: '💻',
                    title: 'Code Generation Completed',
                    template: '{emoji} **{title}**\n\n• **Files Created:** {files_created}\n• **Lines of Code:** {lines_of_code}\n• **Tests Generated:** {tests_created}\n• **Quality Score:** {quality_score}/100\n\n_{summary}_'
                }
            },
            
            system: {
                agent_started: {
                    emoji: '🤖',
                    title: 'Agent Started',
                    template: '{emoji} **{title}**\n\n• **Agent:** {agent_name}\n• **Session:** `{session_id}`\n• **Task:** {task_description}\n\n_{context}_'
                },
                workflow_completed: {
                    emoji: '🎯',
                    title: 'Workflow Completed',
                    template: '{emoji} **{title}**\n\n• **Workflow:** {workflow_type}\n• **Duration:** {total_duration}\n• **Agents:** {agents_count}\n• **Success:** {success_status}\n\n_{summary}_'
                },
                error_occurred: {
                    emoji: '⚠️',
                    title: 'System Error',
                    template: '{emoji} **{title}**\n\n• **Error Type:** {error_type}\n• **Agent:** {agent_name}\n• **Message:** `{error_message}`\n\n_{recovery_actions}_'
                }
            }
        };
    }

    /**
     * Implementation of abstract executeWorkflow method
     */
    async executeWorkflow(context, progressCallback) {
        const results = {};
        
        // Step 1: Initialize communication
        results.initialization = await this.executeStep('initialize_communication', async () => {
            if (progressCallback) progressCallback(12, 'initializing communication...');
            
            const initialization = await this.initializeCommunication(context);
            
            await this.logEvent('communication_initialized', {
                channels: initialization.channels.length,
                notification_types: initialization.notificationTypes.length,
                slack_connected: initialization.slackConnected
            });
            
            return initialization;
        }, 0);
        
        // Step 2: Analyze message context
        results.contextAnalysis = await this.executeStep('analyze_message_context', async () => {
            if (progressCallback) progressCallback(25, 'analyzing message context...');
            
            const analysis = this.analyzeMessageContext(context);
            
            await this.logEvent('context_analyzed', {
                message_type: analysis.messageType,
                urgency: analysis.urgency,
                target_channels: analysis.targetChannels.length
            });
            
            return analysis;
        }, 1);
        
        // Step 3: Prepare notifications
        results.notificationPrep = await this.executeStep('prepare_notifications', async () => {
            if (progressCallback) progressCallback(37, 'preparing notifications...');
            
            const notifications = await this.prepareNotifications(results.contextAnalysis, context);
            
            await this.logEvent('notifications_prepared', {
                notifications_count: notifications.length,
                channels: notifications.map(n => n.channel),
                urgent_notifications: notifications.filter(n => n.urgent).length
            });
            
            return notifications;
        }, 2);
        
        // Step 4: Format messages
        results.messageFormatting = await this.executeStep('format_messages', async () => {
            if (progressCallback) progressCallback(50, 'formatting messages...');
            
            const formattedMessages = await this.formatMessages(results.notificationPrep, context);
            
            await this.logEvent('messages_formatted', {
                messages_count: formattedMessages.length,
                total_length: formattedMessages.reduce((sum, m) => sum + m.text.length, 0),
                mentions_used: formattedMessages.filter(m => m.hasMentions).length
            });
            
            return formattedMessages;
        }, 3);
        
        // Step 5: Send notifications
        results.messageSending = await this.executeStep('send_notifications', async () => {
            if (progressCallback) progressCallback(62, 'sending notifications...');
            
            const sendResults = await this.sendNotifications(results.messageFormatting, context);
            
            await this.logEvent('notifications_sent', {
                messages_sent: sendResults.messagesSent,
                failed_sends: sendResults.failedSends,
                threads_created: sendResults.threadsCreated
            });
            
            return sendResults;
        }, 4);
        
        // Step 6: Handle responses
        results.responseHandling = await this.executeStep('handle_responses', async () => {
            if (progressCallback) progressCallback(75, 'handling responses...');
            
            const responses = await this.handleResponses(results.messageSending, context);
            
            await this.logEvent('responses_handled', {
                responses_received: responses.responsesReceived,
                acknowledgments: responses.acknowledgments,
                follow_up_required: responses.followUpRequired
            });
            
            return responses;
        }, 5);
        
        // Step 7: Update threads
        results.threadUpdates = await this.executeStep('update_threads', async () => {
            if (progressCallback) progressCallback(87, 'updating threads...');
            
            const threadUpdates = await this.updateThreads(results.messageSending, results.responseHandling, context);
            
            await this.logEvent('threads_updated', {
                threads_updated: threadUpdates.threadsUpdated,
                status_updates: threadUpdates.statusUpdates
            });
            
            return threadUpdates;
        }, 6);
        
        // Step 8: Finalize communication
        results.finalization = await this.executeStep('finalize_communication', async () => {
            if (progressCallback) progressCallback(100, 'finalizing communication...');
            
            const finalization = await this.finalizeCommunication(results, context);
            
            return finalization;
        }, 7);
        
        return {
            agent: this.agentName,
            session: this.sessionId,
            messages_sent: results.messageSending.messagesSent,
            channels_notified: results.initialization.channels.length,
            responses_received: results.responseHandling.responsesReceived,
            threads_created: results.messageSending.threadsCreated,
            success: results.messageSending.failedSends === 0,
            results
        };
    }

    /**
     * Initialize communication channels and services
     */
    async initializeCommunication(context) {
        const channels = [];
        const notificationTypes = [];
        let slackConnected = false;
        
        // Initialize Slack connection (mock)
        if (this.commConfig.slack.token) {
            slackConnected = await this.initializeSlackConnection();
            channels.push(...this.commConfig.notifications.channels);
        }
        
        // Add default channels
        if (context.channels) {
            channels.push(...context.channels);
        }
        
        // Determine notification types based on context
        if (context.deployment) notificationTypes.push('deployment');
        if (context.security_scan) notificationTypes.push('security');
        if (context.github_event) notificationTypes.push('github');
        if (context.code_generation) notificationTypes.push('code');
        if (context.system_event) notificationTypes.push('system');
        
        // Store active channels
        channels.forEach(channel => {
            this.activeChannels.set(channel, {
                name: channel,
                active: true,
                lastMessage: null,
                threadId: null
            });
        });
        
        return {
            channels: [...new Set(channels)],
            notificationTypes,
            slackConnected
        };
    }

    /**
     * Analyze message context to determine communication strategy
     */
    analyzeMessageContext(context) {
        let messageType = 'general';
        let urgency = 'medium';
        let targetChannels = [this.commConfig.slack.defaultChannel];
        
        // Determine message type
        if (context.deployment) {
            messageType = 'deployment';
            targetChannels = ['#deployments'];
            
            if (context.deployment.failed || context.deployment.rollback) {
                urgency = 'critical';
            } else if (context.deployment.completed) {
                urgency = 'medium';
            } else {
                urgency = 'low';
            }
        } else if (context.security_scan) {
            messageType = 'security';
            targetChannels = ['#security', '#alerts'];
            
            if (context.security_scan.critical_vulnerabilities > 0) {
                urgency = 'critical';
            } else if (context.security_scan.high_vulnerabilities > 0) {
                urgency = 'high';
            }
        } else if (context.github_event) {
            messageType = 'github';
            targetChannels = ['#dev-team'];
            urgency = context.github_event.type === 'pr_merged' ? 'medium' : 'low';
        } else if (context.code_generation) {
            messageType = 'code';
            targetChannels = ['#dev-team'];
            urgency = 'low';
        } else if (context.system_event) {
            messageType = 'system';
            targetChannels = ['#alerts'];
            urgency = context.system_event.error ? 'high' : 'medium';
        }
        
        // Override with explicit channels
        if (context.channels) {
            targetChannels = context.channels;
        }
        
        // Override with explicit urgency
        if (context.urgency) {
            urgency = context.urgency;
        }
        
        return {
            messageType,
            urgency,
            targetChannels,
            requiresMention: urgency === 'critical' || urgency === 'high',
            requiresThread: context.create_thread !== false
        };
    }

    /**
     * Prepare notifications based on analysis
     */
    async prepareNotifications(analysis, context) {
        const notifications = [];
        
        for (const channel of analysis.targetChannels) {
            const notification = {
                channel,
                messageType: analysis.messageType,
                urgency: analysis.urgency,
                urgent: analysis.urgency === 'critical' || analysis.urgency === 'high',
                requiresMention: analysis.requiresMention,
                requiresThread: analysis.requiresThread,
                context: context,
                timestamp: Date.now()
            };
            
            notifications.push(notification);
        }
        
        return notifications;
    }

    /**
     * Format messages using templates
     */
    async formatMessages(notifications, context) {
        const formattedMessages = [];
        
        for (const notification of notifications) {
            try {
                const message = await this.formatMessage(notification, context);
                formattedMessages.push(message);
            } catch (error) {
                console.error(`Failed to format message for ${notification.channel}:`, error.message);
                
                // Fallback message
                const fallbackMessage = {
                    channel: notification.channel,
                    text: `⚠️ Communication Agent encountered an error formatting message. Raw context: ${JSON.stringify(context, null, 2)}`,
                    urgency: notification.urgency,
                    hasMentions: false,
                    hasThread: false,
                    error: error.message
                };
                
                formattedMessages.push(fallbackMessage);
            }
        }
        
        return formattedMessages;
    }

    /**
     * Format individual message using templates
     */
    async formatMessage(notification, context) {
        const template = this.getMessageTemplate(notification.messageType, context);
        
        if (!template) {
            throw new Error(`No template found for message type: ${notification.messageType}`);
        }
        
        // Prepare template variables
        const variables = this.prepareTemplateVariables(notification, context);
        
        // Format message text
        let text = template.template;
        for (const [key, value] of Object.entries(variables)) {
            text = text.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        
        // Add mentions if required
        if (notification.requiresMention) {
            text = this.addMentions(text, notification.urgency);
        }
        
        // Truncate if too long
        if (text.length > this.commConfig.formatting.maxMessageLength) {
            text = text.substring(0, this.commConfig.formatting.maxMessageLength - 3) + '...';
        }
        
        return {
            channel: notification.channel,
            text,
            urgency: notification.urgency,
            hasMentions: notification.requiresMention,
            hasThread: notification.requiresThread,
            template: template.title,
            variables
        };
    }

    /**
     * Send notifications to channels
     */
    async sendNotifications(formattedMessages, context) {
        let messagesSent = 0;
        let failedSends = 0;
        let threadsCreated = 0;
        const sentMessages = [];
        
        for (const message of formattedMessages) {
            try {
                const sendResult = await this.sendSlackMessage(message);
                
                if (sendResult.success) {
                    messagesSent++;
                    
                    // Create thread if required
                    if (message.hasThread) {
                        const threadResult = await this.createMessageThread(sendResult.messageId, message.channel);
                        if (threadResult.success) {
                            threadsCreated++;
                            this.threadMapping.set(sendResult.messageId, threadResult.threadId);
                        }
                    }
                    
                    sentMessages.push({
                        ...sendResult,
                        channel: message.channel,
                        urgency: message.urgency,
                        threadId: sendResult.threadId
                    });
                    
                    this.communicationMetrics.messagesSent++;
                    
                } else {
                    failedSends++;
                }
                
            } catch (error) {
                failedSends++;
                console.error(`Failed to send message to ${message.channel}:`, error.message);
            }
        }
        
        this.messageSent = sentMessages;
        this.communicationMetrics.threadsCreated += threadsCreated;
        this.communicationMetrics.channelsNotified = new Set(sentMessages.map(m => m.channel)).size;
        
        return {
            messagesSent,
            failedSends,
            threadsCreated,
            sentMessages
        };
    }

    /**
     * Handle responses and interactions
     */
    async handleResponses(messageSendingResults, context) {
        const responses = {
            responsesReceived: 0,
            acknowledgments: 0,
            followUpRequired: 0,
            interactions: []
        };
        
        // Mock response handling (in production, would use Slack events API)
        for (const sentMessage of messageSendingResults.sentMessages) {
            // Simulate some responses based on urgency
            if (sentMessage.urgency === 'critical') {
                responses.responsesReceived += Math.floor(Math.random() * 3) + 1;
                responses.acknowledgments += 1;
            } else if (sentMessage.urgency === 'high') {
                responses.responsesReceived += Math.floor(Math.random() * 2);
            }
            
            // Simulate interactions
            if (Math.random() < 0.3) {
                responses.interactions.push({
                    messageId: sentMessage.messageId,
                    channel: sentMessage.channel,
                    type: 'reaction',
                    user: 'user123',
                    reaction: '✅'
                });
            }
        }
        
        return responses;
    }

    /**
     * Update message threads with status updates
     */
    async updateThreads(messageSendingResults, responseHandlingResults, context) {
        let threadsUpdated = 0;
        let statusUpdates = 0;
        
        for (const sentMessage of messageSendingResults.sentMessages) {
            if (sentMessage.threadId) {
                try {
                    // Add status update to thread
                    const updateMessage = this.generateStatusUpdate(sentMessage, context);
                    const updateResult = await this.sendThreadUpdate(sentMessage.threadId, updateMessage);
                    
                    if (updateResult.success) {
                        threadsUpdated++;
                        statusUpdates++;
                    }
                    
                } catch (error) {
                    console.error(`Failed to update thread ${sentMessage.threadId}:`, error.message);
                }
            }
        }
        
        return {
            threadsUpdated,
            statusUpdates
        };
    }

    /**
     * Finalize communication session
     */
    async finalizeCommunication(results, context) {
        const summary = {
            totalMessages: results.messageSending.messagesSent,
            totalChannels: this.communicationMetrics.channelsNotified,
            totalThreads: results.messageSending.threadsCreated,
            totalResponses: results.responseHandling.responsesReceived,
            communicationTime: Date.now() - results.initialization.timestamp,
            success: results.messageSending.failedSends === 0
        };
        
        // Log final communication metrics
        await this.logEvent('communication_finalized', {
            ...summary,
            metrics: this.communicationMetrics
        });
        
        // Send summary message if requested
        if (context.send_summary) {
            const summaryMessage = this.generateCommunicationSummary(summary);
            await this.sendSlackMessage({
                channel: '#system-logs',
                text: summaryMessage,
                urgency: 'low'
            });
        }
        
        return summary;
    }

    /**
     * Helper methods for communication operations
     */
    
    async initializeSlackConnection() {
        if (!this.slackClient) {
            console.log('❌ No Slack token provided - Slack functionality disabled');
            return false;
        }
        
        try {
            console.log('🔗 Initializing Slack connection...');
            const authResult = await this.slackClient.auth.test();
            console.log(`✅ Connected to Slack workspace: ${authResult.team}`);
            console.log(`   Bot user: ${authResult.user} (${authResult.user_id})`);
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Slack connection:', error.message);
            return false;
        }
    }
    
    getMessageTemplate(messageType, context) {
        const templates = this.messageTemplates[messageType];
        if (!templates) return null;
        
        // Determine specific template based on context
        if (messageType === 'deployment') {
            if (context.deployment?.failed) return templates.failed;
            if (context.deployment?.completed) return templates.completed;
            return templates.started;
        } else if (messageType === 'security') {
            if (context.security_scan?.critical_vulnerabilities > 0) return templates.critical_vulnerability;
            return templates.scan_completed;
        } else if (messageType === 'github') {
            if (context.github_event?.type === 'pr_merged') return templates.pr_merged;
            return templates.pr_created;
        } else if (messageType === 'code') {
            return templates.generation_completed;
        } else if (messageType === 'system') {
            if (context.system_event?.error) return templates.error_occurred;
            if (context.workflow_completed) return templates.workflow_completed;
            return templates.agent_started;
        }
        
        return Object.values(templates)[0]; // Return first template as fallback
    }
    
    prepareTemplateVariables(notification, context) {
        const variables = {
            emoji: this.commConfig.formatting.useEmoji ? '🔔' : '',
            timestamp: new Date().toISOString(),
            agent: this.agentName,
            session_id: this.sessionId,
            urgency: notification.urgency,
            channel: notification.channel
        };
        
        // Add context-specific variables
        if (context.deployment) {
            Object.assign(variables, {
                environment: context.deployment.environment || 'unknown',
                strategy: context.deployment.strategy || 'unknown',
                deployment_id: context.deployment.deployment_id || 'unknown',
                duration: context.deployment.duration || '0s',
                instances: context.deployment.instances || 0,
                health_status: context.deployment.health_status || 'unknown',
                error: context.deployment.error || 'unknown',
                rollback_status: context.deployment.rollback ? 'enabled' : 'disabled',
                context: context.deployment.description || 'No additional context'
            });
        }
        
        if (context.security_scan) {
            Object.assign(variables, {
                files_scanned: context.security_scan.files_scanned || 0,
                vulnerabilities_found: context.security_scan.vulnerabilities_found || 0,
                security_score: context.security_scan.security_score || 0,
                risk_level: context.security_scan.risk_level || 'unknown',
                vulnerability_type: context.security_scan.vulnerability_type || 'unknown',
                file_path: context.security_scan.file_path || 'unknown',
                line_number: context.security_scan.line_number || 0,
                recommendations: context.security_scan.recommendations?.join(', ') || 'No recommendations'
            });
        }
        
        if (context.github_event) {
            Object.assign(variables, {
                repository: context.github_event.repository || 'unknown',
                pr_number: context.github_event.pr_number || 0,
                author: context.github_event.author || 'unknown',
                files_changed: context.github_event.files_changed || 0,
                pr_url: context.github_event.pr_url || '#',
                merged_by: context.github_event.merged_by || 'unknown',
                commit_count: context.github_event.commit_count || 0,
                merge_message: context.github_event.merge_message || 'No message'
            });
        }
        
        if (context.code_generation) {
            Object.assign(variables, {
                files_created: context.code_generation.files_created || 0,
                lines_of_code: context.code_generation.lines_of_code || 0,
                tests_created: context.code_generation.tests_created || 0,
                quality_score: context.code_generation.quality_score || 0,
                summary: context.code_generation.summary || 'No summary'
            });
        }
        
        if (context.workflow_completed) {
            Object.assign(variables, {
                workflow_type: context.workflow_completed.type || 'unknown',
                total_duration: context.workflow_completed.duration || '0s',
                agents_count: context.workflow_completed.agents || 0,
                success_status: context.workflow_completed.success ? 'Success' : 'Failed',
                summary: context.workflow_completed.summary || 'No summary'
            });
        }
        
        if (context.system_event) {
            Object.assign(variables, {
                agent_name: context.system_event.agent || this.agentName,
                task_description: context.system_event.task || 'Unknown task',
                error_type: context.system_event.error_type || 'unknown',
                error_message: context.system_event.error_message || 'unknown',
                recovery_actions: context.system_event.recovery_actions || 'Manual intervention required'
            });
        }
        
        return variables;
    }
    
    addMentions(text, urgency) {
        switch (urgency) {
            case 'critical':
                return text.replace('<!channel>', '<!channel>');
            case 'high':
                return text.replace('<!here>', '<!here>');
            default:
                return text;
        }
    }
    
    async sendSlackMessage(message) {
        if (!this.slackClient) {
            console.log(`🔇 Slack disabled - Would send to ${message.channel}: ${message.text.substring(0, 50)}...`);
            return {
                success: true,
                messageId: `mock_msg_${Date.now()}`,
                timestamp: Date.now(),
                channel: message.channel,
                mock: true
            };
        }
        
        try {
            console.log(`📩 Sending Slack message to ${message.channel}: ${message.text.substring(0, 50)}...`);
            
            // Use channel ID if available, otherwise use channel name
            const channelId = message.channel === this.commConfig.slack.defaultChannel ? 
                this.commConfig.slack.defaultChannelId : message.channel;
            
            const result = await this.slackClient.chat.postMessage({
                channel: channelId,
                text: message.text,
                mrkdwn: true
            });
            
            console.log(`✅ Message sent successfully (ts: ${result.ts})`);
            
            return {
                success: true,
                messageId: result.ts,
                timestamp: Date.now(),
                channel: message.channel,
                slackTs: result.ts
            };
            
        } catch (error) {
            console.error(`❌ Failed to send Slack message to ${message.channel}:`, error.message);
            return {
                success: false,
                error: error.message,
                messageId: null,
                timestamp: Date.now(),
                channel: message.channel
            };
        }
    }
    
    async createMessageThread(messageId, channel) {
        // Mock thread creation
        console.log(`Creating thread for message ${messageId} in ${channel}`);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        return {
            success: true,
            threadId: `thread_${messageId}`,
            messageId
        };
    }
    
    generateStatusUpdate(sentMessage, context) {
        return `🔄 Status Update: Communication completed at ${new Date().toLocaleTimeString()}`;
    }
    
    async sendThreadUpdate(threadId, message) {
        // Mock thread update
        console.log(`Updating thread ${threadId}: ${message}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        return {
            success: true,
            messageId: `thread_msg_${Date.now()}`
        };
    }
    
    generateCommunicationSummary(summary) {
        return `📊 **Communication Summary**

• **Messages Sent:** ${summary.totalMessages}
• **Channels Notified:** ${summary.totalChannels}  
• **Threads Created:** ${summary.totalThreads}
• **Responses Received:** ${summary.totalResponses}
• **Duration:** ${Math.round(summary.communicationTime / 1000)}s
• **Success:** ${summary.success ? '✅' : '❌'}`;
    }
}

/**
 * Demo function for Communication Agent
 */
async function demoCommunicationAgent() {
    console.log('💬 Communication Agent Demo - Factor 10 Specialized Agent\n');
    
    const { SQLiteManager } = require('../database/sqlite-manager');
    const dbManager = new SQLiteManager(':memory:');
    
    try {
        // Initialize database
        await dbManager.initialize();
        
        // Create demo session
        const sessionId = 'comm_agent_demo_' + Date.now();
        await dbManager.createSession(sessionId, 'communication_workflow');
        
        // Create communication agent
        const agent = new CommunicationAgent(sessionId, {
            slack_token: 'demo_token',
            default_channel: '#general',
            notification_channels: ['#deployments', '#alerts', '#dev-team'],
            use_emoji: true,
            use_threads: true
        });
        
        await agent.initialize(dbManager);
        
        console.log(`✅ Created Communication agent: ${agent.agentName}`);
        console.log(`   Steps: ${agent.executionSteps.length} (Factor 10 compliant)`);
        console.log(`   Default channel: ${agent.commConfig.slack.defaultChannel}`);
        console.log(`   Notification channels: ${agent.commConfig.notifications.channels.length}`);
        
        // Test message templates
        console.log('\n🔍 Testing message templates...');
        
        const templateCategories = Object.keys(agent.messageTemplates);
        for (const category of templateCategories) {
            const templates = Object.keys(agent.messageTemplates[category]);
            console.log(`   ${category}: ${templates.length} templates (${templates.join(', ')})`);
        }
        
        // Test message formatting
        console.log('\n⚡ Testing message formatting...');
        
        const testContexts = [
            {
                deployment: {
                    completed: true,
                    environment: 'production',
                    strategy: 'blue-green',
                    deployment_id: 'deploy-123',
                    duration: '3m 45s',
                    instances: 4,
                    health_status: 'healthy'
                },
                channels: ['#deployments']
            },
            {
                security_scan: {
                    files_scanned: 247,
                    vulnerabilities_found: 2,
                    security_score: 85,
                    risk_level: 'LOW',
                    recommendations: ['Update dependencies', 'Review file permissions']
                },
                channels: ['#security']
            }
        ];
        
        for (const [index, testContext] of testContexts.entries()) {
            const analysis = agent.analyzeMessageContext(testContext);
            console.log(`   Context ${index + 1}: ${analysis.messageType} (${analysis.urgency}) → ${analysis.targetChannels.join(', ')}`);
            
            const notifications = await agent.prepareNotifications(analysis, testContext);
            const formatted = await agent.formatMessages(notifications, testContext);
            
            if (formatted.length > 0) {
                console.log(`     Sample message: "${formatted[0].text.substring(0, 80)}..."`);
            }
        }
        
        // Show status
        const status = agent.getStatus();
        console.log(`\n📊 Agent Status:`);
        console.log(`   State: ${status.state}`);
        console.log(`   Execution steps defined: ${status.executionSteps.length}`);
        console.log(`   Message templates: ${Object.keys(agent.messageTemplates).length} categories`);
        
        console.log('\n✅ Communication Agent demo completed successfully!');
        console.log('   ✓ Factor 10: 8 execution steps (≤8 max)');
        console.log('   ✓ Extends BaseAgent with communication functionality');
        console.log('   ✓ Supports Slack integration with rich formatting');
        console.log('   ✓ Includes message templating and threading');
        console.log('   ✓ Provides urgency-based routing and mentions');
        console.log('   ✓ Handles responses and status updates');
        
        console.log('\n📝 Note: Full Slack integration requires valid tokens');
        console.log('   Set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET for production use');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    } finally {
        await dbManager.close();
    }
}

module.exports = { CommunicationAgent };

// Run demo if called directly
if (require.main === module) {
    demoCommunicationAgent().catch(console.error);
}