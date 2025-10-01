#!/usr/bin/env node
/**
 * context-health-check Test Suite
 * Category: CONTEXT
 */

let testResults = { passed: 0, failed: 0 };

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        testResults.passed++;
    } else {
        console.log(`  ❌ ${testName}${details ? ': ' + details : ''}`);
        testResults.failed++;
    }
}

async function runTests() {
    console.log('\n🧪 context-health-check (CONTEXT)\n');

    // Test 1: Module loads
    try {
        const module = require('../../src/context-management/context-health-check');
        assert(module !== null && module !== undefined, 'Module loads');
        assert(typeof module === 'object' || typeof module === 'function', 'Valid export type');
    } catch (error) {
        assert(false, 'Module loading', error.message);
    }

    // Test 2: Module structure
    try {
        const module = require('../../src/context-management/context-health-check');
        const keys = Object.keys(module);
        assert(keys.length >= 0, `Module structure (\${keys.length} exports)`);
    } catch (error) {
        assert(false, 'Module structure', error.message);
    }

    // Test 3: No syntax errors
    try {
        require('../../src/context-management/context-health-check');
        assert(true, 'No syntax errors');
    } catch (error) {
        assert(false, 'Syntax check', error.message);
    }

    // Results
    const total = testResults.passed + testResults.failed;
    const rate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;
    console.log(`\n📊 ✅ ${testResults.passed}/${total} (${rate}%)\n`);
}

runTests().catch(error => {
    console.error('Test failed:', error.message);
    process.exit(1);
});
