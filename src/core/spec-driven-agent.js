const { info, warn, error } = require('../services/logger');
/**
 * Spec-First Development System for Agents
 * IMPLEMENTS: 12-factor-agents spec-driven development principles
 * SOLVES: Inconsistent agent behavior, unclear requirements, and unvalidated specifications
 *
 * Based on research from:
 * - 12-factor-agents framework (spec-first development)
 * - Design-by-contract principles
 * - Behavior-driven development (BDD) patterns
 * - OpenAPI specification patterns for AI agents
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Agent Specification Schema
 * Defines the structure for agent specifications
 */
const AGENT_SPEC_SCHEMA = {
    metadata: {
        name: 'string',
        version: 'string',
        description: 'string',
        author: 'string',
        created: 'string',
        updated: 'string'
    },
    capabilities: {
        primary_function: 'string',
        secondary_functions: 'array',
        supported_inputs: 'array',
        expected_outputs: 'array',
        error_conditions: 'array'
    },
    behavior: {
        execution_steps: 'array',
        decision_points: 'array',
        error_handling: 'object',
        timeout_behavior: 'object'
    },
    contracts: {
        preconditions: 'array',
        postconditions: 'array',
        invariants: 'array',
        side_effects: 'array'
    },
    quality: {
        performance_requirements: 'object',
        reliability_requirements: 'object',
        security_requirements: 'array',
        compliance_requirements: 'array'
    },
    testing: {
        test_scenarios: 'array',
        validation_criteria: 'array',
        acceptance_criteria: 'array'
    }
};

/**
 * Specification Validation Results
 */
const SPEC_VALIDATION_LEVELS = {
    STRICT: 'All fields required, full validation',
    MODERATE: 'Essential fields required, flexible validation',
    LOOSE: 'Minimal validation, development mode'
};

/**
 * Spec-Driven Agent System
 * Implements specification-first development for AI agents
 */
