#!/usr/bin/env node
/**
 * Credential Validation Script
 *
 * Validates that all required credentials are present in .env file
 * for all 13 production services before starting them.
 *
 * Usage: node validate-credentials.js
 * Exit codes: 0 = all credentials valid, 1 = missing credentials
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔐 Validating LonicFLex Credentials\n');

const results = {
    total: 0,
    valid: 0,
    missing: 0,
    optional: 0,
    issues: []
};

/**
 * Check if credential exists and is not a placeholder
 */
function validateCredential(name, isRequired = true) {
    results.total++;
    const value = process.env[name];

    if (!value || value.trim() === '') {
        if (isRequired) {
            results.missing++;
            results.issues.push({
                credential: name,
                status: 'MISSING',
                severity: 'ERROR',
                message: 'Required credential not set'
            });
            console.log(`❌ ${name}: MISSING (required)`);
        } else {
            results.optional++;
            console.log(`⚠️  ${name}: Not set (optional)`);
        }
        return false;
    }

    // Check for placeholder values
    const placeholders = [
        'your_', 'your-', 'https://your-',
        'ghp_your', 'xoxb-your', 'xapp-your',
        'dev123456', 'glpat-...', 'lin_api_...'
    ];

    const hasPlaceholder = placeholders.some(p => value.includes(p));

    if (hasPlaceholder) {
        if (isRequired) {
            results.missing++;
            results.issues.push({
                credential: name,
                status: 'PLACEHOLDER',
                severity: 'ERROR',
                message: 'Credential contains placeholder value'
            });
            console.log(`❌ ${name}: PLACEHOLDER (needs real value)`);
        } else {
            results.optional++;
            console.log(`⚠️  ${name}: Placeholder (optional)`);
        }
        return false;
    }

    results.valid++;
    console.log(`✅ ${name}: Valid`);
    return true;
}

/**
 * Validate service is ready based on its credentials
 */
function validateService(serviceName, credentials) {
    console.log(`\n━━━ ${serviceName} ━━━`);
    const allValid = credentials.every(cred => {
        if (typeof cred === 'string') {
            // Required credential
            return validateCredential(cred, true);
        } else {
            // Optional credential - doesn't affect service readiness
            validateCredential(cred.name, cred.required);
            return true; // Optional credentials don't block service
        }
    });
    return allValid;
}

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.error('   Run: cp .env.template .env');
    console.error('   Then fill in your credentials\n');
    process.exit(1);
}

console.log('📁 Found .env file\n');

// =====================================================
// CORE SYSTEM
// =====================================================
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CORE SYSTEM CONFIGURATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

validateService('Core System', [
    'NODE_ENV',
    'DB_PATH',
    { name: 'LOG_LEVEL', required: false }
]);

// =====================================================
// CORE INFRASTRUCTURE SERVICES
// =====================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CORE INFRASTRUCTURE SERVICES (6 services)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\nℹ️  Core services use system-level credentials (GitHub/Slack)');
console.log('   No additional credentials needed for: master, webhook, workflows, health, integration-hub, permissions\n');

// =====================================================
// EXTERNAL INTEGRATION SERVICES
// =====================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('EXTERNAL INTEGRATION SERVICES (7 services)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const githubValid = validateService('GitHub Service (Port 3002)', [
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'GITHUB_REPO',
    { name: 'GITHUB_WEBHOOK_SECRET', required: false },
    { name: 'WEBHOOK_URL', required: false }
]);

const slackValid = validateService('Slack Service (Port 3006)', [
    'SLACK_BOT_TOKEN',
    'SLACK_APP_TOKEN',
    'SLACK_SIGNING_SECRET'
]);

const gitlabValid = validateService('GitLab Service (Port 3025)', [
    'GITLAB_URL',
    'GITLAB_ACCESS_TOKEN',
    { name: 'GITLAB_WEBHOOK_SECRET', required: false },
    { name: 'GITLAB_DEFAULT_PROJECT', required: false }
]);

const jiraValid = validateService('Jira Service (Port 3021)', [
    'JIRA_URL',
    'JIRA_EMAIL',
    'JIRA_API_TOKEN',
    { name: 'JIRA_WEBHOOK_SECRET', required: false },
    { name: 'JIRA_DEFAULT_PROJECT', required: false }
]);

const servicenowValid = validateService('ServiceNow Service (Port 3022)', [
    'SERVICENOW_INSTANCE_URL',
    // Username/password OR OAuth (at least one method required)
    { name: 'SERVICENOW_USERNAME', required: false },
    { name: 'SERVICENOW_PASSWORD', required: false },
    { name: 'SERVICENOW_CLIENT_ID', required: false },
    { name: 'SERVICENOW_CLIENT_SECRET', required: false }
]);

// Special check for ServiceNow - needs at least one auth method
if (!process.env.SERVICENOW_USERNAME && !process.env.SERVICENOW_CLIENT_ID) {
    console.log('\n⚠️  ServiceNow: No authentication method configured');
    console.log('   Need either: USERNAME+PASSWORD or CLIENT_ID+CLIENT_SECRET');
    results.issues.push({
        credential: 'SERVICENOW_AUTH',
        status: 'INCOMPLETE',
        severity: 'ERROR',
        message: 'Need either username/password or OAuth credentials'
    });
}

const linearValid = validateService('Linear Service (Port 3023)', [
    'LINEAR_API_TOKEN',
    { name: 'LINEAR_WEBHOOK_SECRET', required: false },
    { name: 'LINEAR_DEFAULT_TEAM', required: false }
]);

const jenkinsValid = validateService('Jenkins Service (Port 3024)', [
    'JENKINS_URL',
    'JENKINS_USERNAME',
    'JENKINS_API_TOKEN'
]);

// =====================================================
// SUMMARY
// =====================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('VALIDATION SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`Total Credentials Checked: ${results.total}`);
console.log(`✅ Valid: ${results.valid}`);
console.log(`❌ Missing/Invalid: ${results.missing}`);
console.log(`⚠️  Optional (not set): ${results.optional}\n`);

// Service readiness
console.log('━━━ Service Readiness ━━━\n');
const services = [
    { name: 'GitHub', ready: githubValid },
    { name: 'Slack', ready: slackValid },
    { name: 'GitLab', ready: gitlabValid },
    { name: 'Jira', ready: jiraValid },
    { name: 'ServiceNow', ready: servicenowValid },
    { name: 'Linear', ready: linearValid },
    { name: 'Jenkins', ready: jenkinsValid }
];

services.forEach(svc => {
    console.log(`${svc.ready ? '✅' : '❌'} ${svc.name}: ${svc.ready ? 'Ready' : 'Not Ready'}`);
});

const readyCount = services.filter(s => s.ready).length;
console.log(`\n📊 Services Ready: ${readyCount}/7 external integrations`);

// Issues detail
if (results.issues.length > 0) {
    console.log('\n━━━ Issues Found ━━━\n');
    results.issues.forEach((issue, idx) => {
        console.log(`${idx + 1}. ${issue.credential}`);
        console.log(`   Status: ${issue.status}`);
        console.log(`   Message: ${issue.message}\n`);
    });
}

// Final verdict
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (results.missing === 0) {
    console.log('🎉 All required credentials are valid!');
    console.log('✅ Ready to start services with: pm2 start config/ecosystem.config.js\n');
    process.exit(0);
} else {
    console.log('❌ Missing required credentials');
    console.log(`   ${results.missing} credential(s) need to be configured`);
    console.log('   See .env.template for credential acquisition instructions\n');
    process.exit(1);
}
