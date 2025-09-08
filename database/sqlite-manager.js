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
            'CREATE INDEX IF NOT EXISTS idx_memory_patterns_signature ON memory_patterns(context_signature)'
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