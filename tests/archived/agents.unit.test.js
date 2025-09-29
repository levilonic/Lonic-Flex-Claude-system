const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { BaseAgent } = require('../../agents/base-agent');
const { GitHubAgent } = require('../../agents/github-agent');
const { SecurityAgent } = require('../../agents/security-agent');

describe('Agent Unit Tests', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = {
            initialize: jest.fn().mockResolvedValue(true),
            createSession: jest.fn().mockResolvedValue('session-123'),
            updateSession: jest.fn().mockResolvedValue(true)
        };
    });

    describe('BaseAgent', () => {
        it('should initialize with correct configuration', async () => {
            const agent = new BaseAgent('test-session', { timeout: 5000 });
            
            expect(agent.sessionId).toBe('test-session');
            expect(agent.config.timeout).toBe(5000);
        });

        it('should handle step execution correctly', async () => {
            const agent = new BaseAgent('test-session');
            agent.db = mockDb;
            
            const mockStep = jest.fn().mockResolvedValue({ result: 'success' });
            const result = await agent.executeStep('test-step', mockStep, {});
            
            expect(result.result).toBe('success');
            expect(mockStep).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            const agent = new BaseAgent('test-session');
            agent.db = mockDb;
            
            const mockStep = jest.fn().mockRejectedValue(new Error('Test error'));
            
            await expect(agent.executeStep('test-step', mockStep, {}))
                .rejects.toThrow('Test error');
        });
    });

    describe('GitHubAgent', () => {
        it('should validate GitHub configuration', () => {
            const agent = new GitHubAgent('test-session', {
                github_token: 'test-token',
                owner: 'test-owner',
                repo: 'test-repo'
            });
            
            expect(agent.config.github_token).toBe('test-token');
            expect(agent.config.owner).toBe('test-owner');
            expect(agent.config.repo).toBe('test-repo');
        });
    });

    describe('SecurityAgent', () => {
        it('should initialize with security configuration', () => {
            const agent = new SecurityAgent('test-session', {
                scanDepth: 'full',
                severityThreshold: 'medium'
            });
            
            expect(agent.config.scanDepth).toBe('full');
            expect(agent.config.severityThreshold).toBe('medium');
        });
    });
});
