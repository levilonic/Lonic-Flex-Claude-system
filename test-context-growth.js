#!/usr/bin/env node
/**
 * Test Context Growth - Simulate real context growth to test 40% cleanup
 * Creates gradually increasing context to verify auto-cleanup triggers
 */

const { IntegratedContextManager } = require('./integrated-context-manager');

async function testContextGrowth() {
    console.log('🧪 Testing Context Growth with Auto-Cleanup at 40%\n');
    
    const manager = new IntegratedContextManager({
        cleanupThreshold: 40,    // Test the actual 40% requirement
        targetReduction: 0.3,    // 30% reduction
        updateInterval: 1000     // 1 second updates for demo
    });
    
    let cleanupTriggered = false;
    let finalStats = null;
    
    // Listen for cleanup events
    manager.on('context_cleaned', (data) => {
        cleanupTriggered = true;
        console.log(`\n🧹 AUTO-CLEANUP TRIGGERED!`);
        console.log(`   Original: ${data.originalTokens.toLocaleString()} tokens (${data.originalPercentage.toFixed(1)}%)`);
        console.log(`   Cleaned:  ${data.cleanedTokens.toLocaleString()} tokens (${data.newPercentage.toFixed(1)}%)`);
        console.log(`   Saved:    ${data.savedTokens.toLocaleString()} tokens (${((data.savedTokens/data.originalTokens)*100).toFixed(1)}% reduction)`);
        console.log(`   Archive:  ${data.archiveId}\n`);
    });
    
    try {
        await manager.start();
        
        console.log('📈 Simulating gradual context growth...\n');
        
        // Add events that gradually increase in size
        for (let i = 1; i <= 100; i++) {
            const eventData = {
                step: i,
                timestamp: Date.now(),
                description: `Simulation step ${i} - testing context growth`,
                details: 'x'.repeat(i * 50), // Increasing content size
                metadata: {
                    iteration: i,
                    total_steps: 100,
                    complexity: Math.floor(Math.random() * 10),
                    tags: [`step_${i}`, 'simulation', 'growth_test']
                },
                large_data: Array.from({length: i * 2}, (_, idx) => ({
                    id: `item_${idx}`,
                    value: Math.random() * 1000,
                    description: `Generated item ${idx} for step ${i}`
                }))
            };
            
            await manager.addEvent(`simulation_step_${i}`, eventData);
            
            // Get current usage
            const usage = await manager.getContextUsage();
            const statusLine = await manager.generateStatusLine();
            
            // Clear previous line and show current status
            process.stdout.write('\r' + ' '.repeat(120) + '\r');
            process.stdout.write(`Step ${i.toString().padStart(3)}: ${statusLine}`);
            
            // If we've triggered cleanup, show final stats and break
            if (cleanupTriggered && i > 50) {
                console.log(`\n\n✅ Auto-cleanup successfully triggered at step ${i}`);
                finalStats = await manager.getStatus();
                break;
            }
            
            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!cleanupTriggered) {
            console.log('\n\n⚠️ Auto-cleanup was not triggered during simulation');
            finalStats = await manager.getStatus();
        }
        
        // Show final statistics
        console.log('\n📊 Final System Statistics:');
        console.log(`   Events created: ${finalStats.stats.totalEvents}`);
        console.log(`   Auto-cleanups: ${finalStats.stats.autoCleanups}`);
        console.log(`   Current usage: ${finalStats.usage.tokens.toLocaleString()} tokens (${finalStats.usage.percentage.toFixed(2)}%)`);
        console.log(`   Archive entries: ${finalStats.autoManager.archivedItems}`);
        console.log(`   Total tokens saved: ${finalStats.autoManager.totalTokensSaved.toLocaleString()}`);
        
        // Show archive stats if any
        if (finalStats.autoManager.archivedItems > 0) {
            console.log('\n📦 Archive System:');
            console.log(`   Archives created: ${finalStats.autoManager.archivedItems}`);
            
            // Try to show archive list
            try {
                const { spawn } = require('child_process');
                spawn('npm', ['run', 'context-archive'], { stdio: 'inherit' });
            } catch (error) {
                console.log('   (Archive list command failed)');
            }
        }
        
        console.log(`\n🎯 Test Result: ${cleanupTriggered ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`   40% Auto-cleanup: ${cleanupTriggered ? 'WORKING' : 'NOT TRIGGERED'}`);
        
        manager.stop();
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        manager.stop();
    }
}

// Run the test
if (require.main === module) {
    testContextGrowth().catch(console.error);
}

module.exports = { testContextGrowth };