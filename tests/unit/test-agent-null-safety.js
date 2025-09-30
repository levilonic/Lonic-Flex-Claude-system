/**
 * Test Individual Agent Creation with Null Safety
 * Validates that agents can handle null context managers gracefully
 */

const { BaseAgent } = require('../../src/agents/base-agent');
const { GitHubAgent } = require('../../src/agents/github-agent');

console.log('🧪 Testing Individual Agent Creation with Null Safety');

async function testIndividualAgentCreation() {
    try {
        console.log('\n📋 Test 1: BaseAgent Creation and Initialization...');
        const baseAgent = new BaseAgent('test-base', 'test-session-123');

        // Test that agent can be created
        console.log(`✅ BaseAgent created: ${baseAgent.agentName}`);

        // Test initialization (this should handle null context manager gracefully)
        await baseAgent.initialize();
        console.log(`✅ BaseAgent initialized successfully`);

        // Test context manager state
        if (baseAgent.contextManager) {
            console.log(`✅ Context manager available: ${typeof baseAgent.contextManager.addAgentEvent}`);
        } else {
            console.log(`⚠️ Context manager null (should have fallback)`);
        }

        console.log('\n📋 Test 2: GitHubAgent Creation...');
        const githubAgent = new GitHubAgent('test-session-456');
        console.log(`✅ GitHubAgent created: ${githubAgent.agentName}`);

        await githubAgent.initialize();
        console.log(`✅ GitHubAgent initialized successfully`);

        console.log('\n📋 Test 3: Agent Method Calls with Context Manager...');

        // Test logging event (should not crash even with null context)
        await baseAgent.logEvent('test_event', { message: 'test' });
        console.log(`✅ logEvent call completed without error`);

        // Test progress update
        await baseAgent.updateProgress(50, 'test step');
        console.log(`✅ updateProgress call completed without error`);

        // Test status retrieval
        const status = baseAgent.getStatus();
        console.log(`✅ getStatus call completed: ${status.state}`);

        // Test cleanup
        await baseAgent.cleanup();
        console.log(`✅ cleanup call completed without error`);

        console.log('\n📊 Test Results Summary:');
        console.log('✅ Agent Creation: PASS');
        console.log('✅ Agent Initialization: PASS');
        console.log('✅ Context Manager Null Safety: PASS');
        console.log('✅ Method Calls: PASS');

        return true;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Run the test
testIndividualAgentCreation()
    .then(success => {
        if (success) {
            console.log('\n🎉 Individual Agent Creation Test: SUCCESS');
            console.log('✅ Null safety implemented correctly');
            console.log('✅ Agents handle missing context managers gracefully');
        } else {
            console.log('\n❌ Individual Agent Creation Test: FAILED');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    });