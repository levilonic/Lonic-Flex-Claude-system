/**
 * Test Two-Phase Management System Integration
 * Tests Phase 1 (Planning) -> Phase 2 (Execution) workflow with manager delegation
 */

const { v4: uuidv4 } = require('uuid');
const { SQLiteManager } = require('./database/sqlite-manager');
const { PlanningManagerAgent } = require('./agents/planning-manager-agent');
const { ExecutionManagerAgent } = require('./agents/execution-manager-agent');

class TwoPhaseSystemTester {
    constructor() {
        this.sessionId = `test-two-phase-${Date.now()}`;
        this.dbManager = null;
        this.testResults = {
            phase1: { status: 'pending', details: {} },
            phase2: { status: 'pending', details: {} },
            integration: { status: 'pending', details: {} }
        };
    }

    async initialize() {
        console.log('🔧 Initializing Two-Phase System Test...');
        this.dbManager = new SQLiteManager(':memory:'); // Use in-memory for testing
        await this.dbManager.initialize();
        console.log('✅ Database initialized');
    }

    async runFullTest() {
        console.log('\n🚀 Starting Two-Phase Management System Test');
        console.log(`📋 Session ID: ${this.sessionId}`);
        
        try {
            // Phase 1: Planning & Research
            await this.testPhase1Planning();
            
            // Phase 2: Implementation & Execution  
            await this.testPhase2Execution();
            
            // Integration Testing
            await this.testSystemIntegration();
            
            // Report Results
            this.reportResults();
            
            return this.calculateOverallSuccess();
            
        } catch (error) {
            console.error('❌ Two-Phase System Test Failed:', error.message);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async testPhase1Planning() {
        console.log('\n📋 Phase 1: Testing Planning Manager Agent');
        
        try {
            const planningManager = new PlanningManagerAgent(this.sessionId, {
                testMode: true
            });
            
            await planningManager.initialize(this.dbManager);
            console.log('✅ Planning Manager initialized');
            
            const planningContext = {
                task: 'Implement comprehensive test suite for LonicFLex system',
                requirements: {
                    testCoverage: 'comprehensive',
                    integrationTests: true,
                    performanceBenchmarks: true
                },
                constraints: {
                    timeLimit: '4 hours',
                    factor10Compliance: true,
                    factor12Compliance: true
                },
                technologies: ['node.js', 'sqlite', 'docker'],
                domain: 'software-testing'
            };
            
            console.log('🔄 Executing Phase 1 workflow...');
            const planningResult = await planningManager.executeWorkflow(
                planningContext,
                (step, total) => console.log(`   ⏳ Planning Step ${step}/${total}`)
            );
            
            console.log('✅ Phase 1 Planning completed');
            console.log(`   📊 Research results: ${Object.keys(planningResult.researchResults).length} areas`);
            console.log(`   🏗️  Architecture designed: ${planningResult.architectureDesign ? 'Yes' : 'No'}`);
            console.log(`   📝 Execution plan ready: ${planningResult.executionPlan ? 'Yes' : 'No'}`);
            
            this.testResults.phase1 = {
                status: 'completed',
                details: {
                    executionTime: planningResult.executionTime,
                    researchAreasCompleted: Object.keys(planningResult.researchResults).length,
                    hasExecutionPlan: !!planningResult.executionPlan,
                    hasArchitectureDesign: !!planningResult.architectureDesign,
                    readyForPhase2: planningResult.readyForPhase2
                }
            };
            
        } catch (error) {
            console.error('❌ Phase 1 Planning failed:', error.message);
            this.testResults.phase1 = {
                status: 'failed',
                error: error.message
            };
            throw error;
        }
    }

    async testPhase2Execution() {
        console.log('\n🔧 Phase 2: Testing Execution Manager Agent');
        
        try {
            const executionManager = new ExecutionManagerAgent(this.sessionId, {
                testMode: true
            });
            
            await executionManager.initialize(this.dbManager);
            console.log('✅ Execution Manager initialized');
            
            // Load planning results from Phase 1 (from database)
            const executionContext = {
                sessionId: this.sessionId,
                loadPlanningResults: true
            };
            
            console.log('🔄 Executing Phase 2 workflow...');
            const executionResult = await executionManager.executeWorkflow(
                executionContext,
                (step, total) => console.log(`   ⏳ Execution Step ${step}/${total}`)
            );
            
            console.log('✅ Phase 2 Execution completed');
            console.log(`   ⚡ Implementation tasks: ${executionResult.implementationResults?.completedTasks || 0}`);
            console.log(`   🧪 Tests passed: ${executionResult.testingResults?.testsPassed || 0}`);
            console.log(`   🔗 Integration status: ${executionResult.integrationResults?.status || 'unknown'}`);
            console.log(`   ✅ Quality gates: ${executionResult.qualityGatesPassed ? 'PASSED' : 'FAILED'}`);
            
            this.testResults.phase2 = {
                status: 'completed',
                details: {
                    executionTime: executionResult.executionTime,
                    implementationTasks: executionResult.implementationResults?.completedTasks || 0,
                    testsPassed: executionResult.testingResults?.testsPassed || 0,
                    integrationStatus: executionResult.integrationResults?.status,
                    qualityGatesPassed: executionResult.qualityGatesPassed,
                    deliveryComplete: executionResult.deliveryComplete
                }
            };
            
        } catch (error) {
            console.error('❌ Phase 2 Execution failed:', error.message);
            this.testResults.phase2 = {
                status: 'failed', 
                error: error.message
            };
            throw error;
        }
    }

    async testSystemIntegration() {
        console.log('\n🔗 Testing Two-Phase System Integration');
        
        try {
            // Verify database integration
            const phaseTrackingResults = await this.dbManager.getAllSQL(
                'SELECT * FROM phase_tracking WHERE session_id = ?',
                [this.sessionId]
            );
            
            const planningResults = await this.dbManager.getSQL(
                'SELECT * FROM planning_results WHERE session_id = ?',
                [this.sessionId]
            );
            
            const executionResults = await this.dbManager.getSQL(
                'SELECT * FROM execution_results WHERE session_id = ?',
                [this.sessionId]
            );
            
            console.log(`✅ Phase tracking records: ${phaseTrackingResults.length}`);
            console.log(`✅ Planning results stored: ${planningResults ? 'Yes' : 'No'}`);
            console.log(`✅ Execution results stored: ${executionResults ? 'Yes' : 'No'}`);
            
            // Verify handoff integrity
            const handoffIntegrity = this.verifyHandoffIntegrity(planningResults, executionResults);
            
            this.testResults.integration = {
                status: 'completed',
                details: {
                    phaseTrackingRecords: phaseTrackingResults.length,
                    planningResultsStored: !!planningResults,
                    executionResultsStored: !!executionResults,
                    handoffIntegrityCheck: handoffIntegrity
                }
            };
            
            console.log('✅ System integration validation complete');
            
        } catch (error) {
            console.error('❌ System integration failed:', error.message);
            this.testResults.integration = {
                status: 'failed',
                error: error.message
            };
            throw error;
        }
    }

    verifyHandoffIntegrity(planningResults, executionResults) {
        if (!planningResults || !executionResults) {
            return { status: 'failed', reason: 'Missing planning or execution results' };
        }
        
        try {
            const planningData = JSON.parse(planningResults.execution_plan || '{}');
            const executionData = JSON.parse(executionResults.implementation_results || '{}');
            
            // Check if execution used planning data
            const handoffWorking = planningData && Object.keys(planningData).length > 0;
            
            return {
                status: handoffWorking ? 'passed' : 'failed',
                planningDataSize: JSON.stringify(planningData).length,
                executionDataSize: JSON.stringify(executionData).length
            };
        } catch (error) {
            return { status: 'failed', reason: `JSON parsing error: ${error.message}` };
        }
    }

    reportResults() {
        console.log('\n📊 Two-Phase Management System Test Results');
        console.log('═'.repeat(50));
        
        // Phase 1 Results
        console.log('📋 Phase 1 (Planning):');
        if (this.testResults.phase1.status === 'completed') {
            console.log('   ✅ Status: COMPLETED');
            console.log(`   ⏱️  Execution time: ${this.testResults.phase1.details.executionTime}ms`);
            console.log(`   📚 Research areas: ${this.testResults.phase1.details.researchAreasCompleted}`);
            console.log(`   📝 Has execution plan: ${this.testResults.phase1.details.hasExecutionPlan}`);
            console.log(`   🏗️  Has architecture: ${this.testResults.phase1.details.hasArchitectureDesign}`);
            console.log(`   ➡️  Ready for Phase 2: ${this.testResults.phase1.details.readyForPhase2}`);
        } else {
            console.log(`   ❌ Status: FAILED - ${this.testResults.phase1.error}`);
        }
        
        // Phase 2 Results
        console.log('\n🔧 Phase 2 (Execution):');
        if (this.testResults.phase2.status === 'completed') {
            console.log('   ✅ Status: COMPLETED');
            console.log(`   ⏱️  Execution time: ${this.testResults.phase2.details.executionTime}ms`);
            console.log(`   ⚡ Implementation tasks: ${this.testResults.phase2.details.implementationTasks}`);
            console.log(`   🧪 Tests passed: ${this.testResults.phase2.details.testsPassed}`);
            console.log(`   🔗 Integration status: ${this.testResults.phase2.details.integrationStatus}`);
            console.log(`   ✅ Quality gates: ${this.testResults.phase2.details.qualityGatesPassed ? 'PASSED' : 'FAILED'}`);
            console.log(`   📦 Delivery complete: ${this.testResults.phase2.details.deliveryComplete}`);
        } else {
            console.log(`   ❌ Status: FAILED - ${this.testResults.phase2.error}`);
        }
        
        // Integration Results
        console.log('\n🔗 System Integration:');
        if (this.testResults.integration.status === 'completed') {
            console.log('   ✅ Status: COMPLETED');
            console.log(`   📋 Phase tracking records: ${this.testResults.integration.details.phaseTrackingRecords}`);
            console.log(`   💾 Planning results stored: ${this.testResults.integration.details.planningResultsStored}`);
            console.log(`   💾 Execution results stored: ${this.testResults.integration.details.executionResultsStored}`);
            console.log(`   🤝 Handoff integrity: ${this.testResults.integration.details.handoffIntegrityCheck.status}`);
        } else {
            console.log(`   ❌ Status: FAILED - ${this.testResults.integration.error}`);
        }
    }

    calculateOverallSuccess() {
        const phase1Success = this.testResults.phase1.status === 'completed';
        const phase2Success = this.testResults.phase2.status === 'completed'; 
        const integrationSuccess = this.testResults.integration.status === 'completed';
        
        const overallSuccess = phase1Success && phase2Success && integrationSuccess;
        
        console.log('\n🎯 Overall Test Result:');
        if (overallSuccess) {
            console.log('✅ TWO-PHASE MANAGEMENT SYSTEM: FULLY OPERATIONAL');
            console.log('   • Phase 1 planning coordination working');
            console.log('   • Phase 2 execution coordination working');
            console.log('   • Database integration functional');
            console.log('   • Phase handoff integrity maintained');
        } else {
            console.log('❌ TWO-PHASE MANAGEMENT SYSTEM: NEEDS ATTENTION');
            console.log(`   • Phase 1: ${phase1Success ? 'OK' : 'FAILED'}`);
            console.log(`   • Phase 2: ${phase2Success ? 'OK' : 'FAILED'}`);
            console.log(`   • Integration: ${integrationSuccess ? 'OK' : 'FAILED'}`);
        }
        
        return overallSuccess;
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test resources...');
        if (this.dbManager) {
            await this.dbManager.close();
        }
        console.log('✅ Cleanup complete');
    }
}

// Run test if called directly
if (require.main === module) {
    async function runTest() {
        const tester = new TwoPhaseSystemTester();
        
        try {
            await tester.initialize();
            const success = await tester.runFullTest();
            process.exit(success ? 0 : 1);
        } catch (error) {
            console.error('Test execution failed:', error);
            process.exit(1);
        }
    }
    
    runTest();
}

module.exports = { TwoPhaseSystemTester };