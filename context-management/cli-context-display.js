/**
 * CLI Context Display - Always-visible context percentage for Claude Code UI
 * Shows "77% until auto-compact" below chat box as requested
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class CLIContextDisplay {
    constructor(options = {}) {
        this.displayFile = path.join(__dirname, '../context-display-state.json');
        this.updateInterval = options.updateInterval || 5000; // 5 seconds as requested
        this.isRunning = false;
        this.intervalId = null;
        
        // Context monitoring source
        this.contextSource = null; // Will be set to Factor3ContextManager instance
        
        // Display configuration
        this.position = options.position || 'below_chat'; // below_chat, status_line, overlay
        this.alwaysVisible = options.alwaysVisible !== false;
        
        console.log('✅ CLIContextDisplay initialized');
    }

    /**
     * Start the persistent context display
     */
    startDisplay(contextSource = null) {
        if (this.isRunning) {
            console.log('⚠️ Context display already running');
            return;
        }

        this.contextSource = contextSource;
        this.isRunning = true;
        
        console.log('🖥️  Starting persistent context display...');
        
        // Create initial display state
        this.updateDisplayState();
        
        // Start the display process
        this.launchDisplayProcess();
        
        // Schedule periodic updates
        this.intervalId = setInterval(() => {
            this.updateDisplayState();
        }, this.updateInterval);
        
        console.log(`📊 Context display active - updating every ${this.updateInterval/1000}s`);
    }

    /**
     * Stop the context display
     */
    stopDisplay() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Mark display as inactive
        this.updateDisplayState({ isActive: false });
        
        console.log('🛑 Context display stopped');
    }

    /**
     * Update the display state file with current context data
     */
    async updateDisplayState(overrides = {}) {
        try {
            let contextData = {
                percentage: 0,
                remainingPercentage: 100,
                tokens: 0,
                isWarning: false,
                isCritical: false,
                lastUpdate: Date.now(),
                source: 'unknown'
            };
            
            // Get real context data if available
            if (this.contextSource?.getTokenPercentage) {
                try {
                    contextData = await this.contextSource.getTokenPercentage();
                } catch (error) {
                    console.warn('Failed to get context data:', error.message);
                }
            }
            
            const displayState = {
                isActive: this.isRunning,
                position: this.position,
                alwaysVisible: this.alwaysVisible,
                lastUpdate: Date.now(),
                context: contextData,
                display: this.formatDisplayText(contextData),
                colors: this.getDisplayColors(contextData),
                ...overrides
            };
            
            fs.writeFileSync(this.displayFile, JSON.stringify(displayState, null, 2));
        } catch (error) {
            console.error('Failed to update display state:', error);
        }
    }

    /**
     * Format the context data for display
     */
    formatDisplayText(contextData) {
        const { percentage, remainingPercentage, tokens, isWarning, isCritical } = contextData;
        
        // Main display format: "77% until auto-compact"
        const mainText = `${remainingPercentage.toFixed(0)}% until auto-compact`;
        
        // Detail format: "45,234/200,000 tokens"
        const detailText = `${tokens.toLocaleString()} tokens (${percentage.toFixed(1)}% used)`;
        
        // Status indicator
        let statusIcon = '🟢';
        let statusText = 'SAFE';
        
        if (isCritical) {
            statusIcon = '🔴';
            statusText = 'CRITICAL';
        } else if (isWarning) {
            statusIcon = '🟡';
            statusText = 'WARNING';
        }
        
        return {
            main: mainText,
            detail: detailText,
            status: `${statusIcon} ${statusText}`,
            compact: `${statusIcon} ${remainingPercentage.toFixed(0)}% left`
        };
    }

    /**
     * Get color codes for display based on context state
     */
    getDisplayColors(contextData) {
        const { percentage, isWarning, isCritical } = contextData;
        
        if (isCritical) {
            return {
                background: 'red',
                text: 'white',
                border: 'red',
                intensity: 'bright'
            };
        } else if (isWarning) {
            return {
                background: 'yellow',
                text: 'black', 
                border: 'yellow',
                intensity: 'normal'
            };
        } else {
            return {
                background: 'green',
                text: 'white',
                border: 'green', 
                intensity: 'dim'
            };
        }
    }

    /**
     * Launch the display process for persistent UI
     */
    launchDisplayProcess() {
        const displayScript = this.createDisplayScript();
        const scriptPath = path.join(__dirname, 'context-display-process.js');
        
        try {
            fs.writeFileSync(scriptPath, displayScript);
            
            if (process.platform === 'win32') {
                // For Windows - create a minimized window
                this.displayProcess = spawn('cmd', [
                    '/c', 'start', '/MIN', 
                    `"Context Monitor"`, 
                    'cmd', '/k', 
                    `node "${scriptPath}"`
                ], {
                    detached: true,
                    stdio: 'ignore'
                });
            } else {
                // For macOS/Linux - terminal in background
                this.displayProcess = spawn('node', [scriptPath], {
                    detached: true,
                    stdio: 'ignore'
                });
            }
            
            console.log('🚀 Context display process launched');
        } catch (error) {
            console.error('Failed to launch display process:', error);
        }
    }

    /**
     * Create the display process script
     */
    createDisplayScript() {
        return `
/**
 * Context Display Process - Always visible context percentage
 * This runs in a separate process to maintain persistent display
 */

const fs = require('fs');
const path = require('path');

const displayFile = '${this.displayFile.replace(/\\/g, '\\\\')}';
const updateInterval = 1000; // Check every second

class ContextDisplayProcess {
    constructor() {
        this.lastState = null;
        this.displayActive = false;
    }

    getColorCode(colorName, background = false) {
        const colors = {
            black: background ? '40' : '30',
            red: background ? '41' : '31',
            green: background ? '42' : '32', 
            yellow: background ? '43' : '33',
            blue: background ? '44' : '34',
            magenta: background ? '45' : '35',
            cyan: background ? '46' : '36',
            white: background ? '47' : '37'
        };
        return colors[colorName] || '37';
    }

    formatDisplayLine(state) {
        const { display, colors } = state;
        
        // ANSI color codes
        const bgColor = this.getColorCode(colors.background, true);
        const textColor = this.getColorCode(colors.text, false);
        const reset = '\\033[0m';
        const bold = colors.intensity === 'bright' ? '\\033[1m' : '';
        const dim = colors.intensity === 'dim' ? '\\033[2m' : '';
        
        // Format: [STATUS] Main Text | Detail Text
        const line = \`\${bold}\${dim}\\033[\${bgColor}m\\033[\${textColor}m [\${display.status}] \${display.main} | \${display.detail} \${reset}\`;
        
        return line;
    }

    displayContextInfo(state) {
        const line = this.formatDisplayLine(state);
        
        // Clear previous line and show new one
        if (this.displayActive) {
            process.stdout.write('\\033[1A\\033[2K'); // Move up and clear line
        } else {
            console.log('\\n🎯 Context Monitor Active - Real-time token usage:');
            this.displayActive = true;
        }
        
        console.log(line);
        
        // Add instructions on first display
        if (!this.displayActive) {
            console.log('\\033[2m   Updates every 5 seconds | Ctrl+C to exit\\033[0m');
        }
    }

    checkForUpdates() {
        try {
            if (fs.existsSync(displayFile)) {
                const data = fs.readFileSync(displayFile, 'utf8');
                const state = JSON.parse(data);
                
                if (!state.isActive) {
                    console.log('\\n🛑 Context monitoring stopped by main process');
                    process.exit(0);
                }
                
                if (!this.lastState || JSON.stringify(state) !== JSON.stringify(this.lastState)) {
                    this.displayContextInfo(state);
                    this.lastState = state;
                }
            }
        } catch (error) {
            // Silently handle file read errors
        }
        
        setTimeout(() => this.checkForUpdates(), updateInterval);
    }

    start() {
        console.log('📊 Context Display Process Started');
        console.log('Monitoring context usage in real-time...');
        this.checkForUpdates();
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\\n🛑 Context display process stopped');
            process.exit(0);
        });
    }
}

const display = new ContextDisplayProcess();
display.start();
        `;
    }

    /**
     * Create a status line integration (for Claude Code status bar)
     */
    async createStatusLineDisplay() {
        try {
            const contextData = this.contextSource ? 
                await this.contextSource.getTokenPercentage() : 
                { remainingPercentage: 100, isWarning: false };
            
            const statusText = `Context: ${contextData.remainingPercentage.toFixed(0)}% left`;
            const colorClass = contextData.isWarning ? 'warning' : 'normal';
            
            // Write status line format (compatible with Claude Code)
            const statusData = {
                text: statusText,
                color: colorClass,
                priority: 'high',
                persistent: true,
                lastUpdate: Date.now()
            };
            
            const statusFile = path.join(__dirname, '../claude-context-status.json');
            fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2));
            
            return statusData;
        } catch (error) {
            console.error('Failed to create status line display:', error);
            return null;
        }
    }

    /**
     * Demo function
     */
    async demo() {
        console.log('🖥️  CLI Context Display Demo\\n');
        
        // Mock context source for demo
        const mockContextSource = {
            async getTokenPercentage() {
                const mockPercentage = 35 + (Math.random() * 30); // 35-65%
                return {
                    percentage: mockPercentage,
                    remainingPercentage: 100 - mockPercentage,
                    tokens: Math.floor(mockPercentage * 2000), // Mock token count
                    isWarning: mockPercentage >= 40,
                    isCritical: mockPercentage >= 70,
                    lastUpdate: Date.now()
                };
            }
        };
        
        console.log('📊 Starting context display with mock data...');
        this.startDisplay(mockContextSource);
        
        console.log('✅ Context display is now running!');
        console.log('📱 Check for:');
        console.log('  - Separate window showing context percentage');
        console.log('  - Updates every 5 seconds');
        console.log('  - Color coding: Green (safe), Yellow (warning), Red (critical)');
        
        // Run for demo duration
        setTimeout(() => {
            console.log('\\n🛑 Demo completed - stopping context display');
            this.stopDisplay();
        }, 15000);
        
        return 'Demo running for 15 seconds...';
    }
}

module.exports = { CLIContextDisplay };

// Run demo if called directly
if (require.main === module) {
    const display = new CLIContextDisplay();
    display.demo().catch(console.error);
}