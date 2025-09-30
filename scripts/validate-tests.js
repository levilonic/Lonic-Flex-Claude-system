#!/usr/bin/env node

/**
 * Test Validator
 *
 * Purpose: Systematically validate all test files
 * - Check imports resolve correctly
 * - Check if tests can at least load
 * - Categorize by status: working/broken/needs-fix
 *
 * Usage: node scripts/validate-tests.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestValidator {
    constructor() {
        this.results = {
            working: [],
            broken: [],
            skipped: []
        };
    }

    /**
     * Try to run a test with timeout
     */
    async validateTest(testFile) {
        return new Promise((resolve) => {
            const timeout = 10000; // 10 seconds

            const testProcess = exec(`node "${testFile}"`, { timeout });

            let stdout = '';
            let stderr = '';

            testProcess.stdout?.on('data', (data) => { stdout += data; });
            testProcess.stderr?.on('data', (data) => { stderr += data; });

            testProcess.on('close', (code) => {
                resolve({
                    file: testFile,
                    exitCode: code,
                    stdout,
                    stderr,
                    status: code === 0 ? 'working' : 'broken'
                });
            });

            testProcess.on('error', (error) => {
                resolve({
                    file: testFile,
                    exitCode: -1,
                    error: error.message,
                    status: 'broken'
                });
            });
        });
    }

    /**
     * Find all test files
     */
    findTestFiles() {
        const testDirs = [
            'tests/unit',
            'tests/integration',
            'tests/phase-tests'
        ];

        const testFiles = [];

        for (const dir of testDirs) {
            const dirPath = path.join(process.cwd(), dir);
            if (!fs.existsSync(dirPath)) continue;

            const files = fs.readdirSync(dirPath)
                .filter(f => f.endsWith('.js'))
                .map(f => path.join(dirPath, f));

            testFiles.push(...files);
        }

        return testFiles;
    }

    /**
     * Check if test has import errors without running it
     */
    checkImports(testFile) {
        const content = fs.readFileSync(testFile, 'utf8');
        const requirePattern = /require\(['"]([^'"]+)['"]\)/g;

        const imports = [];
        let match;

        while ((match = requirePattern.exec(content)) !== null) {
            imports.push(match[1]);
        }

        const errors = [];
        const testDir = path.dirname(testFile);

        for (const imp of imports) {
            // Skip node modules
            if (!imp.startsWith('.')) continue;

            // Resolve relative path
            const resolvedPath = path.resolve(testDir, imp);
            const possiblePaths = [
                resolvedPath,
                resolvedPath + '.js',
                path.join(resolvedPath, 'index.js')
            ];

            const exists = possiblePaths.some(p => fs.existsSync(p));

            if (!exists) {
                errors.push({
                    import: imp,
                    message: `Cannot resolve: ${imp}`
                });
            }
        }

        return { imports, errors };
    }

    /**
     * Run validation on all tests
     */
    async runValidation() {
        console.log('🔍 Validating All Test Files...\n');

        const testFiles = this.findTestFiles();
        console.log(`Found ${testFiles.length} test files\n`);

        for (const testFile of testFiles) {
            const fileName = path.relative(process.cwd(), testFile);
            process.stdout.write(`Testing ${fileName}... `);

            // First check imports
            const { errors } = this.checkImports(testFile);

            if (errors.length > 0) {
                console.log('❌ Import errors');
                this.results.broken.push({
                    file: fileName,
                    reason: 'import_errors',
                    errors
                });
                continue;
            }

            // Try to run test
            const result = await this.validateTest(testFile);

            if (result.status === 'working') {
                console.log('✅ Working');
                this.results.working.push({
                    file: fileName,
                    exitCode: result.exitCode
                });
            } else {
                console.log('❌ Failed');

                // Extract error message
                let errorMsg = '';
                if (result.stderr) {
                    const lines = result.stderr.split('\n');
                    errorMsg = lines.find(l => l.includes('Error:')) || lines[0];
                } else if (result.error) {
                    errorMsg = result.error;
                }

                this.results.broken.push({
                    file: fileName,
                    reason: 'execution_failed',
                    exitCode: result.exitCode,
                    error: errorMsg.substring(0, 200)
                });
            }
        }
    }

    /**
     * Print validation report
     */
    printReport() {
        const total = this.results.working.length +
                     this.results.broken.length +
                     this.results.skipped.length;

        console.log('\n' + '═'.repeat(60));
        console.log('  VALIDATION REPORT');
        console.log('═'.repeat(60) + '\n');

        console.log(`✅ Working: ${this.results.working.length}/${total}`);
        console.log(`❌ Broken:  ${this.results.broken.length}/${total}`);
        console.log(`⏭️  Skipped: ${this.results.skipped.length}/${total}\n`);

        if (this.results.working.length > 0) {
            console.log('─'.repeat(60));
            console.log('✅ WORKING TESTS');
            console.log('─'.repeat(60));
            this.results.working.forEach(t => {
                console.log(`  ✅ ${t.file}`);
            });
            console.log('');
        }

        if (this.results.broken.length > 0) {
            console.log('─'.repeat(60));
            console.log('❌ BROKEN TESTS');
            console.log('─'.repeat(60));
            this.results.broken.forEach(t => {
                console.log(`  ❌ ${t.file}`);
                console.log(`     Reason: ${t.reason}`);

                if (t.errors && t.errors.length > 0) {
                    t.errors.forEach(e => {
                        console.log(`       - ${e.message}`);
                    });
                } else if (t.error) {
                    console.log(`       ${t.error}`);
                }
                console.log('');
            });
        }

        // Write report to file
        fs.writeFileSync(
            'test-validation-report.json',
            JSON.stringify(this.results, null, 2)
        );

        console.log('📄 Full report saved to: test-validation-report.json\n');

        const successRate = (this.results.working.length / total * 100).toFixed(1);
        console.log('═'.repeat(60));
        console.log(`📊 Success Rate: ${successRate}%`);
        console.log('═'.repeat(60) + '\n');
    }
}

// Main execution
async function main() {
    const validator = new TestValidator();
    await validator.runValidation();
    validator.printReport();
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    });
}

module.exports = { TestValidator };