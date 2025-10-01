const { info, warn, error } = require('../services/logger');
/**
 * Minimal Working Agent - Clean Architecture Implementation
 *
 * This agent demonstrates proper software engineering:
 * 1. Uses dependency injection (ServiceContainer)
 * 2. No fake success reporting
 * 3. Real error handling
 * 4. Testable and verifiable operations
 * 5. Single responsibility: Basic database operations
 */

class MinimalAgent {
    constructor(sessionId = null, serviceContainer = null) {
        this.sessionId = sessionId || `minimal-${Date.now()}`;
        this.serviceContainer = serviceContainer;
        this.agentName = 'minimal';
        this.status = 'created';
    }

    /**
     * Initialize agent with required services
     * Fail fast if dependencies not available
     */
    async initialize() {
        if (!this.serviceContainer) {
            throw new Error('ServiceContainer required for initialization');
        }

        // Get required services
        this.database = this.serviceContainer.getService('database');
        if (!this.database) {
            throw new Error('Database service not available');
        }

        this.memory = this.serviceContainer.getService('memory');
        if (!this.memory) {
            throw new Error('Memory service not available');
        }

        this.status = 'initialized';
        info(`MinimalAgent ${this.sessionId} initialized`);
    }

    /**
     * Execute a simple task - create agent record in database
     * This is verifiable and doesn't lie about success
     */
    async executeTask() {
        if (this.status !== 'initialized') {
            throw new Error('Agent not initialized. Call initialize() first.');
        }

        this.status = 'executing';
        info(`CYCLE MinimalAgent ${this.sessionId} executing task...`);

        try {
            // Real operation: Insert agent record
            const insertResult = await this.database.run(
                'INSERT INTO agents (id, session_id, name, status, created_at) VALUES (?, ?, ?, ?, ?)',
                [
                    `agent-${this.sessionId}`,
                    this.sessionId,
                    this.agentName,
                    'completed',
                    new Date().toISOString()
                ]
            );

            if (!insertResult || insertResult.changes === 0) {
                throw new Error('Failed to insert agent record');
            }

            info(`Agent record created with ID: ${insertResult.lastID}`);

            // Verify the insert actually worked
            const verifyResult = await this.database.getAllSQL(
                'SELECT * FROM agents WHERE id = ?',
                [`agent-${this.sessionId}`]
            );

            if (!verifyResult || verifyResult.length === 0) {
                throw new Error('Failed to verify agent record creation');
            }

            info(`Verified agent record:`, verifyResult[0]);

            this.status = 'completed';

            return {
                success: true,
                agentId: `agent-${this.sessionId}`,
                sessionId: this.sessionId,
                recordId: insertResult.lastID,
                verificationData: verifyResult[0]
            };

        } catch (error) {
            this.status = 'failed';
            error(`FAIL MinimalAgent ${this.sessionId} failed:`, error.message);

            // Return actual failure, don't hide it
            return {
                success: false,
                error: error.message,
                agentId: `agent-${this.sessionId}`,
                sessionId: this.sessionId
            };
        }
    }

    /**
     * Clean up agent record (for testing)
     */
    async cleanup() {
        if (!this.database) {
            return;
        }

        try {
            await this.database.run(
                'DELETE FROM agents WHERE id = ?',
                [`agent-${this.sessionId}`]
            );
            info(`CLEANUP Cleaned up agent record for ${this.sessionId}`);
        } catch (error) {
            warn(`Cleanup error: ${error.message}`);
        }
    }

    /**
     * Get current status (no lies)
     */
    getStatus() {
        return {
            agentName: this.agentName,
            sessionId: this.sessionId,
            status: this.status,
            hasServiceContainer: !!this.serviceContainer,
            hasDatabase: !!this.database,
            hasMemory: !!this.memory
        };
    }
}

module.exports = { MinimalAgent };

// For testing - allow direct execution with system startup
if (require.main === module) {
    const { systemStartup } = require('../system-startup');

    async function testMinimalAgent() {
        info('TEST Testing MinimalAgent...');

        let agent = null;

        try {
            // Initialize system first
            await systemStartup.initialize();
            const serviceContainer = systemStartup.getServiceContainer();

            // Create and test agent
            agent = new MinimalAgent('test-minimal-agent', serviceContainer);

            info(' Agent status before init:', agent.getStatus());

            await agent.initialize();
            info(' Agent status after init:', agent.getStatus());

            const result = await agent.executeTask();
            info(' Task result:', result);

            if (result.success) {
                info(' MinimalAgent test: SUCCESS');
            } else {
                error('ALERT MinimalAgent test: FAILED');
                info('Error:', result.error);
            }

            // Clean up
            await agent.cleanup();
            await systemStartup.shutdown();

        } catch (error) {
            error('FAIL Test failed:', error.message);
            error('Stack:', error.stack);

            if (agent) {
                await agent.cleanup();
            }

            process.exit(1);
        }
    }

    testMinimalAgent();
}