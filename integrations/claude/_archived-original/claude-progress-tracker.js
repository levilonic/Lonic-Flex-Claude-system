const cliProgress = require('cli-progress');
const colors = require('ansi-colors');

class ClaudeProgressTracker {
    constructor() {
        this.bar = null;
        this.startTime = null;
        this.tokensIn = 0;
        this.tokensOut = 0;
        this.currentTask = '';
        this.totalTasks = 0;
        this.completedTasks = 0;
        this.multibar = null; // Initialize multibar in constructor
        
        // Multi-Agent Extensions - Factor 3: Own Your Context Window
        this.agents = new Map(); // Track multiple agents simultaneously
        this.coordinationState = null;
        this.isMultiAgent = false;
        this.contextFormat = 'xml'; // Efficient custom format
    }

    initializeMultibar() {
        if (!this.multibar) {
            this.multibar = new cliProgress.MultiBar({
                clearOnComplete: false,
                hideCursor: true,
                format: ' {bar} | {percentage}% | {task} | ETA: {eta_formatted} | Elapsed: {duration_formatted}',
                barCompleteChar: '█',
                barIncompleteChar: '░',
            }, cliProgress.Presets.shades_grey);
        }
    }

    start(taskName, estimatedDuration = null) {
        this.startTime = Date.now();
        this.currentTask = taskName;
        
        // Initialize multibar
        this.initializeMultibar();

        // Main task progress bar
        this.taskBar = this.multibar.create(100, 0, { 
            task: `${colors.cyan(taskName)}`,
            eta_formatted: 'calculating...',
            duration_formatted: '00:00'
        });

        // Token usage bar
        this.tokenBar = this.multibar.create(1000, 0, {
            task: `${colors.yellow('Tokens')} In: 0 | Out: 0`,
            eta_formatted: '',
            duration_formatted: ''
        });

        console.log(colors.green(`\n🤖 Claude is working on: ${taskName}`));
        console.log(colors.gray('━'.repeat(60)));
    }

    updateProgress(percentage, currentStep = '') {
        if (!this.taskBar) return;
        
        const elapsed = Date.now() - this.startTime;
        const elapsedFormatted = this.formatDuration(elapsed);
        
        let eta = 'calculating...';
        if (percentage > 0) {
            const estimatedTotal = (elapsed / percentage) * 100;
            const remaining = estimatedTotal - elapsed;
            eta = this.formatDuration(remaining);
        }

        const taskLabel = currentStep ? 
            `${colors.cyan(this.currentTask)} - ${colors.white(currentStep)}` : 
            colors.cyan(this.currentTask);

        this.taskBar.update(percentage, {
            task: taskLabel,
            eta_formatted: eta,
            duration_formatted: elapsedFormatted
        });
    }

    updateTokens(tokensIn, tokensOut) {
        this.tokensIn = tokensIn;
        this.tokensOut = tokensOut;
        
        if (this.tokenBar) {
            const totalTokens = tokensIn + tokensOut;
            this.tokenBar.update(Math.min(totalTokens, 1000), {
                task: `${colors.yellow('Tokens')} In: ${colors.green(tokensIn)} | Out: ${colors.blue(tokensOut)}`,
                eta_formatted: '',
                duration_formatted: ''
            });
        }
    }

    addSubtask(subtaskName) {
        if (this.multibar) {
            const subtaskBar = this.multibar.create(100, 0, {
                task: `${colors.magenta('└─')} ${subtaskName}`,
                eta_formatted: '',
                duration_formatted: ''
            });
            return subtaskBar;
        }
        return null;
    }

    complete(success = true) {
        if (!this.taskBar) return;
        
        const elapsed = Date.now() - this.startTime;
        const elapsedFormatted = this.formatDuration(elapsed);
        
        this.taskBar.update(100);
        this.multibar.stop();
        
        console.log(colors.gray('━'.repeat(60)));
        
        if (success) {
            console.log(colors.green(`✅ Task completed: ${this.currentTask}`));
        } else {
            console.log(colors.red(`❌ Task failed: ${this.currentTask}`));
        }
        
        console.log(colors.gray(`⏱️  Duration: ${elapsedFormatted}`));
        console.log(colors.gray(`📊 Tokens used - In: ${this.tokensIn} | Out: ${this.tokensOut} | Total: ${this.tokensIn + this.tokensOut}`));
        
        if (this.tokensIn > 0 || this.tokensOut > 0) {
            const tokensPerSecond = ((this.tokensIn + this.tokensOut) / (elapsed / 1000)).toFixed(2);
            console.log(colors.gray(`🚀 Processing rate: ${tokensPerSecond} tokens/sec`));
        }
        
        // Multi-agent completion summary
        if (this.isMultiAgent && this.coordinationState) {
            console.log(colors.blue(`🤖 Agent coordination completed`));
            const completedAgents = Array.from(this.agents.values()).filter(a => a.status === 'completed').length;
            console.log(colors.gray(`   Agents completed: ${completedAgents}/${this.agents.size}`));
        }
        
        console.log('');
    }

