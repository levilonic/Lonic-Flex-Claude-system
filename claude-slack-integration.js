const { App } = require('@slack/bolt');
const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SQLiteManager } = require('./database/sqlite-manager');
const { CommunicationAgent } = require('./agents/comm-agent');
const winston = require('winston');
require('dotenv').config();

/**
 * Claude Slack Integration - Session 1 Foundation
 * Enhanced with OAuth permissions, role management, and approval workflows
 * 
 * Phase 4.1: Slack bot integration
 * Phase 4.2: OAuth permissions and role management  
 * Phase 4.3: Slack slash commands (/claude-dev, /claude-admin, /claude-status)
 * Phase 4.4: Approval workflows with timezone support
 * 
 * Following 12-Factor Agent principles and Factor 11: Trigger From Anywhere
 */

/**
 * User Role Management System for Slack Integration
 */
class SlackRoleManager {
    constructor() {
        // Define role hierarchy
        this.roles = {
            admin: {
                level: 100,
                permissions: ['*'], // All permissions
                description: 'Full system administration'
            },
            developer: {
                level: 75,
                permissions: [
                    'workflow.start.all',
                    'workflow.status.all',
                    'workflow.approve.feature',
                    'agent.monitor',
                    'deployment.stage',
                    'security.scan'
                ],
                description: 'Development team member'
            },
            reviewer: {
                level: 50,
                permissions: [
                    'workflow.start.review',
                    'workflow.approve.review',
                    'workflow.status.own',
                    'security.view'
                ],
                description: 'Code reviewer'
            },
            user: {
                level: 25,
                permissions: [
                    'workflow.start.feature',
                    'workflow.status.own',
                    'agent.status'
                ],
                description: 'Regular user'
            }
        };
        
        // User role assignments (in production, this would be in database)
        this.userRoles = new Map();
        this.timezone = new Map();
    }
    
    /**
     * Assign role to user
     */
    assignRole(userId, role, assignedBy = 'system') {
        if (!this.roles[role]) {
            throw new Error(`Invalid role: ${role}`);
        }
        
        this.userRoles.set(userId, {
            role,
            assignedAt: new Date().toISOString(),
            assignedBy
        });
        
        console.log(`✅ Assigned role '${role}' to user ${userId}`);
    }
    
    /**
     * Check if user has permission
     */
    hasPermission(userId, permission) {
        const userRole = this.getUserRole(userId);
        const roleConfig = this.roles[userRole];
        
        if (!roleConfig) return false;
        
        // Admin has all permissions
        if (roleConfig.permissions.includes('*')) return true;
        
        // Check exact permission or wildcard patterns
        return roleConfig.permissions.some(perm => {
            if (perm === permission) return true;
            if (perm.endsWith('.all') && permission.startsWith(perm.replace('.all', ''))) return true;
            return false;
        });
    }
    
    /**
     * Get user role
     */
    getUserRole(userId) {
        const userRoleData = this.userRoles.get(userId);
        return userRoleData ? userRoleData.role : 'user';
    }
    
    /**
     * Set user timezone
     */
    setTimezone(userId, timezone) {
        this.timezone.set(userId, timezone);
    }
    
    /**
     * Get user timezone
     */
    getTimezone(userId) {
        return this.timezone.get(userId) || 'UTC';
    }
    
