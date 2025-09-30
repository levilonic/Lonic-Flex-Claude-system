#!/usr/bin/env node

/**
 * Documentation Verification System
 *
 * Tests ACTUAL claims made in documentation files.
 * No bullshit - either it works or it doesn't.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DocVerifier {
    constructor() {
        this.results = {
            passed: [],
            failed: [],
            warnings: []
        };
    }

    /**
     * Execute command and capture result
     */
    runCommand(cmd, timeout = 30000) {
        try {
            const output = execSync(cmd, {
                timeout,
                encoding: 'utf8',
                stdio: 'pipe'
            });
            return { success: true, output };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                output: error.stdout || error.stderr || ''
            };
        }
    }

    /**
     * Check if file exists
     */
    fileExists(filepath) {
        try {
            return fs.existsSync(filepath);
        } catch {
            return false;
        }
    }

    /**
     * Check if string exists in file
     */
    fileContains(filepath, searchString) {
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            return content.includes(searchString);
        } catch {
            return false;
        }
    }

    /**
     * Verify README.md claims
     */
    verifyReadme() {
        console.log('\n━━━ Verifying README.md ━━━\n');

        // Test: npm run test:core
        console.log('Testing: npm run test:core');
        const testCore = this.runCommand('npm run test:core');
        if (testCore.success && testCore.output.includes('All core system tests passed')) {
            this.results.passed.push('npm run test:core - VERIFIED');
            console.log('✅ PASS: npm run test:core works');
        } else {
            this.results.failed.push('npm run test:core - FAILED');
            console.log('❌ FAIL: npm run test:core');
        }

        // Test: npm run core system:health
        console.log('\nTesting: npm run core system:health');
        const systemHealth = this.runCommand('npm run core system:health');
        if (systemHealth.success && systemHealth.output.includes('healthy')) {
            this.results.passed.push('npm run core system:health - VERIFIED');
            console.log('✅ PASS: system:health works');
        } else {
            this.results.failed.push('npm run core system:health - FAILED');
            console.log('❌ FAIL: system:health');
        }

        // Test: npm run demo
        console.log('\nTesting: npm run demo');
        const demo = this.runCommand('npm run demo');
        if (demo.success && demo.output.includes('Demo complete')) {
            this.results.passed.push('npm run demo - VERIFIED');
            console.log('✅ PASS: demo works');
        } else {
            this.results.failed.push('npm run demo - FAILED');
            console.log('❌ FAIL: demo');
        }

        // Verify claimed files exist
        const claimedFiles = [
            'src/database/sqlite-manager.js',
            'src/context-management/factor3-context-manager.js',
            'src/agents/base-agent.js',
            'src/core/command-executor.js'
        ];

        console.log('\nVerifying claimed files exist:');
        for (const file of claimedFiles) {
            if (this.fileExists(file)) {
                this.results.passed.push(`File exists: ${file}`);
                console.log(`✅ EXISTS: ${file}`);
            } else {
                this.results.failed.push(`File missing: ${file}`);
                console.log(`❌ MISSING: ${file}`);
            }
        }

        // Check for claims about "Fully Functional" systems
        console.log('\nVerifying "Fully Functional" claims:');

        // SQLite WAL mode claim
        if (this.fileContains('src/database/sqlite-manager.js', 'WAL')) {
            this.results.passed.push('SQLite WAL mode - CODE FOUND');
            console.log('✅ VERIFIED: SQLite WAL mode code exists');
        } else {
            this.results.warnings.push('SQLite WAL mode - CODE NOT VERIFIED');
            console.log('⚠️  WARNING: SQLite WAL mode not verified in code');
        }

        // GitHub integration claim - check for actual files
        const githubFiles = [
            'src/agents/github-agent.js',
            'integrations/github-integration.js'
        ];
        const githubExists = githubFiles.some(f => this.fileExists(f));

        if (githubExists) {
            this.results.passed.push('GitHub integration - FILE EXISTS');
            console.log('✅ VERIFIED: GitHub integration files exist');
        } else {
            this.results.failed.push('GitHub integration - FILE MISSING');
            console.log('❌ FAILED: GitHub integration files missing');
        }
    }

    /**
     * Verify CORE-SYSTEM.md claims
     */
    verifyCoreSystem() {
        console.log('\n━━━ Verifying CORE-SYSTEM.md ━━━\n');

        // Test commands listed in CORE-SYSTEM.md
        const coreCommands = [
            'system:health',
            'system:info',
            'gh:list-prs',
            'db:status'
        ];

        console.log('Testing core commands:');
        for (const cmd of coreCommands) {
            const result = this.runCommand(`npm run core ${cmd}`);
            if (result.success) {
                this.results.passed.push(`Command works: ${cmd}`);
                console.log(`✅ PASS: ${cmd}`);
            } else {
                this.results.failed.push(`Command broken: ${cmd}`);
                console.log(`❌ FAIL: ${cmd}`);
            }
        }

        // Verify claimed file count
        if (this.fileExists('src/core/command-executor.js')) {
            const content = fs.readFileSync('src/core/command-executor.js', 'utf8');
            const lineCount = content.split('\n').length;
            console.log(`\n📊 command-executor.js: ${lineCount} lines (claimed: 273)`);

            if (Math.abs(lineCount - 273) < 50) {
                this.results.passed.push('command-executor.js line count - CLOSE ENOUGH');
            } else {
                this.results.warnings.push(`command-executor.js line count - OFF BY ${Math.abs(lineCount - 273)} lines`);
            }
        }
    }

    /**
     * Verify npm scripts actually work
     */
    verifyNpmScripts() {
        console.log('\n━━━ Verifying npm scripts ━━━\n');

        const scripts = [
            { name: 'context:test', expectOutput: 'Context' },
            { name: 'integration:test', expectOutput: 'test' }
        ];

        console.log('Testing npm scripts from package.json:');
        for (const { name, expectOutput } of scripts) {
            const result = this.runCommand(`npm run ${name}`);
            if (result.success) {
                this.results.passed.push(`npm script works: ${name}`);
                console.log(`✅ PASS: npm run ${name}`);
            } else {
                this.results.failed.push(`npm script broken: ${name}`);
                console.log(`❌ FAIL: npm run ${name}`);
                console.log(`   Error: ${result.error.split('\n')[0]}`);
            }
        }
    }

    /**
     * Verify PROJECT.md claims
     */
    verifyProject() {
        console.log('\n━━━ Verifying PROJECT.md ━━━\n');

        const projectFile = 'PROJECT.md';
        if (!this.fileExists(projectFile)) {
            this.results.failed.push('PROJECT.md - FILE MISSING');
            console.log('❌ PROJECT.md not found');
            return;
        }

        const content = fs.readFileSync(projectFile, 'utf8');

        // Check for test success rate claims
        const testClaims = [
            { claim: '100% success rate', pattern: /100%.*success/i },
            { claim: '28/28 tests', pattern: /28\/28.*test/i },
            { claim: '87.5% success rate', pattern: /87\.5%.*success/i }
        ];

        console.log('Checking test success claims:');
        for (const { claim, pattern } of testClaims) {
            if (pattern.test(content)) {
                this.results.warnings.push(`Found claim: "${claim}" - NEEDS VERIFICATION`);
                console.log(`⚠️  FOUND: "${claim}" - needs real test verification`);
            }
        }

        // Verify claimed reorganization
        console.log('\nVerifying reorganization claims:');
        const expectedDirs = ['src/', 'integrations/', 'tests/', 'config/'];
        for (const dir of expectedDirs) {
            if (this.fileExists(dir)) {
                this.results.passed.push(`Directory exists: ${dir}`);
                console.log(`✅ EXISTS: ${dir}`);
            } else {
                this.results.failed.push(`Directory missing: ${dir}`);
                console.log(`❌ MISSING: ${dir}`);
            }
        }
    }

    /**
     * Generate final report
     */
    generateReport() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 VERIFICATION REPORT');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log(`✅ PASSED: ${this.results.passed.length} verifications`);
        console.log(`❌ FAILED: ${this.results.failed.length} verifications`);
        console.log(`⚠️  WARNINGS: ${this.results.warnings.length} items need attention\n`);

        if (this.results.failed.length > 0) {
            console.log('━━━ FAILURES ━━━');
            this.results.failed.forEach(fail => console.log(`  ❌ ${fail}`));
            console.log('');
        }

        if (this.results.warnings.length > 0) {
            console.log('━━━ WARNINGS ━━━');
            this.results.warnings.forEach(warn => console.log(`  ⚠️  ${warn}`));
            console.log('');
        }

        const accuracy = this.results.passed.length /
            (this.results.passed.length + this.results.failed.length) * 100;

        console.log(`📈 Documentation Accuracy: ${accuracy.toFixed(1)}%\n`);

        if (accuracy < 90) {
            console.log('🚨 CRITICAL: Documentation accuracy below 90%');
            console.log('   Action required: Update documentation to match reality\n');
            process.exit(1);
        } else if (this.results.warnings.length > 5) {
            console.log('⚠️  WARNING: Multiple unverified claims found');
            console.log('   Action recommended: Verify or update claims\n');
            process.exit(0);
        } else {
            console.log('✅ Documentation verification passed!\n');
            process.exit(0);
        }
    }

    /**
     * Run all verifications
     */
    async run() {
        console.log('🔍 LonicFLex Documentation Verification System');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        this.verifyReadme();
        this.verifyCoreSystem();
        this.verifyNpmScripts();
        this.verifyProject();
        this.generateReport();
    }
}

// Run verification
const verifier = new DocVerifier();
verifier.run().catch(error => {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
});