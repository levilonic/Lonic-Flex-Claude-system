const { info, warn, error } = require('./logger');
const { Octokit } = require('@octokit/rest');
const { GitHubAgent } = require('../agents/github-agent');
const { SecurityAgent } = require('../agents/security-agent');
const { CodeAgent } = require('../agents/code-agent');
const { DeployAgent } = require('../agents/deploy-agent');
const { CommunicationAgent } = require('../agents/comm-agent');
const { SQLiteManager } = require('../database/sqlite-manager');
const { getAuthManager } = require('../auth/auth-manager');

/**
 * Branch-Aware Agent Manager
 * Creates and manages agent instances specific to GitHub branches
 * Handles real branch operations, PR management, and cross-branch coordination
 */
class BranchAwareAgentManager {
    constructor(options = {}) {
        this.dbManager = options.dbManager || new SQLiteManager();
        this.authManager = getAuthManager();
        this.octokit = null;
        this.githubConfig = {};
        
        // Active branch-specific agents
        this.branchAgents = new Map(); // branchName -> Map<agentType, agentInstance>
        this.crossBranchContext = new Map(); // shared context between branches
        this.branchMetadata = new Map(); // branch -> metadata (created, status, etc.)
        
        // Agent types that can be created per branch
        this.supportedAgentTypes = ['github', 'security', 'code', 'deploy', 'comm'];
        
        // Communication agent for Slack notifications
        this.commAgent = null;
        
        this.initialized = false;
    }

    /**
     * Initialize with GitHub authentication and database
     */
    async initialize() {
        if (this.initialized) return;

        // Initialize auth manager
        await this.authManager.initialize();
        this.githubConfig = this.authManager.getGitHubConfig();

        // Implement graceful degradation for missing GitHub token
        if (!this.githubConfig.token) {
            warn('No GitHub token available - operating in degraded mode');
            info('   GitHub operations will be disabled');
            this.octokit = null;
        } else {
            try {
                // Initialize Octokit with real authentication
                this.octokit = new Octokit({
                    auth: this.githubConfig.token,
                    userAgent: 'LonicFLex-BranchAware/1.0'
                });

                // Test GitHub connectivity
                const { data: user } = await this.octokit.rest.users.getAuthenticated();
                info(`BranchAwareAgentManager authenticated as: ${user.login}`);
            } catch (error) {
                warn('GitHub authentication failed - operating in degraded mode');
                info(`   Error: ${error.message}`);
                this.octokit = null;
            }
        }

        // Initialize database
        if (!this.dbManager.isInitialized) {
            await this.dbManager.initialize();
        }

        // Create branch tracking table if not exists
        await this.createBranchTrackingTable();

        // Initialize communication agent for Slack notifications (with graceful fallback)
        try {
            this.commAgent = new CommunicationAgent(`branch-manager-${Date.now()}`);
            await this.commAgent.initialize(); // No workflowId needed for branch manager comm agent
        } catch (error) {
            warn(`ServiceContainer not initialized during comm agent setup - this is expected during system bootstrap`);
            this.commAgent = null; // Will be initialized later when needed
        }

        this.initialized = true;
    }

