const { info, warn, error } = require('../services/logger');

/**

 * Memory Manager - Learning and Verification System

 * Extends SQLite Manager patterns for persistent memory and lesson tracking

 * Hardcoded into LonicFLex workflow to prevent repeated mistakes

 */



const { SQLiteManager } = require('../database/sqlite-manager');

const crypto = require('crypto');



class MemoryManager {

    constructor(databaseSource = null) {

        // Use shared database manager when provided

        if (databaseSource instanceof SQLiteManager) {

            this.dbManager = databaseSource;

            this.ownsDbConnection = false;

        } else {

            this.dbManager = new SQLiteManager(databaseSource);

            this.ownsDbConnection = true;

        }

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

        

        info('Memory Manager initialized - learning system active');

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



        info(`Lesson recorded: ${lessonType} for ${agentContext}`);

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

            

            verificationOutput = (result.output || '').trim();

            

            // Determine verified status based on command result

            if (result.exitCode === 0) {

                verifiedStatus = 'completed';

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

            info(`DISCREPANCY DETECTED: Task "${taskId}" claimed "${claimedStatus}" but verified as "${verifiedStatus}"`);

            

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



        info(`Pattern recorded: ${patternType} - ${actionTaken} -> ${outcome}`);

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



        info(`Loaded ${lessons.length} lessons for ${agentContext}`);

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



        info(`Loaded ${lessons.length} lessons into cache`);

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

     * Retrieve lightweight memory system statistics

     */

    async getMemoryStats() {

        if (!this.isInitialized) {

            await this.initialize();

        }



        const [lessonsRow, patternsRow, discrepanciesRow] = await Promise.all([

            this.dbManager.getSQL('SELECT COUNT(*) as count FROM memory_lessons'),

            this.dbManager.getSQL('SELECT COUNT(*) as count FROM memory_patterns'),

            this.dbManager.getSQL('SELECT COUNT(*) as count FROM status_verifications WHERE discrepancy = 1')

        ]);



        return {

            lessons: lessonsRow ? lessonsRow.count : 0,

            patterns: patternsRow ? patternsRow.count : 0,

            discrepancies: discrepanciesRow ? discrepanciesRow.count : 0,

            cacheEntries: this.lessonsCache.size,

            initialized: this.isInitialized

        };

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

        if (this.dbManager && this.ownsDbConnection && typeof this.dbManager.close === 'function') {

            await this.dbManager.close();

        }

        this.lessonsCache.clear();

        this.verificationResults.clear();

        this.isInitialized = false;

    }
}

module.exports = {
  MemoryManager
};

if (require.main === module) {
  (async () => {
    const memory = new MemoryManager();
    try {
      await memory.initialize();
      await memory.cleanup();
      info('Memory Manager demo completed');
    } catch (err) {
      error('Memory Manager demo failed:', err.message);
    }
  })();
}


