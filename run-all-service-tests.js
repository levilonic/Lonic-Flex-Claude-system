#!/usr/bin/env node
/**
 * Run all service tests and aggregate results
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, 'tests', 'services');
const testFiles = fs.readdirSync(testsDir).filter(f => f.startsWith('test-') && f.endsWith('.js'));

console.log('🧪 Running All Service Tests\n');
console.log(`Found ${testFiles.length} service test files\n`);

const results = {
    total: testFiles.length,
    passed: 0,
    failed: 0,
    services: []
};

for (const testFile of testFiles) {
    const serviceName = testFile.replace('test-', '').replace('-service.js', '');
    process.stdout.write(`Testing ${serviceName}... `);

    try {
        execSync(`node ${path.join(testsDir, testFile)}`, {
            stdio: 'pipe',
            encoding: 'utf8'
        });
        console.log('✅ PASS');
        results.passed++;
        results.services.push({ name: serviceName, status: 'PASS' });
    } catch (error) {
        console.log('❌ FAIL');
        results.failed++;
        results.services.push({
            name: serviceName,
            status: 'FAIL',
            error: error.stdout || error.message
        });
    }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 All Services Test Results');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Passed: ${results.passed}/${results.total}`);
console.log(`❌ Failed: ${results.failed}/${results.total}`);
console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

if (results.failed > 0) {
    console.log('\n❌ Failed Services:');
    results.services.filter(s => s.status === 'FAIL').forEach(({ name, error }) => {
        console.log(`\n   ${name}:`);
        console.log(`   ${error.split('\n')[0]}`);
    });
    console.log('\n');
    process.exit(1);
} else {
    console.log('\n✅ All service tests passed!\n');
    process.exit(0);
}
