#!/usr/bin/env node
/**
 * Test migrated IntegrationAgent - Verify ServiceContainer pattern works
 */

const assert = require('assert');
const { IntegrationAgent } = require('./src/agents/integration-agent');

console.log('🧪 Testing Migrated IntegrationAgent\n');

// Test 1: Module loads
try {
    console.log('Test 1: Module loads without errors');
    assert(IntegrationAgent !== null && IntegrationAgent !== undefined, 'IntegrationAgent should load');
    console.log('✅ PASS\n');
} catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    process.exit(1);
}

// Test 2: Constructor requires serviceContainer
try {
    console.log('Test 2: Constructor requires serviceContainer');
    try {
        new IntegrationAgent('test-session', null);
        console.log('❌ FAIL: Should have thrown error for missing serviceContainer\n');
        process.exit(1);
    } catch (error) {
        assert(error.message.includes('ServiceContainer is required'), 'Should require ServiceContainer');
        console.log('✅ PASS: Correctly rejects null serviceContainer\n');
    }
} catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    process.exit(1);
}

// Test 3: Constructor accepts serviceContainer (mock)
try {
    console.log('Test 3: Constructor works with serviceContainer mock');

    // Create a mock serviceContainer
    const mockServiceContainer = {
        getMemoryService: () => ({ recordPattern: async () => {}, recordLesson: async () => {} }),
        getComplianceService: () => ({
            handleError: () => ({}),
            validateAgentScope: () => {},
            applyStateTransition: () => 'idle',
            contactHuman: async () => {}
        }),
        getDatabaseService: () => ({
            createAgent: async () => {},
            updateAgentProgress: async () => {},
            logEvent: async () => {},
            acquireLock: async () => true,
            releaseLock: async () => true
        }),
        createWorkflowPartition: async (workflowId, options) => ({
            partitionId: workflowId,
            contextScope: options.contextScope,
            addAgentEvent: () => {},
            addEvent: async () => {},
            registerAgent: () => ({}),
            unregisterAgent: () => {},
            getCurrentContext: () => '<context></context>'
        })
    };

    const agent = new IntegrationAgent('test-session-123', mockServiceContainer, {
        integrationType: 'test-integration'
    });

    assert(agent !== null, 'Agent should be created');
    assert(agent.sessionId === 'test-session-123', 'Session ID should be set');
    assert(agent.services === mockServiceContainer, 'ServiceContainer should be assigned');
    assert(agent.contextManager === null, 'contextManager should be null before initialize()');
    assert(agent.executionSteps.length === 8, 'Should have 8 execution steps');

    console.log('✅ PASS: Agent constructed successfully\n');
} catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    console.log(error.stack);
    process.exit(1);
}

// Test 4: Initialize method sets up contextManager
async function testInitialize() {
    try {
        console.log('Test 4: Initialize method sets up contextManager');

        const mockServiceContainer = {
            getMemoryService: () => ({ recordPattern: async () => {}, recordLesson: async () => {} }),
            getComplianceService: () => ({
                handleError: () => ({}),
                validateAgentScope: () => {},
                applyStateTransition: () => 'idle',
                contactHuman: async () => {}
            }),
            getDatabaseService: () => ({
                createAgent: async () => {},
                updateAgentProgress: async () => {},
                logEvent: async () => {},
                acquireLock: async () => true,
                releaseLock: async () => true
            }),
            createWorkflowPartition: async (workflowId, options) => ({
                partitionId: workflowId,
                contextScope: options.contextScope,
                addAgentEvent: () => {},
                addEvent: async () => {},
                registerAgent: () => ({}),
                unregisterAgent: () => {},
                getCurrentContext: () => '<context></context>'
            })
        };

        const agent = new IntegrationAgent('test-session-456', mockServiceContainer);

        // BEFORE initialize: contextManager should be null
        assert(agent.contextManager === null, 'contextManager should be null before initialize()');

        // Call initialize
        await agent.initialize('test-workflow-123');

        // AFTER initialize: contextManager should be set
        assert(agent.contextManager !== null, 'contextManager should be set after initialize()');
        assert(agent.contextPartition !== null, 'contextPartition should be set after initialize()');
        assert(agent.dbManager !== null, 'dbManager should be set after initialize()');

        console.log('✅ PASS: Initialize method works correctly\n');
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}\n`);
        console.log(error.stack);
        process.exit(1);
    }
}

testInitialize().then(() => {
    console.log('═══════════════════════════════════════');
    console.log('🎉 ALL TESTS PASSED');
    console.log('✅ IntegrationAgent migration successful!');
    console.log('═══════════════════════════════════════');
    process.exit(0);
});
