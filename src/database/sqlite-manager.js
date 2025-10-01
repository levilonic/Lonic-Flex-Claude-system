const { info, warn, error } = require('../services/logger');
/**
 * SQLite Database Manager - Phase 2.2
 * Multi-agent coordination database with WAL mode (Factor 5: Unify Execution State)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');

class SQLiteManager {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '..', '..', 'data', 'database', 'multi-agent-coordination.db');
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
        if (this.isInitialized && this.db) {
            return;
        }

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
     * Expose database run method for direct SQL execution
     */
    async run(sql, params = []) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
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
     * Create all necessary tables for multi-agent coordination
     */
    async createTables() {
        const enableExtendedSchema = process.env.LFX_EXTENDED_SCHEMA === 'true';
        const shouldSkipExtended = (sql) => {
            if (enableExtendedSchema) {
                return false;
            }

            const extendedPatterns = [
                /projects?[_\s(]/i,         // Matches "project_", "projects", "project ", "project("
                /phases?[_\s(]/i,           // Matches "phase_", "phases", "phase ", "phase("
                /multi_workflow/i,          // Multi-workflow tables
                /enterprise_/i,             // Enterprise tables
                /cross_[a-z_]+/i,           // All cross_* tables (cross_system, cross_interaction, etc.)
                /advanced_/i,               // Advanced feature tables
                /lonicflex_/i,              // LonicFLex specific tables
                /planning_results/i,        // Two-phase management tables
                /execution_results/i,
                /agent_delegations/i,
                /quality_gates/i,
                /approval_gates/i,
                /workflow_state/i
            ];

            return extendedPatterns.some(pattern => pattern.test(sql));
        };

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
            )`,

            // ==========================================
            // WINDOW 1: MULTI-WORKFLOW STATE MANAGEMENT ENHANCEMENT
            // ==========================================

            // Multi-workflow session linking - Enterprise workflow orchestration
            `CREATE TABLE IF NOT EXISTS multi_workflow_session_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                primary_workflow_id TEXT NOT NULL,     -- Main workflow session
                linked_workflow_id TEXT NOT NULL,      -- Related workflow session
                link_type TEXT NOT NULL,               -- 'dependency', 'parallel', 'sequential', 'conditional'
                relationship_data TEXT,                -- JSON data about the relationship
                status TEXT DEFAULT 'active',          -- 'active', 'paused', 'completed', 'broken'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME,
                FOREIGN KEY (primary_workflow_id) REFERENCES multi_workflow_sessions (id),
                FOREIGN KEY (linked_workflow_id) REFERENCES multi_workflow_sessions (id)
            )`,

            // Cross-interaction context preservation - Persistent Claude API state
            `CREATE TABLE IF NOT EXISTS cross_interaction_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id TEXT NOT NULL,
                context_key TEXT NOT NULL,             -- 'claude_conversation', 'github_context', 'decision_history'
                context_data TEXT NOT NULL,            -- JSON compressed context data
                context_version INTEGER DEFAULT 1,     -- Version for context evolution
                importance_score INTEGER DEFAULT 5,    -- 1-10 importance for retention
                expires_at DATETIME,                   -- Auto-expiry for low importance context
                compressed_size INTEGER,               -- Size after compression
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
                access_count INTEGER DEFAULT 0,       -- Usage tracking for importance scoring
                FOREIGN KEY (workflow_id) REFERENCES multi_workflow_sessions (id),
                UNIQUE(workflow_id, context_key)
            )`,

            // Workflow state snapshots enhanced - Enterprise state persistence
            `CREATE TABLE IF NOT EXISTS enterprise_workflow_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id TEXT NOT NULL,
                snapshot_type TEXT DEFAULT 'regular',  -- 'creation', 'milestone', 'error', 'resume', 'completion'
                state_data TEXT NOT NULL,              -- Compressed workflow state
                state_hash TEXT NOT NULL,              -- SHA256 hash for integrity verification
                previous_snapshot_id INTEGER,          -- Chain of snapshots for rollback
                metadata TEXT,                         -- JSON metadata (trigger, performance metrics)
                compression_ratio REAL DEFAULT 1.0,   -- Compression effectiveness
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                valid_until DATETIME,                 -- Snapshot expiration
                FOREIGN KEY (workflow_id) REFERENCES multi_workflow_sessions (id),
                FOREIGN KEY (previous_snapshot_id) REFERENCES enterprise_workflow_snapshots (id)
            )`,

            // Conditional workflow rules enhanced - Enterprise logic engine
            `CREATE TABLE IF NOT EXISTS enterprise_conditional_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id TEXT NOT NULL,
                rule_name TEXT NOT NULL,
                condition_expression TEXT NOT NULL,    -- Enhanced expression language
                action_type TEXT NOT NULL,             -- 'create_issue', 'send_notification', 'trigger_workflow', 'request_approval'
                action_configuration TEXT,             -- JSON action configuration
                priority INTEGER DEFAULT 1,           -- Rule execution priority
                enabled BOOLEAN DEFAULT TRUE,
                success_rate REAL DEFAULT 0.0,        -- Historical success rate
                execution_count INTEGER DEFAULT 0,     -- How many times executed
                last_triggered DATETIME,
                performance_metrics TEXT,              -- JSON performance data
                created_by TEXT,                       -- User who created the rule
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (workflow_id) REFERENCES multi_workflow_sessions (id)
            )`,

            // Approval gates enhanced - Enterprise approval workflows
            `CREATE TABLE IF NOT EXISTS enterprise_approval_gates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id TEXT NOT NULL,
                gate_name TEXT NOT NULL,
                approval_type TEXT NOT NULL,           -- 'manager', 'security', 'budget', 'compliance'
                required_approvers TEXT,               -- JSON array of required approvers
                current_approvals TEXT,                -- JSON array of current approvals
                gate_configuration TEXT,               -- JSON gate configuration
                status TEXT DEFAULT 'pending',         -- 'pending', 'approved', 'rejected', 'expired', 'escalated'
                timeout_hours INTEGER DEFAULT 24,     -- Approval timeout
                escalation_rules TEXT,                 -- JSON escalation configuration
                slack_thread_ts TEXT,                  -- Slack thread for approval discussion
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,                   -- Auto-reject after this time
                resolved_at DATETIME,
                resolved_by TEXT,                      -- Who approved/rejected
                resolution_reason TEXT,                -- Reason for approval/rejection
                FOREIGN KEY (workflow_id) REFERENCES multi_workflow_sessions (id)
            )`,

            // Cross-system integration state - Multi-system workflow coordination
            `CREATE TABLE IF NOT EXISTS cross_system_integration_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id TEXT NOT NULL,
                system_type TEXT NOT NULL,             -- 'github', 'slack', 'jira', 'servicenow', 'jenkins'
                system_identifier TEXT NOT NULL,       -- PR number, Slack thread, Jira ticket, etc.
                integration_data TEXT,                 -- JSON integration-specific data
                sync_status TEXT DEFAULT 'active',     -- 'active', 'paused', 'error', 'completed'
                last_sync_at DATETIME,                 -- Last successful sync
                sync_error TEXT,                       -- Last sync error if any
                retry_count INTEGER DEFAULT 0,        -- Retry attempts for failed syncs
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (workflow_id) REFERENCES multi_workflow_sessions (id)
            )`,

            // Window 1: Multi-Workflow State Management Table
            `CREATE TABLE IF NOT EXISTS workflow_state (
                workflow_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                owner TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                context TEXT DEFAULT '{}',
                metadata TEXT DEFAULT '{}',
                completion_percentage REAL DEFAULT 0.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Window 1: Enhanced Approval Gates Table
            `CREATE TABLE IF NOT EXISTS approval_gates (
                gate_id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                requester TEXT NOT NULL,
                workflow_id TEXT,
                status TEXT DEFAULT 'pending',
                priority TEXT DEFAULT 'medium',
                timeout_hours INTEGER DEFAULT 24,
                processed_at DATETIME,
                processed_by TEXT,
                comments TEXT,
                metadata TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const sql of tables) {
            if (shouldSkipExtended(sql)) {
                continue;
            }
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
            'CREATE INDEX IF NOT EXISTS idx_project_dependencies_type ON project_dependencies(dependency_type)',

            // Window 1: Multi-Workflow State Management Indexes
            'CREATE INDEX IF NOT EXISTS idx_multi_workflow_links_primary ON multi_workflow_session_links(primary_workflow_id)',
            'CREATE INDEX IF NOT EXISTS idx_multi_workflow_links_linked ON multi_workflow_session_links(linked_workflow_id)',
            'CREATE INDEX IF NOT EXISTS idx_multi_workflow_links_type ON multi_workflow_session_links(link_type)',
            'CREATE INDEX IF NOT EXISTS idx_multi_workflow_links_status ON multi_workflow_session_links(status)',
            'CREATE INDEX IF NOT EXISTS idx_cross_interaction_context_workflow ON cross_interaction_context(workflow_id)',
            'CREATE INDEX IF NOT EXISTS idx_cross_interaction_context_key ON cross_interaction_context(context_key)',
            'CREATE INDEX IF NOT EXISTS idx_cross_interaction_context_importance ON cross_interaction_context(importance_score)',
            'CREATE INDEX IF NOT EXISTS idx_cross_interaction_context_expires ON cross_interaction_context(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_snapshots_workflow ON enterprise_workflow_snapshots(workflow_id)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_snapshots_type ON enterprise_workflow_snapshots(snapshot_type)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_snapshots_created ON enterprise_workflow_snapshots(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_snapshots_valid ON enterprise_workflow_snapshots(valid_until)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_rules_workflow ON enterprise_conditional_rules(workflow_id)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_rules_enabled ON enterprise_conditional_rules(enabled)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_rules_priority ON enterprise_conditional_rules(priority)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_approval_gates_workflow ON enterprise_approval_gates(workflow_id)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_approval_gates_status ON enterprise_approval_gates(status)',
            'CREATE INDEX IF NOT EXISTS idx_enterprise_approval_gates_expires ON enterprise_approval_gates(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_cross_system_workflow ON cross_system_integration_state(workflow_id)',
            'CREATE INDEX IF NOT EXISTS idx_cross_system_type ON cross_system_integration_state(system_type)',
            'CREATE INDEX IF NOT EXISTS idx_cross_system_status ON cross_system_integration_state(sync_status)'
        ];

        for (const sql of indexes) {
            if (shouldSkipExtended(sql)) {
                continue;
            }
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

    /**
     * Check database health status
     */
    async healthCheck() {
        if (!this.isInitialized || !this.db) {
            await this.initialize();
        }

        try {
            const row = await this.getSQL('SELECT 1 as ok');
            return {
                status: row && row.ok === 1 ? 'ok' : 'unknown',
                dbPath: this.dbPath,
                timestamp: new Date().toISOString()
            };
        } catch (err) {
            throw new Error(`SQLite health check failed: ${err.message}`);
        }
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

    



    /**
     * Close database connection
     */
    async close() {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    this.db = null;
                    this.isInitialized = false;
                    resolve();
                }
            });
        });
    }

}
module.exports = { SQLiteManager };

