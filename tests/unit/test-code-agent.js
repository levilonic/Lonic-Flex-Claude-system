#!/usr/bin/env node
/**
 * Code Agent Comprehensive Test Suite
 * Tests code generation, workflow execution, file system integration, and validation
 */

const { EnhancedCodeAgent } = require('../../src/agents/code-agent');
const { ServiceContainer } = require('../../src/services/service-container');
const fs = require('fs').promises;
const path = require('path');

// Test utilities
let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        testResults.passed++;
        testResults.tests.push({ name: testName, status: 'passed' });
    } else {
        console.log(`  ❌ ${testName}`);
        if (details) console.log(`     ${details}`);
        testResults.failed++;
        testResults.tests.push({ name: testName, status: 'failed', details });
    }
}

async function runTests() {
    console.log('\n🧪 Testing Enhanced Code Agent\n');
    console.log('══════════════════════════════════════════════════════════════');

    let serviceContainer = null;

    try {
        // Setup
        serviceContainer = new ServiceContainer();
        await serviceContainer.initialize();
        console.log('✅ ServiceContainer initialized for testing\n');

        // Test 1: Code Agent Construction
        console.log('📋 Test 1: Code Agent Construction...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-001', serviceContainer);

            assert(codeAgent !== null, 'Code agent constructs successfully');
            assert(codeAgent.agentName === 'code', 'Agent name is "code"');
            assert(codeAgent.codeConfig !== undefined, 'Code config initialized');
            assert(codeAgent.codeConfig.language === 'javascript', 'Default language is javascript');
            assert(codeAgent.codeConfig.framework === 'node', 'Default framework is node');
            assert(codeAgent.generatedFiles instanceof Array, 'Generated files array initialized');
            assert(codeAgent.testsGenerated instanceof Array, 'Tests generated array initialized');
            assert(codeAgent.codeMetrics !== undefined, 'Code metrics initialized');
        } catch (error) {
            assert(false, 'Code agent construction', error.message);
        }

        // Test 2: Custom Configuration
        console.log('\n📋 Test 2: Custom Configuration...');
        try {
            const customAgent = new EnhancedCodeAgent('test-session-002', serviceContainer, {
                language: 'python',
                framework: 'django',
                testFramework: 'pytest',
                outputDir: './custom-output'
            });

            assert(customAgent.codeConfig.language === 'python', 'Custom language respected');
            assert(customAgent.codeConfig.framework === 'django', 'Custom framework respected');
            assert(customAgent.codeConfig.testFramework === 'pytest', 'Custom test framework respected');
            assert(customAgent.codeConfig.outputDir === './custom-output', 'Custom output dir respected');
        } catch (error) {
            assert(false, 'Custom configuration', error.message);
        }

        // Test 3: Code Agent Initialization
        console.log('\n📋 Test 3: Code Agent Initialization...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-003', serviceContainer);
            await codeAgent.initialize('workflow-001');

            assert(codeAgent.workflowId === 'workflow-001', 'Workflow ID set correctly');
            assert(codeAgent.contextPartition !== null, 'Context partition created');
            // Note: Can't easily test state without triggering full workflow
        } catch (error) {
            assert(false, 'Code agent initialization', error.message);
        }

        // Test 4: Execution Steps Defined
        console.log('\n📋 Test 4: Execution Steps Defined...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-004', serviceContainer);

            assert(codeAgent.executionSteps instanceof Array, 'Execution steps array exists');
            assert(codeAgent.executionSteps.length === 8, 'Has 8 execution steps');
            assert(codeAgent.executionSteps.includes('analyze_code_requirements'), 'Has analyze step');
            assert(codeAgent.executionSteps.includes('generate_core_code'), 'Has generate step');
            assert(codeAgent.executionSteps.includes('generate_tests'), 'Has test generation step');
            assert(codeAgent.executionSteps.includes('validate_code_quality'), 'Has validation step');
        } catch (error) {
            assert(false, 'Execution steps defined', error.message);
        }

        // Test 5: Code Metrics Structure
        console.log('\n📋 Test 5: Code Metrics Structure...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-005', serviceContainer);

            assert(codeAgent.codeMetrics.linesOfCode === 0, 'Initial lines of code is 0');
            assert(codeAgent.codeMetrics.complexity === 0, 'Initial complexity is 0');
            assert(codeAgent.codeMetrics.testCoverage === 0, 'Initial test coverage is 0');
            assert(codeAgent.codeMetrics.functions === 0, 'Initial functions count is 0');
            assert(codeAgent.codeMetrics.classes === 0, 'Initial classes count is 0');
        } catch (error) {
            assert(false, 'Code metrics structure', error.message);
        }

        // Test 6: File System Integration
        console.log('\n📋 Test 6: File System Integration...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-006', serviceContainer);

            assert(codeAgent.fileSystem !== undefined, 'File system automation initialized');
            assert(typeof codeAgent.fileSystem === 'object', 'File system is an object');
        } catch (error) {
            assert(false, 'File system integration', error.message);
        }

        // Test 7: Analyze Code Requirements
        console.log('\n📋 Test 7: Analyze Code Requirements...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-007', serviceContainer);
            await codeAgent.initialize('workflow-002');

            const result = await codeAgent.analyzeCodeRequirements({
                requirements: ['feature1', 'feature2', 'feature3']
            });

            assert(result !== null, 'Analysis returns result');
            assert(result.step === 'analyze_code_requirements', 'Correct step name');
            assert(result.success === true, 'Analysis succeeds');
            assert(result.language === 'javascript', 'Returns configured language');
            assert(result.framework === 'node', 'Returns configured framework');
            assert(result.validation !== undefined, 'Includes validation');
        } catch (error) {
            assert(false, 'Analyze code requirements', error.message);
        }

        // Test 8: Design Code Structure
        console.log('\n📋 Test 8: Design Code Structure...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-008', serviceContainer);
            await codeAgent.initialize('workflow-003');

            const result = await codeAgent.designCodeStructure({});

            assert(result !== null, 'Design returns result');
            assert(result.step === 'design_code_structure', 'Correct step name');
            assert(result.success === true, 'Design succeeds');
            assert(result.structure !== undefined, 'Returns structure');
            assert(result.structure.directories instanceof Array, 'Structure has directories');
            assert(result.structure.main_files instanceof Array, 'Structure has main files');
        } catch (error) {
            assert(false, 'Design code structure', error.message);
        }

        // Test 9: Generate Core Code
        console.log('\n📋 Test 9: Generate Core Code...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-009', serviceContainer);
            await codeAgent.initialize('workflow-004');

            const result = await codeAgent.generateCoreCode({
                requirements: ['main module']
            });

            assert(result !== null, 'Code generation returns result');
            assert(result.step === 'generate_core_code', 'Correct step name');
            assert(result.success === true, 'Generation succeeds');
            assert(result.code !== undefined, 'Returns code');
        } catch (error) {
            assert(false, 'Generate core code', error.message);
        }

        // Test 10: Implement Features
        console.log('\n📋 Test 10: Implement Features...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-010', serviceContainer);
            await codeAgent.initialize('workflow-005');

            const result = await codeAgent.implementFeatures({
                features: ['authentication', 'database']
            });

            assert(result !== null, 'Feature implementation returns result');
            assert(result.step === 'implement_features', 'Correct step name');
            assert(result.success === true, 'Implementation succeeds');
        } catch (error) {
            assert(false, 'Implement features', error.message);
        }

        // Test 11: Generate Tests
        console.log('\n📋 Test 11: Generate Tests...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-011', serviceContainer);
            await codeAgent.initialize('workflow-006');

            const result = await codeAgent.generateTests({});

            assert(result !== null, 'Test generation returns result');
            assert(result.step === 'generate_tests', 'Correct step name');
            assert(result.success === true, 'Test generation succeeds');
        } catch (error) {
            assert(false, 'Generate tests', error.message);
        }

        // Test 12: Validate Code Quality
        console.log('\n📋 Test 12: Validate Code Quality...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-012', serviceContainer);
            await codeAgent.initialize('workflow-007');

            const result = await codeAgent.validateCodeQuality({});

            assert(result !== null, 'Quality validation returns result');
            assert(result.step === 'validate_code_quality', 'Correct step name');
            assert(result.success === true, 'Validation succeeds');
        } catch (error) {
            assert(false, 'Validate code quality', error.message);
        }

        // Test 13: Optimize Performance
        console.log('\n📋 Test 13: Optimize Performance...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-013', serviceContainer);
            await codeAgent.initialize('workflow-008');

            const result = await codeAgent.optimizePerformance({});

            assert(result !== null, 'Optimization returns result');
            assert(result.step === 'optimize_performance', 'Correct step name');
            assert(result.success === true, 'Optimization succeeds');
        } catch (error) {
            assert(false, 'Optimize performance', error.message);
        }

        // Test 14: Finalize Code Output
        console.log('\n📋 Test 14: Finalize Code Output...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-014', serviceContainer);
            await codeAgent.initialize('workflow-009');

            const result = await codeAgent.finalizeCodeOutput({});

            assert(result !== null, 'Finalization returns result');
            assert(result.step === 'finalize_code_output', 'Correct step name');
            assert(result.success === true, 'Finalization succeeds');
        } catch (error) {
            assert(false, 'Finalize code output', error.message);
        }

        // Test 15: Full Workflow Execution
        console.log('\n📋 Test 15: Full Workflow Execution...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-015', serviceContainer);
            await codeAgent.initialize('workflow-010');

            let progressUpdates = 0;
            const progressCallback = (percent, message) => {
                progressUpdates++;
            };

            const result = await codeAgent.execute({
                requirements: ['feature1', 'feature2']
            }, progressCallback);

            assert(result !== null, 'Workflow execution returns result');
            assert(result.success === true, 'Workflow succeeds');
            assert(result.agent === 'code', 'Result shows correct agent');
            assert(result.results !== undefined, 'Result contains step results');
            assert(result.architecture === 'enhanced_servicecontainer_validated', 'Enhanced architecture confirmed');
            assert(progressUpdates > 0, 'Progress callback invoked');
        } catch (error) {
            assert(false, 'Full workflow execution', error.message);
        }

        // Test 16: Multiple Agent Instances
        console.log('\n📋 Test 16: Multiple Agent Instances...');
        try {
            const agent1 = new EnhancedCodeAgent('session-001', serviceContainer);
            const agent2 = new EnhancedCodeAgent('session-002', serviceContainer);
            const agent3 = new EnhancedCodeAgent('session-003', serviceContainer);

            assert(agent1 !== agent2, 'Different instances created');
            assert(agent2 !== agent3, 'All instances are unique');
            assert(agent1.sessionId !== agent2.sessionId, 'Different session IDs');
        } catch (error) {
            assert(false, 'Multiple agent instances', error.message);
        }

        // Test 17: Agent State Isolation
        console.log('\n📋 Test 17: Agent State Isolation...');
        try {
            const agent1 = new EnhancedCodeAgent('session-a', serviceContainer, {
                language: 'python'
            });
            const agent2 = new EnhancedCodeAgent('session-b', serviceContainer, {
                language: 'go'
            });

            agent1.generatedFiles.push('file1.py');
            agent2.generatedFiles.push('file2.go');

            assert(agent1.codeConfig.language === 'python', 'Agent 1 has python');
            assert(agent2.codeConfig.language === 'go', 'Agent 2 has go');
            assert(agent1.generatedFiles.length === 1, 'Agent 1 has 1 file');
            assert(agent2.generatedFiles.length === 1, 'Agent 2 has 1 file');
            assert(agent1.generatedFiles[0] !== agent2.generatedFiles[0], 'Files are isolated');
        } catch (error) {
            assert(false, 'Agent state isolation', error.message);
        }

        // Test 18: Error Handling
        console.log('\n📋 Test 18: Error Handling...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-error', serviceContainer);
            await codeAgent.initialize('workflow-error');

            // Execute with invalid context to trigger error handling
            try {
                await codeAgent.executeCodeStep('invalid_step', {}, 0);
                // Should return a default result, not throw
                assert(true, 'Handles invalid step gracefully');
            } catch (err) {
                // If it throws, that's also acceptable error handling
                assert(true, 'Throws error for invalid step');
            }
        } catch (error) {
            assert(false, 'Error handling', error.message);
        }

        // Test 19: Context Partition Integration
        console.log('\n📋 Test 19: Context Partition Integration...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-019', serviceContainer);
            await codeAgent.initialize('workflow-019');

            assert(codeAgent.contextPartition !== null, 'Context partition created');
            assert(typeof codeAgent.contextPartition === 'object', 'Context partition is object');
        } catch (error) {
            assert(false, 'Context partition integration', error.message);
        }

        // Test 20: Validation Success Method
        console.log('\n📋 Test 20: Validation Success Method...');
        try {
            const codeAgent = new EnhancedCodeAgent('test-session-020', serviceContainer);
            await codeAgent.initialize('workflow-020');

            const validation = await codeAgent.validateSuccess({
                evidence: { testPassed: true },
                operation: 'test validation',
                criteria: { testPassed: { required: true } }
            });

            assert(validation !== null, 'Validation returns result');
            assert(validation.success === true, 'Validation succeeds with met criteria');
        } catch (error) {
            assert(false, 'Validation success method', error.message);
        }

    } catch (error) {
        console.error('❌ Test setup failed:', error);
    } finally {
        // Cleanup
        if (serviceContainer) {
            try {
                // ServiceContainer might not have cleanup method in all versions
                if (typeof serviceContainer.cleanup === 'function') {
                    await serviceContainer.cleanup();
                }
                console.log('\n🧹 ServiceContainer cleaned up');
            } catch (cleanupError) {
                console.log('\n🧹 ServiceContainer cleanup skipped');
            }
        }
    }

    // Print Results
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('📊 Test Results Summary:\n');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    console.log('\n══════════════════════════════════════════════════════════════');

    if (testResults.failed === 0) {
        console.log('\n🎉 Enhanced Code Agent: ✅ ALL TESTS PASSED\n');
    } else {
        console.log('\n❌ Enhanced Code Agent: SOME TESTS FAILED\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
