#!/usr/bin/env node
/**
 * Window 1 Multi-Workflow State Management - Comprehensive Test Suite
 * Tests all components of Window 1 implementation
 *
 * Test Coverage:
 * - Multi-Workflow State Manager
 * - Claude State Bridge
 * - Conditional Workflow Engine
 * - Enhanced Approval Gates
 * - Integration between all components
 */

const { SQLiteManager } = require('./database/sqlite-manager');
const { MultiWorkflowStateManager } = require('./services/multi-workflow-state-manager');
const { ClaudeStateBridge } = require('./services/claude-state-bridge');
const { ConditionalWorkflowEngine } = require('./services/conditional-workflow-engine');
const { EnhancedApprovalGates } = require('./services/enhanced-approval-gates');

class Window1TestSuite {
    constructor() {
        this.testResults = [];
        this.componentResults = new Map();
        this.startTime = Date.now();

        // Test configuration
        this.config = {
            database: {
                filename: ':memory:', // Use in-memory database for tests
                enableWAL: false
            },
            workflow: {
                maxActiveWorkflows: 10,
                stateSnapshotInterval: 1000, // 1 second for tests
                enableClaudeIntegration: false // Disable for isolated testing
            },
            claude: {
                enableCaching: true,
                enableWorkflowIntegration: false,
                apiKey: 'test-api-key'
            },
            conditional: {
                maxRulesPerWorkflow: 20,
                enableParallelEvaluation: true
            },
            approval: {
                defaultTimeoutHours: 1,
                enableSlackIntegration: false,
                enableAutoApproval: true
            }
        };

        // Initialize components
        this.db = new SQLiteManager(':memory:'); // Use in-memory database for tests
        this.workflowManager = new MultiWorkflowStateManager(this.config.workflow);
        this.claudeBridge = new ClaudeStateBridge(this.config.claude);
        this.conditionalEngine = new ConditionalWorkflowEngine(this.config.conditional);
        this.approvalGates = new EnhancedApprovalGates(this.config.approval);

        console.log('🔬 Window 1 Multi-Workflow State Management Test Suite');
        console.log('🎯 Testing Foundation v0 Multi-Workflow State Persistence');
        console.log('');
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        try {
            console.log('📋 WINDOW 1 TEST EXECUTION PLAN:');
            console.log('1. Component initialization tests');
            console.log('2. Multi-Workflow State Manager tests');
            console.log('3. Claude State Bridge tests');
            console.log('4. Conditional Workflow Engine tests');
            console.log('5. Enhanced Approval Gates tests');
            console.log('6. Integration tests');
            console.log('7. Performance and stress tests');
            console.log('');

            await this.initializeComponents();

            await this.runComponentTests();
            await this.runIntegrationTests();
            await this.runPerformanceTests();

            await this.generateTestReport();

        } catch (error) {
            console.error('❌ Test suite execution failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Initialize all components
     */
    async initializeComponents() {
        console.log('🚀 Initializing Window 1 components...');

        const components = [
            { name: 'Database', instance: this.db },
            { name: 'Multi-Workflow State Manager', instance: this.workflowManager },
            { name: 'Claude State Bridge', instance: this.claudeBridge },
            { name: 'Conditional Workflow Engine', instance: this.conditionalEngine },
            { name: 'Enhanced Approval Gates', instance: this.approvalGates }
        ];

        for (const component of components) {
            try {
                await component.instance.initialize();
                console.log(`  ✅ ${component.name} initialized`);
            } catch (error) {
                console.error(`  ❌ ${component.name} initialization failed:`, error.message);
                throw error;
            }
        }

        console.log('');
    }

    /**
     * Run component-specific tests
     */
    async runComponentTests() {
        console.log('🧪 Running component tests...');

        // Multi-Workflow State Manager tests
        await this.testMultiWorkflowStateManager();

        // Claude State Bridge tests
        await this.testClaudeStateBridge();

        // Conditional Workflow Engine tests
        await this.testConditionalWorkflowEngine();

        // Enhanced Approval Gates tests
        await this.testEnhancedApprovalGates();

        console.log('');
    }

    /**
     * Test Multi-Workflow State Manager
     */
    async testMultiWorkflowStateManager() {
        console.log('  📊 Testing Multi-Workflow State Manager...');

        const tests = [
            // Test 1: Create workflow session
            async () => {
                const result = await this.workflowManager.createWorkflowSession({
                    name: 'Test Security Review Workflow',
                    description: 'Multi-day security review and remediation',
                    type: 'security',
                    createdBy: 'test-user',
                    estimatedDuration: 2 * 24 * 3600000, // 2 days
                    metadata: {
                        repository: 'test/repo',
                        pullRequest: 123,
                        priority: 'high'
                    }
                });

                this.assertTrue(result.success, 'Workflow session creation should succeed');
                this.assertTrue(result.workflowId, 'Workflow ID should be generated');
                this.assertEquals(result.workflowState.name, 'Test Security Review Workflow');

                return result.workflowId;
            },

            // Test 2: Add workflow steps
            async (workflowId) => {
                const stepResult = await this.workflowManager.addWorkflowStep(workflowId, {
                    stepName: 'security-scan',
                    stepType: 'automated',
                    estimatedDuration: 600000, // 10 minutes
                    dependencies: []
                });

                this.assertTrue(stepResult.success, 'Adding workflow step should succeed');
                this.assertTrue(stepResult.stepId, 'Step ID should be generated');

                return { workflowId, stepId: stepResult.stepId };
            },

            // Test 3: Update step status
            async ({ workflowId, stepId }) => {
                const updateResult = await this.workflowManager.updateWorkflowStep(workflowId, stepId, {
                    status: 'completed',
                    results: {
                        criticalIssues: 2,
                        highIssues: 5,
                        mediumIssues: 12,
                        scanDuration: 580000
                    }
                });

                this.assertTrue(updateResult.success, 'Step update should succeed');

                return { workflowId, stepId };
            },

            // Test 4: Resume workflow session
            async ({ workflowId }) => {
                // First, remove from active workflows to simulate restart
                this.workflowManager.activeWorkflows.delete(workflowId);

                const resumeResult = await this.workflowManager.resumeWorkflowSession(workflowId);

                this.assertTrue(resumeResult.success, 'Workflow resume should succeed');
                this.assertTrue(resumeResult.resumed, 'Workflow should be marked as resumed');
                this.assertEquals(resumeResult.workflowState.steps.length, 1, 'Should have one step');

                return workflowId;
            },

            // Test 5: Add conditional rule
            async (workflowId) => {
                const ruleResult = await this.workflowManager.addConditionalRule(workflowId, {
                    ruleName: 'security-failure-halt',
                    conditionExpression: 'security_scan.critical_issues > 1',
                    actionType: 'halt_workflow',
                    actionData: {
                        reason: 'Critical security issues found',
                        notifyTeam: true
                    }
                });

                this.assertTrue(ruleResult.success, 'Adding conditional rule should succeed');

                return workflowId;
            }
        ];

        const workflowResults = await this.runSequentialTests('Multi-Workflow State Manager', tests);
        this.componentResults.set('workflow-manager', workflowResults);
    }

    /**
     * Test Claude State Bridge
     */
    async testClaudeStateBridge() {
        console.log('  🤖 Testing Claude State Bridge...');

        const tests = [
            // Test 1: Start Claude conversation
            async () => {
                const result = await this.claudeBridge.startConversation({
                    name: 'Code Security Analysis',
                    type: 'security_audit',
                    initialContext: {
                        repository: 'test/repo',
                        branch: 'feature/security-fixes',
                        fileCount: 15
                    },
                    metadata: {
                        priority: 'high',
                        automated: true
                    }
                });

                this.assertTrue(result.success, 'Starting conversation should succeed');
                this.assertTrue(result.conversationId, 'Conversation ID should be generated');
                this.assertEquals(result.conversationState.name, 'Code Security Analysis');

                return result.conversationId;
            },

            // Test 2: Continue conversation with mock Claude interaction
            async (conversationId) => {
                // Mock Claude analysis request
                const analysisRequest = {
                    type: 'security_audit',
                    content: 'function validateInput(userInput) { return userInput; }',
                    context: {
                        filename: 'validator.js',
                        lineNumber: 42
                    }
                };

                // Mock the Claude service for testing
                const originalAnalyzeMethod = this.claudeBridge.claudeService.analyzeWithClaude;
                this.claudeBridge.claudeService.analyzeWithClaude = async (request) => {
                    return {
                        success: true,
                        type: request.type,
                        analysis: 'Security vulnerability detected: Input validation missing. This could lead to injection attacks.',
                        usage: { total_tokens: 150, input_tokens: 100, output_tokens: 50 },
                        estimatedCost: 0.002,
                        structuredAnalysis: {
                            vulnerabilities: [
                                {
                                    type: 'input_validation',
                                    severity: 'high',
                                    line: 42,
                                    recommendation: 'Add input sanitization'
                                }
                            ]
                        }
                    };
                };

                const result = await this.claudeBridge.continueConversation(conversationId, analysisRequest);

                this.assertTrue(result.success, 'Continuing conversation should succeed');
                this.assertTrue(result.claudeResult, 'Should have Claude result');
                this.assertEquals(result.conversationStats.totalInteractions, 1);

                // Restore original method
                this.claudeBridge.claudeService.analyzeWithClaude = originalAnalyzeMethod;

                return conversationId;
            },

            // Test 3: Test conversation memory
            async (conversationId) => {
                const conversation = this.claudeBridge.activeConversations.get(conversationId);
                this.assertTrue(conversation, 'Conversation should exist in memory');
                this.assertEquals(conversation.interactionHistory.length, 1, 'Should have one interaction');

                return conversationId;
            }
        ];

        const claudeResults = await this.runSequentialTests('Claude State Bridge', tests);
        this.componentResults.set('claude-bridge', claudeResults);
    }

    /**
     * Test Conditional Workflow Engine
     */
    async testConditionalWorkflowEngine() {
        console.log('  ⚙️ Testing Conditional Workflow Engine...');

        const tests = [
            // Test 1: Create conditional rule
            async () => {
                const result = await this.conditionalEngine.createRule({
                    name: 'Test Security Halt Rule',
                    description: 'Halt workflow if critical security issues found',
                    conditionExpression: 'security_scan.critical_count > 0',
                    actionType: 'halt_workflow',
                    actionConfig: {
                        reason: 'Critical security vulnerabilities detected',
                        notification: true
                    },
                    priority: 1
                });

                this.assertTrue(result.success, 'Rule creation should succeed');
                this.assertTrue(result.ruleId, 'Rule ID should be generated');

                return result.ruleId;
            },

            // Test 2: Evaluate rule with positive condition
            async (ruleId) => {
                const evaluationContext = {
                    security_scan: {
                        critical_count: 2,
                        high_count: 5,
                        medium_count: 10,
                        scan_complete: true
                    },
                    workflow: {
                        id: 'test-workflow-123',
                        status: 'running'
                    }
                };

                const result = await this.conditionalEngine.evaluateRule(ruleId, evaluationContext);

                this.assertTrue(result.success, 'Rule evaluation should succeed');
                this.assertTrue(result.conditionResult, 'Condition should evaluate to true');
                this.assertTrue(result.actionExecuted, 'Action should be executed');

                return ruleId;
            },

            // Test 3: Evaluate rule with negative condition
            async (ruleId) => {
                const evaluationContext = {
                    security_scan: {
                        critical_count: 0,
                        high_count: 3,
                        medium_count: 8,
                        scan_complete: true
                    }
                };

                const result = await this.conditionalEngine.evaluateRule(ruleId, evaluationContext);

                this.assertTrue(result.success, 'Rule evaluation should succeed');
                this.assertFalse(result.conditionResult, 'Condition should evaluate to false');
                this.assertFalse(result.actionExecuted, 'Action should not be executed');

                return ruleId;
            },

            // Test 4: Test built-in rule templates
            async () => {
                const templates = Array.from(this.conditionalEngine.ruleTemplates.keys());
                this.assertTrue(templates.length > 0, 'Should have built-in rule templates');
                this.assertTrue(templates.includes('security-failure-halt'), 'Should have security-failure-halt template');

                return true;
            }
        ];

        const conditionalResults = await this.runSequentialTests('Conditional Workflow Engine', tests);
        this.componentResults.set('conditional-engine', conditionalResults);
    }

    /**
     * Test Enhanced Approval Gates
     */
    async testEnhancedApprovalGates() {
        console.log('  ✅ Testing Enhanced Approval Gates...');

        const tests = [
            // Test 1: Create approval request
            async () => {
                const result = await this.approvalGates.createApprovalRequest({
                    gateName: 'security-review-approval',
                    title: 'Security Review Approval Required',
                    description: 'Critical security issues found, require team lead approval',
                    priority: 'high',
                    approvers: [
                        { id: 'security-lead', name: 'Security Team Lead' },
                        { id: 'eng-manager', name: 'Engineering Manager' }
                    ],
                    requiredApprovers: 2,
                    timeoutHours: 4,
                    metadata: {
                        repository: 'test/repo',
                        criticalIssues: 2
                    }
                });

                this.assertTrue(result.success, 'Approval request creation should succeed');
                this.assertTrue(result.approvalId, 'Approval ID should be generated');
                this.assertEquals(result.assignments.length, 2, 'Should have two assignments');

                return result.approvalId;
            },

            // Test 2: Submit approval response
            async (approvalId) => {
                const response1 = await this.approvalGates.submitApprovalResponse(approvalId, {
                    approverId: 'security-lead',
                    approverName: 'Security Team Lead',
                    response: 'approved',
                    comments: 'Reviewed security issues, approved for remediation'
                });

                this.assertTrue(response1.success, 'First approval response should succeed');
                this.assertFalse(response1.completed, 'Approval should not be complete yet');

                return approvalId;
            },

            // Test 3: Complete approval with second response
            async (approvalId) => {
                const response2 = await this.approvalGates.submitApprovalResponse(approvalId, {
                    approverId: 'eng-manager',
                    approverName: 'Engineering Manager',
                    response: 'approved',
                    comments: 'Engineering team has capacity for security fixes'
                });

                this.assertTrue(response2.success, 'Second approval response should succeed');
                this.assertTrue(response2.completed, 'Approval should be complete');
                this.assertEquals(response2.finalStatus, 'approved', 'Final status should be approved');

                return approvalId;
            },

            // Test 4: Test auto-approval conditions
            async () => {
                const result = await this.approvalGates.createApprovalRequest({
                    gateName: 'low-risk-change',
                    title: 'Low Risk Change Auto-Approval Test',
                    description: 'Testing auto-approval for low-risk changes',
                    autoApproveConditions: {
                        risk_level: 'low',
                        tests_passing: true
                    },
                    metadata: {
                        risk_level: 'low',
                        tests_passing: true,
                        security_scan_clean: true
                    }
                });

                // Should be auto-approved
                this.assertTrue(result.success, 'Auto-approval request should succeed');

                return true;
            }
        ];

        const approvalResults = await this.runSequentialTests('Enhanced Approval Gates', tests);
        this.componentResults.set('approval-gates', approvalResults);
    }

    /**
     * Run integration tests
     */
    async runIntegrationTests() {
        console.log('🔗 Running integration tests...');

        const tests = [
            // Test 1: End-to-end workflow with all components
            async () => {
                console.log('    🔄 Testing end-to-end workflow integration...');

                // 1. Create multi-day workflow
                const workflowResult = await this.workflowManager.createWorkflowSession({
                    name: 'Integration Test Workflow',
                    description: 'End-to-end test of all Window 1 components',
                    type: 'integration_test',
                    estimatedDuration: 24 * 3600000 // 24 hours
                });

                const workflowId = workflowResult.workflowId;

                // 2. Add security scan step
                await this.workflowManager.addWorkflowStep(workflowId, {
                    stepName: 'security-scan',
                    stepType: 'automated'
                });

                // 3. Create conditional rule for security failures
                await this.conditionalEngine.createRule({
                    workflowId,
                    name: 'Integration Security Rule',
                    conditionExpression: 'security_scan.critical_count > 1',
                    actionType: 'approval_gate',
                    actionConfig: {
                        gateName: 'security-remediation-approval',
                        approvers: ['security-lead', 'eng-manager']
                    }
                });

                // 4. Simulate security scan completion with critical issues
                const stepId = workflowResult.workflowState.steps[0]?.id;
                if (stepId) {
                    await this.workflowManager.updateWorkflowStep(workflowId, stepId, {
                        status: 'completed',
                        results: { critical_count: 3, high_count: 7 }
                    });
                }

                // 5. Evaluate conditional rules (should trigger approval gate)
                const evaluationResult = await this.conditionalEngine.evaluateWorkflowRules(workflowId, {
                    security_scan: { critical_count: 3, high_count: 7 }
                });

                this.assertTrue(evaluationResult.success, 'Rule evaluation should succeed');
                this.assertTrue(evaluationResult.summary.rulesTriggered > 0, 'Should trigger rules');

                return { workflowId, evaluationResult };
            },

            // Test 2: Claude integration with workflow state
            async ({ workflowId }) => {
                console.log('    🤖 Testing Claude-workflow integration...');

                // Start Claude conversation linked to workflow
                const conversationResult = await this.claudeBridge.startConversation({
                    name: 'Workflow Analysis Conversation',
                    type: 'workflow_analysis',
                    workflowId,
                    initialContext: {
                        workflowName: 'Integration Test Workflow',
                        currentStep: 'security-analysis'
                    }
                });

                this.assertTrue(conversationResult.success, 'Claude conversation should start');
                this.assertEquals(conversationResult.conversationState.workflowId, workflowId);

                return { workflowId, conversationId: conversationResult.conversationId };
            }
        ];

        const integrationResults = await this.runSequentialTests('Integration Tests', tests);
        this.componentResults.set('integration', integrationResults);
    }

    /**
     * Run performance tests
     */
    async runPerformanceTests() {
        console.log('⚡ Running performance tests...');

        const tests = [
            // Test 1: Concurrent workflow creation
            async () => {
                const startTime = Date.now();
                const concurrentWorkflows = [];

                for (let i = 0; i < 10; i++) {
                    concurrentWorkflows.push(
                        this.workflowManager.createWorkflowSession({
                            name: `Performance Test Workflow ${i}`,
                            type: 'performance_test'
                        })
                    );
                }

                const results = await Promise.all(concurrentWorkflows);
                const endTime = Date.now();

                this.assertTrue(results.every(r => r.success), 'All concurrent workflows should succeed');

                const duration = endTime - startTime;
                console.log(`    📊 Created 10 workflows in ${duration}ms (${duration/10}ms avg)`);

                return results.length;
            },

            // Test 2: Rule evaluation performance
            async () => {
                const ruleId = (await this.conditionalEngine.createRule({
                    name: 'Performance Test Rule',
                    conditionExpression: 'test.value > 5 && test.status == "active"',
                    actionType: 'notify_team',
                    actionConfig: { message: 'test' }
                })).ruleId;

                const startTime = Date.now();
                const evaluations = [];

                for (let i = 0; i < 100; i++) {
                    evaluations.push(
                        this.conditionalEngine.evaluateRule(ruleId, {
                            test: { value: Math.random() * 10, status: 'active' }
                        })
                    );
                }

                const results = await Promise.all(evaluations);
                const endTime = Date.now();

                this.assertTrue(results.every(r => r.success), 'All evaluations should succeed');

                const duration = endTime - startTime;
                console.log(`    📊 Evaluated rule 100 times in ${duration}ms (${duration/100}ms avg)`);

                return results.length;
            }
        ];

        const performanceResults = await this.runSequentialTests('Performance Tests', tests);
        this.componentResults.set('performance', performanceResults);
    }

    /**
     * Run sequential tests and collect results
     */
    async runSequentialTests(suiteName, tests) {
        const results = { passed: 0, failed: 0, errors: [] };
        let lastResult = undefined;

        for (let i = 0; i < tests.length; i++) {
            try {
                const testResult = await tests[i](lastResult);
                lastResult = testResult;
                results.passed++;
                console.log(`    ✅ Test ${i + 1}: Passed`);
            } catch (error) {
                results.failed++;
                results.errors.push(`Test ${i + 1}: ${error.message}`);
                console.log(`    ❌ Test ${i + 1}: ${error.message}`);
            }
        }

        return results;
    }

    /**
     * Generate comprehensive test report
     */
    async generateTestReport() {
        const totalTime = Date.now() - this.startTime;
        console.log('');
        console.log('📊 WINDOW 1 MULTI-WORKFLOW STATE MANAGEMENT TEST REPORT');
        console.log('='.repeat(60));

        let totalPassed = 0;
        let totalFailed = 0;

        for (const [componentName, results] of this.componentResults) {
            console.log(`\n${componentName.toUpperCase()}:`);
            console.log(`  ✅ Passed: ${results.passed}`);
            console.log(`  ❌ Failed: ${results.failed}`);

            if (results.errors.length > 0) {
                console.log('  Errors:');
                results.errors.forEach(error => console.log(`    - ${error}`));
            }

            totalPassed += results.passed;
            totalFailed += results.failed;
        }

        console.log('\n' + '='.repeat(60));
        console.log(`OVERALL RESULTS:`);
        console.log(`  ✅ Total Passed: ${totalPassed}`);
        console.log(`  ❌ Total Failed: ${totalFailed}`);
        console.log(`  📊 Success Rate: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);
        console.log(`  ⏱️  Total Time: ${Math.round(totalTime / 1000)}s`);

        // Component health checks
        console.log('\nCOMPONENT HEALTH CHECKS:');
        const healthChecks = [
            { name: 'Multi-Workflow State Manager', service: this.workflowManager },
            { name: 'Claude State Bridge', service: this.claudeBridge },
            { name: 'Conditional Workflow Engine', service: this.conditionalEngine },
            { name: 'Enhanced Approval Gates', service: this.approvalGates }
        ];

        for (const { name, service } of healthChecks) {
            const health = service.getServiceHealth();
            console.log(`  🏥 ${name}: ${health.status} (uptime: ${Math.round(health.uptime)}s)`);
        }

        const successRate = Math.round((totalPassed / (totalPassed + totalFailed)) * 100);

        if (successRate >= 95) {
            console.log('\n🎉 WINDOW 1 IMPLEMENTATION VALIDATION: EXCELLENT');
            console.log('✅ Multi-workflow state persistence is fully operational');
        } else if (successRate >= 80) {
            console.log('\n⚠️  WINDOW 1 IMPLEMENTATION VALIDATION: GOOD');
            console.log('🔧 Some issues detected, review failed tests');
        } else {
            console.log('\n❌ WINDOW 1 IMPLEMENTATION VALIDATION: NEEDS WORK');
            console.log('🚨 Significant issues detected, major fixes required');
        }

        console.log('\n🚀 Window 1: Multi-Workflow State Management implementation testing complete!');
        return { totalPassed, totalFailed, successRate };
    }

    // Test assertion helpers
    assertTrue(condition, message) {
        if (!condition) throw new Error(message || 'Assertion failed: expected true');
    }

    assertFalse(condition, message) {
        if (condition) throw new Error(message || 'Assertion failed: expected false');
    }

    assertEquals(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Assertion failed: expected ${expected}, got ${actual}`);
        }
    }
}

// Run the test suite
if (require.main === module) {
    const testSuite = new Window1TestSuite();
    testSuite.runAllTests().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = { Window1TestSuite };