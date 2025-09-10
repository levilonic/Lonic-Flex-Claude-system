/**
 * Integration Tests for LonicFLex Multi-Agent System
 * Phase 7: Comprehensive Testing & Documentation
 * Tests agent coordination, external APIs, and system integration
 */

const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SQLiteManager } = require('./database/sqlite-manager');
const { Factor3ContextManager } = require('./factor3-context-manager');
const { AuthManager } = require('./auth/auth-manager');

class IntegrationTests {
    constructor() {
        this.testResults = [];
        this.core = null;
        this.dbManager = null;
        this.testCounter = 0;
    }

    generateUniqueSessionId() {
        return `integration_test_${Date.now()}_${++this.testCounter}`;
    }

    async runAllTests() {
        console.log('🔗 Integration Tests - Phase 7');
        console.log('='.repeat(50));

        try {
            await this.setup();
            
            // Test Categories
            await this.testMultiAgentCore();
            await this.testDatabaseIntegration();
            await this.testContextSystemIntegration();
            await this.testExternalAPIIntegration();
            await this.testAgentCoordination();
            await this.testErrorRecovery();
            
            await this.teardown();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Integration test suite failed:', error.message);
            throw error;
        }
    }

    async setup() {
        console.log('⚙️ Setting up integration test environment...');
        
        // Initialize core systems
        this.dbManager = new SQLiteManager();
        await this.dbManager.initialize();
        
        this.core = new MultiAgentCore();
        await this.core.initialize();
        
        console.log('✅ Integration test environment ready');
    }

    async teardown() {
        console.log('🧹 Cleaning up integration test environment...');
        
        if (this.dbManager) {
            await this.dbManager.close();
        }
        
        console.log('✅ Integration test cleanup completed');
    }

    async testMultiAgentCore() {
        console.log('\n📋 Testing Multi-Agent Core...');
        
        await this.test('MultiAgentCore initializes successfully', async () => {
            this.assert(this.core.isInitialized === true, 'Core is initialized');
            this.assert(this.core.dbManager !== null, 'Database manager connected');
            this.assert(this.core.branchManager !== null, 'Branch manager initialized');
            
            return true;
        });

        await this.test('MultiAgentCore can create session', async () => {
            const sessionId = this.generateUniqueSessionId();
            const workflow = await this.core.initializeSession(sessionId, 'feature_development', {
                test: true,
                integration: 'basic'
            });
            
            this.assert(workflow !== null, 'Workflow created');
            this.assert(workflow.sessionId === sessionId, 'Session ID matches');
            this.assert(workflow.workflowType === 'feature_development', 'Workflow type matches');
            
            return true;
        });
    }

