#!/usr/bin/env node

/**
 * Universal Context Command System - Phase 3B
 * Unified interface for /start, /save, /resume commands with long-term persistence
 * Works with sessions and projects seamlessly across 3+ month time gaps
 */

const { Factor3ContextManager, CONTEXT_SCOPES } = require('./factor3-context-manager');
const { ContextScopeManager, SCOPE_TYPES } = require('./context-management/context-scope-manager');
const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SimplifiedExternalCoordinator } = require('./external-integrations/simplified-external-coordinator');
const { LongTermPersistence } = require('./context-management/long-term-persistence');
const { ContextHealthMonitor } = require('./context-management/context-health-monitor');
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
        
        // Phase 3B: Long-Term Persistence System (disabled by default)
        this.longTermPersistence = null;
        this.healthMonitor = null;
        this.persistenceConfig = options.persistence || {
            enableLongTerm: false, // Only enable when explicitly requested
            enableHealthMonitoring: false,
            autoArchive: false,
            backgroundMaintenance: false
        };
        
        // Enhanced command registry with Phase 3B commands
        this.commands = {
            start: this.startCommand.bind(this),
            save: this.saveCommand.bind(this),
            resume: this.resumeCommand.bind(this),
            list: this.listCommand.bind(this),
            switch: this.switchCommand.bind(this),
            upgrade: this.upgradeCommand.bind(this),
            status: this.statusCommand.bind(this),
            // Phase 3B: New long-term persistence commands
            archive: this.archiveCommand.bind(this),
            restore: this.restoreCommand.bind(this),
            health: this.healthCommand.bind(this),
            cleanup: this.cleanupCommand.bind(this)
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

        // Phase 3B: Initialize long-term persistence system
        if (!this.longTermPersistence && this.persistenceConfig.enableLongTerm) {
            console.log('📦 Initializing long-term persistence system...');
            this.longTermPersistence = new LongTermPersistence({
                archiveDir: path.join(this.baseDir, 'contexts', 'long-term')
            });
        }

        // Phase 3B: Initialize health monitoring system
        if (!this.healthMonitor && this.persistenceConfig.enableHealthMonitoring) {
            console.log('🏥 Initializing context health monitoring...');
            this.healthMonitor = new ContextHealthMonitor({
                backgroundMaintenance: this.persistenceConfig.backgroundMaintenance,
                persistence: { archiveDir: path.join(this.baseDir, 'contexts', 'long-term') }
            });
            
            if (this.persistenceConfig.backgroundMaintenance) {
                this.healthMonitor.startBackgroundMaintenance();
            }
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
     * Resume existing context with long-term persistence support
     */
    async resumeExistingContext(contextName) {
        // First check active contexts
        let context = Factor3ContextManager.getContextById(contextName);
        if (context) {
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

        // If not in active registry, try to load from disk
        console.log('🔍 Context not in active registry, scanning disk...');
        context = await this.loadContextFromDisk(contextName);
        if (context) {
            // Context loaded from disk, proceed with resumption
            const summary = JSON.parse(context.generateContextSummary());
            
            // Log resumption from disk
            context.addEvent('context_resumed_from_disk', {
                context_id: contextName,
                resumed_at: Date.now(),
                loaded_from: 'disk',
                events_preserved: summary.compressed_events,
                compression_ratio: summary.compression_ratio
            });

            // Inject context for resumption
            const resumptionContext = await this.generateResumptionContext(context, summary);

            return this.formatResumeResponse(contextName, context.contextScope, summary, resumptionContext);
        }

        // Phase 3B: Check long-term archives if context not active
        if (this.longTermPersistence) {
            console.log('🔍 Context not active, checking long-term archives...');
            
            // Try both session and project scopes
            for (const scope of ['session', 'project']) {
                try {
                    const restoreResult = await this.longTermPersistence.restoreContext(contextName, scope);
                    
                    if (restoreResult.success) {
                        console.log(`✅ Context restored from long-term archive (${scope})`);
                        console.log(`⚡ Time gap: ${Math.floor(restoreResult.timeGap / (24 * 60 * 60 * 1000))} days`);
                        console.log(`🚀 Restore time: ${restoreResult.restoreTime}ms`);
                        
                        // Recreate active context from restored data
                        const restoredContext = Factor3ContextManager.createContext({
                            contextId: contextName,
                            contextScope: scope
                        });
                        
                        // Parse restored context and rebuild events
                        await this.rebuildContextFromArchive(restoredContext, restoreResult.context);
                        
                        return {
                            message: `🔄 Restored from archive: ${scope} ${contextName}`,
                            context_id: contextName,
                            scope: scope,
                            time_gap: `${Math.floor(restoreResult.timeGap / (24 * 60 * 60 * 1000))} days`,
                            restore_time: `${restoreResult.restoreTime}ms`,
                            performance_met: restoreResult.performanceMet,
                            restoration_summary: restoreResult.restorationSummary,
                            recommendations: restoreResult.restorationSummary.recommendations
                        };
                    }
                } catch (error) {
                    // Continue trying other scopes
                }
            }
        }

        throw new Error(`Context '${contextName}' not found in active contexts or long-term archives`);
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

        let context = Factor3ContextManager.getContextById(targetContextId);
        if (!context) {
            // If not in active registry, try to load from disk
            console.log('🔍 Context not in active registry, loading from disk...');
            context = await this.loadContextFromDisk(targetContextId);
            if (!context) {
                throw new Error(`Context '${targetContextId}' not found`);
            }
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
     * Load context from disk and register it in active registry
     */
    async loadContextFromDisk(contextName) {
        const { Factor3ContextManager } = require('./factor3-context-manager');
        
        // Try both project and session scopes
        const scopes = ['project', 'session'];
        
        for (const scopeType of scopes) {
            try {
                const contextPath = this.scopeManager.generateContextPath(contextName, scopeType);
                const projectMdPath = path.join(contextPath, 'PROJECT.md');
                
                // Check if context exists on disk
                try {
                    await fs.access(projectMdPath);
                } catch (error) {
                    continue; // Try next scope
                }
                
                // Read PROJECT.md to get context metadata
                const projectMdContent = await fs.readFile(projectMdPath, 'utf-8');
                
                // Parse basic project info (this is a simple parser)
                const visionMatch = projectMdContent.match(/## Project Vision\s*\n([^\n#]+)/);
                const goalMatch = projectMdContent.match(/## Project Goal\s*\n([^\n#]+)/);
                
                const vision = visionMatch ? visionMatch[1].trim() : '';
                const goal = goalMatch ? goalMatch[1].trim() : '';
                
                // Create new context manager instance with loaded data
                const context = Factor3ContextManager.createContext({
                    contextId: contextName,
                    contextScope: scopeType
                });
                
                // Initialize with loaded metadata
                context.addImportantEvent('context_loaded_from_disk', {
                    context_id: contextName,
                    scope: scopeType,
                    loaded_from: contextPath,
                    vision: vision,
                    goal: goal,
                    loaded_at: Date.now()
                }, 8);
                
                // Set current task based on goal if available
                if (goal && goal !== 'Define project goal') {
                    context.currentTask = goal;
                }
                
                // Register in global registry
                if (!global.LONICFLEX_CONTEXT_REGISTRY) {
                    global.LONICFLEX_CONTEXT_REGISTRY = new Map();
                }
                global.LONICFLEX_CONTEXT_REGISTRY.set(contextName, context);
                
                console.log(`✅ Context '${contextName}' loaded from disk (${scopeType} scope)`);
                return context;
                
            } catch (error) {
                console.log(`⚠️ Could not load context '${contextName}' from ${scopeType} scope: ${error.message}`);
                continue;
            }
        }
        
        return null; // Context not found on disk
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

    /**
     * Phase 3B: /archive command - Manually archive context to long-term storage
     */
    async archiveCommand(parsedCmd) {
        const { contextName, flags } = parsedCmd;

        if (!contextName) {
            throw new Error('Context name is required. Usage: /archive <context-name> [--force]');
        }

        const context = Factor3ContextManager.getContextById(contextName);
        if (!context) {
            throw new Error(`Context '${contextName}' not found`);
        }

        if (!this.longTermPersistence) {
            throw new Error('Long-term persistence not enabled');
        }

        // Get context data for archival
        const contextData = {
            context: context.getCurrentContext(),
            last_activity: Date.now(),
            events_count: context.events.length,
            stack_depth: context.contextStack.length,
            current_task: context.currentTask,
            scope: context.contextScope
        };

        const archiveResult = await this.longTermPersistence.archiveContext(
            contextName, 
            contextData, 
            context.contextScope
        );

        if (archiveResult.success && !flags['keep-active']) {
            // Remove from active contexts after successful archive
            Factor3ContextManager.removeContext(contextName);
        }

        return {
            message: `📦 Archived ${context.contextScope}: ${contextName}`,
            archive_level: archiveResult.archiveLevel,
            compression_ratio: `${(archiveResult.compressionRatio * 100).toFixed(1)}%`,
            archive_time: `${archiveResult.archiveTime}ms`,
            paths: archiveResult.paths,
            active_removed: !flags['keep-active']
        };
    }

    /**
     * Phase 3B: /restore command - Restore context from long-term storage
     */
    async restoreCommand(parsedCmd) {
        const { contextName, flags } = parsedCmd;

        if (!contextName) {
            throw new Error('Context name is required. Usage: /restore <context-name> [--scope=session|project]');
        }

        if (!this.longTermPersistence) {
            throw new Error('Long-term persistence not enabled');
        }

        const scope = flags.scope || 'session';
        
        try {
            const restoreResult = await this.longTermPersistence.restoreContext(contextName, scope);

            // Recreate active context
            const restoredContext = Factor3ContextManager.createContext({
                contextId: contextName,
                contextScope: scope
            });

            await this.rebuildContextFromArchive(restoredContext, restoreResult.context);

            return {
                message: `🔄 Restored ${scope}: ${contextName}`,
                time_gap: `${Math.floor(restoreResult.timeGap / (24 * 60 * 60 * 1000))} days`,
                restore_time: `${restoreResult.restoreTime}ms`,
                performance_met: restoreResult.performanceMet,
                restoration_summary: restoreResult.restorationSummary
            };

        } catch (error) {
            throw new Error(`Failed to restore context: ${error.message}`);
        }
    }

    /**
     * Phase 3B: /health command - Check context health and get recommendations
     */
    async healthCommand(parsedCmd) {
        const { contextName, flags } = parsedCmd;

        if (!this.healthMonitor) {
            throw new Error('Health monitoring not enabled');
        }

        if (!contextName) {
            // Return system health summary
            const healthSummary = await this.healthMonitor.getHealthSummary();
            return {
                message: '🏥 System Health Summary',
                ...healthSummary,
                background_maintenance: this.healthMonitor.maintenanceInterval !== null
            };
        }

        // Check specific context health
        const context = Factor3ContextManager.getContextById(contextName);
        if (!context) {
            throw new Error(`Context '${contextName}' not found`);
        }

        const contextData = {
            context: context.getCurrentContext(),
            last_activity: Date.now(),
            events_count: context.events.length,
            stack_depth: context.contextStack.length,
            current_task: context.currentTask
        };

        const healthMetrics = await this.healthMonitor.calculateHealthScore(contextName, contextData);

        if (flags.maintenance) {
            const maintenanceResult = await this.healthMonitor.performMaintenance(contextName, contextData);
            healthMetrics.maintenance = maintenanceResult;
        }

        return {
            message: `🏥 Health check for ${contextName}`,
            ...healthMetrics,
            maintenance_available: !flags.maintenance
        };
    }

    /**
     * Phase 3B: /cleanup command - Clean up old archives and maintenance
     */
    async cleanupCommand(parsedCmd) {
        const { flags } = parsedCmd;

        if (!this.longTermPersistence) {
            throw new Error('Long-term persistence not enabled');
        }

        const retentionDays = flags['retention-days'] || 365;
        
        // Clean up expired contexts
        const cleanupResult = await this.longTermPersistence.cleanupExpiredContexts(retentionDays);
        
        // Get updated statistics
        const stats = await this.longTermPersistence.getArchiveStatistics();

        return {
            message: '🗑️ Archive cleanup completed',
            cleaned: cleanupResult.count,
            freed_bytes: cleanupResult.freedBytes,
            errors: cleanupResult.errors,
            current_stats: stats,
            retention_days: retentionDays
        };
    }

    /**
     * Helper: Rebuild context from archived XML
     */
    async rebuildContextFromArchive(context, archivedXml) {
        // Parse archived XML and rebuild events
        const eventRegex = /<([^>]+)>(.*?)<\/\1>/gs;
        let match;
        
        while ((match = eventRegex.exec(archivedXml)) !== null) {
            const [fullMatch, tagName, content] = match;
            
            if (tagName === 'workflow_context' || tagName === 'context_restoration') continue;
            
            // Extract timestamp if present
            const timestampMatch = content.match(/timestamp[:\s]*["']([^"']+)["']/);
            
            const eventData = {
                type: tagName,
                content: content.trim(),
                restored_from_archive: true
            };
            
            if (timestampMatch) {
                eventData.original_timestamp = timestampMatch[1];
            }
            
            await context.addEvent(`restored_${tagName}`, eventData);
        }
        
        // Add restoration event
        await context.addEvent('context_restored_from_archive', {
            restored_at: Date.now(),
            original_xml_length: archivedXml.length
        });
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
                // Core Universal Context Commands
                start: '/start <name> [--session|--project] [--goal="..."] [--vision="..."]',
                save: '/save [<name>] [--status="..."] [--important] [--pause]',
                resume: '/resume [<name>]',
                list: '/list [--detailed]',
                switch: '/switch <name>',
                upgrade: '/upgrade <name> --to-project --goal="..." [--vision="..."]',
                status: '/status',
                
                // Phase 3B: Long-Term Persistence Commands
                archive: '/archive <name> [--keep-active]',
                restore: '/restore <name> [--scope=session|project]',
                health: '/health [<name>] [--maintenance]',
                cleanup: '/cleanup [--retention-days=365]'
            },
            examples: [
                // Core examples
                '/start fix-auth-bug --session',
                '/start new-auth-system --project --goal="Build secure authentication"',
                '/save fix-auth-bug --status="Fixed JWT expiration"',
                '/upgrade fix-auth-bug --to-project --goal="Complete auth redesign"',
                
                // Phase 3B examples
                '/archive old-project --keep-active',
                '/restore auth-system --scope=project',
                '/health auth-system --maintenance',
                '/cleanup --retention-days=180'
            ],
            phase3b_info: {
                description: 'Phase 3B adds long-term persistence for 3+ month context survival',
                features: [
                    '📦 Progressive archival with compression levels',
                    '🚀 Sub-second restore performance (<1000ms)',
                    '🏥 Health monitoring with proactive maintenance',
                    '🗑️ Automatic cleanup and retention management'
                ]
            }
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