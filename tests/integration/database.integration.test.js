const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { SQLiteManager } = require('../../database/sqlite-manager');
const fs = require('fs');
const path = require('path');

describe('Database Integration Tests', () => {
    let db;
    const testDbPath = path.join(__dirname, '../fixtures/test.db');

    beforeEach(async () => {
        // Clean up any existing test database
        try {
            fs.unlinkSync(testDbPath);
        } catch (error) {
            // File might not exist
        }

        db = new SQLiteManager({ databasePath: testDbPath });
        await db.initialize();
    });

    afterEach(async () => {
        if (db) {
            await db.close();
        }
        // Clean up test database
        try {
            fs.unlinkSync(testDbPath);
        } catch (error) {
            // File might not exist
        }
    });

    describe('Session Management', () => {
        it('should create and retrieve sessions', async () => {
            const sessionId = 'test-session-001';
            const workflowType = 'test_workflow';
            const contextData = { test: 'data' };

            await db.createSession(sessionId, workflowType, contextData);
            
            const session = await db.getSession(sessionId);
            
            expect(session.session_id).toBe(sessionId);
            expect(session.workflow_type).toBe(workflowType);
            expect(JSON.parse(session.context_data)).toEqual(contextData);
        });

        it('should update session status', async () => {
            const sessionId = 'test-session-002';
            
            await db.createSession(sessionId, 'test_workflow');
            await db.updateSession(sessionId, { 
                status: 'completed',
                ended_at: Date.now()
            });
            
            const session = await db.getSession(sessionId);
            expect(session.status).toBe('completed');
            expect(session.ended_at).toBeTruthy();
        });
    });

    describe('Agent Management', () => {
        it('should create and track agents', async () => {
            const sessionId = 'test-session-003';
            const agentId = 'test-agent-001';
            
            await db.createSession(sessionId, 'test_workflow');
            await db.createAgent(agentId, sessionId, 'github');
            
            const agents = await db.getSessionAgents(sessionId);
            expect(agents).toHaveLength(1);
            expect(agents[0].agent_id).toBe(agentId);
            expect(agents[0].agent_name).toBe('github');
        });
    });
});
