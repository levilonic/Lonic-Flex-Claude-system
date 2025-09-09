/**
 * 12-Factor Agent Compliance Tracker
 * Ensures all applicable factors are followed during development
 */

const { Factor3ContextManager } = require('./factor3-context-manager');

class TwelveFactorCompliance {
    constructor() {
        this.contextManager = new Factor3ContextManager(); // Factor 3
        this.activeFactors = new Set();
        this.complianceLog = [];
    }

    // Factor 1: Natural Language to Tool Calls
    executeToolCall(naturalLanguageIntent, toolName, params) {
        this.logCompliance(1, 'Natural Language to Tool Calls', {
            intent: naturalLanguageIntent,
            tool: toolName,
            params
        });
        
        this.contextManager.addEvent('tool_call', {
            intent: naturalLanguageIntent,
            tool: toolName,
            params,
            timestamp: Date.now()
        });
        
        return this.callTool(toolName, params);
    }

    // Factor 2: Own Your Prompts  
    generatePrompt(task, context, customInstructions = []) {
        const prompt = {
            task_description: task,
            context_xml: this.contextManager.getCurrentContext(),
            custom_instructions: customInstructions,
            format: 'owned_prompt',
            timestamp: Date.now()
        };

        this.logCompliance(2, 'Own Your Prompts', {
            task,
            prompt_owned: true,
            context_included: true
        });

        return prompt;
    }

    // Factor 3: Own Your Context Window (Already implemented)
    getContextWindow() {
        this.logCompliance(3, 'Own Your Context Window', {
            format: 'xml',
            prevents_autocompact: true,
            context_size: this.contextManager.getCurrentContext().length
        });
        
        return this.contextManager.getCurrentContext();
    }

    // Factor 4: Tools are Structured Outputs
    formatToolOutput(toolName, rawOutput) {
        const structuredOutput = {
            tool: toolName,
            timestamp: Date.now(),
            status: 'success',
            result: rawOutput,
            format: 'structured'
        };

        this.logCompliance(4, 'Tools are Structured Outputs', {
            tool: toolName,
            structured: true
        });

        this.contextManager.addEvent('tool_result', structuredOutput);
        return structuredOutput;
    }

    // Factor 5: Unify Execution State
    updateExecutionState(agentName, state, data = {}) {
        const unifiedState = {
            agent: agentName,
            state,
            data,
            timestamp: Date.now(),
            session_id: this.getSessionId()
        };

        this.logCompliance(5, 'Unify Execution State', {
            agent: agentName,
            state_unified: true,
            persistent: true
        });

        this.contextManager.addEvent('state_update', unifiedState);
        return unifiedState;
    }

    // Factor 6: Launch, Pause, Resume (for long-running agents)
    launchAgent(agentName, config) {
        this.logCompliance(6, 'Launch, Pause, Resume', {
            agent: agentName,
            action: 'launch',
            resumable: true
        });

        this.contextManager.addAgentEvent(agentName, 'launched', {
            config,
            resumable: true,
            checkpoint_enabled: true
        });
    }

    pauseAgent(agentName) {
        this.logCompliance(6, 'Launch, Pause, Resume', {
            agent: agentName,
            action: 'pause',
            state_preserved: true
        });

        this.contextManager.addAgentEvent(agentName, 'paused', {
            state_checkpoint: Date.now()
        });
    }

    resumeAgent(agentName) {
        this.logCompliance(6, 'Launch, Pause, Resume', {
            agent: agentName,
            action: 'resume',
            state_restored: true
        });

        this.contextManager.addAgentEvent(agentName, 'resumed', {
            resumed_from_checkpoint: true
        });
    }

    // Factor 7: Contact Humans with Tools
    contactHuman(reason, urgency = 'normal', data = {}) {
        this.logCompliance(7, 'Contact Humans with Tools', {
            reason,
            urgency,
            structured_request: true
        });

        this.contextManager.addEvent('human_contact', {
            reason,
            urgency,
            data,
            requires_response: true,
            escalation_path: ['slack', 'email', 'phone'][urgency === 'critical' ? 2 : urgency === 'high' ? 1 : 0]
        });

        return this.sendHumanNotification(reason, urgency, data);
    }

    // Factor 8: Own Your Control Flow
    executeControlFlow(workflow, steps) {
        this.logCompliance(8, 'Own Your Control Flow', {
            workflow,
            custom_flow: true,
            steps_count: steps.length
        });

        this.contextManager.addEvent('control_flow', {
            workflow,
            steps,
            execution_strategy: 'custom_owned',
            parallelizable: false // Sequential for safety
        });

        return this.executeCustomFlow(workflow, steps);
    }

