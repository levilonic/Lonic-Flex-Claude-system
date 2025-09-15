const { Octokit } = require('@octokit/rest');
const { getAuthManager } = require('../auth/auth-manager');
const { SQLiteManager } = require('../database/sqlite-manager');
const { IssueManagementService } = require('./issue-management-service');
require('dotenv').config();

/**
 * Milestone Integration Service - Phase 5.3
 * Connects branch-aware workflows to project milestones for better tracking
 * Integrates with existing Issue Management Service
 */
class MilestoneIntegrationService {
    constructor(options = {}) {
        this.dbManager = options.dbManager || new SQLiteManager();
        this.authManager = getAuthManager();
        this.octokit = null;
        this.githubConfig = {};
        
        // Integration services
        this.issueService = options.issueService || new IssueManagementService({ dbManager: this.dbManager });
        
        // Milestone tracking cache
        this.milestonesCache = new Map();
        this.branchMilestoneMap = new Map();
        
        this.initialized = false;
    }

    /**
     * Initialize with GitHub authentication and dependencies
     */
    async initialize() {
        if (this.initialized) return;

        // Initialize auth manager
        await this.authManager.initialize();
        this.githubConfig = this.authManager.getGitHubConfig();
        
        if (!this.githubConfig.token) {
            throw new Error('GitHub token required for milestone integration');
        }

        // Initialize REST API client
        this.octokit = new Octokit({
            auth: this.githubConfig.token,
            userAgent: 'LonicFLex-MilestoneIntegration/1.0'
        });

        // Initialize issue management service
        if (!this.issueService.initialized) {
            await this.issueService.initialize();
        }

        // Initialize database
        if (!this.dbManager.isInitialized) {
            await this.dbManager.initialize();
        }

        // Create milestone integration tables
        await this.createMilestoneIntegrationDatabase();

        const { data: user } = await this.octokit.rest.users.getAuthenticated();
        console.log(`✅ Milestone Integration Service authenticated as: ${user.login}`);

        this.initialized = true;
    }

    /**
     * Create database tables for milestone integration
     */
    async createMilestoneIntegrationDatabase() {
        const createBranchMilestonesSQL = `
            CREATE TABLE IF NOT EXISTS branch_milestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                branch_name TEXT NOT NULL,
                session_id TEXT NOT NULL,
                milestone_id INTEGER,
                milestone_number INTEGER,
                milestone_title TEXT,
                workflow_type TEXT,
                agent_types TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completion_percentage REAL DEFAULT 0.0,
                estimated_completion DATETIME,
                actual_completion DATETIME,
                metadata TEXT
            )
        `;

        const createMilestoneProgressSQL = `
            CREATE TABLE IF NOT EXISTS milestone_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                milestone_id INTEGER NOT NULL,
                branch_name TEXT NOT NULL,
                session_id TEXT NOT NULL,
                agent_type TEXT NOT NULL,
                task_name TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                started_at DATETIME,
                completed_at DATETIME,
                progress_percentage REAL DEFAULT 0.0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const createMilestoneEventSQL = `
            CREATE TABLE IF NOT EXISTS milestone_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                milestone_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                event_data TEXT NOT NULL,
                branch_name TEXT,
                agent_type TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await this.dbManager.db.exec(createBranchMilestonesSQL);
        await this.dbManager.db.exec(createMilestoneProgressSQL);
        await this.dbManager.db.exec(createMilestoneEventSQL);
    }

