#!/usr/bin/env node
/**
 * Claude Command Router - LonicFLex Foundation v0
 * Smart routing between internal workflows and Claude API integration
 *
 * Routes @claude commands to the most appropriate handler:
 * - Internal LonicFLex workflows (fast, cheap)
 * - Claude API integration (intelligent, costs money)
 * - Hybrid approach (internal + selective Claude enhancement)
 */

const { EnhancedClaudeParser } = require('../enhanced-claude-parser');
const winston = require('winston');

class ClaudeCommandRouter {
    constructor(config = {}) {
        this.config = {
            // Cost optimization settings
            maxClaudeCallsPerHour: config.maxClaudeCallsPerHour || 100,
            maxCostPerDay: config.maxCostPerDay || 50, // USD

            // Routing thresholds
            complexityThreshold: config.complexityThreshold || 0.7,
            confidenceThreshold: config.confidenceThreshold || 0.9,

            // Feature flags
            enableClaudeAPI: config.enableClaudeAPI !== false,
            enableHybridMode: config.enableHybridMode !== false,
            enableCostTracking: config.enableCostTracking !== false,

            ...config
        };

        this.parser = new EnhancedClaudeParser();

        // Usage tracking
        this.usageStats = {
            totalCommands: 0,
            internalRoutes: 0,
            claudeRoutes: 0,
            hybridRoutes: 0,
            costToday: 0,
            claudeCallsThisHour: 0,
            lastHourReset: new Date().getHours()
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
                    filename: './logs/claude-command-router.log'
                })
            ]
        });
    }

    /**
     * Route @claude command to appropriate handler
     */
    async routeCommand(text, context = {}) {
        try {
            this.usageStats.totalCommands++;
            this.resetHourlyCounterIfNeeded();

            // Parse command with existing parser
            const parseResult = this.parser.parseClaudeCommand(text, context);

            if (!parseResult) {
                this.logger.warn('Command parsing failed', { text, context });
                return {
                    route: 'error',
                    error: 'Unable to parse command',
                    suggestions: this.getSuggestions(text)
                };
            }

            // Analyze routing requirements
            const routingAnalysis = this.analyzeRoutingRequirements(parseResult, text, context);

            // Make routing decision
            const routingDecision = this.makeRoutingDecision(routingAnalysis);

            // Track usage
            this.trackUsage(routingDecision);

            this.logger.info('Command routed', {
                command: parseResult.command,
                route: routingDecision.route,
                confidence: parseResult.confidence,
                complexity: routingAnalysis.complexity,
                estimatedCost: routingDecision.estimatedCost
            });

            return {
                ...routingDecision,
                parseResult,
                routingAnalysis
            };

        } catch (error) {
            this.logger.error('Routing failed', { error: error.message, text, context });
            return {
                route: 'error',
                error: error.message,
                fallback: 'internal' // Always fall back to internal system
            };
        }
    }

    /**
     * Analyze command complexity and requirements
     */
    analyzeRoutingRequirements(parseResult, originalText, context) {
        const analysis = {
            complexity: 0,
            requiresAI: false,
            requiresCodeAnalysis: false,
            requiresNaturalLanguage: false,
            hasTemplateMatch: !!parseResult.template,
            confidence: parseResult.confidence || 0,
            estimatedTokens: this.estimateTokenUsage(originalText, context),
            factors: []
        };

        // Complexity factors
        const complexityFactors = [
            {
                name: 'Natural language complexity',
                weight: 0.3,
                score: this.analyzeNaturalLanguageComplexity(originalText)
            },
            {
                name: 'Code analysis requirement',
                weight: 0.4,
                score: this.analyzeCodeAnalysisRequirement(originalText, context)
            },
            {
                name: 'Template match quality',
                weight: 0.2,
                score: analysis.hasTemplateMatch ? (1 - parseResult.confidence) : 1
            },
            {
                name: 'Context complexity',
                weight: 0.1,
                score: this.analyzeContextComplexity(context)
            }
        ];

        // Calculate weighted complexity score
        analysis.complexity = complexityFactors.reduce((total, factor) => {
            analysis.factors.push(factor);
            return total + (factor.weight * factor.score);
        }, 0);

        // Set requirement flags
        analysis.requiresAI = analysis.complexity > this.config.complexityThreshold;
        analysis.requiresCodeAnalysis = this.checkCodeAnalysisRequirement(originalText);
        analysis.requiresNaturalLanguage = this.checkNaturalLanguageRequirement(originalText);

        return analysis;
    }

    /**
     * Make final routing decision based on analysis
     */
    makeRoutingDecision(analysis) {
        const decision = {
            route: 'internal', // default
            reasoning: [],
            estimatedCost: 0,
            estimatedDuration: 2000, // ms
            fallback: 'internal'
        };

        // Cost and usage checks
        if (!this.config.enableClaudeAPI) {
            decision.reasoning.push('Claude API disabled');
            return decision;
        }

        if (this.usageStats.claudeCallsThisHour >= this.config.maxClaudeCallsPerHour) {
            decision.reasoning.push('Hourly Claude API limit reached');
            return decision;
        }

        if (this.usageStats.costToday >= this.config.maxCostPerDay) {
            decision.reasoning.push('Daily cost limit reached');
            return decision;
        }

        // Routing logic
        if (analysis.hasTemplateMatch && analysis.confidence >= this.config.confidenceThreshold) {
            // High confidence template match - use internal
            decision.route = 'internal';
            decision.reasoning.push(`High confidence template match (${Math.round(analysis.confidence * 100)}%)`);
            decision.estimatedDuration = 1500;

        } else if (analysis.requiresAI && analysis.complexity > 0.8) {
            // Complex command requiring AI analysis
            decision.route = 'claude';
            decision.reasoning.push(`High complexity requiring AI analysis (${Math.round(analysis.complexity * 100)}%)`);
            decision.estimatedCost = this.estimateClaudeCost(analysis.estimatedTokens);
            decision.estimatedDuration = 8000;

        } else if (this.config.enableHybridMode && analysis.complexity > 0.5) {
            // Medium complexity - hybrid approach
            decision.route = 'hybrid';
            decision.reasoning.push('Medium complexity - hybrid approach optimal');
            decision.estimatedCost = this.estimateClaudeCost(analysis.estimatedTokens * 0.3); // Selective usage
            decision.estimatedDuration = 4000;

        } else {
            // Default to internal
            decision.reasoning.push('Command well-suited for internal workflows');
            decision.estimatedDuration = 2000;
        }

        return decision;
    }

    /**
     * Analyze natural language complexity
     */
    analyzeNaturalLanguageComplexity(text) {
        let score = 0;

        // Length factor
        const words = text.split(/\s+/).length;
        score += Math.min(words / 20, 0.5); // Max 0.5 for length

        // Complex language patterns
        const complexPatterns = [
            /\b(analyze|examine|investigate|determine|evaluate|assess)\b/i,
            /\b(performance|security|vulnerability|optimization)\b/i,
            /\band\b.*\band\b/i, // Multiple conditions
            /\b(considering|taking into account|given that)\b/i,
            /\?(.*\?){1,}/i // Multiple questions
        ];

        const patternMatches = complexPatterns.filter(pattern => pattern.test(text)).length;
        score += Math.min(patternMatches / complexPatterns.length, 0.5);

        return Math.min(score, 1);
    }

    /**
     * Analyze code analysis requirement
     */
    analyzeCodeAnalysisRequirement(text, context) {
        const codePatterns = [
            /\b(code|function|class|method|variable|bug|error|exception)\b/i,
            /\b(performance|optimization|refactor|cleanup)\b/i,
            /\b(security|vulnerability|exploit|injection)\b/i,
            /\b(test|testing|coverage|assertion)\b/i
        ];

        let score = 0;
        const matches = codePatterns.filter(pattern => pattern.test(text)).length;
        score += matches / codePatterns.length;

        // Context factors
        if (context.pullRequest || context.issue) score += 0.3;
        if (context.files && context.files.length > 0) score += 0.2;

        return Math.min(score, 1);
    }

    /**
     * Analyze context complexity
     */
    analyzeContextComplexity(context) {
        let score = 0;

        if (context.pullRequest) score += 0.3;
        if (context.issue) score += 0.2;
        if (context.files && context.files.length > 5) score += 0.3;
        if (context.repository && context.repository.includes('enterprise')) score += 0.2;

        return Math.min(score, 1);
    }

    /**
     * Check if command requires code analysis
     */
    checkCodeAnalysisRequirement(text) {
        const codeKeywords = ['analyze', 'review', 'check', 'security', 'performance', 'bug', 'refactor'];
        return codeKeywords.some(keyword => text.toLowerCase().includes(keyword));
    }

    /**
     * Check if command requires natural language processing
     */
    checkNaturalLanguageRequirement(text) {
        // Complex sentence structures, multiple clauses, etc.
        return text.includes(' and ') || text.includes(' or ') || text.includes('?') || text.split(' ').length > 10;
    }

    /**
     * Estimate token usage for Claude API
     */
    estimateTokenUsage(text, context) {
        let tokens = text.split(/\s+/).length * 1.3; // Rough token estimate

        // Add context tokens
        if (context.pullRequest) tokens += 500; // PR context
        if (context.issue) tokens += 200; // Issue context
        if (context.files) tokens += context.files.length * 100; // File context

        return Math.ceil(tokens);
    }

    /**
     * Estimate Claude API cost
     */
    estimateClaudeCost(tokens) {
        // Rough cost estimates (these should be updated with actual Anthropic pricing)
        const inputCostPer1K = 0.015; // USD per 1K tokens (example)
        const outputCostPer1K = 0.075; // USD per 1K tokens (example)

        // Estimate output will be ~30% of input
        const inputCost = (tokens / 1000) * inputCostPer1K;
        const outputCost = (tokens * 0.3 / 1000) * outputCostPer1K;

        return inputCost + outputCost;
    }

    /**
     * Track usage statistics
     */
    trackUsage(decision) {
        switch (decision.route) {
            case 'internal':
                this.usageStats.internalRoutes++;
                break;
            case 'claude':
                this.usageStats.claudeRoutes++;
                this.usageStats.claudeCallsThisHour++;
                this.usageStats.costToday += decision.estimatedCost;
                break;
            case 'hybrid':
                this.usageStats.hybridRoutes++;
                this.usageStats.claudeCallsThisHour++;
                this.usageStats.costToday += decision.estimatedCost;
                break;
        }
    }

    /**
     * Reset hourly counter if needed
     */
    resetHourlyCounterIfNeeded() {
        const currentHour = new Date().getHours();
        if (currentHour !== this.usageStats.lastHourReset) {
            this.usageStats.claudeCallsThisHour = 0;
            this.usageStats.lastHourReset = currentHour;
        }
    }

    /**
     * Get command suggestions for failed parsing
     */
    getSuggestions(text) {
        return [
            'Try: @claude review this PR',
            'Try: @claude run security-audit',
            'Try: @claude deploy to staging',
            'Try: @claude fix bug #123'
        ];
    }

    /**
     * Get usage statistics
     */
    getUsageStats() {
        return {
            ...this.usageStats,
            efficiency: {
                internalPercentage: Math.round((this.usageStats.internalRoutes / this.usageStats.totalCommands) * 100),
                claudePercentage: Math.round((this.usageStats.claudeRoutes / this.usageStats.totalCommands) * 100),
                hybridPercentage: Math.round((this.usageStats.hybridRoutes / this.usageStats.totalCommands) * 100),
                averageCostPerCommand: this.usageStats.totalCommands > 0
                    ? (this.usageStats.costToday / this.usageStats.totalCommands).toFixed(4)
                    : 0
            }
        };
    }
}

module.exports = { ClaudeCommandRouter };