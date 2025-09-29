#!/usr/bin/env node
/**
 * Database inspection script - check current database structure
 */

const { SQLiteManager } = require('./database/sqlite-manager');
const { GovernanceSchemaManager } = require('./database/governance-schema-manager');

async function inspectDatabase() {
    console.log('=== DATABASE STRUCTURE INSPECTION ===\n');

    const sqliteManager = new SQLiteManager();

    try {
        await sqliteManager.initialize();
        console.log('✅ SQLiteManager initialized successfully\n');

        // Get all tables
        console.log('📋 CURRENT TABLES:');
        const tables = await new Promise((resolve, reject) => {
            sqliteManager.db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        for (const table of tables) {
            console.log(`- ${table.name}`);
        }

        console.log('\n🔍 WORKFLOW_PERMISSIONS TABLE STRUCTURE:');
        try {
            const columns = await new Promise((resolve, reject) => {
                sqliteManager.db.all("PRAGMA table_info(workflow_permissions);", (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            if (columns.length > 0) {
                console.log('Columns:');
                columns.forEach(col => {
                    console.log(`  - ${col.name} (${col.type}) ${col.pk ? 'PRIMARY KEY' : ''} ${col.notnull ? 'NOT NULL' : ''}`);
                });
            } else {
                console.log('❌ workflow_permissions table does not exist');
            }
        } catch (err) {
            console.log(`❌ Error checking workflow_permissions: ${err.message}`);
        }

        // Check projects table
        console.log('\n🔍 PROJECTS TABLE STRUCTURE:');
        try {
            const projectColumns = await new Promise((resolve, reject) => {
                sqliteManager.db.all("PRAGMA table_info(projects);", (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            if (projectColumns.length > 0) {
                console.log('Columns:');
                projectColumns.forEach(col => {
                    console.log(`  - ${col.name} (${col.type}) ${col.pk ? 'PRIMARY KEY' : ''} ${col.notnull ? 'NOT NULL' : ''}`);
                });
            } else {
                console.log('❌ projects table does not exist');
            }
        } catch (err) {
            console.log(`❌ Error checking projects: ${err.message}`);
        }

        sqliteManager.db.close();

    } catch (error) {
        console.error('❌ Database inspection failed:', error.message);
    }
}

if (require.main === module) {
    inspectDatabase();
}

module.exports = { inspectDatabase };