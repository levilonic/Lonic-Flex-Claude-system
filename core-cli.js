#!/usr/bin/env node
/**
 * Core CLI - Simple command interface without scaffolding
 * Direct access to working functionality
 */

const { CommandExecutor } = require('./src/core/command-executor');

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        showHelp();
        process.exit(0);
    }

    const command = args[0];
    const params = parseParams(args.slice(1));

    const executor = new CommandExecutor();

    try {
        console.log(`\n🚀 Executing: ${command}`);
        console.log(`📋 Parameters:`, JSON.stringify(params, null, 2));
        console.log('');

        const result = await executor.execute(command, params);

        console.log('✅ Success!');
        console.log('📊 Result:', JSON.stringify(result.result, null, 2));
        console.log('');

        await executor.shutdown();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('');
        await executor.shutdown();
        process.exit(1);
    }
}

function parseParams(args) {
    const params = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[i + 1];

            if (value && !value.startsWith('--')) {
                // Try to parse as number
                if (!isNaN(value)) {
                    params[key] = Number(value);
                } else {
                    params[key] = value;
                }
                i++; // Skip next arg
            } else {
                params[key] = true; // Flag without value
            }
        }
    }

    return params;
}

function showHelp() {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  LonicFLex Core CLI v1.0                        ║
║           Simple Commands - Real Functionality                  ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node core-cli.js <command> [--param value]

GITHUB COMMANDS:
  gh:list-prs                    List open pull requests
  gh:review-pr --prNumber 123    Review specific PR
  gh:get-files                   List repository files

DATABASE COMMANDS:
  db:status                      Show database status
  db:query --sql "SELECT * FROM sessions LIMIT 5"

WORKFLOW COMMANDS:
  workflow:list                  List available workflows
  workflow:run --workflow pr-review --input 123

SYSTEM COMMANDS:
  system:health                  Check system health
  system:info                    Show system information

EXAMPLES:
  node core-cli.js gh:list-prs
  node core-cli.js gh:review-pr --prNumber 123
  node core-cli.js workflow:run --workflow pr-review --input 123
  node core-cli.js system:health
  node core-cli.js db:status

ENVIRONMENT:
  GITHUB_TOKEN    GitHub API token (optional, uses mock mode if not set)

`);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main };