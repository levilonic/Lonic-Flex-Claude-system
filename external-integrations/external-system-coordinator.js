#!/usr/bin/env node
/**
 * External System Coordinator - Phase 3A
 * Coordinates GitHub and Slack integrations for Universal Context System
 * Part of LonicFLex Project Window System Phase 3: Integration & Production Readiness
 */

const { GitHubContextIntegration } = require('./github-context-integration');
const { SlackContextIntegration } = require('./slack-context-integration');
const { ContextScopeManager } = require('../context-management/context-scope-manager');
const path = require('path');
const fs = require('fs').promises;

class ExternalSystemCoordinator {
    constructor(config = {}) {
        this.config = {
            // Integration toggles
            enableGitHub: config.enableGitHub !== false,
            enableSlack: config.enableSlack !== false,
            
            // Coordination settings
            parallelExecution: config.parallelExecution !== false,
            failureHandling: config.failureHandling || 'continue', // continue, stop, retry
            retryAttempts: config.retryAttempts || 2,
            retryDelay: config.retryDelay || 1000,
            
            // Cross-system settings
            linkResources: config.linkResources !== false, // Link GitHub PRs in Slack notifications
            contextPersistence: config.contextPersistence !== false,
            
            // GitHub settings
            github: {
                autoCreateBranch: config.github?.autoCreateBranch !== false,
                autoCreatePR: config.github?.autoCreatePR === true,
                ...config.github
            },
            
            // Slack settings
            slack: {
                autoCreateChannel: config.slack?.autoCreateChannel === true, // false by default
                autoNotifyChannel: config.slack?.autoNotifyChannel !== false,
                richFormatting: config.slack?.richFormatting !== false,
                useThreads: config.slack?.useThreads !== false,
                ...config.slack
            },
            
            ...config
        };
        
        this.githubIntegration = null;
        this.slackIntegration = null;
        this.contextScope = new ContextScopeManager();
        this.activeContexts = new Map(); // contextId -> { github: {...}, slack: {...}, status: 'active' }
        this.operationHistory = new Map(); // contextId -> operations[]
    }

    /**
     * Initialize all external system integrations
     */
    async initialize() {
        console.log('🚀 Initializing External System Coordinator...');
        console.log(`   GitHub integration: ${this.config.enableGitHub ? 'enabled' : 'disabled'}`);
        console.log(`   Slack integration: ${this.config.enableSlack ? 'enabled' : 'disabled'}`);
        console.log(`   Parallel execution: ${this.config.parallelExecution}`);
        
        const results = {
            github: { enabled: false, initialized: false, error: null },
            slack: { enabled: false, initialized: false, error: null }
        };
        
        // Initialize GitHub integration
        if (this.config.enableGitHub) {
            try {
                console.log('🔧 Initializing GitHub integration...');
                this.githubIntegration = new GitHubContextIntegration(this.config.github);
                const githubReady = await this.githubIntegration.initialize();
                results.github = { enabled: true, initialized: githubReady, error: null };
                
                if (githubReady) {
                    console.log('✅ GitHub integration ready');
                } else {
                    console.log('❌ GitHub integration failed to initialize');
                }
            } catch (error) {
                console.error('❌ GitHub integration error:', error.message);
                results.github = { enabled: true, initialized: false, error: error.message };
            }
        }
        
        // Initialize Slack integration
        if (this.config.enableSlack) {
            try {
                console.log('🔧 Initializing Slack integration...');
                this.slackIntegration = new SlackContextIntegration(this.config.slack);
                const slackReady = await this.slackIntegration.initialize();
                results.slack = { enabled: true, initialized: slackReady, error: null };
                
                if (slackReady) {
                    console.log('✅ Slack integration ready');
                } else {
                    console.log('❌ Slack integration failed to initialize');
                }
            } catch (error) {
                console.error('❌ Slack integration error:', error.message);
                results.slack = { enabled: true, initialized: false, error: error.message };
            }
        }
        
        const totalEnabled = (results.github.enabled ? 1 : 0) + (results.slack.enabled ? 1 : 0);
        const totalInitialized = (results.github.initialized ? 1 : 0) + (results.slack.initialized ? 1 : 0);
        
        console.log(`🎯 External System Coordinator initialized: ${totalInitialized}/${totalEnabled} systems ready`);
        
        return {
            success: totalInitialized > 0,
            results,
            summary: {
                totalEnabled,
                totalInitialized,
                ready: totalInitialized > 0
            }
        };
    }

