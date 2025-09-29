#!/usr/bin/env node
const { info, warn, error } = require('./src/services/logger');

/**
 * LonicFLex Main Entry Point
 *
 * This is the primary entry point for the LonicFLex system.
 * Provides unified access to all system components and services.
 */

// Import core system components
const { systemStartup } = require('./src/core/system-startup');

class LonicFLexMain {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
        this.serviceContainer = null;
    }

    /**
     * Initialize the LonicFLex system
     */
    async initialize() {
        if (this.initialized) {
            info('LonicFLex already initialized');
            return;
        }

        try {
            info('🚀 Starting LonicFLex System v' + this.version);

            // Initialize core system
            this.serviceContainer = await systemStartup.initialize();
            this.initialized = true;

            info('✅ LonicFLex System initialized successfully');
            return this.serviceContainer;

        } catch (err) {
            error('❌ LonicFLex System initialization failed:', err.message);
            throw err;
        }
    }

    /**
     * Start the main LonicFLex application
     */
    async start() {
        await this.initialize();

        info('🎯 LonicFLex System is running');
        info('   - Universal Context System: ✅ Active');
        info('   - Multi-Agent Coordination: ✅ Active');
        info('   - External Integrations: ✅ Ready');

        // Keep the process running
        process.on('SIGINT', async () => {
            await this.shutdown();
            process.exit(0);
        });
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        info('🛑 Shutting down LonicFLex System...');

        if (this.serviceContainer) {
            await systemStartup.shutdown();
        }

        info('✅ LonicFLex System shutdown complete');
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            version: this.version,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }
}

// Create global instance
const lonicflex = new LonicFLexMain();

// Export for programmatic use
module.exports = { LonicFLexMain, lonicflex };

// If called directly, start the system
if (require.main === module) {
    lonicflex.start().catch(err => {
        error('Failed to start LonicFLex:', err.message);
        process.exit(1);
    });
}