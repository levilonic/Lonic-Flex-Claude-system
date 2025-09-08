const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { MultiAgentCore } = require('../../claude-multi-agent-core');
const { ConfigManager } = require('../../claude-config-manager');

describe('Workflow End-to-End Tests', () => {
    let multiAgentCore;
    let configManager;

    beforeAll(async () => {
        configManager = new ConfigManager();
        await configManager.initialize();
        
        multiAgentCore = new MultiAgentCore();
    });

    afterAll(async () => {
        if (multiAgentCore) {
            multiAgentCore.cleanup();
        }
        if (configManager) {
            await configManager.cleanup();
        }
    });

    describe('Feature Development Workflow', () => {
        it('should complete full feature development workflow', async () => {
            const sessionId = 'e2e-feature-001';
            const context = {
                repository: 'test/example',
                feature: 'user-authentication',
                branch: 'feature/auth'
            };

            await multiAgentCore.initializeSession(
                sessionId, 
                'feature_development', 
                context
            );

            const result = await multiAgentCore.executeWorkflow();

            expect(result.sessionId).toBe(sessionId);
            expect(result.results.github.status).toBe('success');
            expect(result.results.security.status).toBe('success');
            expect(result.results.code.status).toBe('success');
            expect(result.results.deploy.status).toBe('success');
            expect(result.duration).toBeGreaterThan(0);
        }, 45000);
    });

    describe('Security Scan Workflow', () => {
        it('should complete security scan workflow', async () => {
            const sessionId = 'e2e-security-001';
            const context = {
                repository: 'test/example',
                scanType: 'vulnerability'
            };

            await multiAgentCore.initializeSession(
                sessionId,
                'security_scan',
                context
            );

            const result = await multiAgentCore.executeWorkflow();

            expect(result.sessionId).toBe(sessionId);
            expect(result.results.security.status).toBe('success');
            expect(result.results.github.status).toBe('success');
        }, 30000);
    });

    describe('Deployment Workflow', () => {
        it('should complete deployment workflow', async () => {
            const sessionId = 'e2e-deploy-001';
            const context = {
                environment: 'staging',
                strategy: 'blue-green'
            };

            await multiAgentCore.initializeSession(
                sessionId,
                'deployment',
                context
            );

            const result = await multiAgentCore.executeWorkflow();

            expect(result.sessionId).toBe(sessionId);
            expect(result.results.security.status).toBe('success');
            expect(result.results.deploy.status).toBe('success');
            expect(result.results.comm.status).toBe('success');
        }, 60000);
    });
});
