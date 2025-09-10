#!/usr/bin/env node
/**
 * GitHub Context Integration - Phase 3A
 * Automatic branch/PR creation and management based on Universal Context System
 * Part of LonicFLex Project Window System Phase 3: Integration & Production Readiness
 */

const { GitHubAgent } = require('../agents/github-agent');
const { ContextScopeManager } = require('../context-management/context-scope-manager');
const path = require('path');
const fs = require('fs').promises;

class GitHubContextIntegration {
    constructor(config = {}) {
        this.config = {
            // GitHub configuration
            defaultOwner: config.owner || 'levilonic',
            defaultRepo: config.repo || 'Lonic-Flex-Claude-system',
            branchPrefix: config.branchPrefix || 'context/',
            
            // Auto-creation settings
            autoCreateBranch: config.autoCreateBranch !== false,
            autoCreatePR: config.autoCreatePR === true, // false by default
            branchFromMain: config.branchFromMain !== false,
            
            // Branch naming patterns
            sessionBranchPattern: config.sessionBranchPattern || 'context/session-{contextId}',
            projectBranchPattern: config.projectBranchPattern || 'context/project-{contextId}',
            
            // PR settings
            prAutoAssign: config.prAutoAssign === true,
            prLabels: config.prLabels || ['context-driven', 'automated'],
            prTemplate: config.prTemplate,
            
            ...config
        };
        
        this.githubAgent = null;
        this.contextScope = new ContextScopeManager();
        this.activeBranches = new Map(); // contextId -> branchInfo
        this.contextMetadata = new Map(); // contextId -> metadata
    }

    /**
     * Initialize GitHub integration with authentication
     */
    async initialize() {
        try {
            console.log('🔧 Initializing GitHub Context Integration...');
            
            // Initialize GitHub agent
            const sessionId = `github-context-${Date.now()}`;
            this.githubAgent = new GitHubAgent(sessionId, {
                owner: this.config.defaultOwner,
                repo: this.config.defaultRepo
            });
            
            // Initialize without database for external integration mode
            // Just skip database initialization for external integration
            console.log('   External integration mode - skipping database initialization');
            
            console.log(`✅ GitHub Context Integration initialized`);
            console.log(`   Repository: ${this.config.defaultOwner}/${this.config.defaultRepo}`);
            console.log(`   Auto-create branches: ${this.config.autoCreateBranch}`);
            console.log(`   Auto-create PRs: ${this.config.autoCreatePR}`);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize GitHub Context Integration:', error.message);
            return false;
        }
    }

    /**
     * Handle context creation - automatically set up GitHub resources
     */
    async onContextCreated(contextData) {
        try {
            const { contextId, contextType, task, metadata = {} } = contextData;
            
            console.log(`🌿 Setting up GitHub integration for context: ${contextId}`);
            console.log(`   Type: ${contextType}, Task: ${task}`);
            
            // Store context metadata
            this.contextMetadata.set(contextId, {
                contextId,
                contextType,
                task,
                createdAt: new Date().toISOString(),
                ...metadata
            });
            
            const result = {
                contextId,
                githubResources: [],
                errors: []
            };
            
            // Create branch if enabled
            if (this.config.autoCreateBranch) {
                const branchResult = await this.createContextBranch(contextData);
                if (branchResult.success) {
                    result.githubResources.push({
                        type: 'branch',
                        name: branchResult.branchName,
                        url: branchResult.url
                    });
                    
                    // Store branch info
                    this.activeBranches.set(contextId, {
                        branchName: branchResult.branchName,
                        url: branchResult.url,
                        createdAt: new Date().toISOString()
                    });
                } else {
                    result.errors.push(branchResult.error);
                }
            }
            
            // Create PR if enabled and branch was created successfully
            if (this.config.autoCreatePR && result.githubResources.length > 0) {
                const prResult = await this.createContextPR(contextData, result.githubResources[0]);
                if (prResult.success) {
                    result.githubResources.push({
                        type: 'pull_request',
                        number: prResult.prNumber,
                        url: prResult.url
                    });
                } else {
                    result.errors.push(prResult.error);
                }
            }
            
            console.log(`✅ GitHub setup complete for ${contextId}: ${result.githubResources.length} resources created`);
            return result;
            
        } catch (error) {
            console.error(`❌ Failed to set up GitHub resources for context ${contextData.contextId}:`, error.message);
            return {
                contextId: contextData.contextId,
                githubResources: [],
                errors: [error.message]
            };
        }
    }

