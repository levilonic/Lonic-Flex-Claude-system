/**
 * Claude Core Integration - Main Entry Point
 * Consolidates: claude-integration.js, claude-multi-agent-core.js, claude-multi-agent-core-clean.js
 * Provides: Main Claude integration hub, multi-agent coordination, clean core services
 */

const { info, warn, error } = require('../../../src/services/logger');
const { initializeGlobalServiceContainer } = require('../../../src/services/service-container');

class ClaudeCore {
    constructor() {
        this.serviceContainer = null;
        this.initialized = false;
        this.multiAgentCoordination = null;
        this.systemStartup = null;
    }

    /**
     * Initialize Claude Core with ServiceContainer integration
     */
    async initialize() {
        if (this.initialized) {
            return this;
        }

        try {
            info('🚀 Initializing Claude Core Integration...');

            // Initialize ServiceContainer for dependency injection
            this.serviceContainer = await initializeGlobalServiceContainer();

            // Initialize multi-agent coordination
            await this.initializeMultiAgentCoordination();

            this.initialized = true;
            info('✅ Claude Core Integration initialized successfully');
            return this;

        } catch (initError) {
            error('❌ Claude Core initialization failed', { error: initError.message });
            throw initError;
        }
    }

    /**
     * Initialize multi-agent coordination system
     */
    async initializeMultiAgentCoordination() {
        try {
            // Get agent pool manager and workflow orchestrator from service container
            const agentPoolManager = this.serviceContainer.getAgentPoolManager();
            const workflowOrchestrator = this.serviceContainer.getWorkflowOrchestrator();

            this.multiAgentCoordination = {
                agentPoolManager,
                workflowOrchestrator,
                initialized: true
            };

            info('✅ Multi-agent coordination system initialized');

        } catch (error) {
            warn('⚠️ Multi-agent coordination initialization failed', { error: error.message });
            // Continue without multi-agent coordination
            this.multiAgentCoordination = { initialized: false };
        }
    }

    /**
     * Get service from container
     */
    getService(serviceName) {
        if (!this.initialized) {
            throw new Error('Claude Core must be initialized before getting services');
        }
        return this.serviceContainer.getService(serviceName);
    }

    /**
     * Create workflow partition for isolated execution
     */
    async createWorkflowPartition(workflowId, config = {}) {
        if (!this.initialized) {
            throw new Error('Claude Core must be initialized before creating partitions');
        }

        return await this.serviceContainer.createWorkflowPartition(workflowId, config);
    }

    /**
     * Get system health status
     */
    async getSystemHealth() {
        if (!this.initialized) {
            return { status: 'not_initialized', core: false };
        }

        const containerHealth = await this.serviceContainer.getSystemHealth();

        return {
            ...containerHealth,
            core: {
                initialized: this.initialized,
                multiAgentCoordination: this.multiAgentCoordination?.initialized || false
            }
        };
    }

    /**
     * Shutdown Claude Core and cleanup resources
     */
    async shutdown() {
        if (!this.initialized) {
            return;
        }

        info('🔄 Shutting down Claude Core Integration...');

        if (this.serviceContainer) {
            await this.serviceContainer.shutdown();
        }

        this.initialized = false;
        this.serviceContainer = null;
        this.multiAgentCoordination = null;

        info('✅ Claude Core shutdown complete');
    }
}

// Singleton instance
let claudeCoreInstance = null;

/**
 * Get global Claude Core instance
 */
function getClaudeCoreInstance() {
    if (!claudeCoreInstance) {
        claudeCoreInstance = new ClaudeCore();
    }
    return claudeCoreInstance;
}

/**
 * Initialize global Claude Core (call once at startup)
 */
async function initializeClaudeCore() {
    const core = getClaudeCoreInstance();
    await core.initialize();
    return core;
}

module.exports = {
    ClaudeCore,
    getClaudeCoreInstance,
    initializeClaudeCore
};

// Demo functionality
if (require.main === module) {
    async function demoClaudeCore() {
        info('🧪 Claude Core Integration Demo');

        const core = await initializeClaudeCore();
        const health = await core.getSystemHealth();

        info('System Health:', health);
        info('Demo complete - core ready for integration');

        await core.shutdown();
    }

    demoClaudeCore().catch(console.error);
}