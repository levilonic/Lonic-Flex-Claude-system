#!/usr/bin/env node
/**
 * Comprehensive analysis: What does each service do? What's it for? What does it need?
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 LonicFLex Services - Comprehensive Analysis\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const services = [
    { name: 'github', port: 3002, category: 'External Integration' },
    { name: 'gitlab', port: 3010, category: 'External Integration' },
    { name: 'slack', port: 3001, category: 'External Integration' },
    { name: 'jira', port: 3021, category: 'External Integration' },
    { name: 'servicenow', port: 3022, category: 'External Integration' },
    { name: 'linear', port: 3023, category: 'External Integration' },
    { name: 'jenkins', port: 3024, category: 'External Integration' },
    { name: 'health', port: 3003, category: 'Infrastructure' },
    { name: 'integration-hub', port: 3009, category: 'Infrastructure' },
    { name: 'master', port: 3007, category: 'Infrastructure' },
    { name: 'webhook', port: 3008, category: 'Infrastructure' },
    { name: 'workflows', port: 3004, category: 'Infrastructure' },
    { name: 'permissions', port: 3031, category: 'Infrastructure' }
];

const analysis = {};

for (const { name, port, category } of services) {
    const filePath = path.join(__dirname, 'src', 'services', `lonicflex-${name}-service.js`);

    if (!fs.existsSync(filePath)) {
        analysis[name] = { status: 'MISSING', category };
        continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Extract header comment (purpose description)
    const headerMatch = content.match(/\/\*\*\s*\n([^*]|\*(?!\/))*\*\//);
    const purpose = headerMatch ? headerMatch[0]
        .split('\n')
        .filter(l => l.includes(' * ') && !l.includes('/**') && !l.includes(' */'))
        .map(l => l.replace(/^\s*\*\s?/, '').trim())
        .filter(l => l && !l.startsWith('Handles:'))
        .slice(0, 2)
        .join(' ')
        : 'No description';

    // Extract "Handles:" list
    const handlesMatch = content.match(/\* Handles:\s*\n((?:\s*\*\s*-[^\n]+\n)*)/);
    const handles = handlesMatch ? handlesMatch[1]
        .split('\n')
        .map(l => l.replace(/^\s*\*\s*-\s*/, '').trim())
        .filter(l => l)
        : [];

    // Check for real implementation
    const hasStart = content.includes('async start()');
    const hasInitialize = content.includes('async initialize()');
    const hasExports = content.includes('module.exports');
    const hasAxios = (content.match(/await axios/g) || []).length;
    const hasOctokit = (content.match(/await this\.octokit/g) || []).length;
    const hasSlack = (content.match(/await this\.(webClient|slackApp)/g) || []).length;
    const routes = (content.match(/this\.app\.(get|post|put|delete|patch)/g) || []).length;
    const methods = (content.match(/async \w+\([^)]*\)\s*{/g) || []).length;

    // Check for environment variables required
    const envVars = [
        ...new Set(
            (content.match(/process\.env\.\w+/g) || [])
                .map(v => v.replace('process.env.', ''))
        )
    ].filter(v => !v.includes('PORT') && v !== 'NODE_ENV');

    // Check for external dependencies
    const hasDependencies = {
        github: hasOctokit > 0,
        slack: hasSlack > 0,
        http: hasAxios > 0,
        database: content.includes('SQLiteManager'),
        context: content.includes('Factor3ContextManager')
    };

    // Assess readiness
    const issues = [];
    if (!hasStart) issues.push('No start() method');
    if (!hasExports) issues.push('No module.exports');
    if (routes === 0) issues.push('No routes');
    if (methods < 5) issues.push('Few methods');

    // Check for commented implementation
    const commentedCode = content.match(/\/\/ In a real implementation|\/\/ TODO:|\/\/ FIXME:/g) || [];

    const status = issues.length === 0 ? 'READY' :
                   issues.length <= 2 ? 'MOSTLY READY' : 'NEEDS WORK';

    analysis[name] = {
        category,
        port,
        purpose: purpose.substring(0, 100),
        handles,
        lines: lines.length,
        hasStart,
        hasInitialize,
        routes,
        methods,
        apiCalls: hasAxios + hasOctokit + hasSlack,
        envVars,
        dependencies: hasDependencies,
        issues,
        commentedTODOs: commentedCode.length,
        status
    };
}

// Print by category
const categories = {
    'External Integration': [],
    'Infrastructure': []
};

for (const [name, data] of Object.entries(analysis)) {
    categories[data.category].push({ name, ...data });
}

