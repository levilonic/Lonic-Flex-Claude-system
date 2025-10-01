#!/usr/bin/env node
/**
 * SMOKING TEST: ServiceBase Class
 *
 * PURPOSE: Prove ServiceBase class works before using it in production services
 * NOT: General testing
 * YES: Specific validation that validateSuccess() method exists and works
 *
 * This test SMOKES OUT if ServiceBase is broken before we update 4 services.
 */

const { ServiceBase } = require('./src/services/service-base');

console.log('🧪 SMOKING TEST: ServiceBase Class\n');

let passed = 0;
let failed = 0;
const errors = [];

// Test 1: ServiceBase class exists and can be instantiated
try {
    const service = new ServiceBase();
    if (service && typeof service === 'object') {
        console.log('✅ Test 1: ServiceBase class instantiates');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 1: ServiceBase did not instantiate properly');
        console.log('❌ Test 1: ServiceBase did not instantiate properly');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 1: ServiceBase instantiation failed - ${error.message}`);
    console.log(`❌ Test 1: ServiceBase instantiation failed - ${error.message}`);
}

// Test 2: validateSuccess() method exists
try {
    const service = new ServiceBase();
    if (typeof service.validateSuccess === 'function') {
        console.log('✅ Test 2: validateSuccess() method exists');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 2: validateSuccess() method does not exist');
        console.log('❌ Test 2: validateSuccess() method does not exist');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 2: validateSuccess() check failed - ${error.message}`);
    console.log(`❌ Test 2: validateSuccess() check failed - ${error.message}`);
}

// Test 3: validateSuccess() returns true by default
try {
    const service = new ServiceBase();
    const result = service.validateSuccess();
    if (result === true) {
        console.log('✅ Test 3: validateSuccess() returns true by default');
        passed++;
    } else {
        failed++;
        errors.push(`❌ Test 3: validateSuccess() returned ${result}, expected true`);
        console.log(`❌ Test 3: validateSuccess() returned ${result}, expected true`);
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 3: validateSuccess() execution failed - ${error.message}`);
    console.log(`❌ Test 3: validateSuccess() execution failed - ${error.message}`);
}

// Test 4: validateSuccess() accepts options parameter
try {
    const service = new ServiceBase();
    const result = service.validateSuccess({
        evidence: { test: true },
        operation: 'test_operation'
    });
    if (result === true) {
        console.log('✅ Test 4: validateSuccess() accepts options parameter');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 4: validateSuccess() with options returned false');
        console.log('❌ Test 4: validateSuccess() with options returned false');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 4: validateSuccess() with options failed - ${error.message}`);
    console.log(`❌ Test 4: validateSuccess() with options failed - ${error.message}`);
}

// Test 5: validateSuccess() validates criteria when provided
try {
    const service = new ServiceBase();

    // Should return true when criteria matches evidence
    const result1 = service.validateSuccess({
        evidence: { status: 'success', count: 5 },
        criteria: { status: 'success', count: 5 }
    });

    // Should return false when criteria doesn't match evidence
    const result2 = service.validateSuccess({
        evidence: { status: 'success' },
        criteria: { status: 'failed' }
    });

    if (result1 === true && result2 === false) {
        console.log('✅ Test 5: validateSuccess() validates criteria correctly');
        passed++;
    } else {
        failed++;
        errors.push(`❌ Test 5: Criteria validation failed - result1: ${result1}, result2: ${result2}`);
        console.log(`❌ Test 5: Criteria validation failed - result1: ${result1}, result2: ${result2}`);
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 5: Criteria validation failed - ${error.message}`);
    console.log(`❌ Test 5: Criteria validation failed - ${error.message}`);
}

// Test 6: getHealthStatus() method exists
try {
    const service = new ServiceBase();
    if (typeof service.getHealthStatus === 'function') {
        console.log('✅ Test 6: getHealthStatus() method exists');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 6: getHealthStatus() method does not exist');
        console.log('❌ Test 6: getHealthStatus() method does not exist');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 6: getHealthStatus() check failed - ${error.message}`);
    console.log(`❌ Test 6: getHealthStatus() check failed - ${error.message}`);
}

