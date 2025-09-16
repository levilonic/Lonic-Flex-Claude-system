/**
 * Secrets Validation and Health Checking System
 * Real-time validation and monitoring of API tokens and secrets
 * Following 12-Factor principles for observability and health checks
 */

const { getAuthManager } = require('./auth-manager');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class SecretsValidator {
    constructor(options = {}) {
        this.authManager = getAuthManager();
        this.validationInterval = options.interval || 60000; // 1 minute
        this.healthCheckTimeout = options.timeout || 10000; // 10 seconds
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 5000;
        
        this.validationResults = new Map();
        this.healthHistory = [];
        this.isRunning = false;
        this.validationTimer = null;
        
        // API endpoints for validation
        this.validationEndpoints = {
            github: 'https://api.github.com/user',
            slack: 'https://slack.com/api/auth.test',
            docker: 'https://index.docker.io/v1/users/self',
            anthropic: 'https://api.anthropic.com/v1/messages' // Placeholder
        };
    }

    /**
     * Start the secrets validation monitoring
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️  Secrets validator already running');
            return;
        }

        console.log('🔍 Starting secrets validation monitoring...');
        
        // Ensure auth manager is initialized
        await this.authManager.initialize();
        
        // Perform initial validation
        await this.validateAllSecrets();
        
        // Schedule periodic validations
        this.scheduleValidations();
        
        this.isRunning = true;
        console.log('✅ Secrets validation monitoring started');
    }

    /**
     * Stop the secrets validation monitoring
     */
    stop() {
        if (!this.isRunning) return;
        
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
            this.validationTimer = null;
        }
        
        this.isRunning = false;
        console.log('🛑 Secrets validation monitoring stopped');
    }

    /**
     * Schedule periodic validations
     */
    scheduleValidations() {
        this.validationTimer = setInterval(async () => {
            try {
                await this.validateAllSecrets();
            } catch (error) {
                console.error('❌ Scheduled validation failed:', error.message);
                this.recordValidationResult('system', {
                    valid: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }, this.validationInterval);
        
        console.log(`⏰ Validations scheduled every ${this.validationInterval / 1000} seconds`);
    }

    /**
     * Validate all configured secrets
     */
    async validateAllSecrets() {
        console.log('🔍 Validating all secrets...');
        
        const services = ['github', 'slack', 'docker', 'anthropic'];
        const results = {};
        
        for (const service of services) {
            try {
                const result = await this.validateServiceSecret(service);
                results[service] = result;
                this.recordValidationResult(service, result);
                
                const status = result.valid ? '✅' : '❌';
                console.log(`${status} ${service}: ${result.valid ? 'Valid' : result.error}`);
                
            } catch (error) {
                const errorResult = {
                    valid: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                results[service] = errorResult;
                this.recordValidationResult(service, errorResult);
                console.error(`❌ ${service} validation failed:`, error.message);
            }
        }
        
        // Record overall health
        const validCount = Object.values(results).filter(r => r.valid).length;
        const totalCount = Object.keys(results).length;
        
        this.recordHealthSnapshot({
            timestamp: new Date().toISOString(),
            validSecrets: validCount,
            totalSecrets: totalCount,
            healthScore: (validCount / totalCount) * 100,
            results
        });
        
        console.log(`📊 Validation completed: ${validCount}/${totalCount} secrets valid`);
        return results;
    }

    /**
     * Validate a specific service secret
     */
    async validateServiceSecret(service) {
        const validators = {
            github: () => this.validateGitHubToken(),
            slack: () => this.validateSlackToken(),
            docker: () => this.validateDockerToken(),
            anthropic: () => this.validateAnthropicToken()
        };
        
        const validator = validators[service.toLowerCase()];
        if (!validator) {
            throw new Error(`No validator defined for service: ${service}`);
        }
        
        return await this.withRetries(validator, service);
    }

    /**
     * Validate GitHub token
     */
    async validateGitHubToken() {
        try {
            const token = this.authManager.getToken('github');
            
            const response = await axios.get(this.validationEndpoints.github, {
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'LonicFLex-Secrets-Validator'
                },
                timeout: this.healthCheckTimeout
            });
            
            return {
                valid: true,
                service: 'github',
                user: response.data.login,
                rateLimit: response.headers['x-ratelimit-remaining'],
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                valid: false,
                service: 'github',
                error: this.parseError(error),
                httpStatus: error.response?.status,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Validate Slack token
     */
    async validateSlackToken() {
        try {
            const token = this.authManager.getToken('slack');
            
            const response = await axios.post(this.validationEndpoints.slack, 
                new URLSearchParams({ token }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: this.healthCheckTimeout
                }
            );
            
            if (response.data.ok) {
                return {
                    valid: true,
                    service: 'slack',
                    user: response.data.user,
                    team: response.data.team,
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    valid: false,
                    service: 'slack',
                    error: response.data.error || 'Unknown Slack API error',
                    timestamp: new Date().toISOString()
                };
            }
            
        } catch (error) {
            return {
                valid: false,
                service: 'slack',
                error: this.parseError(error),
                httpStatus: error.response?.status,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Validate Docker token (placeholder - registry dependent)
     */
    async validateDockerToken() {
        try {
            // Docker token validation depends on the registry
            // For Docker Hub, we'd use different endpoints
            // This is a placeholder implementation
            
            const token = this.authManager.tokens.get('docker_token');
            if (!token) {
                return {
                    valid: false,
                    service: 'docker',
                    error: 'No Docker token configured',
                    timestamp: new Date().toISOString()
                };
            }
            
            // Simulated validation (always valid for now)
            return {
                valid: true,
                service: 'docker',
                message: 'Docker token validation not implemented - assumed valid',
                simulationMode: true,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                valid: false,
                service: 'docker',
                error: this.parseError(error),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Validate Anthropic token (placeholder)
     */
    async validateAnthropicToken() {
        try {
            const token = this.authManager.tokens.get('anthropic_api_key');
            if (!token) {
                return {
                    valid: false,
                    service: 'anthropic',
                    error: 'No Anthropic API key configured',
                    timestamp: new Date().toISOString()
                };
            }
            
            // Placeholder validation
            return {
                valid: true,
                service: 'anthropic',
                message: 'Anthropic token validation not implemented - assumed valid',
                simulationMode: true,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                valid: false,
                service: 'anthropic',
                error: this.parseError(error),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Execute validation with retries
     */
    async withRetries(validatorFn, serviceName) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const result = await validatorFn();
                
                if (attempt > 1) {
                    console.log(`✅ ${serviceName} validation succeeded on attempt ${attempt}`);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.maxRetries) {
                    console.warn(`⚠️  ${serviceName} validation failed (attempt ${attempt}/${this.maxRetries}), retrying in ${this.retryDelay}ms...`);
                    await this.sleep(this.retryDelay);
                } else {
                    console.error(`❌ ${serviceName} validation failed after ${this.maxRetries} attempts`);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Parse error message from axios response
     */
    parseError(error) {
        if (error.response) {
            // HTTP error response
            const status = error.response.status;
            const message = error.response.data?.message || error.response.statusText;
            return `HTTP ${status}: ${message}`;
        } else if (error.request) {
            // Network error
            return 'Network error - no response received';
        } else {
            // Other error
            return error.message || 'Unknown error';
        }
    }

    /**
     * Record validation result
     */
    recordValidationResult(service, result) {
        this.validationResults.set(service, {
            ...result,
            recordedAt: new Date().toISOString()
        });
        
        // Emit alert for failed validations
        if (!result.valid && !result.simulationMode) {
            this.emitSecretAlert(service, result);
        }
    }

    /**
     * Record health snapshot
     */
    recordHealthSnapshot(snapshot) {
        this.healthHistory.push(snapshot);
        
        // Keep only recent history
        if (this.healthHistory.length > 1000) {
            this.healthHistory = this.healthHistory.slice(-500);
        }
        
        // Emit alert for poor health
        if (snapshot.healthScore < 50) {
            this.emitHealthAlert(snapshot);
        }
    }

    /**
     * Emit secret validation alert
     */
    emitSecretAlert(service, result) {
        const alert = {
            type: 'secret_validation_failed',
            service,
            error: result.error,
            timestamp: result.timestamp,
            severity: 'high'
        };
        
        console.warn(`🚨 SECRET ALERT: ${service} validation failed - ${result.error}`);
        
        // In a real implementation, this would send to monitoring system
        this.sendAlert(alert);
    }

    /**
     * Emit overall health alert
     */
    emitHealthAlert(snapshot) {
        const alert = {
            type: 'secrets_health_degraded',
            healthScore: snapshot.healthScore,
            validSecrets: snapshot.validSecrets,
            totalSecrets: snapshot.totalSecrets,
            timestamp: snapshot.timestamp,
            severity: snapshot.healthScore < 25 ? 'critical' : 'high'
        };
        
        console.warn(`🚨 HEALTH ALERT: Secrets health degraded to ${snapshot.healthScore}%`);
        
        this.sendAlert(alert);
    }

    /**
     * Send alert to monitoring systems
     */
    sendAlert(alert) {
        // Placeholder for alert integration
        // In production, this would send to:
        // - Slack channels
        // - PagerDuty
        // - Email notifications
        // - Webhook endpoints
        
        console.log(`📢 Alert would be sent:`, JSON.stringify(alert, null, 2));
    }

    /**
     * Get validation status summary
     */
    getValidationStatus() {
        const results = {};
        for (const [service, result] of this.validationResults.entries()) {
            results[service] = {
                valid: result.valid,
                lastChecked: result.timestamp,
                error: result.error || null,
                simulationMode: result.simulationMode || false
            };
        }
        
        const recentHealth = this.healthHistory.slice(-1)[0];
        
        return {
            monitoringActive: this.isRunning,
            lastValidation: recentHealth?.timestamp,
            overallHealth: recentHealth?.healthScore || 0,
            validSecrets: recentHealth?.validSecrets || 0,
            totalSecrets: recentHealth?.totalSecrets || 0,
            services: results,
            healthHistory: this.healthHistory.slice(-10) // Recent history
        };
    }

    /**
     * Force validation of specific service
     */
    async forceValidateService(service) {
        console.log(`🔧 Force validating ${service}...`);
        
        try {
            const result = await this.validateServiceSecret(service);
            this.recordValidationResult(service, result);
            return result;
        } catch (error) {
            const errorResult = {
                valid: false,
                service,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            this.recordValidationResult(service, errorResult);
            return errorResult;
        }
    }

    /**
     * Get detailed health report
     */
    async generateHealthReport() {
        const currentStatus = this.getValidationStatus();
        
        // Calculate trends
        const recentHistory = this.healthHistory.slice(-10);
        const healthTrend = this.calculateHealthTrend(recentHistory);
        
        // Service-specific analysis
        const serviceAnalysis = {};
        for (const [service, result] of this.validationResults.entries()) {
            serviceAnalysis[service] = {
                currentStatus: result.valid ? 'healthy' : 'unhealthy',
                lastError: result.error,
                recommendation: this.getServiceRecommendation(service, result)
            };
        }
        
        return {
            timestamp: new Date().toISOString(),
            summary: {
                overallHealth: currentStatus.overallHealth,
                trend: healthTrend,
                monitoringActive: currentStatus.monitoringActive
            },
            services: serviceAnalysis,
            recommendations: this.getOverallRecommendations(currentStatus),
            healthHistory: recentHistory
        };
    }

    /**
     * Calculate health trend from recent history
     */
    calculateHealthTrend(history) {
        if (history.length < 2) return 'insufficient_data';
        
        const recent = history.slice(-5);
        const older = history.slice(-10, -5);
        
        const recentAvg = recent.reduce((sum, h) => sum + h.healthScore, 0) / recent.length;
        const olderAvg = older.reduce((sum, h) => sum + h.healthScore, 0) / (older.length || 1);
        
        const diff = recentAvg - olderAvg;
        
        if (diff > 5) return 'improving';
        if (diff < -5) return 'degrading';
        return 'stable';
    }

    /**
     * Get service-specific recommendation
     */
    getServiceRecommendation(service, result) {
        if (result.valid) {
            return 'Service is healthy - no action needed';
        }
        
        const errorRecommendations = {
            'HTTP 401': 'Token has expired or is invalid - rotation needed',
            'HTTP 403': 'Token lacks required permissions - check scopes',
            'HTTP 429': 'Rate limit exceeded - implement backoff strategy',
            'Network error': 'Check network connectivity and firewall rules',
            'timeout': 'Increase timeout or check service availability'
        };
        
        for (const [pattern, recommendation] of Object.entries(errorRecommendations)) {
            if (result.error?.includes(pattern)) {
                return recommendation;
            }
        }
        
        return 'Check token configuration and service status';
    }

    /**
     * Get overall system recommendations
     */
    getOverallRecommendations(status) {
        const recommendations = [];
        
        if (status.overallHealth < 50) {
            recommendations.push('URGENT: Multiple secrets failing validation - immediate attention required');
        }
        
        if (status.overallHealth < 75) {
            recommendations.push('Several secrets need attention - review and rotate as needed');
        }
        
        if (!status.monitoringActive) {
            recommendations.push('Secrets monitoring is not active - start monitoring service');
        }
        
        const failingServices = Object.entries(status.services)
            .filter(([_, result]) => !result.valid && !result.simulationMode)
            .map(([service, _]) => service);
            
        if (failingServices.length > 0) {
            recommendations.push(`Focus on these failing services: ${failingServices.join(', ')}`);
        }
        
        return recommendations.length > 0 ? recommendations : ['All secrets are healthy - continue monitoring'];
    }

    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Demo function for secrets validation
 */
async function demoSecretsValidation() {
    console.log('🔍 Secrets Validation System Demo\n');
    
    try {
        const validator = new SecretsValidator({
            interval: 30000, // 30 seconds for demo
            timeout: 5000    // 5 seconds timeout
        });
        
        console.log('📋 Validation Configuration:');
        console.log('   • GitHub API validation');
        console.log('   • Slack API validation');
        console.log('   • Docker registry validation (placeholder)');
        console.log('   • Anthropic API validation (placeholder)');
        console.log('   • 30-second validation intervals');
        console.log('   • 3 retry attempts with 5-second delays');
        
        // Start monitoring
        await validator.start();
        
        // Wait for a few validation cycles
        console.log('\n⏳ Running validation cycles...');
        await validator.sleep(5000);
        
        // Get status report
        const status = validator.getValidationStatus();
        console.log('\n📊 Validation Status:');
        console.log(`   Overall Health: ${status.overallHealth}%`);
        console.log(`   Valid Secrets: ${status.validSecrets}/${status.totalSecrets}`);
        
        for (const [service, result] of Object.entries(status.services)) {
            const statusIcon = result.valid ? '✅' : '❌';
            const mode = result.simulationMode ? ' (simulated)' : '';
            console.log(`   ${statusIcon} ${service}: ${result.valid ? 'Valid' : result.error}${mode}`);
        }
        
        // Generate health report
        console.log('\n📋 Generating detailed health report...');
        const healthReport = await validator.generateHealthReport();
        
        console.log('\n🏥 Health Report Summary:');
        console.log(`   Trend: ${healthReport.summary.trend}`);
        console.log(`   Recommendations: ${healthReport.recommendations.length}`);
        
        for (const recommendation of healthReport.recommendations.slice(0, 3)) {
            console.log(`   • ${recommendation}`);
        }
        
        // Stop monitoring
        validator.stop();
        
        console.log('\n✅ Secrets validation demo completed!');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

module.exports = {
    SecretsValidator
};

// Run demo if called directly
if (require.main === module) {
    demoSecretsValidation().catch(console.error);
}