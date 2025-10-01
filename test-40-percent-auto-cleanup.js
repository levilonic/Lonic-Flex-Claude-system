#!/usr/bin/env node
/**
 * REAL TEST: 40% Auto-Cleanup Feature
 * Tests if auto-cleanup ACTUALLY triggers and works
 */

const { ContextWindowMonitor } = require('./src/context-management/context-window-monitor');
const { info, warn, error } = require('./src/services/logger');

async function testAutoCleanup() {
    console.log('\n🧪 TESTING 40% AUTO-CLEANUP FEATURE\n');
    console.log('═'.repeat(60));

    // Test configuration
    const config = {
        warningThreshold: 5,      // Lower for faster testing (simulates 40% in real use)
        criticalThreshold: 10,    // Simulates 70%
        emergencyThreshold: 15,   // Simulates 90%
        enableAutoCleanup: true,  // ENABLE auto-cleanup
        autoCleanupThreshold: 5   // Match warning threshold
    };

    const monitor = new ContextWindowMonitor(config);

    // Track what actually happens
    const events = {
        warning: 0,
        critical: 0,
        emergency: 0,
        autoCleanup: 0,
        autoCleanupFailed: 0
    };

    // Listen for threshold events
    monitor.on('threshold_warning', (state) => {
        events.warning++;
        console.log(`\n⚠️  WARNING TRIGGERED: ${state.percentage.toFixed(1)}% usage`);
    });

    monitor.on('threshold_critical', (state) => {
        events.critical++;
        console.log(`\n🟠 CRITICAL TRIGGERED: ${state.percentage.toFixed(1)}% usage`);
    });

    monitor.on('threshold_emergency', (state) => {
        events.emergency++;
        console.log(`\n🔴 EMERGENCY TRIGGERED: ${state.percentage.toFixed(1)}% usage`);
    });

    // CRITICAL: Listen for auto-cleanup events
    monitor.on('auto_cleanup_completed', (result) => {
        events.autoCleanup++;
        console.log(`\n✅ AUTO-CLEANUP COMPLETED!`);
        console.log(`   Type: ${result.cleanupType}`);
        console.log(`   Saved: ${result.savedTokens.toLocaleString()} tokens`);
        console.log(`   Before: ${result.originalPercentage.toFixed(1)}%`);
        console.log(`   After: ${result.newPercentage.toFixed(1)}%`);
    });

    monitor.on('auto_cleanup_failed', (result) => {
        events.autoCleanupFailed++;
        console.log(`\n❌ AUTO-CLEANUP FAILED: ${result.error}`);
    });

    // Start monitoring
    monitor.startMonitoring();

    // Generate context that WILL hit thresholds
    console.log('\n📈 Generating context to trigger thresholds...\n');

    let mockContext = '<workflow_context>\n';

    // Generate enough content to hit 5% threshold (5000 tokens)
    // Average: ~4 chars per token, so need ~20,000 chars for 5%
    for (let i = 0; i < 100; i++) {
        mockContext += `
        <event_${i}>
            timestamp: "${new Date().toISOString()}"
            type: "stress_test_event"
            data: {
                step: ${i + 1},
                description: "Generating large context to test auto-cleanup at threshold",
                details: "${'x'.repeat(i * 20)}",
                large_field_1: "${'a'.repeat(100)}",
                large_field_2: "${'b'.repeat(100)}",
                large_field_3: "${'c'.repeat(100)}",
                metadata: {
                    iteration: ${i},
                    total_chars: ${mockContext.length},
                    purpose: "test_40_percent_auto_cleanup"
                }
            }
        </event_${i}>
        `;

        // Check every 10 iterations
        if (i % 10 === 0) {
            await monitor.checkContextUsage(mockContext);

            const state = monitor.currentState;
            console.log(`   Step ${i}: ${state.tokens.toLocaleString()} tokens (${state.percentage.toFixed(1)}%) - ${state.level}`);

            // If we've hit critical, we've tested enough
            if (state.level === 'critical' || state.level === 'emergency') {
                console.log(`\n🛑 Reached ${state.level} level - stopping context generation`);
                break;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
    }

    // Final check
    await monitor.checkContextUsage(mockContext);

    monitor.stopMonitoring();

    // RESULTS
    console.log('\n═'.repeat(60));
    console.log('📊 TEST RESULTS\n');
    console.log(`Warning Events:           ${events.warning}`);
    console.log(`Critical Events:          ${events.critical}`);
    console.log(`Emergency Events:         ${events.emergency}`);
    console.log(`Auto-Cleanup Completed:   ${events.autoCleanup}`);
    console.log(`Auto-Cleanup Failed:      ${events.autoCleanupFailed}`);
    console.log(`\nFinal Context: ${mockContext.length.toLocaleString()} characters`);
    console.log(`Final Tokens: ${monitor.currentState.tokens.toLocaleString()} (${monitor.currentState.percentage.toFixed(1)}%)`);

    // VALIDATION
    console.log('\n═'.repeat(60));
    console.log('🔍 VALIDATION\n');

    const tests = [
        {
            name: 'Warning threshold reached',
            pass: events.warning > 0,
            expected: 'At least 1 warning event',
            actual: `${events.warning} events`
        },
        {
            name: 'Auto-cleanup triggered',
            pass: events.autoCleanup > 0 || events.autoCleanupFailed > 0,
            expected: 'Auto-cleanup attempted',
            actual: events.autoCleanup > 0 ? `${events.autoCleanup} successful` : `${events.autoCleanupFailed} failed`
        },
        {
            name: 'Auto-cleanup at correct threshold',
            pass: events.autoCleanup > 0 && events.warning > 0,
            expected: 'Auto-cleanup when warning triggered',
            actual: events.autoCleanup > 0 ? 'Yes' : 'No'
        }
    ];

    let passed = 0;
    tests.forEach(test => {
        const status = test.pass ? '✅ PASS' : '❌ FAIL';
        console.log(`${status}: ${test.name}`);
        console.log(`   Expected: ${test.expected}`);
        console.log(`   Actual: ${test.actual}\n`);
        if (test.pass) passed++;
    });

    console.log('═'.repeat(60));
    console.log(`\n🎯 OVERALL: ${passed}/${tests.length} tests passed (${(passed/tests.length*100).toFixed(0)}%)\n`);

    if (passed === tests.length) {
        console.log('✅ 40% AUTO-CLEANUP FEATURE: WORKING AS EXPECTED\n');
        process.exit(0);
    } else {
        console.log('❌ 40% AUTO-CLEANUP FEATURE: NOT WORKING AS EXPECTED\n');
        process.exit(1);
    }
}

// Run test
testAutoCleanup().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
