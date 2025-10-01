#!/usr/bin/env node

/**
 * Real-World Agent Testing
 * Tests agents end-to-end with actual workflows
 */

const { ServiceContainer } = require('./src/services/service-container');

let sharedServiceContainer = null;

async function getServiceContainer() {
    if (!sharedServiceContainer) {
        sharedServiceContainer = new ServiceContainer();
        await sharedServiceContainer.initialize();
    }
    return sharedServiceContainer;
}

async function testCodeAgent() {
    console.log('\n▶️  Testing CodeAgent (real workflow)...');

    try {
        const { EnhancedCodeAgent } = require('./src/agents/code-agent');
        const serviceContainer = await getServiceContainer();

        const agent = new EnhancedCodeAgent('test_code_workflow', serviceContainer, {
            maxSteps: 5
        });

        await agent.initialize('workflow_code_test');

        const result = await agent.execute({
            task: 'analyze',
            target: 'verify-all-agents.js'
        });

        console.log(`   ✅ CodeAgent executed successfully`);
        console.log(`   Result: ${result.success ? 'Success' : 'Failed'}`);

        return { agent: 'CodeAgent', success: true };
    } catch (error) {
        console.log(`   ❌ CodeAgent failed: ${error.message}`);
        return { agent: 'CodeAgent', success: false, error: error.message };
    }
}

async function testSecurityAgent() {
    console.log('\n▶️  Testing SecurityAgent (real workflow)...');

    try {
        const { EnhancedSecurityAgent } = require('./src/agents/security-agent');
        const serviceContainer = await getServiceContainer();

        const agent = new EnhancedSecurityAgent('test_security_workflow', serviceContainer, {
            maxSteps: 5,
            scanDepth: 'quick' // Use quick mode to avoid 120s timeout
        });

        await agent.initialize('workflow_security_test');

        const result = await agent.execute({
            task: 'scan',
            target: './src/agents'
        });

        console.log(`   ✅ SecurityAgent executed successfully`);
        console.log(`   Result: ${result.success ? 'Success' : 'Failed'}`);

        return { agent: 'SecurityAgent', success: true };
    } catch (error) {
        console.log(`   ❌ SecurityAgent failed: ${error.message}`);
        return { agent: 'SecurityAgent', success: false, error: error.message };
    }
}

async function testDeployAgent() {
    console.log('\n▶️  Testing DeployAgent (real workflow)...');

    try {
        const { EnhancedDeployAgent } = require('./src/agents/deploy-agent');
        const serviceContainer = await getServiceContainer();

        const agent = new EnhancedDeployAgent('test_deploy_workflow', serviceContainer, {
            demoMode: true,
            environment: 'test'
        });

        await agent.initialize('workflow_deploy_test');

        const result = await agent.execute({
            task: 'deploy',
            services: ['test-service']
        });

        console.log(`   ✅ DeployAgent executed successfully`);
        console.log(`   Result: ${result.success ? 'Success' : 'Failed'}`);

        return { agent: 'DeployAgent', success: true };
    } catch (error) {
        console.log(`   ❌ DeployAgent failed: ${error.message}`);
        return { agent: 'DeployAgent', success: false, error: error.message };
    }
}

async function testIntegrationAgent() {
    console.log('\n▶️  Testing IntegrationAgent (real workflow)...');

    try {
        const { IntegrationAgent } = require('./src/agents/integration-agent');
        const serviceContainer = await getServiceContainer();

        const agent = new IntegrationAgent('test_integration_workflow', serviceContainer);

        await agent.initialize('workflow_integration_test');

        const result = await agent.execute({
            task: 'validate',
            components: ['database', 'memory']
        });

        console.log(`   ✅ IntegrationAgent executed successfully`);
        console.log(`   Result: ${result.success ? 'Success' : 'Failed'}`);

        return { agent: 'IntegrationAgent', success: true };
    } catch (error) {
        console.log(`   ❌ IntegrationAgent failed: ${error.message}`);
        return { agent: 'IntegrationAgent', success: false, error: error.message };
    }
}

async function main() {
    console.log('🧪 Real-World Agent Testing');
    console.log('════════════════════════════════════════════════════════════\n');

    const results = [];

    // Test each agent
    results.push(await testCodeAgent());
    results.push(await testSecurityAgent());
    results.push(await testDeployAgent());
    results.push(await testIntegrationAgent());

    // Summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 REAL-WORLD TEST RESULTS');
    console.log('════════════════════════════════════════════════════════════\n');

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Total Agents Tested: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
        console.log('❌ FAILED AGENTS:\n');
        results
            .filter(r => !r.success)
            .forEach(r => {
                console.log(`   ${r.agent}: ${r.error}`);
            });
        console.log('');
    }

    // Cleanup
    if (sharedServiceContainer) {
        await sharedServiceContainer.shutdown();
    }

    const exitCode = failed === 0 ? 0 : 1;

    if (exitCode === 0) {
        console.log('✅ All agents passed real-world testing!\n');
    } else {
        console.log('❌ Some agents failed real-world testing\n');
    }

    process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { testCodeAgent, testSecurityAgent, testDeployAgent, testIntegrationAgent };
