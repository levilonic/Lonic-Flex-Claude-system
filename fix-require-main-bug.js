#!/usr/bin/env node

/**
 * Fix require.main === module block bugs
 *
 * Bug: Using `this.logger` in require.main block where `this` is undefined
 * Fix: Replace with console.log/console.error/console.warn
 */

const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'src', 'services');
const services = fs.readdirSync(servicesDir)
    .filter(f => f.startsWith('lonicflex-') && f.endsWith('-service.js'));

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 Fixing require.main Block Bugs');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const results = {
    total: 0,
    fixed: 0,
    skipped: 0,
    totalReplacements: 0
};

for (const service of services) {
    results.total++;
    const serviceName = service.replace('lonicflex-', '').replace('-service.js', '');
    const filePath = path.join(servicesDir, service);
    let content = fs.readFileSync(filePath, 'utf8');

    // Find require.main block
    const requireMainMatch = content.match(/if \(require\.main === module\) \{([^]*?)\n\}/);

    if (!requireMainMatch) {
        console.log(`⚠️  ${serviceName}: No require.main block found`);
        results.skipped++;
        continue;
    }

    const blockContent = requireMainMatch[1];

    // Check for this.logger usage
    const hasThisLogger = blockContent.includes('this.logger');

    if (!hasThisLogger) {
        console.log(`✅ ${serviceName}: Already clean`);
        results.skipped++;
        continue;
    }

    // Perform replacements
    let replacements = 0;
    const originalContent = content;

    // Replace this.logger.info → console.log
    content = content.replace(
        /this\.logger\.info\(/g,
        (match, offset) => {
            // Only replace within require.main block
            const beforeMatch = originalContent.substring(0, offset);
            const lastRequireMain = beforeMatch.lastIndexOf('if (require.main === module)');
            const nextModuleExport = originalContent.substring(offset).indexOf('module.exports');

            if (lastRequireMain !== -1 && (nextModuleExport === -1 || offset < lastRequireMain + 500)) {
                replacements++;
                return 'console.log(';
            }
            return match;
        }
    );

    // Replace this.logger.error → console.error
    content = content.replace(
        /this\.logger\.error\(/g,
        (match, offset) => {
            const beforeMatch = originalContent.substring(0, offset);
            const lastRequireMain = beforeMatch.lastIndexOf('if (require.main === module)');
            const nextModuleExport = originalContent.substring(offset).indexOf('module.exports');

            if (lastRequireMain !== -1 && (nextModuleExport === -1 || offset < lastRequireMain + 500)) {
                replacements++;
                return 'console.error(';
            }
            return match;
        }
    );

    // Replace this.logger.warn → console.warn
    content = content.replace(
        /this\.logger\.warn\(/g,
        (match, offset) => {
            const beforeMatch = originalContent.substring(0, offset);
            const lastRequireMain = beforeMatch.lastIndexOf('if (require.main === module)');
            const nextModuleExport = originalContent.substring(offset).indexOf('module.exports');

            if (lastRequireMain !== -1 && (nextModuleExport === -1 || offset < lastRequireMain + 500)) {
                replacements++;
                return 'console.warn(';
            }
            return match;
        }
    );

    if (replacements > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ ${serviceName}: Fixed ${replacements} references`);
        results.fixed++;
        results.totalReplacements += replacements;
    } else {
        console.log(`⚠️  ${serviceName}: No replacements made (check manually)`);
        results.skipped++;
    }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Summary');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`Total services:       ${results.total}`);
console.log(`Fixed:                ${results.fixed} ✅`);
console.log(`Skipped:              ${results.skipped}`);
console.log(`Total replacements:   ${results.totalReplacements}`);

if (results.fixed > 0) {
    console.log('\n✅ All require.main blocks fixed!');
    console.log('   Services will no longer crash on startup');
    console.log('\n📝 Next steps:');
    console.log('   1. Run tests: npm test');
    console.log('   2. Start services: node start-services.js');
}
