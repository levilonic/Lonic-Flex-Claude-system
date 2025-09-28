const { ClaudeIntegration } = require('./claude-integration');
const { BaseAgent, AgentFactory } = require('./agents/base-agent');
const { GitHubAgent } = require('./agents/github-agent');
const { SecurityAgent } = require('./agents/security-agent');
const { CodeAgent } = require('./agents/code-agent');
const { DeployAgent } = require('./agents/deploy-agent');
const { CommAgent } = require('./agents/comm-agent');
const { ProjectAgent } = require('./agents/project-agent');
const { PragmaticCodeReviewerAgent } = require('./agents/pragmatic-code-reviewer');
const { SQLiteManager } = require('./database/sqlite-manager');
const DocumentationService = require('./services/documentation-service');
const { BranchAwareAgentManager } = require('./services/branch-aware-agent-manager');
const { CrossBranchCoordinator } = require('./services/cross-branch-coordinator');

/**
 * Multi-Agent Core Coordination Engine
 * Following 12-Factor Agent Principles
 */
class MultiAgentCore {
    constructor() {
        this.claude = new ClaudeIntegration();
        this.activeAgents = new Map();
        this.sessionState = null;
        this.contextHistory = [];
        this.dbManager = new SQLiteManager();
        this.docs = DocumentationService.getInstance();
        
        // Branch-aware functionality
        this.branchManager = new BranchAwareAgentManager({ dbManager: this.dbManager });
        this.crossBranchCoordinator = null;
        this.branchAwareMode = false;
        
        this.isInitialized = false;
    }

    /**
     * Initialize the multi-agent system
     */
    async initialize() {
        if (this.isInitialized) return;
        
        await this.dbManager.initialize();
        await this.branchManager.initialize();
        
        this.isInitialized = true;
        
        console.log('✅ Multi-Agent Core initialized with database and branch-aware capabilities');
    }

    /**
     * Initialize multi-agent session (Factor 5: Unify Execution State)
     */
    async initializeSession(sessionId, workflowType, context = {}) {
        // Ensure core is initialized
        if (!this.isInitialized) {
            await this.initialize();
        }

        this.sessionState = {
            id: sessionId,
            workflowType,
            startedAt: Date.now(),
            context: { ...context },
            currentPhase: 'initialization',
            status: 'active'
        };

        // Create database session
        await this.dbManager.createSession(sessionId, workflowType, context);

        // Start coordination tracking
        const workflow = await this.claude.startWorkflow(workflowType, context);
        
        // Create real agent instances
        await this.createAgentInstances(workflow.agentNames, sessionId, context);
        
        console.log(`🚀 Multi-Agent Session Started: ${sessionId}`);
        console.log(`   Workflow: ${workflowType}`);
        console.log(`   Agents: ${workflow.agentNames.join(' → ')}`);
        
        return workflow;
    }

    /**
     * Create real agent instances for the session
     */
    async createAgentInstances(agentNames, sessionId, context) {
        for (const agentName of agentNames) {
            let agent;
            
            switch (agentName) {
                case 'github':
                    agent = new GitHubAgent(sessionId, context);
                    break;
                case 'security':
                    agent = new SecurityAgent(sessionId, context);
                    break;
                case 'code':
                    agent = new CodeAgent(sessionId, context);
                    break;
                case 'deploy':
                    agent = new DeployAgent(sessionId, context);
                    break;
                case 'comm':
                    agent = new CommAgent(sessionId, context);
                    break;
                case 'project':
                    agent = new ProjectAgent(sessionId, context);
                    break;
                case 'code-reviewer':
                case 'pragmatic-code-reviewer':
                    agent = new PragmaticCodeReviewerAgent(sessionId, context);
                    break;
                default:
                    throw new Error(`Unknown agent type: ${agentName}`);
            }
            
            // Initialize agent with proper workflowId (not database object)
            await agent.initialize(`${sessionId}_${agentName}_workflow`);
            this.activeAgents.set(agentName, agent);
            
            console.log(`✅ Created real agent instance: ${agentName}`);
        }
    }

