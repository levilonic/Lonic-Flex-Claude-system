/**
 * Agent Migration Helper - Phase 3 Migration Framework
 * Provides utilities for safely migrating agents from Heavy Agent Anti-Pattern
 * to ServiceContainer + PartitionedContextManager architecture
 */

const { initializeGlobalServiceContainer } = require('../services/service-container');

/**
 * Migration utilities for systematic agent transformation
 */
class AgentMigrationHelper {
    constructor() {
        this.migrationResults = new Map();
        this.performanceMetrics = new Map();
    }

    /**
     * Compare functionality between original and enhanced agent
     */
    async compareFunctionality(originalAgent, enhancedAgent, testScenarios) {
        console.log(`🔍 Comparing functionality: ${originalAgent.agentName} vs Enhanced`);

        const results = {
            agent: originalAgent.agentName,
            timestamp: Date.now(),
            scenarios: [],
            summary: {
                passed: 0,
                failed: 0,
                total: testScenarios.length
            }
        };

        for (let i = 0; i < testScenarios.length; i++) {
            const scenario = testScenarios[i];
            console.log(`   Testing scenario ${i + 1}: ${scenario.name}`);

            const scenarioResult = {
                name: scenario.name,
                original: null,
                enhanced: null,
                match: false,
                error: null
            };

            try {
                // Test original agent
                console.log(`     → Testing original agent...`);
                const originalStart = Date.now();
                scenarioResult.original = await scenario.testFunction(originalAgent);
                const originalTime = Date.now() - originalStart;

                // Test enhanced agent
                console.log(`     → Testing enhanced agent...`);
                const enhancedStart = Date.now();
                scenarioResult.enhanced = await scenario.testFunction(enhancedAgent);
                const enhancedTime = Date.now() - enhancedStart;

                // Compare results
                scenarioResult.match = this.compareResults(
                    scenarioResult.original,
                    scenarioResult.enhanced,
                    scenario.compareFunction
                );

                scenarioResult.performanceImprovement = originalTime - enhancedTime;
                scenarioResult.timing = { original: originalTime, enhanced: enhancedTime };

                if (scenarioResult.match) {
                    results.summary.passed++;
                    console.log(`     ✅ PASS - Results match`);
                    if (scenarioResult.performanceImprovement > 0) {
                        console.log(`        Performance: ${scenarioResult.performanceImprovement}ms improvement`);
                    }
                } else {
                    results.summary.failed++;
                    console.log(`     ❌ FAIL - Results don't match`);
                }

            } catch (error) {
                results.summary.failed++;
                scenarioResult.error = error.message;
                console.log(`     💥 ERROR: ${error.message}`);
            }

            results.scenarios.push(scenarioResult);
        }

        const successRate = (results.summary.passed / results.summary.total) * 100;
        console.log(`📊 Functionality Comparison Results: ${successRate}% success rate`);

        this.migrationResults.set(originalAgent.agentName, results);
        return results;
    }

    /**
     * Compare results using custom comparison function or default deep comparison
     */
    compareResults(original, enhanced, customCompareFunction) {
        if (customCompareFunction) {
            return customCompareFunction(original, enhanced);
        }

        // Default comparison - check key result fields
        if (typeof original !== typeof enhanced) {
            return false;
        }

        if (typeof original === 'object' && original !== null) {
            // Compare success status if available
            if (original.success !== undefined && enhanced.success !== undefined) {
                return original.success === enhanced.success;
            }

            // Compare result structure
            const originalKeys = Object.keys(original);
            const enhancedKeys = Object.keys(enhanced);

            if (originalKeys.length !== enhancedKeys.length) {
                return false;
            }

            // Check important fields match
            const importantFields = ['success', 'result', 'data', 'status', 'error'];
            for (const field of importantFields) {
                if (original[field] !== enhanced[field]) {
                    return false;
                }
            }

            return true;
        }

        return original === enhanced;
    }

    /**
     * Performance comparison between original and enhanced agents
     */
    async comparePerformance(originalAgent, enhancedAgent, workloadTests) {
        console.log(`⚡ Performance comparison: ${originalAgent.agentName}`);

        const metrics = {
            agent: originalAgent.agentName,
            timestamp: Date.now(),
            tests: [],
            summary: {
                totalImprovement: 0,
                averageImprovement: 0,
                contextUsageImprovement: 0,
                memoryUsageImprovement: 0
            }
        };

        for (const test of workloadTests) {
            console.log(`   Running performance test: ${test.name}`);

            // Measure original agent performance
            const originalMetrics = await this.measureAgentPerformance(originalAgent, test);

            // Measure enhanced agent performance
            const enhancedMetrics = await this.measureAgentPerformance(enhancedAgent, test);

            const improvement = {
                name: test.name,
                original: originalMetrics,
                enhanced: enhancedMetrics,
                improvements: {
                    executionTime: originalMetrics.executionTime - enhancedMetrics.executionTime,
                    memoryUsage: originalMetrics.memoryUsage - enhancedMetrics.memoryUsage,
                    contextUsage: originalMetrics.contextUsage - enhancedMetrics.contextUsage
                }
            };

            metrics.tests.push(improvement);
            metrics.summary.totalImprovement += improvement.improvements.executionTime;

            console.log(`     Original: ${originalMetrics.executionTime}ms, Enhanced: ${enhancedMetrics.executionTime}ms`);
            console.log(`     Improvement: ${improvement.improvements.executionTime}ms`);
        }

        metrics.summary.averageImprovement = metrics.summary.totalImprovement / workloadTests.length;

        this.performanceMetrics.set(originalAgent.agentName, metrics);
        return metrics;
    }