for (const [category, items] of Object.entries(categories)) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📦 ${category.toUpperCase()}`);
    console.log(`${'═'.repeat(70)}\n`);

    for (const item of items) {
        const statusEmoji = item.status === 'READY' ? '✅' :
                           item.status === 'MOSTLY READY' ? '⚠️' : '🔧';

        console.log(`${statusEmoji} ${item.name.toUpperCase().padEnd(20)} | Port: ${item.port} | ${item.status}`);
        console.log(`${'─'.repeat(70)}`);
        console.log(`📋 Purpose: ${item.purpose}`);

        if (item.handles && item.handles.length > 0) {
            console.log(`\n🎯 Key Features:`);
            item.handles.slice(0, 3).forEach(h => console.log(`   • ${h}`));
            if (item.handles.length > 3) console.log(`   • ...and ${item.handles.length - 3} more`);
        }

        console.log(`\n📊 Implementation:`);
        console.log(`   • ${item.lines} lines of code`);
        console.log(`   • ${item.routes} Express routes`);
        console.log(`   • ${item.methods} async methods`);
        console.log(`   • ${item.apiCalls} external API calls`);
        console.log(`   • ${item.commentedTODOs} TODO/placeholder comments`);

        if (item.envVars.length > 0) {
            console.log(`\n🔐 Required Environment Variables:`);
            item.envVars.slice(0, 5).forEach(v => console.log(`   • ${v}`));
            if (item.envVars.length > 5) console.log(`   • ...and ${item.envVars.length - 5} more`);
        }

        console.log(`\n🔗 Dependencies:`);
        Object.entries(item.dependencies)
            .filter(([_, has]) => has)
            .forEach(([dep, _]) => console.log(`   • ${dep}`));

        if (item.issues.length > 0) {
            console.log(`\n⚠️  Issues:`);
            item.issues.forEach(i => console.log(`   • ${i}`));
        }

        console.log(`\n${'─'.repeat(70)}\n`);
    }
}

// Summary and recommendations
console.log(`\n${'═'.repeat(70)}`);
console.log(`📊 SUMMARY & RECOMMENDATIONS`);
console.log(`${'═'.repeat(70)}\n`);

const readyCount = Object.values(analysis).filter(a => a.status === 'READY').length;
const mostlyCount = Object.values(analysis).filter(a => a.status === 'MOSTLY READY').length;
const needsCount = Object.values(analysis).filter(a => a.status === 'NEEDS WORK').length;

console.log(`Status Breakdown:`);
console.log(`  ✅ Ready:        ${readyCount} services`);
console.log(`  ⚠️  Mostly Ready: ${mostlyCount} services`);
console.log(`  🔧 Needs Work:   ${needsCount} services\n`);

console.log(`What These Services Need to Be Fully Working:\n`);
console.log(`1. 🔐 CREDENTIALS & CONFIGURATION`);
console.log(`   • GitHub: GITHUB_TOKEN, repo owner/name`);
console.log(`   • Slack: SLACK_BOT_TOKEN, SLACK_APP_TOKEN (for Socket Mode)`);
console.log(`   • Jira: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN`);
console.log(`   • ServiceNow: SERVICENOW_INSTANCE_URL, username, password`);
console.log(`   • Jenkins: JENKINS_URL, JENKINS_USERNAME, JENKINS_API_TOKEN`);
console.log(`   • Linear: LINEAR_API_KEY`);
console.log(`   • GitLab: GITLAB_URL, GITLAB_TOKEN\n`);

console.log(`2. 🏗️  INFRASTRUCTURE`);
console.log(`   • Database: SQLite (already initialized)`);
console.log(`   • Context Manager: Factor3ContextManager (already initialized)`);
console.log(`   • Service coordination: Integration Hub for cross-service events`);
console.log(`   • Port management: Ensure no conflicts (3001-3031)\n`);

console.log(`3. 🔧 CODE COMPLETION`);
console.log(`   • Remove TODO/placeholder comments (${Object.values(analysis).reduce((sum, a) => sum + a.commentedTODOs, 0)} found)`);
console.log(`   • Uncomment real implementations`);
console.log(`   • Add error handling where missing`);
console.log(`   • Complete ServiceBase integration (already done for most)\n`);

console.log(`4. 🧪 TESTING`);
console.log(`   • Create service-specific tests for each`);
console.log(`   • Test with mock credentials first`);
console.log(`   • Test actual API integration with real credentials`);
console.log(`   • Test cross-service coordination\n`);

console.log(`5. 🚀 DEPLOYMENT READINESS`);
console.log(`   • PM2 process management (already configured)`);
console.log(`   • Logging and monitoring (Winston already set up)`);
console.log(`   • Health check endpoints (already implemented)`);
console.log(`   • Rate limiting and retry logic (partially implemented)\n`);

console.log(`Priority Order for Making Services Fully Working:\n`);
console.log(`  1️⃣  Master Service - Core coordinator, needs this first`);
console.log(`  2️⃣  GitHub Service - Primary integration, most features use this`);
console.log(`  3️⃣  Slack Service - User interface via Slack commands`);
console.log(`  4️⃣  Webhook Service - Event coordination and domino effects`);
console.log(`  5️⃣  Integration Hub - Cross-service communication`);
console.log(`  6️⃣  Workflows Service - Pipeline orchestration`);
console.log(`  7️⃣  Health Service - Monitoring infrastructure`);
console.log(`  8️⃣  Other integrations (Jira, ServiceNow, etc.) - As needed\n`);

// Write JSON report
const reportPath = path.join(__dirname, 'comprehensive-service-report.json');
fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
console.log(`📄 Detailed JSON report: comprehensive-service-report.json\n`);
