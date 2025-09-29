// demo-clean.js - Database demo that actually exits cleanly
console.log("🚀 LonicFLex Clean Demo Starting...");

// Import only what we need, disable monitoring
process.env.DISABLE_CONTEXT_MONITORING = 'true';

const { SQLiteManager } = require('./src/database/sqlite-manager');

async function demo() {
    try {
        // Create database with monitoring disabled
        const db = new SQLiteManager();

        // Override context manager to disable monitoring
        if (db.contextManager && db.contextManager.monitor) {
            db.contextManager.monitor.stopMonitoring();
        }

        await db.initialize();
        console.log("✅ Database initialized!");

        // Do ONE simple query
        const result = await db.run("SELECT datetime('now') as time");
        console.log("📅 Current time from DB:", result);

        await db.close();
        console.log("✅ Demo complete - exits cleanly!");

        // Force clean exit
        process.exit(0);

    } catch (error) {
        console.error("❌ Demo failed:", error.message);
        process.exit(1);
    }
}

demo();