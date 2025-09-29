const { describe, it, expect, beforeAll } = require('@jest/globals');
const { MultiAgentCore } = require('../../claude-multi-agent-core');

describe('Performance Tests', () => {
    let multiAgentCore;

    beforeAll(async () => {
        multiAgentCore = new MultiAgentCore();
    });

    describe('Workflow Performance', () => {
        it('should complete workflow within acceptable time limits', async () => {
            const startTime = Date.now();
            const sessionId = 'perf-test-001';

            await multiAgentCore.initializeSession(sessionId, 'bug_fix', {});
            const result = await multiAgentCore.executeWorkflow();

            const duration = Date.now() - startTime;
            
            expect(result.sessionId).toBe(sessionId);
            expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
        });

        it('should handle concurrent workflows efficiently', async () => {
            const startTime = Date.now();
            const workflows = [];

            // Start 5 concurrent workflows
            for (let i = 0; i < 5; i++) {
                const sessionId = `perf-concurrent-${i}`;
                const workflow = multiAgentCore.initializeSession(sessionId, 'bug_fix', {})
                    .then(() => multiAgentCore.executeWorkflow());
                workflows.push(workflow);
            }

            const results = await Promise.all(workflows);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(5);
            expect(duration).toBeLessThan(15000); // Should complete in under 15 seconds
            results.forEach(result => {
                expect(result.sessionId).toBeTruthy();
            });
        }, 20000);
    });

    describe('Memory Usage', () => {
        it('should not leak memory during multiple workflows', async () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Run 10 workflows
            for (let i = 0; i < 10; i++) {
                const sessionId = `memory-test-${i}`;
                await multiAgentCore.initializeSession(sessionId, 'bug_fix', {});
                await multiAgentCore.executeWorkflow();
                multiAgentCore.cleanup();
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be reasonable (less than 50MB)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        }, 30000);
    });
});
