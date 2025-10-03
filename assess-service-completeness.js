#!/usr/bin/env node
/**
 * Systematically assess completeness of each lonicflex service
 * Tests: Can it instantiate? Can it start? Does it have real logic?
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Systematic Service Completeness Assessment\n');

const services = [
    'github', 'gitlab', 'health', 'integration-hub', 'linear', 'slack',
    'jenkins', 'jira', 'master', 'permissions', 'servicenow', 'webhook', 'workflows'
];

const results = [];

for (const serviceName of services) {
    const filePath = path.join(__dirname, 'src', 'services', `lonicflex-${serviceName}-service.js`);

    if (!fs.existsSync(filePath)) {
        results.push({
            name: serviceName,
            status: 'MISSING',
            issues: ['File does not exist']
        });
        continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    // Assessment criteria
    const assessment = {
        name: serviceName,
        lines,
        hasServiceBase: content.includes('extends ServiceBase'),
        hasAxios: (content.match(/await axios/g) || []).length,
        hasOctokit: (content.match(/await this\.octokit/g) || []).length,
        hasSlack: (content.match(/await this\.(webClient|slackApp)/g) || []).length,
        hasExports: content.includes('module.exports'),
        hasStart: content.includes('async start()') || content.includes('start()'),
        hasInitialize: content.includes('async initialize()') || content.includes('initialize()'),
        hasRoutes: (content.match(/this\.app\.(get|post|put|delete|patch)/g) || []).length,
        hasTODO: (content.match(/\/\/ TODO|\/\*\s*TODO/g) || []).length,
        hasPlaceholder: (content.match(/placeholder|stub|mock.*implementation/gi) || []).length,
        hasThrowNew: (content.match(/throw new Error/g) || []).length,
        hasRealMethods: 0,
        issues: []
    };

    // Check for real method implementations (async functions with actual logic)
    const methodMatches = content.match(/async \w+\([^)]*\)\s*{[^}]{50,}/g) || [];
    assessment.hasRealMethods = methodMatches.length;

    // Determine status
    if (!assessment.hasServiceBase) {
        assessment.issues.push('Missing ServiceBase inheritance');
    }

    if (!assessment.hasExports) {
        assessment.issues.push('No module.exports');
    }

    if (!assessment.hasStart && !assessment.hasInitialize) {
        assessment.issues.push('No start() or initialize() method');
    }

    if (assessment.hasRoutes === 0) {
        assessment.issues.push('No Express routes defined');
    }

    if (assessment.hasRealMethods < 5) {
        assessment.issues.push(`Only ${assessment.hasRealMethods} real methods`);
    }

    if (assessment.hasTODO > 5) {
        assessment.issues.push(`${assessment.hasTODO} TODO comments`);
    }

    if (assessment.hasPlaceholder > 0) {
        assessment.issues.push(`${assessment.hasPlaceholder} placeholders/stubs`);
    }

    // Check for API integration
    const hasAPIIntegration = assessment.hasAxios > 0 || assessment.hasOctokit > 0 || assessment.hasSlack > 0;
    assessment.apiType = hasAPIIntegration ? 'EXTERNAL API' : 'COORDINATOR';

    // Determine overall status
    if (assessment.issues.length === 0) {
        assessment.status = 'COMPLETE';
    } else if (assessment.issues.length <= 2) {
        assessment.status = 'MOSTLY COMPLETE';
    } else if (assessment.hasRealMethods >= 5 && hasAPIIntegration) {
        assessment.status = 'NEEDS WORK';
    } else {
        assessment.status = 'INCOMPLETE';
    }

    results.push(assessment);
}

// Test if services can be instantiated
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 INSTANTIATION TEST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const result of results) {
    if (result.status === 'MISSING') continue;

    try {
        const ServiceClass = require(`./src/services/lonicflex-${result.name}-service.js`);
        const className = ServiceClass.name || Object.keys(ServiceClass)[0];

        if (!className) {
            result.instantiation = '❌ FAIL - No class exported';
            result.issues.push('No class exported');
        } else {
            // Try to instantiate without starting
            const instance = new ServiceClass({ test: true });
            result.instantiation = '✅ PASS';
        }
    } catch (error) {
        result.instantiation = `❌ FAIL - ${error.message.substring(0, 60)}`;
        result.issues.push(`Instantiation error: ${error.message}`);
        result.status = 'BROKEN';
    }
}

// Group by status
const grouped = {
    COMPLETE: results.filter(r => r.status === 'COMPLETE'),
    'MOSTLY COMPLETE': results.filter(r => r.status === 'MOSTLY COMPLETE'),
    'NEEDS WORK': results.filter(r => r.status === 'NEEDS WORK'),
    INCOMPLETE: results.filter(r => r.status === 'INCOMPLETE'),
    BROKEN: results.filter(r => r.status === 'BROKEN'),
    MISSING: results.filter(r => r.status === 'MISSING')
};

// Print results
for (const [status, items] of Object.entries(grouped)) {
    if (items.length === 0) continue;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${getStatusEmoji(status)} ${status}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    for (const item of items) {
        console.log(`📦 ${item.name.padEnd(20)} | ${item.lines} lines | ${item.apiType || 'N/A'}`);
        console.log(`   ${item.instantiation || 'Not tested'}`);
        console.log(`   Routes: ${item.hasRoutes}, Methods: ${item.hasRealMethods}, API calls: ${item.hasAxios + item.hasOctokit + item.hasSlack}`);

        if (item.issues.length > 0) {
            console.log(`   Issues:`);
            item.issues.forEach(issue => console.log(`     - ${issue}`));
        }
        console.log();
    }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

Object.entries(grouped).forEach(([status, items]) => {
    if (items.length > 0) {
        console.log(`${getStatusEmoji(status)} ${status.padEnd(20)} - ${items.length} services`);
    }
});

console.log('\n📝 Recommendation:');
console.log(`   - ${grouped.COMPLETE.length} services are production-ready`);
console.log(`   - ${grouped['MOSTLY COMPLETE'].length} services need minor fixes`);
console.log(`   - ${grouped['NEEDS WORK'].length} services need significant work`);
console.log(`   - ${grouped.INCOMPLETE.length + grouped.BROKEN.length + grouped.MISSING.length} services are not functional\n`);

function getStatusEmoji(status) {
    const emojis = {
        'COMPLETE': '✅',
        'MOSTLY COMPLETE': '⚠️',
        'NEEDS WORK': '🔧',
        'INCOMPLETE': '❌',
        'BROKEN': '💥',
        'MISSING': '🚫'
    };
    return emojis[status] || '❓';
}

// Write detailed JSON report
const reportPath = path.join(__dirname, 'service-assessment-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`📄 Detailed report written to: service-assessment-report.json\n`);