    /**
     * Execute agent workflow with context management (Factor 3)
     */
    async executeWorkflow(agentExecutors = {}) {
        if (!this.sessionState) {
            throw new Error('Session not initialized');
        }

        try {
            const results = await this.claude.coordinateAgents(async (agentName, context, updateProgress) => {
                // Get real agent instance
                const agent = this.activeAgents.get(agentName);
                if (!agent) {
                    throw new Error(`Agent ${agentName} not found in active agents`);
                }
                
                // Update session context
                this.updateSessionContext(agentName, context);
                
                console.log(`🤖 Executing real agent: ${agentName}`);
                
                // Execute real agent workflow
                return await agent.execute(context, updateProgress);
            });

            this.sessionState.status = 'completed';
            this.sessionState.completedAt = Date.now();
            
            return {
                sessionId: this.sessionState.id,
                results: Object.fromEntries(results),
                duration: this.sessionState.completedAt - this.sessionState.startedAt,
                context: this.generateFinalContext()
            };
            
        } catch (error) {
            this.sessionState.status = 'failed';
            this.sessionState.error = error.message;
            throw error;
        }
    }

    /**
     * Update session context following Factor 3 (efficient XML format)
     */
    async updateSessionContext(agentName, context) {
        // Get documentation suggestions for next agent in workflow
        const nextAgentSuggestions = await this.getNextAgentDocumentation(agentName, context);
        
        const contextEntry = {
            timestamp: Date.now(),
            agent: agentName,
            context: context,
            sessionPhase: this.sessionState.currentPhase,
            documentation_context: nextAgentSuggestions
        };
        
        this.contextHistory.push(contextEntry);
        this.sessionState.currentPhase = agentName;
        
        // Share documentation context with the next agent if available
        if (nextAgentSuggestions.length > 0) {
            this.sessionState.shared_documentation = nextAgentSuggestions;
        }
    }

    /**
     * Get documentation suggestions for the next agent in workflow
     */
    async getNextAgentDocumentation(currentAgent, context) {
        // Predict what the next agent might need based on current results
        let nextAgentType = this.predictNextAgent(currentAgent, context);
        
        if (!nextAgentType) return [];
        
        try {
            const suggestions = await this.docs.getSuggestionsForContext(nextAgentType, 'initialization', {
                previousAgent: currentAgent,
                handoffContext: context
            });
            
            return suggestions;
        } catch (error) {
            console.error('Failed to get next agent documentation:', error.message);
            return [];
        }
    }
    
    /**
     * Predict next agent based on current workflow
     */
    predictNextAgent(currentAgent, context) {
        const workflowMap = {
            'github': 'security',
            'security': 'code', 
            'code': 'deploy',
            'deploy': 'comm'
        };
        
        return workflowMap[currentAgent] || null;
    }

    /**
     * Generate efficient context for LLM (Factor 3: Own Your Context Window)
     */
    generateFinalContext() {
        const contextXml = this.contextHistory.map(entry => {
            return `<${entry.agent}_execution>
    timestamp: "${new Date(entry.timestamp).toISOString()}"
    phase: "${entry.sessionPhase}"
    context: |
${JSON.stringify(entry.context, null, 4).split('\n').map(line => '        ' + line).join('\n')}
</${entry.agent}_execution>`;
        }).join('\n\n');

        return `<multi_agent_session>
    session_id: "${this.sessionState.id}"
    workflow_type: "${this.sessionState.workflowType}"
    status: "${this.sessionState.status}"
    duration: "${this.sessionState.completedAt - this.sessionState.startedAt}ms"
    
    execution_history:
${contextXml}
</multi_agent_session>`;
    }

