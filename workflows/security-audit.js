/**
 * Security Audit Workflow Template
 * Comprehensive security and efficiency audit with structured phases
 * Designed for LonicFLex Universal Context System with Workflow Engine
 */

module.exports = function createSecurityAuditWorkflow() {
    return {
        name: 'Security Audit',
        version: '1.0.0',
        description: 'Comprehensive security and efficiency audit workflow with evidence-based validation',
        author: 'LonicFLex Code Reviewer Agent',
        tags: ['security', 'audit', 'efficiency', 'quality-assurance'],
        
        // Estimated total duration: 45-60 minutes
        estimatedDuration: 3600000, // 60 minutes
        
        phases: [
            {
                name: 'Intelligence Planning',
                description: 'Analyze codebase, assess scope, and create intelligent audit plan',
                requiredAgent: 'Code Reviewer Agent',
                estimatedDuration: 900000, // 15 minutes
                
                tasks: [
                    {
                        id: 'codebase_analysis',
                        name: 'Codebase Architecture Analysis',
                        description: 'Analyze codebase size, complexity, technology stack, and risk areas',
                        priority: 'high',
                        estimatedTime: 300000, // 5 minutes
                        verificationCommand: 'find . -name "*.js" | wc -l && du -sh . && npm list --depth=0',
                        successCriteria: 'Complete inventory of files, dependencies, and architecture documented'
                    },
                    {
                        id: 'risk_assessment',
                        name: 'Security Risk Assessment',
                        description: 'Identify high-risk components, external integrations, and potential attack vectors',
                        priority: 'high',
                        estimatedTime: 300000, // 5 minutes
                        dependencies: ['codebase_analysis'],
                        successCriteria: 'Risk matrix created with high/medium/low risk areas identified'
                    },
                    {
                        id: 'tool_selection',
                        name: 'Audit Tool Selection and Configuration',
                        description: 'Select and configure appropriate security and performance testing tools',
                        priority: 'medium',
                        estimatedTime: 300000, // 5 minutes
                        availableTools: [
                            'npm run demo-security-agent',
                            'npm run demo-security-scanner', 
                            'npm run demo-performance',
                            'npm run demo-monitoring',
                            'npm run demo-testing-framework'
                        ],
                        successCriteria: 'All audit tools tested and confirmed working'
                    }
                ],
                
                qualityGates: [
                    {
                        id: 'planning_completeness',
                        name: 'Planning Completeness Gate',
                        criteria: 'All analysis tasks completed with documented evidence',
                        validationMethod: 'evidence_review',
                        requiredEvidence: ['codebase_inventory', 'risk_matrix', 'tool_verification'],
                        blockingLevel: 'critical'
                    },
                    {
                        id: 'scope_clarity',
                        name: 'Audit Scope Clarity',
                        criteria: 'Clear audit scope defined with measurable success criteria',
                        validationMethod: 'manual',
                        blockingLevel: 'high'
                    }
                ]
            },
            
            {
                name: 'Security Scanning Execution',
                description: 'Execute comprehensive security scans with systematic evidence collection',
                requiredAgent: 'Code Reviewer Agent', // Can coordinate with Security Agent
                estimatedDuration: 1800000, // 30 minutes
                
                tasks: [
                    {
                        id: 'dependency_vulnerability_scan',
                        name: 'Dependency Vulnerability Scan',
                        description: 'Scan all dependencies for known vulnerabilities and security issues',
                        priority: 'critical',
                        estimatedTime: 600000, // 10 minutes
                        executionCommand: 'npm run demo-security-agent',
                        verificationCommand: 'grep -i "vulnerability\\|security" logs/security.log | wc -l',
                        successCriteria: 'Zero critical vulnerabilities, documented medium/low findings'
                    },
                    {
                        id: 'source_code_security_scan',
                        name: 'Source Code Security Analysis',
                        description: 'Analyze source code for security anti-patterns, injection vulnerabilities, and secrets',
                        priority: 'critical',
                        estimatedTime: 600000, // 10 minutes
                        executionCommand: 'npm run demo-security-scanner',
                        dependencies: ['dependency_vulnerability_scan'],
                        successCriteria: 'No exposed secrets, no critical security anti-patterns'
                    },
                    {
                        id: 'authentication_security_review',
                        name: 'Authentication & Authorization Security Review',
                        description: 'Review token management, OAuth flows, and access control implementation',
                        priority: 'high',
                        estimatedTime: 600000, // 10 minutes
                        focusAreas: ['auth/auth-manager.js', 'external-integrations/', 'token handling'],
                        successCriteria: 'Secure token storage and handling verified'
                    }
                ],
                
                qualityGates: [
                    {
                        id: 'zero_critical_vulnerabilities',
                        name: 'Zero Critical Vulnerabilities',
                        criteria: 'No critical or high-severity security vulnerabilities found',
                        validationMethod: 'automated',
                        validationCommand: 'npm run demo-security-scanner | grep -c "CRITICAL\\|HIGH" || echo "0"',
                        blockingLevel: 'critical',
                        failureAction: 'stop_workflow'
                    },
                    {
                        id: 'secrets_protection',
                        name: 'Secrets Protection Verification',
                        criteria: 'No exposed API keys, tokens, or credentials in codebase',
                        validationMethod: 'automated',
                        validationCommand: 'git log --all --full-history -- "*.env*" | wc -l',
                        blockingLevel: 'critical'
                    }
                ]
            },
            
            {
                name: 'Performance & Efficiency Audit',
                description: 'Analyze system performance, efficiency, and optimization opportunities',
                requiredAgent: 'Code Reviewer Agent',
                estimatedDuration: 900000, // 15 minutes
                
                tasks: [
                    {
                        id: 'performance_baseline_analysis',
                        name: 'Performance Baseline Analysis',
                        description: 'Establish performance baselines and identify bottlenecks',
                        priority: 'high',
                        estimatedTime: 450000, // 7.5 minutes
                        executionCommand: 'npm run demo-performance',
                        successCriteria: 'Performance baselines documented, bottlenecks identified'
                    },
                    {
                        id: 'resource_efficiency_review',
                        name: 'Resource Efficiency Review',
                        description: 'Analyze memory usage, CPU utilization, and resource optimization opportunities',
                        priority: 'medium',
                        estimatedTime: 450000, // 7.5 minutes
                        executionCommand: 'npm run demo-monitoring',
                        dependencies: ['performance_baseline_analysis'],
                        successCriteria: 'Resource utilization analyzed, optimization opportunities identified'
                    }
                ],
                
                qualityGates: [
                    {
                        id: 'performance_acceptable',
                        name: 'Performance Within Acceptable Limits',
                        criteria: 'System performance meets or exceeds established benchmarks',
                        validationMethod: 'benchmark_comparison',
                        benchmarks: {
                            'context_resume_time': '< 2000ms',
                            'compression_ratio': '> 70%',
                            'memory_usage': '< 500MB'
                        },
                        blockingLevel: 'medium'
                    }
                ]
            },
            
            {
                name: 'Integration & System Validation',
                description: 'Validate security doesn\'t break functionality and system remains operational',
                requiredAgent: 'Code Reviewer Agent',
                estimatedDuration: 600000, // 10 minutes
                
                tasks: [
                    {
                        id: 'functionality_validation',
                        name: 'Core Functionality Validation',
                        description: 'Verify all core systems remain operational after security review',
                        priority: 'critical',
                        estimatedTime: 300000, // 5 minutes
                        executionCommand: 'npm run test-universal-context && npm run test-phase3a-integration',
                        successCriteria: '100% test success rate maintained'
                    },
                    {
                        id: 'integration_security_check',
                        name: 'Integration Security Validation',
                        description: 'Verify external integrations (GitHub, Slack) remain secure and functional',
                        priority: 'high',
                        estimatedTime: 300000, // 5 minutes
                        focusAreas: ['external-integrations/', 'API token usage', 'webhook security'],
                        successCriteria: 'All integrations secure and functional'
                    }
                ],
                
                qualityGates: [
                    {
                        id: 'no_functionality_regression',
                        name: 'No Functionality Regression',
                        criteria: 'All existing functionality continues to work properly',
                        validationMethod: 'automated',
                        validationCommand: 'npm run test-universal-context && npm run test-phase3a-integration',
                        blockingLevel: 'critical',
                        successThreshold: '100% test pass rate'
                    }
                ]
            },
            
            {
                name: 'Reporting & Learning Capture',
                description: 'Generate comprehensive audit report and capture learnings for system improvement',
                requiredAgent: 'Code Reviewer Agent',
                estimatedDuration: 600000, // 10 minutes
                
                tasks: [
                    {
                        id: 'comprehensive_report_generation',
                        name: 'Comprehensive Audit Report Generation',
                        description: 'Generate detailed security and efficiency audit report with actionable recommendations',
                        priority: 'high',
                        estimatedTime: 300000, // 5 minutes
                        reportSections: [
                            'Executive Summary',
                            'Security Findings (by severity)',
                            'Performance Analysis',
                            'Remediation Recommendations',
                            'Risk Assessment Updates'
                        ],
                        successCriteria: 'Complete report with actionable recommendations generated'
                    },
                    {
                        id: 'learning_capture',
                        name: 'Security Audit Learning Capture',
                        description: 'Record lessons learned and improvements for future security audits',
                        priority: 'medium',
                        estimatedTime: 300000, // 5 minutes
                        learningAreas: ['tools_effectiveness', 'process_improvements', 'common_issues', 'best_practices'],
                        successCriteria: 'Learnings recorded in memory system for future audit improvements'
                    }
                ],
                
                qualityGates: [
                    {
                        id: 'report_completeness',
                        name: 'Report Completeness and Quality',
                        criteria: 'Comprehensive report with all sections complete and actionable recommendations',
                        validationMethod: 'manual',
                        blockingLevel: 'high'
                    },
                    {
                        id: 'learning_integration',
                        name: 'Learning Integration Complete',
                        criteria: 'All learnings recorded and integrated into system memory',
                        validationMethod: 'memory_verification',
                        blockingLevel: 'low'
                    }
                ]
            }
        ],
        
        // Global workflow configuration
        configuration: {
            parallelExecution: false, // Sequential execution for audit integrity
            rollbackEnabled: true,
            learningEnabled: true,
            externalIntegration: true,
            
            // Quality standards
            qualityStandards: {
                minimumSeverityLevel: 'medium',
                requiredTestPassRate: 100,
                maxAcceptableCriticalFindings: 0,
                maxAcceptableHighFindings: 2
            },
            
            // Monitoring and alerting
            monitoring: {
                progressReporting: true,
                slackNotifications: true,
                githubIssueCreation: true
            }
        },
        
        // Success criteria for entire workflow
        successCriteria: {
            allPhasesCompleted: true,
            allCriticalQualityGatesPassed: true,
            zeroUnresolvedCriticalFindings: true,
            systemFunctionalityIntact: true,
            comprehensiveReportGenerated: true
        }
    };
};