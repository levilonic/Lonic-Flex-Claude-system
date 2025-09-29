/**
 * Clean Multi-Agent Core - Proper Software Engineering Implementation
 *
 * This replaces the corrupted claude-multi-agent-core.js with:
 * 1. Proper dependency injection using ServiceContainer
 * 2. Real error handling and verification
 * 3. No fake success reporting
 * 4. Evidence-based operations
 * 5. Clean initialization pattern
 */

const { systemStartup } = require('../../src/core/system-startup');
const { MinimalAgent } = require('../../src/agents/minimal-agent');
const { GitHubAgent } = require('../../src/agents/github-agent');
const { SecurityAgent } = require('../../src/agents/security-agent');

class CleanMultiAgentCore {
    constructor() {
        this.serviceContainer = null;
        this.activeAgents = new Map();
        this.sessionState = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the multi-agent system using proper dependency injection
     * No more individual agent initialization chaos
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Multi-Agent Core already initialized');
            return;
        }

        console.log('🚀 Initializing Clean Multi-Agent Core...');

        try {
            // Use proven system startup pattern
            await systemStartup.initialize();
            this.serviceContainer = systemStartup.getServiceContainer();

            // Verify critical services are available
            const database = this.serviceContainer.getService('database');
            const memory = this.serviceContainer.getService('memory');

            if (!database || !memory) {
                throw new Error('Critical services not available after initialization');
            }

            this.isInitialized = true;
            console.log('✅ Clean Multi-Agent Core initialized successfully');

        } catch (error) {
            console.error('❌ Multi-Agent Core initialization FAILED:');
            console.error('Error:', error.message);
            throw error; // Don't hide failures
        }
    }

    /**
     * Create agent using proper dependency injection
     * No more bootstrap mode workarounds
     */
    async createAgent(agentType, sessionId) {
        if (!this.isInitialized) {
            throw new Error('Multi-Agent Core not initialized. Call initialize() first.');
        }

        console.log(`🔄 Creating ${agentType} agent for session ${sessionId}...`);

        try {
            let agent = null;

            // Clean agents that follow proper patterns
            switch (agentType) {
                case 'minimal':
                    agent = new MinimalAgent(sessionId, this.serviceContainer);
                    break;

                case 'github':
                    agent = new GitHubAgent(sessionId, this.serviceContainer);
                    break;

                case 'security':
                    agent = new SecurityAgent(sessionId, this.serviceContainer);
                    break;

                default:
                    throw new Error(`Agent type '${agentType}' not yet cleaned up. Available: minimal, github, security`);
            }

            await agent.initialize();
            this.activeAgents.set(sessionId, agent);

            console.log(`✅ ${agentType} agent created and initialized`);
            return agent;

        } catch (error) {
            console.error(`❌ Failed to create ${agentType} agent:`, error.message);
            throw error; // Real error handling
        }
    }

    /**
     * Execute workflow with real verification
     * No fake success claims
     */
    async executeWorkflow(workflowType, sessionId = null) {
        if (!this.isInitialized) {
            throw new Error('Multi-Agent Core not initialized');
        }

        sessionId = sessionId || `workflow-${Date.now()}`;
        console.log(`🎯 Executing ${workflowType} workflow (session: ${sessionId})`);

        try {
            const startTime = Date.now();

            let result = null;

            switch (workflowType) {
                case 'minimal':
                    result = await this.executeMinimalWorkflow(sessionId);
                    break;

                case 'security-scan':
                    result = await this.executeSecurityWorkflow(sessionId);
                    break;

                case 'github-check':
                    result = await this.executeGitHubWorkflow(sessionId);
                    break;

                default:
                    throw new Error(`Workflow type '${workflowType}' not yet implemented. Available: minimal, security-scan, github-check`);
            }

            const duration = Date.now() - startTime;

            if (result && result.success) {
                console.log(`✅ ${workflowType} workflow completed in ${duration}ms`);
                return {
                    success: true,
                    workflowType,
                    sessionId,
                    duration,
                    result
                };
            } else {
                console.log(`❌ ${workflowType} workflow failed`);
                return {
                    success: false,
                    workflowType,
                    sessionId,
                    duration,
                    error: result ? result.error : 'Unknown error'
                };
            }

        } catch (error) {
            console.error(`❌ Workflow execution failed:`, error.message);
            return {
                success: false,
                workflowType,
                sessionId,
                error: error.message
            };
        }
    }

    /**
     * Execute security scan workflow
     */
    async executeSecurityWorkflow(sessionId) {
        console.log('🔍 Executing security scan workflow...');

        try {
            // Create security agent
            const agent = await this.createAgent('security', sessionId);

            // Execute security scan on agents directory
            const scanResult = await agent.scanDirectory('./agents');

            // Generate security report
            const reportResult = await agent.generateReport();

            // Clean up
            await agent.cleanup();
            this.activeAgents.delete(sessionId);

            if (scanResult.success && reportResult.success) {
                console.log('✅ Security workflow completed successfully');
                console.log(`Found ${scanResult.findings.length} security issues`);
                console.log(`Risk score: ${scanResult.riskScore}/100`);

                return {
                    success: true,
                    scanResults: scanResult,
                    report: reportResult.report,
                    summary: `${scanResult.findings.length} findings, risk score ${scanResult.riskScore}/100`
                };
            } else {
                console.log('❌ Security workflow failed');
                return {
                    success: false,
                    error: scanResult.error || reportResult.error
                };
            }

        } catch (error) {
            console.error('❌ Security workflow error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute GitHub check workflow
     */
    async executeGitHubWorkflow(sessionId) {
        console.log('🔍 Executing GitHub check workflow...');

        try {
            // Create GitHub agent
            const agent = await this.createAgent('github', sessionId);

            // Check repository access
            const repoResult = await agent.getRepository('levilonic', 'Lonic-Flex-Claude-system');

            // List recent issues
            const issuesResult = await agent.listIssues('levilonic', 'Lonic-Flex-Claude-system');

            // Clean up
            await agent.cleanup();
            this.activeAgents.delete(sessionId);

            if (repoResult.success && issuesResult.success) {
                console.log('✅ GitHub workflow completed successfully');
                console.log(`Repository: ${repoResult.repository.full_name}`);
                console.log(`Issues: ${issuesResult.count} open issues`);

                return {
                    success: true,
                    repository: repoResult.repository,
                    issues: issuesResult.issues,
                    summary: `${repoResult.repository.full_name}: ${issuesResult.count} open issues`
                };
            } else {
                console.log('❌ GitHub workflow failed');
                return {
                    success: false,
                    error: repoResult.error || issuesResult.error
                };
            }

        } catch (error) {
            console.error('❌ GitHub workflow error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute minimal workflow - proven to work
     */
    async executeMinimalWorkflow(sessionId) {
        console.log('🔄 Executing minimal workflow...');

        try {
            // Create minimal agent
            const agent = await this.createAgent('minimal', sessionId);

            // Execute task with real verification
            const result = await agent.executeTask();

            // Clean up
            await agent.cleanup();
            this.activeAgents.delete(sessionId);

            if (result.success) {
                console.log('✅ Minimal workflow completed successfully');
                console.log('Evidence:', result.verificationData);
            } else {
                console.log('❌ Minimal workflow failed:', result.error);
            }

            return result;

        } catch (error) {
            console.error('❌ Minimal workflow error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get system status with real verification
     */
    async getSystemStatus() {
        const status = {
            initialized: this.isInitialized,
            activeAgents: this.activeAgents.size,
            serviceContainer: !!this.serviceContainer
        };

        if (this.isInitialized && this.serviceContainer) {
            try {
                // Verify critical services are actually working
                const database = this.serviceContainer.getService('database');
                const memory = this.serviceContainer.getService('memory');

                status.databaseAvailable = !!database;
                status.memoryAvailable = !!memory;

                // Test database connectivity
                if (database) {
                    const testResult = await database.getAllSQL('SELECT 1 as test');
                    status.databaseWorking = testResult && testResult.length > 0;
                } else {
                    status.databaseWorking = false;
                }

            } catch (error) {
                status.error = error.message;
                status.databaseWorking = false;
            }
        }

        return status;
    }

    /**
     * Clean shutdown
     */
    async shutdown() {
        console.log('🧹 Shutting down Clean Multi-Agent Core...');

        try {
            // Clean up active agents
            for (const [sessionId, agent] of this.activeAgents) {
                if (agent.cleanup) {
                    await agent.cleanup();
                }
            }
            this.activeAgents.clear();

            // Shutdown system
            await systemStartup.shutdown();

            this.isInitialized = false;
            this.serviceContainer = null;

            console.log('✅ Clean shutdown complete');

        } catch (error) {
            console.error('❌ Shutdown error:', error.message);
            throw error;
        }
    }
}

module.exports = { MultiAgentCore: CleanMultiAgentCore };

// For testing - demonstrate clean architecture
if (require.main === module) {
    async function demonstrateCleanSystem() {
        console.log('🧪 Demonstrating Clean Multi-Agent System...');

        const core = new CleanMultiAgentCore();

        try {
            // Test system initialization
            await core.initialize();

            // Test system status
            const status = await core.getSystemStatus();
            console.log('📊 System status:', status);

            // Test multiple workflows
            console.log('\n🧪 Testing workflows...');

            // Test minimal workflow
            const minimalResult = await core.executeWorkflow('minimal');
            console.log('📋 Minimal workflow:', minimalResult.success ? 'SUCCESS' : 'FAILED');

            // Test security workflow
            const securityResult = await core.executeWorkflow('security-scan');
            console.log('📋 Security workflow:', securityResult.success ? 'SUCCESS' : 'FAILED');
            if (securityResult.success) {
                console.log('   ', securityResult.summary);
            }

            // Test GitHub workflow
            const githubResult = await core.executeWorkflow('github-check');
            console.log('📋 GitHub workflow:', githubResult.success ? 'SUCCESS' : 'FAILED');
            if (githubResult.success) {
                console.log('   ', githubResult.summary);
            }

            const allSuccessful = minimalResult.success && securityResult.success && githubResult.success;

            if (allSuccessful) {
                console.log('\n🎉 Clean Multi-Agent System: ALL WORKFLOWS WORKING!');
            } else {
                console.log('\n❌ Some workflows failed');
            }

            // Clean shutdown
            await core.shutdown();

        } catch (error) {
            console.error('❌ Demonstration failed:', error.message);
            console.error('Stack:', error.stack);
            process.exit(1);
        }
    }

    demonstrateCleanSystem();
}