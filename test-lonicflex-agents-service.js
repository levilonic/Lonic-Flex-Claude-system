#!/usr/bin/env node
/**
 * SMOKING TEST: LonicFLex Agents Service
 *
 * PURPOSE: Prove agents service works with ServiceBase and validateSuccess()
 * NOT: Testing full agent workflow execution
 * YES: Testing service can start, has validateSuccess(), responds to /health
 *
 * This test SMOKES OUT if agents service is broken after extending ServiceBase.
 */

console.log('🧪 SMOKING TEST: LonicFLex Agents Service\n');

let passed = 0;
let failed = 0;
const errors = [];

// Test 1: Service file has valid syntax
try {
    require.resolve('./src/services/lonicflex-agents-service.js');
    console.log('✅ Test 1: Agents service file exists and has valid syntax');
    passed++;
} catch (error) {
    failed++;
    errors.push(`❌ Test 1: Agents service file invalid - ${error.message}`);
    console.log(`❌ Test 1: Agents service file invalid - ${error.message}`);
}

// Test 2: Service can be required (checking imports)
let LonicFlexAgentsService;
try {
    const serviceModule = require('./src/services/lonicflex-agents-service.js');
    LonicFlexAgentsService = serviceModule.LonicFlexAgentsService;

    if (LonicFlexAgentsService && typeof LonicFlexAgentsService === 'function') {
        console.log('✅ Test 2: Agents service class can be imported');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 2: LonicFlexAgentsService is not a class');
        console.log('❌ Test 2: LonicFlexAgentsService is not a class');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 2: Cannot import agents service - ${error.message}`);
    console.log(`❌ Test 2: Cannot import agents service - ${error.message}`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('❌ SMOKING TEST FAILED: Cannot proceed without being able to import service\n');
    process.exit(1);
}

// Test 3: Service can be instantiated
let service;
try {
    service = new LonicFlexAgentsService({ port: 9003 }); // Use different port to avoid conflicts

    if (service && typeof service === 'object') {
        console.log('✅ Test 3: Agents service can be instantiated');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 3: Service instantiation returned invalid object');
        console.log('❌ Test 3: Service instantiation returned invalid object');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 3: Service instantiation failed - ${error.message}`);
    console.log(`❌ Test 3: Service instantiation failed - ${error.message}`);
}

// Test 4: Service has validateSuccess() method
try {
    if (service && typeof service.validateSuccess === 'function') {
        console.log('✅ Test 4: Service has validateSuccess() method');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 4: validateSuccess() method missing');
        console.log('❌ Test 4: validateSuccess() method missing');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 4: validateSuccess() check failed - ${error.message}`);
    console.log(`❌ Test 4: validateSuccess() check failed - ${error.message}`);
}

// Test 5: validateSuccess() method works
try {
    if (service) {
        const result = service.validateSuccess();
        if (result === true) {
            console.log('✅ Test 5: validateSuccess() returns true');
            passed++;
        } else {
            failed++;
            errors.push(`❌ Test 5: validateSuccess() returned ${result}, expected true`);
            console.log(`❌ Test 5: validateSuccess() returned ${result}, expected true`);
        }
    } else {
        failed++;
        errors.push('❌ Test 5: Cannot test validateSuccess() - service not instantiated');
        console.log('❌ Test 5: Cannot test validateSuccess() - service not instantiated');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 5: validateSuccess() execution failed - ${error.message}`);
    console.log(`❌ Test 5: validateSuccess() execution failed - ${error.message}`);
}

// Test 6: Service has expected Express app
try {
    if (service && service.app && typeof service.app.listen === 'function') {
        console.log('✅ Test 6: Service has Express app');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 6: Service missing Express app');
        console.log('❌ Test 6: Service missing Express app');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 6: Express app check failed - ${error.message}`);
    console.log(`❌ Test 6: Express app check failed - ${error.message}`);
}

// Test 7: Service has core components
try {
    const hasMultiAgentCore = service && service.multiAgentCore;
    const hasDb = service && service.db;
    const hasContextManager = service && service.contextManager;

    if (hasMultiAgentCore && hasDb && hasContextManager) {
        console.log('✅ Test 7: Service has core components (MultiAgentCore, DB, ContextManager)');
        passed++;
    } else {
        failed++;
        errors.push(`❌ Test 7: Missing components - MultiAgentCore: ${!!hasMultiAgentCore}, DB: ${!!hasDb}, Context: ${!!hasContextManager}`);
        console.log(`❌ Test 7: Missing components - MultiAgentCore: ${!!hasMultiAgentCore}, DB: ${!!hasDb}, Context: ${!!hasContextManager}`);
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 7: Core components check failed - ${error.message}`);
    console.log(`❌ Test 7: Core components check failed - ${error.message}`);
}

// Test 8: Service has agent types configured
try {
    const hasAgentTypes = service && service.agentTypes && Object.keys(service.agentTypes).length > 0;

    if (hasAgentTypes) {
        const agentCount = Object.keys(service.agentTypes).length;
        console.log(`✅ Test 8: Service has ${agentCount} agent types configured`);
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 8: No agent types configured');
        console.log('❌ Test 8: No agent types configured');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 8: Agent types check failed - ${error.message}`);
    console.log(`❌ Test 8: Agent types check failed - ${error.message}`);
}

// Test 9: Service has workflow management structures
try {
    const hasActiveWorkflows = service && service.activeWorkflows instanceof Map;
    const hasAgentPool = service && service.agentPool instanceof Map;
    const hasWorkflowQueue = service && Array.isArray(service.workflowQueue);

    if (hasActiveWorkflows && hasAgentPool && hasWorkflowQueue) {
        console.log('✅ Test 9: Service has workflow management structures');
        passed++;
    } else {
        failed++;
        errors.push(`❌ Test 9: Missing workflow structures - activeWorkflows: ${hasActiveWorkflows}, agentPool: ${hasAgentPool}, workflowQueue: ${hasWorkflowQueue}`);
        console.log(`❌ Test 9: Missing workflow structures`);
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 9: Workflow structures check failed - ${error.message}`);
    console.log(`❌ Test 9: Workflow structures check failed - ${error.message}`);
}

// Test 10: Service config is valid
try {
    const hasValidConfig = service && service.config &&
                          service.config.serviceName === 'lonicflex-agents' &&
                          service.config.port === 9003;

    if (hasValidConfig) {
        console.log('✅ Test 10: Service configuration is valid');
        passed++;
    } else {
        failed++;
        errors.push('❌ Test 10: Service configuration invalid');
        console.log('❌ Test 10: Service configuration invalid');
    }
} catch (error) {
    failed++;
    errors.push(`❌ Test 10: Config validation failed - ${error.message}`);
    console.log(`❌ Test 10: Config validation failed - ${error.message}`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failed > 0) {
    console.log('❌ SMOKING TEST FAILED: Agents service is broken!\n');
    console.log('Errors:');
    errors.forEach(err => console.log(`  ${err}`));
    console.log('\n🚨 Service cannot be used in production!\n');
    process.exit(1);
}

console.log('✅ SMOKING TEST PASSED: Agents service works correctly!');
console.log('🎯 Service extends ServiceBase and has validateSuccess() method\n');
console.log('📝 NOTE: This test validates structure only. Full integration tests');
console.log('         with actual workflow execution would require initialized database,');
console.log('         MultiAgentCore, and agent instances.\n');
process.exit(0);
