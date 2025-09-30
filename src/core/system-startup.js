const { info, warn, error } = require('../services/logger');

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

            warn('System already initialized');

            return this.serviceContainer;

        }



        info('Starting LonicFLex system initialization...');



        try {

            // Initialize ServiceContainer ONCE

            info('Initializing ServiceContainer...');

            this.serviceContainer = await initializeGlobalServiceContainer();

            info('ServiceContainer initialized successfully');



            // Validate that all core services are available

            const database = this.serviceContainer.getService('database');

            if (!database) {

                throw new Error('Database service not available after initialization');

            }



            const memory = this.serviceContainer.getService('memory');

            if (!memory) {

                throw new Error('Memory service not available after initialization');

            }



            info('Core services validated');



            this.initialized = true;

            info('System initialization complete');



            return this.serviceContainer;



        } catch (error) {

            error('System initialization FAILED:');

            error('Error:', error.message);

            error('Stack:', error.stack);



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



        info('Shutting down system...');



        try {

            if (this.serviceContainer && typeof this.serviceContainer.shutdown === 'function') {

                await this.serviceContainer.shutdown();

            }



            info('System shutdown complete');

        } catch (error) {

            error('Error during shutdown:', error.message);

            throw error;

        } finally {

            this.initialized = false;

            this.serviceContainer = null;

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



            info('Testing service access...');

            const database = container.getService('database');

            const memory = container.getService('memory');



            info('Database service:', database ? 'Available' : 'Not available');

            info('Memory service:', memory ? 'Available' : 'Not available');



            await systemStartup.shutdown();



        } catch (error) {

            error('Test failed:', error.message);

            process.exit(1);

        }

    }



    testSystemStartup();

}