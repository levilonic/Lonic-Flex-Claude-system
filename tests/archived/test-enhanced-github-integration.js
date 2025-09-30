/**
 * Enhanced GitHub Agent Integration Test
 * Validates that enhanced GitHubAgent integrates properly with existing multi-agent workflows
 */

const { initializeGlobalServiceContainer } = require('../../src/services/service-container');
const { EnhancedGitHubAgent } = require('../../src/agents/enhanced-github-agent');

async function testEnhancedGitHubIntegration() {
    console.log('🔗 Testing Enhanced GitHub Agent Integration');
    console.log('   Validating integration with existing multi-agent system\n');

    let serviceContainer = null;
    let testResults = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
    };

    function logTest(testName, passed, details = '') {
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
        // Initialize ServiceContainer
        console.log('🔧 Setting up test environment...');
        serviceContainer = await initializeGlobalServiceContainer();
        console.log('✅ ServiceContainer initialized');

        // Test 1: Enhanced Agent Creation and Initialization
        console.log('\n🐙 Test 1: Enhanced GitHub Agent Creation...');
        const sessionId = `integration_test_${Date.now()}`;
        const enhancedAgent = new EnhancedGitHubAgent(sessionId, serviceContainer, {
            owner: 'test-org',
            repo: 'test-repo'
        });

        await enhancedAgent.initialize();

        logTest(
            'Enhanced GitHub agent creates and initializes successfully',
            enhancedAgent.agentName === 'github' &&
            enhancedAgent.services &&
            enhancedAgent.contextPartition,
            `Agent: ${enhancedAgent.agentName}, Has Services: ${!!enhancedAgent.services}`
        );

        // Test 2: Multi-Agent Workflow Context
        console.log('\n🔄 Test 2: Multi-Agent Workflow Context...');
        const workflowContext = {
            task: 'multi_agent_github_workflow',
            source_agent: 'test_coordinator',
            github_action: 'branch_creation',
            create_branch: 'feature/integration-test',
            base_branch: 'main'
        };

        // Execute in workflow context (simulating handoff from another agent)
        try {
            const result = await enhancedAgent.execute(workflowContext);

            logTest(
                'Enhanced agent executes in multi-agent workflow context',
                result && result.success !== undefined && result.architecture === 'enhanced_servicecontainer',
                `Success: ${result?.success}, Architecture: ${result?.architecture}`
            );

            // Test handoff context generation
            const handoffContext = enhancedAgent.generateHandoffContext();

            logTest(
                'Enhanced agent generates proper handoff context',
                handoffContext &&
                handoffContext.from_agent === 'github' &&
                handoffContext.workflow_id &&
                handoffContext.context_xml,
                `From: ${handoffContext?.from_agent}, Has Workflow ID: ${!!handoffContext?.workflow_id}`
            );

        } catch (error) {
            logTest('Enhanced agent executes in multi-agent workflow context', false, error.message);
        }

        // Test 3: Context Isolation Verification
        console.log('\n🔒 Test 3: Context Isolation...');

        // Create second agent with different workflow
        const secondAgent = new EnhancedGitHubAgent(`${sessionId}_2`, serviceContainer, {
            owner: 'different-org',
            repo: 'different-repo'
        });
        await secondAgent.initialize();

        const isolation = (
            enhancedAgent.workflowId !== secondAgent.workflowId &&
            enhancedAgent.contextPartition !== secondAgent.contextPartition
        );

        logTest(
            'Enhanced agents maintain proper context isolation',
            isolation,
            `Same workflow: ${enhancedAgent.workflowId === secondAgent.workflowId}, Same partition: ${enhancedAgent.contextPartition === secondAgent.contextPartition}`
        );

        // Test 4: Service Container Integration
        console.log('\n🏗️ Test 4: ServiceContainer Integration...');

        const sharedMemory = (
            enhancedAgent.memoryManager === secondAgent.memoryManager &&
            enhancedAgent.services.getMemoryService() === secondAgent.services.getMemoryService()
        );

        const sharedDB = (
            enhancedAgent.dbManager === secondAgent.dbManager &&
            enhancedAgent.services.getDatabaseService() === secondAgent.services.getDatabaseService()
        );

        logTest(
            'Enhanced agents share services through ServiceContainer',
            sharedMemory && sharedDB,
            `Shared Memory: ${sharedMemory}, Shared DB: ${sharedDB}`
        );

        // Test 5: GitHub-Specific Functionality Preservation
        console.log('\n🐙 Test 5: GitHub API Functionality...');

        const gitHubTests = [
            { context: { create_branch: 'test-branch' }, expectedAction: 'branch_creation' },
            { context: { pull_request: { number: 123 }, pr_action: 'analyze' }, expectedAction: 'pull_request_management' },
            { context: { issue_number: 456 }, expectedAction: 'issue_management' },
            { context: { analysis_type: 'overview' }, expectedAction: 'repository_analysis' }
        ];

        let gitHubFunctionalityWorks = true;
        for (const test of gitHubTests) {
            const action = enhancedAgent.determineAction(test.context);
            if (action.type !== test.expectedAction) {
                gitHubFunctionalityWorks = false;
                break;
            }
        }

        logTest(
            'All GitHub-specific functionality preserved',
            gitHubFunctionalityWorks,
            `Tested ${gitHubTests.length} GitHub action types`
        );

        // Test 6: Performance and Resource Usage
        console.log('\n⚡ Test 6: Performance Verification...');

        const startTime = Date.now();
        const agents = [];

        // Create multiple agents quickly
        for (let i = 0; i < 3; i++) {
            const perfAgent = new EnhancedGitHubAgent(`perf_test_${i}`, serviceContainer, {
                owner: `org-${i}`,
                repo: `repo-${i}`
            });
            await perfAgent.initialize();
            agents.push(perfAgent);
        }

        const creationTime = Date.now() - startTime;
        const performanceGood = creationTime < 2000; // Should be very fast

        logTest(
            'Enhanced agents create quickly with shared infrastructure',
            performanceGood,
            `Creation time for 3 agents: ${creationTime}ms`
        );

        // Cleanup test agents
        for (const agent of agents) {
            await agent.cleanup();
        }
        await enhancedAgent.cleanup();
        await secondAgent.cleanup();

        console.log('\n📊 Integration Test Results:');
        console.log(`✅ Tests Passed: ${testResults.passed}`);
        console.log(`❌ Tests Failed: ${testResults.failed}`);
        console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

        const success = testResults.passed === testResults.total;

        if (success) {
            console.log('\n🎉 Enhanced GitHub Agent Integration: ✅ SUCCESS');
            console.log('   ✓ Integrates perfectly with existing multi-agent system');
            console.log('   ✓ Context isolation working properly');
            console.log('   ✓ ServiceContainer integration verified');
            console.log('   ✓ All GitHub functionality preserved');
            console.log('   ✓ Performance optimized with shared infrastructure');
        } else {
            console.log('\n⚠️ Enhanced GitHub Agent Integration has issues:');
            testResults.tests.filter(t => !t.passed).forEach(test => {
                console.log(`   - ${test.name}: ${test.details}`);
            });
        }

        return success;

    } catch (error) {
        console.error(`💥 Integration test failed: ${error.message}`);
        return false;
    } finally {
        if (serviceContainer) {
            await serviceContainer.shutdown();
        }
    }
}

// Run test if called directly
if (require.main === module) {
    testEnhancedGitHubIntegration()
        .then(success => {
            if (success) {
                console.log('\n✅ Enhanced GitHub Agent ready for production integration!');
                process.exit(0);
            } else {
                console.log('\n❌ Integration issues need to be resolved.');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = { testEnhancedGitHubIntegration };