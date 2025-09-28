#!/usr/bin/env node

/**
 * CLI Project List Command for LonicFLex
 * Integrates with the existing command system and provides the /project-list interface
 */

const { ProjectListCommand } = require('./project-list-command');
const { UniversalContextCommands } = require('./universal-context-commands');

/**
 * Enhanced Project List Command with LonicFLex Universal Context integration
 */
class CLIProjectList {
    constructor() {
        this.projectListCommand = new ProjectListCommand();
        this.contextCommands = new UniversalContextCommands();
    }

    /**
     * Execute /project-list command with full LonicFLex integration
     */
    async execute(args = []) {
        try {
            // Parse command: /project-list [options]
            const parsedArgs = this.parseProjectListArgs(args);
            
            // Check if we need to show help
            if (parsedArgs.help) {
                this.showHelp();
                return { success: this.validateSuccess() };
            }

            // Execute the project list command
            console.log('🔍 Loading project windows...\n');
            const result = await this.projectListCommand.execute(parsedArgs.flags);

            if (result.success) {
                // Add integration hints with Universal Context system
                this.showIntegrationHints(result);
            }

            return result;

        } catch (error) {
            console.error('❌ /project-list command failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Parse /project-list command arguments
     */
    parseProjectListArgs(args) {
        // Handle both "/project-list" and "project-list" formats
        let cleanArgs = args;
        if (args[0] === '/project-list' || args[0] === 'project-list') {
            cleanArgs = args.slice(1);
        }

        const flags = [];
        let help = false;

        for (const arg of cleanArgs) {
            if (arg === '--help' || arg === '-h') {
                help = true;
            } else {
                flags.push(arg);
            }
        }

        return { flags, help };
    }

    /**
     * Show help for /project-list command
     */
    showHelp() {
        console.log(`
📋 /project-list - View All Project Windows

DESCRIPTION:
  Display all available project windows with their status, recent activity, 
  and resumption information using the LonicFLex Universal Context System.

USAGE:
  /project-list [OPTIONS]

OPTIONS:
  --active              Show only active projects
  --paused              Show only paused projects  
  --completed           Show only completed projects
  --archived            Show only archived projects
  --recent <N>          Show only the N most recent projects (default: 10)
  --verbose, --detailed Use detailed view instead of compact table
  --help, -h            Show this help message

EXAMPLES:
  /project-list                    # Show all projects (compact view)
  /project-list --active           # Show only active projects
  /project-list --recent 5         # Show 5 most recent projects
  /project-list --detailed         # Show detailed information
  /project-list --paused --verbose # Show paused projects with details

INTEGRATION:
  The project list integrates with the LonicFLex Universal Context System:
  • Projects preserve context across Claude sessions
  • Session and project scopes maintain separate workflows
  • External integrations (GitHub branches, Slack notifications)
  • Long-term persistence for 3+ month context survival

RELATED COMMANDS:
  /project-start <name> --resume   # Resume a project from the list
  /project-save                    # Save current project state
  /project-pause                   # Pause current project
  /status                          # Show Universal Context System status

For more information: /help universal-context-system
`);
    }

    /**
     * Show integration hints after successful project listing
     */
    showIntegrationHints(result) {
        if (result.count === 0) {
            console.log(`
💡 Getting Started with LonicFLex Project Windows:

1. Create your first project:
   /project-start my-project --project --goal="Build something amazing"

2. Create quick sessions:
   /project-start bug-fix --session --goal="Fix authentication issue"

3. Resume existing work:
   /project-start my-project --resume

📖 Learn more: /help project-windows
`);
            return;
        }

        console.log(`
🚀 Quick Actions:
   • Resume any project: /project-start <name> --resume
   • Save current state: /project-save --status="Progress update"  
   • Check system health: /status
   • View context details: /list --detailed

🔧 Universal Context Features:
   • ✅ Cross-session context preservation
   • ✅ Multi-project workspace support
   • ✅ External system integration (GitHub + Slack)
   ${result.count > 0 ? `• 📊 Managing ${result.count} project windows` : ''}

💾 Context Survival: Sessions survive Claude restarts • Projects survive 3+ months
`);
    }
}

/**
 * Main CLI function
 */
async function main() {
    const args = process.argv.slice(2);
    
    // Create and execute CLI command
    const cli = new CLIProjectList();
    const result = await cli.execute(args);
    
    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
}

// Export for testing and module use
module.exports = { CLIProjectList };

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ CLI execution failed:', error.message);
        process.exit(1);
    });
}