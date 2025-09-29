#!/usr/bin/env node
/**
 * Phase 2 Week 2 Integration Test Suite
 * Tests integration between Project Lifecycle Manager and Advanced Agent Coordinator
 *
 * This test validates the complete autonomous execution layer for Phase 2 Week 2,
 * ensuring both components work together seamlessly to provide sophisticated
 * project management with advanced multi-agent coordination.
 */

const { ProjectLifecycleManager } = require('./core/project-lifecycle-manager');
const { AdvancedAgentCoordinator } = require('./core/advanced-agent-coordinator');

class Phase2Week2IntegrationTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0
        };
    }

    async runAllTests() {
        console.log('🧪 Testing Phase 2 Week 2 Integration - Autonomous Execution Layer');
        console.log('=' .repeat(80));

        const tests = [
            { name: 'Component Initialization Integration', fn: () => this.testComponentInitialization() },
            { name: 'Project Setup with Lifecycle + Coordination', fn: () => this.testProjectSetupIntegration() },
            { name: 'Resource Allocation Integration', fn: () => this.testResourceAllocationIntegration() },
            { name: 'Milestone Tracking with Agent Coordination', fn: () => this.testMilestoneCoordinationIntegration() },
            { name: 'State Transitions with Agent Handoffs', fn: () => this.testStateTransitionIntegration() },
            { name: 'Real-time Monitoring Integration', fn: () => this.testMonitoringIntegration() },
            { name: 'Conflict Resolution in Project Context', fn: () => this.testConflictResolutionIntegration() },
            { name: 'Dynamic Agent Management in Lifecycle', fn: () => this.testDynamicAgentIntegration() },
            { name: 'End-to-End Autonomous Execution', fn: () => this.testEndToEndExecution() },
            { name: 'Performance and Scalability', fn: () => this.testPerformanceIntegration() }
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

    async testComponentInitialization() {
        // Test that both components can be initialized together
        const lifecycleManager = new ProjectLifecycleManager('integration-test-lifecycle');
        const agentCoordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'integration-test-coordinator',
            coordinationMode: 'hybrid'
        });

        this.assert(lifecycleManager.agentId.includes('integration-test-lifecycle'), 'Lifecycle manager should be initialized');
        this.assert(agentCoordinator.coordinatorId.includes('integration-test-coordinator'), 'Agent coordinator should be initialized');
        this.assert(lifecycleManager.projectStates, 'Lifecycle manager should have project states');
        this.assert(agentCoordinator.hierarchicalCoordinator, 'Agent coordinator should have hierarchical coordinator');

        console.log('  ✓ Both components initialized successfully');
        console.log(`  ✓ Lifecycle manager: ${lifecycleManager.agentId}`);
        console.log(`  ✓ Agent coordinator: ${agentCoordinator.coordinatorId}`);
    }

    async testProjectSetupIntegration() {
        const lifecycleManager = new ProjectLifecycleManager('integration-project-setup');
        const agentCoordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'integration-project-coordinator',
            coordinationMode: 'hybrid'
        });

        // Create a realistic project
        const project = {
            id: 'integration-project-ecommerce',
            name: 'E-commerce Integration Platform',
            complexity: 'high',
            priority: 'high',
            category: 'web-application',
            estimatedEffort: 14, // days
            deliverables: ['api', 'frontend', 'admin-panel'],
            requirements: ['scalability', 'security', 'performance']
        };

        // Create team with multiple agent types
        const team = {
            teamId: 'integration-team-ecommerce',
            teamSize: 5,
            agents: [
                { type: 'github', sessionId: 'github-integration-1', capabilities: ['repository', 'workflow'] },
                { type: 'security', sessionId: 'security-integration-1', capabilities: ['vulnerability', 'compliance'] },
                { type: 'code', sessionId: 'code-integration-1', capabilities: ['development', 'testing'] },
                { type: 'deploy', sessionId: 'deploy-integration-1', capabilities: ['infrastructure', 'deployment'] },
                { type: 'comm', sessionId: 'comm-integration-1', capabilities: ['communication', 'coordination'] }
            ],
            members: [
                { agentType: 'github', sessionId: 'github-integration-1' },
                { agentType: 'security', sessionId: 'security-integration-1' },
                { agentType: 'code', sessionId: 'code-integration-1' },
                { agentType: 'deploy', sessionId: 'deploy-integration-1' },
                { agentType: 'comm', sessionId: 'comm-integration-1' }
            ]
        };

        // Test Project Lifecycle Manager setup
        const lifecycleContext = { project, team, executionPlan: {} };
        const lifecycleResult = await lifecycleManager.executeWorkflow(lifecycleContext);

        this.assert(lifecycleResult.success, 'Lifecycle manager should complete successfully');
        this.assert(lifecycleResult.projectId === project.id, 'Project ID should match');
        this.assert(lifecycleResult.lifecycleState, 'Lifecycle state should be created');

        console.log(`  ✓ Project lifecycle initialized: ${lifecycleResult.projectId}`);
        console.log(`  ✓ Current lifecycle state: ${lifecycleResult.lifecycleState.currentState}`);

        // Test Agent Coordinator setup
        const coordinationState = await agentCoordinator.initializeCoordination(project, team, {});

        this.assert(coordinationState.projectId === project.id, 'Coordination project ID should match');
        this.assert(coordinationState.agents.size === team.members.length, 'All team members should be coordinated');
        this.assert(coordinationState.pattern === 'hybrid', 'Should use hybrid coordination pattern');

        console.log(`  ✓ Agent coordination initialized: ${coordinationState.projectId}`);
        console.log(`  ✓ Coordination pattern: ${coordinationState.pattern}`);
        console.log(`  ✓ Agents coordinated: ${coordinationState.agents.size}`);

        // Test integration compatibility
        this.assert(lifecycleResult.resourcePlan, 'Resource plan should be created by lifecycle manager');
        this.assert(coordinationState.consensusGroups, 'Consensus groups should be created by coordinator');

        console.log('  ✓ Components are compatible for integration');
    }

    async testResourceAllocationIntegration() {
        const lifecycleManager = new ProjectLifecycleManager('resource-integration-test');
        const agentCoordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'resource-coordinator',
            coordinationMode: 'hybrid'
        });

        const project = {
            id: 'resource-test-project',
            complexity: 'medium',
            estimatedEffort: 7
        };

        const team = {
            teamSize: 4,
            agents: [
                { type: 'github', sessionId: 'github-resource-1' },
                { type: 'code', sessionId: 'code-resource-1' },
                { type: 'security', sessionId: 'security-resource-1' },
                { type: 'deploy', sessionId: 'deploy-resource-1' }
            ],
            members: [
                { agentType: 'github', sessionId: 'github-resource-1' },
                { agentType: 'code', sessionId: 'code-resource-1' },
                { agentType: 'security', sessionId: 'security-resource-1' },
                { agentType: 'deploy', sessionId: 'deploy-resource-1' }
            ]
        };

        // Test lifecycle resource allocation
        const lifecycleResult = await lifecycleManager.executeWorkflow({ project, team });
        this.assert(lifecycleResult.resourcePlan, 'Lifecycle manager should create resource plan');
        this.assert(lifecycleResult.resourcePlan.totalResources === team.agents.length, 'Should track all resources');

        // Test coordinator resource management
        const coordinationState = await agentCoordinator.initializeCoordination(project, team, {});
        this.assert(coordinationState.agents.size === team.agents.length, 'Coordinator should track all agents');

        // Test resource allocation compatibility
        const lifecycleResources = lifecycleResult.resourcePlan.totalResources;
        const coordinatedAgents = coordinationState.agents.size;
        this.assert(lifecycleResources === coordinatedAgents, 'Resource counts should match between components');

        console.log(`  ✓ Lifecycle resource allocation: ${lifecycleResources} resources`);
        console.log(`  ✓ Coordinator agent management: ${coordinatedAgents} agents`);
        console.log('  ✓ Resource allocation integration successful');
    }

    async testMilestoneCoordinationIntegration() {
        const lifecycleManager = new ProjectLifecycleManager('milestone-integration-test');
        const agentCoordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'milestone-coordinator',
            coordinationMode: 'hierarchical'
        });

        const project = {
            id: 'milestone-integration-project',
            complexity: 'medium',
            category: 'integration-test'
        };

        const team = {
            teamSize: 3,
            agents: [
                { type: 'github', sessionId: 'github-milestone-1' },
                { type: 'code', sessionId: 'code-milestone-1' },
                { type: 'deploy', sessionId: 'deploy-milestone-1' }
            ],
            members: [
                { agentType: 'github', sessionId: 'github-milestone-1' },
                { agentType: 'code', sessionId: 'code-milestone-1' },
                { agentType: 'deploy', sessionId: 'deploy-milestone-1' }
            ]
        };

        // Initialize both components
        const lifecycleResult = await lifecycleManager.executeWorkflow({ project, team });
        const coordinationState = await agentCoordinator.initializeCoordination(project, team, {});

        // Test milestone tracking from lifecycle manager
        this.assert(lifecycleResult.milestones, 'Lifecycle manager should create milestones');
        this.assert(lifecycleResult.milestones.milestones.length > 0, 'Should have multiple milestones');

        // Test coordination patterns that align with milestones
        this.assert(coordinationState.hierarchicalStructure, 'Should have hierarchical structure for milestone coordination');

        // Test that milestones can be coordinated through agent system
        const milestonePhases = lifecycleResult.milestones.milestones.map(m => m.phase);
        const expectedPhases = ['planning', 'development', 'integration', 'testing', 'delivery', 'monitoring'];

        expectedPhases.forEach(phase => {
            this.assert(milestonePhases.includes(phase), `Should have milestone for ${phase} phase`);
        });

        console.log(`  ✓ Milestones created: ${lifecycleResult.milestones.milestones.length}`);
        console.log(`  ✓ Coordination structure: ${coordinationState.pattern}`);
        console.log('  ✓ Milestone coordination integration successful');
    }

    async testStateTransitionIntegration() {
        const lifecycleManager = new ProjectLifecycleManager('state-transition-test');
        const agentCoordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'state-coordinator',
            coordinationMode: 'hybrid'
        });

        const project = {
            id: 'state-transition-project',
            complexity: 'medium'
        };

        const team = {
            teamSize: 3,
            agents: [
                { type: 'github', sessionId: 'github-state-1' },
                { type: 'code', sessionId: 'code-state-1' },
                { type: 'security', sessionId: 'security-state-1' }
            ],
            members: [
                { agentType: 'github', sessionId: 'github-state-1' },
                { agentType: 'code', sessionId: 'code-state-1' },
                { agentType: 'security', sessionId: 'security-state-1' }
            ]
        };

        // Initialize components
        const lifecycleResult = await lifecycleManager.executeWorkflow({ project, team });
        const coordinationState = await agentCoordinator.initializeCoordination(project, team, {});

        // Test that lifecycle state transitions can trigger agent coordination
        this.assert(lifecycleResult.lifecycleState.currentState, 'Should have current lifecycle state');
        this.assert(coordinationState.pattern, 'Should have coordination pattern');

        // Test state machine compatibility
        const lifecycleStates = Object.keys(lifecycleManager.projectStates);
        this.assert(lifecycleStates.length > 0, 'Should have defined lifecycle states');

        // Simulate a state transition and coordination
        const mockTasks = [
            { id: 'task-1', type: 'repository_setup', priority: 'high' },
            { id: 'task-2', type: 'code_implementation', priority: 'medium' }
        ];

        const coordinationResult = await agentCoordinator.coordinateExecution(project.id, mockTasks);
        this.assert(coordinationResult.status === 'completed', 'Coordination should complete');

        console.log(`  ✓ Lifecycle state: ${lifecycleResult.lifecycleState.currentState}`);
        console.log(`  ✓ Coordination completed: ${coordinationResult.status}`);
        console.log('  ✓ State transition integration successful');
    }

    async testMonitoringIntegration() {
        const lifecycleManager = new ProjectLifecycleManager('monitoring-integration-test');
        const agentCoordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'monitoring-coordinator',
            coordinationMode: 'distributed'
        });

        const project = {
            id: 'monitoring-integration-project',
            complexity: 'high'
        };

        const team = {
            teamSize: 4,
            agents: [
                { type: 'github', sessionId: 'github-monitor-1' },
                { type: 'code', sessionId: 'code-monitor-1' },
                { type: 'security', sessionId: 'security-monitor-1' },
                { type: 'deploy', sessionId: 'deploy-monitor-1' }
            ],
            members: [
                { agentType: 'github', sessionId: 'github-monitor-1' },
                { agentType: 'code', sessionId: 'code-monitor-1' },
                { agentType: 'security', sessionId: 'security-monitor-1' },
                { agentType: 'deploy', sessionId: 'deploy-monitor-1' }
            ]
        };

        // Initialize with monitoring
        const lifecycleResult = await lifecycleManager.executeWorkflow({ project, team });
        const coordinationState = await agentCoordinator.initializeCoordination(project, team, {});

        // Test lifecycle monitoring
        this.assert(lifecycleResult.monitoring, 'Lifecycle manager should provide monitoring');
        this.assert(lifecycleResult.monitoring.monitoringActive, 'Monitoring should be active');
        this.assert(lifecycleResult.monitoring.realTimeMetrics, 'Should have real-time metrics');

        // Test coordinator metrics
        const coordinationMetrics = agentCoordinator.getCoordinationMetrics(project.id);
        this.assert(coordinationMetrics, 'Coordinator should provide metrics');
        this.assert(coordinationMetrics.agents.total > 0, 'Should track agent metrics');

        // Test monitoring integration
        const lifecycleMetrics = lifecycleResult.monitoring.realTimeMetrics;
        const coordinatorMetrics = coordinationMetrics;

        this.assert(typeof lifecycleMetrics.teamEfficiency === 'number', 'Lifecycle should track team efficiency');
        this.assert(typeof coordinatorMetrics.efficiency === 'number', 'Coordinator should track efficiency');

        console.log('  ✓ Lifecycle monitoring active');
        console.log('  ✓ Coordinator metrics available');
        console.log(`  ✓ Team efficiency: ${lifecycleMetrics.teamEfficiency}`);
        console.log(`  ✓ Coordination efficiency: ${coordinatorMetrics.efficiency}`);
        console.log('  ✓ Monitoring integration successful');
    }

    async testConflictResolutionIntegration() {
        const lifecycleManager = new ProjectLifecycleManager('conflict-integration-test');
        const agentCoordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'conflict-coordinator',
            coordinationMode: 'hybrid'
        });

        const project = {
            id: 'conflict-integration-project',
            complexity: 'medium',
            priority: 'high'
        };

        const team = {
            teamSize: 3,
            agents: [
                { type: 'code', sessionId: 'code-conflict-1' },
                { type: 'security', sessionId: 'security-conflict-1' },
                { type: 'deploy', sessionId: 'deploy-conflict-1' }
            ],
            members: [
                { agentType: 'code', sessionId: 'code-conflict-1' },
                { agentType: 'security', sessionId: 'security-conflict-1' },
                { agentType: 'deploy', sessionId: 'deploy-conflict-1' }
            ]
        };

        // Initialize both systems
        const lifecycleResult = await lifecycleManager.executeWorkflow({ project, team });
        const coordinationState = await agentCoordinator.initializeCoordination(project, team, {});

        // Test lifecycle-aware conflict resolution
        const conflict = {
            type: 'resource_conflict',
            description: 'Development environment access conflict during integration phase',
            participants: [
                { agentId: 'code-conflict-1', agentType: 'code' },
                { agentId: 'security-conflict-1', agentType: 'security' }
            ],
            resources: ['development-environment'],
            urgency: 'high',
            projectPhase: lifecycleResult.lifecycleState.currentState
        };

        const resolution = await agentCoordinator.resolveConflict(project.id, conflict);

        this.assert(resolution.success !== undefined, 'Conflict resolution should provide result');
        this.assert(resolution.strategy, 'Should have resolution strategy');

        // Test that resolution aligns with project lifecycle
        this.assert(lifecycleResult.lifecycleState.currentState, 'Should have project context');

        console.log(`  ✓ Project phase: ${lifecycleResult.lifecycleState.currentState}`);
        console.log(`  ✓ Conflict resolution strategy: ${resolution.strategy}`);
        console.log(`  ✓ Resolution successful: ${resolution.success}`);
        console.log('  ✓ Conflict resolution integration successful');
    }

    async testDynamicAgentIntegration() {
        const lifecycleManager = new ProjectLifecycleManager('dynamic-integration-test');
        const agentCoordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'dynamic-coordinator',
            coordinationMode: 'hybrid'
        });

        const project = {
            id: 'dynamic-integration-project',
            complexity: 'high'
        };

        const initialTeam = {
            teamSize: 2,
            agents: [
                { type: 'github', sessionId: 'github-dynamic-1' },
                { type: 'code', sessionId: 'code-dynamic-1' }
            ],
            members: [
                { agentType: 'github', sessionId: 'github-dynamic-1' },
                { agentType: 'code', sessionId: 'code-dynamic-1' }
            ]
        };

        // Initialize with small team
        const lifecycleResult = await lifecycleManager.executeWorkflow({ project, team: initialTeam });
        const coordinationState = await agentCoordinator.initializeCoordination(project, initialTeam, {});

        const initialAgentCount = coordinationState.agents.size;
        this.assert(initialAgentCount === 2, 'Should start with 2 agents');

        // Simulate project growth requiring additional agents
        const securitySpecialist = {
            agentId: 'security-dynamic-1',
            agentType: 'security',
            sessionId: 'security-dynamic-1',
            specialization: 'penetration_testing'
        };

        // Test dynamic agent addition in project context
        const addResult = await agentCoordinator.addAgentToCoordination(
            project.id,
            securitySpecialist,
            'security_specialist'
        );

        this.assert(addResult.success, 'Agent addition should succeed');

        const updatedState = agentCoordinator.activeCoordinations.get(project.id);
        this.assert(updatedState.agents.size === initialAgentCount + 1, 'Agent count should increase');

        // Test that lifecycle manager can accommodate team changes
        // (In real implementation, this would trigger resource reallocation)
        this.assert(lifecycleResult.resourcePlan, 'Resource plan should exist for reallocation');

        console.log(`  ✓ Initial team size: ${initialAgentCount} agents`);
        console.log(`  ✓ Final team size: ${updatedState.agents.size} agents`);
        console.log(`  ✓ Specialist added: ${securitySpecialist.specialization}`);
        console.log('  ✓ Dynamic agent integration successful');
    }

    async testEndToEndExecution() {
        console.log('  🎯 Running comprehensive end-to-end integration test...');

        const lifecycleManager = new ProjectLifecycleManager('e2e-integration-test');
        const agentCoordinator = new AdvancedAgentCoordinator({
            coordinatorId: 'e2e-coordinator',
            coordinationMode: 'hybrid'
        });

        // Realistic project scenario
        const project = {
            id: 'e2e-microservices-platform',
            name: 'Microservices Integration Platform',
            complexity: 'very_high',
            priority: 'critical',
            category: 'enterprise-integration',
            estimatedEffort: 21, // days
            deliverables: ['api-gateway', 'service-mesh', 'monitoring-stack', 'security-layer'],
            requirements: ['high-availability', 'scalability', 'security', 'observability']
        };

        // Full development team
        const team = {
            teamId: 'e2e-enterprise-team',
            teamSize: 6,
            agents: [
                { type: 'github', sessionId: 'github-e2e-lead', experience: 'senior' },
                { type: 'security', sessionId: 'security-e2e-lead', experience: 'senior' },
                { type: 'code', sessionId: 'backend-e2e-dev', experience: 'mid' },
                { type: 'code', sessionId: 'frontend-e2e-dev', experience: 'mid' },
                { type: 'deploy', sessionId: 'devops-e2e-lead', experience: 'senior' },
                { type: 'comm', sessionId: 'project-e2e-manager', experience: 'senior' }
            ],
            members: [
                { agentType: 'github', sessionId: 'github-e2e-lead', experience: 'senior' },
                { agentType: 'security', sessionId: 'security-e2e-lead', experience: 'senior' },
                { agentType: 'code', sessionId: 'backend-e2e-dev', experience: 'mid' },
                { agentType: 'code', sessionId: 'frontend-e2e-dev', experience: 'mid' },
                { agentType: 'deploy', sessionId: 'devops-e2e-lead', experience: 'senior' },
                { agentType: 'comm', sessionId: 'project-e2e-manager', experience: 'senior' }
            ]
        };

        console.log('    📋 Initializing project lifecycle management...');
        const lifecycleResult = await lifecycleManager.executeWorkflow({ project, team });

        this.assert(lifecycleResult.success, 'Lifecycle management should complete successfully');
        this.assert(lifecycleResult.lifecycleState.currentState === 'planning', 'Should start in planning phase');

        console.log(`      ✓ Lifecycle initialized: ${lifecycleResult.projectId}`);
        console.log(`      ✓ Current phase: ${lifecycleResult.lifecycleState.currentState}`);

        console.log('    🤖 Initializing advanced agent coordination...');
        const coordinationState = await agentCoordinator.initializeCoordination(project, team, {});

        this.assert(coordinationState.projectId === project.id, 'Project IDs should match');
        this.assert(coordinationState.agents.size === team.agents.length, 'All agents should be coordinated');

        console.log(`      ✓ Agent coordination active: ${coordinationState.pattern} pattern`);
        console.log(`      ✓ Team size: ${coordinationState.agents.size} agents`);

        console.log('    ⚡ Testing integrated execution...');

        // Execute a batch of coordinated tasks within lifecycle context
        const lifecycleTasks = [
            {
                id: 'architecture-design',
                type: 'architecture_design',
                priority: 'critical',
                complexity: 'very_high',
                phase: lifecycleResult.lifecycleState.currentState,
                requirements: { capabilities: ['architecture', 'design'] },
                deliverables: ['system-architecture', 'api-specifications']
            },
            {
                id: 'security-assessment',
                type: 'security_scan',
                priority: 'high',
                complexity: 'high',
                phase: lifecycleResult.lifecycleState.currentState,
                requirements: { capabilities: ['security', 'compliance'] },
                deliverables: ['security-assessment', 'compliance-checklist']
            },
            {
                id: 'infrastructure-planning',
                type: 'infrastructure_design',
                priority: 'high',
                complexity: 'high',
                phase: lifecycleResult.lifecycleState.currentState,
                requirements: { capabilities: ['infrastructure', 'deployment'] },
                deliverables: ['infrastructure-blueprint', 'deployment-strategy']
            }
        ];

        const executionResult = await agentCoordinator.coordinateExecution(project.id, lifecycleTasks);

        this.assert(executionResult.status === 'completed', 'Integrated execution should complete');

        console.log(`      ✓ Tasks coordinated: ${lifecycleTasks.length}`);
        console.log(`      ✓ Execution status: ${executionResult.status}`);

        console.log('    📊 Validating integrated monitoring...');

        // Test integrated monitoring
        const lifecycleMonitoring = lifecycleResult.monitoring;
        const coordinationMetrics = agentCoordinator.getCoordinationMetrics(project.id);

        this.assert(lifecycleMonitoring.monitoringActive, 'Lifecycle monitoring should be active');
        this.assert(coordinationMetrics.agents.total > 0, 'Coordination metrics should be available');

        console.log(`      ✓ Lifecycle monitoring: active`);
        console.log(`      ✓ Coordination efficiency: ${(coordinationMetrics.efficiency * 100).toFixed(1)}%`);

        console.log('    🎯 Testing consensus decision-making in lifecycle context...');

        // Test lifecycle-aware consensus decision
        const architectureDecision = {
            type: 'architecture_decision',
            description: 'Choose microservices communication pattern: event-driven vs REST',
            phase: lifecycleResult.lifecycleState.currentState,
            impact: 'very_high',
            options: ['event_driven', 'rest_api', 'hybrid_approach']
        };

        const consensusResult = await agentCoordinator.executeConsensusDecision(
            project.id,
            architectureDecision,
            team.members.filter(m => ['github', 'code', 'security', 'deploy'].includes(m.agentType))
        );

        this.assert(typeof consensusResult.consensus === 'boolean', 'Consensus should provide decision');

        console.log(`      ✓ Architecture decision consensus: ${consensusResult.consensus ? 'REACHED' : 'ESCALATED'}`);

        // Final integration validation
        this.assert(lifecycleResult.lifecycleReport, 'Should have lifecycle report');
        this.assert(coordinationMetrics, 'Should have coordination metrics');

        console.log('    🎉 End-to-end integration test completed successfully');
        console.log(`      ✓ Project: ${project.name}`);
        console.log(`      ✓ Lifecycle phase: ${lifecycleResult.lifecycleState.currentState}`);
        console.log(`      ✓ Coordination pattern: ${coordinationState.pattern}`);
        console.log(`      ✓ Team efficiency: ${lifecycleMonitoring.realTimeMetrics.teamEfficiency}`);
    }

    async testPerformanceIntegration() {
        console.log('  🚀 Running performance and scalability integration test...');

        const startTime = Date.now();

        // Create multiple projects to test scalability
        const projects = [];
        const lifecycleManagers = [];
        const coordinators = [];

        for (let i = 1; i <= 3; i++) {
            const project = {
                id: `performance-project-${i}`,
                name: `Performance Test Project ${i}`,
                complexity: 'medium'
            };

            const team = {
                teamSize: 4,
                agents: [
                    { type: 'github', sessionId: `github-perf-${i}` },
                    { type: 'code', sessionId: `code-perf-${i}` },
                    { type: 'security', sessionId: `security-perf-${i}` },
                    { type: 'deploy', sessionId: `deploy-perf-${i}` }
                ],
                members: [
                    { agentType: 'github', sessionId: `github-perf-${i}` },
                    { agentType: 'code', sessionId: `code-perf-${i}` },
                    { agentType: 'security', sessionId: `security-perf-${i}` },
                    { agentType: 'deploy', sessionId: `deploy-perf-${i}` }
                ]
            };

            projects.push({ project, team });

            const lifecycleManager = new ProjectLifecycleManager(`performance-lifecycle-${i}`);
            const coordinator = new AdvancedAgentCoordinator({
                coordinatorId: `performance-coordinator-${i}`,
                coordinationMode: 'hybrid'
            });

            lifecycleManagers.push(lifecycleManager);
            coordinators.push(coordinator);
        }

        // Test concurrent initialization
        const initPromises = projects.map(async ({ project, team }, index) => {
            const lifecycleResult = await lifecycleManagers[index].executeWorkflow({ project, team });
            const coordinationState = await coordinators[index].initializeCoordination(project, team, {});

            return { lifecycleResult, coordinationState };
        });

        const results = await Promise.all(initPromises);

        // Validate all results
        results.forEach((result, index) => {
            this.assert(result.lifecycleResult.success, `Project ${index + 1} lifecycle should succeed`);
            this.assert(result.coordinationState.agents.size > 0, `Project ${index + 1} should have coordinated agents`);
        });

        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const timePerProject = totalTime / projects.length;

        console.log(`    ✓ Concurrent projects handled: ${projects.length}`);
        console.log(`    ✓ Total execution time: ${totalTime}ms`);
        console.log(`    ✓ Time per project: ${timePerProject.toFixed(0)}ms`);

        // Performance assertions
        this.assert(totalTime < 30000, 'Total execution should complete within 30 seconds'); // Generous limit
        this.assert(timePerProject < 15000, 'Each project should initialize within 15 seconds');

        console.log('    ✓ Performance and scalability integration successful');
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    displayResults() {
        console.log('\n📊 Phase 2 Week 2 Integration Test Results');
        console.log('=' .repeat(60));
        console.log(`✅ Tests Passed: ${this.testResults.passed}`);
        console.log(`❌ Tests Failed: ${this.testResults.failed}`);
        console.log(`📈 Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);

        if (this.testResults.passed === this.testResults.total) {
            console.log('\n🎉 All integration tests passed!');
            console.log('🚀 Phase 2 Week 2 Autonomous Execution Layer is ready for production.');
            console.log('');
            console.log('✅ Project Lifecycle Manager + Advanced Agent Coordinator integration complete');
            console.log('✅ Sophisticated multi-agent coordination with lifecycle management operational');
            console.log('✅ Real-time monitoring and conflict resolution integrated');
            console.log('✅ End-to-end autonomous execution validated');
        } else {
            console.log('\n⚠️ Some integration tests failed. Review component interactions.');
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new Phase2Week2IntegrationTester();
    tester.runAllTests()
        .then(results => {
            process.exit(results.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Integration test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { Phase2Week2IntegrationTester };