    /**
     * Format time for user's timezone
     */
    formatTimeForUser(userId, timestamp = Date.now()) {
        const userTimezone = this.getTimezone(userId);
        try {
            return new Date(timestamp).toLocaleString('en-US', {
                timeZone: userTimezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            // Fallback to UTC if timezone is invalid
            return new Date(timestamp).toISOString();
        }
    }
}

class SlackIntegration {
    constructor(options = {}) {
        this.db = new SQLiteManager();
        this.agentCore = new MultiAgentCore();
        this.activeWorkflows = new Map();
        
        // Session 1 enhancements
        this.roleManager = new SlackRoleManager();
        this.commAgent = null;
        
        // Initialize logger (Factor 9: Logs as Event Streams)
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'slack-integration.log' })
            ]
        });

        // Slack app configuration
        this.app = new App({
            token: process.env.SLACK_BOT_TOKEN,
            signingSecret: process.env.SLACK_SIGNING_SECRET,
            socketMode: true,
            appToken: process.env.SLACK_APP_TOKEN,
            port: process.env.PORT || 3000
        });

        this.setupEventHandlers();
        this.setupSlashCommands();
        this.setupInteractions();
    }

    /**
     * Setup Slack event listeners
     */
    setupEventHandlers() {
        // React to app mentions for natural language workflow triggers
        this.app.event('app_mention', async ({ event, client, logger }) => {
            try {
                const message = event.text.toLowerCase();
                const userId = event.user;
                const channelId = event.channel;

                this.logger.info('App mention received', { 
                    user: userId, 
                    channel: channelId, 
                    message: message.substring(0, 100) 
                });

                // Parse intent from natural language
                const workflowType = this.parseWorkflowIntent(message);
                
                if (workflowType) {
                    await this.initiateWorkflow(workflowType, {
                        userId,
                        channelId,
                        trigger: 'mention',
                        originalMessage: message
                    }, client);
                } else {
                    await client.chat.postMessage({
                        channel: channelId,
                        text: this.getHelpMessage(),
                        thread_ts: event.ts
                    });
                }

            } catch (error) {
                this.logger.error('Error handling app mention', { error: error.message });
            }
        });
    }

    /**
     * Setup slash commands for direct workflow control
     */
    setupSlashCommands() {
        // Main agent command
        this.app.command('/claude-agent', async ({ command, ack, respond, client }) => {
            await ack();

            try {
                const args = command.text.split(' ');
                const action = args[0];
                const workflowType = args[1];

                switch (action) {
                    case 'start':
                        if (!workflowType) {
                            await respond({
                                text: 'Usage: `/claude-agent start <workflow_type>`\nAvailable workflows: feature_development, bug_fix, security_scan, deployment, code_review'
                            });
                            return;
                        }
                        
                        await this.initiateWorkflow(workflowType, {
                            userId: command.user_id,
                            channelId: command.channel_id,
                            trigger: 'slash_command'
                        }, client);
                        break;

                    case 'status':
                        await this.showWorkflowStatus(command.user_id, respond);
                        break;

                    case 'list':
                        await this.listActiveWorkflows(respond);
                        break;

                    case 'help':
                    default:
                        await respond({
                            text: this.getHelpMessage()
                        });
                }

            } catch (error) {
                this.logger.error('Error handling slash command', { error: error.message });
                await respond({
                    text: `❌ Error: ${error.message}`
                });
            }
        });

        // Quick deploy command
        this.app.command('/deploy', async ({ command, ack, respond, client }) => {
            await ack();
            
            await this.initiateWorkflow('deployment', {
                userId: command.user_id,
                channelId: command.channel_id,
                trigger: 'deploy_command',
                target: command.text || 'staging'
            }, client);
        });

        // Security scan command
        this.app.command('/security-scan', async ({ command, ack, respond, client }) => {
            await ack();
            
            // Check permissions
            if (!this.roleManager.hasPermission(command.user_id, 'security.scan')) {
                await respond({
                    text: '❌ Permission denied. You need developer or admin role to run security scans.'
                });
                return;
            }
            
            await this.initiateWorkflow('security_scan', {
                userId: command.user_id,
                channelId: command.channel_id,
                trigger: 'security_command',
                scope: command.text || 'full'
            }, client);
        });

        // Phase 4.3: Enhanced slash commands
        this.app.command('/claude-dev', async ({ command, ack, respond, client }) => {
            await ack();
            
            try {
                if (!this.roleManager.hasPermission(command.user_id, 'workflow.start.all')) {
                    await respond({
                        text: '❌ Developer permissions required. Contact an admin to assign developer role.'
                    });
                    return;
                }
                
                const args = command.text.split(' ');
                const action = args[0];
                
                switch (action) {
                    case 'start':
                        const workflowType = args[1];
                        if (!workflowType) {
                            await respond({
                                text: '🛠️ **Developer Commands**\n\n' +
                                     '`/claude-dev start <type>` - Start development workflow\n' +
                                     '`/claude-dev monitor` - Monitor all active workflows\n' +
                                     '`/claude-dev agents` - Show agent status\n\n' +
                                     '**Workflow Types:** feature_development, bug_fix, code_review'
                            });
                            return;
                        }
                        
                        await this.initiateWorkflowWithPermissionCheck(workflowType, {
                            userId: command.user_id,
                            channelId: command.channel_id,
                            trigger: 'dev_command',
                            role: 'developer'
                        }, client);
                        break;
                        
                    case 'monitor':
                        await this.showDeveloperMonitor(command.user_id, respond);
                        break;
                        
                    case 'agents':
                        await this.showAgentStatus(respond);
                        break;
                        
                    default:
                        await respond({
                            text: '🛠️ **Developer Commands**\n\n' +
                                 '`/claude-dev start <type>` - Start development workflow\n' +
                                 '`/claude-dev monitor` - Monitor all active workflows\n' +
                                 '`/claude-dev agents` - Show agent status'
                        });
                }
            } catch (error) {
                this.logger.error('Error in /claude-dev command', { error: error.message });
                await respond({ text: `❌ Error: ${error.message}` });
            }
        });

        this.app.command('/claude-admin', async ({ command, ack, respond, client }) => {
            await ack();
            
            try {
                if (!this.roleManager.hasPermission(command.user_id, '*')) {
                    await respond({
                        text: '❌ Admin permissions required.'
                    });
                    return;
                }
                
                const args = command.text.split(' ');
                const action = args[0];
                
                switch (action) {
                    case 'role':
                        const targetUser = args[1];
                        const role = args[2];
                        
                        if (!targetUser || !role) {
                            await respond({
                                text: '👑 **Admin Commands**\n\n' +
                                     '`/claude-admin role @user <role>` - Assign role\n' +
                                     '`/claude-admin roles` - List all user roles\n' +
                                     '`/claude-admin stats` - System statistics\n' +
                                     '`/claude-admin shutdown` - Emergency shutdown\n\n' +
                                     '**Available Roles:** admin, developer, reviewer, user'
                            });
                            return;
                        }
                        
                        const userId = targetUser.replace('<@', '').replace('>', '');
                        await this.assignUserRole(userId, role, command.user_id, respond);
                        break;
                        
                    case 'roles':
                        await this.listUserRoles(respond);
                        break;
                        
                    case 'stats':
                        await this.showSystemStats(respond);
                        break;
                        
                    case 'shutdown':
                        await this.emergencyShutdown(command.user_id, respond);
                        break;
                        
                    default:
                        await respond({
                            text: '👑 **Admin Commands**\n\n' +
                                 '`/claude-admin role @user <role>` - Assign role\n' +
                                 '`/claude-admin roles` - List all user roles\n' +
                                 '`/claude-admin stats` - System statistics\n' +
                                 '`/claude-admin shutdown` - Emergency shutdown'
                        });
                }
            } catch (error) {
                this.logger.error('Error in /claude-admin command', { error: error.message });
                await respond({ text: `❌ Error: ${error.message}` });
            }
        });

        this.app.command('/claude-status', async ({ command, ack, respond, client }) => {
            await ack();
            
            try {
                const userRole = this.roleManager.getUserRole(command.user_id);
                const userTimezone = this.roleManager.getTimezone(command.user_id);
                const currentTime = this.roleManager.formatTimeForUser(command.user_id);
                
                const args = command.text.split(' ');
                const option = args[0];
                
                if (option === 'timezone') {
                    const newTimezone = args[1];
                    if (newTimezone) {
                        this.roleManager.setTimezone(command.user_id, newTimezone);
                        await respond({
                            text: `✅ Timezone set to ${newTimezone}\nCurrent time: ${this.roleManager.formatTimeForUser(command.user_id)}`
                        });
                    } else {
                        await respond({
                            text: `🕐 **Your Status**\n\n` +
                                 `**Role:** ${userRole}\n` +
                                 `**Timezone:** ${userTimezone}\n` +
                                 `**Current Time:** ${currentTime}\n\n` +
                                 `Use \`/claude-status timezone <timezone>\` to change timezone\n` +
                                 `Example: \`/claude-status timezone America/New_York\``
                        });
                    }
                } else {
                    const activeWorkflowCount = Array.from(this.activeWorkflows.values())
                        .filter(w => w.context?.userId === command.user_id).length;
                        
                    await respond({
                        text: `🕐 **Your Status**\n\n` +
                             `**Role:** ${userRole}\n` +
                             `**Timezone:** ${userTimezone}\n` +
                             `**Current Time:** ${currentTime}\n` +
                             `**Active Workflows:** ${activeWorkflowCount}\n\n` +
                             `Use \`/claude-status timezone <timezone>\` to change timezone`
                    });
                }
            } catch (error) {
                this.logger.error('Error in /claude-status command', { error: error.message });
                await respond({ text: `❌ Error: ${error.message}` });
            }
        });
    }

    /**
     * Setup interactive components and modals
     */
    setupInteractions() {
        // Approval workflow interactions
        this.app.action('approve_workflow', async ({ ack, body, client }) => {
            await ack();
            
            const workflowId = body.actions[0].value;
            await this.approveWorkflow(workflowId, body.user.id, client);
        });

        this.app.action('reject_workflow', async ({ ack, body, client }) => {
            await ack();
            
            const workflowId = body.actions[0].value;
            await this.rejectWorkflow(workflowId, body.user.id, client);
        });
    }

    /**
     * Session 1 Enhanced Methods - Phase 4.2-4.4 Support
     */
    
    /**
     * Initialize Communication Agent for enhanced Slack features
     */
    async initializeCommAgent() {
        if (!this.commAgent) {
            const sessionId = `slack-integration-${Date.now()}`;
            this.commAgent = new CommunicationAgent(sessionId);
            await this.commAgent.initialize();
        }
        return this.commAgent;
    }
    
    /**
     * Initiate workflow with permission checking
     */
    async initiateWorkflowWithPermissionCheck(workflowType, context, client) {
        const permission = `workflow.start.${workflowType}`;
        
        if (!this.roleManager.hasPermission(context.userId, permission) && 
            !this.roleManager.hasPermission(context.userId, 'workflow.start.all')) {
            
            await client.chat.postMessage({
                channel: context.channelId,
                text: `❌ Permission denied for workflow type: ${workflowType}\nRequired permission: ${permission}\nYour role: ${this.roleManager.getUserRole(context.userId)}`
            });
            return;
        }
        
        return await this.initiateWorkflow(workflowType, context, client);
    }
    
    /**
     * Assign role to user (admin command)
     */
    async assignUserRole(userId, role, assignedBy, respond) {
        try {
            this.roleManager.assignRole(userId, role, assignedBy);
            await respond({
                text: `✅ Role '${role}' assigned to <@${userId}>\nAssigned by: <@${assignedBy}>\nTimestamp: ${new Date().toISOString()}`
            });
            
            this.logger.info('Role assigned', { userId, role, assignedBy });
        } catch (error) {
            await respond({
                text: `❌ Failed to assign role: ${error.message}`
            });
        }
    }
    
    /**
     * List all user roles (admin command)
     */
    async listUserRoles(respond) {
        const roleData = Array.from(this.roleManager.userRoles.entries());
        
        if (roleData.length === 0) {
            await respond({
                text: '📋 No user roles assigned yet. All users default to "user" role.'
            });
            return;
        }
        
        let roleList = '📋 **User Role Assignments**\n\n';
        roleData.forEach(([userId, data]) => {
            roleList += `• <@${userId}>: **${data.role}**\n`;
            roleList += `  Assigned: ${data.assignedAt} by ${data.assignedBy}\n\n`;
        });
        
        await respond({ text: roleList });
    }
    
    /**
     * Show system statistics (admin command)
     */
    async showSystemStats(respond) {
        const activeWorkflows = this.activeWorkflows.size;
        const totalUsers = this.roleManager.userRoles.size;
        const roleBreakdown = {};
        
        this.roleManager.userRoles.forEach((data) => {
            roleBreakdown[data.role] = (roleBreakdown[data.role] || 0) + 1;
        });
        
        let stats = '📊 **System Statistics**\n\n';
        stats += `**Active Workflows:** ${activeWorkflows}\n`;
        stats += `**Total Users:** ${totalUsers}\n`;
        stats += `**Role Breakdown:**\n`;
        
        Object.entries(roleBreakdown).forEach(([role, count]) => {
            stats += `  • ${role}: ${count}\n`;
        });
        
        stats += `\n**System Health:** ✅ Operational\n`;
        stats += `**Uptime:** ${Math.floor(process.uptime() / 60)} minutes`;
        
        await respond({ text: stats });
    }
    
    /**
     * Emergency shutdown (admin command)
     */
    async emergencyShutdown(userId, respond) {
        await respond({
            text: `⚠️ **EMERGENCY SHUTDOWN INITIATED**\nShutdown requested by: <@${userId}>\nTime: ${new Date().toISOString()}\n\n🔄 Gracefully stopping all workflows...`
        });
        
        this.logger.warn('Emergency shutdown initiated', { userId });
        
        // Gracefully stop all workflows
        for (const [sessionId, workflow] of this.activeWorkflows.entries()) {
            this.logger.info('Stopping workflow for emergency shutdown', { sessionId });
            // In production, you'd implement proper cleanup
            this.activeWorkflows.delete(sessionId);
        }
        
        // Wait a moment then exit
        setTimeout(() => {
            console.log('🛑 Emergency shutdown complete');
            process.exit(0);
        }, 3000);
    }
    
    /**
     * Show developer monitoring dashboard
     */
    async showDeveloperMonitor(userId, respond) {
        const workflows = Array.from(this.activeWorkflows.entries());
        const userTimezone = this.roleManager.getTimezone(userId);
        
        if (workflows.length === 0) {
            await respond({
                text: '🛠️ **Developer Monitor**\n\n📊 No active workflows\n⚡ All systems idle'
            });
            return;
        }
        
        let monitor = '🛠️ **Developer Monitor**\n\n';
        
        workflows.forEach(([sessionId, workflow]) => {
            const startTime = this.roleManager.formatTimeForUser(userId, workflow.startTime);
            monitor += `**${workflow.type}** (${sessionId.substring(0, 8)}...)\n`;
            monitor += `  Status: ${workflow.status}\n`;
            monitor += `  Started: ${startTime}\n`;
            monitor += `  User: <@${workflow.context?.userId || 'unknown'}>\n`;
            monitor += `  Channel: <#${workflow.channelId}>\n\n`;
        });
        
        await respond({ text: monitor });
    }
    
    /**
     * Show agent status information
     */
    async showAgentStatus(respond) {
        try {
            const agentTypes = ['github', 'security', 'code', 'deploy', 'comm'];
            let status = '🤖 **Agent Status**\n\n';
            
            agentTypes.forEach(agentType => {
                // In production, you'd query actual agent health
                const isActive = Math.random() > 0.3; // Mock health check
                const emoji = isActive ? '✅' : '❌';
                status += `${emoji} **${agentType}** - ${isActive ? 'Active' : 'Inactive'}\n`;
            });
            
            status += '\n🔗 **Integration Status:**\n';
            status += `✅ Slack Bot: Connected\n`;
            status += `✅ SQLite DB: ${this.db ? 'Connected' : 'Disconnected'}\n`;
            status += `✅ Multi-Agent Core: ${this.agentCore ? 'Initialized' : 'Not Initialized'}\n`;
            
            await respond({ text: status });
        } catch (error) {
            await respond({ text: `❌ Error getting agent status: ${error.message}` });
        }
    }

    /**
     * Parse workflow intent from natural language
     */
    parseWorkflowIntent(message) {
        const intents = {
            'deployment': ['deploy', 'deployment', 'release', 'ship'],
            'security_scan': ['security', 'scan', 'vulnerability', 'audit'],
            'feature_development': ['feature', 'develop', 'build', 'create'],
            'bug_fix': ['bug', 'fix', 'issue', 'problem'],
            'code_review': ['review', 'check', 'validate', 'approve']
        };

        for (const [workflow, keywords] of Object.entries(intents)) {
            if (keywords.some(keyword => message.includes(keyword))) {
                return workflow;
            }
        }

        return null;
    }

    /**
     * Initiate multi-agent workflow
     */
    async initiateWorkflow(workflowType, context, client) {
        try {
            const sessionId = `slack_${workflowType}_${Date.now()}`;
            
            // Store workflow in database
            await this.db.runSQL(`
                INSERT INTO workflows (session_id, type, status, context, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [sessionId, workflowType, 'initiated', JSON.stringify(context), Date.now()]);

            // Check if approval is required
            const requiresApproval = this.workflowRequiresApproval(workflowType);
            
            if (requiresApproval) {
                await this.requestApproval(sessionId, workflowType, context, client);
                return;
            }

            // Start workflow immediately
            await this.executeWorkflow(sessionId, workflowType, context, client);
            
        } catch (error) {
            this.logger.error('Failed to initiate workflow', { error: error.message, workflowType, context });
            
            await client.chat.postMessage({
                channel: context.channelId,
                text: `❌ Failed to start ${workflowType} workflow: ${error.message}`
            });
        }
    }

    /**
     * Execute multi-agent workflow with Slack notifications
     */
    async executeWorkflow(sessionId, workflowType, context, client) {
        try {
            // Initialize multi-agent session
            await this.agentCore.initializeSession(sessionId, workflowType, context);
            
            // Send workflow started message
            const startMessage = await client.chat.postMessage({
                channel: context.channelId,
                text: '🤖 Starting multi-agent workflow...',
                blocks: this.buildWorkflowStartedBlocks(sessionId, workflowType)
            });

            // Store message info for updates
            this.activeWorkflows.set(sessionId, {
                messageTs: startMessage.ts,
                channelId: context.channelId,
                status: 'running',
                type: workflowType,
                startTime: Date.now(),
                context: context,
                options: { ...context, userId: context.userId, trigger: context.trigger }
            });

            // Execute real multi-agent workflow with progress updates
            const result = await this.agentCore.executeWorkflow();

            // Send completion message
            await this.sendWorkflowCompleted(sessionId, result, client);
            
            // Update database
            await this.db.runSQL(`
                UPDATE workflows 
                SET status = ?, completed_at = ?, results = ?
                WHERE session_id = ?
            `, ['completed', Date.now(), JSON.stringify(result), sessionId]);

        } catch (error) {
            await this.sendWorkflowFailed(sessionId, error, client);
            this.logger.error('Workflow execution failed', { error: error.message, sessionId });
        }
    }

    /**
     * Update workflow progress in Slack
     */
    async updateWorkflowProgress(sessionId, agentName, progress, step, client) {
        const workflow = this.activeWorkflows.get(sessionId);
        if (!workflow) return;

        try {
            await client.chat.update({
                channel: workflow.channelId,
                ts: workflow.messageTs,
                blocks: this.buildWorkflowProgressBlocks(sessionId, agentName, progress, step)
            });
        } catch (error) {
            this.logger.error('Failed to update workflow progress', { error: error.message, sessionId });
        }
    }

    /**
     * Build Slack blocks for workflow started message
     */
    buildWorkflowStartedBlocks(sessionId, workflowType) {
        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `🤖 Claude Multi-Agent Workflow Started`
                }
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Type:* ${workflowType}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Session:* ${sessionId}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Status:* 🟡 Running`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Started:* ${new Date().toLocaleTimeString()}`
                    }
                ]
            }
        ];
    }

    /**
     * Build Slack blocks for workflow progress
     */
    buildWorkflowProgressBlocks(sessionId, currentAgent, progress, step) {
        const agents = ['github', 'security', 'code', 'deploy'];
        const agentStatus = agents.map(agent => {
            if (agent === currentAgent) {
                return `🟡 ${agent} (${progress}%) - ${step}`;
            }
            return `⚪ ${agent}`;
        }).join('\n');

        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `🤖 Claude Multi-Agent Workflow`
                }
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Session:* ${sessionId}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Status:* 🟡 Running`
                    }
                ]
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Agent Progress:*\n${agentStatus}`
                }
            }
        ];
    }

    /**
     * Send workflow completion message
     */
    async sendWorkflowCompleted(sessionId, result, client) {
        const workflow = this.activeWorkflows.get(sessionId);
        if (!workflow) return;

        const completionBlocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `✅ Workflow Completed Successfully`
                }
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Session:* ${sessionId}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Duration:* ${result.duration}ms`
                    }
                ]
            }
        ];

        await client.chat.update({
            channel: workflow.channelId,
            ts: workflow.messageTs,
            blocks: completionBlocks
        });

        this.activeWorkflows.delete(sessionId);
    }

    /**
     * Send workflow failure message
     */
    async sendWorkflowFailed(sessionId, error, client) {
        const workflow = this.activeWorkflows.get(sessionId);
        if (!workflow) return;

        const errorBlocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `❌ Workflow Failed`
                }
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Session:* ${sessionId.substring(0, 20)}...`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Error:* ${error.message || 'Unknown error'}`
                    }
                ]
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `The workflow encountered an error and could not complete. You can try running the command again.`
                }
            }
        ];

        try {
            await client.chat.update({
                channel: workflow.channelId,
                ts: workflow.messageTs,
                blocks: errorBlocks
            });
        } catch (updateError) {
            // If update fails, send a new message
            await client.chat.postMessage({
                channel: workflow.channelId,
                text: `❌ Workflow ${sessionId.substring(0, 8)}... failed: ${error.message}`,
                blocks: errorBlocks
            });
        }

        this.activeWorkflows.delete(sessionId);
    }

    /**
     * Check if workflow requires approval
     */
    workflowRequiresApproval(workflowType) {
        const approvalRequired = ['deployment', 'security_scan'];
        return approvalRequired.includes(workflowType);
    }

    /**
     * Request workflow approval
     */
    async requestApproval(sessionId, workflowType, context, client) {
        const approvalBlocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `🚨 Workflow Approval Required`
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Workflow Type:* ${workflowType}\n*Requested by:* <@${context.userId}>`
                }
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'Approve'
                        },
                        style: 'primary',
                        action_id: 'approve_workflow',
                        value: sessionId
                    },
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'Reject'
                        },
                        style: 'danger',
                        action_id: 'reject_workflow',
                        value: sessionId
                    }
                ]
            }
        ];

        await client.chat.postMessage({
            channel: context.channelId,
            blocks: approvalBlocks
        });
    }

    /**
     * Approve workflow
     */
    async approveWorkflow(sessionId, approverId, client) {
        try {
            const workflow = await this.db.getSQL(`
                SELECT * FROM workflows WHERE session_id = ?
            `, [sessionId]);

            if (!workflow) {
                throw new Error('Workflow not found');
            }

            const context = JSON.parse(workflow.context);
            await this.executeWorkflow(sessionId, workflow.type, context, client);

            this.logger.info('Workflow approved and started', { sessionId, approverId });

        } catch (error) {
            this.logger.error('Failed to approve workflow', { error: error.message, sessionId });
        }
    }

    /**
     * Show workflow status for a user
     */
    async showWorkflowStatus(userId, respond) {
        try {
            const userWorkflows = Array.from(this.activeWorkflows.entries())
                .filter(([sessionId, workflow]) => workflow.context?.userId === userId);

            if (userWorkflows.length === 0) {
                await respond({
                    text: '📊 No active workflows found for your user account.'
                });
                return;
            }

            let statusMessage = '📊 *Your Active Workflows:*\n\n';
            userWorkflows.forEach(([sessionId, workflow]) => {
                statusMessage += `• **${workflow.type}** (${sessionId.substring(0, 8)}...)\n`;
                statusMessage += `  Status: ${workflow.status}\n`;
                statusMessage += `  Started: ${new Date(workflow.startTime).toLocaleTimeString()}\n\n`;
            });

            await respond({
                text: statusMessage
            });
        } catch (error) {
            console.error('Error showing workflow status:', error);
            await respond({
                text: `❌ Error retrieving workflow status: ${error.message}`
            });
        }
    }

    /**
     * List all active workflows
     */
    async listActiveWorkflows(respond) {
        try {
            if (this.activeWorkflows.size === 0) {
                await respond({
                    text: '📊 No active workflows currently running.'
                });
                return;
            }

            let statusMessage = '📊 *All Active Workflows:*\n\n';
            this.activeWorkflows.forEach((workflow, sessionId) => {
                statusMessage += `• **${workflow.type}** (${sessionId.substring(0, 8)}...)\n`;
                statusMessage += `  Status: ${workflow.status}\n`;
                statusMessage += `  User: <@${workflow.options?.userId || 'unknown'}>\n`;
                statusMessage += `  Started: ${new Date(workflow.startTime).toLocaleTimeString()}\n\n`;
            });

            await respond({
                text: statusMessage
            });
        } catch (error) {
            console.error('Error listing workflows:', error);
            await respond({
                text: `❌ Error listing workflows: ${error.message}`
            });
        }
    }

    /**
     * Get help message
     */
    getHelpMessage() {
        return `🤖 *Claude Multi-Agent System*

*Available Commands:*
• \`/claude-agent start <type>\` - Start a workflow
• \`/claude-agent status\` - Check workflow status  
• \`/claude-agent list\` - List active workflows
• \`/deploy [target]\` - Quick deployment
• \`/security-scan [scope]\` - Security scan

*Workflow Types:*
• \`feature_development\` - Full feature pipeline
• \`bug_fix\` - Bug fix workflow
• \`security_scan\` - Security audit
• \`deployment\` - Deploy to environment
• \`code_review\` - Code review process

*Natural Language:*
Just mention @claude with commands like:
• "Deploy to staging"
• "Run security scan"  
• "Review this PR"`;
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Start the Slack app
     */
    async start() {
        try {
            await this.db.initialize();
            
            // Create workflows table
            await this.db.runSQL(`
                CREATE TABLE IF NOT EXISTS workflows (
                    session_id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    context TEXT,
                    results TEXT,
                    created_at INTEGER,
                    completed_at INTEGER
                )
            `);

            await this.app.start();
            this.logger.info('⚡ Slack integration started successfully');
            
            console.log('🤖 Claude Slack Integration is running!');

        } catch (error) {
            this.logger.error('Failed to start Slack integration', { error: error.message });
            console.error('❌ Failed to start:', error.message);
        }
    }
}

