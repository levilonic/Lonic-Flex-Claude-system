#!/usr/bin/env node
const { logger } = require('./src/services/logger');
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
    logger.info('🧪 Testing BaseAgent with Logger Integration - Phase 3');
    logger.info('='.repeat(60));

    let serviceContainer = null;

    try {
        logger.info('\n📋 1. Initialize ServiceContainer with logger...');
        serviceContainer = new ServiceContainer();
        await serviceContainer.initialize();
        logger.info('ServiceContainer initialized');

        logger.info('\n📋 2. Create BaseAgent with logger integration...');
        const agent = new TestAgent('test-agent', 'test-session-123', serviceContainer, {
            workflowId: 'test-workflow-456'
        });
        logger.info('BaseAgent created (should show structured logging)');

        logger.info('\n📋 3. Initialize agent...');
        await agent.initialize();
        logger.info('Agent initialized (should show structured logging)');

        logger.info('\n📋 4. Execute workflow...');
        const result = await agent.execute({});
        logger.info('Workflow executed successfully');
        logger.info('Result:', result);

        logger.info('\n📋 5. Test agent cleanup...');
        await agent.cleanup();
        logger.info('Agent cleanup completed (should show structured logging)');

        logger.info('\n📋 6. Shutdown ServiceContainer...');
        await serviceContainer.shutdown();
        logger.info('ServiceContainer shutdown');

        logger.info('\n✅ All BaseAgent logger integration tests passed!');
        logger.info('📄 Check logs/lonicflex.log for structured agent logs');
        return true;

    } catch (error) {
        logger.error('❌ BaseAgent logger test failed:', error.message);
        logger.error('Stack trace:', error.stack);

        if (serviceContainer) {
            try {
                await serviceContainer.shutdown();
            } catch (shutdownError) {
                logger.error('Failed to shutdown ServiceContainer:', shutdownError.message);
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
            logger.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { testBaseAgentLogger };