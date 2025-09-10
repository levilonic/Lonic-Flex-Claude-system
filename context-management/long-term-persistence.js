/**
 * Long-Term Persistence System - Phase 3B
 * Provides 3+ month context survival with sub-second resume times
 * Extends Universal Context System with deep archival capabilities
 */

const { TokenCounter } = require('./token-counter');
const { ContextPruner } = require('./context-pruner');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class LongTermPersistence {
    constructor(options = {}) {
        this.baseArchiveDir = options.archiveDir || path.join(process.cwd(), 'contexts', 'long-term');
        this.tokenCounter = new TokenCounter();
        this.contextPruner = new ContextPruner();
        
        // Performance targets from Phase 3B requirements
        this.targets = {
            resumeTime: 1000,        // Sub-second resume target (ms)
            deepSleepCompression: 0.2, // 20% of original size for deep sleep
            maxArchiveAge: 90 * 24 * 60 * 60 * 1000, // 90 days until deep archive
            healthCheckInterval: 24 * 60 * 60 * 1000 // Daily health checks
        };
        
        // Archive levels for progressive compression
        this.archiveLevels = {
            active: {
                name: 'Active',
                ageThreshold: 0,
                compressionRatio: 0.7, // Session default
                description: 'Currently active contexts'
            },
            dormant: {
                name: 'Dormant', 
                ageThreshold: 7 * 24 * 60 * 60 * 1000, // 7 days
                compressionRatio: 0.5,
                description: 'Inactive for a week, light compression'
            },
            sleeping: {
                name: 'Sleeping',
                ageThreshold: 30 * 24 * 60 * 60 * 1000, // 30 days
                compressionRatio: 0.3,
                description: 'Inactive for a month, moderate compression'
            },
            deep_sleep: {
                name: 'Deep Sleep',
                ageThreshold: 90 * 24 * 60 * 60 * 1000, // 90 days
                compressionRatio: 0.2,
                description: 'Long-term archive, maximum compression'
            }
        };
        
        console.log(`📁 Archive directory: ${this.baseArchiveDir}`);
        console.log('✅ LongTermPersistence initialized - 3+ month context survival ready');
    }

    /**
     * Ensure archive directory structure exists
     */
    async ensureDirectories() {
        const dirs = [
            this.baseArchiveDir,
            path.join(this.baseArchiveDir, 'sessions'),
            path.join(this.baseArchiveDir, 'projects'),
            path.join(this.baseArchiveDir, 'metadata'),
            path.join(this.baseArchiveDir, 'health-logs')
        ];

        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.mkdir(dir, { recursive: true });
                    console.log(`📁 Created directory: ${dir}`);
                }
            }
        }
    }

    /**
     * Archive context with progressive compression based on age
     */
    async archiveContext(contextId, contextData, scope = 'session') {
        const startTime = Date.now();
        console.log(`📦 Archiving ${scope} context: ${contextId}`);

        // Ensure directories exist before archiving
        await this.ensureDirectories();

        // Determine archive level based on last activity
        const lastActivity = contextData.last_activity || Date.now();
        const age = Date.now() - lastActivity;
        const archiveLevel = this.determineArchiveLevel(age);

        console.log(`🎯 Archive level: ${archiveLevel.name} (${(archiveLevel.compressionRatio * 100)}% compression)`);

        // Get context content
        const contextXml = typeof contextData.context === 'string' ? 
            contextData.context : JSON.stringify(contextData.context);

        // Apply progressive compression based on archive level
        const compressedContext = await this.applyProgressiveCompression(
            contextXml, 
            archiveLevel.compressionRatio
        );

        // Create fingerprint of compressed content (what we actually store)
        const fingerprint = this.createContextFingerprint(compressedContext);

        // Create archive metadata
        const archiveMetadata = {
            contextId,
            scope,
            archiveLevel: archiveLevel.name,
            originalSize: contextXml.length,
            compressedSize: compressedContext.length,
            compressionRatio: compressedContext.length / contextXml.length,
            fingerprint,
            originalTokens: await this.countTokens(contextXml),
            compressedTokens: await this.countTokens(compressedContext),
            archivedAt: Date.now(),
            lastActivity,
            age,
            contextMetadata: {
                scope,
                events_count: contextData.events_count || 0,
                stack_depth: contextData.stack_depth || 0,
                current_task: contextData.current_task,
                created: contextData.created
            }
        };

        // Save compressed context and metadata
        const archiveDir = path.join(this.baseArchiveDir, scope === 'project' ? 'projects' : 'sessions');
        const contextPath = path.join(archiveDir, `${contextId}.xml`);
        const metadataPath = path.join(this.baseArchiveDir, 'metadata', `${contextId}.json`);

        try {
            await fs.writeFile(contextPath, compressedContext);
            await fs.writeFile(metadataPath, JSON.stringify(archiveMetadata, null, 2));
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`📁 Directory missing, creating: ${archiveDir}`);
                await this.ensureDirectories();
                // Retry after creating directories
                await fs.writeFile(contextPath, compressedContext);
                await fs.writeFile(metadataPath, JSON.stringify(archiveMetadata, null, 2));
            } else {
                throw error;
            }
        }

        const archiveTime = Date.now() - startTime;
        console.log(`✅ Context archived in ${archiveTime}ms`);
        console.log(`📊 Size: ${contextXml.length} → ${compressedContext.length} (${(archiveMetadata.compressionRatio * 100).toFixed(1)}% of original)`);

        return {
            success: true,
            contextId,
            archiveLevel: archiveLevel.name,
            compressionRatio: archiveMetadata.compressionRatio,
            archiveTime,
            paths: {
                context: contextPath,
                metadata: metadataPath
            }
        };
    }

    /**
     * Restore context with sub-second performance target
     */
    async restoreContext(contextId, scope = 'session') {
        const startTime = Date.now();
        console.log(`🔄 Restoring ${scope} context: ${contextId}`);

        // Load metadata first for quick checks
        const metadataPath = path.join(this.baseArchiveDir, 'metadata', `${contextId}.json`);
        
        let metadata;
        try {
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(metadataContent);
        } catch (error) {
            throw new Error(`Context ${contextId} not found in archive: ${error.message}`);
        }

        // Validate scope matches
        if (metadata.scope !== scope) {
            throw new Error(`Scope mismatch: requested ${scope}, archived as ${metadata.scope}`);
        }

        // Load compressed context
        const contextPath = path.join(this.baseArchiveDir, scope === 'project' ? 'projects' : 'sessions', `${contextId}.xml`);
        const compressedContext = await fs.readFile(contextPath, 'utf8');

        // Verify integrity
        const currentFingerprint = this.createContextFingerprint(compressedContext);
        if (currentFingerprint !== metadata.fingerprint) {
            console.warn('⚠️ Context fingerprint mismatch - possible corruption');
        }

        // Apply restoration enhancement for time gaps
        const timeGap = Date.now() - metadata.lastActivity;
        const enhancedContext = await this.enhanceContextForTimeGap(
            compressedContext, 
            timeGap, 
            metadata
        );

        const restoreTime = Date.now() - startTime;
        
        // Check if we met the sub-second performance target
        const performanceStatus = restoreTime <= this.targets.resumeTime ? '🚀 TARGET MET' : '⚠️ SLOW';
        console.log(`✅ Context restored in ${restoreTime}ms ${performanceStatus}`);

        return {
            success: true,
            contextId,
            scope,
            context: enhancedContext,
            metadata: metadata,
            timeGap,
            restoreTime,
            performanceMet: restoreTime <= this.targets.resumeTime,
            restorationSummary: this.generateRestorationSummary(metadata, timeGap)
        };
    }

    /**
     * Determine appropriate archive level based on context age
     */
    determineArchiveLevel(age) {
        const levels = Object.values(this.archiveLevels).reverse(); // Check from oldest to newest
        
        for (const level of levels) {
            if (age >= level.ageThreshold) {
                return level;
            }
        }
        
        return this.archiveLevels.active;
    }

    /**
     * Apply progressive compression based on archive level
     */
    async applyProgressiveCompression(contextXml, targetCompression) {
        if (targetCompression >= 0.7) {
            // Light compression - just remove resolved errors
            return await this.contextPruner.smartPrune(contextXml, 1 - targetCompression);
        } else if (targetCompression >= 0.3) {
            // Moderate compression - smart pruning with event consolidation
            return await this.contextPruner.smartPrune(contextXml, 1 - targetCompression);
        } else {
            // Deep compression - aggressive pruning for long-term storage
            return await this.contextPruner.emergencyPrune(contextXml, 1 - targetCompression);
        }
    }

    /**
     * Enhance context when restoring after long time gaps
     */
    async enhanceContextForTimeGap(context, timeGap, metadata) {
        const days = Math.floor(timeGap / (24 * 60 * 60 * 1000));
        
        if (days < 1) {
            return context; // No enhancement needed for recent contexts
        }

        // Add time gap context to help Claude understand the situation
        const timeGapNotice = `
<context_restoration>
    timestamp: "${new Date().toISOString()}"
    context_id: "${metadata.contextId}"
    last_activity: "${new Date(metadata.lastActivity).toISOString()}"
    time_gap: "${days} days"
    archive_level: "${metadata.archiveLevel}"
    restoration_note: "This context was inactive for ${days} days. Previous work may need refreshing or updating."
    original_task: "${metadata.contextMetadata.current_task || 'Unknown'}"
    compression_applied: "${(metadata.compressionRatio * 100).toFixed(1)}% of original context preserved"
</context_restoration>

`;

        // Insert time gap notice at the beginning of the context
        const contextWithGapNotice = context.replace(
            '<workflow_context>',
            `<workflow_context>${timeGapNotice}`
        );

        return contextWithGapNotice;
    }

    /**
     * Generate restoration summary for user
     */
    generateRestorationSummary(metadata, timeGap) {
        const days = Math.floor(timeGap / (24 * 60 * 60 * 1000));
        
        return {
            message: `Context restored after ${days} day${days === 1 ? '' : 's'} of inactivity`,
            archiveLevel: metadata.archiveLevel,
            compressionApplied: `${(metadata.compressionRatio * 100).toFixed(1)}% of original context preserved`,
            originalTask: metadata.contextMetadata.current_task,
            eventsPreserved: metadata.contextMetadata.events_count || 'Unknown',
            recommendations: this.generateRestorationRecommendations(days, metadata)
        };
    }

    /**
     * Generate recommendations based on time gap and context state
     */
    generateRestorationRecommendations(days, metadata) {
        const recommendations = [];

        if (days > 30) {
            recommendations.push('Consider reviewing project status - significant time has passed');
            recommendations.push('Check if dependencies or requirements have changed');
        }

        if (days > 7) {
            recommendations.push('Review previous work and current goals');
        }

        if (metadata.archiveLevel === 'Deep Sleep') {
            recommendations.push('Context was heavily compressed - some detail may be lost');
            recommendations.push('Consider creating a fresh context if starting new work');
        }

        if (!metadata.contextMetadata.current_task) {
            recommendations.push('No previous task found - define current objectives');
        }

        return recommendations.length > 0 ? recommendations : ['Context appears ready to resume'];
    }

    /**
     * Create context fingerprint for integrity checking
     */
    createContextFingerprint(content) {
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    /**
     * Count tokens in context (with caching)
     */
    async countTokens(content) {
        const tokenData = await this.tokenCounter.countContextTokens(content);
        return tokenData.total_tokens;
    }

    /**
     * Get archive statistics
     */
    async getArchiveStatistics() {
        const stats = {
            totalContexts: 0,
            byScope: { sessions: 0, projects: 0 },
            byLevel: {},
            totalSizeBytes: 0,
            totalCompressedBytes: 0,
            averageCompressionRatio: 0,
            oldestContext: null,
            newestContext: null
        };

        try {
            const metadataDir = path.join(this.baseArchiveDir, 'metadata');
            const metadataFiles = await fs.readdir(metadataDir);

            for (const file of metadataFiles) {
                if (!file.endsWith('.json')) continue;

                const metadataPath = path.join(metadataDir, file);
                const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

                stats.totalContexts++;
                stats.byScope[metadata.scope]++;
                stats.byLevel[metadata.archiveLevel] = (stats.byLevel[metadata.archiveLevel] || 0) + 1;
                stats.totalSizeBytes += metadata.originalSize;
                stats.totalCompressedBytes += metadata.compressedSize;

                if (!stats.oldestContext || metadata.archivedAt < stats.oldestContext.archivedAt) {
                    stats.oldestContext = metadata;
                }
                if (!stats.newestContext || metadata.archivedAt > stats.newestContext.archivedAt) {
                    stats.newestContext = metadata;
                }
            }

            stats.averageCompressionRatio = stats.totalContexts > 0 ? 
                stats.totalCompressedBytes / stats.totalSizeBytes : 0;

        } catch (error) {
            console.error('Error calculating archive statistics:', error);
        }

        return stats;
    }

    /**
     * Clean up old deep sleep contexts beyond retention period
     */
    async cleanupExpiredContexts(retentionDays = 365) {
        const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        const cleaned = { count: 0, freedBytes: 0, errors: [] };

        try {
            const metadataDir = path.join(this.baseArchiveDir, 'metadata');
            const metadataFiles = await fs.readdir(metadataDir);

            for (const file of metadataFiles) {
                if (!file.endsWith('.json')) continue;

                const metadataPath = path.join(metadataDir, file);
                const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

                // Only clean up deep sleep contexts older than retention period
                if (metadata.archiveLevel === 'Deep Sleep' && metadata.archivedAt < cutoffTime) {
                    try {
                        const contextPath = path.join(
                            this.baseArchiveDir, 
                            metadata.scope === 'project' ? 'projects' : 'sessions',
                            `${metadata.contextId}.xml`
                        );

                        await fs.unlink(contextPath);
                        await fs.unlink(metadataPath);

                        cleaned.count++;
                        cleaned.freedBytes += metadata.compressedSize;
                    } catch (error) {
                        cleaned.errors.push(`${metadata.contextId}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
            cleaned.errors.push(`General cleanup error: ${error.message}`);
        }

        if (cleaned.count > 0) {
            console.log(`🗑️ Cleaned up ${cleaned.count} expired contexts, freed ${(cleaned.freedBytes / 1024 / 1024).toFixed(2)}MB`);
        }

        return cleaned;
    }

    /**
     * Demo showing long-term persistence capabilities
     */
    async demo() {
        console.log('📦 Long-Term Persistence Demo - 3+ Month Context Survival\n');

        // Create mock context for different ages
        const mockContext = `<workflow_context>
<session_start>
    timestamp: "2024-01-15T10:00:00Z"
    context_id: "demo-long-term"
    goal: "Implement authentication system"
</session_start>

<github_action>
    timestamp: "2024-01-15T10:30:00Z"
    action: "created_branch"
    branch: "feature/auth-system"
    status: "completed"
</github_action>

<code_implementation>
    timestamp: "2024-01-15T11:00:00Z"
    file: "auth/login.js"
    status: "implemented"
    tests_passing: true
</code_implementation>

<deployment>
    timestamp: "2024-01-15T15:00:00Z"
    environment: "staging"
    status: "successful"
    version: "v1.0.0"
</deployment>
</workflow_context>`;

        // Test different archive levels
        const testCases = [
            { age: 6 * 24 * 60 * 60 * 1000, name: 'Recent (6 days)' },
            { age: 45 * 24 * 60 * 60 * 1000, name: 'Month Old (45 days)' },
            { age: 120 * 24 * 60 * 60 * 1000, name: 'Very Old (120 days)' }
        ];

        for (const testCase of testCases) {
            console.log(`\n🧪 Testing ${testCase.name}:`);
            
            const contextData = {
                context: mockContext,
                last_activity: Date.now() - testCase.age,
                events_count: 4,
                current_task: 'Implement authentication system'
            };

            // Archive
            const archiveResult = await this.archiveContext('demo-context', contextData, 'session');
            console.log(`📦 Archived with ${archiveResult.archiveLevel} level`);

            // Restore
            const restoreResult = await this.restoreContext('demo-context', 'session');
            console.log(`⚡ Restore time: ${restoreResult.restoreTime}ms`);
            console.log(`📈 Performance: ${restoreResult.performanceMet ? 'TARGET MET' : 'SLOW'}`);
            console.log(`💡 Time gap: ${Math.floor(restoreResult.timeGap / (24 * 60 * 60 * 1000))} days`);

            // Clean up
            await fs.unlink(archiveResult.paths.context).catch(() => {});
            await fs.unlink(archiveResult.paths.metadata).catch(() => {});
        }

        // Show archive statistics
        console.log('\n📊 Archive Statistics:');
        const stats = await this.getArchiveStatistics();
        console.log(`Total archived: ${stats.totalContexts} contexts`);
        console.log(`Average compression: ${(stats.averageCompressionRatio * 100).toFixed(1)}%`);

        console.log('\n✅ Long-Term Persistence demo completed!');
        console.log('🎯 System ready for 3+ month context survival with sub-second resume times');
    }
}

module.exports = { LongTermPersistence };

// Run demo if called directly
if (require.main === module) {
    const ltp = new LongTermPersistence();
    ltp.demo().catch(console.error);
}