#!/usr/bin/env node
/**
 * LonicFLex Project Operations CLI
 * Unified interface for all project lifecycle operations
 *
 * Consolidates functionality from 6 previous project-save implementations:
 * - project-save.js (comprehensive state preservation)
 * - project-save-implementation.js (ServiceContainer integration)
 * - project-save-reorganization.js (reorganization milestones)
 * - project-save-script.js (database integration)
 * - project-save-system.js (enterprise context preservation)
 * - simple-project-save.js (lightweight operations)
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const { ProjectLifecycleManager } = require('../src/core/project-lifecycle-manager');
const { Factor3ContextManager, CONTEXT_SCOPES } = require('../src/context-management/factor3-context-manager');

class ProjectOperationsCLI {
    constructor() {
        this.projectManager = null;
        this.contextManager = null;
    }

    async initialize() {
        // Initialize project lifecycle manager (uses ServiceContainer)
        this.projectManager = new ProjectLifecycleManager();
        await this.projectManager.initialize();

        // Initialize context manager for state preservation
        this.contextManager = new Factor3ContextManager();

        console.log('✅ LonicFLex Project Operations CLI initialized');
    }

    async saveProject(projectName, options = {}) {
        console.log(`💾 Saving project: ${projectName}`);
        console.log('='.repeat(50));

        try {
            // Use project lifecycle manager for comprehensive save
            const saveResult = await this.projectManager.saveProjectState({
                projectName,
                importance: options.importance || 9,
                milestone: options.milestone || 'development-checkpoint',
                preserveContext: true,
                ...options
            });

            // Also create Factor3 context preservation
            const contextId = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}_${Date.now()}`;
            await this.contextManager.saveContext(contextId, {
                project: projectName,
                phase: options.phase || 'active-development',
                preservation_level: options.importance || 9,
                context_scope: CONTEXT_SCOPES.PROJECT,
                metadata: {
                    saved_at: new Date().toISOString(),
                    cli_operation: true,
                    consolidated_implementation: true
                }
            });

            console.log(`✅ Project saved successfully`);
            console.log(`   Context ID: ${contextId}`);
            console.log(`   Preservation Level: ${options.importance || 9}/10`);
            return { success: true, contextId, saveResult };

        } catch (error) {
            console.error(`❌ Project save failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async resumeProject(contextId) {
        console.log(`🔄 Resuming project: ${contextId}`);
        console.log('='.repeat(50));

        try {
            // Load context using Factor3 context manager
            const context = await this.contextManager.loadContext(contextId);

            // Use project lifecycle manager to resume
            const resumeResult = await this.projectManager.resumeProject(contextId, context);

            console.log(`✅ Project resumed successfully`);
            console.log(`   Project: ${context.project || 'Unknown'}`);
            console.log(`   Phase: ${context.phase || 'Unknown'}`);
            return { success: true, context, resumeResult };

        } catch (error) {
            console.error(`❌ Project resume failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async listProjects() {
        console.log('📋 LonicFLex Projects');
        console.log('='.repeat(50));

        try {
            // Get projects from lifecycle manager
            const projects = await this.projectManager.listProjects();

            if (projects.length === 0) {
                console.log('No saved projects found');
                return { success: true, projects: [] };
            }

            projects.forEach((project, index) => {
                console.log(`${index + 1}. ${project.name}`);
                console.log(`   Status: ${project.status}`);
                console.log(`   Last Updated: ${project.updated_at || 'Unknown'}`);
                console.log(`   Context ID: ${project.context_id || 'N/A'}`);
                console.log('');
            });

            return { success: true, projects };

        } catch (error) {
            console.error(`❌ Failed to list projects: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    displayHelp() {
        console.log('LonicFLex Project Operations CLI');
        console.log('='.repeat(50));
        console.log('Usage: node scripts/project-operations.js <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  save <project-name>     Save current project state');
        console.log('  resume <context-id>     Resume saved project');
        console.log('  list                    List all saved projects');
        console.log('  help                    Show this help message');
        console.log('');
        console.log('Options for save:');
        console.log('  --importance <1-10>     Set preservation importance (default: 9)');
        console.log('  --phase <phase>         Set project phase (default: active-development)');
        console.log('  --milestone <name>      Set milestone name (default: development-checkpoint)');
        console.log('');
        console.log('Examples:');
        console.log('  node scripts/project-operations.js save "my-project"');
        console.log('  node scripts/project-operations.js save "my-project" --importance 10 --phase production');
        console.log('  node scripts/project-operations.js resume my-project_1234567890');
        console.log('  node scripts/project-operations.js list');
    }

    async cleanup() {
        if (this.projectManager) {
            await this.projectManager.cleanup();
        }
        console.log('🧹 Project Operations CLI cleanup completed');
    }
}

// CLI Interface
async function main() {
    const cli = new ProjectOperationsCLI();

    try {
        await cli.initialize();

        const args = process.argv.slice(2);
        if (args.length === 0) {
            cli.displayHelp();
            return;
        }

        const command = args[0].toLowerCase();

        switch (command) {
            case 'save':
                if (args.length < 2) {
                    console.error('❌ Project name required for save command');
                    cli.displayHelp();
                    return;
                }

                const projectName = args[1];
                const options = {};

                // Parse options
                for (let i = 2; i < args.length; i += 2) {
                    const flag = args[i];
                    const value = args[i + 1];

                    switch (flag) {
                        case '--importance':
                            options.importance = parseInt(value) || 9;
                            break;
                        case '--phase':
                            options.phase = value;
                            break;
                        case '--milestone':
                            options.milestone = value;
                            break;
                    }
                }

                await cli.saveProject(projectName, options);
                break;

            case 'resume':
                if (args.length < 2) {
                    console.error('❌ Context ID required for resume command');
                    cli.displayHelp();
                    return;
                }

                await cli.resumeProject(args[1]);
                break;

            case 'list':
                await cli.listProjects();
                break;

            case 'help':
                cli.displayHelp();
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                cli.displayHelp();
        }

    } catch (error) {
        console.error(`❌ CLI Error: ${error.message}`);
    } finally {
        await cli.cleanup();
    }
}

// Only run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { ProjectOperationsCLI };