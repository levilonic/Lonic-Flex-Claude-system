/**
 * Clean GitHub Agent - Proper Software Engineering Implementation
 *
 * This replaces the corrupted github-agent.js with:
 * 1. Proper dependency injection using ServiceContainer
 * 2. Real error handling and verification
 * 3. No validateSuccess({}) empty calls
 * 4. Evidence-based operations
 * 5. Single responsibility: GitHub API operations
 */

const { Octokit } = require('@octokit/rest');
require('dotenv').config();

class CleanGitHubAgent {
    constructor(sessionId = null, serviceContainer = null) {
        this.sessionId = sessionId || `github-${Date.now()}`;
        this.serviceContainer = serviceContainer;
        this.agentName = 'github-clean';
        this.status = 'created';
        this.octokit = null;
        this.database = null;
        this.memory = null;
    }

    /**
     * Initialize agent with required services and GitHub authentication
     * Fail fast if dependencies not available
     */
    async initialize() {
        if (!this.serviceContainer) {
            throw new Error('ServiceContainer required for initialization');
        }

        // Get required services
        this.database = this.serviceContainer.getService('database');
        if (!this.database) {
            throw new Error('Database service not available');
        }

        this.memory = this.serviceContainer.getService('memory');
        if (!this.memory) {
            throw new Error('Memory service not available');
        }

        // Initialize GitHub authentication
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GITHUB_TOKEN environment variable required');
        }

        this.octokit = new Octokit({
            auth: token,
            userAgent: 'LonicFLex-GitHub-Agent/1.0'
        });

        // Verify GitHub authentication
        try {
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            console.log(`✅ GitHub authenticated as: ${user.login}`);
        } catch (error) {
            throw new Error(`GitHub authentication failed: ${error.message}`);
        }

