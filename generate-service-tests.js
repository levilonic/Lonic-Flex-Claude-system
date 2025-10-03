#!/usr/bin/env node
/**
 * Generate test files for all 13 services
 * Uses the GitHub service test as template
 */

const fs = require('fs');
const path = require('path');

const services = [
    { name: 'github', port: 3002, className: 'LonicFlexGitHubService', hasOctokit: true, hasSlack: false },
    { name: 'gitlab', port: 3025, className: 'LonicFlexGitLabService', hasOctokit: false, hasSlack: false },
    { name: 'slack', port: 3006, className: 'LonicFlexSlackService', hasOctokit: false, hasSlack: true },
    { name: 'jira', port: 3021, className: 'LonicFlexJiraService', hasOctokit: false, hasSlack: false },
    { name: 'servicenow', port: 3022, className: 'LonicFlexServiceNowService', hasOctokit: false, hasSlack: false },
    { name: 'linear', port: 3023, className: 'LonicFlexLinearService', hasOctokit: false, hasSlack: false },
    { name: 'jenkins', port: 3024, className: 'LonicFlexJenkinsService', hasOctokit: false, hasSlack: false },
    { name: 'health', port: 3005, className: 'LonicFlexHealthService', hasOctokit: false, hasSlack: false },
    { name: 'integration-hub', port: 3020, className: 'LonicFlexIntegrationHubService', hasOctokit: false, hasSlack: false },
    { name: 'master', port: 3007, className: 'LonicFlexMasterService', hasOctokit: false, hasSlack: false },
    { name: 'webhook', port: 3008, className: 'LonicFlexWebhookService', hasOctokit: false, hasSlack: false },
    { name: 'workflows', port: 3004, className: 'LonicFlexWorkflowsService', hasOctokit: false, hasSlack: false },
    { name: 'permissions', port: 3031, className: 'LonicFlexPermissionsService', hasOctokit: false, hasSlack: false }
];

const testDir = path.join(__dirname, 'tests', 'services');
if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
}

console.log('🔧 Generating service tests...\n');

