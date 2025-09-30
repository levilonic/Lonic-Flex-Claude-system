#!/usr/bin/env node

/**
 * Agent Verification Script
 * Systematically tests all 17 agents load and instantiate correctly
 * Can be added to CI/CD pipeline for continuous verification
 */

const fs = require('fs');
const path = require('path');

// Test results tracking
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    agents: []
};

/**
 * Create mock ServiceContainer for testing agent instantiation
 */
function createMockServiceContainer() {
    const mockLogger = {
        createContextLogger: () => ({
            info: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {}
        })
    };

    const mockMemory = {
        recordPattern: () => {},
        recordLesson: () => {},
        queryPatterns: () => []
    };

    const mockCompliance = {
        validateFactor: () => ({ valid: true })
    };

    const mockDocs = {
        generateDocumentation: () => {}
    };

    const mockDatabase = {
        isInitialized: () => true,
        getSessionState: () => null,
        updateSessionState: () => {},
        closeSession: () => {}
    };

    const mockContextManager = {
        addEvent: async () => {},
        getContext: () => ({ events: [] }),
        clearContext: () => {}
    };

    const mockTokenCounter = {
        estimateTokenCount: () => 100,
        isWithinLimit: () => true
    };

    const mockContextMonitor = {
        checkThreshold: () => ({ withinThreshold: true })
    };

    return {
        getService: (name) => {
            if (name === 'logger') return mockLogger;
            if (name === 'database') return mockDatabase;
            if (name === 'tokenCounter') return mockTokenCounter;
            if (name === 'contextMonitor') return mockContextMonitor;
            return null;
        },
        getMemoryService: () => mockMemory,
        getComplianceService: () => mockCompliance,
        getDocumentationService: () => mockDocs,
        getDatabaseService: () => mockDatabase,
        getTokenCounterService: () => mockTokenCounter,
        getContextMonitorService: () => mockContextMonitor,
        createWorkflowPartition: () => mockContextManager,
        getWorkflowPartition: () => mockContextManager,
        cleanupWorkflowPartition: () => {}
    };
}

/**
 * Test if agent module loads without errors
 */
function testAgentLoads(agentPath, agentName) {
    try {
        // Clear require cache to ensure fresh load
        delete require.cache[require.resolve(agentPath)];

        require(agentPath);
        return { success: true, message: 'Loads successfully' };
    } catch (error) {
        return {
            success: false,
            message: `Load failed: ${error.message}`,
            stack: error.stack
        };
    }
}

/**
 * Test if agent instantiates with mock ServiceContainer
 */
function testAgentInstantiates(agentPath, agentName) {
    try {
        // Clear require cache
        delete require.cache[require.resolve(agentPath)];

        const module = require(agentPath);
        const mockServiceContainer = createMockServiceContainer();

        // Try to find the agent class in the module
        let AgentClass = null;

        // Common export patterns (both Enhanced* and regular names)
        if (module.EnhancedCodeAgent) AgentClass = module.EnhancedCodeAgent;
        else if (module.CodeAgent) AgentClass = module.CodeAgent;
        else if (module.EnhancedSecurityAgent) AgentClass = module.EnhancedSecurityAgent;
        else if (module.SecurityAgent) AgentClass = module.SecurityAgent;
        else if (module.EnhancedCommAgent) AgentClass = module.EnhancedCommAgent;
        else if (module.EnhancedCommunicationAgent) AgentClass = module.EnhancedCommunicationAgent;
        else if (module.CommAgent) AgentClass = module.CommAgent;
        else if (module.EnhancedIntegrationAgent) AgentClass = module.EnhancedIntegrationAgent;
        else if (module.IntegrationAgent) AgentClass = module.IntegrationAgent;
        else if (module.EnhancedDocumentationAgent) AgentClass = module.EnhancedDocumentationAgent;
        else if (module.DocumentationAgent) AgentClass = module.DocumentationAgent;
        else if (module.EnhancedArchitectureDesignAgent) AgentClass = module.EnhancedArchitectureDesignAgent;
        else if (module.ArchitectureDesignAgent) AgentClass = module.ArchitectureDesignAgent;
        else if (module.EnhancedProtocolResearchAgent) AgentClass = module.EnhancedProtocolResearchAgent;
        else if (module.ProtocolResearchAgent) AgentClass = module.ProtocolResearchAgent;
        else if (module.EnhancedProjectAgent) AgentClass = module.EnhancedProjectAgent;
        else if (module.ProjectAgent) AgentClass = module.ProjectAgent;
        else if (module.EnhancedPragmaticCodeReviewer) AgentClass = module.EnhancedPragmaticCodeReviewer;
        else if (module.PragmaticCodeReviewerAgent) AgentClass = module.PragmaticCodeReviewerAgent;
        else if (module.PragmaticCodeReviewer) AgentClass = module.PragmaticCodeReviewer;
        else if (module.EnhancedPlanningManagerAgent) AgentClass = module.EnhancedPlanningManagerAgent;
        else if (module.PlanningManagerAgent) AgentClass = module.PlanningManagerAgent;
        else if (module.EnhancedMultiplanManagerAgent) AgentClass = module.EnhancedMultiplanManagerAgent;
        else if (module.MultiplanManagerAgent) AgentClass = module.MultiplanManagerAgent;
        else if (module.EnhancedExecutionManagerAgent) AgentClass = module.EnhancedExecutionManagerAgent;
        else if (module.ExecutionManagerAgent) AgentClass = module.ExecutionManagerAgent;
        else if (module.EnhancedTestingAgent) AgentClass = module.EnhancedTestingAgent;
        else if (module.TestingAgent) AgentClass = module.TestingAgent;
        else if (module.EnhancedResearchAnalysisAgent) AgentClass = module.EnhancedResearchAnalysisAgent;
        else if (module.ResearchAnalysisAgent) AgentClass = module.ResearchAnalysisAgent;
        else if (module.EnhancedGitHubAgent) AgentClass = module.EnhancedGitHubAgent;
        else if (module.GitHubAgent) AgentClass = module.GitHubAgent;
        else if (module.EnhancedDeployAgent) AgentClass = module.EnhancedDeployAgent;
        else if (module.DeployAgent) AgentClass = module.DeployAgent;
        else if (module.BaseAgent) AgentClass = module.BaseAgent;

        if (!AgentClass) {
            return {
                success: false,
                message: 'No agent class found in module exports'
            };
        }

        // Attempt instantiation with ServiceContainer pattern
        const testSessionId = `test_verify_${Date.now()}`;
        const agent = new AgentClass(testSessionId, mockServiceContainer, {});

        // Basic validation
        if (!agent) {
            return {
                success: false,
                message: 'Agent instantiated but returned null/undefined'
            };
        }

        return {
            success: true,
            message: 'Instantiates with ServiceContainer'
        };
    } catch (error) {
        return {
            success: false,
            message: `Instantiation failed: ${error.message}`,
            stack: error.stack
        };
    }
}

