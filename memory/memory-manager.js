/**
 * Memory Manager - Learning and Verification System
 * Extends SQLite Manager patterns for persistent memory and lesson tracking
 * Hardcoded into LonicFLex workflow to prevent repeated mistakes
 */

const { SQLiteManager } = require('../database/sqlite-manager');
const crypto = require('crypto');

class MemoryManager {
    constructor(databasePath = null) {
        // Use shared database with main system
        this.dbManager = new SQLiteManager(databasePath);
        this.isInitialized = false;
        this.lessonsCache = new Map();
        this.verificationResults = new Map();
    }

    /**
     * Initialize memory system (extends existing database)
     */
    async initialize() {
        if (this.isInitialized) return;
        
        await this.dbManager.initialize();
        await this.loadLessonsCache();
        this.isInitialized = true;
        
        console.log('🧠 Memory Manager initialized - Learning system active');
        return this;
    }

    /**
     * Record a lesson learned (mistake, success, or pattern)
     * Following SQLiteManager pattern for consistency
     */
    async recordLesson(lessonType, agentContext, description, preventionRule = null, verificationCommand = null) {
        if (!this.isInitialized) await this.initialize();

        const sql = `
            INSERT INTO memory_lessons (lesson_type, agent_context, description, prevention_rule, verification_command)
            VALUES (?, ?, ?, ?, ?)
        `;

        const lessonId = await this.dbManager.runSQL(sql, [
            lessonType,
            agentContext,
            description,
            preventionRule,
            verificationCommand
        ]);

        // Update cache
        this.lessonsCache.set(`${agentContext}_${lessonType}`, {
            id: lessonId.lastID,
            type: lessonType,
            context: agentContext,
            description,
            preventionRule,
            verificationCommand,
            appliedCount: 0,
            successRate: 0.0
        });

        console.log(`📝 Lesson recorded: ${lessonType} for ${agentContext}`);
        return lessonId.lastID;
    }

