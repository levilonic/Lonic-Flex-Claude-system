const { info, warn, error } = require('../services/logger');
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
        this.configFile = path.join(__dirname, 'secrets.encrypted.json');
        this.isInitialized = false;
        
        // Encryption settings
        this.algorithm = 'aes-256-gcm';
        this.keyDerivationIterations = 100000;
        this.saltLength = 32;
        this.ivLength = 16;
        this.tagLength = 16;
        
        // Master key (derived from environment)
        this.masterKey = null;
    }

    /**
     * Initialize authentication manager
     */
    async initialize() {
        if (this.isInitialized) return;

        // Derive master key from environment
        await this.deriveMasterKey();

        // Load environment variables
        this.loadFromEnvironment();

        // Load encrypted config file if exists
        await this.loadEncryptedConfig();

        this.isInitialized = true;
        info('Authentication Manager initialized');
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

        info(`Loaded ${tokensLoaded} tokens from environment variables`);
    }

    /**
     * Derive master key from environment variables
     */
    async deriveMasterKey() {
        // Get passphrase from environment (fallback to default for development)
        const passphrase = process.env.SECRETS_PASSPHRASE || 'lonicflex-default-key-dev-only';
        const salt = process.env.SECRETS_SALT || 'lonicflex-salt-dev-only';
        
        if (passphrase === 'lonicflex-default-key-dev-only') {
            console.warn('WARN  Using default passphrase - set SECRETS_PASSPHRASE for production');
        }
        
        // Derive key using PBKDF2
        this.masterKey = crypto.pbkdf2Sync(passphrase, salt, this.keyDerivationIterations, 32, 'sha256');
        info(' Master key derived successfully');
    }

    /**
     * Encrypt data using AES-256-GCM
     */
    encrypt(plaintext) {
        if (!this.masterKey) {
            throw new Error('Master key not initialized');
        }
        
        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipherGCM(this.algorithm, this.masterKey, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const tag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex')
        };
    }

    /**
     * Decrypt data using AES-256-GCM
     */
    decrypt(encryptedData) {
        if (!this.masterKey) {
            throw new Error('Master key not initialized');
        }
        
        const { encrypted, iv, tag } = encryptedData;
        
        const decipher = crypto.createDecipherGCM(this.algorithm, this.masterKey, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Load encrypted configuration file
     */
    async loadEncryptedConfig() {
        try {
            const configExists = await fs.access(this.configFile).then(() => true).catch(() => false);
            if (!configExists) {
                info(' No encrypted config file found - using environment only');
                return;
            }

            // Load and decrypt the configuration
            const encryptedContent = await fs.readFile(this.configFile, 'utf-8');
            const encryptedData = JSON.parse(encryptedContent);
            
            for (const [key, value] of Object.entries(encryptedData.secrets || {})) {
                try {
                    const decryptedValue = this.decrypt(value);
                    this.secrets.set(key, decryptedValue);
                } catch (error) {
                    console.warn(`WARN  Failed to decrypt secret: ${key}`);
                }
            }
            
            info(`Loaded ${this.secrets.size} encrypted secrets`);
        } catch (error) {
            console.warn('WARN  Error loading encrypted config:', error.message);
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
        // Auto-detect repository from git config if not explicitly set
        let owner = process.env.GITHUB_OWNER;
        let repo = process.env.GITHUB_REPO;
        
        if (!owner || !repo) {
            try {
                const { execSync } = require('child_process');
                const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
                
                // Parse GitHub URL (handles both https and ssh formats)
                const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
                if (match) {
                    owner = owner || match[1];
                    repo = repo || match[2];
                }
            } catch (error) {
                console.warn('WARN  Could not auto-detect GitHub repository, using defaults');
            }
        }
        
        return {
            token: this.getToken('github'),
            owner: owner || 'anthropics',
            repo: repo || 'claude-code',
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
        info(`${service} token configured`);
    }

    /**
     * Store encrypted secret
     */
    async storeSecret(key, value) {
        if (!this.masterKey) {
            throw new Error('Master key not initialized - call initialize() first');
        }
        
        const encrypted = this.encrypt(value);
        this.secrets.set(key, value); // Store decrypted in memory
        
        // Save to encrypted file
        await this.saveEncryptedSecrets(key, encrypted);
        info(` Secret stored and encrypted: ${key}`);
    }

    /**
     * Save encrypted secrets to file
     */
    async saveEncryptedSecrets(key, encryptedValue) {
        try {
            // Load existing secrets file
            let existingSecrets = {};
            try {
                const content = await fs.readFile(this.configFile, 'utf-8');
                existingSecrets = JSON.parse(content);
            } catch (error) {
                // File doesn't exist yet - that's okay
            }
            
            // Add new encrypted secret
            if (!existingSecrets.secrets) {
                existingSecrets.secrets = {};
            }
            existingSecrets.secrets[key] = encryptedValue;
            existingSecrets.updated = new Date().toISOString();
            
            // Write back to file
            await fs.writeFile(this.configFile, JSON.stringify(existingSecrets, null, 2));
        } catch (error) {
            error('FAIL Failed to save encrypted secrets:', error.message);
            throw error;
        }
    }

    /**
     * Rotate all API keys
     */
    async rotateApiKeys() {
        info('CYCLE Starting API key rotation...');
        const rotationResults = [];
        
        // GitHub token rotation (if configured)
        if (this.tokens.has('github_token')) {
            try {
                const result = await this.rotateGitHubToken();
                rotationResults.push(result);
            } catch (error) {
                rotationResults.push({
                    service: 'github',
                    success: false,
                    error: error.message
                });
            }
        }
        
        // Slack token rotation (if configured) 
        if (this.tokens.has('slack_token')) {
            try {
                const result = await this.rotateSlackToken();
                rotationResults.push(result);
            } catch (error) {
                rotationResults.push({
                    service: 'slack',
                    success: false,
                    error: error.message
                });
            }
        }
        
        info('CYCLE API key rotation completed');
        return rotationResults;
    }

    /**
     * Rotate GitHub token (placeholder - requires GitHub App)
     */
    async rotateGitHubToken() {
        info('CYCLE Rotating GitHub token...');
        
        // In a real implementation, this would:
        // 1. Generate new token via GitHub API
        // 2. Test new token
        // 3. Store encrypted backup of old token
        // 4. Update current token
        // 5. Revoke old token after delay
        
        return {
            service: 'github',
            success: false,
            message: 'GitHub token rotation requires GitHub App setup'
        };
    }

    /**
     * Rotate Slack token (placeholder - requires Slack App refresh)
     */
    async rotateSlackToken() {
        info('CYCLE Rotating Slack token...');
        
        // In a real implementation, this would:
        // 1. Use refresh token to get new access token
        // 2. Test new token
        // 3. Store encrypted backup of old token
        // 4. Update current token
        
        return {
            service: 'slack',
            success: false,
            message: 'Slack token rotation requires refresh token setup'
        };
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
    info(' Authentication Manager Demo\n');

    const auth = getAuthManager();
    await auth.initialize();

    info('METRICS Authentication Status:');
    const status = auth.getAuthStatus();
    info(JSON.stringify(status, null, 2));

    info('\nTEST Testing agent validations:');
    const agents = ['github', 'security', 'slack', 'deploy'];
    
    for (const agent of agents) {
        const validation = await auth.validateAgentAuth(agent);
        const icon = validation.valid ? 'PASS' : 'FAIL';
        info(`${icon} ${agent}: ${validation.valid ? 'Ready' : validation.error}`);
        if (!validation.valid && validation.suggestion) {
            info(`    ${validation.suggestion}`);
        }
    }

    info('\nPASS Authentication Manager demo completed!');
}

module.exports = {
    AuthManager,
    getAuthManager
};

// Run demo if called directly
if (require.main === module) {
    demoAuthManager().catch(console.error);
}