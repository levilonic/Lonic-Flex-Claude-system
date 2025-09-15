/**
 * SQLite Database Manager - Phase 2.2
 * Multi-agent coordination database with WAL mode (Factor 5: Unify Execution State)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { Factor3ContextManager } = require('../factor3-context-manager');

class SQLiteManager {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '..', 'multi-agent-coordination.db');
        this.db = null;
        this.contextManager = new Factor3ContextManager();
        this.isInitialized = false;
        
        // Ensure database directory exists
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    /**
     * Initialize database with WAL mode for multi-agent coordination
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Enable WAL mode for better concurrent access
                this.db.run('PRAGMA journal_mode = WAL;', (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    this.createTables()
                        .then(() => {
                            this.isInitialized = true;
                            this.contextManager.addEvent('database_initialized', {
                                db_path: this.dbPath,
                                wal_mode: true,
                                tables_created: true
                            });
                            resolve();
                        })
                        .catch(reject);
                });
            });
        });
    }

    /**
     * Create all necessary tables for multi-agent coordination
     */
    async createTables() {
        const tables = [
            // Sessions table - tracks multi-agent workflows
            `CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                workflow_type TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                context_data TEXT,
                result_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Agents table - tracks individual agent instances
            `CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                name TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                current_step TEXT,
                started_at DATETIME,
                completed_at DATETIME,
                context_data TEXT,
                result_data TEXT,
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )`,

            // Events table - Factor 3 context events
            `CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                agent_id TEXT,
                event_type TEXT NOT NULL,
                event_data TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Agent communication table - inter-agent messages
            `CREATE TABLE IF NOT EXISTS agent_communications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                from_agent TEXT NOT NULL,
                to_agent TEXT,
                message_type TEXT NOT NULL,
                message_data TEXT,
                delivered_at DATETIME,
                acknowledged_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Resource locks table - prevent race conditions
            `CREATE TABLE IF NOT EXISTS resource_locks (
                resource_name TEXT PRIMARY KEY,
                locked_by_agent TEXT NOT NULL,
                locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                session_id TEXT NOT NULL
            )`,

            // Configuration table - runtime settings
            `CREATE TABLE IF NOT EXISTS configuration (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Workflows table - tracks workflow execution history
            `CREATE TABLE IF NOT EXISTS workflows (
                session_id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'initiated',
                context TEXT,
                results TEXT,
                error TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )`,

            // Memory System Tables - Learning and Verification
            `CREATE TABLE IF NOT EXISTS memory_lessons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lesson_type TEXT NOT NULL,           -- 'mistake', 'success', 'pattern'
                agent_context TEXT,                  -- Which agent/task context
                description TEXT NOT NULL,           -- What happened
                prevention_rule TEXT,                -- Specific rule to prevent repeat
                verification_command TEXT,           -- Command to verify lesson learned
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                applied_count INTEGER DEFAULT 0,    -- How many times rule was applied
                success_rate REAL DEFAULT 0.0       -- Success rate when rule applied
            )`,

            `CREATE TABLE IF NOT EXISTS status_verifications (
                task_id TEXT PRIMARY KEY,           -- Unique task identifier
                claimed_status TEXT NOT NULL,       -- What was claimed ('completed')
                verified_status TEXT NOT NULL,      -- What verification showed ('failed')
                verification_command TEXT,          -- Command used to verify  
                verification_output TEXT,           -- Full output of verification
                verification_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                discrepancy BOOLEAN NOT NULL,       -- TRUE if claimed != verified
                agent_name TEXT,                    -- Which agent made the claim
                session_id TEXT,                    -- Associated session if any
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )`,

            `CREATE TABLE IF NOT EXISTS memory_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_type TEXT NOT NULL,         -- 'success', 'failure', 'workflow'
                context_signature TEXT NOT NULL,    -- Hash of context conditions
                action_taken TEXT NOT NULL,         -- What action was taken
                outcome TEXT NOT NULL,              -- What was the result
                confidence_score REAL DEFAULT 1.0, -- How confident we are
                occurrence_count INTEGER DEFAULT 1, -- How many times seen
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Project Window System Tables - Configuration Schema (noumena)
            `CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,          -- Project name/identifier
                goal TEXT NOT NULL,                 -- Project main goal
                description TEXT,                   -- Project description  
                vision TEXT,                        -- Long-term vision
                context TEXT,                       -- Background context
                status TEXT DEFAULT 'active',       -- 'active', 'paused', 'completed', 'archived'
                project_dir TEXT,                   -- File system directory path
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Project Sessions - Links sessions to projects (operational schema)
            `CREATE TABLE IF NOT EXISTS project_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                session_purpose TEXT,               -- 'planning', 'execution', 'review'
                status TEXT DEFAULT 'active',       -- 'active', 'paused', 'completed'
                context_summary TEXT,               -- Compressed context for this session
                preserved_context TEXT,             -- Full context preservation
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (project_id) REFERENCES projects (id),
                FOREIGN KEY (session_id) REFERENCES sessions (id),
                UNIQUE(project_id, session_id)
            )`,

            // Project Context - Context schema (phenomena) 
            `CREATE TABLE IF NOT EXISTS project_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                context_type TEXT NOT NULL,         -- 'chat', 'decision', 'milestone', 'note'
                content TEXT NOT NULL,              -- The actual content
                metadata TEXT,                      -- JSON metadata
                importance INTEGER DEFAULT 1,      -- 1-10 importance for preservation
                preserved BOOLEAN DEFAULT FALSE,    -- Whether to preserve long-term
                session_id TEXT,                    -- Session where this was created
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id),
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )`,

            // Project Dependencies - Long-term dependency tracking
            `CREATE TABLE IF NOT EXISTS project_dependencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                dependency_type TEXT NOT NULL,      -- 'github_token', 'api_key', 'config'
                dependency_key TEXT NOT NULL,       -- Key/name of dependency
                encrypted_value TEXT,               -- Encrypted value if sensitive
                expires_at DATETIME,                -- When this dependency expires
                last_validated_at DATETIME,         -- Last time we checked it works
                validation_status TEXT,             -- 'valid', 'expired', 'invalid'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )`,

            // Two-Phase Management System Tables
            
            // Phase Tracking - Track phase states and transitions
            `CREATE TABLE IF NOT EXISTS phase_tracking (
                session_id TEXT NOT NULL,
                current_phase TEXT NOT NULL,        -- 'phase1-planning', 'phase2-execution', 'completed'
                phase_status TEXT DEFAULT 'active', -- 'active', 'completed', 'failed', 'skipped'
                phase_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                phase_end DATETIME,
                manager_agent TEXT,                 -- Which manager agent is handling this phase
                delegated_agents TEXT,              -- JSON array of delegated agents
                progress_percentage INTEGER DEFAULT 0,
                quality_gates_passed TEXT,          -- JSON array of passed quality gates
                quality_gates_failed TEXT,          -- JSON array of failed quality gates
                error_message TEXT,                 -- Error if phase failed
                context_handoff_data TEXT,          -- Data for phase transition
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id),
                PRIMARY KEY (session_id, current_phase)
            )`,

            // Planning Results Storage - Store Phase 1 outputs for Phase 2
            `CREATE TABLE IF NOT EXISTS planning_results (
                session_id TEXT PRIMARY KEY,
                research_synthesis TEXT,            -- JSON of all research findings
                architecture_design TEXT,           -- JSON of architecture design
                execution_plan TEXT,                -- JSON of detailed execution plan
                quality_gates TEXT,                 -- JSON array of defined quality gates
                risk_assessment TEXT,               -- JSON of identified risks and mitigations
                feasibility_score REAL,             -- Overall feasibility score (0-1)
                plan_validation_status TEXT,        -- 'validated', 'needs-review', 'rejected'
                planning_agent_results TEXT,        -- JSON of all delegated agent results
                handoff_context TEXT,               -- Context data for Phase 2 handoff
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )`,

            // Execution Results Storage - Store Phase 2 outputs and final delivery
            `CREATE TABLE IF NOT EXISTS execution_results (
                session_id TEXT PRIMARY KEY,
                implementation_results TEXT,        -- JSON of implementation outcomes
                testing_results TEXT,               -- JSON of testing validation results
                integration_results TEXT,           -- JSON of integration validation results
                quality_validation TEXT,            -- JSON of quality gate validation results
                delivery_report TEXT,               -- JSON of final delivery report
                execution_success_rate REAL,        -- Success rate of execution (0-1)
                performance_metrics TEXT,           -- JSON of performance measurements
                execution_agent_results TEXT,       -- JSON of all delegated agent results
                recommendations TEXT,               -- JSON array of recommendations
                next_steps TEXT,                    -- JSON array of suggested next steps
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )`,

            // Agent Delegation Tracking - Track manager to specialist delegations
            `CREATE TABLE IF NOT EXISTS agent_delegations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                phase TEXT NOT NULL,                -- 'phase1-planning', 'phase2-execution'
                manager_agent TEXT NOT NULL,        -- The manager doing the delegation
                specialist_agent TEXT NOT NULL,     -- The specialist being delegated to
                delegation_task TEXT,               -- Description of delegated task
                task_context TEXT,                  -- JSON context for the task
                delegation_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                delegation_end DATETIME,
                status TEXT DEFAULT 'delegated',    -- 'delegated', 'in-progress', 'completed', 'failed'
                result_data TEXT,                   -- JSON result from specialist agent
                error_message TEXT,                 -- Error if delegation failed
                performance_metrics TEXT,           -- JSON performance data
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )`,

            // Quality Gates Tracking - Track quality gate validations
            `CREATE TABLE IF NOT EXISTS quality_gates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                phase TEXT NOT NULL,                -- 'phase1-planning', 'phase2-execution', 'transition'
                gate_name TEXT NOT NULL,            -- Name of the quality gate
                gate_criteria TEXT,                 -- JSON criteria for the gate
                validation_method TEXT,             -- How the gate is validated
                status TEXT DEFAULT 'pending',      -- 'pending', 'passed', 'failed', 'skipped'
                validation_start DATETIME,
                validation_end DATETIME,
                validation_details TEXT,            -- JSON details of validation
                validation_metrics TEXT,            -- JSON metrics from validation
                failure_reason TEXT,                -- Reason if gate failed
                retry_count INTEGER DEFAULT 0,      -- Number of retry attempts
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )`
        ];

        for (const sql of tables) {
            await this.runSQL(sql);
        }

        // Create indexes for performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_workflow ON sessions(workflow_type)',
            'CREATE INDEX IF NOT EXISTS idx_agents_session ON agents(session_id)',
            'CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)',
            'CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name)',
            'CREATE INDEX IF NOT EXISTS idx_workflows_type ON workflows(type)',
            'CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status)',
            'CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)',
            'CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)',
            // Memory system indexes
            'CREATE INDEX IF NOT EXISTS idx_memory_lessons_type ON memory_lessons(lesson_type)',
            'CREATE INDEX IF NOT EXISTS idx_memory_lessons_agent ON memory_lessons(agent_context)',
            'CREATE INDEX IF NOT EXISTS idx_status_verifications_discrepancy ON status_verifications(discrepancy)',
            'CREATE INDEX IF NOT EXISTS idx_status_verifications_agent ON status_verifications(agent_name)',
            'CREATE INDEX IF NOT EXISTS idx_memory_patterns_type ON memory_patterns(pattern_type)',
            'CREATE INDEX IF NOT EXISTS idx_memory_patterns_signature ON memory_patterns(context_signature)',
            
            // Project Window System Indexes
            'CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)',
            'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
            'CREATE INDEX IF NOT EXISTS idx_projects_last_active ON projects(last_active_at)',
            'CREATE INDEX IF NOT EXISTS idx_project_sessions_project ON project_sessions(project_id)',
            'CREATE INDEX IF NOT EXISTS idx_project_sessions_session ON project_sessions(session_id)',
            'CREATE INDEX IF NOT EXISTS idx_project_sessions_status ON project_sessions(status)',
            'CREATE INDEX IF NOT EXISTS idx_project_context_project ON project_context(project_id)',
            'CREATE INDEX IF NOT EXISTS idx_project_context_type ON project_context(context_type)',
            'CREATE INDEX IF NOT EXISTS idx_project_context_preserved ON project_context(preserved)',
            'CREATE INDEX IF NOT EXISTS idx_project_dependencies_project ON project_dependencies(project_id)',
            'CREATE INDEX IF NOT EXISTS idx_project_dependencies_type ON project_dependencies(dependency_type)'
        ];

        for (const sql of indexes) {
            await this.runSQL(sql);
        }
    }

    /**
     * Execute SQL with promise wrapper
     */
    runSQL(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Get SQL results with promise wrapper
     */
    getSQL(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get all SQL results with promise wrapper
     */
    getAllSQL(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Session Management Methods

    /**
     * Create new multi-agent session
     */
    async createSession(sessionId, workflowType, contextData = {}) {
        const sql = `INSERT INTO sessions (id, workflow_type, context_data) VALUES (?, ?, ?)`;
        const result = await this.runSQL(sql, [
            sessionId, 
            workflowType, 
            JSON.stringify(contextData)
        ]);

        this.contextManager.addEvent('session_created', {
            session_id: sessionId,
            workflow_type: workflowType
        });

        return result;
    }

    /**
     * Update session status
     */
    async updateSession(sessionId, updates) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (key === 'context_data' || key === 'result_data') {
                fields.push(`${key} = ?`);
                values.push(JSON.stringify(value));
            } else {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(sessionId);

        const sql = `UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`;
        return await this.runSQL(sql, values);
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId) {
        const sql = `SELECT * FROM sessions WHERE id = ?`;
        const row = await this.getSQL(sql, [sessionId]);
        
        if (row) {
            // Parse JSON fields
            if (row.context_data) row.context_data = JSON.parse(row.context_data);
            if (row.result_data) row.result_data = JSON.parse(row.result_data);
        }
        
        return row;
    }

    // Agent Management Methods

    /**
     * Create agent record
     */
    async createAgent(agentId, sessionId, agentName, contextData = {}) {
        const sql = `INSERT INTO agents (id, session_id, name, context_data) VALUES (?, ?, ?, ?)`;
        return await this.runSQL(sql, [
            agentId,
            sessionId,
            agentName,
            JSON.stringify(contextData)
        ]);
    }

    /**
     * Update agent progress
     */
    async updateAgentProgress(agentId, progress, currentStep = null, status = null) {
        const updates = { progress };
        if (currentStep) updates.current_step = currentStep;
        if (status) updates.status = status;
        
        if (status === 'in_progress' && progress > 0) {
            updates.started_at = new Date().toISOString();
        }
        if (status === 'completed') {
            updates.completed_at = new Date().toISOString();
        }

        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(agentId);

        const sql = `UPDATE agents SET ${fields.join(', ')} WHERE id = ?`;
        return await this.runSQL(sql, values);
    }

    /**
     * Update agent with flexible data structure (used by ProjectAgent)
     */
    async updateAgent(agentId, updateData) {
        const updates = { ...updateData };
        
        // Handle special fields
        if (updates.result) {
            updates.result_data = JSON.stringify(updates.result);
            delete updates.result;
        }
        if (updates.error) {
            updates.error_message = updates.error;
            delete updates.error;
        }
        if (updates.completed_at) {
            updates.completed_at = new Date(updates.completed_at).toISOString();
        }
        if (updates.failed_at) {
            updates.completed_at = new Date(updates.failed_at).toISOString();
            delete updates.failed_at;
        }

        // Auto-set timestamps based on status
        if (updates.status === 'in_progress') {
            updates.started_at = new Date().toISOString();
        }
        if (updates.status === 'completed' || updates.status === 'failed') {
            updates.completed_at = new Date().toISOString();
        }

        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(agentId);

        const sql = `UPDATE agents SET ${fields.join(', ')} WHERE id = ?`;
        return await this.runSQL(sql, values);
    }

    /**
     * Get agents for session
     */
    async getSessionAgents(sessionId) {
        const sql = `SELECT * FROM agents WHERE session_id = ? ORDER BY created_at`;
        const rows = await this.getAllSQL(sql, [sessionId]);
        
        return rows.map(row => {
            if (row.context_data) row.context_data = JSON.parse(row.context_data);
            if (row.result_data) row.result_data = JSON.parse(row.result_data);
            return row;
        });
    }

    // Event Management Methods

    /**
     * Log event (Factor 3 context tracking)
     */
    async logEvent(sessionId, agentId, eventType, eventData) {
        const sql = `INSERT INTO events (session_id, agent_id, event_type, event_data) VALUES (?, ?, ?, ?)`;
        return await this.runSQL(sql, [
            sessionId,
            agentId,
            eventType,
            JSON.stringify(eventData)
        ]);
    }

    /**
     * Get session events
     */
    async getSessionEvents(sessionId, limit = 100) {
        const sql = `SELECT * FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?`;
        const rows = await this.getAllSQL(sql, [sessionId, limit]);
        
        return rows.map(row => {
            if (row.event_data) row.event_data = JSON.parse(row.event_data);
            return row;
        });
    }

    // Resource Lock Methods (prevent race conditions)

    /**
     * Acquire resource lock
     */
    async acquireLock(resourceName, agentId, sessionId, ttlSeconds = 300) {
        const expiresAt = new Date(Date.now() + (ttlSeconds * 1000)).toISOString();
        
        try {
            const sql = `INSERT INTO resource_locks (resource_name, locked_by_agent, expires_at, session_id) VALUES (?, ?, ?, ?)`;
            await this.runSQL(sql, [resourceName, agentId, expiresAt, sessionId]);
            return true;
        } catch (error) {
            // Lock already exists, check if expired
            const existing = await this.getSQL('SELECT * FROM resource_locks WHERE resource_name = ?', [resourceName]);
            if (existing && new Date(existing.expires_at) < new Date()) {
                // Expired lock, release and retry
                await this.releaseLock(resourceName);
                return this.acquireLock(resourceName, agentId, sessionId, ttlSeconds);
            }
            return false;
        }
    }

    /**
     * Release resource lock
     */
    async releaseLock(resourceName) {
        const sql = `DELETE FROM resource_locks WHERE resource_name = ?`;
        return await this.runSQL(sql, [resourceName]);
    }

    // Utility Methods

    /**
     * Get database statistics
     */
    async getStats() {
        const stats = {};
        
        const queries = [
            { name: 'total_sessions', sql: 'SELECT COUNT(*) as count FROM sessions' },
            { name: 'active_sessions', sql: 'SELECT COUNT(*) as count FROM sessions WHERE status = "active"' },
            { name: 'total_agents', sql: 'SELECT COUNT(*) as count FROM agents' },
            { name: 'completed_agents', sql: 'SELECT COUNT(*) as count FROM agents WHERE status = "completed"' },
            { name: 'total_events', sql: 'SELECT COUNT(*) as count FROM events' },
            { name: 'active_locks', sql: 'SELECT COUNT(*) as count FROM resource_locks WHERE expires_at > datetime("now")' }
        ];

        for (const query of queries) {
            const result = await this.getSQL(query.sql);
            stats[query.name] = result.count;
        }

        return stats;
    }

    /**
     * Clean up expired data
     */
    async cleanup(daysToKeep = 7) {
        const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)).toISOString();
        
        const results = {};
        
        // Clean up old completed sessions
        results.sessions = await this.runSQL(
            'DELETE FROM sessions WHERE status = "completed" AND completed_at < ?', 
            [cutoffDate]
        );
        
        // Clean up expired locks
        results.locks = await this.runSQL(
            'DELETE FROM resource_locks WHERE expires_at < datetime("now")'
        );
        
        // Clean up old events (keep more events than sessions)
        const eventCutoff = new Date(Date.now() - (daysToKeep * 2 * 24 * 60 * 60 * 1000)).toISOString();
        results.events = await this.runSQL(
            'DELETE FROM events WHERE timestamp < ?',
            [eventCutoff]
        );

        return results;
    }

    // ==========================================
    // PROJECT WINDOW SYSTEM METHODS
    // ==========================================

    /**
     * Create a new project (noumena/configuration schema)
     */
    async createProject(name, goal, description = '', projectDir = null, vision = '', context = '') {
        const projectId = `proj_${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        const sql = `INSERT INTO projects (id, name, goal, description, vision, context, project_dir) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        await this.runSQL(sql, [projectId, name, goal, description, vision, context, projectDir]);
        
        this.contextManager.addEvent('project_created', {
            project_id: projectId,
            name,
            goal,
            created_at: Date.now()
        });
        
        return projectId;
    }

    /**
     * Get project by name or ID
     */
    async getProject(nameOrId) {
        const sql = `SELECT * FROM projects WHERE name = ? OR id = ? ORDER BY created_at DESC LIMIT 1`;
        return await this.getSQL(sql, [nameOrId, nameOrId]);
    }

    /**
     * List all projects with optional status filter
     */
    async listProjects(limit = 10, status = null) {
        let sql = `SELECT * FROM projects`;
        const params = [];
        
        if (status) {
            sql += ` WHERE status = ?`;
            params.push(status);
        }
        
        sql += ` ORDER BY last_active_at DESC LIMIT ?`;
        params.push(limit);
        
        return await this.getAllSQL(sql, params);
    }

    /**
     * Update project last active timestamp
     */
    async updateProjectActivity(projectId) {
        const sql = `UPDATE projects SET last_active_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = ?`;
        await this.runSQL(sql, [projectId]);
    }

    /**
     * Link a session to a project (operational schema)
     */
    async linkSessionToProject(projectId, sessionId, purpose = 'execution') {
        const sql = `INSERT OR REPLACE INTO project_sessions 
                     (project_id, session_id, session_purpose, status) 
                     VALUES (?, ?, ?, 'active')`;
        
        await this.runSQL(sql, [projectId, sessionId, purpose]);
        await this.updateProjectActivity(projectId);
        
        this.contextManager.addEvent('session_linked_to_project', {
            project_id: projectId,
            session_id: sessionId,
            purpose
        });
        
        return true;
    }

    /**
     * Save project session with context preservation
     */
    async saveProjectSession(projectId, sessionId, contextData, status = 'saved') {
        const sql = `UPDATE project_sessions 
                     SET context_summary = ?, preserved_context = ?, status = ?, completed_at = CURRENT_TIMESTAMP
                     WHERE project_id = ? AND session_id = ?`;
        
        await this.runSQL(sql, [
            JSON.stringify(contextData.summary || {}),
            JSON.stringify(contextData),
            status,
            projectId,
            sessionId
        ]);
        
        await this.updateProjectActivity(projectId);
        
        this.contextManager.addEvent('project_session_saved', {
            project_id: projectId,
            session_id: sessionId,
            status
        });
        
        return true;
    }

    /**
     * Add context item to project (phenomena/context schema)
     */
    async addProjectContext(projectId, contextType, content, metadata = {}, importance = 1, sessionId = null) {
        const sql = `INSERT INTO project_context 
                     (project_id, context_type, content, metadata, importance, session_id, preserved) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        // Auto-preserve high importance items
        const preserved = importance >= 8;
        
        const result = await this.runSQL(sql, [
            projectId,
            contextType,
            content,
            JSON.stringify(metadata),
            importance,
            sessionId,
            preserved
        ]);
        
        this.contextManager.addEvent('project_context_added', {
            project_id: projectId,
            context_type: contextType,
            importance,
            preserved
        });
        
        return result.lastID;
    }

    /**
     * Get project context for session restoration
     */
    async getProjectContext(projectId, contextTypes = null, preservedOnly = false) {
        let sql = `SELECT * FROM project_context WHERE project_id = ?`;
        const params = [projectId];
        
        if (contextTypes && contextTypes.length > 0) {
            sql += ` AND context_type IN (${contextTypes.map(() => '?').join(',')})`;
            params.push(...contextTypes);
        }
        
        if (preservedOnly) {
            sql += ` AND preserved = 1`;
        }
        
        sql += ` ORDER BY importance DESC, created_at DESC`;
        
        return await this.getAllSQL(sql, params);
    }

    /**
     * Get project sessions for history
     */
    async getProjectSessions(projectId, limit = 10) {
        const sql = `SELECT ps.*, s.workflow_type, s.status as session_status, s.started_at, s.completed_at
                     FROM project_sessions ps
                     LEFT JOIN sessions s ON ps.session_id = s.id
                     WHERE ps.project_id = ?
                     ORDER BY ps.created_at DESC
                     LIMIT ?`;
        
        return await this.getAllSQL(sql, [projectId, limit]);
    }

    /**
     * Update project status
     */
    async updateProjectStatus(projectId, status) {
        const sql = `UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        await this.runSQL(sql, [status, projectId]);
        
        this.contextManager.addEvent('project_status_changed', {
            project_id: projectId,
            new_status: status
        });
        
        return true;
    }

    // Two-Phase Management System Methods

    /**
     * Track phase state and transitions
     */
    async updatePhaseTracking(sessionId, phase, status, managerAgent, updates = {}) {
        const sql = `INSERT OR REPLACE INTO phase_tracking 
                    (session_id, current_phase, phase_status, manager_agent, 
                     delegated_agents, progress_percentage, quality_gates_passed, 
                     quality_gates_failed, error_message, context_handoff_data, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        
        return await this.runSQL(sql, [
            sessionId,
            phase,
            status,
            managerAgent,
            JSON.stringify(updates.delegatedAgents || []),
            updates.progressPercentage || 0,
            JSON.stringify(updates.qualityGatesPassed || []),
            JSON.stringify(updates.qualityGatesFailed || []),
            updates.errorMessage || null,
            JSON.stringify(updates.contextHandoffData || {})
        ]);
    }

    /**
     * Get current phase tracking info
     */
    async getPhaseTracking(sessionId, phase = null) {
        let sql, params;
        
        if (phase) {
            sql = `SELECT * FROM phase_tracking WHERE session_id = ? AND current_phase = ?`;
            params = [sessionId, phase];
        } else {
            sql = `SELECT * FROM phase_tracking WHERE session_id = ? ORDER BY created_at DESC`;
            params = [sessionId];
        }
        
        const rows = await this.getAllSQL(sql, params);
        return rows.map(row => ({
            ...row,
            delegated_agents: row.delegated_agents ? JSON.parse(row.delegated_agents) : [],
            quality_gates_passed: row.quality_gates_passed ? JSON.parse(row.quality_gates_passed) : [],
            quality_gates_failed: row.quality_gates_failed ? JSON.parse(row.quality_gates_failed) : [],
            context_handoff_data: row.context_handoff_data ? JSON.parse(row.context_handoff_data) : {}
        }));
    }

    /**
     * Store planning results for Phase 2 handoff
     */
    async storePlanningResults(sessionId, results) {
        const sql = `INSERT OR REPLACE INTO planning_results 
                    (session_id, research_synthesis, architecture_design, execution_plan, 
                     quality_gates, risk_assessment, feasibility_score, plan_validation_status,
                     planning_agent_results, handoff_context, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        
        return await this.runSQL(sql, [
            sessionId,
            JSON.stringify(results.researchContext || {}),
            JSON.stringify(results.architectureDesign || {}),
            JSON.stringify(results.executionPlan || {}),
            JSON.stringify(results.qualityGates || []),
            JSON.stringify(results.riskAssessment || {}),
            results.feasibilityScore || 0,
            results.planValidationStatus || 'validated',
            JSON.stringify(results.delegatedAgentResults || {}),
            JSON.stringify(results.handoffContext || {})
        ]);
    }

    /**
     * Load planning results for Phase 2 execution
     */
    async loadPlanningResults(sessionId) {
        const sql = `SELECT * FROM planning_results WHERE session_id = ?`;
        const row = await this.getSQL(sql, [sessionId]);
        
        if (row) {
            return {
                sessionId: row.session_id,
                researchContext: JSON.parse(row.research_synthesis || '{}'),
                architectureDesign: JSON.parse(row.architecture_design || '{}'),
                executionPlan: JSON.parse(row.execution_plan || '{}'),
                qualityGates: JSON.parse(row.quality_gates || '[]'),
                riskAssessment: JSON.parse(row.risk_assessment || '{}'),
                feasibilityScore: row.feasibility_score,
                planValidationStatus: row.plan_validation_status,
                delegatedAgentResults: JSON.parse(row.planning_agent_results || '{}'),
                handoffContext: JSON.parse(row.handoff_context || '{}'),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        }
        
        return null;
    }

    /**
     * Store execution results and final delivery
     */
    async storeExecutionResults(sessionId, results) {
        const sql = `INSERT OR REPLACE INTO execution_results 
                    (session_id, implementation_results, testing_results, integration_results,
                     quality_validation, delivery_report, execution_success_rate, performance_metrics,
                     execution_agent_results, recommendations, next_steps, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        
        return await this.runSQL(sql, [
            sessionId,
            JSON.stringify(results.implementationResults || {}),
            JSON.stringify(results.testingResults || {}),
            JSON.stringify(results.integrationResults || {}),
            JSON.stringify(results.qualityValidation || {}),
            JSON.stringify(results.deliveryReport || {}),
            results.executionSuccessRate || 0,
            JSON.stringify(results.performanceMetrics || {}),
            JSON.stringify(results.delegatedAgentResults || {}),
            JSON.stringify(results.recommendations || []),
            JSON.stringify(results.nextSteps || [])
        ]);
    }

    /**
     * Load execution results
     */
    async loadExecutionResults(sessionId) {
        const sql = `SELECT * FROM execution_results WHERE session_id = ?`;
        const row = await this.getSQL(sql, [sessionId]);
        
        if (row) {
            return {
                sessionId: row.session_id,
                implementationResults: JSON.parse(row.implementation_results || '{}'),
                testingResults: JSON.parse(row.testing_results || '{}'),
                integrationResults: JSON.parse(row.integration_results || '{}'),
                qualityValidation: JSON.parse(row.quality_validation || '{}'),
                deliveryReport: JSON.parse(row.delivery_report || '{}'),
                executionSuccessRate: row.execution_success_rate,
                performanceMetrics: JSON.parse(row.performance_metrics || '{}'),
                delegatedAgentResults: JSON.parse(row.execution_agent_results || '{}'),
                recommendations: JSON.parse(row.recommendations || '[]'),
                nextSteps: JSON.parse(row.next_steps || '[]'),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        }
        
        return null;
    }

    /**
     * Track agent delegations from manager to specialist
     */
    async recordDelegation(sessionId, phase, managerAgent, specialistAgent, task, context = {}) {
        const sql = `INSERT INTO agent_delegations 
                    (session_id, phase, manager_agent, specialist_agent, delegation_task, task_context)
                    VALUES (?, ?, ?, ?, ?, ?)`;
        
        const result = await this.runSQL(sql, [
            sessionId,
            phase,
            managerAgent,
            specialistAgent,
            task,
            JSON.stringify(context)
        ]);
        
        return result.lastID;
    }

    /**
     * Update delegation status and results
     */
    async updateDelegation(delegationId, status, results = {}) {
        const sql = `UPDATE agent_delegations 
                    SET status = ?, result_data = ?, error_message = ?, performance_metrics = ?,
                        delegation_end = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?`;
        
        return await this.runSQL(sql, [
            status,
            JSON.stringify(results.resultData || {}),
            results.errorMessage || null,
            JSON.stringify(results.performanceMetrics || {}),
            delegationId
        ]);
    }

    /**
     * Get delegations for a session or manager
     */
    async getDelegations(sessionId, managerAgent = null) {
        let sql, params;
        
        if (managerAgent) {
            sql = `SELECT * FROM agent_delegations WHERE session_id = ? AND manager_agent = ? ORDER BY delegation_start`;
            params = [sessionId, managerAgent];
        } else {
            sql = `SELECT * FROM agent_delegations WHERE session_id = ? ORDER BY delegation_start`;
            params = [sessionId];
        }
        
        const rows = await this.getAllSQL(sql, params);
        return rows.map(row => ({
            ...row,
            task_context: row.task_context ? JSON.parse(row.task_context) : {},
            result_data: row.result_data ? JSON.parse(row.result_data) : {},
            performance_metrics: row.performance_metrics ? JSON.parse(row.performance_metrics) : {}
        }));
    }

    /**
     * Record quality gate validation
     */
    async recordQualityGate(sessionId, phase, gateName, criteria, validationMethod) {
        const sql = `INSERT INTO quality_gates 
                    (session_id, phase, gate_name, gate_criteria, validation_method)
                    VALUES (?, ?, ?, ?, ?)`;
        
        const result = await this.runSQL(sql, [
            sessionId,
            phase,
            gateName,
            JSON.stringify(criteria),
            validationMethod
        ]);
        
        return result.lastID;
    }

    /**
     * Update quality gate validation results
     */
    async updateQualityGate(gateId, status, details = {}) {
        const sql = `UPDATE quality_gates 
                    SET status = ?, validation_start = ?, validation_end = ?, validation_details = ?,
                        validation_metrics = ?, failure_reason = ?, retry_count = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?`;
        
        return await this.runSQL(sql, [
            status,
            details.validationStart || null,
            details.validationEnd || null,
            JSON.stringify(details.validationDetails || {}),
            JSON.stringify(details.validationMetrics || {}),
            details.failureReason || null,
            details.retryCount || 0,
            gateId
        ]);
    }

    /**
     * Get quality gates for a session and phase
     */
    async getQualityGates(sessionId, phase = null) {
        let sql, params;
        
        if (phase) {
            sql = `SELECT * FROM quality_gates WHERE session_id = ? AND phase = ? ORDER BY created_at`;
            params = [sessionId, phase];
        } else {
            sql = `SELECT * FROM quality_gates WHERE session_id = ? ORDER BY created_at`;
            params = [sessionId];
        }
        
        const rows = await this.getAllSQL(sql, params);
        return rows.map(row => ({
            ...row,
            gate_criteria: row.gate_criteria ? JSON.parse(row.gate_criteria) : {},
            validation_details: row.validation_details ? JSON.parse(row.validation_details) : {},
            validation_metrics: row.validation_metrics ? JSON.parse(row.validation_metrics) : {}
        }));
    }

    /**
     * Get comprehensive two-phase session report
     */
    async getTwoPhaseReport(sessionId) {
        const [session, phaseTracking, planningResults, executionResults, delegations, qualityGates] = await Promise.all([
            this.getSession(sessionId),
            this.getPhaseTracking(sessionId),
            this.loadPlanningResults(sessionId),
            this.loadExecutionResults(sessionId),
            this.getDelegations(sessionId),
            this.getQualityGates(sessionId)
        ]);

        return {
            session,
            phaseTracking,
            planningResults,
            executionResults,
            delegations,
            qualityGates,
            summary: {
                phasesCompleted: phaseTracking.filter(p => p.phase_status === 'completed').length,
                totalDelegations: delegations.length,
                completedDelegations: delegations.filter(d => d.status === 'completed').length,
                qualityGatesPassed: qualityGates.filter(qg => qg.status === 'passed').length,
                qualityGatesFailed: qualityGates.filter(qg => qg.status === 'failed').length,
                overallSuccess: executionResults?.executionSuccessRate || 0
            }
        };
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) console.error('Database close error:', err);
                    this.isInitialized = false;
                    resolve();
                });
            });
        }
    }

    /**
     * Demo and testing
     */
    static async demo() {
        console.log('📊 SQLite Manager Demo - Multi-Agent Database\n');
        
        const dbManager = new SQLiteManager(':memory:'); // In-memory for demo
        
        try {
            // Initialize database
            await dbManager.initialize();
            console.log('✅ Database initialized with WAL mode');
            
            // Create demo session
            const sessionId = 'demo_session_' + Date.now();
            await dbManager.createSession(sessionId, 'feature_development', {
                repository: 'test-repo',
                branch: 'feature/demo'
            });
            console.log(`✅ Session created: ${sessionId}`);
            
            // Create agents
            const agents = ['github', 'security', 'code', 'deploy'];
            for (const agentName of agents) {
                const agentId = `${sessionId}_${agentName}`;
                await dbManager.createAgent(agentId, sessionId, agentName, { role: agentName });
                console.log(`✅ Agent created: ${agentName}`);
            }
            
            // Simulate agent progress
            for (const agentName of agents) {
                const agentId = `${sessionId}_${agentName}`;
                
                await dbManager.updateAgentProgress(agentId, 0, 'starting...', 'in_progress');
                await dbManager.logEvent(sessionId, agentId, 'agent_started', { step: 'initialization' });
                
                await dbManager.updateAgentProgress(agentId, 50, 'processing...');
                await dbManager.logEvent(sessionId, agentId, 'progress_update', { progress: 50 });
                
                await dbManager.updateAgentProgress(agentId, 100, 'completed', 'completed');
                await dbManager.logEvent(sessionId, agentId, 'agent_completed', { success: true });
            }
            
            // Test resource locking
            const lockResult = await dbManager.acquireLock('github_api', 'github_agent', sessionId);
            console.log(`✅ Resource lock acquired: ${lockResult}`);
            
            // Get session data
            const session = await dbManager.getSession(sessionId);
            const sessionAgents = await dbManager.getSessionAgents(sessionId);
            const events = await dbManager.getSessionEvents(sessionId);
            const stats = await dbManager.getStats();
            
            console.log('\n📊 Demo Results:');
            console.log(`   Session: ${session.id} (${session.workflow_type})`);
            console.log(`   Agents: ${sessionAgents.length} total`);
            console.log(`   Events: ${events.length} logged`);
            console.log(`   Database stats:`, stats);
            
            // Release lock
            await dbManager.releaseLock('github_api');
            console.log('✅ Resource lock released');
            
            console.log('\n✅ SQLite Manager demo completed successfully!');
            console.log('   WAL mode enables concurrent multi-agent access');
            console.log('   Factor 3 context events are tracked persistently');
            
        } catch (error) {
            console.error('❌ Demo failed:', error.message);
        } finally {
            await dbManager.close();
        }
    }
}

module.exports = { SQLiteManager };

// Run demo if called directly
if (require.main === module) {
    SQLiteManager.demo().catch(console.error);
}