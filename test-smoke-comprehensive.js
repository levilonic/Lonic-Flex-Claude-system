#!/usr/bin/env node

/**
 * Comprehensive Smoke Test
 * Validates that everything claimed in documentation actually works
 */

const { execSync } = require('child_process');
const fs = require('fs');

class ComprehensiveSmokeTest {
    constructor() {
        this.results = {
            passed: [],
            failed: [],
            warnings: []
        };
    }

    log(icon, message) {
        console.log(`${icon} ${message}`);
    }

    run(command, description, timeout = 30000) {
        try {
            const output = execSync(command, {
                timeout,
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.results.passed.push(description);
            this.log('✅', description);
            return { success: true, output };
        } catch (error) {
            this.results.failed.push(description);
            this.log('❌', `${description} - ${error.message.split('\n')[0]}`);
            return { success: false, error: error.message };
        }
    }

    fileExists(path) {
        try {
            return fs.existsSync(path);
        } catch {
            return false;
        }
    }

    async testAllClaims() {
        console.log('🔥 LonicFLex Comprehensive Smoke Test');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Test 1: Documentation verification
        console.log('━━━ Documentation Verification ━━━');
        this.run('npm run verify:docs', 'Documentation accuracy verification');
        console.log('');

        // Test 2: Core system tests
        console.log('━━━ Core System Tests ━━━');
        this.run('npm run test:core', 'Core system functionality');
        this.run('npm run context:test', 'Universal Context System');
        this.run('npm run integration:test', 'Phase 3A External Integration');
        console.log('');

        // Test 3: Commands from README
        console.log('━━━ README Commands ━━━');
        this.run('npm run demo', 'Basic demo');
        this.run('npm run core system:health', 'System health check');
        this.run('npm run core system:info', 'System info');
        this.run('npm run core gh:list-prs', 'GitHub PR listing');
        this.run('npm run core db:status', 'Database status');
        console.log('');

        // Test 4: File existence from README
        console.log('━━━ Core Files ━━━');
        const coreFiles = [
            'src/database/sqlite-manager.js',
            'src/context-management/factor3-context-manager.js',
            'src/agents/base-agent.js',
            'src/core/command-executor.js',
            'verify-docs.js',
            'README.md',
            'PROJECT.md',
            'CORE-SYSTEM.md'
        ];

        for (const file of coreFiles) {
            if (this.fileExists(file)) {
                this.results.passed.push(`File exists: ${file}`);
                this.log('✅', `File exists: ${file}`);
            } else {
                this.results.failed.push(`File missing: ${file}`);
                this.log('❌', `File missing: ${file}`);
            }
        }
        console.log('');

        // Test 5: Agent files
        console.log('━━━ Agent Files ━━━');
        const agents = [
            'src/agents/base-agent.js',
            'src/agents/github-agent.js',
            'src/agents/security-agent.js',
            'src/agents/code-agent.js',
            'src/agents/deploy-agent.js'
        ];

        for (const agent of agents) {
            if (this.fileExists(agent)) {
                this.results.passed.push(`Agent exists: ${agent}`);
                this.log('✅', `Agent exists: ${agent}`);
            } else {
                this.results.failed.push(`Agent missing: ${agent}`);
                this.log('❌', `Agent missing: ${agent}`);
            }
        }
        console.log('');

        // Test 6: Service files (sample)
        console.log('━━━ Service Files ━━━');
        const services = [
            'src/services/logger.js',
            'src/services/github-workflow-manager.js',
            'src/context-management/context-scope-manager.js'
        ];

        for (const service of services) {
            if (this.fileExists(service)) {
                this.results.passed.push(`Service exists: ${service}`);
                this.log('✅', `Service exists: ${service}`);
            } else {
                this.results.failed.push(`Service missing: ${service}`);
                this.log('❌', `Service missing: ${service}`);
            }
        }
        console.log('');

        // Test 7: Database
        console.log('━━━ Database ━━━');
        if (this.fileExists('database.sqlite')) {
            this.results.passed.push('Database file exists');
            this.log('✅', 'Database file exists');
        } else {
            this.results.warnings.push('Database file not created yet (normal for fresh install)');
            this.log('⚠️', 'Database file not created yet');
        }
        console.log('');

        // Test 8: Integration directories
        console.log('━━━ Directory Structure ━━━');
        const dirs = ['src/', 'tests/', 'integrations/', 'config/', 'docs/', 'content/'];
        for (const dir of dirs) {
            if (this.fileExists(dir)) {
                this.results.passed.push(`Directory exists: ${dir}`);
                this.log('✅', `Directory exists: ${dir}`);
            } else {
                this.results.failed.push(`Directory missing: ${dir}`);
                this.log('❌', `Directory missing: ${dir}`);
            }
        }
        console.log('');

        // Generate report
        this.generateReport();
    }

    generateReport() {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 SMOKE TEST REPORT');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log(`✅ PASSED: ${this.results.passed.length} checks`);
        console.log(`❌ FAILED: ${this.results.failed.length} checks`);
        console.log(`⚠️  WARNINGS: ${this.results.warnings.length} items\n`);

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

        const successRate = (this.results.passed.length /
            (this.results.passed.length + this.results.failed.length) * 100).toFixed(1);

        console.log(`📈 Success Rate: ${successRate}%\n`);

        if (this.results.failed.length === 0) {
            console.log('🎉 ALL SMOKE TESTS PASSED!');
            console.log('✅ System is fully operational\n');
            process.exit(0);
        } else {
            console.log('🚨 SMOKE TEST FAILED');
            console.log(`   ${this.results.failed.length} critical issues found\n`);
            process.exit(1);
        }
    }
}

// Run smoke test
const test = new ComprehensiveSmokeTest();
test.testAllClaims().catch(error => {
    console.error('❌ Smoke test crashed:', error.message);
    process.exit(1);
});