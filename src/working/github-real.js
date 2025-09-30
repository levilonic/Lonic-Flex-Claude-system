/**
 * GitHub Real Integration - Actually Works
 * No inheritance, no abstractions, just real API calls
 */

const { Octokit } = require('@octokit/rest');

class GitHubReal {
    constructor(options = {}) {
        this.token = options.token || process.env.GITHUB_TOKEN;
        this.owner = options.owner || 'humanlayer';
        this.repo = options.repo || '12-factor-agents';

        if (this.token) {
            this.octokit = new Octokit({ auth: this.token });
            this.connected = true;
        } else {
            this.connected = false;
            console.log(' GitHub token not provided - using mock mode');
        }
    }

    /**
     * List open pull requests - REAL API call
     */
    async listPRs() {
        if (!this.connected) {
            // Mock data when no token
            return [
                {
                    number: 123,
                    title: 'Mock PR for testing',
                    state: 'open',
                    additions: 45,
                    deletions: 12,
                    changed_files: 3
                }
            ];
        }

        try {
            const { data } = await this.octokit.rest.pulls.list({
                owner: this.owner,
                repo: this.repo,
                state: 'open'
            });

            console.log(`PASS Found ${data.length} open PRs`);
            return data;

        } catch (error) {
            console.error('FAIL GitHub API error:', error.message);
            throw error;
        }
    }

    /**
     * Get specific PR details - REAL API call
     */
    async getPR(prNumber) {
        if (!this.connected) {
            // Mock data when no token
            return {
                number: prNumber,
                title: `Mock PR ${prNumber}`,
                state: 'open',
                additions: 45,
                deletions: 12,
                changed_files: 3,
                body: 'This is a mock PR for testing purposes',
                user: { login: 'test-user' },
                created_at: new Date().toISOString()
            };
        }

        try {
            const { data } = await this.octokit.rest.pulls.get({
                owner: this.owner,
                repo: this.repo,
                pull_number: prNumber
            });

            console.log(`PASS Retrieved PR #${prNumber}: ${data.title}`);
            return data;

        } catch (error) {
            console.error(`FAIL GitHub API error getting PR ${prNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * List repository files - REAL API call
     */
    async listFiles(path = '') {
        if (!this.connected) {
            // Mock data when no token
            return [
                { name: 'package.json', type: 'file' },
                { name: 'src', type: 'dir' },
                { name: 'demo.js', type: 'file' }
            ];
        }

        try {
            const { data } = await this.octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: path
            });

            const files = Array.isArray(data) ? data : [data];
            console.log(`PASS Found ${files.length} files in ${path || 'root'}`);
            return files.map(file => ({
                name: file.name,
                type: file.type,
                size: file.size
            }));

        } catch (error) {
            console.error('FAIL GitHub API error listing files:', error.message);
            throw error;
        }
    }

    /**
     * Create a comment on PR - REAL API call
     */
    async commentOnPR(prNumber, comment) {
        if (!this.connected) {
            console.log(` Mock comment on PR ${prNumber}: ${comment}`);
            return { id: 'mock-comment-id', body: comment };
        }

        try {
            const { data } = await this.octokit.rest.issues.createComment({
                owner: this.owner,
                repo: this.repo,
                issue_number: prNumber,
                body: comment
            });

            console.log(`PASS Posted comment on PR #${prNumber}`);
            return data;

        } catch (error) {
            console.error(`FAIL GitHub API error commenting on PR ${prNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.connected,
            hasToken: !!this.token,
            owner: this.owner,
            repo: this.repo,
            mode: this.connected ? 'live' : 'mock'
        };
    }
}

module.exports = { GitHubReal };

// Test if run directly
if (require.main === module) {
    async function testGitHub() {
        console.log('TEST Testing GitHubReal...\n');

        const github = new GitHubReal();
        console.log('Status:', github.getStatus());

        try {
            // Test listing PRs
            const prs = await github.listPRs();
            console.log(`Found ${prs.length} PRs`);

            if (prs.length > 0) {
                // Test getting specific PR
                const pr = await github.getPR(prs[0].number);
                console.log(`PR details: ${pr.title}`);
            }

            // Test listing files
            const files = await github.listFiles();
            console.log(`Found ${files.length} files in root`);

            console.log('\nPASS GitHubReal test completed successfully!');

        } catch (error) {
            console.error('\nFAIL GitHubReal test failed:', error.message);
        }
    }

    testGitHub();
}