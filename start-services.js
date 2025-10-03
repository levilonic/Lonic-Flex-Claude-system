#!/usr/bin/env node
/**
 * Service Startup Script
 *
 * Systematically starts all 13 LonicFLex services with proper error handling.
 * Alternative to PM2 for development/testing.
 *
 * Usage: node start-services.js [service-name]
 *   - No args: Start all services
 *   - With service name: Start specific service
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Service definitions from ecosystem.config.js
const services = [
    // Core Infrastructure
    { name: 'lonicflex-master', script: 'src/services/lonicflex-master-service.js', port: 3007 },
    { name: 'lonicflex-webhook', script: 'src/services/lonicflex-webhook-service.js', port: 3008 },
    { name: 'lonicflex-workflows', script: 'src/services/lonicflex-workflows-service.js', port: 3004 },
    { name: 'lonicflex-health', script: 'src/services/lonicflex-health-service.js', port: 3005 },
    { name: 'lonicflex-integration-hub', script: 'src/services/lonicflex-integration-hub-service.js', port: 3020 },
    { name: 'lonicflex-permissions', script: 'src/services/lonicflex-permissions-service.js', port: 3031 },

    // External Integrations
    { name: 'lonicflex-github', script: 'src/services/lonicflex-github-service.js', port: 3002 },
    { name: 'lonicflex-slack', script: 'src/services/lonicflex-slack-service.js', port: 3006 },
    { name: 'lonicflex-gitlab', script: 'src/services/lonicflex-gitlab-service.js', port: 3025 },
    { name: 'lonicflex-jira', script: 'src/services/lonicflex-jira-service.js', port: 3021 },
    { name: 'lonicflex-servicenow', script: 'src/services/lonicflex-servicenow-service.js', port: 3022 },
    { name: 'lonicflex-linear', script: 'src/services/lonicflex-linear-service.js', port: 3023 },
    { name: 'lonicflex-jenkins', script: 'src/services/lonicflex-jenkins-service.js', port: 3024 }
];

const runningProcesses = [];

/**
 * Start a single service
 */
function startService(service) {
    return new Promise((resolve) => {
        const scriptPath = path.join(__dirname, service.script);

        // Check if script exists
        if (!fs.existsSync(scriptPath)) {
            console.log(`❌ ${service.name}: Script not found at ${service.script}`);
            resolve({ service: service.name, status: 'error', reason: 'Script not found' });
            return;
        }

        console.log(`🚀 Starting ${service.name} on port ${service.port}...`);

        const proc = spawn('node', [scriptPath], {
            env: {
                ...process.env,
                NODE_ENV: 'production',
                PORT: service.port
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let startupOutput = '';
        let hasStarted = false;
        let startTimeout;

        proc.stdout.on('data', (data) => {
            const output = data.toString();
            startupOutput += output;

            // Check for successful startup indicators
            // Services use either plain console.log or JSON logger format
            if (output.includes('started successfully') ||
                output.includes('listening on port') ||
                output.includes('running on port') ||
                output.includes(`"port":${service.port}`) ||
                output.includes(`port ${service.port}`)) {

                if (!hasStarted) {
                    hasStarted = true;
                    clearTimeout(startTimeout);
                    console.log(`✅ ${service.name}: Started successfully on port ${service.port}`);
                    runningProcesses.push({ service: service.name, process: proc, port: service.port });
                    resolve({ service: service.name, status: 'running', port: service.port, pid: proc.pid });
                }
            }
        });

        proc.stderr.on('data', (data) => {
            const error = data.toString();
            // Only log actual errors, not warnings
            if (error.includes('Error') || error.includes('EADDRINUSE')) {
                console.error(`⚠️  ${service.name}: ${error.substring(0, 200)}`);
            }
        });

        proc.on('error', (error) => {
            console.log(`❌ ${service.name}: Failed to start - ${error.message}`);
            if (!hasStarted) {
                resolve({ service: service.name, status: 'error', reason: error.message });
            }
        });

        proc.on('exit', (code) => {
            if (!hasStarted) {
                console.log(`❌ ${service.name}: Exited with code ${code}`);
                resolve({ service: service.name, status: 'exited', code });
            } else {
                console.log(`⚠️  ${service.name}: Service stopped (exit code ${code})`);
            }
        });

        // Give service 10 seconds to start
        startTimeout = setTimeout(() => {
            if (!hasStarted) {
                console.log(`⏱️  ${service.name}: Startup timeout (10s), assuming running...`);
                console.log(`   Last output: ${startupOutput.substring(0, 200)}`);
                runningProcesses.push({ service: service.name, process: proc, port: service.port });
                resolve({ service: service.name, status: 'timeout', port: service.port, pid: proc.pid });
            }
        }, 10000);
    });
}

/**
 * Check if port is in use
 */
async function isPortInUse(port) {
    return new Promise((resolve) => {
        const net = require('net');
        const tester = net.createServer()
            .once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true);
                } else {
                    resolve(false);
                }
            })
            .once('listening', () => {
                tester.once('close', () => resolve(false)).close();
            })
            .listen(port);
    });
}

