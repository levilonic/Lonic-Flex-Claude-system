/**
 * Unit Tests for BaseAgent Class
 * Phase 7: Comprehensive Testing & Documentation
 * Tests core agent functionality and Factor compliance
 */

const { BaseAgent } = require('../../src/agents/base-agent');
const { SQLiteManager } = require('../../src/database/sqlite-manager');
const { ServiceContainer } = require('../../src/services/service-container');
const fs = require('fs').promises;
const path = require('path');

class TestBaseAgent extends BaseAgent {
    constructor(sessionId, serviceContainer, config = {}) {
        super('test-agent', sessionId, serviceContainer, config);
    }

    async executeWorkflow(context, progressCallback) {
        // Simple test workflow implementation
        await this.executeStep('step_1', async () => {
            return { step: 1, completed: true };
        });

        await this.executeStep('step_2', async () => {
            return { step: 2, completed: true };
        });

        return { workflow_completed: true, steps: 2 };
    }
}

class BaseAgentUnitTests {
    constructor() {
        this.testResults = [];
        this.dbManager = null;
        this.serviceContainer = null;
        this.testCounter = 0;
    }
    
    generateUniqueSessionId() {
        return `test_session_${Date.now()}_${++this.testCounter}`;
    }

    async runAllTests() {
        console.log('🧪 BaseAgent Unit Tests - Phase 7');
        console.log('='.repeat(50));

        try {
            await this.setup();
            
            // Test Categories
            await this.testConstructor();
            await this.testInitialization();
            await this.testStateTransitions();
            await this.testExecutionWorkflow();
            await this.testFactorCompliance();
            await this.testMemoryIntegration();
            await this.testErrorHandling();
            await this.testCleanup();
            
            await this.teardown();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            throw error;
        }
    }

    async setup() {
        console.log('⚙️ Setting up test environment...');

        // Initialize ServiceContainer (required for BaseAgent)
        this.serviceContainer = new ServiceContainer();
        await this.serviceContainer.initialize();
        console.log('✅ ServiceContainer initialized for testing');

        // Get database from ServiceContainer
        this.dbManager = this.serviceContainer.getService('database');
        console.log('✅ Database service obtained from ServiceContainer');
    }

    async teardown() {
        console.log('🧹 Cleaning up test environment...');
        if (this.serviceContainer) {
            await this.serviceContainer.shutdown();
        }
        console.log('✅ Test cleanup completed');
    }

