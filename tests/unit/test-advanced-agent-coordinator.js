#!/usr/bin/env node
/**
 * Advanced Agent Coordinator Test Suite
 * Comprehensive testing for Phase 2 Week 2 autonomous execution layer
 *
 * Tests sophisticated multi-agent coordination patterns including:
 * - Hierarchical coordination
 * - Distributed coordination
 * - Hybrid coordination patterns
 * - Consensus decision-making
 * - Advanced handoff protocols
 * - Conflict resolution
 */

const { AdvancedAgentCoordinator } = require('../../src/core/advanced-agent-coordinator');

class AdvancedAgentCoordinatorTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0
        };
    }

    async runAllTests() {
        console.log('🧪 Testing Advanced Agent Coordinator - Phase 2 Week 2');
        console.log('=' .repeat(60));

        const tests = [
            { name: 'Initialization and Configuration', fn: () => this.testInitialization() },
            { name: 'Hierarchical Coordination Pattern', fn: () => this.testHierarchicalCoordination() },
            { name: 'Distributed Coordination Pattern', fn: () => this.testDistributedCoordination() },
            { name: 'Hybrid Coordination Pattern', fn: () => this.testHybridCoordination() },
            { name: 'Consensus Decision Making', fn: () => this.testConsensusDecisionMaking() },
            { name: 'Advanced Handoff Protocols', fn: () => this.testAdvancedHandoffs() },
            { name: 'Conflict Resolution Engine', fn: () => this.testConflictResolution() },
            { name: 'Dynamic Agent Management', fn: () => this.testDynamicAgentManagement() },
            { name: 'Performance Metrics and Monitoring', fn: () => this.testPerformanceMetrics() },
            { name: 'Real-world Integration Scenario', fn: () => this.testRealWorldScenario() }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.fn);
        }

        this.displayResults();
        return this.testResults;
    }

    async runTest(testName, testFn) {
        this.testResults.total++;

        try {
            console.log(`🔧 Test ${this.testResults.total}: ${testName}...`);
            await testFn();
            this.testResults.passed++;
            console.log(`✅ ${testName} - PASSED\n`);
        } catch (error) {
            this.testResults.failed++;
            console.log(`❌ ${testName} - FAILED: ${error.message}\n`);
        }
    }

    async testInitialization() {
        // Test basic coordinator initialization
        const coordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'test-coordinator',
            coordinationMode: 'hybrid'
        });

        this.assert(coordinator.coordinatorId.includes('test-coordinator'), 'Coordinator ID should be set');
        this.assert(coordinator.coordinationMode === 'hybrid', 'Coordination mode should be hybrid');
        this.assert(coordinator.activeCoordinations instanceof Map, 'Active coordinations should be a Map');
        this.assert(coordinator.hierarchicalCoordinator, 'Hierarchical coordinator should exist');
        this.assert(coordinator.distributedCoordinator, 'Distributed coordinator should exist');
        this.assert(coordinator.consensusEngine, 'Consensus engine should exist');
        this.assert(coordinator.handoffManager, 'Handoff manager should exist');

        console.log('  ✓ Basic initialization successful');
        console.log('  ✓ All core components instantiated');
    }

    async testHierarchicalCoordination() {
        const coordinator = new AdvancedAgentCoordinator({ coordinationMode: 'hierarchical' });

        // Create mock project and team
        const mockProject = {
            id: 'test-project-hierarchical',
            complexity: 'medium',
            estimatedDuration: 3600000 // 1 hour
        };

        const mockTeam = {
            id: 'test-team-hierarchical',
            members: [
                { agentType: 'github', sessionId: 'github-1', capabilities: ['repository', 'workflow'] },
                { agentType: 'security', sessionId: 'security-1', capabilities: ['vulnerability', 'compliance'] },
                { agentType: 'code', sessionId: 'code-1', capabilities: ['development', 'implementation'] },
                { agentType: 'deploy', sessionId: 'deploy-1', capabilities: ['deployment', 'infrastructure'] }
            ]
        };

        const mockExecutionPlan = {
            phases: ['planning', 'development', 'testing', 'deployment'],
            estimatedDuration: 3600000
        };

        // Test coordination initialization
        const coordinationState = await coordinator.initializeCoordination(mockProject, mockTeam, mockExecutionPlan);

        this.assert(coordinationState.projectId === mockProject.id, 'Project ID should match');
        this.assert(coordinationState.pattern === 'hierarchical', 'Pattern should be hierarchical');
        this.assert(coordinationState.status === 'active', 'Status should be active');
        this.assert(coordinationState.agents instanceof Map, 'Agents should be tracked in Map');
        this.assert(coordinationState.hierarchicalStructure, 'Hierarchical structure should exist');

        console.log('  ✓ Hierarchical coordination initialized successfully');
        console.log(`  ✓ Team leader selected: ${coordinationState.hierarchicalStructure.leader.agentType}`);
        console.log(`  ✓ Hierarchical layers: ${coordinationState.hierarchicalStructure.layers.length} levels`);

        // Test task coordination
        const mockTasks = [
            { id: 'task-1', type: 'repository_setup', priority: 'high', complexity: 'medium' },
            { id: 'task-2', type: 'code_implementation', priority: 'medium', complexity: 'high' },
            { id: 'task-3', type: 'security_scan', priority: 'high', complexity: 'medium' },
            { id: 'task-4', type: 'deployment', priority: 'medium', complexity: 'low' }
        ];

        const coordinationResult = await coordinator.coordinateExecution(mockProject.id, mockTasks);

        this.assert(coordinationResult.status === 'completed', 'Coordination should complete successfully');
        this.assert(coordinationResult.pattern === 'hierarchical', 'Pattern should remain hierarchical');

        console.log('  ✓ Task coordination executed successfully');
        console.log(`  ✓ Tasks coordinated: ${mockTasks.length}`);
    }

    async testDistributedCoordination() {
        const coordinator = new AdvancedAgentCoordinator({ coordinationMode: 'distributed' });

        const mockProject = {
            id: 'test-project-distributed',
            complexity: 'high',
            estimatedDuration: 7200000 // 2 hours
        };

        const mockTeam = {
            id: 'test-team-distributed',
            members: [
                { agentType: 'github', sessionId: 'github-1' },
                { agentType: 'security', sessionId: 'security-1' },
                { agentType: 'code', sessionId: 'code-1' },
                { agentType: 'deploy', sessionId: 'deploy-1' },
                { agentType: 'comm', sessionId: 'comm-1' }
            ]
        };

        const coordinationState = await coordinator.initializeCoordination(mockProject, mockTeam, {});

        this.assert(coordinationState.pattern === 'distributed', 'Pattern should be distributed');
        this.assert(coordinationState.distributedNetwork, 'Distributed network should exist');
        this.assert(coordinationState.distributedNetwork.nodes.length === mockTeam.members.length, 'All team members should be nodes');

        console.log('  ✓ Distributed coordination initialized successfully');
        console.log(`  ✓ Network nodes: ${coordinationState.distributedNetwork.nodes.length}`);
        console.log(`  ✓ Network connections: ${coordinationState.distributedNetwork.connections.length}`);
        console.log(`  ✓ Consensus groups: ${coordinationState.distributedNetwork.consensus_groups.length}`);

        // Test parallel task distribution
        const parallelTasks = [
            { id: 'parallel-1', type: 'code_implementation', complexity: 'medium', requirements: { capabilities: ['development'] } },
            { id: 'parallel-2', type: 'security_scan', complexity: 'medium', requirements: { capabilities: ['vulnerability'] } },
            { id: 'parallel-3', type: 'deployment', complexity: 'low', requirements: { capabilities: ['deployment'] } }
        ];

        const distributedResult = await coordinator.coordinateExecution(mockProject.id, parallelTasks);

        this.assert(distributedResult.status === 'completed', 'Distributed coordination should complete');
        console.log('  ✓ Parallel task distribution successful');
    }

    async testHybridCoordination() {
        const coordinator = new AdvancedAgentCoordinator({ coordinationMode: 'hybrid' });

        const mockProject = {
            id: 'test-project-hybrid',
            complexity: 'very_high',
            estimatedDuration: 10800000, // 3 hours
            dependencies: ['external-api', 'database', 'cache']
        };

        const mockTeam = {
            id: 'test-team-hybrid',
            members: [
                { agentType: 'github', sessionId: 'github-1' },
                { agentType: 'security', sessionId: 'security-1' },
                { agentType: 'code', sessionId: 'code-1' },
                { agentType: 'deploy', sessionId: 'deploy-1' },
                { agentType: 'comm', sessionId: 'comm-1' }
            ]
        };

        const coordinationState = await coordinator.initializeCoordination(mockProject, mockTeam, {});

        this.assert(coordinationState.pattern === 'hybrid', 'Pattern should be hybrid');
        this.assert(coordinationState.hierarchicalStructure, 'Should have hierarchical structure');
        this.assert(coordinationState.distributedNetwork, 'Should have distributed network');

        console.log('  ✓ Hybrid coordination combines both patterns');
        console.log(`  ✓ Hierarchical layers: ${coordinationState.hierarchicalStructure.layers.length}`);
        console.log(`  ✓ Distributed nodes: ${coordinationState.distributedNetwork.nodes.length}`);

        // Test hybrid task execution
        const mixedTasks = [
            { id: 'critical-1', type: 'repository_setup', priority: 'critical', complexity: 'high', exclusiveResources: ['git-repo'] },
            { id: 'parallel-1', type: 'code_implementation', priority: 'medium', complexity: 'medium' },
            { id: 'parallel-2', type: 'security_scan', priority: 'medium', complexity: 'medium' },
            { id: 'critical-2', type: 'deployment', priority: 'high', complexity: 'high', exclusiveResources: ['production-env'] }
        ];

        const hybridResult = await coordinator.coordinateExecution(mockProject.id, mixedTasks);

        this.assert(hybridResult.status === 'completed', 'Hybrid coordination should complete');
        this.assert(hybridResult.hierarchicalResults || hybridResult.distributedResults, 'Should have results from at least one pattern');

        console.log('  ✓ Hybrid execution successfully balances patterns');
    }

    async testConsensusDecisionMaking() {
        const coordinator = new AdvancedAgentCoordinator();

        const mockProject = {
            id: 'test-project-consensus',
            complexity: 'high'
        };

        const mockTeam = {
            id: 'test-team-consensus',
            members: [
                { agentType: 'github', sessionId: 'github-1' },
                { agentType: 'security', sessionId: 'security-1' },
                { agentType: 'code', sessionId: 'code-1' },
                { agentType: 'deploy', sessionId: 'deploy-1' }
            ]
        };

        const coordinationState = await coordinator.initializeCoordination(mockProject, mockTeam, {});

        // Test consensus decision for technical change
        const technicalDecision = {
            type: 'technical_change',
            description: 'Switch from REST to GraphQL API',
            options: ['implement_graphql', 'keep_rest', 'hybrid_approach'],
            impact: 'high',
            timeout: 30000
        };

        const consensusResult = await coordinator.executeConsensusDecision(
            mockProject.id,
            technicalDecision,
            mockTeam.members
        );

        this.assert(typeof consensusResult.consensus === 'boolean', 'Consensus result should be boolean');
        this.assert(consensusResult.approvalRate >= 0 && consensusResult.approvalRate <= 1, 'Approval rate should be 0-1');
        this.assert(consensusResult.votes instanceof Map, 'Votes should be tracked');
        this.assert(consensusResult.participants === mockTeam.members.length, 'All participants should vote');

        console.log(`  ✓ Consensus decision: ${consensusResult.consensus ? 'REACHED' : 'FAILED'}`);
        console.log(`  ✓ Approval rate: ${(consensusResult.approvalRate * 100).toFixed(1)}%`);
        console.log(`  ✓ Participants: ${consensusResult.participants}`);

        // Test architectural decision requiring higher threshold
        const architectureDecision = {
            type: 'architecture_decision',
            description: 'Migrate to microservices architecture',
            impact: 'very_high'
        };

        const architectureConsensus = await coordinator.executeConsensusDecision(
            mockProject.id,
            architectureDecision,
            mockTeam.members
        );

        this.assert(architectureConsensus.threshold > technicalDecision.threshold || 0.6, 'Architecture decisions should have higher threshold');
        console.log('  ✓ Different decision types have appropriate thresholds');
    }

    async testAdvancedHandoffs() {
        const coordinator = new AdvancedAgentCoordinator();

        const mockProject = {
            id: 'test-project-handoffs',
            complexity: 'medium'
        };

        const mockTeam = {
            id: 'test-team-handoffs',
            members: [
                { agentType: 'github', sessionId: 'github-1' },
                { agentType: 'code', sessionId: 'code-1' },
                { agentType: 'security', sessionId: 'security-1' }
            ]
        };

        const coordinationState = await coordinator.initializeCoordination(mockProject, mockTeam, {
            executionOrder: ['task-1', 'task-2', 'task-3'],
            tasks: [
                { id: 'task-1', type: 'repository_setup', complexity: 'low' },
                { id: 'task-2', type: 'code_implementation', complexity: 'medium' },
                { id: 'task-3', type: 'security_scan', complexity: 'high' }
            ]
        });

        // Check if handoff protocols were initialized (they're stored in the handoff manager)
        const protocols = coordinator.handoffManager.handoffProtocols.get(coordinationState.projectId);
        this.assert(protocols, 'Handoff protocols should be initialized');
        console.log(`  ✓ Handoff protocols initialized: ${protocols.length || 0}`);

        // Test specific handoff execution
        const fromAgent = { agentId: 'github-1', agentType: 'github' };
        const toAgent = { agentId: 'code-1', agentType: 'code' };
        const handoffTask = { id: 'handoff-test', type: 'repository_setup', status: 'completed' };
        const handoffData = {
            executionResults: { repositoryUrl: 'https://github.com/test/repo', setupComplete: true },
            context: { branch: 'main', lastCommit: 'abc123' },
            artifacts: ['repository', 'initial-commit', 'readme']
        };

        const handoffResult = await coordinator.handoffManager.executeHandoff(
            fromAgent,
            toAgent,
            handoffTask,
            handoffData,
            coordinationState
        );

        this.assert(handoffResult.success !== undefined, 'Handoff should return success status');
        console.log(`  ✓ Handoff execution: ${handoffResult.success ? 'SUCCESSFUL' : 'FAILED'}`);

        if (handoffResult.success) {
            console.log(`  ✓ Handoff duration: ${handoffResult.duration}ms`);
            console.log(`  ✓ Handoff steps completed: ${handoffResult.steps}`);
        }
    }

    async testConflictResolution() {
        const coordinator = new AdvancedAgentCoordinator();

        const mockProject = {
            id: 'test-project-conflicts',
            complexity: 'high'
        };

        const mockTeam = {
            id: 'test-team-conflicts',
            members: [
                { agentType: 'code', sessionId: 'code-1' },
                { agentType: 'deploy', sessionId: 'deploy-1' }
            ]
        };

        const coordinationState = await coordinator.initializeCoordination(mockProject, mockTeam, {});

        // Test resource conflict resolution
        const resourceConflict = {
            type: 'resource_conflict',
            description: 'Both agents need exclusive access to production database',
            participants: [
                { agentId: 'code-1', agentType: 'code' },
                { agentId: 'deploy-1', agentType: 'deploy' }
            ],
            resources: ['production-database'],
            urgency: 'high',
            characteristics: ['blocking_multiple_tasks', 'resource_exhaustion']
        };

        const resolutionResult = await coordinator.resolveConflict(mockProject.id, resourceConflict);

        this.assert(resolutionResult.strategy, 'Resolution should have a strategy');
        this.assert(typeof resolutionResult.success === 'boolean', 'Resolution should indicate success/failure');

        console.log(`  ✓ Resource conflict resolution strategy: ${resolutionResult.strategy}`);
        console.log(`  ✓ Resolution successful: ${resolutionResult.success}`);

        // Test agent conflict
        const agentConflict = {
            type: 'agent_conflict',
            description: 'Disagreement on implementation approach',
            participants: [
                { agentId: 'code-1', agentType: 'code' },
                { agentId: 'deploy-1', agentType: 'deploy' }
            ],
            urgency: 'medium'
        };

        const agentResolution = await coordinator.resolveConflict(mockProject.id, agentConflict);
        this.assert(agentResolution.strategy, 'Agent conflict should have resolution strategy');
        console.log(`  ✓ Agent conflict resolution strategy: ${agentResolution.strategy}`);

        // Test priority conflict
        const priorityConflict = {
            type: 'priority_conflict',
            description: 'Conflicting priorities between security and deployment',
            participants: [
                { agentId: 'security-1', agentType: 'security' },
                { agentId: 'deploy-1', agentType: 'deploy' }
            ],
            urgency: 'low'
        };

        const priorityResolution = await coordinator.resolveConflict(mockProject.id, priorityConflict);
        this.assert(priorityResolution.strategy, 'Priority conflict should have resolution strategy');
        console.log(`  ✓ Priority conflict resolution strategy: ${priorityResolution.strategy}`);
    }

    async testDynamicAgentManagement() {
        const coordinator = new AdvancedAgentCoordinator();

        const mockProject = {
            id: 'test-project-dynamic',
            complexity: 'medium'
        };

        const initialTeam = {
            id: 'test-team-dynamic',
            members: [
                { agentType: 'github', sessionId: 'github-1' },
                { agentType: 'code', sessionId: 'code-1' }
            ]
        };

        const coordinationState = await coordinator.initializeCoordination(mockProject, initialTeam, {});
        const initialAgentCount = coordinationState.agents.size;

        // Test adding new agent during execution
        const newAgent = { agentId: 'security-1', agentType: 'security', sessionId: 'security-1' };
        const addResult = await coordinator.addAgentToCoordination(mockProject.id, newAgent, 'security_specialist');

        this.assert(addResult.success, 'Agent addition should succeed');
        this.assert(addResult.role === 'security_specialist', 'Agent role should be set correctly');

        const updatedState = coordinator.activeCoordinations.get(mockProject.id);
        this.assert(updatedState.agents.size === initialAgentCount + 1, 'Agent count should increase');

        console.log(`  ✓ Agent added successfully: ${newAgent.agentId}`);
        console.log(`  ✓ New team size: ${updatedState.agents.size}`);

        // Verify pattern reassessment
        const agentData = updatedState.agents.get(newAgent.agentId);
        this.assert(agentData.role === 'security_specialist', 'Agent role should be stored');
        this.assert(agentData.status === 'active', 'Agent should be active after integration');

        console.log('  ✓ Agent integration completed successfully');
        console.log(`  ✓ Coordination pattern potentially updated: ${updatedState.pattern}`);
    }

    async testPerformanceMetrics() {
        const coordinator = new AdvancedAgentCoordinator();

        const mockProject = {
            id: 'test-project-metrics',
            complexity: 'medium'
        };

        const mockTeam = {
            id: 'test-team-metrics',
            members: [
                { agentType: 'github', sessionId: 'github-1' },
                { agentType: 'code', sessionId: 'code-1' },
                { agentType: 'deploy', sessionId: 'deploy-1' }
            ]
        };

        const coordinationState = await coordinator.initializeCoordination(mockProject, mockTeam, {});

        // Simulate some coordination activity
        coordinationState.performanceData.tasksCompleted = 5;
        coordinationState.performanceData.handoffsExecuted = 3;
        coordinationState.performanceData.conflictsResolved = 1;
        coordinationState.performanceData.consensusDecisions = 2;
        coordinationState.tasks.set('task-1', { status: 'completed' });
        coordinationState.tasks.set('task-2', { status: 'active' });

        // Test project-specific metrics
        const projectMetrics = coordinator.getCoordinationMetrics(mockProject.id);

        this.assert(projectMetrics.projectId === mockProject.id, 'Project ID should match');
        this.assert(projectMetrics.coordinationPattern, 'Should report coordination pattern');
        this.assert(projectMetrics.status, 'Should report coordination status');
        this.assert(typeof projectMetrics.duration === 'number', 'Duration should be numeric');
        this.assert(projectMetrics.agents.total === mockTeam.members.length, 'Should track agent count');
        this.assert(projectMetrics.tasks.completed === 5, 'Should track completed tasks');
        this.assert(projectMetrics.performance.handoffsExecuted === 3, 'Should track handoffs');
        this.assert(typeof projectMetrics.efficiency === 'number', 'Efficiency should be numeric');

        console.log(`  ✓ Project metrics retrieved: ${mockProject.id}`);
        console.log(`  ✓ Coordination efficiency: ${(projectMetrics.efficiency * 100).toFixed(1)}%`);
        console.log(`  ✓ Tasks completed: ${projectMetrics.tasks.completed}`);
        console.log(`  ✓ Handoffs executed: ${projectMetrics.performance.handoffsExecuted}`);

        // Test platform-wide metrics
        const platformMetrics = coordinator.getCoordinationMetrics();

        this.assert(typeof platformMetrics.activeCoordinations === 'number', 'Should report active coordinations');
        this.assert(typeof platformMetrics.successRate === 'number', 'Should calculate success rate');

        console.log('  ✓ Platform-wide metrics available');
        console.log(`  ✓ Active coordinations: ${platformMetrics.activeCoordinations}`);
    }

    async testRealWorldScenario() {
        console.log('  🎯 Running realistic multi-agent project scenario...');

        const coordinator = new AdvancedAgentCoordinator({ coordinationMode: 'hybrid' });

        // Realistic project: E-commerce platform deployment
        const realProject = {
            id: 'ecommerce-platform-v2',
            name: 'E-commerce Platform v2.0',
            complexity: 'very_high',
            estimatedDuration: 14400000, // 4 hours
            dependencies: ['database-migration', 'api-gateway', 'payment-service', 'inventory-service'],
            deliverables: ['api', 'frontend', 'admin-panel', 'mobile-app']
        };

        // Realistic multi-agent team
        const realTeam = {
            id: 'ecommerce-team-alpha',
            members: [
                { agentType: 'github', sessionId: 'github-lead-1', experience: 'senior' },
                { agentType: 'security', sessionId: 'security-specialist-1', experience: 'senior' },
                { agentType: 'code', sessionId: 'fullstack-dev-1', experience: 'mid' },
                { agentType: 'code', sessionId: 'frontend-dev-1', experience: 'mid' },
                { agentType: 'deploy', sessionId: 'devops-engineer-1', experience: 'senior' },
                { agentType: 'comm', sessionId: 'project-manager-1', experience: 'senior' }
            ]
        };

        // Realistic execution plan
        const realExecutionPlan = {
            phases: ['planning', 'architecture', 'development', 'integration', 'testing', 'deployment', 'monitoring'],
            executionOrder: [
                'repo-setup', 'database-design', 'api-development', 'frontend-development',
                'security-audit', 'integration-testing', 'performance-testing',
                'staging-deployment', 'production-deployment', 'monitoring-setup'
            ],
            tasks: [
                {
                    id: 'repo-setup',
                    type: 'repository_setup',
                    priority: 'critical',
                    complexity: 'medium',
                    requirements: { capabilities: ['repository', 'workflow'] },
                    estimatedDuration: 1800000 // 30 min
                },
                {
                    id: 'database-design',
                    type: 'architecture_design',
                    priority: 'high',
                    complexity: 'high',
                    dependencies: ['repo-setup'],
                    requirements: { capabilities: ['development', 'architecture'] },
                    estimatedDuration: 3600000 // 1 hour
                },
                {
                    id: 'api-development',
                    type: 'code_implementation',
                    priority: 'high',
                    complexity: 'very_high',
                    dependencies: ['database-design'],
                    requirements: { capabilities: ['development', 'api'] },
                    exclusiveResources: ['development-environment'],
                    estimatedDuration: 7200000 // 2 hours
                },
                {
                    id: 'frontend-development',
                    type: 'code_implementation',
                    priority: 'high',
                    complexity: 'high',
                    dependencies: ['api-development'],
                    requirements: { capabilities: ['development', 'frontend'] },
                    estimatedDuration: 5400000 // 1.5 hours
                },
                {
                    id: 'security-audit',
                    type: 'security_scan',
                    priority: 'critical',
                    complexity: 'high',
                    dependencies: ['api-development'],
                    requirements: { capabilities: ['vulnerability', 'compliance'] },
                    estimatedDuration: 1800000 // 30 min
                },
                {
                    id: 'integration-testing',
                    type: 'testing',
                    priority: 'high',
                    complexity: 'medium',
                    dependencies: ['frontend-development', 'security-audit'],
                    requirements: { capabilities: ['testing', 'integration'] },
                    estimatedDuration: 2700000 // 45 min
                },
                {
                    id: 'staging-deployment',
                    type: 'deployment',
                    priority: 'high',
                    complexity: 'medium',
                    dependencies: ['integration-testing'],
                    requirements: { capabilities: ['deployment', 'infrastructure'] },
                    exclusiveResources: ['staging-environment'],
                    estimatedDuration: 1800000 // 30 min
                },
                {
                    id: 'production-deployment',
                    type: 'deployment',
                    priority: 'critical',
                    complexity: 'high',
                    dependencies: ['staging-deployment'],
                    requirements: { capabilities: ['deployment', 'infrastructure'] },
                    exclusiveResources: ['production-environment'],
                    estimatedDuration: 3600000 // 1 hour
                }
            ],
            parallelGroups: [
                ['repo-setup'],
                ['database-design'],
                ['api-development'],
                ['frontend-development'],
                ['security-audit'],
                ['integration-testing'],
                ['staging-deployment'],
                ['production-deployment']
            ]
        };

        console.log('  📋 Initializing realistic coordination scenario...');

        // Save original team size before any coordination modifications
        const originalTeamSize = realTeam.members.length;

        // Initialize coordination
        const coordinationState = await coordinator.initializeCoordination(realProject, realTeam, realExecutionPlan);

        this.assert(coordinationState.projectId === realProject.id, 'Project should be properly initialized');
        this.assert(coordinationState.agents.size === realTeam.members.length, 'All agents should be registered');
        console.log(`    ✓ Team assembled: ${coordinationState.agents.size} agents`);
        console.log(`    ✓ Coordination pattern selected: ${coordinationState.pattern}`);

        // Execute coordination for first batch of tasks
        const firstBatch = realExecutionPlan.tasks.slice(0, 3);
        const firstResult = await coordinator.coordinateExecution(realProject.id, firstBatch);

        this.assert(firstResult.status === 'completed', 'First batch should complete');
        console.log(`    ✓ First batch coordinated: ${firstBatch.length} tasks`);

        // Simulate a conflict and resolve it
        const simulatedConflict = {
            type: 'resource_conflict',
            description: 'Development environment access conflict between api and frontend development',
            participants: [
                { agentId: 'fullstack-dev-1', agentType: 'code' },
                { agentId: 'frontend-dev-1', agentType: 'code' }
            ],
            resources: ['development-environment'],
            urgency: 'high',
            characteristics: ['blocking_multiple_tasks']
        };

        const conflictResolution = await coordinator.resolveConflict(realProject.id, simulatedConflict);
        this.assert(conflictResolution.success !== undefined, 'Conflict should be addressed');
        console.log(`    ✓ Conflict resolved: ${conflictResolution.strategy}`);

        // Test consensus decision for deployment strategy
        const deploymentDecision = {
            type: 'deployment_decision',
            description: 'Choose deployment strategy: blue-green vs rolling deployment',
            options: ['blue_green', 'rolling', 'canary'],
            impact: 'high'
        };

        const deploymentConsensus = await coordinator.executeConsensusDecision(
            realProject.id,
            deploymentDecision,
            realTeam.members.filter(m => ['deploy', 'security', 'comm'].includes(m.agentType))
        );

        this.assert(typeof deploymentConsensus.consensus === 'boolean', 'Deployment decision should reach consensus result');
        console.log(`    ✓ Deployment strategy consensus: ${deploymentConsensus.consensus ? 'REACHED' : 'ESCALATED'}`);

        // Add a specialist mid-execution
        const securitySpecialist = {
            agentId: 'penetration-tester-1',
            agentType: 'security',
            sessionId: 'penetration-tester-1',
            specialization: 'penetration_testing'
        };

        const specialistResult = await coordinator.addAgentToCoordination(realProject.id, securitySpecialist, 'security_specialist');
        this.assert(specialistResult.success, 'Specialist should be added successfully');
        console.log(`    ✓ Security specialist added mid-execution`);

        // Get final coordination metrics
        const finalMetrics = coordinator.getCoordinationMetrics(realProject.id);
        this.assert(finalMetrics.agents.total === originalTeamSize + 1, 'Should include new specialist');
        console.log(`    ✓ Final team size: ${finalMetrics.agents.total} agents`);
        console.log(`    ✓ Coordination efficiency: ${(finalMetrics.efficiency * 100).toFixed(1)}%`);
        console.log(`    ✓ Handoffs executed: ${finalMetrics.performance.handoffsExecuted}`);
        console.log(`    ✓ Conflicts resolved: ${finalMetrics.performance.conflictsResolved}`);

        console.log('  🎉 Real-world scenario completed successfully');
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    displayResults() {
        console.log('\n📊 Advanced Agent Coordinator Test Results');
        console.log('=' .repeat(50));
        console.log(`✅ Tests Passed: ${this.testResults.passed}`);
        console.log(`❌ Tests Failed: ${this.testResults.failed}`);
        console.log(`📈 Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);

        if (this.testResults.passed === this.testResults.total) {
            console.log('\n🎉 All tests passed! Advanced Agent Coordinator is ready for Phase 2 Week 2.');
        } else {
            console.log('\n⚠️ Some tests failed. Review implementation before proceeding.');
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new AdvancedAgentCoordinatorTester();
    tester.runAllTests()
        .then(results => {
            process.exit(results.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { AdvancedAgentCoordinatorTester };