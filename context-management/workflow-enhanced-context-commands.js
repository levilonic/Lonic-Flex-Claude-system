/**
 * Workflow Enhanced Universal Context Commands
 * Extends Universal Context System with structured workflow capabilities
 * Integrates Workflow Engine for complex multi-phase tasks
 */

const { UniversalContextCommands } = require('../universal-context-commands');
const { WorkflowEngine } = require('./workflow-engine');
const { Factor3ContextManager } = require('../factor3-context-manager');

class WorkflowEnhancedContextCommands extends UniversalContextCommands {
    constructor(options = {}) {
        super(options);
        
        // Workflow system configuration
        this.workflowConfig = {
            enableWorkflows: options.enableWorkflows !== false,
            workflowTemplatesDir: options.workflowTemplatesDir || './workflows',
            autoAgentSwitching: options.autoAgentSwitching !== false,
            workflowLearning: options.workflowLearning !== false,
            ...options.workflow
        };
        
        // Active workflows tracking
        this.activeWorkflows = new Map();
        
        console.log('🔧 Workflow Enhanced Context Commands initialized');
    }

    /**
     * Enhanced /start command with workflow support
     * Usage: /start <context-name> [--workflow=<template>] [other flags]
     */
    async startContext(command) {
        // Parse command and extract workflow flag
        const parsedCmd = this.parseCommand(command);
        const { contextName, flags } = parsedCmd;
        
        // Check for workflow flag
        if (flags.workflow) {
            return await this.startWorkflowContext(contextName, flags.workflow, flags);
        }
        
        // Standard context creation (fallback to parent class)
        return await super.startContext(command);
    }

    /**
     * Start context with structured workflow
     */
    async startWorkflowContext(contextName, workflowTemplate, flags) {
        console.log(`🔧 Starting structured workflow context: ${contextName}`);
        console.log(`📋 Workflow Template: ${workflowTemplate}`);
        
        // Create the context first using parent method
        const contextResult = await this.createNewContext(contextName, flags.project ? 'project' : 'session', flags);
        
        // Get the created context
        const context = Factor3ContextManager.getContextById(contextName);
        if (!context) {
            throw new Error(`Failed to create context: ${contextName}`);
        }
        
        // Initialize workflow engine for this context
        const workflowEngine = new WorkflowEngine(context, {
            workflowTemplatesDir: this.workflowConfig.workflowTemplatesDir,
            enableLearning: this.workflowConfig.workflowLearning,
            enableAgentCoordination: this.workflowConfig.autoAgentSwitching
        });
        
        // Set up workflow event handlers
        this.setupWorkflowEventHandlers(workflowEngine, contextName);
        
        try {
            // Load and start workflow
            await workflowEngine.loadWorkflowTemplate(workflowTemplate, flags.goal);
            await workflowEngine.startWorkflow();
            
            // Track active workflow
            this.activeWorkflows.set(contextName, workflowEngine);
            
            // Log workflow start to context
            context.addEvent('workflow_context_created', {
                template: workflowTemplate,
                goal: flags.goal,
                workflowEnabled: true,
                contextType: flags.project ? 'project' : 'session'
            });
            
            console.log(`✅ Workflow context started: ${contextName}`);
            console.log(`🎯 Current Phase: ${workflowEngine.workflow.currentPhase.name}`);
            
            // Display current phase information
            this.displayCurrentPhase(workflowEngine);
            
            return {
                success: true,
                contextId: contextName,
                contextType: flags.project ? 'project' : 'session',
                workflowTemplate,
                currentPhase: workflowEngine.workflow.currentPhase.name,
                totalPhases: workflowEngine.workflow.phases.length,
                ...contextResult
            };
            
        } catch (error) {
            console.error('❌ Failed to start workflow:', error.message);
            // Clean up on failure
            this.activeWorkflows.delete(contextName);
            throw error;
        }
    }

