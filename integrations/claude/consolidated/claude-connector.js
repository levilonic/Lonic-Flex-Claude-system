/**
 * Claude Connector - Master Integration Hub
 * Consolidates: claude-progress-tracker.js, claude-progress-overlay.js
 * Provides: Connection management, master coordination, integration orchestration
 */

const { info, warn, error } = require('../../../src/services/logger');

const { getClaudeCoreInstance } = require('./claude-core');
const { ClaudeGitHubIntegration } = require('./claude-github');
const { ClaudeSlackIntegration } = require('./claude-slack');
const { ClaudeDeploymentIntegration } = require('./claude-deployment');
const { getClaudeConfig } = require('./claude-config');
const { ClaudeServicesIntegration } = require('./claude-services');

class ClaudeConnector {
    constructor(config = {}) {
        this.config = {
            enableGitHub: config.enableGitHub !== false,
            enableSlack: config.enableSlack !== false,
            enableDeployment: config.enableDeployment !== false,
            enableServices: config.enableServices !== false,
            ...config
        };

        this.initialized = false;
        this.core = null;
        this.integrations = new Map();
        this.status = 'disconnected';
    }

    /**
     * Initialize Claude Connector and all integrations
     */
    async initialize() {
        if (this.initialized) {
            return this;
        }

        try {
            info('🔗 Initializing Claude Connector...');
            this.status = 'connecting';

            // Initialize configuration
            const configManager = getClaudeConfig();
            await configManager.initialize();

            // Initialize core
            this.core = getClaudeCoreInstance();
            await this.core.initialize();

            // Initialize all integrations
            await this.initializeIntegrations(configManager);

            this.initialized = true;
            this.status = 'connected';
            info('✅ Claude Connector initialized successfully');

            return this;

        } catch (initError) {
            this.status = 'failed';
            error('❌ Claude Connector initialization failed', { error: initError.message });
            throw initError;
        }
    }

    /**
     * Initialize all integrations
     */
    async initializeIntegrations(configManager) {
        const integrationConfigs = {
            github: {
                enabled: this.config.enableGitHub && configManager.get('github.enabled', false),
                class: ClaudeGitHubIntegration
            },
            slack: {
                enabled: this.config.enableSlack && configManager.get('slack.enabled', false),
                class: ClaudeSlackIntegration
            },
            deployment: {
                enabled: this.config.enableDeployment,
                class: ClaudeDeploymentIntegration
            },
            services: {
                enabled: this.config.enableServices,
                class: ClaudeServicesIntegration
            }
        };

        for (const [name, config] of Object.entries(integrationConfigs)) {
            if (config.enabled) {
                try {
                    const integration = new config.class();
                    await integration.initialize();
                    this.integrations.set(name, integration);
                    info(`✅ ${name} integration initialized`);
                } catch (error) {
                    warn(`⚠️ Failed to initialize ${name} integration`, { error: error.message });
                }
            } else {
                info(`ℹ️ ${name} integration disabled`);
            }
        }

        info(`🔗 ${this.integrations.size} integrations initialized`);
    }

    /**
     * Get integration by name
     */
    getIntegration(name) {
        return this.integrations.get(name) || null;
    }

    /**
     * Send context notification to all applicable integrations
     */
    async sendContextNotification(contextId, action, details = {}) {
        const notifications = [];

        // GitHub notification
        const github = this.getIntegration('github');
        if (github && action === 'created') {
            const branch = await github.createContextBranch(contextId);
            if (branch) {
                notifications.push({ service: 'github', type: 'branch_created', data: branch });
            }
        }

        // Slack notification
        const slack = this.getIntegration('slack');
        if (slack) {
            const message = await slack.sendContextNotification(contextId, action, details);
            if (message) {
                notifications.push({ service: 'slack', type: 'message_sent', data: message });
            }
        }

        info(`📢 Context notification sent: ${contextId}@${action}`, {
            notifications: notifications.length
        });

        return notifications;
    }

