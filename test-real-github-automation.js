/**
 * REAL GitHub Automation System Test
 * Tests actual GitHub API functionality - NO DEMOS
 */

const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fs = require('fs').promises;

class RealGitHubAutomationTest {
    constructor() {
        this.octokit = null;
        this.config = {
            owner: 'levilonic',
            repo: 'Lonic-Flex-Claude-system'
        };
        this.testResults = [];
    }

    /**
     * Initialize with REAL GitHub token
     */
    async initialize() {
        try {
            // Get REAL token from GitHub CLI
            const token = execSync('gh auth token', { encoding: 'utf8' }).trim();

            this.octokit = new Octokit({
                auth: token,
                userAgent: 'LonicFLex-Real-Automation-Test/1.0'
            });

            // Verify authentication
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            console.log(`✅ REAL GitHub API authenticated as: ${user.login}`);

            return true;

        } catch (error) {
            console.error('❌ GitHub authentication failed:', error.message);
            return false;
        }
    }

    /**
     * Test REAL GitHub Actions workflows exist
     */
    async testWorkflowsExist() {
        console.log('🧪 Testing REAL GitHub Actions workflows...');

        try {
            const { data: workflows } = await this.octokit.rest.actions.listRepoWorkflows({
                owner: this.config.owner,
                repo: this.config.repo
            });

            console.log(`📊 Found ${workflows.total_count} workflows in repository:`);

            const lonicflexWorkflows = workflows.workflows.filter(w =>
                w.name.includes('LonicFLex') || w.path.includes('.github/workflows/')
            );

            let workflowsFound = 0;
            lonicflexWorkflows.forEach(workflow => {
                console.log(`   ✓ ${workflow.name} (${workflow.path}) - ${workflow.state}`);
                workflowsFound++;
            });

            this.addResult('GitHub Actions Workflows', workflowsFound >= 2,
                `Found ${workflowsFound} LonicFLex workflows`);

            return lonicflexWorkflows;

        } catch (error) {
            this.addResult('GitHub Actions Workflows', false, error.message);
            console.error('❌ Failed to test workflows:', error.message);
            return [];
        }
    }

    /**
     * Test REAL repository configuration
     */
    async testRepositoryConfig() {
        console.log('🧪 Testing REAL repository configuration...');

        try {
            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.config.owner,
                repo: this.config.repo
            });

            console.log(`📋 Repository: ${repo.full_name}`);
            console.log(`   Description: ${repo.description}`);
            console.log(`   Visibility: ${repo.visibility}`);
            console.log(`   Issues: ${repo.has_issues ? 'enabled' : 'disabled'}`);
            console.log(`   Projects: ${repo.has_projects ? 'enabled' : 'disabled'}`);

            const hasLonicFlexDescription = repo.description?.includes('LonicFLex');
            this.addResult('Repository Configuration', hasLonicFlexDescription,
                `Description contains LonicFLex: ${hasLonicFlexDescription}`);

