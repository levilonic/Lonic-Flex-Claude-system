#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Phase 2.13: Fix this.logger calls in start() method catch blocks
 *
 * Problem: When services start via require.main, the logger isn't initialized yet
 * Solution: Replace this.logger with console in start() method error handlers
 */

const services = [
    'lonicflex-workflows-service.js',
    'lonicflex-health-service.js',
    'lonicflex-github-service.js',
    'lonicflex-slack-service.js',
    'lonicflex-linear-service.js'
];

const servicesDir = path.join(__dirname, 'src', 'services');

console.log('🔧 Phase 2.13: Fixing start() method logger calls\n');

services.forEach(serviceFile => {
    const filePath = path.join(servicesDir, serviceFile);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Pattern: this.logger.error in start() method catch block
    // Look for: "Failed to start {Service} service" or "Failed to start {Service} Service"
    const patterns = [
        {
            old: /this\.logger\.error\('(FAIL )?Failed to start (\w+) [Ss]ervice:?',\s*error\.message\);/g,
            new: (match, prefix, serviceName) => `console.error('${prefix || ''}Failed to start ${serviceName} service:', error.message);`
        },
        {
            old: /this\.logger\.error\('(FAIL )?Failed to start (\w+) [Ss]ervice',\s*\{[\s\S]*?error:\s*error\.message[\s\S]*?\}\);/g,
            new: (match, prefix, serviceName) => `console.error('${prefix || ''}Failed to start ${serviceName} service:', error.message);`
        }
    ];

    patterns.forEach(pattern => {
        if (pattern.old.test(content)) {
            content = content.replace(pattern.old, pattern.new);
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed: ${serviceFile}`);
    } else {
        console.log(`⏭️  Skipped: ${serviceFile} (no matches)`);
    }
});

console.log('\n✅ Phase 2.13 complete: All start() method logger calls fixed');
