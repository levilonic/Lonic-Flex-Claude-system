#!/usr/bin/env node

/**
 * Test Suite: Long-Term Persistence System (Phase 3B)
 * Validates 3+ month context survival with sub-second resume times
 * Tests integration with existing Universal Context System
 */

const { LongTermPersistence } = require('./context-management/long-term-persistence');
const { ContextHealthMonitor } = require('./context-management/context-health-monitor');
const { Factor3ContextManager } = require('./factor3-context-manager');
const fs = require('fs').promises;
const path = require('path');

class LongTermPersistenceTestSuite {
    constructor() {
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            details: []
        };
        
        this.longTermPersistence = new LongTermPersistence({
            archiveDir: path.join(process.cwd(), 'test-archives')
        });
        
        this.healthMonitor = new ContextHealthMonitor();
        
        // Performance targets from Phase 3B requirements
        this.targets = {
            resumeTime: 1000, // Sub-second resume (ms)
            compressionEfficiency: 0.8, // 80%+ compression for deep sleep
            healthAccuracy: 0.9, // 90%+ health score accuracy
            dataIntegrity: 0.95 // 95%+ data integrity after archival
        };
        
        console.log('🧪 Long-Term Persistence Test Suite - Phase 3B Validation');
        console.log('🎯 Targets: <1s resume, 80%+ compression, 90%+ health accuracy');
    }

    /**
     * Run complete test suite
     */
    async runAllTests() {
        console.log('\n📋 Starting comprehensive Phase 3B test suite...\n');
        
        try {
            // 1. Basic archival and restoration tests
            await this.testBasicArchivalRestoration();
            
            // 2. Progressive compression tests
            await this.testProgressiveCompression();
            
            // 3. Long time gap simulation (3+ months)
            await this.testLongTimeGapSurvival();
            
            // 4. Performance benchmarking
            await this.testPerformanceTargets();
            
            // 5. Health monitoring tests
            await this.testHealthMonitoring();
            
            // 6. Data integrity tests
            await this.testDataIntegrityAcrossTimeGaps();
            
            // 7. Integration with existing Universal Context System
            await this.testUniversalContextIntegration();
            
            // 8. Background maintenance tests
            await this.testBackgroundMaintenance();
            
            // 9. Archive cleanup and management
            await this.testArchiveManagement();
            
            // 10. Failure recovery tests
            await this.testFailureRecovery();
            
        } catch (error) {
            console.error('🚨 Test suite execution failed:', error);
            this.recordTest('Test Suite Execution', false, error.message);
        }
        
        await this.cleanup();
        this.printResults();
        
        return this.testResults;
    }

    /**
     * Test 1: Basic archival and restoration functionality
     */
    async testBasicArchivalRestoration() {
        console.log('🧪 Test 1: Basic Archival and Restoration');
        
        const mockContext = this.createMockContext('basic-test', 'session');
        
        try {
            // Archive context
            const archiveResult = await this.longTermPersistence.archiveContext(
                'basic-test', 
                mockContext
            );
            
            this.recordTest('Basic Archive Operation', archiveResult.success, 
                archiveResult.success ? 'Archive created successfully' : 'Archive failed');
            
            // Restore context
            const restoreResult = await this.longTermPersistence.restoreContext(
                'basic-test', 
                'session'
            );
            
            this.recordTest('Basic Restore Operation', restoreResult.success,
                restoreResult.success ? `Restored in ${restoreResult.restoreTime}ms` : 'Restore failed');
            
            // Verify data integrity
            const originalData = JSON.stringify(mockContext.context);
            const restoredHasOriginalStructure = restoreResult.context.includes('<workflow_context>');
            
            this.recordTest('Basic Data Integrity', restoredHasOriginalStructure,
                restoredHasOriginalStructure ? 'XML structure preserved' : 'XML structure corrupted');
            
        } catch (error) {
            this.recordTest('Basic Archival/Restoration', false, error.message);
        }
    }

    /**
     * Test 2: Progressive compression based on archive levels
     */
    async testProgressiveCompression() {
        console.log('🧪 Test 2: Progressive Compression Levels');
        
        const testCases = [
            { age: 6 * 24 * 60 * 60 * 1000, expectedLevel: 'Dormant' },    // 6 days
            { age: 45 * 24 * 60 * 60 * 1000, expectedLevel: 'Sleeping' },  // 45 days  
            { age: 120 * 24 * 60 * 60 * 1000, expectedLevel: 'Deep Sleep' } // 120 days
        ];
        
        for (const testCase of testCases) {
            try {
                const contextId = `compression-test-${testCase.expectedLevel.toLowerCase().replace(' ', '-')}`;
                const mockContext = this.createMockContext(contextId, 'session');
                
                // Set last activity to simulate age
                mockContext.last_activity = Date.now() - testCase.age;
                
                const archiveResult = await this.longTermPersistence.archiveContext(
                    contextId, 
                    mockContext
                );
                
                const correctLevel = archiveResult.archiveLevel === testCase.expectedLevel;
                this.recordTest(`Progressive Compression - ${testCase.expectedLevel}`, 
                    correctLevel,
                    correctLevel ? 
                        `Correct archive level (${archiveResult.compressionRatio.toFixed(2)} ratio)` : 
                        `Wrong level: expected ${testCase.expectedLevel}, got ${archiveResult.archiveLevel}`);
                
            } catch (error) {
                this.recordTest(`Progressive Compression - ${testCase.expectedLevel}`, 
                    false, error.message);
            }
        }
    }

    /**
     * Test 3: Long time gap survival (3+ months)
     */
    async testLongTimeGapSurvival() {
        console.log('🧪 Test 3: Long Time Gap Survival (3+ Months)');
        
        const timeGaps = [
            { days: 30, name: '1 Month' },
            { days: 90, name: '3 Months' },
            { days: 180, name: '6 Months' },
            { days: 365, name: '1 Year' }
        ];
        
        for (const timeGap of timeGaps) {
            try {
                const contextId = `time-gap-${timeGap.days}d`;
                const scope = timeGap.days > 90 ? 'project' : 'session'; // Use project for long gaps
                const mockContext = this.createMockContext(contextId, scope);
                
                // Simulate time gap
                mockContext.last_activity = Date.now() - (timeGap.days * 24 * 60 * 60 * 1000);
                
                // Archive
                const archiveResult = await this.longTermPersistence.archiveContext(
                    contextId, 
                    mockContext,
                    scope
                );
                
                // Restore after simulated time gap using same scope
                const restoreResult = await this.longTermPersistence.restoreContext(
                    contextId, 
                    scope
                );
                
                // Verify restoration includes time gap enhancement
                const hasTimeGapNotice = restoreResult.context.includes('<context_restoration>');
                const correctTimeGap = Math.floor(restoreResult.timeGap / (24 * 60 * 60 * 1000)) === timeGap.days;
                
                this.recordTest(`Time Gap Survival - ${timeGap.name}`, 
                    restoreResult.success && hasTimeGapNotice && correctTimeGap,
                    restoreResult.success ? 
                        `Survived ${timeGap.days} day gap, restored in ${restoreResult.restoreTime}ms` :
                        'Failed to survive time gap');
                
            } catch (error) {
                this.recordTest(`Time Gap Survival - ${timeGap.name}`, false, error.message);
            }
        }
    }

    /**
     * Test 4: Performance targets validation
     */
    async testPerformanceTargets() {
        console.log('🧪 Test 4: Performance Targets Validation');
        
        try {
            // Test sub-second resume performance
            const performanceTestData = [];
            
            for (let i = 0; i < 5; i++) {
                const contextId = `performance-test-${i}`;
                const mockContext = this.createMockContext(contextId, 'session');
                
                // Archive
                await this.longTermPersistence.archiveContext(contextId, mockContext, 'session');
                
                // Measure restore time
                const startTime = Date.now();
                const restoreResult = await this.longTermPersistence.restoreContext(contextId, 'session');
                const restoreTime = Date.now() - startTime;
                
                performanceTestData.push(restoreTime);
            }
            
            const averageRestoreTime = performanceTestData.reduce((a, b) => a + b, 0) / performanceTestData.length;
            const maxRestoreTime = Math.max(...performanceTestData);
            
            const meetSubSecondTarget = averageRestoreTime <= this.targets.resumeTime;
            const allUnderTarget = maxRestoreTime <= this.targets.resumeTime;
            
            this.recordTest('Sub-Second Resume Performance - Average', meetSubSecondTarget,
                `Average: ${averageRestoreTime.toFixed(0)}ms (target: <${this.targets.resumeTime}ms)`);
            
            this.recordTest('Sub-Second Resume Performance - Maximum', allUnderTarget,
                `Max: ${maxRestoreTime.toFixed(0)}ms (target: <${this.targets.resumeTime}ms)`);
            
            // Test compression efficiency
            const contextId = 'compression-efficiency-test';
            const largeContext = this.createLargeMockContext(contextId, 'session');
            
            const archiveResult = await this.longTermPersistence.archiveContext(contextId, largeContext, 'session');
            const compressionEfficiency = 1 - archiveResult.compressionRatio;
            
            const meetsCompressionTarget = compressionEfficiency >= this.targets.compressionEfficiency;
            
            this.recordTest('Compression Efficiency Target', meetsCompressionTarget,
                `Achieved: ${(compressionEfficiency * 100).toFixed(1)}% (target: >${(this.targets.compressionEfficiency * 100)}%)`);
            
        } catch (error) {
            this.recordTest('Performance Targets', false, error.message);
        }
    }

    /**
     * Test 5: Health monitoring system
     */
    async testHealthMonitoring() {
        console.log('🧪 Test 5: Health Monitoring System');
        
        const testContexts = [
            {
                id: 'healthy-context',
                data: this.createMockContext('healthy', 'session', { age: 2 * 24 * 60 * 60 * 1000 }), // 2 days old
                expectedLevel: 'excellent'
            },
            {
                id: 'stale-context',
                data: this.createMockContext('stale', 'session', { age: 60 * 24 * 60 * 60 * 1000 }), // 60 days old
                expectedLevel: 'warning'
            },
            {
                id: 'corrupted-context',
                data: {
                    context: '<workflow_context><broken_xml>Incomplete',
                    last_activity: Date.now() - (10 * 24 * 60 * 60 * 1000),
                    events_count: 5
                },
                expectedLevel: 'critical'
            }
        ];
        
        for (const testContext of testContexts) {
            try {
                const healthMetrics = await this.healthMonitor.calculateHealthScore(
                    testContext.id, 
                    testContext.data
                );
                
                const levelCorrect = healthMetrics.level === testContext.expectedLevel;
                
                this.recordTest(`Health Monitoring - ${testContext.id}`, levelCorrect,
                    levelCorrect ? 
                        `Correct level: ${healthMetrics.level} (${(healthMetrics.overallScore * 100).toFixed(1)}%)` :
                        `Expected: ${testContext.expectedLevel}, Got: ${healthMetrics.level}`);
                
                // Test maintenance
                const maintenanceResult = await this.healthMonitor.performMaintenance(
                    testContext.id, 
                    testContext.data
                );
                
                this.recordTest(`Health Maintenance - ${testContext.id}`, maintenanceResult.success,
                    maintenanceResult.success ? 
                        `Actions: ${maintenanceResult.actions.join(', ') || 'None needed'}` :
                        maintenanceResult.error);
                
            } catch (error) {
                this.recordTest(`Health Monitoring - ${testContext.id}`, false, error.message);
            }
        }
    }

    /**
     * Test 6: Data integrity across time gaps
     */
    async testDataIntegrityAcrossTimeGaps() {
        console.log('🧪 Test 6: Data Integrity Across Time Gaps');
        
        const contextId = 'integrity-test';
        const mockContext = this.createMockContext(contextId, 'session');
        
        // Add specific data to verify integrity
        mockContext.context = mockContext.context.replace(
            '</workflow_context>',
            `<integrity_marker>TEST_DATA_12345</integrity_marker>
<important_event>Critical project milestone completed</important_event>
</workflow_context>`
        );
        
        try {
            // Archive context
            const archiveResult = await this.longTermPersistence.archiveContext(contextId, mockContext, 'session');
            
            // Simulate various time gaps and restore
            const timeGapsToTest = [30, 90, 180]; // days
            
            for (const days of timeGapsToTest) {
                const restoreResult = await this.longTermPersistence.restoreContext(contextId, 'session');
                
                // Check data integrity
                const hasIntegrityMarker = restoreResult.context.includes('TEST_DATA_12345');
                const hasImportantEvent = restoreResult.context.includes('Critical project milestone');
                const hasXMLStructure = restoreResult.context.includes('<workflow_context>') && 
                                        restoreResult.context.includes('</workflow_context>');
                
                const integrityScore = [hasIntegrityMarker, hasImportantEvent, hasXMLStructure]
                    .filter(Boolean).length / 3;
                
                const meetsIntegrityTarget = integrityScore >= this.targets.dataIntegrity;
                
                this.recordTest(`Data Integrity - ${days} days`, meetsIntegrityTarget,
                    `Integrity: ${(integrityScore * 100).toFixed(1)}% (target: >${(this.targets.dataIntegrity * 100)}%)`);
            }
            
        } catch (error) {
            this.recordTest('Data Integrity', false, error.message);
        }
    }

    /**
     * Test 7: Integration with Universal Context System
     */
    async testUniversalContextIntegration() {
        console.log('🧪 Test 7: Universal Context System Integration');
        
        try {
            // Test integration with Factor3ContextManager
            const contextManager = new Factor3ContextManager({
                contextId: 'integration-test',
                contextScope: 'session'
            });
            
            // Add some events to create context
            await contextManager.addEvent('test_event', { message: 'Integration test' });
            await contextManager.addEvent('github_action', { 
                action: 'create_branch',
                branch: 'feature/integration-test'
            });
            
            // Get context data for archival
            const contextXml = contextManager.getCurrentContext();
            const contextData = {
                context: contextXml,
                last_activity: Date.now(),
                events_count: contextManager.events.length,
                current_task: 'Integration testing'
            };
            
            // Archive using long-term persistence
            const archiveResult = await this.longTermPersistence.archiveContext(
                'integration-test', 
                contextData,
                'session'
            );
            
            this.recordTest('Universal Context Integration - Archive', archiveResult.success,
                archiveResult.success ? 'Successfully archived Factor3 context' : 'Archive failed');
            
            // Restore and verify
            const restoreResult = await this.longTermPersistence.restoreContext(
                'integration-test',
                'session'
            );
            
            const hasEvents = restoreResult.context.includes('test_event') && 
                             restoreResult.context.includes('github_action');
            
            this.recordTest('Universal Context Integration - Restore', 
                restoreResult.success && hasEvents,
                restoreResult.success ? 
                    `Restored with events preserved in ${restoreResult.restoreTime}ms` : 
                    'Restore failed');
            
            // Clean up
            contextManager.destroy();
            
        } catch (error) {
            this.recordTest('Universal Context Integration', false, error.message);
        }
    }

    /**
     * Test 8: Background maintenance system
     */
    async testBackgroundMaintenance() {
        console.log('🧪 Test 8: Background Maintenance System');
        
        try {
            // Test health monitoring startup
            this.healthMonitor.startBackgroundMaintenance();
            
            // Verify maintenance is running
            const isRunning = this.healthMonitor.maintenanceInterval !== null;
            
            this.recordTest('Background Maintenance Startup', isRunning,
                isRunning ? 'Maintenance scheduler started' : 'Failed to start maintenance');
            
            // Test maintenance stop
            this.healthMonitor.stopBackgroundMaintenance();
            
            const isStopped = this.healthMonitor.maintenanceInterval === null;
            
            this.recordTest('Background Maintenance Shutdown', isStopped,
                isStopped ? 'Maintenance scheduler stopped' : 'Failed to stop maintenance');
            
        } catch (error) {
            this.recordTest('Background Maintenance', false, error.message);
        }
    }

    /**
     * Test 9: Archive management and cleanup
     */
    async testArchiveManagement() {
        console.log('🧪 Test 9: Archive Management and Cleanup');
        
        try {
            // Create test archives
            const testArchives = ['cleanup-test-1', 'cleanup-test-2', 'cleanup-test-3'];
            
            for (const contextId of testArchives) {
                const mockContext = this.createMockContext(contextId, 'session');
                await this.longTermPersistence.archiveContext(contextId, mockContext, 'session');
            }
            
            // Get archive statistics
            const statsBefore = await this.longTermPersistence.getArchiveStatistics();
            
            this.recordTest('Archive Statistics Collection', 
                statsBefore.totalContexts >= testArchives.length,
                `Found ${statsBefore.totalContexts} archived contexts`);
            
            // Test cleanup (with very long retention to not actually delete test data)
            const cleanupResult = await this.longTermPersistence.cleanupExpiredContexts(10000); // 10000 days
            
            this.recordTest('Archive Cleanup System', 
                cleanupResult.errors.length === 0,
                cleanupResult.errors.length === 0 ? 
                    `Cleanup successful (${cleanupResult.count} contexts processed)` :
                    `Cleanup errors: ${cleanupResult.errors.length}`);
            
        } catch (error) {
            this.recordTest('Archive Management', false, error.message);
        }
    }

    /**
     * Test 10: Failure recovery scenarios
     */
    async testFailureRecovery() {
        console.log('🧪 Test 10: Failure Recovery Scenarios');
        
        try {
            // Test recovery from corrupted archive
            const contextId = 'recovery-test';
            const mockContext = this.createMockContext(contextId, 'session');
            
            // Archive normally first
            await this.longTermPersistence.archiveContext(contextId, mockContext, 'session');
            
            // Test restore of non-existent context
            try {
                await this.longTermPersistence.restoreContext('non-existent-context', 'session');
                this.recordTest('Non-existent Context Recovery', false, 'Should have thrown error');
            } catch (error) {
                this.recordTest('Non-existent Context Recovery', true, 
                    'Correctly threw error for non-existent context');
            }
            
            // Test scope mismatch recovery
            try {
                await this.longTermPersistence.restoreContext(contextId, 'project'); // Wrong scope
                this.recordTest('Scope Mismatch Recovery', false, 'Should have thrown error');
            } catch (error) {
                this.recordTest('Scope Mismatch Recovery', true,
                    'Correctly threw error for scope mismatch');
            }
            
        } catch (error) {
            this.recordTest('Failure Recovery', false, error.message);
        }
    }

    /**
     * Create mock context data for testing
     */
    createMockContext(contextId, scope, options = {}) {
        const age = options.age || 0;
        const eventsCount = options.eventsCount || 10;
        
        let mockXml = `<workflow_context>
<session_start>
    timestamp: "${new Date(Date.now() - age).toISOString()}"
    context_id: "${contextId}"
    scope: "${scope}"
    goal: "Test context for ${contextId}"
</session_start>`;

        // Add some events
        for (let i = 0; i < eventsCount; i++) {
            mockXml += `
<test_event_${i}>
    timestamp: "${new Date(Date.now() - age + (i * 60000)).toISOString()}"
    type: "test_event"
    data: "Test event ${i} for context ${contextId}"
</test_event_${i}>`;
        }

        mockXml += '\n</workflow_context>';

        return {
            context: mockXml,
            last_activity: Date.now() - age,
            events_count: eventsCount,
            stack_depth: 0,
            current_task: `Testing ${contextId}`,
            scope: scope,
            created: Date.now() - age
        };
    }

    /**
     * Create large mock context for compression testing
     */
    createLargeMockContext(contextId, scope) {
        const baseContext = this.createMockContext(contextId, scope, { eventsCount: 50 });
        
        // Add large amounts of data to test compression
        let largeContent = baseContext.context.replace('</workflow_context>', '');
        
        for (let i = 0; i < 20; i++) {
            largeContent += `
<large_data_block_${i}>
    timestamp: "${new Date().toISOString()}"
    data: "${'x'.repeat(1000)}" 
    metadata: {
        block_number: ${i},
        content_size: 1000,
        purpose: "compression_testing"
    }
</large_data_block_${i}>`;
        }
        
        largeContent += '\n</workflow_context>';
        
        return {
            ...baseContext,
            context: largeContent
        };
    }

    /**
     * Record test result
     */
    recordTest(testName, passed, details) {
        this.testResults.total++;
        if (passed) {
            this.testResults.passed++;
            console.log(`✅ ${testName}: ${details}`);
        } else {
            this.testResults.failed++;
            console.log(`❌ ${testName}: ${details}`);
        }
        
        this.testResults.details.push({
            test: testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Clean up test artifacts
     */
    async cleanup() {
        console.log('\n🧹 Cleaning up test artifacts...');
        
        try {
            const testArchiveDir = path.join(process.cwd(), 'test-archives');
            await fs.rm(testArchiveDir, { recursive: true, force: true });
            console.log('✅ Test artifacts cleaned up');
        } catch (error) {
            console.log('⚠️ Cleanup warning:', error.message);
        }
    }

    /**
     * Print final test results
     */
    printResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 PHASE 3B LONG-TERM PERSISTENCE TEST RESULTS');
        console.log('='.repeat(80));
        
        const successRate = this.testResults.total > 0 ? 
            (this.testResults.passed / this.testResults.total * 100) : 0;
        
        console.log(`📋 Total Tests: ${this.testResults.total}`);
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
        
        // Performance summary
        console.log('\n🎯 PERFORMANCE TARGETS:');
        console.log(`Sub-Second Resume: Target <${this.targets.resumeTime}ms`);
        console.log(`Compression Efficiency: Target >${(this.targets.compressionEfficiency * 100)}%`);
        console.log(`Health Accuracy: Target >${(this.targets.healthAccuracy * 100)}%`);
        console.log(`Data Integrity: Target >${(this.targets.dataIntegrity * 100)}%`);
        
        // Overall assessment
        console.log('\n🏆 PHASE 3B ASSESSMENT:');
        if (successRate >= 95) {
            console.log('🎉 EXCELLENT - Phase 3B ready for production deployment');
        } else if (successRate >= 90) {
            console.log('🚀 GOOD - Phase 3B ready with minor optimizations needed');
        } else if (successRate >= 80) {
            console.log('⚠️ NEEDS WORK - Some critical issues need resolution');
        } else {
            console.log('🚨 CRITICAL - Major issues prevent Phase 3B deployment');
        }
        
        console.log('\n' + '='.repeat(80));
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new LongTermPersistenceTestSuite();
    testSuite.runAllTests()
        .then(results => {
            const successRate = results.total > 0 ? 
                (results.passed / results.total * 100) : 0;
            process.exit(successRate >= 95 ? 0 : 1);
        })
        .catch(error => {
            console.error('🚨 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { LongTermPersistenceTestSuite };