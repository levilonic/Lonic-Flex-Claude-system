#!/usr/bin/env node
/**
 * Environment Template Verification
 *
 * Validates that .env.template contains ALL required credentials
 * for ALL 13 production services with no "optional" services
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying .env.template completeness\n');

const tests = {
    passed: 0,
    failed: 0,
    errors: []
};

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        tests.passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        tests.failed++;
        tests.errors.push({ test: name, error: error.message });
    }
}

// Read .env.template
const templatePath = path.join(process.cwd(), '.env.template');
if (!fs.existsSync(templatePath)) {
    console.error('❌ .env.template not found!');
    process.exit(1);
}

const envTemplate = fs.readFileSync(templatePath, 'utf8');

// Test 1: Core system variables
test('Core system variables present', () => {
    const required = ['NODE_ENV', 'DB_PATH', 'LOG_LEVEL'];
    const missing = required.filter(v => !envTemplate.includes(v));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 2: All 6 core service ports
test('All 6 core infrastructure service ports', () => {
    const required = [
        'MASTER_SERVICE_PORT',      // 3007
        'WEBHOOK_SERVICE_PORT',     // 3008
        'WORKFLOWS_SERVICE_PORT',   // 3004
        'HEALTH_SERVICE_PORT',      // 3005
        'INTEGRATION_HUB_PORT',     // 3020
        'PERMISSIONS_PORT'          // 3031
    ];
    const missing = required.filter(v => !envTemplate.includes(v));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 3: GitHub service credentials (Port 3002)
test('GitHub service credentials complete', () => {
    const required = [
        'GITHUB_TOKEN',
        'GITHUB_OWNER',
        'GITHUB_REPO',
        'GITHUB_SERVICE_PORT',
        'GITHUB_WEBHOOK_SECRET',
        'WEBHOOK_URL'
    ];
    const missing = required.filter(v => !envTemplate.includes(v));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 4: Slack service credentials (Port 3006)
test('Slack service credentials complete', () => {
    const required = [
        'SLACK_BOT_TOKEN',
        'SLACK_APP_TOKEN',
        'SLACK_SIGNING_SECRET',
        'SLACK_SERVICE_PORT',
        'ENABLE_SLACK_INTEGRATION'
    ];
    const missing = required.filter(v => !envTemplate.includes(v));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 5: GitLab service credentials (Port 3025)
test('GitLab service credentials complete', () => {
    const required = [
        'GITLAB_URL',
        'GITLAB_ACCESS_TOKEN',
        'GITLAB_WEBHOOK_SECRET',
        'GITLAB_DEFAULT_PROJECT',
        'GITLAB_SERVICE_PORT'
    ];
    const missing = required.filter(v => !envTemplate.includes(v));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 6: Jira service credentials (Port 3021)
test('Jira service credentials complete', () => {
    const required = [
        'JIRA_URL',
        'JIRA_EMAIL',
        'JIRA_API_TOKEN',
        'JIRA_WEBHOOK_SECRET',
        'JIRA_DEFAULT_PROJECT',
        'JIRA_SERVICE_PORT',
        'JIRA_DEMO_MODE'
    ];
    const missing = required.filter(v => !envTemplate.includes(v));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 7: ServiceNow credentials (Port 3022)
test('ServiceNow service credentials complete', () => {
    const required = [
        'SERVICENOW_INSTANCE_URL',
        'SERVICENOW_USERNAME',
        'SERVICENOW_PASSWORD',
        'SERVICENOW_CLIENT_ID',
        'SERVICENOW_CLIENT_SECRET',
        'SERVICENOW_SERVICE_PORT',
        'SERVICENOW_DEMO_MODE'
    ];
    const missing = required.filter(v => !envTemplate.includes(v));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 8: Linear service credentials (Port 3023)
test('Linear service credentials complete', () => {
    const required = [
        'LINEAR_API_TOKEN',
        'LINEAR_WEBHOOK_SECRET',
        'LINEAR_DEFAULT_TEAM',
        'LINEAR_SERVICE_PORT'
    ];
    const missing = required.filter(v => !envTemplate.includes(v));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 9: Jenkins service credentials (Port 3024)
test('Jenkins service credentials complete', () => {
    const required = [
        'JENKINS_URL',
        'JENKINS_USERNAME',
        'JENKINS_API_TOKEN',
        'JENKINS_SERVICE_PORT'
    ];
    const missing = required.filter(v => !envTemplate.includes(v));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 10: No "optional" language for required services
test('No "optional" language for the 13 production services', () => {
    const lines = envTemplate.split('\n');
    const servicesSections = [
        'GITHUB INTEGRATION',
        'SLACK INTEGRATION',
        'GITLAB INTEGRATION',
        'JIRA INTEGRATION',
        'SERVICENOW INTEGRATION',
        'LINEAR INTEGRATION',
        'JENKINS INTEGRATION'
    ];

    for (const section of servicesSections) {
        const sectionIndex = lines.findIndex(l => l.includes(section));
        if (sectionIndex === -1) continue;

        // Check next 20 lines for "optional" keyword
        const sectionLines = lines.slice(sectionIndex, sectionIndex + 20).join('\n').toLowerCase();
        if (sectionLines.includes('optional') && sectionLines.includes('required')) {
            // This is fine - marked as Required
            continue;
        }
        if (sectionLines.includes('optional') && !sectionLines.includes('required')) {
            throw new Error(`${section} incorrectly marked as optional`);
        }
    }
});

// Test 11: All 13 services documented
test('All 13 production services documented', () => {
    const services = [
        'Master Service',
        'Webhook Service',
        'Workflows Service',
        'Health Service',
        'Integration Hub',
        'Permissions Service',
        'GITHUB INTEGRATION',
        'SLACK INTEGRATION',
        'GITLAB INTEGRATION',
        'JIRA INTEGRATION',
        'SERVICENOW INTEGRATION',
        'LINEAR INTEGRATION',
        'JENKINS INTEGRATION'
    ];
    const missing = services.filter(s => !envTemplate.includes(s));
    if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

// Test 12: Credential acquisition checklist present
test('Credential acquisition checklist included', () => {
    if (!envTemplate.includes('CREDENTIAL ACQUISITION CHECKLIST')) {
        throw new Error('Missing credential acquisition checklist');
    }

    const requiredInstructions = ['GitHub:', 'Slack:', 'GitLab:', 'Jira:', 'ServiceNow:', 'Linear:', 'Jenkins:'];
    const missing = requiredInstructions.filter(s => !envTemplate.includes(s));
    if (missing.length > 0) throw new Error(`Missing instructions: ${missing.join(', ')}`);
});

// Test 13: Service dependency map present
test('Service dependency map documented', () => {
    if (!envTemplate.includes('SERVICE DEPENDENCY MAP')) {
        throw new Error('Missing service dependency map');
    }
});

// Test 14: File has proper structure with sections
test('Template has proper section structure', () => {
    const requiredSections = [
        'CORE SYSTEM CONFIGURATION',
        'CORE INFRASTRUCTURE SERVICES',
        'SERVICE DEPENDENCY MAP',
        'CREDENTIAL ACQUISITION CHECKLIST'
    ];
    const missing = requiredSections.filter(s => !envTemplate.includes(s));
    if (missing.length > 0) throw new Error(`Missing sections: ${missing.join(', ')}`);
});

// Test 15: Port numbers match ecosystem.config.js
test('Port numbers match PM2 configuration', () => {
    const expectedPorts = {
        'GITHUB_SERVICE_PORT': '3002',
        'WORKFLOWS_SERVICE_PORT': '3004',
        'HEALTH_SERVICE_PORT': '3005',
        'SLACK_SERVICE_PORT': '3006',
        'MASTER_SERVICE_PORT': '3007',
        'WEBHOOK_SERVICE_PORT': '3008',
        'INTEGRATION_HUB_PORT': '3020',
        'JIRA_SERVICE_PORT': '3021',
        'SERVICENOW_SERVICE_PORT': '3022',
        'LINEAR_SERVICE_PORT': '3023',
        'JENKINS_SERVICE_PORT': '3024',
        'GITLAB_SERVICE_PORT': '3025',
        'PERMISSIONS_PORT': '3031'
    };

    for (const [varName, expectedPort] of Object.entries(expectedPorts)) {
        const regex = new RegExp(`${varName}=${expectedPort}`);
        if (!regex.test(envTemplate)) {
            throw new Error(`${varName} should be ${expectedPort}`);
        }
    }
});

// Print results
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Verification Results');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Passed: ${tests.passed}`);
console.log(`❌ Failed: ${tests.failed}`);
console.log(`📈 Success Rate: ${((tests.passed / (tests.passed + tests.failed)) * 100).toFixed(1)}%`);

if (tests.failed > 0) {
    console.log('\n❌ Failed Tests:');
    tests.errors.forEach(({ test, error }) => {
        console.log(`   • ${test}: ${error}`);
    });
    console.log('\n💥 .env.template verification FAILED');
    process.exit(1);
} else {
    console.log('\n✅ .env.template is complete and production-ready!');
    console.log('   • All 13 services have credentials defined');
    console.log('   • No services marked as "optional"');
    console.log('   • Port numbers match PM2 configuration');
    console.log('   • Acquisition checklist included');
    process.exit(0);
}
