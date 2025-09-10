/**
 * Factor 3: Own Your Context Window - Universal Context System
 * Following 12-Factor Agents methodology to prevent auto-compact
 * Enhanced with session/project scope management and universal context preservation
 */

const { TokenCounter } = require('./context-management/token-counter');
const { ContextWindowMonitor } = require('./context-management/context-window-monitor');

/**
 * Context Scope Types - Universal system for sessions and projects
 */
const CONTEXT_SCOPES = {
    session: {
        identity: null,           // No PROJECT.md needed
        persistence: 'weeks',     // Temporary
        scope: 'existing-system', // Works within current codebase
        github: 'feature-branch', // Simple branch
        slack: 'thread',         // Slack thread discussion
        compression_ratio: 0.7   // More aggressive compression
    },
    
    project: {
        identity: 'PROJECT.md',   // Full noumena/phenomena
        persistence: 'months',    // Long-term  
        scope: 'isolated',        // Own worldview/goals
        github: 'project-board',  // Full GitHub project
        slack: 'channel',        // Dedicated channel
        compression_ratio: 0.5   // Conservative compression
    }
};

class Factor3ContextManager {
    constructor(options = {}) {
        this.events = [];
        this.currentContext = null;
        this.format = 'xml'; // Efficient custom format per Factor 3
        
        // Universal Context System
        this.contextScope = options.contextScope || 'session';
        this.contextId = options.contextId || `ctx_${Date.now()}`;
        this.scopeConfig = CONTEXT_SCOPES[this.contextScope];
        
        // Context Stack for Tangent Handling  
        this.contextStack = [];
        this.currentTask = null;
        
        // Multi-Context Registry (shared across instances)
        if (!global.LONICFLEX_CONTEXT_REGISTRY) {
            global.LONICFLEX_CONTEXT_REGISTRY = new Map();
        }
        global.LONICFLEX_CONTEXT_REGISTRY.set(this.contextId, this);
        
        // Enhanced with real token counting
        this.tokenCounter = new TokenCounter(options.tokenCounter);
        this.monitor = options.enableMonitoring !== false ? 
            new ContextWindowMonitor({ 
                ...options.monitor, 
                tokenCounter: this.tokenCounter 
            }) : null;
        
        // Token usage tracking
        this.tokenUsage = {
            current: 0,
            percentage: 0,
            lastUpdate: null,
            source: 'estimate'
        };
        
        // Auto-monitoring setup
        if (this.monitor) {
            this.monitor.on('threshold_warning', (state) => {
                console.log(`🟡 CONTEXT WARNING: ${state.percentage.toFixed(1)}% usage - approaching 40% limit!`);
            });
            
            this.monitor.on('threshold_critical', (state) => {
                console.log(`🟠 CONTEXT CRITICAL: ${state.percentage.toFixed(1)}% usage - auto-compact prevention active!`);
            });
            
            // Start monitoring with this context manager as source
            this.monitor.contextSource = this;
            this.monitor.startMonitoring();
        }
        
        console.log('✅ Enhanced Factor3ContextManager with token counting & monitoring');
    }

    /**
     * Add event following Factor 3 XML format (not standard message array)
     * Enhanced with async token counting
     */
    async addEvent(type, data) {
        const event = {
            type,
            data,
            timestamp: Date.now(),
            id: `event_${this.events.length + 1}`
        };
        
        this.events.push(event);
        await this.updateContext();
        
        return event;
    }

    /**
     * Generate efficient XML context (Factor 3: token-efficient format)
     * This prevents auto-compact by using custom format instead of standard messages
     */
    generateContext() {
        const eventXml = this.events.map(event => {
            const dataString = typeof event.data === 'string' 
                ? event.data 
                : JSON.stringify(event.data, null, 2);
                
            return `<${event.type}>
    timestamp: "${new Date(event.timestamp).toISOString()}"
    ${dataString}
</${event.type}>`;
        }).join('\n\n');

        return `<workflow_context>
${eventXml}
</workflow_context>`;
    }

