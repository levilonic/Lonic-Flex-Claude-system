const { logger } = require('./logger');
/**
 * REAL Repository Configuration Manager
 * Actually manages GitHub repository settings via API
 * NO DEMOS - REAL IMPLEMENTATION ONLY
 */

const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');

class RepositoryConfigManager {
    constructor(config = {}) {
        this.config = {
            owner: config.owner || 'levilonic',
            repo: config.repo || 'Lonic-Flex-Claude-system',
            ...config
        };

        this.octokit = null;
        this.repoSettings = null;

        logger.info('⚙️ Repository Configuration Manager initialized for', `${this.config.owner}/${this.config.repo}`);
    }

    /**
     * Initialize with REAL GitHub token
     */
    async initialize() {
        // Get REAL token from GitHub CLI or environment
        let token = process.env.GITHUB_TOKEN;

        if (!token || token === 'YOUR_GITHUB_TOKEN_HERE') {
            try {
                // Get token from GitHub CLI
                token = execSync('gh auth token', { encoding: 'utf8' }).trim();
                logger.info('Using GitHub CLI token');
            } catch (error) {
                throw new Error('No valid GitHub token available. Set GITHUB_TOKEN or authenticate with gh CLI');
            }
        }

        this.octokit = new Octokit({
            auth: token,
            userAgent: 'LonicFLex-Repository-Config-Manager/1.0'
        });

        // Verify authentication and repository access
        try {
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            logger.info(`REAL GitHub API authenticated as: ${user.login}`);

            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.config.owner,
                repo: this.config.repo
            });

            this.repoSettings = repo;
            logger.info(`Repository access verified: ${repo.full_name}`);

