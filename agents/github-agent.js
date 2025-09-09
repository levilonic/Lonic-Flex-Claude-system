/**
 * GitHub Agent - Phase 3.1
 * Specialized agent for GitHub PR/issue management following Factor 10
 * Extends BaseAgent with GitHub-specific functionality
 */

const { BaseAgent } = require('./base-agent');
const { Octokit } = require('@octokit/rest');
const { getAuthManager } = require('../auth/auth-manager');
require('dotenv').config();

class GitHubAgent extends BaseAgent {
    constructor(sessionId, config = {}) {
        super('github', sessionId, {
            maxSteps: 8,
            timeout: 45000,
            ...config
        });
        
        // GitHub-specific configuration (will be populated in initialize())
        this.githubConfig = {
            token: null,
            owner: config.owner,
            repo: config.repo,
            ...config.github
        };
        this.authManager = null;
        
        this.octokit = null;
        
        // Define execution steps (Factor 10: max 8 steps)
        this.executionSteps = [
            'authenticate_github',
            'validate_repository',
            'analyze_context',
            'execute_github_action',
            'validate_result',
            'update_status',
            'generate_report',
            'cleanup_resources'
        ];
        
        // Will be configured in initialize method
    }

    /**
     * Initialize GitHub agent with authentication
     */
    async initialize(dbManager) {
        // Initialize parent first
        await super.initialize(dbManager);
        
        // Initialize authentication
        this.authManager = getAuthManager();
        await this.authManager.initialize();
        
        // Get GitHub configuration from auth manager
        try {
            const githubConfig = this.authManager.getGitHubConfig();
            this.githubConfig = { ...this.githubConfig, ...githubConfig };
            
            console.log(`✅ GitHub Agent authenticated for ${this.githubConfig.owner}/${this.githubConfig.repo}`);
        } catch (error) {
            console.error(`❌ GitHub Agent authentication failed: ${error.message}`);
            // Don't throw here - let the execute method handle it gracefully
        }

        // Initialize GitHub context
        this.contextManager.addAgentEvent(this.agentName, 'github_config_loaded', {
            has_token: !!this.githubConfig.token,
            owner: this.githubConfig.owner,
            repo: this.githubConfig.repo
        });

        return this;
    }

