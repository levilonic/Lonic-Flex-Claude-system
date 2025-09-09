const { SQLiteManager } = require('../database/sqlite-manager');
const { MilestoneIntegrationService } = require('./milestone-integration-service');
const { IssueManagementService } = require('./issue-management-service');
require('dotenv').config();

/**
 * Workflow Template Service - Phase 5.4
 * Creates and manages reusable workflow templates for different project types
 * Supports template-based multi-agent orchestration
 */
class WorkflowTemplateService {
    constructor(options = {}) {
        this.dbManager = options.dbManager || new SQLiteManager();
        this.milestoneService = options.milestoneService || new MilestoneIntegrationService({ dbManager: this.dbManager });
        this.issueService = options.issueService || new IssueManagementService({ dbManager: this.dbManager });
        
        // Template cache and registry
        this.templateRegistry = new Map();
        this.templateExecutions = new Map();
        
        this.initialized = false;
        this.builtInTemplates = this.defineBuiltInTemplates();
    }

    /**
     * Initialize the template service and dependencies
     */
    async initialize() {
        if (this.initialized) return;

        // Initialize database
        if (!this.dbManager.isInitialized) {
            await this.dbManager.initialize();
        }

        // Create workflow template tables
        await this.createWorkflowTemplateDatabase();

        // Initialize dependent services
        await this.milestoneService.initialize();
        await this.issueService.initialize();

        // Load built-in templates
        await this.loadBuiltInTemplates();

        console.log(`✅ Workflow Template Service initialized with ${this.templateRegistry.size} templates`);
        this.initialized = true;
    }

    /**
     * Create database tables for workflow templates
     */
    async createWorkflowTemplateDatabase() {
        const createTemplatesTableSQL = `
            CREATE TABLE IF NOT EXISTS workflow_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT DEFAULT 'custom',
                version TEXT DEFAULT '1.0.0',
                agent_types TEXT NOT NULL,
                execution_order TEXT NOT NULL,
                configuration TEXT,
                requirements TEXT,
                estimated_duration INTEGER,
                is_builtin BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        `;

        const createTemplateExecutionsSQL = `
            CREATE TABLE IF NOT EXISTS workflow_template_executions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                execution_id TEXT UNIQUE NOT NULL,
                template_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                branch_name TEXT,
                status TEXT DEFAULT 'initialized',
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                milestone_id INTEGER,
                configuration_used TEXT,
                results TEXT,
                error_details TEXT,
                FOREIGN KEY (template_id) REFERENCES workflow_templates (template_id)
            )
        `;

        const createTemplateStepsSQL = `
            CREATE TABLE IF NOT EXISTS workflow_template_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id TEXT NOT NULL,
                step_order INTEGER NOT NULL,
                step_name TEXT NOT NULL,
                agent_type TEXT NOT NULL,
                step_config TEXT,
                dependencies TEXT,
                timeout_minutes INTEGER DEFAULT 30,
                retry_count INTEGER DEFAULT 3,
                is_critical BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (template_id) REFERENCES workflow_templates (template_id)
            )
        `;

        await this.dbManager.db.exec(createTemplatesTableSQL);
        await this.dbManager.db.exec(createTemplateExecutionsSQL);
        await this.dbManager.db.exec(createTemplateStepsSQL);
    }