    /**
     * Initialize branch-aware workflow with cross-branch coordination
     */
    async initializeBranchAwareWorkflow(sessionId, branches, workflowType, context = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        this.branchAwareMode = true;
        
        // Initialize cross-branch coordinator
        this.crossBranchCoordinator = new CrossBranchCoordinator({
            dbManager: this.dbManager,
            sessionId,
            repository: context.repository
        });
        await this.crossBranchCoordinator.initialize();

        console.log(`🌿 Initializing branch-aware workflow: ${workflowType}`);
        console.log(`   Branches: ${branches.join(', ')}`);

        const branchWorkflows = {};

        // Create agents for each branch
        for (const branchName of branches) {
            const branchContext = {
                ...context,
                branchName,
                branchAware: true
            };

            // Register branch with coordinator
            await this.crossBranchCoordinator.registerBranch(branchName, branchContext);

            // Create branch-specific agents
            const branchAgents = await this.branchManager.createAgentsForBranch(
                sessionId, branchName, ['github', 'security', 'code'], branchContext
            );

            branchWorkflows[branchName] = {
                agents: branchAgents,
                context: branchContext,
                status: 'initialized'
            };
        }

        return {
            sessionId,
            workflowType,
            branches,
            branchWorkflows,
            coordinator: this.crossBranchCoordinator
        };
    }

    /**
     * Execute workflow on specific branch
     */
    async executeBranchWorkflow(sessionId, branchName, workflowType, context = {}) {
        if (!this.branchAwareMode) {
            throw new Error('Branch-aware mode not initialized');
        }

        console.log(`⚡ Executing ${workflowType} on branch: ${branchName}`);

        // Update branch context in coordinator
        await this.crossBranchCoordinator.updateBranchContext(branchName, 'workflow_start', {
            workflowType,
            startedAt: Date.now()
        });

        // Execute workflow using branch manager
        const result = await this.branchManager.executeBranchWorkflow(
            sessionId, branchName, workflowType, context
        );

        // Update completion context
        await this.crossBranchCoordinator.updateBranchContext(branchName, 'workflow_complete', {
            workflowType,
            completedAt: Date.now(),
            result
        });

        return result;
    }

