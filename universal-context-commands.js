#!/usr/bin/env node

/**
 * Universal Context Command System - Phase 2B
 * Unified interface for /start, /save, /resume commands
 * Works with both sessions and projects seamlessly
 */

const { Factor3ContextManager, CONTEXT_SCOPES } = require('./factor3-context-manager');
const { ContextScopeManager, SCOPE_TYPES } = require('./context-management/context-scope-manager');
const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SimplifiedExternalCoordinator } = require('./external-integrations/simplified-external-coordinator');
const path = require('path');
const fs = require('fs').promises;

class UniversalContextCommands {
    constructor(options = {}) {
        this.baseDir = options.baseDir || process.cwd();
        this.scopeManager = new ContextScopeManager(options);
        this.multiAgentCore = null;
        
        // Phase 3A: External System Integration
        this.externalCoordinator = null;
        this.externalIntegrationConfig = options.externalIntegration || {
            enableGitHub: true,
            enableSlack: true,
            parallelExecution: true,
            github: {
                autoCreateBranch: true,
                autoCreatePR: false
            },
            slack: {
                autoCreateChannel: false,
                autoNotifyChannel: true,
                richFormatting: true
            }
        };
        
        // Command registry
        this.commands = {
            start: this.startCommand.bind(this),
            save: this.saveCommand.bind(this),
            resume: this.resumeCommand.bind(this),
            list: this.listCommand.bind(this),
            switch: this.switchCommand.bind(this),
            upgrade: this.upgradeCommand.bind(this),
            status: this.statusCommand.bind(this)
        };
    }

    /**
     * Parse command arguments
     */
    parseCommand(args) {
        const command = args[0];
        const contextName = args[1];
        const flags = {};
        const positional = [];

        for (let i = 2; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const [key, value] = arg.substring(2).split('=');
                flags[key] = value || true;
            } else {
                positional.push(arg);
            }
        }

