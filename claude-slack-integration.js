const { App } = require('@slack/bolt');
const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SQLiteManager } = require('./database/sqlite-manager');
const winston = require('winston');
require('dotenv').config();

/**
 * Claude Slack Integration - Factor 11: Trigger From Anywhere
 * 
 * Integrates Claude multi-agent system with Slack for human-to-agent communication
 * Following 12-Factor Agent principles
 */
class SlackIntegration {
    constructor(options = {}) {
        this.db = new SQLiteManager();
        this.agentCore = new MultiAgentCore();
        this.activeWorkflows = new Map();
        
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
            
            await this.initiateWorkflow('security_scan', {
                userId: command.user_id,
                channelId: command.channel_id,
                trigger: 'security_command',
                scope: command.text || 'full'
            }, client);
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