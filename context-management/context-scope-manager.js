/**
 * Context Scope Manager - Universal Context System
 * Handles session vs project scope logic and management
 * Part of LonicFLex Project Window System Phase 2
 */

const path = require('path');
const fs = require('fs').promises;

/**
 * Context Scope Definitions
 */
const SCOPE_TYPES = {
    session: {
        name: 'Session',
        description: 'Temporary context for quick work (fixes, small features)',
        identity: null,
        persistence: 'weeks',
        scope: 'existing-system',
        github: 'feature-branch',
        slack: 'thread',
        compression_ratio: 0.7,
        auto_cleanup_days: 30,
        requires_goal: false
    },
    
    project: {
        name: 'Project', 
        description: 'Long-term context for major work (new systems, refactors)',
        identity: 'PROJECT.md',
        persistence: 'months',
        scope: 'isolated',
        github: 'project-board',
        slack: 'channel',
        compression_ratio: 0.5,
        auto_cleanup_days: 365,
        requires_goal: true
    }
};

/**
 * Context Scope Manager Class
 */
class ContextScopeManager {
    constructor(options = {}) {
        this.baseDir = options.baseDir || path.join(process.cwd(), 'contexts');
        this.ensureDirectories();
    }

    /**
     * Ensure context directories exist
     */
    async ensureDirectories() {
        const dirs = [
            this.baseDir,
            path.join(this.baseDir, 'sessions'),
            path.join(this.baseDir, 'projects')
        ];

        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.mkdir(dir, { recursive: true });
                }
            }
        }
    }

    /**
     * Detect optimal scope for given context requirements
     */
    detectOptimalScope(requirements = {}) {
        const {
            goal,
            vision,
            expectedDuration,
            complexity,
            hasExternalDependencies,
            requiresIdentity
        } = requirements;

        let score = 0;
        const reasons = [];

        // Scoring system for scope detection
        if (goal && goal.length > 50) {
            score += 2;
            reasons.push('Complex goal specified');
        }

        if (vision) {
            score += 3;
            reasons.push('Long-term vision provided');
        }

        if (expectedDuration === 'months') {
            score += 4;
            reasons.push('Long-term duration expected');
        }

        if (complexity === 'high') {
            score += 2;
            reasons.push('High complexity indicated');
        }

        if (hasExternalDependencies) {
            score += 1;
            reasons.push('External dependencies involved');
        }

        if (requiresIdentity) {
            score += 3;
            reasons.push('Requires persistent identity');
        }

        const suggestedScope = score >= 4 ? 'project' : 'session';
        
        return {
            suggested_scope: suggestedScope,
            confidence: score >= 6 ? 'high' : score >= 4 ? 'medium' : 'low',
            score,
            reasons,
            alternative: suggestedScope === 'project' ? 'session' : 'project'
        };
    }

    /**
     * Validate scope upgrade requirements
     */
    validateScopeUpgrade(fromScope, toScope, context = {}) {
        if (fromScope === toScope) {
            return {
                valid: false,
                error: 'Source and target scopes are the same'
            };
        }

        if (fromScope === 'project' && toScope === 'session') {
            return {
                valid: false,
                error: 'Cannot downgrade from project to session - use archive instead'
            };
        }

        if (fromScope === 'session' && toScope === 'project') {
            const requirements = SCOPE_TYPES.project;
            const missing = [];

            if (requirements.requires_goal && !context.goal) {
                missing.push('goal');
            }

            if (missing.length > 0) {
                return {
                    valid: false,
                    error: `Missing required fields for project scope: ${missing.join(', ')}`
                };
            }

            return {
                valid: true,
                requirements_met: true,
                upgrade_benefits: [
                    'Long-term context preservation',
                    'PROJECT.md identity creation',
                    'Enhanced external integrations',
                    'Better compression for complex contexts'
                ]
            };
        }

        return {
            valid: false,
            error: 'Invalid scope combination'
        };
    }

    /**
     * Get scope configuration
     */
    getScopeConfig(scopeType) {
        const config = SCOPE_TYPES[scopeType];
        if (!config) {
            throw new Error(`Unknown scope type: ${scopeType}`);
        }

        return {
            ...config,
            directory: path.join(this.baseDir, scopeType === 'project' ? 'projects' : 'sessions'),
            timestamp: Date.now()
        };
    }

    /**
     * Generate context path for scope
     */
    generateContextPath(contextId, scopeType) {
        const scopeDir = scopeType === 'project' ? 'projects' : 'sessions';
        return path.join(this.baseDir, scopeDir, contextId);
    }

    /**
     * Create PROJECT.md for project scope
     */
    async createProjectIdentity(contextId, projectInfo) {
        const projectDir = this.generateContextPath(contextId, 'project');
        await fs.mkdir(projectDir, { recursive: true });

        const projectMdPath = path.join(projectDir, 'PROJECT.md');
        const content = this.generateProjectMdContent(projectInfo);

        await fs.writeFile(projectMdPath, content);
        
        return {
            path: projectMdPath,
            directory: projectDir,
            identity_created: true
        };
    }

    /**
     * Generate PROJECT.md content
     */
    generateProjectMdContent(projectInfo) {
        const {
            name,
            goal,
            vision,
            context,
            requirements = [],
            success_criteria = []
        } = projectInfo;

        return `# ${name}

## Project Goal
${goal || 'Define project goal here'}

## Project Vision  
${vision || 'Define long-term vision here'}

## Context
${context || 'Provide project context and background'}

## Key Requirements
${requirements.length > 0 ? requirements.map(req => `- ${req}`).join('\n') : '- Add key requirements here'}

## Success Criteria
${success_criteria.length > 0 ? success_criteria.map(crit => `- ${crit}`).join('\n') : '- Define success metrics and completion criteria'}

## Notes
Additional notes and considerations

---
*Project created: ${new Date().toISOString()}*
*Context ID: ${projectInfo.contextId || 'unknown'}*
*Scope: project*
`;
    }

    /**
     * Get all contexts of a specific scope
     */
    async getContextsByScope(scopeType) {
        const scopeDir = path.join(this.baseDir, scopeType === 'project' ? 'projects' : 'sessions');
        
        try {
            const entries = await fs.readdir(scopeDir);
            const contexts = [];

            for (const entry of entries) {
                const contextPath = path.join(scopeDir, entry);
                const stats = await fs.stat(contextPath);
                
                if (stats.isDirectory()) {
                    contexts.push({
                        id: entry,
                        scope: scopeType,
                        path: contextPath,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }

            return contexts;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    /**
     * Archive old contexts based on scope cleanup policies
     */
    async cleanupOldContexts() {
        const results = {
            sessions_cleaned: 0,
            projects_cleaned: 0,
            errors: []
        };

        for (const [scopeType, config] of Object.entries(SCOPE_TYPES)) {
            try {
                const contexts = await this.getContextsByScope(scopeType);
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - config.auto_cleanup_days);

                for (const context of contexts) {
                    if (context.modified < cutoffDate) {
                        // Archive instead of delete
                        await this.archiveContext(context.id, scopeType);
                        results[`${scopeType}s_cleaned`]++;
                    }
                }
            } catch (error) {
                results.errors.push(`${scopeType}: ${error.message}`);
            }
        }

        return results;
    }

    /**
     * Archive context (move to archive directory)
     */
    async archiveContext(contextId, scopeType) {
        const sourcePath = this.generateContextPath(contextId, scopeType);
        const archiveDir = path.join(this.baseDir, 'archive', scopeType === 'project' ? 'projects' : 'sessions');
        const archivePath = path.join(archiveDir, contextId);

        await fs.mkdir(archiveDir, { recursive: true });
        await fs.rename(sourcePath, archivePath);

        return {
            archived: true,
            from: sourcePath,
            to: archivePath,
            timestamp: Date.now()
        };
    }

    /**
     * Get scope statistics
     */
    async getScopeStatistics() {
        const stats = {
            sessions: { count: 0, total_size: 0 },
            projects: { count: 0, total_size: 0 },
            archived: { count: 0, total_size: 0 }
        };

        for (const scopeType of ['sessions', 'projects']) {
            const contexts = await this.getContextsByScope(scopeType);
            stats[scopeType].count = contexts.length;

            for (const context of contexts) {
                try {
                    const contextStats = await this.getContextSize(context.path);
                    stats[scopeType].total_size += contextStats.size;
                } catch (error) {
                    // Ignore size calculation errors
                }
            }
        }

        return stats;
    }

    /**
     * Get context directory size
     */
    async getContextSize(contextPath) {
        let totalSize = 0;

        try {
            const entries = await fs.readdir(contextPath);
            
            for (const entry of entries) {
                const entryPath = path.join(contextPath, entry);
                const stats = await fs.stat(entryPath);
                totalSize += stats.size;
            }
        } catch (error) {
            // Return 0 for inaccessible paths
        }

        return { size: totalSize, formatted: this.formatBytes(totalSize) };
    }

    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = { ContextScopeManager, SCOPE_TYPES };