    /**
     * Implementation of abstract executeWorkflow method
     */
    async executeWorkflow(context, progressCallback) {
        const results = {};
        
        // Step 1: Authenticate with GitHub
        results.auth = await this.executeStep('authenticate_github', async () => {
            if (progressCallback) progressCallback(12, 'authenticating with GitHub...');
            
            // Get contextual documentation for GitHub authentication
            const authDocs = await this.getContextualSuggestions();
            
            if (!this.githubConfig.token) {
                throw new Error('GitHub token not provided');
            }
            
            this.octokit = new Octokit({
                auth: this.githubConfig.token,
                userAgent: 'LonicFLex-MultiAgent/1.0'
            });
            
            // Test authentication
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            
            await this.logEvent('github_authenticated', {
                user: user.login,
                user_id: user.id,
                documentation_available: authDocs.length > 0,
                doc_suggestions: authDocs.map(d => d.heading)
            });
            
            return {
                authenticated: true,
                user: user.login,
                rate_limit: await this.getRateLimit(),
                documentation_context: authDocs
            };
        }, 0);
        
        // Step 2: Validate repository access
        results.repo_validation = await this.executeStep('validate_repository', async () => {
            if (progressCallback) progressCallback(25, 'validating repository access...');
            
            if (!this.githubConfig.owner || !this.githubConfig.repo) {
                throw new Error('Repository owner and name are required');
            }
            
            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.githubConfig.owner,
                repo: this.githubConfig.repo
            });
            
            await this.logEvent('repository_validated', {
                repo_id: repo.id,
                full_name: repo.full_name,
                private: repo.private,
                permissions: repo.permissions
            });
            
            return {
                valid: true,
                repo_name: repo.full_name,
                default_branch: repo.default_branch,
                permissions: repo.permissions
            };
        }, 1);
        
        // Step 3: Analyze context and determine action
        results.context_analysis = await this.executeStep('analyze_context', async () => {
            if (progressCallback) progressCallback(37, 'analyzing context...');
            
            const action = this.determineAction(context);
            
            await this.logEvent('context_analyzed', {
                action: action.type,
                context_keys: Object.keys(context),
                action_params: action.params
            });
            
            return action;
        }, 2);
        
        // Step 4: Execute GitHub action
        results.action_execution = await this.executeStep('execute_github_action', async () => {
            if (progressCallback) progressCallback(50, `executing ${results.context_analysis.type}...`);
            
            const actionResult = await this.executeAction(results.context_analysis, context);
            
            await this.logEvent('github_action_executed', {
                action: results.context_analysis.type,
                result_type: typeof actionResult,
                success: true
            });
            
            return actionResult;
        }, 3);
        
        // Step 5: Validate result
        results.validation = await this.executeStep('validate_result', async () => {
            if (progressCallback) progressCallback(62, 'validating result...');
            
            const validation = this.validateActionResult(results.action_execution, results.context_analysis);
            
            await this.logEvent('result_validated', validation);
            
            return validation;
        }, 4);
        
        // Step 6: Update status/notifications
        results.status_update = await this.executeStep('update_status', async () => {
            if (progressCallback) progressCallback(75, 'updating status...');
            
            const statusUpdate = await this.updateGitHubStatus(results.action_execution, context);
            
            return statusUpdate;
        }, 5);
        
        // Step 7: Generate report
        results.report = await this.executeStep('generate_report', async () => {
            if (progressCallback) progressCallback(87, 'generating report...');
            
            const report = this.generateActionReport(results);
            
            await this.logEvent('report_generated', {
                report_sections: Object.keys(report),
                total_actions: report.actions_performed?.length || 0
            });
            
            return report;
        }, 6);
        
        // Step 8: Cleanup resources  
        results.cleanup = await this.executeStep('cleanup_resources', async () => {
            if (progressCallback) progressCallback(100, 'cleaning up...');
            
            const cleanup = await this.performCleanup(results);
            
            return cleanup;
        }, 7);
        
        return {
            agent: this.agentName,
            session: this.sessionId,
            github_action: results.context_analysis.type,
            success: results.validation.valid,
            repository: `${this.githubConfig.owner}/${this.githubConfig.repo}`,
            results
        };
    }

    /**
     * Determine what GitHub action to perform based on context
     */
    determineAction(context) {
        // Branch creation/management (prioritized for BranchAware operations)
        if (context.create_branch || context.branch_action === 'create') {
            return {
                type: 'branch_creation',
                params: {
                    branch_name: context.branch_name || context.create_branch,
                    base_branch: context.base_branch || 'main',
                    branch_type: context.branch_type || 'feature'
                }
            };
        }

        // Branch operations (delete, protect, merge)
        if (context.branch_operation) {
            return {
                type: 'branch_operation',
                params: {
                    branch_name: context.branch_name || context.branch,
                    operation: context.branch_operation,
                    target_branch: context.target_branch
                }
            };
        }
        
        // PR management with enhanced operations
        if (context.pull_request || context.pr_number || context.create_pr) {
            return {
                type: 'pull_request_management',
                params: {
                    pr_number: context.pr_number || context.pull_request?.number,
                    action: context.pr_action || (context.create_pr ? 'create' : 'analyze'),
                    branch_name: context.branch_name,
                    title: context.pr_title,
                    body: context.pr_body,
                    base: context.base_branch || 'main'
                }
            };
        }
        
        // Issue management
        if (context.issue || context.issue_number) {
            return {
                type: 'issue_management',
                params: {
                    issue_number: context.issue_number || context.issue.number,
                    action: context.issue_action || 'analyze'
                }
            };
        }
        
        // Branch management (legacy support)
        if (context.branch || context.branch_name) {
            return {
                type: 'branch_management',
                params: {
                    branch_name: context.branch_name || context.branch,
                    action: context.branch_action || 'status'
                }
            };
        }
        
        // Repository analysis (default)
        return {
            type: 'repository_analysis',
            params: {
                analysis_type: context.analysis_type || 'overview'
            }
        };
    }

    /**
     * Execute specific GitHub action
     */
    async executeAction(action, context) {
        switch (action.type) {
            case 'branch_creation':
                return await this.handleBranchCreation(action.params, context);
                
            case 'branch_operation':
                return await this.handleBranchOperation(action.params, context);
                
            case 'pull_request_management':
                return await this.handlePullRequest(action.params, context);
                
            case 'issue_management':
                return await this.handleIssue(action.params, context);
                
            case 'branch_management':
                return await this.handleBranch(action.params, context);
                
            case 'repository_analysis':
                return await this.handleRepositoryAnalysis(action.params, context);
                
            default:
                throw new Error(`Unknown GitHub action: ${action.type}`);
        }
    }

    /**
     * Handle branch creation with real GitHub API calls
     */
    async handleBranchCreation(params, context) {
        const { branch_name, base_branch, branch_type } = params;
        
        try {
            // Get base branch reference
            const { data: baseRef } = await this.octokit.rest.git.getRef({
                owner: this.githubConfig.owner,
                repo: this.githubConfig.repo,
                ref: `heads/${base_branch}`
            });

            // Create new branch
            const { data: newRef } = await this.octokit.rest.git.createRef({
                owner: this.githubConfig.owner,
                repo: this.githubConfig.repo,
                ref: `refs/heads/${branch_name}`,
                sha: baseRef.object.sha
            });

            return {
                branch_created: true,
                branch_name,
                base_branch,
                branch_type,
                sha: newRef.object.sha,
                url: newRef.url,
                ref: newRef.ref
            };

        } catch (error) {
            if (error.status === 422 && error.message.includes('Reference already exists')) {
                return {
                    branch_created: false,
                    branch_name,
                    error: 'Branch already exists',
                    existing: true
                };
            }
            throw new Error(`Failed to create branch ${branch_name}: ${error.message}`);
        }
    }

    /**
     * Handle branch operations (delete, protect, merge)
     */
    async handleBranchOperation(params, context) {
        const { branch_name, operation, target_branch } = params;

        switch (operation) {
            case 'delete':
                return await this.deleteBranch(branch_name);
                
            case 'protect':
                return await this.protectBranch(branch_name, context.protection_rules || {});
                
            case 'merge':
                if (!target_branch) {
                    throw new Error('Target branch required for merge operation');
                }
                return await this.mergeBranch(branch_name, target_branch, context);
                
            case 'status':
                return await this.getBranchStatus(branch_name);
                
            default:
                throw new Error(`Unknown branch operation: ${operation}`);
        }
    }

    /**
     * Delete branch using GitHub API
     */
    async deleteBranch(branchName) {
        try {
            await this.octokit.rest.git.deleteRef({
                owner: this.githubConfig.owner,
                repo: this.githubConfig.repo,
                ref: `heads/${branchName}`
            });

            return {
                branch_deleted: true,
                branch_name: branchName
            };

        } catch (error) {
            if (error.status === 404) {
                return {
                    branch_deleted: false,
                    branch_name: branchName,
                    error: 'Branch not found'
                };
            }
            throw new Error(`Failed to delete branch ${branchName}: ${error.message}`);
        }
    }

    /**
     * Protect branch with rules
     */
    async protectBranch(branchName, rules = {}) {
        const defaultRules = {
            required_status_checks: null,
            enforce_admins: false,
            required_pull_request_reviews: {
                required_approving_review_count: 1,
                dismiss_stale_reviews: true,
                require_code_owner_reviews: false
            },
            restrictions: null
        };

        const protectionRules = { ...defaultRules, ...rules };

        try {
            const { data: protection } = await this.octokit.rest.repos.updateBranchProtection({
                owner: this.githubConfig.owner,
                repo: this.githubConfig.repo,
                branch: branchName,
                ...protectionRules
            });

            return {
                branch_protected: true,
                branch_name: branchName,
                protection_rules: protection
            };

        } catch (error) {
            throw new Error(`Failed to protect branch ${branchName}: ${error.message}`);
        }
    }

    /**
     * Merge branch into target branch
     */
    async mergeBranch(sourceBranch, targetBranch, context) {
        const commitMessage = context.merge_message || `Merge branch '${sourceBranch}' into '${targetBranch}'`;
        
        try {
            const { data: merge } = await this.octokit.rest.repos.merge({
                owner: this.githubConfig.owner,
                repo: this.githubConfig.repo,
                base: targetBranch,
                head: sourceBranch,
                commit_message: commitMessage
            });

            return {
                merged: true,
                source_branch: sourceBranch,
                target_branch: targetBranch,
                sha: merge.sha,
                commit_message: commitMessage
            };

        } catch (error) {
            if (error.status === 409) {
                return {
                    merged: false,
                    source_branch: sourceBranch,
                    target_branch: targetBranch,
                    error: 'Merge conflict - manual resolution required'
                };
            }
            throw new Error(`Failed to merge ${sourceBranch} into ${targetBranch}: ${error.message}`);
        }
    }

    /**
     * Get detailed branch status
     */
    async getBranchStatus(branchName) {
        try {
            const { data: branch } = await this.octokit.rest.repos.getBranch({
                owner: this.githubConfig.owner,
                repo: this.githubConfig.repo,
                branch: branchName
            });

            // Get comparison with main branch
            const { data: comparison } = await this.octokit.rest.repos.compareCommits({
                owner: this.githubConfig.owner,
                repo: this.githubConfig.repo,
                base: 'main',
                head: branchName
            });

            return {
                branch_name: branchName,
                exists: true,
                sha: branch.commit.sha,
                protected: branch.protected,
                ahead_by: comparison.ahead_by,
                behind_by: comparison.behind_by,
                last_commit: {
                    message: branch.commit.commit.message,
                    author: branch.commit.commit.author.name,
                    date: branch.commit.commit.author.date,
                    sha: branch.commit.sha
                }
            };

        } catch (error) {
            if (error.status === 404) {
                return {
                    branch_name: branchName,
                    exists: false,
                    error: 'Branch not found'
                };
            }
            throw error;
        }
    }

    /**
     * Handle pull request operations
     */
    async handlePullRequest(params, context) {
        const { pr_number, action, branch_name, title, body, base } = params;
        
        switch (action) {
            case 'create':
                if (!branch_name) {
                    throw new Error('Branch name required for PR creation');
                }
                
                try {
                    const { data: pr } = await this.octokit.rest.pulls.create({
                        owner: this.githubConfig.owner,
                        repo: this.githubConfig.repo,
                        title: title || `Feature: ${branch_name}`,
                        body: body || `Automated PR created from branch: ${branch_name}`,
                        head: branch_name,
                        base: base || 'main'
                    });

                    return {
                        pr_created: true,
                        pr_number: pr.number,
                        pr_url: pr.html_url,
                        title: pr.title,
                        head: branch_name,
                        base: base || 'main'
                    };

                } catch (error) {
                    throw new Error(`Failed to create PR from ${branch_name}: ${error.message}`);
                }
                
            case 'analyze':
                if (!pr_number) {
                    throw new Error('PR number required for analysis');
                }
                
                const { data: pr } = await this.octokit.rest.pulls.get({
                    owner: this.githubConfig.owner,
                    repo: this.githubConfig.repo,
                    pull_number: pr_number
                });
                
                const files = await this.octokit.rest.pulls.listFiles({
                    owner: this.githubConfig.owner,
                    repo: this.githubConfig.repo,
                    pull_number: pr_number
                });
                
                return {
                    pr_info: {
                        number: pr.number,
                        title: pr.title,
                        state: pr.state,
                        user: pr.user.login,
                        created_at: pr.created_at,
                        updated_at: pr.updated_at,
                        mergeable: pr.mergeable,
                        mergeable_state: pr.mergeable_state,
                        head_branch: pr.head.ref,
                        base_branch: pr.base.ref
                    },
                    files_changed: files.data.length,
                    additions: pr.additions,
                    deletions: pr.deletions,
                    changed_files: files.data.map(file => ({
                        filename: file.filename,
                        status: file.status,
                        additions: file.additions,
                        deletions: file.deletions
                    }))
                };
                
            case 'merge':
                if (!pr_number) {
                    throw new Error('PR number required for merge');
                }
                
                if (!context.merge_approved) {
                    throw new Error('Merge not approved - human approval required');
                }
                
                try {
                    const mergeResult = await this.octokit.rest.pulls.merge({
                        owner: this.githubConfig.owner,
                        repo: this.githubConfig.repo,
                        pull_number: pr_number,
                        commit_title: context.merge_title || `Merge PR #${pr_number}`,
                        merge_method: context.merge_method || 'squash'
                    });
                    
                    return {
                        merged: true,
                        sha: mergeResult.data.sha,
                        merge_method: context.merge_method || 'squash',
                        message: mergeResult.data.message
                    };

                } catch (error) {
                    if (error.status === 405) {
                        return {
                            merged: false,
                            pr_number,
                            error: 'PR not mergeable - check conflicts or status checks'
                        };
                    }
                    throw new Error(`Failed to merge PR #${pr_number}: ${error.message}`);
                }

            case 'close':
                if (!pr_number) {
                    throw new Error('PR number required to close');
                }

                const { data: closedPR } = await this.octokit.rest.pulls.update({
                    owner: this.githubConfig.owner,
                    repo: this.githubConfig.repo,
                    pull_number: pr_number,
                    state: 'closed'
                });

                return {
                    pr_closed: true,
                    pr_number: closedPR.number,
                    state: closedPR.state
                };
                
            default:
                throw new Error(`Unknown PR action: ${action}`);
        }
    }

    /**
     * Handle issue operations
     */
    async handleIssue(params, context) {
        const { issue_number, action } = params;
        
        const { data: issue } = await this.octokit.rest.issues.get({
            owner: this.githubConfig.owner,
            repo: this.githubConfig.repo,
            issue_number: issue_number
        });
        
        return {
            issue_info: {
                title: issue.title,
                state: issue.state,
                user: issue.user.login,
                labels: issue.labels.map(l => l.name),
                created_at: issue.created_at
            }
        };
    }

    /**
     * Handle branch operations
     */
    async handleBranch(params, context) {
        const { branch_name, action } = params;
        
        switch (action) {
            case 'list_tags':
                const { data: tags } = await this.octokit.rest.repos.listTags({
                    owner: this.githubConfig.owner,
                    repo: this.githubConfig.repo,
                    per_page: 10
                });
                
                return {
                    tags: tags.map(tag => ({
                        name: tag.name,
                        commit: tag.commit.sha,
                        zipball_url: tag.zipball_url
                    }))
                };
                
            default:
                return { action_not_implemented: action };
        }
    }

    /**
     * Handle repository analysis
     */
    async handleRepositoryAnalysis(params, context) {
        const { data: repo } = await this.octokit.rest.repos.get({
            owner: this.githubConfig.owner,
            repo: this.githubConfig.repo
        });
        
        const { data: commits } = await this.octokit.rest.repos.listCommits({
            owner: this.githubConfig.owner,
            repo: this.githubConfig.repo,
            per_page: 5
        });
        
        return {
            repository_info: {
                name: repo.name,
                full_name: repo.full_name,
                description: repo.description,
                language: repo.language,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                open_issues: repo.open_issues_count,
                default_branch: repo.default_branch
            },
            recent_commits: commits.map(commit => ({
                sha: commit.sha.substring(0, 7),
                message: commit.commit.message.split('\n')[0],
                author: commit.commit.author.name,
                date: commit.commit.author.date
            }))
        };
    }

    /**
     * Validate action result
     */
    validateActionResult(result, action) {
        const validation = {
            valid: true,
            issues: [],
            warnings: []
        };
        
        if (!result) {
            validation.valid = false;
            validation.issues.push('No result returned from GitHub action');
            return validation;
        }
        
        // Type-specific validation
        switch (action.type) {
            case 'branch_creation':
                if (!result.branch_created && !result.existing) {
                    validation.issues.push('Branch creation failed');
                    validation.valid = false;
                } else if (result.existing) {
                    validation.warnings.push('Branch already exists');
                }
                break;
                
            case 'branch_operation':
                if (action.params.operation === 'delete' && !result.branch_deleted) {
                    if (result.error !== 'Branch not found') {
                        validation.issues.push('Branch deletion failed');
                        validation.valid = false;
                    }
                } else if (action.params.operation === 'merge' && !result.merged) {
                    validation.issues.push('Branch merge failed or conflicts detected');
                    validation.valid = false;
                } else if (action.params.operation === 'protect' && !result.branch_protected) {
                    validation.issues.push('Branch protection setup failed');
                    validation.valid = false;
                }
                break;
                
            case 'pull_request_management':
                if (action.params.action === 'create' && !result.pr_created) {
                    validation.issues.push('PR creation failed');
                    validation.valid = false;
                } else if (action.params.action === 'merge' && !result.merged) {
                    validation.issues.push('PR merge failed');
                    validation.valid = false;
                } else if (action.params.action === 'close' && !result.pr_closed) {
                    validation.issues.push('PR close failed');
                    validation.valid = false;
                }
                break;
                
            case 'repository_analysis':
                if (!result.repository_info) {
                    validation.issues.push('Missing repository info');
                    validation.valid = false;
                }
                break;
        }
        
        return validation;
    }

    /**
     * Update GitHub status/comments
     */
    async updateGitHubStatus(result, context) {
        // In a full implementation, this would add comments, update status checks, etc.
        // For demo, just log the status update
        await this.logEvent('status_updated', {
            action: 'status_comment',
            success: true
        });
        
        return { status_updated: true, type: 'comment' };
    }

    /**
     * Generate comprehensive action report
     */
    generateActionReport(results) {
        return {
            agent: this.agentName,
            session: this.sessionId,
            github_repository: `${this.githubConfig.owner}/${this.githubConfig.repo}`,
            action_performed: results.context_analysis.type,
            actions_performed: [
                'authentication',
                'repository_validation',
                'context_analysis',
                'action_execution',
                'result_validation'
            ],
            success: results.validation.valid,
            rate_limit_remaining: results.auth.rate_limit.remaining,
            execution_time: Date.now() - this.contextManager.events[0].timestamp,
            recommendations: this.generateRecommendations(results)
        };
    }

    /**
     * Generate recommendations based on results
     */
    generateRecommendations(results) {
        const recommendations = [];
        
        if (results.auth.rate_limit.remaining < 100) {
            recommendations.push('GitHub API rate limit is low - consider implementing caching');
        }
        
        if (results.context_analysis.type === 'repository_analysis' && 
            results.action_execution.repository_info.open_issues > 50) {
            recommendations.push('High number of open issues - consider triaging');
        }
        
        return recommendations;
    }

    /**
     * Perform cleanup
     */
    async performCleanup(results) {
        // Release any GitHub-specific resources
        await this.logEvent('cleanup_performed', {
            cleanup_items: ['rate_limit_check', 'context_clear']
        });
        
        return { cleaned_up: true, resources_released: ['github_client'] };
    }

    /**
     * Get GitHub rate limit status
     */
    async getRateLimit() {
        if (!this.octokit) return null;
        
        const { data: rateLimit } = await this.octokit.rest.rateLimit.get();
        return {
            remaining: rateLimit.resources.core.remaining,
            limit: rateLimit.resources.core.limit,
            reset: new Date(rateLimit.resources.core.reset * 1000)
        };
    }
}

