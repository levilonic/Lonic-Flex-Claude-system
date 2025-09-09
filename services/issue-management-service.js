const { Octokit } = require('@octokit/rest');
const { getAuthManager } = require('../auth/auth-manager');
const { SQLiteManager } = require('../database/sqlite-manager');
const { CommunicationAgent } = require('../agents/comm-agent');
require('dotenv').config();

/**
 * Issue Management Service - Phase 5.2
 * Automated issue creation, assignment, and tracking for multi-agent workflows
 * Fallback for GitHub Projects integration when project permissions are unavailable
 */
class IssueManagementService {
    constructor(options = {}) {
        this.dbManager = options.dbManager || new SQLiteManager();
        this.authManager = getAuthManager();
        this.octokit = null;
        this.githubConfig = {};
        
        // Issue tracking cache
        this.issuesCache = new Map();
        this.milestonesCache = new Map();
        this.labelsCache = new Map();
        
        // Communication agent for notifications
        this.commAgent = null;
        
        this.initialized = false;
    }

    /**
     * Initialize with GitHub authentication
     */
    async initialize() {
        if (this.initialized) return;

        // Initialize auth manager
        await this.authManager.initialize();
        this.githubConfig = this.authManager.getGitHubConfig();
        
        if (!this.githubConfig.token) {
            throw new Error('GitHub token required for issue management operations');
        }

        // Initialize REST API client
        this.octokit = new Octokit({
            auth: this.githubConfig.token,
            userAgent: 'LonicFLex-IssueManager/1.0'
        });

        // Test authentication
        const { data: user } = await this.octokit.rest.users.getAuthenticated();
        console.log(`✅ Issue Management Service authenticated as: ${user.login}`);

        // Initialize database
        if (!this.dbManager.isInitialized) {
            await this.dbManager.initialize();
        }

        // Create issue tracking tables
        await this.createIssueTrackingDatabase();

        // Initialize communication agent for Slack notifications
        this.commAgent = new CommunicationAgent(`issue-manager-${Date.now()}`);
        await this.commAgent.initialize(this.dbManager);

        this.initialized = true;
    }

    /**
     * Create database tables for issue tracking
     */
    async createIssueTrackingDatabase() {
        const createIssuesTableSQL = `
            CREATE TABLE IF NOT EXISTS workflow_issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                issue_id INTEGER NOT NULL,
                issue_node_id TEXT,
                issue_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                body TEXT,
                state TEXT DEFAULT 'open',
                assignee_login TEXT,
                milestone_id INTEGER,
                session_id TEXT NOT NULL,
                branch_name TEXT,
                agent_type TEXT,
                workflow_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        `;

        const createWorkflowMilestonesSQL = `
            CREATE TABLE IF NOT EXISTS workflow_milestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                milestone_id INTEGER NOT NULL,
                milestone_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                due_date DATETIME,
                state TEXT DEFAULT 'open',
                session_id TEXT NOT NULL,
                workflow_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const createWorkflowLabelsSQL = `
            CREATE TABLE IF NOT EXISTS workflow_labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label_id INTEGER,
                label_name TEXT NOT NULL,
                label_color TEXT DEFAULT '0052CC',
                label_description TEXT,
                workflow_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await this.dbManager.db.exec(createIssuesTableSQL);
        await this.dbManager.db.exec(createWorkflowMilestonesSQL);
        await this.dbManager.db.exec(createWorkflowLabelsSQL);
    }

