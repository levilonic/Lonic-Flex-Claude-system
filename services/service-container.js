/**
 * ServiceContainer - Dependency Injection Foundation
 * Solves the Heavy Agent Anti-Pattern by providing shared infrastructure services
 * Replaces: Each agent creating its own GlobalContextManager, MemoryManager, etc.
 * With: Single container providing shared service instances
 */

const { SQLiteManager } = require('../database/sqlite-manager');
const { MemoryManager } = require('../memory/memory-manager');
const { TokenCounter } = require('../context-management/token-counter');
const { ContextWindowMonitor } = require('../context-management/context-window-monitor');
const { TwelveFactorCompliance } = require('../12-factor-compliance-tracker');
const DocumentationService = require('./documentation-service');

// Import for PartitionedContextManager
const { PartitionedContextManager } = require('./partitioned-context-manager');
const { AgentPoolManager } = require('./agent-pool-manager');
const { WorkflowOrchestrator } = require('./workflow-orchestrator');
const { HealthMonitor } = require('./health-monitor');

/**
 * ServiceContainer provides dependency injection for LonicFLex agents
 * Eliminates resource duplication and context explosion
 */
class ServiceContainer {
    constructor() {
        this.services = new Map();
        this.workflowPartitions = new Map();
        this.initialized = false;
    }

