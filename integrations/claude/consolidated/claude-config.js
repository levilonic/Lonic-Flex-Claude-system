/**
 * Claude Configuration Management - Consolidated
 * Consolidates: claude-config-manager.js
 * Provides: Configuration management, environment handling, settings persistence
 */

const { info, warn, error } = require('../../../src/services/logger');

class ClaudeConfigManager {
    constructor(config = {}) {
        this.config = {
            configPath: config.configPath || './config',
            environment: config.environment || process.env.NODE_ENV || 'development',
            ...config
        };

        this.settings = new Map();
        this.initialized = false;
    }

    /**
     * Initialize configuration manager
     */
    async initialize() {
        if (this.initialized) {
            return this;
        }

        try {
            info('⚙️ Initializing Claude Configuration Manager...');

            // Load default settings
            this.loadDefaultSettings();

            // Load environment-specific settings
            await this.loadEnvironmentSettings();

            this.initialized = true;
            info('✅ Configuration Manager initialized successfully');
            return this;

        } catch (initError) {
            error('❌ Configuration manager initialization failed', { error: initError.message });
            throw initError;
        }
    }

    /**
     * Load default settings
     */
    loadDefaultSettings() {
        const defaults = {
            // Core system settings
            'system.name': 'LonicFLex',
            'system.version': '0.1.0',
            'system.environment': this.config.environment,

            // Context management
            'context.compression_ratio': 0.7,
            'context.max_events': 1000,
            'context.cleanup_threshold': 0.4,

            // External integrations
            'github.enabled': !!process.env.GITHUB_TOKEN,
            'slack.enabled': !!process.env.SLACK_BOT_TOKEN,
            'docker.enabled': true,

            // Performance settings
            'performance.max_agents': 10,
            'performance.timeout_ms': 30000,
            'performance.retry_attempts': 3
        };

        for (const [key, value] of Object.entries(defaults)) {
            this.settings.set(key, value);
        }

        info('✅ Default settings loaded');
    }

    /**
     * Load environment-specific settings
     */
    async loadEnvironmentSettings() {
        const envSettings = {
            development: {
                'system.debug': true,
                'performance.timeout_ms': 60000,
                'context.cleanup_threshold': 0.6
            },
            production: {
                'system.debug': false,
                'performance.timeout_ms': 30000,
                'context.cleanup_threshold': 0.4
            },
            test: {
                'system.debug': false,
                'performance.timeout_ms': 10000,
                'context.max_events': 100
            }
        };

        const currentEnvSettings = envSettings[this.config.environment] || {};

        for (const [key, value] of Object.entries(currentEnvSettings)) {
            this.settings.set(key, value);
        }

        info(`✅ Environment settings loaded: ${this.config.environment}`);
    }

    /**
     * Get configuration value
     */
    get(key, defaultValue = null) {
        if (!this.initialized) {
            warn('⚠️ Configuration manager not initialized');
            return defaultValue;
        }

        return this.settings.get(key) ?? defaultValue;
    }

    /**
     * Set configuration value
     */
    set(key, value) {
        if (!this.initialized) {
            warn('⚠️ Configuration manager not initialized');
            return false;
        }

        const oldValue = this.settings.get(key);
        this.settings.set(key, value);

        info('🔧 Configuration updated', { key, oldValue, newValue: value });
        return true;
    }

    /**
     * Get all settings for a namespace
     */
    getNamespace(namespace) {
        if (!this.initialized) {
            return {};
        }

        const result = {};
        const prefix = `${namespace}.`;

        for (const [key, value] of this.settings.entries()) {
            if (key.startsWith(prefix)) {
                const shortKey = key.slice(prefix.length);
                result[shortKey] = value;
            }
        }

        return result;
    }

    /**
     * Get system configuration
     */
    getSystemConfig() {
        return this.getNamespace('system');
    }

    /**
     * Get context configuration
     */
    getContextConfig() {
        return this.getNamespace('context');
    }

    /**
     * Get performance configuration
     */
    getPerformanceConfig() {
        return this.getNamespace('performance');
    }

    /**
     * Get integration statuses
     */
    getIntegrationStatus() {
        return {
            github: this.get('github.enabled', false),
            slack: this.get('slack.enabled', false),
            docker: this.get('docker.enabled', false)
        };
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        const issues = [];

        // Check required settings
        const required = ['system.name', 'system.version'];
        for (const key of required) {
            if (!this.settings.has(key)) {
                issues.push(`Missing required setting: ${key}`);
            }
        }

        // Check value ranges
        const compressionRatio = this.get('context.compression_ratio', 0.7);
        if (compressionRatio < 0.1 || compressionRatio > 1.0) {
            issues.push('context.compression_ratio must be between 0.1 and 1.0');
        }

        return {
            valid: issues.length === 0,
            issues
        };
    }

    /**
     * Export configuration
     */
    exportConfig() {
        const config = {};
        for (const [key, value] of this.settings.entries()) {
            config[key] = value;
        }
        return config;
    }

    /**
     * Get configuration summary
     */
    getConfigSummary() {
        return {
            initialized: this.initialized,
            environment: this.config.environment,
            settingsCount: this.settings.size,
            systemConfig: this.getSystemConfig(),
            integrations: this.getIntegrationStatus(),
            valid: this.validateConfig().valid
        };
    }
}

// Singleton instance
let configInstance = null;

/**
 * Get global config instance
 */
function getClaudeConfig() {
    if (!configInstance) {
        configInstance = new ClaudeConfigManager();
    }
    return configInstance;
}

module.exports = {
    ClaudeConfigManager,
    getClaudeConfig
};

// Demo functionality
if (require.main === module) {
    async function demoConfigManager() {
        info('🧪 Claude Config Manager Demo');

        const config = new ClaudeConfigManager();
        await config.initialize();

        const summary = config.getConfigSummary();
        info('Configuration Summary:', summary);

        // Test setting and getting values
        config.set('demo.test', 'hello world');
        const testValue = config.get('demo.test');
        info('Test setting:', testValue);

        info('Demo complete');
    }

    demoConfigManager().catch(console.error);
}