/**
 * Verify a single agent
 */
function verifyAgent(agentPath, agentName) {
    console.log(`\n▶️  Testing: ${agentName}`);

    const result = {
        name: agentName,
        path: agentPath,
        loadTest: null,
        instantiationTest: null,
        passed: false
    };

    // Test 1: Module loads
    result.loadTest = testAgentLoads(agentPath, agentName);
    console.log(`   ${result.loadTest.success ? '✅' : '❌'} Load: ${result.loadTest.message}`);

    // Test 2: Agent instantiates (only if load succeeded)
    if (result.loadTest.success) {
        result.instantiationTest = testAgentInstantiates(agentPath, agentName);
        console.log(`   ${result.instantiationTest.success ? '✅' : '❌'} Instantiation: ${result.instantiationTest.message}`);
    } else {
        result.instantiationTest = { success: false, message: 'Skipped (load failed)' };
        console.log(`   ⏭️  Instantiation: Skipped (load failed)`);
    }

    // Overall pass if both tests pass
    result.passed = result.loadTest.success && result.instantiationTest.success;

    return result;
}

/**
 * Discover all agent files in src/agents/
 */
function discoverAgents() {
    const agentsDir = path.join(__dirname, 'src', 'agents');
    const files = fs.readdirSync(agentsDir);

    return files
        .filter(file => {
            // Include only .js files
            if (!file.endsWith('.js')) return false;

            // Exclude .OLD.js backup files
            if (file.endsWith('.OLD.js')) return false;

            // Exclude helper/utility files
            if (file === 'migration-helper.js') return false;
            if (file === 'minimal-agent.js') return false;

            return true;
        })
        .map(file => ({
            name: file.replace('.js', ''),
            path: path.join(agentsDir, file)
        }));
}

/**
 * Main verification function
 */
function main() {
    console.log('🧪 Agent Verification Script');
    console.log('════════════════════════════════════════════════════════════\n');

    // Discover agents
    const agents = discoverAgents();
    results.total = agents.length;

    console.log(`Found ${agents.length} agents to verify\n`);

    // Verify each agent
    for (const agent of agents) {
        const result = verifyAgent(agent.path, agent.name);
        results.agents.push(result);

        if (result.passed) {
            results.passed++;
        } else {
            results.failed++;
        }
    }

    // Summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 VERIFICATION RESULTS');
    console.log('════════════════════════════════════════════════════════════\n');

    console.log(`Total Agents: ${results.total}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%\n`);

    // Failed agents detail
    if (results.failed > 0) {
        console.log('❌ FAILED AGENTS:\n');
        results.agents
            .filter(a => !a.passed)
            .forEach(agent => {
                console.log(`   ${agent.name}:`);
                if (!agent.loadTest.success) {
                    console.log(`      Load Error: ${agent.loadTest.message}`);
                }
                if (!agent.instantiationTest.success) {
                    console.log(`      Instantiation Error: ${agent.instantiationTest.message}`);
                }
                console.log('');
            });
    }

    // Exit code
    const exitCode = results.failed === 0 ? 0 : 1;

    if (exitCode === 0) {
        console.log('✅ All agents verified successfully!\n');
    } else {
        console.log('❌ Some agents failed verification\n');
    }

    process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { verifyAgent, discoverAgents, createMockServiceContainer };