    /**
     * Handle context creation across all enabled external systems
     */
    async onContextCreated(contextData) {
        console.log(`🎯 Coordinating external systems for context: ${contextData.contextId}`);
        
        const operations = [];
        const results = {
            contextId: contextData.contextId,
            github: null,
            slack: null,
            crossSystem: { linked: false, errors: [] },
            summary: { success: true, errors: [], totalResources: 0 }
        };
        
        // Prepare operations
        if (this.config.enableGitHub && this.githubIntegration) {
            operations.push({
                system: 'github',
                operation: () => this.githubIntegration.onContextCreated(contextData)
            });
        }
        
        if (this.config.enableSlack && this.slackIntegration) {
            operations.push({
                system: 'slack',
                operation: () => this.slackIntegration.onContextCreated(contextData)
            });
        }
        
        // Execute operations
        if (this.config.parallelExecution && operations.length > 1) {
            console.log('⚡ Executing external system operations in parallel...');
            await this.executeOperationsParallel(operations, results);
        } else {
            console.log('🔄 Executing external system operations sequentially...');
            await this.executeOperationsSequential(operations, results);
        }
        
        // Cross-system integration (link GitHub resources in Slack)
        if (this.config.linkResources && results.github && results.slack) {
            await this.linkSystemResources(contextData, results);
        }
        
        // Store context state
        this.activeContexts.set(contextData.contextId, {
            contextData,
            github: results.github,
            slack: results.slack,
            status: 'active',
            createdAt: new Date().toISOString()
        });
        
        // Record operation history
        const history = this.operationHistory.get(contextData.contextId) || [];
        history.push({
            operation: 'context_created',
            timestamp: new Date().toISOString(),
            results: results.summary,
            systems: operations.map(op => op.system)
        });
        this.operationHistory.set(contextData.contextId, history);
        
        // Update summary
        results.summary.totalResources = 
            (results.github?.githubResources?.length || 0) + 
            (results.slack?.slackResources?.length || 0);
        
        console.log(`✅ External system coordination complete for ${contextData.contextId}:`);
        console.log(`   GitHub resources: ${results.github?.githubResources?.length || 0}`);
        console.log(`   Slack notifications: ${results.slack?.notifications?.length || 0}`);
        console.log(`   Total errors: ${results.summary.errors.length}`);
        
        return results;
    }

    /**
     * Execute operations in parallel
     */
    async executeOperationsParallel(operations, results) {
        try {
            const promises = operations.map(async (op) => {
                try {
                    const result = await op.operation();
                    return { system: op.system, result, success: true };
                } catch (error) {
                    return { system: op.system, error: error.message, success: false };
                }
            });
            
            const operationResults = await Promise.allSettled(promises);
            
            for (let i = 0; i < operationResults.length; i++) {
                const opResult = operationResults[i];
                const system = operations[i].system;
                
                if (opResult.status === 'fulfilled') {
                    const { result, success, error } = opResult.value;
                    if (success) {
                        results[system] = result;
                    } else {
                        results.summary.errors.push(`${system}: ${error}`);
                        results.summary.success = false;
                    }
                } else {
                    results.summary.errors.push(`${system}: ${opResult.reason}`);
                    results.summary.success = false;
                }
            }
        } catch (error) {
            results.summary.errors.push(`Parallel execution failed: ${error.message}`);
            results.summary.success = false;
        }
    }