    /**
     * Verify task completion status (anti-bullshit system)
     * This is the core verification that prevents false claims
     */
    async verifyTaskCompletion(taskId, claimedStatus, verificationCommand, agentName = null, sessionId = null) {
        if (!this.isInitialized) await this.initialize();

        let verifiedStatus = 'unknown';
        let verificationOutput = '';
        let discrepancy = false;

        try {
            // Run actual verification command
            const { spawn } = require('child_process');
            const result = await this.executeCommand(verificationCommand);
            
            verificationOutput = result.output;
            
            // Determine verified status based on command result
            if (result.exitCode === 0) {
                verifiedStatus = result.output.includes('❌') ? 'failed' : 'completed';
            } else {
                verifiedStatus = 'failed';
            }

            discrepancy = (claimedStatus !== verifiedStatus);

        } catch (error) {
            verifiedStatus = 'error';
            verificationOutput = `Verification failed: ${error.message}`;
            discrepancy = true;
        }

        // Store verification result
        const sql = `
            INSERT OR REPLACE INTO status_verifications 
            (task_id, claimed_status, verified_status, verification_command, verification_output, 
             discrepancy, agent_name, session_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.dbManager.runSQL(sql, [
            taskId,
            claimedStatus,
            verifiedStatus,
            verificationCommand,
            verificationOutput,
            discrepancy,
            agentName,
            sessionId
        ]);

        // Cache result
        this.verificationResults.set(taskId, {
            claimed: claimedStatus,
            verified: verifiedStatus,
            discrepancy,
            output: verificationOutput
        });

        if (discrepancy) {
            console.log(`🚨 DISCREPANCY DETECTED: Task "${taskId}" claimed "${claimedStatus}" but verified as "${verifiedStatus}"`);
            
            // Auto-record lesson about false claims
            await this.recordLesson(
                'mistake',
                agentName || 'unknown_agent',
                `False completion claim: Task "${taskId}" claimed "${claimedStatus}" but actually "${verifiedStatus}"`,
                `Always verify "${taskId}" with command: ${verificationCommand}`,
                verificationCommand
            );
        }

        return {
            taskId,
            claimed: claimedStatus,
            verified: verifiedStatus,
            discrepancy,
            output: verificationOutput
        };
    }

    /**
     * Record execution pattern for learning
     */
    async recordPattern(patternType, context, actionTaken, outcome, confidenceScore = 1.0) {
        if (!this.isInitialized) await this.initialize();

        // Create signature hash for pattern recognition
        const contextSignature = crypto.createHash('md5')
            .update(JSON.stringify(context))
            .digest('hex');

        // Check if pattern already exists
        const existing = await this.dbManager.getAllSQL(
            'SELECT * FROM memory_patterns WHERE context_signature = ? AND action_taken = ?',
            [contextSignature, actionTaken]
        );

        if (existing && existing.length > 0) {
            // Update existing pattern
            const newCount = existing[0].occurrence_count + 1;
            await this.dbManager.runSQL(
                `UPDATE memory_patterns 
                 SET occurrence_count = ?, last_seen = CURRENT_TIMESTAMP, confidence_score = ?
                 WHERE id = ?`,
                [newCount, confidenceScore, existing[0].id]
            );
        } else {
            // Insert new pattern
            await this.dbManager.runSQL(
                `INSERT INTO memory_patterns 
                 (pattern_type, context_signature, action_taken, outcome, confidence_score)
                 VALUES (?, ?, ?, ?, ?)`,
                [patternType, contextSignature, actionTaken, outcome, confidenceScore]
            );
        }

        console.log(`🔍 Pattern recorded: ${patternType} - ${actionTaken} → ${outcome}`);
    }

    /**
     * Get lessons for specific agent context (loaded at agent start)
     */
    async getLessonsForContext(agentContext) {
        if (!this.isInitialized) await this.initialize();

        const lessons = await this.dbManager.getAllSQL(
            'SELECT * FROM memory_lessons WHERE agent_context = ? ORDER BY created_at DESC',
            [agentContext]
        );

        console.log(`🧠 Loaded ${lessons.length} lessons for ${agentContext}`);
        return lessons;
    }

    /**
     * Get all verification discrepancies (honesty report)
     */
    async getDiscrepancies() {
        if (!this.isInitialized) await this.initialize();

        const discrepancies = await this.dbManager.getAllSQL(
            `SELECT * FROM status_verifications 
             WHERE discrepancy = 1 
             ORDER BY verification_timestamp DESC`
        );

        return discrepancies;
    }

    /**
     * Load lessons into cache for fast access
     */
    async loadLessonsCache() {
        const lessons = await this.dbManager.getAllSQL('SELECT * FROM memory_lessons ORDER BY created_at DESC');
        
        this.lessonsCache.clear();
        for (const lesson of lessons) {
            const key = `${lesson.agent_context}_${lesson.lesson_type}`;
            this.lessonsCache.set(key, lesson);
        }

        console.log(`🧠 Loaded ${lessons.length} lessons into cache`);
    }

    /**
     * Execute shell command for verification
     */
    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const process = spawn('sh', ['-c', command]);
            
            let output = '';
            let error = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                error += data.toString();
            });

            process.on('close', (exitCode) => {
                resolve({
                    exitCode,
                    output: output + error,
                    success: exitCode === 0
                });
            });

            process.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Generate memory system report
     */
    async generateMemoryReport() {
        if (!this.isInitialized) await this.initialize();

        const lessons = await this.dbManager.getAllSQL('SELECT COUNT(*) as count, lesson_type FROM memory_lessons GROUP BY lesson_type');
        const discrepancies = await this.getDiscrepancies();
        const patterns = await this.dbManager.getAllSQL('SELECT COUNT(*) as count, pattern_type FROM memory_patterns GROUP BY pattern_type');

        const report = {
            timestamp: new Date().toISOString(),
            lessons: lessons.reduce((acc, row) => {
                acc[row.lesson_type] = row.count;
                return acc;
            }, {}),
            totalDiscrepancies: discrepancies.length,
            recentDiscrepancies: discrepancies.slice(0, 5),
            patterns: patterns.reduce((acc, row) => {
                acc[row.pattern_type] = row.count;
                return acc;
            }, {}),
            cacheSize: this.lessonsCache.size
        };

        return report;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.dbManager) {
            await this.dbManager.close();
        }
        this.lessonsCache.clear();
        this.verificationResults.clear();
    }
}

/**
 * Demo function showing memory system capabilities
 */
async function demoMemorySystem() {
    console.log('🧠 Memory Manager Demo - Learning System\n');

    const memory = new MemoryManager();
    
    try {
        await memory.initialize();

        // Record a sample lesson
        await memory.recordLesson(
            'mistake',
            'foundation_agent',
            'Claimed 40% completion but actually only 27% verified',
            'Always run verification commands before claiming completion',
            'npm run verify-all'
        );

        // Test verification system
        console.log('🧪 Testing verification system...');
        const verification = await memory.verifyTaskCompletion(
            'demo_task_001',
            'completed',
            'echo "Test verification"',
            'demo_agent',
            'demo_session_001'
        );
        
        console.log('✅ Verification result:', verification);

        // Record a pattern
        await memory.recordPattern(
            'success',
            { agent: 'foundation', step: 'database_setup' },
            'extend_existing_schema',
            'successful_table_creation',
            0.95
        );

        // Generate report
        console.log('\n📊 Memory System Report:');
        const report = await memory.generateMemoryReport();
        console.log(JSON.stringify(report, null, 2));

        console.log('\n✅ Memory system demo completed successfully!');
        
    } catch (error) {
        console.error('❌ Memory system demo failed:', error.message);
    } finally {
        await memory.cleanup();
    }
}

module.exports = {
    MemoryManager
};

// Run demo if called directly
if (require.main === module) {
    demoMemorySystem().catch(console.error);
}