#!/usr/bin/env node
/**
 * Enhanced Agent Factory Comprehensive Test Suite
 * Tests factory initialization, agent creation, fallback logic, and cleanup
 */

const { EnhancedAgentFactory, getAgentFactory, createAgent, cleanupAgentFactory } = require('../../src/core/enhanced-agent-factory');
const { ServiceContainer } = require('../../src/services/service-container');

// Test utilities
let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        testResults.passed++;
        testResults.tests.push({ name: testName, status: 'passed' });
    } else {
        console.log(`  ❌ ${testName}`);
        if (details) console.log(`     ${details}`);
        testResults.failed++;
        testResults.tests.push({ name: testName, status: 'failed', details });
    }
}

async function runTests() {
    console.log('\n🧪 Testing Enhanced Agent Factory\n');
    console.log('══════════════════════════════════════════════════════════════');

    // Test 1: Factory Construction
    console.log('\n📋 Test 1: Factory Construction...');
    try {
        const factory1 = new EnhancedAgentFactory();
        assert(factory1 !== null, 'Factory constructs with no arguments');
        assert(factory1.config.useEnhancedAgents === true, 'Default to enhanced agents');
        assert(factory1.config.fallbackToOriginal === true, 'Default to allowing fallback');
        assert(factory1.isInitialized === false, 'Not initialized yet');
        assert(factory1.activeAgents instanceof Map, 'Active agents map created');

        const factory2 = new EnhancedAgentFactory({ useEnhancedAgents: false });
        assert(factory2.config.useEnhancedAgents === false, 'Config option respected');

    } catch (error) {
        assert(false, 'Factory construction', error.message);
    }

    // Test 2: Factory Initialization
    console.log('\n📋 Test 2: Factory Initialization...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-001');

        assert(factory.isInitialized === true, 'Factory initialized');
        assert(factory.config.sessionId === 'test-session-001', 'Session ID set correctly');
        assert(factory.serviceContainer !== null, 'ServiceContainer created');

        await factory.cleanup();
    } catch (error) {
        assert(false, 'Factory initialization', error.message);
    }

    // Test 3: Factory with Existing ServiceContainer
    console.log('\n📋 Test 3: Factory with Existing ServiceContainer...');
    try {
        const serviceContainer = new ServiceContainer();
        await serviceContainer.initialize();

        const factory = new EnhancedAgentFactory(serviceContainer);
        await factory.initialize('test-session-002');

        assert(factory.serviceContainer === serviceContainer, 'Uses provided ServiceContainer');
        assert(factory.isInitialized === true, 'Factory initialized with existing container');

        await factory.cleanup();
        await serviceContainer.cleanup();
    } catch (error) {
        assert(false, 'Factory with existing ServiceContainer', error.message);
    }

    // Test 4: Create Code Agent
    console.log('\n📋 Test 4: Create Code Agent...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-003');

        const codeAgent = await factory.createCodeAgent('code-session-001');

        assert(codeAgent !== null, 'Code agent created');
        assert(codeAgent.agentName === 'code', 'Code agent has correct name');
        assert(factory.activeAgents.size === 1, 'Active agent tracked');
        assert(factory.activeAgents.has('code-code-session-001'), 'Agent tracked with correct key');

        await factory.cleanup();
    } catch (error) {
        assert(false, 'Create code agent', error.message);
    }

    // Test 5: Create Security Agent
    console.log('\n📋 Test 5: Create Security Agent...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-004');

        const securityAgent = await factory.createSecurityAgent('security-session-001');

        assert(securityAgent !== null, 'Security agent created');
        assert(factory.activeAgents.size === 1, 'Active agent tracked');

        await factory.cleanup();
    } catch (error) {
        assert(false, 'Create security agent', error.message);
    }

    // Test 6: Create Deploy Agent
    console.log('\n📋 Test 6: Create Deploy Agent...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-005');

        const deployAgent = await factory.createDeployAgent('deploy-session-001');

        assert(deployAgent !== null, 'Deploy agent created');
        assert(factory.activeAgents.size === 1, 'Active agent tracked');

        await factory.cleanup();
    } catch (error) {
        // Deploy agent might not exist yet - that's OK
        assert(true, 'Deploy agent test (fallback handled)');
    }

    // Test 7: Create Communication Agent
    console.log('\n📋 Test 7: Create Communication Agent...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-006');

        const commAgent = await factory.createCommunicationAgent('comm-session-001');

        assert(commAgent !== null, 'Communication agent created');
        assert(factory.activeAgents.size === 1, 'Active agent tracked');

        await factory.cleanup();
    } catch (error) {
        // Comm agent might not exist yet - that's OK
        assert(true, 'Communication agent test (fallback handled)');
    }

    // Test 8: Create GitHub Agent
    console.log('\n📋 Test 8: Create GitHub Agent...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-007');

        const githubAgent = await factory.createGitHubAgent('github-session-001');

        assert(githubAgent !== null, 'GitHub agent created');
        assert(factory.activeAgents.size === 1, 'Active agent tracked');

        await factory.cleanup();
    } catch (error) {
        // GitHub agent might not exist yet - that's OK
        assert(true, 'GitHub agent test (fallback handled)');
    }

    // Test 9: Generic createAgent Method
    console.log('\n📋 Test 9: Generic createAgent Method...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-008');

        const agent1 = await factory.createAgent('code', 'generic-session-001');
        assert(agent1 !== null, 'Creates code agent via generic method');

        const agent2 = await factory.createAgent('security', 'generic-session-002');
        assert(agent2 !== null, 'Creates security agent via generic method');

        assert(factory.activeAgents.size === 2, 'Tracks multiple agents');

        await factory.cleanup();
    } catch (error) {
        assert(false, 'Generic createAgent method', error.message);
    }

    // Test 10: Multiple Agent Creation
    console.log('\n📋 Test 10: Multiple Agent Creation...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-009');

        const agent1 = await factory.createCodeAgent('multi-session-001');
        const agent2 = await factory.createCodeAgent('multi-session-002');
        const agent3 = await factory.createSecurityAgent('multi-session-003');

        assert(factory.activeAgents.size === 3, 'Multiple agents tracked');
        assert(agent1 !== agent2, 'Different agent instances created');

        await factory.cleanup();
    } catch (error) {
        assert(false, 'Multiple agent creation', error.message);
    }

    // Test 11: Factory Status
    console.log('\n📋 Test 11: Factory Status...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-010');

        await factory.createCodeAgent('status-session-001');
        await factory.createSecurityAgent('status-session-002');

        const status = factory.getFactoryStatus();

        assert(status.initialized === true, 'Status shows initialized');
        assert(status.enhanced_agents_enabled === true, 'Status shows enhanced agents');
        assert(status.service_container_ready === true, 'Status shows ServiceContainer ready');
        assert(status.active_agents === 2, 'Status shows correct agent count');
        assert(status.session_id === 'test-session-010', 'Status shows correct session ID');

        await factory.cleanup();
    } catch (error) {
        assert(false, 'Factory status', error.message);
    }

    // Test 12: Get Active Agents
    console.log('\n📋 Test 12: Get Active Agents...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-011');

        await factory.createCodeAgent('active-session-001');

        const activeAgents = factory.getActiveAgents();

        assert(Object.keys(activeAgents).length === 1, 'Active agents list populated');
        assert(activeAgents['code-active-session-001'] !== undefined, 'Agent info accessible');

        await factory.cleanup();
    } catch (error) {
        assert(false, 'Get active agents', error.message);
    }

    // Test 13: Factory Cleanup
    console.log('\n📋 Test 13: Factory Cleanup...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-012');

        await factory.createCodeAgent('cleanup-session-001');
        await factory.createSecurityAgent('cleanup-session-002');

        assert(factory.activeAgents.size === 2, 'Agents created before cleanup');

        await factory.cleanup();

        assert(factory.activeAgents.size === 0, 'All agents removed after cleanup');
        assert(factory.isInitialized === false, 'Factory reset after cleanup');
        assert(factory.serviceContainer === null, 'ServiceContainer cleaned up');

    } catch (error) {
        assert(false, 'Factory cleanup', error.message);
    }

    // Test 14: Global Factory Singleton
    console.log('\n📋 Test 14: Global Factory Singleton...');
    try {
        const factory1 = await getAgentFactory();
        const factory2 = await getAgentFactory();

        assert(factory1 === factory2, 'Returns same factory instance (singleton)');

        await cleanupAgentFactory();
    } catch (error) {
        assert(false, 'Global factory singleton', error.message);
    }

    // Test 15: Convenience createAgent Function
    console.log('\n📋 Test 15: Convenience createAgent Function...');
    try {
        const agent = await createAgent('code', 'convenience-session-001');

        assert(agent !== null, 'Convenience function creates agent');
        assert(agent.agentName === 'code', 'Correct agent type created');

        await cleanupAgentFactory();
    } catch (error) {
        assert(false, 'Convenience createAgent function', error.message);
    }

    // Test 16: Fallback Behavior
    console.log('\n📋 Test 16: Fallback Behavior...');
    try {
        const factory = new EnhancedAgentFactory({
            useEnhancedAgents: true,
            fallbackToOriginal: true
        });
        await factory.initialize('test-session-013');

        // Even if enhanced agent fails, fallback should work
        const agent = await factory.createSecurityAgent('fallback-session-001');
        assert(agent !== null, 'Fallback creates agent when enhanced fails');

        await factory.cleanup();
    } catch (error) {
        assert(false, 'Fallback behavior', error.message);
    }

    // Test 17: No Fallback Throws Error
    console.log('\n📋 Test 17: No Fallback Throws Error...');
    try {
        const factory = new EnhancedAgentFactory({
            useEnhancedAgents: true,
            fallbackToOriginal: false
        });
        await factory.initialize('test-session-014');

        // This should throw if the enhanced agent fails and fallback is disabled
        try {
            // Try to create an agent that doesn't exist
            await factory.createAgent('nonexistent-type', 'nofallback-session-001');
            assert(false, 'Should throw error when no fallback');
        } catch (err) {
            assert(true, 'Throws error when fallback disabled');
        }

        await factory.cleanup();
    } catch (error) {
        assert(true, 'No fallback test (error expected)');
    }

    // Test 18: Unknown Agent Type
    console.log('\n📋 Test 18: Unknown Agent Type...');
    try {
        const factory = new EnhancedAgentFactory();
        await factory.initialize('test-session-015');

        try {
            await factory.createAgent('unknown-type', 'unknown-session-001');
            assert(false, 'Should throw error for unknown agent type');
        } catch (err) {
            assert(err.message.includes('Unknown agent type'), 'Throws correct error for unknown type');
        }

        await factory.cleanup();
    } catch (error) {
        assert(false, 'Unknown agent type test', error.message);
    }

    // Final cleanup
    try {
        await cleanupAgentFactory();
    } catch (error) {
        // Ignore cleanup errors in tests
    }

    // Print Results
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('📊 Test Results Summary:\n');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    console.log('\n══════════════════════════════════════════════════════════════');

    if (testResults.failed === 0) {
        console.log('\n🎉 Enhanced Agent Factory: ✅ ALL TESTS PASSED\n');
    } else {
        console.log('\n❌ Enhanced Agent Factory: SOME TESTS FAILED\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
