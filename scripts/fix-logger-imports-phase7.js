#!/usr/bin/env node
/**
 * Phase 7: Fix Logger Import Patterns
 *
 * Automatically fixes 19 files that still use the wrong logger import pattern:
 * FROM: const { logger } = require('./logger');
 * TO:   const { info, warn, error } = require('./logger');
 *
 * Also updates all logger method calls:
 * logger.info() → info()
 * logger.warn() → warn()
 * logger.error() → error()
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Phase 7: Fixing Logger Import Patterns\n');

// Files that need fixing (discovered via grep)
const filesToFix = [
    'src/services/workflow-template-service.js',
    'src/services/workflow-orchestrator.js',
    'src/services/test-automation.js',
    'src/services/resource-manager.js',
    'src/services/repository-config-manager.js',
    'src/services/real-slack-authenticator.js',
    'src/services/progress-monitor.js',
    'src/services/milestone-integration-service.js',
    'src/services/issue-management-service.js',
    'src/services/github-workflow-manager.js',
    'src/services/github-projects-manager.js',
    'src/services/github-actions-manager.js',
    'src/services/git-automation.js',
    'src/services/filesystem-automation.js',
    'src/services/error-recovery.js',
    'src/services/documentation-service.js',
    'src/services/cross-branch-coordinator.js',
    'src/services/branch-aware-agent-manager.js',
    'src/services/agent-pool-manager.js'
];

let totalFixed = 0;
let totalFiles = 0;

function fixLoggerImports(filePath) {
    try {
        const fullPath = path.join(__dirname, '..', filePath);

        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️  File not found: ${filePath}`);
            return false;
        }

        let content = fs.readFileSync(fullPath, 'utf8');
        const originalContent = content;

        // Fix the import statement
        content = content.replace(
            /const \{ logger \} = require\(['"]\.\/logger['"]\);?/g,
            "const { info, warn, error } = require('./logger');"
        );

        // Fix all logger.info() calls
        content = content.replace(/logger\.info\(/g, 'info(');

        // Fix all logger.warn() calls
        content = content.replace(/logger\.warn\(/g, 'warn(');

        // Fix all logger.error() calls
        content = content.replace(/logger\.error\(/g, 'error(');

        // Count changes made
        const changes = originalContent !== content;

        if (changes) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`✅ Fixed: ${filePath}`);
            totalFixed++;
        } else {
            console.log(`ℹ️  No changes needed: ${filePath}`);
        }

        totalFiles++;
        return changes;

    } catch (error) {
        console.error(`❌ Error fixing ${filePath}:`, error.message);
        return false;
    }
}

function main() {
    console.log(`📋 Processing ${filesToFix.length} files with logger import issues...\n`);

    for (const filePath of filesToFix) {
        fixLoggerImports(filePath);
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Files processed: ${totalFiles}`);
    console.log(`   Files fixed: ${totalFixed}`);
    console.log(`   Files unchanged: ${totalFiles - totalFixed}`);

    if (totalFixed > 0) {
        console.log(`\n✅ Phase 7 logger import fixes complete!`);
        console.log(`   All files now use: const { info, warn, error } = require('./logger');`);
        console.log(`   All method calls updated: logger.info() → info()`);
    } else {
        console.log(`\nℹ️  All files were already correct.`);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { fixLoggerImports, filesToFix };