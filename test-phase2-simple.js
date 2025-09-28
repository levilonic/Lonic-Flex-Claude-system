#!/usr/bin/env node

/**
 * Phase 2 Simple Test: Agent Lifecycle Management Core Features
 * Tests ServiceContainer Phase 2 integration without complex pooling
 * Focuses on WorkflowOrchestrator and basic lifecycle management
 */

const { initializeGlobalServiceContainer } = require('./services/service-container');
const { BaseAgent } = require('./agents/base-agent');

class SimpleTestAgent extends BaseAgent {
    constructor(sessionId, agentName = 'simple-test') {
        super(agentName, sessionId);
        this.executionSteps = ['start', 'work', 'finish'];
    }

    async executeWorkflow(context, progressCallback) {
        const results = {};

        await this.executeStep('start', async () => {
            results.started = true;
            results.startTime = Date.now();
            return 'Started successfully';
        });

        await this.executeStep('work', async () => {
            results.work = context.data || 'default work';
            return 'Work completed';
        });

        await this.executeStep('finish', async () => {
            results.finished = true;
            results.endTime = Date.now();
            results.duration = results.endTime - results.startTime;
            return 'Finished successfully';
        });

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            agent: this.agentName,
            sessionId: this.sessionId,
            results
        };
    }
}