            return true;

        } catch (error) {
            throw new Error(`GitHub repository access failed: ${error.message}`);
        }
    }

    /**
     * Configure repository settings for LonicFLex
     */
    async configureRepository() {
        logger.debug('Configuring repository settings...');

        try {
            const updates = {
                description: 'LonicFLex Universal Context System - Production-ready multi-agent architecture with GitHub automation',
                homepage: 'https://github.com/levilonic/Lonic-Flex-Claude-system',
                topics: [
                    'lonicflex',
                    'multi-agent-system',
                    'github-automation',
                    'universal-context',
                    'claude-code',
                    'ai-agents',
                    'workflow-orchestration',
                    'nodejs',
                    'javascript',
                    'automation'
                ],
                has_issues: true,
                has_projects: true,
                has_wiki: false,
                has_downloads: true,
                allow_squash_merge: true,
                allow_merge_commit: true,
                allow_rebase_merge: true,
                delete_branch_on_merge: true,
                allow_auto_merge: false,
                allow_update_branch: true
            };

            const { data: updatedRepo } = await this.octokit.rest.repos.update({
                owner: this.config.owner,
                repo: this.config.repo,
                ...updates
            });

            logger.info('Repository settings updated successfully');
            logger.info(`   Description: ${updatedRepo.description}`);
            logger.info(`   Topics: ${updatedRepo.topics.join(', ')}`);

            return updatedRepo;

        } catch (error) {
            logger.error('❌ Failed to configure repository:', error.message);
            throw error;
        }
    }

    /**
     * Set up branch protection rules
     */
    async configureBranchProtection(branch = 'master') {
        logger.info(`🛡️ Configuring branch protection for: ${branch}`);

        try {
            const protectionRules = {
                required_status_checks: {
                    strict: true,
                    contexts: ['test']
                },
                enforce_admins: false,
                required_pull_request_reviews: {
                    required_approving_review_count: 1,
                    dismiss_stale_reviews: true,
                    require_code_owner_reviews: false
                },
                restrictions: null
            };

            const { data: protection } = await this.octokit.rest.repos.updateBranchProtection({
                owner: this.config.owner,
                repo: this.config.repo,
                branch: branch,
                ...protectionRules
            });

            logger.info(`Branch protection configured for: ${branch}`);
            logger.info(`   Required status checks: ${protection.required_status_checks.contexts.join(', ')}`);

            return protection;

        } catch (error) {
            if (error.status === 404) {
                logger.warn(`Branch ${branch} not found or no push access for protection rules`);
                return null;
            }
            logger.error(`❌ Failed to configure branch protection for ${branch}:`, error.message);
            throw error;
        }
    }

    /**
     * Set up repository labels for LonicFLex
     */
    async configureLabels() {
        logger.info('🏷️ Configuring repository labels...');

        const lonicflexLabels = [
            // Agent types
            { name: 'agent:github', color: '0052CC', description: 'GitHub Agent related' },
            { name: 'agent:security', color: 'D93F0B', description: 'Security Agent related' },
            { name: 'agent:code', color: '0E8A16', description: 'Code Agent related' },
            { name: 'agent:deploy', color: '7057FF', description: 'Deploy Agent related' },
            { name: 'agent:comm', color: 'FBCA04', description: 'Communication Agent related' },

            // System components
            { name: 'universal-context', color: '1D76DB', description: 'Universal Context System' },
            { name: 'multi-agent', color: 'FF6B6B', description: 'Multi-Agent System' },
            { name: 'github-automation', color: '4ECDC4', description: 'GitHub Automation' },
            { name: 'workflow-orchestration', color: '45B7D1', description: 'Workflow Orchestration' },

            // Priority levels
            { name: 'priority:critical', color: 'B60205', description: 'Critical priority' },
            { name: 'priority:high', color: 'D93F0B', description: 'High priority' },
            { name: 'priority:medium', color: 'FBCA04', description: 'Medium priority' },
            { name: 'priority:low', color: '0E8A16', description: 'Low priority' },

            // Issue types
            { name: 'type:enhancement', color: '84B6EB', description: 'Enhancement or new feature' },
            { name: 'type:bug', color: 'D93F0B', description: 'Bug fix required' },
            { name: 'type:documentation', color: '5319E7', description: 'Documentation update' },
            { name: 'type:maintenance', color: '2E8B57', description: 'Maintenance task' },

            // Status
            { name: 'status:in-progress', color: 'FFA500', description: 'Work in progress' },
            { name: 'status:blocked', color: 'DC143C', description: 'Blocked by dependency' },
            { name: 'status:ready', color: '32CD32', description: 'Ready for implementation' }
        ];

        const createdLabels = [];
        const updatedLabels = [];
        const errors = [];

        for (const label of lonicflexLabels) {
            try {
                // Try to create the label
                const { data: createdLabel } = await this.octokit.rest.issues.createLabel({
                    owner: this.config.owner,
                    repo: this.config.repo,
                    name: label.name,
                    color: label.color,
                    description: label.description
                });

                createdLabels.push(createdLabel.name);
                logger.info(`Created label: ${createdLabel.name}`);

            } catch (error) {
                if (error.status === 422) {
                    // Label already exists, try to update it
                    try {
                        const { data: updatedLabel } = await this.octokit.rest.issues.updateLabel({
                            owner: this.config.owner,
                            repo: this.config.repo,
                            name: label.name,
                            color: label.color,
                            description: label.description
                        });

                        updatedLabels.push(updatedLabel.name);
                        logger.info(`🔄 Updated label: ${updatedLabel.name}`);

                    } catch (updateError) {
                        errors.push({ label: label.name, error: updateError.message });
                        logger.error(`❌ Failed to update label ${label.name}:`, updateError.message);
                    }
                } else {
                    errors.push({ label: label.name, error: error.message });
                    logger.error(`❌ Failed to create label ${label.name}:`, error.message);
                }
            }
        }

        logger.info(`Label configuration complete: ${createdLabels.length} created, ${updatedLabels.length} updated`);

        return {
            created: createdLabels,
            updated: updatedLabels,
            errors: errors
        };
    }

    /**
     * Create repository environments for deployment
     */
    async configureEnvironments() {
        logger.info('🌍 Configuring deployment environments...');

        const environments = [
            {
                name: 'staging',
                wait_timer: 0,
                reviewers: [],
                deployment_branch_policy: {
                    protected_branches: false,
                    custom_branch_policies: true
                }
            },
            {
                name: 'production',
                wait_timer: 30, // 30 minute delay
                reviewers: [
                    {
                        type: 'User',
                        id: await this.getUserId()
                    }
                ],
                deployment_branch_policy: {
                    protected_branches: true,
                    custom_branch_policies: false
                }
            }
        ];

        const results = [];

        for (const env of environments) {
            try {
                // Note: Environment API requires repository ID
                const repoId = this.repoSettings.id;

                const { data: environment } = await this.octokit.rest.repos.createOrUpdateEnvironment({
                    repository_id: repoId,
                    environment_name: env.name,
                    wait_timer: env.wait_timer,
                    reviewers: env.reviewers,
                    deployment_branch_policy: env.deployment_branch_policy
                });

                results.push(environment);
                logger.info(`Environment configured: ${env.name}`);

            } catch (error) {
                logger.error(`❌ Failed to configure environment ${env.name}:`, error.message);
                results.push({ name: env.name, error: error.message });
            }
        }

        return results;
    }

    /**
     * Set up webhooks for LonicFLex integration
     */
    async configureWebhooks() {
        logger.info('🔗 Configuring repository webhooks...');

        const webhooks = [
            {
                name: 'LonicFLex Multi-Agent Webhook',
                config: {
                    url: process.env.WEBHOOK_URL || 'https://your-lonicflex-webhook.com/github',
                    content_type: 'json',
                    secret: process.env.GITHUB_WEBHOOK_SECRET || 'your-webhook-secret'
                },
                events: [
                    'push',
                    'pull_request',
                    'issues',
                    'workflow_run',
                    'deployment'
                ],
                active: true
            }
        ];

        const results = [];

        for (const webhook of webhooks) {
            try {
                // Check if webhook already exists
                const { data: existingWebhooks } = await this.octokit.rest.repos.listWebhooks({
                    owner: this.config.owner,
                    repo: this.config.repo
                });

                const existing = existingWebhooks.find(w => w.config.url === webhook.config.url);

                if (existing) {
                    logger.info(`🔄 Webhook already exists: ${webhook.name}`);
                    results.push({ ...existing, status: 'exists' });
                } else if (webhook.config.url.includes('your-lonicflex-webhook.com')) {
                    logger.warn(`Skipping webhook creation - placeholder URL: ${webhook.name}`);
                    results.push({ name: webhook.name, status: 'skipped', reason: 'placeholder_url' });
                } else {
                    const { data: createdWebhook } = await this.octokit.rest.repos.createWebhook({
                        owner: this.config.owner,
                        repo: this.config.repo,
                        name: 'web',
                        config: webhook.config,
                        events: webhook.events,
                        active: webhook.active
                    });

                    results.push({ ...createdWebhook, status: 'created' });
                    logger.info(`Webhook created: ${webhook.name}`);
                }

            } catch (error) {
                logger.error(`❌ Failed to configure webhook ${webhook.name}:`, error.message);
                results.push({ name: webhook.name, error: error.message });
            }
        }

        return results;
    }

    /**
     * Get current user ID for environment reviewers
     */
    async getUserId() {
        try {
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            return user.id;
        } catch (error) {
            logger.error('❌ Failed to get user ID:', error.message);
            return null;
        }
    }

    /**
     * Complete repository configuration
     */
    async configureAll() {
        logger.info('Starting complete repository configuration...');

        const results = {
            repository: null,
            branchProtection: null,
            labels: null,
            environments: null,
            webhooks: null
        };

        try {
            // Configure repository settings
            results.repository = await this.configureRepository();

            // Configure labels
            results.labels = await this.configureLabels();

            // Configure branch protection (optional, might fail)
            try {
                results.branchProtection = await this.configureBranchProtection('master');
            } catch (error) {
                logger.warn('Branch protection skipped (insufficient permissions or branch not found)');
            }

            // Configure environments (optional, might fail)
            try {
                results.environments = await this.configureEnvironments();
            } catch (error) {
                logger.warn('Environment configuration skipped (requires additional permissions)');
            }

            // Configure webhooks
            results.webhooks = await this.configureWebhooks();

            logger.info('🎉 Repository configuration complete!');
            return results;

        } catch (error) {
            logger.error('❌ Repository configuration failed:', error.message);
            throw error;
        }
    }

    /**
     * Get current repository configuration
     */
    async getConfiguration() {
        try {
            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.config.owner,
                repo: this.config.repo
            });

            const { data: labels } = await this.octokit.rest.issues.listLabelsForRepo({
                owner: this.config.owner,
                repo: this.config.repo
            });

            const { data: webhooks } = await this.octokit.rest.repos.listWebhooks({
                owner: this.config.owner,
                repo: this.config.repo
            });

            return {
                repository: {
                    name: repo.name,
                    description: repo.description,
                    topics: repo.topics,
                    visibility: repo.visibility,
                    default_branch: repo.default_branch
                },
                labels: labels.map(label => ({
                    name: label.name,
                    color: label.color,
                    description: label.description
                })),
                webhooks: webhooks.map(webhook => ({
                    id: webhook.id,
                    name: webhook.name,
                    url: webhook.config.url,
                    events: webhook.events,
                    active: webhook.active
                }))
            };

        } catch (error) {
            logger.error('❌ Failed to get repository configuration:', error.message);
            throw error;
        }
    }
}

module.exports = { RepositoryConfigManager };

// Execute REAL repository configuration
if (require.main === module) {
    (async () => {
        const configManager = new RepositoryConfigManager();

        try {
            logger.info('REAL Repository Configuration Starting...');

            await configManager.initialize();
            const results = await configManager.configureAll();

            logger.info('\n🎉 REAL Repository Configuration Complete!');
            logger.info(`   Repository: ${results.repository?.full_name || 'configured'}`);
            logger.info(`   Labels: ${results.labels?.created?.length || 0} created, ${results.labels?.updated?.length || 0} updated`);
            logger.info(`   Webhooks: ${results.webhooks?.filter(w => w.status === 'created').length || 0} created`);

        } catch (error) {
            logger.error('\n❌ REAL configuration failed:', error.message);
            process.exit(1);
        }
    })();
}