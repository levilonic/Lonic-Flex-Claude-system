/**
 * PartitionedContextManager - Solves Context Explosion Anti-Pattern
 * Replaces shared Factor3ContextManager with isolated partitions per workflow
 * Each workflow gets its own context partition with full isolation
 * Infrastructure is shared but context events remain completely separate
 */

const { Factor3ContextManager } = require('../../src/context-management/factor3-context-manager');

/**
 * Context Partition - Isolated context for a single workflow
 */
class ContextPartition {
    constructor(workflowId, serviceContainer, config = {}) {
        this.workflowId = workflowId;
        this.serviceContainer = serviceContainer;
        this.config = config;

        // Create isolated Factor3ContextManager for this partition
        this.contextManager = new Factor3ContextManager({
            contextId: `partition_${workflowId}`,
            contextScope: config.contextScope || 'session',
            // Use shared services from container
            tokenCounter: serviceContainer.getTokenCounterService(),
            enableMonitoring: false // Prevent duplicate monitoring
        });

        // Agent tracking within this partition
        this.registeredAgents = new Set();
        this.agentContexts = new Map();

        // Partition state
        this.created = Date.now();
        this.lastActivity = Date.now();
        this.status = 'active';

        console.log(`🔧 Created isolated partition: ${typeof workflowId === 'object' ? '[object]' : workflowId}`);
    }

    /**
     * Register an agent with this partition
     */
    registerAgent(agentId, agentConfig = {}) {
        this.registeredAgents.add(agentId);
        this.agentContexts.set(agentId, {
            registered: Date.now(),
            config: agentConfig,
            lastActivity: Date.now()
        });

        this.lastActivity = Date.now();
        console.log(`🔗 Agent ${agentId} registered with partition: ${this.workflowId}`);

        return this.contextManager;
    }

    /**
     * Unregister an agent from this partition
     */
    unregisterAgent(agentId) {
        if (this.registeredAgents.has(agentId)) {
            this.registeredAgents.delete(agentId);
            this.agentContexts.delete(agentId);
            console.log(`🔌 Agent ${agentId} unregistered from partition: ${this.workflowId}`);
        }
    }

    /**
     * Get context manager for agent operations
     */
    getContextManager() {
        this.lastActivity = Date.now();
        return this.contextManager;
    }

    /**
     * Add event to partition context
     */
    async addEvent(type, data) {
        this.lastActivity = Date.now();
        return await this.contextManager.addEvent(type, data);
    }

    /**
     * Get partition statistics
     */
    getStats() {
        return {
            workflowId: this.workflowId,
            status: this.status,
            registeredAgents: this.registeredAgents.size,
            agentList: Array.from(this.registeredAgents),
            events: this.contextManager.events.length,
            created: this.created,
            lastActivity: this.lastActivity,
            ageMinutes: Math.floor((Date.now() - this.created) / 60000),
            idleMinutes: Math.floor((Date.now() - this.lastActivity) / 60000),
            tokenUsage: this.contextManager.tokenUsage
        };
    }

    /**
     * Cleanup partition resources
     */
    async cleanup() {
        this.status = 'cleanup';

        // Cleanup all agent registrations
        for (const agentId of this.registeredAgents) {
            this.unregisterAgent(agentId);
        }

        // Cleanup context manager if it has cleanup method
        if (typeof this.contextManager.cleanup === 'function') {
            await this.contextManager.cleanup();
        }

        this.status = 'disposed';
        console.log(`🧹 Partition ${this.workflowId} cleanup complete`);
    }
}

/**
 * PartitionedContextManager - Manages isolated context partitions
 * Replaces the Heavy Agent Anti-Pattern with lightweight service consumption
 */
class PartitionedContextManager {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.partitions = new Map();
        this.partitionCount = 0;
        this.initialized = false;

        // Cleanup configuration
        this.maxIdleMinutes = 30; // Cleanup partitions idle for 30+ minutes
        this.cleanupInterval = null;

