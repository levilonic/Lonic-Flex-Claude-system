#!/usr/bin/env node
const { info, warn, error } = require('../services/logger');
/**
 * Context Health Checker - Check current context usage and suggest actions
 * Usage: npm run context-health
 */

const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const { TokenCounter } = require('./token-counter');
const { ContextWindowMonitor } = require('./context-window-monitor');

class ContextHealthChecker {
    constructor() {
        this.tokenCounter = new TokenCounter();
        this.results = {
            status: 'unknown',
            issues: [],
            recommendations: [],
            metrics: {}
        };
    }

    /**
     * Run comprehensive context health check
     */
    async runHealthCheck(contextSource = null) {
        info('🏥 Context Health Check - Auto-Compact Prevention Report\n');
        
        try {
            // Test 1: Token Counter Functionality
            await this.checkTokenCounter();
            
            // Test 2: Context Manager Integration
            await this.checkContextManager();
            
            // Test 3: Monitor System
            await this.checkMonitorSystem();
            
            // Test 4: External Context (if provided)
            if (contextSource) {
                await this.checkExternalContext(contextSource);
            }
            
            // Generate recommendations
            this.generateRecommendations();
            
            // Display results
            this.displayResults();
            
            return this.results;
            
        } catch (error) {
            error('❌ Health check failed:', error);
            this.results.status = 'error';
            this.results.issues.push(`Health check error: ${error.message}`);
            return this.results;
        }
    }

    /**
     * Test token counting functionality
     */
    async checkTokenCounter() {
        info('🔢 Testing Token Counter...');
        
        try {
            // Test basic token counting
            const testContent = 'This is a test context for token counting functionality.';
            const tokenData = await this.tokenCounter.countTokens(testContent);
            
            this.results.metrics.tokenCounter = {
                working: true,
                source: tokenData.source,
                testTokens: tokenData.total_tokens,
                fromCache: tokenData.fromCache
            };
            
            info(`  ✅ Token counting working (${tokenData.source}): ${tokenData.total_tokens} tokens`);
            
            // Test API vs estimation accuracy
            if (this.tokenCounter.anthropicClient) {
                try {
                    const apiResult = await this.tokenCounter.countTokens(testContent, { forceAPI: true });
                    const estimateResult = await this.tokenCounter.countTokens(testContent, { forceEstimate: true });
                    
                    const accuracy = 1 - Math.abs(apiResult.total_tokens - estimateResult.total_tokens) / apiResult.total_tokens;
                    
                    this.results.metrics.tokenAccuracy = {
                        apiTokens: apiResult.total_tokens,
                        estimatedTokens: estimateResult.total_tokens,
                        accuracy: accuracy * 100
                    };
                    
                    info(`  📊 Estimation accuracy: ${(accuracy * 100).toFixed(1)}%`);
                    
                    if (accuracy < 0.8) {
                        this.results.issues.push('Token estimation accuracy below 80% - consider API integration');
                    }
                } catch (error) {
                    info('  ⚠️ API testing failed - using estimation only');
                    this.results.issues.push('Anthropic API not available - using estimation fallback');
                }
            } else {
                info('  ⚠️ Anthropic API not configured - using estimation');
                this.results.issues.push('Anthropic API not configured - estimation only');
            }
            
        } catch (error) {
            info(`  ❌ Token counter failed: ${error.message}`);
            this.results.issues.push(`Token counter not working: ${error.message}`);
            this.results.metrics.tokenCounter = { working: false, error: error.message };
        }
    }

