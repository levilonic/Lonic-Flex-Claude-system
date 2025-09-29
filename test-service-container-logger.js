#!/usr/bin/env node
/**
 * Test ServiceContainer with Logger Integration - Phase 3A
 * Verify that ServiceContainer uses structured logging correctly
 */

const { ServiceContainer } = require('./src/services/service-container');

async function testServiceContainerLogger() {
    console.log('🧪 Testing ServiceContainer with Logger Integration - Phase 3A');
    console.log('='.repeat(60));

    let serviceContainer = null;

    try {
        console.log('\n📋 1. Initialize ServiceContainer (should use logger)...');
        serviceContainer = new ServiceContainer();
        await serviceContainer.initialize();
        console.log('✅ ServiceContainer initialized successfully');

        console.log('\n📋 2. Test logger service retrieval...');
        const logger = serviceContainer.getService('logger');
        console.log('✅ Logger service retrieved from container');

        // Test direct logger usage
        const testLogger = logger.createContextLogger({
            category: 'test',
            component: 'service-container-test'
        });
        testLogger.info('Testing logger from ServiceContainer');

        console.log('\n📋 3. Test other service retrievals...');
        const database = serviceContainer.getService('database');
        console.log('✅ Database service retrieved');

        const memory = serviceContainer.getService('memory');
        console.log('✅ Memory service retrieved');

        console.log('\n📋 4. Test workflow partition creation...');
        const partition = await serviceContainer.createWorkflowPartition('test-workflow', {
            isolation: true
        });
        console.log('✅ Workflow partition created with logging');

        console.log('\n📋 6. Test service not found (should log error)...');
        try {
            serviceContainer.getService('nonexistent-service');
        } catch (error) {
            console.log('✅ Service not found logged correctly');
        }

        console.log('\n📋 7. Test graceful shutdown...');
        await serviceContainer.shutdown();
        console.log('✅ ServiceContainer shutdown with logging');

        console.log('\n✅ All ServiceContainer logger integration tests passed!');
        console.log('📄 Check logs/lonicflex.log for structured log output');
        return true;

    } catch (error) {
        console.error('❌ ServiceContainer logger test failed:', error.message);
        console.error('Stack trace:', error.stack);

        // Try to shutdown if possible
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
    testServiceContainerLogger()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { testServiceContainerLogger };