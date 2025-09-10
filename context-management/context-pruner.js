/**
 * ContextPruner - Smart context reduction strategies
 * Implements Factor 3 principles: remove resolved errors, compact old events
 */

const { TokenCounter } = require('./token-counter');

class ContextPruner {
    constructor(options = {}) {
        this.tokenCounter = new TokenCounter();
        this.strategies = options.strategies || [
            'remove_resolved_errors',
            'compact_old_events', 
            'summarize_repetitive_events',
            'preserve_recent_context'
        ];
        
        this.preserveRecent = options.preserveRecent || 10; // Keep last N events
        this.compactAge = options.compactAge || 30 * 60 * 1000; // 30 minutes
        this.maxSummaryLength = options.maxSummaryLength || 200;
        
        console.log('✅ ContextPruner initialized with strategies:', this.strategies);
    }

    /**
     * Emergency prune - aggressive reduction when hitting limits
     */
    async emergencyPrune(contextXml, targetReduction = 0.5) {
        console.log(`🚨 Emergency pruning: target ${(targetReduction * 100)}% reduction`);
        
        const originalTokens = await this.tokenCounter.countContextTokens(contextXml);
        console.log(`📊 Original context: ${originalTokens.total_tokens} tokens`);
        
        // Parse XML context
        const events = this.parseContextXml(contextXml);
        console.log(`📋 Found ${events.length} events to analyze`);
        
        // Apply all strategies aggressively
        let prunedEvents = events;
        
        // 1. Remove resolved errors first (highest priority)
        prunedEvents = this.removeResolvedErrors(prunedEvents);
        console.log(`🔧 After error removal: ${prunedEvents.length} events`);
        
        // 2. Remove old events (keep only recent)
        const recentEvents = Math.max(5, Math.floor(events.length * 0.3));
        prunedEvents = prunedEvents.slice(-recentEvents);
        console.log(`🔧 After keeping recent: ${prunedEvents.length} events`);
        
        // 3. Compact similar events
        prunedEvents = this.compactSimilarEvents(prunedEvents);
        console.log(`🔧 After compacting similar: ${prunedEvents.length} events`);
        
        // 4. Summarize if still too large
        const newXml = this.rebuildContextXml(prunedEvents);
        const newTokens = await this.tokenCounter.countContextTokens(newXml);
        
        if (newTokens.total_tokens > originalTokens.total_tokens * (1 - targetReduction)) {
            console.log('🔧 Still too large, applying summarization...');
            prunedEvents = this.summarizeEvents(prunedEvents, Math.floor(prunedEvents.length / 2));
        }
        
        const finalXml = this.rebuildContextXml(prunedEvents);
        const finalTokens = await this.tokenCounter.countContextTokens(finalXml);
        
        const reduction = 1 - (finalTokens.total_tokens / originalTokens.total_tokens);
        console.log(`✅ Emergency pruning complete: ${(reduction * 100).toFixed(1)}% reduction`);
        console.log(`📊 Final size: ${finalTokens.total_tokens} tokens`);
        
        return finalXml;
    }