    /**
     * Test context manager integration
     */
    async checkContextManager() {
        info('\n📄 Testing Context Manager...');
        
        try {
            const contextManager = new Factor3ContextManager({
                enableMonitoring: false // Disable for testing
            });
            
            // Test basic functionality
            await contextManager.addEvent('health_check', { test: true });
            const context = contextManager.getCurrentContext();
            const summary = await contextManager.getContextSummary();
            
            this.results.metrics.contextManager = {
                working: true,
                eventsCount: summary.total_events,
                contextSize: summary.context_size_chars,
                tokenCount: summary.context_tokens,
                tokenPercentage: summary.token_percentage
            };
            
            info(`  ✅ Context manager working`);
            info(`  📊 Test context: ${summary.context_tokens} tokens (${summary.token_percentage.toFixed(1)}%)`);
            
            // Test token percentage functionality
            const tokenData = await contextManager.getTokenPercentage();
            if (tokenData.percentage !== undefined) {
                info(`  📈 Token monitoring: ${tokenData.remainingPercentage.toFixed(0)}% until auto-compact`);
            }
            
            contextManager.destroy();
            
        } catch (error) {
            info(`  ❌ Context manager failed: ${error.message}`);
            this.results.issues.push(`Context manager not working: ${error.message}`);
            this.results.metrics.contextManager = { working: false, error: error.message };
        }
    }

    /**
     * Test monitoring system
     */
    async checkMonitorSystem() {
        info('\n📊 Testing Monitor System...');
        
        try {
            const monitor = new ContextWindowMonitor({
                warningThreshold: 40,
                criticalThreshold: 70,
                emergencyThreshold: 90
            });
            
            // Test threshold checking
            const mockContext = '<workflow_context>\n<test>Mock context for monitoring test</test>\n</workflow_context>';
            const state = await monitor.checkContextUsage(mockContext);
            
            this.results.metrics.monitor = {
                working: true,
                tokens: state.tokens,
                percentage: state.percentage,
                level: state.level,
                thresholds: monitor.thresholds
            };
            
            info(`  ✅ Monitor system working`);
            info(`  🎯 Threshold: Warning at ${monitor.thresholds.warning}%, Critical at ${monitor.thresholds.critical}%`);
            info(`  📊 Test result: ${state.level.toUpperCase()} level`);
            
            monitor.stopMonitoring();
            
        } catch (error) {
            info(`  ❌ Monitor system failed: ${error.message}`);
            this.results.issues.push(`Monitor system not working: ${error.message}`);
            this.results.metrics.monitor = { working: false, error: error.message };
        }
    }

    /**
     * Check external context source
     */
    async checkExternalContext(contextSource) {
        info('\n🔍 Testing External Context...');
        
        try {
            const tokenData = await contextSource.getTokenPercentage();
            const summary = await contextSource.getContextSummary();
            
            this.results.metrics.externalContext = {
                working: true,
                tokens: tokenData.tokens,
                percentage: tokenData.percentage,
                remainingPercentage: tokenData.remainingPercentage,
                warningLevel: summary.warning_level,
                eventsCount: summary.total_events
            };
            
            info(`  ✅ External context working`);
            info(`  📊 Current usage: ${tokenData.tokens} tokens (${tokenData.percentage.toFixed(1)}%)`);
            info(`  🎯 Status: ${summary.warning_level.toUpperCase()}`);
            
            // Check for high usage
            if (tokenData.percentage > 60) {
                this.results.issues.push(`High context usage: ${tokenData.percentage.toFixed(1)}% - approaching limits`);
            }
            
        } catch (error) {
            info(`  ❌ External context check failed: ${error.message}`);
            this.results.issues.push(`External context issue: ${error.message}`);
        }
    }

    /**
     * Generate health recommendations
     */
    generateRecommendations() {
        const recs = this.results.recommendations;
        
        // Check overall system health
        const hasWorkingTokens = this.results.metrics.tokenCounter?.working;
        const hasWorkingContext = this.results.metrics.contextManager?.working;
        const hasWorkingMonitor = this.results.metrics.monitor?.working;
        
        if (hasWorkingTokens && hasWorkingContext && hasWorkingMonitor) {
            if (this.results.issues.length === 0) {
                this.results.status = 'healthy';
                recs.push('✅ System is healthy - no actions needed');
            } else {
                this.results.status = 'warning';
                recs.push('⚠️ System working but has minor issues - see recommendations below');
            }
        } else {
            this.results.status = 'critical';
            recs.push('🔴 Critical issues found - immediate action required');
        }

        // Specific recommendations
        if (!hasWorkingTokens) {
            recs.push('🔧 Install/configure Anthropic SDK for accurate token counting');
            recs.push('📝 Set ANTHROPIC_API_KEY environment variable');
        }

        if (!this.tokenCounter.anthropicClient) {
            recs.push('⚡ Consider adding Anthropic API key for 95%+ token counting accuracy');
        }

        const accuracy = this.results.metrics.tokenAccuracy?.accuracy;
        if (accuracy && accuracy < 80) {
            recs.push('📊 Token estimation accuracy low - verify character-to-token ratio');
        }

        // Context-specific recommendations
        const extContext = this.results.metrics.externalContext;
        if (extContext) {
            if (extContext.percentage > 70) {
                recs.push('🚨 Context usage critical - run emergency compact');
                recs.push('📝 Command: npm run compact-context');
            } else if (extContext.percentage > 40) {
                recs.push('⚠️ Context usage above 40% threshold - monitor closely');
                recs.push('🔧 Consider clearing resolved errors: context.clearResolvedErrors()');
            }
        }

        // Performance recommendations
        if (this.results.metrics.tokenCounter?.fromCache === false) {
            recs.push('💾 Enable token caching for better performance');
        }
    }

