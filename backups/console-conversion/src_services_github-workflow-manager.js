/**
 * GitHub Workflow Manager - Advanced GitHub Automation
 * Provides intelligent branch management, PR automation, and workflow orchestration
 * Integrates with LonicFLex ServiceContainer and WorkflowOrchestrator
 */

const { Octokit } = require('@octokit/rest');
const { GitAutomation } = require('./git-automation');
const { getAuthManager } = require('../auth/auth-manager');
const { EventEmitter } = require('events');

/**
 * GitHub Workflow Manager - Central orchestration for GitHub operations
 */
class GitHubWorkflowManager extends EventEmitter {
    constructor(serviceContainer, config = {}) {
        super();

        if (!serviceContainer) {
            throw new Error('ServiceContainer is required for GitHubWorkflowManager');
        }

        this.serviceContainer = serviceContainer;
        this.config = {
            // Repository configuration
            owner: config.owner || 'levilonic',
            repo: config.repo || 'Lonic-Flex-Claude-system',
            defaultBranch: config.defaultBranch || 'main',

            // Branch management
            branchNamingStrategy: config.branchNamingStrategy || 'context-aware', // context-aware, simple, semantic
            branchPrefix: config.branchPrefix || 'claude',
            maxBranchAge: config.maxBranchAge || 7 * 24 * 60 * 60 * 1000, // 7 days

            // PR automation
            autoCreatePR: config.autoCreatePR !== false,
            prTemplate: config.prTemplate || 'comprehensive',
            autoAssignReviewers: config.autoAssignReviewers !== false,
            autoAddLabels: config.autoAddLabels !== false,

            // Integration settings
            enableSlackNotifications: config.enableSlackNotifications !== false,
            enableStatusChecks: config.enableStatusChecks !== false,

            ...config
        };

        // Core services
        this.octokit = null;
        this.authManager = null;
        this.gitAutomation = null;

        // State management
        this.activeBranches = new Map();
        this.pendingPRs = new Map();
        this.workflowHistory = [];

        // GitHub API management
        this.rateLimitInfo = null;
        this.lastApiCall = 0;

        console.log('🐙 GitHubWorkflowManager created with intelligent automation');
    }

