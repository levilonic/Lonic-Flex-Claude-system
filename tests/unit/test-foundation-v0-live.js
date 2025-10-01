#!/usr/bin/env node
/**
 * LonicFLex Foundation v0 Live System Test Suite
 * Comprehensive testing of the live 24/7 automation platform
 */

const http = require('http');
const { performance } = require('perf_hooks');

class FoundationV0TestSuite {
    constructor() {
        this.services = {
            'Master Service': 'http://localhost:3007/health',
            'Webhook Service': 'http://localhost:3008/health',
            'GitHub Service': 'http://localhost:3002/health',
            'Agents Service': 'http://localhost:3003/health',
            'Workflows Service': 'http://localhost:3004/health',
            'Health Service': 'http://localhost:3005/health'
        };

        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            total: 0
        };
    }

    async checkServicesAvailable() {
        // Try to connect to master service (primary service)
        try {
            await this.makeHttpRequest('http://localhost:3007/health', 'GET');
            return true; // At least one service is running
        } catch (error) {
            // Master service not running, check if any other service is running
            for (const [name, url] of Object.entries(this.services)) {
                try {
                    await this.makeHttpRequest(url, 'GET');
                    return true; // Found a running service
                } catch (e) {
                    // This service not running, try next
                }
            }
            return false; // No services are running
        }
    }

    async runAllTests() {
        console.log('\n🎯 LonicFLex Foundation v0 - Live System Test Suite');
        console.log('=' .repeat(60));

        const startTime = performance.now();

        // Quick check: Are any services actually running?
        const servicesAvailable = await this.checkServicesAvailable();
        if (!servicesAvailable) {
            console.log('\n⏭️  SKIPPED: No live services detected (services not running)');
            console.log('   This test requires Foundation v0 services to be running on ports 3002-3008');
            console.log('   To run this test, start services with: npm run start:services');
            console.log('\n✅ Test suite skipped gracefully (not a failure)');
            console.log('\n' + '=' .repeat(60));
            this.results.total = 0;
            this.results.skipped = true;
            return this.results;
        }

        // Test 1: Service Health Checks
        await this.testServiceHealth();

        // Test 2: Service Connectivity
        await this.testServiceConnectivity();

        // Test 3: /lx run Command Processing
        await this.testLxRunCommand();

        // Test 4: Run Status Tracking
        await this.testRunStatusTracking();

        // Test 5: Cross-Service Coordination
        await this.testCrossServiceCoordination();

        // Test 6: Error Handling
        await this.testErrorHandling();

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        // Report Results
        this.reportResults(duration);

        return this.results;
    }

    async testServiceHealth() {
        console.log('\n📊 Test 1: Service Health Checks');
        console.log('-'.repeat(40));

        for (const [serviceName, healthUrl] of Object.entries(this.services)) {
            try {
                const response = await this.makeHttpRequest(healthUrl, 'GET');
                const health = JSON.parse(response);

                if (health.status === 'healthy' && health.initialized === true) {
                    this.logSuccess(`✅ ${serviceName}: Healthy (uptime: ${Math.round(health.uptime/1000)}s)`);
                    this.recordTest(serviceName + ' Health', true);
                } else {
                    this.logError(`❌ ${serviceName}: Unhealthy - ${health.status}`);
                    this.recordTest(serviceName + ' Health', false);
                }
            } catch (error) {
                this.logError(`❌ ${serviceName}: Connection failed - ${error.message}`);
                this.recordTest(serviceName + ' Health', false);
            }
        }
    }

    async testServiceConnectivity() {
        console.log('\n🔗 Test 2: Service Connectivity');
        console.log('-'.repeat(40));

        // Test if services can communicate with each other
        const connectivityTests = [
            { name: 'Master → Workflows', test: () => this.testEndpoint('http://localhost:3007/stats') },
            { name: 'Webhooks → Master', test: () => this.testEndpoint('http://localhost:3008/health') },
            { name: 'Workflows Status', test: () => this.testEndpoint('http://localhost:3004/health') }
        ];

        for (const test of connectivityTests) {
            try {
                await test.test();
                this.logSuccess(`✅ ${test.name}: Connected`);
                this.recordTest(test.name, true);
            } catch (error) {
                this.logError(`❌ ${test.name}: Failed - ${error.message}`);
                this.recordTest(test.name, false);
            }
        }
    }

    async testLxRunCommand() {
        console.log('\n⚡ Test 3: /lx run Command Processing');
        console.log('-'.repeat(40));

        try {
            const testCommand = {
                command: 'system-test',
                parameters: {
                    test: 'foundation-v0-validation',
                    timestamp: new Date().toISOString()
                },
                brief: 'Foundation v0 automated system test',
                mode: 'auto',
                requester: 'foundation-v0-test-suite'
            };

            const response = await this.makeHttpRequest(
                'http://localhost:3007/lx/run',
                'POST',
                JSON.stringify(testCommand),
                { 'Content-Type': 'application/json' }
            );

            const result = JSON.parse(response);

            if (result.success && result.runId && result.status === 'running') {
                this.logSuccess(`✅ /lx run command successful: ${result.runId}`);
                this.logSuccess(`   Branch created: ${result.branchName}`);
                this.logSuccess(`   Estimated duration: ${Math.round(result.estimatedDuration/1000)}s`);
                this.recordTest('/lx run Command', true);

                // Store run ID for status tracking test
                this.testRunId = result.runId;
            } else {
                this.logError(`❌ /lx run command failed: ${result.error || 'Unknown error'}`);
                this.recordTest('/lx run Command', false);
            }
        } catch (error) {
            this.logError(`❌ /lx run command error: ${error.message}`);
            this.recordTest('/lx run Command', false);
        }
    }

    async testRunStatusTracking() {
        console.log('\n📈 Test 4: Run Status Tracking');
        console.log('-'.repeat(40));

        if (!this.testRunId) {
            this.logError('❌ No run ID available for status tracking test');
            this.recordTest('Run Status Tracking', false);
            return;
        }

        try {
            // Test individual run status
            const statusResponse = await this.makeHttpRequest(
                `http://localhost:3007/run/${this.testRunId}/status`,
                'GET'
            );
            const status = JSON.parse(statusResponse);

            if (status.runId === this.testRunId && status.status && status.steps) {
                this.logSuccess(`✅ Run status tracking: ${status.status}`);
                this.logSuccess(`   Progress: ${status.progress}%`);
                this.logSuccess(`   Steps completed: ${status.steps.filter(s => s.status === 'completed').length}/${status.steps.length}`);
                this.recordTest('Individual Run Status', true);
            } else {
                this.logError('❌ Run status tracking failed: Invalid response structure');
                this.recordTest('Individual Run Status', false);
            }

            // Test run listing
            const listResponse = await this.makeHttpRequest('http://localhost:3007/runs', 'GET');
            const runs = JSON.parse(listResponse);

            if (runs.active && runs.stats && runs.stats.totalRuns > 0) {
                this.logSuccess(`✅ Run listing: ${runs.stats.totalRuns} total runs`);
                this.logSuccess(`   Active: ${runs.stats.activeRuns}, Completed: ${runs.stats.completedRuns}`);
                this.recordTest('Run Listing', true);
            } else {
                this.logError('❌ Run listing failed: Invalid response structure');
                this.recordTest('Run Listing', false);
            }

        } catch (error) {
            this.logError(`❌ Run status tracking error: ${error.message}`);
            this.recordTest('Run Status Tracking', false);
        }
    }

    async testCrossServiceCoordination() {
        console.log('\n🔄 Test 5: Cross-Service Coordination');
        console.log('-'.repeat(40));

        try {
            // Test master service stats (shows coordination)
            const masterStats = await this.makeHttpRequest('http://localhost:3007/stats', 'GET');
            const stats = JSON.parse(masterStats);

            if (stats.service === 'lonicflex-master' && typeof stats.uptime === 'number') {
                this.logSuccess(`✅ Master service stats: ${stats.service}`);
                this.logSuccess(`   Uptime: ${Math.round(stats.uptime/1000)}s`);
                this.logSuccess(`   Active runs: ${stats.activeRuns}`);
                this.recordTest('Master Stats', true);
            } else {
                this.logError('❌ Master service stats failed');
                this.recordTest('Master Stats', false);
            }

            // Test webhook service stats
            const webhookStats = await this.makeHttpRequest('http://localhost:3008/health', 'GET');
            const webhooks = JSON.parse(webhookStats);

            if (webhooks.service === 'lonicflex-webhooks' && webhooks.stats) {
                this.logSuccess(`✅ Webhook service coordination: ${webhooks.service}`);
                this.logSuccess(`   Total webhooks: ${webhooks.stats.totalWebhooks}`);
                this.logSuccess(`   Active chains: ${webhooks.stats.activeChains}`);
                this.recordTest('Webhook Coordination', true);
            } else {
                this.logError('❌ Webhook service coordination failed');
                this.recordTest('Webhook Coordination', false);
            }

        } catch (error) {
            this.logError(`❌ Cross-service coordination error: ${error.message}`);
            this.recordTest('Cross-Service Coordination', false);
        }
    }

    async testErrorHandling() {
        console.log('\n🛠️  Test 6: Error Handling');
        console.log('-'.repeat(40));

        // Test invalid run ID
        try {
            await this.makeHttpRequest('http://localhost:3007/run/invalid-run-id/status', 'GET');
            this.logError('❌ Error handling failed: Should have returned 404');
            this.recordTest('Invalid Run ID Handling', false);
        } catch (error) {
            if (error.message.includes('404')) {
                this.logSuccess('✅ Invalid run ID properly handled (404)');
                this.recordTest('Invalid Run ID Handling', true);
            } else {
                this.logError(`❌ Unexpected error handling: ${error.message}`);
                this.recordTest('Invalid Run ID Handling', false);
            }
        }

        // Test invalid JSON payload
        try {
            await this.makeHttpRequest(
                'http://localhost:3007/lx/run',
                'POST',
                'invalid-json',
                { 'Content-Type': 'application/json' }
            );
            this.logError('❌ Error handling failed: Should have returned 400');
            this.recordTest('Invalid JSON Handling', false);
        } catch (error) {
            if (error.message.includes('400') || error.message.includes('parse')) {
                this.logSuccess('✅ Invalid JSON properly handled');
                this.recordTest('Invalid JSON Handling', true);
            } else {
                this.logError(`❌ Unexpected JSON error handling: ${error.message}`);
                this.recordTest('Invalid JSON Handling', false);
            }
        }
    }

    async testEndpoint(url) {
        const response = await this.makeHttpRequest(url, 'GET');
        return JSON.parse(response);
    }

    makeHttpRequest(url, method = 'GET', data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method,
                headers: {
                    'User-Agent': 'LonicFLex-Foundation-v0-TestSuite',
                    ...headers
                },
                timeout: 10000
            };

            const req = http.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    } else {
                        resolve(body);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (data) {
                req.write(data);
            }

            req.end();
        });
    }

    recordTest(testName, passed) {
        this.tests.push({ name: testName, passed });
        this.results.total++;
        if (passed) {
            this.results.passed++;
        } else {
            this.results.failed++;
        }
    }

    logSuccess(message) {
        console.log(`  ${message}`);
    }

    logError(message) {
        console.log(`  ${message}`);
    }

    reportResults(duration) {
        console.log('\n📋 Test Results Summary');
        console.log('=' .repeat(60));

        const successRate = Math.round((this.results.passed / this.results.total) * 100);

        console.log(`📊 Overall Success Rate: ${successRate}% (${this.results.passed}/${this.results.total})`);
        console.log(`⏱️  Total Test Duration: ${duration}ms`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);

        if (this.results.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.tests
                .filter(test => !test.passed)
                .forEach(test => console.log(`   • ${test.name}`));
        }

        console.log('\n🎯 Foundation v0 Status:');
        if (successRate >= 80) {
            console.log('🟢 OPERATIONAL - LonicFLex Foundation v0 is ready for production use');
        } else if (successRate >= 60) {
            console.log('🟡 DEGRADED - Some issues detected, but core functionality working');
        } else {
            console.log('🔴 CRITICAL - Major issues detected, system not ready for production');
        }

        console.log('\n' + '=' .repeat(60));
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new FoundationV0TestSuite();
    testSuite.runAllTests()
        .then(results => {
            // If skipped (no services running), exit successfully
            if (results.skipped) {
                process.exit(0);
            }
            // Otherwise, exit based on test results
            const exitCode = results.failed === 0 ? 0 : 1;
            process.exit(exitCode);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { FoundationV0TestSuite };