    // Multi-Agent Methods - Factor 3: Efficient Context Format
    startAgentCoordination(sessionId, agentNames) {
        this.isMultiAgent = true;
        this.coordinationState = {
            sessionId,
            startedAt: Date.now(),
            currentAgent: null,
            totalAgents: agentNames.length
        };
        
        // Ensure multibar is initialized
        this.initializeMultibar();
        
        // Create progress bars for each agent
        agentNames.forEach(agentName => {
            const agentBar = this.multibar.create(100, 0, {
                task: `${colors.blue('🤖')} ${agentName}: ${colors.gray('waiting...')}`,
                eta_formatted: '',
                duration_formatted: ''
            });
            
            this.agents.set(agentName, {
                name: agentName,
                status: 'pending',
                progress: 0,
                bar: agentBar,
                startTime: null,
                context: null
            });
        });

        console.log(colors.cyan(`\n🔄 Multi-Agent Coordination Started`));
        console.log(colors.gray(`Session: ${sessionId} | Agents: ${agentNames.length}`));
        console.log(colors.gray('━'.repeat(60)));
    }

    updateAgentProgress(agentName, progress, step = '', context = null) {
        if (!this.agents.has(agentName)) return;
        
        const agent = this.agents.get(agentName);
        agent.progress = progress;
        agent.context = context;
        
        if (progress > 0 && !agent.startTime) {
            agent.startTime = Date.now();
            agent.status = 'in_progress';
            this.coordinationState.currentAgent = agentName;
        }
        
        if (progress >= 100) {
            agent.status = 'completed';
        }
        
        const statusIcon = progress >= 100 ? '✅' : progress > 0 ? '⚡' : '⏳';
        const stepText = step ? `- ${step}` : '';
        
        agent.bar.update(progress, {
            task: `${colors.blue(statusIcon)} ${agentName}: ${colors.white(stepText)}`,
            eta_formatted: '',
            duration_formatted: ''
        });
    }

    // Generate efficient context for LLM (Factor 3 format)
    generateAgentContext() {
        if (!this.isMultiAgent) return '';
        
        const agentStates = Array.from(this.agents.entries()).map(([name, agent]) => {
            return `      - ${name}: "${agent.status}" (${agent.progress}%)`;
        }).join('\n');

        return `<agent_coordination>
    session_id: "${this.coordinationState.sessionId}"
    current_agent: "${this.coordinationState.currentAgent}"
    total_agents: ${this.coordinationState.totalAgents}
    agents:
${agentStates}
    elapsed: "${this.formatDuration(Date.now() - this.coordinationState.startedAt)}"
</agent_coordination>`;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    // Simulate Claude task progress
    simulateClaudeTask(taskName, steps = []) {
        return new Promise((resolve) => {
            this.start(taskName);
            
            let currentStep = 0;
            const totalSteps = steps.length || 10;
            
            const stepInterval = setInterval(() => {
                const progress = ((currentStep + 1) / totalSteps) * 100;
                const stepName = steps[currentStep] || `Step ${currentStep + 1}`;
                
                this.updateProgress(progress, stepName);
                
                // Simulate token usage growth
                this.updateTokens(
                    Math.floor(50 + (currentStep * 15)), // Input tokens
                    Math.floor(30 + (currentStep * 25))  // Output tokens
                );
                
                currentStep++;
                
                if (currentStep >= totalSteps) {
                    clearInterval(stepInterval);
                    this.complete(true);
                    resolve();
                }
            }, 800);
        });
    }
}

// Example usage and demo
async function demo() {
    const tracker = new ClaudeProgressTracker();
    
    const steps = [
        'Reading project files',
        'Analyzing codebase structure',
        'Identifying patterns',
        'Planning implementation',
        'Generating code',
        'Optimizing solution',
        'Adding documentation',
        'Running tests',
        'Final review'
    ];
    
    await tracker.simulateClaudeTask('Implementing new feature', steps);
    
    // Demo multiple tasks
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await tracker.simulateClaudeTask('Code review and optimization', [
        'Scanning for issues',
        'Performance analysis',
        'Applying fixes',
        'Validation'
    ]);
}

module.exports = ClaudeProgressTracker;

// Run demo if called directly
if (require.main === module) {
    demo().catch(console.error);
}