    /**
     * Enhanced /status command with workflow information
     */
    async statusContext(command = '') {
        const standardStatus = await super.statusContext(command);
        
        // Add workflow status to all active workflows
        if (this.activeWorkflows.size > 0) {
            console.log(`\n📋 Active Workflows (${this.activeWorkflows.size}):`);
            
            for (const [contextId, workflowEngine] of this.activeWorkflows) {
                const workflowStatus = workflowEngine.getWorkflowStatus();
                
                console.log(`\n🔧 Context: ${contextId}`);
                console.log(`   Template: ${workflowStatus.template}`);
                console.log(`   Phase: ${workflowStatus.currentPhase} (${workflowStatus.currentPhaseIndex + 1}/${workflowStatus.totalPhases})`);
                console.log(`   Progress: ${workflowStatus.progress}%`);
                console.log(`   Duration: ${Math.round(workflowStatus.duration / 1000)}s`);
                console.log(`   Tasks: ${workflowStatus.metrics.tasksCompleted}/${workflowEngine.workflow.tasks.size} completed`);
                console.log(`   Quality Gates: ${workflowStatus.metrics.qualityGatesPassed}/${workflowEngine.workflow.qualityGates.size} passed`);
            }
        }
        
        return {
            ...standardStatus,
            workflows: Array.from(this.activeWorkflows.entries()).map(([contextId, engine]) => ({
                contextId,
                status: engine.getWorkflowStatus()
            }))
        };
    }

    /**
     * Workflow task completion command
     * Usage: /task-complete <task-id> [--evidence="..."] [--agent="..."]
     */
    async completeWorkflowTask(taskId, evidence = null, agent = null) {
        const currentContext = this.getCurrentActiveContext();
        if (!currentContext) {
            throw new Error('No active context. Use /start to create a context first.');
        }
        
        const workflowEngine = this.activeWorkflows.get(currentContext.contextId);
        if (!workflowEngine) {
            throw new Error('Current context is not using a workflow. Use /start --workflow=<template> to create a workflow context.');
        }
        
        try {
            await workflowEngine.completeTask(taskId, evidence, agent);
            console.log(`✅ Task completed: ${taskId}`);
            
            // Display updated phase status
            this.displayCurrentPhase(workflowEngine);
            
        } catch (error) {
            console.error('❌ Failed to complete task:', error.message);
            throw error;
        }
    }

    /**
     * Workflow quality gate evaluation command
     * Usage: /quality-gate <gate-id> <passed|failed> [--data="..."]
     */
    async evaluateWorkflowQualityGate(gateId, passed, evaluationData = null) {
        const currentContext = this.getCurrentActiveContext();
        if (!currentContext) {
            throw new Error('No active context. Use /start to create a context first.');
        }
        
        const workflowEngine = this.activeWorkflows.get(currentContext.contextId);
        if (!workflowEngine) {
            throw new Error('Current context is not using a workflow.');
        }
        
        try {
            const result = await workflowEngine.evaluateQualityGate(gateId, passed === 'passed', evaluationData);
            
            if (result) {
                console.log(`✅ Quality Gate PASSED: ${gateId}`);
            } else {
                console.log(`❌ Quality Gate FAILED: ${gateId}`);
            }
            
            // Display updated phase status
            this.displayCurrentPhase(workflowEngine);
            
            return result;
            
        } catch (error) {
            console.error('❌ Failed to evaluate quality gate:', error.message);
            throw error;
        }
    }

    /**
     * Setup workflow event handlers for context integration
     */
    setupWorkflowEventHandlers(workflowEngine, contextId) {
        // Handle agent switching requirements
        workflowEngine.on('agent-switch-required', (data) => {
            console.log(`\n🤖 Agent Switch Required:`);
            console.log(`   Current: ${data.currentAgent}`);
            console.log(`   Required: ${data.requiredAgent}`);
            console.log(`   Phase: ${data.phase}`);
            console.log(`   Action: Switch to ${data.requiredAgent} persona to continue workflow`);
        });
        
        // Handle phase transitions
        workflowEngine.on('phase-started', (data) => {
            console.log(`\n🎯 Phase Started: ${data.phase.name}`);
            
            // Log to context
            const context = Factor3ContextManager.getContextById(contextId);
            if (context) {
                context.addEvent('workflow_phase_started', {
                    phase: data.phase.name,
                    description: data.phase.description,
                    tasks: data.phase.tasks ? data.phase.tasks.length : 0,
                    qualityGates: data.phase.qualityGates ? data.phase.qualityGates.length : 0
                });
            }
        });
        
        // Handle phase completion
        workflowEngine.on('phase-completed', (data) => {
            console.log(`\n✅ Phase Completed: ${data.phase.name}`);
            console.log(`   Duration: ${Math.round(data.phase.duration / 1000)}s`);
            
            // Log to context
            const context = Factor3ContextManager.getContextById(contextId);
            if (context) {
                context.addEvent('workflow_phase_completed', {
                    phase: data.phase.name,
                    duration: data.phase.duration,
                    success: true
                });
            }
        });
        
        // Handle workflow completion
        workflowEngine.on('workflow-completed', (data) => {
            console.log(`\n🎉 Workflow Completed: ${data.summary.template}`);
            console.log(`   Total Duration: ${Math.round(data.summary.totalDuration / 1000)}s`);
            console.log(`   Success: ${data.summary.success}`);
            
            // Remove from active workflows
            this.activeWorkflows.delete(contextId);
            
            // Log to context
            const context = Factor3ContextManager.getContextById(contextId);
            if (context) {
                context.addEvent('workflow_completed', data.summary);
            }
        });
        
        // Handle task completion
        workflowEngine.on('task-completed', (data) => {
            const context = Factor3ContextManager.getContextById(contextId);
            if (context) {
                context.addEvent('workflow_task_completed', {
                    taskId: data.task.id,
                    taskName: data.task.name,
                    evidence: data.evidence,
                    completionTime: data.task.completionTime
                });
            }
        });
    }

