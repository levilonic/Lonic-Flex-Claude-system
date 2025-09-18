#!/usr/bin/env node
/**
 * Hybrid Claude Parser - LonicFLex Foundation v0
 * Intelligent parser that combines internal workflows with Claude API integration
 *
 * This is the orchestration layer that:
 * - Uses Smart Command Router to decide routing strategy
 * - Integrates with Claude Analysis Service for AI-powered analysis
 * - Falls back gracefully to internal workflows
 * - Provides unified interface for @claude commands
 */

const { ClaudeCommandRouter } = require('./claude-command-router');
const { ClaudeAnalysisService } = require('./claude-analysis-service');
const { EnhancedClaudeParser } = require('../enhanced-claude-parser');
const { AdvancedWorkflowTemplates } = require('../advanced-workflow-templates');
const winston = require('winston');

class HybridClaudeParser {
    constructor(config = {}) {
        this.config = {
            serviceName: 'hybrid-claude-parser',
            port: config.port || 3010,

            // Integration settings
            enableClaudeIntegration: config.enableClaudeIntegration !== false,
            enableHybridMode: config.enableHybridMode !== false,
            fallbackToInternal: config.fallbackToInternal !== false,

            // Performance settings
            maxProcessingTime: config.maxProcessingTime || 30000, // 30s
            parallelProcessing: config.parallelProcessing !== false,

            ...config
        };

        // Initialize components
        try {
            this.commandRouter = new ClaudeCommandRouter(config.router || {});
            this.internalParser = new EnhancedClaudeParser();
            this.workflowTemplates = new AdvancedWorkflowTemplates();

            // Initialize Claude Analysis Service if enabled
            if (this.config.enableClaudeIntegration) {
                this.claudeService = new ClaudeAnalysisService(config.claudeService || {});
            }

        } catch (error) {
            console.warn('Claude integration disabled due to configuration error:', error.message);
            this.config.enableClaudeIntegration = false;
        }

        // Processing statistics
        this.processingStats = {
            totalCommands: 0,
            internalProcessed: 0,
            claudeProcessed: 0,
            hybridProcessed: 0,
            errorCount: 0,
            averageProcessingTime: 0,
            successRate: 0
        };

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

        this.logger.info('Hybrid Claude Parser initialized', {
            claudeIntegration: this.config.enableClaudeIntegration,
            hybridMode: this.config.enableHybridMode,
            fallbackEnabled: this.config.fallbackToInternal
        });
    }

