#!/usr/bin/env node
/**
 * LonicFLex Master Service - Foundation v0
 * /lx run command processor with run ID management and pipeline orchestration
 *
 * Handles:
 * - /lx run command processing
 * - Run ID generation and management
 * - Automated branch/PR creation coordination
 * - Cross-service communication and coordination
 * - Health monitoring endpoint
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');
require('dotenv').config();

class LonicFlexMasterService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.PORT || process.env.MASTER_SERVICE_PORT || 3007,
            serviceName: 'lonicflex-master',
            runIdPrefix: 'R',
            branchPrefix: 'run/',
            ...config
        };

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.contextManager = new Factor3ContextManager();
        this.activeRuns = new Map(); // runId -> run state
        this.runHistory = new Map(); // completed runs

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: `./logs/${this.config.serviceName}.log`
                })
            ]
        });

        // Service state
        this.isInitialized = false;
        this.startTime = new Date();
        this.stats = {
            totalRuns: 0,
            activeRuns: 0,
            completedRuns: 0,
            failedRuns: 0
        };
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info('Request received', {
                method: req.method,
                url: req.url,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                initialized: this.isInitialized,
                stats: this.stats,
                activeRuns: this.activeRuns.size
            });
        });

        // /lx run command endpoint (primary interface)
        this.app.post('/lx/run', async (req, res) => {
            try {
                const result = await this.processLxRun(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('LX run processing failed', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get run status
        this.app.get('/run/:runId/status', (req, res) => {
            const runId = req.params.runId;
            const run = this.activeRuns.get(runId) || this.runHistory.get(runId);

            if (!run) {
                return res.status(404).json({ error: 'Run not found' });
            }

            res.json({
                runId,
                status: run.status,
                progress: run.progress,
                steps: run.steps,
                metadata: run.metadata,
                created: run.created,
                updated: run.updated
            });
        });

        // List all runs
        this.app.get('/runs', (req, res) => {
            const activeRuns = Array.from(this.activeRuns.entries()).map(([id, run]) => ({
                runId: id,
                status: run.status,
                progress: run.progress,
                created: run.created
            }));

            const recentHistory = Array.from(this.runHistory.entries())
                .slice(-10)
                .map(([id, run]) => ({
                    runId: id,
                    status: run.status,
                    completed: run.completed
                }));

            res.json({
                active: activeRuns,
                recent: recentHistory,
                stats: this.stats
            });
        });

        // Service statistics and monitoring
        this.app.get('/stats', (req, res) => {
            res.json({
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                activeRuns: this.activeRuns.size,
                totalMemoryUsage: process.memoryUsage(),
                nodeVersion: process.version
            });
        });

        // Workflow completion notifications endpoint
        this.app.post('/api/notifications', (req, res) => {
            try {
                const { eventType, data } = req.body;

                this.logger.info('Workflow notification received', {
                    eventType,
                    workflowId: data?.workflowId
                });

                if (eventType === 'workflow_completed' && data?.workflowId) {
                    // Mark the run as completed
                    if (this.activeRuns.has(data.workflowId)) {
                        const run = this.activeRuns.get(data.workflowId);
                        run.status = 'completed';
                        run.completedAt = new Date();
                        run.result = data.results;

                        // Move to history
                        this.runHistory.set(data.workflowId, run);
                        this.activeRuns.delete(data.workflowId);

                        // Update stats
                        this.stats.completedRuns++;
                        this.stats.activeRuns = this.activeRuns.size;

                        this.logger.info('Run marked as completed', {
                            runId: data.workflowId,
                            duration: data.duration
                        });
                    }
                }

                res.json({
            success: this.validateSuccess(),   message: 'Notification processed' });

            } catch (error) {
                this.logger.error('Failed to process notification', { error: error.message });
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    /**
     * Process /lx run command - Core functionality
     */
    async processLxRun(params) {
        const {
            command,           // e.g., 'operator-crawl'
            parameters = {},   // e.g., { operator: 'Regus' }
            brief,            // Brief description or file content
            mode = 'auto',    // 'auto', 'manual', 'dry-run'
            requester         // Slack user ID or system identifier
        } = params;

        // Generate unique run ID
        const runId = this.generateRunId();
        const branchName = `${this.config.branchPrefix}${runId}`;

        this.logger.info('Processing /lx run command', {
            runId,
            command,
            parameters,
            mode,
            requester
        });

        // Create run state
        const runState = {
            runId,
            command,
            parameters,
            brief,
            mode,
            requester,
            branchName,
            status: 'initializing',
            progress: 0,
            steps: [],
            metadata: {
                created: new Date(),
                updated: new Date(),
                estimatedDuration: this.estimateRunDuration(command)
            },
            created: new Date(),
            updated: new Date()
        };

        // Store run state
        this.activeRuns.set(runId, runState);
        this.stats.totalRuns++;
        this.stats.activeRuns++;

        try {
            // Step 1: Create GitHub branch
            await this.createGitHubBranch(runState);

            // Step 2: Create draft PR (only for commands that generate commits)
            if (this.shouldCreatePR(command)) {
                await this.createDraftPR(runState);
            } else {
                this.logger.info('Skipping PR creation for non-commit command', { runId, command });
            }

            // Step 3: Trigger workflow pipeline
            await this.triggerWorkflowPipeline(runState);

            runState.status = 'running';
            runState.updated = new Date();

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                runId,
                branchName,
                status: runState.status,
                prUrl: runState.prUrl,
                estimatedDuration: runState.metadata.estimatedDuration,
                message: `Run ${runId} initiated successfully`
            };

        } catch (error) {
            runState.status = 'failed';
            runState.error = error.message;
            runState.updated = new Date();

            this.stats.failedRuns++;
            this.stats.activeRuns--;

            // Move to history
            this.runHistory.set(runId, runState);
            this.activeRuns.delete(runId);

            this.logger.error('Run failed', {
                runId,
                error: error.message,
                command: runState.command,
                mode: runState.mode
            });

            // Return failure result instead of throwing
            return {
                success: false,
                runId,
                error: error.message,
                status: 'failed',
                message: `Run ${runId} failed: ${error.message}`
            };
        }
    }

    /**
     * Generate unique run ID with timestamp
     */
    generateRunId() {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = date.getHours().toString().padStart(2, '0') +
                       date.getMinutes().toString().padStart(2, '0');
        const sequence = (this.stats.totalRuns % 999).toString().padStart(3, '0');

        return `${this.config.runIdPrefix}-${dateStr}-${timeStr}-${sequence}`;
    }

    /**
     * Create GitHub branch for the run
     */
    async createGitHubBranch(runState) {
        this.logger.info('Creating GitHub branch', {
            runId: runState.runId,
            branchName: runState.branchName
        });

        runState.steps.push({
            step: 'create_branch',
            status: 'in_progress',
            started: new Date()
        });

        try {
            // Call GitHub service to create branch
            const response = await this.callService('github', '/branches/create', {
                branchName: runState.branchName,
                runId: runState.runId,
                baseBranch: 'main',
                createInitialCommit: true,
                command: runState.command
            });

            runState.steps[runState.steps.length - 1].status = 'completed';
            runState.steps[runState.steps.length - 1].completed = new Date();
            runState.branchUrl = response.branchUrl;
            runState.branchName = response.branchName; // Update with actual branch name from GitHub

            this.logger.info('GitHub branch created successfully', {
                runId: runState.runId,
                branchName: response.branchName,
                branchUrl: response.branchUrl
            });

        } catch (error) {
            runState.steps[runState.steps.length - 1].status = 'failed';
            runState.steps[runState.steps.length - 1].error = error.message;
            throw error;
        }
    }

    /**
     * Create draft PR for the run
     */
    async createDraftPR(runState) {
        this.logger.info('Creating draft PR', { runId: runState.runId });

        runState.steps.push({
            step: 'create_pr',
            status: 'in_progress',
            started: new Date()
        });

        try {
            const prTitle = `${runState.runId} ${runState.command}`;
            const prBody = this.generatePRBody(runState);

            const response = await this.callService('github', '/prs/create', {
                head: runState.branchName,
                title: prTitle,
                body: prBody,
                draft: true,
                runId: runState.runId
            });

            runState.steps[runState.steps.length - 1].status = 'completed';
            runState.steps[runState.steps.length - 1].completed = new Date();
            runState.prUrl = response.prUrl;
            runState.prNumber = response.prNumber;

            this.logger.info('Draft PR created successfully', {
                runId: runState.runId,
                prUrl: response.prUrl,
                prNumber: response.prNumber
            });

        } catch (error) {
            runState.steps[runState.steps.length - 1].status = 'failed';
            runState.steps[runState.steps.length - 1].error = error.message;
            throw error;
        }
    }

    /**
     * Trigger the workflow pipeline
     */
    async triggerWorkflowPipeline(runState) {
        this.logger.info('Triggering workflow pipeline', { runId: runState.runId });

        runState.steps.push({
            step: 'trigger_workflow',
            status: 'in_progress',
            started: new Date()
        });

        try {
            // Map command to available template ID
            const templateMap = {
                'system-test': 'health-check',
                'deploy': 'lonicflex-deploy',
                'branch': 'branch-management',
                'health': 'health-check',
                'test': 'health-check'
            };
            const templateId = templateMap[runState.command] || 'health-check'; // Default fallback

            const response = await this.callService('workflows', '/execute', {
                templateId: templateId,
                context: {
                    runId: runState.runId,
                    parameters: runState.parameters,
                    branchName: runState.branchName,
                    prNumber: runState.prNumber
                },
                runId: runState.runId
            });

            runState.steps[runState.steps.length - 1].status = 'completed';
            runState.steps[runState.steps.length - 1].completed = new Date();
            runState.workflowId = response.workflowId;

            this.logger.info('Workflow pipeline triggered', {
                runId: runState.runId,
                workflowId: response.workflowId
            });

        } catch (error) {
            runState.steps[runState.steps.length - 1].status = 'failed';
            runState.steps[runState.steps.length - 1].error = error.message;
            throw error;
        }
    }

    /**
     * Generate PR body with run information
     */
    generatePRBody(runState) {
        return `## ${runState.runId} - ${runState.command}

### Run Information
- **Run ID**: ${runState.runId}
- **Command**: ${runState.command}
- **Parameters**: ${JSON.stringify(runState.parameters, null, 2)}
- **Requester**: ${runState.requester || 'System'}
- **Created**: ${runState.created.toISOString()}

### Brief
${runState.brief || 'No brief provided'}

### Status
🟡 **In Progress** - Pipeline execution started

---
*🤖 Generated by LonicFLex Master Service*
`;
    }

    /**
     * Estimate run duration based on command type
     */
    estimateRunDuration(command) {
        const estimates = {
            'operator-crawl': 15 * 60 * 1000,    // 15 minutes
            'security-scan': 10 * 60 * 1000,     // 10 minutes
            'code-review': 5 * 60 * 1000,        // 5 minutes
            'deployment': 20 * 60 * 1000,        // 20 minutes
            'default': 10 * 60 * 1000             // 10 minutes default
        };

        return estimates[command] || estimates.default;
    }

    /**
     * Determine if a command should create a PR (commands that generate commits)
     */
    shouldCreatePR(command) {
        const commitGeneratingCommands = [
            'deployment',
            'feature',
            'bugfix',
            'refactor',
            'operator-crawl',
            'code-review-with-fixes',
            'security-fixes',
            'update-dependencies'
        ];

        const nonCommitCommands = [
            'health-check',
            'status',
            'validate',
            'test',
            'scan',
            'security-scan'
        ];

        // If explicitly a non-commit command, return false
        if (nonCommitCommands.includes(command)) {
            return false;
        }

        // If explicitly a commit-generating command, return true
        if (commitGeneratingCommands.includes(command)) {
            return true;
        }

        // Default: assume it might generate commits for unknown commands
        return true;
    }

    /**
     * Call other LonicFLex services
     */
    async callService(serviceName, endpoint, data) {
        const serviceUrls = {
            'github': 'http://localhost:3002',
            'slack': 'http://localhost:3006',
            'webhooks': 'http://localhost:3008',
            'agents': 'http://localhost:3003',
            'workflows': 'http://localhost:3004',
            'health': 'http://localhost:3005'
        };

        const baseUrl = serviceUrls[serviceName];
        if (!baseUrl) {
            throw new Error(`Unknown service: ${serviceName}`);
        }

        // Make real HTTP call to service
        this.logger.info('Making service call', { serviceName, endpoint, url: `${baseUrl}${endpoint}` });

        try {
            // Use built-in Node.js modules
            const https = require('https');
            const http = require('http');
            const url = require('url');

            const urlParsed = new URL(`${baseUrl}${endpoint}`);
            const client = urlParsed.protocol === 'https:' ? https : http;

            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 10000
            };

            return new Promise((resolve, reject) => {
                const req = client.request(urlParsed, requestOptions, (res) => {
                    let body = '';

                    res.on('data', (chunk) => {
                        body += chunk;
                    });

                    res.on('end', () => {
                        try {
                            if (res.statusCode >= 400) {
                                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                                return;
                            }

                            const result = JSON.parse(body);
                            this.logger.info('Service call successful', { serviceName, endpoint, status: res.statusCode });
                            resolve(result);
                        } catch (parseError) {
                            reject(new Error(`Failed to parse response: ${parseError.message}`));
                        }
                    });
                });

                req.on('error', (error) => {
                    reject(error);
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                // Send the data
                req.write(JSON.stringify(data));
                req.end();
            });

        } catch (error) {
            this.logger.error('Service call failed', { serviceName, endpoint, error: error.message });
            throw new Error(`Service call to ${serviceName}${endpoint} failed: ${error.message}`);
        }
    }

    /**
     * Initialize the service
     */
    async initialize() {
        try {
            await this.db.initialize();

            this.isInitialized = true;
            this.logger.info('LonicFLex Master Service initialized', {
                port: this.config.port,
                serviceName: this.config.serviceName
            });

        } catch (error) {
            this.logger.error('Service initialization failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Start the service
     */
    async start() {
        await this.initialize();

        this.server = this.app.listen(this.config.port, () => {
            console.log(`🚀 LonicFLex Master Service running on port ${this.config.port}`);
            console.log(`📊 Health check: http://localhost:${this.config.port}/health`);
            console.log(`⚡ Ready to process /lx run commands`);

            this.logger.info('Master service started', {
                port: this.config.port,
                pid: process.pid
            });
        });

        // Graceful shutdown handling
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
    }

    /**
     * Graceful shutdown
     */
    async gracefulShutdown() {
        this.logger.info('Graceful shutdown initiated');

        if (this.server) {
            this.server.close(() => {
                this.logger.info('HTTP server closed');
                process.exit(0);
            });
        }
    }
}

// Start service if run directly
if (require.main === module) {
    const service = new LonicFlexMasterService();
    service.start().catch(error => {
        console.error('Failed to start LonicFLex Master Service:', error);
        process.exit(1);
    });
}

module.exports = { LonicFlexMasterService };