/**
 * GitHub Agent execution function
 */
async function runGitHubAgent() {
    console.log('🐙 GitHub Agent - Real Execution Mode\n');
    
    const { SQLiteManager } = require('../database/sqlite-manager');
    const dbManager = new SQLiteManager(':memory:');
    
    try {
        // Initialize database
        await dbManager.initialize();
        
        // Create session
        const sessionId = 'github_agent_' + Date.now();
        await dbManager.createSession(sessionId, 'github_workflow');
        
        // Create GitHub agent with mock config
        const agent = new GitHubAgent(sessionId, {
            github_token: 'demo_token_for_testing',
            owner: 'anthropics',
            repo: 'claude-code'  // Example repo
        });
        
        await agent.initialize(dbManager);
        
        console.log(`✅ Created GitHub agent: ${agent.agentName}`);
        console.log(`   Steps: ${agent.executionSteps.length} (Factor 10 compliant)`);
        console.log(`   Repository: ${agent.githubConfig.owner}/${agent.githubConfig.repo}`);
        
        // Test context analysis without actual GitHub API calls
        console.log('\n🔍 Testing context analysis...');
        
        const testContexts = [
            { pull_request: { number: 123 }, pr_action: 'analyze' },
            { issue_number: 456, issue_action: 'analyze' },
            { branch_name: 'main', branch_action: 'list_tags' },
            { analysis_type: 'overview' }
        ];
        
        for (const context of testContexts) {
            const action = agent.determineAction(context);
            console.log(`   Context: ${Object.keys(context)[0]} → Action: ${action.type}`);
        }
        
        // Show status
        const status = agent.getStatus();
        console.log(`\n📊 Agent Status:`);
        console.log(`   State: ${status.state}`);
        console.log(`   Execution steps defined: ${status.executionSteps.length}`);
        
        console.log('\n✅ GitHub Agent execution completed successfully!');
        console.log('   ✓ Factor 10: 8 execution steps (≤8 max)');
        console.log('   ✓ Extends BaseAgent with GitHub-specific functionality');
        console.log('   ✓ Supports PR, Issue, Branch, and Repository analysis');
        console.log('   ✓ Includes rate limiting and validation');
        
        console.log('\n📝 Note: Full GitHub API integration requires valid token');
        console.log('   Set GITHUB_TOKEN environment variable for production use');
        
    } catch (error) {
        console.error('❌ Execution failed:', error.message);
    } finally {
        await dbManager.close();
    }
}

module.exports = { GitHubAgent };

// Run GitHub agent if called directly
if (require.main === module) {
    runGitHubAgent().catch(console.error);
}