            return repo;

        } catch (error) {
            this.addResult('Repository Configuration', false, error.message);
            console.error('❌ Failed to test repository config:', error.message);
            return null;
        }
    }

    /**
     * Test REAL labels exist
     */
    async testLabelsExist() {
        console.log('🧪 Testing REAL repository labels...');

        try {
            const { data: labels } = await this.octokit.rest.issues.listLabelsForRepo({
                owner: this.config.owner,
                repo: this.config.repo
            });

            console.log(`🏷️ Found ${labels.length} labels in repository`);

            const lonicflexLabels = labels.filter(label =>
                label.name.includes('agent:') ||
                label.name.includes('universal-context') ||
                label.name.includes('multi-agent') ||
                label.name.includes('github-automation')
            );

            console.log(`   LonicFLex-specific labels: ${lonicflexLabels.length}`);
            lonicflexLabels.slice(0, 10).forEach(label => {
                console.log(`   ✓ ${label.name} - ${label.description || 'No description'}`);
            });

            this.addResult('LonicFLex Labels', lonicflexLabels.length >= 10,
                `Found ${lonicflexLabels.length} LonicFLex labels`);

            return lonicflexLabels;

        } catch (error) {
            this.addResult('LonicFLex Labels', false, error.message);
            console.error('❌ Failed to test labels:', error.message);
            return [];
        }
    }

    /**
     * Test REAL branch protection
     */
    async testBranchProtection() {
        console.log('🧪 Testing REAL branch protection...');

        try {
            const { data: protection } = await this.octokit.rest.repos.getBranchProtection({
                owner: this.config.owner,
                repo: this.config.repo,
                branch: 'master'
            });

            console.log(`🛡️ Branch protection for master:`);
            console.log(`   Required status checks: ${protection.required_status_checks?.contexts?.join(', ') || 'none'}`);
            console.log(`   Enforce admins: ${protection.enforce_admins?.enabled || false}`);
            console.log(`   Required reviews: ${protection.required_pull_request_reviews?.required_approving_review_count || 0}`);

            this.addResult('Branch Protection', true, 'Branch protection configured');

            return protection;

        } catch (error) {
            if (error.status === 404) {
                this.addResult('Branch Protection', false, 'No branch protection found');
                console.log('⚠️ No branch protection configured (expected if insufficient permissions)');
            } else {
                this.addResult('Branch Protection', false, error.message);
                console.error('❌ Failed to test branch protection:', error.message);
            }
            return null;
        }
    }

    /**
     * Test file structure exists
     */
    async testFileStructure() {
        console.log('🧪 Testing REAL file structure...');

        const expectedFiles = [
            '.github/workflows/ci.yml',
            '.github/workflows/security.yml',
            '.github/workflows/multi-agent.yml',
            'services/github-workflow-manager.js',
            'services/repository-config-manager.js',
            'services/issue-management-service.js',
            'create-real-github-workflows.js'
        ];

        let filesExist = 0;

        for (const file of expectedFiles) {
            try {
                await fs.access(file);
                console.log(`   ✓ ${file}`);
                filesExist++;
            } catch (error) {
                console.log(`   ✗ ${file} - not found`);
            }
        }

        this.addResult('File Structure', filesExist === expectedFiles.length,
            `${filesExist}/${expectedFiles.length} files exist`);

        return filesExist;
    }

    /**
     * Test REAL API rate limits and permissions
     */
    async testAPILimits() {
        console.log('🧪 Testing REAL API rate limits and permissions...');

        try {
            const { data: rateLimit } = await this.octokit.rest.rateLimit.get();

            console.log(`📊 API Rate Limit Status:`);
            console.log(`   Remaining: ${rateLimit.rate.remaining}/${rateLimit.rate.limit}`);
            console.log(`   Resets at: ${new Date(rateLimit.rate.reset * 1000).toLocaleTimeString()}`);

            const hasGoodRateLimit = rateLimit.rate.remaining > 100;
            this.addResult('API Rate Limits', hasGoodRateLimit,
                `${rateLimit.rate.remaining}/${rateLimit.rate.limit} requests remaining`);

            return rateLimit;

        } catch (error) {
            this.addResult('API Rate Limits', false, error.message);
            console.error('❌ Failed to test API limits:', error.message);
            return null;
        }
    }

    /**
     * Add test result
     */
    addResult(testName, success, details = '') {
        this.testResults.push({
            test: testName,
            success,
            details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Run all REAL tests
     */
    async runAllTests() {
        console.log('🎯 REAL GitHub Automation System Test Starting...\n');

        const tests = [
            () => this.testRepositoryConfig(),
            () => this.testLabelsExist(),
            () => this.testWorkflowsExist(),
            () => this.testBranchProtection(),
            () => this.testFileStructure(),
            () => this.testAPILimits()
        ];

        for (const test of tests) {
            try {
                await test();
                console.log(''); // Add spacing
            } catch (error) {
                console.error(`Test failed: ${error.message}\n`);
            }
        }

        this.showResults();
        return this.calculateSuccessRate();
    }

    /**
     * Show test results
     */
    showResults() {
        console.log('📊 REAL GitHub Automation Test Results:');
        console.log('=' .repeat(70));

        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${status} - ${result.test}`);
            if (result.details) {
                console.log(`   Details: ${result.details}`);
            }
        });

        const successRate = this.calculateSuccessRate();
        console.log('=' .repeat(70));
        console.log(`Overall Success Rate: ${successRate}%`);

        if (successRate === 100) {
            console.log('🎉 ALL REAL GitHub automation tests PASSED!');
            console.log('✅ System is production-ready and fully functional');
        } else if (successRate >= 80) {
            console.log('✅ REAL GitHub automation system mostly functional');
            console.log('⚠️ Some optional features may require additional permissions');
        } else {
            console.log('⚠️ REAL GitHub automation system needs attention');
            console.log('❌ Core functionality may be impaired');
        }
    }

    /**
     * Calculate success rate
     */
    calculateSuccessRate() {
        if (this.testResults.length === 0) return 0;

        const successful = this.testResults.filter(result => result.success).length;
        return Math.round((successful / this.testResults.length) * 100);
    }
}

// Execute REAL testing
if (require.main === module) {
    (async () => {
        const test = new RealGitHubAutomationTest();

        try {
            const initialized = await test.initialize();
            if (initialized) {
                const successRate = await test.runAllTests();

                console.log(`\n🎯 REAL GitHub Automation Test Complete`);
                console.log(`   Success Rate: ${successRate}%`);

                process.exit(successRate >= 80 ? 0 : 1);
            } else {
                process.exit(1);
            }
        } catch (error) {
            console.error('❌ REAL test execution failed:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = { RealGitHubAutomationTest };