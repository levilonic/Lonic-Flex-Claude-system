#!/usr/bin/env node
/**
 * Core API Server - Simple REST API without scaffolding
 * Direct access to working functionality via HTTP
 */

const express = require('express');
const { CommandExecutor } = require('./src/core/command-executor');

const app = express();
const PORT = process.env.CORE_API_PORT || 3000;

// Middleware
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Initialize command executor
const executor = new CommandExecutor();
let initialized = false;

async function ensureInitialized() {
    if (!initialized) {
        await executor.initialize();
        initialized = true;
    }
}

// ========================================
// Routes
// ========================================

// Health check
app.get('/health', async (req, res) => {
    try {
        await ensureInitialized();
        const result = await executor.execute('system:health');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// System info
app.get('/info', async (req, res) => {
    try {
        await ensureInitialized();
        const result = await executor.execute('system:info');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List all commands
app.get('/commands', async (req, res) => {
    try {
        await ensureInitialized();
        const commands = executor.listCommands();
        res.json({ commands, count: commands.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Execute any command via POST
app.post('/execute', async (req, res) => {
    try {
        const { command, params } = req.body;

        if (!command) {
            return res.status(400).json({ error: 'command parameter required' });
        }

        await ensureInitialized();
        const result = await executor.execute(command, params || {});
        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// Convenience endpoints
// ========================================

// GitHub: List PRs
app.get('/github/prs', async (req, res) => {
    try {
        await ensureInitialized();
        const result = await executor.execute('gh:list-prs');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GitHub: Review PR
app.post('/github/review/:prNumber', async (req, res) => {
    try {
        const prNumber = parseInt(req.params.prNumber);
        await ensureInitialized();
        const result = await executor.execute('gh:review-pr', { prNumber });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Database: Status
app.get('/database/status', async (req, res) => {
    try {
        await ensureInitialized();
        const result = await executor.execute('db:status');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Workflows: List
app.get('/workflows', async (req, res) => {
    try {
        await ensureInitialized();
        const result = await executor.execute('workflow:list');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Workflows: Run
app.post('/workflows/run', async (req, res) => {
    try {
        const { workflow, input } = req.body;

        if (!workflow) {
            return res.status(400).json({ error: 'workflow parameter required' });
        }

        await ensureInitialized();
        const result = await executor.execute('workflow:run', { workflow, input });
        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Root - API documentation
app.get('/', (req, res) => {
    res.json({
        name: 'LonicFLex Core API',
        version: '1.0.0',
        description: 'Simple REST API for core functionality',
        endpoints: {
            health: 'GET /health',
            info: 'GET /info',
            commands: 'GET /commands',
            execute: 'POST /execute',
            github: {
                listPRs: 'GET /github/prs',
                reviewPR: 'POST /github/review/:prNumber'
            },
            database: {
                status: 'GET /database/status'
            },
            workflows: {
                list: 'GET /workflows',
                run: 'POST /workflows/run'
            }
        },
        examples: {
            health: 'curl http://localhost:3000/health',
            listPRs: 'curl http://localhost:3000/github/prs',
            reviewPR: 'curl -X POST http://localhost:3000/github/review/123',
            execute: 'curl -X POST http://localhost:3000/execute -H "Content-Type: application/json" -d \'{"command":"system:info"}\'',
            runWorkflow: 'curl -X POST http://localhost:3000/workflows/run -H "Content-Type: application/json" -d \'{"workflow":"pr-review","input":123}\''
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await executor.shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully...');
    await executor.shutdown();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║               LonicFLex Core API Server v1.0                    ║
║          Simple REST API - Real Functionality                   ║
╚════════════════════════════════════════════════════════════════╝

Server running on: http://localhost:${PORT}

Try:
  curl http://localhost:${PORT}/health
  curl http://localhost:${PORT}/info
  curl http://localhost:${PORT}/commands
  curl http://localhost:${PORT}/github/prs

For full API documentation:
  curl http://localhost:${PORT}/
`);
});

module.exports = app;