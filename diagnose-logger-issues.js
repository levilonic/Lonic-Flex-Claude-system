#!/usr/bin/env node
/**
 * Diagnose Logger Issues in All Services
 *
 * Systematically checks each service for:
 * 1. Whether it uses logger
 * 2. Whether it imports logger
 * 3. Whether it initializes logger
 */

const fs = require('fs');
const path = require('path');

const services = [
    'lonicflex-master-service.js',
    'lonicflex-webhook-service.js',
    'lonicflex-workflows-service.js',
    'lonicflex-health-service.js',
    'lonicflex-integration-hub-service.js',
    'lonicflex-permissions-service.js',
    'lonicflex-github-service.js',
    'lonicflex-slack-service.js',
    'lonicflex-gitlab-service.js',
    'lonicflex-jira-service.js',
    'lonicflex-servicenow-service.js',
    'lonicflex-linear-service.js',
    'lonicflex-jenkins-service.js'
];

console.log('🔍 Diagnosing Logger Issues in All Services\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const results = {
    needsFix: [],
    alreadyFixed: [],
    noLogger: []
};

for (const serviceName of services) {
    const filePath = path.join(__dirname, 'src/services', serviceName);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ ${serviceName}: File not found`);
        continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Check if uses logger
    const usesLogger = content.includes('logger.info') ||
                      content.includes('logger.error') ||
                      content.includes('logger.warn') ||
                      content.includes('logger.debug');

    // Check if imports logger
    const hasLoggerImport = content.includes("require('./logger')") ||
                           content.includes('require("./logger")') ||
                           content.includes('from "./logger"') ||
                           content.includes('from \'./logger\'');

    // Check if initializes logger
    const hasLoggerInit = content.includes('this.logger = ') ||
                         content.includes('const logger = ');

    console.log(`\n📝 ${serviceName}:`);
    console.log(`   Uses logger: ${usesLogger ? '✅ YES' : '❌ NO'}`);
    console.log(`   Imports logger: ${hasLoggerImport ? '✅ YES' : '❌ NO'}`);
    console.log(`   Initializes logger: ${hasLoggerInit ? '✅ YES' : '❌ NO'}`);

    if (!usesLogger) {
        console.log(`   Status: ✅ No logger usage - OK`);
        results.noLogger.push(serviceName);
    } else if (hasLoggerImport && hasLoggerInit) {
        console.log(`   Status: ✅ Already properly configured`);
        results.alreadyFixed.push(serviceName);
    } else {
        console.log(`   Status: ❌ NEEDS FIX`);
        results.needsFix.push({
            service: serviceName,
            needsImport: !hasLoggerImport,
            needsInit: !hasLoggerInit
        });
    }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Diagnosis Summary');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`✅ Already Fixed: ${results.alreadyFixed.length}/${services.length}`);
console.log(`❌ Need Fixing: ${results.needsFix.length}/${services.length}`);
console.log(`⚪ No Logger: ${results.noLogger.length}/${services.length}\n`);

if (results.needsFix.length > 0) {
    console.log('Services That Need Fixing:\n');
    results.needsFix.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.service}`);
        if (item.needsImport) console.log(`   → Needs logger import`);
        if (item.needsInit) console.log(`   → Needs logger initialization`);
    });
    console.log();
}

if (results.alreadyFixed.length > 0) {
    console.log('Services Already Fixed:\n');
    results.alreadyFixed.forEach((service, idx) => {
        console.log(`${idx + 1}. ${service}`);
    });
    console.log();
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (results.needsFix.length > 0) {
    console.log(`❌ ${results.needsFix.length} services need logger fixes\n`);
    process.exit(1);
} else {
    console.log('✅ All services have proper logger configuration\n');
    process.exit(0);
}
