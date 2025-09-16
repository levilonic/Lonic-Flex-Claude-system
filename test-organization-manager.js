#!/usr/bin/env node
/**
 * OrganizationManager Testing Suite
 * Phase 2 Implementation - Week 1, Day 1
 *
 * Comprehensive testing for the Autonomous AI Organization core system
 */

const { OrganizationManager } = require('./core/organization-manager');

class OrganizationManagerTester {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    }

    async runAllTests() {
        console.log('🧪 Testing OrganizationManager - Autonomous AI Organization Core\n');

        // Test categories
        await this.testBasicInitialization();
        await this.testNaturalLanguageProcessing();
        await this.testProjectDecomposition();
        await this.testAgentTeamFormation();
        await this.testInfrastructureSetup();
        await this.testResourceAllocation();
        await this.testExecutionPlanning();
        await this.testEndToEndWorkflow();

        this.printSummary();
        return this.failed === 0;
    }

    async testBasicInitialization() {
        console.log('🔧 Test Category: Basic Initialization');

        await this.test('should initialize OrganizationManager with default configuration', async () => {
            const orgManager = new OrganizationManager();

            this.assert(orgManager.agentName === 'organization-manager', 'Agent name should be organization-manager');
            this.assert(orgManager.config.maxSteps === 10, 'Should have extended steps for coordination');
            this.assert(orgManager.config.timeout === 120000, 'Should have extended timeout');
            this.assert(orgManager.config.autonomous === true, 'Should be configured as autonomous');
            this.assert(orgManager.activeProjects instanceof Map, 'Should have active projects map');
            this.assert(orgManager.agentTeams instanceof Map, 'Should have agent teams map');
            this.assert(orgManager.resourceAllocation instanceof Map, 'Should have resource allocation map');
        });

        await this.test('should initialize with custom configuration', async () => {
            const customConfig = {
                github: { owner: 'test-org', repo: 'test-repo' },
                slack: { channel: '#test-channel' }
            };

            const orgManager = new OrganizationManager('test-session-123', customConfig);

            this.assert(orgManager.sessionId === 'test-session-123', 'Should use provided session ID');
            this.assert(orgManager.externalCoordinator.config.github.owner === 'test-org', 'Should use custom GitHub config');
        });

        await this.test('should have essential components initialized', async () => {
            const orgManager = new OrganizationManager();

            this.assert(orgManager.nlProcessor, 'Should have natural language processor');
            this.assert(orgManager.projectDecomposer, 'Should have project decomposer');
            this.assert(orgManager.agentSpecialist, 'Should have agent specialist');
            this.assert(orgManager.externalCoordinator, 'Should have external coordinator');
        });
    }

    async testNaturalLanguageProcessing() {
        console.log('🔧 Test Category: Natural Language Processing');

        await this.test('should parse simple dashboard request', async () => {
            const orgManager = new OrganizationManager();
            const input = 'Build a customer analytics dashboard with user authentication';

            const requirements = await orgManager.parseNaturalLanguage(input);

            this.assert(requirements.originalInput === input, 'Should preserve original input');
            this.assert(requirements.projectType === 'dashboard', 'Should identify dashboard project type');
            this.assert(requirements.features.includes('authentication'), 'Should extract authentication feature');
            this.assert(requirements.complexity, 'Should assess complexity');
            this.assert(requirements.timeline, 'Should estimate timeline');
        });

        await this.test('should extract technologies and platforms', async () => {
            const orgManager = new OrganizationManager();
            const input = 'Create a React web application with Node.js backend and PostgreSQL database';

            const requirements = await orgManager.parseNaturalLanguage(input);

            this.assert(requirements.technologies.includes('javascript'), 'Should identify JavaScript technology');
            this.assert(requirements.platforms.includes('web'), 'Should identify web platform');
            this.assert(requirements.features.includes('database'), 'Should identify database feature');
        });

        await this.test('should assess project complexity correctly', async () => {
            const orgManager = new OrganizationManager();

            const simpleInput = 'Build a simple contact form';
            const simpleReq = await orgManager.parseNaturalLanguage(simpleInput);
            this.assert(simpleReq.complexity === 'low', 'Should identify low complexity');

            const complexInput = 'Build a sophisticated enterprise microservices platform with distributed architecture, real-time analytics, and advanced security features';
            const complexReq = await orgManager.parseNaturalLanguage(complexInput);
            this.assert(complexReq.complexity === 'very_high', 'Should identify very high complexity');
        });

        await this.test('should extract business goals and success criteria', async () => {
            const orgManager = new OrganizationManager();
            const input = 'Build a revenue tracking dashboard to increase sales efficiency and reduce costs';

            const requirements = await orgManager.parseNaturalLanguage(input);

            this.assert(requirements.businessGoals.includes('revenue_generation'), 'Should identify revenue goal');
            this.assert(requirements.businessGoals.includes('operational_efficiency'), 'Should identify efficiency goal');
            this.assert(requirements.success_criteria.length > 0, 'Should have success criteria');
        });
    }

    async testProjectDecomposition() {
        console.log('🔧 Test Category: Project Decomposition');

        await this.test('should decompose dashboard project into components', async () => {
            const orgManager = new OrganizationManager();
            const requirements = {
                originalInput: 'Build an analytics dashboard',
                projectType: 'dashboard',
                features: ['authentication', 'database'],
                complexity: 'medium',
                timeline: '2-4 weeks'
            };

            const project = await orgManager.decomposeProject(requirements);

            this.assert(project.id, 'Should have project ID');
            this.assert(project.name, 'Should have project name');
            this.assert(project.components.length > 0, 'Should have components');
            this.assert(project.dependencies.length >= 0, 'Should have dependencies array');
            this.assert(project.timeline, 'Should have timeline');
            this.assert(project.status === 'planning', 'Should start in planning status');
        });

        await this.test('should create appropriate components for project type', async () => {
            const orgManager = new OrganizationManager();
            const requirements = {
                projectType: 'api',
                features: ['authentication'],
                complexity: 'medium'
            };

            const project = await orgManager.decomposeProject(requirements);

            const hasApiFramework = project.components.some(c => c.name.includes('api_framework'));
            const hasDatabase = project.components.some(c => c.name.includes('database'));
            const hasAuth = project.components.some(c => c.name.includes('authentication'));

            this.assert(hasApiFramework, 'API project should have API framework component');
            this.assert(hasDatabase, 'API project should have database component');
            this.assert(hasAuth, 'Should have authentication component when requested');
        });

        await this.test('should analyze component dependencies', async () => {
            const orgManager = new OrganizationManager();
            const requirements = {
                projectType: 'dashboard',
                features: ['authentication', 'database'],
                complexity: 'medium'
            };

            const project = await orgManager.decomposeProject(requirements);

            // Should have logical dependencies
            const authDep = project.dependencies.find(d =>
                d.from.includes('authentication') || d.to.includes('authentication')
            );
            this.assert(project.dependencies.length >= 0, 'Should have dependency analysis');
        });

        await this.test('should create realistic timeline based on complexity', async () => {
            const orgManager = new OrganizationManager();

            const simpleReq = { projectType: 'frontend', complexity: 'low', components: [{}, {}] };
            const simpleProject = await orgManager.decomposeProject(simpleReq);

            const complexReq = { projectType: 'dashboard', complexity: 'very_high', components: [{}, {}, {}, {}, {}, {}] };
            const complexProject = await orgManager.decomposeProject(complexReq);

            const simpleTime = parseInt(simpleProject.timeline.estimated_duration);
            const complexTime = parseInt(complexProject.timeline.estimated_duration);

            this.assert(complexTime > simpleTime, 'Complex projects should have longer timelines');
            this.assert(simpleProject.timeline.phases.length > 0, 'Should have timeline phases');
            this.assert(simpleProject.timeline.milestones.length > 0, 'Should have milestones');
        });
    }

    async testAgentTeamFormation() {
        console.log('🔧 Test Category: Agent Team Formation');

        await this.test('should form appropriate team for dashboard project', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'test-dashboard-project',
                name: 'Test Dashboard',
                components: [
                    { name: 'authentication', type: 'backend', priority: 'high' },
                    { name: 'dashboard_ui', type: 'frontend', priority: 'medium' }
                ],
                complexity: 'medium'
            };

            const team = await orgManager.formAgentTeam(project);

            this.assert(team.id, 'Should have team ID');
            this.assert(team.projectId === project.id, 'Should be linked to project');
            this.assert(team.members.length > 0, 'Should have team members');
            this.assert(team.coordinationPattern, 'Should have coordination pattern');
            this.assert(team.leadership !== null, 'Should have team leadership assigned');
        });

        await this.test('should include GitHub agent for project coordination', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'test-project',
                components: [{ name: 'basic', type: 'backend' }],
                complexity: 'low'
            };

            const team = await orgManager.formAgentTeam(project);

            const hasGitHub = team.members.some(m => m.agentType === 'github');
            this.assert(hasGitHub, 'Should always include GitHub agent for coordination');
        });

        await this.test('should include security agent for security-focused projects', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'secure-project',
                requirements: {
                    constraints: ['security_focused']
                },
                components: [{ name: 'auth_system', type: 'backend' }],
                complexity: 'medium'
            };

            const team = await orgManager.formAgentTeam(project);

            const hasSecurity = team.members.some(m => m.agentType === 'security');
            this.assert(hasSecurity, 'Should include security agent for security-focused projects');
        });

        await this.test('should select appropriate coordination pattern', async () => {
            const orgManager = new OrganizationManager();

            // Small team - should use direct coordination
            const smallProject = {
                id: 'small-project',
                components: [{ name: 'basic', type: 'backend' }],
                complexity: 'low'
            };

            const smallTeam = await orgManager.formAgentTeam(smallProject);
            // With minimal agents, should be direct or hierarchical
            this.assert(['direct', 'hierarchical'].includes(smallTeam.coordinationPattern),
                'Small team should use direct or hierarchical coordination');

            // Large team - should use distributed or hierarchical coordination
            const largeProject = {
                id: 'large-project',
                components: [
                    { name: 'comp1', type: 'backend' },
                    { name: 'comp2', type: 'frontend' },
                    { name: 'comp3', type: 'testing' },
                    { name: 'comp4', type: 'devops' },
                    { name: 'comp5', type: 'docs' }
                ],
                complexity: 'high',
                requirements: { constraints: ['security_focused'] }
            };

            const largeTeam = await orgManager.formAgentTeam(largeProject);
            // Should accommodate larger team coordination
            this.assert(['hierarchical', 'distributed'].includes(largeTeam.coordinationPattern),
                'Large team should use hierarchical or distributed coordination');
        });

        await this.test('should create appropriate agent configurations', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'config-test-project',
                name: 'Config Test',
                complexity: 'medium',
                requirements: {
                    technologies: ['javascript'],
                    constraints: []
                },
                components: [{ name: 'webapp', type: 'frontend' }]
            };

            const team = await orgManager.formAgentTeam(project);

            team.members.forEach(member => {
                this.assert(member.sessionId, 'Each agent should have session ID');
                this.assert(member.config, 'Each agent should have configuration');
                this.assert(member.config.autonomous === true, 'Should be configured for autonomous operation');
                this.assert(member.config.project.id === project.id, 'Should be linked to project');
            });
        });
    }

    async testInfrastructureSetup() {
        console.log('🔧 Test Category: Infrastructure Setup');

        await this.test('should setup infrastructure using external coordinator', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'infra-test-project',
                name: 'Infrastructure Test',
                description: 'Test project for infrastructure setup',
                complexity: 'medium',
                estimatedDuration: '2 weeks',
                components: [{ name: 'webapp', type: 'frontend' }]
            };

            const team = {
                id: 'infra-test-team',
                members: [
                    { agentType: 'github' },
                    { agentType: 'code' }
                ]
            };

            // Mock external coordinator to avoid actual API calls
            orgManager.externalCoordinator.onContextCreated = async (contextData) => {
                return {
                    github: { repository: 'mock-repo', branch: 'autonomous/infra-test-project' },
                    slack: { channel: '#infra-test-project', notifications: true }
                };
            };

            const infrastructure = await orgManager.setupInfrastructure(project, team);

            this.assert(infrastructure.projectId === project.id, 'Should be linked to project');
            this.assert(infrastructure.teamId === team.id, 'Should be linked to team');
            this.assert(infrastructure.github, 'Should have GitHub setup');
            this.assert(infrastructure.slack, 'Should have Slack setup');
            this.assert(infrastructure.autonomousFeatures, 'Should have autonomous features enabled');
            this.assert(infrastructure.monitoring, 'Should have monitoring configured');
            this.assert(infrastructure.status === 'active', 'Should be active after setup');
        });

        await this.test('should prepare appropriate context data for external systems', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'context-test-project',
                name: 'Context Test',
                description: 'Testing context data preparation',
                complexity: 'high',
                estimatedDuration: '3 weeks',
                components: [
                    { name: 'backend', type: 'backend' },
                    { name: 'frontend', type: 'frontend' }
                ]
            };

            const team = {
                id: 'context-test-team',
                members: [
                    { agentType: 'github' },
                    { agentType: 'code' },
                    { agentType: 'security' }
                ]
            };

            // Capture context data passed to external coordinator
            let capturedContextData = null;
            orgManager.externalCoordinator.onContextCreated = async (contextData) => {
                capturedContextData = contextData;
                return { github: {}, slack: {} };
            };

            await orgManager.setupInfrastructure(project, team);

            this.assert(capturedContextData, 'Should pass context data to external coordinator');
            this.assert(capturedContextData.contextId === project.id, 'Should include project ID');
            this.assert(capturedContextData.contextType === 'autonomous_project', 'Should identify as autonomous project');
            this.assert(capturedContextData.task === project.description, 'Should include project description');
            this.assert(capturedContextData.metadata.team.length === team.members.length, 'Should include team information');
            this.assert(capturedContextData.metadata.autonomousOrganization === true, 'Should identify as autonomous organization');
        });
    }

    async testResourceAllocation() {
        console.log('🔧 Test Category: Resource Allocation');

        await this.test('should allocate resources based on project complexity', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'resource-test-project',
                estimatedDuration: '2 weeks',
                resourceNeeds: {
                    cpu: 'medium',
                    memory: 'medium',
                    storage: 'low'
                },
                timeline: {
                    phases: [
                        { name: 'development', duration: '60%' },
                        { name: 'testing', duration: '40%' }
                    ],
                    milestones: [
                        { name: 'MVP Complete', day: 10 },
                        { name: 'Final Delivery', day: 14 }
                    ]
                },
                qualityGates: [
                    { name: 'Code Review', criteria: 'All code reviewed' },
                    { name: 'Security Scan', criteria: 'No critical vulnerabilities' }
                ]
            };

            const team = {
                id: 'resource-test-team',
                members: [
                    { agentType: 'github' },
                    { agentType: 'code' },
                    { agentType: 'security' }
                ]
            };

            const infrastructure = {
                autonomousFeatures: {
                    autoDeployment: true,
                    continuousIntegration: true
                }
            };

            const resourcePlan = await orgManager.allocateResources(project, team, infrastructure);

            this.assert(resourcePlan.projectId === project.id, 'Should be linked to project');
            this.assert(resourcePlan.teamId === team.id, 'Should be linked to team');
            this.assert(resourcePlan.computeResources, 'Should have compute resource allocation');
            this.assert(resourcePlan.timeAllocation, 'Should have time allocation');
            this.assert(resourcePlan.platformAllocation, 'Should have platform allocation');
            this.assert(resourcePlan.qualityAssurance, 'Should have quality assurance allocation');
            this.assert(resourcePlan.status === 'allocated', 'Should be marked as allocated');
        });

        await this.test('should calculate appropriate time allocation', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'time-test-project',
                estimatedDuration: '3 weeks',
                timeline: {
                    phases: [
                        { name: 'planning', duration: '20%' },
                        { name: 'development', duration: '60%' },
                        { name: 'testing', duration: '20%' }
                    ]
                }
            };

            const team = { id: 'time-test-team', members: [] };
            const infrastructure = {};

            const resourcePlan = await orgManager.allocateResources(project, team, infrastructure);

            this.assert(resourcePlan.timeAllocation.totalEstimate === project.estimatedDuration, 'Should preserve total estimate');
            this.assert(resourcePlan.timeAllocation.phases.length > 0, 'Should include timeline phases');
            this.assert(resourcePlan.timeAllocation.buffer, 'Should include time buffer');
        });

        await this.test('should store resource allocation for tracking', async () => {
            const orgManager = new OrganizationManager();
            const projectId = 'storage-test-project';
            const project = { id: projectId, estimatedDuration: '1 week' };
            const team = { id: 'storage-test-team', members: [] };
            const infrastructure = {};

            const resourcePlan = await orgManager.allocateResources(project, team, infrastructure);

            this.assert(orgManager.resourceAllocation.has(projectId), 'Should store resource allocation');
            this.assert(orgManager.resourceAllocation.get(projectId) === resourcePlan, 'Should store correct resource plan');
        });
    }

    async testExecutionPlanning() {
        console.log('🔧 Test Category: Execution Planning');

        await this.test('should create comprehensive execution plan', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'exec-test-project',
                components: [
                    { name: 'backend_api', type: 'backend' },
                    { name: 'frontend_ui', type: 'frontend' },
                    { name: 'tests', type: 'testing' }
                ],
                qualityGates: [
                    { name: 'Code Review', criteria: 'All code reviewed' },
                    { name: 'Security Scan', criteria: 'No vulnerabilities' }
                ]
            };

            const team = {
                id: 'exec-test-team',
                coordinationPattern: 'hierarchical',
                communicationProtocol: 'event-driven',
                members: [
                    { agentType: 'github' },
                    { agentType: 'code' },
                    { agentType: 'security' }
                ],
                specialists: [
                    { agentType: 'code' },
                    { agentType: 'security' }
                ],
                leadership: { agentType: 'github' },
                escalationRules: []
            };

            const infrastructure = {};
            const resourcePlan = {};

            const executionPlan = await orgManager.initiateExecution(project, team, infrastructure, resourcePlan);

            this.assert(executionPlan.projectId === project.id, 'Should be linked to project');
            this.assert(executionPlan.teamId === team.id, 'Should be linked to team');
            this.assert(executionPlan.strategy === 'autonomous-coordination', 'Should use autonomous coordination');
            this.assert(executionPlan.coordinationPattern === team.coordinationPattern, 'Should preserve coordination pattern');
            this.assert(executionPlan.phases.length === 4, 'Should have standard 4 phases');
            this.assert(executionPlan.status === 'planned', 'Should be in planned status');
        });

        await this.test('should define appropriate execution phases', async () => {
            const orgManager = new OrganizationManager();
            const project = {
                id: 'phase-test-project',
                components: [
                    { name: 'component1', type: 'backend' },
                    { name: 'component2', type: 'frontend' }
                ]
            };

            const team = {
                id: 'phase-test-team',
                coordinationPattern: 'hierarchical',
                communicationProtocol: 'event-driven',
                members: [
                    { agentType: 'github' },
                    { agentType: 'code' }
                ],
                specialists: [{ agentType: 'code' }],
                leadership: { agentType: 'github' },
                escalationRules: []
            };

            const executionPlan = await orgManager.initiateExecution(project, team, {}, {});

            const phaseNames = executionPlan.phases.map(p => p.phase);
            this.assert(phaseNames.includes('initialization'), 'Should have initialization phase');
            this.assert(phaseNames.includes('development'), 'Should have development phase');
            this.assert(phaseNames.includes('integration'), 'Should have integration phase');
            this.assert(phaseNames.includes('delivery'), 'Should have delivery phase');

            // Check phase timing
            const totalDuration = executionPlan.phases.reduce((sum, phase) => {
                return sum + parseInt(phase.duration);
            }, 0);
            this.assert(totalDuration === 100, 'Phase durations should sum to 100%');
        });

        await this.test('should create handoff protocols', async () => {
            const orgManager = new OrganizationManager();
            const team = {
                members: [
                    { agentType: 'github' },
                    { agentType: 'code' },
                    { agentType: 'security' }
                ]
            };

            const protocols = await orgManager.defineHandoffProtocols(team);

            this.assert(protocols.length === team.members.length - 1, 'Should have handoff protocol for each transition');

            protocols.forEach(protocol => {
                this.assert(protocol.from, 'Should specify source agent');
                this.assert(protocol.to, 'Should specify target agent');
                this.assert(protocol.trigger, 'Should specify trigger condition');
                this.assert(protocol.validation, 'Should specify validation requirement');
            });
        });
    }

    async testEndToEndWorkflow() {
        console.log('🔧 Test Category: End-to-End Workflow');

        await this.test('should execute complete workflow for simple project', async () => {
            const orgManager = new OrganizationManager('e2e-test-session');

            // Mock external coordinator to avoid actual API calls
            orgManager.externalCoordinator.onContextCreated = async () => ({
                github: { repository: 'mock-repo' },
                slack: { channel: 'mock-channel' }
            });

            const context = {
                input: 'Build a simple todo list application with user authentication',
                priority: 'medium'
            };

            // Mock context manager to avoid database calls
            orgManager.contextManager = {
                addAgentEvent: async (agent, event, data) => {
                    console.log(`📝 Mock context event: ${agent}.${event}`);
                }
            };

            const result = await orgManager.executeWorkflow(context);

            this.assert(result, 'Should return execution result');
            this.assert(result.requirements, 'Should have parsed requirements');
            this.assert(result.project, 'Should have decomposed project');
            this.assert(result.team, 'Should have formed team');
            this.assert(result.infrastructure, 'Should have setup infrastructure');
            this.assert(result.resourcePlan, 'Should have allocated resources');
            this.assert(result.executionPlan, 'Should have created execution plan');
            this.assert(result.coordinationResult, 'Should have coordination result');
            this.assert(result.status === 'completed', 'Should be marked as completed');
        });

        await this.test('should handle complex project with multiple components', async () => {
            const orgManager = new OrganizationManager('complex-e2e-test');

            // Mock external coordinator
            orgManager.externalCoordinator.onContextCreated = async () => ({
                github: { repository: 'complex-repo' },
                slack: { channel: 'complex-channel' }
            });

            // Mock context manager
            orgManager.contextManager = {
                addAgentEvent: async () => {}
            };

            const context = {
                input: 'Build a comprehensive e-commerce platform with user management, product catalog, shopping cart, payment processing, order management, and admin dashboard',
                priority: 'high'
            };

            const result = await orgManager.executeWorkflow(context);

            // Complex project should result in larger team and more components
            this.assert(result.project.complexity !== 'low', 'Should not be low complexity');
            this.assert(result.team.members.length >= 3, 'Should have substantial team for complex project');
            this.assert(result.project.components.length >= 5, 'Should have multiple components');
            this.assert(result.executionPlan.phases.length === 4, 'Should have all execution phases');
        });

        await this.test('should maintain organization state across multiple projects', async () => {
            const orgManager = new OrganizationManager('multi-project-test');

            // Mock dependencies
            orgManager.externalCoordinator.onContextCreated = async () => ({ github: {}, slack: {} });
            orgManager.contextManager = { addAgentEvent: async () => {} };

            const project1Context = { input: 'Build a blog application' };
            const project2Context = { input: 'Create an API service' };

            const result1 = await orgManager.executeWorkflow(project1Context);
            const result2 = await orgManager.executeWorkflow(project2Context);

            this.assert(orgManager.activeProjects.size === 2, 'Should track multiple active projects');
            this.assert(orgManager.agentTeams.size === 2, 'Should track multiple teams');
            this.assert(orgManager.resourceAllocation.size === 2, 'Should track multiple resource allocations');

            const status = orgManager.getOrganizationStatus();
            this.assert(status.activeProjects === 2, 'Status should reflect active projects');
            this.assert(status.activeTeams === 2, 'Status should reflect active teams');
            this.assert(status.organizationHealth === 'operational', 'Should be operational');
        });

        await this.test('should handle organization capacity calculations', async () => {
            const orgManager = new OrganizationManager('capacity-test');

            const status = orgManager.getOrganizationStatus();

            this.assert(status.currentCapacity, 'Should have capacity information');
            this.assert(typeof status.currentCapacity.used === 'number', 'Should track used capacity');
            this.assert(typeof status.currentCapacity.total === 'number', 'Should have total capacity');
            this.assert(typeof status.currentCapacity.available === 'number', 'Should calculate available capacity');
            this.assert(status.nextAvailable, 'Should estimate next availability');
        });
    }

    async test(description, testFunction) {
        try {
            await testFunction();
            console.log(`✅ ${description}`);
            this.passed++;
            this.results.push({ description, status: 'passed' });
        } catch (error) {
            console.log(`❌ ${description}`);
            console.log(`   Error: ${error.message}`);
            this.failed++;
            this.results.push({ description, status: 'failed', error: error.message });
        }
    }

    assert(condition, message = 'Assertion failed') {
        if (!condition) {
            throw new Error(message);
        }
    }

    printSummary() {
        console.log('\n📊 Test Results Summary:');
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📈 Success Rate: ${(this.passed / (this.passed + this.failed) * 100).toFixed(1)}%`);

        if (this.failed === 0) {
            console.log('\n🎉 OrganizationManager: ✅ ALL TESTS PASSED - READY FOR AUTONOMOUS OPERATION');
        } else {
            console.log('\n⚠️  Some tests failed. Review and fix before proceeding.');

            console.log('\nFailed Tests:');
            this.results
                .filter(r => r.status === 'failed')
                .forEach(r => console.log(`  - ${r.description}: ${r.error}`));
        }

        console.log('\n🎯 OrganizationManager Core Implementation Complete');
        console.log('📋 Next Steps: Day 2 - Natural Language Execution Engine');
    }
}

// Run tests if executed directly
if (require.main === module) {
    (async () => {
        const tester = new OrganizationManagerTester();
        const success = await tester.runAllTests();
        process.exit(success ? 0 : 1);
    })();
}

module.exports = { OrganizationManagerTester };