    /**
     * Create branch-specific milestone with workflow integration
     */
    async createBranchMilestone(owner, repo, branchName, sessionId, workflowType, agentTypes, options = {}) {
        const title = options.title || `Branch: ${branchName} - ${workflowType}`;
        const description = options.description || this.generateMilestoneDescription(branchName, sessionId, workflowType, agentTypes);
        const dueDate = options.dueDate || this.estimateCompletionDate(agentTypes.length);

        try {
            // Check if milestone already exists for this branch/session
            const existing = await this.findExistingMilestone(owner, repo, branchName, sessionId);
            if (existing) {
                console.log(`✅ Using existing milestone: ${existing.title}`);
                return existing;
            }

            // Create new milestone via GitHub API
            const { data: milestone } = await this.octokit.rest.issues.createMilestone({
                owner,
                repo,
                title,
                description,
                due_on: dueDate.toISOString()
            });

            // Store in database with branch mapping
            await this.storeBranchMilestone(milestone, branchName, sessionId, workflowType, agentTypes);

            // Create progress tracking entries for each agent
            await this.initializeMilestoneProgress(milestone, branchName, sessionId, agentTypes);

            // Log milestone creation event
            await this.logMilestoneEvent(milestone.id, 'created', {
                branchName,
                sessionId,
                workflowType,
                agentTypes,
                dueDate
            });

            this.milestonesCache.set(milestone.id, milestone);
            this.branchMilestoneMap.set(`${branchName}_${sessionId}`, milestone);

            console.log(`✅ Created branch milestone: ${milestone.title} (Due: ${dueDate.toDateString()})`);
            return milestone;

        } catch (error) {
            console.error(`❌ Failed to create branch milestone: ${error.message}`);
            return null;
        }
    }

    /**
     * Update milestone progress when agent completes
     */
    async updateMilestoneProgress(milestoneId, branchName, sessionId, agentType, status, results = {}) {
        try {
            // Update progress tracking
            const stmt = await this.dbManager.db.prepare(`
                UPDATE milestone_progress 
                SET status = ?, progress_percentage = ?, completed_at = ?, notes = ?, updated_at = ?
                WHERE milestone_id = ? AND branch_name = ? AND session_id = ? AND agent_type = ?
            `);

            const progressPercentage = status === 'completed' ? 100 : (status === 'in_progress' ? 50 : 0);
            const completedAt = status === 'completed' ? new Date().toISOString() : null;
            const notes = JSON.stringify(results);

            await stmt.run([
                status,
                progressPercentage,
                completedAt,
                notes,
                new Date().toISOString(),
                milestoneId,
                branchName,
                sessionId,
                agentType
            ]);

            await stmt.finalize();

            // Calculate overall milestone progress
            const overallProgress = await this.calculateMilestoneProgress(milestoneId, branchName, sessionId);
            
            // Update milestone description with progress
            await this.updateMilestoneDescription(milestoneId, branchName, sessionId, overallProgress);

            // Log progress event
            await this.logMilestoneEvent(milestoneId, 'progress_updated', {
                branchName,
                agentType,
                status,
                overallProgress,
                results
            }, branchName, agentType);

            // Close milestone if all agents completed
            if (overallProgress.completionPercentage === 100) {
                await this.completeMilestone(milestoneId, branchName, sessionId);
            }

            console.log(`✅ Updated milestone progress: ${agentType} -> ${status} (${overallProgress.completionPercentage}% overall)`);
            return overallProgress;

        } catch (error) {
            console.error(`❌ Failed to update milestone progress: ${error.message}`);
            return null;
        }
    }

    /**
     * Calculate overall milestone progress
     */
    async calculateMilestoneProgress(milestoneId, branchName, sessionId) {
        const stmt = await this.dbManager.db.prepare(`
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                AVG(progress_percentage) as avg_progress,
                MIN(started_at) as first_started,
                MAX(completed_at) as last_completed
            FROM milestone_progress 
            WHERE milestone_id = ? AND branch_name = ? AND session_id = ?
        `);

        const result = await stmt.get(milestoneId, branchName, sessionId);
        await stmt.finalize();

        const completionPercentage = Math.round(result.avg_progress || 0);
        const isCompleted = result.completed_tasks === result.total_tasks && result.total_tasks > 0;

        return {
            totalTasks: result.total_tasks,
            completedTasks: result.completed_tasks,
            completionPercentage,
            isCompleted,
            firstStarted: result.first_started,
            lastCompleted: result.last_completed
        };
    }

