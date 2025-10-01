// demo.js - The simplest thing that could possibly work
console.log("🚀 LonicFLex Demo Starting...");

const { SQLiteManager } = require('./src/database/sqlite-manager');

async function demo() {
    try {
        // Just test if database works
        const db = new SQLiteManager();
        await db.initialize();

        console.log("✅ Database initialized!");

        // Do ONE simple query
        const result = await db.run("SELECT datetime('now') as time");
        console.log("📅 Current time from DB:", result);

        await db.close();
        console.log("✅ Demo complete - something actually worked!");
        process.exit(0);

    } catch (error) {
        console.error("❌ Demo failed:", error.message);
        process.exit(1);
    }
}

demo();