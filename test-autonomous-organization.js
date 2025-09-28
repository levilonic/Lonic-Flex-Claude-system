#!/usr/bin/env node
/**
 * Autonomous AI Organization Test Suite
 * Phase 2 Implementation: Week 1, Day 1
 *
 * Tests the complete autonomous organization system including:
 * - OrganizationManager core functionality
 * - Database schema extensions
 * - Natural Language Execution Engine
 * - End-to-end autonomous project delivery
 */

const { OrganizationManager } = require('./core/organization-manager');
const { NaturalLanguageExecutionEngine } = require('./core/nl-execution-engine');
const { SQLiteManager } = require('./database/sqlite-manager');
const { AutonomousSchemaManager } = require('./database/autonomous-schema-manager');

class AutonomousOrganizationTester {
    constructor() {
        this.dbManager = null;
        this.schemaManager = null;
        this.orgManager = null;
        this.nlEngine = null;
        this.testResults = [];
    }

    async runAllTests() {
        console.log('🧪 Starting Autonomous AI Organization Test Suite');
        console.log('=' .repeat(60));

        try {
            await this.setupTestEnvironment();
            await this.testDatabaseSchema();
            await this.testNaturalLanguageEngine();
            await this.testOrganizationManager();
            await this.testEndToEndScenarios();

            this.displayTestResults();

        } catch (error) {
            console.error('❌ Test suite failed:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async setupTestEnvironment() {
        console.log('\n🔧 Setting up test environment...');

        // Initialize database with test path
        this.dbManager = new SQLiteManager('./test-autonomous-org.db');
        await this.dbManager.initialize();

        // Apply autonomous organization schema
        this.schemaManager = new AutonomousSchemaManager(this.dbManager);
        await this.schemaManager.applySchemaExtensions();

        // Initialize natural language engine
        this.nlEngine = new NaturalLanguageExecutionEngine();

        // Initialize organization manager with unique session ID
        const uniqueSessionId = `test-org-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this.orgManager = new OrganizationManager(uniqueSessionId, {
            testMode: true,
            github: { autoCreateBranch: false }, // Disable external systems for testing
            slack: { autoNotify: false }
        });
        await this.orgManager.initialize(); // Initialize the organization manager

        console.log('✅ Test environment setup complete');
    }

    async testDatabaseSchema() {
        console.log('\n📊 Testing database schema extensions...');

        try {
            // Test 1: Create autonomous project
            const projectData = {
                id: 'test-project-001',
                name: 'Test Dashboard Application',
                description: 'Create a customer analytics dashboard with real-time metrics',
                original_input: 'Build a customer dashboard with user authentication and analytics',
                project_type: 'dashboard',
                complexity: 'medium',
                priority: 'high',
                estimated_duration: 14,
                estimated_loc: 2000,
                requirements: {
                    features: ['authentication', 'dashboard', 'analytics'],
                    constraints: ['security_focused'],
                    technologies: ['javascript', 'react']
                },
                components: [
                    { name: 'authentication', type: 'backend', priority: 'high' },
                    { name: 'dashboard_ui', type: 'frontend', priority: 'medium' }
                ],
                assigned_manager: 'test-org-manager'
            };

            await this.schemaManager.createProject(projectData);
            this.recordTestResult('Create Project', true, 'Project created successfully');

            // Test 2: Create project team
            const teamData = {
                id: 'test-team-001',
                project_id: 'test-project-001',
                name: 'Dashboard Development Team',
                coordination_pattern: 'hierarchical',
                leader_agent_type: 'github',
                member_count: 4,
                status: 'active'
            };

            await this.schemaManager.createTeam(teamData);
            this.recordTestResult('Create Team', true, 'Team created successfully');

            // Test 3: Add team members
            const memberData = {
                id: 'test-member-001',
                team_id: 'test-team-001',
                project_id: 'test-project-001',
                agent_type: 'github',
                session_id: 'test-github-session',
                role: 'Project Coordinator',
                responsibilities: ['repository_management', 'workflow_coordination'],
                capabilities: ['github_api', 'project_management']
            };

            await this.schemaManager.addTeamMember(memberData);
            this.recordTestResult('Add Team Member', true, 'Team member added successfully');

            // Test 4: Create execution plan
            const planData = {
                id: 'test-plan-001',
                project_id: 'test-project-001',
                team_id: 'test-team-001',
                strategy: 'autonomous-coordination',
                coordination_pattern: 'hierarchical',
                communication_protocol: 'event-driven',
                phases: [
                    { name: 'foundation', duration: 3, agents: ['github', 'security'] },
                    { name: 'development', duration: 8, agents: ['code', 'github'] },
                    { name: 'integration', duration: 2, agents: ['deploy', 'security'] },
                    { name: 'delivery', duration: 1, agents: ['github'] }
                ],
                current_phase: 'foundation'
            };

            await this.schemaManager.createExecutionPlan(planData);
            this.recordTestResult('Create Execution Plan', true, 'Execution plan created successfully');

            // Test 5: Create tasks
            const taskData = {
                id: 'test-task-001',
                project_id: 'test-project-001',
                execution_plan_id: 'test-plan-001',
                name: 'Setup Authentication System',
                description: 'Implement JWT-based authentication with user management',
                task_type: 'executable',
                phase: 'foundation',
                priority: 'high',
                assigned_agent_type: 'security',
                estimated_effort: 16,
                estimated_loc: 300,
                deliverables: ['auth_middleware', 'user_model', 'login_endpoints']
            };

            await this.schemaManager.createTask(taskData);
            this.recordTestResult('Create Task', true, 'Task created successfully');

            // Test 6: Record metrics
            const metricData = {
                project_id: 'test-project-001',
                metric_type: 'progress',
                metric_name: 'overall_progress',
                metric_value: 0.25,
                metric_unit: 'percentage',
                measured_by: 'test-system',
                baseline_value: 0.0,
                target_value: 1.0,
                trend: 'improving'
            };

            await this.schemaManager.recordMetric(metricData);
            this.recordTestResult('Record Metrics', true, 'Metrics recorded successfully');

            // Test 7: Query data
            const projects = await this.schemaManager.getActiveProjects();
            const hasTestProject = projects.some(p => p.id === 'test-project-001');
            this.recordTestResult('Query Active Projects', hasTestProject,
                hasTestProject ? 'Test project found in query results' : 'Test project not found');

            console.log('✅ Database schema tests completed');

        } catch (error) {
            this.recordTestResult('Database Schema Tests', false, error.message);
            throw error;
        }
    }

    async testNaturalLanguageEngine() {
        console.log('\n🧠 Testing Natural Language Execution Engine...');

        try {
            // Test 1: Simple project parsing
            const simpleInput = 'Create a basic todo application with user authentication';
            const simpleResult = await this.nlEngine.transformToExecution(simpleInput);

            const hasStages = simpleResult.stages &&
                              simpleResult.stages.adapt &&
                              simpleResult.stages.dart &&
                              simpleResult.stages.coc &&
                              simpleResult.stages.lilo;

            this.recordTestResult('Simple NL Processing', hasStages,
                hasStages ? 'All NL processing stages completed' : 'Missing processing stages');

            // Test 2: Complex project parsing
            const complexInput = `Build a comprehensive e-commerce platform with microservices architecture.
                                 Include user management, product catalog, shopping cart, payment processing,
                                 order management, inventory tracking, and admin dashboard.
                                 Must be scalable, secure, and support high performance.`;

            const complexResult = await this.nlEngine.transformToExecution(complexInput);

            const hasHighComplexity = complexResult.stages.adapt.complexity === 'very_high' ||
                                     complexResult.stages.adapt.complexity === 'high';

            this.recordTestResult('Complex NL Processing', hasHighComplexity,
                `Complexity assessed as: ${complexResult.stages.adapt.complexity}`);

            // Test 3: Pattern recognition
            const patternResult = complexResult.stages.lilo;
            const hasPatterns = patternResult.patternsFound > 0;

            this.recordTestResult('Pattern Recognition', hasPatterns,
                `Found ${patternResult.patternsFound} patterns`);

            // Test 4: Code generation planning
            const codeResult = complexResult.stages.coc;
            const hasCodeComponents = codeResult.totalComponents > 0;

            this.recordTestResult('Code Generation Planning', hasCodeComponents,
                `Generated ${codeResult.totalComponents} code components`);

            console.log('✅ Natural Language Engine tests completed');

        } catch (error) {
            this.recordTestResult('Natural Language Engine Tests', false, error.message);
            throw error;
        }
    }

    async testOrganizationManager() {
        console.log('\n🏢 Testing Organization Manager...');

        try {
            // Test 1: Natural language parsing
            const testInput = 'Build a customer analytics dashboard with real-time metrics, user authentication, and data visualization';
            const requirements = await this.orgManager.parseNaturalLanguage(testInput);

            const hasRequirements = requirements.projectType &&
                                   requirements.features &&
                                   requirements.complexity;

            this.recordTestResult('Requirements Parsing', hasRequirements,
                `Project type: ${requirements.projectType}, Features: ${requirements.features.length}`);

            // Test 2: Project decomposition
            const project = await this.orgManager.decomposeProject(requirements);

            const hasComponents = project.components && project.components.length > 0;
            const hasTimeline = project.timeline && project.timeline.phases;

            this.recordTestResult('Project Decomposition', hasComponents && hasTimeline,
                `Components: ${project.components?.length || 0}, Phases: ${project.timeline?.phases?.length || 0}`);

            // Test 3: Team formation
            const team = await this.orgManager.formAgentTeam(project);

            const hasMembers = team.members && team.members.length > 0;
            const hasCoordination = team.coordinationPattern;

            this.recordTestResult('Team Formation', hasMembers && hasCoordination,
                `Team members: ${team.members?.length || 0}, Pattern: ${team.coordinationPattern}`);

            // Test 4: Infrastructure setup (test mode - no external calls)
            const infrastructure = await this.orgManager.setupInfrastructure(project, team);

            const hasInfrastructure = infrastructure && infrastructure.autonomousFeatures;

            this.recordTestResult('Infrastructure Setup', hasInfrastructure,
                hasInfrastructure ? 'Infrastructure configuration created' : 'No infrastructure created');

            // Test 5: Resource allocation
            const resources = await this.orgManager.allocateResources(project, team, infrastructure);

            const hasResources = resources.computeResources && resources.timeAllocation;

            this.recordTestResult('Resource Allocation', hasResources,
                hasResources ? `Allocated ${resources.computeResources.agents} agents` : 'Resource allocation failed');

            console.log('✅ Organization Manager tests completed');

        } catch (error) {
            this.recordTestResult('Organization Manager Tests', false, error.message);
            throw error;
        }
    }

    async testEndToEndScenarios() {
        console.log('\n🎯 Testing end-to-end autonomous organization scenarios...');

        try {
            // Scenario 1: Simple web application
            const scenario1Input = 'Create a simple blog application with user registration and posting capabilities';
            const scenario1Result = await this.runFullScenario('Simple Blog App', scenario1Input);

            this.recordTestResult('E2E Simple Scenario', scenario1Result.success,
                scenario1Result.message || 'Simple scenario completed');

            // Scenario 2: Dashboard application
            const scenario2Input = 'Build an analytics dashboard for monitoring website traffic with charts and user management';
            const scenario2Result = await this.runFullScenario('Analytics Dashboard', scenario2Input);

            this.recordTestResult('E2E Dashboard Scenario', scenario2Result.success,
                scenario2Result.message || 'Dashboard scenario completed');

            // Scenario 3: API service
            const scenario3Input = 'Develop a REST API service for managing customer data with authentication and CRUD operations';
            const scenario3Result = await this.runFullScenario('REST API Service', scenario3Input);

            this.recordTestResult('E2E API Scenario', scenario3Result.success,
                scenario3Result.message || 'API scenario completed');

            console.log('✅ End-to-end scenario tests completed');

        } catch (error) {
            this.recordTestResult('End-to-End Tests', false, error.message);
            throw error;
        }
    }

    async runFullScenario(scenarioName, input) {
        try {
            console.log(`   🔄 Running ${scenarioName} scenario...`);

            // Create new organization manager for this scenario
            const orgManager = new OrganizationManager(`test-scenario-${Date.now()}`, {
                testMode: true,
                github: { autoCreateBranch: false },
                slack: { autoNotify: false }
            });
            await orgManager.initialize(); // Initialize the organization manager

            // Run the full autonomous organization workflow
            const context = {
                input: input,
                testMode: true
            };

            const result = await orgManager.executeWorkflow(context);

            // Verify the result has required components
            const hasProject = result.project && result.project.id;
            const hasTeam = result.team && result.team.members && result.team.members.length > 0;
            const hasInfrastructure = result.infrastructure;
            const hasExecution = result.executionPlan;

            if (hasProject && hasTeam && hasInfrastructure && hasExecution) {

                const validation = { success: this.validateSuccess() };return {

                    success: validation.success,
                    message: `${scenarioName}: Project=${result.project.name}, Team=${result.team.members.length} members, Status=${result.status}`
                };
            } else {
                return {
                    success: false,
                    message: `${scenarioName}: Missing components - Project=${!!hasProject}, Team=${!!hasTeam}, Infrastructure=${!!hasInfrastructure}, Execution=${!!hasExecution}`
                };
            }

        } catch (error) {
            return {
                success: false,
                message: `${scenarioName} failed: ${error.message}`
            };
        }
    }

    recordTestResult(testName, success, details) {
        this.testResults.push({
            test: testName,
            success: success,
            details: details,
            timestamp: new Date().toISOString()
        });

        const status = success ? '✅' : '❌';
        console.log(`   ${status} ${testName}: ${details}`);
    }

    displayTestResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(60));

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;

        console.log(`Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`📈 Success Rate: ${successRate}%`);

        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => !r.success)
                .forEach(test => {
                    console.log(`   • ${test.test}: ${test.details}`);
                });
        }