    /**
     * Complete milestone and close it
     */
    async completeMilestone(milestoneId, branchName, sessionId) {
        try {
            // Get milestone details
            const milestone = await this.getMilestoneById(milestoneId);
            if (!milestone) return;

            // Close the milestone
            const githubConfig = this.authManager.getGitHubConfig();
            const owner = githubConfig.owner;
            const repo = githubConfig.repo;

            await this.octokit.rest.issues.updateMilestone({
                owner,
                repo,
                milestone_number: milestone.number,
                state: 'closed'
            });

            // Update database record
            const stmt = await this.dbManager.db.prepare(`
                UPDATE branch_milestones 
                SET completion_percentage = 100.0, actual_completion = ?, updated_at = ?
                WHERE milestone_id = ? AND branch_name = ? AND session_id = ?
            `);

            await stmt.run([
                new Date().toISOString(),
                new Date().toISOString(),
                milestoneId,
                branchName,
                sessionId
            ]);

            await stmt.finalize();

            // Log completion event
            await this.logMilestoneEvent(milestoneId, 'completed', {
                branchName,
                sessionId,
                completedAt: new Date().toISOString()
            });

            console.log(`✅ Milestone completed: ${milestone.title}`);

        } catch (error) {
            console.error(`❌ Failed to complete milestone: ${error.message}`);
        }
    }

    /**
     * Initialize progress tracking for all agents
     */
    async initializeMilestoneProgress(milestone, branchName, sessionId, agentTypes) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT INTO milestone_progress 
            (milestone_id, branch_name, session_id, agent_type, task_name, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `);

        for (const agentType of agentTypes) {
            const taskName = `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent Workflow`;
            await stmt.run([milestone.id, branchName, sessionId, agentType, taskName]);
        }

        await stmt.finalize();
    }

    /**
     * Generate milestone description
     */
    generateMilestoneDescription(branchName, sessionId, workflowType, agentTypes) {
        return `
## Multi-Agent Workflow Milestone

**Branch**: \`${branchName}\`
**Session**: \`${sessionId}\`
**Workflow Type**: \`${workflowType}\`

### Agent Tasks:
${agentTypes.map(agent => `- [ ] **${agent.toUpperCase()}** Agent`).join('\n')}

### Progress Tracking:
This milestone tracks the completion of all agent tasks in the multi-agent workflow for branch \`${branchName}\`.

**Agents**: ${agentTypes.length}
**Estimated Duration**: ${this.estimateWorkflowDuration(agentTypes.length)} minutes
**Created**: ${new Date().toISOString()}

---
*Auto-generated by LonicFLex Milestone Integration Service*
        `.trim();
    }

    /**
     * Update milestone description with progress
     */
    async updateMilestoneDescription(milestoneId, branchName, sessionId, progress) {
        try {
            const milestone = await this.getMilestoneById(milestoneId);
            if (!milestone) return;

            const progressBar = this.generateProgressBar(progress.completionPercentage);
            const updatedDescription = milestone.description + `

### Current Progress: ${progress.completionPercentage}%
${progressBar}

**Tasks Completed**: ${progress.completedTasks}/${progress.totalTasks}
**Status**: ${progress.isCompleted ? '✅ Completed' : '🔄 In Progress'}
**Last Updated**: ${new Date().toISOString()}
            `;

            const githubConfig = this.authManager.getGitHubConfig();
            const owner = githubConfig.owner;
            const repo = githubConfig.repo;

            await this.octokit.rest.issues.updateMilestone({
                owner,
                repo,
                milestone_number: milestone.number,
                description: updatedDescription
            });

        } catch (error) {
            console.error(`❌ Failed to update milestone description: ${error.message}`);
        }
    }