        console.log('✅ PartitionedContextManager created');
    }

    /**
     * Initialize partition manager
     */
    async initialize() {
        if (this.initialized) {
            return this;
        }

        // Start periodic cleanup of idle partitions
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdlePartitions();
        }, 5 * 60 * 1000); // Check every 5 minutes

        this.initialized = true;
        console.log('✅ PartitionedContextManager initialized');
        return this;
    }

    /**
     * Create new isolated partition for workflow
     */
    async createPartition(workflowId, config = {}) {
        if (this.partitions.has(workflowId)) {
            console.log(`⚠️ Partition ${workflowId} already exists, returning existing`);
            return this.partitions.get(workflowId);
        }

        const partition = new ContextPartition(workflowId, this.serviceContainer, config);
        this.partitions.set(workflowId, partition);
        this.partitionCount++;

        console.log(`🏗️ Created partition ${workflowId} (${this.partitionCount} total)`);
        return partition;
    }

    /**
     * Get existing partition
     */
    getPartition(workflowId) {
        const partition = this.partitions.get(workflowId);
        if (!partition) {
            throw new Error(`Partition '${workflowId}' not found`);
        }
        return partition;
    }

    /**
     * Get context manager for agent in specific workflow
     */
    getAgentContext(workflowId, agentId, agentConfig = {}) {
        const partition = this.getPartition(workflowId);
        return partition.registerAgent(agentId, agentConfig);
    }

    /**
     * Release agent from partition
     */
    releaseAgent(workflowId, agentId) {
        const partition = this.partitions.get(workflowId);
        if (partition) {
            partition.unregisterAgent(agentId);
        }
    }

    /**
     * Cleanup specific partition
     */
    async cleanupPartition(workflowId) {
        const partition = this.partitions.get(workflowId);
        if (!partition) {
            return; // Already cleaned up
        }

        await partition.cleanup();
        this.partitions.delete(workflowId);
        this.partitionCount--;

        console.log(`🧹 Cleaned up partition: ${workflowId} (${this.partitionCount} remaining)`);
    }

    /**
     * Cleanup idle partitions automatically
     */
    async cleanupIdlePartitions() {
        const now = Date.now();
        const toCleanup = [];

        for (const [workflowId, partition] of this.partitions.entries()) {
            const stats = partition.getStats();

            // Cleanup if idle too long and no active agents
            if (stats.idleMinutes >= this.maxIdleMinutes && stats.registeredAgents === 0) {
                toCleanup.push(workflowId);
            }
        }

        if (toCleanup.length > 0) {
            console.log(`🧹 Auto-cleaning ${toCleanup.length} idle partitions`);
            for (const workflowId of toCleanup) {
                await this.cleanupPartition(workflowId);
            }
        }
    }

    /**
     * Get all partition statistics
     */
    getAllStats() {
        const stats = {
            totalPartitions: this.partitionCount,
            activePartitions: this.partitions.size,
            partitions: []
        };

        for (const [workflowId, partition] of this.partitions.entries()) {
            stats.partitions.push(partition.getStats());
        }

        return stats;
    }

    /**
     * Get system health for context partitioning
     */
    async getHealth() {
        const stats = this.getAllStats();

        let status = 'healthy';
        const warnings = [];

        // Check for excessive partition count
        if (stats.totalPartitions > 10) {
            status = 'warning';
            warnings.push(`High partition count: ${stats.totalPartitions}`);
        }

        // Check for memory leaks (partitions not being cleaned up)
        const idlePartitions = stats.partitions.filter(p =>
            p.idleMinutes > this.maxIdleMinutes && p.registeredAgents === 0
        ).length;

        if (idlePartitions > 0) {
            status = 'warning';
            warnings.push(`${idlePartitions} partitions should be cleaned up`);
        }

        return {
            status,
            warnings,
            stats,
            maxIdleMinutes: this.maxIdleMinutes
        };
    }

    /**
     * Force cleanup all partitions
     */
    async cleanup() {
        console.log(`🧹 PartitionedContextManager cleanup: ${this.partitions.size} partitions`);

        // Stop cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Cleanup all partitions
        const cleanupPromises = [];
        for (const workflowId of this.partitions.keys()) {
            cleanupPromises.push(this.cleanupPartition(workflowId));
        }

        await Promise.all(cleanupPromises);

        this.initialized = false;
        console.log('✅ PartitionedContextManager cleanup complete');
    }

    /**
     * Get partition for agent (creates if doesn't exist)
     */
    async getOrCreatePartitionForAgent(agentId, workflowId = null) {
        // If no workflow specified, create one based on agent
        if (!workflowId) {
            workflowId = `workflow_${agentId}_${Date.now()}`;
        }

        let partition = this.partitions.get(workflowId);
        if (!partition) {
            partition = await this.createPartition(workflowId);
        }

        return partition.registerAgent(agentId);
    }
}

module.exports = {
    PartitionedContextManager,
    ContextPartition
};