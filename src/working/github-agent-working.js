/**
 * Working GitHub Agent - No inheritance, just functions
 * Extends GitHubReal with additional agent capabilities
 */

const { GitHubReal } = require('./github-real');

class GitHubAgentWorking extends GitHubReal {
    constructor(options = {}) {
        super(options);

        this.agentName = 'github';
        this.sessionId = options.sessionId;
        this.config = options;
    }

    /**
     * Create a new branch for a feature/session
     */
    async createBranch(branchName, baseBranch = 'main') {
        if (!this.connected) {
            console.log(`📝 Mock: Would create branch '${branchName}' from '${baseBranch}'`);
            return { name: branchName, sha: 'mock-sha-123', created: true };
        }

        try {
            // Get base branch reference
            const { data: baseRef } = await this.octokit.rest.git.getRef({
                owner: this.owner,
                repo: this.repo,
                ref: `heads/${baseBranch}`
            });

            // Create new branch
            const { data: newRef } = await this.octokit.rest.git.createRef({
                owner: this.owner,
                repo: this.repo,
                ref: `refs/heads/${branchName}`,
                sha: baseRef.object.sha
            });

            console.log(`✅ Created branch: ${branchName}`);
            return {
                name: branchName,
                sha: newRef.object.sha,
                created: true
            };

        } catch (error) {
            if (error.status === 422) {
                console.log(`ℹ️ Branch '${branchName}' already exists`);
                return { name: branchName, created: false, exists: true };
            }
            console.error(`❌ Failed to create branch ${branchName}:`, error.message);
            throw error;
        }
    }

    /**
     * Create a new issue
     */
    async createIssue(title, body, labels = []) {
        if (!this.connected) {
            console.log(`📝 Mock: Would create issue '${title}'`);
            return {
                number: Math.floor(Math.random() * 1000) + 1,
                title,
                body,
                url: 'https://github.com/example/mock-issue'
            };
        }

        try {
            const { data } = await this.octokit.rest.issues.create({
                owner: this.owner,
                repo: this.repo,
                title,
                body,
                labels
            });

            console.log(`✅ Created issue #${data.number}: ${title}`);
            return {
                number: data.number,
                title: data.title,
                body: data.body,
                url: data.html_url
            };

        } catch (error) {
            console.error(`❌ Failed to create issue:`, error.message);
            throw error;
        }
    }

    /**
     * Create a PR
     */
    async createPR(title, body, head, base = 'main') {
        if (!this.connected) {
            console.log(`📝 Mock: Would create PR '${title}' from ${head} to ${base}`);
            return {
                number: Math.floor(Math.random() * 1000) + 1,
                title,
                head,
                base,
                url: 'https://github.com/example/mock-pr'
            };
        }

        try {
            const { data } = await this.octokit.rest.pulls.create({
                owner: this.owner,
                repo: this.repo,
                title,
                body,
                head,
                base
            });

            console.log(`✅ Created PR #${data.number}: ${title}`);
            return {
                number: data.number,
                title: data.title,
                head: data.head.ref,
                base: data.base.ref,
                url: data.html_url
            };

        } catch (error) {
            console.error(`❌ Failed to create PR:`, error.message);
            throw error;
        }
    }

    /**
     * List issues
     */
    async listIssues(state = 'open') {
        if (!this.connected) {
            return [
                {
                    number: 123,
                    title: 'Mock issue for testing',
                    state: 'open',
                    labels: ['bug']
                }
            ];
        }

        try {
            const { data } = await this.octokit.rest.issues.list({
                owner: this.owner,
                repo: this.repo,
                state
            });

            console.log(`✅ Found ${data.length} ${state} issues`);
            return data.map(issue => ({
                number: issue.number,
                title: issue.title,
                state: issue.state,
                labels: issue.labels.map(l => l.name)
            }));

        } catch (error) {
            console.error(`❌ Failed to list issues:`, error.message);
            throw error;
        }
    }

    /**
     * Execute GitHub workflow - simple function, no inheritance
     */
    async executeWorkflow(context) {
        const results = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            context
        };

        try {
            // Step 1: Check connection
            const status = this.getStatus();
            results.status = status;

            // Step 2: Execute based on context
            if (context.action === 'create-branch') {
                results.branch = await this.createBranch(context.branchName, context.baseBranch);
            } else if (context.action === 'create-pr') {
                results.pr = await this.createPR(
                    context.title,
                    context.body,
                    context.head,
                    context.base
                );
            } else if (context.action === 'review-pr') {
                results.pr = await this.getPR(context.prNumber);
            } else if (context.action === 'list-prs') {
                results.prs = await this.listPRs();
            } else if (context.action === 'list-issues') {
                results.issues = await this.listIssues();
            } else {
                throw new Error(`Unknown action: ${context.action}`);
            }

            results.success = true;
            return results;

        } catch (error) {
            results.success = false;
            results.error = error.message;
            throw error;
        }
    }
}

module.exports = { GitHubAgentWorking };

// Test if run directly
if (require.main === module) {
    async function testGitHubAgent() {
        console.log('🧪 Testing GitHubAgentWorking...\n');

        const agent = new GitHubAgentWorking({ sessionId: 'test-session' });
        console.log('Status:', agent.getStatus());

        try {
            // Test workflow execution
            const result = await agent.executeWorkflow({
                action: 'list-prs'
            });

            console.log('✅ Workflow executed successfully');
            console.log('Result:', JSON.stringify(result, null, 2));

        } catch (error) {
            console.error('❌ Workflow test failed:', error.message);
        }
    }

    testGitHubAgent();
}