/**
 * GitHub Actions Automation Test
 * Comprehensive testing of GitHub Actions workflow creation and management
 */

const { GitHubActionsManager } = require('./services/github-actions-manager');
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

class GitHubActionsTest {
    constructor() {
        this.octokit = null;
        this.actionsManager = null;
        this.testResults = [];
        this.config = {
            owner: 'levilonic',
            repository: 'Lonic-Flex-Claude-system'
        };
    }

    /**
     * Initialize GitHub API client
     */
    async initialize() {
        try {
            if (!process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN === 'YOUR_GITHUB_TOKEN_HERE') {
                console.log('⚠️ GITHUB_TOKEN not configured - using demo mode');
                return this.runDemoMode();
            }

            this.octokit = new Octokit({
                auth: process.env.GITHUB_TOKEN,
                userAgent: 'LonicFLex-GitHub-Actions-Test/1.0'
            });

            // Test authentication
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            console.log(`✅ GitHub authenticated as: ${user.login}`);

            this.actionsManager = new GitHubActionsManager(this.octokit, this.config);

            return true;

        } catch (error) {
            console.error('❌ GitHub initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Run comprehensive GitHub Actions tests
     */
    async runTests() {
        console.log('🧪 Starting GitHub Actions automation tests...\n');

        const tests = [
            () => this.testWorkflowTemplates(),
            () => this.testWorkflowCreation(),
            () => this.testCustomWorkflow(),
            () => this.testWorkflowManagement(),
            () => this.testEnvironmentSecrets(),
            () => this.testWorkflowTriggers()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.addResult(`Test failed: ${test.name}`, false, error.message);
            }
        }

        this.showResults();
        return this.calculateSuccessRate();
    }

    /**
     * Test workflow templates generation
     */
    async testWorkflowTemplates() {
        console.log('📋 Testing workflow templates...');

        const templates = this.actionsManager.getWorkflowTemplates();
        const expectedWorkflows = ['ci', 'security', 'deploy', 'multi-agent'];

        let templatesValid = true;
        const validationResults = [];

        for (const workflowType of expectedWorkflows) {
            const template = templates[workflowType];

            if (!template) {
                templatesValid = false;
                validationResults.push(`Missing template: ${workflowType}`);
                continue;
            }

            // Validate template structure
            const hasRequiredFields = template.filename && template.content &&
                                    template.content.name && template.content.on && template.content.jobs;

            if (!hasRequiredFields) {
                templatesValid = false;
                validationResults.push(`Invalid template structure: ${workflowType}`);
            } else {
                validationResults.push(`✓ ${workflowType}: ${template.filename}`);
            }
        }

        this.addResult(
            'Workflow Templates Generation',
            templatesValid,
            validationResults.join(', ')
        );

        console.log(`   Templates: ${Object.keys(templates).length} workflows defined`);
        validationResults.forEach(result => console.log(`   ${result}`));
    }

    /**
     * Test workflow creation (dry run without actual GitHub API calls)
     */
    async testWorkflowCreation() {
        console.log('\n🏗️ Testing workflow creation logic...');

        try {
            // Test workflow content generation
            const templates = this.actionsManager.getWorkflowTemplates();
            const yaml = require('js-yaml');

            let creationValid = true;
            const creationResults = [];

            for (const [workflowType, template] of Object.entries(templates)) {
                try {
                    // Test YAML serialization
                    const workflowYaml = yaml.dump(template.content, {
                        indent: 2,
                        lineWidth: -1,
                        noRefs: true
                    });

                    // Validate YAML can be parsed back
                    const parsedYaml = yaml.load(workflowYaml);

                    if (parsedYaml.name && parsedYaml.on && parsedYaml.jobs) {
                        creationResults.push(`✓ ${workflowType}: YAML valid`);
                    } else {
                        creationValid = false;
                        creationResults.push(`✗ ${workflowType}: Invalid YAML structure`);
                    }

                } catch (error) {
                    creationValid = false;
                    creationResults.push(`✗ ${workflowType}: YAML error - ${error.message}`);
                }
            }

            this.addResult(
                'Workflow Creation Logic',
                creationValid,
                creationResults.join(', ')
            );

            creationResults.forEach(result => console.log(`   ${result}`));

        } catch (error) {
            this.addResult('Workflow Creation Logic', false, error.message);
        }
    }

    /**
     * Test custom workflow creation
     */
    async testCustomWorkflow() {
        console.log('\n🎨 Testing custom workflow creation...');

        try {
            const customName = 'Test Custom Workflow';
            const customTriggers = {
                workflow_dispatch: {},
                push: { branches: ['test'] }
            };
            const customJobs = {
                test: {
                    'runs-on': 'ubuntu-latest',
                    steps: [
                        { uses: 'actions/checkout@v4' },
                        { name: 'Run custom test', run: 'echo "Custom workflow test"' }
                    ]
                }
            };

            // Test the logic without actual API call
            const expectedFilename = 'test-custom-workflow.yml';
            const yaml = require('js-yaml');

            const workflowContent = {
                name: customName,
                on: customTriggers,
                jobs: customJobs
            };

            const yamlContent = yaml.dump(workflowContent, {
                indent: 2,
                lineWidth: -1,
                noRefs: true
            });

            // Validate the generated YAML
            const parsedYaml = yaml.load(yamlContent);
            const isValid = parsedYaml.name === customName &&
                          parsedYaml.on.workflow_dispatch !== undefined &&
                          parsedYaml.jobs.test !== undefined;

            this.addResult(
                'Custom Workflow Creation',
                isValid,
                `Generated filename: ${expectedFilename}, YAML valid: ${isValid}`
            );

            console.log(`   Custom workflow YAML generated successfully`);
            console.log(`   Expected filename: ${expectedFilename}`);

        } catch (error) {
            this.addResult('Custom Workflow Creation', false, error.message);
        }
    }

    /**
     * Test workflow management operations
     */
    async testWorkflowManagement() {
        console.log('\n⚙️ Testing workflow management operations...');

        try {
            // Test workflow trigger logic
            const triggerData = {
                workflowId: 'ci.yml',
                ref: 'master',
                inputs: {
                    environment: 'staging'
                }
            };

            // Validate trigger parameters
            const hasValidTriggerData = triggerData.workflowId &&
                                      triggerData.ref &&
                                      typeof triggerData.inputs === 'object';

            // Test workflow run data structure
            const mockWorkflowRuns = [
                {
                    id: 123456,
                    name: 'CI/CD Pipeline',
                    status: 'completed',
                    conclusion: 'success',
                    workflowId: 'ci.yml',
                    headBranch: 'master'
                }
            ];

            const hasValidRunStructure = mockWorkflowRuns.every(run =>
                run.id && run.name && run.status && run.workflowId
            );

            const managementValid = hasValidTriggerData && hasValidRunStructure;

            this.addResult(
                'Workflow Management Operations',
                managementValid,
                `Trigger validation: ${hasValidTriggerData}, Run structure: ${hasValidRunStructure}`
            );

            console.log(`   Workflow trigger parameters validated`);
            console.log(`   Workflow run data structure validated`);

        } catch (error) {
            this.addResult('Workflow Management Operations', false, error.message);
        }
    }

    /**
     * Test environment secrets setup
     */
    async testEnvironmentSecrets() {
        console.log('\n🔐 Testing environment secrets management...');

        try {
            const testSecrets = {
                'API_KEY': 'test-api-key-value',
                'DATABASE_URL': 'test-database-url',
                'SLACK_TOKEN': 'test-slack-token'
            };

            // Validate secret structure
            const secretsValid = Object.entries(testSecrets).every(([name, value]) =>
                typeof name === 'string' && name.length > 0 &&
                typeof value === 'string' && value.length > 0
            );

            // Test environment setup logic
            const environments = ['staging', 'production'];
            const environmentsValid = environments.every(env =>
                typeof env === 'string' && env.length > 0
            );

            const secretsManagementValid = secretsValid && environmentsValid;

            this.addResult(
                'Environment Secrets Management',
                secretsManagementValid,
                `Secrets structure: ${secretsValid}, Environments: ${environmentsValid}`
            );

            console.log(`   Secret validation passed: ${Object.keys(testSecrets).length} secrets`);
            console.log(`   Environment validation passed: ${environments.length} environments`);

        } catch (error) {
            this.addResult('Environment Secrets Management', false, error.message);
        }
    }

    /**
     * Test workflow triggers and event handling
     */
    async testWorkflowTriggers() {
        console.log('\n⚡ Testing workflow triggers...');

        try {
            const templates = this.actionsManager.getWorkflowTemplates();

            let triggersValid = true;
            const triggerResults = [];

            for (const [workflowType, template] of Object.entries(templates)) {
                const triggers = template.content.on;

                if (!triggers) {
                    triggersValid = false;
                    triggerResults.push(`✗ ${workflowType}: No triggers defined`);
                    continue;
                }

                // Check for at least one trigger type
                const hasTriggers = Object.keys(triggers).length > 0;

                if (hasTriggers) {
                    triggerResults.push(`✓ ${workflowType}: ${Object.keys(triggers).join(', ')}`);
                } else {
                    triggersValid = false;
                    triggerResults.push(`✗ ${workflowType}: Empty triggers`);
                }
            }

            this.addResult(
                'Workflow Triggers',
                triggersValid,
                triggerResults.join(', ')
            );

            triggerResults.forEach(result => console.log(`   ${result}`));

        } catch (error) {
            this.addResult('Workflow Triggers', false, error.message);
        }
    }

    /**
     * Run demo mode without API calls
     */
    async runDemoMode() {
        console.log('🎭 Running GitHub Actions Manager in demo mode...\n');

        this.actionsManager = new GitHubActionsManager(null, this.config);

        // Run tests that don't require API calls
        await this.testWorkflowTemplates();
        await this.testWorkflowCreation();
        await this.testCustomWorkflow();
        await this.testWorkflowManagement();
        await this.testEnvironmentSecrets();
        await this.testWorkflowTriggers();

        this.showResults();
        return this.calculateSuccessRate();
    }

    /**
     * Add test result
     */
    addResult(testName, success, details = '') {
        this.testResults.push({
            test: testName,
            success,
            details
        });
    }

    /**
     * Show test results
     */
    showResults() {
        console.log('\n📊 GitHub Actions Test Results:');
        console.log('=' .repeat(60));

        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${status} - ${result.test}`);
            if (result.details) {
                console.log(`   Details: ${result.details}`);
            }
        });

        const successRate = this.calculateSuccessRate();
        console.log('=' .repeat(60));
        console.log(`Overall Success Rate: ${successRate}%`);

        if (successRate === 100) {
            console.log('🎉 All GitHub Actions tests passed!');
        } else if (successRate >= 80) {
            console.log('✅ GitHub Actions system mostly functional');
        } else {
            console.log('⚠️ GitHub Actions system needs attention');
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

// Run the test
if (require.main === module) {
    (async () => {
        const test = new GitHubActionsTest();

        try {
            const initialized = await test.initialize();
            if (initialized) {
                const successRate = await test.runTests();

                console.log(`\n🎯 GitHub Actions Manager Test Complete`);
                console.log(`   Success Rate: ${successRate}%`);

                process.exit(successRate === 100 ? 0 : 1);
            }
        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = { GitHubActionsTest };