    /**
     * Create standardized labels for multi-agent workflows
     */
    async createWorkflowLabels(owner, repo) {
        const workflowLabels = [
            { name: 'agent:github', color: '0052CC', description: 'GitHub Agent task' },
            { name: 'agent:security', color: 'D93F0B', description: 'Security Agent task' },
            { name: 'agent:code', color: '0E8A16', description: 'Code Agent task' },
            { name: 'agent:deploy', color: '7057FF', description: 'Deploy Agent task' },
            { name: 'agent:comm', color: 'FBCA04', description: 'Communication Agent task' },
            { name: 'workflow:active', color: '1D76DB', description: 'Active workflow' },
            { name: 'workflow:completed', color: '0E8A16', description: 'Completed workflow' },
            { name: 'workflow:failed', color: 'D93F0B', description: 'Failed workflow' },
            { name: 'priority:high', color: 'B60205', description: 'High priority task' },
            { name: 'priority:medium', color: 'FBCA04', description: 'Medium priority task' },
            { name: 'priority:low', color: '0E8A16', description: 'Low priority task' },
            { name: 'type:enhancement', color: '84B6EB', description: 'Enhancement or new feature' },
            { name: 'type:bugfix', color: 'D93F0B', description: 'Bug fix' },
            { name: 'type:maintenance', color: '5319E7', description: 'Maintenance task' }
        ];

        const createdLabels = [];
        for (const labelConfig of workflowLabels) {
            try {
                const { data: label } = await this.octokit.rest.issues.createLabel({
                    owner,
                    repo,
                    name: labelConfig.name,
                    color: labelConfig.color,
                    description: labelConfig.description
                });
                
                createdLabels.push(label);
                this.labelsCache.set(label.name, label);
                
                // Store in database
                await this.storeLabelInDatabase(label, 'multiagent');
                
            } catch (error) {
                if (error.status === 422) {
                    // Label already exists - get it
                    const { data: existingLabels } = await this.octokit.rest.issues.listLabelsForRepo({
                        owner,
                        repo
                    });
                    const existingLabel = existingLabels.find(l => l.name === labelConfig.name);
                    if (existingLabel) {
                        createdLabels.push(existingLabel);
                        this.labelsCache.set(existingLabel.name, existingLabel);
                    }
                } else {
                    console.error(`❌ Failed to create label ${labelConfig.name}: ${error.message}`);
                }
            }
        }

        console.log(`✅ Created/verified ${createdLabels.length} workflow labels`);
        return createdLabels;
    }

    /**
     * Create milestone for workflow session
     */
    async createWorkflowMilestone(owner, repo, sessionId, workflowType, dueDate = null) {
        const title = `Workflow: ${workflowType} (${sessionId})`;
        const description = `Multi-agent workflow milestone for session ${sessionId}. Tracks completion of all agent tasks in the ${workflowType} workflow.`;

        try {
            const { data: milestone } = await this.octokit.rest.issues.createMilestone({
                owner,
                repo,
                title,
                description,
                ...(dueDate && { due_on: dueDate })
            });

            this.milestonesCache.set(milestone.id, milestone);
            await this.storeMilestoneInDatabase(milestone, sessionId, workflowType);

            console.log(`✅ Created workflow milestone: ${milestone.title}`);
            return milestone;

        } catch (error) {
            console.error(`❌ Failed to create milestone: ${error.message}`);
            return null;
        }
    }

    /**
     * Create issue for agent task with automatic labeling and milestone assignment
     */
    async createAgentIssue(owner, repo, sessionId, agentType, branchName, workflowType, milestone = null) {
        const title = `[${agentType.toUpperCase()}] Agent Task - ${branchName || 'main'}`;
        const body = `
## Agent Task: ${agentType}

**Workflow Type**: ${workflowType}
**Branch**: ${branchName || 'main'}
**Session ID**: ${sessionId}
**Status**: 🔄 In Progress

### Task Description:
This issue tracks the execution of the **${agentType}** agent in the multi-agent workflow.

### Agent Responsibilities:
${this.getAgentResponsibilities(agentType)}

### Progress Checklist:
- [ ] Agent initialization
- [ ] Authentication and setup
- [ ] Workflow execution
- [ ] Result validation
- [ ] Report generation
- [ ] Cleanup and handoff

### Workflow Context:
- **Created**: ${new Date().toISOString()}
- **Priority**: ${this.getAgentPriority(agentType)}
- **Dependencies**: ${this.getAgentDependencies(agentType)}

---
*This issue was automatically created by the LonicFLex Issue Management Service*
        `;

        const labels = [
            `agent:${agentType}`,
            'workflow:active',
            `priority:${this.getAgentPriority(agentType)}`,
            'type:enhancement'
        ];

        // Add branch-specific label if branch name provided
        if (branchName && branchName !== 'main') {
            labels.push(`branch:${branchName}`);
        }

        try {
            const { data: issue } = await this.octokit.rest.issues.create({
                owner,
                repo,
                title,
                body,
                labels,
                ...(milestone && { milestone: milestone.number })
            });

            // Store in database
            await this.storeIssueInDatabase(issue, sessionId, branchName, agentType, workflowType);
            this.issuesCache.set(issue.id, issue);

            // Send Slack notification if communication agent is available
            if (this.commAgent) {
                await this.commAgent.sendMessage(`
🎯 **New Agent Task Created**

**Issue**: #${issue.number} - ${issue.title}
**Agent**: ${agentType}
**Branch**: ${branchName || 'main'}
**Session**: ${sessionId}

[View Issue](${issue.html_url})
                `);
            }

            console.log(`✅ Created agent issue #${issue.number} for ${agentType}`);
            return issue;

        } catch (error) {
            console.error(`❌ Failed to create agent issue: ${error.message}`);
            return null;
        }
    }

