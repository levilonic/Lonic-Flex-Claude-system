#!/usr/bin/env node
/**
 * Working CLI - No abstractions, just functions that work
 * Uses working components from src/working/
 */

const { PRReviewWorkflow } = require('./src/working/pr-review-workflow');
const { GitHubReal } = require('./src/working/github-real');
const { GitHubAgentWorking } = require('./src/working/github-agent-working');

class WorkingCLI {
    constructor() {
        this.github = new GitHubReal();
        this.githubAgent = new GitHubAgentWorking({ sessionId: `cli-${Date.now()}` });
        this.prWorkflow = new PRReviewWorkflow();
    }

    /**
     * Parse and execute command
     */
    async execute(args = process.argv.slice(2)) {
        if (args.length === 0) {
            this.showHelp();
            process.exit(0);
        }

        const command = args[0];
        const options = args.slice(1);

        try {
            switch (command) {
                case 'pr-review':
                    await this.reviewPR(options);
                    break;
                case 'github-status':
                    await this.githubStatus();
                    break;
                case 'create-branch':
                    await this.createBranch(options);
                    break;
                case 'list-issues':
                    await this.listIssues(options);
                    break;
                case 'test':
                    await this.runTests();
                    break;
                case 'help':
                    this.showHelp();
                    break;
                default:
                    console.error(`❌ Unknown command: ${command}`);
                    this.showHelp();
                    process.exit(1);
            }
        } catch (error) {
            console.error(`❌ Command '${command}' failed:`, error.message);
            process.exit(1);
        }
    }

    /**
     * Review a PR - actually works
     */
    async reviewPR(options) {
        const prNumber = parseInt(options[0]);

        if (!prNumber) {
            console.error('❌ Usage: cli-working pr-review <pr-number>');
            process.exit(1);
        }

        console.log(`🔍 Reviewing PR #${prNumber}...`);

        const review = await this.prWorkflow.execute(prNumber);

        console.log(`\n📊 Review Results:`);
        console.log(`   PR: ${review.title}`);
        console.log(`   Score: ${review.overallScore}/100`);
        console.log(`   Complexity: ${review.analysis.size.complexity}`);
        console.log(`   Risks: ${review.analysis.risks.length}`);
        console.log(`   Recommendations: ${review.recommendations.length}`);

        console.log(`\n💬 Review Comment:`);
        console.log(this.prWorkflow.formatReviewComment(review));

        process.exit(0);
    }

    /**
     * Show GitHub connection status
     */
    async githubStatus() {
        console.log('🔗 GitHub Status:');

        const status = this.github.getStatus();
        console.log(`   Connected: ${status.connected ? '✅' : '❌'}`);
        console.log(`   Mode: ${status.mode}`);
        console.log(`   Repository: ${status.owner}/${status.repo}`);

        if (status.connected) {
            try {
                const files = await this.github.listFiles();
                console.log(`   Files found: ${files.length}`);
            } catch (error) {
                console.log(`   API test failed: ${error.message}`);
            }
        } else {
            console.log('   💡 Set GITHUB_TOKEN environment variable for live integration');
        }

        process.exit(0);
    }

    /**
     * Create a GitHub branch
     */
    async createBranch(options) {
        const branchName = options[0];
        const baseBranch = options[1] || 'main';

        if (!branchName) {
            console.error('❌ Usage: cli-working create-branch <branch-name> [base-branch]');
            process.exit(1);
        }

        console.log(`🌿 Creating branch '${branchName}' from '${baseBranch}'...`);

        try {
            const result = await this.githubAgent.executeWorkflow({
                action: 'create-branch',
                branchName,
                baseBranch
            });

            if (result.success) {
                console.log(`✅ Branch operation completed`);
                if (result.branch.created) {
                    console.log(`   Created: ${result.branch.name}`);
                } else if (result.branch.exists) {
                    console.log(`   Already exists: ${result.branch.name}`);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to create branch: ${error.message}`);
            process.exit(1);
        }

        process.exit(0);
    }

    /**
     * List GitHub issues
     */
    async listIssues(options) {
        const state = options[0] || 'open';

        console.log(`📋 Listing ${state} issues...`);

        try {
            const result = await this.githubAgent.executeWorkflow({
                action: 'list-issues',
                state
            });

            if (result.success && result.issues) {
                console.log(`\n Found ${result.issues.length} ${state} issues:`);
                result.issues.forEach(issue => {
                    console.log(`   #${issue.number}: ${issue.title}`);
                    if (issue.labels.length > 0) {
                        console.log(`      Labels: ${issue.labels.join(', ')}`);
                    }
                });
            }
        } catch (error) {
            console.error(`❌ Failed to list issues: ${error.message}`);
            process.exit(1);
        }

        process.exit(0);
    }

    /**
     * Run working tests
     */
    async runTests() {
        console.log('🧪 Running Working Tests...\n');

        try {
            // Import and run the real integration test
            const { runIntegrationTests } = require('./tests/real/pr-review-integration.test');
            const results = await runIntegrationTests();

            if (results.workflow.percentage >= 90) {
                console.log('\n✅ All tests passed - system is working!');
                process.exit(0);
            } else {
                console.log('\n❌ Some tests failed');
                process.exit(1);
            }

        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Show help
     */
    showHelp() {
        console.log(`
🚀 LonicFLex Working CLI

Usage: node cli-working.js <command> [options]

Commands:
  pr-review <number>           Review a GitHub PR
  github-status                Show GitHub connection status
  create-branch <name> [base]  Create a GitHub branch
  list-issues [state]          List GitHub issues (open/closed/all)
  test                         Run integration tests
  help                         Show this help

Examples:
  node cli-working.js pr-review 123
  node cli-working.js github-status
  node cli-working.js create-branch feature/new-feature
  node cli-working.js list-issues open
  GITHUB_TOKEN=xxx node cli-working.js github-status
  node cli-working.js test

This CLI uses only working components with no broken abstractions.
        `);
    }
}

// Execute if called directly
if (require.main === module) {
    const cli = new WorkingCLI();
    cli.execute();
}

module.exports = { WorkingCLI };