    /**
     * Execute multi-integration workflow
     */
    async executeWorkflow(workflowName, parameters = {}) {
        if (!this.initialized) {
            throw new Error('Claude Connector not initialized');
        }

        info(`🔄 Executing workflow: ${workflowName}`, parameters);

        const workflowId = `workflow_${workflowName}_${Date.now()}`;
        const context = await this.core.createWorkflowPartition(workflowId, {
            workflow: workflowName,
            parameters
        });

        try {
            let result;

            switch (workflowName) {
                case 'full_deployment':
                    result = await this.executeDeploymentWorkflow(parameters);
                    break;
                case 'security_scan':
                    result = await this.executeSecurityWorkflow(parameters);
                    break;
                case 'test_suite':
                    result = await this.executeTestWorkflow(parameters);
                    break;
                default:
                    throw new Error(`Unknown workflow: ${workflowName}`);
            }

            info(`✅ Workflow completed: ${workflowName}`, { workflowId, result });
            return { workflowId, result, success: true };

        } catch (workflowError) {
            error(`❌ Workflow failed: ${workflowName}`, { workflowId, error: workflowError.message });
            throw workflowError;
        }
    }

    /**
     * Execute deployment workflow
     */
    async executeDeploymentWorkflow(parameters) {
        const deployment = this.getIntegration('deployment');
        if (!deployment) {
            throw new Error('Deployment integration not available');
        }

        const services = parameters.services || ['web'];
        const results = [];

        for (const service of services) {
            const result = await deployment.deployService(service, parameters.version);
            results.push(result);
        }

        return { deployedServices: results };
    }

    /**
     * Execute security workflow
     */
    async executeSecurityWorkflow(parameters) {
        const services = this.getIntegration('services');
        if (!services) {
            throw new Error('Services integration not available');
        }

        const scanResult = await services.performSecurityScan(parameters);
        return { securityScan: scanResult };
    }

    /**
     * Execute test workflow
     */
    async executeTestWorkflow(parameters) {
        const services = this.getIntegration('services');
        if (!services) {
            throw new Error('Services integration not available');
        }

        const testResult = await services.runTests(parameters);
        return { testResults: testResult };
    }

    /**
     * Get comprehensive system status
     */
    async getSystemStatus() {
        const status = {
            connector: {
                initialized: this.initialized,
                status: this.status,
                integrations: this.integrations.size
            },
            core: this.core ? await this.core.getSystemHealth() : null,
            integrations: {}
        };

        // Get status from each integration
        for (const [name, integration] of this.integrations.entries()) {
            try {
                if (typeof integration.getStatus === 'function') {
                    status.integrations[name] = integration.getStatus();
                } else {
                    status.integrations[name] = { available: true };
                }
            } catch (error) {
                status.integrations[name] = { error: error.message };
            }
        }

        return status;
    }

    /**
     * Shutdown connector and all integrations
     */
    async shutdown() {
        if (!this.initialized) {
            return;
        }

        info('🔄 Shutting down Claude Connector...');

        // Shutdown all integrations
        for (const [name, integration] of this.integrations.entries()) {
            try {
                if (typeof integration.shutdown === 'function') {
                    await integration.shutdown();
                    info(`✅ ${name} integration shutdown`);
                }
            } catch (error) {
                warn(`⚠️ Failed to shutdown ${name} integration`, { error: error.message });
            }
        }

        // Shutdown core
        if (this.core) {
            await this.core.shutdown();
        }

        this.initialized = false;
        this.status = 'disconnected';
        this.integrations.clear();

        info('✅ Claude Connector shutdown complete');
    }
}

// Singleton instance
let connectorInstance = null;

/**
 * Get global Claude Connector instance
 */
function getClaudeConnector() {
    if (!connectorInstance) {
        connectorInstance = new ClaudeConnector();
    }
    return connectorInstance;
}

/**
 * Initialize global Claude Connector
 */
async function initializeClaudeConnector(config = {}) {
    const connector = getClaudeConnector();
    if (config) {
        Object.assign(connector.config, config);
    }
    await connector.initialize();
    return connector;
}

module.exports = {
    ClaudeConnector,
    getClaudeConnector,
    initializeClaudeConnector
};

// Demo functionality
if (require.main === module) {
    async function demoClaudeConnector() {
        info('🧪 Claude Connector Demo');

        const connector = await initializeClaudeConnector();
        const status = await connector.getSystemStatus();

        info('System Status:', JSON.stringify(status, null, 2));

        // Test workflow execution
        try {
            await connector.executeWorkflow('test_suite', { suites: ['unit'] });
        } catch (error) {
            info('Workflow test completed (expected for demo)');
        }

        await connector.shutdown();
        info('Demo complete');
    }

    demoClaudeConnector().catch(console.error);
}