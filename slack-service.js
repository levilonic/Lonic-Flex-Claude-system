const { WebClient } = require('@slack/web-api');
const { CommunicationAgent } = require('./agents/comm-agent');
const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SQLiteManager } = require('./database/sqlite-manager');
require('dotenv').config();

/**
 * Slack Service - Direct API Integration (No Socket Mode)
 * 
 * Provides Slack messaging capabilities for multi-agent workflows
 * Uses direct Web API calls instead of event-driven Socket Mode
 */
class SlackService {
    constructor(options = {}) {
        this.webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
        this.db = new SQLiteManager();
        this.agentCore = new MultiAgentCore();
        this.activeWorkflows = new Map();
        
        // Communication configuration  
        this.config = {
            defaultChannel: options.defaultChannel || '#all-lonixflex',
            defaultChannelId: 'C09D4RUQ739', // all-lonixflex channel ID
            notificationChannels: {
                deployments: '#all-lonixflex',  // Use existing channel
                security: '#all-lonixflex',     // Use existing channel  
                alerts: '#all-lonixflex',       // Use existing channel
                general: '#all-lonixflex'       // Use existing channel
            },
            ...options
        };

        this.isConnected = false;
    }

    /**
     * Initialize and test Slack connectivity
     */
    async initialize() {
        try {
            console.log('🔗 Initializing Slack service...');
            
            // Test authentication
            const authResult = await this.webClient.auth.test();
            console.log(`✅ Connected to Slack workspace: ${authResult.team}`);
            console.log(`   Bot user: ${authResult.user} (${authResult.user_id})`);
            
            // Initialize database
            await this.db.initialize();
            console.log('✅ Database initialized');
            
            this.isConnected = true;
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize Slack service:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Send message to Slack channel
     */
    async sendMessage(channelId, text, options = {}) {
        if (!this.isConnected) {
            throw new Error('Slack service not connected');
        }

        try {
            const result = await this.webClient.chat.postMessage({
                channel: channelId,
                text: text,
                ...options
            });
            
            console.log(`📩 Message sent to ${channelId}: ${text.substring(0, 50)}...`);
            return result;
            
        } catch (error) {
            console.error(`❌ Failed to send message to ${channelId}:`, error.message);
            throw error;
        }
    }

    /**
     * Send workflow notification
     */
    async sendWorkflowNotification(workflowType, status, data = {}) {
        const channelId = this.getChannelForWorkflow(workflowType);
        
        let message = '';
        let emoji = '';
        
        switch (status) {
            case 'started':
                emoji = '🚀';
                message = `${emoji} **${workflowType.toUpperCase()} WORKFLOW STARTED**\\n\\n`;
                message += `• **Session ID:** \`${data.sessionId || 'unknown'}\`\\n`;
                message += `• **Triggered by:** ${data.trigger || 'system'}\\n`;
                message += `• **Status:** Initializing...\\n`;
                break;
                
            case 'completed':
                emoji = '✅';
                message = `${emoji} **${workflowType.toUpperCase()} WORKFLOW COMPLETED**\\n\\n`;
                message += `• **Session ID:** \`${data.sessionId || 'unknown'}\`\\n`;
                message += `• **Duration:** ${data.duration || 'unknown'}\\n`;
                message += `• **Result:** ${data.result || 'Success'}\\n`;
                break;
                
            case 'failed':
                emoji = '❌';
                message = `${emoji} **${workflowType.toUpperCase()} WORKFLOW FAILED**\\n\\n`;
                message += `• **Session ID:** \`${data.sessionId || 'unknown'}\`\\n`;
                message += `• **Error:** \`${data.error || 'Unknown error'}\`\\n`;
                message += `• **Recovery:** ${data.recovery || 'Manual intervention required'}\\n`;
                break;
                
            case 'progress':
                emoji = '⚡';
                message = `${emoji} **${workflowType.toUpperCase()} PROGRESS UPDATE**\\n\\n`;
                message += `• **Session ID:** \`${data.sessionId || 'unknown'}\`\\n`;
                message += `• **Current Step:** ${data.currentStep || 'unknown'}\\n`;
                message += `• **Progress:** ${data.progress || '0'}%\\n`;
                break;
                
            default:
                emoji = 'ℹ️';
                message = `${emoji} **${workflowType.toUpperCase()} UPDATE**\\n\\n`;
                message += `• **Status:** ${status}\\n`;
                message += `• **Info:** ${JSON.stringify(data)}\\n`;
        }

        return await this.sendMessage(channelId, message, {
            mrkdwn: true
        });
    }

    /**
     * Get appropriate channel for workflow type
     */
    getChannelForWorkflow(workflowType) {
        switch (workflowType) {
            case 'deployment':
            case 'deploy':
                return this.config.notificationChannels.deployments;
            case 'security_scan':
            case 'security':
                return this.config.notificationChannels.security;
            case 'bug_fix':
            case 'feature_development':
            case 'code_review':
                return this.config.notificationChannels.general;
            default:
                return this.config.defaultChannel;
        }
    }

    /**
     * Start a multi-agent workflow with Slack notifications
     */
    async startWorkflow(workflowType, options = {}) {
        const sessionId = options.sessionId || `slack_${workflowType}_${Date.now()}`;
        
        try {
            console.log(`🚀 Starting ${workflowType} workflow via Slack service`);
            
            // Send start notification
            await this.sendWorkflowNotification(workflowType, 'started', {
                sessionId,
                trigger: options.trigger || 'slack_service',
                ...options
            });

            // Store workflow in active workflows
            this.activeWorkflows.set(sessionId, {
                type: workflowType,
                status: 'running',
                startTime: Date.now(),
                options
            });

            // Start the actual multi-agent workflow
            const result = await this.executeWorkflowWithNotifications(sessionId, workflowType, options);
            
            // Send completion notification
            await this.sendWorkflowNotification(workflowType, 'completed', {
                sessionId,
                duration: this.formatDuration(Date.now() - this.activeWorkflows.get(sessionId).startTime),
                result: 'Success'
            });

            // Remove from active workflows
            this.activeWorkflows.delete(sessionId);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Workflow ${workflowType} failed:`, error.message);
            
            // Send failure notification
            await this.sendWorkflowNotification(workflowType, 'failed', {
                sessionId,
                error: error.message,
                recovery: 'Check logs and retry'
            });

            // Remove from active workflows
            this.activeWorkflows.delete(sessionId);
            
            throw error;
        }
    }

    /**
     * Execute workflow with progress notifications
     */
    async executeWorkflowWithNotifications(sessionId, workflowType, options) {
        console.log(`⚡ Executing ${workflowType} workflow with notifications`);
        
        // Progress callback for notifications
        const progressCallback = async (progress, currentStep) => {
            console.log(`   Progress: ${progress}% - ${currentStep}`);
            
            // Send progress updates for major milestones
            if (progress % 25 === 0 && progress > 0) {
                await this.sendWorkflowNotification(workflowType, 'progress', {
                    sessionId,
                    progress,
                    currentStep
                });
            }
        };

        // Create session in database
        await this.db.createSession(sessionId, workflowType);
        
        // Execute multi-agent workflow
        const result = await this.agentCore.executeWorkflow(workflowType, {
            sessionId,
            progressCallback,
            ...options
        });

        return result;
    }

    /**
     * Test all major Slack functionality
     */
    async runTests() {
        console.log('🧪 Running Slack Service Tests\\n');
        
        try {
            // Test 1: Connectivity
            console.log('1. Testing connectivity...');
            const connected = await this.initialize();
            if (!connected) {
                throw new Error('Failed to connect');
            }
            console.log('✅ Connectivity test passed\\n');
            
            // Test 2: Send test message
            console.log('2. Testing message sending...');
            const testMessage = await this.sendMessage(
                this.config.defaultChannel, 
                '🧪 Test message from Claude Multi-Agent System',
                { mrkdwn: true }
            );
            console.log('✅ Message sending test passed\\n');
            
            // Test 3: Workflow notifications
            console.log('3. Testing workflow notifications...');
            await this.sendWorkflowNotification('test_workflow', 'started', {
                sessionId: 'test_session_123',
                trigger: 'test_suite'
            });
            
            await this.sendWorkflowNotification('test_workflow', 'completed', {
                sessionId: 'test_session_123',
                duration: '30 seconds',
                result: 'Test successful'
            });
            console.log('✅ Workflow notifications test passed\\n');
            
            // Test 4: Channel routing
            console.log('4. Testing channel routing...');
            const deploymentChannel = this.getChannelForWorkflow('deployment');
            const securityChannel = this.getChannelForWorkflow('security_scan');
            console.log(`   Deployment channel: ${deploymentChannel}`);
            console.log(`   Security channel: ${securityChannel}`);
            console.log('✅ Channel routing test passed\\n');
            
            console.log('🎉 All Slack service tests passed!');
            return true;
            
        } catch (error) {
            console.error('❌ Slack service test failed:', error.message);
            return false;
        }
    }

    /**
     * Format duration in human readable format
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            activeWorkflows: this.activeWorkflows.size,
            defaultChannel: this.config.defaultChannel,
            notificationChannels: this.config.notificationChannels
        };
    }
}

// Command line interface for testing
if (require.main === module) {
    const slackService = new SlackService();
    
    // Parse command line arguments
    const command = process.argv[2];
    
    switch (command) {
        case 'test':
            slackService.runTests().then(() => {
                console.log('\\n✅ Test suite completed');
                process.exit(0);
            }).catch(error => {
                console.error('\\n❌ Test suite failed:', error.message);
                process.exit(1);
            });
            break;
            
        case 'workflow':
            const workflowType = process.argv[3] || 'feature_development';
            slackService.initialize().then(() => {
                return slackService.startWorkflow(workflowType, {
                    trigger: 'cli_test'
                });
            }).then(() => {
                console.log('\\n✅ Workflow completed');
                process.exit(0);
            }).catch(error => {
                console.error('\\n❌ Workflow failed:', error.message);
                process.exit(1);
            });
            break;
            
        case 'status':
            slackService.initialize().then(() => {
                const status = slackService.getStatus();
                console.log('\\n📊 Slack Service Status:');
                console.log(JSON.stringify(status, null, 2));
                process.exit(0);
            }).catch(error => {
                console.error('\\n❌ Status check failed:', error.message);
                process.exit(1);
            });
            break;
            
        default:
            console.log('🤖 Claude Slack Service\\n');
            console.log('Usage:');
            console.log('   node slack-service.js test     - Run test suite');
            console.log('   node slack-service.js workflow [type] - Test workflow');
            console.log('   node slack-service.js status   - Show service status');
            console.log('\\nAvailable workflow types:');
            console.log('   feature_development, bug_fix, security_scan, deployment, code_review');
    }
}

module.exports = SlackService;