    /**
     * Update agent issue with progress
     */
    async updateAgentProgress(issueNumber, owner, repo, agentType, status, results = {}) {
        const comment = `
## 🔄 Agent Progress Update

**Agent**: ${agentType}
**Status**: ${this.getStatusEmoji(status)} ${status}
**Updated**: ${new Date().toISOString()}

### Execution Results:
\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`

### Status Details:
${this.getStatusDetails(status, results)}

---
*Automated update from LonicFLex Multi-Agent System*
        `;

        try {
            await this.octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: issueNumber,
                body: comment
            });

            // Update labels based on status
            const newLabels = await this.getStatusLabels(status, agentType);
            await this.octokit.rest.issues.setLabels({
                owner,
                repo,
                issue_number: issueNumber,
                labels: newLabels
            });

            // Close issue if completed
            if (status === 'completed') {
                await this.octokit.rest.issues.update({
                    owner,
                    repo,
                    issue_number: issueNumber,
                    state: 'closed'
                });
            }

            console.log(`✅ Updated issue #${issueNumber} with ${status} status`);

        } catch (error) {
            console.error(`❌ Failed to update issue: ${error.message}`);
        }
    }

    /**
     * Create complete workflow with issues for all agents
     */
    async createWorkflowIssues(owner, repo, sessionId, agentTypes, branchName, workflowType) {
        // Ensure labels exist
        await this.createWorkflowLabels(owner, repo);

        // Create milestone
        const milestone = await this.createWorkflowMilestone(owner, repo, sessionId, workflowType);

        // Create issues for each agent
        const issues = [];
        for (const agentType of agentTypes) {
            const issue = await this.createAgentIssue(
                owner, 
                repo, 
                sessionId, 
                agentType, 
                branchName, 
                workflowType, 
                milestone
            );
            if (issue) {
                issues.push(issue);
            }
        }

        // Send workflow creation notification
        if (this.commAgent) {
            await this.commAgent.sendMessage(`
🚀 **Multi-Agent Workflow Initialized**

**Workflow**: ${workflowType}
**Session**: ${sessionId}
**Branch**: ${branchName || 'main'}
**Agents**: ${agentTypes.join(', ')}

**Created Issues**: ${issues.length}
**Milestone**: ${milestone ? milestone.title : 'None'}

**Issues Created**:
${issues.map(issue => `• #${issue.number} - ${issue.title}`).join('\n')}
            `);
        }

        console.log(`✅ Created workflow with ${issues.length} agent issues`);
        return { issues, milestone };
    }

    /**
     * Get agent responsibilities for issue description
     */
    getAgentResponsibilities(agentType) {
        const responsibilities = {
            github: `
• Repository analysis and validation
• PR and issue management
• Branch operations and Git workflows
• GitHub API integration and rate limiting`,
            security: `
• Vulnerability scanning and assessment
• Security best practice validation
• Code analysis for security issues
• Compliance verification`,
            code: `
• Code generation and analysis
• Claude Code SDK integration
• Development workflow automation
• Code quality assessment`,
            deploy: `
• Docker container management
• Deployment strategy execution
• Infrastructure provisioning
• Health checks and monitoring`,
            comm: `
• Slack integration and notifications
• Multi-agent communication coordination
• Status updates and reporting
• Alert management`
        };
        return responsibilities[agentType] || `• ${agentType} agent specific tasks`;
    }

    /**
     * Get agent priority level
     */
    getAgentPriority(agentType) {
        const priorities = {
            github: 'high',
            security: 'high',
            code: 'medium',
            deploy: 'medium',
            comm: 'low'
        };
        return priorities[agentType] || 'medium';
    }

    /**
     * Get agent dependencies
     */
    getAgentDependencies(agentType) {
        const dependencies = {
            github: 'None (entry point)',
            security: 'GitHub Agent results',
            code: 'Security Agent validation',
            deploy: 'Code Agent output',
            comm: 'All agent results'
        };
        return dependencies[agentType] || 'Previous agent completion';
    }

    /**
     * Get status emoji
     */
    getStatusEmoji(status) {
        const emojis = {
            'initialized': '🟡',
            'in_progress': '🔄',
            'completed': '✅',
            'failed': '❌',
            'blocked': '🚫',
            'skipped': '⏭️'
        };
        return emojis[status] || '❓';
    }

    /**
     * Get status details
     */
    getStatusDetails(status, results) {
        switch (status) {
            case 'completed':
                return `✅ Agent completed successfully with ${Object.keys(results).length} result properties`;
            case 'failed':
                return `❌ Agent failed: ${results.error || 'Unknown error'}`;
            case 'blocked':
                return `🚫 Agent blocked: ${results.blockReason || 'Unknown blocker'}`;
            case 'in_progress':
                return `🔄 Agent executing step ${results.currentStep || 'unknown'}`;
            default:
                return `Status: ${status}`;
        }
    }

    /**
     * Get status-based labels
     */
    async getStatusLabels(status, agentType) {
        const baseLabels = [`agent:${agentType}`];
        
        switch (status) {
            case 'completed':
                baseLabels.push('workflow:completed');
                break;
            case 'failed':
                baseLabels.push('workflow:failed', 'priority:high');
                break;
            case 'in_progress':
                baseLabels.push('workflow:active');
                break;
            default:
                baseLabels.push('workflow:active');
        }
        
        return baseLabels;
    }

    /**
     * Store issue in database
     */
    async storeIssueInDatabase(issue, sessionId, branchName, agentType, workflowType) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT OR REPLACE INTO workflow_issues 
            (issue_id, issue_node_id, issue_number, title, body, state, assignee_login, 
             session_id, branch_name, agent_type, workflow_type, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        await stmt.run([
            issue.id,
            issue.node_id,
            issue.number,
            issue.title,
            issue.body,
            issue.state,
            issue.assignee?.login || null,
            sessionId,
            branchName,
            agentType,
            workflowType,
            JSON.stringify(issue)
        ]);

        await stmt.finalize();
    }

    /**
     * Store milestone in database
     */
    async storeMilestoneInDatabase(milestone, sessionId, workflowType) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT OR REPLACE INTO workflow_milestones 
            (milestone_id, milestone_number, title, description, due_date, state, session_id, workflow_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        await stmt.run([
            milestone.id,
            milestone.number,
            milestone.title,
            milestone.description,
            milestone.due_on,
            milestone.state,
            sessionId,
            workflowType
        ]);

        await stmt.finalize();
    }

    /**
     * Store label in database
     */
    async storeLabelInDatabase(label, workflowType) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT OR REPLACE INTO workflow_labels 
            (label_id, label_name, label_color, label_description, workflow_type)
            VALUES (?, ?, ?, ?, ?)
        `);

        await stmt.run([
            label.id,
            label.name,
            label.color,
            label.description,
            workflowType
        ]);

        await stmt.finalize();
    }
}

// Export for use in multi-agent system
module.exports = { IssueManagementService };

// Demo/testing function
async function demoIssueManagement() {
    console.log('🎯 Issue Management Service Demo');
    
    const issueService = new IssueManagementService();
    
    try {
        await issueService.initialize();
        
        // Create workflow issues for demo
        const result = await issueService.createWorkflowIssues(
            'levilonic',
            'Lonic-Flex-Claude-system',
            `demo_session_${Date.now()}`,
            ['github', 'security', 'code', 'deploy'],
            'feature/issue-management',
            'feature_development'
        );
        
        console.log(`✅ Created ${result.issues.length} issues with milestone: ${result.milestone?.title}`);
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
}

// Run demo if called directly
if (require.main === module) {
    demoIssueManagement();
}