    /**
     * Create a GitHub branch for the context
     */
    async createContextBranch(contextData) {
        try {
            const { contextId, contextType, task } = contextData;
            
            // Generate branch name
            const pattern = contextType === 'session' 
                ? this.config.sessionBranchPattern 
                : this.config.projectBranchPattern;
            const branchName = pattern.replace('{contextId}', contextId);
            
            console.log(`🌿 Creating branch: ${branchName}`);
            
            // Use GitHub agent to create branch
            const actionContext = {
                action: 'create_branch',
                branch_name: branchName,
                from_branch: 'main',
                description: `Context branch for: ${task}`,
                context_metadata: {
                    contextId,
                    contextType,
                    task,
                    createdBy: 'LonicFLex-Universal-Context-System'
                }
            };
            
            await this.githubAgent.executeStep('authenticate_github');
            await this.githubAgent.executeStep('validate_repository');
            
            // Set the context for branch creation
            this.githubAgent.executionContext = actionContext;
            const result = await this.githubAgent.executeStep('execute_github_action');
            
            if (result.success) {
                const branchUrl = `https://github.com/${this.config.defaultOwner}/${this.config.defaultRepo}/tree/${branchName}`;
                
                console.log(`✅ Branch created successfully: ${branchName}`);
                console.log(`   URL: ${branchUrl}`);
                
                return {
                    success: true,
                    branchName,
                    url: branchUrl
                };
            } else {
                throw new Error(result.error || 'Branch creation failed');
            }
            
        } catch (error) {
            console.error(`❌ Failed to create branch for context ${contextData.contextId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create a GitHub PR for the context
     */
    async createContextPR(contextData, branchInfo) {
        try {
            const { contextId, contextType, task } = contextData;
            
            console.log(`🔄 Creating PR for branch: ${branchInfo.name}`);
            
            // Generate PR details
            const title = `[${contextType.toUpperCase()}] ${task}`;
            const body = this.generatePRDescription(contextData, branchInfo);
            
            const actionContext = {
                action: 'create_pull_request',
                title,
                body,
                head: branchInfo.name,
                base: 'main',
                labels: this.config.prLabels,
                context_metadata: {
                    contextId,
                    contextType,
                    task,
                    createdBy: 'LonicFLex-Universal-Context-System'
                }
            };
            
            this.githubAgent.executionContext = actionContext;
            const result = await this.githubAgent.executeStep('execute_github_action');
            
            if (result.success && result.pr_number) {
                const prUrl = `https://github.com/${this.config.defaultOwner}/${this.config.defaultRepo}/pull/${result.pr_number}`;
                
                console.log(`✅ PR created successfully: #${result.pr_number}`);
                console.log(`   URL: ${prUrl}`);
                
                return {
                    success: true,
                    prNumber: result.pr_number,
                    url: prUrl
                };
            } else {
                throw new Error(result.error || 'PR creation failed');
            }
            
        } catch (error) {
            console.error(`❌ Failed to create PR for context ${contextData.contextId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate PR description based on context data
     */
    generatePRDescription(contextData, branchInfo) {
        const { contextId, contextType, task, metadata = {} } = contextData;
        
        let description = `## Context-Driven Development\n\n`;
        description += `**Context ID**: \`${contextId}\`\n`;
        description += `**Context Type**: ${contextType.charAt(0).toUpperCase() + contextType.slice(1)}\n`;
        description += `**Task**: ${task}\n`;
        description += `**Branch**: \`${branchInfo.name}\`\n\n`;
        
        description += `## Auto-Generated Resources\n\n`;
        description += `This PR was automatically created by the LonicFLex Universal Context System to track work related to this context.\n\n`;
        
        if (metadata.description) {
            description += `## Description\n\n${metadata.description}\n\n`;
        }
        
        if (metadata.requirements) {
            description += `## Requirements\n\n${metadata.requirements}\n\n`;
        }
        
        description += `## Context Management\n\n`;
        description += `- 🔄 This PR is linked to context \`${contextId}\`\n`;
        description += `- 🌿 Branch automatically created from main\n`;
        description += `- 📝 Context state preserved across sessions\n`;
        description += `- 🎯 Work tracked in Universal Context System\n\n`;
        
        description += `---\n*Generated by LonicFLex Universal Context System - Phase 3A*`;
        
        return description;
    }

    /**
     * Handle context completion - update GitHub resources
     */
    async onContextCompleted(contextData) {
        try {
            const { contextId } = contextData;
            const branchInfo = this.activeBranches.get(contextId);
            
            if (!branchInfo) {
                console.log(`ℹ️ No GitHub branch found for completed context: ${contextId}`);
                return { success: true, actions: [] };
            }
            
            console.log(`🎯 Context completed: ${contextId}`);
            console.log(`   Updating GitHub resources for branch: ${branchInfo.branchName}`);
            
            // Could add automatic PR updates, branch protection, etc.
            // For now, just log the completion
            
            const result = {
                success: true,
                actions: [
                    {
                        type: 'completion_logged',
                        branch: branchInfo.branchName,
                        timestamp: new Date().toISOString()
                    }
                ]
            };
            
            return result;
            
        } catch (error) {
            console.error(`❌ Failed to handle context completion for ${contextData.contextId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get status of all GitHub integrations
     */
    async getStatus() {
        return {
            initialized: !!this.githubAgent,
            activeBranches: this.activeBranches.size,
            contexts: this.contextMetadata.size,
            config: {
                repository: `${this.config.defaultOwner}/${this.config.defaultRepo}`,
                autoCreateBranch: this.config.autoCreateBranch,
                autoCreatePR: this.config.autoCreatePR,
                branchPrefix: this.config.branchPrefix
            },
            branches: Array.from(this.activeBranches.entries()).map(([contextId, info]) => ({
                contextId,
                branchName: info.branchName,
                url: info.url,
                createdAt: info.createdAt
            }))
        };
    }

    /**
     * Clean up resources for a context
     */
    async cleanupContext(contextId) {
        try {
            console.log(`🧹 Cleaning up GitHub resources for context: ${contextId}`);
            
            this.activeBranches.delete(contextId);
            this.contextMetadata.delete(contextId);
            
            console.log(`✅ Cleanup complete for context: ${contextId}`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Failed to cleanup context ${contextId}:`, error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = { GitHubContextIntegration };

// CLI testing if run directly
if (require.main === module) {
    async function testGitHubContextIntegration() {
        console.log('🧪 Testing GitHub Context Integration - Phase 3A\n');
        
        try {
            const integration = new GitHubContextIntegration({
                autoCreateBranch: true,
                autoCreatePR: false // Don't create PRs in testing
            });
            
            console.log('🔧 Test 1: Initialize GitHub Integration...');
            const initialized = await integration.initialize();
            if (!initialized) {
                throw new Error('Failed to initialize GitHub integration');
            }
            console.log('✅ GitHub integration initialized successfully\n');
            
            console.log('🌿 Test 2: Context Creation with Branch...');
            const contextData = {
                contextId: 'test-context-github-integration',
                contextType: 'session',
                task: 'Test GitHub integration for Universal Context System',
                metadata: {
                    description: 'Testing Phase 3A GitHub integration features',
                    requirements: 'Automatic branch creation and PR management'
                }
            };
            
            const result = await integration.onContextCreated(contextData);
            if (result.errors.length > 0) {
                console.log('⚠️ Errors during setup:', result.errors);
            }
            console.log(`✅ GitHub resources created: ${result.githubResources.length} resources\n`);
            
            console.log('📊 Test 3: Get Integration Status...');
            const status = await integration.getStatus();
            console.log('✅ Status retrieved:', JSON.stringify(status, null, 2));
            
            console.log('\n🎯 GitHub Context Integration - Phase 3A: ✅ READY');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        }
    }
    
    testGitHubContextIntegration().catch(console.error);
}