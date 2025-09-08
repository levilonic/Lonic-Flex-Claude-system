const fs = require('fs').promises;
const path = require('path');
const { TwelveFactorCompliance } = require('./12-factor-compliance-tracker');
const winston = require('winston');

/**
 * Configuration Manager - Factor 2: Explicitly Declare and Isolate Dependencies
 * 
 * Centralized configuration management for the multi-agent system
 * Following 12-Factor Agent principles
 */
class ConfigManager {
    constructor(options = {}) {
        this.config = null;
        this.environment = options.environment || process.env.NODE_ENV || 'development';
        this.configPath = options.configPath || path.join(__dirname, 'config', 'agents.json');
        this.envPath = options.envPath || path.join(__dirname, '.env');
        
        // Environment variable cache
        this.envVars = new Map();
        this.configCache = new Map();
        this.watchers = new Map();
        
        // Compliance tracker
        this.compliance = new TwelveFactorCompliance();
        
        // Logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console({ level: 'info' })
            ]
        });
    }

    /**
     * Initialize configuration manager
     */
    async initialize() {
        try {
            // Load environment variables
            await this.loadEnvironmentVariables();
            
            // Load main configuration
            await this.loadConfiguration();
            
            // Validate configuration
            await this.validateConfiguration();
            
            // Setup file watchers for hot reload
            await this.setupConfigWatchers();
            
            this.logger.info('Configuration manager initialized', {
                environment: this.environment,
                configPath: this.configPath
            });

        } catch (error) {
            this.logger.error('Failed to initialize configuration manager', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Load environment variables from .env file and process.env
     */
    async loadEnvironmentVariables() {
        try {
            // Load from .env file if it exists
            try {
                const envContent = await fs.readFile(this.envPath, 'utf-8');
                const envLines = envContent.split('\n');
                
                for (const line of envLines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        const [key, ...valueParts] = trimmed.split('=');
                        if (key && valueParts.length > 0) {
                            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                            this.envVars.set(key, value);
                        }
                    }
                }
                
                this.logger.info('Loaded environment variables from .env file', {
                    count: this.envVars.size
                });
                
            } catch (error) {
                // .env file doesn't exist - that's okay
                this.logger.info('No .env file found, using process environment only');
            }

            // Override with process.env values
            for (const [key, value] of Object.entries(process.env)) {
                if (value !== undefined) {
                    this.envVars.set(key, value);
                }
            }

        } catch (error) {
            this.logger.error('Failed to load environment variables', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Load main configuration file
     */
    async loadConfiguration() {
        try {
            const configContent = await fs.readFile(this.configPath, 'utf-8');
            const rawConfig = JSON.parse(configContent);
            
            // Process configuration with environment variable substitution
            this.config = this.processConfiguration(rawConfig);
            
            this.logger.info('Configuration loaded successfully', {
                version: this.config.version,
                environment: this.config.environment,
                agentCount: Object.keys(this.config.agents).length,
                workflowCount: Object.keys(this.config.workflows).length
            });

        } catch (error) {
            this.logger.error('Failed to load configuration', { 
                error: error.message,
                configPath: this.configPath 
            });
            throw error;
        }
    }

    /**
     * Process configuration with environment variable substitution
     */
    processConfiguration(config) {
        const processed = JSON.parse(JSON.stringify(config)); // Deep clone
        
        const substituteEnvVars = (obj) => {
            if (typeof obj === 'string') {
                // Replace ${VAR_NAME} with environment variable values
                return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
                    const value = this.envVars.get(varName);
                    if (value === undefined) {
                        this.logger.warn('Environment variable not found', { varName });
                        return match; // Leave as-is if not found
                    }
                    return value;
                });
            } else if (Array.isArray(obj)) {
                return obj.map(substituteEnvVars);
            } else if (obj && typeof obj === 'object') {
                const result = {};
                for (const [key, value] of Object.entries(obj)) {
                    result[key] = substituteEnvVars(value);
                }
                return result;
            }
            return obj;
        };

        return substituteEnvVars(processed);
    }

    /**
     * Validate configuration against 12-factor principles
     */
    async validateConfiguration() {
        const issues = [];

        try {
            // Validate required sections
            const requiredSections = ['agents', 'workflows', 'integrations', 'database'];
            for (const section of requiredSections) {
                if (!this.config[section]) {
                    issues.push(`Missing required configuration section: ${section}`);
                }
            }

            // Validate agent configurations
            if (this.config.agents) {
                for (const [agentName, agentConfig] of Object.entries(this.config.agents)) {
                    if (!agentConfig.enabled !== undefined && !agentConfig.timeout) {
                        issues.push(`Agent ${agentName} missing timeout configuration`);
                    }
                    
                    if (!agentConfig.docker || !agentConfig.docker.image) {
                        issues.push(`Agent ${agentName} missing Docker image configuration`);
                    }
                }
            }

            // Validate workflow configurations
            if (this.config.workflows) {
                for (const [workflowName, workflowConfig] of Object.entries(this.config.workflows)) {
                    if (!workflowConfig.agents || !Array.isArray(workflowConfig.agents)) {
                        issues.push(`Workflow ${workflowName} missing or invalid agents array`);
                    }
                    
                    if (!workflowConfig.timeout) {
                        issues.push(`Workflow ${workflowName} missing timeout configuration`);
                    }
                }
            }

            // Check 12-Factor compliance (basic validation)
            if (this.config.factor_compliance) {
                const factors = this.config.factor_compliance;
                let complianceScore = 0;
                let totalFactors = 0;
                
                for (const [factorName, factorConfig] of Object.entries(factors)) {
                    totalFactors++;
                    if (typeof factorConfig === 'object') {
                        const compliantFeatures = Object.values(factorConfig).filter(Boolean).length;
                        const totalFeatures = Object.keys(factorConfig).length;
                        if (compliantFeatures === totalFeatures) {
                            complianceScore++;
                        }
                    }
                }
                
                this.logger.info('12-Factor compliance check', {
                    compliantFactors: complianceScore,
                    totalFactors: totalFactors,
                    compliancePercentage: Math.round((complianceScore / totalFactors) * 100)
                });
            }

            if (issues.length > 0) {
                this.logger.warn('Configuration validation issues found', { 
                    issues,
                    issueCount: issues.length 
                });
                
                // Don't throw error for warnings, just log them
                if (issues.some(issue => issue.includes('Missing required'))) {
                    throw new Error(`Critical configuration issues: ${issues.join('; ')}`);
                }
            } else {
                this.logger.info('Configuration validation passed');
            }

        } catch (error) {
            this.logger.error('Configuration validation failed', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Setup configuration file watchers for hot reload
     */
    async setupConfigWatchers() {
        try {
            const fs = require('fs');
            
            // Watch main config file
            this.watchers.set('config', fs.watch(this.configPath, async (eventType) => {
                if (eventType === 'change') {
                    this.logger.info('Configuration file changed, reloading...');
                    try {
                        await this.loadConfiguration();
                        await this.validateConfiguration();
                        this.emit('configChanged', this.config);
                    } catch (error) {
                        this.logger.error('Failed to reload configuration', { 
                            error: error.message 
                        });
                    }
                }
            }));

            // Watch .env file if it exists
            try {
                await fs.promises.access(this.envPath);
                this.watchers.set('env', fs.watch(this.envPath, async (eventType) => {
                    if (eventType === 'change') {
                        this.logger.info('Environment file changed, reloading...');
                        try {
                            await this.loadEnvironmentVariables();
                            await this.loadConfiguration();
                            await this.validateConfiguration();
                            this.emit('configChanged', this.config);
                        } catch (error) {
                            this.logger.error('Failed to reload after env change', { 
                                error: error.message 
                            });
                        }
                    }
                }));
            } catch {
                // .env file doesn't exist - that's okay
            }

        } catch (error) {
            this.logger.error('Failed to setup config watchers', { 
                error: error.message 
            });
        }
    }

    /**
     * Get configuration for a specific agent
     */
    getAgentConfig(agentName) {
        if (!this.config || !this.config.agents) {
            throw new Error('Configuration not loaded');
        }

        const agentConfig = this.config.agents[agentName];
        if (!agentConfig) {
            throw new Error(`Agent configuration not found: ${agentName}`);
        }

        return {
            ...agentConfig,
            globalConfig: {
                environment: this.config.environment,
                database: this.config.database,
                logging: this.config.logging
            }
        };
    }

    /**
     * Get configuration for a specific workflow
     */
    getWorkflowConfig(workflowName) {
        if (!this.config || !this.config.workflows) {
            throw new Error('Configuration not loaded');
        }

        const workflowConfig = this.config.workflows[workflowName];
        if (!workflowConfig) {
            throw new Error(`Workflow configuration not found: ${workflowName}`);
        }

        return {
            ...workflowConfig,
            agentConfigs: workflowConfig.agents.map(agentName => 
                this.getAgentConfig(agentName)
            )
        };
    }

    /**
     * Get integration configuration
     */
    getIntegrationConfig(integrationName) {
        if (!this.config || !this.config.integrations) {
            throw new Error('Configuration not loaded');
        }

        const integrationConfig = this.config.integrations[integrationName];
        if (!integrationConfig) {
            throw new Error(`Integration configuration not found: ${integrationName}`);
        }

        return integrationConfig;
    }

    /**
     * Get database configuration
     */
    getDatabaseConfig() {
        if (!this.config || !this.config.database) {
            throw new Error('Database configuration not loaded');
        }

        return this.config.database;
    }

    /**
     * Get logging configuration
     */
    getLoggingConfig() {
        if (!this.config || !this.config.logging) {
            return {
                level: 'info',
                format: 'json',
                outputs: [{ type: 'console' }]
            };
        }

        return this.config.logging;
    }

    /**
     * Get monitoring configuration
     */
    getMonitoringConfig() {
        if (!this.config || !this.config.monitoring) {
            return {
                health_check_interval: 30000,
                metrics_enabled: false
            };
        }

        return this.config.monitoring;
    }

    /**
     * Get security configuration
     */
    getSecurityConfig() {
        if (!this.config || !this.config.security) {
            return {
                webhook_signature_verification: true,
                api_rate_limiting: true,
                max_requests_per_minute: 100
            };
        }

        return this.config.security;
    }

    /**
     * Get all available agent names
     */
    getAvailableAgents() {
        if (!this.config || !this.config.agents) {
            return [];
        }

        return Object.keys(this.config.agents).filter(
            agentName => this.config.agents[agentName].enabled !== false
        );
    }

    /**
     * Get all available workflow names
     */
    getAvailableWorkflows() {
        if (!this.config || !this.config.workflows) {
            return [];
        }

        return Object.keys(this.config.workflows).filter(
            workflowName => this.config.workflows[workflowName].enabled !== false
        );
    }

    /**
     * Update configuration dynamically (in memory only)
     */
    updateConfig(path, value) {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }

        const keys = path.split('.');
        let current = this.config;
        
        // Navigate to parent of target key
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        // Set the value
        const lastKey = keys[keys.length - 1];
        const oldValue = current[lastKey];
        current[lastKey] = value;

        this.logger.info('Configuration updated', {
            path,
            oldValue,
            newValue: value
        });

        this.emit('configUpdated', { path, oldValue, newValue: value });
    }

    /**
     * Save current configuration to file
     */
    async saveConfiguration() {
        if (!this.config) {
            throw new Error('No configuration to save');
        }

        try {
            const configJson = JSON.stringify(this.config, null, 2);
            await fs.writeFile(this.configPath, configJson, 'utf-8');
            
            this.logger.info('Configuration saved to file', {
                configPath: this.configPath
            });

        } catch (error) {
            this.logger.error('Failed to save configuration', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Emit events (simple EventEmitter functionality)
     */
    emit(event, data) {
        // In a real implementation, this would use EventEmitter
        this.logger.debug('Event emitted', { event, data });
    }

    /**
     * Get environment variable
     */
    getEnvVar(name, defaultValue = undefined) {
        return this.envVars.get(name) || defaultValue;
    }

    /**
     * Set environment variable (runtime only)
     */
    setEnvVar(name, value) {
        this.envVars.set(name, value);
        this.logger.debug('Environment variable set', { name });
    }

    /**
     * Get full configuration
     */
    getFullConfig() {
        return this.config;
    }

    /**
     * Get configuration summary for health checks
     */
    getConfigSummary() {
        if (!this.config) {
            return { loaded: false };
        }

        return {
            loaded: true,
            version: this.config.version,
            environment: this.config.environment,
            agents: {
                total: Object.keys(this.config.agents).length,
                enabled: Object.values(this.config.agents).filter(a => a.enabled !== false).length
            },
            workflows: {
                total: Object.keys(this.config.workflows).length,
                enabled: Object.values(this.config.workflows).filter(w => w.enabled !== false).length
            },
            integrations: Object.keys(this.config.integrations || {}).length,
            lastLoaded: Date.now()
        };
    }

    /**
     * Cleanup watchers and resources
     */
    async cleanup() {
        for (const [name, watcher] of this.watchers) {
            try {
                watcher.close();
                this.logger.debug('Closed config watcher', { name });
            } catch (error) {
                this.logger.error('Failed to close watcher', { name, error: error.message });
            }
        }
        
        this.watchers.clear();
        this.configCache.clear();
        this.logger.info('Configuration manager cleaned up');
    }
}

/**
 * Demo function
 */
async function demonstrateConfigManager() {
    console.log('⚙️  Configuration Manager Demo\n');
    
    try {
        const configManager = new ConfigManager();
        await configManager.initialize();

        console.log('✅ Configuration Manager Features:');
        console.log('   • Centralized configuration management');
        console.log('   • Environment variable substitution');
        console.log('   • 12-Factor compliance validation');
        console.log('   • Hot configuration reload');
        console.log('   • Agent and workflow configuration');
        console.log('   • Integration settings management');
        console.log('   • Security and monitoring configuration');

        const summary = configManager.getConfigSummary();
        console.log('\n📊 Configuration Summary:');
        console.log(`   Version: ${summary.version}`);
        console.log(`   Environment: ${summary.environment}`);
        console.log(`   Agents: ${summary.agents.enabled}/${summary.agents.total} enabled`);
        console.log(`   Workflows: ${summary.workflows.enabled}/${summary.workflows.total} enabled`);
        console.log(`   Integrations: ${summary.integrations}`);

        console.log('\n🤖 Available Agents:');
        const agents = configManager.getAvailableAgents();
        agents.forEach(agent => {
            const config = configManager.getAgentConfig(agent);
            console.log(`   • ${agent}: ${config.max_instances} max instances, ${config.timeout}ms timeout`);
        });

        console.log('\n🔄 Available Workflows:');
        const workflows = configManager.getAvailableWorkflows();
        workflows.forEach(workflow => {
            const config = configManager.getWorkflowConfig(workflow);
            console.log(`   • ${workflow}: ${config.agents.join(' → ')} (${config.timeout}ms timeout)`);
        });

        console.log('\n🔧 Integration Status:');
        const integrations = ['slack', 'github', 'docker'];
        integrations.forEach(integration => {
            try {
                const config = configManager.getIntegrationConfig(integration);
                console.log(`   • ${integration}: ${config.enabled ? '✅ Enabled' : '❌ Disabled'}`);
            } catch (error) {
                console.log(`   • ${integration}: ❌ Not configured`);
            }
        });

        await configManager.cleanup();
        console.log('\n✅ Demo completed - Configuration system ready!');

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

module.exports = {
    ConfigManager
};

// Run demo if called directly
if (require.main === module) {
    demonstrateConfigManager().catch(console.error);
}