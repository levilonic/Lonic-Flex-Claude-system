#!/usr/bin/env node
/**
 * Quick Logger Test - Phase 3A
 * Verify Winston logger implementation before mass console.log replacement
 */

const { logger, system, agent, workflow, integration, database, auth, test, info, warn, error, logError, time, createContextLogger } = require('./src/services/logger');

async function testLogger() {
    console.log('🧪 Testing LonicFLex Central Logger - Phase 3A');
    console.log('='.repeat(50));

    try {
        console.log('\n📋 1. Basic Logging Levels...');
        info('Logger initialized successfully');
        warn('This is a warning message');
        error('This is an error message');

        console.log('\n📋 2. Category-Specific Logging...');
        system.info('System startup initiated', { component: 'startup' });
        agent.info('Agent created', { agentId: 'test-agent-123', type: 'github' });
        workflow.info('Workflow started', { workflowId: 'workflow-456', steps: 5 });
        integration.info('External service connected', { service: 'github', endpoint: 'api.github.com' });
        database.info('Database query executed', { operation: 'SELECT', table: 'agents', duration: 45 });
        auth.info('User authenticated', { userId: 'user-789', method: 'token' });
        test.info('Test case completed', { testName: 'logger-basic-test', passed: true });

        console.log('\n📋 3. Context-Aware Logging...');
        const contextLogger = createContextLogger({
            sessionId: 'session-abc',
            agentId: 'context-agent',
            category: 'test'
        });
        contextLogger.info('Context-aware log message', { action: 'test-action' });
        contextLogger.warn('Context warning with session info');

        console.log('\n📋 4. Error Handling...');
        const testError = new Error('Test error for logging');
        testError.code = 'TEST_ERROR';
        logError(testError, { component: 'logger-test', severity: 'low' });

        console.log('\n📋 5. Performance Timing...');
        const timer = time('test-operation', { component: 'logger-test' });
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 100));
        timer.end();

        console.log('\n📋 6. Structured Metadata...');
        agent.info('Agent workflow completed', {
            agentId: 'test-agent-456',
            sessionId: 'session-def',
            workflowId: 'workflow-789',
            steps: [
                { step: 1, action: 'initialize', duration: 50 },
                { step: 2, action: 'process', duration: 120 },
                { step: 3, action: 'finalize', duration: 30 }
            ],
            result: { success: true, itemsProcessed: 42 }
        });

        console.log('\n✅ Logger test completed successfully!');
        console.log('📄 Check logs/ directory for output files');
        console.log('   - lonicflex.log (general logs)');
        console.log('   - lonicflex-error.log (error logs)');

        return true;

    } catch (error) {
        console.error('❌ Logger test failed:', error.message);
        return false;
    }
}

// Run test
if (require.main === module) {
    testLogger()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { testLogger };