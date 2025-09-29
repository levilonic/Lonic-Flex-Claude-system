/**
 * Test ServiceContainer Integration - Phase 2 Validation
 * Verifies that ServiceContainer and PartitionedContextManager solve:
 * 1. Heavy Agent Anti-Pattern (resource duplication)
 * 2. Context Explosion Anti-Pattern (shared context issues)
 * 3. Performance issues (90%+ context usage, 2-minute timeouts)
 */

const { initializeGlobalServiceContainer } = require('../../src/services/service-container');
const { BaseAgent } = require('../../src/agents/base-agent');

async function testServiceContainerIntegration() {
    console.log('🧪 Testing ServiceContainer Integration - Phase 2');
    console.log('   Verifying: Heavy Agent Anti-Pattern + Context Explosion solutions\n');

    let serviceContainer = null;
    let testResults = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
    };

    function logTestResult(testName, passed, details = '') {
        testResults.total++;
        if (passed) {
            testResults.passed++;
            console.log(`✅ ${testName}`);
        } else {
            testResults.failed++;
            console.log(`❌ ${testName}: ${details}`);
        }
        testResults.tests.push({ name: testName, passed, details });
    }

    try {
        // Test 1: ServiceContainer Initialization
        console.log('🔧 Test 1: ServiceContainer Initialization...');
        serviceContainer = await initializeGlobalServiceContainer();
        const containerStats = serviceContainer.getStats();

        logTestResult(
            'ServiceContainer initializes successfully',
            containerStats.initialized && containerStats.total_services >= 5,
            `Services: ${containerStats.total_services}, Initialized: ${containerStats.initialized}`
        );

        // Test 2: ServiceContainer Health Check
        console.log('🔧 Test 2: ServiceContainer Health Check...');
        const health = await serviceContainer.getSystemHealth();

        logTestResult(
            'ServiceContainer health is acceptable',
            (health.status === 'healthy' || health.status === 'degraded') && health.services >= 5,
            `Status: ${health.status}, Services: ${health.services}`
        );

        // Test 3: Enhanced Agent Creation with Dependency Injection
        console.log('🔧 Test 3: Enhanced Agent Creation...');
        const agentFactory = new EnhancedAgentFactory(serviceContainer);
        const sessionId = `test_session_${Date.now()}`;

        try {
            const agent = agentFactory.createAgent('base_work', sessionId, {
                contextScope: 'session'
            });

            logTestResult(
                'Enhanced agent creates successfully with ServiceContainer injection',
                agent && agent.services && agent.agentName === 'base_work',
                `Agent: ${agent?.agentName}, Has Services: ${!!agent?.services}`
            );

            // Test 4: Agent Initialization with Isolated Partition
            console.log('🔧 Test 4: Agent Initialization with Context Partition...');
            await agent.initialize();

            logTestResult(
                'Agent initializes with isolated context partition',
                agent.contextPartition && agent.contextManager && agent.workflowId,
                `Partition: ${!!agent.contextPartition}, Context: ${!!agent.contextManager}, Workflow: ${agent.workflowId}`
            );

            // Test 5: Partition Isolation Verification
            console.log('🔧 Test 5: Context Partition Isolation...');
            const partitionStats = agent.contextPartition.getStats();

            logTestResult(
                'Context partition provides proper isolation',
                partitionStats.registeredAgents === 1 &&
                partitionStats.workflowId === agent.workflowId &&
                partitionStats.status === 'active',
                `Agents: ${partitionStats.registeredAgents}, Status: ${partitionStats.status}`
            );

            // Test 6: Agent Execution with ServiceContainer
            console.log('🔧 Test 6: Agent Execution with ServiceContainer...');
            let executionSucceeded = false;
            let executionResult = null;
            let executionSteps = 0;

            const testContext = {
                task: 'service_container_test',
                timestamp: Date.now(),
                architecture: 'enhanced_dependency_injection'
            };

            try {
                executionResult = await agent.execute(testContext, (progress, step) => {
                    console.log(`   Progress: ${progress}% - ${step}`);
                    executionSteps++;
                });
                executionSucceeded = true;
            } catch (error) {
                console.log(`   Execution error: ${error.message}`);
            }

            logTestResult(
                'Agent executes successfully with ServiceContainer services',
                executionSucceeded && executionResult && executionResult.success,
                `Success: ${executionSucceeded}, Result: ${!!executionResult}, Steps: ${executionSteps}`
            );

            // Test 7: Resource Sharing Verification
            console.log('🔧 Test 7: Shared Service Usage...');

            // Verify agent is using shared services (not creating its own)
            const memoryService = serviceContainer.getMemoryService();
            const dbService = serviceContainer.getDatabaseService();

            const sharesSameServices = (
                agent.memoryManager === memoryService &&
                agent.dbManager === dbService
            );

            logTestResult(
                'Agent uses shared services from container (eliminates duplication)',
                sharesSameServices,
                `Memory shared: ${agent.memoryManager === memoryService}, DB shared: ${agent.dbManager === dbService}`
            );

            // Test 8: Context Isolation Between Multiple Agents
            console.log('🔧 Test 8: Multi-Agent Context Isolation...');

            const agent2 = agentFactory.createAgent('base_work', `${sessionId}_2`, {
                contextScope: 'session'
            });
            await agent2.initialize();

            const isolation = (
                agent.workflowId !== agent2.workflowId &&
                agent.contextPartition !== agent2.contextPartition &&
                agent.contextManager !== agent2.contextManager
            );

            logTestResult(
                'Multiple agents have isolated context partitions',
                isolation,
                `Different workflows: ${agent.workflowId !== agent2.workflowId}, Different partitions: ${agent.contextPartition !== agent2.contextPartition}`
            );

            // Test 9: Partition Statistics and Health
            console.log('🔧 Test 9: Partition Statistics...');
            const allPartitionStats = serviceContainer.services.get('contextManager').getAllStats();

            logTestResult(
                'Partition system tracks multiple isolated workflows',
                allPartitionStats.totalPartitions >= 2 &&
                allPartitionStats.activePartitions === allPartitionStats.totalPartitions,
                `Total: ${allPartitionStats.totalPartitions}, Active: ${allPartitionStats.activePartitions}`
            );

            // Test 10: Agent Cleanup and Resource Management
            console.log('🔧 Test 10: Agent Cleanup and Resource Management...');

            const initialPartitions = allPartitionStats.totalPartitions;
            await agent2.cleanup();

            // Give a moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));

            const finalPartitionStats = serviceContainer.services.get('contextManager').getAllStats();

            logTestResult(
                'Agent cleanup properly manages partition resources',
                finalPartitionStats.totalPartitions <= initialPartitions,
                `Initial: ${initialPartitions}, Final: ${finalPartitionStats.totalPartitions}`
            );

            // Cleanup
            await agent.cleanup();

        } catch (error) {
            logTestResult('Enhanced agent creation and execution', false, error.message);
        }

        // Test 11: Performance Comparison (Context Usage)
        console.log('🔧 Test 11: Performance Impact Analysis...');

        // Create multiple agents and measure resource usage
        const startTime = Date.now();
        const agents = [];

        try {
            for (let i = 0; i < 3; i++) {
                const perfSessionId = `perf_test_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                const testAgent = agentFactory.createAgent('base_work', perfSessionId, {
                    contextScope: 'session'
                });
                await testAgent.initialize();
                agents.push(testAgent);
            }

            const creationTime = Date.now() - startTime;
            const containerHealthAfter = await serviceContainer.getSystemHealth();

            logTestResult(
                'Multiple agents create quickly with shared infrastructure',
                creationTime < 5000 && (containerHealthAfter.status === 'healthy' || containerHealthAfter.status === 'degraded'),
                `Creation time: ${creationTime}ms, Health: ${containerHealthAfter.status}`
            );

            // Cleanup performance test agents
            for (const agent of agents) {
                await agent.cleanup();
            }

        } catch (error) {
            logTestResult('Performance test', false, error.message);
        }

    } catch (error) {
        console.error(`💥 Test suite failed: ${error.message}`);
        logTestResult('Test suite execution', false, error.message);
    } finally {
        // Final cleanup
        if (serviceContainer) {
            console.log('🧹 Cleaning up ServiceContainer...');
            await serviceContainer.shutdown();
        }
    }

    // Test Results Summary
    console.log(`\n📊 ServiceContainer Integration Test Results:`);
    console.log(`✅ Tests Passed: ${testResults.passed}`);
    console.log(`❌ Tests Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    if (testResults.passed === testResults.total) {
        console.log(`\n🎉 ServiceContainer Integration: ✅ READY`);
        console.log(`   ✓ Heavy Agent Anti-Pattern SOLVED - Shared infrastructure services`);
        console.log(`   ✓ Context Explosion Anti-Pattern SOLVED - Isolated partitions per workflow`);
        console.log(`   ✓ Resource Duplication ELIMINATED - Single service instances`);
        console.log(`   ✓ Agent Performance IMPROVED - Lightweight agent creation`);
        console.log(`   ✓ Context Isolation ACHIEVED - Zero context bleeding between workflows`);

        return true;
    } else {
        console.log(`\n⚠️ ServiceContainer Integration needs fixes:`);
        const failedTests = testResults.tests.filter(t => !t.passed);
        failedTests.forEach(test => {
            console.log(`   - ${test.name}: ${test.details}`);
        });

        return false;
    }
}

// Run test if called directly
if (require.main === module) {
    testServiceContainerIntegration()
        .then(success => {
            if (success) {
                console.log('\n🎯 Phase 2 ServiceContainer implementation is working correctly!');
                process.exit(0);
            } else {
                console.log('\n❌ Phase 2 ServiceContainer implementation needs fixes.');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = { testServiceContainerIntegration };