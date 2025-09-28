#!/usr/bin/env node
/**
 * Claude Analysis Service - LonicFLex Foundation v0
 * Integration with Anthropic's Claude API for intelligent code analysis
 *
 * Features:
 * - Real Claude API integration using official Anthropic endpoints
 * - Smart caching to reduce API costs
 * - Enhanced code analysis beyond internal templates
 * - Hybrid mode with internal workflows
 * - Cost tracking and optimization
 */

const https = require('https');
const crypto = require('crypto');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');

class ClaudeAnalysisService {
    constructor(config = {}) {
        this.config = {
            // Claude API Configuration
            apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
            apiVersion: config.apiVersion || '2023-06-01',
            baseURL: config.baseURL || 'https://api.anthropic.com',

            // Model Configuration (based on research)
            defaultModel: config.defaultModel || 'claude-3-5-sonnet-20241022', // Latest Sonnet
            maxTokens: config.maxTokens || 4000,
            temperature: config.temperature || 0.1, // Low for code analysis

            // Cost Management
            maxCostPerHour: config.maxCostPerHour || 10, // USD
            maxCallsPerHour: config.maxCallsPerHour || 50,
            enableCaching: config.enableCaching !== false,
            cacheExpiry: config.cacheExpiry || 3600000, // 1 hour

            // Service Configuration
            serviceName: 'claude-analysis',
            port: config.port || 3009,
            timeout: config.timeout || 30000,

            ...config
        };

        // Validate API key
        if (!this.config.apiKey) {
            throw new Error('ANTHROPIC_API_KEY environment variable required');
        }

        // Initialize components
        this.contextManager = new Factor3ContextManager();
        this.cache = new Map(); // Simple in-memory cache
        this.usageStats = this.initializeUsageStats();

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

        this.logger.info('Claude Analysis Service initialized', {
            model: this.config.defaultModel,
            cachingEnabled: this.config.enableCaching,
            maxCostPerHour: this.config.maxCostPerHour
        });
    }

    initializeUsageStats() {
        return {
            totalRequests: 0,
            successfulRequests: 0,
            cachedRequests: 0,
            failedRequests: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            hourlyRequests: 0,
            hourlyCost: 0,
            lastHourReset: new Date().getHours(),
            averageResponseTime: 0,
            responseTimeSum: 0
        };
    }

    /**
     * Analyze code/text using Claude API
     */
    async analyzeWithClaude(analysisRequest) {
        const startTime = Date.now();

        try {
            this.resetHourlyStatsIfNeeded();

            // Check usage limits
            if (!this.canMakeRequest()) {
                throw new Error('Usage limits reached for this hour');
            }

            // Check cache first
            if (this.config.enableCaching) {
                const cached = this.getCachedResult(analysisRequest);
                if (cached) {
                    this.usageStats.cachedRequests++;
                    this.logger.info('Cache hit for analysis request');
                    return cached;
                }
            }

            // Prepare Claude API request
            const claudeRequest = this.prepareClaudeRequest(analysisRequest);

            // Make API call
            const response = await this.makeClaudeAPICall(claudeRequest);

            // Process response
            const result = this.processClaudeResponse(response, analysisRequest);

            // Update usage stats
            this.updateUsageStats(result, Date.now() - startTime);

            // Cache result if enabled
            if (this.config.enableCaching) {
                this.cacheResult(analysisRequest, result);
            }

            this.logger.info('Claude analysis completed', {
                requestType: analysisRequest.type,
                tokensUsed: result.usage?.total_tokens || 0,
                responseTime: Date.now() - startTime,
                cost: result.estimatedCost || 0
            });

            return result;

        } catch (error) {
            this.usageStats.failedRequests++;
            this.logger.error('Claude analysis failed', {
                error: error.message,
                requestType: analysisRequest?.type
            });
            throw error;
        }
    }

