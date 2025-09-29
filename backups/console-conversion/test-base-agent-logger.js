#!/usr/bin/env node
/**
 * Test BaseAgent with Logger Integration - Phase 3
 * Verify that BaseAgent uses structured logging correctly
 */

const { ServiceContainer } = require('./src/services/service-container');
const { BaseAgent } = require('./src/agents/base-agent');

class TestAgent extends BaseAgent {
    async executeWorkflow(context) {
        await this.executeStep('test_step_1', async () => {
            return { message: 'Test step 1 completed' };
        });

        await this.executeStep('test_step_2', async () => {
            return { message: 'Test step 2 completed' };
        });

        return { workflow: 'test', completed: true };
    }
}

async function testBaseAgentLogger() {
    console.log('🧪 Testing BaseAgent with Logger Integration - Phase 3');
    console.log('='.repeat(60));

    let serviceContainer = null;

    try {
        console.log('\n📋 1. Initialize ServiceContainer with logger...');
        serviceContainer = new ServiceContainer();
        await serviceContainer.initialize();
        console.log('✅ ServiceContainer initialized');

        console.log('\n📋 2. Create BaseAgent with logger integration...');
        const agent = new TestAgent('test-agent', 'test-session-123', serviceContainer, {
            workflowId: 'test-workflow-456'
        });
        console.log('✅ BaseAgent created (should show structured logging)');

        console.log('\n📋 3. Initialize agent...');
        await agent.initialize();
        console.log('✅ Agent initialized (should show structured logging)');

        console.log('\n📋 4. Execute workflow...');
        const result = await agent.execute({});
        console.log('✅ Workflow executed successfully');
        console.log('Result:', result);

        console.log('\n📋 5. Test agent cleanup...');
        await agent.cleanup();
        console.log('✅ Agent cleanup completed (should show structured logging)');

        console.log('\n📋 6. Shutdown ServiceContainer...');
        await serviceContainer.shutdown();
        console.log('✅ ServiceContainer shutdown');

        console.log('\n✅ All BaseAgent logger integration tests passed!');
        console.log('📄 Check logs/lonicflex.log for structured agent logs');
        return true;

    } catch (error) {
        console.error('❌ BaseAgent logger test failed:', error.message);
        console.error('Stack trace:', error.stack);

        if (serviceContainer) {
            try {
                await serviceContainer.shutdown();
            } catch (shutdownError) {
                console.error('Failed to shutdown ServiceContainer:', shutdownError.message);
            }
        }

        return false;
    }
}

// Run test
if (require.main === module) {
    testBaseAgentLogger()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { testBaseAgentLogger };