    /**
     * Initialize all shared services (call once at system startup)
     */
    async initialize() {
        if (this.initialized) {
            return this;
        }

        try {
            // Core database service (single instance for all agents)
            const sqliteManager = new SQLiteManager();
            await sqliteManager.initialize();
            this.registerService('database', sqliteManager);

            // Memory management service (shared across agents)
            const memoryManager = new MemoryManager();
            this.registerService('memory', memoryManager);

            // Token counting service (prevents duplication across agents)
            const tokenCounter = new TokenCounter();
            this.registerService('tokenCounter', tokenCounter);

            // Context window monitoring (system-wide monitoring)
            const contextMonitor = new ContextWindowMonitor();
            this.registerService('contextMonitor', contextMonitor);

            // 12-Factor compliance tracking (shared compliance checking)
            const compliance = new TwelveFactorCompliance();
            this.registerService('compliance', compliance);

            // Documentation service (singleton pattern)
            const docs = DocumentationService.getInstance();
            this.registerService('documentation', docs);

            // Partitioned context manager (replaces shared context)
            const partitionedContextManager = new PartitionedContextManager(this);
            await partitionedContextManager.initialize();
            this.registerService('contextManager', partitionedContextManager);

            // Phase 2: Agent Lifecycle Management services
            // Note: AgentPoolManager has circular dependency - needs refactoring
            // const agentPoolManager = new AgentPoolManager(this);
            // await agentPoolManager.initialize();
            // this.registerService('agentPoolManager', agentPoolManager);

            const workflowOrchestrator = new WorkflowOrchestrator(this);
            await workflowOrchestrator.initialize();
            this.registerService('workflowOrchestrator', workflowOrchestrator);

            // Phase 3: Infrastructure Management services
            const healthMonitor = new HealthMonitor(this);
            await healthMonitor.loadMetrics();
            this.registerService('healthMonitor', healthMonitor);

            this.initialized = true;
            console.log('✅ ServiceContainer initialized with Phase 3 infrastructure management services');

            return this;

        } catch (error) {
            console.error('❌ ServiceContainer initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Register a service instance
     */
    registerService(name, instance) {
        this.services.set(name, instance);
    }

    /**
     * Get a service instance
     */
    getService(name) {
        if (!this.initialized) {
            throw new Error('ServiceContainer must be initialized before getting services');
        }

        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service '${name}' not found in container`);
        }
        return service;
    }

    /**
     * Get database service (most commonly used)
     */
    getDatabaseService() {
        return this.getService('database');
    }

    /**
     * Get memory management service
     */
    getMemoryService() {
        return this.getService('memory');
    }

    /**
     * Get token counter service
     */
    getTokenCounterService() {
        return this.getService('tokenCounter');
    }

    /**
     * Get context monitoring service
     */
    getContextMonitorService() {
        return this.getService('contextMonitor');
    }

    /**
     * Get compliance tracking service
     */
    getComplianceService() {
        return this.getService('compliance');
    }

    /**
     * Get documentation service
     */
    getDocumentationService() {
        return this.getService('documentation');
    }

    /**
     * Get agent pool manager (Phase 2)
     */
    getAgentPoolManager() {
        return this.getService('agentPoolManager');
    }

    /**
     * Get workflow orchestrator (Phase 2)
     */
    getWorkflowOrchestrator() {
        return this.getService('workflowOrchestrator');
    }

    /**
     * Get health monitor (Phase 3)
     */
    getHealthMonitor() {
        return this.getService('healthMonitor');
    }

    /**
     * Create isolated context partition for a workflow
     * Solves Context Explosion Anti-Pattern by providing isolation
     */
    async createWorkflowPartition(workflowId, config = {}) {
        if (!this.initialized) {
            throw new Error('ServiceContainer must be initialized before creating partitions');
        }

        if (this.workflowPartitions.has(workflowId)) {
            throw new Error(`Workflow partition '${workflowId}' already exists`);
        }

        const contextManager = this.getService('contextManager');
        if (!contextManager) {
            throw new Error('PartitionedContextManager not available');
        }

        const partition = await contextManager.createPartition(workflowId, config);
        this.workflowPartitions.set(workflowId, partition);

        console.log(`🔧 Created isolated partition for workflow: ${typeof workflowId === 'object' ? '[object]' : workflowId}`);
        return partition;
    }

    /**
     * Get existing workflow partition
     */
    getWorkflowPartition(workflowId) {
        const partition = this.workflowPartitions.get(workflowId);
        if (!partition) {
            throw new Error(`Workflow partition '${workflowId}' not found`);
        }
        return partition;
    }

    /**
     * Clean up workflow partition when workflow completes
     */
    async cleanupWorkflowPartition(workflowId) {
        const partition = this.workflowPartitions.get(workflowId);
        if (!partition) {
            return; // Already cleaned up
        }

        const contextManager = this.getService('contextManager');
        if (contextManager && typeof contextManager.cleanupPartition === 'function') {
            await contextManager.cleanupPartition(workflowId);
        }

        this.workflowPartitions.delete(workflowId);
        console.log(`🧹 Cleaned up partition for workflow: ${workflowId}`);
    }

    /**
     * Get system health status
     */
    async getSystemHealth() {
        if (!this.initialized) {
            return { status: 'not_initialized', services: 0 };
        }

        const health = {
            status: 'healthy',
            services: this.services.size,
            activePartitions: this.workflowPartitions.size,
            services_status: {}
        };

        // Check database health
        try {
            const db = this.getDatabaseService();
            await db.healthCheck();
            health.services_status.database = 'healthy';
        } catch (error) {
            health.services_status.database = 'unhealthy';
            health.status = 'degraded';
        }

        // Check memory service health
        try {
            const memory = this.getMemoryService();
            const memoryStats = await memory.getMemoryStats();
            health.services_status.memory = 'healthy';
            health.memory_usage = memoryStats;
        } catch (error) {
            health.services_status.memory = 'unhealthy';
            health.status = 'degraded';
        }

        return health;
    }

    /**
     * Shutdown and cleanup all services
     */
    async shutdown() {
        console.log('🔧 ServiceContainer shutting down...');

        // Cleanup all workflow partitions
        for (const workflowId of this.workflowPartitions.keys()) {
            await this.cleanupWorkflowPartition(workflowId);
        }

        // Shutdown services in reverse order
        const db = this.services.get('database');
        if (db && typeof db.close === 'function') {
            await db.close();
        }

        this.services.clear();
        this.workflowPartitions.clear();
        this.initialized = false;

        console.log('✅ ServiceContainer shutdown complete');
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            initialized: this.initialized,
            total_services: this.services.size,
            active_partitions: this.workflowPartitions.size,
            registered_services: Array.from(this.services.keys()),
            active_workflow_ids: Array.from(this.workflowPartitions.keys())
        };
    }
}

// Singleton instance for system-wide usage
let globalServiceContainer = null;

/**
 * Get global service container instance (singleton pattern)
 */
function getGlobalServiceContainer() {
    if (!globalServiceContainer) {
        globalServiceContainer = new ServiceContainer();
    }
    return globalServiceContainer;
}

/**
 * Initialize global service container (call once at system startup)
 */
async function initializeGlobalServiceContainer() {
    const container = getGlobalServiceContainer();
    await container.initialize();
    return container;
}

module.exports = {
    ServiceContainer,
    getGlobalServiceContainer,
    initializeGlobalServiceContainer
};