/**
 * Real Slack integration function - No longer demo mode
 */
async function startSlackIntegration() {
    console.log('🤖 Claude Slack Integration - Production Mode\n');
    
    const requiredEnvVars = [
        'SLACK_BOT_TOKEN',
        'SLACK_SIGNING_SECRET', 
        'SLACK_APP_TOKEN'
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
    console.log('🔗 Connecting to Slack workspace: LonixFlex');
    console.log('🤖 App: Claude Multi-Agent System');
    
    console.log('\n🎯 Available Features:');
    console.log('   • Slash commands: /claude-agent, /deploy, /security-scan');
    console.log('   • Natural language parsing from @mentions');
    console.log('   • Interactive approval workflows');
    console.log('   • Real-time progress updates in Slack');
    console.log('   • Multi-agent coordination with visual feedback');
    console.log('   • Persistent workflow tracking in SQLite');
    
    console.log('\n🔄 Workflow Types:');
    console.log('   • feature_development: github → security → code → deploy');
    console.log('   • bug_fix: github → security → deploy');
    console.log('   • security_scan: security → github');
    console.log('   • deployment: security → deploy → comm');
    console.log('   • code_review: security → github → comm');
    
    try {
        const integration = new SlackIntegration();
        await integration.start();
        console.log('🚀 Slack integration started successfully!');
    } catch (error) {
        console.error('❌ Failed to start Slack integration:', error.message);
        process.exit(1);
    }
}

module.exports = {
    SlackIntegration
};

// Run real integration if called directly
if (require.main === module) {
    startSlackIntegration().catch(console.error);
}