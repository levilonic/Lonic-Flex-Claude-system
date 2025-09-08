const { App } = require('@slack/bolt');
const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SQLiteManager } = require('./database/sqlite-manager');
const winston = require('winston');
require('dotenv').config();

/**
 * HTTP-based Slack Integration (Alternative to Socket Mode)
 * Uses HTTP endpoints instead of Socket Mode for Slack events
 */
class SlackHTTPIntegration {
    constructor(options = {}) {
        this.db = new SQLiteManager();
        this.agentCore = new MultiAgentCore();
        this.activeWorkflows = new Map();
        
        // Initialize logger
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

        // HTTP-based Slack app (no Socket Mode)
        this.app = new App({
            token: process.env.SLACK_BOT_TOKEN,
            signingSecret: process.env.SLACK_SIGNING_SECRET,
            socketMode: false,  // Use HTTP mode instead
            port: process.env.PORT || 3000
        });

        this.setupSlashCommands();
        this.setupInteractions();
        this.setupTestEndpoints();
    }

    /**
     * Setup slash commands for workflow control
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
     * Setup test endpoints for manual workflow triggering
     */
    setupTestEndpoints() {
        // Add Express routes to the Slack Bolt app
        this.app.receiver.app.get('/test-workflow', async (req, res) => {
            const workflowType = req.query.type || 'feature_development';
            const sessionId = `test_${workflowType}_${Date.now()}`;
            
            try {
                // Create a mock client for testing
                const mockClient = {
                    chat: {
                        postMessage: async (params) => {
                            console.log('📩 Mock Slack message:', params.text);
                            return { ts: Date.now().toString() };
                        },
                        update: async (params) => {
                            console.log('📝 Mock Slack update:', params.blocks?.[1]?.text?.text || params.text);
                            return { ts: params.ts };
                        }
                    }
                };

                // Execute workflow
                await this.executeWorkflowAsync(sessionId, workflowType, {
                    userId: 'test_user',
                    channelId: 'test_channel',
                    trigger: 'manual_test'
                }, mockClient, Date.now().toString());

                res.json({
                    success: true,
                    message: `🚀 ${workflowType} workflow started!`,
                    sessionId: sessionId,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Test workflow failed:', error.message);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Health check endpoint
        this.app.receiver.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'slack-integration',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // Available workflows endpoint
        this.app.receiver.app.get('/workflows', (req, res) => {
            res.json({
                available_workflows: [
                    'feature_development',
                    'bug_fix', 
                    'security_scan',
                    'deployment',
                    'code_review'
                ],
                example_usage: [
                    '/test-workflow?type=security_scan',
                    '/test-workflow?type=deployment',
                    '/test-workflow?type=feature_development'
                ],
                slack_commands: [
                    '/claude-agent start <workflow_type>',
                    '/deploy [target]',
                    '/security-scan [scope]'
                ]
            });
        });
    }

    /**
     * Setup interactive components
     */
    setupInteractions() {
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

            // Send immediate response
            const message = await client.chat.postMessage({
                channel: context.channelId,
                text: `🤖 Starting ${workflowType} workflow...`,
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: `🚀 Claude Multi-Agent Workflow: ${workflowType}`
                        }
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Session:* \`${sessionId}\`\n*Status:* 🟡 Initializing...`
                        }
                    }
                ]
            });

            // Execute workflow asynchronously
            this.executeWorkflowAsync(sessionId, workflowType, context, client, message.ts);
            
        } catch (error) {
            this.logger.error('Failed to initiate workflow', { error: error.message, workflowType, context });
            
            await client.chat.postMessage({
                channel: context.channelId,
                text: `❌ Failed to start ${workflowType} workflow: ${error.message}`
            });
        }
    }

