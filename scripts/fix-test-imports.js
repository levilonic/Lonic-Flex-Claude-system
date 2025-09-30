#!/usr/bin/env node

/**
 * Test Import Fixer
 *
 * Purpose: Automatically fix broken import paths in test files
 * This is systematic engineering - understand the pattern, automate the fix
 *
 * Common patterns to fix:
 * - ./services/X -> ../../src/services/X
 * - ./agents/X -> ../../src/agents/X
 * - ./database/X -> ../../src/database/X
 * - ./core/X -> ../../src/core/X
 * - ../services/X -> ../../src/services/X (from integration tests)
 *
 * Usage: node scripts/fix-test-imports.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

class TestImportFixer {
    constructor(dryRun = false) {
        this.dryRun = dryRun;
        this.fixes = [];
    }

    /**
     * Determine correct import path based on test location
     */
    getCorrectImportPath(testFile, originalImport) {
        const testDir = path.dirname(testFile);
        const testCategory = path.basename(testDir); // 'unit', 'integration', 'phase-tests'

        // Map of common import patterns to correct paths
        const importMappings = {
            // From tests/unit/ (one level up, then to src/)
            unit: {
                './services/': '../../src/services/',
                './agents/': '../../src/agents/',
                './database/': '../../src/database/',
                './core/': '../../src/core/',
                './context-management/': '../../src/context-management/',
                './memory/': '../../src/memory/',
                './working/': '../../src/working/',
                '../services/': '../../src/services/',
                '../agents/': '../../src/agents/'
            },
            // From tests/integration/ (one level up, then to src/)
            integration: {
                './services/': '../../src/services/',
                './agents/': '../../src/agents/',
                './database/': '../../src/database/',
                './core/': '../../src/core/',
                './context-management/': '../../src/context-management/',
                '../services/': '../../src/services/',
                '../agents/': '../../src/agents/',
                '../../database/': '../../src/database/',
                './universal-context-commands': '../../src/context-management/universal-context-commands',
                '../context-management/factor3-context-manager': '../../src/context-management/factor3-context-manager'
            },
            // From tests/phase-tests/ (one level up, then to src/)
            'phase-tests': {
                './services/': '../../src/services/',
                './agents/': '../../src/agents/',
                './database/': '../../src/database/',
                './core/': '../../src/core/',
                './middleware/': '../../middleware/',
                '../services/': '../../src/services/',
                '../agents/': '../../src/agents/'
            }
        };

        const mappings = importMappings[testCategory] || {};

        for (const [pattern, replacement] of Object.entries(mappings)) {
            if (originalImport.startsWith(pattern)) {
                return originalImport.replace(pattern, replacement);
            }
        }

        // No mapping found
        return null;
    }

    /**
     * Fix imports in a single file
     */
    fixFileImports(testFile) {
        const content = fs.readFileSync(testFile, 'utf8');
        let newContent = content;
        const fixes = [];

        // Match require statements
        const requirePattern = /require\(['"]([^'"]+)['"]\)/g;
        let match;

        while ((match = requirePattern.exec(content)) !== null) {
            const originalImport = match[1];

            // Skip node modules and already correct paths
            if (!originalImport.startsWith('.')) continue;
            if (originalImport.includes('../../src/')) continue;

            const correctedImport = this.getCorrectImportPath(testFile, originalImport);

            if (correctedImport && correctedImport !== originalImport) {
                // Replace in content
                const originalRequire = `require('${originalImport}')`;
                const correctedRequire = `require('${correctedImport}')`;

                newContent = newContent.replace(originalRequire, correctedRequire);

                fixes.push({
                    original: originalImport,
                    corrected: correctedImport
                });
            }
        }

        return { newContent, fixes };
    }

    /**
     * Fix all test files
     */
    fixAllTests() {
        const testDirs = [
            path.join(process.cwd(), 'tests', 'unit'),
            path.join(process.cwd(), 'tests', 'integration'),
            path.join(process.cwd(), 'tests', 'phase-tests')
        ];

        console.log('🔧 Fixing Test Import Paths...\n');

        if (this.dryRun) {
            console.log('🏃 DRY RUN MODE - No files will be modified\n');
        }

        let totalFixed = 0;

        for (const dir of testDirs) {
            if (!fs.existsSync(dir)) continue;

            const files = fs.readdirSync(dir)
                .filter(f => f.endsWith('.js'))
                .map(f => path.join(dir, f));

            for (const file of files) {
                const { newContent, fixes } = this.fixFileImports(file);

                if (fixes.length > 0) {
                    const relativePath = path.relative(process.cwd(), file);

                    console.log(`📝 ${relativePath}`);
                    fixes.forEach(fix => {
                        console.log(`   ${fix.original}`);
                        console.log(`   → ${fix.corrected}`);
                    });
                    console.log('');

                    this.fixes.push({
                        file: relativePath,
                        fixes
                    });

                    // Write changes if not dry run
                    if (!this.dryRun) {
                        fs.writeFileSync(file, newContent, 'utf8');
                    }

                    totalFixed += fixes.length;
                }
            }
        }

        return totalFixed;
    }

    /**
     * Print summary
     */
    printSummary(totalFixed) {
        console.log('═'.repeat(60));
        console.log('  FIX SUMMARY');
        console.log('═'.repeat(60) + '\n');

        console.log(`📊 Total fixes applied: ${totalFixed}`);
        console.log(`📁 Files modified: ${this.fixes.length}\n`);

        if (this.dryRun) {
            console.log('⚠️  This was a DRY RUN - no files were actually modified');
            console.log('   Run without --dry-run to apply fixes\n');
        } else {
            console.log('✅ All import paths have been fixed');
            console.log('   Run: node scripts/validate-tests.js to verify\n');
        }
    }
}

// Main execution
async function main() {
    const dryRun = process.argv.includes('--dry-run');

    const fixer = new TestImportFixer(dryRun);
    const totalFixed = fixer.fixAllTests();
    fixer.printSummary(totalFixed);
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fix failed:', error.message);
        process.exit(1);
    });
}

module.exports = { TestImportFixer };