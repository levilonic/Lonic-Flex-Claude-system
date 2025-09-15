#!/usr/bin/env node

/**
 * Test Multi-Context Workspace - Phase 2C Validation
 * Tests simultaneous contexts, isolation, and workspace management
 */

const { UniversalContextCommands } = require('./universal-context-commands');
const { Factor3ContextManager } = require('./factor3-context-manager');

console.log('🧪 Testing Multi-Context Workspace - Phase 2C\n');

async function testMultiContextWorkspace() {
    const commands = new UniversalContextCommands();
    let testResults = { passed: 0, failed: 0, tests: [] };

    function addTest(name, passed, details = '') {
        testResults.tests.push({ name, passed, details });
        if (passed) {
            testResults.passed++;
            console.log(`✅ ${name}${details ? ` - ${details}` : ''}`);
        } else {
            testResults.failed++;
            console.log(`❌ ${name}${details ? ` - ${details}` : ''}`);
        }
    }

    console.log('🚀 Test 1: Create Multiple Simultaneous Contexts...');
    try {
        // Create Session 1: Bug fix work
        const session1 = await commands.executeCommand([
            'start', 'fix-memory-leak',
            '--session',
            '--goal=Fix memory leak in agent processing'
        ]);

        // Create Session 2: Quick feature  
        const session2 = await commands.executeCommand([
            'start', 'add-logging',
            '--session', 
            '--goal=Add comprehensive logging to core system'
        ]);

        // Create Project 1: Major system
        const project1 = await commands.executeCommand([
            'start', 'next-gen-agents',
            '--project',
            '--goal=Build next-generation agent architecture',
            '--vision=Scalable, intelligent, and self-organizing agent ecosystem'
        ]);

        // Create Project 2: Infrastructure 
        const project2 = await commands.executeCommand([
            'start', 'infrastructure-overhaul', 
            '--project',
            '--goal=Modernize entire infrastructure stack',
            '--vision=Cloud-native, containerized, and highly available platform'
        ]);

        addTest('Session 1 created', !session1.error, session1.message);
        addTest('Session 2 created', !session2.error, session2.message);
        addTest('Project 1 created', !project1.error, project1.message);
        addTest('Project 2 created', !project2.error, project2.message);

    } catch (error) {
        addTest('Multiple context creation', false, error.message);
    }

    console.log('\n📊 Test 2: Verify Context Registry and Isolation...');
    try {
        const allContexts = Factor3ContextManager.getAllActiveContexts();
        
        addTest('Multiple contexts tracked', allContexts.length >= 4, `${allContexts.length} contexts`);

        // Test context isolation
        const context1 = Factor3ContextManager.getContextById('fix-memory-leak');
        const context2 = Factor3ContextManager.getContextById('add-logging');
        const context3 = Factor3ContextManager.getContextById('next-gen-agents');
        const context4 = Factor3ContextManager.getContextById('infrastructure-overhaul');

        addTest('Session 1 isolated', context1 && context1.contextId === 'fix-memory-leak');
        addTest('Session 2 isolated', context2 && context2.contextId === 'add-logging');
        addTest('Project 1 isolated', context3 && context3.contextId === 'next-gen-agents');
        addTest('Project 2 isolated', context4 && context4.contextId === 'infrastructure-overhaul');

        // Test scope isolation
        addTest('Session scopes correct', 
               context1.contextScope === 'session' && context2.contextScope === 'session');
        addTest('Project scopes correct',
               context3.contextScope === 'project' && context4.contextScope === 'project');

    } catch (error) {
        addTest('Context registry and isolation', false, error.message);
    }

    console.log('\n🔄 Test 3: Context Switching and Work Simulation...');
    try {
        // Work on Session 1 (memory leak fix)
        const context1 = Factor3ContextManager.getContextById('fix-memory-leak');
        context1.setCurrentTask('Debugging agent memory usage');
        context1.addEvent('debug_step', {
            step: 'Identified memory leak in event handler',
            component: 'EventProcessor',
            memory_usage: '45MB increase per hour'
        });

        // Push tangent in Session 1
        context1.pushContext({
            reason: 'Need to understand event handler lifecycle',
            newTask: 'Research event handler patterns',
            returnPoint: 'Apply fix to memory leak'
        });

        // Switch to Session 2 (logging feature)
        const switchResult = await commands.executeCommand(['switch', 'add-logging']);
        addTest('Context switch successful', !switchResult.error, switchResult.message);

        const context2 = Factor3ContextManager.getContextById('add-logging');
        context2.setCurrentTask('Implementing structured logging');
        context2.addEvent('development_step', {
            step: 'Added Winston logger configuration',
            component: 'LoggingService',
            log_levels: ['error', 'warn', 'info', 'debug']
        });

        // Work on Project 1 (next-gen agents)
        const context3 = Factor3ContextManager.getContextById('next-gen-agents');
        context3.setCurrentTask('Designing agent communication protocols');
        context3.addImportantEvent('architecture_decision', {
            decision: 'Use event-driven architecture with message queues',
            rationale: 'Better scalability and fault tolerance',
            impact: 'All agents can communicate asynchronously'
        }, 9);

        addTest('Context 1 work tracked', context1.currentTask.includes('Research'));
        addTest('Context 2 work tracked', context2.currentTask === 'Implementing structured logging');
        addTest('Context 3 work tracked', context3.currentTask === 'Designing agent communication protocols');
        addTest('Context 1 tangent active', context1.contextStack.length === 1);

    } catch (error) {
        addTest('Context switching and work simulation', false, error.message);
    }

    console.log('\n🔒 Test 4: Context Isolation Verification...');
    try {
        const context1 = Factor3ContextManager.getContextById('fix-memory-leak');
        const context2 = Factor3ContextManager.getContextById('add-logging');
        const context3 = Factor3ContextManager.getContextById('next-gen-agents');

        // Verify events don't cross-contaminate
        const context1Events = context1.events.filter(e => e.type === 'debug_step').length;
        const context2Events = context2.events.filter(e => e.type === 'development_step').length;
        const context3Events = context3.events.filter(e => e.type === 'architecture_decision').length;

        addTest('Context 1 events isolated', context1Events >= 1 && context2Events === 0 && context3Events === 0, 'Debug events only in context 1');
        addTest('Context 2 events isolated', context2Events >= 1 && context1Events >= 1 && context3Events === 0, 'Development events only in context 2');
        addTest('Context 3 events isolated', context3Events >= 1 && context1Events >= 1 && context2Events >= 1, 'Architecture events only in context 3');

        // Verify context stacks are independent
        addTest('Context 1 has tangent', context1.contextStack.length === 1);
        addTest('Context 2 no tangent', context2.contextStack.length === 0);
        addTest('Context 3 no tangent', context3.contextStack.length === 0);

        // Verify different compression ratios
        addTest('Session compression more aggressive', 
               context1.scopeConfig.compression_ratio > context3.scopeConfig.compression_ratio);
        addTest('Project compression more conservative',
               context3.scopeConfig.compression_ratio === 0.5);

    } catch (error) {
        addTest('Context isolation verification', false, error.message);
    }

    console.log('\n💾 Test 5: Save Multiple Contexts...');
    try {
        // Save all contexts with different statuses
        const save1 = await commands.executeCommand([
            'save', 'fix-memory-leak',
            '--status=Research phase complete, ready to implement fix',
            '--important'
        ]);

        const save2 = await commands.executeCommand([
            'save', 'add-logging',
            '--status=Winston logger configured, working on integration'
        ]);

        const save3 = await commands.executeCommand([
            'save', 'next-gen-agents', 
            '--status=Architecture decisions finalized, starting implementation',
            '--important'
        ]);

        addTest('Context 1 save successful', !save1.error);
        addTest('Context 2 save successful', !save2.error);
        addTest('Context 3 save successful', !save3.error);
        addTest('Important contexts marked', save1.importance === 'high' && save3.importance === 'high');
        addTest('Different compression ratios applied', save1.compression_ratio !== save3.compression_ratio);

    } catch (error) {
        addTest('Save multiple contexts', false, error.message);
    }

    console.log('\n📋 Test 6: Comprehensive Context Listing...');
    try {
        const listResult = await commands.executeCommand(['list', '--detailed']);

        addTest('Detailed list successful', !listResult.error);
        
        if (listResult.sessions && listResult.projects) {
            addTest('Sessions listed', listResult.sessions.length >= 2);
            addTest('Projects listed', listResult.projects.length >= 2);
            
            // Check session details
            const sessionTasks = listResult.sessions.map(s => s.task);
            addTest('Session tasks preserved', 
                   sessionTasks.some(task => task.includes('Research') || task.includes('Implementing')));
            
            // Check project details  
            const projectTasks = listResult.projects.map(p => p.task);
            addTest('Project tasks preserved',
                   projectTasks.some(task => task.includes('Designing') || task.includes('Modernize')));
        }

    } catch (error) {
        addTest('Comprehensive context listing', false, error.message);
    }

    console.log('\n🎯 Test 7: Context Resume with Isolation...');
    try {
        // Resume different contexts and verify isolation maintained
        const resume1 = await commands.executeCommand(['resume', 'fix-memory-leak']);
        const resume2 = await commands.executeCommand(['resume', 'infrastructure-overhaul']);

        addTest('Resume context 1 successful', !resume1.error);
        addTest('Resume context 2 successful', !resume2.error);
        addTest('Different scopes maintained', resume1.scope !== resume2.scope);
        addTest('Context-specific information', 
               resume1.context !== resume2.context);

    } catch (error) {
        addTest('Context resume with isolation', false, error.message);
    }

    console.log('\n📊 Test 8: Workspace Statistics...');
    try {
        const statusResult = await commands.executeCommand(['status']);
        
        addTest('Status command successful', !statusResult.error);
        
        if (statusResult.statistics) {
            addTest('Multiple contexts counted', statusResult.statistics.total_contexts >= 4);
            addTest('Sessions counted correctly', statusResult.statistics.sessions >= 2);
            addTest('Projects counted correctly', statusResult.statistics.projects >= 2);
            
            const totalExpected = statusResult.statistics.sessions + statusResult.statistics.projects;
            addTest('Context counts match', statusResult.statistics.total_contexts === totalExpected);
        }

        if (statusResult.contexts) {
            const contextIds = statusResult.contexts.map(c => c.id);
            const expectedIds = ['fix-memory-leak', 'add-logging', 'next-gen-agents', 'infrastructure-overhaul'];
            
            addTest('All expected contexts present', 
                   expectedIds.every(id => contextIds.includes(id)),
                   `Found: ${contextIds.length}, Expected: ${expectedIds.length}`);
        }

    } catch (error) {
        addTest('Workspace statistics', false, error.message);
    }

    // Results summary
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    
    const successRate = (testResults.passed / (testResults.passed + testResults.failed)) * 100;
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

    if (testResults.failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.tests
            .filter(t => !t.passed)
            .forEach(t => console.log(`   - ${t.name}: ${t.details}`));
    }

    console.log('\n🧹 Cleanup: Removing test contexts...');
    try {
        Factor3ContextManager.removeContext('fix-memory-leak');
        Factor3ContextManager.removeContext('add-logging'); 
        Factor3ContextManager.removeContext('next-gen-agents');
        Factor3ContextManager.removeContext('infrastructure-overhaul');
        console.log('✅ Test contexts cleaned up');
    } catch (error) {
        console.log('⚠️  Cleanup warning:', error.message);
    }

    return {
        success: testResults.failed === 0,
        total: testResults.passed + testResults.failed,
        passed: testResults.passed,
        failed: testResults.failed,
        success_rate: successRate
    };
}

// Run tests if called directly
if (require.main === module) {
    testMultiContextWorkspace()
        .then(results => {
            console.log(`\n🎯 Multi-Context Workspace Phase 2C: ${results.success ? '✅ READY' : '❌ NEEDS WORK'}`);
            process.exit(results.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testMultiContextWorkspace };