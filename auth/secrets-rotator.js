/**
 * Secrets Rotation System
 * Automated API key rotation and management for LonicFLex agents
 * Following 12-Factor principles for security and configuration
 */

const { getAuthManager } = require('./auth-manager');
const cron = require('node:timers');
const fs = require('fs').promises;
const path = require('path');

class SecretsRotator {
    constructor(options = {}) {
        this.authManager = getAuthManager();
        this.rotationSchedule = options.schedule || this.getDefaultSchedule();
        this.backupPath = options.backupPath || path.join(__dirname, 'secrets-backups');
        this.maxBackups = options.maxBackups || 5;
        this.rotationLog = [];
        this.isRunning = false;
        
        // Rotation intervals (in milliseconds)
        this.intervals = {
            github: 30 * 24 * 60 * 60 * 1000,    // 30 days
            slack: 90 * 24 * 60 * 60 * 1000,     // 90 days
            docker: 60 * 24 * 60 * 60 * 1000,    // 60 days
            anthropic: 90 * 24 * 60 * 60 * 1000, // 90 days
        };
    }

    /**
     * Get default rotation schedule
     */
    getDefaultSchedule() {
        return {
            enabled: process.env.ENABLE_SECRET_ROTATION !== 'false',
            checkInterval: 24 * 60 * 60 * 1000, // 24 hours
            rotationTime: '02:00', // 2 AM UTC
            timezone: 'UTC',
            services: {
                github: { enabled: true, interval: 30 },      // days
                slack: { enabled: true, interval: 90 },       // days  
                docker: { enabled: false, interval: 60 },     // days
                anthropic: { enabled: false, interval: 90 }   // days
            }
        };
    }

    /**
     * Start the secrets rotation scheduler
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️  Secrets rotator already running');
            return;
        }

        console.log('🔄 Starting secrets rotation scheduler...');
        
        // Ensure auth manager is initialized
        await this.authManager.initialize();
        
        // Create backup directory
        await this.ensureBackupDirectory();
        
        // Schedule rotation checks
        this.scheduleRotationChecks();
        
        this.isRunning = true;
        console.log('✅ Secrets rotation scheduler started');
        
        // Perform initial check
        await this.checkRotationNeeded();
    }

    /**
     * Stop the secrets rotation scheduler
     */
    stop() {
        if (!this.isRunning) return;
        
        if (this.rotationTimer) {
            clearInterval(this.rotationTimer);
            this.rotationTimer = null;
        }
        
        this.isRunning = false;
        console.log('🛑 Secrets rotation scheduler stopped');
    }

    /**
     * Schedule periodic rotation checks
     */
    scheduleRotationChecks() {
        const checkInterval = this.rotationSchedule.checkInterval;
        
        this.rotationTimer = setInterval(async () => {
            try {
                await this.checkRotationNeeded();
            } catch (error) {
                console.error('❌ Rotation check failed:', error.message);
                this.logRotationEvent('check_failed', null, { error: error.message });
            }
        }, checkInterval);
        
        console.log(`⏰ Rotation checks scheduled every ${checkInterval / (60 * 60 * 1000)} hours`);
    }

    /**
     * Check if any secrets need rotation
     */
    async checkRotationNeeded() {
        console.log('🔍 Checking for secrets needing rotation...');
        
        const services = Object.keys(this.rotationSchedule.services);
        const rotationNeeded = [];
        
        for (const service of services) {
            const serviceConfig = this.rotationSchedule.services[service];
            if (!serviceConfig.enabled) continue;
            
            const needsRotation = await this.shouldRotateService(service, serviceConfig.interval);
            if (needsRotation) {
                rotationNeeded.push(service);
            }
        }
        
        if (rotationNeeded.length > 0) {
            console.log(`🔄 Services needing rotation: ${rotationNeeded.join(', ')}`);
            await this.rotateServices(rotationNeeded);
        } else {
            console.log('✅ No secrets need rotation at this time');
        }
        
        return rotationNeeded;
    }

    /**
     * Check if a specific service should be rotated
     */
    async shouldRotateService(service, intervalDays) {
        try {
            const lastRotation = await this.getLastRotationTime(service);
            if (!lastRotation) {
                // Never rotated - check if token is old enough
                return await this.isTokenOldEnough(service, intervalDays);
            }
            
            const rotationAge = Date.now() - lastRotation;
            const rotationInterval = intervalDays * 24 * 60 * 60 * 1000;
            
            const shouldRotate = rotationAge >= rotationInterval;
            
            if (shouldRotate) {
                console.log(`🔄 ${service} token is ${Math.floor(rotationAge / (24 * 60 * 60 * 1000))} days old (threshold: ${intervalDays} days)`);
            }
            
            return shouldRotate;
        } catch (error) {
            console.warn(`⚠️  Could not check rotation status for ${service}:`, error.message);
            return false;
        }
    }