/**
 * Check ports before starting
 */
async function checkPorts() {
    console.log('🔍 Checking for port conflicts...\n');
    const conflicts = [];

    for (const service of services) {
        const inUse = await isPortInUse(service.port);
        if (inUse) {
            conflicts.push({ service: service.name, port: service.port });
            console.log(`⚠️  Port ${service.port} already in use (${service.name})`);
        }
    }

    if (conflicts.length > 0) {
        console.log(`\n❌ ${conflicts.length} port conflict(s) found`);
        console.log('   Stop services using these ports or change port configuration\n');
        return false;
    }

    console.log('✅ All ports available\n');
    return true;
}

/**
 * Start all services sequentially with delays
 */
async function startAllServices() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 LonicFLex Service Startup');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check ports first
    const portsAvailable = await checkPorts();
    if (!portsAvailable) {
        console.log('❌ Cannot start services - resolve port conflicts first\n');
        process.exit(1);
    }

    const results = [];

    // Start services with 2-second delay between each
    for (let i = 0; i < services.length; i++) {
        const service = services[i];
        const result = await startService(service);
        results.push(result);

        // Small delay between services to avoid overwhelming the system
        if (i < services.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Print summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Startup Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const running = results.filter(r => r.status === 'running' || r.status === 'timeout');
    const failed = results.filter(r => r.status === 'error' || r.status === 'exited');

    console.log(`✅ Running: ${running.length}/${services.length}`);
    console.log(`❌ Failed:  ${failed.length}/${services.length}\n`);

    if (running.length > 0) {
        console.log('Running Services:');
        running.forEach(r => {
            console.log(`  • ${r.service} (port ${r.port}, pid ${r.pid})`);
        });
        console.log();
    }

    if (failed.length > 0) {
        console.log('Failed Services:');
        failed.forEach(r => {
            console.log(`  • ${r.service}: ${r.reason || `Exit code ${r.code}`}`);
        });
        console.log();
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (running.length === services.length) {
        console.log('🎉 ALL SERVICES STARTED SUCCESSFULLY');
    } else if (running.length > 0) {
        console.log(`⚠️  ${running.length}/${services.length} SERVICES RUNNING`);
    } else {
        console.log('❌ NO SERVICES STARTED');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Press Ctrl+C to stop all services\n');

    // Keep process alive
    process.stdin.resume();
}

/**
 * Cleanup on exit
 */
process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping all services...\n');

    runningProcesses.forEach(({ service, process }) => {
        console.log(`   Stopping ${service}...`);
        process.kill('SIGTERM');
    });

    setTimeout(() => {
        console.log('\n✅ All services stopped\n');
        process.exit(0);
    }, 2000);
});

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.length > 0) {
        const serviceName = args[0];
        const service = services.find(s => s.name === serviceName);

        if (!service) {
            console.error(`❌ Service not found: ${serviceName}`);
            console.log('\nAvailable services:');
            services.forEach(s => console.log(`  • ${s.name}`));
            process.exit(1);
        }

        const result = await startService(service);
        if (result.status === 'running' || result.status === 'timeout') {
            console.log('\nPress Ctrl+C to stop\n');
            process.stdin.resume();
        } else {
            process.exit(1);
        }
    } else {
        await startAllServices();
    }
}

main().catch(error => {
    console.error('\n💥 Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
});
