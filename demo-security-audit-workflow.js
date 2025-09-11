#!/usr/bin/env node
/**
 * Security Audit Workflow Demo
 * Demonstrates the new Workflow Engine integrated with Universal Context System
 * Executes comprehensive security and efficiency audit using structured phases
 */

const { WorkflowEnhancedContextCommands } = require('./context-management/workflow-enhanced-context-commands');
const { MemoryManager } = require('./memory/memory-manager');

class SecurityAuditDemo {
    constructor() {
        this.workflowCommands = new WorkflowEnhancedContextCommands({
            enableWorkflows: true,
            workflowTemplatesDir: './workflows',
            autoAgentSwitching: true,
            workflowLearning: true
        });
        
        this.memory = new MemoryManager();
    }

    async initialize() {
        console.log('🔧 Initializing Security Audit Workflow Demo...\n');
        
        try {
            // Initialize memory system
            await this.memory.initialize();
            console.log('🧠 Memory system initialized\n');
            
            return true;
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            return false;
        }
    }

    async runSecurityAuditWorkflow() {
        console.log('🎯 Starting Comprehensive Security & Efficiency Audit\n');
        console.log('=' .repeat(80));
        console.log('🔒 LONICFLEX SECURITY & EFFICIENCY AUDIT');
        console.log('📋 Using Structured Workflow Engine with Phase Management');
        console.log('=' .repeat(80));
        
        try {
            // Start workflow-enabled context session
            const result = await this.workflowCommands.startWorkflowContext(
                'security-audit-comprehensive',
                'security-audit',
                {
                    goal: 'Complete security and efficiency audit with zero critical vulnerabilities',
                    session: true, // Session scope for focused audit work
                    description: 'Comprehensive security scan with performance analysis and remediation recommendations',
                    complexity: 'high',
                    duration: '60min'
                }
            );
            
            console.log('\n✅ Security Audit Workflow Session Initialized!');
            console.log(`🆔 Context ID: ${result.contextId}`);
            console.log(`📋 Workflow Template: ${result.workflowTemplate}`);
            console.log(`🎯 Current Phase: ${result.currentPhase}`);
            console.log(`📊 Total Phases: ${result.totalPhases}`);
            
            return result;
            
        } catch (error) {
            console.error('❌ Failed to start security audit workflow:', error);
            throw error;
        }
    }

    async demonstrateWorkflowStatus() {
        console.log('\n📊 Checking Workflow Status...\n');
        
        try {
            const status = await this.workflowCommands.statusContext();
            
            console.log('✅ Workflow status retrieved successfully');
            
            if (status.workflows && status.workflows.length > 0) {
                console.log(`\n🔧 Active Workflows: ${status.workflows.length}`);
                for (const workflow of status.workflows) {
                    const ws = workflow.status;
                    console.log(`\n   Context: ${workflow.contextId}`);
                    console.log(`   Template: ${ws.template}`);
                    console.log(`   Phase: ${ws.currentPhase} (${ws.currentPhaseIndex + 1}/${ws.totalPhases})`);
                    console.log(`   Progress: ${ws.progress}%`);
                    console.log(`   Duration: ${Math.round(ws.duration / 1000)}s`);
                }
            }
            
            return status;
            
        } catch (error) {
            console.error('❌ Failed to get workflow status:', error);
            throw error;
        }
    }

    async recordInitializationLesson() {
        console.log('\n🧠 Recording Workflow Initialization Lesson...');
        
        try {
            await this.memory.recordLesson(
                'workflow_system_initialization',
                'Security Audit Workflow',
                'Successfully integrated Workflow Engine with Universal Context System for structured security audits',
                'Use workflow-enhanced context commands for complex multi-phase tasks requiring structured execution',
                'node demo-security-audit-workflow.js && check workflow status in context'
            );
            
            console.log('✅ Workflow initialization lesson recorded');
            
        } catch (error) {
            console.error('⚠️ Failed to record lesson:', error.message);
        }
    }

    async displayNextSteps() {
        console.log('\n' + '=' .repeat(80));
        console.log('🎯 NEXT STEPS - SECURITY AUDIT EXECUTION');
        console.log('=' .repeat(80));
        
        console.log('\n📋 Phase 1: Intelligence Planning');
        console.log('   🎯 Current Status: READY TO EXECUTE');
        console.log('   📝 Tasks Required:');
        console.log('      • Complete codebase architecture analysis');
        console.log('      • Perform security risk assessment');
        console.log('      • Configure and verify audit tools');
        console.log('   🚪 Quality Gates:');
        console.log('      • Planning completeness verification');
        console.log('      • Audit scope clarity confirmation');
        
        console.log('\n🤖 AGENT COORDINATION:');
        console.log('   Current: Code Reviewer Agent (correct for security audit)');
        console.log('   Phase 1 Requires: Code Reviewer Agent ✅');
        console.log('   Auto-switching: ENABLED for other phases');
        
        console.log('\n⚡ EXECUTION COMMANDS:');
        console.log('   Task Completion: /task-complete <task-id> --evidence="..." --agent="Code Reviewer Agent"');
        console.log('   Quality Gate: /quality-gate <gate-id> passed|failed --data="..."');
        console.log('   Status Check: /status');
        
        console.log('\n🔧 MANUAL EXECUTION:');
        console.log('   1. Execute codebase analysis commands');
        console.log('   2. Run security risk assessment');
        console.log('   3. Verify audit tools functionality');
        console.log('   4. Mark tasks complete with evidence');
        console.log('   5. Evaluate quality gates');
        console.log('   6. Proceed to next phase');
        
        console.log('\n📊 SUCCESS CRITERIA:');
        console.log('   • Zero critical security vulnerabilities');
        console.log('   • All audit tools verified working');
        console.log('   • Comprehensive risk assessment completed');
        console.log('   • Performance benchmarks established');
        console.log('   • Actionable remediation recommendations provided');
        
        console.log('\n' + '=' .repeat(80));
    }

    async run() {
        console.log('🚀 LonicFLex Security Audit Workflow Demo\n');
        
        // Initialize system
        const initialized = await this.initialize();
        if (!initialized) {
            console.error('❌ Demo initialization failed');
            process.exit(1);
        }
        
        try {
            // Run the workflow demonstration
            const workflowResult = await this.runSecurityAuditWorkflow();
            
            // Check status
            const statusResult = await this.demonstrateWorkflowStatus();
            
            // Record lesson
            await this.recordInitializationLesson();
            
            // Display next steps
            await this.displayNextSteps();
            
            console.log('\n🎉 Security Audit Workflow Demo Complete!');
            console.log('✅ Workflow Engine successfully integrated with Universal Context System');
            console.log('🔒 Security audit session ready for Phase 1 execution');
            
            return {
                success: true,
                workflowResult,
                statusResult
            };
            
        } catch (error) {
            console.error('\n❌ Demo failed:', error.message);
            console.error('Stack:', error.stack);
            
            // Record failure lesson
            try {
                await this.memory.recordLesson(
                    'workflow_system_error',
                    'Security Audit Workflow',
                    `Workflow demo failed: ${error.message}`,
                    'Debug workflow engine integration issues before proceeding with security audit',
                    'node demo-security-audit-workflow.js && check error logs'
                );
            } catch (recordError) {
                console.error('⚠️ Failed to record error lesson:', recordError.message);
            }
            
            process.exit(1);
        }
    }
}

// Run demo if called directly
if (require.main === module) {
    const demo = new SecurityAuditDemo();
    demo.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { SecurityAuditDemo };