    /**
     * Update current context following Factor 3 principles
     * Enhanced with real token counting
     */
    async updateContext() {
        const contextXml = this.generateContext();
        
        // Count tokens in the current context
        const tokenData = await this.tokenCounter.countContextTokens(contextXml);
        const percentageData = this.tokenCounter.calculatePercentageUntilCompact(tokenData.total_tokens);
        
        this.tokenUsage = {
            current: tokenData.total_tokens,
            percentage: percentageData.usedPercentage,
            remainingPercentage: percentageData.remainingPercentage,
            lastUpdate: Date.now(),
            source: tokenData.source,
            fromCache: tokenData.fromCache
        };
        
        this.currentContext = {
            format: 'factor3_xml',
            events_count: this.events.length,
            context_window: contextXml,
            last_updated: Date.now(),
            token_usage: this.tokenUsage,
            prevents_autocompact: percentageData.remainingPercentage > 0
        };
        
        // Trigger monitoring check if available
        if (this.monitor) {
            this.monitor.checkContextUsage(contextXml);
        }
    }

    /**
     * Get current context in Factor 3 format
     */
    getCurrentContext() {
        return this.currentContext?.context_window || '<workflow_context></workflow_context>';
    }

    /**
     * Add multi-agent coordination event
     */
    addAgentEvent(agentName, action, data = {}) {
        return this.addEvent(`${agentName}_${action}`, {
            agent: agentName,
            action,
            ...data
        });
    }

    /**
     * Add slack interaction
     */
    addSlackEvent(message, channel, user) {
        return this.addEvent('slack_message', {
            channel,
            user,
            message,
            thread: []
        });
    }

    /**
     * Add GitHub event  
     */
    addGitHubEvent(action, repository, data = {}) {
        return this.addEvent('github_action', {
            action,
            repository,
            ...data
        });
    }

    /**
     * Get context for LLM (Factor 3: efficient single user message)
     */
    getContextForLLM(instruction = "what's the next step?") {
        return [
            {
                "role": "system", 
                "content": "You are coordinating multiple agents following 12-factor principles."
            },
            {
                "role": "user",
                "content": `Here's everything that happened so far:

${this.getCurrentContext()}

${instruction}`
            }
        ];
    }

    /**
     * Universal context summary generation - works for sessions and projects
     */
    generateContextSummary() {
        const compressionRatio = this.scopeConfig.compression_ratio;
        const eventCount = Math.floor(this.events.length * (1 - compressionRatio));
        const recentEvents = this.events.slice(-eventCount);
        
        const summary = {
            context_id: this.contextId,
            context_scope: this.contextScope,
            scope_config: this.scopeConfig,
            total_events: this.events.length,
            compressed_events: recentEvents.length,
            compression_ratio: compressionRatio,
            recent_events: recentEvents.map(event => ({
                type: event.type,
                timestamp: event.timestamp,
                summary: this.summarizeEvent(event),
                importance: event.importance || 5
            })),
            context_stack: this.contextStack,
            current_task: this.currentTask,
            token_usage: this.tokenUsage,
            context_health: this.currentContext?.prevents_autocompact ? 'healthy' : 'at_risk',
            generated_at: Date.now()
        };
        
        return JSON.stringify(summary, null, 2);
    }

    /**
     * Push context for tangent handling (universal)
     */
    pushContext(tangentInfo) {
        const contextFrame = {
            task: this.currentTask,
            timestamp: Date.now(),
            events_count: this.events.length,
            tangent_reason: tangentInfo.reason,
            return_point: tangentInfo.returnPoint || 'Continue previous work'
        };
        
        this.contextStack.push(contextFrame);
        this.currentTask = tangentInfo.newTask;
        
        this.addEvent('context_push', {
            from_task: contextFrame.task,
            to_task: this.currentTask,
            reason: tangentInfo.reason,
            stack_depth: this.contextStack.length
        });
        
        return contextFrame;
    }

