#!/usr/bin/env node
/**
 * Fix Logger References in All Services
 *
 * Problem: Services use `logger.info()` but logger is stored as `this.logger`
 * Solution: Replace all `logger.` with `this.logger.` in service methods
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

console.log('🔧 Fixing Logger References in All Services\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let fixed = 0;
let skipped = 0;

for (const serviceName of services) {
    const filePath = path.join(__dirname, 'src/services', serviceName);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  ${serviceName}: File not found - skipped`);
        skipped++;
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let changesMade = 0;

    // Replace logger. with this.logger. but ONLY in class methods
    // NOT in places where logger is correctly used (like logger module itself)

    // Pattern: Find logger.info/warn/error/debug that are NOT this.logger
    const patterns = [
        { from: /([^.]|^)logger\.info\(/g, to: '$1this.logger.info(' },
        { from: /([^.]|^)logger\.warn\(/g, to: '$1this.logger.warn(' },
        { from: /([^.]|^)logger\.error\(/g, to: '$1this.logger.error(' },
        { from: /([^.]|^)logger\.debug\(/g, to: '$1this.logger.debug(' }
    ];

    let newContent = content;
    for (const pattern of patterns) {
        const before = newContent;
        newContent = newContent.replace(pattern.from, pattern.to);
        if (before !== newContent) {
            changesMade++;
        }
    }

    if (changesMade > 0) {
        fs.writeFileSync(filePath, newContent);
        console.log(`✅ ${serviceName}: Fixed ${changesMade} logger reference(s)`);
        fixed++;
    } else {
        console.log(`✅ ${serviceName}: No changes needed`);
        skipped++;
    }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Fix Summary');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`✅ Fixed: ${fixed}/${services.length}`);
console.log(`⚪ Skipped: ${skipped}/${services.length}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (fixed > 0) {
    console.log('🎉 Logger references fixed successfully!\n');
    console.log('Next steps:');
    console.log('1. Run tests: node run-all-service-tests.js');
    console.log('2. Commit changes');
    console.log('3. Start services\n');
}