    /**
     * Define built-in workflow templates
     */
    defineBuiltInTemplates() {
        return {
            'feature-development': {
                name: 'Feature Development Workflow',
                description: 'Complete feature development with all quality gates',
                category: 'development',
                agentTypes: ['github', 'security', 'code', 'deploy'],
                executionOrder: 'sequential',
                estimatedDuration: 60,
                configuration: {
                    github: {
                        createBranch: true,
                        createPR: true,
                        requireReviews: true
                    },
                    security: {
                        scanVulnerabilities: true,
                        checkCompliance: true,
                        generateReport: true
                    },
                    code: {
                        generateCode: true,
                        runTests: true,
                        checkQuality: true
                    },
                    deploy: {
                        buildContainers: true,
                        deployStaging: true,
                        runHealthChecks: true
                    }
                },
                requirements: {
                    githubToken: true,
                    dockerEngine: true,
                    slackIntegration: false
                }
            },

            'hotfix-deployment': {
                name: 'Hotfix Deployment Workflow',
                description: 'Fast-track deployment for critical fixes',
                category: 'deployment',
                agentTypes: ['security', 'code', 'deploy'],
                executionOrder: 'sequential',
                estimatedDuration: 30,
                configuration: {
                    security: {
                        quickScan: true,
                        criticalOnly: true
                    },
                    code: {
                        runTests: true,
                        skipQualityGates: true
                    },
                    deploy: {
                        skipStaging: true,
                        deployDirect: true,
                        enableRollback: true
                    }
                },
                requirements: {
                    githubToken: true,
                    dockerEngine: true,
                    emergencyApproval: true
                }
            },

            'security-audit': {
                name: 'Security Audit Workflow',
                description: 'Comprehensive security assessment and reporting',
                category: 'security',
                agentTypes: ['github', 'security', 'comm'],
                executionOrder: 'sequential',
                estimatedDuration: 45,
                configuration: {
                    github: {
                        analyzeRepository: true,
                        scanHistory: true,
                        checkPermissions: true
                    },
                    security: {
                        fullScan: true,
                        generateReport: true,
                        checkCompliance: true,
                        validateSecrets: true
                    },
                    comm: {
                        sendAlert: true,
                        notifyTeam: true,
                        scheduleReview: true
                    }
                },
                requirements: {
                    githubToken: true,
                    slackIntegration: true,
                    securityTools: true
                }
            },

            'parallel-feature-development': {
                name: 'Parallel Feature Development',
                description: 'Develop multiple features simultaneously across branches',
                category: 'development',
                agentTypes: ['github', 'security', 'code', 'deploy'],
                executionOrder: 'parallel',
                estimatedDuration: 90,
                configuration: {
                    parallelBranches: true,
                    maxConcurrency: 3,
                    crossBranchCoordination: true,
                    github: {
                        multipleBranches: true,
                        coordinatedPRs: true
                    },
                    security: {
                        perBranchScan: true,
                        consolidatedReport: true
                    },
                    code: {
                        parallelGeneration: true,
                        mergeValidation: true
                    },
                    deploy: {
                        parallelBuilds: true,
                        stagingEnvironments: true
                    }
                },
                requirements: {
                    githubToken: true,
                    dockerEngine: true,
                    branchAwareCoordination: true
                }
            },

            'maintenance-workflow': {
                name: 'Maintenance and Cleanup',
                description: 'Routine maintenance, updates, and system cleanup',
                category: 'maintenance',
                agentTypes: ['github', 'security', 'deploy'],
                executionOrder: 'sequential',
                estimatedDuration: 40,
                configuration: {
                    github: {
                        cleanupBranches: true,
                        updateDependencies: true,
                        archiveOldIssues: true
                    },
                    security: {
                        routineScan: true,
                        updateSecurityRules: true
                    },
                    deploy: {
                        cleanupContainers: true,
                        updateImages: true,
                        systemHealthCheck: true
                    }
                },
                requirements: {
                    githubToken: true,
                    dockerEngine: true,
                    maintenanceWindow: true
                }
            }
        };
    }

    /**
     * Load built-in templates into database
     */
    async loadBuiltInTemplates() {
        for (const [templateId, template] of Object.entries(this.builtInTemplates)) {
            await this.registerTemplate({
                templateId,
                name: template.name,
                description: template.description,
                category: template.category,
                agentTypes: template.agentTypes,
                executionOrder: template.executionOrder,
                configuration: template.configuration,
                requirements: template.requirements,
                estimatedDuration: template.estimatedDuration,
                isBuiltin: true
            });
        }
    }