    /**
     * Execute workflows on multiple branches in parallel
     */
    async executeParallelBranchWorkflows(sessionId, branchWorkflows) {
        if (!this.branchAwareMode) {
            throw new Error('Branch-aware mode not initialized');
        }

        console.log(`🔄 Executing parallel workflows on ${branchWorkflows.length} branches`);

        const promises = branchWorkflows.map(async ({ branchName, workflowType, context }) => {
            try {
                const result = await this.executeBranchWorkflow(sessionId, branchName, workflowType, context);

                const validation = await this.validateWorkflowResult(result, {
                    branchName,
                    workflowType,
                    context
                });

                return {
                    branchName,
                    result,
                    success: validation.success,
                    evidence: validation.evidence,
                    validation: validation,
                    reason: validation.success ? 'Evidence-based validation passed' : validation.reason
                };
            } catch (error) {
                console.error(`❌ Branch ${branchName} workflow failed:`, error.message);
                return { branchName, error: error.message, success: false };
            }
        });

        const results = await Promise.allSettled(promises);
        
        // Process results
        const successfulBranches = results
            .filter(r => r.status === 'fulfilled' && r.value.success)
            .map(r => r.value);
        
        const failedBranches = results
            .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
            .map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message });

        return {
            totalBranches: branchWorkflows.length,
            successfulBranches,
            failedBranches,
            successRate: Math.round((successfulBranches.length / branchWorkflows.length) * 100)
        };
    }

    /**
     * Create branch with GitHub integration
     */
    async createBranch(sessionId, branchName, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return await this.branchManager.createBranch(sessionId, branchName, options);
    }

    /**
     * Create pull request from branch
     */
    async createPullRequest(branchName, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return await this.branchManager.createPullRequest(branchName, options);
    }

    /**
     * Get status of all branches
     */
    async getBranchStatuses(branches) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const statuses = {};
        
        for (const branchName of branches) {
            try {
                statuses[branchName] = await this.branchManager.getBranchStatus(branchName);
            } catch (error) {
                statuses[branchName] = { error: error.message };
            }
        }

        return statuses;
    }

    /**
     * Coordinate action across branches
     */
    async coordinateAcrossBranches(sessionId, branches, coordinationTask, actionData = {}) {
        if (!this.crossBranchCoordinator) {
            throw new Error('Cross-branch coordinator not initialized');
        }

        return await this.crossBranchCoordinator.coordinateAction(
            coordinationTask, branches, actionData
        );
    }

    /**
     * Get cross-branch conflicts
     */
    async getCrossBranchConflicts(branches = null) {
        if (!this.crossBranchCoordinator) {
            return [];
        }

        return await this.crossBranchCoordinator.getAllConflicts(branches);
    }

    /**
     * Get branch-aware status
     */
    getBranchAwareStatus() {
        return {
            branchAwareMode: this.branchAwareMode,
            branchManager: this.branchManager.getStatus(),
            crossBranchCoordinator: this.crossBranchCoordinator?.getStatus() || null,
            activeBranches: this.crossBranchCoordinator?.activeBranches.size || 0
        };
    }

    /**
     * Cleanup all agents
     */
    async cleanupAgents() {
        for (const [agentName, agent] of this.activeAgents) {
            try {
                await agent.cleanup();
                console.log(`🧹 Cleaned up agent: ${agentName}`);
            } catch (error) {
                console.error(`❌ Error cleaning up ${agentName}:`, error.message);
            }
        }
    }

    /**
     * Get session status
     */
    getSessionStatus() {
        return this.sessionState;
    }

    /**
     * ValidatedAgent-style evidence-based workflow result validation
     * Eliminates theater code pattern: success: this.validateSuccess() without evidence
     */
    async validateWorkflowResult(result, context = {}) {
        const evidence = {
            // Basic result structure validation
            resultExists: !!result,
            resultHasProperties: result && Object.keys(result).length > 0,

            // Agent completion validation
            agentsProcessed: result?.agents ? Object.keys(result.agents).length : 0,
            agentSuccessCount: result?.agents ?
                Object.values(result.agents).filter(agent =>
                    agent.status === 'completed' ||
                    agent.status === 'success' ||
                    agent.success === true
                ).length : 0,

            // Workflow status validation
            workflowStatus: result?.status || result?.success,
            workflowCompleted: !!(result?.status === 'completed' ||
                                  result?.status === 'success' ||
                                  result?.success === true),

            // Context validation
            branchName: context.branchName,
            workflowType: context.workflowType,

            // Error validation
            hasErrors: !!(result?.error || result?.errors),
            errorCount: result?.errors ? Object.keys(result.errors).length : (result?.error ? 1 : 0)
        };

        // Validation criteria for workflow success
        const validationCriteria = {
            // Must have valid result structure
            resultExists: { required: true },
            resultHasProperties: { required: true },

            // If agents exist, at least 50% must succeed
            agentSuccessRatio: evidence.agentsProcessed > 0 ?
                (evidence.agentSuccessCount / evidence.agentsProcessed) : 1,

            // Must not have critical errors
            errorCount: { max: 0 }
        };

        // Evaluate success based on evidence
        const successChecks = [];

        // Basic structure checks
        successChecks.push({
            check: 'result_structure',
            passed: evidence.resultExists && evidence.resultHasProperties,
            evidence: { resultExists: evidence.resultExists, resultHasProperties: evidence.resultHasProperties }
        });

        // Agent success ratio check (if agents exist)
        if (evidence.agentsProcessed > 0) {
            const agentSuccessRatio = evidence.agentSuccessCount / evidence.agentsProcessed;
            successChecks.push({
                check: 'agent_success_ratio',
                passed: agentSuccessRatio >= 0.5, // At least 50% success rate
                evidence: {
                    agentsProcessed: evidence.agentsProcessed,
                    agentSuccessCount: evidence.agentSuccessCount,
                    successRatio: agentSuccessRatio
                }
            });
        }

        // Workflow completion check
        successChecks.push({
            check: 'workflow_completion',
            passed: evidence.workflowCompleted && !evidence.hasErrors,
            evidence: {
                workflowCompleted: evidence.workflowCompleted,
                hasErrors: evidence.hasErrors,
                errorCount: evidence.errorCount
            }
        });

        // Calculate overall success
        const passedChecks = successChecks.filter(check => check.passed).length;
        const totalChecks = successChecks.length;
        const successRatio = passedChecks / totalChecks;
        const overallSuccess = successRatio >= 0.75; // 75% of checks must pass

        return {
            success: overallSuccess,
            confidence: successRatio,
            evidence: evidence,
            validation: {
                checks: successChecks,
                passedChecks: passedChecks,
                totalChecks: totalChecks,
                successRatio: successRatio,
                criteria: validationCriteria
            },
            reason: overallSuccess ?
                `Validation passed: ${passedChecks}/${totalChecks} checks successful` :
                `Validation failed: only ${passedChecks}/${totalChecks} checks passed (need ${Math.ceil(totalChecks * 0.75)})`
        };
    }

    /**
     * Clean up session
     */
    async cleanup() {
        await this.cleanupAgents();
        this.activeAgents.clear();
        this.contextHistory = [];
        this.sessionState = null;

        if (this.dbManager) {
            await this.dbManager.close();
        }
    }
}

