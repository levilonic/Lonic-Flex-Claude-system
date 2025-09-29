/**
 * System Startup - Proper Dependency Injection Initialization
 *
 * This file implements proper software engineering patterns:
 * 1. Single initialization point (not every agent initializing)
 * 2. Dependency injection container initialized ONCE
 * 3. Clean error handling and validation
 * 4. No fake success reporting
 */

const { initializeGlobalServiceContainer } = require('../services/service-container');

class SystemStartup {
    constructor() {
        this.initialized = false;
        this.serviceContainer = null;
    }

    /**
     * Initialize the entire system with proper dependency injection
     * This should be called ONCE at system startup, not by individual agents
     */
    async initialize() {
        if (this.initialized) {
            console.log('⚠️ System already initialized');
            return this.serviceContainer;
        }

        console.log('🚀 Starting LonicFLex system initialization...');

        try {
            // Initialize ServiceContainer ONCE
            console.log('📦 Initializing ServiceContainer...');
            this.serviceContainer = await initializeGlobalServiceContainer();
            console.log('✅ ServiceContainer initialized successfully');

            // Validate that all core services are available
            const database = this.serviceContainer.getService('database');
            if (!database) {
                throw new Error('Database service not available after initialization');
            }

            const memory = this.serviceContainer.getService('memory');
            if (!memory) {
                throw new Error('Memory service not available after initialization');
            }

            console.log('✅ Core services validated');

            this.initialized = true;
            console.log('🎉 System initialization complete');

            return this.serviceContainer;

        } catch (error) {
            console.error('❌ System initialization FAILED:');
            console.error('Error:', error.message);
            console.error('Stack:', error.stack);

            // Don't hide the failure - let it bubble up
            throw error;
        }
    }

    /**
     * Get initialized ServiceContainer
     * This should be used by agents instead of initializing their own
     */
    getServiceContainer() {
        if (!this.initialized || !this.serviceContainer) {
            throw new Error('System not initialized. Call initialize() first.');
        }
        return this.serviceContainer;
    }

    /**
     * Clean shutdown
     */
    async shutdown() {
        if (!this.initialized) {
            return;
        }

        console.log('🧹 Shutting down system...');

        try {
            // Close database connections
            const database = this.serviceContainer.getService('database');
            if (database && database.close) {
                await database.close();
            }

            this.initialized = false;
            this.serviceContainer = null;

            console.log('✅ System shutdown complete');

        } catch (error) {
            console.error('❌ Error during shutdown:', error.message);
            throw error;
        }
    }
}

// Create singleton instance
const systemStartup = new SystemStartup();

module.exports = {
    SystemStartup,
    systemStartup
};

// For testing - allow direct execution
if (require.main === module) {
    async function testSystemStartup() {
        try {
            await systemStartup.initialize();
            const container = systemStartup.getServiceContainer();

            console.log('🧪 Testing service access...');
            const database = container.getService('database');
            const memory = container.getService('memory');

            console.log('✅ Database service:', database ? 'Available' : 'Not available');
            console.log('✅ Memory service:', memory ? 'Available' : 'Not available');

            await systemStartup.shutdown();

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        }
    }

    testSystemStartup();
}