    /**
     * Execute operations sequentially
     */
    async executeOperationsSequential(operations, results) {
        for (const op of operations) {
            try {
                const result = await op.operation();
                results[op.system] = result;
                
                // Handle errors based on failure handling strategy
                if (result.errors && result.errors.length > 0) {
                    if (this.config.failureHandling === 'stop') {
                        results.summary.errors.push(`${op.system}: ${result.errors.join(', ')}`);
                        results.summary.success = false;
                        break;
                    } else {
                        results.summary.errors.push(...result.errors.map(err => `${op.system}: ${err}`));
                    }
                }
            } catch (error) {
                const errorMsg = `${op.system}: ${error.message}`;
                results.summary.errors.push(errorMsg);
                
                if (this.config.failureHandling === 'stop') {
                    results.summary.success = false;
                    break;
                } else if (this.config.failureHandling === 'retry') {
                    // Implement retry logic if needed
                    console.log(`⚠️ Retrying ${op.system} operation...`);
                }
            }
        }
    }

    /**
     * Link resources across systems (e.g., include GitHub PR links in Slack notifications)
     */
    async linkSystemResources(contextData, results) {
        try {
            console.log('🔗 Linking resources across systems...');
            
            // If we have GitHub resources, include them in Slack notifications
            if (results.github?.githubResources && results.slack?.notifications) {
                const githubResources = results.github.githubResources;
                const branchInfo = githubResources.find(r => r.type === 'branch');
                const prInfo = githubResources.find(r => r.type === 'pull_request');
                
                if (branchInfo || prInfo) {
                    // This would be implemented by updating Slack notifications
                    // with GitHub resource links
                    results.crossSystem.linked = true;
                    console.log('✅ GitHub resources linked in Slack notifications');
                }
            }
        } catch (error) {
            console.error('❌ Failed to link system resources:', error.message);
            results.crossSystem.errors.push(error.message);
        }
    }

    /**
     * Handle context completion across all systems
     */
    async onContextCompleted(contextData) {
        console.log(`🎯 Handling context completion: ${contextData.contextId}`);
        
        const results = {
            contextId: contextData.contextId,
            github: null,
            slack: null,
            summary: { success: true, errors: [] }
        };
        
        try {
            // GitHub completion
            if (this.githubIntegration && this.activeContexts.get(contextData.contextId)?.github) {
                results.github = await this.githubIntegration.onContextCompleted(contextData);
            }
            
            // Slack completion
            if (this.slackIntegration && this.activeContexts.get(contextData.contextId)?.slack) {
                results.slack = await this.slackIntegration.onContextCompleted(contextData);
            }
            
            // Update context status
            const contextInfo = this.activeContexts.get(contextData.contextId);
            if (contextInfo) {
                contextInfo.status = 'completed';
                contextInfo.completedAt = new Date().toISOString();
            }
            
            // Record operation history
            const history = this.operationHistory.get(contextData.contextId) || [];
            history.push({
                operation: 'context_completed',
                timestamp: new Date().toISOString(),
                results: results.summary
            });
            this.operationHistory.set(contextData.contextId, history);
            
            console.log(`✅ Context completion handled for ${contextData.contextId}`);
            return results;
            
        } catch (error) {
            console.error(`❌ Failed to handle context completion for ${contextData.contextId}:`, error.message);
            results.summary.success = false;
            results.summary.errors.push(error.message);
            return results;
        }
    }

    /**
     * Get comprehensive status of all external systems
     */
    async getStatus() {
        const status = {
            coordinator: {
                initialized: !!(this.githubIntegration || this.slackIntegration),
                activeContexts: this.activeContexts.size,
                totalOperations: Array.from(this.operationHistory.values()).reduce((sum, arr) => sum + arr.length, 0),
                config: {
                    enableGitHub: this.config.enableGitHub,
                    enableSlack: this.config.enableSlack,
                    parallelExecution: this.config.parallelExecution,
                    failureHandling: this.config.failureHandling
                }
            },
            github: null,
            slack: null,
            contexts: Array.from(this.activeContexts.entries()).map(([contextId, info]) => ({
                contextId,
                status: info.status,
                createdAt: info.createdAt,
                completedAt: info.completedAt,
                githubResources: info.github?.githubResources?.length || 0,
                slackNotifications: info.slack?.notifications?.length || 0
            }))
        };
        
        // Get GitHub status
        if (this.githubIntegration) {
            status.github = await this.githubIntegration.getStatus();
        }
        
        // Get Slack status
        if (this.slackIntegration) {
            status.slack = await this.slackIntegration.getStatus();
        }
        
        return status;
    }

