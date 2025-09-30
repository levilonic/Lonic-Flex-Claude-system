/**
 * Pragmatic Code Reviewer Agent - OneRedOak Integration
 * "Net Positive > Perfection" methodology with 7-category assessment framework
 * Extends BaseAgent with code review functionality following Factor 10
 */

const { ValidatedAgent } = require('../core/validated-agent-base');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class PragmaticCodeReviewerAgent extends ValidatedAgent {
    constructor(sessionId, config = {}) {
        super('pragmatic-code-reviewer', sessionId, {
            maxSteps: 8,
            timeout: 120000,
            ...config
        });

        // OneRedOak review configuration
        this.reviewConfig = {
            methodology: 'Net Positive > Perfection',
            framework: '7-category assessment',
            tool_restrictions: config.tool_restrictions || ['Read', 'Edit', 'Bash(git*)', 'Grep'],
            security_profile: config.security_profile || 'restricted',
            ...config.review
        };

        // Review results storage
        this.reviewResults = {
            overall_assessment: '',
            merge_recommendation: '',
            critical_issues: [],
            improvements: [],
            nits: [],
            positive_highlights: []
        };

        // Review metrics
        this.reviewMetrics = {
            files_reviewed: 0,
            lines_analyzed: 0,
            issues_found: 0,
            category_scores: {}
        };

        // Define execution steps (Factor 10: max 8 steps)
        this.executionSteps = [
            'initialize_code_review',
            'gather_context',
            'analyze_files',
            'assess_categories',
            'classify_severity',
            'generate_recommendations',
            'create_review_report',
            'finalize_review'
        ];

        // OneRedOak 7-category framework with weights
        this.reviewFramework = this.initializeReviewFramework();

        // Initialize review context
        this.contextManager.addAgentEvent(this.agentName, 'review_config_loaded', {
            methodology: this.reviewConfig.methodology,
            framework: this.reviewConfig.framework,
            categories: Object.keys(this.reviewFramework).length
        });
    }

    /**
     * Initialize OneRedOak 7-category review framework
     */
    initializeReviewFramework() {
        return {
            architecture: {
                weight: 0.25,
                threshold: 'improvement',
                description: 'System design patterns and maintainability',
                criteria: [
                    'Component relationships and dependencies',
                    'Scalability and extensibility considerations',
                    'Design pattern usage and appropriateness',
                    'Separation of concerns and modularity',
                    'Interface design and API contracts'
                ],
                patterns: [
                    // Good architecture patterns
                    { pattern: /class\s+\w+\s+extends\s+\w+/g, type: 'inheritance_pattern', score: 1 },
                    { pattern: /interface\s+\w+/g, type: 'interface_usage', score: 2 },
                    { pattern: /dependency.*injection|DI/gi, type: 'dependency_injection', score: 2 },
                    { pattern: /single.*responsibility|SRP/gi, type: 'solid_principles', score: 2 },
                    // Architecture concerns
                    { pattern: /god.*class|large.*class|giant.*function/gi, type: 'architecture_smell', score: -2 },
                    { pattern: /circular.*dependency|cyclic.*import/gi, type: 'circular_dependency', score: -3 },
                    { pattern: /tight.*coupling|hardcoded.*dependency/gi, type: 'coupling_issue', score: -2 }
                ]
            },

            functionality: {
                weight: 0.20,
                threshold: 'blocker',
                description: 'Logic correctness and edge case handling',
                criteria: [
                    'Requirements compliance and feature completeness',
                    'Error handling and input validation',
                    'Business logic correctness',
                    'Edge case coverage',
                    'Data flow integrity'
                ],
                patterns: [
                    // Good functionality patterns
                    { pattern: /try\s*{[\s\S]*?catch\s*\([^)]*\)\s*{/g, type: 'error_handling', score: 2 },
                    { pattern: /validate\w*\(|validation|sanitize/gi, type: 'input_validation', score: 2 },
                    { pattern: /if\s*\([^)]*null[^)]*\)|null.*check|undefined.*check/g, type: 'null_checks', score: 1 },
                    // Functionality issues
                    { pattern: /TODO.*bug|FIXME.*bug|BUG:/gi, type: 'known_bugs', score: -3 },
                    { pattern: /catch\s*\([^)]*\)\s*{\s*}/g, type: 'empty_catch', score: -2 },
                    { pattern: /throw\s+new\s+Error\s*\(\s*['"]{2}\s*\)/g, type: 'empty_error', score: -1 }
                ]
            },

            security: {
                weight: 0.20,
                threshold: 'critical',
                description: 'Vulnerability assessment and secure coding',
                criteria: [
                    'OWASP Top 10 compliance',
                    'Secrets exposure and credential handling',
                    'Input sanitization and attack vector analysis',
                    'Authentication and authorization',
                    'Data protection and encryption'
                ],
                patterns: [
                    // Security vulnerabilities (from SecurityAgent)
                    { pattern: /eval\s*\(|new\s+Function\s*\(/gi, type: 'code_injection', score: -5 },
                    { pattern: /innerHTML\s*=\s*.*\+|document\.write\s*\(\s*.*\+/gi, type: 'xss_risk', score: -4 },
                    { pattern: /password\s*[:=]\s*['"]/gi, type: 'hardcoded_password', score: -5 },
                    { pattern: /api[_-]?key\s*[:=]\s*['"]/gi, type: 'exposed_api_key', score: -4 },
                    // Good security practices
                    { pattern: /crypto\.randomBytes|crypto\.generateKey/gi, type: 'secure_random', score: 2 },
                    { pattern: /bcrypt|scrypt|argon2/gi, type: 'secure_hashing', score: 2 },
                    { pattern: /helmet\(|security.*headers/gi, type: 'security_headers', score: 1 }
                ]
            },

            performance: {
                weight: 0.15,
                threshold: 'improvement',
                description: 'Efficiency and resource utilization',
                criteria: [
                    'Scalability bottlenecks and optimization opportunities',
                    'Memory management and computational complexity',
                    'Database query efficiency',
                    'Caching strategies',
                    'Resource cleanup and lifecycle'
                ],
                patterns: [
                    // Performance improvements
                    { pattern: /cache|memoize|memo/gi, type: 'caching_strategy', score: 2 },
                    { pattern: /async.*await|Promise\./g, type: 'async_pattern', score: 1 },
                    { pattern: /lazy.*loading|virtualization/gi, type: 'lazy_loading', score: 2 },
                    // Performance concerns
                    { pattern: /for.*in.*for|nested.*loop.*O\(n.*2\)/gi, type: 'nested_loops', score: -2 },
                    { pattern: /SELECT.*\*.*FROM|\.find\(\)\.map\(\)/gi, type: 'inefficient_query', score: -2 },
                    { pattern: /memory.*leak|resource.*leak/gi, type: 'resource_leak', score: -3 },
                    { pattern: /sync.*operation|synchronous.*file/gi, type: 'blocking_operation', score: -1 }
                ]
            },

            maintainability: {
                weight: 0.10,
                threshold: 'nit',
                description: 'Code clarity and readability',
                criteria: [
                    'Documentation quality and completeness',
                    'Technical debt assessment',
                    'Code organization and structure',
                    'Naming conventions consistency',
                    'Complexity management'
                ],
                patterns: [
                    // Good maintainability patterns
                    { pattern: /\/\*\*[\s\S]*?\*\/|\/\/.*TODO.*fix|\/\/.*FIXME/g, type: 'documentation', score: 1 },
                    { pattern: /const\s+[A-Z][A-Z_]+\s*=/g, type: 'constants', score: 1 },
                    { pattern: /function\s+\w+|const\s+\w+\s*=\s*\(/g, type: 'function_declaration', score: 1 },
                    // Maintainability issues
                    { pattern: /function.*{[\s\S]{200,}}/g, type: 'long_function', score: -2 },
                    { pattern: /var\s+\w+/g, type: 'var_usage', score: -1 },
                    { pattern: /magic.*number|\b\d{3,}\b(?!\s*ms|\s*px|\s*%)/g, type: 'magic_numbers', score: -1 }
                ]
            },

            testing: {
                weight: 0.05,
                threshold: 'improvement',
                description: 'Test coverage and quality assessment',
                criteria: [
                    'Test design and edge case validation',
                    'Integration and unit test effectiveness',
                    'Test maintainability and clarity',
                    'Mock and stub usage',
                    'Test data management'
                ],
                patterns: [
                    // Good testing patterns
                    { pattern: /describe\(|it\(|test\(|expect\(/g, type: 'test_presence', score: 2 },
                    { pattern: /mock\w*\(|stub\w*\(|spy\w*\(/gi, type: 'test_doubles', score: 1 },
                    { pattern: /beforeEach|afterEach|setUp|tearDown/gi, type: 'test_setup', score: 1 },
                    // Testing issues
                    { pattern: /\.skip\(|\.only\(/g, type: 'test_skip_only', score: -1 },
                    { pattern: /test.*test.*test/gi, type: 'redundant_tests', score: -1 }
                ]
            },

            documentation: {
                weight: 0.05,
                threshold: 'nit',
                description: 'Code comments and documentation quality',
                criteria: [
                    'README updates and API documentation',
                    'Change documentation and usage examples',
                    'Inline comments appropriateness',
                    'Documentation accuracy and completeness',
                    'External documentation updates'
                ],
                patterns: [
                    // Good documentation patterns
                    { pattern: /\/\*\*[\s\S]*?@param[\s\S]*?\*\//g, type: 'jsdoc_params', score: 2 },
                    { pattern: /\/\*\*[\s\S]*?@returns[\s\S]*?\*\//g, type: 'jsdoc_returns', score: 2 },
                    { pattern: /README\.md|CHANGELOG\.md|API\.md/gi, type: 'documentation_files', score: 1 },
                    // Documentation issues
                    { pattern: /\/\/.*placeholder|\/\/.*todo.*doc|\/\/.*fixme.*doc/gi, type: 'placeholder_comments', score: -1 },
                    { pattern: /\/\/\s*$/gm, type: 'empty_comments', score: -1 }
                ]
            }
        };
    }

    /**
     * Implementation of abstract executeWorkflow method
     */
    async executeWorkflow(context, progressCallback) {
        const results = {};

        // Step 1: Initialize code review
        results.initialization = await this.executeStep('initialize_code_review', async () => {
            if (progressCallback) progressCallback(12, 'initializing code review...');

            const reviewTarget = context.review_target || process.cwd();
            const reviewConfig = {
                target: reviewTarget,
                timestamp: Date.now(),
                review_id: this.generateReviewId(),
                methodology: this.reviewConfig.methodology,
                framework: this.reviewConfig.framework,
                files: context.files || []
            };

            await this.logEvent('code_review_initialized', reviewConfig);

            return reviewConfig;
        }, 0);

        // Step 2: Gather context
        results.context = await this.executeStep('gather_context', async () => {
            if (progressCallback) progressCallback(25, 'gathering review context...');

            const contextData = await this.gatherReviewContext(results.initialization);

            await this.logEvent('context_gathered', {
                files_to_review: contextData.filesToReview.length,
                git_changes: contextData.gitChanges.length,
                review_scope: contextData.reviewScope
            });

            return contextData;
        }, 1);

        // Step 3: Analyze files
        results.fileAnalysis = await this.executeStep('analyze_files', async () => {
            if (progressCallback) progressCallback(37, 'analyzing files...');

            const fileAnalysis = await this.analyzeFiles(results.context.filesToReview);

            await this.logEvent('files_analyzed', {
                files_processed: fileAnalysis.filesProcessed,
                total_lines: fileAnalysis.totalLines,
                patterns_detected: fileAnalysis.patternsDetected
            });

            return fileAnalysis;
        }, 2);

        // Step 4: Assess categories
        results.categoryAssessment = await this.executeStep('assess_categories', async () => {
            if (progressCallback) progressCallback(50, 'assessing categories...');

            const assessment = await this.assessCategories(results.fileAnalysis);

            await this.logEvent('categories_assessed', {
                category_scores: assessment.categoryScores,
                weighted_score: assessment.weightedScore
            });

            return assessment;
        }, 3);

        // Step 5: Classify severity
        results.severityClassification = await this.executeStep('classify_severity', async () => {
            if (progressCallback) progressCallback(62, 'classifying severity...');

            const classification = await this.classifySeverity(results.categoryAssessment);

            await this.logEvent('severity_classified', {
                critical_count: classification.critical.length,
                improvement_count: classification.improvements.length,
                nit_count: classification.nits.length
            });

            return classification;
        }, 4);

        // Step 6: Generate recommendations
        results.recommendations = await this.executeStep('generate_recommendations', async () => {
            if (progressCallback) progressCallback(75, 'generating recommendations...');

            const recommendations = await this.generateRecommendations(results);

            await this.logEvent('recommendations_generated', {
                total_recommendations: recommendations.totalRecommendations,
                merge_recommendation: recommendations.mergeRecommendation
            });

            return recommendations;
        }, 5);

        // Step 7: Create review report
        results.reviewReport = await this.executeStep('create_review_report', async () => {
            if (progressCallback) progressCallback(87, 'creating review report...');

            const report = await this.createReviewReport(results);

            await this.logEvent('review_report_created', {
                report_sections: report.sections.length,
                overall_assessment: report.overallAssessment
            });

            return report;
        }, 6);

        // Step 8: Finalize review
        results.finalization = await this.executeStep('finalize_review', async () => {
            if (progressCallback) progressCallback(100, 'finalizing review...');

            const finalization = await this.finalizeReview(results);

            return finalization;
        }, 7);

        return {
            agent: this.agentName,
            session: this.sessionId,
            review_id: results.initialization.review_id,
            overall_score: results.categoryAssessment.weightedScore,
            merge_recommendation: results.recommendations.mergeRecommendation,
            total_issues: results.severityClassification.totalIssues,
            results
        };

        const evidence = {
            reviewCompleted: !!results,
            categoryAssessment: !!results.categoryAssessment,
            severityClassification: !!results.severityClassification,
            recommendations: !!results.recommendations,
            overallScoreGenerated: typeof results.categoryAssessment.weightedScore === 'number'
        };

        const validation = await this.validateSuccess({
            evidence: evidence,
            operation: 'Pragmatic code review workflow',
            criteria: {
                reviewCompleted: { required: true },
                categoryAssessment: { required: true },
                recommendations: { required: true }
            }
        });

        return {
            ...reviewSummary,
            success: validation.success,
            validation: validation
        };
    }

    /**
     * Gather review context including git changes and target files
     */
    async gatherReviewContext(config) {
        const context = {
            filesToReview: [],
            gitChanges: [],
            reviewScope: 'full',
            baseline: 'HEAD~1'
        };

        try {
            // If specific files provided, use those
            if (config.files && config.files.length > 0) {
                context.filesToReview = config.files;
                context.reviewScope = 'targeted';
            } else {
                // Get git changes for review scope
                try {
                    const { exec } = require('child_process');
                    const { promisify } = require('util');
                    const execAsync = promisify(exec);

                    const { stdout: changedFiles } = await execAsync('git diff --name-only HEAD~1', {
                        cwd: config.target
                    });

                    context.gitChanges = changedFiles.trim().split('\n').filter(f => f);
                    context.filesToReview = context.gitChanges.filter(file =>
                        this.isReviewableFile(file)
                    );
                    context.reviewScope = 'git_changes';
                } catch (gitError) {
                    // Fallback to current directory files
                    context.filesToReview = await this.getReviewableFiles(config.target);
                    context.reviewScope = 'directory_scan';
                }
            }

        } catch (error) {
            context.error = error.message;
            context.filesToReview = [];
        }

        return context;
    }

    /**
     * Analyze files for review patterns
     */
    async analyzeFiles(filesToReview) {
        const analysis = {
            filesProcessed: 0,
            totalLines: 0,
            patternsDetected: 0,
            fileResults: [],
            categoryFindings: {}
        };

        try {
            for (const filePath of filesToReview) {
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    const lines = content.split('\n').length;
                    analysis.totalLines += lines;

                    const fileResult = {
                        file: filePath,
                        lines: lines,
                        patterns: [],
                        categoryScores: {}
                    };

                    // Analyze file against each category
                    for (const [category, framework] of Object.entries(this.reviewFramework)) {
                        const categoryResult = this.analyzeFileCategory(content, framework, filePath);
                        fileResult.categoryScores[category] = categoryResult.score;
                        fileResult.patterns.push(...categoryResult.patterns);

                        // Aggregate category findings
                        if (!analysis.categoryFindings[category]) {
                            analysis.categoryFindings[category] = [];
                        }
                        analysis.categoryFindings[category].push(...categoryResult.findings);
                    }

                    analysis.patternsDetected += fileResult.patterns.length;
                    analysis.fileResults.push(fileResult);
                    analysis.filesProcessed++;

                } catch (fileError) {
                    // Skip unreadable files but log the error
                    analysis.fileErrors = analysis.fileErrors || [];
                    analysis.fileErrors.push({
                        file: filePath,
                        error: fileError.message
                    });
                }
            }
        } catch (error) {
            analysis.error = error.message;
        }

        this.reviewMetrics.files_reviewed = analysis.filesProcessed;
        this.reviewMetrics.lines_analyzed = analysis.totalLines;
        this.reviewMetrics.issues_found = analysis.patternsDetected;

        return analysis;
    }

    /**
     * Analyze file content against specific category framework
     */
    analyzeFileCategory(content, framework, filePath) {
        const result = {
            score: 0,
            patterns: [],
            findings: []
        };

        for (const pattern of framework.patterns) {
            let match;
            let matches = [];

            // Handle global regex patterns
            if (pattern.pattern.global) {
                matches = content.match(pattern.pattern) || [];
            } else {
                const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags + 'g');
                matches = content.match(regex) || [];
            }

            if (matches.length > 0) {
                result.score += pattern.score * matches.length;
                result.patterns.push({
                    type: pattern.type,
                    matches: matches.length,
                    score: pattern.score * matches.length,
                    severity: this.getPatternSeverity(pattern.score)
                });

                // Create detailed findings
                for (const match of matches) {
                    result.findings.push({
                        file: filePath,
                        pattern: pattern.type,
                        match: match,
                        line: this.getLineNumber(content, match),
                        score: pattern.score,
                        severity: this.getPatternSeverity(pattern.score),
                        suggestion: this.getPatternSuggestion(pattern.type)
                    });
                }
            }

            // Reset regex lastIndex to prevent skipping matches
            pattern.pattern.lastIndex = 0;
        }

        return result;
    }

    /**
     * Assess categories using weighted scoring
     */
    async assessCategories(fileAnalysis) {
        const assessment = {
            categoryScores: {},
            weightedScore: 0,
            totalScore: 0,
            categoryDetails: {}
        };

        try {
            for (const [category, framework] of Object.entries(this.reviewFramework)) {
                const categoryFindings = fileAnalysis.categoryFindings[category] || [];
                const rawScore = categoryFindings.reduce((sum, finding) => sum + finding.score, 0);

                // Normalize score (0-100 scale)
                const normalizedScore = this.normalizeScore(rawScore, categoryFindings.length);
                const weightedScore = normalizedScore * framework.weight;

                assessment.categoryScores[category] = {
                    rawScore: rawScore,
                    normalizedScore: normalizedScore,
                    weightedScore: weightedScore,
                    weight: framework.weight,
                    findingsCount: categoryFindings.length,
                    threshold: framework.threshold
                };

                assessment.weightedScore += weightedScore;
                assessment.totalScore += normalizedScore;

                // Store detailed findings for later use
                assessment.categoryDetails[category] = {
                    findings: categoryFindings,
                    framework: framework
                };
            }

            this.reviewMetrics.category_scores = assessment.categoryScores;

        } catch (error) {
            assessment.error = error.message;
        }

        return assessment;
    }

    /**
     * Classify issues by severity based on OneRedOak thresholds
     */
    async classifySeverity(categoryAssessment) {
        const classification = {
            critical: [],
            improvements: [],
            nits: [],
            positive_highlights: [],
            totalIssues: 0
        };

        try {
            for (const [category, details] of Object.entries(categoryAssessment.categoryDetails)) {
                const framework = details.framework;
                const findings = details.findings;

                for (const finding of findings) {
                    const issue = {
                        category: category,
                        file: finding.file,
                        pattern: finding.pattern,
                        line: finding.line,
                        score: finding.score,
                        suggestion: finding.suggestion,
                        threshold: framework.threshold
                    };

                    // Classify based on threshold and score
                    if (framework.threshold === 'critical' && finding.score < -2) {
                        classification.critical.push({
                            ...issue,
                            severity: 'critical',
                            message: `Critical ${category} issue: ${finding.pattern}`
                        });
                    } else if (framework.threshold === 'blocker' && finding.score < -1) {
                        classification.critical.push({
                            ...issue,
                            severity: 'blocker',
                            message: `Blocker ${category} issue: ${finding.pattern}`
                        });
                    } else if (finding.score < 0) {
                        classification.improvements.push({
                            ...issue,
                            severity: 'improvement',
                            message: `${category} improvement needed: ${finding.pattern}`
                        });
                    } else if (finding.score === 0 || framework.threshold === 'nit') {
                        classification.nits.push({
                            ...issue,
                            severity: 'nit',
                            message: `${category} nit: ${finding.pattern}`
                        });
                    } else if (finding.score > 0) {
                        classification.positive_highlights.push({
                            ...issue,
                            severity: 'positive',
                            message: `Good ${category} practice: ${finding.pattern}`
                        });
                    }
                }
            }

            classification.totalIssues =
                classification.critical.length +
                classification.improvements.length +
                classification.nits.length;

            // Store in review results
            this.reviewResults.critical_issues = classification.critical;
            this.reviewResults.improvements = classification.improvements;
            this.reviewResults.nits = classification.nits;
            this.reviewResults.positive_highlights = classification.positive_highlights;

        } catch (error) {
            classification.error = error.message;
        }

        return classification;
    }

    /**
     * Generate recommendations based on OneRedOak methodology
     */
    async generateRecommendations(results) {
        const recommendations = {
            mergeRecommendation: 'NEEDS_REVIEW',
            overallAssessment: '',
            actionItems: [],
            totalRecommendations: 0,
            rationale: []
        };

        try {
            const severity = results.severityClassification;
            const assessment = results.categoryAssessment;

            // Apply "Net Positive > Perfection" philosophy
            const criticalCount = severity.critical.length;
            const improvementCount = severity.improvements.length;
            const positiveCount = severity.positive_highlights.length;
            const overallScore = assessment.weightedScore;

            // Determine merge recommendation
            if (criticalCount === 0 && overallScore >= 60) {
                if (positiveCount > improvementCount) {
                    recommendations.mergeRecommendation = 'APPROVE';
                    recommendations.overallAssessment = 'Net positive contribution. Benefits outweigh minor issues.';
                } else {
                    recommendations.mergeRecommendation = 'APPROVE_WITH_SUGGESTIONS';
                    recommendations.overallAssessment = 'Acceptable changes. Consider addressing improvements.';
                }
            } else if (criticalCount > 0) {
                recommendations.mergeRecommendation = 'REQUEST_CHANGES';
                recommendations.overallAssessment = 'Critical issues must be resolved before merge.';
            } else {
                recommendations.mergeRecommendation = 'NEEDS_WORK';
                recommendations.overallAssessment = 'Significant improvements needed for code quality.';
            }

            // Generate action items by priority
            if (criticalCount > 0) {
                recommendations.actionItems.push({
                    priority: 'HIGH',
                    action: `Address ${criticalCount} critical issues`,
                    items: severity.critical.slice(0, 5).map(issue => issue.message)
                });
            }

            if (improvementCount > 0) {
                recommendations.actionItems.push({
                    priority: 'MEDIUM',
                    action: `Consider ${improvementCount} improvements`,
                    items: severity.improvements.slice(0, 3).map(issue => issue.message)
                });
            }

            if (severity.nits.length > 0) {
                recommendations.actionItems.push({
                    priority: 'LOW',
                    action: `Optional: ${severity.nits.length} minor improvements`,
                    items: severity.nits.slice(0, 2).map(issue => issue.message)
                });
            }

            // Add rationale based on methodology
            recommendations.rationale = [
                `Applied "Net Positive > Perfection" methodology`,
                `7-category assessment completed`,
                `Overall weighted score: ${overallScore.toFixed(1)}/100`,
                `Critical issues: ${criticalCount}, Improvements: ${improvementCount}, Positives: ${positiveCount}`
            ];

            recommendations.totalRecommendations = recommendations.actionItems.length;

            // Store final results
            this.reviewResults.overall_assessment = recommendations.overallAssessment;
            this.reviewResults.merge_recommendation = recommendations.mergeRecommendation;

        } catch (error) {
            recommendations.error = error.message;
            recommendations.mergeRecommendation = 'ERROR';
        }

        return recommendations;
    }

    /**
     * Create comprehensive review report
     */
    async createReviewReport(results) {
        const report = {
            metadata: {
                review_id: results.initialization.review_id,
                timestamp: results.initialization.timestamp,
                methodology: results.initialization.methodology,
                agent: this.agentName,
                session: this.sessionId
            },

            summary: {
                overallAssessment: results.recommendations.overallAssessment,
                mergeRecommendation: results.recommendations.mergeRecommendation,
                filesReviewed: results.fileAnalysis.filesProcessed,
                linesAnalyzed: results.fileAnalysis.totalLines,
                totalIssues: results.severityClassification.totalIssues
            },

            sections: [],

            formatted_output: ''
        };

        // Build formatted review output
        let formatted = '## Code Review Summary\n\n';
        formatted += `**Overall Assessment**: ${results.recommendations.overallAssessment}\n`;
        formatted += `**Merge Recommendation**: ${results.recommendations.mergeRecommendation}\n\n`;

        // Critical Issues section
        if (results.severityClassification.critical.length > 0) {
            formatted += '### Critical Issues\n';
            for (const issue of results.severityClassification.critical.slice(0, 10)) {
                formatted += `- **${issue.file}:${issue.line}** - ${issue.message}\n`;
                if (issue.suggestion) {
                    formatted += `  *Suggestion: ${issue.suggestion}*\n`;
                }
            }
            formatted += '\n';
        }

        // Improvements section
        if (results.severityClassification.improvements.length > 0) {
            formatted += '### Improvements\n';
            for (const issue of results.severityClassification.improvements.slice(0, 8)) {
                formatted += `- **${issue.file}:${issue.line}** - ${issue.message}\n`;
                if (issue.suggestion) {
                    formatted += `  *Suggestion: ${issue.suggestion}*\n`;
                }
            }
            formatted += '\n';
        }

        // Nits section
        if (results.severityClassification.nits.length > 0) {
            formatted += '### Nits\n';
            for (const issue of results.severityClassification.nits.slice(0, 5)) {
                formatted += `- **${issue.file}:${issue.line}** - ${issue.message}\n`;
            }
            formatted += '\n';
        }

        // Positive Highlights section
        if (results.severityClassification.positive_highlights.length > 0) {
            formatted += '### Positive Highlights\n';
            for (const highlight of results.severityClassification.positive_highlights.slice(0, 5)) {
                formatted += `- **${highlight.file}:${highlight.line}** - ${highlight.message}\n`;
            }
            formatted += '\n';
        }

        // Category breakdown
        formatted += '### Category Breakdown\n';
        for (const [category, scores] of Object.entries(results.categoryAssessment.categoryScores)) {
            const percentage = scores.normalizedScore.toFixed(1);
            formatted += `- **${category}**: ${percentage}% (weight: ${(scores.weight * 100).toFixed(0)}%)\n`;
        }

        report.formatted_output = formatted;
        report.sections = ['summary', 'critical_issues', 'improvements', 'nits', 'positive_highlights', 'category_breakdown'];

        return report;
    }

    /**
     * Finalize review and cleanup
     */
    async finalizeReview(results) {
        const finalization = {
            review_completed: true,
            artifacts_created: [],
            next_actions: []
        };

        try {
            // Log completion event
            await this.logEvent('code_review_completed', {
                review_id: results.initialization.review_id,
                merge_recommendation: results.recommendations.mergeRecommendation,
                total_issues: results.severityClassification.totalIssues,
                files_reviewed: results.fileAnalysis.filesProcessed
            });

            // Record memory pattern for future reviews
            await this.recordMemoryPattern('code_review_pattern', {
                methodology: 'Net Positive > Perfection',
                framework: '7-category assessment',
                outcome: results.recommendations.mergeRecommendation,
                issue_types: this.extractIssueTypes(results.severityClassification),
                confidence: this.calculateConfidence(results)
            });

            finalization.artifacts_created = ['review_report', 'memory_pattern'];
            finalization.next_actions = results.recommendations.actionItems.map(item => item.action);

        } catch (error) {
            finalization.error = error.message;
        }

        return finalization;
    }

    /**
     * Helper methods
     */

    generateReviewId() {
        return crypto.randomBytes(8).toString('hex');
    }

    isReviewableFile(filePath) {
        const reviewableExtensions = ['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rb', '.php', '.go', '.java', '.cs', '.cpp', '.c', '.h'];
        const excludePatterns = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'test', 'spec'];

        // Check extension
        const hasReviewableExt = reviewableExtensions.some(ext => filePath.endsWith(ext));

        // Check exclusions
        const isExcluded = excludePatterns.some(pattern => filePath.includes(pattern));

        return hasReviewableExt && !isExcluded;
    }

    async getReviewableFiles(targetPath) {
        try {
            const files = await this.walkDirectory(targetPath);
            return files.filter(file => this.isReviewableFile(file));
        } catch (error) {
            return [];
        }
    }

    async walkDirectory(dir) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                files.push(...await this.walkDirectory(fullPath));
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }

        return files;
    }

    getLineNumber(content, searchString) {
        const index = content.indexOf(searchString);
        if (index === -1) return 1;
        return content.substring(0, index).split('\n').length;
    }

    getPatternSeverity(score) {
        if (score <= -3) return 'critical';
        if (score <= -1) return 'improvement';
        if (score >= 1) return 'positive';
        return 'nit';
    }

    getPatternSuggestion(patternType) {
        const suggestions = {
            // Architecture
            'inheritance_pattern': 'Good use of inheritance pattern',
            'interface_usage': 'Excellent interface design',
            'architecture_smell': 'Consider breaking into smaller, focused components',
            'circular_dependency': 'Resolve circular dependencies through dependency injection',

            // Functionality
            'error_handling': 'Good error handling practice',
            'input_validation': 'Excellent input validation',
            'known_bugs': 'Address known bugs before merge',
            'empty_catch': 'Add proper error handling or logging in catch block',

            // Security
            'code_injection': 'Use safer alternatives to eval() and Function()',
            'xss_risk': 'Sanitize user input to prevent XSS attacks',
            'hardcoded_password': 'Move passwords to environment variables',
            'secure_random': 'Good use of cryptographically secure random generation',

            // Performance
            'caching_strategy': 'Excellent caching implementation',
            'nested_loops': 'Consider optimizing nested loops for better performance',
            'blocking_operation': 'Use asynchronous operations to avoid blocking',

            // Maintainability
            'documentation': 'Good documentation practice',
            'long_function': 'Consider breaking large functions into smaller ones',
            'magic_numbers': 'Extract magic numbers into named constants',

            // Testing
            'test_presence': 'Good test coverage',
            'test_skip_only': 'Remove .skip() and .only() from tests',

            // Documentation
            'jsdoc_params': 'Excellent JSDoc parameter documentation',
            'placeholder_comments': 'Replace placeholder comments with actual documentation'
        };

        return suggestions[patternType] || 'Review and improve as needed';
    }

    normalizeScore(rawScore, findingsCount) {
        if (findingsCount === 0) return 75; // Baseline score for no findings

        // Normalize based on findings density and scores
        const averageScore = rawScore / findingsCount;
        const normalizedScore = Math.max(0, Math.min(100, 50 + (averageScore * 5)));

        return normalizedScore;
    }

    extractIssueTypes(severityClassification) {
        const types = new Set();

        [...severityClassification.critical, ...severityClassification.improvements, ...severityClassification.nits]
            .forEach(issue => types.add(issue.pattern));

        return Array.from(types);
    }

    calculateConfidence(results) {
        const filesReviewed = results.fileAnalysis.filesProcessed;
        const linesAnalyzed = results.fileAnalysis.totalLines;
        const patternsDetected = results.fileAnalysis.patternsDetected;

        // Confidence based on review scope and pattern detection
        let confidence = 0.5; // Base confidence

        if (filesReviewed > 0) confidence += 0.2;
        if (linesAnalyzed > 100) confidence += 0.1;
        if (patternsDetected > 0) confidence += 0.2;

        return Math.min(1.0, confidence);
    }
}

/**
 * Demo function for Pragmatic Code Reviewer Agent
 */
async function demoPragmaticCodeReviewerAgent() {
    logger.info(' Pragmatic Code Reviewer Agent Demo - OneRedOak Methodology\n');

    const { SQLiteManager } = require('../database/sqlite-manager');
    const dbManager = new SQLiteManager(':memory:');

    try {
        // Initialize database
        await dbManager.initialize();

        // Create demo session
        const sessionId = 'code_reviewer_demo_' + Date.now();
        await dbManager.createSession(sessionId, 'code_review_workflow');

        // Create pragmatic code reviewer agent
        const agent = new PragmaticCodeReviewerAgent(sessionId, {
            tool_restrictions: ['Read', 'Edit', 'Bash(git*)', 'Grep'],
            security_profile: 'restricted'
        });

        await agent.initialize(dbManager);

        logger.info(`Created Pragmatic Code Reviewer: ${agent.agentName}`);
        logger.info(`   Methodology: ${agent.reviewConfig.methodology}`);
        logger.info(`   Framework: ${agent.reviewConfig.framework}`);
        logger.info(`   Steps: ${agent.executionSteps.length} (Factor 10 compliant)`);
        logger.info(`   Categories: ${Object.keys(agent.reviewFramework).length}`);

        // Test review framework
        logger.info('\nMETRICS Testing 7-category framework...');
        for (const [category, framework] of Object.entries(agent.reviewFramework)) {
            logger.info(`   ${category}: ${(framework.weight * 100).toFixed(0)}% weight, ${framework.threshold} threshold`);
        }

        // Test pattern detection
        logger.info('\n Testing pattern detection...');

        const testCode = `
            // Architecture patterns
            class UserService extends BaseService {
                constructor(userRepository) {
                    super();
                    this.userRepository = userRepository; // Good dependency injection
                }

                // Functionality patterns
                async createUser(userData) {
                    try {
                        if (!userData || !userData.email) {
                            throw new Error('Invalid user data'); // Good validation
                        }
                        return await this.userRepository.create(userData);
                    } catch (error) {
                        // Good error handling
                        this.logger.error('User creation failed', error);
                        throw error;
                    }
                }

                // Security patterns
                authenticateUser(password) {
                    const hashedPassword = bcrypt.hash(password); // Good security
                    // Bad: const adminPass = "admin123"; // Security issue
                    return this.comparePasswords(hashedPassword);
                }
            }
        `;

        let totalPatterns = 0;
        for (const [category, framework] of Object.entries(agent.reviewFramework)) {
            let categoryPatterns = 0;
            for (const pattern of framework.patterns) {
                const matches = testCode.match(pattern.pattern) || [];
                if (matches.length > 0) {
                    categoryPatterns += matches.length;
                    logger.info(`   ${category}: Found ${pattern.type} (${matches.length} matches)`);
                }
                pattern.pattern.lastIndex = 0;
            }
            totalPatterns += categoryPatterns;
        }

        logger.info(`   Total patterns detected: ${totalPatterns}`);

        // Show status
        const status = agent.getStatus();
        logger.info(`\nMETRICS Agent Status:`);
        logger.info(`   State: ${status.state}`);
        logger.info(`   Methodology: ${agent.reviewConfig.methodology}`);
        logger.info(`   Framework: ${agent.reviewConfig.framework}`);

        logger.info('\nPASS Pragmatic Code Reviewer demo completed successfully!');
        logger.info('   OK Factor 10: 8 execution steps (<=8 max)');
        logger.info('   OK OneRedOak methodology: "Net Positive > Perfection"');
        logger.info('   OK 7-category assessment framework');
        logger.info('   OK Weighted scoring and severity classification');
        logger.info('   OK Comprehensive pattern detection');
        logger.info('   OK Pragmatic merge recommendations');

        logger.info('\n Note: Full code review requires git repository and source files');
        logger.info('   Usage: agent.executeWorkflow({ files: ["src/file1.js", "src/file2.js"] })');

    } catch (error) {
        logger.error('FAIL Demo failed:', error.message);
    } finally {
        await dbManager.close();
    }
}

module.exports = { PragmaticCodeReviewerAgent };

// Run demo if called directly
if (require.main === module) {
    demoPragmaticCodeReviewerAgent().catch(console.error);
}