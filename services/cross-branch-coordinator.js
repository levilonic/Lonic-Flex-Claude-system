const { SQLiteManager } = require('../database/sqlite-manager');
const { EventEmitter } = require('events');

/**
 * Cross-Branch Coordinator
 * Manages context sharing, conflict detection, and coordination between branch-specific agents
 * Uses real SQLite database for persistence and coordination
 */
class CrossBranchCoordinator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.dbManager = options.dbManager || new SQLiteManager();
        this.sessionId = options.sessionId;
        this.repository = options.repository;
        
        // Active branch contexts
        this.branchContexts = new Map(); // branchName -> context data
        this.conflictDetectors = new Map(); // branchName -> conflict detection rules
        this.coordinationRules = new Map(); // rule type -> handler function
        
        // Coordination state
        this.activeBranches = new Set();
        this.pendingConflicts = new Map();
        this.resolutionHistory = [];
        
        this.initialized = false;
        
        // Initialize default coordination rules
        this.setupDefaultCoordinationRules();
    }

    /**
     * Initialize coordinator with database schema
     */
    async initialize() {
        if (this.initialized) return;

        if (!this.dbManager.isInitialized) {
            await this.dbManager.initialize();
        }

        // Create coordination tables
        await this.createCoordinationTables();
        
        this.initialized = true;
        console.log('✅ Cross-Branch Coordinator initialized');
    }

    /**
     * Create database tables for cross-branch coordination
     */
    async createCoordinationTables() {
        // Branch context table
        const createContextTableSQL = `
            CREATE TABLE IF NOT EXISTS branch_contexts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                branch_name TEXT NOT NULL,
                context_type TEXT NOT NULL,
                context_data TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(session_id, branch_name, context_type)
            )
        `;
        await this.dbManager.db.exec(createContextTableSQL);

        // Conflict detection table
        const createConflictTableSQL = `
            CREATE TABLE IF NOT EXISTS branch_conflicts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                branch_a TEXT NOT NULL,
                branch_b TEXT NOT NULL,
                conflict_type TEXT NOT NULL,
                conflict_data TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                resolution TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME
            )
        `;
        await this.dbManager.db.exec(createConflictTableSQL);

        // Cross-branch messages table
        const createMessagesTableSQL = `
            CREATE TABLE IF NOT EXISTS cross_branch_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                from_branch TEXT NOT NULL,
                to_branch TEXT,
                message_type TEXT NOT NULL,
                message_data TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME
            )
        `;
        await this.dbManager.db.exec(createMessagesTableSQL);

        // Coordination actions table
        const createActionsTableSQL = `
            CREATE TABLE IF NOT EXISTS coordination_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                target_branches TEXT NOT NULL,
                action_data TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                result TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
            )
        `;
        await this.dbManager.db.exec(createActionsTableSQL);
    }

    /**
     * Register a branch with the coordinator
     */
    async registerBranch(branchName, initialContext = {}) {
        if (!this.initialized) await this.initialize();

        this.activeBranches.add(branchName);
        this.branchContexts.set(branchName, {
            ...initialContext,
            registeredAt: Date.now(),
            lastActivity: Date.now()
        });

        // Store in database
        await this.storeBranchContext(branchName, 'registration', initialContext);
        
        console.log(`🌿 Registered branch: ${branchName}`);
        this.emit('branchRegistered', { branchName, initialContext });
        
        return true;
    }

    /**
     * Update context for a specific branch
     */
    async updateBranchContext(branchName, contextType, contextData) {
        if (!this.activeBranches.has(branchName)) {
            await this.registerBranch(branchName);
        }

        const currentContext = this.branchContexts.get(branchName) || {};
        const updatedContext = {
            ...currentContext,
            [contextType]: contextData,
            lastActivity: Date.now()
        };

        this.branchContexts.set(branchName, updatedContext);
        
        // Store in database
        await this.storeBranchContext(branchName, contextType, contextData);
        
        // Check for conflicts with other branches
        await this.detectConflicts(branchName, contextType, contextData);
        
        this.emit('contextUpdated', { branchName, contextType, contextData });
        
        return updatedContext;
    }

    /**
     * Get context for a specific branch
     */
    getBranchContext(branchName, contextType = null) {
        const context = this.branchContexts.get(branchName) || {};
        return contextType ? context[contextType] : context;
    }

    /**
     * Get context from all branches for coordination
     */
    getAllBranchContexts(contextType = null) {
        const allContexts = {};
        
        for (const [branchName, context] of this.branchContexts) {
            allContexts[branchName] = contextType ? context[contextType] : context;
        }
        
        return allContexts;
    }

    /**
     * Detect conflicts between branches
     */
    async detectConflicts(branchName, contextType, contextData) {
        const conflicts = [];
        
        // Check against all other branches
        for (const [otherBranch, otherContext] of this.branchContexts) {
            if (otherBranch === branchName) continue;
            
            const conflict = this.checkConflict(
                branchName, contextData,
                otherBranch, otherContext[contextType]
            );
            
            if (conflict) {
                conflicts.push({
                    branchA: branchName,
                    branchB: otherBranch,
                    conflictType: conflict.type,
                    conflictData: conflict.data,
                    severity: conflict.severity
                });
                
                // Store conflict in database
                await this.storeConflict(conflict);
            }
        }
        
        if (conflicts.length > 0) {
            console.log(`⚠️  Detected ${conflicts.length} conflict(s) for branch ${branchName}`);
            this.emit('conflictsDetected', { branchName, conflicts });
        }
        
        return conflicts;
    }

    /**
     * Check for specific conflict between two branch contexts
     */
    checkConflict(branchA, dataA, branchB, dataB) {
        if (!dataA || !dataB) return null;
        
        // File modification conflicts
        if (dataA.modifiedFiles && dataB.modifiedFiles) {
            const commonFiles = dataA.modifiedFiles.filter(file => 
                dataB.modifiedFiles.includes(file)
            );
            
            if (commonFiles.length > 0) {
                return {
                    type: 'file_modification',
                    severity: 'high',
                    data: {
                        commonFiles,
                        branchA: branchA,
                        branchB: branchB
                    }
                };
            }
        }
        
        // Database schema conflicts
        if (dataA.schemaChanges && dataB.schemaChanges) {
            const conflictingTables = dataA.schemaChanges.filter(change => 
                dataB.schemaChanges.some(otherChange => 
                    change.table === otherChange.table && change.type !== otherChange.type
                )
            );
            
            if (conflictingTables.length > 0) {
                return {
                    type: 'schema_conflict',
                    severity: 'critical',
                    data: { conflictingTables }
                };
            }
        }
        
        // API endpoint conflicts
        if (dataA.apiEndpoints && dataB.apiEndpoints) {
            const conflictingEndpoints = dataA.apiEndpoints.filter(endpoint => 
                dataB.apiEndpoints.some(otherEndpoint => 
                    endpoint.path === otherEndpoint.path && 
                    endpoint.method === otherEndpoint.method
                )
            );
            
            if (conflictingEndpoints.length > 0) {
                return {
                    type: 'api_endpoint_conflict',
                    severity: 'medium',
                    data: { conflictingEndpoints }
                };
            }
        }
        
        return null;
    }

    /**
     * Coordinate action across multiple branches
     */
    async coordinateAction(actionType, targetBranches, actionData) {
        if (!this.initialized) await this.initialize();

        const coordinationId = `coord_${Date.now()}`;
        
        console.log(`🔄 Coordinating ${actionType} across branches: ${targetBranches.join(', ')}`);
        
        // Store coordination action
        await this.storeCoordinationAction(coordinationId, actionType, targetBranches, actionData);
        
        const results = {};
        const errors = {};
        
        // Execute coordination logic based on action type
        switch (actionType) {
            case 'sync_dependencies':
                return await this.syncDependencies(targetBranches, actionData);
                
            case 'merge_preparation':
                return await this.prepareMerge(targetBranches, actionData);
                
            case 'conflict_resolution':
                return await this.resolveConflicts(targetBranches, actionData);
                
            case 'cross_branch_test':
                return await this.runCrossBranchTests(targetBranches, actionData);
                
            default:
                throw new Error(`Unknown coordination action: ${actionType}`);
        }
    }

    /**
     * Sync dependencies across branches
     */
    async syncDependencies(branches, actionData) {
        const dependencyMap = new Map();
        const conflicts = [];
        
        // Collect dependency information from all branches
        for (const branch of branches) {
            const context = this.getBranchContext(branch, 'dependencies');
            if (context) {
                for (const [pkg, version] of Object.entries(context)) {
                    if (dependencyMap.has(pkg) && dependencyMap.get(pkg) !== version) {
                        conflicts.push({
                            package: pkg,
                            versions: [dependencyMap.get(pkg), version],
                            branches: [dependencyMap.get(`${pkg}_branch`), branch]
                        });
                    }
                    dependencyMap.set(pkg, version);
                    dependencyMap.set(`${pkg}_branch`, branch);
                }
            }
        }
        
        return {
            action: 'sync_dependencies',
            branches,
            conflicts,
            syncRequired: conflicts.length > 0,
            dependencyMap: Object.fromEntries(
                Array.from(dependencyMap.entries()).filter(([key]) => !key.endsWith('_branch'))
            )
        };
    }

    /**
     * Prepare branches for merging
     */
    async prepareMerge(branches, actionData) {
        const mergePreparation = {
            conflicts: [],
            recommendations: [],
            readyToMerge: true
        };
        
        // Check for conflicts between branches
        const allConflicts = await this.getAllConflicts(branches);
        
        if (allConflicts.length > 0) {
            mergePreparation.conflicts = allConflicts;
            mergePreparation.readyToMerge = false;
            mergePreparation.recommendations.push('Resolve all conflicts before merging');
        }
        
        // Check for incomplete features
        for (const branch of branches) {
            const context = this.getBranchContext(branch, 'feature_status');
            if (context && context.status !== 'complete') {
                mergePreparation.readyToMerge = false;
                mergePreparation.recommendations.push(`Complete feature development in ${branch}`);
            }
        }
        
        return {
            action: 'merge_preparation',
            branches,
            ...mergePreparation
        };
    }

    /**
     * Resolve conflicts between branches
     */
    async resolveConflicts(branches, actionData) {
        const resolutions = [];
        const pendingConflicts = await this.getAllConflicts(branches);
        
        for (const conflict of pendingConflicts) {
            const resolution = await this.attemptConflictResolution(conflict);
            resolutions.push(resolution);
            
            if (resolution.resolved) {
                await this.markConflictResolved(conflict.id, resolution.method);
            }
        }
        
        return {
            action: 'conflict_resolution',
            branches,
            resolutions,
            totalConflicts: pendingConflicts.length,
            resolvedConflicts: resolutions.filter(r => r.resolved).length
        };
    }

    /**
     * Run cross-branch tests
     */
    async runCrossBranchTests(branches, actionData) {
        const testResults = {
            branches,
            integrationTests: [],
            compatibilityTests: [],
            overallStatus: 'pending'
        };
        
        // Mock test execution (in real implementation, would trigger actual tests)
        for (const branch of branches) {
            const context = this.getBranchContext(branch);
            
            testResults.integrationTests.push({
                branch,
                status: 'passed', // Would be actual test result
                tests: context.tests || [],
                coverage: context.coverage || 0
            });
        }
        
        // Cross-branch compatibility tests
        for (let i = 0; i < branches.length; i++) {
            for (let j = i + 1; j < branches.length; j++) {
                testResults.compatibilityTests.push({
                    branchA: branches[i],
                    branchB: branches[j],
                    status: 'passed', // Would be actual compatibility test result
                    issues: []
                });
            }
        }
        
        testResults.overallStatus = testResults.integrationTests.every(t => t.status === 'passed') &&
                                    testResults.compatibilityTests.every(t => t.status === 'passed') 
                                    ? 'passed' : 'failed';
        
        return {
            action: 'cross_branch_test',
            ...testResults
        };
    }

    /**
     * Setup default coordination rules
     */
    setupDefaultCoordinationRules() {
        this.coordinationRules.set('file_conflict', async (conflict) => {
            return {
                type: 'manual_review',
                message: 'File conflicts require manual review',
                automated: false
            };
        });

        this.coordinationRules.set('dependency_conflict', async (conflict) => {
            return {
                type: 'use_latest',
                message: 'Using latest version for dependency conflicts',
                automated: true
            };
        });
    }

    /**
     * Database operations
     */
    async storeBranchContext(branchName, contextType, contextData) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT OR REPLACE INTO branch_contexts 
            (session_id, branch_name, context_type, context_data, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        await stmt.run(
            this.sessionId,
            branchName,
            contextType,
            JSON.stringify(contextData)
        );
        await stmt.finalize();
    }

    async storeConflict(conflict) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT INTO branch_conflicts 
            (session_id, branch_a, branch_b, conflict_type, conflict_data)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        await stmt.run(
            this.sessionId,
            conflict.branchA,
            conflict.branchB,
            conflict.type,
            JSON.stringify(conflict.data)
        );
        await stmt.finalize();
    }

    async storeCoordinationAction(actionId, actionType, targetBranches, actionData) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT INTO coordination_actions 
            (session_id, action_type, target_branches, action_data)
            VALUES (?, ?, ?, ?)
        `);
        
        await stmt.run(
            this.sessionId,
            actionType,
            JSON.stringify(targetBranches),
            JSON.stringify(actionData)
        );
        await stmt.finalize();
    }

    async getAllConflicts(branches = null) {
        let query = `
            SELECT * FROM branch_conflicts 
            WHERE session_id = ? AND status = 'pending'
        `;
        let params = [this.sessionId];
        
        if (branches) {
            const branchPlaceholders = branches.map(() => '?').join(',');
            query += ` AND (branch_a IN (${branchPlaceholders}) OR branch_b IN (${branchPlaceholders}))`;
            params.push(...branches, ...branches);
        }
        
        const stmt = await this.dbManager.db.prepare(query);
        const conflicts = await stmt.all(params);
        await stmt.finalize();
        
        return conflicts.map(conflict => ({
            ...conflict,
            conflict_data: conflict.conflict_data ? JSON.parse(conflict.conflict_data) : null
        }));
    }

    async markConflictResolved(conflictId, resolutionMethod) {
        const stmt = await this.dbManager.db.prepare(`
            UPDATE branch_conflicts 
            SET status = 'resolved', resolution = ?, resolved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        await stmt.run(resolutionMethod, conflictId);
        await stmt.finalize();
    }

    async attemptConflictResolution(conflict) {
        const rule = this.coordinationRules.get(conflict.conflict_type);
        
        if (rule) {
            try {
                const resolution = await rule(conflict);
                return {
                    conflictId: conflict.id,
                    resolved: resolution.automated,
                    method: resolution.type,
                    message: resolution.message
                };
            } catch (error) {
                return {
                    conflictId: conflict.id,
                    resolved: false,
                    method: 'failed',
                    message: `Resolution failed: ${error.message}`
                };
            }
        }
        
        return {
            conflictId: conflict.id,
            resolved: false,
            method: 'no_rule',
            message: 'No resolution rule available'
        };
    }

    /**
     * Get coordinator status and statistics
     */
    getStatus() {
        return {
            initialized: this.initialized,
            activeBranches: this.activeBranches.size,
            branchNames: Array.from(this.activeBranches),
            totalContexts: this.branchContexts.size,
            coordinationRules: this.coordinationRules.size,
            pendingConflicts: this.pendingConflicts.size
        };
    }

    /**
     * Cleanup coordinator resources
     */
    async cleanup() {
        this.branchContexts.clear();
        this.activeBranches.clear();
        this.pendingConflicts.clear();
        this.removeAllListeners();
        
        console.log('🧹 Cross-Branch Coordinator cleaned up');
    }
}

module.exports = { CrossBranchCoordinator };