    /**
     * Pop context after tangent completion (universal) 
     */
    popContext(completionInfo) {
        if (this.contextStack.length === 0) {
            throw new Error('No context to pop - context stack is empty');
        }
        
        const contextFrame = this.contextStack.pop();
        const tangentTask = this.currentTask;
        this.currentTask = contextFrame.task;
        
        this.addEvent('context_pop', {
            completed_tangent: tangentTask,
            returned_to: this.currentTask,
            tangent_result: completionInfo.result,
            new_assets: completionInfo.assets || [],
            stack_depth: this.contextStack.length
        });
        
        return contextFrame;
    }

    /**
     * Get current context scope configuration
     */
    getScopeConfig() {
        return {
            scope: this.contextScope,
            config: this.scopeConfig,
            context_id: this.contextId,
            stack_depth: this.contextStack.length,
            current_task: this.currentTask
        };
    }

    /**
     * Upgrade context scope (session → project)
     */
    upgradeToProject(projectInfo) {
        if (this.contextScope === 'project') {
            throw new Error('Context is already a project');
        }
        
        const oldScope = this.contextScope;
        this.contextScope = 'project';
        this.scopeConfig = CONTEXT_SCOPES.project;
        
        // Add upgrade event
        this.addEvent('scope_upgrade', {
            from_scope: oldScope,
            to_scope: 'project',
            project_info: projectInfo,
            preserved_events: this.events.length,
            upgrade_reason: projectInfo.reason
        });
        
        return {
            old_scope: oldScope,
            new_scope: this.contextScope,
            events_preserved: this.events.length,
            context_id: this.contextId
        };
    }

    /**
     * Summarize an event for context preservation
     */
    summarizeEvent(event) {
        const { type, data } = event;
        switch (true) {
            case type.includes('agent'):
                return `Agent ${data.agent} performed ${data.action}`;
            case type.includes('github'):
                return `GitHub ${data.action} on ${data.repository}`;
            case type.includes('slack'):
                return `Slack message in ${data.channel}`;
            case type.includes('database'):
                return `Database operation: ${data.operation}`;
            default:
                return `Event type: ${type}`;
        }
    }

    /**
     * Clear resolved errors (Factor 3: hide resolved errors from context)
     * Enhanced with async context updates
     */
    async clearResolvedErrors() {
        const beforeCount = this.events.length;
        this.events = this.events.filter(event => 
            !event.type.includes('error') || event.data.status !== 'resolved'
        );
        const afterCount = this.events.length;
        
        if (beforeCount !== afterCount) {
            console.log(`🗑️ Cleared ${beforeCount - afterCount} resolved errors`);
            await this.updateContext();
        }
    }

    /**
     * Get current token usage percentage (main interface for 40% monitoring)
     */
    async getTokenPercentage() {
        if (!this.tokenUsage.lastUpdate || Date.now() - this.tokenUsage.lastUpdate > 10000) {
            await this.updateContext();
        }
        
        return {
            percentage: this.tokenUsage.percentage,
            remainingPercentage: this.tokenUsage.remainingPercentage,
            tokens: this.tokenUsage.current,
            isWarning: this.tokenUsage.percentage >= 40,
            isCritical: this.tokenUsage.percentage >= 70,
            lastUpdate: this.tokenUsage.lastUpdate
        };
    }

