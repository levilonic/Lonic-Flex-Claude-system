const { info, warn, error } = require('../services/logger');
/**
 * ContextWindowMonitor - Real-time monitoring for 40% threshold prevention
 * Prevents auto-compact by tracking token usage and triggering warnings
 */

const { TokenCounter } = require('./token-counter');
const EventEmitter = require('events');

class ContextWindowMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.tokenCounter = new TokenCounter(options.tokenCounter);
        this.thresholds = {
            warning: options.warningThreshold || 40,    // User's 40% requirement
            critical: options.criticalThreshold || 70,   // More urgent warnings
            emergency: options.emergencyThreshold || 90, // Auto-compact trigger
            ...options.thresholds
        };
        
        this.monitoring = false;
        this.monitoringInterval = options.monitoringInterval || 5000; // 5 seconds
        this.intervalId = null;
        
        // State tracking
        this.currentState = {
            tokens: 0,
            percentage: 0,
            level: 'safe', // safe, warning, critical, emergency
            lastUpdate: null,
            contextContent: null
        };
        
        // History for trend analysis
        this.history = [];
        this.maxHistory = options.maxHistory || 50;
        
        // Auto-compact prevention strategies
        this.autoCompactEnabled = options.autoCompact !== false;
        this.compactStrategies = options.compactStrategies || ['remove_resolved_errors', 'compact_old_events'];

        // NEW: 40% auto-cleanup trigger (user's original requirement)
        this.enableAutoCleanup = options.enableAutoCleanup !== false;
        this.autoCleanupThreshold = options.autoCleanupThreshold || 40; // Trigger at 40%
        
        // Only log in development mode
        if (process.env.NODE_ENV !== 'production') {
            info(`ContextWindowMonitor initialized with ${this.thresholds.warning}% threshold`);
        }
    }

    /**
     * Start monitoring context window usage
     */
    startMonitoring(contextSource = null) {
        if (this.monitoring) {
            logger.warn('Monitor already running');
            return;
        }

        this.monitoring = true;
        this.contextSource = contextSource;
        
        // Only log in development mode
        if (process.env.NODE_ENV !== 'production') {
            info(`Started context monitoring (${this.thresholds.warning}% threshold)`);
        }
        
        // Immediate check
        this.checkContextUsage();
        
        // Periodic monitoring
        this.intervalId = setInterval(() => {
            this.checkContextUsage();
        }, this.monitoringInterval);

        this.emit('monitoring_started', { thresholds: this.thresholds });
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.monitoring) return;
        
        this.monitoring = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        info('STOP Context monitoring stopped');
        this.emit('monitoring_stopped');
    }

    /**
     * Check current context usage and emit warnings
     */
    async checkContextUsage(contextContent = null) {
        try {
            // Get context content
            const content = contextContent || 
                           (this.contextSource?.getCurrentContext?.() || 
                            this.currentState.contextContent);
            
            if (!content) {
                return this.currentState;
            }

            // Count tokens
            const tokenData = await this.tokenCounter.countContextTokens(content);
            const percentageData = this.tokenCounter.calculatePercentageUntilCompact(tokenData.total_tokens);
            
            // Update state
            const newState = {
                tokens: tokenData.total_tokens,
                percentage: percentageData.usedPercentage,
                remainingPercentage: percentageData.remainingPercentage,
                level: this.determineWarningLevel(percentageData.usedPercentage),
                lastUpdate: Date.now(),
                contextContent: content,
                tokenSource: tokenData.source,
                fromCache: tokenData.fromCache
            };

            // Track history
            this.addToHistory(newState);
            
            // Check for threshold changes
            if (newState.level !== this.currentState.level || 
                Math.abs(newState.percentage - this.currentState.percentage) > 1) {
                this.handleThresholdChange(this.currentState, newState);
            }
            
            this.currentState = newState;
            this.emit('context_updated', newState);
            
            return newState;
            
        } catch (error) {
            logger.error('Context usage check failed:', error);
            this.emit('monitor_error', error);
            return this.currentState;
        }
    }

    /**
     * Determine warning level based on percentage
     */
    determineWarningLevel(percentage) {
        if (percentage >= this.thresholds.emergency) return 'emergency';
        if (percentage >= this.thresholds.critical) return 'critical';
        if (percentage >= this.thresholds.warning) return 'warning';
        return 'safe';
    }

    /**
     * Handle threshold level changes
     */
    handleThresholdChange(oldState, newState) {
        const levelChanged = oldState.level !== newState.level;
        const percentageChange = newState.percentage - oldState.percentage;
        
        // Only log context stats in development mode or for critical issues
        if (process.env.NODE_ENV !== 'production' || newState.level === 'critical' || newState.level === 'emergency') {
            info(`METRICS Context: ${newState.tokens} tokens (${newState.percentage.toFixed(1)}%) - ${newState.level.toUpperCase()}`);
        }
        
        // Emit specific threshold events
        switch (newState.level) {
            case 'warning':
                if (levelChanged) {
                    info(` WARNING: Context usage reached ${this.thresholds.warning}% threshold!`);
                    this.emit('threshold_warning', newState);

                    // NEW: Auto-cleanup at 40% threshold
                    if (this.enableAutoCleanup && newState.percentage >= this.autoCleanupThreshold) {
                        info(`🟡 AUTO-CLEANUP TRIGGERED: ${newState.percentage.toFixed(1)}% usage reached`);
                        this.performAutoCleanup(newState, 'standard');
                    }
                }
                break;

            case 'critical':
                if (levelChanged) {
                    info(` CRITICAL: Context usage reached ${this.thresholds.critical}% threshold!`);
                    this.emit('threshold_critical', newState);

                    // NEW: Aggressive auto-cleanup at 70% threshold
                    if (this.enableAutoCleanup) {
                        info(`🟠 AGGRESSIVE AUTO-CLEANUP: ${newState.percentage.toFixed(1)}% usage - critical level`);
                        this.performAutoCleanup(newState, 'aggressive');
                    }
                }
                break;
                
            case 'emergency':
                if (levelChanged) {
                    info(` EMERGENCY: Context usage reached ${this.thresholds.emergency}% - AUTO-COMPACT IMMINENT!`);
                    this.emit('threshold_emergency', newState);

                    // Emergency: Most aggressive cleanup (50% reduction)
                    if (this.enableAutoCleanup) {
                        info(`🔴 EMERGENCY AUTO-CLEANUP: ${newState.percentage.toFixed(1)}% usage - 50% reduction`);
                        this.performAutoCleanup(newState, 'emergency');
                    } else if (this.autoCompactEnabled) {
                        this.handleEmergencyCompact(newState);
                    }
                }
                break;
                
            case 'safe':
                if (oldState.level !== 'safe') {
                    info(` Context usage back to safe levels (${newState.percentage.toFixed(1)}%)`);
                    this.emit('threshold_safe', newState);
                }
                break;
        }
        
        // Trend analysis - only log rapid growth in critical situations or development
        if (percentageChange > 10) {
            if (process.env.NODE_ENV !== 'production' || percentageChange > 25) {
                info(`FAST Rapid context growth: +${percentageChange.toFixed(1)}% in ${this.monitoringInterval/1000}s`);
            }
            this.emit('rapid_growth', { change: percentageChange, duration: this.monitoringInterval });
        }
    }

    /**
     * Handle emergency auto-compact prevention
     */
    async handleEmergencyCompact(state) {
        info('ALERT EMERGENCY COMPACT PREVENTION ACTIVATED');
        
        try {
            // Emit emergency event first
            this.emit('emergency_compact_triggered', state);
            
            // Try to get pruner if available
            let pruner;
            try {
                const { ContextPruner } = require('./context-pruner');
                pruner = new ContextPruner();
            } catch (error) {
                logger.warn('ContextPruner not available, basic compact only');
            }
            
            if (pruner && this.contextSource) {
                // Smart pruning
                logger.debug('Attempting smart context pruning...');
                const prunedContext = await pruner.emergencyPrune(state.contextContent);
                
                // Update context source if possible
                if (this.contextSource.updateContext) {
                    this.contextSource.updateContext(prunedContext);
                    info('Context pruned successfully');
                } else {
                    logger.warn('Cannot update context - manual intervention required');
                }
            } else {
                // Basic truncation fallback
                logger.debug('Performing basic context truncation...');
                const truncatedContent = this.basicTruncate(state.contextContent);
                
                if (this.contextSource?.updateContext) {
                    this.contextSource.updateContext(truncatedContent);
                }
            }
            
            // Recheck after emergency compact
            setTimeout(() => {
                this.checkContextUsage();
            }, 1000);
            
        } catch (error) {
            logger.error('ALERT Emergency compact failed:', error);
            this.emit('emergency_compact_failed', { state, error });
        }
    }

    /**
     * Basic context truncation as emergency fallback
     */
    basicTruncate(contextContent) {
        if (!contextContent || typeof contextContent !== 'string') {
            return contextContent;
        }
        
        // Keep only the last 50% of content
        const halfPoint = Math.floor(contextContent.length / 2);
        const truncated = contextContent.substring(halfPoint);
        
        // Try to start from a clean XML tag
        const xmlTagMatch = truncated.match(/<[^>]+>/);
        if (xmlTagMatch) {
            const cleanStart = truncated.indexOf(xmlTagMatch[0]);
            return `<workflow_context>\n<!-- Context truncated for emergency compact -->\n${truncated.substring(cleanStart)}\n</workflow_context>`;
        }
        
        return `<workflow_context>\n<!-- Context truncated for emergency compact -->\n${truncated}\n</workflow_context>`;
    }

    /**
     * NEW: Perform auto-cleanup at threshold levels (40%, 70%, 90%)
     * Implements three-tier cleanup strategy from archived pattern
     */
    async performAutoCleanup(state, cleanupType = 'standard') {
        try {
            const contextContent = state.contextContent;
            if (!contextContent) {
                warn('No context content available for auto-cleanup');
                return { success: false, reason: 'no_content' };
            }

            const originalTokens = state.tokens;
            const originalPercentage = state.percentage;

            // Determine reduction target based on cleanup type
            const reductionTargets = {
                standard: 0.15,   // 15% reduction at 40% threshold
                aggressive: 0.30, // 30% reduction at 70% threshold
                emergency: 0.50   // 50% reduction at 90% threshold
            };
            const targetReduction = reductionTargets[cleanupType] || 0.15;

            info(`📦 Starting ${cleanupType} cleanup (target: ${(targetReduction * 100).toFixed(0)}% reduction)`);

            // Try to get ContextPruner for smart cleanup
            let cleanedContext;
            try {
                const { ContextPruner } = require('./context-pruner');
                const pruner = new ContextPruner();

                if (cleanupType === 'emergency') {
                    cleanedContext = await pruner.emergencyPrune(contextContent, targetReduction);
                } else if (cleanupType === 'aggressive') {
                    // Use smart cleanup for aggressive (30% reduction)
                    cleanedContext = await pruner.smartPrune(contextContent, targetReduction);
                } else {
                    // Standard cleanup: use minimal pruning (15% reduction)
                    cleanedContext = await pruner.applyMinimalPruning(contextContent, targetReduction);
                }
            } catch (error) {
                warn(`ContextPruner failed, using basic truncation: ${error.message}`);
                // Fallback to basic truncation
                const keepRatio = 1 - targetReduction;
                const keepLength = Math.floor(contextContent.length * keepRatio);
                cleanedContext = contextContent.substring(contextContent.length - keepLength);
            }

            // Update context if source is available
            if (this.contextSource?.updateContext) {
                this.contextSource.updateContext(cleanedContext);
            }

            // Calculate savings
            const cleanedTokens = await this.tokenCounter.countContextTokens(cleanedContext);
            const savedTokens = originalTokens - cleanedTokens.total_tokens;
            const newPercentage = cleanedTokens.usedPercentage || (cleanedTokens.total_tokens / 100000 * 100);

            info(`✅ Auto-cleanup complete: Saved ${savedTokens.toLocaleString()} tokens`);
            info(`   Before: ${originalTokens.toLocaleString()} tokens (${originalPercentage.toFixed(1)}%)`);
            info(`   After: ${cleanedTokens.total_tokens.toLocaleString()} tokens (${newPercentage.toFixed(1)}%)`);

            // Emit cleanup completed event
            this.emit('auto_cleanup_completed', {
                cleanupType,
                originalTokens,
                cleanedTokens: cleanedTokens.total_tokens,
                savedTokens,
                originalPercentage,
                newPercentage,
                success: true
            });

            // Recheck context usage after cleanup
            setTimeout(() => {
                this.checkContextUsage(cleanedContext);
            }, 1000);

            return {
                success: true,
                cleanupType,
                savedTokens,
                originalPercentage,
                newPercentage
            };

        } catch (error) {
            error(`❌ Auto-cleanup failed (${cleanupType}):`, error.message);
            this.emit('auto_cleanup_failed', { cleanupType, error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Add state to history for trend analysis
     */
    addToHistory(state) {
        this.history.push({
            timestamp: state.lastUpdate,
            tokens: state.tokens,
            percentage: state.percentage,
            level: state.level
        });
        
        // Keep history size manageable
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }

    /**
     * Get context usage trends
     */
    getTrends(minutes = 10) {
        const cutoffTime = Date.now() - (minutes * 60 * 1000);
        const recentHistory = this.history.filter(h => h.timestamp > cutoffTime);
        
        if (recentHistory.length < 2) {
            return { trend: 'insufficient_data', slope: 0, predictions: [] };
        }
        
        // Calculate trend
        const first = recentHistory[0];
        const last = recentHistory[recentHistory.length - 1];
        const timeSpan = last.timestamp - first.timestamp;
        const percentageChange = last.percentage - first.percentage;
        const slope = percentageChange / (timeSpan / 1000); // percentage per second
        
        let trend = 'stable';
        if (slope > 0.01) trend = 'growing';
        if (slope > 0.05) trend = 'rapid_growth';
        if (slope < -0.01) trend = 'shrinking';
        
        // Predict when thresholds might be hit
        const predictions = [];
        if (slope > 0) {
            const timeToWarning = (this.thresholds.warning - last.percentage) / slope;
            const timeToCritical = (this.thresholds.critical - last.percentage) / slope;
            const timeToEmergency = (this.thresholds.emergency - last.percentage) / slope;
            
            if (timeToWarning > 0) predictions.push({ threshold: 'warning', eta: timeToWarning });
            if (timeToCritical > 0) predictions.push({ threshold: 'critical', eta: timeToCritical });
            if (timeToEmergency > 0) predictions.push({ threshold: 'emergency', eta: timeToEmergency });
        }
        
        return {
            trend,
            slope,
            predictions,
            history: recentHistory,
            timeSpan: timeSpan / 1000
        };
    }

    /**
     * Get current state and status
     */
    getStatus() {
        const trends = this.getTrends();
        
        return {
            monitoring: this.monitoring,
            current: this.currentState,
            thresholds: this.thresholds,
            trends,
            autoCompactEnabled: this.autoCompactEnabled,
            nextCheck: this.monitoring ? Date.now() + this.monitoringInterval : null
        };
    }

    /**
     * Update monitoring thresholds
     */
    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
        info(`METRICS Thresholds updated:`, this.thresholds);
        this.emit('thresholds_updated', this.thresholds);
    }

    /**
     * Force immediate context check
     */
    async forceCheck(contextContent = null) {
        info(' Force checking context usage...');
        return await this.checkContextUsage(contextContent);
    }

    /**
     * Demo function showing threshold monitoring
     */
    async demo() {
        info('METRICS ContextWindowMonitor Demo - 40% Threshold Protection\n');
        
        // Mock context content that grows over time
        let mockContext = '<workflow_context>\n';
        
        // Set up event listeners
        this.on('threshold_warning', (state) => {
            info(`ALERT THRESHOLD ALERT: ${state.percentage.toFixed(1)}% usage detected!`);
        });
        
        this.on('context_updated', (state) => {
            const emoji = {
                safe: '',
                warning: '', 
                critical: '',
                emergency: ''
            }[state.level];
            
            info(`${emoji} Context: ${state.tokens} tokens (${state.percentage.toFixed(1)}%) - Level: ${state.level}`);
        });
        
        // Start monitoring
        this.startMonitoring();
        
        info(' Simulating context growth...\n');
        
        // Simulate growing context
        for (let i = 0; i < 10; i++) {
            // Add more content to simulate growth
            mockContext += `
            <event_${i}>
                timestamp: "${new Date().toISOString()}"
                type: "demo_event"
                data: {
                    step: ${i + 1},
                    description: "Simulating context growth to test threshold monitoring",
                    details: "${'x'.repeat(i * 100)}", // Growing content
                    metadata: { iteration: ${i}, total_chars: ${mockContext.length} }
                }
            </event_${i}>
            `;
            
            // Check context usage
            await this.checkContextUsage(mockContext);
            
            // Wait between iterations
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Break if we hit warning threshold
            if (this.currentState.level !== 'safe') {
                info(`\n Demo reached ${this.currentState.level} level - stopping simulation`);
                break;
            }
        }
        
        // Show trends
        info('\n Context Growth Trends:');
        const trends = this.getTrends(5);
        info(`Trend: ${trends.trend}`);
        info(`Growth rate: ${(trends.slope * 60).toFixed(2)}% per minute`);
        
        if (trends.predictions.length > 0) {
            info('\nCLOCK Threshold Predictions:');
            trends.predictions.forEach(pred => {
                const minutes = Math.ceil(pred.eta / 60);
                info(`${pred.threshold}: ${minutes} minutes`);
            });
        }
        
        this.stopMonitoring();
        mockContext += '\n</workflow_context>';
        
        info('\nPASS ContextWindowMonitor demo completed!');
        info(`Final context size: ${mockContext.length} characters`);
    }
}

module.exports = { ContextWindowMonitor };

// Run demo if called directly
if (require.main === module) {
    const monitor = new ContextWindowMonitor({
        warningThreshold: 5, // Lower threshold for demo
        criticalThreshold: 10,
        emergencyThreshold: 15
    });
    monitor.demo().catch(console.error);
}