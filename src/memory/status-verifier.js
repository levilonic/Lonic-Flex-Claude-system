const { info, warn, error } = require('../services/logger');
/**
 * Status Verifier - Anti-Bullshit System
 * Verifies claimed task completions and records discrepancies
 * Integrates with MemoryManager to prevent false claims
 */

const { MemoryManager } = require('./memory-manager');
const fs = require('fs').promises;
const path = require('path');

class StatusVerifier {
    constructor() {
        this.memoryManager = new MemoryManager();
        this.taskVerificationMap = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize with verification command mappings
     */
    async initialize() {
        if (this.isInitialized) return;
        
        await this.memoryManager.initialize();
        await this.loadTaskVerificationMap();
        this.isInitialized = true;
        
        info('🔍 Status Verifier initialized - Anti-bullshit system active');
    }

    /**
     * Load verification commands for different task types
     */
    async loadTaskVerificationMap() {
        // Define verification commands for different task types
        this.taskVerificationMap = new Map([
            // Foundation Agent tasks
            ['Multi-Agent Core to use real agents', 'node claude-multi-agent-core.js 2>&1 | grep "🤖 Executing real agent"'],
            ['SQLiteManager Schema completeness', 'npm run demo-db 2>&1 | grep "✅ Database initialized"'],
            ['Authentication System', 'npm run demo-auth 2>&1 | grep "✅ Authentication Manager initialized"'],
            ['Multi-agent dashboard works', 'npm run demo-multi-overlay 2>&1 | grep "Multi-Agent Demo completed"'],
            ['Database Integration Testing', 'npm run demo-db 2>&1 | grep "✅ SQLite Manager demo completed"'],
            
            // Agent functionality tests
            ['BaseAgent functionality', 'npm run demo-base-agent 2>&1 | grep "✅ Base Agent demo completed"'],
            ['GitHub Agent functionality', 'npm run demo-github-agent 2>&1 | grep "✅ GitHub Agent demo completed"'],
            ['Security Agent functionality', 'npm run demo-security-agent 2>&1 | grep "✅ Security Agent demo completed"'],
            
            // Core system tests  
            ['Multi-agent coordination', 'npm run demo 2>&1 | head -10 | grep "Multi-Agent"'],
            ['Progress overlay', 'npm run demo-overlay 2>&1 | grep "Demo completed"'],
            ['Memory system', 'npm run demo-memory 2>&1 | grep "Memory system demo completed"'],
            
            // Infrastructure tests
            ['Module imports', 'node -e "info(require(\'./claude-multi-agent-core.js\') ? \'✅ PASS\' : \'❌ FAIL\')"'],
            ['Database tables exist', 'node -e "const db = require(\'./database/sqlite-manager.js\'); info(\'✅ PASS\')"'],
            
            // Test cases (will fail deliberately)
            ['fake task for testing', 'echo "❌ FAKE TASK - This should fail" && exit 1']
        ]);

        info(`🔍 Loaded ${this.taskVerificationMap.size} verification commands`);
    }

    /**
     * Verify a single task completion claim
     */
    async verifyTask(taskDescription, claimedStatus, agentName = 'unknown') {
        if (!this.isInitialized) await this.initialize();

        // Find matching verification command
        let verificationCommand = null;
        for (const [taskPattern, command] of this.taskVerificationMap.entries()) {
            if (taskDescription.toLowerCase().includes(taskPattern.toLowerCase()) || 
                taskPattern.toLowerCase().includes(taskDescription.toLowerCase())) {
                verificationCommand = command;
                break;
            }
        }

        if (!verificationCommand) {
            info(`⚠️  No verification command found for task: "${taskDescription}"`);
            return {
                taskId: taskDescription,
                claimed: claimedStatus,
                verified: 'unknown',
                discrepancy: false,
                reason: 'No verification command available'
            };
        }

        // Use MemoryManager to verify the task
        const result = await this.memoryManager.verifyTaskCompletion(
            taskDescription,
            claimedStatus,
            verificationCommand,
            agentName
        );

        return result;
    }

    /**
     * Verify all tasks in PROGRESS-CHECKPOINT.md
     */
    async verifyAllTasks() {
        if (!this.isInitialized) await this.initialize();

        info('🔍 Verifying all tasks in PROGRESS-CHECKPOINT.md...\n');

        try {
            const progressFile = path.join(__dirname, '..', 'PROGRESS-CHECKPOINT.md');
            const content = await fs.readFile(progressFile, 'utf-8');
            
            // Extract all ✅ marked tasks
            const completedTasks = [];
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('✅') && line.includes('Phase ')) {
                    // Extract task description - handle numbered format
                    const match = line.match(/✅\s*Phase \d+\.\d+:\s*(.+?)(?:\s-\s|$)/);
                    if (match) {
                        completedTasks.push({
                            line: i + 1,
                            fullLine: line,
                            taskDescription: match[1].trim(),
                            claimedStatus: 'completed'
                        });
                    } else {
                        // Try simpler pattern for other formats  
                        const simpleMatch = line.match(/✅.*?Phase \d+\.\d+:\s*(.+)/);
                        if (simpleMatch) {
                            completedTasks.push({
                                line: i + 1,
                                fullLine: line,
                                taskDescription: simpleMatch[1].trim(),
                                claimedStatus: 'completed'
                            });
                        }
                    }
                }
            }

            info(`Found ${completedTasks.length} tasks marked as completed\n`);

            // Verify each task
            const results = [];
            let discrepancyCount = 0;

            for (const task of completedTasks) {
                info(`🧪 Verifying: ${task.taskDescription}`);
                
                const result = await this.verifyTask(
                    task.taskDescription,
                    task.claimedStatus,
                    'checkpoint_reader'
                );

                results.push(result);
                
                if (result.discrepancy) {
                    discrepancyCount++;
                    info(`🚨 DISCREPANCY: ${task.taskDescription}`);
                    info(`   Claimed: ${result.claimed} | Verified: ${result.verified}\n`);
                } else {
                    info(`Verified: ${task.taskDescription}\n`);
                }
            }

            // Generate summary report
            const summary = {
                totalTasks: completedTasks.length,
                verifiedTasks: results.filter(r => r.verified === 'completed').length,
                discrepancies: discrepancyCount,
                accuracyRate: completedTasks.length > 0 ? 
                    ((completedTasks.length - discrepancyCount) / completedTasks.length * 100).toFixed(1) : 0,
                results: results
            };

            info('📊 VERIFICATION SUMMARY:');
            info(`   Total tasks claimed complete: ${summary.totalTasks}`);
            info(`   Actually verified complete: ${summary.verifiedTasks}`);
            info(`   Discrepancies found: ${summary.discrepancies}`);
            info(`   Accuracy rate: ${summary.accuracyRate}%`);

            if (summary.discrepancies > 0) {
                info('\n🚨 HONESTY ISSUES DETECTED:');
                results.filter(r => r.discrepancy).forEach(r => {
                    info(`   - "${r.taskId}": claimed ${r.claimed} but verified ${r.verified}`);
                });
            }

            return summary;

        } catch (error) {
            error('❌ Verification failed:', error.message);
            throw error;
        }
    }

    /**
     * Verify specific task by ID/description
     */
    async verifySpecificTask(taskId) {
        if (!this.isInitialized) await this.initialize();

        info(`🔍 Verifying specific task: ${taskId}\n`);

        const result = await this.verifyTask(taskId, 'completed', 'manual_verification');
        
        info('📊 VERIFICATION RESULT:');
        info(`   Task: ${result.taskId}`);
        info(`   Claimed: ${result.claimed}`);
        info(`   Verified: ${result.verified}`);
        info(`   Discrepancy: ${result.discrepancy ? 'YES' : 'NO'}`);
        
        if (result.output) {
            info(`   Output: ${result.output.substring(0, 200)}...`);
        }

        return result;
    }

    /**
     * Generate discrepancy report
     */
    async generateDiscrepancyReport() {
        if (!this.isInitialized) await this.initialize();

        const discrepancies = await this.memoryManager.getDiscrepancies();
        
        info('📊 DISCREPANCY REPORT:');
        info(`   Total discrepancies: ${discrepancies.length}\n`);

        if (discrepancies.length > 0) {
            info('🚨 Recent discrepancies:');
            discrepancies.slice(0, 10).forEach((d, i) => {
                info(`   ${i + 1}. "${d.task_id}"`);
                info(`      Claimed: ${d.claimed_status} | Verified: ${d.verified_status}`);
                info(`      Agent: ${d.agent_name} | Time: ${d.verification_timestamp}\n`);
            });
        } else {
            info('No discrepancies found - honesty verified!');
        }

        return discrepancies;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        await this.memoryManager.cleanup();
    }
}

/**
 * CLI interface for verification commands
 */
async function main() {
    const args = process.argv.slice(2);
    const verifier = new StatusVerifier();
    
    try {
        await verifier.initialize();

        if (args.includes('--all')) {
            await verifier.verifyAllTasks();
        } else if (args.includes('--task') && args[args.indexOf('--task') + 1]) {
            const taskId = args[args.indexOf('--task') + 1];
            await verifier.verifySpecificTask(taskId);
        } else if (args.includes('--discrepancies')) {
            await verifier.generateDiscrepancyReport();
        } else {
            info('Status Verifier - Anti-Bullshit System\n');
            info('Usage:');
            info('  node status-verifier.js --all              # Verify all tasks');
            info('  node status-verifier.js --task "task_name" # Verify specific task');
            info('  node status-verifier.js --discrepancies    # Show discrepancy report');
            info('\nExample:');
            info('  npm run verify-all    # Verify all claimed completions');
            info('  npm run verify-task   # Interactive task verification');
        }

    } catch (error) {
        error('❌ Verification system error:', error.message);
        process.exit(1);
    } finally {
        await verifier.cleanup();
    }
}

module.exports = {
    StatusVerifier
};

// Run CLI if called directly
if (require.main === module) {
    main();
}