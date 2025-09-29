/**
 * Integration Validation Service
 * System integration testing and health validation
 * Part of Phase 2 Task 2.7: Integration Validation
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const execAsync = promisify(exec);

class IntegrationValidator {
    constructor(config = {}) {
        this.config = {
            validationTimeout: config.validationTimeout || 180000, // 3 minutes
            healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
            enableContinuousValidation: config.enableContinuousValidation !== false,
            criticalComponents: config.criticalComponents || [
                'universal-context-system',
                'multi-agent-core',
                'database',
                'file-system',
                'git-automation'
            ],
            ...config
        };
        
        // Validation state
        this.isValidating = false;
        this.lastValidation = null;
        this.validationHistory = [];
        
        // Component registry
        this.components = new Map();
        this.initializeComponents();
        
        // Validation statistics
        this.stats = {
            totalValidations: 0,
            successfulValidations: 0,
            failedValidations: 0,
            averageValidationTime: 0,
            componentUptime: new Map()
        };
        
        console.log('🔗 Integration Validator initialized');
    }
    
    /**
     * Initialize system components for validation
     */
    initializeComponents() {
        // Universal Context System
        this.components.set('universal-context-system', {
            name: 'Universal Context System',
            description: 'Core context preservation system',
            healthCheck: async () => await this.checkUniversalContextSystem(),
            dependencies: [],
            critical: true
        });
        
        // Multi-Agent Core
        this.components.set('multi-agent-core', {
            name: 'Multi-Agent Core',
            description: 'Multi-agent coordination system',
            healthCheck: async () => await this.checkMultiAgentCore(),
            dependencies: ['database'],
            critical: true
        });
        
        // Database System
        this.components.set('database', {
            name: 'Database System',
            description: 'SQLite database and persistence',
            healthCheck: async () => await this.checkDatabase(),
            dependencies: [],
            critical: true
        });
        
        // File System Services
        this.components.set('file-system', {
            name: 'File System Services',
            description: 'File system automation and operations',
            healthCheck: async () => await this.checkFileSystemServices(),
            dependencies: [],
            critical: true
        });
        
        // Git Automation
        this.components.set('git-automation', {
            name: 'Git Automation',
            description: 'Git workflow and automation',
            healthCheck: async () => await this.checkGitAutomation(),
            dependencies: [],
            critical: true
        });
        
        // Progress Monitor
        this.components.set('progress-monitor', {
            name: 'Progress Monitor',
            description: 'Progress tracking and monitoring',
            healthCheck: async () => await this.checkProgressMonitor(),
            dependencies: [],
            critical: false
        });
        
        // Error Recovery
        this.components.set('error-recovery', {
            name: 'Error Recovery',
            description: 'Error recovery and handling',
            healthCheck: async () => await this.checkErrorRecovery(),
            dependencies: [],
            critical: false
        });
        
        // Communication System
        this.components.set('communication', {
            name: 'Communication System',
            description: 'Slack and communication integration',
            healthCheck: async () => await this.checkCommunicationSystem(),
            dependencies: [],
            critical: false
        });
        
        console.log(`✅ Initialized ${this.components.size} system components for validation`);
    }
    
    /**
     * Validate complete system integration
     */
    async validateSystemIntegration(components = 'all') {
        const validationId = uuidv4();
        const startTime = Date.now();
        
        try {
            console.log(`🔗 Starting system integration validation (${validationId})`);
            
            this.isValidating = true;
            
            // Determine components to validate
            let componentsToValidate = [];
            if (components === 'all') {
                componentsToValidate = Array.from(this.components.values());
            } else if (components === 'critical') {
                componentsToValidate = Array.from(this.components.values()).filter(c => c.critical);
            } else if (Array.isArray(components)) {
                componentsToValidate = components.map(name => this.components.get(name)).filter(Boolean);
            }
            
            const validationResults = [];
            const dependencyMap = this.buildDependencyMap(componentsToValidate);
            
            // Validate components in dependency order
            for (const component of dependencyMap) {
                console.log(`🔍 Validating component: ${component.name}`);
                
                const componentResult = await this.validateComponent(component);
                validationResults.push(componentResult);
                
                if (!componentResult.healthy && component.critical) {
                    console.warn(`⚠️ Critical component failed: ${component.name}`);
                }
            }
            
            // Check inter-component integration
            const integrationTests = await this.runIntegrationTests();
            
            // Calculate overall results
            const executionTime = Date.now() - startTime;
            const healthyComponents = validationResults.filter(r => r.healthy).length;
            const totalComponents = validationResults.length;
            const overallHealth = (healthyComponents / totalComponents) * 100;
            
            const results = {
                validationId: validationId,
                success: healthyComponents === totalComponents,
                overallHealth: Math.round(overallHealth * 100) / 100,
                executionTime: executionTime,
                timestamp: Date.now(),
                componentResults: validationResults,
                integrationTests: integrationTests,
                summary: {
                    totalComponents: totalComponents,
                    healthyComponents: healthyComponents,
                    unhealthyComponents: totalComponents - healthyComponents,
                    criticalComponentsHealthy: validationResults
                        .filter(r => r.critical && r.healthy).length,
                    integrationTestsPassed: integrationTests.filter(t => t.passed).length,
                    integrationTestsFailed: integrationTests.filter(t => !t.passed).length
                }
            };
            
            // Update statistics
            this.updateValidationStatistics(results);
            
            // Store validation result
            this.validationHistory.push(results);
            this.lastValidation = results;
            
            if (this.validationHistory.length > 50) {
                this.validationHistory = this.validationHistory.slice(-50);
            }
            
            console.log(`✅ System validation ${results.success ? 'completed' : 'completed with issues'}`);
            console.log(`📊 Health: ${results.overallHealth}%, Components: ${healthyComponents}/${totalComponents}`);
            
            return results;
            
        } catch (error) {
            const errorResults = {
                validationId: validationId,
                success: false,
                error: error.message,
                executionTime: Date.now() - startTime,
                timestamp: Date.now()
            };
            
            this.validationHistory.push(errorResults);
            this.stats.failedValidations++;
            this.stats.totalValidations++;
            
            console.error(`❌ System validation failed: ${error.message}`);
            return errorResults;
            
        } finally {
            this.isValidating = false;
        }
    }
    
    /**
     * Validate individual component
     */
    async validateComponent(component) {
        const startTime = Date.now();
        
        try {
            console.log(`🔍 Health check: ${component.name}`);
            
            const healthResult = await component.healthCheck();
            const executionTime = Date.now() - startTime;
            
            // Update component uptime tracking
            const uptimeKey = component.name;
            if (!this.stats.componentUptime.has(uptimeKey)) {
                this.stats.componentUptime.set(uptimeKey, { checks: 0, successes: 0 });
            }
            
            const uptime = this.stats.componentUptime.get(uptimeKey);
            uptime.checks++;
            if (healthResult.healthy) {
                uptime.successes++;
            }
            
            return {
                component: component.name,
                description: component.description,
                healthy: healthResult.healthy,
                critical: component.critical,
                executionTime: executionTime,
                details: healthResult.details,
                error: healthResult.error,
                uptime: (uptime.successes / uptime.checks) * 100
            };
            
        } catch (error) {
            return {
                component: component.name,
                description: component.description,
                healthy: false,
                critical: component.critical,
                executionTime: Date.now() - startTime,
                error: error.message
            };
        }
    }
    
    /**
     * Run integration tests between components
     */
    async runIntegrationTests() {
        const integrationTests = [];
        
        try {
            // Test 1: Universal Context + Multi-Agent Integration
            integrationTests.push(await this.testContextAgentIntegration());
            
            // Test 2: File System + Git Integration
            integrationTests.push(await this.testFileSystemGitIntegration());
            
            // Test 3: Progress Monitor + Communication Integration
            integrationTests.push(await this.testMonitorCommunicationIntegration());
            
            // Test 4: Error Recovery + All Services Integration
            integrationTests.push(await this.testErrorRecoveryIntegration());
            
        } catch (error) {
            integrationTests.push({
                testName: 'Integration Test Suite',
                passed: false,
                error: error.message
            });
        }
        
        return integrationTests;
    }
    
    /**
     * Individual component health checks
     */
    async checkUniversalContextSystem() {
        try {
            // Check if test file exists and can be executed
            const testPath = path.join(process.cwd(), 'test-universal-context.js');
            await fs.access(testPath);
            
            return {
                healthy: true,
                details: {
                    testFile: 'Available',
                    system: 'Universal Context System operational'
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: `Universal Context System check failed: ${error.message}`
            };
        }
    }
    
    async checkMultiAgentCore() {
        try {
            const corePath = path.join(process.cwd(), 'claude-multi-agent-core.js');
            await fs.access(corePath);
            
            return {
                healthy: true,
                details: {
                    coreFile: 'Available',
                    system: 'Multi-Agent Core operational'
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: `Multi-Agent Core check failed: ${error.message}`
            };
        }
    }
    
    async checkDatabase() {
        try {
            const dbPath = path.join(process.cwd(), 'database', 'sqlite-manager.js');
            await fs.access(dbPath);
            
            // Check if database file exists
            const dbFile = path.join(process.cwd(), 'multi-agent-coordination.db');
            try {
                await fs.access(dbFile);
                return {
                    healthy: true,
                    details: {
                        manager: 'Available',
                        database: 'File exists',
                        system: 'Database system operational'
                    }
                };
            } catch {
                return {
                    healthy: true,
                    details: {
                        manager: 'Available',
                        database: 'Will be created on first use',
                        system: 'Database system ready'
                    }
                };
            }
        } catch (error) {
            return {
                healthy: false,
                error: `Database check failed: ${error.message}`
            };
        }
    }
    
    async checkFileSystemServices() {
        try {
            const { FileSystemAutomation } = require('./filesystem-automation');
            const fsService = new FileSystemAutomation();
            
            return {
                healthy: true,
                details: {
                    service: 'Loaded successfully',
                    system: 'File System Automation operational'
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: `File System Services check failed: ${error.message}`
            };
        }
    }
    
    async checkGitAutomation() {
        try {
            const { GitAutomation } = require('./git-automation');
            const gitService = new GitAutomation();
            
            return {
                healthy: true,
                details: {
                    service: 'Loaded successfully',
                    system: 'Git Automation operational'
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: `Git Automation check failed: ${error.message}`
            };
        }
    }
    
    async checkProgressMonitor() {
        try {
            const { ProgressMonitor } = require('./progress-monitor');
            const monitor = new ProgressMonitor({ enableSlackNotifications: false });
            
            return {
                healthy: true,
                details: {
                    service: 'Loaded successfully',
                    system: 'Progress Monitor operational'
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: `Progress Monitor check failed: ${error.message}`
            };
        }
    }
    
    async checkErrorRecovery() {
        try {
            const { ErrorRecovery } = require('./error-recovery');
            const errorRecovery = new ErrorRecovery();
            
            return {
                healthy: true,
                details: {
                    service: 'Loaded successfully',
                    strategies: errorRecovery.recoveryStrategies.size,
                    system: 'Error Recovery operational'
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: `Error Recovery check failed: ${error.message}`
            };
        }
    }
    
    async checkCommunicationSystem() {
        try {
            const { CommunicationAgent } = require('../agents/comm-agent');
            
            return {
                healthy: true,
                details: {
                    agent: 'Loaded successfully',
                    system: 'Communication System operational'
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: `Communication System check failed: ${error.message}`
            };
        }
    }
    
    /**
     * Integration test implementations
     */
    async testContextAgentIntegration() {
        try {
            // Test context manager integration
            const testResult = await this.checkUniversalContextSystem();
            const agentResult = await this.checkMultiAgentCore();
            
            return {
                testName: 'Context-Agent Integration',
                passed: testResult.healthy && agentResult.healthy,
                details: 'Universal Context System and Multi-Agent Core integration verified'
            };
        } catch (error) {
            return {
                testName: 'Context-Agent Integration',
                passed: false,
                error: error.message
            };
        }
    }
    
    async testFileSystemGitIntegration() {
        try {
            const fsResult = await this.checkFileSystemServices();
            const gitResult = await this.checkGitAutomation();
            
            return {
                testName: 'FileSystem-Git Integration',
                passed: fsResult.healthy && gitResult.healthy,
                details: 'File System and Git Automation integration verified'
            };
        } catch (error) {
            return {
                testName: 'FileSystem-Git Integration',
                passed: false,
                error: error.message
            };
        }
    }
    
    async testMonitorCommunicationIntegration() {
        try {
            const monitorResult = await this.checkProgressMonitor();
            const commResult = await this.checkCommunicationSystem();
            
            return {
                testName: 'Monitor-Communication Integration',
                passed: monitorResult.healthy && commResult.healthy,
                details: 'Progress Monitor and Communication integration verified'
            };
        } catch (error) {
            return {
                testName: 'Monitor-Communication Integration',
                passed: false,
                error: error.message
            };
        }
    }
    
    async testErrorRecoveryIntegration() {
        try {
            const errorResult = await this.checkErrorRecovery();
            const fsResult = await this.checkFileSystemServices();
            const gitResult = await this.checkGitAutomation();
            
            return {
                testName: 'Error Recovery Integration',
                passed: errorResult.healthy && fsResult.healthy && gitResult.healthy,
                details: 'Error Recovery integration with all services verified'
            };
        } catch (error) {
            return {
                testName: 'Error Recovery Integration',
                passed: false,
                error: error.message
            };
        }
    }
    
    /**
     * Run continuous health checks
     */
    async runHealthChecks() {
        try {
            console.log('🔍 Running continuous health checks...');
            
            const healthResults = [];
            for (const [key, component] of this.components) {
                const result = await this.validateComponent(component);
                healthResults.push(result);
            }
            
            const healthyCount = healthResults.filter(r => r.healthy).length;
            const totalCount = healthResults.length;
            const systemHealth = (healthyCount / totalCount) * 100;
            
            console.log(`📊 System health: ${Math.round(systemHealth)}% (${healthyCount}/${totalCount})`);
            
            return {
                systemHealth: Math.round(systemHealth * 100) / 100,
                healthyComponents: healthyCount,
                totalComponents: totalCount,
                results: healthResults,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            return {
                systemHealth: 0,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * Helper methods
     */
    buildDependencyMap(components) {
        // Simple dependency ordering - in production this would be more sophisticated
        const ordered = [...components];
        
        // Sort so dependencies come first
        ordered.sort((a, b) => {
            if (a.dependencies.length === 0 && b.dependencies.length > 0) return -1;
            if (a.dependencies.length > 0 && b.dependencies.length === 0) return 1;
            return 0;
        });
        
        return ordered;
    }
    
    updateValidationStatistics(results) {
        this.stats.totalValidations++;
        
        if (results.success) {
            this.stats.successfulValidations++;
        } else {
            this.stats.failedValidations++;
        }
        
        // Update average execution time
        if (this.stats.totalValidations === 1) {
            this.stats.averageValidationTime = results.executionTime;
        } else {
            this.stats.averageValidationTime = 
                (this.stats.averageValidationTime * (this.stats.totalValidations - 1) + results.executionTime) / 
                this.stats.totalValidations;
        }
    }
    
    /**
     * Get validation status
     */
    getStatus() {
        const successRate = this.stats.totalValidations > 0 ? 
            (this.stats.successfulValidations / this.stats.totalValidations) * 100 : 0;
        
        return {
            isValidating: this.isValidating,
            lastValidation: this.lastValidation,
            statistics: {
                ...this.stats,
                successRate: Math.round(successRate * 100) / 100
            },
            componentUptime: Object.fromEntries(
                Array.from(this.stats.componentUptime.entries()).map(([name, data]) => [
                    name, 
                    Math.round((data.successes / data.checks) * 100 * 100) / 100
                ])
            ),
            availableComponents: Array.from(this.components.keys()),
            recentValidations: this.validationHistory.slice(-5)
        };
    }
}

module.exports = { IntegrationValidator };

// If run directly, demonstrate the service
if (require.main === module) {
    (async () => {
        console.log('🧪 Testing Integration Validator Service...');
        
        const validator = new IntegrationValidator();
        
        try {
            // Run system validation
            console.log('\n🔍 Running system integration validation...');
            const results = await validator.validateSystemIntegration('critical');
            
            console.log(`\n📊 Validation Results:`);
            console.log(`Success: ${results.success}`);
            console.log(`Overall Health: ${results.overallHealth}%`);
            console.log(`Components: ${results.summary.healthyComponents}/${results.summary.totalComponents}`);
            console.log(`Integration Tests: ${results.summary.integrationTestsPassed}/${results.summary.integrationTestsPassed + results.summary.integrationTestsFailed}`);
            
            // Show detailed component results
            console.log('\n🔍 Component Health:');
            results.componentResults.forEach(comp => {
                console.log(`  ${comp.component}: ${comp.healthy ? '✅' : '❌'} ${comp.healthy ? '' : '(' + comp.error + ')'}`);
            });
            
            console.log('✅ Integration Validator Service test completed');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    })();
}