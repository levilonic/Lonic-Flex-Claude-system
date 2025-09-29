/**
 * Workflow Engine - Structured Phase Management for Universal Context System
 * Enables complex multi-phase tasks with quality gates, agent coordination, and learning
 * Integrates seamlessly with existing Universal Context System
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;

class WorkflowEngine extends EventEmitter {
    constructor(context, options = {}) {
        super();
        
        this.context = context; // Universal Context instance
        this.options = {
            enableLearning: options.enableLearning !== false,
            enableAgentCoordination: options.enableAgentCoordination !== false,
            enableQualityGates: options.enableQualityGates !== false,
            workflowTemplatesDir: options.workflowTemplatesDir || path.join(process.cwd(), 'workflows'),
            ...options
        };
        
        // Workflow state management
        this.workflow = {
            template: null,
            currentPhase: null,
            phases: [],
            tasks: new Map(),
            qualityGates: new Map(),
            agents: new Map(),
            startTime: null,
            metrics: {
                phasesCompleted: 0,
                tasksCompleted: 0,
                qualityGatesPassed: 0,
                agentSwitches: 0
            }
        };
        
        // Learning and improvement tracking
        this.learningData = {
            patterns: [],
            successes: [],
            failures: [],
            optimizations: []
        };
        
        console.log('🔧 Workflow Engine initialized for context:', this.context.contextId);
    }

    /**
     * Load workflow template and initialize phases
     */
    async loadWorkflowTemplate(templateName, workflowGoal = null) {
        console.log(`📋 Loading workflow template: ${templateName}`);
        
        try {
            // Try to load from templates directory first
            const templatePath = path.join(this.options.workflowTemplatesDir, `${templateName}.js`);
            let template = null;
            
            try {
                const templateModule = require(templatePath);
                template = typeof templateModule === 'function' ? templateModule() : templateModule;
            } catch (error) {
                // If template doesn't exist, create basic structure
                console.log(`⚠️ Template ${templateName} not found, creating basic structure`);
                template = this.createBasicWorkflowTemplate(templateName, workflowGoal);
            }
            
            // Initialize workflow from template
            this.workflow.template = template;
            this.workflow.phases = [...template.phases];
            this.workflow.currentPhase = template.phases[0];
            this.workflow.startTime = Date.now();
            
            // Initialize tasks from template
            for (const phase of template.phases) {
                if (phase.tasks) {
                    for (const task of phase.tasks) {
                        this.workflow.tasks.set(task.id, {
                            ...task,
                            status: 'pending',
                            startTime: null,
                            completionTime: null,
                            assignedAgent: null
                        });
                    }
                }
                
                // Initialize quality gates
                if (phase.qualityGates) {
                    for (const gate of phase.qualityGates) {
                        this.workflow.qualityGates.set(gate.id, {
                            ...gate,
                            status: 'pending',
                            evaluationTime: null,
                            passed: false
                        });
                    }
                }
            }
            
            // Log workflow initialization to context
            this.context.addEvent('workflow_initialized', {
                template: templateName,
                phases: template.phases.map(p => p.name),
                totalTasks: this.workflow.tasks.size,
                totalQualityGates: this.workflow.qualityGates.size,
                goal: workflowGoal
            });
            
            console.log(`✅ Workflow loaded: ${template.phases.length} phases, ${this.workflow.tasks.size} tasks`);
            return template;
            
        } catch (error) {
            console.error('❌ Failed to load workflow template:', error);
            throw new Error(`Workflow template loading failed: ${error.message}`);
        }
    }

    /**
     * Create basic workflow template when specific template doesn't exist
     */
    createBasicWorkflowTemplate(templateName, goal) {
        return {
            name: templateName,
            version: '1.0.0',
            description: `Auto-generated workflow template for ${templateName}`,
            phases: [
                {
                    name: 'Planning',
                    description: 'Analyze requirements and create execution plan',
                    requiredAgent: 'Code Reviewer Agent',
                    tasks: [
                        {
                            id: 'analyze_scope',
                            name: 'Analyze Scope and Requirements',
                            description: 'Understand the full scope of work needed',
                            estimatedTime: 300000 // 5 minutes
                        },
                        {
                            id: 'select_tools',
                            name: 'Select Tools and Methods',
                            description: 'Choose appropriate tools and techniques',
                            estimatedTime: 300000 // 5 minutes
                        },
                        {
                            id: 'define_success_criteria',
                            name: 'Define Success Criteria',
                            description: 'Establish measurable success criteria',
                            estimatedTime: 300000 // 5 minutes
                        }
                    ],
                    qualityGates: [
                        {
                            id: 'planning_completeness',
                            name: 'Planning Completeness Check',
                            criteria: 'All tasks defined with clear success criteria',
                            validationMethod: 'manual'
                        }
                    ]
                },
                {
                    name: 'Execution',
                    description: 'Execute the planned work systematically',
                    requiredAgent: 'auto-detect',
                    tasks: [
                        {
                            id: 'execute_primary_work',
                            name: 'Execute Primary Work',
                            description: goal || 'Execute the main work as planned',
                            estimatedTime: 1800000 // 30 minutes
                        }
                    ],
                    qualityGates: [
                        {
                            id: 'execution_success',
                            name: 'Execution Success Validation',
                            criteria: 'Primary work completed successfully',
                            validationMethod: 'testing'
                        }
                    ]
                },
                {
                    name: 'Validation',
                    description: 'Validate results and capture learnings',
                    requiredAgent: 'Code Reviewer Agent',
                    tasks: [
                        {
                            id: 'validate_results',
                            name: 'Validate Results',
                            description: 'Verify all success criteria met',
                            estimatedTime: 600000 // 10 minutes
                        },
                        {
                            id: 'capture_learnings',
                            name: 'Capture Learnings',
                            description: 'Record lessons learned for future improvement',
                            estimatedTime: 300000 // 5 minutes
                        }
                    ],
                    qualityGates: [
                        {
                            id: 'validation_complete',
                            name: 'Validation Complete',
                            criteria: 'All results validated and learnings captured',
                            validationMethod: 'manual'
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Start workflow execution
     */
    async startWorkflow() {
        if (!this.workflow.template) {
            throw new Error('No workflow template loaded. Call loadWorkflowTemplate() first.');
        }
        
        console.log(`🚀 Starting workflow: ${this.workflow.template.name}`);
        console.log(`📋 Current Phase: ${this.workflow.currentPhase.name}`);
        
        // Log workflow start
        this.context.addEvent('workflow_started', {
            template: this.workflow.template.name,
            startPhase: this.workflow.currentPhase.name,
            totalPhases: this.workflow.phases.length
        });
        
        // Start first phase
        await this.startPhase(this.workflow.currentPhase);
        
        this.emit('workflow-started', {
            template: this.workflow.template.name,
            phase: this.workflow.currentPhase.name
        });
    }

    /**
     * Start a specific phase
     */
    async startPhase(phase) {
        console.log(`\n🎯 Starting Phase: ${phase.name}`);
        console.log(`📝 Description: ${phase.description}`);
        
        phase.startTime = Date.now();
        
        // Agent coordination - switch to required agent if specified
        if (phase.requiredAgent && phase.requiredAgent !== 'auto-detect' && this.options.enableAgentCoordination) {
            console.log(`🤖 Phase requires: ${phase.requiredAgent}`);
            // This would trigger agent switching in the persona system
            this.emit('agent-switch-required', {
                currentAgent: 'Code Reviewer Agent', // Current persona
                requiredAgent: phase.requiredAgent,
                phase: phase.name
            });
        }
        
        // Display phase tasks
        if (phase.tasks) {
            console.log(`📋 Phase Tasks (${phase.tasks.length}):`);
            for (const task of phase.tasks) {
                const taskData = this.workflow.tasks.get(task.id);
                console.log(`  • ${task.name} [${taskData.status.toUpperCase()}]`);
                console.log(`    ${task.description}`);
            }
        }
        
        // Display quality gates
        if (phase.qualityGates) {
            console.log(`🚪 Quality Gates (${phase.qualityGates.length}):`);
            for (const gate of phase.qualityGates) {
                console.log(`  • ${gate.name}`);
                console.log(`    Criteria: ${gate.criteria}`);
            }
        }
        
        // Log phase start to context
        this.context.addEvent('phase_started', {
            phase: phase.name,
            tasks: phase.tasks ? phase.tasks.map(t => t.name) : [],
            qualityGates: phase.qualityGates ? phase.qualityGates.map(g => g.name) : [],
            requiredAgent: phase.requiredAgent
        });
        
        this.emit('phase-started', { phase });
    }

    /**
     * Mark task as completed with evidence
     */
    async completeTask(taskId, evidence = null, agent = null) {
        const task = this.workflow.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found in workflow`);
        }
        
        task.status = 'completed';
        task.completionTime = Date.now();
        task.assignedAgent = agent;
        task.evidence = evidence;
        
        this.workflow.metrics.tasksCompleted++;
        
        console.log(`✅ Task completed: ${task.name}`);
        if (evidence) {
            console.log(`📊 Evidence: ${evidence}`);
        }
        
        // Log to context
        this.context.addEvent('task_completed', {
            taskId,
            taskName: task.name,
            completionTime: task.completionTime - (task.startTime || this.workflow.startTime),
            evidence,
            agent
        });
        
        this.emit('task-completed', { task, evidence });
        
        // Check if phase is complete
        await this.checkPhaseCompletion();
    }

    /**
     * Evaluate quality gate
     */
    async evaluateQualityGate(gateId, passed = true, evaluationData = null) {
        const gate = this.workflow.qualityGates.get(gateId);
        if (!gate) {
            throw new Error(`Quality gate ${gateId} not found in workflow`);
        }
        
        gate.status = passed ? 'passed' : 'failed';
        gate.passed = passed;
        gate.evaluationTime = Date.now();
        gate.evaluationData = evaluationData;
        
        if (passed) {
            this.workflow.metrics.qualityGatesPassed++;
            console.log(`✅ Quality Gate PASSED: ${gate.name}`);
        } else {
            console.log(`❌ Quality Gate FAILED: ${gate.name}`);
            console.log(`   Criteria: ${gate.criteria}`);
        }
        
        // Log to context
        this.context.addEvent('quality_gate_evaluated', {
            gateId,
            gateName: gate.name,
            passed,
            criteria: gate.criteria,
            evaluationData
        });
        
        this.emit('quality-gate-evaluated', { gate, passed });
        
        return passed;
    }

    /**
     * Check if current phase is complete and ready for next phase
     */
    async checkPhaseCompletion() {
        const currentPhase = this.workflow.currentPhase;
        
        // Check if all tasks in current phase are completed
        const phaseTasks = currentPhase.tasks || [];
        const completedTasks = phaseTasks.filter(task => {
            const taskData = this.workflow.tasks.get(task.id);
            return taskData && taskData.status === 'completed';
        });
        
        // Check if all quality gates are passed
        const phaseGates = currentPhase.qualityGates || [];
        const passedGates = phaseGates.filter(gate => {
            const gateData = this.workflow.qualityGates.get(gate.id);
            return gateData && gateData.passed === true;
        });
        
        const tasksComplete = completedTasks.length === phaseTasks.length;
        const gatesComplete = passedGates.length === phaseGates.length;
        
        console.log(`\n📊 Phase Completion Check:`);
        console.log(`   Tasks: ${completedTasks.length}/${phaseTasks.length} completed`);
        console.log(`   Quality Gates: ${passedGates.length}/${phaseGates.length} passed`);
        
        if (tasksComplete && gatesComplete) {
            await this.completePhase(currentPhase);
        } else {
            console.log(`⏳ Phase not ready for completion yet`);
        }
    }

    /**
     * Complete current phase and move to next
     */
    async completePhase(phase) {
        phase.completionTime = Date.now();
        phase.duration = phase.completionTime - phase.startTime;
        
        this.workflow.metrics.phasesCompleted++;
        
        console.log(`✅ Phase Complete: ${phase.name}`);
        console.log(`⏱️ Duration: ${Math.round(phase.duration / 1000)}s`);
        
        // Log phase completion
        this.context.addEvent('phase_completed', {
            phase: phase.name,
            duration: phase.duration,
            tasksCompleted: (phase.tasks || []).length,
            qualityGatesPassed: (phase.qualityGates || []).length
        });
        
        // Move to next phase
        const currentPhaseIndex = this.workflow.phases.findIndex(p => p.name === phase.name);
        const nextPhaseIndex = currentPhaseIndex + 1;
        
        if (nextPhaseIndex < this.workflow.phases.length) {
            this.workflow.currentPhase = this.workflow.phases[nextPhaseIndex];
            console.log(`\n➡️ Moving to next phase: ${this.workflow.currentPhase.name}`);
            await this.startPhase(this.workflow.currentPhase);
        } else {
            await this.completeWorkflow();
        }
        
        this.emit('phase-completed', { phase });
    }

    /**
     * Complete entire workflow
     */
    async completeWorkflow() {
        const totalDuration = Date.now() - this.workflow.startTime;
        
        console.log(`\n🎉 Workflow Complete: ${this.workflow.template.name}`);
        console.log(`⏱️ Total Duration: ${Math.round(totalDuration / 1000)}s`);
        console.log(`📊 Metrics:`);
        console.log(`   Phases: ${this.workflow.metrics.phasesCompleted}/${this.workflow.phases.length}`);
        console.log(`   Tasks: ${this.workflow.metrics.tasksCompleted}/${this.workflow.tasks.size}`);
        console.log(`   Quality Gates: ${this.workflow.metrics.qualityGatesPassed}/${this.workflow.qualityGates.size}`);
        
        // Generate workflow summary
        const summary = {
            template: this.workflow.template.name,
            totalDuration,
            metrics: this.workflow.metrics,
            success: this.workflow.metrics.phasesCompleted === this.workflow.phases.length
        };
        
        // Log completion to context
        this.context.addEvent('workflow_completed', summary);
        
        // Record learning data if enabled
        if (this.options.enableLearning) {
            await this.recordLearnings();
        }
        
        this.emit('workflow-completed', { summary });
        
        return summary;
    }

    /**
     * Get current workflow status
     */
    getWorkflowStatus() {
        if (!this.workflow.template) {
            return { status: 'not_started' };
        }
        
        const currentPhaseIndex = this.workflow.phases.findIndex(p => p.name === this.workflow.currentPhase.name);
        const progress = (this.workflow.metrics.phasesCompleted / this.workflow.phases.length) * 100;
        
        return {
            status: 'in_progress',
            template: this.workflow.template.name,
            currentPhase: this.workflow.currentPhase.name,
            currentPhaseIndex,
            totalPhases: this.workflow.phases.length,
            progress: Math.round(progress),
            metrics: this.workflow.metrics,
            startTime: this.workflow.startTime,
            duration: this.workflow.startTime ? Date.now() - this.workflow.startTime : 0
        };
    }

    /**
     * Record learnings for future workflow improvement
     */
    async recordLearnings() {
        console.log(`🧠 Recording workflow learnings...`);
        
        const learningData = {
            template: this.workflow.template.name,
            totalDuration: Date.now() - this.workflow.startTime,
            metrics: this.workflow.metrics,
            success: this.workflow.metrics.phasesCompleted === this.workflow.phases.length,
            patterns: this.learningData.patterns,
            timestamp: Date.now()
        };
        
        // This would integrate with the MemoryManager to record patterns
        this.context.addEvent('workflow_learning_recorded', learningData);
        
        console.log(`✅ Learnings recorded for template: ${this.workflow.template.name}`);
    }
}

module.exports = { WorkflowEngine };