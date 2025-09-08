/**
 * Authentication Manager
 * Centralized token and secret management for LonicFLex agents
 * Following 12-Factor principles for configuration management
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class AuthManager {
    constructor() {
        this.tokens = new Map();
        this.secrets = new Map();
        this.configFile = path.join(__dirname, '..', 'auth', 'tokens.encrypted.json');
        this.isInitialized = false;
    }

    /**
     * Initialize authentication manager
     */
    async initialize() {
        if (this.isInitialized) return;

        // Load environment variables
        this.loadFromEnvironment();

        // Load encrypted config file if exists
        await this.loadEncryptedConfig();

        this.isInitialized = true;
        console.log('✅ Authentication Manager initialized');
    }

    /**
     * Load authentication from environment variables
     */
    loadFromEnvironment() {
        const envMappings = {
            'github_token': process.env.GITHUB_TOKEN,
            'slack_token': process.env.SLACK_TOKEN,
            'slack_signing_secret': process.env.SLACK_SIGNING_SECRET,
            'docker_token': process.env.DOCKER_TOKEN,
            'anthropic_api_key': process.env.ANTHROPIC_API_KEY,
            'openai_api_key': process.env.OPENAI_API_KEY
        };

        let tokensLoaded = 0;
        for (const [key, value] of Object.entries(envMappings)) {
            if (value) {
                this.tokens.set(key, value);
                tokensLoaded++;
            }
        }

        console.log(`✅ Loaded ${tokensLoaded} tokens from environment variables`);
    }

    /**
     * Load encrypted configuration file
     */
    async loadEncryptedConfig() {
        try {
            const configExists = await fs.access(this.configFile).then(() => true).catch(() => false);
            if (!configExists) {
                console.log('📝 No encrypted config file found - using environment only');
                return;
            }

            // In a real implementation, this would decrypt the file
            // For now, just create the structure
            console.log('📝 Encrypted config support ready (not implemented)');
        } catch (error) {
            console.warn('⚠️  Error loading encrypted config:', error.message);
        }
    }

    /**
     * Get authentication token for service
     */
    getToken(service) {
        if (!this.isInitialized) {
            throw new Error('AuthManager not initialized - call initialize() first');
        }

        const token = this.tokens.get(`${service.toLowerCase()}_token`);
        if (!token) {
            throw new Error(`${service} token not configured. Set ${service.toUpperCase()}_TOKEN environment variable.`);
        }

        return token;
    }

    /**
     * Get secret for service
     */
    getSecret(service, secretType) {
        if (!this.isInitialized) {
            throw new Error('AuthManager not initialized - call initialize() first');
        }

        const key = `${service.toLowerCase()}_${secretType.toLowerCase()}`;
        const secret = this.secrets.get(key) || this.tokens.get(key);
        
        if (!secret) {
            throw new Error(`${service} ${secretType} not configured`);
        }

        return secret;
    }

    /**
     * Validate authentication for agent
     */
    async validateAgentAuth(agentName) {
        const validations = {
            github: () => this.getToken('github'),
            slack: () => this.getToken('slack'),
            docker: () => this.getToken('docker'),
            security: () => true, // Security agent doesn't need external auth
            code: () => true, // Code agent works with local files
            deploy: () => this.getToken('docker'), // Deploy needs Docker
            comm: () => this.getToken('slack') // Comm needs Slack
        };

        try {
            const validator = validations[agentName.toLowerCase()];
            if (!validator) {
                throw new Error(`No validation defined for agent: ${agentName}`);
            }

            const result = validator();
            return { valid: true, token: result };
        } catch (error) {
            return { 
                valid: false, 
                error: error.message,
                suggestion: `Set the required environment variable: ${error.message.match(/Set (\w+)/)?.[1] || 'TOKEN'}`
            };
        }
    }

    /**
     * Get GitHub configuration for agent
     */
    getGitHubConfig() {
        return {
            token: this.getToken('github'),
            owner: process.env.GITHUB_OWNER || 'anthropics',
            repo: process.env.GITHUB_REPO || 'claude-code',
            baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com'
        };
    }

    /**
     * Get Slack configuration for agent
     */
    getSlackConfig() {
        return {
            token: this.getToken('slack'),
            signingSecret: this.getSecret('slack', 'signing_secret'),
            appToken: process.env.SLACK_APP_TOKEN,
            port: process.env.SLACK_PORT || 3000
        };
    }

    /**
     * Get Docker configuration for agent
     */
    getDockerConfig() {
        return {
            token: this.tokens.get('docker_token'),
            host: process.env.DOCKER_HOST || 'unix:///var/run/docker.sock',
            registry: process.env.DOCKER_REGISTRY || 'docker.io'
        };
    }

    /**
     * Store new token (for development/testing)
     */
    setToken(service, token) {
        this.tokens.set(`${service.toLowerCase()}_token`, token);
        console.log(`✅ ${service} token configured`);
    }

    /**
     * Get authentication status summary
     */
    getAuthStatus() {
        const services = ['github', 'slack', 'docker'];
        const status = {};

        for (const service of services) {
            try {
                const token = this.getToken(service);
                status[service] = {
                    configured: true,
                    hasToken: !!token,
                    tokenLength: token ? token.length : 0
                };
            } catch (error) {
                status[service] = {
                    configured: false,
                    error: error.message
                };
            }
        }

        return status;
    }
}

// Singleton instance
let authManager = null;

/**
 * Get singleton auth manager instance
 */
function getAuthManager() {
    if (!authManager) {
        authManager = new AuthManager();
    }
    return authManager;
}

/**
 * Demo function
 */
async function demoAuthManager() {
    console.log('🔐 Authentication Manager Demo\n');

    const auth = getAuthManager();
    await auth.initialize();

    console.log('📊 Authentication Status:');
    const status = auth.getAuthStatus();
    console.log(JSON.stringify(status, null, 2));

    console.log('\n🧪 Testing agent validations:');
    const agents = ['github', 'security', 'slack', 'deploy'];
    
    for (const agent of agents) {
        const validation = await auth.validateAgentAuth(agent);
        const icon = validation.valid ? '✅' : '❌';
        console.log(`${icon} ${agent}: ${validation.valid ? 'Ready' : validation.error}`);
        if (!validation.valid && validation.suggestion) {
            console.log(`   💡 ${validation.suggestion}`);
        }
    }

    console.log('\n✅ Authentication Manager demo completed!');
}

module.exports = {
    AuthManager,
    getAuthManager
};

// Run demo if called directly
if (require.main === module) {
    demoAuthManager().catch(console.error);
}