    /**
     * Measure individual agent performance
     */
    async measureAgentPerformance(agent, test) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage();

        // Get initial context stats if available
        let initialContextSize = 0;
        if (agent.contextManager && typeof agent.contextManager.events !== 'undefined') {
            initialContextSize = agent.contextManager.events.length;
        }

        try {
            // Run the performance test
            await test.workload(agent);

            const endTime = Date.now();
            const endMemory = process.memoryUsage();

            // Get final context stats
            let finalContextSize = 0;
            if (agent.contextManager && typeof agent.contextManager.events !== 'undefined') {
                finalContextSize = agent.contextManager.events.length;
            }

            // THEATER CODE ELIMINATED: Evidence-based migration success validation
            const migrationValidation = this.validateMigrationSuccess({
                executionTime: endTime - startTime,
                memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
                contextUsage: finalContextSize - initialContextSize,
                agent: agent
            });

            return {
                executionTime: endTime - startTime,
                memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
                contextUsage: finalContextSize - initialContextSize,
                success: migrationValidation.success,
                validation: migrationValidation,
                evidence: migrationValidation.evidence
            };

        } catch (error) {
            const endTime = Date.now();
            const endMemory = process.memoryUsage();

            return {
                executionTime: endTime - startTime,
                memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
                contextUsage: 0,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate migration success based on comprehensive criteria
     */
    validateMigration(agentName) {
        const functionalityResults = this.migrationResults.get(agentName);
        const performanceResults = this.performanceMetrics.get(agentName);

        if (!functionalityResults || !performanceResults) {
            return {
                valid: false,
                reason: 'Incomplete migration testing - missing functionality or performance results'
            };
        }

        // Check functionality preservation
        const functionalitySuccess = (functionalityResults.summary.passed / functionalityResults.summary.total) >= 1.0;
        if (!functionalitySuccess) {
            return {
                valid: false,
                reason: `Functionality regression detected: ${functionalityResults.summary.failed} scenarios failed`
            };
        }

        // Check performance improvements (should at least not regress significantly)
        const avgImprovement = performanceResults.summary.averageImprovement;
        if (avgImprovement < -1000) { // Allow up to 1 second regression
            return {
                valid: false,
                reason: `Significant performance regression: ${Math.abs(avgImprovement)}ms slower on average`
            };
        }

        return {
            valid: true,
            functionalitySuccess: functionalitySuccess,
            performanceImprovement: avgImprovement,
            details: {
                scenariosPassed: functionalityResults.summary.passed,
                scenariosTotal: functionalityResults.summary.total,
                averageSpeedup: avgImprovement
            }
        };
    }

    /**
     * Generate migration report
     */
    generateMigrationReport(agentName) {
        const validation = this.validateMigration(agentName);
        const functionalityResults = this.migrationResults.get(agentName);
        const performanceResults = this.performanceMetrics.get(agentName);

        return {
            agent: agentName,
            timestamp: Date.now(),
            valid: validation.valid,
            validation,
            functionalityResults,
            performanceResults,
            recommendation: validation.valid ? 'APPROVED FOR PRODUCTION' : 'REQUIRES FIXES BEFORE PRODUCTION'
        };
    }

    /**
     * Helper to create ServiceContainer for testing
     */
    async createTestServiceContainer() {
        const serviceContainer = await initializeGlobalServiceContainer();
        return serviceContainer;
    }

    /**
     * Clean up test resources
     */
    async cleanup() {
        // Clear stored results
        this.migrationResults.clear();
        this.performanceMetrics.clear();

        console.log('🧹 Migration testing resources cleaned up');
    }

    /**
     * ValidatedAgent-style evidence-based migration success validation
     */
    validateMigrationSuccess(context) {
        const evidence = {
            executionTime: context.executionTime,
            memoryUsage: context.memoryUsage,
            contextUsage: context.contextUsage,
            agentExists: !!context.agent,
            executionWithinLimits: context.executionTime < 30000, // 30 seconds max
            memoryReasonable: Math.abs(context.memoryUsage) < 100 * 1024 * 1024, // 100MB reasonable
            contextManaged: Math.abs(context.contextUsage) < 1000 // 1000 events reasonable
        };

        const successChecks = [];

        // Agent existence check
        successChecks.push({
            check: 'agent_exists',
            passed: evidence.agentExists,
            evidence: { agentExists: evidence.agentExists }
        });

        // Execution time check
        successChecks.push({
            check: 'execution_time',
            passed: evidence.executionWithinLimits && evidence.executionTime > 0,
            evidence: { executionTime: evidence.executionTime, executionWithinLimits: evidence.executionWithinLimits }
        });

        // Memory usage check
        successChecks.push({
            check: 'memory_usage',
            passed: evidence.memoryReasonable,
            evidence: { memoryUsage: evidence.memoryUsage, memoryReasonable: evidence.memoryReasonable }
        });

        // Context usage check
        successChecks.push({
            check: 'context_usage',
            passed: evidence.contextManaged,
            evidence: { contextUsage: evidence.contextUsage, contextManaged: evidence.contextManaged }
        });

        const passedChecks = successChecks.filter(check => check.passed).length;
        const totalChecks = successChecks.length;
        const overallSuccess = passedChecks >= totalChecks * 0.75; // 75% threshold

        return {
            success: overallSuccess,
            evidence: evidence,
            validation: { checks: successChecks, passedChecks, totalChecks },
            reason: overallSuccess ? `Migration validation passed: ${passedChecks}/${totalChecks}` : `Migration validation failed: ${passedChecks}/${totalChecks}`
        };
    }
}

module.exports = { AgentMigrationHelper };