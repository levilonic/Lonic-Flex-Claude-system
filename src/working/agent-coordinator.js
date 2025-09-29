/**
 * Agent Coordinator - Multi-Agent Task Orchestration
 * Coordinates multiple working agents to complete complex workflows
 * No inheritance, just composition and function chains
 */

const { GitHubAgentWorking } = require('./github-agent-working');
const { CodeAgentWorking } = require('./code-agent-working');
const { SecurityAgentWorking } = require('./security-agent-working');
const { PRReviewWorkflow } = require('./pr-review-workflow');

class AgentCoordinator {
    constructor(options = {}) {
        this.sessionId = options.sessionId || `coord-${Date.now()}`;

        // Initialize working agents
        this.agents = {
            github: new GitHubAgentWorking({ sessionId: this.sessionId }),
            code: new CodeAgentWorking({
                sessionId: this.sessionId,
                outputDir: options.outputDir || './generated'
            }),
            security: new SecurityAgentWorking({ sessionId: this.sessionId }),
            prReview: new PRReviewWorkflow()
        };

        // Workflow execution log
        this.executionLog = [];
    }

    /**
     * Log workflow step execution
     */
    logStep(step, agent, input, output, success = true, error = null) {
        const logEntry = {
            step,
            agent,
            timestamp: new Date().toISOString(),
            input,
            output: success ? output : null,
            success,
            error: error?.message || error
        };

        this.executionLog.push(logEntry);

        if (success) {
            console.log(`  ✅ Step ${step}: ${agent} completed`);
        } else {
            console.log(`  ❌ Step ${step}: ${agent} failed - ${error}`);
        }
    }

    /**
     * Execute workflow: Review PR → Generate Fix → Create Branch
     */
    async executeWorkflow_ReviewAndFix(prNumber, fixDescription = 'Automated fix') {
        const workflow = {
            name: 'Review and Fix PR',
            steps: [],
            result: null
        };

        try {
            console.log(`🔄 Starting workflow: Review and Fix PR #${prNumber}`);

            // Step 1: Review PR
            const reviewResult = await this.agents.prReview.execute(prNumber);
            this.logStep(1, 'PR Review', { prNumber }, reviewResult, true);
            workflow.steps.push({ step: 1, agent: 'prReview', success: true, result: reviewResult });

            // Step 2: Generate fix code based on issues
            const codeContext = {
                action: 'generate-class',
                name: 'PRFixer',
                description: `Fix for PR #${prNumber}`,
                methods: [
                    { name: 'fixIssue', params: ['issue'], body: `// Fix for: ${fixDescription}` },
                    { name: 'validateFix', params: [], body: 'return this.issue === null;' }
                ],
                properties: ['issue', 'status'],
                generateTests: true
            };

            const codeResult = await this.agents.code.executeWorkflow(codeContext);
            this.logStep(2, 'Code Generator', codeContext, codeResult, true);
            workflow.steps.push({ step: 2, agent: 'code', success: true, result: codeResult });

            // Step 3: Security scan generated code
            if (codeResult.files && codeResult.files.length > 0) {
                const securityContext = {
                    action: 'scan-file',
                    filePath: codeResult.files[0]
                };

                const securityResult = await this.agents.security.executeWorkflow(securityContext);
                this.logStep(3, 'Security Scanner', securityContext, securityResult, true);
                workflow.steps.push({ step: 3, agent: 'security', success: true, result: securityResult });

                // Step 4: Create branch for fix
                const branchName = `fix/pr-${prNumber}-${Date.now()}`;
                const githubContext = {
                    action: 'create-branch',
                    branchName,
                    baseBranch: 'main'
                };

                const githubResult = await this.agents.github.executeWorkflow(githubContext);
                this.logStep(4, 'GitHub Agent', githubContext, githubResult, true);
                workflow.steps.push({ step: 4, agent: 'github', success: true, result: githubResult });

                workflow.result = {
                    prReview: reviewResult,
                    generatedFiles: codeResult.files,
                    securityIssues: securityResult.secrets.length + securityResult.issues.length,
                    branchCreated: githubResult.branch?.name,
                    success: true
                };
            }

            console.log(`✅ Workflow completed: ${workflow.name}`);
            return workflow;

        } catch (error) {
            this.logStep(workflow.steps.length + 1, 'Workflow', null, null, false, error);
            workflow.result = { success: false, error: error.message };
            throw error;
        }
    }

    /**
     * Execute workflow: Generate Code → Scan → Test
     */
    async executeWorkflow_GenerateAndScan(codeType, codeName, description = '') {
        const workflow = {
            name: 'Generate Code and Security Scan',
            steps: [],
            result: null
        };

        try {
            console.log(`🔄 Starting workflow: Generate ${codeType} ${codeName}`);

            // Step 1: Generate code
            let codeContext = { action: `generate-${codeType}`, name: codeName };

            if (codeType === 'function') {
                codeContext.params = ['input'];
                codeContext.body = 'return input;';
                codeContext.description = description || `${codeName} function`;
            } else if (codeType === 'class') {
                codeContext.methods = [
                    { name: 'process', params: ['data'], body: 'return data;' },
                    { name: 'validate', params: [], body: 'return true;' }
                ];
                codeContext.properties = ['data'];
                codeContext.description = description || `${codeName} class`;
                codeContext.generateTests = true;
            }

            const codeResult = await this.agents.code.executeWorkflow(codeContext);
            this.logStep(1, 'Code Generator', codeContext, codeResult, true);
            workflow.steps.push({ step: 1, agent: 'code', success: true, result: codeResult });

            // Step 2: Security scan generated files
            let allSecurityResults = [];
            for (const file of codeResult.files || []) {
                const securityContext = { action: 'scan-file', filePath: file };
                const securityResult = await this.agents.security.executeWorkflow(securityContext);
                allSecurityResults.push({ file, ...securityResult });
            }

            this.logStep(2, 'Security Scanner', { files: codeResult.files }, allSecurityResults, true);
            workflow.steps.push({ step: 2, agent: 'security', success: true, result: allSecurityResults });

            workflow.result = {
                generatedFiles: codeResult.files,
                securityScanResults: allSecurityResults,
                totalIssues: allSecurityResults.reduce((sum, result) =>
                    sum + (result.secrets?.length || 0) + (result.issues?.length || 0), 0),
                success: true
            };

            console.log(`✅ Workflow completed: ${workflow.name}`);
            return workflow;

        } catch (error) {
            this.logStep(workflow.steps.length + 1, 'Workflow', null, null, false, error);
            workflow.result = { success: false, error: error.message };
            throw error;
        }
    }

