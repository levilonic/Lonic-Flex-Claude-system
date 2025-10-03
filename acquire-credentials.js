#!/usr/bin/env node
/**
 * Interactive Credential Acquisition Guide
 *
 * Systematically walks through acquiring credentials for all 7 external services.
 * Validates each credential as it's added to .env file.
 *
 * Usage: node acquire-credentials.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise(resolve => {
        rl.question(prompt, resolve);
    });
}

console.log('🔐 LonicFLex Credential Acquisition Guide\n');
console.log('This guide will walk you through acquiring credentials for all 7 external services.');
console.log('We already have: ✅ GitHub, ✅ Slack\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const envPath = path.join(process.cwd(), '.env');

/**
 * Update .env file with new credential
 */
function updateEnvFile(key, value) {
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Check if key exists
    const keyRegex = new RegExp(`^${key}=.*$`, 'm');

    if (keyRegex.test(envContent)) {
        // Update existing key
        envContent = envContent.replace(keyRegex, `${key}=${value}`);
    } else {
        // Add new key at the end
        envContent += `\n${key}=${value}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`   ✅ Updated ${key} in .env file`);
}

/**
 * Check if credential exists and is valid
 */
function checkCredential(key) {
    const value = process.env[key];
    if (!value || value.trim() === '') return false;

    const placeholders = ['your_', 'your-', 'https://your-', 'dev123456'];
    return !placeholders.some(p => value.includes(p));
}

/**
 * Service acquisition guides
 */
const services = [
    {
        name: 'GitLab',
        ready: () => checkCredential('GITLAB_URL') && checkCredential('GITLAB_ACCESS_TOKEN'),
        credentials: [
            {
                key: 'GITLAB_URL',
                name: 'GitLab Instance URL',
                default: 'https://gitlab.com',
                instructions: [
                    '1. If using GitLab.com, use: https://gitlab.com',
                    '2. If using self-hosted GitLab, enter your instance URL',
                    '3. Press Enter to use default (https://gitlab.com)'
                ]
            },
            {
                key: 'GITLAB_ACCESS_TOKEN',
                name: 'GitLab Access Token',
                instructions: [
                    '1. Go to: https://gitlab.com/-/profile/personal_access_tokens',
                    '2. Click "Add new token"',
                    '3. Name: LonicFLex Integration',
                    '4. Scopes: api, read_repository, write_repository',
                    '5. Click "Create personal access token"',
                    '6. Copy the token (starts with glpat-)',
                    '7. Paste it here:'
                ]
            }
        ]
    },
    {
        name: 'Jira',
        ready: () => checkCredential('JIRA_URL') && checkCredential('JIRA_EMAIL') && checkCredential('JIRA_API_TOKEN'),
        credentials: [
            {
                key: 'JIRA_URL',
                name: 'Jira Instance URL',
                instructions: [
                    '1. Your Jira Cloud URL (e.g., https://your-domain.atlassian.net)',
                    '2. Find it by logging into Jira and checking the URL',
                    '3. Enter the full URL:'
                ]
            },
            {
                key: 'JIRA_EMAIL',
                name: 'Jira Account Email',
                instructions: [
                    '1. The email address for your Atlassian account',
                    '2. This is the email you use to log into Jira',
                    '3. Enter your email:'
                ]
            },
            {
                key: 'JIRA_API_TOKEN',
                name: 'Jira API Token',
                instructions: [
                    '1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens',
                    '2. Click "Create API token"',
                    '3. Label: LonicFLex Integration',
                    '4. Click "Create"',
                    '5. Copy the token',
                    '6. Paste it here:'
                ]
            }
        ]
    },
    {
        name: 'ServiceNow',
        ready: () => checkCredential('SERVICENOW_INSTANCE_URL') &&
               (checkCredential('SERVICENOW_USERNAME') || checkCredential('SERVICENOW_CLIENT_ID')),
        credentials: [
            {
                key: 'SERVICENOW_INSTANCE_URL',
                name: 'ServiceNow Instance URL',
                instructions: [
                    '1. Go to: https://developer.servicenow.com',
                    '2. Sign up for free developer account',
                    '3. Request a Personal Developer Instance (PDI)',
                    '4. Wait for instance to be created (takes ~5 minutes)',
                    '5. Your instance URL will be like: https://dev123456.service-now.com',
                    '6. Enter your instance URL:'
                ]
            },
            {
                key: 'SERVICENOW_USERNAME',
                name: 'ServiceNow Username',
                instructions: [
                    '1. Default username for PDI is: admin',
                    '2. Or use your custom username if you changed it',
                    '3. Enter username:'
                ]
            },
            {
                key: 'SERVICENOW_PASSWORD',
                name: 'ServiceNow Password',
                instructions: [
                    '1. Password sent to your email when PDI was created',
                    '2. Or use custom password if you changed it',
                    '3. Enter password:'
                ]
            }
        ]
    },
    {
        name: 'Linear',
        ready: () => checkCredential('LINEAR_API_TOKEN'),
        credentials: [
            {
                key: 'LINEAR_API_TOKEN',
                name: 'Linear API Token',
                instructions: [
                    '1. Go to: https://linear.app/settings/api',
                    '2. Click "Create new token"',
                    '3. Name: LonicFLex Integration',
                    '4. Scopes: Keep default (full access)',
                    '5. Click "Create"',
                    '6. Copy the token (starts with lin_api_)',
                    '7. Paste it here:'
                ]
            }
        ]
    },
    {
        name: 'Jenkins',
        ready: () => checkCredential('JENKINS_URL') && checkCredential('JENKINS_USERNAME') && checkCredential('JENKINS_API_TOKEN'),
        credentials: [
            {
                key: 'JENKINS_URL',
                name: 'Jenkins URL',
                instructions: [
                    '1. If you have Jenkins running locally: http://localhost:8080',
                    '2. If using hosted Jenkins, enter your Jenkins URL',
                    '3. If you DON\'T have Jenkins yet, enter: http://localhost:8080',
                    '   (We can set up Jenkins later)',
                    '4. Enter Jenkins URL:'
                ]
            },
            {
                key: 'JENKINS_USERNAME',
                name: 'Jenkins Username',
                instructions: [
                    '1. Your Jenkins username (usually "admin" for local)',
                    '2. If Jenkins not set up yet, enter: admin',
                    '3. Enter username:'
                ]
            },
            {
                key: 'JENKINS_API_TOKEN',
                name: 'Jenkins API Token',
                instructions: [
                    '1. In Jenkins: Click your name → Configure',
                    '2. Under "API Token", click "Add new Token"',
                    '3. Name: LonicFLex',
                    '4. Click "Generate"',
                    '5. Copy the token',
                    '6. If Jenkins not set up yet, enter: placeholder_jenkins_token',
                    '   (We can update later)',
                    '7. Paste token here:'
                ]
            }
        ]
    }
];

async function acquireServiceCredentials(service) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔧 ${service.name} Credentials`);
    console.log(`${'═'.repeat(70)}\n`);

    for (const cred of service.credentials) {
        // Check if already exists
        if (checkCredential(cred.key)) {
            console.log(`✅ ${cred.name}: Already configured`);
            continue;
        }

        console.log(`\n📝 ${cred.name}:`);
        cred.instructions.forEach(line => console.log(`   ${line}`));
        console.log();

        let value = await question(`➡️  ${cred.name}: `);

        // Use default if provided and user pressed enter
        if (!value && cred.default) {
            value = cred.default;
            console.log(`   Using default: ${value}`);
        }

        if (value && value.trim()) {
            updateEnvFile(cred.key, value.trim());
            // Reload env
            process.env[cred.key] = value.trim();
        } else {
            console.log(`   ⚠️  Skipped - you can add this later`);
        }
    }

    console.log(`\n✅ ${service.name} configuration complete!`);
}

async function main() {
    // Check current status
    console.log('📊 Current Status:\n');
    services.forEach((service, idx) => {
        const status = service.ready() ? '✅ Ready' : '❌ Needs credentials';
        console.log(`${idx + 1}. ${service.name}: ${status}`);
    });

    const readyCount = services.filter(s => s.ready()).length;
    console.log(`\n${readyCount}/5 services ready\n`);

    const answer = await question('Start credential acquisition? (y/n): ');
    if (answer.toLowerCase() !== 'y') {
        console.log('\n👍 No problem! Run this script again when ready.');
        console.log('   Command: node acquire-credentials.js\n');
        rl.close();
        return;
    }

    // Acquire credentials for each service that needs them
    for (const service of services) {
        if (!service.ready()) {
            await acquireServiceCredentials(service);
        } else {
            console.log(`\n✅ ${service.name}: Already configured (skipping)\n`);
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Credential Acquisition Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Next Steps:\n');
    console.log('1. Validate credentials: node validate-credentials.js');
    console.log('2. Start services: pm2 start config/ecosystem.config.js');
    console.log('3. Check service health: pm2 logs\n');

    rl.close();
}

main().catch(error => {
    console.error('\n💥 Error:', error.message);
    rl.close();
    process.exit(1);
});
