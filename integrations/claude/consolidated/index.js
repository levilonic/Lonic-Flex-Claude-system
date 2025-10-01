/**
 * Claude Consolidated Integrations - Main Export
 * Provides: Unified access to all consolidated Claude integrations
 * Replaces: 17+ individual integration files with 8 consolidated modules
 */

// Core integrations
const { ClaudeCore, getClaudeCoreInstance, initializeClaudeCore } = require('./claude-core');
const { ClaudeConnector, getClaudeConnector, initializeClaudeConnector } = require('./claude-connector');

// Specific integrations
const { ClaudeGitHubIntegration } = require('./claude-github');
const { ClaudeSlackIntegration } = require('./claude-slack');
const { ClaudeDeploymentIntegration } = require('./claude-deployment');
const { ClaudeConfigManager, getClaudeConfig } = require('./claude-config');
const { ClaudeServicesIntegration } = require('./claude-services');

/**
 * Initialize all Claude integrations with default configuration
 */
async function initializeClaudeIntegrations(config = {}) {
    const connector = await initializeClaudeConnector(config);
    return {
        connector,
        core: getClaudeCoreInstance(),
        config: getClaudeConfig(),
        status: await connector.getSystemStatus()
    };
}

/**
 * Quick setup for development/testing
 */
async function quickSetup() {
    try {
        const integrations = await initializeClaudeIntegrations();
        console.log('✅ Claude Integrations initialized successfully');
        console.log(`📊 Status: ${integrations.status.connector.integrations} integrations active`);
        return integrations;
    } catch (error) {
        console.error('❌ Claude Integrations setup failed:', error.message);
        throw error;
    }
}

// Export all integrations
module.exports = {
    // Main integration classes
    ClaudeCore,
    ClaudeConnector,
    ClaudeGitHubIntegration,
    ClaudeSlackIntegration,
    ClaudeDeploymentIntegration,
    ClaudeConfigManager,
    ClaudeServicesIntegration,

    // Singleton getters
    getClaudeCoreInstance,
    getClaudeConnector,
    getClaudeConfig,

    // Initialization functions
    initializeClaudeCore,
    initializeClaudeConnector,
    initializeClaudeIntegrations,
    quickSetup
};

// Auto-initialize if run directly
if (require.main === module) {
    quickSetup().then(integrations => {
        console.log('\n🎉 Claude Integrations Demo Complete');
        console.log('Available integrations:', Object.keys(integrations.status.integrations));

        // Shutdown after demo
        setTimeout(async () => {
            await integrations.connector.shutdown();
            console.log('🔄 Demo shutdown complete');
        }, 1000);
    }).catch(console.error);
}