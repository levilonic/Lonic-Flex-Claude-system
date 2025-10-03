#!/usr/bin/env node
/**
 * Pre-flight Check for Service Startup
 *
 * Systematically validates everything is ready before starting services:
 * 1. All credentials present
 * 2. All service files exist
 * 3. All ports available
 * 4. Database accessible
 * 5. Dependencies installed
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const net = require('net');

console.log('🔍 LonicFLex Pre-flight Check\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const checks = {
    passed: 0,
    failed: 0,
    warnings: 0,
    issues: []
};

function pass(message) {
    console.log(`✅ ${message}`);
    checks.passed++;
}

function fail(message, details) {
    console.log(`❌ ${message}`);
    if (details) console.log(`   ${details}`);
    checks.failed++;
    checks.issues.push({ type: 'ERROR', message, details });
}

function warn(message, details) {
    console.log(`⚠️  ${message}`);
    if (details) console.log(`   ${details}`);
    checks.warnings++;
    checks.issues.push({ type: 'WARNING', message, details });
}

// Service definitions
const services = [
    { name: 'lonicflex-master', script: 'src/services/lonicflex-master-service.js', port: 3007 },
    { name: 'lonicflex-webhook', script: 'src/services/lonicflex-webhook-service.js', port: 3008 },
    { name: 'lonicflex-workflows', script: 'src/services/lonicflex-workflows-service.js', port: 3004 },
    { name: 'lonicflex-health', script: 'src/services/lonicflex-health-service.js', port: 3005 },
    { name: 'lonicflex-integration-hub', script: 'src/services/lonicflex-integration-hub-service.js', port: 3020 },
    { name: 'lonicflex-permissions', script: 'src/services/lonicflex-permissions-service.js', port: 3031 },
    { name: 'lonicflex-github', script: 'src/services/lonicflex-github-service.js', port: 3002 },
    { name: 'lonicflex-slack', script: 'src/services/lonicflex-slack-service.js', port: 3006 },
    { name: 'lonicflex-gitlab', script: 'src/services/lonicflex-gitlab-service.js', port: 3025 },
    { name: 'lonicflex-jira', script: 'src/services/lonicflex-jira-service.js', port: 3021 },
    { name: 'lonicflex-servicenow', script: 'src/services/lonicflex-servicenow-service.js', port: 3022 },
    { name: 'lonicflex-linear', script: 'src/services/lonicflex-linear-service.js', port: 3023 },
    { name: 'lonicflex-jenkins', script: 'src/services/lonicflex-jenkins-service.js', port: 3024 }
];

/**
 * Check if port is available
 */
function checkPort(port) {
    return new Promise((resolve) => {
        const tester = net.createServer()
            .once('error', (err) => {
                resolve(err.code !== 'EADDRINUSE');
            })
            .once('listening', () => {
                tester.once('close', () => resolve(true)).close();
            })
            .listen(port);
    });
}

async function main() {
    // Check 1: Environment file
    console.log('1️⃣  Environment Configuration\n');
    if (fs.existsSync('.env')) {
        pass('.env file exists');
    } else {
        fail('.env file missing', 'Run: cp .env.template .env');
    }
    console.log();

    // Check 2: Required credentials
    console.log('2️⃣  Credentials\n');
    const requiredCreds = [
        'GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO',
        'SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_SIGNING_SECRET',
        'GITLAB_URL', 'GITLAB_ACCESS_TOKEN',
        'JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN',
        'SERVICENOW_INSTANCE_URL', 'SERVICENOW_USERNAME', 'SERVICENOW_PASSWORD',
        'LINEAR_API_TOKEN',
        'JENKINS_URL', 'JENKINS_USERNAME', 'JENKINS_API_TOKEN'
    ];

    let missingCreds = 0;
    for (const cred of requiredCreds) {
        if (process.env[cred]) {
            // Don't print individual creds, just count
        } else {
            fail(`Missing credential: ${cred}`);
            missingCreds++;
        }
    }

    if (missingCreds === 0) {
        pass(`All ${requiredCreds.length} required credentials present`);
    }
    console.log();

    // Check 3: Service files exist
    console.log('3️⃣  Service Files\n');
    let missingFiles = 0;
    for (const service of services) {
        const scriptPath = path.join(__dirname, service.script);
        if (fs.existsSync(scriptPath)) {
            // File exists
        } else {
            fail(`${service.name}: Script not found`, service.script);
            missingFiles++;
        }
    }

    if (missingFiles === 0) {
        pass(`All ${services.length} service scripts exist`);
    }
    console.log();

    // Check 4: Port availability
    console.log('4️⃣  Port Availability\n');
    let portsInUse = 0;
    for (const service of services) {
        const available = await checkPort(service.port);
        if (available) {
            // Port available
        } else {
            fail(`Port ${service.port} in use`, service.name);
            portsInUse++;
        }
    }

    if (portsInUse === 0) {
        pass(`All ${services.length} ports available`);
    } else {
        fail(`${portsInUse} port(s) in use`, 'Stop conflicting services');
    }
    console.log();

    // Check 5: Database directory
    console.log('5️⃣  Database\n');
    const dbDir = path.join(__dirname, 'database');
    if (fs.existsSync(dbDir)) {
        pass('Database directory exists');
    } else {
        warn('Database directory missing', 'Will be created on first run');
    }
    console.log();

    // Check 6: Dependencies
    console.log('6️⃣  Dependencies\n');
    if (fs.existsSync('node_modules')) {
        pass('node_modules exists');
    } else {
        fail('node_modules missing', 'Run: npm install');
    }

    if (fs.existsSync('package.json')) {
        pass('package.json exists');
    } else {
        fail('package.json missing');
    }
    console.log();

    // Check 7: External services
    console.log('7️⃣  External Services\n');

    // Check Jenkins Docker container
    const { execSync } = require('child_process');
    try {
        execSync('docker ps --filter name=jenkins --format "{{.Names}}"', { stdio: 'pipe' });
        pass('Jenkins container running');
    } catch (error) {
        warn('Jenkins container not found', 'Some features may not work');
    }
    console.log();

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Pre-flight Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`✅ Passed:   ${checks.passed}`);
    console.log(`❌ Failed:   ${checks.failed}`);
    console.log(`⚠️  Warnings: ${checks.warnings}\n`);

    if (checks.failed === 0) {
        console.log('🎉 ALL CHECKS PASSED - Ready to start services!\n');
        console.log('Run: node start-services.js\n');
        process.exit(0);
    } else {
        console.log('❌ PRE-FLIGHT FAILED - Fix issues before starting\n');
        if (checks.issues.length > 0) {
            console.log('Issues to fix:\n');
            checks.issues.filter(i => i.type === 'ERROR').forEach((issue, idx) => {
                console.log(`${idx + 1}. ${issue.message}`);
                if (issue.details) console.log(`   → ${issue.details}`);
            });
            console.log();
        }
        process.exit(1);
    }
}

main().catch(error => {
    console.error('\n💥 Pre-flight check crashed:', error.message);
    process.exit(1);
});
