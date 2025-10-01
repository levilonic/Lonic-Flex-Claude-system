/**
 * Test Core System - Verify all core functionality works
 */

const { CommandExecutor } = require('./src/core/command-executor');

async function testCoreSystem() {
    console.log('🧪 Testing LonicFLex Core System\n');

    const executor = new CommandExecutor();
    let passed = 0;
    let failed = 0;

    // Test 1: System initialization
    console.log('━━━ System Initialization ━━━');
    try {
        await executor.initialize();
        console.log('✓ System initialized');
        passed++;
    } catch (e) {
        console.log('✗ System initialization failed:', e.message);
        failed++;
        process.exit(1);
    }

    // Test 2: System info
    console.log('\n━━━ System Commands ━━━');
    try {
        const result = await executor.execute('system:info');
        console.log(`✓ system:info - ${result.result.name} v${result.result.version}`);
        passed++;
    } catch (e) {
        console.log('✗ system:info failed:', e.message);
        failed++;
    }

    // Test 3: System health
    try {
        const result = await executor.execute('system:health');
        const status = result.result.status;
        console.log(`✓ system:health - ${status}`);
        passed++;
    } catch (e) {
        console.log('✗ system:health failed:', e.message);
        failed++;
    }

    // Test 4: Database status
    console.log('\n━━━ Database Commands ━━━');
    try {
        const result = await executor.execute('db:status');
        console.log(`✓ db:status - ${result.result.stats.active_sessions} active sessions`);
        passed++;
    } catch (e) {
        console.log('✗ db:status failed:', e.message);
        failed++;
    }

    // Test 5: GitHub list PRs
    console.log('\n━━━ GitHub Commands ━━━');
    try {
        const result = await executor.execute('gh:list-prs');
        console.log(`✓ gh:list-prs - ${result.result.count} PRs found`);
        passed++;
    } catch (e) {
        console.log('✗ gh:list-prs failed:', e.message);
        failed++;
    }

    // Test 6: GitHub get files
    try {
        const result = await executor.execute('gh:get-files');
        console.log(`✓ gh:get-files - ${result.result.count} files found`);
        passed++;
    } catch (e) {
        console.log('✗ gh:get-files failed:', e.message);
        failed++;
    }

    // Test 7: PR review
    try {
        const result = await executor.execute('gh:review-pr', { prNumber: 123 });
        console.log(`✓ gh:review-pr - Score: ${result.result.score}/100`);
        passed++;
    } catch (e) {
        console.log('✗ gh:review-pr failed:', e.message);
        failed++;
    }

    // Test 8: List workflows
    console.log('\n━━━ Workflow Commands ━━━');
    try {
        const result = await executor.execute('workflow:list');
        console.log(`✓ workflow:list - ${result.result.count} workflows available`);
        passed++;
    } catch (e) {
        console.log('✗ workflow:list failed:', e.message);
        failed++;
    }

    // Test 9: Run workflow
    try {
        const result = await executor.execute('workflow:run', {
            workflow: 'pr-review',
            input: 123
        });
        console.log(`✓ workflow:run - PR review workflow executed`);
        passed++;
    } catch (e) {
        console.log('✗ workflow:run failed:', e.message);
        failed++;
    }

    // Test 10: List commands
    console.log('\n━━━ Command Registry ━━━');
    try {
        const commands = executor.listCommands();
        console.log(`✓ Command registry - ${commands.length} commands available`);

        const categories = {};
        commands.forEach(cmd => {
            categories[cmd.category] = (categories[cmd.category] || 0) + 1;
        });

        console.log('  Categories:', Object.keys(categories).join(', '));
        passed++;
    } catch (e) {
        console.log('✗ Command listing failed:', e.message);
        failed++;
    }

    // Cleanup
    await executor.shutdown();

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (failed === 0) {
        console.log('✅ All core system tests passed!');
        console.log('🚀 LonicFLex Core is fully operational\n');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed\n');
        process.exit(1);
    }
}

testCoreSystem();