/**
 * Real multi-agent workflow execution with actual GitHub operations
 */
async function demonstrateMultiAgentWorkflow() {
    console.log('🤖 Multi-Agent Core - Real Workflow Execution\n');
    
    const core = new MultiAgentCore();
    
    try {
        // Get real repository information from git config
        const { execSync } = require('child_process');
        let repoInfo = {};
        
        try {
            const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
            const repoMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
            
            if (repoMatch) {
                repoInfo = {
                    owner: repoMatch[1],
                    repo: repoMatch[2],
                    repository: `${repoMatch[1]}/${repoMatch[2]}`
                };
                console.log(`📂 Detected repository: ${repoInfo.repository}`);
            } else {
                throw new Error('Not a GitHub repository');
            }
        } catch (error) {
            console.log('⚠️  Could not detect GitHub repository, using environment config');
            repoInfo = {
                owner: process.env.GITHUB_OWNER || 'test-owner',
                repo: process.env.GITHUB_REPO || 'test-repo',
                repository: process.env.GITHUB_REPOSITORY || 'test-owner/test-repo'
            };
        }

        // Initialize session with real repository data
        const sessionId = `real_session_${Date.now()}`;
        await core.initializeSession(sessionId, 'feature_development', {
            ...repoInfo,
            feature: 'multi-agent-integration',
            branch: `feature/integration-${Date.now()}`,
            realOperations: true
        });
        
        // Test branch-aware functionality if requested
        if (process.env.TEST_BRANCH_AWARE === 'true') {
            console.log('\n🌿 Testing branch-aware functionality...');
            
            const testBranches = [`feature/test-${Date.now()}`];
            
            // Initialize branch-aware workflow
            await core.initializeBranchAwareWorkflow(
                sessionId,
                testBranches,
                'feature_development',
                { ...repoInfo, testMode: true }
            );
            
            // Create real branch on GitHub
            const branchResult = await core.createBranch(sessionId, testBranches[0], {
                baseBranch: 'main',
                branchType: 'feature',
                agentTypes: ['github']
            });
            
            console.log(`   ✅ Branch operation: ${branchResult.existing ? 'existing' : 'created'}`);
            
            // Get real branch status
            const branchStatuses = await core.getBranchStatuses(testBranches);
            console.log(`   ✅ Branch status: ${branchStatuses[testBranches[0]]?.exists ? 'exists' : 'not found'}`);
        }

        // Execute workflow with real agents
        const result = await core.executeWorkflow();
        
        console.log('\n🎉 Real Multi-Agent Workflow Completed Successfully!');
        console.log(`   Session: ${result.sessionId}`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Agents executed: ${Object.keys(result.results).length}`);
        console.log(`   Repository: ${repoInfo.repository}`);
        console.log(`   Real operations: ${result.context.includes('real') ? 'YES' : 'standard'}`);
        
        // Show branch-aware status if active
        const branchStatus = core.getBranchAwareStatus();
        if (branchStatus.branchAwareMode) {
            console.log('\n🌿 Branch-Aware Status:');
            console.log(`   Active branches: ${branchStatus.activeBranches}`);
            console.log(`   GitHub connected: ${branchStatus.branchManager.githubConnected}`);
        }
        
    } catch (error) {
        console.error('❌ Workflow failed:', error.message);
    } finally {
        await core.cleanup();
    }
}

module.exports = {
    MultiAgentCore
};

// Run demo if called directly
if (require.main === module) {
    demonstrateMultiAgentWorkflow().catch(console.error);
}