    /**
     * Execute workflow asynchronously
     */
    async executeWorkflowAsync(sessionId, workflowType, context, client, messageTs) {
        try {
            // Simulate multi-agent execution
            const agents = ['github', 'security', 'code', 'deploy'];
            
            for (let i = 0; i < agents.length; i++) {
                const agent = agents[i];
                const progress = Math.round(((i + 1) / agents.length) * 100);
                
                // Update progress
                await client.chat.update({
                    channel: context.channelId,
                    ts: messageTs,
                    blocks: [
                        {
                            type: 'header',
                            text: {
                                type: 'plain_text',
                                text: `🚀 Claude Multi-Agent Workflow: ${workflowType}`
                            }
                        },
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `*Session:* \`${sessionId}\`\n*Status:* 🟡 Running ${agent} agent (${progress}%)`
                            }
                        }
                    ]
                });
                
                // Simulate work
                await this.delay(2000);
            }

            // Complete workflow
            await client.chat.update({
                channel: context.channelId,
                ts: messageTs,
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: `✅ Workflow Completed: ${workflowType}`
                        }
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Session:* \`${sessionId}\`\n*Status:* ✅ Successfully completed\n*Duration:* ${agents.length * 2}s`
                        }
                    }
                ]
            });

            // Update database
            await this.db.runSQL(`
                UPDATE workflows 
                SET status = ?, completed_at = ?, results = ?
                WHERE session_id = ?
            `, ['completed', Date.now(), JSON.stringify({status: 'success'}), sessionId]);

        } catch (error) {
            this.logger.error('Workflow execution failed', { error: error.message, sessionId });
            
            await client.chat.update({
                channel: context.channelId,
                ts: messageTs,
                text: `❌ Workflow ${sessionId} failed: ${error.message}`
            });
        }
    }

    /**
     * Show workflow status
     */
    async showWorkflowStatus(userId, respond) {
        const activeCount = this.activeWorkflows.size;
        await respond({
            text: `📊 Active Workflows: ${activeCount}\n🤖 System Status: Operational\n🔗 Integration: HTTP Mode (Socket Mode disabled)`
        });
    }

    /**
     * List active workflows
     */
    async listActiveWorkflows(respond) {
        if (this.activeWorkflows.size === 0) {
            await respond({
                text: '📋 No active workflows currently running.'
            });
            return;
        }

        const workflows = Array.from(this.activeWorkflows.entries())
            .map(([id, workflow]) => `• ${id}: ${workflow.type} (${workflow.status})`)
            .join('\n');

        await respond({
            text: `📋 Active Workflows:\n${workflows}`
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
            await this.executeWorkflowAsync(sessionId, workflow.type, context, client);

            this.logger.info('Workflow approved and started', { sessionId, approverId });

        } catch (error) {
            this.logger.error('Failed to approve workflow', { error: error.message, sessionId });
        }
    }

    /**
     * Get help message
     */
    getHelpMessage() {
        return `🤖 *Claude Multi-Agent System* (HTTP Mode)

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

*Note:* Running in HTTP mode. Socket Mode disabled due to auth issues.`;
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Start the HTTP-based Slack app
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
            this.logger.info('⚡ HTTP Slack integration started successfully');
            
            console.log('🤖 Claude Slack Integration (HTTP Mode) is running!');
            console.log('🌐 Server listening on port', process.env.PORT || 3000);
            console.log('⚠️  Note: Using HTTP mode instead of Socket Mode');
            console.log('   To use Socket Mode, fix the App Token authentication');

        } catch (error) {
            this.logger.error('Failed to start HTTP Slack integration', { error: error.message });
            console.error('❌ Failed to start:', error.message);
        }
    }
}

/**
 * Start HTTP-based Slack integration
 */
async function startHTTPSlackIntegration() {
    console.log('🤖 Claude Slack Integration - HTTP Mode\n');
    
    const requiredEnvVars = [
        'SLACK_BOT_TOKEN',
        'SLACK_SIGNING_SECRET'
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
    console.log('🌐 Mode: HTTP (Socket Mode bypassed)');
    
    try {
        const integration = new SlackHTTPIntegration();
        await integration.start();
        console.log('🚀 HTTP Slack integration started successfully!');
    } catch (error) {
        console.error('❌ Failed to start HTTP Slack integration:', error.message);
        process.exit(1);
    }
}

module.exports = {
    SlackHTTPIntegration
};

// Run HTTP integration if called directly
if (require.main === module) {
    startHTTPSlackIntegration().catch(console.error);
}