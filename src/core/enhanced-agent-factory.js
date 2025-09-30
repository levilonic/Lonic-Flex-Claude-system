const { info, warn, error } = require('../services/logger');
/**
 * Enhanced Agent Factory - Production Deployment Ready
 * Provides seamless switching between Original and Enhanced agents
 * Supports ServiceContainer architecture with fallback compatibility
 */

const { ServiceContainer } = require('../services/service-container');

/**
 * Enhanced Agent Factory for Production Deployment
 */
class EnhancedAgentFactory {
    constructor(configOrServiceContainer = {}) {
        // Handle both: new EnhancedAgentFactory(serviceContainer) or new EnhancedAgentFactory({config})
        const isServiceContainer = configOrServiceContainer && typeof configOrServiceContainer.initialize === 'function';
        const passedServiceContainer = isServiceContainer ? configOrServiceContainer : null;
        const config = isServiceContainer ? {} : configOrServiceContainer;

        this.config = {
            useEnhancedAgents: config.useEnhancedAgents !== false, // Default to enhanced
            fallbackToOriginal: config.fallbackToOriginal !== false, // Allow fallback
            serviceContainer: passedServiceContainer || config.serviceContainer || null,
            sessionId: null,
            ...config
        };

        // Use passed ServiceContainer or create new one later
        this.serviceContainer = passedServiceContainer || null;
        this.isInitialized = false;

        // Track created agents for cleanup
        this.activeAgents = new Map();

        info(` Enhanced Agent Factory created (Enhanced: ${this.config.useEnhancedAgents})`);
    }

    /**
     * Initialize the factory with ServiceContainer
     */
    async initialize(sessionId = null) {
        this.config.sessionId = sessionId || `factory-${Date.now()}`;

        if (this.config.useEnhancedAgents) {
            try {
                // Only create new ServiceContainer if one wasn't passed to constructor
                if (!this.serviceContainer) {
                    this.serviceContainer = new ServiceContainer();
                    await this.serviceContainer.initialize();
                    info(' Agent Factory initialized with ServiceContainer');
                } else {
                    info(' Agent Factory using existing ServiceContainer');
                }
            } catch (error) {
                console.warn('WARN ServiceContainer initialization failed, falling back to original agents');
                this.config.useEnhancedAgents = false;
            }
        }

        this.isInitialized = true;
        return this;
    }

    /**
     * Create Security Agent
     */
    async createSecurityAgent(sessionId, config = {}) {
        const agentSessionId = sessionId || this.config.sessionId;

        try {
            if (this.config.useEnhancedAgents && this.serviceContainer) {
                const { EnhancedSecurityAgent } = require('./agents/enhanced-security-agent');
                const agent = new EnhancedSecurityAgent(agentSessionId, this.serviceContainer, config);
                await agent.initialize();

                this.activeAgents.set(`security-${agentSessionId}`, agent);
                info(' Enhanced SecurityAgent created');
                return agent;
            }
        } catch (error) {
            console.warn('WARN Enhanced SecurityAgent creation failed:', error.message);
            if (!this.config.fallbackToOriginal) throw error;
        }

        // Fallback to original
        const { SecurityAgent } = require('../agents/security-agent');
        const agent = new SecurityAgent(agentSessionId, config);
        this.activeAgents.set(`security-${agentSessionId}`, agent);
        info(' Original SecurityAgent created (fallback)');
        return agent;
    }

    /**
     * Create Code Agent
     */
    async createCodeAgent(sessionId, config = {}) {
        const agentSessionId = sessionId || this.config.sessionId;

        // code-agent.js already exports EnhancedCodeAgent (no separate enhanced version exists)
        const { EnhancedCodeAgent } = require('../agents/code-agent');

        // Ensure we have ServiceContainer
        if (!this.serviceContainer) {
            this.serviceContainer = new ServiceContainer();
            await this.serviceContainer.initialize();
        }

        const agent = new EnhancedCodeAgent(agentSessionId, this.serviceContainer, config);
        this.activeAgents.set(`code-${agentSessionId}`, agent);
        info(' CodeAgent created (already enhanced)');
        return agent;
    }

    /**
     * Create Deploy Agent
     */
    async createDeployAgent(sessionId, config = {}) {
        const agentSessionId = sessionId || this.config.sessionId;

        try {
            if (this.config.useEnhancedAgents && this.serviceContainer) {
                const { EnhancedDeployAgent } = require('./agents/enhanced-deploy-agent');
                const agent = new EnhancedDeployAgent(agentSessionId, this.serviceContainer, config);
                await agent.initialize();

                this.activeAgents.set(`deploy-${agentSessionId}`, agent);
                info('Enhanced DeployAgent created');
                return agent;
            }
        } catch (error) {
            console.warn('WARN Enhanced DeployAgent creation failed:', error.message);
            if (!this.config.fallbackToOriginal) throw error;
        }

        // Fallback to original
        const { DeployAgent } = require('../agents/deploy-agent');
        const agent = new DeployAgent(agentSessionId, config);
        this.activeAgents.set(`deploy-${agentSessionId}`, agent);
        info('Original DeployAgent created (fallback)');
        return agent;
    }

