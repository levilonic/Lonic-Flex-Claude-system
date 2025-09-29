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
const { TwelveFactorCompliance } = require('../core/12-factor-compliance-tracker');
const DocumentationService = require('./documentation-service');
const { LonicFlexLogger } = require('./logger');
const { info, warn, error } = require('./logger');

// Import for context management
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
// REMOVED: Direct imports that cause circular dependencies
// const { AgentPoolManager } = require('./agent-pool-manager');
// const { WorkflowOrchestrator } = require('./workflow-orchestrator');
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
        this.logger = null;
    }

    /**
     * Initialize all shared services (call once at system startup)
     */
    async initialize() {
        if (this.initialized) {
            return this;
        }

        try {
            // Initialize logger service FIRST (required by all other services)
            const lonicFlexLogger = new LonicFlexLogger();
            this.registerService('logger', lonicFlexLogger);
            this.logger = lonicFlexLogger.createContextLogger({
                category: 'system',
                component: 'ServiceContainer'
            });
            this.logger.info('ServiceContainer initialization started');

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

            // Context manager (using Factor3ContextManager as primary)
            const contextManager = new Factor3ContextManager({
                contextScope: 'system',
                contextId: `service_container_${Date.now()}`
            });
            this.registerService('contextManager', contextManager);

            // Phase 2: Agent Lifecycle Management services
            // Use lazy initialization to break circular dependencies
            await this.initializeAgentLifecycleServices();

            // Phase 3: Infrastructure Management services
            const healthMonitor = new HealthMonitor(this);
            await healthMonitor.loadMetrics();
            this.registerService('healthMonitor', healthMonitor);

            this.initialized = true;
            this.logger.info('ServiceContainer initialized with Phase 3 infrastructure management services', {
                totalServices: this.services.size,
                phase: 'Phase 3'
            });

            return this;

        } catch (initError) {
            if (this.logger) {
                this.logger.error('ServiceContainer initialization failed', { error: initError.message });
            } else {
                error('❌ ServiceContainer initialization failed:', initError.message);
            }
            throw initError;
        }
    }

    /**
     * Initialize agent lifecycle services with lazy loading to prevent circular dependencies
     */
    async initializeAgentLifecycleServices() {
        try {
            // Step 1: Initialize AgentPoolManager first (no dependencies on others)
            const { AgentPoolManager } = require('./agent-pool-manager');
            const agentPoolManager = new AgentPoolManager(this);
            await agentPoolManager.initialize();
            this.registerService('agentPoolManager', agentPoolManager);
            this.logger.info('AgentPoolManager initialized successfully');

            // Step 2: Initialize WorkflowOrchestrator with AgentPoolManager available
            const { WorkflowOrchestrator } = require('./workflow-orchestrator');
            const workflowOrchestrator = new WorkflowOrchestrator(this);
            await workflowOrchestrator.initialize();
            this.registerService('workflowOrchestrator', workflowOrchestrator);
            this.logger.info('WorkflowOrchestrator initialized successfully');

        } catch (error) {
            this.logger.error('Agent lifecycle services initialization failed', {
                error: error.message,
                continuingWithoutServices: true
            });
            this.logger.warn('ServiceContainer continuing without agent lifecycle services');
        }
    }

    /**
     * Register a service instance
     */
    registerService(name, instance) {
        this.services.set(name, instance);
        if (this.logger) {
            this.logger.info(`Service registered: ${name}`, {
                totalServices: this.services.size
            });
        } else {
            // Fallback for logger service registration itself
            info(`Service registered: ${name} (${this.services.size} total services)`);
        }
    }

    /**
     * Get a service instance
     */
    getService(name) {
        if (!this.initialized) {
            throw new Error('ServiceContainer must be initialized before getting services');
        }

        return this._getServiceInternal(name);
    }

    /**
     * Internal service getter that bypasses initialization check for bootstrap
     */
    _getServiceInternal(name) {
        const service = this.services.get(name);
        if (!service) {
            const availableServices = Array.from(this.services.keys());
            if (this.logger) {
                this.logger.error(`Service '${name}' not found`, {
                    requestedService: name,
                    availableServices
                });
            } else {
                info(`❌ Service '${name}' not found. Available services: [${availableServices.join(', ')}]`);
            }
            throw new Error(`Service '${name}' not found in container`);
        }

        if (this.logger) {
            this.logger.debug(`Service retrieved: ${name}`);
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
     * Create workflow context for isolated task execution
     * Simplified context management using Factor3ContextManager
     */
    async createWorkflowPartition(workflowId, config = {}) {
        if (!this.initialized) {
            throw new Error('ServiceContainer must be initialized before creating partitions');
        }

        if (this.workflowPartitions.has(workflowId)) {
            throw new Error(`Workflow partition '${workflowId}' already exists`);
        }

        // Create a new Factor3ContextManager for this workflow
        const workflowContext = new Factor3ContextManager({
            contextScope: 'workflow',
            contextId: workflowId,
            ...config
        });

        this.workflowPartitions.set(workflowId, workflowContext);

        this.logger.info('Created isolated context for workflow', {
            workflowId: typeof workflowId === 'object' ? '[object]' : workflowId,
            contextType: 'workflow'
        });
        return workflowContext;
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

        // Factor3ContextManager cleanup (if it has cleanup methods)
        if (partition && typeof partition.cleanup === 'function') {
            await partition.cleanup();
        }

        this.workflowPartitions.delete(workflowId);
        this.logger.info('Cleaned up workflow context', {
            workflowId: workflowId
        });
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
        if (this.logger) {
            this.logger.info('ServiceContainer shutting down', {
                workflowPartitions: this.workflowPartitions.size,
                services: this.services.size
            });
        } else {
            info('ServiceContainer shutting down...');
        }

        // Cleanup all workflow partitions
        for (const workflowId of this.workflowPartitions.keys()) {
            await this.cleanupWorkflowPartition(workflowId);
        }

        // Shutdown services in reverse order
        const db = this.services.get('database');
        if (db && typeof db.close === 'function') {
            await db.close();
        }

        // Shutdown logger last
        const logger = this.services.get('logger');
        if (this.logger && typeof this.logger.shutdown === 'function') {
            await this.logger.shutdown();
        }

        this.services.clear();
        this.workflowPartitions.clear();
        this.initialized = false;
        this.logger = null;

        info('ServiceContainer shutdown complete');
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