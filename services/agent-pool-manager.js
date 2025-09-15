/**
 * Agent Pool Manager - Phase 3A Implementation
 * Provides stateless, reusable agent instances for better performance
 * Eliminates agent initialization overhead through intelligent pooling
 *
 * SOLVES: Sequential Blocking Anti-Pattern by providing pre-initialized agent pools
 * PROVIDES: Stateless agent reuse, lifecycle management, resource optimization
 */

const { EventEmitter } = require('events');

/**
 * Agent Pool Manager - Manages pools of stateless, reusable agents
 */
class AgentPoolManager extends EventEmitter {
    constructor(serviceContainer, config = {}) {
        super();

        if (!serviceContainer) {
            throw new Error('ServiceContainer is required for AgentPoolManager');
        }

        this.serviceContainer = serviceContainer;
        this.config = {
            // Pool configuration
            minPoolSize: config.minPoolSize || 2,          // Minimum agents to keep warm
            maxPoolSize: config.maxPoolSize || 10,         // Maximum agents in pool
            maxIdleTime: config.maxIdleTime || 300000,     // 5 minutes idle timeout
            cleanupInterval: config.cleanupInterval || 60000, // 1 minute cleanup interval

            // Resource limits
            maxMemoryUsage: config.maxMemoryUsage || 0.8,   // 80% memory threshold
            maxConcurrentAgents: config.maxConcurrentAgents || 20,

            // Health monitoring
            healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
            enableMetrics: config.enableMetrics !== false,

            ...config
        };

        // Agent pools by type
        this.pools = new Map(); // agentType -> AgentPool
        this.activeAgents = new Map(); // agentId -> AgentInfo
        this.poolStats = new Map(); // agentType -> PoolStats

        // Resource monitoring
        this.resourceMonitor = null;
        this.cleanupTimer = null;
        this.healthCheckTimer = null;

        // Pool state
        this.isInitialized = false;
        this.isShuttingDown = false;

        console.log('🏊 AgentPoolManager created with intelligent pooling');
    }

