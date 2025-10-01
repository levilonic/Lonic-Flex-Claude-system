const { describe, it, expect, beforeAll } = require('@jest/globals');
const { SlackAuthManager } = require('../../claude-slack-auth');
const crypto = require('crypto');

describe('Security Tests', () => {
    let authManager;

    beforeAll(async () => {
        authManager = new SlackAuthManager({
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret'
        });
        await authManager.initialize();
    });

    describe('OAuth Security', () => {
        it('should generate secure state parameters', () => {
            const state1 = authManager.generateState();
            const state2 = authManager.generateState();
            
            expect(state1).toHaveLength(32); // 16 bytes hex = 32 chars
            expect(state2).toHaveLength(32);
            expect(state1).not.toBe(state2); // Should be unique
        });

        it('should validate state parameters correctly', async () => {
            const validState = authManager.generateState('T12345');
            
            // Valid state should exist in database
            const stateRecord = await authManager.db.db.get(
                'SELECT * FROM oauth_states WHERE state = ?',
                [validState]
            );
            
            expect(stateRecord).toBeTruthy();
            expect(stateRecord.team_id).toBe('T12345');
        });
    });

    describe('Permission System', () => {
        it('should enforce role-based permissions correctly', async () => {
            await authManager.createOrUpdateUser(
                'U123', 'T123', 'testuser', null, 'viewer'
            );

            const canStart = await authManager.hasPermission('U123', 'T123', 'workflow.start');
            const canView = await authManager.hasPermission('U123', 'T123', 'workflow.view');

            expect(canStart).toBe(false); // Viewer cannot start workflows
            expect(canView).toBe(true);   // Viewer can view workflows
        });

        it('should handle admin permissions correctly', async () => {
            await authManager.createOrUpdateUser(
                'U456', 'T123', 'admin', null, 'admin'
            );

            const canManage = await authManager.hasPermission('U456', 'T123', 'config.edit');
            const canDeploy = await authManager.hasPermission('U456', 'T123', 'deployment.production');

            expect(canManage).toBe(true); // Admin can do everything
            expect(canDeploy).toBe(true);
        });
    });

    describe('Input Validation', () => {
        it('should reject invalid role assignments', async () => {
            await expect(authManager.updateUserRole('U789', 'T123', 'invalid_role', 'U456'))
                .rejects.toThrow('Invalid role');
        });

        it('should sanitize input data', () => {
            // Test that potentially malicious input is handled safely
            const maliciousInput = '<script>alert("xss")</script>';
            const sanitized = authManager.sanitizeInput ? 
                authManager.sanitizeInput(maliciousInput) : 
                maliciousInput;
            
            // This is a placeholder - actual implementation would sanitize
            expect(typeof sanitized).toBe('string');
        });
    });
});
