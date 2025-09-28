/**
 * Progress Monitoring Service
 * Real-time progress tracking and Slack notifications every 15 minutes
 * Part of Phase 2 Task 2.4: Progress Monitoring System
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

class ProgressMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            reportInterval: config.reportInterval || 15 * 60 * 1000, // 15 minutes
            milestoneThreshold: config.milestoneThreshold || 25, // 25% progress increments
            enableSlackNotifications: config.enableSlackNotifications !== false,
            enableConsoleLogging: config.enableConsoleLogging !== false,
            maxHistoryEntries: config.maxHistoryEntries || 1000,
            ...config
        };
        
        // Monitoring state
        this.sessionId = null;
        this.executionPlan = null;
        this.currentPhase = null;
        this.currentStep = null;
        this.startTime = null;
        this.isMonitoring = false;
        
        // Progress tracking
        this.progressHistory = [];
        this.milestones = [];
        this.lastReport = null;
        this.reportTimer = null;
        
        // Statistics
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            progressReports: 0,
            milestonesReached: 0,
            estimatedTimeRemaining: null
        };
        
        console.log('📊 Progress Monitor initialized');
    }
    
    /**
     * Start monitoring autonomous execution
     */
    async startMonitoring(sessionId, executionPlan) {
        try {
            console.log(`📊 Starting progress monitoring for session: ${sessionId}`);
            
            this.sessionId = sessionId;
            this.executionPlan = executionPlan;
            this.startTime = Date.now();
            this.isMonitoring = true;
            
            // Initialize statistics
            this.stats.totalTasks = executionPlan.tasks?.length || 0;
            this.stats.completedTasks = 0;
            this.stats.failedTasks = 0;
            
            // Set up periodic reporting
            this.setupPeriodicReporting();
            
            // Initial progress report
            await this.reportProgress('monitoring', 'started', {
                sessionId: sessionId,
                totalTasks: this.stats.totalTasks,
                startTime: this.startTime
            });
            
            console.log(`✅ Progress monitoring started - reporting every ${this.config.reportInterval / 60000} minutes`);

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                sessionId: sessionId,
                monitoringStarted: this.startTime,
                totalTasks: this.stats.totalTasks
            };
            
        } catch (error) {
            console.error('❌ Failed to start progress monitoring:', error.message);
            throw error;
        }
    }
    
    /**
     * Report progress for a specific phase and step
     */
    async reportProgress(phase, step, details = {}) {
        if (!this.isMonitoring) return;
        
        const timestamp = Date.now();
        const progressEntry = {
            id: uuidv4(),
            sessionId: this.sessionId,
            phase: phase,
            step: step,
            details: details,
            timestamp: timestamp,
            uptime: timestamp - this.startTime
        };
        
        // Update current state
        this.currentPhase = phase;
        this.currentStep = step;
        
        // Add to history
        this.progressHistory.push(progressEntry);
        
        // Trim history if too large
        if (this.progressHistory.length > this.config.maxHistoryEntries) {
            this.progressHistory = this.progressHistory.slice(-this.config.maxHistoryEntries);
        }
        
        // Update statistics if this is a task completion
        if (details.taskCompleted) {
            this.stats.completedTasks++;
        }
        if (details.taskFailed) {
            this.stats.failedTasks++;
        }
        
        // Check for milestones
        await this.checkMilestones();
        
        // Console logging
        if (this.config.enableConsoleLogging) {
            console.log(`📊 Progress: ${phase} - ${step} (${this.formatUptime(progressEntry.uptime)})`);
        }
        
        // Emit progress event
        this.emit('progress', progressEntry);
        
        // Send notification if threshold reached
        const progressPercent = (this.stats.completedTasks / this.stats.totalTasks) * 100;
        if (this.shouldSendNotification(progressPercent)) {
            await this.sendProgressNotification(progressEntry, progressPercent);
        }
        
        return progressEntry;
    }
    
    /**
     * Report milestone achievement
     */
    async reportMilestone(milestone, achievements = {}) {
        const timestamp = Date.now();
        const milestoneEntry = {
            id: uuidv4(),
            sessionId: this.sessionId,
            milestone: milestone,
            achievements: achievements,
            timestamp: timestamp,
            uptime: timestamp - this.startTime
        };
        
        // Add to milestones
        this.milestones.push(milestoneEntry);
        this.stats.milestonesReached++;
        
        console.log(`🎯 Milestone achieved: ${milestone}`);
        
        // Send detailed milestone notification
        await this.sendMilestoneNotification(milestoneEntry);
        
        // Emit milestone event
        this.emit('milestone', milestoneEntry);
        
        return milestoneEntry;
    }
    
    /**
     * Set up periodic progress reporting
     */
    setupPeriodicReporting() {
        if (this.reportTimer) {
            clearInterval(this.reportTimer);
        }
        
        this.reportTimer = setInterval(async () => {
            try {
                await this.sendPeriodicReport();
                this.stats.progressReports++;
            } catch (error) {
                console.error('❌ Periodic report failed:', error.message);
            }
        }, this.config.reportInterval);
        
        console.log(`⏰ Periodic reporting scheduled every ${this.config.reportInterval / 60000} minutes`);
    }
    
    /**
     * Send periodic progress report
     */
    async sendPeriodicReport() {
        const uptime = Date.now() - this.startTime;
        const progressPercent = (this.stats.completedTasks / this.stats.totalTasks) * 100;
        
        const report = {
            sessionId: this.sessionId,
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime),
            currentPhase: this.currentPhase,
            currentStep: this.currentStep,
            progress: {
                completed: this.stats.completedTasks,
                total: this.stats.totalTasks,
                percentage: Math.round(progressPercent * 100) / 100,
                failed: this.stats.failedTasks
            },
            statistics: {
                progressReports: this.stats.progressReports,
                milestonesReached: this.stats.milestonesReached,
                estimatedTimeRemaining: this.calculateEstimatedTimeRemaining()
            },
            recentActivity: this.getRecentActivity(),
            timestamp: Date.now()
        };
        
        this.lastReport = report;
        
        // Send Slack notification
        await this.sendSlackProgressReport(report);
        
        return report;
    }
    
    /**
     * Send Slack progress notification
     */
    async sendSlackProgressReport(report) {
        if (!this.config.enableSlackNotifications) return;
        
        try {
            // Try to load and use CommAgent
            const { CommAgent } = require('../agents/comm-agent');
            const commAgent = new CommAgent(this.sessionId);
            
            const message = `🤖 **LonicFLex Autonomous Execution - Progress Report**

⏱️ **Uptime**: ${report.uptimeFormatted}
📊 **Progress**: ${report.progress.completed}/${report.progress.total} tasks (${report.progress.percentage}%)
🎯 **Current Phase**: ${report.currentPhase || 'Initializing'}
📋 **Current Step**: ${report.currentStep || 'Starting'}

📈 **Statistics**:
• Progress Reports: ${report.statistics.progressReports}
• Milestones Reached: ${report.statistics.milestonesReached}
• Failed Tasks: ${report.progress.failed}
${report.statistics.estimatedTimeRemaining ? `• Estimated Time Remaining: ${this.formatUptime(report.statistics.estimatedTimeRemaining)}` : ''}

🔄 **Recent Activity**:
${report.recentActivity.map(activity => `• ${activity.phase}: ${activity.step}`).join('\n')}

Session: \`${this.sessionId}\`
Timestamp: ${new Date(report.timestamp).toLocaleString()}`;

            await commAgent.sendSlackNotification('autonomous-execution-progress', message);
            console.log('📢 Slack progress report sent');
            
        } catch (error) {
            console.log('📝 Slack unavailable, progress logged locally:', {
                uptime: report.uptimeFormatted,
                progress: `${report.progress.completed}/${report.progress.total}`,
                phase: report.currentPhase,
                step: report.currentStep
            });
        }
    }
    
    /**
     * Send individual progress notification
     */
    async sendProgressNotification(progressEntry, progressPercent) {
        if (!this.config.enableSlackNotifications) return;
        
        try {
            const { CommAgent } = require('../agents/comm-agent');
            const commAgent = new CommAgent(this.sessionId);
            
            const message = `📊 **Progress Update** - ${Math.round(progressPercent)}% Complete

🎯 **Phase**: ${progressEntry.phase}
📋 **Step**: ${progressEntry.step}
⏱️ **Uptime**: ${this.formatUptime(progressEntry.uptime)}
📈 **Tasks**: ${this.stats.completedTasks}/${this.stats.totalTasks}

Session: \`${this.sessionId}\``;

            await commAgent.sendSlackNotification('autonomous-execution-updates', message);
            
        } catch (error) {
            // Fail silently for notifications
        }
    }
    
    /**
     * Send milestone notification
     */
    async sendMilestoneNotification(milestoneEntry) {
        if (!this.config.enableSlackNotifications) return;
        
        try {
            const { CommAgent } = require('../agents/comm-agent');
            const commAgent = new CommAgent(this.sessionId);
            
            const message = `🎯 **Milestone Achieved!**

🏆 **Milestone**: ${milestoneEntry.milestone}
⏱️ **Time Taken**: ${this.formatUptime(milestoneEntry.uptime)}
📊 **Progress**: ${this.stats.completedTasks}/${this.stats.totalTasks} tasks

🎉 **Achievements**:
${Object.entries(milestoneEntry.achievements).map(([key, value]) => `• ${key}: ${value}`).join('\n')}

Session: \`${this.sessionId}\``;

            await commAgent.sendSlackNotification('autonomous-execution-milestones', message);
            console.log('🎯 Milestone notification sent to Slack');
            
        } catch (error) {
            console.log('🎯 Milestone logged locally:', milestoneEntry.milestone);
        }
    }
    
    /**
     * Check if milestones have been reached
     */
    async checkMilestones() {
        const progressPercent = (this.stats.completedTasks / this.stats.totalTasks) * 100;
        const milestoneThresholds = [25, 50, 75, 90, 100];
        
        for (const threshold of milestoneThresholds) {
            if (progressPercent >= threshold) {
                const milestoneKey = `${threshold}_percent_complete`;
                
                // Check if we've already reported this milestone
                const alreadyReported = this.milestones.some(m => 
                    m.milestone.includes(`${threshold}%`)
                );
                
                if (!alreadyReported) {
                    await this.reportMilestone(`${threshold}% Complete`, {
                        progressPercent: threshold,
                        tasksCompleted: this.stats.completedTasks,
                        totalTasks: this.stats.totalTasks,
                        uptime: this.formatUptime(Date.now() - this.startTime)
                    });
                }
            }
        }
    }
    
    /**
     * Calculate estimated time remaining
     */
    calculateEstimatedTimeRemaining() {
        if (this.stats.completedTasks === 0) return null;
        
        const uptime = Date.now() - this.startTime;
        const averageTimePerTask = uptime / this.stats.completedTasks;
        const remainingTasks = this.stats.totalTasks - this.stats.completedTasks;
        
        return remainingTasks * averageTimePerTask;
    }
    
    /**
     * Get recent activity for reports
     */
    getRecentActivity(limit = 5) {
        return this.progressHistory
            .slice(-limit)
            .map(entry => ({
                phase: entry.phase,
                step: entry.step,
                timestamp: entry.timestamp
            }));
    }
    
    /**
     * Check if we should send a notification based on progress
     */
    shouldSendNotification(progressPercent) {
        // Send notification at milestone thresholds
        return progressPercent > 0 && progressPercent % this.config.milestoneThreshold < 1;
    }
    
    /**
     * Stop progress monitoring
     */
    async stop() {
        console.log('🛑 Stopping progress monitoring...');
        
        this.isMonitoring = false;
        
        // Clear reporting timer
        if (this.reportTimer) {
            clearInterval(this.reportTimer);
            this.reportTimer = null;
        }
        
        // Send final report
        try {
            await this.sendPeriodicReport();
            
            // Send completion notification
            await this.reportMilestone('Autonomous Execution Completed', {
                totalTasks: this.stats.totalTasks,
                completedTasks: this.stats.completedTasks,
                failedTasks: this.stats.failedTasks,
                totalUptime: this.formatUptime(Date.now() - this.startTime),
                progressReports: this.stats.progressReports,
                milestonesReached: this.stats.milestonesReached
            });
            
        } catch (error) {
            console.error('❌ Final report failed:', error.message);
        }
        
        console.log('✅ Progress monitoring stopped');
    }
    
    /**
     * Get current monitoring status
     */
    getStatus() {
        const uptime = this.startTime ? Date.now() - this.startTime : 0;
        const progressPercent = this.stats.totalTasks > 0 ? 
            (this.stats.completedTasks / this.stats.totalTasks) * 100 : 0;
        
        return {
            isMonitoring: this.isMonitoring,
            sessionId: this.sessionId,
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime),
            currentPhase: this.currentPhase,
            currentStep: this.currentStep,
            progress: {
                completed: this.stats.completedTasks,
                total: this.stats.totalTasks,
                percentage: Math.round(progressPercent * 100) / 100,
                failed: this.stats.failedTasks
            },
            statistics: this.stats,
            lastReport: this.lastReport,
            recentActivity: this.getRecentActivity()
        };
    }
    
    /**
     * Get full monitoring history
     */
    getHistory() {
        return {
            progressHistory: this.progressHistory,
            milestones: this.milestones,
            statistics: this.stats,
            sessionId: this.sessionId,
            startTime: this.startTime
        };
    }
    
    /**
     * Format uptime for display
     */
    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours}h ${minutes}m ${secs}s`;
    }
}

module.exports = { ProgressMonitor };

// If run directly, demonstrate the service
if (require.main === module) {
    (async () => {
        console.log('🧪 Testing Progress Monitoring Service...');
        
        const monitor = new ProgressMonitor({
            reportInterval: 5000, // 5 seconds for testing
            enableSlackNotifications: false // Disable for testing
        });
        
        try {
            // Start monitoring
            await monitor.startMonitoring('test-session', {
                tasks: [
                    { id: '1', name: 'Task 1' },
                    { id: '2', name: 'Task 2' },
                    { id: '3', name: 'Task 3' },
                    { id: '4', name: 'Task 4' }
                ]
            });
            
            // Simulate progress
            await new Promise(resolve => setTimeout(resolve, 1000));
            await monitor.reportProgress('implementation', 'Task 1', { taskCompleted: true });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            await monitor.reportProgress('implementation', 'Task 2', { taskCompleted: true });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            await monitor.reportProgress('testing', 'Task 3', { taskCompleted: true });
            
            // Check status
            const status = monitor.getStatus();
            console.log('Monitor status:', status);
            
            // Stop monitoring
            await monitor.stop();
            
            console.log('✅ Progress Monitoring Service test completed');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    })();
}