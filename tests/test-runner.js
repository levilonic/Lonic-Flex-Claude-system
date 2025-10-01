#!/usr/bin/env node

/**
 * Unified Test Runner - LonicFLex System
 *
 * Purpose: Single command to run all tests with proper reporting
 * Usage: node tests/test-runner.js [--category=<smoke|unit|integration|all>]
 *
 * Design Principles:
 * 1. Fail fast - Stop on first critical failure
 * 2. Clear output - Show progress and failures clearly
 * 3. Exit codes - 0 for success, 1 for failure (CI/CD compatible)
 * 4. Timing - Report execution time for each suite
 * 5. Isolation - Each test runs in clean environment
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
    constructor() {
        this.results = {
            suites: [],
            totalPassed: 0,
            totalFailed: 0,
            totalSkipped: 0,
            startTime: Date.now()
        };

        // Test suites organized by priority and category
        this.suites = {
            smoke: [
                {
                    name: 'Core System Smoke',
                    file: 'test-core-system.js',
                    timeout: 30000,
                    critical: true,
                    description: 'Validates core command execution works'
                },
                {
                    name: 'Basic Module Loading',
                    file: 'src/smoke.js',
                    timeout: 10000,
                    critical: true,
                    description: 'Verifies essential modules load without errors'
                }
            ],

            unit: [
                {
                    name: 'Service Container',
                    file: 'tests/unit/test-service-container.js',
                    timeout: 30000,
                    critical: true,
                    description: 'Tests dependency injection foundation'
                },
                {
                    name: 'Base Agent',
                    file: 'tests/unit/test-base-agent.js',
                    timeout: 30000,
                    critical: true,
                    description: 'Tests agent foundation and lifecycle'
                },
                {
                    name: 'Database Isolation',
                    file: 'tests/unit/test-database-isolation.js',
                    timeout: 30000,
                    critical: true,
                    description: 'Tests database concurrent access safety'
                },
                {
                    name: 'Agent Null Safety',
                    file: 'tests/unit/test-agent-null-safety.js',
                    timeout: 20000,
                    critical: false,
                    description: 'Tests agent error handling'
                },
                {
                    name: 'Unified Commands',
                    file: 'tests/unit/test-unified-commands.js',
                    timeout: 20000,
                    critical: false,
                    description: 'Tests command registry system'
                }
            ],

            integration: [
                {
                    name: 'Universal Context System',
                    file: 'tests/integration/test-universal-context.js',
                    timeout: 45000,
                    critical: true,
                    description: 'Tests context preservation across sessions'
                },
                {
                    name: 'Database Integration',
                    file: 'tests/integration/test-database-integration.js',
                    timeout: 45000,
                    critical: true,
                    description: 'Tests database operations end-to-end'
                },
                {
                    name: 'Service Container Integration',
                    file: 'tests/integration/test-service-container-integration.js',
                    timeout: 45000,
                    critical: true,
                    description: 'Tests service initialization and coordination'
                },
                {
                    name: 'Phase 3A External Integration',
                    file: 'tests/phase-tests/test-phase3a-integration.js',
                    timeout: 45000,
                    critical: false,
                    description: 'Tests GitHub and Slack integration framework'
                },
                {
                    name: 'Multi-Agent Coordination',
                    file: 'tests/integration/test-multi-agent-integration.js',
                    timeout: 60000,
                    critical: false,
                    description: 'Tests multiple agents working together'
                }
            ],

            e2e: [
                {
                    name: 'PR Review Workflow',
                    file: 'tests/real/pr-review-integration.test.js',
                    timeout: 60000,
                    critical: false,
                    skipIfNoToken: 'GITHUB_TOKEN',
                    description: 'Tests end-to-end PR review with real GitHub API'
                }
            ]
        };
    }

    /**
     * Run a single test suite
     */
    async runSuite(suite) {
        const filePath = suite.file.startsWith('tests/')
            ? path.join(process.cwd(), suite.file)
            : path.join(process.cwd(), suite.file);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return {
                name: suite.name,
                status: 'skipped',
                reason: 'File not found',
                duration: 0
            };
        }

        // Check if should skip due to missing env vars
        if (suite.skipIfNoToken && !process.env[suite.skipIfNoToken]) {
            return {
                name: suite.name,
                status: 'skipped',
                reason: `Missing ${suite.skipIfNoToken}`,
                duration: 0
            };
        }

        const startTime = Date.now();

        return new Promise((resolve) => {
            console.log(`\n▶️  Running: ${suite.name}`);
            console.log(`   ${suite.description}`);

            const testProcess = exec(`node "${filePath}"`, {
                timeout: suite.timeout,
                env: {
                    ...process.env,
                    NODE_ENV: 'test',
                    TEST_DB_PATH: ':memory:' // Use in-memory DB for tests
                }
            });

            let stdout = '';
            let stderr = '';

            testProcess.stdout?.on('data', (data) => {
                stdout += data;
                // Show real-time output for critical tests
                if (suite.critical) {
                    process.stdout.write(data);
                }
            });

            testProcess.stderr?.on('data', (data) => {
                stderr += data;
            });

            testProcess.on('close', (code) => {
                const duration = Date.now() - startTime;

                if (code === 0) {
                    console.log(`✅ PASS: ${suite.name} (${duration}ms)`);
                    resolve({
                        name: suite.name,
                        status: 'passed',
                        duration,
                        stdout
                    });
                } else {
                    console.log(`❌ FAIL: ${suite.name} (${duration}ms)`);
                    if (stderr) console.error(`   Error: ${stderr.substring(0, 200)}...`);
                    resolve({
                        name: suite.name,
                        status: 'failed',
                        duration,
                        stdout,
                        stderr,
                        exitCode: code
                    });
                }
            });

            testProcess.on('error', (error) => {
                const duration = Date.now() - startTime;
                console.log(`❌ ERROR: ${suite.name} - ${error.message}`);
                resolve({
                    name: suite.name,
                    status: 'failed',
                    duration,
                    error: error.message
                });
            });
        });
    }

    /**
     * Run test suites by category
     */
    async runCategory(category) {
        const suites = this.suites[category];
        if (!suites) {
            console.error(`❌ Unknown test category: ${category}`);
            return false;
        }

        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  ${category.toUpperCase()} TESTS`);
        console.log(`${'═'.repeat(60)}`);
        console.log(`Running ${suites.length} test suites...\n`);

        for (const suite of suites) {
            const result = await this.runSuite(suite);
            this.results.suites.push(result);

            if (result.status === 'passed') {
                this.results.totalPassed++;
            } else if (result.status === 'failed') {
                this.results.totalFailed++;

                // Fail fast for critical tests
                if (suite.critical) {
                    console.log(`\n🚨 CRITICAL TEST FAILED - Stopping execution`);
                    return false;
                }
            } else if (result.status === 'skipped') {
                this.results.totalSkipped++;
            }
        }

        return this.results.totalFailed === 0;
    }

    /**
     * Run all test categories
     */
    async runAll() {
        const categories = ['smoke', 'unit', 'integration'];

        for (const category of categories) {
            const success = await this.runCategory(category);
            if (!success) {
                console.log(`\n⚠️  ${category} tests failed - skipping remaining categories`);
                break;
            }
        }
    }

    /**
     * Print final report
     */
    printReport() {
        const duration = Date.now() - this.results.startTime;

        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  TEST RESULTS`);
        console.log(`${'═'.repeat(60)}\n`);

        console.log(`✅ Passed:  ${this.results.totalPassed}`);
        console.log(`❌ Failed:  ${this.results.totalFailed}`);
        console.log(`⏭️  Skipped: ${this.results.totalSkipped}`);
        console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s\n`);

        if (this.results.totalFailed > 0) {
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`  FAILURES`);
            console.log(`${'─'.repeat(60)}\n`);

            this.results.suites
                .filter(s => s.status === 'failed')
                .forEach(suite => {
                    console.log(`❌ ${suite.name}`);
                    if (suite.stderr) {
                        console.log(`   ${suite.stderr.substring(0, 300)}...`);
                    }
                    if (suite.error) {
                        console.log(`   Error: ${suite.error}`);
                    }
                    console.log();
                });
        }

        const successRate = this.results.totalPassed /
            (this.results.totalPassed + this.results.totalFailed) * 100;

        console.log(`${'═'.repeat(60)}`);
        if (this.results.totalFailed === 0) {
            console.log(`🎉 ALL TESTS PASSED (${successRate.toFixed(1)}%)`);
        } else {
            console.log(`💥 TESTS FAILED (${successRate.toFixed(1)}% pass rate)`);
        }
        console.log(`${'═'.repeat(60)}\n`);
    }

    /**
     * Get exit code for CI/CD
     */
    getExitCode() {
        return this.results.totalFailed === 0 ? 0 : 1;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const categoryArg = args.find(arg => arg.startsWith('--category='));
    const category = categoryArg ? categoryArg.split('=')[1] : 'all';

    console.log(`\n🧪 LonicFLex Test Runner`);
    console.log(`${'═'.repeat(60)}\n`);

    const runner = new TestRunner();

    if (category === 'all') {
        await runner.runAll();
    } else {
        await runner.runCategory(category);
    }

    runner.printReport();
    process.exit(runner.getExitCode());
}

if (require.main === module) {
    main().catch(error => {
        console.error('\n💥 Test runner crashed:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
}

module.exports = { TestRunner };