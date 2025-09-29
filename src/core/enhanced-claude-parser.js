#!/usr/bin/env node
/**
 * Enhanced @claude Command Parser - LonicFLex Foundation v0
 * Advanced command parsing and workflow template integration
 */

const { AdvancedWorkflowTemplates } = require('./advanced-workflow-templates');

class EnhancedClaudeParser {
    constructor() {
        this.workflowTemplates = new AdvancedWorkflowTemplates();
        this.commandPatterns = this.initializeCommandPatterns();
    }

    initializeCommandPatterns() {
        return {
            // Basic command patterns
            simple: /@claude\s+(\w+)(?:\s+(.+))?/i,

            // Advanced patterns with context
            withContext: /@claude\s+(\w+)\s+(.*?)(?:\s+(?:in|on|for)\s+(.+))?/i,

            // Pull request specific
            pullRequest: /@claude\s+(review|check)\s+(?:this\s+)?(pr|pull request|merge request)/i,

            // Issue specific
            issue: /@claude\s+(fix|resolve|close)\s+(?:bug|issue)\s*(?:#?(\d+)|in\s+(.+))/i,

            // Feature development
            feature: /@claude\s+(develop|create|build|implement)\s+(?:feature\s+)?(.+)/i,

            // Deployment
            deployment: /@claude\s+(deploy|release)\s+(?:to\s+)?(\w+)?/i,

            // Security and maintenance
            security: /@claude\s+(?:run\s+)?(security|audit|scan)(?:\s+(.+))?/i,
            maintenance: /@claude\s+(?:run\s+)?(maintenance|cleanup|update)(?:\s+(.+))?/i,

            // Testing
            testing: /@claude\s+(?:run\s+)?(?:test|testing)(?:\s+(.+))?/i,

            // Help and info
            help: /@claude\s+(help|info|status|list)(?:\s+(.+))?/i
        };
    }

    /**
     * Parse @claude command with advanced context awareness
     */
    parseClaudeCommand(text, context = {}) {
        try {
            // Clean up text
            const cleanText = text.trim();

            // Try different parsing strategies
            const result = this.tryParsingStrategies(cleanText, context);

            if (!result) {
                return null;
            }

            // Enhance with workflow template matching
            const enhancedResult = this.enhanceWithTemplate(result, context);

            return enhancedResult;

        } catch (error) {
            console.error('Command parsing error:', error.message);
            return null;
        }
    }

    tryParsingStrategies(text, context) {
        const strategies = [
            () => this.parseSpecializedCommands(text, context),
            () => this.parseContextualCommands(text, context),
            () => this.parseBasicCommands(text, context)
        ];

        for (const strategy of strategies) {
            const result = strategy();
            if (result) {
                return result;
            }
        }

        return null;
    }

    parseSpecializedCommands(text, context) {
        // Pull Request Commands
        const prMatch = text.match(this.commandPatterns.pullRequest);
        if (prMatch && context.pullRequest) {
            return {
                command: 'review',
                action: prMatch[1].toLowerCase(),
                target: 'pullRequest',
                parameters: {
                    prNumber: context.pullRequest.number,
                    repository: context.repository,
                    comprehensive: true
                },
                originalText: prMatch[0],
                confidence: 0.95
            };
        }

        // Issue Commands
        const issueMatch = text.match(this.commandPatterns.issue);
        if (issueMatch) {
            return {
                command: 'fix',
                action: issueMatch[1].toLowerCase(),
                target: 'issue',
                parameters: {
                    issueNumber: issueMatch[2] || context.issue?.number,
                    description: issueMatch[3] || context.issue?.title,
                    repository: context.repository
                },
                originalText: issueMatch[0],
                confidence: 0.95
            };
        }

        // Feature Development Commands
        const featureMatch = text.match(this.commandPatterns.feature);
        if (featureMatch) {
            return {
                command: 'develop',
                action: featureMatch[1].toLowerCase(),
                target: 'feature',
                parameters: {
                    featureName: featureMatch[2],
                    repository: context.repository,
                    comprehensive: true
                },
                originalText: featureMatch[0],
                confidence: 0.9
            };
        }

        return null;
    }

    parseContextualCommands(text, context) {
        // Deployment Commands
        const deployMatch = text.match(this.commandPatterns.deployment);
        if (deployMatch) {
            return {
                command: 'deploy',
                action: deployMatch[1].toLowerCase(),
                target: 'deployment',
                parameters: {
                    environment: deployMatch[2] || 'staging',
                    repository: context.repository
                },
                originalText: deployMatch[0],
                confidence: 0.9
            };
        }

        // Security Commands
        const securityMatch = text.match(this.commandPatterns.security);
        if (securityMatch) {
            return {
                command: 'security-audit',
                action: securityMatch[1].toLowerCase(),
                target: 'security',
                parameters: {
                    scope: securityMatch[2] || 'comprehensive',
                    repository: context.repository
                },
                originalText: securityMatch[0],
                confidence: 0.85
            };
        }

        // Maintenance Commands
        const maintenanceMatch = text.match(this.commandPatterns.maintenance);
        if (maintenanceMatch) {
            return {
                command: 'maintenance',
                action: maintenanceMatch[1].toLowerCase(),
                target: 'maintenance',
                parameters: {
                    scope: maintenanceMatch[2] || 'comprehensive',
                    repository: context.repository
                },
                originalText: maintenanceMatch[0],
                confidence: 0.85
            };
        }

        // Testing Commands
        const testingMatch = text.match(this.commandPatterns.testing);
        if (testingMatch) {
            return {
                command: 'test',
                action: 'run',
                target: 'testing',
                parameters: {
                    testType: testingMatch[1] || 'comprehensive',
                    repository: context.repository
                },
                originalText: testingMatch[0],
                confidence: 0.85
            };
        }

        return null;
    }

    parseBasicCommands(text, context) {
        const basicMatch = text.match(this.commandPatterns.simple);
        if (!basicMatch) {
            return null;
        }

        const [fullMatch, command, params] = basicMatch;

        return {
            command: command.toLowerCase(),
            action: command.toLowerCase(),
            target: params || 'default',
            parameters: this.parseParameters(params || '', context),
            originalText: fullMatch,
            confidence: 0.7
        };
    }

    parseParameters(paramText, context = {}) {
        const params = {
            repository: context.repository
        };

        if (!paramText) {
            return params;
        }

        // Key=value pairs
        const keyValuePattern = /(\w+)=([^\s]+)/g;
        let match;

        while ((match = keyValuePattern.exec(paramText)) !== null) {
            params[match[1]] = match[2];
        }

        // If no key=value pairs, treat as target
        if (Object.keys(params).length <= 1 && paramText.trim()) {
            params.target = paramText.trim();
        }

        // Extract common patterns
        if (paramText.includes('staging')) params.environment = 'staging';
        if (paramText.includes('production')) params.environment = 'production';
        if (paramText.includes('comprehensive')) params.scope = 'comprehensive';
        if (paramText.includes('quick')) params.scope = 'quick';

        return params;
    }

    enhanceWithTemplate(parseResult, context) {
        try {
            // Find matching workflow template
            const template = this.workflowTemplates.matchCommandToTemplate(
                parseResult.command,
                parseResult.parameters
            );

            if (template) {
                parseResult.template = {
                    id: template.id,
                    name: template.name,
                    description: template.description,
                    estimatedDuration: template.estimatedDuration,
                    category: template.category,
                    steps: template.steps.length
                };

                parseResult.confidence = Math.min(parseResult.confidence + 0.1, 1.0);

                // Add template-specific parameters
                parseResult.parameters.templateId = template.id;
                parseResult.parameters.workflowType = template.category;
            }

            // Add context-specific enhancements
            if (context.pullRequest) {
                parseResult.contextType = 'pullRequest';
                parseResult.parameters.prContext = {
                    number: context.pullRequest.number,
                    title: context.pullRequest.title,
                    author: context.pullRequest.author,
                    branch: context.pullRequest.head?.ref
                };
            }

            if (context.issue) {
                parseResult.contextType = 'issue';
                parseResult.parameters.issueContext = {
                    number: context.issue.number,
                    title: context.issue.title,
                    author: context.issue.user?.login,
                    labels: context.issue.labels?.map(l => l.name)
                };
            }

            return parseResult;

        } catch (error) {
            console.error('Template enhancement error:', error.message);
            return parseResult;
        }
    }

    /**
     * Generate human-readable command summary
     */
    generateCommandSummary(parseResult) {
        if (!parseResult) {
            return 'Unable to parse command';
        }

        const { command, action, target, template, parameters } = parseResult;

        let summary = `Command: ${command}`;

        if (template) {
            summary += `\nWorkflow: ${template.name}`;
            summary += `\nEstimated Duration: ${Math.round(template.estimatedDuration / 1000)}s`;
            summary += `\nSteps: ${template.steps}`;
        }

        if (parameters.repository) {
            summary += `\nRepository: ${parameters.repository}`;
        }

        if (parameters.environment) {
            summary += `\nEnvironment: ${parameters.environment}`;
        }

        if (parseResult.contextType) {
            summary += `\nContext: ${parseResult.contextType}`;
        }

        return summary;
    }

    /**
     * Validate command against requirements
     */
    validateCommand(parseResult, availableServices = []) {
        const validation = {
            valid: true,
            errors: [],
            warnings: [],
            missingRequirements: []
        };

        if (!parseResult) {
            validation.valid = false;
            validation.errors.push('Command could not be parsed');
            return validation;
        }

        // Check template requirements
        if (parseResult.template) {
            const template = this.workflowTemplates.getTemplate(parseResult.template.id);

            if (template && template.requirements) {
                // Check GitHub token
                if (template.requirements.githubToken && !process.env.GITHUB_TOKEN) {
                    validation.warnings.push('GitHub token not configured');
                }

                // Check Docker engine
                if (template.requirements.dockerEngine) {
                    validation.warnings.push('Docker engine required - ensure it is running');
                }

                // Check Slack integration
                if (template.requirements.slackIntegration && !process.env.SLACK_BOT_TOKEN) {
                    validation.warnings.push('Slack integration not configured');
                }
            }
        }

        // Check confidence level
        if (parseResult.confidence < 0.8) {
            validation.warnings.push(`Low confidence command parsing (${Math.round(parseResult.confidence * 100)}%)`);
        }

        return validation;
    }
}

// Demo and testing
async function demoEnhancedClaudeParser() {
    console.log('🎯 Enhanced @claude Command Parser Demo\n');

    const parser = new EnhancedClaudeParser();

    const testCases = [
        {
            text: '@claude review this PR',
            context: {
                pullRequest: { number: 123, title: 'Add new feature', author: 'developer' },
                repository: 'levilonic/Lonic-Flex-Claude-system'
            }
        },
        {
            text: '@claude fix bug in issue #456',
            context: {
                issue: { number: 456, title: 'Authentication fails' },
                repository: 'levilonic/Lonic-Flex-Claude-system'
            }
        },
        {
            text: '@claude develop feature user-dashboard',
            context: {
                repository: 'levilonic/Lonic-Flex-Claude-system'
            }
        },
        {
            text: '@claude deploy to production',
            context: {
                repository: 'levilonic/Lonic-Flex-Claude-system'
            }
        },
        {
            text: '@claude run security-audit',
            context: {
                repository: 'levilonic/Lonic-Flex-Claude-system'
            }
        },
        {
            text: '@claude run maintenance',
            context: {
                repository: 'levilonic/Lonic-Flex-Claude-system'
            }
        },
        {
            text: '@claude test comprehensive',
            context: {
                repository: 'levilonic/Lonic-Flex-Claude-system'
            }
        }
    ];

    console.log('📋 Command Parsing Tests:\n');

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`${i + 1}. Input: "${testCase.text}"`);

        const result = parser.parseClaudeCommand(testCase.text, testCase.context);

        if (result) {
            console.log(`   ✅ Parsed successfully (${Math.round(result.confidence * 100)}% confidence)`);
            console.log(`   Command: ${result.command}`);

            if (result.template) {
                console.log(`   Template: ${result.template.name}`);
                console.log(`   Duration: ${Math.round(result.template.estimatedDuration / 1000)}s`);
            }

            const validation = parser.validateCommand(result);
            if (validation.warnings.length > 0) {
                console.log(`   ⚠️  Warnings: ${validation.warnings.join(', ')}`);
            }
        } else {
            console.log('   ❌ Parsing failed');
        }

        console.log();
    }

    console.log('✅ Enhanced @claude Command Parser Demo Complete!');
}

module.exports = { EnhancedClaudeParser };

// Run demo if called directly
if (require.main === module) {
    demoEnhancedClaudeParser().catch(console.error);
}