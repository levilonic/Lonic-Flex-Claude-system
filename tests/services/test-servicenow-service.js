#!/usr/bin/env node
/**
 * NowService Service Test Suite
 * Verifies lonicflex-servicenow-service.js is production-ready
 */

const { LonicFlexServiceNowService } = require('../../src/services/lonicflex-servicenow-service');

console.log('🧪 Testing LonicFlex Servicenow Service\n');

const tests = {
    passed: 0,
    failed: 0,
    errors: []
};

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        tests.passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        tests.failed++;
        tests.errors.push({ test: name, error: error.message });
    }
}

// Test 1: Service instantiates
test('Service instantiates without error', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (!service) throw new Error('Service is null');
    if (typeof service !== 'object') throw new Error('Service is not an object');
});

// Test 2: Extends ServiceBase
test('Service extends ServiceBase', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (typeof service.validateSuccess !== 'function') {
        throw new Error('Missing validateSuccess() from ServiceBase');
    }
    if (typeof service.getHealthStatus !== 'function') {
        throw new Error('Missing getHealthStatus() from ServiceBase');
    }
});

// Test 3: Has required configuration
test('Service has correct configuration', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (!service.config) throw new Error('Missing config');
    if (service.config.port !== 3022) throw new Error('Wrong port (expected 3022)');
    if (!service.config.serviceName.includes('servicenow')) throw new Error('Wrong service name');
});

// Test 4: Has start() method
test('Service has start() method', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (typeof service.start !== 'function') throw new Error('Missing start() method');
});

// Test 5: Has initialize() method
test('Service has initialize() method', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (typeof service.initialize !== 'function') throw new Error('Missing initialize() method');
});

// Test 6: Has Express app
test('Service has Express app configured', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (!service.app) throw new Error('Missing Express app');
    if (typeof service.app.listen !== 'function') throw new Error('Invalid Express app');
});

// Test 7: Has routes
test('Service has routes defined', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    const routeCount = service.app._router?.stack?.filter(r => r.route).length || 0;
    if (routeCount < 4) throw new Error(`Only ${routeCount} routes (expected 4+)`);
});

// Test 8: Has database integration
test('Service has database integration', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (!service.db) throw new Error('Missing database instance');
});

// Test 9: Has context manager
test('Service has context manager', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (!service.contextManager) throw new Error('Missing context manager');
});

// Test 10: Has logger
test('Service has logger configured', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (!service.logger) throw new Error('Missing logger');
    if (typeof service.logger.info !== 'function') throw new Error('Invalid logger');
});

// Test 11: Service-specific validation
test('Service has required properties', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    if (!service.stats) throw new Error('Missing stats tracking');
});

// Test 12: validateSuccess() works
test('validateSuccess() method works', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    const result = service.validateSuccess();
    if (typeof result !== 'boolean') throw new Error('validateSuccess() must return boolean');
});

// Test 13: getHealthStatus() works
test('getHealthStatus() returns valid object', () => {
    const service = new LonicFlexServiceNowService({ test: true });
    const health = service.getHealthStatus();
    if (!health || typeof health !== 'object') throw new Error('Invalid health object');
    if (!('healthy' in health)) throw new Error('Missing healthy property');
    if (!('service' in health)) throw new Error('Missing service property');
});

// Print results
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Test Results');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Passed: ${tests.passed}`);
console.log(`❌ Failed: ${tests.failed}`);
console.log(`📈 Success Rate: ${((tests.passed / (tests.passed + tests.failed)) * 100).toFixed(1)}%`);

if (tests.failed > 0) {
    console.log('\n❌ Failed Tests:');
    tests.errors.forEach(({ test, error }) => {
        console.log(`   • ${test}: ${error}`);
    });
    process.exit(1);
} else {
    console.log('\n✅ All servicenow service tests passed!');
    process.exit(0);
}
