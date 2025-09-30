/**
 * Test Database Manager
 *
 * Purpose: Provides isolated test databases for each test
 * Ensures tests don't interfere with each other or production data
 *
 * Usage:
 *   const { getTestDb, cleanupTestDb } = require('./test-db-manager');
 *
 *   async function myTest() {
 *       const db = await getTestDb('my-test-name');
 *       // ... use db ...
 *       await cleanupTestDb(db);
 *   }
 */

const { SQLiteManager } = require('../src/database/sqlite-manager');
const path = require('path');
const fs = require('fs');

class TestDatabaseManager {
    constructor() {
        this.testDatabases = new Map();
        this.testDataDir = path.join(__dirname, '..', 'data', 'test-databases');

        // Ensure test database directory exists
        if (!fs.existsSync(this.testDataDir)) {
            fs.mkdirSync(this.testDataDir, { recursive: true });
        }
    }

    /**
     * Get a clean test database for a test
     */
    async getTestDb(testName) {
        // Create unique database name
        const timestamp = Date.now();
        const dbName = `test-${testName}-${timestamp}.db`;
        const dbPath = path.join(this.testDataDir, dbName);

        // Create new database instance
        const db = new SQLiteManager(dbPath);
        await db.initialize();

        // Track this database for cleanup
        this.testDatabases.set(testName, { db, dbPath, createdAt: timestamp });

        return db;
    }

    /**
     * Get in-memory database (fastest, no disk I/O)
     */
    async getInMemoryDb(testName = 'in-memory') {
        const db = new SQLiteManager(':memory:');
        await db.initialize();

        this.testDatabases.set(testName, { db, dbPath: ':memory:', createdAt: Date.now() });

        return db;
    }

    /**
     * Clean up a specific test database
     */
    async cleanupTestDb(testName) {
        const dbInfo = this.testDatabases.get(testName);
        if (!dbInfo) {
            return;
        }

        const { db, dbPath } = dbInfo;

        // Close database connection
        if (db && db.isInitialized) {
            await db.close();
        }

        // Delete database file if not in-memory
        if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);

            // Also remove WAL files if they exist
            const walPath = dbPath + '-wal';
            const shmPath = dbPath + '-shm';
            if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
            if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        }

        this.testDatabases.delete(testName);
    }

    /**
     * Clean up all test databases (call at end of test suite)
     */
    async cleanupAll() {
        const testNames = Array.from(this.testDatabases.keys());

        for (const testName of testNames) {
            try {
                await this.cleanupTestDb(testName);
            } catch (error) {
                console.error(`Failed to cleanup test database ${testName}:`, error.message);
            }
        }

        // Clean up any orphaned test databases
        this.cleanupOrphanedDatabases();
    }

    /**
     * Remove old test databases that weren't cleaned up
     */
    cleanupOrphanedDatabases() {
        if (!fs.existsSync(this.testDataDir)) {
            return;
        }

        const files = fs.readdirSync(this.testDataDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const file of files) {
            if (file.startsWith('test-') && file.endsWith('.db')) {
                const filePath = path.join(this.testDataDir, file);
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;

                if (age > maxAge) {
                    console.log(`Cleaning up orphaned test database: ${file}`);
                    try {
                        fs.unlinkSync(filePath);
                        // Also remove associated WAL files
                        const walPath = filePath + '-wal';
                        const shmPath = filePath + '-shm';
                        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
                        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
                    } catch (error) {
                        console.error(`Failed to remove ${file}:`, error.message);
                    }
                }
            }
        }
    }

    /**
     * Get statistics about test databases
     */
    getStats() {
        return {
            active: this.testDatabases.size,
            directory: this.testDataDir
        };
    }
}

// Singleton instance
const testDbManager = new TestDatabaseManager();

// Export convenient functions
module.exports = {
    getTestDb: (testName) => testDbManager.getTestDb(testName),
    getInMemoryDb: (testName) => testDbManager.getInMemoryDb(testName),
    cleanupTestDb: (testName) => testDbManager.cleanupTestDb(testName),
    cleanupAllTestDbs: () => testDbManager.cleanupAll(),
    testDbStats: () => testDbManager.getStats(),
    TestDatabaseManager
};

// Cleanup on process exit
process.on('exit', () => {
    testDbManager.cleanupOrphanedDatabases();
});

process.on('SIGINT', async () => {
    await testDbManager.cleanupAll();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await testDbManager.cleanupAll();
    process.exit(0);
});