    /**
     * Initialize the pool manager
     */
    async initialize() {
        if (this.isInitialized) {
            return this;
        }

        try {
            // Initialize resource monitoring
            this.resourceMonitor = new ResourceMonitor(this.config);

            // Start background tasks
            this.startCleanupTimer();
            this.startHealthCheckTimer();

            // Initialize default pools for common agent types
            const defaultAgentTypes = ['github', 'security', 'code', 'deploy', 'comm'];
            for (const agentType of defaultAgentTypes) {
                await this.initializePool(agentType);
            }

            this.isInitialized = true;
            this.emit('initialized', { pools: this.pools.size });

            console.log(`✅ AgentPoolManager initialized with ${this.pools.size} pools`);
            return this;

        } catch (error) {
            console.error('❌ AgentPoolManager initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Initialize a pool for a specific agent type
     */
    async initializePool(agentType) {
        if (this.pools.has(agentType)) {
            return this.pools.get(agentType);
        }

        const pool = new AgentPool(agentType, this.serviceContainer, {
            minSize: this.config.minPoolSize,
            maxSize: this.config.maxPoolSize,
            maxIdleTime: this.config.maxIdleTime
        });

        await pool.initialize();
        this.pools.set(agentType, pool);

        // Initialize stats tracking
        this.poolStats.set(agentType, {
            created: 0,
            reused: 0,
            destroyed: 0,
            activeCount: 0,
            totalRequests: 0,
            averageLifetime: 0
        });

        this.emit('poolInitialized', { agentType, pool });
        console.log(`🏊 Initialized pool for ${agentType} agents`);

        return pool;
    }

    /**
     * Get an agent from the pool (main interface)
     */
    async getAgent(agentType, sessionId, workflowId, config = {}) {
        if (!this.isInitialized) {
            throw new Error('AgentPoolManager must be initialized before getting agents');
        }

        if (this.isShuttingDown) {
            throw new Error('AgentPoolManager is shutting down');
        }

        // Check resource limits
        await this.checkResourceLimits();

        // Get or create pool for this agent type
        let pool = this.pools.get(agentType);
        if (!pool) {
            pool = await this.initializePool(agentType);
        }

        // Get agent from pool
        const agent = await pool.getAgent(sessionId, workflowId, config);

        // Track active agent
        this.activeAgents.set(agent.agentId, {
            agent,
            agentType,
            sessionId,
            workflowId,
            acquiredAt: Date.now(),
            pool
        });

        // Update stats
        const stats = this.poolStats.get(agentType);
        stats.activeCount++;
        stats.totalRequests++;

        this.emit('agentAcquired', {
            agentType,
            agentId: agent.agentId,
            sessionId,
            workflowId
        });

        console.log(`🔄 Agent acquired from pool: ${agentType} (${stats.activeCount} active)`);
        return agent;
    }

    /**
     * Return agent to pool
     */
    async returnAgent(agentId) {
        const agentInfo = this.activeAgents.get(agentId);
        if (!agentInfo) {
            console.warn(`⚠️ Attempted to return unknown agent: ${agentId}`);
            return false;
        }

        try {
            // Return to pool
            await agentInfo.pool.returnAgent(agentInfo.agent);

            // Update stats
            const stats = this.poolStats.get(agentInfo.agentType);
            stats.activeCount = Math.max(0, stats.activeCount - 1);
            stats.reused++;

            // Calculate lifetime
            const lifetime = Date.now() - agentInfo.acquiredAt;
            stats.averageLifetime = (stats.averageLifetime + lifetime) / 2;

            // Remove from active tracking
            this.activeAgents.delete(agentId);

            this.emit('agentReturned', {
                agentType: agentInfo.agentType,
                agentId,
                lifetime
            });

            console.log(`🔄 Agent returned to pool: ${agentInfo.agentType} (${stats.activeCount} active)`);
            return true;

        } catch (error) {
            console.error(`❌ Error returning agent ${agentId}:`, error.message);
            return false;
        }
    }

    /**
     * Release agent permanently (remove from pool)
     */
    async releaseAgent(agentId) {
        const agentInfo = this.activeAgents.get(agentId);
        if (!agentInfo) {
            return false;
        }

        try {
            // Cleanup agent
            await agentInfo.agent.cleanup();

            // Update stats
            const stats = this.poolStats.get(agentInfo.agentType);
            stats.activeCount = Math.max(0, stats.activeCount - 1);
            stats.destroyed++;

            // Remove from active tracking
            this.activeAgents.delete(agentId);

            this.emit('agentReleased', {
                agentType: agentInfo.agentType,
                agentId
            });

            console.log(`🗑️ Agent released permanently: ${agentInfo.agentType}`);
            return true;

        } catch (error) {
            console.error(`❌ Error releasing agent ${agentId}:`, error.message);
            return false;
        }
    }

    /**
     * Check resource limits before allocating agents
     */
    async checkResourceLimits() {
        const totalActive = this.activeAgents.size;

        // Check concurrent agent limit
        if (totalActive >= this.config.maxConcurrentAgents) {
            throw new Error(`Maximum concurrent agents limit reached: ${totalActive}/${this.config.maxConcurrentAgents}`);
        }

        // Check memory usage if resource monitor available
        if (this.resourceMonitor) {
            const memoryUsage = await this.resourceMonitor.getMemoryUsage();
            if (memoryUsage > this.config.maxMemoryUsage) {
                throw new Error(`Memory usage too high: ${(memoryUsage * 100).toFixed(1)}%`);
            }
        }
    }

    /**
     * Get pool statistics
     */
    getPoolStats() {
        const stats = {
            pools: this.pools.size,
            totalActiveAgents: this.activeAgents.size,
            pools_detail: {},
            resource_usage: null
        };

        // Add per-pool stats
        for (const [agentType, poolStats] of this.poolStats) {
            const pool = this.pools.get(agentType);
            stats.pools_detail[agentType] = {
                ...poolStats,
                poolSize: pool ? pool.size : 0,
                availableAgents: pool ? pool.available : 0
            };
        }

        // Add resource usage if available
        if (this.resourceMonitor) {
            stats.resource_usage = this.resourceMonitor.getCurrentUsage();
        }

        return stats;
    }

    /**
     * Get detailed system health
     */
    async getSystemHealth() {
        const health = {
            status: 'healthy',
            initialized: this.isInitialized,
            shutting_down: this.isShuttingDown,
            pools: this.pools.size,
            active_agents: this.activeAgents.size,
            resource_limits: {
                max_concurrent: this.config.maxConcurrentAgents,
                max_memory: this.config.maxMemoryUsage
            },
            pool_health: {}
        };

        // Check each pool health
        for (const [agentType, pool] of this.pools) {
            try {
                const poolHealth = await pool.getHealth();
                health.pool_health[agentType] = poolHealth;

                if (poolHealth.status !== 'healthy') {
                    health.status = 'degraded';
                }
            } catch (error) {
                health.pool_health[agentType] = { status: 'unhealthy', error: error.message };
                health.status = 'degraded';
            }
        }

        // Check resource monitor health
        if (this.resourceMonitor) {
            const resourceHealth = await this.resourceMonitor.getHealth();
            health.resource_monitor = resourceHealth;

            if (resourceHealth.status !== 'healthy') {
                health.status = 'degraded';
            }
        }

        return health;
    }

    /**
     * Start background cleanup timer
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(async () => {
            try {
                await this.performCleanup();
            } catch (error) {
                console.error('❌ Pool cleanup error:', error.message);
            }
        }, this.config.cleanupInterval);
    }

    /**
     * Start health check timer
     */
    startHealthCheckTimer() {
        if (!this.config.enableMetrics) return;

        this.healthCheckTimer = setInterval(async () => {
            try {
                const health = await this.getSystemHealth();
                this.emit('healthCheck', health);

                if (health.status !== 'healthy') {
                    console.warn('⚠️ Pool system health degraded:', health);
                }
            } catch (error) {
                console.error('❌ Health check error:', error.message);
            }
        }, this.config.healthCheckInterval);
    }

    /**
     * Perform cleanup of idle agents and resources
     */
    async performCleanup() {
        let cleanedUp = 0;

        for (const [agentType, pool] of this.pools) {
            try {
                const cleaned = await pool.cleanup();
                cleanedUp += cleaned;
            } catch (error) {
                console.error(`❌ Pool cleanup error for ${agentType}:`, error.message);
            }
        }

        if (cleanedUp > 0) {
            this.emit('cleanup', { cleanedAgents: cleanedUp });
            console.log(`🧹 Pool cleanup completed: ${cleanedUp} agents cleaned`);
        }
    }

    /**
     * Shutdown pool manager
     */
    async shutdown() {
        console.log('🛑 Shutting down AgentPoolManager...');
        this.isShuttingDown = true;

        // Clear timers
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        // Return all active agents
        const activeAgentIds = Array.from(this.activeAgents.keys());
        for (const agentId of activeAgentIds) {
            try {
                await this.returnAgent(agentId);
            } catch (error) {
                console.warn(`⚠️ Error returning agent during shutdown: ${agentId}`);
            }
        }

        // Shutdown all pools
        for (const [agentType, pool] of this.pools) {
            try {
                await pool.shutdown();
                console.log(`✅ Pool ${agentType} shutdown complete`);
            } catch (error) {
                console.error(`❌ Error shutting down pool ${agentType}:`, error.message);
            }
        }

        this.pools.clear();
        this.activeAgents.clear();
        this.poolStats.clear();
        this.isInitialized = false;

        this.emit('shutdown');
        console.log('✅ AgentPoolManager shutdown complete');
    }
}

/**
 * Individual Agent Pool - manages agents of a specific type
 */
class AgentPool {
    constructor(agentType, serviceContainer, config = {}) {
        this.agentType = agentType;
        this.serviceContainer = serviceContainer;
        this.config = {
            minSize: config.minSize || 2,
            maxSize: config.maxSize || 10,
            maxIdleTime: config.maxIdleTime || 300000,
            ...config
        };

        this.availableAgents = []; // Ready-to-use agents
        this.inUseAgents = new Map(); // Currently assigned agents
        this.totalCreated = 0;
        this.isInitialized = false;
    }

    /**
     * Initialize the pool with minimum agents
     */
    async initialize() {
        if (this.isInitialized) return;

        // Pre-create minimum pool size
        for (let i = 0; i < this.config.minSize; i++) {
            try {
                const agent = await this.createAgent();
                this.availableAgents.push({
                    agent,
                    createdAt: Date.now(),
                    lastUsed: Date.now()
                });
            } catch (error) {
                console.error(`❌ Error pre-creating ${this.agentType} agent:`, error.message);
            }
        }

        this.isInitialized = true;
        console.log(`✅ Pool initialized for ${this.agentType}: ${this.availableAgents.length} agents ready`);
    }

    /**
     * Get agent from pool
     */
    async getAgent(sessionId, workflowId, config = {}) {
        // Try to get from available pool first
        let agentInfo = this.availableAgents.shift();

        if (!agentInfo) {
            // Create new agent if under max limit
            if (this.totalCreated < this.config.maxSize) {
                const agent = await this.createAgent();
                agentInfo = {
                    agent,
                    createdAt: Date.now(),
                    lastUsed: Date.now()
                };
            } else {
                throw new Error(`Maximum pool size reached for ${this.agentType}: ${this.config.maxSize}`);
            }
        }

        // Configure agent for this usage
        await this.configureAgentForUse(agentInfo.agent, sessionId, workflowId, config);

        // Track as in use
        this.inUseAgents.set(agentInfo.agent.agentId, {
            ...agentInfo,
            assignedAt: Date.now(),
            sessionId,
            workflowId
        });

        agentInfo.lastUsed = Date.now();
        return agentInfo.agent;
    }

    /**
     * Return agent to available pool
     */
    async returnAgent(agent) {
        const agentInfo = this.inUseAgents.get(agent.agentId);
        if (!agentInfo) {
            console.warn(`⚠️ Attempted to return unknown agent to ${this.agentType} pool`);
            return false;
        }

        try {
            // Reset agent to clean state
            await this.resetAgentState(agent);

            // Move back to available pool
            this.inUseAgents.delete(agent.agentId);
            this.availableAgents.push({
                agent,
                createdAt: agentInfo.createdAt,
                lastUsed: Date.now()
            });

            return true;

        } catch (error) {
            console.error(`❌ Error returning ${this.agentType} agent:`, error.message);
            // If reset fails, destroy the agent
            await this.destroyAgent(agent);
            this.inUseAgents.delete(agent.agentId);
            return false;
        }
    }

    /**
     * Create new agent instance
     */
    async createAgent() {
        // Import the enhanced agent factory
        const { EnhancedAgentFactory } = require('../enhanced-agent-factory');

        const factory = new EnhancedAgentFactory();
        await factory.initialize();

        const sessionId = `pool_${this.agentType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const agent = await factory.createAgent(this.agentType, sessionId);

        this.totalCreated++;
        return agent;
    }

    /**
     * Configure agent for specific usage
     */
    async configureAgentForUse(agent, sessionId, workflowId, config) {
        // Update agent configuration for this usage
        agent.sessionId = sessionId;
        if (workflowId && typeof agent.setWorkflowId === 'function') {
            agent.setWorkflowId(workflowId);
        }

        // Apply any additional configuration
        if (config && Object.keys(config).length > 0) {
            agent.config = { ...agent.config, ...config };
        }
    }

    /**
     * Reset agent to clean state for reuse
     */
    async resetAgentState(agent) {
        // Reset agent state
        agent.state = 'idle';
        agent.progress = 0;
        agent.currentStep = '';
        agent.result = null;
        agent.error = null;
        agent.executionSteps = [];

        // Clear any context data but keep the agent structure
        // The partition will be cleaned up by the ServiceContainer
    }

    /**
     * Cleanup idle agents
     */
    async cleanup() {
        const now = Date.now();
        let cleaned = 0;

        // Clean up idle agents that exceed max idle time
        this.availableAgents = this.availableAgents.filter(agentInfo => {
            const idleTime = now - agentInfo.lastUsed;
            if (idleTime > this.config.maxIdleTime && this.availableAgents.length > this.config.minSize) {
                this.destroyAgent(agentInfo.agent);
                cleaned++;
                return false;
            }
            return true;
        });

        return cleaned;
    }

    /**
     * Destroy agent instance
     */
    async destroyAgent(agent) {
        try {
            if (typeof agent.cleanup === 'function') {
                await agent.cleanup();
            }
            this.totalCreated = Math.max(0, this.totalCreated - 1);
        } catch (error) {
            console.error(`❌ Error destroying ${this.agentType} agent:`, error.message);
        }
    }

    /**
     * Get pool health
     */
    async getHealth() {
        return {
            status: 'healthy',
            agentType: this.agentType,
            available: this.availableAgents.length,
            inUse: this.inUseAgents.size,
            total: this.totalCreated,
            config: this.config
        };
    }

    /**
     * Get pool size
     */
    get size() {
        return this.totalCreated;
    }

    /**
     * Get available count
     */
    get available() {
        return this.availableAgents.length;
    }

    /**
     * Shutdown pool
     */
    async shutdown() {
        // Clean up all agents
        for (const agentInfo of this.availableAgents) {
            await this.destroyAgent(agentInfo.agent);
        }

        for (const [agentId, agentInfo] of this.inUseAgents) {
            await this.destroyAgent(agentInfo.agent);
        }

        this.availableAgents = [];
        this.inUseAgents.clear();
        this.totalCreated = 0;
        this.isInitialized = false;
    }
}

/**
 * Resource Monitor - monitors system resources
 */
class ResourceMonitor {
    constructor(config = {}) {
        this.config = config;
        this.lastMetrics = null;
    }

    /**
     * Get current memory usage
     */
    async getMemoryUsage() {
        const usage = process.memoryUsage();
        const totalMemory = require('os').totalmem();
        return usage.rss / totalMemory;
    }

    /**
     * Get current resource usage
     */
    getCurrentUsage() {
        const usage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
            memory: {
                rss: usage.rss,
                heapTotal: usage.heapTotal,
                heapUsed: usage.heapUsed,
                external: usage.external
            },
            cpu: cpuUsage,
            uptime: process.uptime(),
            timestamp: Date.now()
        };
    }

    /**
     * Get resource monitor health
     */
    async getHealth() {
        try {
            const memoryUsage = await this.getMemoryUsage();

            return {
                status: memoryUsage < 0.9 ? 'healthy' : 'warning',
                memoryUsage: Math.round(memoryUsage * 100),
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
}

module.exports = {
    AgentPoolManager,
    AgentPool,
    ResourceMonitor
};