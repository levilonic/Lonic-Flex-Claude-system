#!/usr/bin/env node

/**
 * Diagnose require.main === module block bugs
 *
 * Bug: Using `this.logger` in require.main block where `this` is undefined
 * Fix: Replace with console.log/console.error
 */

const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'src', 'services');
const services = fs.readdirSync(servicesDir)
    .filter(f => f.startsWith('lonicflex-') && f.endsWith('-service.js'));

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 Diagnosing require.main Block Bugs');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const results = {
    total: 0,
    buggy: 0,
    clean: 0,
    issues: []
};

for (const service of services) {
    results.total++;
    const serviceName = service.replace('lonicflex-', '').replace('-service.js', '');
    const filePath = path.join(servicesDir, service);
    const content = fs.readFileSync(filePath, 'utf8');

    // Find require.main block
    const requireMainMatch = content.match(/if \(require\.main === module\) \{([^]*?)\n\}/);

    if (!requireMainMatch) {
        console.log(`⚠️  ${serviceName}: No require.main block found`);
        continue;
    }

    const blockContent = requireMainMatch[1];

    // Check for this.logger usage
    const hasThisLogger = blockContent.includes('this.logger');

    if (hasThisLogger) {
        results.buggy++;

        // Extract specific lines with this.logger
        const lines = content.split('\n');
        const bugLines = [];
        let inBlock = false;

        lines.forEach((line, idx) => {
            if (line.includes('if (require.main === module)')) {
                inBlock = true;
            }
            if (inBlock && line.includes('this.logger')) {
                bugLines.push({ lineNum: idx + 1, content: line.trim() });
            }
            if (inBlock && line === '}' && line[0] === '}') {
                inBlock = false;
            }
        });

        console.log(`❌ ${serviceName}: Uses this.logger in require.main block`);
        bugLines.forEach(({ lineNum, content }) => {
            console.log(`   Line ${lineNum}: ${content}`);
        });

        results.issues.push({
            service: serviceName,
            file: service,
            bugLines
        });
    } else {
        results.clean++;
        console.log(`✅ ${serviceName}: Clean (uses console.log)`);
    }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Summary');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`Total services:  ${results.total}`);
console.log(`Buggy services:  ${results.buggy} ❌`);
console.log(`Clean services:  ${results.clean} ✅`);

if (results.buggy > 0) {
    console.log('\n🚨 CRITICAL BUG: Services use this.logger in require.main block');
    console.log('   This causes crash because `this` is undefined in module context');
    console.log('\n💡 Fix: Replace this.logger with console');
    console.log('   - this.logger.info()  → console.log()');
    console.log('   - this.logger.error() → console.error()');
    console.log('   - this.logger.warn()  → console.warn()');
}
