const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Factor3ContextManager } = require('./factor3-context-manager');
const { CLIContextDisplay } = require('./context-management/cli-context-display');

/**
 * Claude Progress Overlay - Multi-Agent Dashboard Extension
 * Phase 2.0: Enhanced with persistent context percentage display
 * Shows "X% until auto-compact" below chat as requested
 */
class ClaudeProgressOverlay {
    constructor() {
        this.progressProcess = null;
        this.progressFile = path.join(__dirname, 'progress-state.json');
        this.isRunning = false;
        
        // Enhanced Context Management
        this.contextManager = new Factor3ContextManager({
            enableMonitoring: true,
            monitor: {
                warningThreshold: 40, // User's 40% requirement
                criticalThreshold: 70,
                emergencyThreshold: 90
            }
        });
        
        // CLI Context Display (always visible)
        this.contextDisplay = new CLIContextDisplay({
            updateInterval: 5000, // 5 seconds as requested
            alwaysVisible: true,
            position: 'below_chat'
        });
        
        // Multi-Agent Extensions
        this.agents = new Map();
        this.sessionData = null;
        this.isMultiAgent = false;
        
        // Start persistent context display immediately
        this.contextDisplay.startDisplay(this.contextManager);
        
        console.log('✅ Enhanced Progress Overlay with persistent context display');
    }

    /**
     * Start multi-agent coordination overlay
     */
    startMultiAgentOverlay(sessionId, agentNames, workflowType) {
        this.isMultiAgent = true;
        this.sessionData = { sessionId, agentNames, workflowType, startedAt: Date.now() };
        
        // Initialize agents
        agentNames.forEach(name => {
            this.agents.set(name, {
                name,
                status: 'pending',
                progress: 0,
                step: 'waiting...',
                startTime: null
            });
        });

        this.contextManager.addEvent('multi_agent_overlay_started', {
            sessionId, agentNames, workflowType
        });

        this.startOverlay(`Multi-Agent: ${workflowType}`, true);
        return this;
    }

    /**
     * Update agent progress (multi-agent mode)
     */
    updateAgentProgress(agentName, progress, step = '') {
        if (!this.agents.has(agentName)) return;
        
        const agent = this.agents.get(agentName);
        agent.progress = progress;
        agent.step = step;
        
        if (progress > 0 && !agent.startTime) {
            agent.startTime = Date.now();
            agent.status = 'in_progress';
        }
        
        if (progress >= 100) {
            agent.status = 'completed';
        }
        
        this.contextManager.addAgentEvent(agentName, 'progress_update', {
            progress, step, status: agent.status
        }).catch(err => console.warn('Context update failed:', err));

        // Update overlay display
        this.updateMultiAgentState();
    }

    /**
     * Update multi-agent state file with context data
     */
    async updateMultiAgentState() {
        if (!this.isMultiAgent) return;

        // Get current context usage
        let contextData = { percentage: 0, remainingPercentage: 100, tokens: 0 };
        try {
            contextData = await this.contextManager.getTokenPercentage();
        } catch (error) {
            console.warn('Failed to get context data:', error.message);
        }

        const state = {
            taskName: `Multi-Agent: ${this.sessionData.workflowType}`,
            sessionId: this.sessionData.sessionId,
            isMultiAgent: true,
            agents: Object.fromEntries(this.agents),
            contextXml: this.contextManager.getCurrentContext(),
            contextUsage: contextData, // Added context usage data
            progress: this.calculateOverallProgress(),
            step: this.getCurrentStep(),
            startTime: this.sessionData.startedAt,
            isActive: true
        };

        this.updateProgressState(state);
    }

    calculateOverallProgress() {
        if (this.agents.size === 0) return 0;
        const totalProgress = Array.from(this.agents.values()).reduce((sum, agent) => sum + agent.progress, 0);
        return Math.floor(totalProgress / this.agents.size);
    }

    getCurrentStep() {
        const inProgress = Array.from(this.agents.values()).find(a => a.status === 'in_progress');
        if (inProgress) return `${inProgress.name}: ${inProgress.step}`;
        
        const completed = Array.from(this.agents.values()).filter(a => a.status === 'completed').length;
        return `${completed}/${this.agents.size} agents completed`;
    }

