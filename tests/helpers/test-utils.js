/**
 * Test Utilities and Helper Functions
 */

class TestUtils {
    /**
     * Create mock database instance
     */
    static createMockDb() {
        return {
            initialize: jest.fn().mockResolvedValue(true),
            createSession: jest.fn().mockResolvedValue('mock-session'),
            updateSession: jest.fn().mockResolvedValue(true),
            getSession: jest.fn().mockResolvedValue({ session_id: 'mock-session' }),
            createAgent: jest.fn().mockResolvedValue('mock-agent'),
            close: jest.fn().mockResolvedValue(true)
        };
    }

    /**
     * Create mock Slack client
     */
    static createMockSlackClient() {
        return {
            chat: {
                postMessage: jest.fn().mockResolvedValue({ 
                    ok: true, 
                    ts: '1234567890.123456' 
                }),
                update: jest.fn().mockResolvedValue({ ok: true })
            },
            oauth: {
                v2: {
                    access: jest.fn().mockResolvedValue({
                        ok: true,
                        team: { id: 'T123', name: 'Test Team' },
                        bot_user_id: 'B123',
                        access_token: 'xoxb-test-token'
                    })
                }
            }
        };
    }

    /**
     * Wait for async operations
     */
    static async waitForAsync(ms = 100) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate test data
     */
    static generateTestData(type) {
        switch (type) {
            case 'session':
                return {
                    sessionId: `test-session-${Date.now()}`,
                    workflowType: 'test_workflow',
                    context: { test: true }
                };
            
            case 'agent':
                return {
                    agentId: `test-agent-${Date.now()}`,
                    agentName: 'test',
                    config: { timeout: 5000 }
                };
                
            case 'user':
                return {
                    userId: `U${Math.random().toString(36).substr(2, 8)}`,
                    teamId: `T${Math.random().toString(36).substr(2, 8)}`,
                    username: `testuser${Math.floor(Math.random() * 1000)}`,
                    email: 'test@example.com'
                };
                
            default:
                return {};
        }
    }

    /**
     * Assert error is thrown with specific message
     */
    static async assertThrowsAsync(fn, expectedMessage) {
        let error;
        try {
            await fn();
        } catch (e) {
            error = e;
        }
        
        expect(error).toBeDefined();
        if (expectedMessage) {
            expect(error.message).toContain(expectedMessage);
        }
    }

    /**
     * Create temporary test environment
     */
    static createTestEnv(envVars = {}) {
        const originalEnv = { ...process.env };
        
        // Set test environment variables
        Object.assign(process.env, envVars);
        
        // Return cleanup function
        return () => {
            process.env = originalEnv;
        };
    }

    /**
     * Mock external API responses
     */
    static mockApiResponses(responses = {}) {
        const originalFetch = global.fetch;
        
        global.fetch = jest.fn((url) => {
            const response = responses[url] || { ok: true, json: () => ({}) };
            return Promise.resolve(response);
        });
        
        // Return cleanup function
        return () => {
            global.fetch = originalFetch;
        };
    }
}

module.exports = { TestUtils };
