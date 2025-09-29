/**
 * Global Context Manager - Singleton for preventing context duplication
 * Addresses the core issue where each agent creates its own context system
 */

const { Factor3ContextManager } = require('../context-management/factor3-context-manager');

class GlobalContextManager {
    constructor() {
        if (GlobalContextManager.instance) {
            return GlobalContextManager.instance;
        }

        this.sharedContextManager = null;
        this.agentCount = 0;
        this.contextSharing = new Map(); // agentId -> shared context reference

        GlobalContextManager.instance = this;
        return this;
    }

    /**
     * Get or create shared context manager for multi-agent workflows
     */
    getSharedContext(agentId, options = {}) {
        // Create shared context manager if it doesn't exist
        if (!this.sharedContextManager) {
            console.log('🔧 Creating shared context manager for multi-agent workflow');
            this.sharedContextManager = new Factor3ContextManager({
                contextId: `shared_workflow_${Date.now()}`,
                contextScope: options.contextScope || 'session',
                ...options
            });
        }

        // Register agent with shared context
        this.contextSharing.set(agentId, this.sharedContextManager);
        this.agentCount++;

        console.log(`🔗 Agent ${agentId} connected to shared context (${this.agentCount} agents)`);

        return this.sharedContextManager;
    }

    /**
     * Release agent from shared context
     */
    releaseAgent(agentId) {
        if (this.contextSharing.has(agentId)) {
            this.contextSharing.delete(agentId);
            this.agentCount--;

            console.log(`🔌 Agent ${agentId} disconnected from shared context (${this.agentCount} agents remaining)`);

            // Clean up shared context if no agents remain
            if (this.agentCount === 0) {
                console.log('🧹 All agents disconnected - cleaning up shared context');
                this.sharedContextManager = null;
            }
        }
    }

    /**
     * Get current shared context stats
     */
    getContextStats() {
        if (!this.sharedContextManager) {
            return { active: false, agents: 0 };
        }

        return {
            active: true,
            agents: this.agentCount,
            contextId: this.sharedContextManager.contextId,
            events: this.sharedContextManager.events.length,
            tokenUsage: this.sharedContextManager.tokenUsage
        };
    }

    /**
     * Force cleanup of shared context
     */
    cleanup() {
        console.log('🧹 Force cleanup of global context manager');
        this.sharedContextManager = null;
        this.agentCount = 0;
        this.contextSharing.clear();
    }

    /**
     * Create individual context for agents that need isolation
     */
    createIsolatedContext(agentId, options = {}) {
        const contextManager = new Factor3ContextManager({
            contextId: `isolated_${agentId}_${Date.now()}`,
            // Disable monitoring to prevent duplication
            enableMonitoring: false,
            ...options
        });

        console.log(`🔒 Created isolated context for agent ${agentId}`);
        return contextManager;
    }
}

// Singleton instance
GlobalContextManager.instance = null;

module.exports = { GlobalContextManager };