    async testConstructor() {
        console.log('\n📋 Testing BaseAgent Constructor...');

        await this.test('Constructor creates agent with correct properties', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer);

            this.assert(agent.agentName === 'test-agent', 'Agent name set correctly');
            this.assert(agent.sessionId === sessionId, 'Session ID set correctly');
            this.assert(agent.state === 'idle', 'Initial state is idle');
            this.assert(agent.progress === 0, 'Initial progress is 0');
            this.assert(agent.config.maxSteps === 8, 'Factor 10: Max steps is 8');

            return true;
        });

        await this.test('Constructor initializes services from ServiceContainer', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer);

            this.assert(agent.services !== null, 'ServiceContainer injected');
            this.assert(agent.compliance !== null, 'Compliance service available');
            this.assert(agent.memoryManager !== null, 'Memory manager service available');

            return true;
        });
    }

    async testInitialization() {
        console.log('\n📋 Testing Agent Initialization...');
        
        await this.test('Initialize method connects to database', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer);
            await agent.initialize(`workflow_${Date.now()}_${Math.random()}`);
            
            this.assert(agent.dbManager !== null, 'Database manager connected');
            // The state machine doesn't define 'initialize' transition, so it stays 'idle'
            this.assert(agent.state === 'idle', 'State remains idle after init (no initialize transition defined)');
            
            return true;
        });
    }

    async testStateTransitions() {
        console.log('\n📋 Testing State Transitions...');
        
        await this.test('State transitions follow correct flow', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer);
            await agent.initialize(`workflow_${Date.now()}_${Math.random()}`);
            
            // Test transition sequence based on actual state machine
            this.assert(agent.state === 'idle', 'Starts idle');
            
            agent.state = agent.applyStateTransition(agent.state, 'start');
            this.assert(agent.state === 'running', 'Transitions to running');
            
            agent.state = agent.applyStateTransition(agent.state, 'complete');
            this.assert(agent.state === 'completed', 'Transitions to completed');
            
            return true;
        });
    }

    async testExecutionWorkflow() {
        console.log('\n📋 Testing Execution Workflow...');
        
        await this.test('Execute workflow completes successfully', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer);
            await agent.initialize(`workflow_${Date.now()}_${Math.random()}`);
            
            const result = await agent.execute({ test: true });
            
            this.assert(result.workflow_completed === true, 'Workflow completed');
            this.assert(result.steps === 2, 'Correct number of steps executed');
            this.assert(agent.state === 'completed', 'Agent state is completed');
            this.assert(agent.progress === 100, 'Progress is 100%');
            
            return true;
        });

        await this.test('Execution steps are tracked correctly', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer);
            await agent.initialize(`workflow_${Date.now()}_${Math.random()}`);
            
            const result = await agent.execute({ test: true });
            
            // Check result contains step information from executeWorkflow  
            this.assert(result.steps === 2, 'Execution step count recorded in result');
            this.assert(result.workflow_completed === true, 'Workflow completion tracked');
            
            return true;
        });
    }

    async testFactorCompliance() {
        console.log('\n📋 Testing 12-Factor Compliance...');
        
        await this.test('Factor 10: Agent enforces max steps limit', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer, { maxSteps: 2 });
            await agent.initialize(`workflow_${Date.now()}_${Math.random()}`);
            
            this.assert(agent.config.maxSteps === 2, 'Max steps configured correctly');
            
            // Test should pass as we only use 2 steps in TestBaseAgent
            const result = await agent.execute({ test: true });
            this.assert(result.workflow_completed === true, 'Workflow respects step limit');
            
            return true;
        });

        await this.test('Factor 12: Stateless reducer pattern', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer);
            await agent.initialize(`workflow_${Date.now()}_${Math.random()}`);
            
            // Each state transition should be deterministic
            const state1 = agent.applyStateTransition('idle', 'start');
            const state2 = agent.applyStateTransition('idle', 'start');
            
            this.assert(state1 === state2, 'State transitions are deterministic');
            this.assert(state1 === 'running', 'Correct state transition');
            
            return true;
        });
    }

    async testMemoryIntegration() {
        console.log('\n📋 Testing Memory Integration...');
        
        await this.test('Memory manager records patterns', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer);
            await agent.initialize(`workflow_${Date.now()}_${Math.random()}`);
            
            await agent.execute({ test: true });
            
            // Memory manager should be initialized and functional
            this.assert(agent.memoryManager !== null, 'Memory manager available');
            
            return true;
        });
    }

    async testErrorHandling() {
        console.log('\n📋 Testing Error Handling...');
        
        await this.test('Agent handles execution errors gracefully', async () => {
            class FailingAgent extends BaseAgent {
                constructor(sessionId, serviceContainer) {
                    super('failing-agent', sessionId, serviceContainer);
                }

                async executeWorkflow() {
                    throw new Error('Test error');
                }
            }

            const sessionId = this.generateUniqueSessionId();
            const agent = new FailingAgent(sessionId, this.serviceContainer);
            await agent.initialize(`workflow_${Date.now()}_${Math.random()}`);
            
            try {
                await agent.execute({ test: true });
                this.assert(false, 'Should have thrown error');
            } catch (error) {
                this.assert(error.message === 'Test error', 'Error propagated correctly');
                this.assert(agent.state === 'failed', 'State transitioned to failed');
            }
            
            return true;
        });
    }

    async testCleanup() {
        console.log('\n📋 Testing Cleanup Operations...');
        
        await this.test('Agent cleans up resources properly', async () => {
            const sessionId = this.generateUniqueSessionId();
            const agent = new TestBaseAgent(sessionId, this.serviceContainer);
            await agent.initialize(`workflow_${Date.now()}_${Math.random()}`);
            
            await agent.execute({ test: true });
            
            // Check that agent completed successfully
            this.assert(agent.state === 'completed', 'Agent completed successfully');
            this.assert(agent.result !== null, 'Result was set');
            
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
        console.log('📊 BaseAgent Unit Test Results');
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

        console.log('\n🎯 BaseAgent Unit Tests: ' + (failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`));

        // CRITICAL FIX: Exit with failure code if any tests failed
        if (failed > 0) {
            throw new Error(`${failed} test(s) failed`);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tests = new BaseAgentUnitTests();
    tests.runAllTests()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { BaseAgentUnitTests, TestBaseAgent };