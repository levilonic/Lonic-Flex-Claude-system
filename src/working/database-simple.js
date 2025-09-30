/**
 * Simple Database - ONLY database operations
 * No context management, no monitoring, just database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseSimple {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '..', '..', 'data', 'database', 'simple.db');
        this.db = null;
        this.isInitialized = false;

        // Ensure database directory exists
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    /**
     * Initialize database with WAL mode
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

                    this.createBasicTables()
                        .then(() => {
                            this.isInitialized = true;
                            resolve(this);
                        })
                        .catch(reject);
                });
            });
        });
    }

    /**
     * Create basic tables
     */
    async createBasicTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                data TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                level TEXT,
                message TEXT,
                data TEXT
            )`
        ];

        for (const sql of tables) {
            await this.run(sql);
        }
    }

    /**
     * Run SQL with parameters
     */
    async run(sql, params = []) {
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
     * Get single row
     */
    async get(sql, params = []) {
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
     * Get all rows
     */
    async all(sql, params = []) {
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
     * Execute multiple statements in transaction
     */
    async transaction(statements) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                let completed = 0;
                let failed = false;

                for (const { sql, params } of statements) {
                    this.db.run(sql, params, function(err) {
                        if (err && !failed) {
                            failed = true;
                            this.db.run('ROLLBACK');
                            reject(err);
                            return;
                        }

                        completed++;
                        if (completed === statements.length && !failed) {
                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ completed });
                                }
                            });
                        }
                    });
                }
            });
        });
    }

    /**
     * Insert data into table
     */
    async insert(table, data) {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);

        const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
        return await this.run(sql, values);
    }

    /**
     * Update data in table
     */
    async update(table, data, where, whereParams = []) {
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), ...whereParams];

        const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
        return await this.run(sql, values);
    }

    /**
     * Delete from table
     */
    async delete(table, where, whereParams = []) {
        const sql = `DELETE FROM ${table} WHERE ${where}`;
        return await this.run(sql, whereParams);
    }

    /**
     * Close database connection
     */
    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    }
                    this.db = null;
                    this.isInitialized = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Get database status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            connected: !!this.db,
            path: this.dbPath,
            capabilities: ['run', 'get', 'all', 'transaction', 'insert', 'update', 'delete']
        };
    }
}

module.exports = { DatabaseSimple };

// Test if run directly
if (require.main === module) {
    async function testDatabase() {
        console.log('TEST Testing DatabaseSimple...\n');

        const db = new DatabaseSimple();
        console.log('Initial status:', db.getStatus());

        try {
            await db.initialize();
            console.log('PASS Database initialized');
            console.log('Status:', db.getStatus());

            // Test simple query
            const result = await db.run("SELECT datetime('now') as time");
            console.log('Query result:', result);

            // Test data insertion
            const insertResult = await db.insert('sessions', {
                id: 'test-session-123',
                data: JSON.stringify({ test: true })
            });
            console.log('PASS Insert successful:', insertResult);

            // Test data retrieval
            const session = await db.get('SELECT * FROM sessions WHERE id = ?', ['test-session-123']);
            console.log('PASS Retrieved data:', session);

            await db.close();
            console.log('PASS Database closed cleanly');

        } catch (error) {
            console.error('FAIL Database test failed:', error.message);
        }
    }

    testDatabase();
}