    /**
     * Generate progress bar visualization
     */
    generateProgressBar(percentage, width = 20) {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage}%`;
    }

    /**
     * Estimate completion date based on agent count
     */
    estimateCompletionDate(agentCount) {
        const baseMinutes = 30; // Base time for workflow setup
        const agentMinutes = agentCount * 15; // 15 minutes per agent
        const bufferMinutes = agentCount * 5; // Buffer time
        
        const totalMinutes = baseMinutes + agentMinutes + bufferMinutes;
        const completionDate = new Date();
        completionDate.setMinutes(completionDate.getMinutes() + totalMinutes);
        
        return completionDate;
    }

    /**
     * Estimate workflow duration
     */
    estimateWorkflowDuration(agentCount) {
        return (agentCount * 15) + 30; // 15 minutes per agent + 30 base
    }

    /**
     * Find existing milestone for branch/session
     */
    async findExistingMilestone(owner, repo, branchName, sessionId) {
        const stmt = await this.dbManager.db.prepare(`
            SELECT * FROM branch_milestones 
            WHERE branch_name = ? AND session_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `);

        const result = await stmt.get(branchName, sessionId);
        await stmt.finalize();

        if (result) {
            try {
                const { data: milestone } = await this.octokit.rest.issues.getMilestone({
                    owner,
                    repo,
                    milestone_number: result.milestone_number
                });
                return milestone;
            } catch (error) {
                console.warn(`⚠️ Milestone ${result.milestone_number} not found on GitHub`);
            }
        }

        return null;
    }

    /**
     * Get milestone by ID
     */
    async getMilestoneById(milestoneId) {
        const stmt = await this.dbManager.db.prepare(`
            SELECT * FROM branch_milestones WHERE milestone_id = ?
        `);

        const result = await stmt.get(milestoneId);
        await stmt.finalize();

        return result;
    }

    /**
     * Store branch milestone in database
     */
    async storeBranchMilestone(milestone, branchName, sessionId, workflowType, agentTypes) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT OR REPLACE INTO branch_milestones 
            (branch_name, session_id, milestone_id, milestone_number, milestone_title, 
             workflow_type, agent_types, estimated_completion, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        await stmt.run([
            branchName,
            sessionId,
            milestone.id,
            milestone.number,
            milestone.title,
            workflowType,
            JSON.stringify(agentTypes),
            milestone.due_on,
            JSON.stringify(milestone)
        ]);

        await stmt.finalize();
    }

    /**
     * Log milestone event
     */
    async logMilestoneEvent(milestoneId, eventType, eventData, branchName = null, agentType = null) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT INTO milestone_events 
            (milestone_id, event_type, event_data, branch_name, agent_type)
            VALUES (?, ?, ?, ?, ?)
        `);

        await stmt.run([
            milestoneId,
            eventType,
            JSON.stringify(eventData),
            branchName,
            agentType
        ]);

        await stmt.finalize();
    }

    /**
     * Get milestone progress report
     */
    async getMilestoneReport(milestoneId) {
        // Get milestone info
        const milestoneInfo = await this.getMilestoneById(milestoneId);
        if (!milestoneInfo) return null;

        // Get progress details
        const progressStmt = await this.dbManager.db.prepare(`
            SELECT * FROM milestone_progress 
            WHERE milestone_id = ?
            ORDER BY agent_type
        `);

        const progressDetails = await progressStmt.all(milestoneId);
        await progressStmt.finalize();

        // Get events
        const eventsStmt = await this.dbManager.db.prepare(`
            SELECT * FROM milestone_events 
            WHERE milestone_id = ?
            ORDER BY timestamp DESC
            LIMIT 10
        `);

        const recentEvents = await eventsStmt.all(milestoneId);
        await eventsStmt.finalize();

        return {
            milestoneInfo,
            progressDetails,
            recentEvents,
            summary: await this.calculateMilestoneProgress(
                milestoneId,
                milestoneInfo.branch_name,
                milestoneInfo.session_id
            )
        };
    }
}

// Export for use in multi-agent system
module.exports = { MilestoneIntegrationService };

// Demo/testing function
async function demoMilestoneIntegration() {
    console.log('🎯 Milestone Integration Service Demo');
    
    const milestoneService = new MilestoneIntegrationService();
    
    try {
        await milestoneService.initialize();
        
        // Create a demo milestone
        const milestone = await milestoneService.createBranchMilestone(
            'levilonic',
            'Lonic-Flex-Claude-system',
            'feature/milestone-integration',
            `demo_session_${Date.now()}`,
            'feature_development',
            ['github', 'security', 'code', 'deploy']
        );
        
        if (milestone) {
            console.log(`✅ Created milestone: ${milestone.title}`);
            
            // Simulate agent progress
            await milestoneService.updateMilestoneProgress(
                milestone.id,
                'feature/milestone-integration',
                milestone.session_id || 'demo_session',
                'github',
                'completed',
                { success: true, tasks: 5 }
            );
        }
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
}

// Run demo if called directly
if (require.main === module) {
    demoMilestoneIntegration();
}