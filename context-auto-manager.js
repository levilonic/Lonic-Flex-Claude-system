#!/usr/bin/env node
/**
 * Context Auto Manager - Intelligent cleanup at 40% threshold
 * Automatically cleans context when reaching 40% usage
 * Stores removed content in archive for later retrieval
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

// Import LonicFLex components
const { TokenCounter } = require('./context-management/token-counter');
const { ContextWindowMonitor } = require('./context-management/context-window-monitor');
const { ContextPruner } = require('./context-management/context-pruner');
const { ContextArchiveManager } = require('./context-archive-manager');

class ContextAutoManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.tokenCounter = new TokenCounter();
        this.monitor = new ContextWindowMonitor({
            warningThreshold: 40,    // User's requirement
            criticalThreshold: 70,
            emergencyThreshold: 90,
            monitoringInterval: 5000 // 5 seconds
        });
        this.pruner = new ContextPruner();
        this.archiveManager = new ContextArchiveManager();
        
        this.isRunning = false;
        this.cleanupInProgress = false;
        this.contextFile = path.join(__dirname, '.claude', 'current-context.xml');
        this.archiveDir = path.join(__dirname, '.claude', 'context-archive');
        
        // Auto-cleanup configuration
        this.autoCleanupThreshold = options.cleanupThreshold || 40;
        this.targetReduction = options.targetReduction || 0.3; // Reduce by 30%
        this.enableAutoCleanup = options.autoCleanup !== false;
        
        // Statistics
        this.stats = {
            cleanupCount: 0,
            totalTokensSaved: 0,
            lastCleanupTime: null,
            archivedItems: 0
        };
        
        this.setupEventHandlers();
        console.log(`✅ ContextAutoManager initialized (${this.autoCleanupThreshold}% threshold)`);
    }
    
    /**
     * Setup event handlers for monitoring
     */
    setupEventHandlers() {
        this.monitor.on('threshold_warning', (state) => {
            if (state.percentage >= this.autoCleanupThreshold && this.enableAutoCleanup) {
                console.log(`🟡 AUTO-CLEANUP TRIGGERED: ${state.percentage}% usage reached`);
                this.performAutoCleanup(state);
            }
        });
        
        this.monitor.on('threshold_critical', (state) => {
            console.log(`🟠 CRITICAL: ${state.percentage}% usage - aggressive cleanup needed`);
            if (this.enableAutoCleanup) {
                this.performAutoCleanup(state, true); // Aggressive mode
            }
        });
        
        this.monitor.on('threshold_emergency', (state) => {
            console.log(`🔴 EMERGENCY: ${state.percentage}% usage - emergency cleanup!`);
            this.performAutoCleanup(state, true, 0.5); // Emergency - 50% reduction
        });
    }
    
    /**
     * Start the auto manager
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Context auto-manager already running');
            return;
        }
        
        this.isRunning = true;
        console.log('🎯 Starting context auto-manager...');
        
        // Initialize archive manager
        await this.archiveManager.initialize();
        
        // Create archive directory
        try {
            await fs.mkdir(this.archiveDir, { recursive: true });
        } catch (error) {
            console.log(`📁 Archive directory exists: ${this.archiveDir}`);
        }
        
        // Start monitoring
        this.monitor.startMonitoring();
        
        // Initial context check
        await this.checkCurrentContext();
        
        console.log('✅ Context auto-manager started successfully');
        this.emit('manager_started');
    }
    
    /**
     * Stop the auto manager
     */
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.monitor.stopMonitoring();
        
        console.log('🛑 Context auto-manager stopped');
        this.emit('manager_stopped');
    }
    
    /**
     * Check current context and trigger cleanup if needed
     */
    async checkCurrentContext() {
        try {
            const contextContent = await this.getCurrentContext();
            const tokenData = await this.tokenCounter.countContextTokens(contextContent);
            const percentage = (tokenData.total_tokens / 200000) * 100;
            
            if (percentage >= this.autoCleanupThreshold && this.enableAutoCleanup && !this.cleanupInProgress) {
                console.log(`🔍 Context check: ${percentage.toFixed(1)}% usage - cleanup needed`);
                await this.performAutoCleanup({ 
                    tokens: tokenData.total_tokens, 
                    percentage,
                    contextContent 
                });
            }
            
            return { tokens: tokenData.total_tokens, percentage };
            
        } catch (error) {
            console.error('❌ Context check failed:', error.message);
            return null;
        }
    }
    
    /**
     * Get current context content
     */
    async getCurrentContext() {
        try {
            // Try to read context file first
            const contextContent = await fs.readFile(this.contextFile, 'utf8');
            return contextContent;
        } catch (error) {
            // Generate basic context estimate
            return `<session_context>
                <timestamp>${new Date().toISOString()}</timestamp>
                <status>active</status>
                <estimated>true</estimated>
            </session_context>`;
        }
    }
    
    /**
     * Perform automatic context cleanup
     */
    async performAutoCleanup(state, aggressive = false, targetReduction = null) {
        if (this.cleanupInProgress) {
            console.log('⚠️ Cleanup already in progress, skipping...');
            return;
        }
        
        this.cleanupInProgress = true;
        const cleanupStart = Date.now();
        
        try {
            console.log(`🧹 Starting ${aggressive ? 'aggressive' : 'standard'} auto-cleanup...`);
            
            const originalTokens = state.tokens;
            const originalPercentage = state.percentage;
            const reductionTarget = targetReduction || this.targetReduction;
            
            // Get current context
            const contextContent = state.contextContent || await this.getCurrentContext();
            
            // Archive current context before cleaning using enhanced archive manager
            const archiveId = await this.archiveManager.archiveContext(contextContent, 'pre-cleanup', {
                originalTokens,
                originalPercentage,
                cleanupType: aggressive ? 'aggressive' : 'standard'
            });
            
            // Perform cleanup using ContextPruner
            let cleanedContext;
            if (aggressive) {
                cleanedContext = await this.pruner.emergencyPrune(contextContent, reductionTarget);
            } else {
                cleanedContext = await this.performSmartCleanup(contextContent, reductionTarget);
            }
            
            // Calculate savings
            const cleanedTokens = await this.tokenCounter.countContextTokens(cleanedContext);
            const savedTokens = originalTokens - cleanedTokens.total_tokens;
            const newPercentage = (cleanedTokens.total_tokens / 200000) * 100;
            
            // Update stats
            this.stats.cleanupCount++;
            this.stats.totalTokensSaved += savedTokens;
            this.stats.lastCleanupTime = Date.now();
            
            // Save cleaned context
            await this.saveCleanedContext(cleanedContext);
            
            const cleanupTime = Date.now() - cleanupStart;
            
            console.log(`✅ Auto-cleanup completed in ${cleanupTime}ms:`);
            console.log(`   Before: ${originalTokens.toLocaleString()} tokens (${originalPercentage.toFixed(1)}%)`);
            console.log(`   After:  ${cleanedTokens.total_tokens.toLocaleString()} tokens (${newPercentage.toFixed(1)}%)`);
            console.log(`   Saved:  ${savedTokens.toLocaleString()} tokens (${((savedTokens/originalTokens)*100).toFixed(1)}% reduction)`);
            console.log(`   Archive ID: ${archiveId}`);
            
            this.emit('cleanup_completed', {
                originalTokens,
                cleanedTokens: cleanedTokens.total_tokens,
                savedTokens,
                originalPercentage,
                newPercentage,
                archiveId,
                cleanupTime
            });
            
        } catch (error) {
            console.error('❌ Auto-cleanup failed:', error.message);
            this.emit('cleanup_failed', error);
        } finally {
            this.cleanupInProgress = false;
        }
    }
    
    /**
     * Perform smart context cleanup (less aggressive than emergency)
     */
    async performSmartCleanup(contextContent, targetReduction) {
        console.log('🤖 Performing smart context cleanup...');
        
        // Parse context to identify different content types
        const events = this.pruner.parseContextXml(contextContent);
        
        // Apply smart cleanup strategies
        let cleanedEvents = events;
        
        // 1. Remove resolved errors (highest priority)
        cleanedEvents = this.pruner.removeResolvedErrors(cleanedEvents);
        
        // 2. Remove old events beyond retention period
        const retentionCount = Math.floor(events.length * (1 - targetReduction));
        if (cleanedEvents.length > retentionCount) {
            cleanedEvents = cleanedEvents.slice(-retentionCount);
        }
        
        // 3. Summarize repetitive patterns
        cleanedEvents = this.pruner.summarizeRepetitive(cleanedEvents);
        
        // Rebuild context XML
        const cleanedXml = this.pruner.rebuildContextXml(cleanedEvents);
        
        return cleanedXml;
    }
    
    /**
     * Archive context content with metadata
     */
    async archiveContext(contextContent, reason) {
        const archiveId = `archive_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const archiveFile = path.join(this.archiveDir, `${archiveId}.xml`);
        const metaFile = path.join(this.archiveDir, `${archiveId}.meta.json`);
        
        const metadata = {
            archiveId,
            timestamp: new Date().toISOString(),
            reason,
            originalSize: contextContent.length,
            tokenCount: (await this.tokenCounter.countContextTokens(contextContent)).total_tokens,
            checksum: this.calculateChecksum(contextContent)
        };
        
        await fs.writeFile(archiveFile, contextContent, 'utf8');
        await fs.writeFile(metaFile, JSON.stringify(metadata, null, 2), 'utf8');
        
        this.stats.archivedItems++;
        console.log(`📦 Archived context: ${archiveId}`);
        
        return archiveId;
    }
    
    /**
     * Save cleaned context back to the system
     */
    async saveCleanedContext(cleanedContent) {
        try {
            // Create directory if it doesn't exist
            await fs.mkdir(path.dirname(this.contextFile), { recursive: true });
            
            // Write cleaned context
            await fs.writeFile(this.contextFile, cleanedContent, 'utf8');
            console.log('💾 Cleaned context saved successfully');
        } catch (error) {
            console.error('❌ Failed to save cleaned context:', error.message);
        }
    }
    
    /**
     * Calculate simple checksum for content integrity
     */
    calculateChecksum(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }
    
    /**
     * Get manager statistics
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            cleanupInProgress: this.cleanupInProgress,
            threshold: this.autoCleanupThreshold,
            targetReduction: this.targetReduction
        };
    }
    
    /**
     * List archived contexts
     */
    async listArchive() {
        try {
            const files = await fs.readdir(this.archiveDir);
            const metaFiles = files.filter(f => f.endsWith('.meta.json'));
            
            const archives = [];
            for (const metaFile of metaFiles) {
                const metaPath = path.join(this.archiveDir, metaFile);
                const metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
                archives.push(metadata);
            }
            
            return archives.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('❌ Failed to list archive:', error.message);
            return [];
        }
    }
    
    /**
     * Retrieve archived context by ID
     */
    async retrieveArchive(archiveId) {
        try {
            const archiveFile = path.join(this.archiveDir, `${archiveId}.xml`);
            const metaFile = path.join(this.archiveDir, `${archiveId}.meta.json`);
            
            const content = await fs.readFile(archiveFile, 'utf8');
            const metadata = JSON.parse(await fs.readFile(metaFile, 'utf8'));
            
            return { content, metadata };
        } catch (error) {
            console.error(`❌ Failed to retrieve archive ${archiveId}:`, error.message);
            return null;
        }
    }
}

// Demo/test function
async function testAutoManager() {
    console.log('🧪 Testing Context Auto Manager...\n');
    
    const manager = new ContextAutoManager({
        cleanupThreshold: 5, // Lower threshold for testing
        targetReduction: 0.3
    });
    
    // Setup event listeners
    manager.on('cleanup_completed', (data) => {
        console.log('✅ Cleanup event received:', data);
    });
    
    await manager.start();
    
    // Simulate high context usage
    console.log('📈 Simulating context growth...');
    await manager.checkCurrentContext();
    
    // Show stats
    console.log('\n📊 Manager stats:', JSON.stringify(manager.getStats(), null, 2));
    
    // List archive
    const archives = await manager.listArchive();
    console.log('\n📦 Archives:', archives.length);
    
    manager.stop();
    console.log('\n✅ Auto-manager test completed!');
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--test') || args.includes('--demo')) {
        testAutoManager().catch(console.error);
    } else if (args.includes('--start')) {
        const manager = new ContextAutoManager();
        manager.start().catch(console.error);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n👋 Shutting down auto-manager...');
            manager.stop();
            process.exit(0);
        });
    } else {
        console.log(`
Context Auto Manager - Intelligent cleanup at 40% threshold

Usage:
  node context-auto-manager.js --start    Start the auto manager
  node context-auto-manager.js --test     Run tests
  node context-auto-manager.js --demo     Run demo

Features:
  - Monitors context usage in real-time
  - Auto-cleanup at 40% threshold (configurable)
  - Archives removed content for later retrieval
  - Smart cleanup strategies (errors, old events, repetitive patterns)
  - Statistics and reporting
        `);
    }
}

module.exports = { ContextAutoManager };