    /**
     * Create database table for tracking branch-specific agents
     */
    async createBranchTrackingTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS branch_agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                branch_name TEXT NOT NULL,
                agent_type TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                status TEXT DEFAULT 'created',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                UNIQUE(session_id, branch_name, agent_type)
            )
        `;
        
        await this.dbManager.db.exec(createTableSQL);

        const createBranchMetadataSQL = `
            CREATE TABLE IF NOT EXISTS branch_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                branch_name TEXT NOT NULL,
                repository TEXT NOT NULL,
                base_branch TEXT DEFAULT 'main',
                branch_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active',
                metadata TEXT,
                UNIQUE(session_id, branch_name, repository)
            )
        `;
        
        await this.dbManager.db.exec(createBranchMetadataSQL);
    }

    /**
     * Create a new branch on GitHub with associated agents
     */
    async createBranch(sessionId, branchName, options = {}) {
        if (!this.initialized) await this.initialize();

        const {
            baseBranch = 'main',
            branchType = 'feature',
            agentTypes = ['github', 'security'],
            repository = this.githubConfig.repo,
            owner = this.githubConfig.owner
        } = options;

        // Graceful degradation when GitHub API not available
        if (!this.octokit) {
            warn(`GitHub API not available - simulating branch creation: ${branchName}`);
            info('   Branch operations will be tracked locally only');

            // Store branch metadata in database even without GitHub API
            await this.storeBranchMetadata(sessionId, branchName, repository || 'local', {
                baseBranch,
                branchType,
                owner: owner || 'local',
                agentTypes,
                simulatedBranch: true
            });

            // Create branch-specific agents (they can still work locally)
            const agents = await this.createAgentsForBranch(sessionId, branchName, agentTypes, {
                owner: owner || 'local',
                repo: repository || 'local',
                branch: branchName,
                simulatedMode: true
            });

            info(`Local branch ${branchName} simulated with ${agents.size} agents`);

            return {
                branchName,
                repository: repository || 'local',
                owner: owner || 'local',
                agents: Array.from(agents.keys()),
                simulatedBranch: true,
                success: this.validateSuccess()
            };
        }

        try {
            info(` Creating branch: ${branchName} from ${baseBranch}`);

            // Get base branch reference
            const { data: baseRef } = await this.octokit.rest.git.getRef({
                owner,
                repo: repository,
                ref: `heads/${baseBranch}`
            });

            // Create new branch
            await this.octokit.rest.git.createRef({
                owner,
                repo: repository,
                ref: `refs/heads/${branchName}`,
                sha: baseRef.object.sha
            });

            // Store branch metadata in database
            await this.storeBranchMetadata(sessionId, branchName, repository, {
                baseBranch,
                branchType,
                owner,
                agentTypes
            });

            // Create branch-specific agents
            const agents = await this.createAgentsForBranch(sessionId, branchName, agentTypes, {
                owner,
                repo: repository,
                branch: branchName
            });

            info(`Branch ${branchName} created with ${agents.size} agents`);
            
            // Send Slack notification for branch creation
            try {
                await this.commAgent.notifyBranchOperation('created', branchName, repository, {
                    owner,
                    status: 'created',
                    agents: Array.from(agents.keys()),
                    sha: baseRef.object.sha
                });
            } catch (error) {
                info(` Slack notification failed: ${error.message}`);
            }
            
            return {
                branchName,
                repository: `${owner}/${repository}`,
                agents: Array.from(agents.keys()),
                sha: baseRef.object.sha
            };

        } catch (error) {
            if (error.status === 422 && error.message.includes('Reference already exists')) {
                warn(`Branch ${branchName} already exists, creating agents only`);
                const agents = await this.createAgentsForBranch(sessionId, branchName, agentTypes, {
                    owner,
                    repo: repository,
                    branch: branchName
                });
                return {
                    branchName,
                    repository: `${owner}/${repository}`,
                    agents: Array.from(agents.keys()),
                    existing: true
                };
            }
            throw new Error(`Failed to create branch ${branchName}: ${error.message}`);
        }
    }

    /**
     * Create agents specific to a branch
     */
    async createAgentsForBranch(sessionId, branchName, agentTypes, config) {
        const branchAgentMap = new Map();

        for (const agentType of agentTypes) {
            if (!this.supportedAgentTypes.includes(agentType)) {
                console.warn(`WARN  Unsupported agent type: ${agentType}`);
                continue;
            }

            const agentConfig = {
                ...config,
                branchName,
                sessionId: `${sessionId}_${branchName}`,
                branchAware: true
            };

            let agent;
            switch (agentType) {
                case 'github':
                    agent = new GitHubAgent(`${sessionId}_${branchName}`, agentConfig);
                    break;
                case 'security':
                    agent = new SecurityAgent(`${sessionId}_${branchName}`, agentConfig);
                    break;
                case 'code':
                    agent = new CodeAgent(`${sessionId}_${branchName}`, agentConfig);
                    break;
                case 'deploy':
                    agent = new DeployAgent(`${sessionId}_${branchName}`, agentConfig);
                    break;
                case 'comm':
                    agent = new CommunicationAgent(`${sessionId}_${branchName}`, agentConfig);
                    break;
            }

            if (agent) {
                await agent.initialize(this.dbManager);
                branchAgentMap.set(agentType, agent);

                // Store in database
                await this.storeBranchAgent(sessionId, branchName, agentType, agent.agentId, {
                    agentConfig
                });

                info(`   PASS Created ${agentType} agent for branch ${branchName}`);
            }
        }

        // Store branch agents in memory
        this.branchAgents.set(branchName, branchAgentMap);

        return branchAgentMap;
    }

    /**
     * Get agents for a specific branch
     */
    getBranchAgents(branchName) {
        return this.branchAgents.get(branchName) || new Map();
    }

    /**
     * Execute workflow on specific branch with branch-aware agents
     */
    async executeBranchWorkflow(sessionId, branchName, workflowType, context = {}) {
        const agents = this.getBranchAgents(branchName);
        if (agents.size === 0) {
            throw new Error(`No agents found for branch: ${branchName}`);
        }

        const branchContext = {
            ...context,
            branchName,
            sessionId: `${sessionId}_${branchName}`,
            crossBranchContext: this.crossBranchContext.get(branchName) || {}
        };

        info(`FAST Executing ${workflowType} workflow on branch: ${branchName}`);

        const results = new Map();
        
        // Execute agents in sequence for the workflow
        for (const [agentType, agent] of agents) {
            if (this.shouldRunAgentForWorkflow(agentType, workflowType)) {
                try {
                    info(`   AGENT Running ${agentType} agent on ${branchName}`);
                    
                    const result = await agent.executeWorkflow(branchContext, (progress, message) => {
                        info(`      ${progress}% - ${message}`);
                    });

                    results.set(agentType, result);

                    // Update cross-branch context with results
                    this.updateCrossBranchContext(branchName, agentType, result);

                } catch (error) {
                    error(`FAIL ${agentType} agent failed on ${branchName}: ${error.message}`);
                    results.set(agentType, { error: error.message });
                }
            }
        }

        return {
            branchName,
            workflowType,
            sessionId: `${sessionId}_${branchName}`,
            agentResults: Object.fromEntries(results),
            crossBranchContext: this.crossBranchContext.get(branchName)
        };
    }

    /**
     * Create PR from branch using GitHub API
     */
    async createPullRequest(branchName, options = {}) {
        if (!this.initialized) await this.initialize();

        const {
            title = `Feature: ${branchName}`,
            body = `Automated PR created by BranchAwareAgentManager`,
            base = 'main',
            owner = this.githubConfig.owner,
            repo = this.githubConfig.repo
        } = options;

        // Graceful degradation when GitHub API not available
        if (!this.octokit) {
            warn(`GitHub API not available - simulating PR creation for: ${branchName}`);
            const simulatedPR = {
                number: Math.floor(Math.random() * 1000) + 1,
                url: `https://github.com/${owner || 'local'}/${repo || 'local'}/pull/simulated`,
                title,
                head: branchName,
                base,
                simulated: true
            };
            info(` Simulated PR #${simulatedPR.number}: ${simulatedPR.title}`);
            return simulatedPR;
        }

        try {
            const { data: pr } = await this.octokit.rest.pulls.create({
                owner,
                repo,
                title,
                body,
                head: branchName,
                base
            });

            info(` Created PR #${pr.number}: ${pr.title}`);
            info(`   URL: ${pr.html_url}`);

            return {
                number: pr.number,
                url: pr.html_url,
                title: pr.title,
                head: branchName,
                base
            };

        } catch (error) {
            throw new Error(`Failed to create PR from ${branchName}: ${error.message}`);
        }
    }

    /**
     * Get branch status from GitHub
     */
    async getBranchStatus(branchName, repository = this.githubConfig.repo, owner = this.githubConfig.owner) {
        if (!this.initialized) await this.initialize();

        // Graceful degradation when GitHub API not available
        if (!this.octokit) {
            warn(`GitHub API not available - returning simulated status for: ${branchName}`);
            return {
                name: branchName,
                sha: 'simulated-' + Date.now(),
                protected: false,
                aheadBy: 0,
                behindBy: 0,
                lastCommit: {
                    message: 'Simulated commit',
                    author: 'local',
                    date: new Date().toISOString()
                },
                simulated: true,
                exists: true
            };
        }

        try {
            const { data: branch } = await this.octokit.rest.repos.getBranch({
                owner,
                repo: repository,
                branch: branchName
            });

            const { data: comparison } = await this.octokit.rest.repos.compareCommits({
                owner,
                repo: repository,
                base: 'main',
                head: branchName
            });

            return {
                name: branch.name,
                sha: branch.commit.sha,
                protected: branch.protected,
                aheadBy: comparison.ahead_by,
                behindBy: comparison.behind_by,
                lastCommit: {
                    message: branch.commit.commit.message,
                    author: branch.commit.commit.author.name,
                    date: branch.commit.commit.author.date
                }
            };

        } catch (error) {
            if (error.status === 404) {
                return { exists: false };
            }
            throw error;
        }
    }

    /**
     * Coordinate agents across multiple branches
     */
    async coordinateAcrossBranches(sessionId, branches, coordinationTask) {
        info(`CYCLE Coordinating across branches: ${branches.join(', ')}`);

        const branchResults = new Map();
        
        // Execute coordination task on each branch
        for (const branchName of branches) {
            const agents = this.getBranchAgents(branchName);
            const context = {
                coordinationTask,
                otherBranches: branches.filter(b => b !== branchName),
                crossBranchData: this.getCrossBranchData(branches)
            };

            try {
                const result = await this.executeBranchWorkflow(sessionId, branchName, coordinationTask, context);
                branchResults.set(branchName, result);
            } catch (error) {
                branchResults.set(branchName, { error: error.message });
            }
        }

        const coordinationResult = {
            coordinationTask,
            branches,
            results: Object.fromEntries(branchResults),
            summary: this.generateCoordinationSummary(branchResults)
        };

        // Send Slack notification for cross-branch coordination
        try {
            const successCount = Array.from(branchResults.values()).filter(r => !r.error).length;
            const status = successCount === branches.length ? 'completed' : `${successCount}/${branches.length} successful`;
            
            await this.commAgent.notifyCrossBranchCoordination('sync', branches, status, {
                conflicts: Array.from(branchResults.values()).filter(r => r.error).length,
                resolved: successCount
            });
        } catch (error) {
            info(` Cross-branch coordination Slack notification failed: ${error.message}`);
        }

        return coordinationResult;
    }

    /**
     * Helper methods for internal operations
     */
    shouldRunAgentForWorkflow(agentType, workflowType) {
        const workflowAgents = {
            'feature_development': ['github', 'code', 'security'],
            'bug_fix': ['github', 'security', 'code'],
            'security_scan': ['github', 'security'],
            'deployment': ['github', 'deploy', 'comm'],
            'code_review': ['github', 'code', 'security']
        };
        
        return workflowAgents[workflowType]?.includes(agentType) ?? true;
    }

    updateCrossBranchContext(branchName, agentType, result) {
        if (!this.crossBranchContext.has(branchName)) {
            this.crossBranchContext.set(branchName, {});
        }
        
        const context = this.crossBranchContext.get(branchName);
        context[agentType] = {
            timestamp: Date.now(),
            result: result,
            status: result.error ? 'failed' : 'completed'
        };
    }

    getCrossBranchData(branches) {
        const data = {};
        for (const branch of branches) {
            data[branch] = this.crossBranchContext.get(branch) || {};
        }
        return data;
    }

    generateCoordinationSummary(branchResults) {
        const total = branchResults.size;
        const successful = Array.from(branchResults.values()).filter(r => !r.error).length;
        const failed = total - successful;
        
        return {
            totalBranches: total,
            successful,
            failed,
            successRate: Math.round((successful / total) * 100)
        };
    }

    async storeBranchMetadata(sessionId, branchName, repository, metadata) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT OR REPLACE INTO branch_metadata 
            (session_id, branch_name, repository, base_branch, branch_type, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        await stmt.run(
            sessionId, 
            branchName, 
            repository, 
            metadata.baseBranch, 
            metadata.branchType, 
            JSON.stringify(metadata)
        );
        await stmt.finalize();
    }

    async storeBranchAgent(sessionId, branchName, agentType, agentId, metadata) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT OR REPLACE INTO branch_agents 
            (session_id, branch_name, agent_type, agent_id, metadata)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        await stmt.run(sessionId, branchName, agentType, agentId, JSON.stringify(metadata));
        await stmt.finalize();
    }

    /**
     * Get service status and statistics
     */
    getStatus() {
        return {
            initialized: this.initialized,
            activeBranches: this.branchAgents.size,
            totalAgents: Array.from(this.branchAgents.values()).reduce((sum, agents) => sum + agents.size, 0),
            supportedAgentTypes: this.supportedAgentTypes,
            githubConnected: !!this.octokit,
            crossBranchContexts: this.crossBranchContext.size
        };
    }
}

module.exports = { BranchAwareAgentManager };