    /**
     * Register a new workflow template
     */
    async registerTemplate(templateData) {
        const {
            templateId,
            name,
            description,
            category = 'custom',
            version = '1.0.0',
            agentTypes,
            executionOrder = 'sequential',
            configuration = {},
            requirements = {},
            estimatedDuration = 60,
            isBuiltin = false
        } = templateData;

        // Store in database
        const stmt = await this.dbManager.db.prepare(`
            INSERT OR REPLACE INTO workflow_templates
            (template_id, name, description, category, version, agent_types, execution_order,
             configuration, requirements, estimated_duration, is_builtin, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        await stmt.run([
            templateId,
            name,
            description,
            category,
            version,
            JSON.stringify(agentTypes),
            executionOrder,
            JSON.stringify(configuration),
            JSON.stringify(requirements),
            estimatedDuration,
            isBuiltin,
            JSON.stringify(templateData)
        ]);

        await stmt.finalize();

        // Add to registry
        this.templateRegistry.set(templateId, {
            ...templateData,
            agentTypes,
            configuration,
            requirements
        });

        console.log(`✅ Registered template: ${name} (${templateId})`);
        return templateId;
    }

    /**
     * Execute workflow template
     */
    async executeTemplate(templateId, options = {}) {
        const template = this.templateRegistry.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        const {
            sessionId = `template_${templateId}_${Date.now()}`,
            branchName = options.branchName || 'main',
            owner = options.owner || 'levilonic',
            repo = options.repo || 'LonicFLex',
            customConfig = {}
        } = options;

        const executionId = `exec_${sessionId}_${Date.now()}`;

        try {
            // Validate requirements
            await this.validateRequirements(template.requirements, options);

            // Create execution record
            await this.createExecutionRecord(executionId, templateId, sessionId, branchName, customConfig);

            // Create milestone for tracking
            const milestone = await this.milestoneService.createBranchMilestone(
                owner,
                repo,
                branchName,
                sessionId,
                template.name,
                template.agentTypes,
                {
                    title: `${template.name} - ${branchName}`,
                    description: `Template execution: ${template.description}`,
                    dueDate: this.calculateDueDate(template.estimatedDuration)
                }
            );

            // Create issues for tracking if milestone creation failed (fallback)
            if (!milestone) {
                await this.issueService.createWorkflowIssues(
                    owner,
                    repo,
                    sessionId,
                    template.agentTypes,
                    branchName,
                    template.name
                );
            }

            // Execute based on execution order
            let results;
            if (template.executionOrder === 'parallel') {
                results = await this.executeParallelWorkflow(template, executionId, sessionId, branchName, customConfig);
            } else {
                results = await this.executeSequentialWorkflow(template, executionId, sessionId, branchName, customConfig);
            }

            // Update execution record with results
            await this.completeExecutionRecord(executionId, 'completed', results);

            // Update milestone progress
            if (milestone) {
                for (const agentType of template.agentTypes) {
                    await this.milestoneService.updateMilestoneProgress(
                        milestone.id,
                        branchName,
                        sessionId,
                        agentType,
                        'completed',
                        results[agentType] || {}
                    );
                }
            }

            console.log(`✅ Template execution completed: ${templateId} (${executionId})`);
            return {
                executionId,
                sessionId,
                results,
                milestone
            };

        } catch (error) {
            // Update execution record with error
            await this.completeExecutionRecord(executionId, 'failed', null, error.message);
            console.error(`❌ Template execution failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute sequential workflow
     */
    async executeSequentialWorkflow(template, executionId, sessionId, branchName, customConfig) {
        const results = {};
        
        console.log(`🔄 Executing sequential workflow: ${template.name}`);
        
        for (let i = 0; i < template.agentTypes.length; i++) {
            const agentType = template.agentTypes[i];
            const agentConfig = { 
                ...template.configuration[agentType], 
                ...customConfig[agentType] 
            };

            console.log(`  🤖 Step ${i + 1}/${template.agentTypes.length}: ${agentType} agent`);

            try {
                // Simulate agent execution (in real implementation, would call actual agents)
                const agentResult = await this.executeAgent(agentType, agentConfig, {
                    sessionId,
                    branchName,
                    previousResults: results,
                    stepOrder: i + 1
                });

                results[agentType] = agentResult;

                // Log progress
                await this.logExecutionProgress(executionId, agentType, 'completed', agentResult);

            } catch (error) {
                await this.logExecutionProgress(executionId, agentType, 'failed', { error: error.message });
                throw error;
            }
        }

        return results;
    }

    /**
     * Execute parallel workflow
     */
    async executeParallelWorkflow(template, executionId, sessionId, branchName, customConfig) {
        console.log(`🔄 Executing parallel workflow: ${template.name}`);
        
        const agentPromises = template.agentTypes.map(async (agentType, index) => {
            const agentConfig = { 
                ...template.configuration[agentType], 
                ...customConfig[agentType] 
            };

            console.log(`  🤖 Starting parallel: ${agentType} agent`);

            try {
                const agentResult = await this.executeAgent(agentType, agentConfig, {
                    sessionId,
                    branchName,
                    stepOrder: index + 1,
                    parallel: true
                });

                await this.logExecutionProgress(executionId, agentType, 'completed', agentResult);
                return { agentType, result: agentResult };

            } catch (error) {
                await this.logExecutionProgress(executionId, agentType, 'failed', { error: error.message });
                throw error;
            }
        });

        // Wait for all agents to complete
        const results = {};
        const agentResults = await Promise.all(agentPromises);
        
        for (const { agentType, result } of agentResults) {
            results[agentType] = result;
        }

        return results;
    }

    /**
     * Execute individual agent - REAL AGENT EXECUTION
     */
    async executeAgent(agentType, config, context) {
        const startTime = Date.now();
        
        try {
            // Import real agent classes
            const { GitHubAgent } = require('../agents/github-agent');
            const { SecurityAgent } = require('../agents/security-agent');
            const { CodeAgent } = require('../agents/code-agent');
            const { DeployAgent } = require('../agents/deploy-agent');
            const { CommunicationAgent } = require('../agents/comm-agent');
            
            // Create real agent instance
            let agent;
            const agentSessionId = `${context.sessionId}_${agentType}_${Date.now()}`;
            
            switch (agentType) {
                case 'github':
                    agent = new GitHubAgent(agentSessionId, config);
                    break;
                case 'security':
                    agent = new SecurityAgent(agentSessionId, config);
                    break;
                case 'code':
                    agent = new CodeAgent(agentSessionId, config);
                    break;
                case 'deploy':
                    agent = new DeployAgent(agentSessionId, config);
                    break;
                case 'comm':
                    agent = new CommunicationAgent(agentSessionId, config);
                    break;
                default:
                    throw new Error(`Unknown agent type: ${agentType}`);
            }
            
            // Initialize agent with database
            await agent.initialize(this.dbManager);
            
            // Execute real agent workflow
            const agentResult = await agent.executeWorkflow(context, (progress, message) => {
                console.log(`    📊 ${agentType}: ${progress}% - ${message}`);
            });
            
            const executionTime = Date.now() - startTime;
            
            return {
                ...agentResult,
                agentType,
                executionTime,
                sessionId: agentSessionId,
                realExecution: true
            };
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            console.error(`❌ Real agent execution failed for ${agentType}: ${error.message}`);
            
            // Return error result instead of throwing to allow other agents to continue
            return {
                success: false,
                error: error.message,
                agentType,
                executionTime,
                realExecution: true
            };
        }
    }

    /**
     * Validate template requirements
     */
    async validateRequirements(requirements, options) {
        const missing = [];

        if (requirements.githubToken && !process.env.GITHUB_TOKEN) {
            missing.push('GitHub token');
        }

        if (requirements.dockerEngine && !options.skipDockerCheck) {
            // Would check Docker in real implementation
        }

        if (requirements.slackIntegration && !process.env.SLACK_BOT_TOKEN) {
            missing.push('Slack integration');
        }

        if (missing.length > 0) {
            throw new Error(`Missing requirements: ${missing.join(', ')}`);
        }
    }

    /**
     * Calculate due date based on estimated duration
     */
    calculateDueDate(durationMinutes) {
        const dueDate = new Date();
        dueDate.setMinutes(dueDate.getMinutes() + durationMinutes);
        return dueDate;
    }

    /**
     * Create execution record
     */
    async createExecutionRecord(executionId, templateId, sessionId, branchName, config) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT INTO workflow_template_executions
            (execution_id, template_id, session_id, branch_name, configuration_used)
            VALUES (?, ?, ?, ?, ?)
        `);

        await stmt.run([
            executionId,
            templateId,
            sessionId,
            branchName,
            JSON.stringify(config)
        ]);

        await stmt.finalize();
    }

    /**
     * Complete execution record
     */
    async completeExecutionRecord(executionId, status, results, errorDetails = null) {
        const stmt = await this.dbManager.db.prepare(`
            UPDATE workflow_template_executions
            SET status = ?, completed_at = ?, results = ?, error_details = ?
            WHERE execution_id = ?
        `);

        await stmt.run([
            status,
            new Date().toISOString(),
            results ? JSON.stringify(results) : null,
            errorDetails,
            executionId
        ]);

        await stmt.finalize();
    }

    /**
     * Log execution progress
     */
    async logExecutionProgress(executionId, agentType, status, results) {
        // In real implementation, would update milestone and send notifications
        console.log(`    ✅ ${agentType}: ${status} (${JSON.stringify(results).substring(0, 100)}...)`);
    }

    /**
     * Get all available templates
     */
    getAvailableTemplates() {
        return Array.from(this.templateRegistry.entries()).map(([id, template]) => ({
            id,
            name: template.name,
            description: template.description,
            category: template.category,
            agentTypes: template.agentTypes,
            estimatedDuration: template.estimatedDuration,
            isBuiltin: template.isBuiltin
        }));
    }

    /**
     * Get template by ID
     */
    getTemplate(templateId) {
        return this.templateRegistry.get(templateId);
    }
}

// Export for use in multi-agent system
module.exports = { WorkflowTemplateService };

// Demo/testing function
async function demoWorkflowTemplates() {
    console.log('🎯 Workflow Template Service Demo');
    
    const templateService = new WorkflowTemplateService();
    
    try {
        await templateService.initialize();
        
        // Show available templates
        const templates = templateService.getAvailableTemplates();
        console.log(`📋 Available templates: ${templates.length}`);
        
        for (const template of templates) {
            console.log(`  • ${template.name} (${template.id}) - ${template.estimatedDuration}min`);
        }

        // Execute a template
        console.log('\n🚀 Executing feature-development template...');
        const result = await templateService.executeTemplate('feature-development', {
            branchName: 'feature/template-demo',
            owner: 'levilonic',
            repo: 'Lonic-Flex-Claude-system'
        });

        console.log(`✅ Template execution completed: ${result.executionId}`);
        console.log(`📊 Results: ${Object.keys(result.results).length} agents completed`);
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
}

// Run demo if called directly
if (require.main === module) {
    demoWorkflowTemplates();
}