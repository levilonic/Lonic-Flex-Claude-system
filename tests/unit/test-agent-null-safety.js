/**
 * Test Individual Agent Creation with ServiceContainer
 * Validates that agents properly initialize with dependency injection
 */

const { BaseAgent } = require('../../src/agents/base-agent');
const { GitHubAgent } = require('../../src/agents/github-agent');
const { ServiceContainer } = require('../../src/services/service-container');

console.log('🧪 Testing Agent Creation with ServiceContainer\n');

async function testAgentCreationWithServiceContainer() {
    let serviceContainer = null;

    try {
        // Initialize ServiceContainer
        console.log('📋 Setup: Initializing ServiceContainer...');
        serviceContainer = new ServiceContainer();
        await serviceContainer.initialize();
        console.log('✅ ServiceContainer initialized\n');

        // Test 1: BaseAgent Creation and Initialization
        console.log('📋 Test 1: BaseAgent Creation with ServiceContainer...');
        const uniqueSessionId = `test-session-${Date.now()}`;
        const baseAgent = new BaseAgent('test-base', uniqueSessionId, serviceContainer);
        console.log(`✅ BaseAgent created: ${baseAgent.agentName}`);

        // Test initialization with unique workflow ID
        await baseAgent.initialize(`workflow_${Date.now()}_${Math.random()}_base`);
        console.log(`✅ BaseAgent initialized successfully`);

        // Verify context manager is available
        if (baseAgent.contextManager && typeof baseAgent.contextManager.addAgentEvent === 'function') {
            console.log(`✅ Context manager available with correct API`);
        } else {
            throw new Error('Context manager not properly initialized');
        }

        // Test 2: Agent Method Calls
        console.log('\n📋 Test 2: Agent Method Calls...');

        // Test logging event
        await baseAgent.logEvent('test_event', { message: 'test' });
        console.log(`✅ logEvent call completed without error`);

        // Test progress update
        await baseAgent.updateProgress(50, 'test step', 'in_progress');
        console.log(`✅ updateProgress call completed without error`);

        // Test status retrieval
        const status = baseAgent.getStatus();
        console.log(`✅ getStatus call completed: ${status.state}`);

        // Test 3: Service Container Dependency Injection
        console.log('\n📋 Test 3: Verify Dependency Injection...');

        if (baseAgent.services === serviceContainer) {
            console.log(`✅ ServiceContainer properly injected`);
        } else {
            throw new Error('ServiceContainer not properly injected');
        }

        if (baseAgent.memoryManager) {
            console.log(`✅ Memory manager service available`);
        } else {
            throw new Error('Memory manager not available');
        }

        if (baseAgent.compliance) {
            console.log(`✅ Compliance service available`);
        } else {
            throw new Error('Compliance service not available');
        }

        if (baseAgent.docs) {
            console.log(`✅ Documentation service available`);
        } else {
            throw new Error('Documentation service not available');
        }

        // Test 4: GitHubAgent Creation (different constructor pattern)
        console.log('\n📋 Test 4: GitHubAgent Creation...');
        const githubAgent = new GitHubAgent('test-session-456');
        console.log(`✅ GitHubAgent created: ${githubAgent.agentName}`);

        // Note: GitHubAgent extends ValidatedAgent, not BaseAgent
        // So it doesn't require ServiceContainer in constructor
        console.log(`ℹ️  GitHubAgent uses ValidatedAgent pattern (no ServiceContainer required)`);

        console.log('\n📊 Test Results Summary:');
        console.log('✅ BaseAgent Creation with ServiceContainer: PASS');
        console.log('✅ Agent Initialization: PASS');
        console.log('✅ Dependency Injection: PASS');
        console.log('✅ Context Manager Integration: PASS');
        console.log('✅ Method Calls: PASS');
        console.log('✅ GitHubAgent Creation: PASS');

        return true;

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;

    } finally {
        // Cleanup
        if (serviceContainer) {
            console.log('\n🧹 Cleaning up ServiceContainer...');
            await serviceContainer.shutdown();
            console.log('✅ Cleanup complete');
        }
    }
}

// Run the test
testAgentCreationWithServiceContainer()
    .then(success => {
        if (success) {
            console.log('\n🎉 Agent Creation with ServiceContainer Test: SUCCESS');
            console.log('✅ Dependency injection working correctly');
            console.log('✅ Agents properly initialized with services');
            process.exit(0);
        } else {
            console.log('\n❌ Agent Creation with ServiceContainer Test: FAILED');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    });
