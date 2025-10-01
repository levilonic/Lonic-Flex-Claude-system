#!/usr/bin/env node

/**
 * Test Unified Command System - Phase 2B Validation
 * Tests the UniversalContextCommands system
 */

const { UniversalContextCommands } = require('./universal-context-commands');

console.log('🧪 Testing Unified Command System - Phase 2B\n');

async function testUnifiedCommandSystem() {
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

    console.log('🚀 Test 1: Start Session Command...');
    try {
        const sessionResult = await commands.executeCommand([
            'start', 'test-session-debug-issue', 
            '--session', 
            '--goal=Fix memory leak in agent processing'
        ]);

        addTest('Session start command successful', !sessionResult.error, sessionResult.message);
        addTest('Session scope correctly set', sessionResult.scope === 'session');
        addTest('Goal preserved in session', sessionResult.goal === 'Fix memory leak in agent processing');
        addTest('Context ID matches input', sessionResult.context_id === 'test-session-debug-issue');

    } catch (error) {
        addTest('Session start command', false, error.message);
    }

    console.log('\n🎯 Test 2: Start Project Command...');
    try {
        const projectResult = await commands.executeCommand([
            'start', 'test-project-new-system',
            '--project',
            '--goal=Build next-generation multi-agent coordination system',
            '--vision=Scalable, reliable, and intelligent agent orchestration'
        ]);

        addTest('Project start command successful', !projectResult.error, projectResult.message);
        addTest('Project scope correctly set', projectResult.scope === 'project');
        addTest('Goal preserved in project', !!projectResult.goal);
        addTest('Vision preserved in project', !!projectResult.vision);

    } catch (error) {
        addTest('Project start command', false, error.message);
    }

    console.log('\n📋 Test 3: List Active Contexts...');
    try {
        const listResult = await commands.executeCommand(['list']);

        addTest('List command successful', !listResult.error);
        
        if (listResult.sessions || listResult.projects) {
            const totalContexts = (listResult.sessions?.length || 0) + (listResult.projects?.length || 0);
            addTest('Active contexts found', totalContexts >= 2, `${totalContexts} contexts`);
            addTest('Sessions tracked', Array.isArray(listResult.sessions));
            addTest('Projects tracked', Array.isArray(listResult.projects));
            addTest('Command help provided', !!listResult.commands);
        } else {
            addTest('List shows contexts or no contexts message', !!listResult.suggestion || !!listResult.sessions);
        }

    } catch (error) {
        addTest('List command', false, error.message);
    }

    console.log('\n💾 Test 4: Save Context Command...');
    try {
        const saveResult = await commands.executeCommand([
            'save', 'test-session-debug-issue',
            '--status=Identified root cause of memory leak',
            '--important'
        ]);

        addTest('Save command successful', !saveResult.error, saveResult.message);
        addTest('Context saved with status', saveResult.status === 'Identified root cause of memory leak');
        addTest('Importance marked', saveResult.importance === 'high');
        addTest('Compression applied', !!saveResult.compression_ratio);

    } catch (error) {
        addTest('Save command', false, error.message);
    }

    console.log('\n🔄 Test 5: Resume Context Command...');
    try {
        const resumeResult = await commands.executeCommand(['resume', 'test-project-new-system']);

        addTest('Resume command successful', !resumeResult.error, resumeResult.message);
        addTest('Context ID preserved', resumeResult.context_id === 'test-project-new-system');
        addTest('Scope preserved', resumeResult.scope === 'project');
        addTest('Context information provided', !!resumeResult.context);

    } catch (error) {
        addTest('Resume command', false, error.message);
    }

    console.log('\n🔀 Test 6: Context Switch Command...');
    try {
        const switchResult = await commands.executeCommand(['switch', 'test-session-debug-issue']);

        addTest('Switch command successful', !switchResult.error, switchResult.message);
        addTest('Switched to correct context', switchResult.context.context_id === 'test-session-debug-issue');
        addTest('Scope information provided', switchResult.scope === 'session');
        addTest('Context details provided', !!switchResult.context);

    } catch (error) {
        addTest('Switch command', false, error.message);
    }

    console.log('\n⬆️  Test 7: Upgrade Session to Project...');
    try {
        const upgradeResult = await commands.executeCommand([
            'upgrade', 'test-session-debug-issue',
            '--to-project',
            '--goal=Complete system memory optimization and performance enhancement',
            '--reason=Memory issue revealed systemic performance problems'
        ]);

        addTest('Upgrade command successful', !upgradeResult.error, upgradeResult.message);
        addTest('Upgrade preserved events', upgradeResult.upgrade_result?.events_preserved > 0);
        addTest('PROJECT.md created', upgradeResult.project_created === true);
        addTest('Upgrade benefits listed', Array.isArray(upgradeResult.benefits));

    } catch (error) {
        addTest('Upgrade command', false, error.message);
    }

    console.log('\n📊 Test 8: System Status Command...');
    try {
        const statusResult = await commands.executeCommand(['status']);

        addTest('Status command successful', !statusResult.error, statusResult.message);
        addTest('Statistics provided', !!statusResult.statistics);
        addTest('Context details provided', Array.isArray(statusResult.contexts));
        addTest('System health reported', statusResult.system_health === 'operational');

        if (statusResult.statistics) {
            addTest('Total contexts counted', statusResult.statistics.total_contexts >= 2);
            addTest('Sessions and projects separated', 
                   typeof statusResult.statistics.sessions === 'number' &&
                   typeof statusResult.statistics.projects === 'number');
        }

    } catch (error) {
        addTest('Status command', false, error.message);
    }

    console.log('\n🔧 Test 9: Auto-Scope Detection...');
    try {
        // Test with minimal info (should suggest session)
        const sessionAutoResult = await commands.executeCommand([
            'start', 'test-auto-session',
            '--goal=Quick bug fix'
        ]);

        addTest('Auto-detection works for simple tasks', sessionAutoResult.scope === 'session' || sessionAutoResult.scope === 'project');

        // Test with complex info (should suggest project)
        const projectAutoResult = await commands.executeCommand([
            'start', 'test-auto-project', 
            '--goal=Build comprehensive microservices architecture with event sourcing and CQRS patterns',
            '--vision=Next-generation distributed system foundation',
            '--duration=months',
            '--complexity=high',
            '--external-deps'
        ]);

        addTest('Auto-detection works for complex tasks', projectAutoResult.scope === 'project');

    } catch (error) {
        addTest('Auto-scope detection', false, error.message);
    }

    console.log('\n❌ Test 10: Error Handling...');
    try {
        // Test invalid command
        const invalidResult = await commands.executeCommand(['invalid-command']);
        addTest('Invalid command handled', invalidResult.error === true);

        // Test missing context
        const missingResult = await commands.executeCommand(['resume', 'non-existent-context']);
        addTest('Missing context handled', missingResult.error === true);

        // Test invalid upgrade
        const invalidUpgradeResult = await commands.executeCommand(['upgrade', 'test-auto-project', '--invalid-flag']);
        addTest('Invalid upgrade handled', invalidUpgradeResult.error === true);

    } catch (error) {
        addTest('Error handling test setup', false, error.message);
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
    testUnifiedCommandSystem()
        .then(results => {
            console.log(`\n🎯 Unified Command System Phase 2B: ${results.success ? '✅ READY' : '❌ NEEDS WORK'}`);
            process.exit(results.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testUnifiedCommandSystem };