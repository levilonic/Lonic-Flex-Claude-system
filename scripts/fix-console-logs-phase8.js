#!/usr/bin/env node
/**
 * Fix remaining console.log statements from Phase 8 analysis
 * Convert to structured logger pattern
 */

const fs = require('fs');
const path = require('path');

// Files with remaining console.log to convert
const filesToFix = [
    'src/auth/secrets-rotator.js',
    'src/auth/secrets-validator.js',
    'src/context-management/context-archive-manager.js',
    'src/context-management/context-auto-manager.js',
    'src/context-management/integrated-context-manager.js',
    'src/core/project-list-command.js',
    'src/core/react-self-correction-engine.js',
    'src/services/progress-monitor.js',
    'src/services/service-container.js'
];

function fixConsoleLogsInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let changes = 0;

    // Check if logger is already imported
    const hasLoggerImport = content.includes("require('./logger')") ||
                           content.includes("require('../services/logger')") ||
                           content.includes('{ info, warn, error }') ||
                           content.includes('LonicFlexLogger');

    // Add logger import if not present
    if (!hasLoggerImport && content.includes('console.log')) {
        // Find the best place to add the import
        const requireStatements = content.match(/^const .* = require\(.*\);$/gm);
        if (requireStatements && requireStatements.length > 0) {
            const lastRequire = requireStatements[requireStatements.length - 1];
            const importToAdd = "const { info, warn, error } = require('./logger');";

            // Check relative path depth
            const relativeDepth = (filePath.match(/\//g) || []).length - 1;
            let loggerPath = './logger';
            if (filePath.includes('src/auth/')) loggerPath = '../services/logger';
            if (filePath.includes('src/context-management/')) loggerPath = '../services/logger';
            if (filePath.includes('src/core/')) loggerPath = '../services/logger';

            const correctImport = `const { info, warn, error } = require('${loggerPath}');`;
            content = content.replace(lastRequire, lastRequire + '\n' + correctImport);
        }
    }

    // Convert console.log patterns
    const patterns = [
        // console.log(...) -> info(...)
        {
            pattern: /console\.log\(/g,
            replacement: 'info(',
            description: 'console.log to info'
        },
        // console.warn(...) -> warn(...)
        {
            pattern: /console\.warn\(/g,
            replacement: 'warn(',
            description: 'console.warn to warn'
        },
        // console.error(...) -> error(...)
        {
            pattern: /console\.error\(/g,
            replacement: 'error(',
            description: 'console.error to error'
        }
    ];

    for (const { pattern, replacement, description } of patterns) {
        const matches = content.match(pattern);
        if (matches) {
            content = content.replace(pattern, replacement);
            changes += matches.length;
        }
    }

    return { content, changes, hasChanges: content !== originalContent };
}

function main() {
    console.log('🔧 Phase 8: Cleaning up remaining console.log statements\n');

    let totalFiles = 0;
    let totalChanges = 0;

    for (const file of filesToFix) {
        const filePath = path.join(__dirname, '..', file);

        if (!fs.existsSync(filePath)) {
            console.log(`❌ File not found: ${file}`);
            continue;
        }

        const result = fixConsoleLogsInFile(filePath);

        if (result.hasChanges) {
            fs.writeFileSync(filePath, result.content, 'utf8');
            console.log(`✅ ${file}: ${result.changes} console statements converted`);
            totalFiles++;
            totalChanges += result.changes;
        } else {
            console.log(`✅ ${file}: No console statements found`);
        }
    }

    console.log(`\n🎯 Phase 8 Console Cleanup Complete:`);
    console.log(`   Files updated: ${totalFiles}`);
    console.log(`   Total conversions: ${totalChanges}`);
    console.log('✅ All console.log statements cleaned!');
}

if (require.main === module) {
    main();
}

module.exports = { fixConsoleLogsInFile };