    /**
     * Execute workflow: Create Feature Branch → Generate Code → Scan → Create PR
     */
    async executeWorkflow_FullFeature(featureName, codeSpecs) {
        const workflow = {
            name: 'Full Feature Development',
            steps: [],
            result: null
        };

        try {
            console.log(`🔄 Starting workflow: Full Feature Development - ${featureName}`);

            // Step 1: Create feature branch
            const branchName = `feature/${featureName.toLowerCase().replace(/\s+/g, '-')}`;
            const branchContext = {
                action: 'create-branch',
                branchName,
                baseBranch: 'main'
            };

            const branchResult = await this.agents.github.executeWorkflow(branchContext);
            this.logStep(1, 'GitHub Agent', branchContext, branchResult, true);
            workflow.steps.push({ step: 1, agent: 'github', success: true, result: branchResult });

            // Step 2: Generate code for feature
            const codeContext = {
                action: 'generate-class',
                name: featureName.replace(/\s+/g, ''),
                description: `${featureName} feature implementation`,
                methods: codeSpecs.methods || [
                    { name: 'execute', params: ['input'], body: 'return input;' }
                ],
                properties: codeSpecs.properties || ['status'],
                generateTests: true
            };

            const codeResult = await this.agents.code.executeWorkflow(codeContext);
            this.logStep(2, 'Code Generator', codeContext, codeResult, true);
            workflow.steps.push({ step: 2, agent: 'code', success: true, result: codeResult });

            // Step 3: Security scan
            const securityContext = {
                action: 'scan-directory',
                path: './generated'
            };

            const securityResult = await this.agents.security.executeWorkflow(securityContext);
            this.logStep(3, 'Security Scanner', securityContext, securityResult, true);
            workflow.steps.push({ step: 3, agent: 'security', success: true, result: securityResult });

            // Step 4: Create PR (mock for now)
            const prContext = {
                action: 'create-pr',
                title: `feat: ${featureName}`,
                body: `Automated feature implementation for ${featureName}\n\nGenerated files: ${codeResult.files?.join(', ')}`,
                head: branchName,
                base: 'main'
            };

            const prResult = await this.agents.github.executeWorkflow(prContext);
            this.logStep(4, 'GitHub Agent', prContext, prResult, true);
            workflow.steps.push({ step: 4, agent: 'github', success: true, result: prResult });

            workflow.result = {
                branchCreated: branchResult.branch?.name,
                generatedFiles: codeResult.files,
                securityIssues: securityResult.scan?.secrets?.length + securityResult.scan?.issues?.length,
                prCreated: prResult.pr?.number,
                success: true
            };

            console.log(`✅ Workflow completed: ${workflow.name}`);
            return workflow;

        } catch (error) {
            this.logStep(workflow.steps.length + 1, 'Workflow', null, null, false, error);
            workflow.result = { success: false, error: error.message };
            throw error;
        }
    }

    /**
     * Get coordinator status
     */
    getStatus() {
        return {
            sessionId: this.sessionId,
            agents: Object.keys(this.agents),
            executionLog: this.executionLog.length,
            availableWorkflows: [
                'review-and-fix',
                'generate-and-scan',
                'full-feature'
            ]
        };
    }

    /**
     * Get execution log
     */
    getExecutionLog() {
        return this.executionLog;
    }

    /**
     * Clear execution log
     */
    clearLog() {
        this.executionLog = [];
    }
}

module.exports = { AgentCoordinator };

// Test if run directly
if (require.main === module) {
    async function testCoordinator() {
        console.log('🧪 Testing Agent Coordinator...\n');

        const coordinator = new AgentCoordinator({ sessionId: 'test-coord' });
        console.log('Coordinator status:', coordinator.getStatus());

        try {
            // Test Generate and Scan workflow
            const result = await coordinator.executeWorkflow_GenerateAndScan('class', 'TestService', 'Service for testing coordination');

            console.log('\n📊 Workflow Results:');
            console.log(`  Success: ${result.result.success}`);
            console.log(`  Generated files: ${result.result.generatedFiles?.length || 0}`);
            console.log(`  Security issues: ${result.result.totalIssues}`);

            console.log('\n📋 Execution Log:');
            coordinator.getExecutionLog().forEach(entry => {
                console.log(`  ${entry.timestamp}: ${entry.agent} - ${entry.success ? 'SUCCESS' : 'FAILED'}`);
            });

        } catch (error) {
            console.error('❌ Coordinator test failed:', error.message);
        }
    }

    testCoordinator();
}