    /**
     * Display current phase information
     */
    displayCurrentPhase(workflowEngine) {
        const status = workflowEngine.getWorkflowStatus();
        const currentPhase = workflowEngine.workflow.currentPhase;
        
        console.log(`\n📊 Current Phase Status:`);
        console.log(`   Phase: ${currentPhase.name} (${status.currentPhaseIndex + 1}/${status.totalPhases})`);
        console.log(`   Progress: ${status.progress}%`);
        
        // Show pending tasks
        if (currentPhase.tasks) {
            const pendingTasks = currentPhase.tasks.filter(task => {
                const taskData = workflowEngine.workflow.tasks.get(task.id);
                return taskData && taskData.status === 'pending';
            });
            
            if (pendingTasks.length > 0) {
                console.log(`\n📋 Pending Tasks (${pendingTasks.length}):`);
                for (const task of pendingTasks) {
                    console.log(`   • ${task.name}`);
                    if (task.verificationCommand) {
                        console.log(`     Verification: ${task.verificationCommand}`);
                    }
                }
            }
        }
        
        // Show pending quality gates
        if (currentPhase.qualityGates) {
            const pendingGates = currentPhase.qualityGates.filter(gate => {
                const gateData = workflowEngine.workflow.qualityGates.get(gate.id);
                return gateData && gateData.status === 'pending';
            });
            
            if (pendingGates.length > 0) {
                console.log(`\n🚪 Pending Quality Gates (${pendingGates.length}):`);
                for (const gate of pendingGates) {
                    console.log(`   • ${gate.name}`);
                    console.log(`     Criteria: ${gate.criteria}`);
                }
            }
        }
    }

    /**
     * Get current active context (helper method)
     */
    getCurrentActiveContext() {
        // This would need to be implemented based on how current context tracking works
        // For now, we'll assume the most recently created context is active
        const contexts = Factor3ContextManager.listContexts();
        return contexts.length > 0 ? contexts[contexts.length - 1] : null;
    }

    /**
     * Parse enhanced command with workflow flags
     */
    parseCommand(command) {
        const parsed = super.parseCommand ? super.parseCommand(command) : this.basicParseCommand(command);
        
        // Add workflow-specific flag parsing
        if (parsed.flags && typeof parsed.flags === 'object') {
            // Workflow template flag
            if (parsed.flags.workflow) {
                parsed.workflowTemplate = parsed.flags.workflow;
            }
            
            // Agent coordination flags
            if (parsed.flags['auto-agent-switch'] !== undefined) {
                parsed.flags.autoAgentSwitch = parsed.flags['auto-agent-switch'] !== 'false';
            }
            
            // Learning flags
            if (parsed.flags['enable-learning'] !== undefined) {
                parsed.flags.enableLearning = parsed.flags['enable-learning'] !== 'false';
            }
        }
        
        return parsed;
    }

    /**
     * Basic command parsing fallback
     */
    basicParseCommand(command) {
        const parts = command.trim().split(/\s+/);
        const contextName = parts[0];
        const flags = {};
        
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('--')) {
                const [key, value] = part.substring(2).split('=');
                flags[key] = value || true;
            }
        }
        
        return { contextName, flags };
    }
}

module.exports = { WorkflowEnhancedContextCommands };