#!/usr/bin/env node
const { info, warn, error } = require('../services/logger');

/**
 * Project List Command - LonicFLex Implementation
 * Display all available project windows with status, recent activity, and resumption information
 */

const { MultiAgentCore } = require('../../integrations/claude/claude-multi-agent-core');
const { SQLiteManager } = require('./database/sqlite-manager');
const path = require('path');

class ProjectListCommand {
    constructor(options = {}) {
        this.core = new MultiAgentCore();
        this.options = {
            format: 'compact', // 'compact' | 'detailed'
            limit: 10,
            status: null, // 'active' | 'paused' | 'completed' | 'archived'
            recent: null,
            verbose: false,
            ...options
        };
    }

    /**
     * Parse command line arguments
     */
    parseArgs(args) {
        const flags = {};
        const remaining = [];

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            if (arg.startsWith('--')) {
                const [key, value] = arg.substring(2).split('=');
                
                if (value !== undefined) {
                    flags[key] = value;
                } else if (key === 'active' || key === 'paused' || key === 'completed' || key === 'archived') {
                    flags.status = key;
                } else if (key === 'verbose' || key === 'detailed') {
                    flags.verbose = true;
                    flags.format = 'detailed';
                } else {
                    // Look for value in next argument
                    if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                        flags[key] = args[++i];
                    } else {
                        flags[key] = true;
                    }
                }
            } else {
                remaining.push(arg);
            }
        }

        return { flags, remaining };
    }

    /**
     * Execute project list command
     */
    async execute(args = []) {
        try {
            const { flags } = this.parseArgs(args);
            
            // Merge flags with options
            const options = {
                ...this.options,
                ...flags,
                limit: parseInt(flags.recent || flags.limit || this.options.limit),
                status: flags.status || this.options.status
            };

            // Initialize system
            await this.core.initialize();

            // Create session for project listing
            const sessionId = `project_list_${Date.now()}`;
            await this.core.initializeSession(sessionId, 'project-management', {
                action: 'list_projects',
                options
            });

            // Get project agent and execute listing
            const projectAgent = this.core.activeAgents.get('project');
            const result = await projectAgent.execute({
                action: 'list_projects',
                limit: options.limit,
                status: options.status
            });

            if (!result.success) {
                throw new Error('Project listing failed: ' + (result.error || 'Unknown error'));
            }

            // Enhance projects with additional information
            const enhancedProjects = await this.enhanceProjectsWithDetails(result.data.projects);

            // Format and display results
            const displayResult = await this.formatProjectList(enhancedProjects, options);
            
            info(displayResult);

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                projects: enhancedProjects,
                count: enhancedProjects.length,
                options: options
            };

        } catch (error) {
            error('❌ Project list command failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        } finally {
            if (this.core) {
                await this.core.cleanup();
            }
        }
    }

    /**
     * Enhance project data with sessions, context, and activity info
     */
    async enhanceProjectsWithDetails(projects) {
        const enhanced = [];

        for (const project of projects) {
            try {
                // Get recent sessions for this project
                const sessions = await this.core.dbManager.getProjectSessions(project.id, 3);
                
                // Get important context items
                const context = await this.core.dbManager.getProjectContext(
                    project.id,
                    ['milestone', 'decision', 'note'],
                    true // preserved only
                );

                // Calculate days since last active
                const lastActiveDate = new Date(project.last_active_at || project.created_at);
                const daysSinceActive = Math.floor((Date.now() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));

                // Get status icon
                const statusIcon = this.getStatusIcon(project.status);
                
                // Get recent activity summary
                const recentActivity = await this.getRecentActivitySummary(sessions, context);

                enhanced.push({
                    ...project,
                    session_count: sessions.length,
                    last_session: sessions[0] || null,
                    key_context: context.slice(0, 2),
                    context_health: this.calculateContextHealth(context),
                    days_since_active: daysSinceActive,
                    time_since_active: this.formatTimeSince(daysSinceActive),
                    status_icon: statusIcon,
                    recent_activity: recentActivity,
                    quick_actions: this.generateQuickActions(project)
                });

            } catch (error) {
                warn(`⚠️ Could not enhance project ${project.name}:`, error.message);
                // Add basic enhancement even if detailed info fails
                enhanced.push({
                    ...project,
                    session_count: 0,
                    days_since_active: 0,
                    time_since_active: 'Unknown',
                    status_icon: this.getStatusIcon(project.status),
                    context_health: { preserved: 0, total: 0, percentage: 0 }
                });
            }
        }

        return enhanced;
    }

    /**
     * Format project list for display
     */
    async formatProjectList(projects, options) {
        if (projects.length === 0) {
            return this.formatEmptyState();
        }

        // Filter by status if specified
        let filteredProjects = projects;
        if (options.status) {
            filteredProjects = projects.filter(p => p.status === options.status);
        }

        // Sort by last active (most recent first)
        filteredProjects.sort((a, b) => {
            const dateA = new Date(a.last_active_at || a.created_at);
            const dateB = new Date(b.last_active_at || b.created_at);
            return dateB - dateA;
        });

        // Generate display
        if (options.format === 'detailed' || options.verbose) {
            return this.formatDetailedView(filteredProjects, options);
        } else {
            return this.formatCompactView(filteredProjects, options);
        }
    }

    /**
     * Format compact table view
     */
    formatCompactView(projects, options) {
        const statusCounts = this.getStatusCounts(projects);
        const header = `🏗️  Project Windows (${statusCounts.active} active, ${statusCounts.paused} paused, ${statusCounts.completed} completed)`;
        
        // Table headers
        const table = [
            '┌──────────────────┬──────────┬─────────────┬───────────────┐',
            '│ Project Name     │ Status   │ Last Active │ Sessions      │',
            '├──────────────────┼──────────┼─────────────┼───────────────┤'
        ];

        // Table rows
        for (const project of projects) {
            const name = this.truncate(project.name, 16);
            const status = `${project.status_icon} ${this.capitalize(project.status)}`;
            const lastActive = project.time_since_active;
            const sessions = `${project.session_count} sessions`;

            table.push(
                `│ ${this.pad(name, 16)} │ ${this.pad(status, 8)} │ ${this.pad(lastActive, 11)} │ ${this.pad(sessions, 13)} │`
            );
        }

        table.push('└──────────────────┴──────────┴─────────────┴───────────────┘');

        // Quick actions
        const quickActions = [
            '',
            '💡 Resume: /project-start <name> --resume',
            '💾 Quick Actions: /project-save, /project-pause',
            ''
        ];

        // Warnings and alerts
        const warnings = this.generateWarnings(projects);

        return [header, '', ...table, ...quickActions, ...warnings].join('\n');
    }

    /**
     * Format detailed view
     */
    formatDetailedView(projects, options) {
        const lines = [];
        const statusCounts = this.getStatusCounts(projects);
        
        lines.push(`🏗️  Project Windows (${projects.length} total: ${statusCounts.active} active, ${statusCounts.paused} paused, ${statusCounts.completed} completed)`);
        lines.push('');

        for (const project of projects) {
            lines.push(`${project.status_icon}  ${project.name} (${this.capitalize(project.status)})`);
            lines.push(`    🎯 Goal: ${project.goal || 'No goal specified'}`);
            
            const createdDate = new Date(project.created_at).toLocaleDateString();
            lines.push(`    📅 Created: ${createdDate} • Last Active: ${project.time_since_active}`);
            
            const contextHealth = `${project.context_health.preserved} items (${project.context_health.percentage}% preserved)`;
            lines.push(`    📊 Progress: ${project.session_count} sessions • ${contextHealth}`);
            
            if (project.recent_activity) {
                lines.push(`    🔑 Recent: "${project.recent_activity}"`);
            }
            
            lines.push(`    ▶️  Resume: /project-start ${project.name} --resume`);
            lines.push('');
        }

        // Add system health summary
        const healthSummary = this.generateHealthSummary(projects);
        lines.push(...healthSummary);

        return lines.join('\n');
    }

    /**
     * Format empty state
     */
    formatEmptyState() {
        return [
            '📭 No projects found',
            '',
            '💡 Create your first project with:',
            '   /project-start <name> --project --goal="Your project goal"',
            '',
            '📖 Learn more: /help project-system'
        ].join('\n');
    }

    /**
     * Get status icon for project
     */
    getStatusIcon(status) {
        const icons = {
            'active': '⚡',
            'paused': '⏸️',
            'completed': '✅',
            'archived': '📦',
            'blocked': '⚠️'
        };
        return icons[status] || '❓';
    }

    /**
     * Calculate context health metrics
     */
    calculateContextHealth(contextItems) {
        const total = contextItems.length;
        const preserved = contextItems.filter(item => item.preserved).length;
        const percentage = total > 0 ? Math.round((preserved / total) * 100) : 0;

        return { preserved, total, percentage };
    }

    /**
     * Format time since last activity
     */
    formatTimeSince(days) {
        if (days === 0) return 'Today';
        if (days === 1) return '1 day ago';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        if (days < 365) return `${Math.floor(days / 30)} months ago`;
        return `${Math.floor(days / 365)} years ago`;
    }

    /**
     * Get recent activity summary
     */
    async getRecentActivitySummary(sessions, contextItems) {
        // Try to get most recent meaningful activity
        if (sessions.length > 0) {
            const lastSession = sessions[0];
            if (lastSession.context_summary) {
                try {
                    const summary = JSON.parse(lastSession.context_summary);
                    if (summary.summary) {
                        return this.truncate(summary.summary, 50);
                    }
                } catch (e) {
                    // Fall through to context items
                }
            }
        }

        // Fall back to recent context items
        if (contextItems.length > 0) {
            const recent = contextItems[0];
            return this.truncate(recent.content, 50);
        }

        return null;
    }

    /**
     * Generate quick actions for project
     */
    generateQuickActions(project) {
        return [
            `/project-start ${project.name} --resume`,
            `/project-save --status="Current progress"`,
            `/project-pause ${project.name}`,
            `/project-archive ${project.name}`
        ];
    }

    /**
     * Generate warnings and alerts
     */
    generateWarnings(projects) {
        const warnings = [];
        
        // Stale projects (>30 days)
        const staleProjects = projects.filter(p => p.days_since_active > 30 && p.status === 'active');
        if (staleProjects.length > 0) {
            warnings.push('⚠️  Stale Projects (>30 days inactive):');
            staleProjects.forEach(p => {
                warnings.push(`   • ${p.name} (${p.days_since_active} days) - Consider archiving`);
            });
            warnings.push('');
        }

        // Context health issues
        const healthIssues = projects.filter(p => p.context_health.percentage < 80 && p.context_health.total > 0);
        if (healthIssues.length > 0) {
            warnings.push('⚠️  Context Health Issues:');
            healthIssues.forEach(p => {
                warnings.push(`   • ${p.name}: ${p.context_health.percentage}% preserved - Review important milestones`);
            });
            warnings.push('');
        }

        return warnings;
    }

    /**
     * Generate system health summary
     */
    generateHealthSummary(projects) {
        const summary = [];
        const totalSessions = projects.reduce((sum, p) => sum + p.session_count, 0);
        const totalContextItems = projects.reduce((sum, p) => sum + p.context_health.total, 0);
        
        summary.push('📊 System Health Summary:');
        summary.push(`   📁 ${projects.length} projects • 🔄 ${totalSessions} sessions • 💾 ${totalContextItems} context items`);
        
        const avgHealth = projects.length > 0 
            ? Math.round(projects.reduce((sum, p) => sum + p.context_health.percentage, 0) / projects.length)
            : 0;
        summary.push(`   🏥 Average context health: ${avgHealth}%`);
        
        return summary;
    }

    /**
     * Get status counts
     */
    getStatusCounts(projects) {
        const counts = { active: 0, paused: 0, completed: 0, archived: 0, blocked: 0 };
        projects.forEach(p => {
            if (counts.hasOwnProperty(p.status)) {
                counts[p.status]++;
            }
        });
        return counts;
    }

    // Utility methods
    truncate(str, length) {
        if (!str) return '';
        return str.length > length ? str.substring(0, length - 3) + '...' : str;
    }

    pad(str, length) {
        return str.padEnd(length, ' ').substring(0, length);
    }

    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// CLI execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        info(`
Project List Command - LonicFLex

USAGE:
  node project-list-command.js [OPTIONS]

OPTIONS:
  --active              Show only active projects
  --paused              Show only paused projects  
  --completed           Show only completed projects
  --archived            Show only archived projects
  --recent <N>          Show only the N most recent projects
  --verbose, --detailed Use detailed view instead of compact table
  --help, -h            Show this help message

EXAMPLES:
  node project-list-command.js
  node project-list-command.js --active
  node project-list-command.js --recent 5 --detailed
  node project-list-command.js --paused --verbose
`);
        return;
    }

    const command = new ProjectListCommand();
    await command.execute(args);
}

// Export for use as module or run as CLI
module.exports = { ProjectListCommand };

if (require.main === module) {
    main().catch(error => {
        error('❌ Command failed:', error.message);
        process.exit(1);
    });
}