    /**
     * Main processing method - unified interface for @claude commands
     */
    async processClaudeCommand(text, context = {}) {
        const startTime = Date.now();
        const processingId = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.processingStats.totalCommands++;

            this.logger.info('Processing Claude command', {
                processingId,
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                context: {
                    repository: context.repository,
                    pullRequest: context.pullRequest?.number,
                    issue: context.issue?.number
                }
            });

            // Step 1: Route command using Smart Command Router
            const routingDecision = await this.commandRouter.routeCommand(text, context);

            if (routingDecision.route === 'error') {
                return this.createErrorResponse(routingDecision.error, routingDecision.suggestions);
            }

            // Step 2: Process based on routing decision
            let result;
            switch (routingDecision.route) {
                case 'internal':
                    result = await this.processInternalRoute(routingDecision, text, context);
                    this.processingStats.internalProcessed++;
                    break;

                case 'claude':
                    result = await this.processClaudeRoute(routingDecision, text, context);
                    this.processingStats.claudeProcessed++;
                    break;

                case 'hybrid':
                    result = await this.processHybridRoute(routingDecision, text, context);
                    this.processingStats.hybridProcessed++;
                    break;

                default:
                    throw new Error(`Unknown routing decision: ${routingDecision.route}`);
            }

            // Step 3: Enhance result with metadata
            result.processingMetadata = {
                processingId,
                route: routingDecision.route,
                processingTime: Date.now() - startTime,
                reasoning: routingDecision.reasoning,
                estimatedCost: routingDecision.estimatedCost || 0,
                timestamp: new Date().toISOString()
            };

            this.updateProcessingStats(true, Date.now() - startTime);

            this.logger.info('Command processing completed', {
                processingId,
                route: routingDecision.route,
                processingTime: Date.now() - startTime,
                success: true
            });

            return result;

        } catch (error) {
            this.processingStats.errorCount++;
            this.updateProcessingStats(false, Date.now() - startTime);

            this.logger.error('Command processing failed', {
                processingId,
                error: error.message,
                processingTime: Date.now() - startTime
            });

            // Attempt fallback if enabled
            if (this.config.fallbackToInternal && error.message.includes('Claude')) {
                try {
                    this.logger.info('Attempting fallback to internal processing', { processingId });
                    const fallbackResult = await this.processInternalRoute({ parseResult: null }, text, context);
                    fallbackResult.processingMetadata = {
                        processingId,
                        route: 'fallback',
                        originalError: error.message,
                        processingTime: Date.now() - startTime,
                        timestamp: new Date().toISOString()
                    };
                    return fallbackResult;
                } catch (fallbackError) {
                    this.logger.error('Fallback also failed', { processingId, error: fallbackError.message });
                }
            }

            return this.createErrorResponse(error.message, this.getSuggestions(text));
        }
    }

    /**
     * Process command using internal LonicFLex workflows
     */
    async processInternalRoute(routingDecision, text, context) {
        this.logger.debug('Processing via internal route');

        // Use existing enhanced parser
        let parseResult = routingDecision.parseResult;
        if (!parseResult) {
            parseResult = this.internalParser.parseClaudeCommand(text, context);
        }

        if (!parseResult) {
            throw new Error('Unable to parse command with internal parser');
        }

        return {
            success: true,
            route: 'internal',
            command: parseResult.command,
            confidence: parseResult.confidence,
            template: parseResult.template,
            parameters: parseResult.parameters,
            workflowSteps: parseResult.template?.steps || [],
            analysis: `Command processed using internal LonicFLex workflow: ${parseResult.template?.name || parseResult.command}`,
            actionable: true,
            estimatedDuration: parseResult.template?.duration || 120000
        };
    }

    /**
     * Process command using Claude Analysis Service
     */
    async processClaudeRoute(routingDecision, text, context) {
        if (!this.config.enableClaudeIntegration || !this.claudeService) {
            throw new Error('Claude integration not available');
        }

        this.logger.debug('Processing via Claude route');

        // Determine analysis type based on command
        const analysisType = this.determineAnalysisType(routingDecision.parseResult, text);

        // Prepare analysis request
        const analysisRequest = {
            type: analysisType,
            content: text,
            context: {
                ...context,
                originalCommand: routingDecision.parseResult?.command,
                confidence: routingDecision.parseResult?.confidence,
                template: routingDecision.parseResult?.template?.name
            }
        };

        // Get Claude analysis
        const claudeResult = await this.claudeService.analyzeWithClaude(analysisRequest);

        return {
            success: true,
            route: 'claude',
            command: routingDecision.parseResult?.command || 'analyze',
            confidence: 0.95, // High confidence for Claude analysis
            analysis: claudeResult.analysis,
            structuredAnalysis: claudeResult.structuredAnalysis,
            claudeMetadata: {
                model: claudeResult.model,
                usage: claudeResult.usage,
                cost: claudeResult.estimatedCost,
                requestId: claudeResult.requestId
            },
            actionable: true,
            estimatedDuration: 0 // Already completed
        };
    }

    /**
     * Process command using hybrid approach (internal + selective Claude analysis)
     */
    async processHybridRoute(routingDecision, text, context) {
        this.logger.debug('Processing via hybrid route');

        const promises = [];

        // Start internal processing
        promises.push(
            this.processInternalRoute(routingDecision, text, context)
                .then(result => ({ type: 'internal', result }))
                .catch(error => ({ type: 'internal', error: error.message }))
        );

        // Start Claude analysis for enhancement (if enabled)
        if (this.config.enableClaudeIntegration && this.claudeService) {
            const analysisType = this.determineAnalysisType(routingDecision.parseResult, text);
            promises.push(
                this.claudeService.analyzeWithClaude({
                    type: analysisType,
                    content: this.extractRelevantContent(text, context),
                    context: context
                }).then(result => ({ type: 'claude', result }))
                .catch(error => ({ type: 'claude', error: error.message }))
            );
        }

        // Process in parallel with timeout
        const results = await Promise.allSettled(promises);

        // Combine results
        const internalResult = results.find(r => r.value?.type === 'internal')?.value;
        const claudeResult = results.find(r => r.value?.type === 'claude')?.value;

        if (!internalResult?.result) {
            throw new Error('Internal processing failed in hybrid mode');
        }

        const hybridResult = {
            success: true,
            route: 'hybrid',
            command: internalResult.result.command,
            confidence: internalResult.result.confidence,
            template: internalResult.result.template,
            parameters: internalResult.result.parameters,
            workflowSteps: internalResult.result.workflowSteps,
            analysis: internalResult.result.analysis,
            estimatedDuration: internalResult.result.estimatedDuration,
            actionable: true
        };

        // Enhance with Claude analysis if available
        if (claudeResult?.result) {
            hybridResult.enhancedAnalysis = {
                claudeInsights: claudeResult.result.analysis,
                structuredAnalysis: claudeResult.result.structuredAnalysis,
                confidence: 'enhanced',
                cost: claudeResult.result.estimatedCost
            };
        } else if (claudeResult?.error) {
            hybridResult.enhancedAnalysis = {
                error: claudeResult.error,
                fallbackUsed: true
            };
        }

        return hybridResult;
    }

    /**
     * Determine Claude analysis type based on command
     */
    determineAnalysisType(parseResult, text) {
        if (!parseResult) {
            return 'general';
        }

        const command = parseResult.command?.toLowerCase() || '';
        const textLower = text.toLowerCase();

        if (command.includes('review') || textLower.includes('review') || textLower.includes('pr')) {
            return 'code_review';
        }

        if (command.includes('security') || textLower.includes('security') || textLower.includes('audit')) {
            return 'security_audit';
        }

        if (command.includes('fix') || command.includes('bug') || textLower.includes('bug') || textLower.includes('error')) {
            return 'bug_analysis';
        }

        if (command.includes('develop') || command.includes('feature') || textLower.includes('implement')) {
            return 'feature_planning';
        }

        return 'general';
    }

    /**
     * Extract relevant content for Claude analysis
     */
    extractRelevantContent(text, context) {
        let content = text;

        // Add context information
        if (context.pullRequest) {
            content += `\n\nPull Request Context: PR #${context.pullRequest.number} - ${context.pullRequest.title}`;
        }

        if (context.issue) {
            content += `\n\nIssue Context: Issue #${context.issue.number} - ${context.issue.title}`;
        }

        if (context.files && context.files.length > 0) {
            content += `\n\nRelated Files: ${context.files.slice(0, 5).join(', ')}${context.files.length > 5 ? ` and ${context.files.length - 5} more` : ''}`;
        }

        return content;
    }

    /**
     * Create standardized error response
     */
    createErrorResponse(error, suggestions = []) {
        return {
            success: false,
            error,
            suggestions,
            route: 'error',
            actionable: false,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Update processing statistics
     */
    updateProcessingStats(success, processingTime) {
        const totalProcessed = this.processingStats.internalProcessed +
                              this.processingStats.claudeProcessed +
                              this.processingStats.hybridProcessed;

        if (success) {
            this.processingStats.averageProcessingTime =
                (this.processingStats.averageProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed;
        }

        this.processingStats.successRate =
            (totalProcessed / this.processingStats.totalCommands) * 100;
    }

    /**
     * Get command suggestions
     */
    getSuggestions(text) {
        return [
            'Try: @claude review this PR',
            'Try: @claude run security-audit',
            'Try: @claude fix bug in authentication',
            'Try: @claude deploy to staging'
        ];
    }

    /**
     * Get service health and statistics
     */
    getServiceHealth() {
        const health = {
            status: 'healthy',
            service: this.config.serviceName,
            uptime: process.uptime(),
            processing: this.processingStats,
            components: {
                commandRouter: 'healthy',
                internalParser: 'healthy',
                workflowTemplates: 'healthy'
            }
        };

        // Add Claude service health if available
        if (this.config.enableClaudeIntegration && this.claudeService) {
            try {
                health.components.claudeService = 'healthy';
                health.claudeServiceHealth = this.claudeService.getServiceHealth();
            } catch (error) {
                health.components.claudeService = 'degraded';
                health.claudeServiceError = error.message;
            }
        } else {
            health.components.claudeService = 'disabled';
        }

        // Add command router health
        try {
            health.routerStats = this.commandRouter.getUsageStats();
        } catch (error) {
            health.components.commandRouter = 'degraded';
        }

        return health;
    }
}

module.exports = { HybridClaudeParser };