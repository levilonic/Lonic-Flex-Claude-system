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
        
        console.log(`✅ ContextWindowMonitor initialized with ${this.thresholds.warning}% threshold`);
    }

    /**
     * Start monitoring context window usage
     */
    startMonitoring(contextSource = null) {
        if (this.monitoring) {
            console.log('⚠️ Monitor already running');
            return;
        }

        this.monitoring = true;
        this.contextSource = contextSource;
        
        console.log(`🎯 Started context monitoring (${this.thresholds.warning}% threshold)`);
        
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
        
        console.log('🛑 Context monitoring stopped');
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
            console.error('Context usage check failed:', error);
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
        
        console.log(`📊 Context: ${newState.tokens} tokens (${newState.percentage.toFixed(1)}%) - ${newState.level.toUpperCase()}`);
        
        // Emit specific threshold events
        switch (newState.level) {
            case 'warning':
                if (levelChanged) {
                    console.log(`🟡 WARNING: Context usage reached ${this.thresholds.warning}% threshold!`);
                    this.emit('threshold_warning', newState);
                }
                break;
                
            case 'critical':
                if (levelChanged) {
                    console.log(`🟠 CRITICAL: Context usage reached ${this.thresholds.critical}% threshold!`);
                    this.emit('threshold_critical', newState);
                }
                break;
                
            case 'emergency':
                if (levelChanged) {
                    console.log(`🔴 EMERGENCY: Context usage reached ${this.thresholds.emergency}% - AUTO-COMPACT IMMINENT!`);
                    this.emit('threshold_emergency', newState);
                    
                    if (this.autoCompactEnabled) {
                        this.handleEmergencyCompact(newState);
                    }
                }
                break;
                
            case 'safe':
                if (oldState.level !== 'safe') {
                    console.log(`🟢 Context usage back to safe levels (${newState.percentage.toFixed(1)}%)`);
                    this.emit('threshold_safe', newState);
                }
                break;
        }
        
        // Trend analysis
        if (percentageChange > 10) {
            console.log(`⚡ Rapid context growth: +${percentageChange.toFixed(1)}% in ${this.monitoringInterval/1000}s`);
            this.emit('rapid_growth', { change: percentageChange, duration: this.monitoringInterval });
        }
    }

    /**
     * Handle emergency auto-compact prevention
     */
    async handleEmergencyCompact(state) {
        console.log('🚨 EMERGENCY COMPACT PREVENTION ACTIVATED');
        
        try {
            // Emit emergency event first
            this.emit('emergency_compact_triggered', state);
            
            // Try to get pruner if available
            let pruner;
            try {
                const { ContextPruner } = require('./context-pruner');
                pruner = new ContextPruner();
            } catch (error) {
                console.log('⚠️ ContextPruner not available, basic compact only');
            }
            
            if (pruner && this.contextSource) {
                // Smart pruning
                console.log('🔧 Attempting smart context pruning...');
                const prunedContext = await pruner.emergencyPrune(state.contextContent);
                
                // Update context source if possible
                if (this.contextSource.updateContext) {
                    this.contextSource.updateContext(prunedContext);
                    console.log('✅ Context pruned successfully');
                } else {
                    console.log('⚠️ Cannot update context - manual intervention required');
                }
            } else {
                // Basic truncation fallback
                console.log('🔧 Performing basic context truncation...');
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
            console.error('🚨 Emergency compact failed:', error);
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
        console.log(`📊 Thresholds updated:`, this.thresholds);
        this.emit('thresholds_updated', this.thresholds);
    }

    /**
     * Force immediate context check
     */
    async forceCheck(contextContent = null) {
        console.log('🔍 Force checking context usage...');
        return await this.checkContextUsage(contextContent);
    }

    /**
     * Demo function showing threshold monitoring
     */
    async demo() {
        console.log('📊 ContextWindowMonitor Demo - 40% Threshold Protection\n');
        
        // Mock context content that grows over time
        let mockContext = '<workflow_context>\n';
        
        // Set up event listeners
        this.on('threshold_warning', (state) => {
            console.log(`🚨 THRESHOLD ALERT: ${state.percentage.toFixed(1)}% usage detected!`);
        });
        
        this.on('context_updated', (state) => {
            const emoji = {
                safe: '🟢',
                warning: '🟡', 
                critical: '🟠',
                emergency: '🔴'
            }[state.level];
            
            console.log(`${emoji} Context: ${state.tokens} tokens (${state.percentage.toFixed(1)}%) - Level: ${state.level}`);
        });
        
        // Start monitoring
        this.startMonitoring();
        
        console.log('📈 Simulating context growth...\n');
        
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
                console.log(`\n🎯 Demo reached ${this.currentState.level} level - stopping simulation`);
                break;
            }
        }
        
        // Show trends
        console.log('\n📈 Context Growth Trends:');
        const trends = this.getTrends(5);
        console.log(`Trend: ${trends.trend}`);
        console.log(`Growth rate: ${(trends.slope * 60).toFixed(2)}% per minute`);
        
        if (trends.predictions.length > 0) {
            console.log('\n⏰ Threshold Predictions:');
            trends.predictions.forEach(pred => {
                const minutes = Math.ceil(pred.eta / 60);
                console.log(`${pred.threshold}: ${minutes} minutes`);
            });
        }
        
        this.stopMonitoring();
        mockContext += '\n</workflow_context>';
        
        console.log('\n✅ ContextWindowMonitor demo completed!');
        console.log(`Final context size: ${mockContext.length} characters`);
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