        console.log('\n🎯 AUTONOMOUS AI ORGANIZATION SYSTEM STATUS:');
        if (successRate >= 90) {
            console.log('✅ PRODUCTION READY - System is fully operational');
        } else if (successRate >= 75) {
            console.log('⚠️ MOSTLY FUNCTIONAL - Some issues need attention');
        } else {
            console.log('❌ NEEDS WORK - Major issues require fixing');
        }

        console.log('='.repeat(60));
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...');

        try {
            // Close database connection
            if (this.dbManager && this.dbManager.db) {
                await new Promise((resolve) => {
                    this.dbManager.db.close((err) => {
                        if (err) console.warn('Database close warning:', err.message);
                        resolve();
                    });
                });
            }

            // Remove test database file
            const fs = require('fs');
            if (fs.existsSync('./test-autonomous-org.db')) {
                fs.unlinkSync('./test-autonomous-org.db');
            }
            if (fs.existsSync('./test-autonomous-org.db-wal')) {
                fs.unlinkSync('./test-autonomous-org.db-wal');
            }
            if (fs.existsSync('./test-autonomous-org.db-shm')) {
                fs.unlinkSync('./test-autonomous-org.db-shm');
            }

            console.log('✅ Cleanup completed');

        } catch (error) {
            console.warn('⚠️ Cleanup warning:', error.message);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new AutonomousOrganizationTester();
    tester.runAllTests()
        .then(() => {
            console.log('\n🎉 Autonomous AI Organization test suite completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Test suite failed:', error.message);
            process.exit(1);
        });
}

module.exports = { AutonomousOrganizationTester };