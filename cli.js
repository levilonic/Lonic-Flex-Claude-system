#!/usr/bin/env node
const { info, warn, error } = require('./src/services/logger');

/**
 * LonicFLex Command Line Interface
 *
 * Provides command-line access to LonicFLex functionality
 * Usage: node cli.js <command> [options]
 */

const { lonicflex } = require('./index');
const { systemStartup } = require('./src/core/system-startup');

class LonicFLexCLI {
    constructor() {
        this.commands = {
            'start': this.startSystem.bind(this),
            'status': this.showStatus.bind(this),
            'test': this.runTests.bind(this),
            'agents': this.listAgents.bind(this),
            'health': this.healthCheck.bind(this),
            'help': this.showHelp.bind(this)
        };
    }

    /**
     * Parse and execute command
     */
    async execute(args = process.argv.slice(2)) {
        if (args.length === 0) {
            this.showHelp();
            return;
        }

        const command = args[0];
        const options = args.slice(1);

        if (this.commands[command]) {
            try {
                await this.commands[command](options);
            } catch (err) {
                error(`Command '${command}' failed:`, err.message);
                process.exit(1);
            }
        } else {
            error(`Unknown command: ${command}`);
            this.showHelp();
            process.exit(1);
        }
    }

    /**
     * Start the LonicFLex system
     */
    async startSystem(options) {
        info('🚀 Starting LonicFLex System via CLI...');
        await lonicflex.start();
    }

    /**
     * Show system status
     */
    async showStatus(options) {
        try {
            await lonicflex.initialize();
            const status = lonicflex.getStatus();

            info('📊 LonicFLex System Status:');
            info(`   Version: ${status.version}`);
            info(`   Initialized: ${status.initialized ? '✅' : '❌'}`);
            info(`   Uptime: ${Math.floor(status.uptime)}s`);
            info(`   Memory: ${Math.round(status.memoryUsage.rss / 1024 / 1024)}MB`);

            // System health from service container
            if (lonicflex.serviceContainer) {
                const health = await lonicflex.serviceContainer.getSystemHealth();
                info(`   System Health: ${health.status === 'healthy' ? '✅' : '⚠️'} ${health.status}`);
            }

        } catch (err) {
            error('Failed to get status:', err.message);
        }
    }

    /**
     * Run system tests
     */
    async runTests(options) {
        info('🧪 Running LonicFLex System Tests...');

        const { spawn } = require('child_process');
        const testFiles = [
            'tests/integration/test-universal-context.js',
            'tests/integration/test-phase3a-integration.js'
        ];

        for (const testFile of testFiles) {
            info(`Running: ${testFile}`);

            try {
                await new Promise((resolve, reject) => {
                    const child = spawn('node', [testFile], { stdio: 'inherit' });
                    child.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`Test failed with code ${code}`));
                    });
                });
                info(`✅ ${testFile} passed`);
            } catch (err) {
                error(`❌ ${testFile} failed`);
                throw err;
            }
        }

        info('✅ All tests passed');
    }

    /**
     * List available agents
     */
    async listAgents(options) {
        const fs = require('fs');
        const path = require('path');

        const agentsDir = path.join(__dirname, 'src', 'agents');
        const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.js'));

        info('🤖 Available Agents:');
        agentFiles.forEach(file => {
            const name = file.replace('.js', '');
            info(`   - ${name}`);
        });
    }

    /**
     * Health check
     */
    async healthCheck(options) {
        info('🏥 LonicFLex Health Check...');

        try {
            await lonicflex.initialize();

            // Check database
            const db = lonicflex.serviceContainer.getService('database');
            if (db) {
                const stats = await db.getStats();
                info('✅ Database: Connected');
                info(`   Sessions: ${stats.total_sessions || 0}`);
                info(`   Agents: ${stats.total_agents || 0}`);
            } else {
                warn('⚠️ Database: Not available');
            }

            // Check memory service
            const memory = lonicflex.serviceContainer.getService('memory');
            if (memory) {
                info('✅ Memory Service: Available');
            } else {
                warn('⚠️ Memory Service: Not available');
            }

            info('✅ Health check complete');

        } catch (err) {
            error('❌ Health check failed:', err.message);
            throw err;
        }
    }

    /**
     * Show help
     */
    showHelp() {
        info('LonicFLex Command Line Interface');
        info('');
        info('Usage: node cli.js <command> [options]');
        info('');
        info('Commands:');
        info('  start    Start the LonicFLex system');
        info('  status   Show system status');
        info('  test     Run system tests');
        info('  agents   List available agents');
        info('  health   Run health check');
        info('  help     Show this help message');
        info('');
        info('Examples:');
        info('  node cli.js start');
        info('  node cli.js status');
        info('  node cli.js test');
    }
}

// Create CLI instance
const cli = new LonicFLexCLI();

// Execute if called directly
if (require.main === module) {
    cli.execute();
}

module.exports = { LonicFLexCLI, cli };