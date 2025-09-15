const ClaudeProgressTracker = require('./claude-progress-tracker');

/**
 * Claude Integration Wrapper - Enhanced for Multi-Agent Orchestration
 * 
 * This module provides integration with Claude Code to show live progress
 * and token usage during task execution, plus multi-agent coordination.
 */
class ClaudeIntegration {
    constructor() {
        this.tracker = new ClaudeProgressTracker();
        this.isTracking = false;
        
        // Multi-Agent Extensions
        this.agents = new Map();
        this.activeSession = null;
        this.coordinationMode = false;
    }

    /**
     * Start tracking a Claude task
     * @param {string} taskName - Name of the task being performed
     * @param {number} estimatedDuration - Estimated duration in milliseconds (optional)
     */
    startTask(taskName, estimatedDuration = null) {
        this.isTracking = true;
        this.tracker.start(taskName, estimatedDuration);
        return this;
    }

    /**
     * Update task progress
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} currentStep - Current step being executed (optional)
     */
    updateProgress(percentage, currentStep = '') {
        if (this.isTracking) {
            this.tracker.updateProgress(percentage, currentStep);
        }
        return this;
    }

    /**
     * Update token usage statistics
     * @param {number} tokensIn - Input tokens used
     * @param {number} tokensOut - Output tokens generated
     */
    updateTokens(tokensIn, tokensOut) {
        if (this.isTracking) {
            this.tracker.updateTokens(tokensIn, tokensOut);
        }
        return this;
    }

    /**
     * Add a subtask to the progress display
     * @param {string} subtaskName - Name of the subtask
     * @returns {Object} Subtask progress bar object
     */
    addSubtask(subtaskName) {
        if (this.isTracking) {
            return this.tracker.addSubtask(subtaskName);
        }
        return null;
    }

    /**
     * Complete the current task
     * @param {boolean} success - Whether the task completed successfully
     */
    completeTask(success = true) {
        if (this.isTracking) {
            this.tracker.complete(success);
            this.isTracking = false;
        }
        return this;
    }

    /**
     * Helper method to track a complete task with automatic progress updates
     * @param {string} taskName - Name of the task
     * @param {Array} steps - Array of step names
     * @param {Function} stepCallback - Function called for each step (receives step index and name)
     * @param {number} stepDelay - Delay between steps in milliseconds
     */
    async trackTask(taskName, steps = [], stepCallback = null, stepDelay = 1000) {
        this.startTask(taskName);

        for (let i = 0; i < steps.length; i++) {
            const progress = ((i + 1) / steps.length) * 100;
            this.updateProgress(progress, steps[i]);

            if (stepCallback) {
                try {
                    await stepCallback(i, steps[i]);
                } catch (error) {
                    this.completeTask(false);
                    throw error;
                }
            }

            // Simulate token usage (you would replace this with actual token tracking)
            const tokensIn = Math.floor(50 + (i * 20));
            const tokensOut = Math.floor(30 + (i * 35));
            this.updateTokens(tokensIn, tokensOut);

            if (i < steps.length - 1) {
                await new Promise(resolve => setTimeout(resolve, stepDelay));
            }
        }

        this.completeTask(true);
    }

    // Multi-Agent Orchestration Methods - Following Factor 10 & 11 principles
    
    /**
     * Start multi-agent coordination session
     */
    startAgentCoordination(sessionId, agentNames, workflowType = 'general') {
        this.coordinationMode = true;
        this.activeSession = {
            id: sessionId,
            workflowType,
            startedAt: Date.now(),
            agentOrder: agentNames,
            currentIndex: 0
        };
        
        this.tracker.start(`Multi-Agent Workflow: ${workflowType}`);
        this.tracker.startAgentCoordination(sessionId, agentNames);
        
        return this;
    }

    /**
     * Execute agent workflow step by step (Factor 10: Small, Focused Agents)
     */
    async coordinateAgents(agentExecutor) {
        if (!this.coordinationMode || !this.activeSession) {
            throw new Error('Agent coordination not started');
        }
        
        const { agentOrder } = this.activeSession;
        const results = new Map();
        
        try {
            for (let i = 0; i < agentOrder.length; i++) {
                const agentName = agentOrder[i];
                this.activeSession.currentIndex = i;
                
                this.tracker.updateAgentProgress(agentName, 0, 'starting...');
                
                try {
                    const context = this.generateExecutionContext(agentName, results);
                    const result = await agentExecutor(agentName, context, (progress, step) => {
                        this.tracker.updateAgentProgress(agentName, progress, step);
                    });
                    
                    results.set(agentName, result);
                    this.tracker.updateAgentProgress(agentName, 100, 'completed');
                    
                } catch (error) {
                    this.tracker.updateAgentProgress(agentName, 0, `error: ${error.message}`);
                    throw new Error(`Agent ${agentName} failed: ${error.message}`);
                }
            }
            
            this.completeTask(true);
            return results;
            
        } catch (error) {
            this.completeTask(false);
            throw error;
        }
    }

    /**
     * Generate execution context for current agent (Factor 3: Own Your Context Window)
     */
    generateExecutionContext(currentAgent, previousResults) {
        const context = {
            session_id: this.activeSession.id,
            workflow_type: this.activeSession.workflowType,
            current_agent: currentAgent,
            agent_coordination: this.tracker.generateAgentContext()
        };
        
        if (previousResults.size > 0) {
            const resultEntries = Array.from(previousResults.entries()).map(([agent, result]) => {
                return `<${agent}_result>\n${JSON.stringify(result, null, 2)}\n</${agent}_result>`;
            }).join('\n\n');
            
            context.previous_results = resultEntries;
        }
        
        return context;
    }

    /**
     * Get workflow definitions (Factor 11: Trigger From Anywhere)
     */
    getWorkflowDefinitions() {
        return {
            feature_development: ['github', 'security', 'code', 'deploy'],
            bug_fix: ['github', 'security', 'deploy'],
            security_scan: ['security', 'github'],
            deployment: ['security', 'deploy', 'comm'],
            code_review: ['security', 'github', 'comm'],
            project_management: ['project']
        };
    }

    /**
     * Start workflow by type
     */
    async startWorkflow(workflowType, context = {}) {
        const workflows = this.getWorkflowDefinitions();
        
        if (!workflows[workflowType]) {
            throw new Error(`Unknown workflow type: ${workflowType}`);
        }
        
        const sessionId = `${workflowType}_${Date.now()}`;
        const agentNames = workflows[workflowType];
        
        this.startAgentCoordination(sessionId, agentNames, workflowType);
        
        return {
            sessionId,
            agentNames,
            context: { ...context, workflow_type: workflowType }
        };
    }
}

/**
 * Global Claude integration instance
 * Use this for easy access across your application
 */
const claude = new ClaudeIntegration();

/**
 * Convenience functions for quick usage
 */
const claudeProgress = {
    start: (taskName, estimatedDuration) => claude.startTask(taskName, estimatedDuration),
    update: (percentage, step) => claude.updateProgress(percentage, step),
    tokens: (tokensIn, tokensOut) => claude.updateTokens(tokensIn, tokensOut),
    subtask: (name) => claude.addSubtask(name),
    complete: (success) => claude.completeTask(success),
    track: (taskName, steps, callback, delay) => claude.trackTask(taskName, steps, callback, delay)
};

module.exports = {
    ClaudeIntegration,
    claude,
    claudeProgress
};
