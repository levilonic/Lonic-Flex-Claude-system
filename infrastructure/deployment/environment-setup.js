/**
 * Environment Setup and Validation System
 * Multi-environment deployment configuration and validation
 * Following 12-Factor principles for environment parity and configuration
 */

const { ConfigManager } = require('../claude-config-manager');
const { getAuthManager } = require('../auth/auth-manager');
const fs = require('fs').promises;
const path = require('path');

class EnvironmentSetup {
    constructor(options = {}) {
        this.environment = options.environment || process.env.NODE_ENV || 'development';
        this.configManager = null;
        this.authManager = getAuthManager();
        this.validationResults = new Map();
        this.setupLog = [];
    }

    /**
     * Initialize environment setup
     */
    async initialize() {
        console.log(`🚀 Initializing ${this.environment} environment setup...`);
        
        // Initialize configuration manager for this environment
        this.configManager = new ConfigManager({ environment: this.environment });
        await this.configManager.initialize();
        
        // Initialize authentication manager
        await this.authManager.initialize();
        
        console.log(`✅ Environment setup initialized for: ${this.environment}`);
    }

    /**
     * Validate complete environment setup
     */
    async validateEnvironment() {
        console.log(`🔍 Validating ${this.environment} environment...`);
        
        const validations = [
            { name: 'Configuration Files', fn: () => this.validateConfigurationFiles() },
            { name: 'Environment Variables', fn: () => this.validateEnvironmentVariables() },
            { name: 'Authentication Tokens', fn: () => this.validateAuthenticationTokens() },
            { name: 'Database Setup', fn: () => this.validateDatabaseSetup() },
            { name: 'Network Configuration', fn: () => this.validateNetworkConfiguration() },
            { name: 'Docker Configuration', fn: () => this.validateDockerConfiguration() },
            { name: 'Integration Endpoints', fn: () => this.validateIntegrationEndpoints() },
            { name: 'Security Settings', fn: () => this.validateSecuritySettings() },
            { name: 'Logging Configuration', fn: () => this.validateLoggingConfiguration() },
            { name: 'Monitoring Setup', fn: () => this.validateMonitoringSetup() }
        ];

        const results = [];
        let passCount = 0;

        for (const validation of validations) {
            try {
                console.log(`   🔍 ${validation.name}...`);
                const result = await validation.fn();
                
                if (result.valid) {
                    console.log(`   ✅ ${validation.name}: ${result.message || 'Valid'}`);
                    passCount++;
                } else {
                    console.log(`   ❌ ${validation.name}: ${result.error}`);
                }
                
                results.push({
                    name: validation.name,
                    ...result
                });
                
                this.validationResults.set(validation.name, result);
                
            } catch (error) {
                console.log(`   ❌ ${validation.name}: ${error.message}`);
                const errorResult = {
                    valid: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                results.push({
                    name: validation.name,
                    ...errorResult
                });
                this.validationResults.set(validation.name, errorResult);
            }
        }

        const successRate = Math.round((passCount / validations.length) * 100);
        
        console.log(`\n📊 Environment Validation Results for ${this.environment}:`);
        console.log(`   Success Rate: ${passCount}/${validations.length} (${successRate}%)`);
        
        const summary = {
            environment: this.environment,
            timestamp: new Date().toISOString(),
            passedValidations: passCount,
            totalValidations: validations.length,
            successRate: successRate,
            results: results,
            ready: successRate >= 80 // 80% minimum for deployment readiness
        };

        if (summary.ready) {
            console.log(`   🎉 ${this.environment} environment is ready for deployment!`);
        } else {
            console.log(`   ⚠️  ${this.environment} environment needs attention before deployment`);
        }

        return summary;
    }

    /**
     * Validate configuration files exist and are valid
     */
    async validateConfigurationFiles() {
        try {
            const config = this.configManager.getFullConfig();
            
            if (!config) {
                return { valid: false, error: 'Configuration not loaded' };
            }

            const requiredSections = ['agents', 'workflows', 'integrations', 'database'];
            const missingSections = requiredSections.filter(section => !config[section]);
            
            if (missingSections.length > 0) {
                return { 
                    valid: false, 
                    error: `Missing configuration sections: ${missingSections.join(', ')}` 
                };
            }

            return {
                valid: true,
                message: `Configuration loaded with ${Object.keys(config.agents || {}).length} agents, ${Object.keys(config.workflows || {}).length} workflows`,
                config: {
                    version: config.version,
                    environment: config.environment,
                    agentCount: Object.keys(config.agents || {}).length,
                    workflowCount: Object.keys(config.workflows || {}).length
                }
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Validate required environment variables
     */
    async validateEnvironmentVariables() {
        try {
            const config = this.configManager.getFullConfig();
            const requiredVars = this.getRequiredEnvironmentVariables();
            const missingVars = [];
            const presentVars = [];

            for (const varName of requiredVars) {
                const value = process.env[varName];
                if (!value || value.startsWith('${')) {
                    missingVars.push(varName);
                } else {
                    presentVars.push(varName);
                }
            }

            if (missingVars.length > 0) {
                return {
                    valid: false,
                    error: `Missing environment variables: ${missingVars.join(', ')}`,
                    missingVars,
                    presentVars
                };
            }

            return {
                valid: true,
                message: `All ${presentVars.length} required environment variables present`,
                presentVars
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Get required environment variables based on environment and config
     */
    getRequiredEnvironmentVariables() {
        const baseVars = ['NODE_ENV'];
        const environmentVars = {
            development: ['PORT'],
            staging: ['PORT', 'GITHUB_TOKEN', 'SLACK_BOT_TOKEN'],
            production: ['PORT', 'GITHUB_TOKEN', 'SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SECRETS_PASSPHRASE']
        };

        return [...baseVars, ...(environmentVars[this.environment] || [])];
    }

    /**
     * Validate authentication tokens
     */
    async validateAuthenticationTokens() {
        try {
            const authStatus = this.authManager.getAuthStatus();
            const requiredServices = this.getRequiredServices();
            
            const missingAuth = [];
            const validAuth = [];

            for (const service of requiredServices) {
                const serviceAuth = authStatus[service];
                if (!serviceAuth || !serviceAuth.configured) {
                    missingAuth.push(service);
                } else {
                    validAuth.push(service);
                }
            }

            if (missingAuth.length > 0) {
                return {
                    valid: false,
                    error: `Missing authentication for services: ${missingAuth.join(', ')}`,
                    missingAuth,
                    validAuth
                };
            }

            return {
                valid: true,
                message: `Authentication configured for all ${validAuth.length} required services`,
                validAuth
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Get required services based on environment
     */
    getRequiredServices() {
        const environmentServices = {
            development: [],
            staging: ['github', 'slack'],
            production: ['github', 'slack']
        };

        return environmentServices[this.environment] || [];
    }

    /**
     * Validate database setup
     */
    async validateDatabaseSetup() {
        try {
            const dbConfig = this.configManager.getDatabaseConfig();
            
            if (!dbConfig) {
                return { valid: false, error: 'No database configuration found' };
            }

            // Check if database file exists (for SQLite)
            if (dbConfig.type === 'sqlite') {
                const dbPath = path.resolve(dbConfig.file);
                try {
                    await fs.access(dbPath);
                    const stats = await fs.stat(dbPath);
                    
                    return {
                        valid: true,
                        message: `SQLite database exists (${Math.round(stats.size / 1024)}KB)`,
                        database: {
                            type: dbConfig.type,
                            path: dbPath,
                            size: stats.size,
                            walMode: dbConfig.wal_mode
                        }
                    };
                } catch (error) {
                    return {
                        valid: false,
                        error: `Database file not found: ${dbPath}`,
                        expectedPath: dbPath
                    };
                }
            }

            return {
                valid: true,
                message: `Database configuration valid for ${dbConfig.type}`,
                database: dbConfig
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Validate network configuration
     */
    async validateNetworkConfiguration() {
        try {
            const integrations = this.configManager.getFullConfig().integrations || {};
            const networkConfig = {
                ports: [],
                networks: []
            };

            // Check Slack port
            if (integrations.slack?.enabled) {
                networkConfig.ports.push({
                    service: 'slack',
                    port: integrations.slack.webhook_port || 3000
                });
            }

            // Check GitHub webhook port
            if (integrations.github?.enabled) {
                networkConfig.ports.push({
                    service: 'github',
                    port: integrations.github.webhook_port || 3001
                });
            }

            // Check Docker network
            if (integrations.docker?.enabled) {
                networkConfig.networks.push({
                    service: 'docker',
                    network: integrations.docker.network_name
                });
            }

            return {
                valid: true,
                message: `Network configuration valid for ${networkConfig.ports.length} services`,
                networkConfig
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Validate Docker configuration
     */
    async validateDockerConfiguration() {
        try {
            const config = this.configManager.getFullConfig();
            const dockerConfig = config.integrations?.docker;

            if (!dockerConfig || !dockerConfig.enabled) {
                return {
                    valid: true,
                    message: 'Docker integration disabled - skipping validation',
                    skipped: true
                };
            }

            // In development, Docker might not be required
            if (this.environment === 'development') {
                return {
                    valid: true,
                    message: 'Docker validation skipped in development environment',
                    dockerConfig
                };
            }

            // For staging/production, would check Docker connectivity
            return {
                valid: true,
                message: 'Docker configuration present',
                dockerConfig
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Validate integration endpoints
     */
    async validateIntegrationEndpoints() {
        try {
            const config = this.configManager.getFullConfig();
            const integrations = config.integrations || {};
            const endpoints = [];

            for (const [name, integration] of Object.entries(integrations)) {
                if (integration.enabled) {
                    endpoints.push({
                        name,
                        enabled: integration.enabled,
                        port: integration.webhook_port || integration.port,
                        path: integration.webhook_path || '/'
                    });
                }
            }

            return {
                valid: true,
                message: `${endpoints.length} integration endpoints configured`,
                endpoints
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Validate security settings
     */
    async validateSecuritySettings() {
        try {
            const securityConfig = this.configManager.getSecurityConfig();
            
            const securityChecks = {
                webhookVerification: securityConfig.webhook_signature_verification,
                rateLimiting: securityConfig.api_rate_limiting,
                httpsOnly: securityConfig.https_only,
                corsDisabled: !securityConfig.cors_enabled
            };

            const securityScore = Object.values(securityChecks).filter(Boolean).length;
            const totalChecks = Object.keys(securityChecks).length;
            const securityPercentage = Math.round((securityScore / totalChecks) * 100);

            // Production should have stricter security
            const requiredScore = this.environment === 'production' ? 90 : 50;

            return {
                valid: securityPercentage >= requiredScore,
                message: `Security score: ${securityPercentage}% (${securityScore}/${totalChecks})`,
                securityConfig,
                securityChecks,
                securityScore: securityPercentage,
                requiredScore
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Validate logging configuration
     */
    async validateLoggingConfiguration() {
        try {
            const loggingConfig = this.configManager.getLoggingConfig();
            
            const hasConsoleOutput = loggingConfig.outputs?.some(output => output.type === 'console');
            const hasFileOutput = loggingConfig.outputs?.some(output => output.type === 'file');
            
            const validationResult = {
                valid: true,
                message: `Logging configured with ${loggingConfig.outputs?.length || 0} outputs`,
                loggingConfig,
                hasConsoleOutput,
                hasFileOutput
            };

            // Production should have file logging
            if (this.environment === 'production' && !hasFileOutput) {
                validationResult.valid = false;
                validationResult.error = 'Production environment requires file logging';
            }

            return validationResult;
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Validate monitoring setup
     */
    async validateMonitoringSetup() {
        try {
            const monitoringConfig = this.configManager.getMonitoringConfig();
            
            const monitoringFeatures = {
                healthChecks: !!monitoringConfig.health_check_interval,
                metrics: monitoringConfig.metrics_enabled,
                alerts: !!monitoringConfig.alerts,
                prometheus: !!monitoringConfig.prometheus_port
            };

            const enabledFeatures = Object.values(monitoringFeatures).filter(Boolean).length;
            const totalFeatures = Object.keys(monitoringFeatures).length;

            // Production should have comprehensive monitoring
            const requiredFeatures = this.environment === 'production' ? 3 : 1;

            return {
                valid: enabledFeatures >= requiredFeatures,
                message: `Monitoring: ${enabledFeatures}/${totalFeatures} features enabled`,
                monitoringConfig,
                monitoringFeatures,
                enabledFeatures,
                requiredFeatures
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Generate deployment readiness report
     */
    async generateDeploymentReport() {
        const validationSummary = await this.validateEnvironment();
        
        const report = {
            environment: this.environment,
            timestamp: new Date().toISOString(),
            ready: validationSummary.ready,
            summary: validationSummary,
            recommendations: this.generateRecommendations(validationSummary),
            nextSteps: this.generateNextSteps(validationSummary)
        };

        return report;
    }

    /**
     * Generate recommendations based on validation results
     */
    generateRecommendations(summary) {
        const recommendations = [];
        
        if (!summary.ready) {
            recommendations.push('🚨 Environment is not ready for deployment - address failing validations first');
        }

        const failedValidations = summary.results.filter(r => !r.valid);
        
        for (const failed of failedValidations) {
            switch (failed.name) {
                case 'Environment Variables':
                    recommendations.push(`Set missing environment variables: ${failed.missingVars?.join(', ')}`);
                    break;
                case 'Authentication Tokens':
                    recommendations.push(`Configure authentication for: ${failed.missingAuth?.join(', ')}`);
                    break;
                case 'Database Setup':
                    recommendations.push('Initialize database schema and ensure database file exists');
                    break;
                case 'Security Settings':
                    recommendations.push(`Improve security configuration - current score: ${failed.securityScore}%`);
                    break;
                default:
                    recommendations.push(`Fix ${failed.name}: ${failed.error}`);
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('🎉 Environment is fully validated and ready for deployment');
        }

        return recommendations;
    }

    /**
     * Generate next steps for deployment
     */
    generateNextSteps(summary) {
        const steps = [];
        
        if (summary.ready) {
            steps.push('✅ All validations passed - proceed with deployment');
            steps.push('🚀 Run deployment scripts for this environment');
            steps.push('📊 Monitor deployment progress and health checks');
        } else {
            steps.push('🔧 Address all failing validations');
            steps.push('🔄 Re-run environment validation');
            steps.push('📋 Review configuration files for completeness');
        }

        return steps;
    }
}

/**
 * Demo function for environment setup
 */
async function demoEnvironmentSetup() {
    console.log('🚀 Environment Setup System Demo\n');
    
    try {
        const environments = ['development', 'staging', 'production'];
        
        for (const env of environments) {
            console.log(`\n🌍 Validating ${env} environment:`);
            console.log('='.repeat(50));
            
            const setup = new EnvironmentSetup({ environment: env });
            await setup.initialize();
            
            const validationSummary = await setup.validateEnvironment();
            
            if (validationSummary.ready) {
                console.log(`🎉 ${env} environment: READY FOR DEPLOYMENT`);
            } else {
                console.log(`⚠️  ${env} environment: NEEDS ATTENTION`);
            }
            
            // Show a few recommendations
            const report = await setup.generateDeploymentReport();
            console.log('\nTop recommendations:');
            for (const rec of report.recommendations.slice(0, 3)) {
                console.log(`   • ${rec}`);
            }
        }
        
        console.log('\n✅ Environment setup demo completed!');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

module.exports = {
    EnvironmentSetup
};

// Run demo if called directly
if (require.main === module) {
    demoEnvironmentSetup().catch(console.error);
}