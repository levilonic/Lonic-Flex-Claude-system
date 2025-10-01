#!/usr/bin/env node
/**
 * Fix broken error syntax from Phase 7 console.log conversion
 * Issue: error(`); statements causing syntax errors
 */

const fs = require('fs');
const path = require('path');

// Files with broken error syntax
const brokenFiles = [
    'src/context-management/workflow-enhanced-context-commands.js',
    'src/core/human-in-the-loop-manager.js',
    'src/context-management/workflow-engine.js',
    'src/context-management/context-health-check.js',
    'src/core/spec-driven-agent.js',
    'src/core/validated-agent-base.js'
];

function fixBrokenErrorSyntax() {
    console.log('🔧 Fixing broken error syntax in 6 files...\n');
    let totalFixed = 0;

    for (const file of brokenFiles) {
        const filePath = path.join(__dirname, '..', file);

        if (!fs.existsSync(filePath)) {
            console.log(`❌ File not found: ${file}`);
            continue;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        // Fix broken error(`); patterns
        let fixes = 0;

        // Pattern 1: error(`); -> error('Error occurred');
        const brokenPattern1 = /error\(`\);/g;
        const matches1 = content.match(brokenPattern1);
        if (matches1) {
            content = content.replace(brokenPattern1, "error('Error occurred');");
            fixes += matches1.length;
        }

        // Pattern 2: error(`); followed by newline -> error('Error occurred', { details });
        const brokenPattern2 = /error\(`\);\s*\n/g;
        const matches2 = content.match(brokenPattern2);
        if (matches2) {
            content = content.replace(brokenPattern2, "error('Error occurred');\n");
            fixes += matches2.length;
        }

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ ${file}: Fixed ${fixes} broken error statements`);
            totalFixed += fixes;
        } else {
            console.log(`✅ ${file}: No fixes needed`);
        }
    }

    console.log(`\n🎯 Total fixes applied: ${totalFixed}`);
    console.log('✅ All broken error syntax fixed!');
}

if (require.main === module) {
    fixBrokenErrorSyntax();
}

module.exports = { fixBrokenErrorSyntax };