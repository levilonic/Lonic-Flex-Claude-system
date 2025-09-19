#!/usr/bin/env node
/**
 * Quick database schema fix for Window 3 services
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'multi-agent-coordination.db');
const db = new sqlite3.Database(dbPath);

async function fixDatabaseSchema() {
    console.log('🔧 Fixing database schema conflicts...');

    const alterQueries = [
        `ALTER TABLE governance_policies ADD COLUMN category TEXT DEFAULT 'general'`,
        `ALTER TABLE workflow_permissions ADD COLUMN workflow_category TEXT DEFAULT 'standard'`
    ];

    for (const query of alterQueries) {
        await new Promise((resolve, reject) => {
            db.run(query, function(err) {
                if (err) {
                    if (err.message.includes('duplicate column name')) {
                        console.log('✅ Column already exists');
                        resolve();
                    } else {
                        console.error('❌ Error adding column:', err);
                        reject(err);
                    }
                } else {
                    console.log('✅ Added column:', query);
                    resolve();
                }
            });
        });
    }
}

async function verifySchema() {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(governance_policies)", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                console.log('📋 Current governance_policies schema:');
                rows.forEach(column => {
                    console.log(`  ${column.name}: ${column.type}`);
                });
                resolve(rows);
            }
        });
    });
}

async function main() {
    try {
        await verifySchema();
        await fixDatabaseSchema();
        await verifySchema();
        console.log('✅ Database schema fix completed!');
    } catch (error) {
        console.error('❌ Database fix failed:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

main();