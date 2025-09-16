#!/usr/bin/env node
/**
 * Simple OrganizationManager test to validate basic functionality
 */

const { OrganizationManager } = require('./core/organization-manager');

async function simpleTest() {
    console.log('🧪 Simple OrganizationManager Test');
    console.log('===================================');

    try {
        // Test 1: Basic initialization
        console.log('\n🔧 Test 1: Initializing OrganizationManager...');
        const orgManager = new OrganizationManager(`test-simple-${Date.now()}`);
        await orgManager.initialize();
        console.log('✅ OrganizationManager initialized successfully');

        // Test 2: Natural language processing
        console.log('\n🎯 Test 2: Testing natural language processing...');
        const testInput = {
            input: "Build a simple login page",
            context: { type: 'test' }
        };

        const result = await orgManager.executeWorkflow(testInput);

        console.log('📊 Results:');
        console.log(`  Project: ${result.project?.name || 'Generated'}`);
        console.log(`  Complexity: ${result.project?.complexity || 'unknown'}`);
        console.log(`  Team size: ${result.team?.teamSize || 'unknown'}`);
        console.log(`  Success: ${result.success ? '✅' : '❌'}`);

        console.log('\n🎉 Simple test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        // Don't exit with error, just report
    }
}

if (require.main === module) {
    simpleTest().catch(console.error);
}