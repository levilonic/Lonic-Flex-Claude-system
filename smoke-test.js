// Comprehensive smoke test - verify basic functionality
console.log('🔥 Running comprehensive smoke test...\n');

async function smokeTest() {
    let passed = 0;
    let failed = 0;

    // Test 1: Core modules load
    console.log('━━━ Core Module Loading ━━━');
    try {
        require('./src/services/logger');
        console.log('✓ Logger module loads');
        passed++;
    } catch (e) {
        console.log('✗ Logger module failed:', e.message);
        failed++;
    }

    try {
        require('./src/agents/base-agent');
        console.log('✓ BaseAgent module loads');
        passed++;
    } catch (e) {
        console.log('✗ BaseAgent failed:', e.message);
        failed++;
    }

    try {
        require('./index.js');
        console.log('✓ Main index.js loads');
        passed++;
    } catch (e) {
        console.log('✗ index.js failed:', e.message);
        failed++;
    }

    // Test 2: Database operations
    console.log('\n━━━ Database Operations ━━━');
    try {
        const { SQLiteManager } = require('./src/database/sqlite-manager');
        const db = new SQLiteManager();
        console.log('✓ SQLiteManager instantiates');
        passed++;
    } catch (e) {
        console.log('✗ SQLiteManager failed:', e.message);
        failed++;
    }

    try {
        const { SQLiteManager } = require('./src/database/sqlite-manager');
        const db = new SQLiteManager();
        await db.initialize();
        const result = await db.run("SELECT 1 as test");
        await db.close();
        console.log('✓ Database init, query, close works');
        passed++;
    } catch (e) {
        console.log('✗ Database operations failed:', e.message);
        failed++;
    }

    // Test 3: GitHub integration
    console.log('\n━━━ GitHub Integration ━━━');
    try {
        const { GitHubReal } = require('./src/working/github-real');
        const github = new GitHubReal();
        const status = github.getStatus();
        console.log(`✓ GitHub integration loads (mode: ${status.mode})`);
        passed++;
    } catch (e) {
        console.log('✗ GitHub integration failed:', e.message);
        failed++;
    }

    // Test 4: PR Review Workflow
    try {
        const { PRReviewWorkflow } = require('./src/working/pr-review-workflow');
        const workflow = new PRReviewWorkflow();
        console.log('✓ PR Review Workflow loads');
        passed++;
    } catch (e) {
        console.log('✗ PR Review Workflow failed:', e.message);
        failed++;
    }

    // Test 5: Context Management
    console.log('\n━━━ Context Management ━━━');
    try {
        const { Factor3ContextManager } = require('./src/context-management/factor3-context-manager');
        const context = new Factor3ContextManager();
        console.log('✓ Factor3ContextManager loads');
        passed++;
    } catch (e) {
        console.log('✗ Factor3ContextManager failed:', e.message);
        failed++;
    }

    // Test 6: Service Container
    try {
        const { ServiceContainer } = require('./src/services/service-container');
        console.log('✓ ServiceContainer loads');
        passed++;
    } catch (e) {
        console.log('✗ ServiceContainer failed:', e.message);
        failed++;
    }

    // Test 7: Verify stub methods throw NOT_IMPLEMENTED
    console.log('\n━━━ Stub Method Verification ━━━');
    try {
        const { LonicFlexCostManagementService } = require('./src/services/lonicflex-cost-management-service');
        const service = new LonicFlexCostManagementService();
        let threw = false;
        try {
            await service.getCostDashboardData();
        } catch (e) {
            if (e.message.includes('NOT_IMPLEMENTED')) {
                threw = true;
            }
        }
        if (threw) {
            console.log('✓ Cost management stubs throw NOT_IMPLEMENTED');
            passed++;
        } else {
            console.log('✗ Cost management stubs should throw NOT_IMPLEMENTED');
            failed++;
        }
    } catch (e) {
        console.log('✗ Cost management service verification failed:', e.message);
        failed++;
    }

    try {
        const { LonicFlexGovernanceService } = require('./src/services/lonicflex-governance-service');
        const service = new LonicFlexGovernanceService();
        let threw = false;
        try {
            await service.getDashboardData();
        } catch (e) {
            if (e.message.includes('NOT_IMPLEMENTED')) {
                threw = true;
            }
        }
        if (threw) {
            console.log('✓ Governance stubs throw NOT_IMPLEMENTED');
            passed++;
        } else {
            console.log('✗ Governance stubs should throw NOT_IMPLEMENTED');
            failed++;
        }
    } catch (e) {
        console.log('✗ Governance service verification failed:', e.message);
        failed++;
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (failed > 0) {
        console.log('❌ Some tests failed');
        process.exit(1);
    } else {
        console.log('✅ All smoke tests passed!');
        process.exit(0);
    }
}

smokeTest();