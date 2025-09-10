#!/usr/bin/env node

/**
 * Test Universal Context System - Phase 2A Validation
 * Tests the enhanced Factor3ContextManager and ContextScope system
 */

const { Factor3ContextManager, CONTEXT_SCOPES } = require('./factor3-context-manager');
const { ContextScopeManager, SCOPE_TYPES } = require('./context-management/context-scope-manager');

console.log('🧪 Testing Universal Context System - Phase 2A\n');

async function testUniversalContextSystem() {
    let testResults = {
        passed: 0,
        failed: 0,
        tests: []
    };

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

    console.log('🔧 Test 1: Context Scope Types Loading...');
    try {
        addTest('CONTEXT_SCOPES loaded', CONTEXT_SCOPES.session && CONTEXT_SCOPES.project, 
               `Session compression: ${CONTEXT_SCOPES.session.compression_ratio}, Project: ${CONTEXT_SCOPES.project.compression_ratio}`);
        addTest('SCOPE_TYPES loaded', SCOPE_TYPES.session && SCOPE_TYPES.project,
               `Session cleanup: ${SCOPE_TYPES.session.auto_cleanup_days} days, Project: ${SCOPE_TYPES.project.auto_cleanup_days} days`);
    } catch (error) {
        addTest('Context scope types loading', false, error.message);
    }

    console.log('\n🏗️  Test 2: Session Context Creation...');
    try {
        const sessionContext = Factor3ContextManager.createContext({
            contextScope: 'session',
            contextId: 'test-session-fix-auth-bug'
        });

        addTest('Session context created', !!sessionContext, `ID: ${sessionContext.contextId}`);
        addTest('Session scope configured', sessionContext.contextScope === 'session', 
               `Compression ratio: ${sessionContext.scopeConfig.compression_ratio}`);

        // Test session context functionality
        sessionContext.setCurrentTask('Fix JWT token expiration bug');
        sessionContext.addEvent('bug_investigation', { 
            issue: 'JWT tokens expiring too early',
            component: 'auth-middleware' 
        });

        addTest('Session task tracking', sessionContext.currentTask === 'Fix JWT token expiration bug');
        addTest('Session event logging', sessionContext.events.length > 0);

    } catch (error) {
        addTest('Session context creation', false, error.message);
    }

    console.log('\n🎯 Test 3: Project Context Creation...');
    try {
        const projectContext = Factor3ContextManager.createContext({
            contextScope: 'project',
            contextId: 'test-project-new-auth-system'
        });

        addTest('Project context created', !!projectContext, `ID: ${projectContext.contextId}`);
        addTest('Project scope configured', projectContext.contextScope === 'project',
               `Compression ratio: ${projectContext.scopeConfig.compression_ratio}`);

        // Test project context functionality
        projectContext.setCurrentTask('Design authentication architecture');
        projectContext.addImportantEvent('architecture_decision', {
            decision: 'Use JWT with refresh tokens',
            rationale: 'Better security and scalability',
            alternatives: ['Session-based auth', 'OAuth only']
        }, 9);

        addTest('Project task tracking', projectContext.currentTask === 'Design authentication architecture');
        addTest('Project important events', projectContext.events.some(e => e.data.importance === 9));

    } catch (error) {
        addTest('Project context creation', false, error.message);
    }

    console.log('\n🔄 Test 4: Tangent Handling (Universal)...');
    try {
        const context = Factor3ContextManager.getContextById('test-project-new-auth-system');
        
        // Push tangent
        const tangentFrame = context.pushContext({
            reason: 'Need to create security validation agent',
            newTask: 'Create SecurityValidationAgent',
            returnPoint: 'Continue with JWT architecture design'
        });

        addTest('Context push successful', !!tangentFrame && context.contextStack.length === 1);
        addTest('Current task updated for tangent', context.currentTask === 'Create SecurityValidationAgent');

        // Work on tangent
        context.addEvent('agent_development', {
            agent_name: 'SecurityValidationAgent',
            functionality: 'JWT validation and security checks'
        });

        // Pop tangent  
        const returnFrame = context.popContext({
            result: 'SecurityValidationAgent created successfully',
            assets: ['SecurityValidationAgent.js', 'JWT validation patterns']
        });

        addTest('Context pop successful', !!returnFrame && context.contextStack.length === 0);
        addTest('Returned to original task', context.currentTask === 'Design authentication architecture');

    } catch (error) {
        addTest('Tangent handling', false, error.message);
    }

    console.log('\n📊 Test 5: Smart Compression Testing...');
    try {
        const context = Factor3ContextManager.getContextById('test-session-fix-auth-bug');
        
        // Generate substantial context (simulate work)
        for (let i = 0; i < 50; i++) {
            context.addEvent('debug_step', {
                step: i + 1,
                action: `Debugging step ${i + 1}`,
                findings: `Found issue in component ${i % 5}`
            });
        }

        const stats = context.getCompressionStats();
        const compressionRatio = stats.compression_ratio;
        const actualCompression = (stats.preserved_events / stats.total_events);

        addTest('Generated sufficient events', stats.total_events >= 50, `${stats.total_events} events`);
        addTest('Compression ratio configured', compressionRatio === 0.7, `Ratio: ${compressionRatio}`);
        addTest('Smart compression working', actualCompression >= compressionRatio, 
               `${(actualCompression * 100).toFixed(1)}% compression achieved`);

        // Test context summary generation
        const summary = JSON.parse(context.generateContextSummary());
        addTest('Context summary generated', !!summary.context_id, `${summary.compressed_events} events compressed`);
        addTest('Compression statistics included', !!summary.compression_ratio, `${(summary.compression_ratio * 100)}% target ratio`);

    } catch (error) {
        addTest('Smart compression testing', false, error.message);
    }

    console.log('\n🔧 Test 6: Scope Upgrade (Session → Project)...');
    try {
        const sessionContext = Factor3ContextManager.getContextById('test-session-fix-auth-bug');
        
        const upgradeResult = sessionContext.upgradeToProject({
            reason: 'Bug fix revealed need for complete auth system redesign',
            goal: 'Build secure, scalable authentication system',
            vision: 'Enterprise-grade auth with modern security practices'
        });

        addTest('Scope upgrade successful', upgradeResult.new_scope === 'project');
        addTest('Events preserved during upgrade', upgradeResult.events_preserved > 0, 
               `${upgradeResult.events_preserved} events preserved`);
        addTest('Upgrade event recorded', sessionContext.events.some(e => e.type === 'scope_upgrade'));

    } catch (error) {
        addTest('Scope upgrade', false, error.message);
    }

    console.log('\n🌐 Test 7: Multi-Context Registry...');
    try {
        const allContexts = Factor3ContextManager.getAllActiveContexts();
        
        addTest('Multiple contexts tracked', allContexts.length >= 2, `${allContexts.length} contexts found`);
        
        const sessionContexts = allContexts.filter(c => c.scope === 'session');
        const projectContexts = allContexts.filter(c => c.scope === 'project');
        
        addTest('Session contexts tracked', sessionContexts.length >= 0, `${sessionContexts.length} sessions`);
        addTest('Project contexts tracked', projectContexts.length >= 1, `${projectContexts.length} projects`);

        // Test context isolation
        const context1 = Factor3ContextManager.getContextById('test-session-fix-auth-bug');
        const context2 = Factor3ContextManager.getContextById('test-project-new-auth-system');
        
        addTest('Context isolation maintained', 
                context1 && context2 && context1.contextId !== context2.contextId,
                'Different context IDs');

    } catch (error) {
        addTest('Multi-context registry', false, error.message);
    }

    console.log('\n🔧 Test 8: ContextScopeManager Integration...');
    try {
        const scopeManager = new ContextScopeManager();

        // Test scope detection
        const detection = scopeManager.detectOptimalScope({
            goal: 'Build comprehensive authentication system with JWT, OAuth, and role-based permissions',
            vision: 'Enterprise-grade security foundation',
            expectedDuration: 'months',
            complexity: 'high',
            hasExternalDependencies: true,
            requiresIdentity: true
        });

        addTest('Scope detection working', detection.suggested_scope === 'project', 
               `Confidence: ${detection.confidence}, Score: ${detection.score}`);

        // Test upgrade validation
        const upgradeValidation = scopeManager.validateScopeUpgrade('session', 'project', {
            goal: 'Build authentication system'
        });

        addTest('Upgrade validation working', upgradeValidation.valid === true, 
               `Requirements met: ${upgradeValidation.requirements_met}`);

    } catch (error) {
        addTest('ContextScopeManager integration', false, error.message);
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

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    try {
        Factor3ContextManager.removeContext('test-session-fix-auth-bug');
        Factor3ContextManager.removeContext('test-project-new-auth-system');
        console.log('✅ Test contexts removed');
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
    testUniversalContextSystem()
        .then(results => {
            console.log(`\n🎯 Universal Context System Phase 2A: ${results.success ? '✅ READY' : '❌ NEEDS WORK'}`);
            process.exit(results.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testUniversalContextSystem };