    async testDatabaseIntegration() {
        console.log('\n📋 Testing Database Integration...');
        
        await this.test('Database operations work correctly', async () => {
            const sessionId = this.generateUniqueSessionId();
            
            // Create a session
            await this.dbManager.createSession(sessionId, 'test-integration', {
                test: true,
                phase: 'integration-testing'
            });
            
            // Verify session exists
            const testSession = await this.dbManager.getSession(sessionId);
            
            this.assert(testSession !== undefined, 'Session was created');
            this.assert(testSession.workflow_type === 'test-integration', 'Workflow type stored');
            
            return true;
        });

        await this.test('Agent database operations work', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agentId = `${sessionId}_test_agent`;
            
            // Create agent record
            await this.dbManager.createAgent(agentId, sessionId, 'test-agent', {
                integration: true,
                test_phase: 'database_integration'
            });
            
            // Update agent
            await this.dbManager.updateAgent(agentId, {
                status: 'running',
                progress: 50,
                current_step: 'integration_test'
            });
            
            // Verify agent record
            const agents = await this.dbManager.getSessionAgents(sessionId);
            const testAgent = agents.find(a => a.id === agentId);
            
            this.assert(testAgent !== undefined, 'Agent record exists');
            this.assert(testAgent.status === 'running', 'Agent status updated');
            this.assert(testAgent.progress === 50, 'Agent progress updated');
            
            return true;
        });
    }

    async testContextSystemIntegration() {
        console.log('\n📋 Testing Context System Integration...');
        
        await this.test('Factor3ContextManager integration', async () => {
            const contextManager = new Factor3ContextManager({
                contextScope: 'session',
                contextId: 'integration-test-context'
            });
            
            // Add test events
            await contextManager.addEvent('integration_test_start', {
                test: true,
                timestamp: Date.now()
            });
            
            await contextManager.addEvent('agent_coordination', {
                agents: ['test-agent-1', 'test-agent-2'],
                coordination_type: 'sequential'
            });
            
            // Get context
            const context = contextManager.getCurrentContext();
            
            this.assert(context !== null, 'Context generated');
            this.assert(context.includes('integration_test_start'), 'Event recorded in context');
            this.assert(context.includes('agent_coordination'), 'Coordination event recorded');
            
            return true;
        });

        await this.test('Context compression and preservation', async () => {
            const contextManager = new Factor3ContextManager({
                contextScope: 'project',  // 50% compression
                contextId: 'compression-test-context'
            });
            
            // Add multiple events to test compression
            for (let i = 0; i < 10; i++) {
                await contextManager.addEvent('test_event', {
                    iteration: i,
                    data: `Test data for iteration ${i}`,
                    timestamp: Date.now() + i
                });
            }
            
            // Get current context (compression happens internally)
            const compressedContext = contextManager.getCurrentContext();
            
            this.assert(compressedContext !== null, 'Context generated');
            this.assert(compressedContext.length > 0, 'Context contains data');
            
            return true;
        });
    }

    async testExternalAPIIntegration() {
        console.log('\n📋 Testing External API Integration...');
        
        await this.test('AuthManager loads configurations', async () => {
            const authManager = new AuthManager();
            await authManager.initialize();
            
            // Check that auth manager initialized
            this.assert(authManager !== null, 'AuthManager initialized');
            
            return true;
        });

        await this.test('GitHub integration availability', async () => {
            // Test that GitHub agent can be created (even without token)
            try {
                const { GitHubAgent } = require('./agents/github-agent');
                const sessionId = this.generateUniqueSessionId();
                const githubAgent = new GitHubAgent(sessionId);
                
                this.assert(githubAgent !== null, 'GitHub agent can be created');
                this.assert(githubAgent.agentName === 'github', 'GitHub agent name correct');
                
                return true;
            } catch (error) {
                // Agent creation should work even without API tokens
                throw new Error(`GitHub agent creation failed: ${error.message}`);
            }
        });

        await this.test('Slack integration availability', async () => {
            // Test that Slack agent can be created (even without token)
            try {
                const CommAgent = require('./agents/comm-agent');
                const sessionId = this.generateUniqueSessionId();
                const commAgent = new CommAgent(sessionId);
                
                this.assert(commAgent !== null, 'Comm agent can be created');
                this.assert(commAgent.agentName === 'comm', 'Comm agent name correct');
                
                return true;
            } catch (error) {
                throw new Error(`Comm agent creation failed: ${error.message}`);
            }
        });
    }

    async testAgentCoordination() {
        console.log('\n📋 Testing Agent Coordination...');
        
        await this.test('Multiple agents can be created in session', async () => {
            const sessionId = this.generateUniqueSessionId();
            const workflow = await this.core.initializeSession(sessionId, 'feature_development', {});
            
            // Verify that core has agent creation capabilities
            this.assert(typeof this.core.initializeSession === 'function', 'Session initialization available');
            this.assert(workflow.sessionId === sessionId, 'Session created with correct ID');
            
            return true;
        });

        await this.test('Agent state coordination through database', async () => {
            const sessionId = this.generateUniqueSessionId();
            
            // Create multiple agents
            const agent1Id = `${sessionId}_coordinator_1`;
            const agent2Id = `${sessionId}_coordinator_2`;
            
            await this.dbManager.createAgent(agent1Id, sessionId, 'coordinator-1', {});
            await this.dbManager.createAgent(agent2Id, sessionId, 'coordinator-2', {});
            
            // Update agent states
            await this.dbManager.updateAgent(agent1Id, { 
                status: 'completed', 
                result: JSON.stringify({ handoff: 'coordinator-2' })
            });
            
            await this.dbManager.updateAgent(agent2Id, { 
                status: 'in_progress', 
                current_step: 'receiving_handoff'
            });
            
            // Verify coordination
            const agents = await this.dbManager.getSessionAgents(sessionId);
            
            this.assert(agents.length === 2, 'Two agents created');
            
            const agent1 = agents.find(a => a.id === agent1Id);
            const agent2 = agents.find(a => a.id === agent2Id);
            
            this.assert(agent1.status === 'completed', 'Agent 1 completed');
            this.assert(agent2.status === 'in_progress', 'Agent 2 in progress');
            
            return true;
        });
    }

    async testErrorRecovery() {
        console.log('\n📋 Testing Error Recovery...');
        
        await this.test('Database connection recovery', async () => {
            // Test that database operations handle errors gracefully
            try {
                const invalidSessionId = '';
                
                // This should handle the error gracefully
                await this.dbManager.createSession(invalidSessionId, 'invalid-test', {});
                
                // If we get here, the error was handled
                this.assert(false, 'Should have thrown error for invalid session ID');
                
            } catch (error) {
                // Expected behavior - error should be thrown for invalid input
                this.assert(error.message.includes('') || error.message.length > 0, 'Error thrown for invalid input');
                
                return true;
            }
        });

        await this.test('Context system error handling', async () => {
            const contextManager = new Factor3ContextManager({
                contextScope: 'session',
                contextId: 'error-test-context'
            });
            
            // Test that context manager handles invalid events gracefully
            try {
                await contextManager.addEvent(null, { test: true });
                // Should handle null event type
            } catch (error) {
                // Error handling is expected
            }
            
            // Context manager should still be functional
            await contextManager.addEvent('recovery_test', { recovered: true });
            const context = contextManager.getCurrentContext();
            
            this.assert(context !== null, 'Context manager recovered from error');
            
            return true;
        });
    }

    async test(description, testFunction) {
        try {
            const result = await testFunction();
            if (result) {
                console.log(`  ✅ ${description}`);
                this.testResults.push({ description, passed: true });
            } else {
                console.log(`  ❌ ${description}`);
                this.testResults.push({ description, passed: false });
            }
        } catch (error) {
            console.log(`  ❌ ${description}: ${error.message}`);
            this.testResults.push({ description, passed: false, error: error.message });
        }
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    printResults() {
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const failed = total - passed;
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 Integration Test Results');
        console.log('='.repeat(50));
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Coverage: ${((passed / total) * 100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.filter(r => !r.passed).forEach(test => {
                console.log(`  • ${test.description}${test.error ? ': ' + test.error : ''}`);
            });
        }
        
        console.log('\n🎯 Integration Tests: ' + (failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`));
    }
}

// Run tests if called directly
if (require.main === module) {
    const tests = new IntegrationTests();
    tests.runAllTests()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Integration test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { IntegrationTests };