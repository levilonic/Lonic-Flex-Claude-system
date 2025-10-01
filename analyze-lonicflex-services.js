#!/usr/bin/env node
/**
 * Systematically analyze each lonicflex service to determine:
 * - Real implementation vs scaffold
 * - Number of NOT_IMPLEMENTED errors
 * - Number of stub methods
 * - Has actual logic or just Express routes
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Systematic Analysis of Remaining LonicFLex Services\n');

const servicesDir = path.join(__dirname, 'src', 'services');
const services = fs.readdirSync(servicesDir)
    .filter(f => f.startsWith('lonicflex-') && f.endsWith('-service.js'))
    .sort();

const results = [];

for (const service of services) {
    const servicePath = path.join(servicesDir, service);
    const content = fs.readFileSync(servicePath, 'utf8');
    const lines = content.split('\n').length;

    // Count indicators
    const notImplemented = (content.match(/NOT_IMPLEMENTED/g) || []).length;
    const stubMethods = (content.match(/\/\* Implementation \*\//g) || []).length;
    const axiosCalls = (content.match(/await axios\./g) || []).length;
    const octokitCalls = (content.match(/await this\.octokit/g) || []).length;
    const slackCalls = (content.match(/await this\.webClient|await this\.slackApp/g) || []).length;
    const expressRoutes = (content.match(/this\.app\.(get|post|put|delete|patch)/g) || []).length;

    // Determine status
    let status = 'UNKNOWN';
    let reason = '';

    if (notImplemented > 0) {
        status = 'SCAFFOLD';
        reason = `${notImplemented} NOT_IMPLEMENTED errors`;
    } else if (stubMethods > 10) {
        status = 'SCAFFOLD';
        reason = `${stubMethods} stub methods`;
    } else if (axiosCalls > 0 || octokitCalls > 0 || slackCalls > 0) {
        status = 'REAL';
        reason = `Has actual API calls: axios(${axiosCalls}), octokit(${octokitCalls}), slack(${slackCalls})`;
    } else if (expressRoutes > 5) {
        status = 'HYBRID';
        reason = `${expressRoutes} routes but no real API calls`;
    } else {
        status = 'MINIMAL';
        reason = 'Few routes, no clear implementation';
    }

    results.push({
        service,
        lines,
        status,
        reason,
        notImplemented,
        stubMethods,
        axiosCalls,
        octokitCalls,
        slackCalls,
        expressRoutes
    });
}

// Group by status
const grouped = {
    REAL: results.filter(r => r.status === 'REAL'),
    HYBRID: results.filter(r => r.status === 'HYBRID'),
    SCAFFOLD: results.filter(r => r.status === 'SCAFFOLD'),
    MINIMAL: results.filter(r => r.status === 'MINIMAL'),
    UNKNOWN: results.filter(r => r.status === 'UNKNOWN')
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ REAL IMPLEMENTATION (Keep)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (grouped.REAL.length === 0) {
    console.log('   (none)\n');
} else {
    grouped.REAL.forEach(({ service, lines, reason }) => {
        console.log(`   ${service} (${lines} lines)`);
        console.log(`      ${reason}\n`);
    });
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚠️  HYBRID (Needs Review)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (grouped.HYBRID.length === 0) {
    console.log('   (none)\n');
} else {
    grouped.HYBRID.forEach(({ service, lines, reason }) => {
        console.log(`   ${service} (${lines} lines)`);
        console.log(`      ${reason}\n`);
    });
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('❌ SCAFFOLD (Delete)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (grouped.SCAFFOLD.length === 0) {
    console.log('   (none)\n');
} else {
    grouped.SCAFFOLD.forEach(({ service, lines, reason, notImplemented, stubMethods }) => {
        console.log(`   ${service} (${lines} lines)`);
        console.log(`      ${reason}`);
        if (notImplemented > 0) console.log(`      NOT_IMPLEMENTED: ${notImplemented}`);
        if (stubMethods > 0) console.log(`      Stub methods: ${stubMethods}`);
        console.log();
    });
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`   ✅ REAL:     ${grouped.REAL.length} services (KEEP)`);
console.log(`   ⚠️  HYBRID:   ${grouped.HYBRID.length} services (REVIEW)`);
console.log(`   ❌ SCAFFOLD: ${grouped.SCAFFOLD.length} services (DELETE)`);
console.log(`   ❓ MINIMAL:  ${grouped.MINIMAL.length} services (REVIEW)`);
console.log(`   ❓ UNKNOWN:  ${grouped.UNKNOWN.length} services (REVIEW)\n`);

const toDelete = grouped.SCAFFOLD.length;
const toReview = grouped.HYBRID.length + grouped.MINIMAL.length + grouped.UNKNOWN.length;
const toKeep = grouped.REAL.length;

console.log(`📝 Recommendation:`);
console.log(`   - Keep ${toKeep} real services`);
console.log(`   - Review ${toReview} hybrid/minimal services manually`);
console.log(`   - Delete ${toDelete} scaffold services\n`);

if (toDelete > 0) {
    console.log('🗑️  Services to DELETE:\n');
    grouped.SCAFFOLD.forEach(({ service }) => {
        console.log(`   rm src/services/${service}`);
    });
    console.log();
}