    /**
     * Start progress tracking in a separate terminal window  
     */
    startOverlay(taskName = 'Claude Task', isMultiAgent = false) {
        // Create initial progress state
        this.updateProgressState({
            taskName,
            progress: 0,
            step: 'Initializing...',
            tokensIn: 0,
            tokensOut: 0,
            startTime: Date.now(),
            isActive: true
        });

        // Create the overlay script
        const overlayScript = `
const fs = require('fs');
const cliProgress = require('cli-progress');
const colors = require('ansi-colors');
const path = require('path');

const progressFile = '${this.progressFile.replace(/\\/g, '\\\\')}';

class ProgressOverlay {
    constructor() {
        this.multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: ' {bar} | {percentage}% | {task} | ETA: {eta_formatted} | Elapsed: {duration_formatted}',
            barCompleteChar: '█',
            barIncompleteChar: '░',
        }, cliProgress.Presets.shades_grey);

        this.taskBar = null;
        this.tokenBar = null;
        this.contextBar = null; // Context percentage bar (always visible)
        this.lastState = null;
        this.agentBars = new Map();
        this.isMultiAgent = false;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return \`\${hours.toString().padStart(2, '0')}:\${(minutes % 60).toString().padStart(2, '0')}:\${(seconds % 60).toString().padStart(2, '0')}\`;
        }
        return \`\${minutes.toString().padStart(2, '0')}:\${(seconds % 60).toString().padStart(2, '0')}\`;
    }

    getStatusIcon(status) {
        switch (status) {
            case 'pending': return '⏳';
            case 'in_progress': return '⚡';
            case 'completed': return '✅';
            case 'failed': return '❌';
            default: return '❓';
        }
    }

    updateDisplay(state) {
        if (!this.taskBar) {
            const header = state.isMultiAgent ? 
                \`\\n🚀 Multi-Agent Coordination - \${state.taskName}\` :
                \`\\n🤖 Claude Progress Monitor - \${state.taskName}\`;
            console.log(colors.green(header));
            console.log(colors.gray('━'.repeat(60)));
            
            this.isMultiAgent = state.isMultiAgent || false;
            
            this.taskBar = this.multibar.create(100, 0, { 
                task: colors.cyan(state.taskName),
                eta_formatted: 'calculating...',
                duration_formatted: '00:00'
            });

            // ALWAYS create context bar (user's requirement: always visible)
            this.contextBar = this.multibar.create(100, 100, {
                task: colors.magenta('Context: 100% until auto-compact'),
                eta_formatted: '',
                duration_formatted: ''
            });

            if (!this.isMultiAgent) {
                this.tokenBar = this.multibar.create(1000, 0, {
                    task: colors.yellow('Tokens') + ' In: 0 | Out: 0',
                    eta_formatted: '',
                    duration_formatted: ''
                });
            }
            
            // Create agent bars if multi-agent
            if (this.isMultiAgent && state.agents) {
                for (const [agentName, agentData] of Object.entries(state.agents)) {
                    const agentBar = this.multibar.create(100, 0, {
                        task: colors.blue(\`🤖 \${agentName}\`) + ': waiting...',
                        eta_formatted: '',
                        duration_formatted: ''
                    });
                    this.agentBars.set(agentName, agentBar);
                }
            }
        }

        const elapsed = Date.now() - state.startTime;
        const elapsedFormatted = this.formatDuration(elapsed);
        
        let eta = 'calculating...';
        if (state.progress > 0) {
            const estimatedTotal = (elapsed / state.progress) * 100;
            const remaining = estimatedTotal - elapsed;
            eta = this.formatDuration(remaining);
        }

        const taskLabel = state.step ? 
            \`\${colors.cyan(state.taskName)} - \${colors.white(state.step)}\` : 
            colors.cyan(state.taskName);

        this.taskBar.update(state.progress, {
            task: taskLabel,
            eta_formatted: eta,
            duration_formatted: elapsedFormatted
        });

        // Update context bar (ALWAYS - user's requirement)
        if (this.contextBar) {
            const contextData = state.contextUsage || { 
                remainingPercentage: 100, 
                percentage: 0, 
                tokens: 0, 
                isWarning: false 
            };
            
            const contextColor = contextData.isWarning ? 
                (contextData.percentage >= 70 ? 'red' : 'yellow') : 'green';
            const contextText = \`Context: \${contextData.remainingPercentage.toFixed(0)}% until auto-compact | \${contextData.tokens.toLocaleString()} tokens\`;
            
            this.contextBar.update(contextData.remainingPercentage, {
                task: colors[contextColor](contextText),
                eta_formatted: '',
                duration_formatted: ''
            });
        }

        // Update agent bars if multi-agent
        if (this.isMultiAgent && state.agents) {
            for (const [agentName, agentData] of Object.entries(state.agents)) {
                const agentBar = this.agentBars.get(agentName);
                if (agentBar) {
                    const statusIcon = this.getStatusIcon(agentData.status);
                    const agentElapsed = agentData.startTime ? 
                        this.formatDuration(Date.now() - agentData.startTime) : '--:--';
                    
                    agentBar.update(agentData.progress, {
                        task: \`\${statusIcon} \${colors.blue(agentName)}: \${colors.white(agentData.step)}\`,
                        eta_formatted: '',
                        duration_formatted: agentElapsed
                    });
                }
            }
        } else if (this.tokenBar) {
            const totalTokens = (state.tokensIn || 0) + (state.tokensOut || 0);
            this.tokenBar.update(Math.min(totalTokens, 1000), {
                task: \`\${colors.yellow('Tokens')} In: \${colors.green(state.tokensIn || 0)} | Out: \${colors.blue(state.tokensOut || 0)}\`,
                eta_formatted: '',
                duration_formatted: ''
            });
        }
    }

    complete(state) {
        if (this.taskBar) {
            this.taskBar.update(100);
            this.multibar.stop();
            
            const elapsed = Date.now() - state.startTime;
            const elapsedFormatted = this.formatDuration(elapsed);
            
            console.log(colors.gray('━'.repeat(60)));
            console.log(colors.green(\`✅ Task completed: \${state.taskName}\`));
            console.log(colors.gray(\`⏱️  Duration: \${elapsedFormatted}\`));
            console.log(colors.gray(\`📊 Tokens used - In: \${state.tokensIn} | Out: \${state.tokensOut} | Total: \${state.tokensIn + state.tokensOut}\`));
            
            if (state.tokensIn > 0 || state.tokensOut > 0) {
                const tokensPerSecond = ((state.tokensIn + state.tokensOut) / (elapsed / 1000)).toFixed(2);
                console.log(colors.gray(\`🚀 Processing rate: \${tokensPerSecond} tokens/sec\`));
            }
            
            console.log('\\nPress any key to close...');
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', () => process.exit(0));
        }
    }

    start() {
        console.log('Claude Progress Monitor Started');
        console.log('Monitoring for progress updates...');
        
        const checkForUpdates = () => {
            try {
                if (fs.existsSync(progressFile)) {
                    const data = fs.readFileSync(progressFile, 'utf8');
                    const state = JSON.parse(data);
                    
                    if (!state.isActive) {
                        this.complete(state);
                        return;
                    }
                    
                    if (!this.lastState || JSON.stringify(state) !== JSON.stringify(this.lastState)) {
                        this.updateDisplay(state);
                        this.lastState = state;
                    }
                }
            } catch (error) {
                // Ignore file read errors (file might be being written)
            }
            
            setTimeout(checkForUpdates, 100);
        };
        
        checkForUpdates();
    }
}

const overlay = new ProgressOverlay();
overlay.start();
        `;

        // Write the overlay script to a temporary file
        const overlayScriptPath = path.join(__dirname, 'progress-overlay-temp.js');
        fs.writeFileSync(overlayScriptPath, overlayScript);

        // Launch in new terminal window
        if (process.platform === 'win32') {
            this.progressProcess = spawn('cmd', ['/c', 'start', 'cmd', '/k', `node "${overlayScriptPath}"`], {
                detached: true,
                stdio: 'ignore'
            });
        } else {
            // For macOS/Linux
            this.progressProcess = spawn('gnome-terminal', ['--', 'node', overlayScriptPath], {
                detached: true,
                stdio: 'ignore'
            });
        }

        this.isRunning = true;
        console.log('🚀 Progress overlay started in separate window');
    }