class SpecDrivenAgentSystem extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Specification validation
            validationLevel: config.validationLevel || 'MODERATE',
            enforceContracts: config.enforceContracts !== false,
            requireTests: config.requireTests !== false,

            // Specification storage
            specDirectory: config.specDirectory || './specs/agents',
            schemaValidation: config.schemaValidation !== false,

            // Development workflow
            allowDraftSpecs: config.allowDraftSpecs !== false,
            autoGenerateTests: config.autoGenerateTests !== false,
            enableVersioning: config.enableVersioning !== false,

            // Quality enforcement
            minimumCoverage: config.minimumCoverage || 80, // 80%
            requireDocumentation: config.requireDocumentation !== false,

            ...config
        };

        // Specification registry
        this.specifications = new Map(); // specId -> AgentSpecification
        this.registeredAgents = new Map(); // agentId -> RegisteredAgent
        this.validationCache = new Map(); // specId -> ValidationResult

        // Contract tracking
        this.contractViolations = new Map(); // agentId -> ContractViolation[]
        this.performanceMetrics = new Map(); // agentId -> PerformanceMetrics

        // Statistics
        this.stats = {
            totalSpecs: 0,
            validSpecs: 0,
            registeredAgents: 0,
            contractViolations: 0,
            testCoverage: 0
        };

        this.initializeSpecDirectory();
        info('Spec-Driven Agent System initialized with 12-factor principles');
    }

    /**
     * Initialize specification directory
     */
    initializeSpecDirectory() {
        if (!fs.existsSync(this.config.specDirectory)) {
            fs.mkdirSync(this.config.specDirectory, { recursive: true });
            info(`📁 Created specification directory: ${this.config.specDirectory}`);
        }
    }

    /**
     * Create agent specification
     * Main entry point for spec-first development
     */
    async createAgentSpecification(specData, options = {}) {
        const specId = specData.metadata?.name || this.generateSpecId();

        info(`Creating agent specification: ${specId}`);

        // Validate specification structure
        const validationResult = this.validateSpecification(specData);
        if (!validationResult.isValid && this.config.validationLevel === 'STRICT') {
            throw new Error(`Specification validation failed: ${validationResult.errors.join(', ')}`);
        }

        // Create specification object
        const specification = this.createSpecificationObject(specId, specData, validationResult);

        // Auto-generate tests if enabled
        if (this.config.autoGenerateTests) {
            specification.testing.generated_tests = this.generateTestSuite(specification);
        }

        // Store specification
        this.specifications.set(specId, specification);
        this.stats.totalSpecs++;

        if (validationResult.isValid) {
            this.stats.validSpecs++;
        }

        // Save to file if requested
        if (options.saveToFile !== false) {
            await this.saveSpecificationToFile(specification);
        }

        info(`Specification created: ${specId} (valid: ${validationResult.isValid})`);

        // Emit specification created event
        this.emit('specificationCreated', {
            specId,
            specification,
            validation: validationResult
        });

        return specification;
    }

    /**
     * Validate specification against schema
     */
    validateSpecification(specData) {
        const errors = [];
        const warnings = [];
        let score = 0;
        const maxScore = 100;

        try {
            // Check required metadata
            if (!specData.metadata) {
                errors.push('Missing metadata section');
            } else {
                if (!specData.metadata.name) errors.push('Missing metadata.name');
                if (!specData.metadata.description) warnings.push('Missing metadata.description');
                if (!specData.metadata.version) warnings.push('Missing metadata.version');
                score += specData.metadata.name ? 15 : 0;
                score += specData.metadata.description ? 10 : 0;
                score += specData.metadata.version ? 5 : 0;
            }

            // Check capabilities
            if (!specData.capabilities) {
                errors.push('Missing capabilities section');
            } else {
                if (!specData.capabilities.primary_function) errors.push('Missing capabilities.primary_function');
                if (!specData.capabilities.supported_inputs) warnings.push('Missing capabilities.supported_inputs');
                if (!specData.capabilities.expected_outputs) warnings.push('Missing capabilities.expected_outputs');
                score += specData.capabilities.primary_function ? 20 : 0;
                score += specData.capabilities.supported_inputs ? 10 : 0;
                score += specData.capabilities.expected_outputs ? 10 : 0;
            }

            // Check behavior specification
            if (!specData.behavior) {
                warnings.push('Missing behavior section');
            } else {
                if (!specData.behavior.execution_steps) warnings.push('Missing behavior.execution_steps');
                if (!specData.behavior.error_handling) warnings.push('Missing behavior.error_handling');
                score += specData.behavior.execution_steps ? 15 : 0;
                score += specData.behavior.error_handling ? 5 : 0;
            }

            // Check contracts (design-by-contract)
            if (!specData.contracts && this.config.enforceContracts) {
                warnings.push('Missing contracts section (preconditions/postconditions)');
            } else if (specData.contracts) {
                score += specData.contracts.preconditions ? 5 : 0;
                score += specData.contracts.postconditions ? 5 : 0;
                score += specData.contracts.invariants ? 5 : 0;
            }

            // Check testing requirements
            if (!specData.testing && this.config.requireTests) {
                warnings.push('Missing testing section');
            } else if (specData.testing) {
                score += specData.testing.test_scenarios ? 10 : 0;
                score += specData.testing.validation_criteria ? 5 : 0;
            }

            const isValid = errors.length === 0 && score >= 50; // Minimum 50% score

            return {
                isValid,
                score,
                maxScore,
                errors,
                warnings,
                completeness: Math.round((score / maxScore) * 100)
            };

        } catch (error) {
            return {
                isValid: false,
                score: 0,
                maxScore,
                errors: [`Validation error: ${error.message}`],
                warnings: [],
                completeness: 0
            };
        }
    }

    /**
     * Create specification object
     */
    createSpecificationObject(specId, specData, validation) {
        const now = new Date().toISOString();

        return {
            id: specId,
            version: specData.metadata?.version || '1.0.0',
            created: now,
            updated: now,
            status: validation.isValid ? 'valid' : 'draft',
            validation,

            // Specification data
            metadata: {
                name: specData.metadata?.name || specId,
                description: specData.metadata?.description || 'Auto-generated specification',
                author: specData.metadata?.author || 'LonicFLex System',
                version: specData.metadata?.version || '1.0.0',
                created: now,
                updated: now,
                ...specData.metadata
            },

            capabilities: {
                primary_function: specData.capabilities?.primary_function || 'Unspecified primary function',
                secondary_functions: specData.capabilities?.secondary_functions || [],
                supported_inputs: specData.capabilities?.supported_inputs || ['any'],
                expected_outputs: specData.capabilities?.expected_outputs || ['object'],
                error_conditions: specData.capabilities?.error_conditions || ['validation_failed', 'execution_timeout'],
                ...specData.capabilities
            },

            behavior: {
                execution_steps: specData.behavior?.execution_steps || ['initialize', 'execute', 'validate', 'complete'],
                decision_points: specData.behavior?.decision_points || [],
                error_handling: specData.behavior?.error_handling || { strategy: 'fail_fast', retry_limit: 3 },
                timeout_behavior: specData.behavior?.timeout_behavior || { timeout_ms: 30000, action: 'fail' },
                ...specData.behavior
            },

            contracts: {
                preconditions: specData.contracts?.preconditions || [],
                postconditions: specData.contracts?.postconditions || [],
                invariants: specData.contracts?.invariants || [],
                side_effects: specData.contracts?.side_effects || [],
                ...specData.contracts
            },

            quality: {
                performance_requirements: specData.quality?.performance_requirements || { max_execution_time: 30000 },
                reliability_requirements: specData.quality?.reliability_requirements || { min_success_rate: 95 },
                security_requirements: specData.quality?.security_requirements || ['input_validation', 'output_sanitization'],
                compliance_requirements: specData.quality?.compliance_requirements || [],
                ...specData.quality
            },

            testing: {
                test_scenarios: specData.testing?.test_scenarios || [],
                validation_criteria: specData.testing?.validation_criteria || [],
                acceptance_criteria: specData.testing?.acceptance_criteria || [],
                generated_tests: [],
                ...specData.testing
            }
        };
    }

    /**
     * Generate test suite for specification
     */
    generateTestSuite(specification) {
        const tests = [];

        // Generate basic contract tests
        if (specification.contracts.preconditions.length > 0) {
            tests.push({
                name: 'precondition_validation',
                type: 'contract_test',
                description: 'Validate all preconditions are met before execution',
                test_function: this.generatePreconditionTest(specification.contracts.preconditions)
            });
        }

        if (specification.contracts.postconditions.length > 0) {
            tests.push({
                name: 'postcondition_validation',
                type: 'contract_test',
                description: 'Validate all postconditions are satisfied after execution',
                test_function: this.generatePostconditionTest(specification.contracts.postconditions)
            });
        }

        // Generate capability tests
        if (specification.capabilities.supported_inputs.length > 0) {
            tests.push({
                name: 'input_handling',
                type: 'capability_test',
                description: 'Test handling of all supported input types',
                test_function: this.generateInputTest(specification.capabilities.supported_inputs)
            });
        }

        // Generate performance tests
        if (specification.quality.performance_requirements.max_execution_time) {
            tests.push({
                name: 'performance_test',
                type: 'performance_test',
                description: 'Validate execution time within specified limits',
                test_function: this.generatePerformanceTest(specification.quality.performance_requirements)
            });
        }

        // Generate error handling tests
        for (const errorCondition of specification.capabilities.error_conditions) {
            tests.push({
                name: `error_${errorCondition}`,
                type: 'error_test',
                description: `Test handling of ${errorCondition} error condition`,
                test_function: this.generateErrorTest(errorCondition)
            });
        }

        return tests;
    }

    /**
     * Generate precondition test
     */
    generatePreconditionTest(preconditions) {
        return `
async function testPreconditions(agent, context) {
    const preconditions = ${JSON.stringify(preconditions)};

    for (const condition of preconditions) {
        if (!await agent.validatePrecondition(condition, context)) {
            throw new Error(\`Precondition failed: \${condition}\`);
        }
    }

    return { passed: true, message: 'All preconditions satisfied' };
}`;
    }

    /**
     * Generate postcondition test
     */
    generatePostconditionTest(postconditions) {
        return `
async function testPostconditions(agent, result, context) {
    const postconditions = ${JSON.stringify(postconditions)};

    for (const condition of postconditions) {
        if (!await agent.validatePostcondition(condition, result, context)) {
            throw new Error(\`Postcondition failed: \${condition}\`);
        }
    }

    return { passed: true, message: 'All postconditions satisfied' };
}`;
    }

    /**
     * Generate input test
     */
    generateInputTest(supportedInputs) {
        return `
async function testInputHandling(agent, testInputs) {
    const supportedTypes = ${JSON.stringify(supportedInputs)};
    const results = [];

    for (const inputType of supportedTypes) {
        try {
            const testInput = generateTestInput(inputType);
            const result = await agent.execute(testInput);
            results.push({ inputType, success: this.validateSuccess(),  result });
        } catch (error) {
            results.push({ inputType, success: false, error: error.message });
        }
    }

    const successCount = results.filter(r => r.success).length;
    return {
        passed: successCount === supportedTypes.length,
        successRate: (successCount / supportedTypes.length) * 100,
        results
    };
}`;
    }

    /**
     * Generate performance test
     */
    generatePerformanceTest(performanceRequirements) {
        return `
async function testPerformance(agent, context) {
    const maxTime = ${performanceRequirements.max_execution_time || 30000};

    const startTime = Date.now();
    const result = await agent.execute(context);
    const executionTime = Date.now() - startTime;

    return {
        passed: executionTime <= maxTime,
        executionTime,
        maxAllowedTime: maxTime,
        result
    };
}`;
    }

    /**
     * Generate error test
     */
    generateErrorTest(errorCondition) {
        return `
async function testErrorCondition_${errorCondition}(agent) {
    const testContext = generateErrorContext('${errorCondition}');

    try {
        const result = await agent.execute(testContext);
        return {
            passed: false,
            message: 'Expected error but execution succeeded',
            unexpectedResult: result
        };
    } catch (error) {
        const expectedError = error.message.includes('${errorCondition}');
        return {
            passed: expectedError,
            message: expectedError
                ? 'Correctly handled ${errorCondition}'
                : \`Unexpected error: \${error.message}\`,
            error: error.message
        };
    }
}`;
    }

    /**
     * Register agent with specification
     */
    async registerAgent(agentInstance, specId, options = {}) {
        if (!this.specifications.has(specId)) {
            throw new Error(`Specification not found: ${specId}`);
        }

        const specification = this.specifications.get(specId);
        const agentId = options.agentId || `${agentInstance.constructor.name}_${Date.now()}`;

        info(`Registering agent: ${agentId} with specification: ${specId}`);

        // Validate agent implements specification
        const complianceResult = await this.validateAgentCompliance(agentInstance, specification);

        const registeredAgent = {
            id: agentId,
            instance: agentInstance,
            specId,
            specification,
            registeredAt: Date.now(),
            compliance: complianceResult,
            status: complianceResult.compliant ? 'compliant' : 'non_compliant',
            contractViolations: [],
            performanceHistory: []
        };

        this.registeredAgents.set(agentId, registeredAgent);
        this.stats.registeredAgents++;

        if (!complianceResult.compliant) {
            info(`⚠️ Agent ${agentId} is not fully compliant: ${complianceResult.violations.join(', ')}`);
        } else {
            info(`Agent ${agentId} successfully registered and compliant`);
        }

        // Emit registration event
        this.emit('agentRegistered', {
            agentId,
            specId,
            compliance: complianceResult
        });

        return registeredAgent;
    }

    /**
     * Validate agent compliance with specification
     */
    async validateAgentCompliance(agentInstance, specification) {
        const violations = [];
        let score = 0;
        const maxScore = 100;

        try {
            // Check if agent has required methods
            const requiredMethods = ['execute', 'initialize', 'cleanup'];
            for (const method of requiredMethods) {
                if (typeof agentInstance[method] === 'function') {
                    score += 15;
                } else {
                    violations.push(`Missing required method: ${method}`);
                }
            }

            // Check execution steps compliance
            if (specification.behavior.execution_steps && agentInstance.executionSteps) {
                const specSteps = specification.behavior.execution_steps.length;
                const agentSteps = agentInstance.executionSteps.length;

                if (specSteps === agentSteps) {
                    score += 20;
                } else {
                    violations.push(`Step count mismatch: spec has ${specSteps}, agent has ${agentSteps}`);
                }
            }

            // Check contract support
            if (specification.contracts.preconditions.length > 0) {
                if (typeof agentInstance.validatePrecondition === 'function') {
                    score += 10;
                } else {
                    violations.push('Missing precondition validation method');
                }
            }

            if (specification.contracts.postconditions.length > 0) {
                if (typeof agentInstance.validatePostcondition === 'function') {
                    score += 10;
                } else {
                    violations.push('Missing postcondition validation method');
                }
            }

            // Check timeout configuration
            if (specification.behavior.timeout_behavior && agentInstance.config) {
                const specTimeout = specification.behavior.timeout_behavior.timeout_ms;
                const agentTimeout = agentInstance.config.timeout;

                if (agentTimeout && agentTimeout <= specTimeout) {
                    score += 10;
                } else {
                    violations.push(`Timeout mismatch: spec allows ${specTimeout}ms, agent has ${agentTimeout || 'none'}`);
                }
            }

            // Additional capability checks
            score += Math.min(25, (100 - violations.length * 5)); // Bonus points for low violation count

            const compliant = violations.length === 0 && score >= 70;

            return {
                compliant,
                score,
                maxScore,
                violations,
                compliancePercentage: Math.round((score / maxScore) * 100)
            };

        } catch (error) {
            return {
                compliant: false,
                score: 0,
                maxScore,
                violations: [`Compliance validation error: ${error.message}`],
                compliancePercentage: 0
            };
        }
    }

    /**
     * Execute agent with contract validation
     */
    async executeAgentWithContracts(agentId, context = {}, options = {}) {
        if (!this.registeredAgents.has(agentId)) {
            throw new Error(`Agent not registered: ${agentId}`);
        }

        const registeredAgent = this.registeredAgents.get(agentId);
        const { instance: agent, specification } = registeredAgent;

        info(`🏃 Executing agent ${agentId} with contract validation`);

        const executionStart = Date.now();
        let contractViolations = [];

        try {
            // 1. Validate preconditions
            if (specification.contracts.preconditions.length > 0 && agent.validatePrecondition) {
                for (const precondition of specification.contracts.preconditions) {
                    const isValid = await agent.validatePrecondition(precondition, context);
                    if (!isValid) {
                        contractViolations.push({
                            type: 'precondition',
                            condition: precondition,
                            message: 'Precondition not satisfied'
                        });
                    }
                }

                if (contractViolations.length > 0 && this.config.enforceContracts) {
                    throw new Error(`Precondition violations: ${contractViolations.map(v => v.condition).join(', ')}`);
                }
            }

            // 2. Execute agent
            const result = await agent.execute(context);

            // 3. Validate postconditions
            if (specification.contracts.postconditions.length > 0 && agent.validatePostcondition) {
                for (const postcondition of specification.contracts.postconditions) {
                    const isValid = await agent.validatePostcondition(postcondition, result, context);
                    if (!isValid) {
                        contractViolations.push({
                            type: 'postcondition',
                            condition: postcondition,
                            message: 'Postcondition not satisfied'
                        });
                    }
                }

                if (contractViolations.some(v => v.type === 'postcondition') && this.config.enforceContracts) {
                    throw new Error(`Postcondition violations: ${contractViolations.filter(v => v.type === 'postcondition').map(v => v.condition).join(', ')}`);
                }
            }

            // 4. Record performance metrics
            const executionTime = Date.now() - executionStart;
            const performanceRecord = {
                timestamp: Date.now(),
                executionTime,
                success: this.validateSuccess(), 
                contractViolations: contractViolations.length,
                context: Object.keys(context)
            };

            registeredAgent.performanceHistory.push(performanceRecord);

            // 5. Check performance requirements
            if (specification.quality.performance_requirements.max_execution_time) {
                const maxTime = specification.quality.performance_requirements.max_execution_time;
                if (executionTime > maxTime) {
                    contractViolations.push({
                        type: 'performance',
                        condition: `max_execution_time: ${maxTime}ms`,
                        message: `Execution took ${executionTime}ms, exceeding limit`
                    });
                }
            }

            info(`Agent ${agentId} executed successfully (${executionTime}ms, ${contractViolations.length} violations)`);

            return {
                agentId,
                result,
                executionTime,
                contractViolations,
                specification: specification.id,
                performance: performanceRecord
            };

        } catch (error) {
            const executionTime = Date.now() - executionStart;
            const performanceRecord = {
                timestamp: Date.now(),
                executionTime,
                success: false,
                error: error.message,
                contractViolations: contractViolations.length,
                context: Object.keys(context)
            };

            registeredAgent.performanceHistory.push(performanceRecord);

            error(`);

            throw error;
        }
    }

    /**
     * Save specification to file
     */
    async saveSpecificationToFile(specification) {
        const fileName = `${specification.id}.spec.json`;
        const filePath = path.join(this.config.specDirectory, fileName);

        try {
            const specData = JSON.stringify(specification, null, 2);
            fs.writeFileSync(filePath, specData);
            info(`💾 Specification saved: ${filePath}`);
        } catch (error) {
            error(`❌ Failed to save specification: ${error.message}`);
        }
    }

    /**
     * Load specification from file
     */
    async loadSpecificationFromFile(filePath) {
        try {
            const specData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const specId = specData.id || path.basename(filePath, '.spec.json');

            this.specifications.set(specId, specData);
            this.stats.totalSpecs++;

            if (specData.status === 'valid') {
                this.stats.validSpecs++;
            }

            info(`Specification loaded: ${specId}`);
            return specData;
        } catch (error) {
            throw new Error(`Failed to load specification: ${error.message}`);
        }
    }

    /**
     * Generate unique specification ID
     */
    generateSpecId() {
        return `agent_spec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get system statistics
     */
    getStats() {
        return {
            ...this.stats,
            validationLevel: this.config.validationLevel,
            specComplianceRate: this.stats.totalSpecs > 0 ? Math.round((this.stats.validSpecs / this.stats.totalSpecs) * 100) : 0,
            avgContractViolations: this.calculateAverageContractViolations(),
            testCoverage: this.calculateTestCoverage()
        };
    }

    /**
     * Calculate average contract violations
     */
    calculateAverageContractViolations() {
        if (this.registeredAgents.size === 0) return 0;

        let totalViolations = 0;
        for (const agent of this.registeredAgents.values()) {
            totalViolations += agent.contractViolations.length;
        }

        return Math.round(totalViolations / this.registeredAgents.size);
    }

    /**
     * Calculate test coverage
     */
    calculateTestCoverage() {
        if (this.specifications.size === 0) return 0;

        let totalTests = 0;
        let coveredSpecs = 0;

        for (const spec of this.specifications.values()) {
            const hasTests = spec.testing.test_scenarios.length > 0 ||
                           spec.testing.generated_tests.length > 0;
            if (hasTests) {
                coveredSpecs++;
                totalTests += spec.testing.test_scenarios.length + spec.testing.generated_tests.length;
            }
        }

        return Math.round((coveredSpecs / this.specifications.size) * 100);
    }

    /**
     * Generate compliance report
     */
    generateComplianceReport() {
        return {
            system: this.getStats(),
            specifications: Array.from(this.specifications.values()).map(spec => ({
                id: spec.id,
                status: spec.status,
                completeness: spec.validation.completeness,
                testCoverage: spec.testing.test_scenarios.length + spec.testing.generated_tests.length
            })),
            agents: Array.from(this.registeredAgents.values()).map(agent => ({
                id: agent.id,
                specId: agent.specId,
                compliance: agent.compliance.compliancePercentage,
                violations: agent.contractViolations.length,
                performance: agent.performanceHistory.slice(-5) // Last 5 executions
            }))
        };
    }

    /**
     * Cleanup and shutdown
     */
    async cleanup() {
        this.specifications.clear();
        this.registeredAgents.clear();
        this.validationCache.clear();
        this.contractViolations.clear();
        this.performanceMetrics.clear();
        this.removeAllListeners();

        info('Spec-Driven Agent System cleanup complete');
    }
}

module.exports = {
    SpecDrivenAgentSystem,
    AGENT_SPEC_SCHEMA,
    SPEC_VALIDATION_LEVELS
};

// Demo execution
async function demoSpecDrivenAgent() {
    info('Spec-Driven Agent System Demo\n');

    const specSystem = new SpecDrivenAgentSystem({
        validationLevel: 'MODERATE',
        autoGenerateTests: true,
        enforceContracts: true
    });

    try {
        info('📝 Creating agent specifications...\n');

        // Test 1: Create comprehensive specification
        info('🔹 Test 1: Create comprehensive SecurityAgent specification');
        const securityAgentSpec = await specSystem.createAgentSpecification({
            metadata: {
                name: 'SecurityAgent',
                version: '1.0.0',
                description: 'Agent for security vulnerability scanning and analysis',
                author: 'LonicFLex Security Team'
            },
            capabilities: {
                primary_function: 'Scan code for security vulnerabilities',
                secondary_functions: ['Generate security reports', 'Suggest remediation'],
                supported_inputs: ['code_files', 'repository_urls', 'code_snippets'],
                expected_outputs: ['security_report', 'vulnerability_list'],
                error_conditions: ['invalid_code', 'scan_timeout', 'dependency_error']
            },
            behavior: {
                execution_steps: ['initialize', 'scan_dependencies', 'analyze_code', 'generate_report', 'validate_findings'],
                error_handling: { strategy: 'continue_on_non_critical', retry_limit: 2 },
                timeout_behavior: { timeout_ms: 120000, action: 'partial_results' }
            },
            contracts: {
                preconditions: ['code_input_provided', 'scan_tools_available'],
                postconditions: ['security_report_generated', 'findings_categorized'],
                invariants: ['no_false_positives_in_critical_findings'],
                side_effects: ['temporary_files_created', 'scan_logs_written']
            },
            quality: {
                performance_requirements: { max_execution_time: 120000 },
                reliability_requirements: { min_success_rate: 95 },
                security_requirements: ['input_sanitization', 'secure_file_handling']
            },
            testing: {
                test_scenarios: [
                    'scan_clean_code_expects_no_vulnerabilities',
                    'scan_vulnerable_code_expects_findings',
                    'invalid_input_expects_graceful_error'
                ],
                validation_criteria: ['all_critical_vulnerabilities_detected', 'false_positive_rate_under_5_percent']
            }
        });

        info(`   Specification completeness: ${securityAgentSpec.validation.completeness}%`);
        info(`   Generated tests: ${securityAgentSpec.testing.generated_tests.length}`);

        // Test 2: Create minimal specification
        info('\n🔸 Test 2: Create minimal agent specification');
        const minimalSpec = await specSystem.createAgentSpecification({
            metadata: {
                name: 'SimpleAgent'
            },
            capabilities: {
                primary_function: 'Perform simple data processing'
            }
        });

        info(`   Specification completeness: ${minimalSpec.validation.completeness}%`);
        info(`   Validation errors: ${minimalSpec.validation.errors.length}`);
        info(`   Validation warnings: ${minimalSpec.validation.warnings.length}`);

        // Test 3: Mock agent registration (demo purposes)
        info('\n🔺 Test 3: Agent registration and compliance validation');

        // Create mock agent that implements the specification
        const mockSecurityAgent = {
            executionSteps: ['initialize', 'scan_dependencies', 'analyze_code', 'generate_report', 'validate_findings'],
            config: { timeout: 120000 },

            async initialize() { return true; },
            async execute(context) {
                return {
                    vulnerabilities: [],
                    scan_time: Date.now(),
                    success: this.validateSuccess()
                };
            },
            async cleanup() { return true; },
            async validatePrecondition(condition, context) {
                return condition === 'code_input_provided' ? !!context.code : true;
            },
            async validatePostcondition(condition, result, context) {
                return condition === 'security_report_generated' ? !!result.scan_time : true;
            }
        };

        const registeredAgent = await specSystem.registerAgent(mockSecurityAgent, 'SecurityAgent', {
            agentId: 'security_agent_demo'
        });

        info(`   Agent compliance: ${registeredAgent.compliance.compliancePercentage}%`);
        info(`   Compliance violations: ${registeredAgent.compliance.violations.length}`);

        // Test 4: Execute agent with contract validation
        if (registeredAgent.compliance.compliant) {
            info('\n🚀 Test 4: Execute agent with contract validation');

            const executionResult = await specSystem.executeAgentWithContracts('security_agent_demo', {
                code: 'function test() { return true; }'
            });

            info(`   Execution time: ${executionResult.executionTime}ms`);
            info(`   Contract violations: ${executionResult.contractViolations.length}`);
        }

        // Show system statistics
        const stats = specSystem.getStats();
        info('\n📊 System Statistics:');
        info(`   Total specifications: ${stats.totalSpecs}`);
        info(`   Valid specifications: ${stats.validSpecs}`);
        info(`   Registered agents: ${stats.registeredAgents}`);
        info(`   Spec compliance rate: ${stats.specComplianceRate}%`);
        info(`   Test coverage: ${stats.testCoverage}%`);

        info('\n🎉 Spec-Driven Agent Demo Complete!');
        info('Key features demonstrated:');
        info('  ✅ Specification creation and validation');
        info('  ✅ Auto-generated test suite creation');
        info('  ✅ Agent compliance verification');
        info('  ✅ Contract-based execution (preconditions/postconditions)');
        info('  ✅ Performance requirement enforcement');

    } catch (error) {
        error('❌ Demo failed:', error.message);
    } finally {
        await specSystem.cleanup();
    }
}

// Run demo if called directly
if (require.main === module) {
    demoSpecDrivenAgent().catch(console.error);
}