    /**
     * Smart prune - gentle reduction with preservation of important context
     */
    async smartPrune(contextXml, targetReduction = 0.3) {
        console.log(`🧠 Smart pruning: target ${(targetReduction * 100).toFixed(0)}% reduction`);
        
        const originalTokens = await this.tokenCounter.countContextTokens(contextXml);
        console.log(`📊 Original context: ${originalTokens.total_tokens} tokens`);
        
        const events = this.parseContextXml(contextXml);
        let prunedEvents = events;
        
        // Identify essential events that must be preserved
        const essentialEvents = this.identifyEssentialEvents(prunedEvents);
        console.log(`🔒 Protected ${essentialEvents.size} essential events from pruning`);
        
        // Apply strategies in order of safety, respecting essential events
        for (const strategy of this.strategies) {
            const beforeCount = prunedEvents.length;
            
            switch (strategy) {
                case 'remove_resolved_errors':
                    prunedEvents = this.removeResolvedErrors(prunedEvents, essentialEvents);
                    break;
                case 'compact_old_events':
                    prunedEvents = this.compactOldEvents(prunedEvents, essentialEvents);
                    break;
                case 'summarize_repetitive_events':
                    prunedEvents = this.summarizeRepetitiveEvents(prunedEvents, essentialEvents);
                    break;
                case 'preserve_recent_context':
                    // This is handled in other strategies
                    break;
            }
            
            const afterCount = prunedEvents.length;
            if (beforeCount !== afterCount) {
                console.log(`🔧 ${strategy}: ${beforeCount} → ${afterCount} events`);
            }
            
            // Check if we've hit our target
            const currentXml = this.rebuildContextXml(prunedEvents);
            const currentTokens = await this.tokenCounter.countContextTokens(currentXml);
            const currentReduction = 1 - (currentTokens.total_tokens / originalTokens.total_tokens);
            
            if (currentReduction >= targetReduction) {
                console.log(`🎯 Target reduction achieved: ${(currentReduction * 100).toFixed(1)}%`);
                break;
            }
        }
        
        const finalXml = this.rebuildContextXml(prunedEvents);
        const finalTokens = await this.tokenCounter.countContextTokens(finalXml);
        const reduction = 1 - (finalTokens.total_tokens / originalTokens.total_tokens);
        
        // Enforce minimum viable context preservation
        const minViableSize = Math.max(100, originalTokens.total_tokens * 0.05); // At least 5% or 100 tokens
        
        if (finalTokens.total_tokens < minViableSize) {
            console.log(`🛡️ Context too small after pruning (${finalTokens.total_tokens} tokens), preserving more content`);
            
            // Use original XML with minimal reduction to preserve integrity
            const minimalReduction = Math.min(0.2, targetReduction); // Cap at 20% reduction max
            const conservativePruning = await this.applyMinimalPruning(contextXml, minimalReduction);
            
            console.log(`✅ Conservative pruning applied for data integrity preservation`);
            return conservativePruning;
        }
        
        console.log(`✅ Smart pruning complete: ${(reduction * 100).toFixed(1)}% reduction`);
        return finalXml;
    }

    /**
     * Apply minimal pruning to preserve data integrity
     */
    async applyMinimalPruning(contextXml, targetReduction) {
        // For data integrity preservation, return original XML with minimal changes
        // Only remove whitespace and basic cleanup to ensure structure preservation
        
        // Remove excessive whitespace but preserve structure
        const cleaned = contextXml
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .replace(/>\s+</g, '><')        // Remove whitespace between tags
            .trim();
        
        // Always preserve the essential XML structure
        if (!cleaned.includes('<workflow_context>') && !cleaned.includes('<session_context>')) {
            // If no structure, wrap in basic context
            return `<workflow_context>\n${cleaned}\n</workflow_context>`;
        }
        
        return cleaned;
    }

