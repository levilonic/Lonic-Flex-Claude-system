#!/usr/bin/env node

/**
 * ServiceContainer Test - Phase 1.1 Verification
 * Tests ServiceContainer instantiation and basic dependency injection
 */

const { ServiceContainer, getGlobalServiceContainer, initializeGlobalServiceContainer } = require('../../src/services/service-container');

async function testServiceContainer() {
    console.log('🧪 Testing ServiceContainer Architecture - Phase 1.1');

    let passCount = 0;
    let failCount = 0;

    function testPassed(message) {
        console.log(`✅ ${message}`);
        passCount++;
    }

    function testFailed(message, error) {
        console.log(`❌ ${message}: ${error.message}`);
        failCount++;
    }

    try {
        // Test 1: ServiceContainer instantiation
        console.log('\n🔧 Test 1: ServiceContainer Instantiation...');
        const container = new ServiceContainer();
        if (container.services && container.workflowPartitions) {
            testPassed('ServiceContainer instantiation');
        } else {
            testFailed('ServiceContainer instantiation', new Error('Missing required properties'));
        }

        // Test 2: Singleton pattern
        console.log('\n🔧 Test 2: Singleton Pattern...');
        const globalContainer1 = getGlobalServiceContainer();
        const globalContainer2 = getGlobalServiceContainer();
        if (globalContainer1 === globalContainer2) {
            testPassed('Singleton pattern working');
        } else {
            testFailed('Singleton pattern', new Error('Multiple instances created'));
        }

        // Test 3: Service initialization
        console.log('\n🔧 Test 3: Service Initialization...');
        try {
            await initializeGlobalServiceContainer();
            const initialized = getGlobalServiceContainer();
            if (initialized.initialized) {
                testPassed('ServiceContainer initialization');
            } else {
                testFailed('ServiceContainer initialization', new Error('Container not initialized'));
            }
        } catch (error) {
            testFailed('ServiceContainer initialization', error);
        }

        // Test 4: Service dependency injection
        console.log('\n🔧 Test 4: Service Dependency Injection...');
        try {
            const globalContainer = getGlobalServiceContainer();

            const dbService = globalContainer.getDatabaseService();
            if (dbService) {
                testPassed('Database service injection');
            } else {
                testFailed('Database service injection', new Error('Service not found'));
            }

            const memoryService = globalContainer.getMemoryService();
            if (memoryService) {
                testPassed('Memory service injection');
            } else {
                testFailed('Memory service injection', new Error('Service not found'));
            }

            const contextService = globalContainer.getService('contextManager');
            if (contextService) {
                testPassed('PartitionedContextManager injection');
            } else {
                testFailed('PartitionedContextManager injection', new Error('Service not found'));
            }

        } catch (error) {
            testFailed('Service dependency injection', error);
        }

        // Test 5: Workflow partition creation
        console.log('\n🔧 Test 5: Workflow Partition Creation...');
        try {
            const globalContainer = getGlobalServiceContainer();
            const partition = await globalContainer.createWorkflowPartition('test-workflow-123', {
                contextScope: 'session'
            });

            if (partition) {
                testPassed('Workflow partition creation');

                // Test partition isolation
                const retrievedPartition = globalContainer.getWorkflowPartition('test-workflow-123');
                if (retrievedPartition === partition) {
                    testPassed('Workflow partition retrieval');
                } else {
                    testFailed('Workflow partition retrieval', new Error('Partition mismatch'));
                }

                // Cleanup test partition
                await globalContainer.cleanupWorkflowPartition('test-workflow-123');
                testPassed('Workflow partition cleanup');
            } else {
                testFailed('Workflow partition creation', new Error('Partition not created'));
            }
        } catch (error) {
            testFailed('Workflow partition creation', error);
        }

        // Test 6: System health check
        console.log('\n🔧 Test 6: System Health Check...');
        try {
            const globalContainer = getGlobalServiceContainer();
            const health = await globalContainer.getSystemHealth();

            if (health.status && health.services >= 5) {
                testPassed(`System health check (${health.services} services)`);
            } else {
                testFailed('System health check', new Error(`Insufficient services: ${health.services}`));
            }
        } catch (error) {
            testFailed('System health check', error);
        }

        // Test 7: Service statistics
        console.log('\n🔧 Test 7: Service Statistics...');
        try {
            const globalContainer = getGlobalServiceContainer();
            const stats = globalContainer.getStats();

            if (stats.initialized && stats.total_services >= 5) {
                testPassed(`Service statistics (${stats.total_services} services)`);
            } else {
                testFailed('Service statistics', new Error('Invalid statistics'));
            }
        } catch (error) {
            testFailed('Service statistics', error);
        }

    } catch (error) {
        testFailed('ServiceContainer testing', error);
    }

    // Final results
    console.log('\n📊 ServiceContainer Test Results:');
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📈 Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);

    if (failCount === 0) {
        console.log('\n🎯 ServiceContainer Architecture Phase 1.1: ✅ READY');
        return true;
    } else {
        console.log('\n❌ ServiceContainer Architecture Phase 1.1: FAILED');
        return false;
    }
}

// Run tests if called directly
if (require.main === module) {
    testServiceContainer()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testServiceContainer };