    /**
     * Display health check results
     */
    displayResults() {
        info('\n' + '='.repeat(60));
        info('CONTEXT HEALTH REPORT');
        info('='.repeat(60));
        
        // Overall status
        const statusEmojis = {
            healthy: '🟢',
            warning: '🟡', 
            critical: '🔴',
            error: '💥'
        };
        
        info(`\nOverall Status: ${statusEmojis[this.results.status]} ${this.results.status.toUpperCase()}`);
        
        // Component status
        info('\n📊 Component Status:');
        if (this.results.metrics.tokenCounter) {
            const status = this.results.metrics.tokenCounter.working ? '✅' : '❌';
            info(`  ${status} Token Counter (${this.results.metrics.tokenCounter.source || 'error'})`);
        }
        
        if (this.results.metrics.contextManager) {
            const status = this.results.metrics.contextManager.working ? '✅' : '❌';
            info(`  ${status} Context Manager`);
        }
        
        if (this.results.metrics.monitor) {
            const status = this.results.metrics.monitor.working ? '✅' : '❌';
            info(`  ${status} Monitor System`);
        }
        
        // Issues
        if (this.results.issues.length > 0) {
            info('\n⚠️ Issues Found:');
            this.results.issues.forEach((issue, i) => {
                info(`  ${i + 1}. ${issue}`);
            });
        }
        
        // Recommendations  
        info('\n💡 Recommendations:');
        this.results.recommendations.forEach((rec, i) => {
            info(`  ${i + 1}. ${rec}`);
        });
        
        // Context metrics (if available)
        if (this.results.metrics.externalContext) {
            const ctx = this.results.metrics.externalContext;
            info('\n📈 Current Context Usage:');
            info(`  Tokens: ${ctx.tokens?.toLocaleString() || 'N/A'}`);
            info(`  Usage: ${ctx.percentage?.toFixed(1) || 'N/A'}%`);
            info(`  Remaining: ${ctx.remainingPercentage?.toFixed(1) || 'N/A'}% until auto-compact`);
            info(`  Level: ${ctx.warningLevel?.toUpperCase() || 'UNKNOWN'}`);
        }
        
        info('\n' + '='.repeat(60));
        
        // Exit code based on status
        if (this.results.status === 'critical' || this.results.status === 'error') {
            process.exitCode = 1;
        }
    }

    /**
     * Quick status check (minimal output)
     */
    async quickCheck() {
        try {
            const tokenCounter = new TokenCounter();
            const testResult = await tokenCounter.countTokens('test');
            
            info(`🎯 Context System: ${testResult.source === 'api' ? 'OPTIMAL' : 'FUNCTIONAL'}`);
            info(`📊 Token counting: ${testResult.total_tokens} tokens (${testResult.source})`);
            
            return testResult.source === 'api' ? 'optimal' : 'functional';
        } catch (error) {
            error(`);
            return 'broken';
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const checker = new ContextHealthChecker();
    
    if (args.includes('--quick')) {
        await checker.quickCheck();
    } else {
        await checker.runHealthCheck();
    }
}

module.exports = { ContextHealthChecker };

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        error('Health check failed:', error);
        process.exit(1);
    });
}