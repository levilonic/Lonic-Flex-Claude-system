/**
 * Context Health Monitor - Phase 3B
 * Automatic degradation detection and proactive context maintenance
 * Provides health scoring, alerts, and background maintenance
 */

const { TokenCounter } = require('./token-counter');
const { LongTermPersistence } = require('./long-term-persistence');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class ContextHealthMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.tokenCounter = new TokenCounter();
        this.longTermPersistence = new LongTermPersistence(options.persistence);
        this.healthLogDir = options.healthLogDir || path.join(process.cwd(), 'contexts', 'long-term', 'health-logs');
        
        // Health scoring weights (total = 1.0)
        this.healthWeights = {
            freshness: 0.3,        // How recently was context active
            usagePattern: 0.2,     // Consistent vs sporadic usage
            dataIntegrity: 0.25,   // Context corruption indicators
            compressionHealth: 0.15, // Compression efficiency
            tokenEfficiency: 0.1   // Token usage optimization
        };

        // Health thresholds (adjusted for realistic scoring)
        this.healthThresholds = {
            excellent: 0.8,        // 80%+ health score (more achievable for healthy contexts)
            good: 0.6,            // 60-79% health score  
            warning: 0.4,         // 40-59% health score
            critical: 0.2,        // 20-39% health score
            failing: 0.0          // Below 20% health score
        };

        // Background maintenance schedule
        this.maintenanceConfig = {
            enabled: options.backgroundMaintenance !== false,
            interval: options.maintenanceInterval || 6 * 60 * 60 * 1000, // 6 hours
            maxConcurrentJobs: options.maxConcurrentJobs || 3,
            quietHours: options.quietHours || { start: 22, end: 6 } // 10pm - 6am
        };

        this.runningJobs = new Set();
        this.maintenanceInterval = null;
        
        console.log('✅ ContextHealthMonitor initialized with proactive maintenance');
        this.ensureDirectories();
    }

    /**
     * Ensure health log directories exist
     */
    async ensureDirectories() {
        try {
            await fs.mkdir(this.healthLogDir, { recursive: true });
        } catch (error) {
            // Directory creation handled gracefully
        }
    }

    /**
     * Calculate comprehensive health score for a context
     */
    async calculateHealthScore(contextId, contextData, metadata = null) {
        const healthMetrics = {
            contextId,
            timestamp: Date.now(),
            scores: {},
            overallScore: 0,
            level: 'unknown',
            recommendations: []
        };

        try {
            // 1. Freshness Score (30% weight) - How recently was context active
            healthMetrics.scores.freshness = this.calculateFreshnessScore(
                contextData.last_activity || metadata?.lastActivity || Date.now()
            );

            // 2. Usage Pattern Score (20% weight) - Consistency of usage
            healthMetrics.scores.usagePattern = await this.calculateUsagePatternScore(
                contextId, contextData
            );

            // 3. Data Integrity Score (25% weight) - Context corruption indicators
            healthMetrics.scores.dataIntegrity = await this.calculateDataIntegrityScore(
                contextData.context || contextData, metadata
            );

            // 4. Compression Health Score (15% weight) - Compression efficiency
            healthMetrics.scores.compressionHealth = await this.calculateCompressionHealthScore(
                contextData, metadata
            );

            // 5. Token Efficiency Score (10% weight) - Token usage optimization
            healthMetrics.scores.tokenEfficiency = await this.calculateTokenEfficiencyScore(
                contextData.context || contextData
            );

            // Calculate weighted overall score
            healthMetrics.overallScore = Object.entries(this.healthWeights).reduce((total, [metric, weight]) => {
                return total + (healthMetrics.scores[metric] || 0) * weight;
            }, 0);

            // Determine health level
            healthMetrics.level = this.determineHealthLevel(healthMetrics.overallScore);

            // Generate recommendations
            healthMetrics.recommendations = this.generateHealthRecommendations(healthMetrics);

            return healthMetrics;

        } catch (error) {
            console.error('Health score calculation failed:', error);
            return {
                ...healthMetrics,
                error: error.message,
                overallScore: 0,
                level: 'error'
            };
        }
    }

    /**
     * Calculate freshness score based on last activity
     */
    calculateFreshnessScore(lastActivity) {
        const age = Date.now() - lastActivity;
        const days = age / (24 * 60 * 60 * 1000);

        // Exponential decay: 100% for today, 50% at 7 days, 10% at 30 days, 1% at 90 days
        if (days <= 1) return 1.0;
        if (days <= 7) return 0.8 - ((days - 1) * 0.3 / 6);  // 80% to 50%
        if (days <= 30) return 0.5 - ((days - 7) * 0.4 / 23); // 50% to 10%  
        if (days <= 90) return 0.1 - ((days - 30) * 0.09 / 60); // 10% to 1%
        return 0.01; // Very stale contexts
    }

    /**
     * Calculate usage pattern score based on historical activity
     */
    async calculateUsagePatternScore(contextId, contextData) {
        // For now, use simple heuristics - in full implementation would analyze usage logs
        const eventsCount = contextData.events_count || 0;
        const stackDepth = contextData.stack_depth || 0;

        // More events and managed context switching indicates healthy usage
        let score = Math.min(eventsCount / 50, 1.0); // 50+ events = max score

        // Bonus for managed context stack (shows organized work)
        if (stackDepth > 0 && stackDepth <= 3) {
            score += 0.2; // Moderate stack depth is good
        } else if (stackDepth > 3) {
            score -= 0.1; // Too deep might indicate confusion
        }

        return Math.max(0, Math.min(1.0, score));
    }

    /**
     * Calculate data integrity score
     */
    async calculateDataIntegrityScore(contextContent, metadata = null) {
        let score = 1.0;

        try {
            const contextXml = typeof contextContent === 'string' ? 
                contextContent : JSON.stringify(contextContent);

            // Handle edge case: very short or empty content
            if (!contextXml || contextXml.length < 10) {
                return 0.1; // Definitely corrupted
            }

            // Check XML structure validity with better edge case handling
            const hasOpeningTag = contextXml.includes('<workflow_context>') || contextXml.includes('<session_context>');
            const hasClosingTag = contextXml.includes('</workflow_context>') || contextXml.includes('</session_context>');
            
            if (!hasOpeningTag && !hasClosingTag) {
                score -= 0.4; // Major structure issue
            } else if (!hasOpeningTag || !hasClosingTag) {
                score -= 0.2; // Partial structure issue
            }

            // Enhanced corruption indicators with better edge case handling
            const corruptionIndicators = [
                /\x00/g,  // Null bytes
                /<[^>]*$/g, // Incomplete XML tags
                /&[^;]*$/g, // Incomplete XML entities
                /timestamp[:\s]*""[^"]/g, // Malformed timestamps
                />\s*</g.test(contextXml) ? false : /<>\s*[^<]/g // Empty tags
            ];

            let corruptionCount = 0;
            for (const indicator of corruptionIndicators) {
                if (indicator && indicator.test && indicator.test(contextXml)) {
                    corruptionCount++;
                    score -= 0.08; // Smaller penalty per indicator
                }
            }

            // Verify fingerprint if metadata available
            if (metadata?.fingerprint) {
                try {
                    const crypto = require('crypto');
                    const currentFingerprint = crypto.createHash('sha256')
                        .update(contextXml).digest('hex').substring(0, 16);
                    
                    if (currentFingerprint !== metadata.fingerprint) {
                        score -= 0.15; // Reduced penalty for fingerprint mismatch
                    }
                } catch (fingerprintError) {
                    score -= 0.1; // Penalty for fingerprint calculation failure
                }
            }

            // Improved content length validation with context
            if (contextXml.length < 50) {
                score -= 0.3; // Reduced penalty for short content
            } else if (contextXml.length > 1000000) {
                score -= 0.1; // Penalty for suspiciously large content
            }

            // Check for essential elements that should be preserved
            const essentialElements = ['timestamp', 'context', 'session', 'goal'];
            let essentialElementsFound = 0;
            for (const element of essentialElements) {
                if (contextXml.toLowerCase().includes(element)) {
                    essentialElementsFound++;
                }
            }
            
            // Bonus for having essential elements
            if (essentialElementsFound >= 2) {
                score += 0.1;
            }

        } catch (error) {
            // Better error handling for edge cases
            console.warn('Data integrity calculation error:', error.message);
            score = 0.2; // Less severe penalty for calculation errors
        }

        return Math.max(0.1, Math.min(1.0, score)); // Ensure minimum score of 0.1
    }

    /**
     * Calculate compression health score
     */
    async calculateCompressionHealthScore(contextData, metadata = null) {
        if (!metadata) return 0.8; // Default score for non-archived contexts

        try {
            // Ideal compression ratios by archive level
            const idealCompressions = {
                'Active': 0.7,
                'Dormant': 0.5, 
                'Sleeping': 0.3,
                'Deep Sleep': 0.2
            };

            const ideal = idealCompressions[metadata.archiveLevel] || 0.5;
            const actual = metadata.compressionRatio;

            // Score based on how close actual compression is to ideal
            const efficiency = 1 - Math.abs(actual - ideal) / ideal;
            return Math.max(0, Math.min(1.0, efficiency));

        } catch (error) {
            return 0.5; // Default score on error
        }
    }

    /**
     * Calculate token efficiency score
     */
    async calculateTokenEfficiencyScore(contextContent) {
        try {
            const contextXml = typeof contextContent === 'string' ? 
                contextContent : JSON.stringify(contextContent);

            const tokenData = await this.tokenCounter.countContextTokens(contextXml);
            const charToTokenRatio = contextXml.length / tokenData.total_tokens;

            // Efficient contexts have good char-to-token ratios (around 3-4 chars per token)
            const idealRatio = 3.5;
            const efficiency = 1 - Math.abs(charToTokenRatio - idealRatio) / idealRatio;
            
            return Math.max(0.1, Math.min(1.0, efficiency));

        } catch (error) {
            return 0.5; // Default score on error
        }
    }

    /**
     * Determine health level from overall score
     */
    determineHealthLevel(score) {
        if (score >= this.healthThresholds.excellent) return 'excellent';
        if (score >= this.healthThresholds.good) return 'good';  
        if (score >= this.healthThresholds.warning) return 'warning';
        if (score >= this.healthThresholds.critical) return 'critical';
        return 'failing';
    }

    /**
     * Generate health recommendations based on scores
     */
    generateHealthRecommendations(healthMetrics) {
        const recommendations = [];
        const scores = healthMetrics.scores;

        if (scores.freshness < 0.5) {
            recommendations.push('Context is stale - consider archiving or refreshing');
        }

        if (scores.dataIntegrity < 0.7) {
            recommendations.push('Data integrity issues detected - manual review recommended');
        }

        if (scores.compressionHealth < 0.6) {
            recommendations.push('Compression efficiency is poor - context may need reprocessing');
        }

        if (scores.tokenEfficiency < 0.5) {
            recommendations.push('Token usage is inefficient - context pruning recommended');
        }

        if (scores.usagePattern < 0.4) {
            recommendations.push('Irregular usage pattern - context may benefit from restructuring');
        }

        if (healthMetrics.level === 'excellent') {
            recommendations.push('Context is in excellent health');
        } else if (healthMetrics.level === 'failing') {
            recommendations.push('URGENT: Context requires immediate attention or archival');
        }

        return recommendations;
    }

    /**
     * Perform background maintenance on a context
     */
    async performMaintenance(contextId, contextData, metadata = null) {
        if (this.runningJobs.has(contextId)) {
            return { skipped: true, reason: 'Already running' };
        }

        this.runningJobs.add(contextId);
        const startTime = Date.now();

        try {
            console.log(`🔧 Starting maintenance for context: ${contextId}`);

            // Calculate health score
            const healthMetrics = await this.calculateHealthScore(contextId, contextData, metadata);
            
            // Log health status
            await this.logHealthStatus(contextId, healthMetrics);

            // Perform maintenance actions based on health level
            const actions = await this.executeMaintenance(contextId, contextData, healthMetrics, metadata);

            const maintenanceTime = Date.now() - startTime;
            console.log(`✅ Maintenance completed for ${contextId} in ${maintenanceTime}ms`);

            // Emit health event
            this.emit('maintenance_completed', {
                contextId,
                healthLevel: healthMetrics.level,
                overallScore: healthMetrics.overallScore,
                actions,
                maintenanceTime
            });

            return {
                success: true,
                contextId,
                healthMetrics,
                actions,
                maintenanceTime
            };

        } catch (error) {
            console.error(`Maintenance failed for ${contextId}:`, error);
            this.emit('maintenance_failed', { contextId, error: error.message });
            return {
                success: false,
                contextId,
                error: error.message
            };
        } finally {
            this.runningJobs.delete(contextId);
        }
    }

    /**
     * Execute maintenance actions based on health assessment
     */
    async executeMaintenance(contextId, contextData, healthMetrics, metadata) {
        const actions = [];
        const level = healthMetrics.level;

        // Archive if context is stale and in good condition
        if (healthMetrics.scores.freshness < 0.3 && healthMetrics.scores.dataIntegrity > 0.8) {
            if (!metadata) { // Only archive if not already archived
                try {
                    await this.longTermPersistence.archiveContext(contextId, contextData);
                    actions.push('archived_context');
                } catch (error) {
                    actions.push(`archive_failed: ${error.message}`);
                }
            }
        }

        // Alert for critical health issues
        if (level === 'critical' || level === 'failing') {
            this.emit('context_health_alert', {
                contextId,
                level,
                score: healthMetrics.overallScore,
                recommendations: healthMetrics.recommendations
            });
            actions.push('health_alert_sent');
        }

        // Schedule cleanup for failing contexts
        if (level === 'failing' && healthMetrics.scores.dataIntegrity < 0.3) {
            actions.push('marked_for_cleanup');
        }

        return actions;
    }

    /**
     * Log health status to file
     */
    async logHealthStatus(contextId, healthMetrics) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            contextId,
            healthLevel: healthMetrics.level,
            overallScore: healthMetrics.overallScore,
            scores: healthMetrics.scores,
            recommendations: healthMetrics.recommendations
        };

        const logFile = path.join(this.healthLogDir, `${contextId}-health.json`);
        
        try {
            // Read existing log or create new one
            let healthHistory = [];
            try {
                const existingLog = await fs.readFile(logFile, 'utf8');
                healthHistory = JSON.parse(existingLog);
            } catch (error) {
                // New log file
            }

            healthHistory.push(logEntry);
            
            // Keep only last 100 entries
            if (healthHistory.length > 100) {
                healthHistory = healthHistory.slice(-100);
            }

            await fs.writeFile(logFile, JSON.stringify(healthHistory, null, 2));
        } catch (error) {
            console.error('Failed to log health status:', error);
        }
    }

    /**
     * Start background maintenance
     */
    startBackgroundMaintenance() {
        if (!this.maintenanceConfig.enabled || this.maintenanceInterval) {
            return;
        }

        console.log('🤖 Starting background context maintenance');
        
        this.maintenanceInterval = setInterval(async () => {
            await this.runBackgroundMaintenance();
        }, this.maintenanceConfig.interval);

        // Run initial maintenance
        setTimeout(() => this.runBackgroundMaintenance(), 5000);
    }

    /**
     * Stop background maintenance
     */
    stopBackgroundMaintenance() {
        if (this.maintenanceInterval) {
            clearInterval(this.maintenanceInterval);
            this.maintenanceInterval = null;
            console.log('🛑 Stopped background context maintenance');
        }
    }

    /**
     * Run background maintenance cycle
     */
    async runBackgroundMaintenance() {
        const hour = new Date().getHours();
        
        // Skip during quiet hours
        if (hour >= this.maintenanceConfig.quietHours.start || 
            hour < this.maintenanceConfig.quietHours.end) {
            console.log('😴 Skipping maintenance during quiet hours');
            return;
        }

        if (this.runningJobs.size >= this.maintenanceConfig.maxConcurrentJobs) {
            console.log('⏳ Maintenance queue full, skipping cycle');
            return;
        }

        console.log('🔍 Running background maintenance cycle');

        try {
            // Get contexts that need maintenance (would integrate with context registry)
            const contexts = this.getContextsNeedingMaintenance();
            
            for (const context of contexts) {
                if (this.runningJobs.size >= this.maintenanceConfig.maxConcurrentJobs) {
                    break;
                }
                
                // Run maintenance without blocking
                this.performMaintenance(context.id, context.data, context.metadata)
                    .catch(error => console.error('Background maintenance error:', error));
            }

        } catch (error) {
            console.error('Background maintenance cycle failed:', error);
        }
    }

    /**
     * Get contexts that need maintenance (stub - would integrate with registry)
     */
    getContextsNeedingMaintenance() {
        // In full implementation, this would:
        // 1. Get all contexts from global registry
        // 2. Check last maintenance time
        // 3. Prioritize by health score
        // 4. Return contexts needing attention
        return [];
    }

    /**
     * Get health summary for all monitored contexts
     */
    async getHealthSummary() {
        // Implementation would aggregate health data across all contexts
        return {
            totalContexts: 0,
            byHealthLevel: {
                excellent: 0,
                good: 0,
                warning: 0,
                critical: 0,
                failing: 0
            },
            averageScore: 0,
            maintenanceRunning: this.maintenanceInterval !== null,
            activeJobs: this.runningJobs.size
        };
    }

    /**
     * Demo showing health monitoring capabilities
     */
    async demo() {
        console.log('🏥 Context Health Monitor Demo - Proactive Context Maintenance\n');

        // Mock contexts with different health conditions
        const testContexts = [
            {
                id: 'healthy-context',
                data: {
                    context: '<workflow_context><recent_event>Active work</recent_event></workflow_context>',
                    last_activity: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days old
                    events_count: 25,
                    stack_depth: 1
                }
            },
            {
                id: 'stale-context', 
                data: {
                    context: '<workflow_context><old_event>Old work</old_event></workflow_context>',
                    last_activity: Date.now() - (45 * 24 * 60 * 60 * 1000), // 45 days old
                    events_count: 5,
                    stack_depth: 0
                }
            },
            {
                id: 'corrupted-context',
                data: {
                    context: '<workflow_context><broken_xml>Incomplete', // Corrupted XML
                    last_activity: Date.now() - (7 * 24 * 60 * 60 * 1000), // 7 days old
                    events_count: 15,
                    stack_depth: 2
                }
            }
        ];

        // Test health calculation for each context
        for (const context of testContexts) {
            console.log(`\n🔍 Health check for: ${context.id}`);
            
            const healthMetrics = await this.calculateHealthScore(context.id, context.data);
            
            console.log(`📊 Overall Score: ${(healthMetrics.overallScore * 100).toFixed(1)}% (${healthMetrics.level})`);
            console.log(`📈 Detailed Scores:`);
            Object.entries(healthMetrics.scores).forEach(([metric, score]) => {
                console.log(`   ${metric}: ${(score * 100).toFixed(1)}%`);
            });
            
            if (healthMetrics.recommendations.length > 0) {
                console.log(`💡 Recommendations:`);
                healthMetrics.recommendations.forEach(rec => console.log(`   - ${rec}`));
            }

            // Test maintenance
            const maintenanceResult = await this.performMaintenance(context.id, context.data);
            if (maintenanceResult.success) {
                console.log(`🔧 Maintenance: ${maintenanceResult.actions.join(', ') || 'No actions needed'}`);
            }
        }

        console.log('\n✅ Context Health Monitor demo completed!');
        console.log('🎯 System ready for proactive context maintenance and degradation prevention');
    }
}

module.exports = { ContextHealthMonitor };

// Run demo if called directly
if (require.main === module) {
    const monitor = new ContextHealthMonitor();
    monitor.demo().catch(console.error);
}