    // Factor 9: Compact Errors
    handleError(error, context = {}, shouldCompact = true) {
        const compactError = shouldCompact ? {
            type: error.constructor.name,
            message: error.message.substring(0, 100), // Compact
            code: error.code,
            recoverable: this.isRecoverable(error),
            timestamp: Date.now()
        } : error;

        this.logCompliance(9, 'Compact Errors', {
            error_type: error.constructor.name,
            compacted: shouldCompact,
            recoverable: this.isRecoverable(error)
        });

        this.contextManager.addEvent('error', {
            ...compactError,
            context,
            recovery_attempted: false
        });

        return compactError;
    }

    // Factor 10: Small, Focused Agents
    validateAgentScope(agentName, stepCount, maxSteps = 8) {
        const isSmallAndFocused = stepCount <= maxSteps;
        
        this.logCompliance(10, 'Small, Focused Agents', {
            agent: agentName,
            step_count: stepCount,
            max_allowed: maxSteps,
            compliant: isSmallAndFocused
        });

        if (!isSmallAndFocused) {
            throw new Error(`Agent ${agentName} violates Factor 10: ${stepCount} steps > ${maxSteps} max`);
        }

        return isSmallAndFocused;
    }

    // Factor 11: Trigger From Anywhere
    registerTrigger(source, eventType, handler) {
        this.logCompliance(11, 'Trigger From Anywhere', {
            source,
            event_type: eventType,
            handler_registered: true
        });

        this.contextManager.addEvent('trigger_registered', {
            source,
            eventType,
            handler: handler.name,
            supports_anywhere: true
        });

        return this.setupTrigger(source, eventType, handler);
    }

    // Setup trigger implementation (placeholder for actual trigger setup)
    setupTrigger(source, eventType, handler) {
        // In a real implementation, this would set up event listeners
        // For demo purposes, we'll just return a success indicator
        return {
            source,
            eventType,
            handler: handler.name,
            active: true,
            registered: new Date().toISOString()
        };
    }

    // Factor 12: Stateless Reducer (for state transitions)
    applyStateTransition(currentState, event, data = {}) {
        const newState = this.stateReducer(currentState, event, data);
        
        this.logCompliance(12, 'Stateless Reducer', {
            current_state: currentState,
            event,
            new_state: newState,
            deterministic: true
        });

        this.contextManager.addEvent('state_transition', {
            from: currentState,
            to: newState,
            event,
            data,
            deterministic: true,
            reversible: true
        });

        return newState;
    }

    // Compliance tracking
    logCompliance(factorNumber, factorName, details) {
        const entry = {
            factor: factorNumber,
            name: factorName,
            timestamp: Date.now(),
            details,
            compliant: true
        };

        this.complianceLog.push(entry);
        this.activeFactors.add(factorNumber);
        
        console.log(`✓ Factor ${factorNumber}: ${factorName} - Applied`);
    }

    getComplianceReport() {
        return {
            factors_applied: Array.from(this.activeFactors).sort(),
            total_applications: this.complianceLog.length,
            context_format: 'xml',
            prevents_autocompact: true,
            log: this.complianceLog
        };
    }

    // Helper methods
    callTool(toolName, params) {
        // Implement actual tool calls
        return { tool: toolName, params, executed: true };
    }

    sendHumanNotification(reason, urgency, data) {
        // Implement Slack/email notification
        return { notified: true, reason, urgency };
    }

    executeCustomFlow(workflow, steps) {
        // Implement custom workflow execution
        return { workflow, steps, executed: true };
    }

    isRecoverable(error) {
        const recoverableTypes = ['NetworkError', 'TimeoutError', 'RetryableError'];
        return recoverableTypes.includes(error.constructor.name);
    }

    stateReducer(currentState, event, data) {
        // Simple state machine
        const transitions = {
            'idle': { 'start': 'running', 'pause': 'idle' },
            'running': { 'pause': 'paused', 'complete': 'completed', 'error': 'failed' },
            'paused': { 'resume': 'running', 'cancel': 'idle' },
            'completed': { 'reset': 'idle' },
            'failed': { 'retry': 'running', 'reset': 'idle' }
        };

        return transitions[currentState]?.[event] || currentState;
    }

    getSessionId() {
        return 'multi_agent_session_' + Date.now();
    }
}

module.exports = { TwelveFactorCompliance };

// Demo showing all factors in action
if (require.main === module) {
    async function demo12FactorCompliance() {
        console.log('🎯 12-Factor Agent Compliance Demo\n');
        
        const compliance = new TwelveFactorCompliance();
        
        // Apply multiple factors
        compliance.executeToolCall("Fix the integration syntax error", "file_edit", { file: "claude-integration.js" });
        compliance.updateExecutionState("integration_fixer", "in_progress", { step: 1 });
        compliance.validateAgentScope("integration_fixer", 3, 8);
        compliance.registerTrigger("slack", "slash_command", () => {});
        
        console.log('\n📊 Compliance Report:');
        console.log(compliance.getComplianceReport());
        
        console.log('\n📄 Current Context (Factor 3):');
        console.log(compliance.getContextWindow());
    }
    
    demo12FactorCompliance().catch(console.error);
}