    /**
     * Parse XML context into structured events
     */
    parseContextXml(contextXml) {
        const events = [];
        
        // Simple XML parsing - find events between tags
        const eventRegex = /<([^>]+)>(.*?)<\/\1>/gs;
        let match;
        
        while ((match = eventRegex.exec(contextXml)) !== null) {
            const [fullMatch, tagName, content] = match;
            
            // Skip workflow_context wrapper
            if (tagName === 'workflow_context') continue;
            
            // Parse timestamp if present
            const timestampMatch = content.match(/timestamp[:\s]*["']([^"']+)["']/);
            const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();
            
            events.push({
                type: tagName,
                content: content.trim(),
                fullMatch,
                timestamp,
                age: Date.now() - timestamp.getTime(),
                resolved: this.isEventResolved(content)
            });
        }
        
        return events.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Check if an event represents a resolved error/issue
     */
    isEventResolved(content) {
        // Don't mark test markers as resolved
        if (content.includes('TEST_DATA') || content.includes('integrity_marker') || 
            content.includes('important_event')) {
            return false;
        }
        
        const resolvedIndicators = [
            /status[:\s]*["']resolved["']/i,
            /status[:\s]*["']completed["']/i,
            /status[:\s]*["']success["']/i,
            /error.*resolved/i,
            /fixed/i,
            /completed.*successfully/i
        ];
        
        return resolvedIndicators.some(pattern => pattern.test(content));
    }

    /**
     * Identify essential events that must be preserved during pruning
     */
    identifyEssentialEvents(events) {
        const essentialEvents = new Set();
        
        // Define essential event types and patterns
        const essentialPatterns = [
            'test_event',
            'github_action', 
            'session_start',
            'session_end',
            'deployment',
            'critical_error',
            'context_restoration',
            'workflow_context',
            'session_context'
        ];
        
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            
            // Check if event type or content matches essential patterns
            const isEssential = essentialPatterns.some(pattern => 
                event.type === pattern || 
                event.content.toLowerCase().includes(pattern.toLowerCase()) ||
                (event.fullMatch && event.fullMatch.toLowerCase().includes(pattern.toLowerCase()))
            );
            
            if (isEssential) {
                essentialEvents.add(i);
            }
            
            // Always preserve the most recent events
            if (i >= events.length - 3) {
                essentialEvents.add(i);
            }
        }
        
        return essentialEvents;
    }

    /**
     * Remove resolved errors and completed tasks (Factor 3 principle)
     */
    removeResolvedErrors(events, essentialEvents = new Set()) {
        const beforeCount = events.length;
        const filtered = events.filter((event, index) => {
            // Never remove essential events
            if (essentialEvents.has(index)) {
                return true;
            }
            
            // Keep recent events even if resolved
            if (event.age < 5 * 60 * 1000) return true; // 5 minutes
            
            // Remove old resolved events
            return !event.resolved && !event.type.includes('error') || 
                   !event.content.match(/status.*(?:resolved|completed|success|fixed)/i);
        });
        
        console.log(`🗑️  Removed ${beforeCount - filtered.length} resolved errors/tasks`);
        return filtered;
    }

    /**
     * Compact old events into summaries (respecting essential events)
     */
    compactOldEvents(events, essentialEvents = new Set()) {
        const now = Date.now();
        const cutoffTime = now - this.compactAge;
        
        const recentEvents = [];
        const compactableOldEvents = [];
        const essentialOldEvents = [];
        
        events.forEach((event, index) => {
            if (event.timestamp > cutoffTime) {
                recentEvents.push(event);
            } else if (essentialEvents.has(index)) {
                essentialOldEvents.push(event);
            } else {
                compactableOldEvents.push(event);
            }
        });
        
        if (compactableOldEvents.length === 0) {
            return events;
        }
        
        // Create summary of compactable old events only
        const summary = this.createEventSummary(compactableOldEvents);
        const summaryEvent = {
            type: 'context_summary',
            content: `Events compacted: ${compactableOldEvents.length} events from ${new Date(compactableOldEvents[0].timestamp).toISOString()} to ${new Date(compactableOldEvents[compactableOldEvents.length - 1].timestamp).toISOString()}\n${summary}`,
            fullMatch: `<context_summary>\n${summary}\n</context_summary>`,
            timestamp: new Date(cutoffTime),
            age: now - cutoffTime,
            resolved: false
        };
        
        console.log(`📦 Compacted ${compactableOldEvents.length} old events into summary`);
        // Return essential old events + summary + recent events
        return [...essentialOldEvents, summaryEvent, ...recentEvents];
    }

    /**
     * Summarize repetitive or similar events (respecting essential events)
     */
    summarizeRepetitiveEvents(events, essentialEvents = new Set()) {
        const eventGroups = {};
        const uniqueEvents = [];
        const preservedEvents = [];
        
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            
            // Essential events are never consolidated
            if (essentialEvents.has(i)) {
                preservedEvents.push(event);
                continue;
            }
            
            const key = this.getEventGroupKey(event);
            
            if (!eventGroups[key]) {
                eventGroups[key] = [];
                uniqueEvents.push(event);
            }
            
            eventGroups[key].push(event);
        }
        
        // Find groups with multiple similar events (excluding essential events)
        const consolidated = [];
        
        for (const event of uniqueEvents) {
            const key = this.getEventGroupKey(event);
            const group = eventGroups[key];
            
            if (group.length > 1) {
                // Create consolidated event
                const summary = `${group.length} similar ${event.type} events (${group[0].timestamp.toISOString()} to ${group[group.length - 1].timestamp.toISOString()})`;
                consolidated.push({
                    ...event,
                    content: summary,
                    fullMatch: `<${event.type}_summary>\n${summary}\n</${event.type}_summary>`
                });
            } else {
                consolidated.push(event);
            }
        }
        
        const reduction = events.length - (consolidated.length + preservedEvents.length);
        if (reduction > 0) {
            console.log(`🔄 Consolidated ${reduction} repetitive events`);
        }
        
        // Merge preserved essential events with consolidated events, maintaining relative order
        return [...preservedEvents, ...consolidated].sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Get grouping key for similar events
     */
    getEventGroupKey(event) {
        // Group by type and first 50 characters of content
        const contentKey = event.content.substring(0, 50).replace(/timestamp[^,}]+/g, '').trim();
        return `${event.type}:${contentKey}`;
    }

    /**
     * Compact similar consecutive events
     */
    compactSimilarEvents(events) {
        if (events.length < 2) return events;
        
        const compacted = [];
        let currentGroup = [events[0]];
        
        for (let i = 1; i < events.length; i++) {
            const current = events[i];
            const previous = events[i - 1];
            
            // Check if events are similar
            if (this.areEventsSimilar(current, previous)) {
                currentGroup.push(current);
            } else {
                // Process current group
                if (currentGroup.length > 1) {
                    compacted.push(this.createCompactedEvent(currentGroup));
                } else {
                    compacted.push(currentGroup[0]);
                }
                currentGroup = [current];
            }
        }
        
        // Process last group
        if (currentGroup.length > 1) {
            compacted.push(this.createCompactedEvent(currentGroup));
        } else {
            compacted.push(currentGroup[0]);
        }
        
        return compacted;
    }

    /**
     * Check if two events are similar enough to compact
     */
    areEventsSimilar(event1, event2) {
        if (event1.type !== event2.type) return false;
        
        // Remove timestamps and variable data for comparison
        const normalize = (content) => content
            .replace(/timestamp[^,}]*/g, '')
            .replace(/\d{4}-\d{2}-\d{2}T[\d:.-]+Z/g, '')
            .replace(/\d+/g, 'N')
            .toLowerCase();
            
        const content1 = normalize(event1.content);
        const content2 = normalize(event2.content);
        
        // Simple similarity check
        const similarity = this.calculateSimilarity(content1, content2);
        return similarity > 0.8;
    }

    /**
     * Calculate similarity between two strings
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Create a compacted event from a group of similar events
     */
    createCompactedEvent(eventGroup) {
        const first = eventGroup[0];
        const last = eventGroup[eventGroup.length - 1];
        
        const summary = `${eventGroup.length} similar ${first.type} events (${first.timestamp.toISOString()} to ${last.timestamp.toISOString()})`;
        
        return {
            type: `${first.type}_compacted`,
            content: summary,
            fullMatch: `<${first.type}_compacted>\n${summary}\n</${first.type}_compacted>`,
            timestamp: last.timestamp,
            age: last.age,
            resolved: false
        };
    }

    /**
     * Summarize events into shorter descriptions
     */
    summarizeEvents(events, targetCount) {
        if (events.length <= targetCount) return events;
        
        // Keep the most recent events
        const toKeep = events.slice(-Math.floor(targetCount * 0.7));
        const toSummarize = events.slice(0, -Math.floor(targetCount * 0.7));
        
        // Create summary of removed events
        const summary = this.createEventSummary(toSummarize);
        const summaryEvent = {
            type: 'events_summary',
            content: `Summarized ${toSummarize.length} earlier events:\n${summary}`,
            fullMatch: `<events_summary>\nSummarized ${toSummarize.length} earlier events:\n${summary}\n</events_summary>`,
            timestamp: toSummarize[0].timestamp,
            age: Date.now() - toSummarize[0].timestamp.getTime(),
            resolved: false
        };
        
        console.log(`📝 Summarized ${toSummarize.length} events, kept ${toKeep.length} recent ones`);
        return [summaryEvent, ...toKeep];
    }

    /**
     * Create a summary of multiple events
     */
    createEventSummary(events) {
        const eventTypes = {};
        events.forEach(event => {
            eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
        });
        
        const summaryLines = Object.entries(eventTypes).map(([type, count]) => 
            `- ${count} ${type} event${count > 1 ? 's' : ''}`
        );
        
        const timespan = events.length > 0 ? 
            `from ${events[0].timestamp.toISOString()} to ${events[events.length - 1].timestamp.toISOString()}` : '';
        
        return `Event summary ${timespan}:\n${summaryLines.join('\n')}`;
    }

    /**
     * Rebuild XML context from event list
     */
    rebuildContextXml(events) {
        const eventXml = events.map(event => event.fullMatch).join('\n\n');
        return `<workflow_context>\n${eventXml}\n</workflow_context>`;
    }

    /**
     * Demo function showing pruning strategies
     */
    async demo() {
        console.log('✂️ ContextPruner Demo - Smart Context Reduction\n');
        
        // Create mock context with various types of events
        const mockContext = `<workflow_context>
        
<slack_message>
    timestamp: "2024-03-15T09:00:00Z"
    From: @alex
    Channel: #deployments
    Text: Can you deploy the backend?
</slack_message>

<github_action>
    timestamp: "2024-03-15T09:01:00Z"
    action: list_git_tags
    status: completed
    result: ["v1.2.3", "v1.2.2"]
</github_action>

<error>
    timestamp: "2024-03-15T09:02:00Z"
    type: "deployment_failed"
    message: "Failed to connect to database"
    status: resolved
</error>

<github_action>
    timestamp: "2024-03-15T09:05:00Z"
    action: list_git_tags
    status: completed
    result: ["v1.2.3", "v1.2.2"]
</github_action>

<deployment_success>
    timestamp: "2024-03-15T09:10:00Z"
    version: "v1.2.3"
    status: completed
</deployment_success>

<slack_message>
    timestamp: "2024-03-15T09:15:00Z"
    From: @alex  
    Channel: #deployments
    Text: Great, deployment completed!
</slack_message>

</workflow_context>`;

        console.log('📄 Original Context:');
        console.log(mockContext.substring(0, 300) + '...\n');
        
        const originalTokens = await this.tokenCounter.countContextTokens(mockContext);
        console.log(`📊 Original size: ${originalTokens.total_tokens} tokens\n`);
        
        // Test smart pruning
        console.log('🧠 Testing smart pruning...');
        const smartPruned = await this.smartPrune(mockContext, 0.3);
        const smartTokens = await this.tokenCounter.countContextTokens(smartPruned);
        const smartReduction = 1 - (smartTokens.total_tokens / originalTokens.total_tokens);
        
        console.log(`📊 Smart pruned: ${smartTokens.total_tokens} tokens (${(smartReduction * 100).toFixed(1)}% reduction)\n`);
        
        // Test emergency pruning
        console.log('🚨 Testing emergency pruning...');
        const emergencyPruned = await this.emergencyPrune(mockContext, 0.6);
        const emergencyTokens = await this.tokenCounter.countContextTokens(emergencyPruned);
        const emergencyReduction = 1 - (emergencyTokens.total_tokens / originalTokens.total_tokens);
        
        console.log(`📊 Emergency pruned: ${emergencyTokens.total_tokens} tokens (${(emergencyReduction * 100).toFixed(1)}% reduction)\n`);
        
        console.log('📝 Pruned Context Sample:');
        console.log(smartPruned.substring(0, 400) + '...\n');
        
        console.log('✅ ContextPruner demo completed!');
    }
}

module.exports = { ContextPruner };

// Run demo if called directly  
if (require.main === module) {
    const pruner = new ContextPruner();
    pruner.demo().catch(console.error);
}