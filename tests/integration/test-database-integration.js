/**
 * Database Integration Tests
 * Tests SQLiteManager session and agent management functionality
 */

const { SQLiteManager } = require('../../src/database/sqlite-manager');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Testing Database Integration\n');

class DatabaseIntegrationTests {
    constructor() {
        this.db = null;
        this.testResults = [];
        this.testDbPath = path.join(__dirname, '../fixtures/test.db');
    }

    async setup() {
        console.log('⚙️ Setting up test database...');

        // Use in-memory database for testing (faster, no cleanup needed)
        this.db = new SQLiteManager(':memory:');
        await this.db.initialize();
        console.log('✅ Test database initialized (in-memory)\n');
    }

    async teardown() {
        console.log('\n🧹 Cleaning up test database...');
        if (this.db) {
            await this.db.close();
        }
        console.log('✅ Cleanup complete');
    }

    async runAllTests() {
        try {
            await this.setup();

            await this.testSessionManagement();
            await this.testAgentManagement();

            await this.teardown();

            this.printResults();

        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            throw error;
        }
    }

    async testSessionManagement() {
        console.log('📋 Testing Session Management...\n');

        await this.test('Should create and retrieve sessions', async () => {
            const sessionId = `test-session-${Date.now()}-001`;
            const workflowType = 'test_workflow';
            const contextData = { test: 'data' };

            await this.db.createSession(sessionId, workflowType, contextData);

            const session = await this.db.getSession(sessionId);

            assert.strictEqual(session.session_id, sessionId, 'Session ID should match');
            assert.strictEqual(session.workflow_type, workflowType, 'Workflow type should match');

            const retrievedData = JSON.parse(session.context_data);
            assert.deepStrictEqual(retrievedData, contextData, 'Context data should match');

            console.log(`  ✅ Session created and retrieved: ${sessionId}`);
            return true;
        });

        await this.test('Should update session status', async () => {
            const sessionId = `test-session-${Date.now()}-002`;

            await this.db.createSession(sessionId, 'test_workflow');
            await this.db.updateSession(sessionId, {
                status: 'completed',
                ended_at: Date.now()
            });

            const session = await this.db.getSession(sessionId);
            assert.strictEqual(session.status, 'completed', 'Status should be updated');
            assert.ok(session.ended_at, 'ended_at should be set');

            console.log(`  ✅ Session status updated: ${sessionId}`);
            return true;
        });
    }

    async testAgentManagement() {
        console.log('\n📋 Testing Agent Management...\n');

        await this.test('Should create and track agents', async () => {
            const sessionId = `test-session-${Date.now()}-003`;
            const agentId = `test-agent-${Date.now()}-001`;

            await this.db.createSession(sessionId, 'test_workflow');
            await this.db.createAgent(agentId, sessionId, 'github');

            const agents = await this.db.getSessionAgents(sessionId);
            assert.strictEqual(agents.length, 1, 'Should have 1 agent');
            assert.strictEqual(agents[0].agent_id, agentId, 'Agent ID should match');
            assert.strictEqual(agents[0].agent_name, 'github', 'Agent name should match');

            console.log(`  ✅ Agent created and tracked: ${agentId}`);
            return true;
        });

        await this.test('Should handle multiple agents per session', async () => {
            const sessionId = `test-session-${Date.now()}-004`;

            await this.db.createSession(sessionId, 'multi_agent_workflow');

            await this.db.createAgent(`${sessionId}_agent1`, sessionId, 'github');
            await this.db.createAgent(`${sessionId}_agent2`, sessionId, 'code');
            await this.db.createAgent(`${sessionId}_agent3`, sessionId, 'comm');

            const agents = await this.db.getSessionAgents(sessionId);
            assert.strictEqual(agents.length, 3, 'Should have 3 agents');

            console.log(`  ✅ Multiple agents tracked: ${agents.length} agents`);
            return true;
        });
    }

    async test(description, testFunction) {
        try {
            const result = await testFunction();
            if (result) {
                this.testResults.push({ description, passed: true });
            } else {
                console.log(`  ❌ ${description}`);
                this.testResults.push({ description, passed: false });
            }
        } catch (error) {
            console.log(`  ❌ ${description}: ${error.message}`);
            this.testResults.push({ description, passed: false, error: error.message });
        }
    }

    printResults() {
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const failed = total - passed;

        console.log('\n' + '='.repeat(50));
        console.log('📊 Database Integration Test Results');
        console.log('='.repeat(50));
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Coverage: ${((passed / total) * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.filter(r => !r.passed).forEach(test => {
                console.log(`  • ${test.description}${test.error ? ': ' + test.error : ''}`);
            });
            throw new Error(`${failed} test(s) failed`);
        }

        console.log('\n🎯 Database Integration Tests: ✅ ALL PASSED');
    }
}

// Run tests if called directly
if (require.main === module) {
    const tests = new DatabaseIntegrationTests();
    tests.runAllTests()
        .then(() => {
            console.log('\n🎉 Database Integration Test Suite: SUCCESS');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Database Integration Test Suite: FAILED');
            console.error(error.message);
            process.exit(1);
        });
}

module.exports = { DatabaseIntegrationTests };