    /**
     * Emergency compact context when approaching limits
     */
    async emergencyCompact() {
        try {
            console.log('🚨 EMERGENCY COMPACT: Context approaching auto-compact limits!');
            
            const { ContextPruner } = require('./context-management/context-pruner');
            const pruner = new ContextPruner();
            
            const currentContext = this.getCurrentContext();
            const prunedContext = await pruner.emergencyPrune(currentContext, 0.5);
            
            // Rebuild events from pruned context (simplified approach)
            this.events = [{
                type: 'context_emergency_compact',
                data: {
                    original_events: this.events.length,
                    compact_timestamp: Date.now(),
                    pruned_content: prunedContext
                },
                timestamp: Date.now(),
                id: 'emergency_compact_1'
            }];
            
            await this.updateContext();
            console.log('✅ Emergency compact completed');
            
            return this.tokenUsage;
        } catch (error) {
            console.error('🚨 Emergency compact failed:', error);
            throw error;
        }
    }

    /**
     * Update context from external source (for monitor integration)
     */
    async updateContextFromXml(newXml) {
        // This allows the monitor to update context after pruning
        // For now, we'll just log - in full implementation this would parse XML back to events
        console.log('📝 Context updated from external source');
        this.currentContext.context_window = newXml;
        await this.updateContext();
    }

    /**
     * Stop monitoring when context manager is destroyed
     */
    destroy() {
        if (this.monitor) {
            this.monitor.stopMonitoring();
            this.monitor.removeAllListeners();
        }
        console.log('🛑 Factor3ContextManager destroyed');
    }

    /**
     * Get context summary with real token usage (enhanced monitoring)
     */
    async getContextSummary() {
        const eventTypes = {};
        this.events.forEach(event => {
            eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
        });

        // Ensure we have current token data
        if (!this.tokenUsage.lastUpdate || Date.now() - this.tokenUsage.lastUpdate > 30000) {
            await this.updateContext();
        }

        return {
            total_events: this.events.length,
            event_types: eventTypes,
            context_size_chars: this.getCurrentContext().length,
            context_tokens: this.tokenUsage.current,
            token_percentage: this.tokenUsage.percentage,
            remaining_percentage: this.tokenUsage.remainingPercentage,
            token_source: this.tokenUsage.source,
            format: 'factor3_xml',
            prevents_autocompact: this.tokenUsage.remainingPercentage > 0,
            warning_level: this.tokenUsage.percentage > 40 ? 'warning' : 
                          this.tokenUsage.percentage > 70 ? 'critical' : 'safe',
            last_token_update: this.tokenUsage.lastUpdate
        };
    }

    /**
     * Demo of Enhanced Factor 3 context management with token counting
     */
    static async demo() {
        console.log('📄 Enhanced Factor 3: Context Window + Token Monitoring Demo\n');
        
        // Create enhanced context manager with monitoring
        const context = new Factor3ContextManager({
            monitor: {
                warningThreshold: 5,   // Lower for demo
                criticalThreshold: 10,
                emergencyThreshold: 15
            }
        });
        
        console.log('📈 Adding events and monitoring token usage...\n');
        
        // Add events following Factor 3 principles (now async)
        await context.addSlackEvent("Can you deploy the backend?", "#deployments", "@alex");
        console.log('✅ Added Slack event');
        
        await context.addGitHubEvent("list_tags", "backend-service");
        console.log('✅ Added GitHub event');
        
        await context.addAgentEvent("github", "processing", { status: "scanning_tags" });
        console.log('✅ Added agent processing event');
        
        await context.addAgentEvent("github", "completed", { 
            tags: [
                { name: "v1.2.3", commit: "abc123", date: "2024-03-15T10:00:00Z" },
                { name: "v1.2.2", commit: "def456", date: "2024-03-14T15:30:00Z" }
            ]
        });
        console.log('✅ Added agent completed event');

        // Show enhanced context summary with token data
        console.log('\n📊 Enhanced Context Summary with Token Counting:');
        const summary = await context.getContextSummary();
        console.log(JSON.stringify(summary, null, 2));
        
        // Show token percentage monitoring
        console.log('\n🎯 Token Usage Monitoring:');
        const tokenData = await context.getTokenPercentage();
        console.log(`Current usage: ${tokenData.tokens} tokens (${tokenData.percentage.toFixed(1)}%)`);
        console.log(`Remaining until auto-compact: ${tokenData.remainingPercentage.toFixed(1)}%`);
        console.log(`Warning level: ${tokenData.isWarning ? '🟡 WARNING' : '🟢 SAFE'}`);
        
        // Test resolved error clearing
        console.log('\n🗑️ Testing resolved error clearing...');
        await context.addEvent('error', { 
            message: 'Test error', 
            status: 'resolved' 
        });
        console.log('Added resolved error');
        
        await context.clearResolvedErrors();
        console.log('Cleared resolved errors');
        
        // Generate context for LLM
        console.log('\n💬 LLM Context Generation:');
        const llmMessages = context.getContextForLLM("What's the deployment status?");
        console.log(`Generated ${llmMessages.length} messages for LLM`);
        console.log(`Total context length: ${llmMessages[1].content.length} characters`);
        
        // Clean up
        context.destroy();
        
        console.log('\n✅ Enhanced Factor 3 demo completed!');
        console.log('🎯 This system now provides:');
        console.log('  - Real token counting (not just character estimates)');
        console.log('  - 40% threshold monitoring with warnings');  
        console.log('  - Automatic context pruning when approaching limits');
        console.log('  - Factor 3 XML format for auto-compact prevention');
    }

