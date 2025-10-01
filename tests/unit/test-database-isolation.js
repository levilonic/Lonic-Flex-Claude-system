/**
 * Test SQLiteManager in complete isolation
 * No ServiceContainer, no agents, no external dependencies
 * Just test if the database actually works
 */

const { SQLiteManager } = require('../../src/database/sqlite-manager');

async function testDatabaseIsolation() {
    console.log('🧪 Testing SQLiteManager in isolation...');

    let db = null;

    try {
        // Test 1: Can we create a database manager?
        console.log('\n📝 Test 1: Create SQLiteManager instance');
        db = new SQLiteManager();
        console.log('✅ SQLiteManager instance created');

        // Test 2: Can we initialize the database?
        console.log('\n📝 Test 2: Initialize database');
        await db.initialize();
        console.log('✅ Database initialized');

        // Test 3: Can we create a simple table?
        console.log('\n📝 Test 3: Create test table');
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS test_isolation (
                id INTEGER PRIMARY KEY,
                name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await db.run(createTableQuery);
        console.log('✅ Test table created');

        // Test 4: Can we insert data?
        console.log('\n📝 Test 4: Insert test data');
        await db.run(
            'INSERT INTO test_isolation (name) VALUES (?)',
            ['database_isolation_test']
        );
        console.log('✅ Data inserted');

        // Test 5: Can we query data?
        console.log('\n📝 Test 5: Query test data');
        const results = await db.getAllSQL(
            'SELECT * FROM test_isolation WHERE name = ?',
            ['database_isolation_test']
        );

        if (results && results.length > 0) {
            console.log('✅ Data queried successfully:', results[0]);
        } else {
            console.log('❌ No data returned from query');
            return false;
        }

        // Test 6: Can we clean up?
        console.log('\n📝 Test 6: Clean up test data');
        await db.run('DELETE FROM test_isolation WHERE name = ?', ['database_isolation_test']);
        await db.run('DROP TABLE test_isolation');
        console.log('✅ Test data cleaned up');

        console.log('\n🎉 Database isolation test: ALL PASSED');
        return true;

    } catch (error) {
        console.log('\n❌ Database isolation test FAILED:');
        console.log('Error:', error.message);
        console.log('Stack:', error.stack);
        return false;

    } finally {
        if (db && db.close) {
            try {
                await db.close();
                console.log('🧹 Database connection closed');
            } catch (closeError) {
                console.log('⚠️ Error closing database:', closeError.message);
            }
        }
    }
}

// Run the test
if (require.main === module) {
    testDatabaseIsolation().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testDatabaseIsolation };