    /**
     * Prepare Claude API request based on analysis type
     */
    prepareClaudeRequest(analysisRequest) {
        const { type, content, context = {} } = analysisRequest;

        let systemPrompt = '';
        let userPrompt = '';

        switch (type) {
            case 'code_review':
                systemPrompt = `You are an expert code reviewer with deep knowledge of software engineering best practices, security vulnerabilities, and performance optimization. Analyze the provided code thoroughly and provide actionable feedback.

Focus on:
- Security vulnerabilities and potential exploits
- Performance issues and optimization opportunities
- Code quality and maintainability concerns
- Best practices and design patterns
- Bug identification and fix suggestions

Provide your analysis in structured JSON format with severity levels.`;

                userPrompt = `Please analyze this code:

\`\`\`
${content}
\`\`\`

${context.pullRequest ? `This is part of PR #${context.pullRequest.number}: ${context.pullRequest.title}` : ''}
${context.files ? `Related files: ${context.files.join(', ')}` : ''}

Provide detailed analysis with specific line references where applicable.`;
                break;

            case 'security_audit':
                systemPrompt = `You are a cybersecurity expert specializing in application security. Perform a comprehensive security audit of the provided code or system configuration.

Focus on:
- SQL injection vulnerabilities
- XSS and CSRF vulnerabilities
- Authentication and authorization flaws
- Insecure data handling
- Dependency vulnerabilities
- Configuration security issues

Rate findings by severity (Critical, High, Medium, Low) and provide specific remediation steps.`;

                userPrompt = `Security audit requested for:

\`\`\`
${content}
\`\`\`

${context.environment ? `Environment: ${context.environment}` : ''}
${context.dependencies ? `Key dependencies: ${context.dependencies.join(', ')}` : ''}

Provide comprehensive security analysis with remediation priorities.`;
                break;

            case 'bug_analysis':
                systemPrompt = `You are a debugging expert with extensive experience in root cause analysis. Analyze the provided error or bug report and suggest specific solutions.

Focus on:
- Root cause identification
- Step-by-step debugging approach
- Specific code fixes with examples
- Prevention strategies
- Testing recommendations

Provide clear, actionable solutions.`;

                userPrompt = `Bug analysis needed:

Error/Issue: ${content}

${context.stackTrace ? `Stack trace: ${context.stackTrace}` : ''}
${context.reproductionSteps ? `Reproduction steps: ${context.reproductionSteps}` : ''}
${context.environment ? `Environment: ${context.environment}` : ''}

Provide detailed analysis and specific fix recommendations.`;
                break;

            case 'feature_planning':
                systemPrompt = `You are a technical architect and product strategist. Analyze the feature request and provide a comprehensive implementation plan.

Focus on:
- Technical architecture and design patterns
- Implementation complexity and effort estimation
- Potential challenges and risks
- Integration points with existing systems
- Testing strategy
- Performance considerations

Provide structured implementation roadmap.`;

                userPrompt = `Feature planning request:

Feature Description: ${content}

${context.requirements ? `Requirements: ${context.requirements.join(', ')}` : ''}
${context.constraints ? `Constraints: ${context.constraints.join(', ')}` : ''}
${context.existingArchitecture ? `Current architecture: ${context.existingArchitecture}` : ''}

Provide comprehensive feature implementation plan.`;
                break;

            default:
                systemPrompt = `You are an expert software engineer and architect. Provide thoughtful analysis and actionable recommendations for the given request.

Focus on best practices, security, performance, and maintainability.`;

                userPrompt = content;
        }

        return {
            model: this.config.defaultModel,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userPrompt
                }
            ]
        };
    }

    /**
     * Make actual Claude API call
     */
    async makeClaudeAPICall(requestData) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(requestData);

            const options = {
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': this.config.apiVersion,
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(postData)
                },
                timeout: this.config.timeout
            };

            const req = https.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    try {
                        const result = JSON.parse(body);

                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(result);
                        } else {
                            reject(new Error(`Claude API error: ${result.error?.message || 'Unknown error'}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse Claude API response: ${parseError.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Claude API request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Claude API request timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    /**
     * Process Claude API response
     */
    processClaudeResponse(response, originalRequest) {
        const result = {
            success: this.validateSuccess(), 
            type: originalRequest.type,
            analysis: response.content?.[0]?.text || response.content || 'No analysis provided',
            usage: response.usage || {},
            model: response.model,
            timestamp: new Date().toISOString(),
            requestId: response.id
        };

        // Calculate estimated cost based on usage
        if (result.usage.input_tokens && result.usage.output_tokens) {
            result.estimatedCost = this.calculateCost(result.usage.input_tokens, result.usage.output_tokens);
        }

        // Try to parse structured responses (JSON in analysis text)
        try {
            const jsonMatch = result.analysis.match(/```json\n(.*?)\n```/s);
            if (jsonMatch) {
                result.structuredAnalysis = JSON.parse(jsonMatch[1]);
            }
        } catch (e) {
            // Not JSON, keep as plain text
        }

        return result;
    }

    /**
     * Calculate cost based on token usage
     */
    calculateCost(inputTokens, outputTokens) {
        // Pricing for Claude 3.5 Sonnet (as of 2025): $3/$15 per MTok
        const inputCostPerToken = 3 / 1000000;  // $3 per million tokens
        const outputCostPerToken = 15 / 1000000; // $15 per million tokens

        const inputCost = inputTokens * inputCostPerToken;
        const outputCost = outputTokens * outputCostPerToken;

        return inputCost + outputCost;
    }

    /**
     * Check if we can make another request based on limits
     */
    canMakeRequest() {
        if (this.usageStats.hourlyRequests >= this.config.maxCallsPerHour) {
            return false;
        }

        if (this.usageStats.hourlyCost >= this.config.maxCostPerHour) {
            return false;
        }

        return true;
    }

    /**
     * Update usage statistics
     */
    updateUsageStats(result, responseTime) {
        this.usageStats.totalRequests++;
        this.usageStats.successfulRequests++;
        this.usageStats.hourlyRequests++;

        if (result.usage?.total_tokens) {
            this.usageStats.totalTokensUsed += result.usage.total_tokens;
        }

        if (result.estimatedCost) {
            this.usageStats.totalCost += result.estimatedCost;
            this.usageStats.hourlyCost += result.estimatedCost;
        }

        // Update average response time
        this.usageStats.responseTimeSum += responseTime;
        this.usageStats.averageResponseTime = this.usageStats.responseTimeSum / this.usageStats.successfulRequests;
    }

    /**
     * Reset hourly statistics if needed
     */
    resetHourlyStatsIfNeeded() {
        const currentHour = new Date().getHours();
        if (currentHour !== this.usageStats.lastHourReset) {
            this.usageStats.hourlyRequests = 0;
            this.usageStats.hourlyCost = 0;
            this.usageStats.lastHourReset = currentHour;
        }
    }

    /**
     * Generate cache key for request
     */
    getCacheKey(request) {
        const keyData = {
            type: request.type,
            content: request.content,
            context: request.context || {}
        };

        return crypto
            .createHash('sha256')
            .update(JSON.stringify(keyData))
            .digest('hex');
    }

    /**
     * Get cached result if available and not expired
     */
    getCachedResult(request) {
        const cacheKey = this.getCacheKey(request);
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
            return cached.result;
        }

        if (cached) {
            this.cache.delete(cacheKey); // Remove expired
        }

        return null;
    }

    /**
     * Cache analysis result
     */
    cacheResult(request, result) {
        const cacheKey = this.getCacheKey(request);
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });

        // Simple cache size management
        if (this.cache.size > 1000) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Get service health and usage statistics
     */
    getServiceHealth() {
        const currentHour = new Date().getHours();
        this.resetHourlyStatsIfNeeded();

        return {
            status: 'healthy',
            service: this.config.serviceName,
            uptime: process.uptime(),
            usage: {
                ...this.usageStats,
                cacheSize: this.cache.size,
                canMakeRequest: this.canMakeRequest(),
                remainingHourlyRequests: Math.max(0, this.config.maxCallsPerHour - this.usageStats.hourlyRequests),
                remainingHourlyBudget: Math.max(0, this.config.maxCostPerHour - this.usageStats.hourlyCost)
            },
            config: {
                model: this.config.defaultModel,
                maxTokens: this.config.maxTokens,
                cachingEnabled: this.config.enableCaching,
                limits: {
                    maxCallsPerHour: this.config.maxCallsPerHour,
                    maxCostPerHour: this.config.maxCostPerHour
                }
            }
        };
    }

    /**
     * Clear analysis cache
     */
    clearCache() {
        const size = this.cache.size;
        this.cache.clear();
        this.logger.info('Analysis cache cleared', { clearedEntries: size });

        const validation = { success: this.validateSuccess() };return {

            success: validation.success, clearedEntries: size };
    }
}

// Export for service integration
module.exports = { ClaudeAnalysisService };