const { ClaudeIntegration } = require('./claude-integration');
const { BaseAgent, AgentFactory } = require('./agents/base-agent');
const { GitHubAgent } = require('./agents/github-agent');
const { SecurityAgent } = require('./agents/security-agent');
const { CodeAgent } = require('./agents/code-agent');
const { DeployAgent } = require('./agents/deploy-agent');
const { CommAgent } = require('./agents/comm-agent');
const { SQLiteManager } = require('./database/sqlite-manager');
const DocumentationService = require('./services/documentation-service');

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
        this.isInitialized = false;
    }

    /**
     * Initialize the multi-agent system
     */
    async initialize() {
        if (this.isInitialized) return;
        
        await this.dbManager.initialize();
        this.isInitialized = true;
        
        console.log('✅ Multi-Agent Core initialized with database');
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
                default:
                    throw new Error(`Unknown agent type: ${agentName}`);
            }
            
            // Initialize agent with database
            await agent.initialize(this.dbManager);
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
 * Demo function showing multi-agent coordination
 */
async function demonstrateMultiAgentWorkflow() {
    console.log('🤖 Multi-Agent Core Coordination Demo\n');
    
    const core = new MultiAgentCore();
    
    try {
        // Initialize session with unique ID
        const sessionId = `demo_session_${Date.now()}`;
        await core.initializeSession(sessionId, 'feature_development', {
            repository: 'claude-multi-agent-demo',
            feature: 'payment-integration',
            branch: 'feature/payments'
        });
        
        // Execute workflow with default executors
        const result = await core.executeWorkflow();
        
        console.log('\n🎉 Workflow Completed Successfully!');
        console.log(`   Session: ${result.sessionId}`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Agents executed: ${Object.keys(result.results).length}`);
        
        // Show final context (Factor 3 format)
        console.log('\n📄 Final Context (XML Format):');
        console.log(result.context);
        
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