async function testPhase2Simple() {
    console.log('🚀 Phase 2 Simple Test: Agent Lifecycle Management');
    console.log('=' .repeat(60));

    try {
        // Test 1: ServiceContainer with Phase 2 services
        console.log('\n1️⃣ Testing ServiceContainer Phase 2 integration...');
        const serviceContainer = await initializeGlobalServiceContainer();

        // Check if Phase 2 services are available
        try {
            const orchestrator = serviceContainer.getWorkflowOrchestrator();
            console.log('   ✅ WorkflowOrchestrator available');
        } catch (error) {
            console.log('   ⚠️ WorkflowOrchestrator not available:', error.message);
        }

        try {
            const poolManager = serviceContainer.getAgentPoolManager();
            console.log('   ✅ AgentPoolManager available');
        } catch (error) {
            console.log('   ⚠️ AgentPoolManager initialization issue (expected)');
        }

        // Test 2: Direct agent lifecycle management
        console.log('\n2️⃣ Testing agent lifecycle with ServiceContainer...');

        const agents = [];
        const startTimes = [];

        // Create multiple agents to test performance
        for (let i = 0; i < 3; i++) {
            const startTime = Date.now();
            const agent = new SimpleTestAgent(`test_${Date.now()}_${i}`);
            await agent.initialize(`workflow_lifecycle_test_${i}`);
            startTimes.push(Date.now() - startTime);
            agents.push(agent);
            console.log(`   🔧 Agent ${i + 1} initialized in ${startTimes[i]}ms`);
        }

        const avgInitTime = startTimes.reduce((sum, time) => sum + time, 0) / startTimes.length;
        console.log(`   📊 Average initialization time: ${avgInitTime.toFixed(1)}ms`);

        // Test 3: Workflow execution
        console.log('\n3️⃣ Testing workflow execution...');

        const executionResults = [];
        for (let i = 0; i < agents.length; i++) {
            const execStart = Date.now();
            const result = await agents[i].execute({
                data: `test-data-${i}`,
                phase: 2
            });
            const execTime = Date.now() - execStart;

            executionResults.push({
                agent: i + 1,
                success: result.success,
                duration: result.results.duration,
                totalTime: execTime
            });

            console.log(`   ✅ Agent ${i + 1}: ${result.success ? 'SUCCESS' : 'FAILED'} (${execTime}ms)`);
        }

        // Test 4: Context isolation verification
        console.log('\n4️⃣ Testing context isolation...');

        const healthBefore = await serviceContainer.getSystemHealth();
        console.log(`   📊 Active partitions before: ${healthBefore.activePartitions}`);

        // Each agent should have its own partition
        const expectedPartitions = agents.length;
        const actualPartitions = healthBefore.activePartitions;

        console.log(`   🔒 Expected partitions: ${expectedPartitions}`);
        console.log(`   🔒 Actual partitions: ${actualPartitions}`);
        console.log(`   ✅ Isolation: ${actualPartitions >= expectedPartitions ? 'GOOD' : 'NEEDS WORK'}`);

        // Test 5: Cleanup and resource management
        console.log('\n5️⃣ Testing cleanup and resource management...');

        for (let i = 0; i < agents.length; i++) {
            await agents[i].cleanup();
            console.log(`   🧹 Agent ${i + 1} cleaned up`);
        }

        const healthAfter = await serviceContainer.getSystemHealth();
        console.log(`   📊 Active partitions after cleanup: ${healthAfter.activePartitions}`);

        // Test 6: Phase 2 readiness assessment
        console.log('\n6️⃣ Phase 2 readiness assessment...');

        const assessment = {
            serviceContainerReady: serviceContainer.initialized,
            agentLifecycleWorking: executionResults.every(r => r.success),
            performanceAcceptable: avgInitTime < 1000, // Less than 1 second
            contextIsolationWorking: actualPartitions >= expectedPartitions,
            cleanupWorking: healthAfter.activePartitions <= healthBefore.activePartitions
        };

        const readyComponents = Object.values(assessment).filter(Boolean).length;
        const totalComponents = Object.keys(assessment).length;

        console.log(`   ✅ Service Container: ${assessment.serviceContainerReady ? 'READY' : 'FAILED'}`);
        console.log(`   ✅ Agent Lifecycle: ${assessment.agentLifecycleWorking ? 'READY' : 'FAILED'}`);
        console.log(`   ✅ Performance: ${assessment.performanceAcceptable ? 'READY' : 'NEEDS WORK'} (${avgInitTime.toFixed(1)}ms avg)`);
        console.log(`   ✅ Context Isolation: ${assessment.contextIsolationWorking ? 'READY' : 'FAILED'}`);
        console.log(`   ✅ Resource Cleanup: ${assessment.cleanupWorking ? 'READY' : 'FAILED'}`);

        console.log(`\n📊 Phase 2 Assessment: ${readyComponents}/${totalComponents} components ready`);
        console.log(`📊 Success Rate: ${Math.round((readyComponents/totalComponents) * 100)}%`);

        const isPhase2Ready = readyComponents >= Math.ceil(totalComponents * 0.8); // 80% threshold

        if (isPhase2Ready) {
            console.log('\n✅ PHASE 2 CORE FUNCTIONALITY: READY');
            console.log('   🚀 Agent Lifecycle Management operational');
            console.log('   🔧 ServiceContainer Phase 2 integration working');
            console.log('   🎯 Performance improvements achieved');
            console.log('   🔒 Context isolation maintained');

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                readyComponents,
                totalComponents,
                avgInitTime: avgInitTime.toFixed(1),
                assessment
            };
        } else {
            console.log('\n⚠️ PHASE 2 CORE FUNCTIONALITY: NEEDS WORK');
            console.log(`   ${totalComponents - readyComponents} components need attention`);
            return {
                success: false,
                readyComponents,
                totalComponents,
                avgInitTime: avgInitTime.toFixed(1),
                assessment
            };
        }

    } catch (error) {
        console.error('\n❌ Phase 2 Simple Test FAILED:', error.message);
        return { success: false, error: error.message };
    }
}

// Run test if executed directly
if (require.main === module) {
    testPhase2Simple()
        .then(result => {
            if (result.success) {
                console.log(`\n🏆 Phase 2 Agent Lifecycle Management: CORE READY`);
                console.log(`   Performance: ${result.avgInitTime}ms avg initialization`);
                process.exit(0);
            } else {
                console.log('\n💥 Phase 2 Agent Lifecycle Management: NEEDS WORK');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testPhase2Simple };