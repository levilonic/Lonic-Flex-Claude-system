#!/usr/bin/env node
/**
 * Integrated Context Manager - Combines Factor3, Auto-cleanup, and Status Line
 * Provides unified context management with live tracking and auto-cleanup at 40%
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

// Import all LonicFLex components
const { Factor3ContextManager } = require('./factor3-context-manager');
const { ContextAutoManager } = require('./context-auto-manager');
const { ContextStatusLine } = require('./context-statusline');

class IntegratedContextManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.factor3Manager = new Factor3ContextManager();
        this.autoManager = new ContextAutoManager({
            cleanupThreshold: options.cleanupThreshold || 40,
            targetReduction: options.targetReduction || 0.3
        });
        this.statusLine = new ContextStatusLine();
        
        this.isRunning = false;
        this.contextFile = path.join(__dirname, '.claude', 'current-context.xml');
        this.updateInterval = options.updateInterval || 2000; // 2 seconds for real-time
        this.intervalId = null;
        
        // Statistics
        this.stats = {
            totalEvents: 0,
            autoCleanups: 0,
            currentTokens: 0,
            currentPercentage: 0,
            lastUpdate: null
        };
        
        this.setupEventHandlers();
        console.log('✅ IntegratedContextManager initialized');
    }
    
    /**
     * Setup event handlers between components
     */
    setupEventHandlers() {
        // Auto-manager cleanup events
        this.autoManager.on('cleanup_completed', (data) => {
            console.log(`🧹 Auto-cleanup: ${data.originalTokens} → ${data.cleanedTokens} tokens`);
            this.stats.autoCleanups++;
            this.emit('context_cleaned', data);
        });
        
        this.autoManager.on('cleanup_failed', (error) => {
            console.error('❌ Auto-cleanup failed:', error.message);
            this.emit('cleanup_error', error);
        });
    }
    
    /**
     * Start the integrated context manager
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Integrated context manager already running');
            return;
        }
        
        this.isRunning = true;
        console.log('🚀 Starting integrated context management system...');
        
        try {
            // Initialize all components
            // Factor3ContextManager doesn't need explicit initialization
            await this.autoManager.start();
            
            // Create current context file
            await this.ensureContextFile();
            
            // Start real-time updates
            this.startRealTimeUpdates();
            
            console.log('✅ Integrated context manager started successfully');
            this.emit('manager_started');
            
        } catch (error) {
            console.error('❌ Failed to start integrated manager:', error.message);
            throw error;
        }
    }
    
    /**
     * Stop the integrated context manager
     */
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        // Stop components
        this.autoManager.stop();
        this.factor3Manager.destroy();
        
        // Stop real-time updates
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('🛑 Integrated context manager stopped');
        this.emit('manager_stopped');
    }
    
    /**
     * Add event to context (main interface)
     */
    async addEvent(type, data) {
        if (!this.isRunning) {
            throw new Error('Context manager not running');
        }
        
        try {
            // Add to Factor3 manager
            const event = await this.factor3Manager.addEvent(type, data);
            
            // Update current context file
            await this.updateContextFile();
            
            // Update statistics
            this.stats.totalEvents++;
            this.stats.lastUpdate = Date.now();
            
            this.emit('event_added', event);
            return event;
            
        } catch (error) {
            console.error('❌ Failed to add event:', error.message);
            throw error;
        }
    }
    
    /**
     * Get current context usage
     */
    async getContextUsage() {
        try {
            const usage = await this.factor3Manager.getTokenPercentage();
            
            this.stats.currentTokens = usage.tokens;
            this.stats.currentPercentage = usage.percentage;
            
            return usage;
            
        } catch (error) {
            console.error('❌ Failed to get context usage:', error.message);
            return null;
        }
    }
    
    /**
     * Force context cleanup (manual trigger)
     */
    async forceCleanup(aggressive = false) {
        console.log(`🧹 Forcing ${aggressive ? 'aggressive' : 'standard'} context cleanup...`);
        
        try {
            const currentUsage = await this.getContextUsage();
            if (!currentUsage) {
                throw new Error('Unable to get current context usage');
            }
            
            const contextContent = this.factor3Manager.generateContext();
            
            await this.autoManager.performAutoCleanup({
                tokens: currentUsage.tokens,
                percentage: currentUsage.percentage,
                contextContent
            }, aggressive);
            
            // Reload cleaned context
            await this.reloadCleanedContext();
            
            console.log('✅ Manual cleanup completed');
            
        } catch (error) {
            console.error('❌ Manual cleanup failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Start real-time context updates
     */
    startRealTimeUpdates() {
        console.log('⏱️ Starting real-time context updates...');
        
        this.intervalId = setInterval(async () => {
            try {
                await this.updateContextFile();
                await this.getContextUsage();
            } catch (error) {
                console.error('❌ Real-time update failed:', error.message);
            }
        }, this.updateInterval);
    }
    
    /**
     * Ensure context file exists and is up to date
     */
    async ensureContextFile() {
        try {
            const contextDir = path.dirname(this.contextFile);
            await fs.mkdir(contextDir, { recursive: true });
            
            // Create initial context file
            await this.updateContextFile();
            
        } catch (error) {
            console.error('❌ Failed to ensure context file:', error.message);
        }
    }
    
    /**
     * Update the current context file
     */
    async updateContextFile() {
        try {
            const contextXml = this.factor3Manager.generateContext();
            await fs.writeFile(this.contextFile, contextXml, 'utf8');
            
            // Notify status line of update (if needed)
            this.emit('context_updated', contextXml);
            
        } catch (error) {
            console.error('❌ Failed to update context file:', error.message);
        }
    }
    
    /**
     * Reload cleaned context from auto-manager
     */
    async reloadCleanedContext() {
        try {
            const cleanedContent = await fs.readFile(this.contextFile, 'utf8');
            
            // Parse and reload into Factor3 manager
            // This is a simplified approach - in production you'd want more sophisticated parsing
            console.log('🔄 Reloading cleaned context...');
            
            // Reset Factor3 manager with cleaned content
            // Note: This is a basic implementation - you might want more sophisticated handling
            this.factor3Manager.events = []; // Reset events
            
            await this.factor3Manager.addEvent('context_reloaded', {
                source: 'auto_cleanup',
                content_length: cleanedContent.length,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ Failed to reload cleaned context:', error.message);
        }
    }
    
    /**
     * Get comprehensive status
     */
    async getStatus() {
        const usage = await this.getContextUsage();
        const autoManagerStats = this.autoManager.getStats();
        
        return {
            isRunning: this.isRunning,
            usage: usage || { tokens: 0, percentage: 0 },
            stats: this.stats,
            autoManager: autoManagerStats,
            factor3Events: this.factor3Manager.events.length,
            contextFile: this.contextFile,
            lastUpdate: this.stats.lastUpdate
        };
    }
    
    /**
     * Generate status line output
     */
    async generateStatusLine() {
        try {
            const usage = await this.getContextUsage();
            if (!usage) return '🔴 Context: Error reading usage';
            
            const formatted = this.statusLine.formatStatusLine({
                tokens: usage.tokens,
                percentage: usage.percentage,
                remaining: usage.tokens ? (200000 - usage.tokens) : 200000
            });
            
            return formatted;
            
        } catch (error) {
            return '🔴 Context: Status unavailable';
        }
    }
    
    /**
     * List recent events
     */
    getRecentEvents(limit = 10) {
        return this.factor3Manager.events
            .slice(-limit)
            .map(event => ({
                type: event.type,
                timestamp: new Date(event.timestamp).toISOString(),
                id: event.id
            }));
    }
    
    /**
     * Clear resolved errors (manual cleanup)
     */
    async clearResolvedErrors() {
        console.log('🔧 Clearing resolved errors...');
        
        try {
            this.factor3Manager.clearResolvedErrors();
            await this.updateContextFile();
            
            const usage = await this.getContextUsage();
            console.log(`✅ Resolved errors cleared. Current usage: ${usage?.percentage.toFixed(1)}%`);
            
        } catch (error) {
            console.error('❌ Failed to clear resolved errors:', error.message);
        }
    }
}

// Demo function
async function demoIntegratedManager() {
    console.log('🧪 Testing Integrated Context Manager...\n');
    
    const manager = new IntegratedContextManager({
        cleanupThreshold: 10, // Lower for demo
        updateInterval: 1000  // 1 second updates
    });
    
    // Setup event listeners
    manager.on('event_added', (event) => {
        console.log(`📝 Event added: ${event.type}`);
    });
    
    manager.on('context_cleaned', (data) => {
        console.log(`🧹 Context cleaned: ${data.savedTokens} tokens saved`);
    });
    
    try {
        await manager.start();
        
        // Add some test events
        console.log('📈 Adding test events...');
        await manager.addEvent('test_start', { message: 'Starting integration test' });
        await manager.addEvent('demo_action', { action: 'create_file', file: 'test.js' });
        await manager.addEvent('demo_success', { result: 'File created successfully' });
        
        // Show status
        const status = await manager.getStatus();
        console.log('\n📊 Status:', JSON.stringify(status, null, 2));
        
        // Generate status line
        const statusLine = await manager.generateStatusLine();
        console.log('\n📟 Status Line:', statusLine);
        
        // Show recent events
        console.log('\n📜 Recent Events:');
        const events = manager.getRecentEvents(5);
        events.forEach(event => {
            console.log(`  ${event.timestamp} - ${event.type}`);
        });
        
        // Wait a moment then stop
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        manager.stop();
        console.log('\n✅ Integrated manager demo completed!');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        manager.stop();
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--demo') || args.includes('--test')) {
        demoIntegratedManager().catch(console.error);
    } else if (args.includes('--start')) {
        const manager = new IntegratedContextManager();
        
        manager.start().then(() => {
            console.log('🎯 Integrated context manager running...');
            console.log('Press Ctrl+C to stop');
            
            // Handle graceful shutdown
            process.on('SIGINT', () => {
                console.log('\n👋 Shutting down integrated manager...');
                manager.stop();
                process.exit(0);
            });
        }).catch(console.error);
    } else {
        console.log(`
Integrated Context Manager - Unified context management system

Usage:
  node integrated-context-manager.js --start    Start the integrated manager
  node integrated-context-manager.js --demo     Run demonstration
  node integrated-context-manager.js --test     Run tests

Features:
  - Real-time context tracking with Factor3 XML format
  - Auto-cleanup at 40% threshold with intelligent archiving
  - Always-visible status line integration
  - Live token counting and percentage monitoring
  - Event-driven architecture with comprehensive logging

Commands available after starting:
  - Add events through Factor3 interface
  - Monitor context usage in real-time
  - Automatic cleanup triggers at thresholds
  - Archive system for removed content
        `);
    }
}

module.exports = { IntegratedContextManager };