    /**
     * Update progress state
     */
    updateProgressState(state) {
        try {
            fs.writeFileSync(this.progressFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('Failed to update progress state:', error);
        }
    }

    /**
     * Update task progress
     */
    updateProgress(percentage, step = '', tokensIn = 0, tokensOut = 0) {
        if (!this.isRunning) return;

        this.updateProgressState({
            taskName: this.getCurrentState()?.taskName || 'Claude Task',
            progress: percentage,
            step,
            tokensIn,
            tokensOut,
            startTime: this.getCurrentState()?.startTime || Date.now(),
            isActive: true
        });
    }

    /**
     * Complete the task
     */
    complete() {
        if (!this.isRunning) return;

        const currentState = this.getCurrentState();
        if (currentState) {
            this.updateProgressState({
                ...currentState,
                progress: 100,
                isActive: false
            });
        }

        this.isRunning = false;
        
        // Clean up temp files after a delay
        setTimeout(() => {
            try {
                fs.unlinkSync(this.progressFile);
                fs.unlinkSync(path.join(__dirname, 'progress-overlay-temp.js'));
            } catch (error) {
                // Ignore cleanup errors
            }
        }, 5000);
    }

    /**
     * Get current progress state
     */
    getCurrentState() {
        try {
            if (fs.existsSync(this.progressFile)) {
                const data = fs.readFileSync(this.progressFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            // Return null if can't read state
        }
        return null;
    }

    /**
     * Demo function - single agent
     */
    async demo() {
        this.startOverlay('Claude Code Analysis');
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        const steps = [
            'Reading project structure',
            'Analyzing dependencies',
            'Scanning for patterns',
            'Generating insights',
            'Optimizing recommendations',
            'Finalizing report'
        ];

        for (let i = 0; i < steps.length; i++) {
            const progress = ((i + 1) / steps.length) * 100;
            const tokensIn = 75 + (i * 30);
            const tokensOut = 45 + (i * 40);
            
            this.updateProgress(progress, steps[i], tokensIn, tokensOut);
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        this.complete();
        console.log('✅ Demo completed! Check the separate progress window.');
    }

    /**
     * Multi-agent demo
     */
    async multiAgentDemo() {
        console.log('🚀 Multi-Agent Overlay Demo - Starting in 2 seconds...');
        
        const sessionId = 'multi_agent_demo_' + Date.now();
        const agents = ['github', 'security', 'code', 'deploy'];
        
        this.startMultiAgentOverlay(sessionId, agents, 'feature_development');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Simulate agent execution
        for (const agentName of agents) {
            this.updateAgentProgress(agentName, 0, 'starting...');
            await new Promise(resolve => setTimeout(resolve, 500));

            const steps = ['initializing...', 'processing...', 'finalizing...', 'completed'];
            for (let i = 0; i < steps.length; i++) {
                const progress = ((i + 1) / steps.length) * 100;
                this.updateAgentProgress(agentName, progress, steps[i]);
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }

        // Mark workflow complete
        this.updateMultiAgentState();
        console.log('\\n✅ Multi-Agent Demo completed! Check the separate progress window.');
        
        setTimeout(() => {
            this.complete();
        }, 3000);
    }
}

module.exports = { ClaudeProgressOverlay };

// Run demo if called directly
if (require.main === module) {
    const overlay = new ClaudeProgressOverlay();
    
    // Check if multi-agent demo requested
    const args = process.argv.slice(2);
    if (args.includes('--multi-agent')) {
        overlay.multiAgentDemo().catch(console.error);
    } else {
        overlay.demo().catch(console.error);
    }
}