    /**
     * Initialize GitHub Workflow Manager
     */
    async initialize() {
        try {
            // Initialize authentication
            this.authManager = getAuthManager();
            await this.authManager.initialize();

            // Get GitHub configuration
            const githubConfig = this.authManager.getGitHubConfig();
            this.config = { ...this.config, ...githubConfig };

            // Initialize Octokit
            this.octokit = new Octokit({
                auth: this.config.token,
                baseUrl: 'https://api.github.com'
            });

            // Initialize Git automation
            this.gitAutomation = new GitAutomation({
                repositoryPath: process.cwd(),
                branchPrefix: this.config.branchPrefix,
                enableAutoCommit: true,
                enableAutoPush: true
            });

            await this.gitAutomation.initialize();

            // Test GitHub API connectivity
            await this.validateGitHubConnection();

            // Load existing branch state
            await this.loadBranchState();

            console.log(`✅ GitHubWorkflowManager initialized for ${this.config.owner}/${this.config.repo}`);
            return this;

        } catch (error) {
            console.error('❌ GitHubWorkflowManager initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Create intelligent branch with context-aware naming
     */
    async createSmartBranch(context = {}) {
        const branchInfo = this.generateBranchInfo(context);

        try {
            // Check if branch already exists
            const existingBranch = await this.getBranchInfo(branchInfo.name);
            if (existingBranch) {
                console.log(`🌿 Branch already exists: ${branchInfo.name}`);
                return { ...branchInfo, existed: true, branch: existingBranch };
            }

            // Create local branch
            const localBranch = await this.gitAutomation.createBranch(branchInfo.name, {
                description: branchInfo.description,
                baseBranch: this.config.defaultBranch
            });

            // Create remote branch
            const remoteBranch = await this.createRemoteBranch(branchInfo.name, branchInfo);

            // Track active branch
            this.activeBranches.set(branchInfo.name, {
                ...branchInfo,
                createdAt: Date.now(),
                localBranch,
                remoteBranch,
                commits: [],
                status: 'active'
            });

            this.emit('branchCreated', branchInfo);
            console.log(`✅ Smart branch created: ${branchInfo.name}`);

            return { ...branchInfo, created: true, localBranch, remoteBranch };

        } catch (error) {
            console.error(`❌ Failed to create branch ${branchInfo.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Generate intelligent branch information based on context
     */
    generateBranchInfo(context = {}) {
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const sessionId = context.sessionId || `session-${Date.now()}`;

        let branchName, branchType, description;

        switch (this.config.branchNamingStrategy) {
            case 'context-aware':
                branchName = this.generateContextAwareBranchName(context);
                break;
            case 'semantic':
                branchName = this.generateSemanticBranchName(context);
                break;
            case 'simple':
            default:
                branchName = `${this.config.branchPrefix}/${sessionId}`;
                break;
        }

        // Determine branch type and description
        branchType = this.determineBranchType(context);
        description = this.generateBranchDescription(context, branchType);

        return {
            name: branchName,
            type: branchType,
            description,
            context: { ...context },
            sessionId,
            timestamp,
            baseBranch: this.config.defaultBranch
        };
    }

    /**
     * Generate context-aware branch name
     */
    generateContextAwareBranchName(context) {
        const parts = [this.config.branchPrefix];

        // Add type prefix
        if (context.type) {
            parts.push(context.type);
        } else if (context.task) {
            // Infer type from task
            if (context.task.includes('fix') || context.task.includes('bug')) {
                parts.push('bugfix');
            } else if (context.task.includes('feature') || context.task.includes('add')) {
                parts.push('feature');
            } else if (context.task.includes('enhance') || context.task.includes('improve')) {
                parts.push('enhancement');
            } else if (context.task.includes('refactor')) {
                parts.push('refactor');
            } else {
                parts.push('task');
            }
        } else {
            parts.push('development');
        }

        // Add descriptive part
        if (context.description) {
            const desc = context.description
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '-')
                .slice(0, 30);
            parts.push(desc);
        } else if (context.task) {
            const task = context.task
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '-')
                .slice(0, 30);
            parts.push(task);
        }

        // Add timestamp
        const timestamp = new Date().toISOString().slice(0, 10);
        parts.push(timestamp);

        return parts.join('/');
    }

    /**
     * Generate semantic branch name following gitflow conventions
     */
    generateSemanticBranchName(context) {
        const type = this.determineBranchType(context);
        const scope = context.scope || 'general';
        const description = (context.description || context.task || 'development')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 40);

        return `${type}/${scope}-${description}`;
    }

    /**
     * Determine branch type based on context
     */
    determineBranchType(context) {
        if (context.type) return context.type;

        const task = (context.task || context.description || '').toLowerCase();

        if (task.includes('fix') || task.includes('bug') || task.includes('error')) {
            return 'bugfix';
        } else if (task.includes('feature') || task.includes('add') || task.includes('new')) {
            return 'feature';
        } else if (task.includes('enhance') || task.includes('improve') || task.includes('optimize')) {
            return 'enhancement';
        } else if (task.includes('refactor') || task.includes('restructure')) {
            return 'refactor';
        } else if (task.includes('doc') || task.includes('readme')) {
            return 'docs';
        } else if (task.includes('test') || task.includes('spec')) {
            return 'test';
        } else if (task.includes('hotfix') || task.includes('urgent')) {
            return 'hotfix';
        } else {
            return 'task';
        }
    }

    /**
     * Generate comprehensive branch description
     */
    generateBranchDescription(context, branchType) {
        const descriptions = {
            feature: 'Implements new functionality',
            bugfix: 'Fixes identified bugs and issues',
            enhancement: 'Improves existing functionality',
            refactor: 'Code restructuring and optimization',
            docs: 'Documentation updates and improvements',
            test: 'Test additions and improvements',
            hotfix: 'Critical issue resolution',
            task: 'General development task'
        };

        let description = descriptions[branchType] || 'Development work';

        if (context.description) {
            description += `: ${context.description}`;
        } else if (context.task) {
            description += `: ${context.task}`;
        }

        if (context.sessionId) {
            description += ` (Session: ${context.sessionId})`;
        }

        return description;
    }

    /**
     * Create remote branch on GitHub
     */
    async createRemoteBranch(branchName, branchInfo) {
        try {
            // Get the SHA of the base branch
            const baseBranchRef = await this.octokit.rest.git.getRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `heads/${this.config.defaultBranch}`
            });

            // Create the new branch reference
            const newBranchRef = await this.octokit.rest.git.createRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `refs/heads/${branchName}`,
                sha: baseBranchRef.data.object.sha
            });

            console.log(`🌿 Remote branch created: ${branchName}`);
            return newBranchRef.data;

        } catch (error) {
            // Branch might already exist
            if (error.status === 422) {
                console.log(`⚠️ Remote branch already exists: ${branchName}`);
                return await this.getBranchInfo(branchName);
            }
            throw error;
        }
    }

    /**
     * Get branch information from GitHub
     */
    async getBranchInfo(branchName) {
        try {
            const branchRef = await this.octokit.rest.git.getRef({
                owner: this.config.owner,
                repo: this.config.repo,
                ref: `heads/${branchName}`
            });

            return branchRef.data;
        } catch (error) {
            if (error.status === 404) {
                return null; // Branch doesn't exist
            }
            throw error;
        }
    }

    /**
     * Create automated Pull Request
     */
    async createAutomatedPR(branchName, prOptions = {}) {
        try {
            const branchInfo = this.activeBranches.get(branchName) || { name: branchName };

            // Generate PR content
            const prContent = await this.generatePRContent(branchInfo, prOptions);

            // Create the pull request
            const pr = await this.octokit.rest.pulls.create({
                owner: this.config.owner,
                repo: this.config.repo,
                title: prContent.title,
                body: prContent.body,
                head: branchName,
                base: prOptions.baseBranch || this.config.defaultBranch,
                draft: prOptions.draft || false
            });

            // Auto-assign reviewers if enabled
            if (this.config.autoAssignReviewers && prOptions.reviewers) {
                await this.assignReviewers(pr.data.number, prOptions.reviewers);
            }

            // Auto-add labels if enabled
            if (this.config.autoAddLabels) {
                const labels = this.generatePRLabels(branchInfo, prOptions);
                if (labels.length > 0) {
                    await this.addLabelsToPR(pr.data.number, labels);
                }
            }

            // Track the PR
            this.pendingPRs.set(pr.data.number, {
                ...pr.data,
                branchName,
                createdAt: Date.now(),
                automated: true
            });

            this.emit('prCreated', {
                pr: pr.data,
                branch: branchInfo,
                automated: true
            });

            console.log(`✅ Automated PR created: #${pr.data.number} - ${prContent.title}`);
            return pr.data;

        } catch (error) {
            console.error(`❌ Failed to create PR for branch ${branchName}:`, error.message);
            throw error;
        }
    }

    /**
     * Generate comprehensive PR content
     */
    async generatePRContent(branchInfo, prOptions = {}) {
        const title = this.generatePRTitle(branchInfo, prOptions);
        const body = await this.generatePRBody(branchInfo, prOptions);

        return { title, body };
    }

    /**
     * Generate PR title
     */
    generatePRTitle(branchInfo, prOptions) {
        if (prOptions.title) return prOptions.title;

        const type = branchInfo.type || 'feat';
        const scope = prOptions.scope || 'general';
        const description = branchInfo.description || prOptions.description || 'Development changes';

        // Use conventional commit format for PR titles
        const typeEmojis = {
            feature: '✨',
            bugfix: '🐛',
            enhancement: '⚡',
            refactor: '♻️',
            docs: '📚',
            test: '🧪',
            hotfix: '🔥',
            task: '🔧'
        };

        const emoji = typeEmojis[type] || '🔧';
        const typeLabel = type === 'feature' ? 'feat' : type;

        return `${emoji} ${typeLabel}(${scope}): ${description}`;
    }

    /**
     * Generate comprehensive PR body
     */
    async generatePRBody(branchInfo, prOptions = {}) {
        const sections = [];

        // Summary section
        sections.push('## Summary');
        sections.push(branchInfo.description || prOptions.description || 'Development changes from LonicFLex system.');
        sections.push('');

        // Changes section
        sections.push('## Changes Made');
        const changes = await this.getChangeSummary(branchInfo.name);
        if (changes && changes.length > 0) {
            changes.forEach(change => sections.push(`- ${change}`));
        } else {
            sections.push('- See commit history for detailed changes');
        }
        sections.push('');

        // Type of change
        sections.push('## Type of Change');
        const changeTypes = {
            feature: '- [ ] New feature (non-breaking change which adds functionality)',
            bugfix: '- [x] Bug fix (non-breaking change which fixes an issue)',
            enhancement: '- [ ] Enhancement (non-breaking change which improves existing functionality)',
            refactor: '- [ ] Code refactor (no functional changes)',
            docs: '- [ ] Documentation update',
            test: '- [ ] Test additions or modifications',
            hotfix: '- [x] Hotfix (critical issue resolution)'
        };

        const selectedType = changeTypes[branchInfo.type] || changeTypes.task;
        Object.values(changeTypes).forEach(type => {
            sections.push(type === selectedType ? type : type.replace('[x]', '[ ]'));
        });
        sections.push('');

        // Testing section
        sections.push('## Testing');
        sections.push('- [ ] Unit tests pass');
        sections.push('- [ ] Integration tests pass');
        sections.push('- [ ] Manual testing completed');
        sections.push('- [ ] No breaking changes identified');
        sections.push('');

        // Checklist
        sections.push('## Checklist');
        sections.push('- [x] Code follows project style guidelines');
        sections.push('- [x] Self-review of code completed');
        sections.push('- [ ] Code is commented where necessary');
        sections.push('- [ ] Documentation updated if needed');
        sections.push('- [x] No new warnings introduced');
        sections.push('');

        // Additional context
        if (branchInfo.context && Object.keys(branchInfo.context).length > 0) {
            sections.push('## Additional Context');
            sections.push('```json');
            sections.push(JSON.stringify(branchInfo.context, null, 2));
            sections.push('```');
            sections.push('');
        }

        // Auto-generated footer
        sections.push('---');
        sections.push('🤖 *This PR was automatically generated by [LonicFLex](https://github.com/levilonic/Lonic-Flex-Claude-system)*');

        return sections.join('\n');
    }

    /**
     * Get change summary for PR body
     */
    async getChangeSummary(branchName) {
        try {
            const commits = await this.gitAutomation.getCommitsSinceBase(branchName);
            return commits.map(commit => {
                const message = commit.message.split('\n')[0]; // Get first line
                return message.length > 80 ? message.slice(0, 77) + '...' : message;
            });
        } catch (error) {
            console.warn('⚠️ Could not get change summary:', error.message);
            return [];
        }
    }

    /**
     * Generate labels for PR based on branch info
     */
    generatePRLabels(branchInfo, prOptions = {}) {
        const labels = [];

        // Type-based labels
        const typeLabels = {
            feature: 'enhancement',
            bugfix: 'bug',
            enhancement: 'improvement',
            refactor: 'refactor',
            docs: 'documentation',
            test: 'testing',
            hotfix: 'critical'
        };

        const typeLabel = typeLabels[branchInfo.type];
        if (typeLabel) labels.push(typeLabel);

        // Automated label
        labels.push('automated');

        // Custom labels from options
        if (prOptions.labels) {
            labels.push(...prOptions.labels);
        }

        return labels;
    }

    /**
     * Assign reviewers to PR
     */
    async assignReviewers(prNumber, reviewers) {
        try {
            await this.octokit.rest.pulls.requestReviewers({
                owner: this.config.owner,
                repo: this.config.repo,
                pull_number: prNumber,
                reviewers: Array.isArray(reviewers) ? reviewers : [reviewers]
            });

            console.log(`👥 Reviewers assigned to PR #${prNumber}: ${reviewers.join(', ')}`);
        } catch (error) {
            console.warn(`⚠️ Could not assign reviewers to PR #${prNumber}:`, error.message);
        }
    }

    /**
     * Add labels to PR
     */
    async addLabelsToPR(prNumber, labels) {
        try {
            await this.octokit.rest.issues.addLabels({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: prNumber,
                labels
            });

            console.log(`🏷️ Labels added to PR #${prNumber}: ${labels.join(', ')}`);
        } catch (error) {
            console.warn(`⚠️ Could not add labels to PR #${prNumber}:`, error.message);
        }
    }

    /**
     * Validate GitHub connection and permissions
     */
    async validateGitHubConnection() {
        try {
            // Test authentication
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            console.log(`🔐 GitHub authenticated as: ${user.login}`);

            // Test repository access
            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.config.owner,
                repo: this.config.repo
            });

            console.log(`📁 Repository access confirmed: ${repo.full_name}`);

            // Check rate limit
            const { data: rateLimit } = await this.octokit.rest.rateLimit.get();
            this.rateLimitInfo = rateLimit.rate;

            console.log(`⚡ API rate limit: ${this.rateLimitInfo.remaining}/${this.rateLimitInfo.limit}`);

            return { user, repo, rateLimit };

        } catch (error) {
            console.error('❌ GitHub validation failed:', error.message);
            throw error;
        }
    }

    /**
     * Load existing branch state from GitHub
     */
    async loadBranchState() {
        try {
            const { data: branches } = await this.octokit.rest.repos.listBranches({
                owner: this.config.owner,
                repo: this.config.repo,
                per_page: 100
            });

            // Filter for our managed branches
            const managedBranches = branches.filter(branch =>
                branch.name.startsWith(this.config.branchPrefix)
            );

            console.log(`📊 Found ${managedBranches.length} managed branches`);

            // Load branch information
            for (const branch of managedBranches) {
                this.activeBranches.set(branch.name, {
                    name: branch.name,
                    sha: branch.commit.sha,
                    loadedFromRemote: true,
                    status: 'active'
                });
            }

        } catch (error) {
            console.warn('⚠️ Could not load branch state:', error.message);
        }
    }

    /**
     * Get workflow manager statistics
     */
    getStats() {
        return {
            initialized: !!this.octokit,
            repository: `${this.config.owner}/${this.config.repo}`,
            activeBranches: this.activeBranches.size,
            pendingPRs: this.pendingPRs.size,
            rateLimitRemaining: this.rateLimitInfo?.remaining || 'unknown',
            branchNamingStrategy: this.config.branchNamingStrategy,
            config: {
                autoCreatePR: this.config.autoCreatePR,
                autoAssignReviewers: this.config.autoAssignReviewers,
                autoAddLabels: this.config.autoAddLabels
            }
        };
    }

    /**
     * Get system health
     */
    async getSystemHealth() {
        const health = {
            status: 'healthy',
            github_connectivity: 'unknown',
            rate_limit: null,
            active_branches: this.activeBranches.size,
            pending_prs: this.pendingPRs.size
        };

        try {
            // Check GitHub connectivity
            await this.octokit.rest.rateLimit.get();
            health.github_connectivity = 'connected';

            // Update rate limit info
            const { data: rateLimit } = await this.octokit.rest.rateLimit.get();
            health.rate_limit = {
                remaining: rateLimit.rate.remaining,
                limit: rateLimit.rate.limit,
                reset: new Date(rateLimit.rate.reset * 1000)
            };

            // Check if rate limit is low
            if (rateLimit.rate.remaining < 100) {
                health.status = 'warning';
            }

        } catch (error) {
            health.github_connectivity = 'disconnected';
            health.status = 'degraded';
        }

        return health;
    }

    /**
     * Cleanup old branches
     */
    async cleanupOldBranches() {
        const cutoffTime = Date.now() - this.config.maxBranchAge;
        let cleanedCount = 0;

        for (const [branchName, branchInfo] of this.activeBranches) {
            if (branchInfo.createdAt && branchInfo.createdAt < cutoffTime) {
                try {
                    // Check if branch has open PRs
                    const { data: prs } = await this.octokit.rest.pulls.list({
                        owner: this.config.owner,
                        repo: this.config.repo,
                        head: `${this.config.owner}:${branchName}`,
                        state: 'open'
                    });

                    if (prs.length === 0) {
                        // Delete the branch
                        await this.octokit.rest.git.deleteRef({
                            owner: this.config.owner,
                            repo: this.config.repo,
                            ref: `heads/${branchName}`
                        });

                        this.activeBranches.delete(branchName);
                        cleanedCount++;

                        console.log(`🧹 Cleaned up old branch: ${branchName}`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Could not cleanup branch ${branchName}:`, error.message);
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`✅ Cleaned up ${cleanedCount} old branches`);
        }

        return cleanedCount;
    }

    /**
     * Shutdown workflow manager
     */
    async shutdown() {
        console.log('🛑 Shutting down GitHubWorkflowManager...');

        // Cleanup any pending operations
        if (this.gitAutomation) {
            await this.gitAutomation.shutdown();
        }

        // Clear state
        this.activeBranches.clear();
        this.pendingPRs.clear();
        this.workflowHistory = [];

        this.emit('shutdown');
        console.log('✅ GitHubWorkflowManager shutdown complete');
    }
}

module.exports = {
    GitHubWorkflowManager
};