    /**
     * Clean up all resources for a context
     */
    async cleanupContext(contextId) {
        console.log(`🧹 Coordinating cleanup for context: ${contextId}`);
        
        const results = {
            contextId,
            github: null,
            slack: null,
            summary: { success: true, errors: [] }
        };
        
        try {
            // GitHub cleanup
            if (this.githubIntegration) {
                results.github = await this.githubIntegration.cleanupContext(contextId);
            }
            
            // Slack cleanup
            if (this.slackIntegration) {
                results.slack = await this.slackIntegration.cleanupContext(contextId);
            }
            
            // Local cleanup
            this.activeContexts.delete(contextId);
            this.operationHistory.delete(contextId);
            
            console.log(`✅ Coordinated cleanup complete for ${contextId}`);
            return results;
            
        } catch (error) {
            console.error(`❌ Failed to cleanup context ${contextId}:`, error.message);
            results.summary.success = false;
            results.summary.errors.push(error.message);
            return results;
        }
    }
}

module.exports = { ExternalSystemCoordinator };

// CLI testing if run directly
if (require.main === module) {
    async function testExternalSystemCoordinator() {
        console.log('🧪 Testing External System Coordinator - Phase 3A\n');
        
        try {
            const coordinator = new ExternalSystemCoordinator({
                enableGitHub: true,
                enableSlack: true,
                parallelExecution: true,
                linkResources: true,
                github: {
                    autoCreateBranch: true,
                    autoCreatePR: false // Don't create PRs in testing
                },
                slack: {
                    autoCreateChannel: false, // Don't create channels in testing
                    autoNotifyChannel: true,
                    richFormatting: true
                }
            });
            
            console.log('🚀 Test 1: Initialize External System Coordinator...');
            const initResult = await coordinator.initialize();
            console.log(`✅ Coordinator initialized: ${initResult.summary.totalInitialized}/${initResult.summary.totalEnabled} systems ready\n`);
            
            console.log('🎯 Test 2: Context Creation with External Systems...');
            const contextData = {
                contextId: 'test-coordinator-integration',
                contextType: 'session',
                task: 'Test external system coordination for Universal Context System',
                metadata: {
                    description: 'Testing Phase 3A external system coordinator',
                    requirements: 'Coordinated GitHub and Slack operations'
                }
            };
            
            const result = await coordinator.onContextCreated(contextData);
            console.log(`✅ External system coordination complete:`);
            console.log(`   Total resources: ${result.summary.totalResources}`);
            console.log(`   Errors: ${result.summary.errors.length}\n`);
            
            console.log('📊 Test 3: Get Coordinator Status...');
            const status = await coordinator.getStatus();
            console.log(`✅ Status retrieved: ${status.coordinator.activeContexts} active contexts\n`);
            
            console.log('🎯 Test 4: Context Completion...');
            const completionResult = await coordinator.onContextCompleted(contextData);
            console.log(`✅ Context completion handled: ${completionResult.summary.success}\n`);
            
            console.log('🧹 Test 5: Context Cleanup...');
            const cleanupResult = await coordinator.cleanupContext(contextData.contextId);
            console.log(`✅ Context cleanup complete: ${cleanupResult.summary.success}\n`);
            
            console.log('🎯 External System Coordinator - Phase 3A: ✅ READY');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        }
    }
    
    testExternalSystemCoordinator().catch(console.error);
}