// Test 7: getHealthStatus() returns valid object
try {
    const service = new ServiceBase();
    const health = service.getHealthStatus();

    if (health &&
        typeof health === 'object' &&
        'healthy' in health &&
        'service' in health &&
        'uptime' in health &&
        'initialized' in health) {
        console.log('✅ Test 7: getHealthStatus() returns valid health object');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 7: getHealthStatus() returned invalid object');
        console.log('❌ Test 7: getHealthStatus() returned invalid object');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 7: getHealthStatus() execution failed - ${error.message}`);
    console.log(`❌ Test 7: getHealthStatus() execution failed - ${error.message}`);
}

// Test 8: validateConfig() method exists and works
try {
    const service = new ServiceBase();
    const valid = service.validateConfig({ port: 3000 });
    const invalid = service.validateConfig(null);

    if (valid === true && invalid === false) {
        console.log('✅ Test 8: validateConfig() works correctly');
        passed++;
    } else {
        failed++;
        errors.push(`❌ Test 8: validateConfig() failed - valid: ${valid}, invalid: ${invalid}`);
        console.log(`❌ Test 8: validateConfig() failed - valid: ${valid}, invalid: ${invalid}`);
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 8: validateConfig() failed - ${error.message}`);
    console.log(`❌ Test 8: validateConfig() failed - ${error.message}`);
}

// Test 9: ServiceBase can be extended
try {
    class TestService extends ServiceBase {
        constructor() {
            super();
            this.config = { serviceName: 'test-service' };
            this.isInitialized = true;
            this.startTime = new Date();
        }
    }

    const testService = new TestService();
    const hasValidateSuccess = typeof testService.validateSuccess === 'function';
    const validationWorks = testService.validateSuccess() === true;

    if (hasValidateSuccess && validationWorks) {
        console.log('✅ Test 9: ServiceBase can be extended by child classes');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 9: ServiceBase extension failed');
        console.log('❌ Test 9: ServiceBase extension failed');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 9: ServiceBase extension failed - ${error.message}`);
    console.log(`❌ Test 9: ServiceBase extension failed - ${error.message}`);
}

// Test 10: Child class can call parent validateSuccess()
(async () => {
    try {
        class TestService extends ServiceBase {
            constructor() {
                super();
                this.config = { serviceName: 'test-service' };
            }

            async testOperation() {
                const validation = { success: this.validateSuccess() };
                return {
                    success: validation.success,
                    data: { test: true }
                };
            }
        }

        const testService = new TestService();
        const result = await testService.testOperation();

        if (result && result.success === true && result.data.test === true) {
            console.log('✅ Test 10: Child class can call parent validateSuccess() in pattern used by services');
            passed++;
        } else {
            failed++;
            errors.push('❌ Test 10: Child class validateSuccess() pattern failed');
            console.log('❌ Test 10: Child class validateSuccess() pattern failed');
        }
    } catch (error) {
        failed++;
        errors.push(`❌ Test 10: Child class pattern failed - ${error.message}`);
        console.log(`❌ Test 10: Child class pattern failed - ${error.message}`);
    }

    // Print results after async test completes
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (failed > 0) {
        console.log('❌ SMOKING TEST FAILED: ServiceBase is broken!\n');
        console.log('Errors:');
        errors.forEach(err => console.log(`  ${err}`));
        console.log('\n🚨 DO NOT update production services until this is fixed!\n');
        process.exit(1);
    }

    console.log('✅ SMOKING TEST PASSED: ServiceBase works correctly!');
    console.log('🎯 Safe to update production services to extend ServiceBase\n');
    process.exit(0);
})();
