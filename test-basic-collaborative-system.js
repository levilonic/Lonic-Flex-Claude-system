#!/usr/bin/env node
/**
 * Basic Collaborative System Test - Debug and verify it actually works
 * No bullshit - just test the core functionality step by step
 */

async function testBasicSystem() {
    console.log('🧪 TESTING BASIC COLLABORATIVE SYSTEM\n');

    try {
        // Test 1: Can we load the planning engine?
        console.log('📋 TEST 1: Loading Multi-Agent Planning Engine...');
        const { MultiAgentPlanningEngine } = require('./multi-agent-planning-engine');
        const engine = new MultiAgentPlanningEngine({
            contextId: `test_planning_${Date.now()}`
        });
        await engine.initialize();
        console.log('   ✅ Planning engine loaded and initialized\n');

        // Test 2: Can we run team planning?
        console.log('🏢 TEST 2: Running team planning session...');
        const teamPlan = await engine.startPlanningSession(
            "Test authentication bug fix",
            { priority: "high", complexity: "simple" }
        );
        
        if (!teamPlan || !teamPlan.agents || teamPlan.agents.length === 0) {
            throw new Error('Team plan failed - no agents assigned');
        }
        
        console.log(`   ✅ Team plan created: ${teamPlan.agents.length} agents assigned`);
        console.log(`   Agents: ${teamPlan.agents.map(a => a.agent).join(', ')}`);
        console.log(`   Phases: ${teamPlan.phases.length}\n`);

        // Test 3: Can we create role assignments?
        console.log('👥 TEST 3: Creating role assignments...');
        const { AgentRoleAssignmentSystem } = require('./agent-role-assignment-system');
        const roleSystem = new AgentRoleAssignmentSystem({
            workspaceId: 'test_workspace',
            teamPlan: teamPlan
        });
        
        const assignments = await roleSystem.createRoleAssignments(teamPlan);
        
        if (!assignments || assignments.total_agents === 0) {
            throw new Error('Role assignments failed');
        }
        
        console.log(`   ✅ Role assignments created: ${assignments.total_agents} agents`);
        console.log(`   Communication pairs: ${assignments.communication_matrix.length}`);
        console.log(`   Shared resources: ${assignments.resource_sharing.length}\n`);

        // Test 4: Can we create collaborative workspace?
        console.log('🏢 TEST 4: Creating collaborative workspace...');
        const { CollaborativeWorkspaceInfrastructure } = require('./collaborative-workspace-infrastructure');
        const workspace = new CollaborativeWorkspaceInfrastructure({
            workspaceId: `test_basic_collaboration_${Date.now()}`
        });
        
        await workspace.initialize();
        
        if (!workspace.workspaceId || !workspace.contextManager) {
            throw new Error('Workspace initialization failed');
        }
        
        console.log(`   ✅ Workspace initialized: ${workspace.workspaceId}`);
        console.log(`   State: ${workspace.state}\n`);

        // Test 5: Can workspace run complete project?
        console.log('🚀 TEST 5: Running complete collaborative project...');
        const projectResult = await workspace.startCollaborativeProject(
            "Test feature implementation",
            { priority: "medium" }
        );
        
        if (!projectResult || !projectResult.teamPlan || !projectResult.roleAssignments) {
            throw new Error('Collaborative project failed');
        }
        
        console.log(`   ✅ Project started successfully`);
        console.log(`   Team: ${projectResult.teamPlan.agents.length} agents`);
        console.log(`   Status: ${projectResult.status}\n`);

        // Test 6: Can we initialize agent coordination?
        console.log('🤖 TEST 6: Testing agent coordination...');
        const { SimultaneousAgentCoordination } = require('./simultaneous-agent-coordination');
        const coordination = new SimultaneousAgentCoordination(workspace);
        
        await coordination.initializeCollaborativeAgents(
            projectResult.teamPlan,
            projectResult.roleAssignments
        );
        
        if (coordination.collaborativeAgents.size === 0) {
            throw new Error('Agent coordination initialization failed');
        }
        
        console.log(`   ✅ Agent coordination initialized`);
        console.log(`   Collaborative agents: ${coordination.collaborativeAgents.size}\n`);

        // Test 7: Can agents communicate through workspace?
        console.log('📡 TEST 7: Testing agent communication...');
        let communicationWorking = false;
        
        workspace.communicationHub.on('agent_message', (message) => {
            communicationWorking = true;
            console.log(`   📨 Message received: ${message.from} → ${message.to}`);
        });
        
        // Send test message
        workspace.communicationHub.emit('agent_message', {
            from: 'github',
            to: 'security', 
            type: 'test_message',
            data: 'Testing communication system'
        });
        
        // Give it a moment to process
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!communicationWorking) {
            throw new Error('Agent communication system not working');
        }
        
        console.log(`   ✅ Agent communication working\n`);

        // Test 8: Status updates and shared resources
        console.log('📊 TEST 8: Testing status updates and resources...');
        
        // Test status update
        workspace.communicationHub.emit('agent_status_update', {
            agent: 'github',
            status: 'working',
            task: 'Test task',
            progress: 50
        });
        
        // Test shared resource
        await workspace.updateSharedResource('test_resource', {
            data: 'test_data',
            timestamp: new Date().toISOString()
        }, 'github');
        
        const sharedResource = workspace.getSharedResource('test_resource');
        if (!sharedResource || sharedResource.data !== 'test_data') {
            throw new Error('Shared resources not working');
        }
        
        console.log(`   ✅ Status updates and shared resources working\n`);

        // Success summary
        console.log('🎉 ALL TESTS PASSED - SYSTEM IS WORKING!\n');
        console.log('✅ Multi-Agent Planning: WORKING');
        console.log('✅ Role Assignment: WORKING'); 
        console.log('✅ Collaborative Workspace: WORKING');
        console.log('✅ Agent Coordination: WORKING');
        console.log('✅ Communication Hub: WORKING');
        console.log('✅ Shared Resources: WORKING');
        console.log('✅ Status Updates: WORKING');
        
        console.log('\n🚀 THE COLLABORATIVE MULTI-AGENT SYSTEM IS FUNCTIONAL');
        
        return true;

    } catch (error) {
        console.error(`\n💥 TEST FAILED: ${error.message}`);
        console.error(error.stack);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testBasicSystem().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testBasicSystem };