    /**
     * Static methods for multi-context management
     */
    static getAllActiveContexts() {
        if (!global.LONICFLEX_CONTEXT_REGISTRY) {
            return [];
        }
        
        const contexts = [];
        for (const [contextId, contextManager] of global.LONICFLEX_CONTEXT_REGISTRY) {
            contexts.push({
                id: contextId,
                scope: contextManager.contextScope,
                current_task: contextManager.currentTask,
                events_count: contextManager.events.length,
                stack_depth: contextManager.contextStack.length,
                last_activity: contextManager.events.length > 0 ? 
                    contextManager.events[contextManager.events.length - 1].timestamp : null
            });
        }
        
        return contexts;
    }

    static getContextById(contextId) {
        if (!global.LONICFLEX_CONTEXT_REGISTRY) {
            return null;
        }
        return global.LONICFLEX_CONTEXT_REGISTRY.get(contextId);
    }

    static createContext(options = {}) {
        const contextId = options.contextId || `${options.contextScope || 'session'}_${Date.now()}`;
        return new Factor3ContextManager({
            ...options,
            contextId
        });
    }

    static removeContext(contextId) {
        if (!global.LONICFLEX_CONTEXT_REGISTRY) {
            return false;
        }
        return global.LONICFLEX_CONTEXT_REGISTRY.delete(contextId);
    }

    /**
     * Add importance to events for better compression
     */
    addImportantEvent(eventType, data, importance = 8) {
        return this.addEvent(eventType, {
            ...data,
            importance,
            marked_important: true
        });
    }

    /**
     * Set current task for context tracking
     */
    setCurrentTask(taskDescription) {
        const oldTask = this.currentTask;
        this.currentTask = taskDescription;
        
        this.addEvent('task_change', {
            from_task: oldTask,
            to_task: taskDescription,
            context_scope: this.contextScope
        });
        
        return oldTask;
    }

    /**
     * Get compression statistics
     */
    getCompressionStats() {
        const totalEvents = this.events.length;
        const compressionRatio = this.scopeConfig.compression_ratio;
        const compressedEvents = Math.floor(totalEvents * (1 - compressionRatio));
        
        return {
            total_events: totalEvents,
            compressed_events: compressedEvents,
            preserved_events: totalEvents - compressedEvents,
            compression_ratio: compressionRatio,
            scope: this.contextScope,
            estimated_token_savings: Math.floor(totalEvents * compressionRatio * 50) // rough estimate
        };
    }
}

module.exports = { Factor3ContextManager, CONTEXT_SCOPES };

// Run demo if called directly
if (require.main === module) {
    Factor3ContextManager.demo().catch(console.error);
}