for (const service of services) {
    const testPath = path.join(testDir, `test-${service.name}-service.js`);

    // Skip GitHub - already created manually
    if (service.name === 'github') {
        console.log(`⏭️  ${service.name} - already exists`);
        continue;
    }

    const integrationTest = service.hasOctokit
        ? `// Test 11: Has Octokit integration
test('Service has Octokit integration', () => {
    const service = new ${service.className}({ test: true });
    if (!('octokit' in service)) throw new Error('Missing octokit property');
});`
        : service.hasSlack
        ? `// Test 11: Has Slack integration
test('Service has Slack integration', () => {
    const service = new ${service.className}({ test: true });
    if (!('slackApp' in service || 'webClient' in service)) {
        throw new Error('Missing Slack integration');
    }
});`
        : `// Test 11: Service-specific validation
test('Service has required properties', () => {
    const service = new ${service.className}({ test: true });
    if (!service.stats) throw new Error('Missing stats tracking');
});`;

    const content = `#!/usr/bin/env node
/**
 * ${service.className.replace('LonicFlex', '').replace('Service', '')} Service Test Suite
 * Verifies lonicflex-${service.name}-service.js is production-ready
 */

const { ${service.className} } = require('../../src/services/lonicflex-${service.name}-service');

console.log('🧪 Testing LonicFlex ${service.name.charAt(0).toUpperCase() + service.name.slice(1)} Service\\n');

const tests = {
    passed: 0,
    failed: 0,
    errors: []
};

function test(name, fn) {
    try {
        fn();
        console.log(\`✅ \${name}\`);
        tests.passed++;
    } catch (error) {
        console.log(\`❌ \${name}\`);
        console.log(\`   Error: \${error.message}\`);
        tests.failed++;
        tests.errors.push({ test: name, error: error.message });
    }
}

// Test 1: Service instantiates
test('Service instantiates without error', () => {
    const service = new ${service.className}({ test: true });
    if (!service) throw new Error('Service is null');
    if (typeof service !== 'object') throw new Error('Service is not an object');
});

// Test 2: Extends ServiceBase
test('Service extends ServiceBase', () => {
    const service = new ${service.className}({ test: true });
    if (typeof service.validateSuccess !== 'function') {
        throw new Error('Missing validateSuccess() from ServiceBase');
    }
    if (typeof service.getHealthStatus !== 'function') {
        throw new Error('Missing getHealthStatus() from ServiceBase');
    }
});

// Test 3: Has required configuration
test('Service has correct configuration', () => {
    const service = new ${service.className}({ test: true });
    if (!service.config) throw new Error('Missing config');
    if (service.config.port !== ${service.port}) throw new Error('Wrong port (expected ${service.port})');
    if (!service.config.serviceName.includes('${service.name}')) throw new Error('Wrong service name');
});

// Test 4: Has start() method
test('Service has start() method', () => {
    const service = new ${service.className}({ test: true });
    if (typeof service.start !== 'function') throw new Error('Missing start() method');
});

// Test 5: Has initialize() method
test('Service has initialize() method', () => {
    const service = new ${service.className}({ test: true });
    if (typeof service.initialize !== 'function') throw new Error('Missing initialize() method');
});

// Test 6: Has Express app
test('Service has Express app configured', () => {
    const service = new ${service.className}({ test: true });
    if (!service.app) throw new Error('Missing Express app');
    if (typeof service.app.listen !== 'function') throw new Error('Invalid Express app');
});

// Test 7: Has routes
test('Service has routes defined', () => {
    const service = new ${service.className}({ test: true });
    const routeCount = service.app._router?.stack?.filter(r => r.route).length || 0;
    if (routeCount < 4) throw new Error(\`Only \${routeCount} routes (expected 4+)\`);
});

// Test 8: Has database integration
test('Service has database integration', () => {
    const service = new ${service.className}({ test: true });
    if (!service.db) throw new Error('Missing database instance');
});

// Test 9: Has context manager
test('Service has context manager', () => {
    const service = new ${service.className}({ test: true });
    if (!service.contextManager) throw new Error('Missing context manager');
});

// Test 10: Has logger
test('Service has logger configured', () => {
    const service = new ${service.className}({ test: true });
    if (!service.logger) throw new Error('Missing logger');
    if (typeof service.logger.info !== 'function') throw new Error('Invalid logger');
});

${integrationTest}

// Test 12: validateSuccess() works
test('validateSuccess() method works', () => {
    const service = new ${service.className}({ test: true });
    const result = service.validateSuccess();
    if (typeof result !== 'boolean') throw new Error('validateSuccess() must return boolean');
});

// Test 13: getHealthStatus() works
test('getHealthStatus() returns valid object', () => {
    const service = new ${service.className}({ test: true });
    const health = service.getHealthStatus();
    if (!health || typeof health !== 'object') throw new Error('Invalid health object');
    if (!('healthy' in health)) throw new Error('Missing healthy property');
    if (!('service' in health)) throw new Error('Missing service property');
});

// Print results
console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Test Results');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(\`✅ Passed: \${tests.passed}\`);
console.log(\`❌ Failed: \${tests.failed}\`);
console.log(\`📈 Success Rate: \${((tests.passed / (tests.passed + tests.failed)) * 100).toFixed(1)}%\`);

if (tests.failed > 0) {
    console.log('\\n❌ Failed Tests:');
    tests.errors.forEach(({ test, error }) => {
        console.log(\`   • \${test}: \${error}\`);
    });
    process.exit(1);
} else {
    console.log('\\n✅ All ${service.name} service tests passed!');
    process.exit(0);
}
`;

    fs.writeFileSync(testPath, content);
    console.log(`✅ ${service.name} - test created`);
}

console.log(`\n✅ Generated ${services.length - 1} service test files`);
console.log(`📁 Location: ${testDir}\n`);