        return {
            command,
            contextName,
            flags,
            positional,
            rawArgs: args
        };
    }

    /**
     * /start command - Universal context creation/resumption
     */
    async startCommand(parsedCmd) {
        const { contextName, flags } = parsedCmd;

        if (!contextName) {
            throw new Error('Context name is required. Usage: /start <context-name> [--session|--project] [--goal="..."]');
        }

        // Check if context already exists
        const existingContext = Factor3ContextManager.getContextById(contextName);
        if (existingContext) {
            return await this.resumeExistingContext(contextName);
        }

        // Detect scope or use explicit flag
        let scopeType = 'session'; // Default
        if (flags.project) {
            scopeType = 'project';
        } else if (flags.session) {
            scopeType = 'session';
        } else {
            // Auto-detect optimal scope
            const detection = this.scopeManager.detectOptimalScope({
                goal: flags.goal,
                vision: flags.vision,
                expectedDuration: flags.duration,
                complexity: flags.complexity === 'high' ? 'high' : 'medium',
                hasExternalDependencies: !!flags['external-deps'],
                requiresIdentity: !!flags.identity
            });

            scopeType = detection.suggested_scope;
            
            if (detection.confidence !== 'high') {
                console.log(`🤖 Auto-detected scope: ${scopeType} (confidence: ${detection.confidence})`);
                console.log(`💡 Reasons: ${detection.reasons.join(', ')}`);
                console.log(`⚡ Use --session or --project to override`);
            }
        }

        // Create new context
        return await this.createNewContext(contextName, scopeType, flags);
    }

    /**
     * Create new context (session or project)
     */
    async createNewContext(contextName, scopeType, flags) {
        // Initialize multi-agent system if needed
        if (!this.multiAgentCore) {
            this.multiAgentCore = new MultiAgentCore();
            await this.multiAgentCore.initialize();
        }

        // Phase 3A: Initialize external system coordination
        if (!this.externalCoordinator) {
            console.log('🚀 Initializing external system integration...');
            this.externalCoordinator = new SimplifiedExternalCoordinator(this.externalIntegrationConfig);
            await this.externalCoordinator.initialize();
        }

        // Create context
        const context = Factor3ContextManager.createContext({
            contextScope: scopeType,
            contextId: contextName
        });

        // Set up initial task
        const initialTask = flags.goal || `Working on ${contextName}`;
        context.setCurrentTask(initialTask);

        // Create PROJECT.md for projects
        if (scopeType === 'project') {
            await this.createProjectIdentity(contextName, flags);
        }

        // Phase 3A: Set up external systems (GitHub branches, Slack notifications)
        const contextData = {
            contextId: contextName,
            contextType: scopeType,
            task: initialTask,
            metadata: {
                description: flags.description || flags.goal,
                requirements: flags.requirements,
                complexity: flags.complexity,
                duration: flags.duration,
                vision: flags.vision,
                createdBy: 'Universal-Context-System'
            }
        };

        try {
            console.log('🔧 Setting up external systems...');
            const externalResult = await this.externalCoordinator.onContextCreated(contextData);
            
            // Log external system setup results
            if (externalResult.github?.githubResources?.length > 0) {
                console.log(`✅ GitHub resources created: ${externalResult.github.githubResources.length}`);
                externalResult.github.githubResources.forEach(resource => {
                    console.log(`   ${resource.type}: ${resource.name || resource.number} - ${resource.url}`);
                });
            }
            
            if (externalResult.slack?.notifications?.length > 0) {
                console.log(`📢 Slack notifications sent: ${externalResult.slack.notifications.length}`);
            }
            
            if (externalResult.summary.errors.length > 0) {
                console.log(`⚠️ External system errors: ${externalResult.summary.errors.length}`);
                externalResult.summary.errors.forEach(error => console.log(`   ${error}`));
            }
            
            // Store external resources in context
            context.addEvent('external_systems_setup', {
                github: externalResult.github,
                slack: externalResult.slack,
                totalResources: externalResult.summary.totalResources,
                errors: externalResult.summary.errors
            });
            
        } catch (error) {
            console.error('❌ External system setup failed:', error.message);
            // Continue without external systems - not a blocking error
            context.addEvent('external_systems_error', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }

        // Start multi-agent session if needed
        if (flags.agents) {
            await this.startMultiAgentSession(contextName, scopeType, flags);
        }

        // Log context creation
        context.addImportantEvent('context_created', {
            context_id: contextName,
            scope: scopeType,
            goal: flags.goal,
            vision: flags.vision,
            created_via: 'start_command'
        }, 8);

        return this.formatStartResponse(contextName, scopeType, true, {
            goal: flags.goal,
            vision: flags.vision,
            initial_task: initialTask
        });
    }

    /**
     * Resume existing context
     */
    async resumeExistingContext(contextName) {
        const context = Factor3ContextManager.getContextById(contextName);
        if (!context) {
            throw new Error(`Context '${contextName}' not found`);
        }

        // Generate context summary for resumption
        const summary = JSON.parse(context.generateContextSummary());
        
        // Log resumption
        context.addEvent('context_resumed', {
            context_id: contextName,
            resumed_at: Date.now(),
            events_preserved: summary.compressed_events,
            compression_ratio: summary.compression_ratio
        });

        // Inject context for resumption (this would integrate with Claude Code)
        const resumptionContext = await this.generateResumptionContext(context, summary);

        return this.formatResumeResponse(contextName, context.contextScope, summary, resumptionContext);
    }

    /**
     * /save command - Save current context state
     */
    async saveCommand(parsedCmd) {
        const { contextName, flags } = parsedCmd;

        // Determine context to save
        let targetContextId = contextName;
        if (!targetContextId) {
            // Use current active context if available
            const allContexts = Factor3ContextManager.getAllActiveContexts();
            if (allContexts.length === 1) {
                targetContextId = allContexts[0].id;
            } else {
                throw new Error('Multiple contexts active. Please specify: /save <context-name>');
            }
        }

        const context = Factor3ContextManager.getContextById(targetContextId);
        if (!context) {
            throw new Error(`Context '${targetContextId}' not found`);
        }

        // Save context state
        const saveResult = await this.saveContextState(context, flags);

        // Handle pause if requested
        if (flags.pause) {
            await this.pauseContext(context);
        }

        return this.formatSaveResponse(targetContextId, context.contextScope, saveResult, flags);
    }

    /**
     * /resume command - Resume specific context
     */
    async resumeCommand(parsedCmd) {
        const { contextName } = parsedCmd;

        if (!contextName) {
            // List available contexts if none specified
            return await this.listCommand(parsedCmd);
        }

        return await this.resumeExistingContext(contextName);
    }

    /**
     * /list command - Show all active contexts
     */
    async listCommand(parsedCmd) {
        const { flags } = parsedCmd;
        const allContexts = Factor3ContextManager.getAllActiveContexts();

        if (allContexts.length === 0) {
            return {
                message: '📭 No active contexts found',
                suggestion: 'Use /start <context-name> to create your first context'
            };
        }

        // Group by scope
        const sessions = allContexts.filter(c => c.scope === 'session');
        const projects = allContexts.filter(c => c.scope === 'project');

        const response = {
            message: `📋 Active Contexts (${allContexts.length} total)`,
            sessions: sessions.map(this.formatContextSummary),
            projects: projects.map(this.formatContextSummary),
            commands: {
                resume: '/resume <context-name>',
                save: '/save <context-name>',
                switch: '/switch <context-name>'
            }
        };

        if (flags.detailed) {
            response.detailed = await this.getDetailedContextList(allContexts);
        }

        return response;
    }

    /**
     * /switch command - Switch between active contexts
     */
    async switchCommand(parsedCmd) {
        const { contextName } = parsedCmd;

        if (!contextName) {
            throw new Error('Context name required. Usage: /switch <context-name>');
        }

        const context = Factor3ContextManager.getContextById(contextName);
        if (!context) {
            throw new Error(`Context '${contextName}' not found`);
        }

        // Generate switch context
        const summary = JSON.parse(context.generateContextSummary());
        const switchContext = await this.generateResumptionContext(context, summary);

        // Log context switch
        context.addEvent('context_switched', {
            switched_to: contextName,
            at: Date.now(),
            from_external: true
        });

        return {
            message: `🔄 Switched to ${context.contextScope}: ${contextName}`,
            context: switchContext,
            current_task: context.currentTask,
            scope: context.contextScope,
            events_count: context.events.length,
            stack_depth: context.contextStack.length
        };
    }

    /**
     * /upgrade command - Upgrade session to project
     */
    async upgradeCommand(parsedCmd) {
        const { contextName, flags } = parsedCmd;

        if (!contextName) {
            throw new Error('Context name required. Usage: /upgrade <context-name> --to-project --goal="..."');
        }

        if (!flags['to-project']) {
            throw new Error('Only session → project upgrades supported. Use --to-project flag');
        }

        const context = Factor3ContextManager.getContextById(contextName);
        if (!context) {
            throw new Error(`Context '${contextName}' not found`);
        }

        if (context.contextScope === 'project') {
            throw new Error('Context is already a project');
        }

        // Validate upgrade requirements
        const validation = this.scopeManager.validateScopeUpgrade('session', 'project', {
            goal: flags.goal,
            vision: flags.vision
        });

        if (!validation.valid) {
            throw new Error(`Upgrade validation failed: ${validation.error}`);
        }

        // Perform upgrade
        const upgradeResult = context.upgradeToProject({
            reason: flags.reason || 'Manual upgrade via command',
            goal: flags.goal,
            vision: flags.vision
        });

        // Create PROJECT.md
        await this.createProjectIdentity(contextName, flags);

        return {
            message: `⬆️ Upgraded ${contextName} from session to project`,
            upgrade_result: upgradeResult,
            benefits: validation.upgrade_benefits,
            project_created: true
        };
    }

    /**
     * /status command - Show current context status
     */
    async statusCommand(parsedCmd) {
        const allContexts = Factor3ContextManager.getAllActiveContexts();
        
        if (allContexts.length === 0) {
            return { message: '📭 No active contexts' };
        }

        const stats = {
            total_contexts: allContexts.length,
            sessions: allContexts.filter(c => c.scope === 'session').length,
            projects: allContexts.filter(c => c.scope === 'project').length,
            total_events: allContexts.reduce((sum, c) => sum + c.events_count, 0)
        };

        // Get detailed stats for each context
        const contextDetails = [];
        for (const contextInfo of allContexts) {
            const context = Factor3ContextManager.getContextById(contextInfo.id);
            if (context) {
                const compressionStats = context.getCompressionStats();
                contextDetails.push({
                    id: contextInfo.id,
                    scope: contextInfo.scope,
                    current_task: contextInfo.current_task,
                    events: contextInfo.events_count,
                    stack_depth: contextInfo.stack_depth,
                    compression: `${(compressionStats.compression_ratio * 100)}%`,
                    token_savings: compressionStats.estimated_token_savings
                });
            }
        }

        return {
            message: '📊 Universal Context System Status',
            statistics: stats,
            contexts: contextDetails,
            system_health: 'operational'
        };
    }

    /**
     * Helper: Create PROJECT.md for project contexts
     */
    async createProjectIdentity(contextName, flags) {
        const projectInfo = {
            contextId: contextName,
            name: flags.name || contextName,
            goal: flags.goal || 'Define project goal',
            vision: flags.vision || 'Define project vision',
            context: flags.context || 'Provide project context',
            requirements: flags.requirements ? flags.requirements.split(',') : [],
            success_criteria: flags.criteria ? flags.criteria.split(',') : []
        };

        return await this.scopeManager.createProjectIdentity(contextName, projectInfo);
    }

    /**
     * Helper: Save context state with compression
     */
    async saveContextState(context, flags) {
        const summary = JSON.parse(context.generateContextSummary());
        const compressionStats = context.getCompressionStats();

        // Add save event
        context.addImportantEvent('context_saved', {
            saved_at: Date.now(),
            events_count: summary.total_events,
            compression_ratio: summary.compression_ratio,
            status: flags.status,
            importance: flags.important ? 9 : 5,
            note: flags.note
        }, flags.important ? 9 : 6);

        return {
            events_preserved: summary.compressed_events,
            compression_ratio: summary.compression_ratio,
            compression_stats: compressionStats,
            status: flags.status,
            importance: flags.important ? 'high' : 'normal'
        };
    }

    /**
     * Helper: Generate context for resumption
     */
    async generateResumptionContext(context, summary) {
        const recentEvents = summary.recent_events.slice(-5);
        const importantEvents = summary.recent_events.filter(e => e.importance >= 8);

        return {
            context_id: context.contextId,
            scope: context.contextScope,
            current_task: context.currentTask,
            recent_activity: recentEvents,
            important_events: importantEvents,
            context_stack: context.contextStack,
            summary: `Context: ${context.contextScope} '${context.contextId}' - ${context.currentTask || 'No current task'}`
        };
    }

    /**
     * Helper: Format context summary for list display
     */
    formatContextSummary(contextInfo) {
        return {
            id: contextInfo.id,
            scope: contextInfo.scope,
            task: contextInfo.current_task || 'No current task',
            events: contextInfo.events_count,
            stack: contextInfo.stack_depth,
            last_active: contextInfo.last_activity ? 
                new Date(contextInfo.last_activity).toISOString() : 'Unknown'
        };
    }

    /**
     * Response formatters
     */
    formatStartResponse(contextName, scopeType, isNew, details) {
        const response = {
            message: `${isNew ? '🚀' : '🔄'} ${isNew ? 'Started' : 'Resumed'} ${scopeType}: ${contextName}`,
            context_id: contextName,
            scope: scopeType,
            is_new: isNew
        };

        if (details.goal) response.goal = details.goal;
        if (details.vision) response.vision = details.vision;
        if (details.initial_task) response.current_task = details.initial_task;

        return response;
    }

    formatResumeResponse(contextName, scopeType, summary, resumptionContext) {
        return {
            message: `🔄 Resumed ${scopeType}: ${contextName}`,
            context_id: contextName,
            scope: scopeType,
            current_task: resumptionContext.current_task,
            events_preserved: summary.compressed_events,
            compression_ratio: `${(summary.compression_ratio * 100)}%`,
            context: resumptionContext.summary,
            last_activity: summary.recent_events.length > 0 ? 
                summary.recent_events[summary.recent_events.length - 1].timestamp : null
        };
    }

    formatSaveResponse(contextName, scopeType, saveResult, flags) {
        const response = {
            message: `💾 Saved ${scopeType}: ${contextName}`,
            context_id: contextName,
            scope: scopeType,
            events_preserved: saveResult.events_preserved,
            compression_ratio: `${(saveResult.compression_ratio * 100)}%`,
            token_savings: saveResult.compression_stats.estimated_token_savings
        };

        if (flags.status) response.status = flags.status;
        if (flags.important) response.importance = 'high';
        if (flags.pause) response.paused = true;

        return response;
    }

    /**
     * Execute command
     */
    async executeCommand(args) {
        try {
            const parsedCmd = this.parseCommand(args);
            
            if (!this.commands[parsedCmd.command]) {
                throw new Error(`Unknown command: ${parsedCmd.command}. Available: ${Object.keys(this.commands).join(', ')}`);
            }

            return await this.commands[parsedCmd.command](parsedCmd);
        } catch (error) {
            return {
                error: true,
                message: error.message,
                usage: this.getUsageHelp()
            };
        }
    }

    /**
     * Get usage help
     */
    getUsageHelp() {
        return {
            commands: {
                start: '/start <name> [--session|--project] [--goal="..."] [--vision="..."]',
                save: '/save [<name>] [--status="..."] [--important] [--pause]',
                resume: '/resume [<name>]',
                list: '/list [--detailed]',
                switch: '/switch <name>',
                upgrade: '/upgrade <name> --to-project --goal="..." [--vision="..."]',
                status: '/status'
            },
            examples: [
                '/start fix-auth-bug --session',
                '/start new-auth-system --project --goal="Build secure authentication"',
                '/save fix-auth-bug --status="Fixed JWT expiration"',
                '/upgrade fix-auth-bug --to-project --goal="Complete auth redesign"'
            ]
        };
    }
}

module.exports = { UniversalContextCommands };

// CLI execution if run directly
if (require.main === module) {
    const commands = new UniversalContextCommands();
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Universal Context Command System');
        console.log('Usage: node universal-context-commands.js <command> [args...]');
        console.log(JSON.stringify(commands.getUsageHelp(), null, 2));
        process.exit(0);
    }

    commands.executeCommand(args)
        .then(result => {
            console.log(JSON.stringify(result, null, 2));
            process.exit(result.error ? 1 : 0);
        })
        .catch(error => {
            console.error('Command execution failed:', error.message);
            process.exit(1);
        });
}