    /**
     * Create Communication Agent
     */
    async createCommunicationAgent(sessionId, config = {}) {
        const agentSessionId = sessionId || this.config.sessionId;

        try {
            if (this.config.useEnhancedAgents && this.serviceContainer) {
                const { EnhancedCommunicationAgent } = require('./agents/enhanced-comm-agent');
                const agent = new EnhancedCommunicationAgent(agentSessionId, this.serviceContainer, config);
                await agent.initialize();

                this.activeAgents.set(`comm-${agentSessionId}`, agent);
                info(' Enhanced CommunicationAgent created');
                return agent;
            }
        } catch (error) {
            console.warn('WARN Enhanced CommunicationAgent creation failed:', error.message);
            if (!this.config.fallbackToOriginal) throw error;
        }

        // Fallback to original
        const { CommunicationAgent } = require('../agents/comm-agent');
        const agent = new CommunicationAgent(agentSessionId, config);
        this.activeAgents.set(`comm-${agentSessionId}`, agent);
        info(' Original CommunicationAgent created (fallback)');
        return agent;
    }

    /**
     * Create GitHub Agent (enhanced version already exists)
     */
    async createGitHubAgent(sessionId, config = {}) {
        const agentSessionId = sessionId || this.config.sessionId;

        try {
            if (this.config.useEnhancedAgents && this.serviceContainer) {
                const { EnhancedGitHubAgent } = require('./agents/enhanced-github-agent');
                const agent = new EnhancedGitHubAgent(agentSessionId, this.serviceContainer, config);
                await agent.initialize();

                this.activeAgents.set(`github-${agentSessionId}`, agent);
                info(' Enhanced GitHubAgent created');
                return agent;
            }
        } catch (error) {
            console.warn('WARN Enhanced GitHubAgent creation failed:', error.message);
            if (!this.config.fallbackToOriginal) throw error;
        }

        // Fallback to original
        const { GitHubAgent } = require('../agents/github-agent');
        const agent = new GitHubAgent(agentSessionId, config);
        this.activeAgents.set(`github-${agentSessionId}`, agent);
        info(' Original GitHubAgent created (fallback)');
        return agent;
    }

    /**
     * Create any agent by name with automatic enhanced/original selection
     */
    async createAgent(agentType, sessionId, config = {}) {
        switch (agentType.toLowerCase()) {
            case 'security':
                return await this.createSecurityAgent(sessionId, config);

            case 'code':
                return await this.createCodeAgent(sessionId, config);

            case 'deploy':
            case 'deployment':
                return await this.createDeployAgent(sessionId, config);

            case 'comm':
            case 'communication':
                return await this.createCommunicationAgent(sessionId, config);

            case 'github':
            case 'git':
                return await this.createGitHubAgent(sessionId, config);

            default:
                throw new Error(`Unknown agent type: ${agentType}`);
        }
    }

    /**
     * Get factory status and statistics
     */
    getFactoryStatus() {
        return {
            initialized: this.isInitialized,
            enhanced_agents_enabled: this.config.useEnhancedAgents,
            service_container_ready: !!this.serviceContainer,
            active_agents: this.activeAgents.size,
            session_id: this.config.sessionId,
            agent_types: Array.from(this.activeAgents.keys()).map(key => key.split('-')[0])
        };
    }

    /**
     * Get active agents list
     */
    getActiveAgents() {
        const agents = {};
        for (const [key, agent] of this.activeAgents) {
            agents[key] = {
                type: agent.agentName,
                session: agent.sessionId,
                state: agent.state,
                enhanced: agent.constructor.name.includes('Enhanced')
            };
        }
        return agents;
    }

    /**
     * Cleanup factory and all active agents
     */
    async cleanup() {
        info(`CLEANUP Cleaning up Agent Factory (${this.activeAgents.size} active agents)`);

        // Cleanup all active agents
        for (const [key, agent] of this.activeAgents) {
            try {
                if (typeof agent.cleanup === 'function') {
                    await agent.cleanup();
                }
            } catch (error) {
                console.warn(`WARN Agent cleanup failed for ${key}:`, error.message);
            }
        }

        this.activeAgents.clear();

        // Cleanup ServiceContainer
        if (this.serviceContainer) {
            try {
                if (typeof this.serviceContainer.cleanup === 'function') {
                    await this.serviceContainer.cleanup();
                }
            } catch (error) {
                console.warn('WARN ServiceContainer cleanup failed:', error.message);
            }
            this.serviceContainer = null;
        }

        this.isInitialized = false;
        info('Agent Factory cleanup completed');
    }
}

/**
 * Singleton factory instance for global use
 */
let globalFactory = null;

/**
 * Get or create global factory instance
 */
async function getAgentFactory(config = {}) {
    if (!globalFactory) {
        globalFactory = new EnhancedAgentFactory(config);
        await globalFactory.initialize();
    }
    return globalFactory;
}

/**
 * Create agent using global factory (convenience method)
 */
async function createAgent(agentType, sessionId, config = {}) {
    const factory = await getAgentFactory();
    return await factory.createAgent(agentType, sessionId, config);
}

/**
 * Cleanup global factory
 */
async function cleanupAgentFactory() {
    if (globalFactory) {
        await globalFactory.cleanup();
        globalFactory = null;
    }
}

module.exports = {
    EnhancedAgentFactory,
    getAgentFactory,
    createAgent,
    cleanupAgentFactory
};