        this.status = 'initialized';
        console.log(`✅ CleanGitHubAgent ${this.sessionId} initialized`);
    }

    /**
     * Get repository information with real verification
     */
    async getRepository(owner, repo) {
        if (this.status !== 'initialized') {
            throw new Error('Agent not initialized. Call initialize() first.');
        }

        console.log(`🔍 Getting repository: ${owner}/${repo}`);

        try {
            const { data: repository } = await this.octokit.rest.repos.get({
                owner,
                repo
            });

            // Create agent task record
            await this.database.run(
                'INSERT INTO agents (id, session_id, name, status, context_data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    `${this.agentName}-${this.sessionId}`,
                    this.sessionId,
                    this.agentName,
                    'completed',
                    JSON.stringify({ operation: 'getRepository', owner, repo }),
                    new Date().toISOString()
                ]
            );

            console.log(`✅ Repository found: ${repository.full_name}`);

            return {
                success: true,
                repository: {
                    id: repository.id,
                    name: repository.name,
                    full_name: repository.full_name,
                    owner: repository.owner.login,
                    private: repository.private,
                    default_branch: repository.default_branch,
                    clone_url: repository.clone_url
                },
                sessionId: this.sessionId,
                evidence: repository // Real evidence for verification
            };

        } catch (error) {
            console.error(`❌ Failed to get repository ${owner}/${repo}:`, error.message);

            // Record failure in database
            await this.database.run(
                'INSERT INTO agents (id, session_id, name, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    `${this.agentName}-${this.sessionId}`,
                    this.sessionId,
                    this.agentName,
                    'failed',
                    error.message,
                    new Date().toISOString()
                ]
            );

            return {
                success: false,
                error: error.message,
                sessionId: this.sessionId
            };
        }
    }

    /**
     * List repository issues with real verification
     */
    async listIssues(owner, repo, state = 'open') {
        if (this.status !== 'initialized') {
            throw new Error('Agent not initialized. Call initialize() first.');
        }

        console.log(`📋 Listing ${state} issues for: ${owner}/${repo}`);

        try {
            const { data: issues } = await this.octokit.rest.issues.listForRepo({
                owner,
                repo,
                state,
                per_page: 10 // Limit for testing
            });

            // Record operation in database
            await this.database.run(
                'INSERT INTO agents (id, session_id, name, status, context_data, result_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    `${this.agentName}-list-issues-${Date.now()}`,
                    this.sessionId,
                    this.agentName,
                    'completed',
                    JSON.stringify({ operation: 'listIssues', owner, repo, state }),
                    JSON.stringify({ issueCount: issues.length }),
                    new Date().toISOString()
                ]
            );

            console.log(`✅ Found ${issues.length} ${state} issues`);

            return {
                success: true,
                issues: issues.map(issue => ({
                    number: issue.number,
                    title: issue.title,
                    state: issue.state,
                    user: issue.user.login,
                    created_at: issue.created_at,
                    html_url: issue.html_url
                })),
                count: issues.length,
                sessionId: this.sessionId,
                evidence: issues // Real evidence for verification
            };

        } catch (error) {
            console.error(`❌ Failed to list issues for ${owner}/${repo}:`, error.message);

            return {
                success: false,
                error: error.message,
                sessionId: this.sessionId
            };
        }
    }

    /**
     * Create an issue with real verification
     */
    async createIssue(owner, repo, title, body = '') {
        if (this.status !== 'initialized') {
            throw new Error('Agent not initialized. Call initialize() first.');
        }

        console.log(`📝 Creating issue: ${title}`);

        try {
            const { data: issue } = await this.octokit.rest.issues.create({
                owner,
                repo,
                title,
                body
            });

            // Record operation in database
            await this.database.run(
                'INSERT INTO agents (id, session_id, name, status, context_data, result_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    `${this.agentName}-create-issue-${Date.now()}`,
                    this.sessionId,
                    this.agentName,
                    'completed',
                    JSON.stringify({ operation: 'createIssue', owner, repo, title }),
                    JSON.stringify({ issueNumber: issue.number, issueUrl: issue.html_url }),
                    new Date().toISOString()
                ]
            );

            console.log(`✅ Issue created: #${issue.number}`);

            return {
                success: true,
                issue: {
                    number: issue.number,
                    title: issue.title,
                    html_url: issue.html_url,
                    user: issue.user.login,
                    created_at: issue.created_at
                },
                sessionId: this.sessionId,
                evidence: issue // Real evidence for verification
            };

        } catch (error) {
            console.error(`❌ Failed to create issue:`, error.message);

            return {
                success: false,
                error: error.message,
                sessionId: this.sessionId
            };
        }
    }

    /**
     * Clean up agent records (for testing)
     */
    async cleanup() {
        if (!this.database) {
            return;
        }

        try {
            await this.database.run(
                'DELETE FROM agents WHERE session_id = ?',
                [this.sessionId]
            );
            console.log(`🧹 Cleaned up GitHub agent records for ${this.sessionId}`);
        } catch (error) {
            console.log(`⚠️ Cleanup error: ${error.message}`);
        }
    }

    /**
     * Get current status (no lies)
     */
    getStatus() {
        return {
            agentName: this.agentName,
            sessionId: this.sessionId,
            status: this.status,
            hasServiceContainer: !!this.serviceContainer,
            hasDatabase: !!this.database,
            hasMemory: !!this.memory,
            hasGitHubAuth: !!this.octokit
        };
    }
}

module.exports = { CleanGitHubAgent };

// For testing - allow direct execution with system startup
if (require.main === module) {
    const { systemStartup } = require('../system-startup');

    async function testCleanGitHubAgent() {
        console.log('🧪 Testing CleanGitHubAgent...');

        let agent = null;

        try {
            // Initialize system first
            await systemStartup.initialize();
            const serviceContainer = systemStartup.getServiceContainer();

            // Create and test agent
            agent = new CleanGitHubAgent('test-github-agent', serviceContainer);

            console.log('📝 Agent status before init:', agent.getStatus());

            await agent.initialize();
            console.log('📝 Agent status after init:', agent.getStatus());

            // Test repository access (using known repository)
            const repoResult = await agent.getRepository('levilonic', 'Lonic-Flex-Claude-system');
            console.log('📝 Repository result:', repoResult.success ? 'SUCCESS' : 'FAILED');
            if (repoResult.success) {
                console.log('Repository:', repoResult.repository.full_name);
            } else {
                console.log('Error:', repoResult.error);
            }

            // Test issue listing
            const issuesResult = await agent.listIssues('levilonic', 'Lonic-Flex-Claude-system');
            console.log('📝 Issues result:', issuesResult.success ? 'SUCCESS' : 'FAILED');
            if (issuesResult.success) {
                console.log(`Found ${issuesResult.count} issues`);
            } else {
                console.log('Error:', issuesResult.error);
            }

            console.log('🎉 CleanGitHubAgent test completed');

            // Clean up
            await agent.cleanup();
            await systemStartup.shutdown();

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            console.error('Stack:', error.stack);

            if (agent) {
                await agent.cleanup();
            }

            process.exit(1);
        }
    }

    testCleanGitHubAgent();
}