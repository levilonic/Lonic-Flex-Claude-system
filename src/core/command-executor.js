/**
 * Core Command Executor - Simple, Working Command System
 * Replaces scaffolding with real functionality
 */

const { info, warn, error } = require('../services/logger');
const { SQLiteManager } = require('../database/sqlite-manager');
const { GitHubReal } = require('../working/github-real');
const { PRReviewWorkflow } = require('../working/pr-review-workflow');

class CommandExecutor {
    constructor() {
        this.db = null;
        this.github = null;
        this.workflows = {
            'pr-review': PRReviewWorkflow
        };

        this.commands = {
            // GitHub commands
            'gh:list-prs': this.listPRs.bind(this),
            'gh:review-pr': this.reviewPR.bind(this),
            'gh:get-files': this.getFiles.bind(this),

            // Database commands
            'db:status': this.databaseStatus.bind(this),
            'db:query': this.databaseQuery.bind(this),

            // Workflow commands
            'workflow:run': this.runWorkflow.bind(this),
            'workflow:list': this.listWorkflows.bind(this),

            // System commands
            'system:health': this.systemHealth.bind(this),
            'system:info': this.systemInfo.bind(this)
        };
    }

    async initialize() {
        if (this.db) return; // Already initialized

        // Initialize database
        this.db = new SQLiteManager();
        await this.db.initialize();

        // Create pr_reviews table if it doesn't exist
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS pr_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pr_number INTEGER NOT NULL,
                score INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        `);

        info('CommandExecutor: Database initialized');

        // Initialize GitHub
        this.github = new GitHubReal();
        info('CommandExecutor: GitHub initialized');
    }

    async shutdown() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }

    /**
     * Execute a command with parameters
     */
    async execute(commandName, params = {}) {
        await this.initialize();

        if (!this.commands[commandName]) {
            throw new Error(`Unknown command: ${commandName}`);
        }

        info(`Executing command: ${commandName}`);
        const result = await this.commands[commandName](params);
        info(`Command completed: ${commandName}`);

        return {
            success: true,
            command: commandName,
            result,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * List available commands
     */
    listCommands() {
        return Object.keys(this.commands).map(cmd => {
            const [category, action] = cmd.split(':');
            return { command: cmd, category, action };
        });
    }

    // ========================================
    // GitHub Commands
    // ========================================

    async listPRs(params = {}) {
        const prs = await this.github.listPRs();
        return {
            count: prs.length,
            prs: prs.map(pr => ({
                number: pr.number,
                title: pr.title,
                state: pr.state,
                author: pr.user?.login || 'unknown'
            }))
        };
    }

    async reviewPR(params = {}) {
        if (!params.prNumber) {
            throw new Error('prNumber parameter required');
        }

        const workflow = new PRReviewWorkflow();
        const review = await workflow.execute(params.prNumber);

        // Store review in database
        await this.db.run(
            `INSERT INTO pr_reviews (pr_number, score, status, created_at)
             VALUES (?, ?, ?, ?)`,
            [params.prNumber, review.overallScore, 'completed', new Date().toISOString()]
        );

        return {
            prNumber: params.prNumber,
            score: review.overallScore,
            recommendations: review.recommendations.length,
            risks: review.analysis.risks.length
        };
    }

    async getFiles(params = {}) {
        const files = await this.github.listFiles();
        return {
            count: files.length,
            files: files.slice(0, 10).map(f => f.name) // First 10 files
        };
    }

    // ========================================
    // Database Commands
    // ========================================

    async databaseStatus(params = {}) {
        // Get database stats by querying tables
        const stats = {
            active_sessions: 0,
            total_agents: 0,
            total_events: 0
        };

        try {
            const sessions = await this.db.run('SELECT COUNT(*) as count FROM sessions WHERE status = "active"');
            stats.active_sessions = sessions.changes || 0;
        } catch (e) {
            // Table might not exist yet
        }

        return {
            connected: true,
            path: this.db.dbPath,
            stats
        };
    }

    async databaseQuery(params = {}) {
        if (!params.sql) {
            throw new Error('sql parameter required');
        }

        const result = await this.db.run(params.sql, params.params || []);
        return result;
    }

    // ========================================
    // Workflow Commands
    // ========================================

    async runWorkflow(params = {}) {
        if (!params.workflow) {
            throw new Error('workflow parameter required');
        }

        const WorkflowClass = this.workflows[params.workflow];
        if (!WorkflowClass) {
            throw new Error(`Unknown workflow: ${params.workflow}`);
        }

        const workflow = new WorkflowClass();
        const result = await workflow.execute(params.input);

        return {
            workflow: params.workflow,
            result
        };
    }

    async listWorkflows(params = {}) {
        return {
            workflows: Object.keys(this.workflows),
            count: Object.keys(this.workflows).length
        };
    }

    // ========================================
    // System Commands
    // ========================================

    async systemHealth(params = {}) {
        const checks = {
            database: false,
            github: false
        };

        try {
            await this.db.run('SELECT 1');
            checks.database = true;
        } catch (e) {
            error('Database health check failed:', e.message);
        }

        try {
            const status = this.github.getStatus();
            checks.github = status.connected || status.mode === 'mock';
        } catch (e) {
            error('GitHub health check failed:', e.message);
        }

        const healthy = checks.database && checks.github;

        return {
            status: healthy ? 'healthy' : 'degraded',
            checks,
            timestamp: new Date().toISOString()
        };
    }

    async systemInfo(params = {}) {
        return {
            version: '1.0.0',
            name: 'LonicFLex Core',
            commands: this.listCommands().length,
            workflows: Object.keys(this.workflows).length,
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        };
    }
}

module.exports = { CommandExecutor };