const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { MultiAgentCore } = require('../../claude-multi-agent-core');

describe('Multi-Agent Integration Tests', () => {
    let multiAgentCore;

    beforeEach(async () => {
        multiAgentCore = new MultiAgentCore();
    });

    afterEach(async () => {
        if (multiAgentCore) {
            multiAgentCore.cleanup();
        }
    });

    describe('Session Management', () => {
        it('should initialize session correctly', async () => {
            const sessionId = 'integration-test-001';
            const workflowType = 'feature_development';
            const context = { repository: 'test/repo' };

            const workflow = await multiAgentCore.initializeSession(
                sessionId, 
                workflowType, 
                context
            );

            expect(workflow.sessionId).toBe(sessionId);
            expect(workflow.agentNames).toContain('github');
            expect(workflow.agentNames).toContain('security');
        });
    });

    describe('Agent Coordination', () => {
        it('should execute workflow with all agents', async () => {
            const sessionId = 'integration-test-002';
            await multiAgentCore.initializeSession(sessionId, 'bug_fix', {});

            const executors = {
                github: async (context, updateProgress) => {
                    updateProgress(100, 'GitHub processing complete');
                    return { agent: 'github', status: 'success' };
                },
                security: async (context, updateProgress) => {
                    updateProgress(100, 'Security scan complete');
                    return { agent: 'security', status: 'success' };
                },
                deploy: async (context, updateProgress) => {
                    updateProgress(100, 'Deployment complete');
                    return { agent: 'deploy', status: 'success' };
                }
            };

            const result = await multiAgentCore.executeWorkflow(executors);

            expect(result.sessionId).toBe(sessionId);
            expect(Object.keys(result.results)).toHaveLength(3);
            expect(result.results.github.status).toBe('success');
        }, 15000);
    });
});