    /**
     * Check if token is old enough to warrant initial rotation
     */
    async isTokenOldEnough(service, intervalDays) {
        // For now, assume tokens should be rotated if they're older than half the interval
        // In a real implementation, this would check token creation date from API
        const graceInterval = intervalDays * 0.5; // Half the rotation interval
        console.log(`📅 ${service} token age check - grace period: ${graceInterval} days`);
        return false; // Conservative approach - don't rotate without explicit history
    }

    /**
     * Get last rotation time for a service
     */
    async getLastRotationTime(service) {
        try {
            const logFile = path.join(this.backupPath, 'rotation-log.json');
            const logContent = await fs.readFile(logFile, 'utf-8');
            const log = JSON.parse(logContent);
            
            // Find most recent successful rotation for service
            const lastRotation = log
                .filter(entry => entry.service === service && entry.success)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                
            return lastRotation ? new Date(lastRotation.timestamp).getTime() : null;
        } catch (error) {
            // Log file doesn't exist or is corrupted
            return null;
        }
    }

    /**
     * Rotate secrets for multiple services
     */
    async rotateServices(services) {
        console.log(`🔄 Starting rotation for services: ${services.join(', ')}`);
        
        const results = [];
        
        for (const service of services) {
            try {
                console.log(`🔄 Rotating ${service} secrets...`);
                const result = await this.rotateServiceSecret(service);
                results.push(result);
                
                if (result.success) {
                    await this.backupOldSecret(service, result.oldToken);
                    console.log(`✅ ${service} secret rotated successfully`);
                } else {
                    console.error(`❌ Failed to rotate ${service} secret:`, result.error);
                }
                
                this.logRotationEvent('rotation_attempt', service, result);
                
                // Wait between rotations to avoid rate limits
                await this.sleep(5000);
                
            } catch (error) {
                const errorResult = {
                    service,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                results.push(errorResult);
                this.logRotationEvent('rotation_error', service, errorResult);
                console.error(`❌ Rotation failed for ${service}:`, error.message);
            }
        }
        
        console.log(`🔄 Rotation completed. Success: ${results.filter(r => r.success).length}/${results.length}`);
        return results;
    }

    /**
     * Rotate secret for a specific service
     */
    async rotateServiceSecret(service) {
        const rotationMethods = {
            github: () => this.rotateGitHubSecret(),
            slack: () => this.rotateSlackSecret(),
            docker: () => this.rotateDockerSecret(),
            anthropic: () => this.rotateAnthropicSecret()
        };
        
        const rotateMethod = rotationMethods[service.toLowerCase()];
        if (!rotateMethod) {
            throw new Error(`No rotation method defined for service: ${service}`);
        }
        
        return await rotateMethod();
    }

    /**
     * Rotate GitHub secret (placeholder implementation)
     */
    async rotateGitHubSecret() {
        console.log('🔄 GitHub secret rotation (simulated)...');
        
        // In a real implementation:
        // 1. Use GitHub App to generate new token
        // 2. Test new token with API call
        // 3. Store new token securely
        // 4. Schedule revocation of old token
        
        return {
            service: 'github',
            success: false,
            message: 'GitHub secret rotation requires GitHub App configuration',
            simulationMode: true,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Rotate Slack secret (placeholder implementation)
     */
    async rotateSlackSecret() {
        console.log('🔄 Slack secret rotation (simulated)...');
        
        // In a real implementation:
        // 1. Use refresh token to get new access token
        // 2. Test new token with API call
        // 3. Store new token securely
        // 4. Update all Slack integrations
        
        return {
            service: 'slack',
            success: false,
            message: 'Slack secret rotation requires OAuth refresh token setup',
            simulationMode: true,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Rotate Docker secret (placeholder implementation)
     */
    async rotateDockerSecret() {
        console.log('🔄 Docker secret rotation (simulated)...');
        
        return {
            service: 'docker',
            success: false,
            message: 'Docker secret rotation requires registry API setup',
            simulationMode: true,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Rotate Anthropic secret (placeholder implementation)
     */
    async rotateAnthropicSecret() {
        console.log('🔄 Anthropic secret rotation (simulated)...');
        
        return {
            service: 'anthropic',
            success: false,
            message: 'Anthropic secret rotation requires API key management setup',
            simulationMode: true,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Backup old secret before rotation
     */
    async backupOldSecret(service, oldToken) {
        if (!oldToken) return;
        
        try {
            const backupFile = path.join(this.backupPath, `${service}-backup-${Date.now()}.json`);
            const backup = {
                service,
                token: await this.authManager.encrypt(oldToken),
                timestamp: new Date().toISOString(),
                expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString() // 30 days
            };
            
            await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
            console.log(`💾 Backed up old ${service} secret`);
            
            // Clean up old backups
            await this.cleanupOldBackups(service);
        } catch (error) {
            console.warn(`⚠️  Failed to backup old ${service} secret:`, error.message);
        }
    }

    /**
     * Clean up old backup files
     */
    async cleanupOldBackups(service) {
        try {
            const files = await fs.readdir(this.backupPath);
            const serviceBackups = files
                .filter(file => file.startsWith(`${service}-backup-`))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupPath, file),
                    timestamp: parseInt(file.match(/-(\d+)\.json$/)?.[1] || '0')
                }))
                .sort((a, b) => b.timestamp - a.timestamp);
                
            // Keep only the most recent backups
            const toDelete = serviceBackups.slice(this.maxBackups);
            
            for (const backup of toDelete) {
                await fs.unlink(backup.path);
                console.log(`🗑️  Deleted old backup: ${backup.name}`);
            }
        } catch (error) {
            console.warn(`⚠️  Backup cleanup failed for ${service}:`, error.message);
        }
    }

    /**
     * Log rotation event
     */
    logRotationEvent(eventType, service, data) {
        const event = {
            eventType,
            service,
            timestamp: new Date().toISOString(),
            ...data
        };
        
        this.rotationLog.push(event);
        
        // Keep only recent log entries in memory
        if (this.rotationLog.length > 1000) {
            this.rotationLog = this.rotationLog.slice(-500);
        }
        
        // Persist to file
        this.persistRotationLog(event);
    }

    /**
     * Persist rotation log to file
     */
    async persistRotationLog(event) {
        try {
            const logFile = path.join(this.backupPath, 'rotation-log.json');
            
            let existingLog = [];
            try {
                const content = await fs.readFile(logFile, 'utf-8');
                existingLog = JSON.parse(content);
            } catch (error) {
                // Log file doesn't exist yet
            }
            
            existingLog.push(event);
            
            // Keep only recent entries in file
            if (existingLog.length > 10000) {
                existingLog = existingLog.slice(-5000);
            }
            
            await fs.writeFile(logFile, JSON.stringify(existingLog, null, 2));
        } catch (error) {
            console.warn('⚠️  Failed to persist rotation log:', error.message);
        }
    }

    /**
     * Ensure backup directory exists
     */
    async ensureBackupDirectory() {
        try {
            await fs.access(this.backupPath);
        } catch (error) {
            await fs.mkdir(this.backupPath, { recursive: true });
            console.log(`📁 Created backup directory: ${this.backupPath}`);
        }
    }

    /**
     * Get rotation status summary
     */
    async getRotationStatus() {
        const services = Object.keys(this.rotationSchedule.services);
        const status = {};
        
        for (const service of services) {
            const lastRotation = await this.getLastRotationTime(service);
            const serviceConfig = this.rotationSchedule.services[service];
            
            status[service] = {
                enabled: serviceConfig.enabled,
                intervalDays: serviceConfig.interval,
                lastRotation: lastRotation ? new Date(lastRotation) : null,
                daysSinceRotation: lastRotation ? Math.floor((Date.now() - lastRotation) / (24 * 60 * 60 * 1000)) : null,
                nextRotationDue: lastRotation ? new Date(lastRotation + (serviceConfig.interval * 24 * 60 * 60 * 1000)) : null
            };
        }
        
        return {
            schedulerRunning: this.isRunning,
            checkInterval: this.rotationSchedule.checkInterval,
            services: status,
            recentEvents: this.rotationLog.slice(-10)
        };
    }

    /**
     * Force rotation of specific service (for testing/emergency)
     */
    async forceRotateService(service) {
        console.log(`🔧 Force rotating ${service} secret...`);
        
        if (!this.rotationSchedule.services[service]) {
            throw new Error(`Unknown service: ${service}`);
        }
        
        const result = await this.rotateServiceSecret(service);
        this.logRotationEvent('force_rotation', service, result);
        
        return result;
    }

    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Demo function for secrets rotation
 */
async function demoSecretsRotation() {
    console.log('🔄 Secrets Rotation System Demo\n');
    
    try {
        const rotator = new SecretsRotator();
        
        console.log('📋 Rotation Configuration:');
        console.log('   • GitHub tokens: 30 day rotation');
        console.log('   • Slack tokens: 90 day rotation');
        console.log('   • Docker tokens: 60 day rotation (disabled)');
        console.log('   • Daily rotation checks at 2 AM UTC');
        
        // Start the rotation scheduler
        await rotator.start();
        
        // Get current status
        const status = await rotator.getRotationStatus();
        console.log('\n📊 Current Rotation Status:');
        for (const [service, serviceStatus] of Object.entries(status.services)) {
            const enabled = serviceStatus.enabled ? '✅' : '❌';
            const lastRotation = serviceStatus.lastRotation ? 
                serviceStatus.lastRotation.toISOString().split('T')[0] : 'Never';
            console.log(`   ${enabled} ${service}: Last rotated ${lastRotation} (${serviceStatus.intervalDays} day interval)`);
        }
        
        // Simulate rotation check
        console.log('\n🔍 Checking for services needing rotation...');
        const neededRotation = await rotator.checkRotationNeeded();
        
        if (neededRotation.length === 0) {
            console.log('✅ No rotations needed at this time');
        }
        
        // Stop the scheduler
        rotator.stop();
        
        console.log('\n✅ Secrets rotation demo completed!');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

module.exports = {
    SecretsRotator
};

// Run demo if called directly
if (require.main === module) {
    demoSecretsRotation().catch(console.error);
}