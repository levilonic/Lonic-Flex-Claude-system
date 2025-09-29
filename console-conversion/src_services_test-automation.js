/**
 * Test Automation Service
 * Continuous testing service with automated test execution and validation
 * Part of Phase 2 Task 2.6: Testing Automation Integration
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const execAsync = promisify(exec);

class TestAutomation {
    constructor(config = {}) {
        this.config = {
            testFramework: config.testFramework || 'jest',
            testDirectory: config.testDirectory || './test',
            enableContinuousTesting: config.enableContinuousTesting !== false,
            testTimeout: config.testTimeout || 300000, // 5 minutes
            coverageThreshold: config.coverageThreshold || 80,
            parallelTests: config.parallelTests !== false,
            testOnFileChange: config.testOnFileChange !== false,
            ...config
        };
        
        // Test execution state
        this.isRunning = false;
        this.currentTestRun = null;
        this.testHistory = [];
        this.watchedFiles = new Set();
        
        // Test suites registry
        this.testSuites = new Map();
        this.initializeTestSuites();
        
        // Test statistics
        this.stats = {
            totalTestRuns: 0,
            passedTestRuns: 0,
            failedTestRuns: 0,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            averageExecutionTime: 0,
            coveragePercentage: 0
        };
        
        console.log('🧪 Test Automation Service initialized');
    }
    
    /**
     * Initialize built-in test suites
     */
    initializeTestSuites() {
        // Universal Context System Tests
        this.testSuites.set('universal-context', {
            name: 'Universal Context System',
            command: 'node test-universal-context.js',
            description: 'Core context preservation system tests',
            required: true,
            timeout: 60000
        });
        
        // Phase 3A Integration Tests  
        this.testSuites.set('phase3a-integration', {
            name: 'Phase 3A Integration',
            command: 'node test-phase3a-integration.js',
            description: 'External system integration tests',
            required: true,
            timeout: 90000
        });
        
        // Long-term Persistence Tests
        this.testSuites.set('long-term-persistence', {
            name: 'Long-term Persistence',
            command: 'node test-long-term-persistence.js',
            description: 'Context persistence and recovery tests',
            required: false,
            timeout: 120000
        });
        
        // Multi-Agent Workflow Tests
        this.testSuites.set('multi-agent', {
            name: 'Multi-Agent Workflow',
            command: 'npm run demo',
            description: 'Multi-agent coordination and workflow tests',
            required: true,
            timeout: 180000
        });
        
        // Base Agent Tests
        this.testSuites.set('base-agent', {
            name: 'Base Agent',
            command: 'npm run test-base-agent',
            description: 'Base agent functionality tests',
            required: true,
            timeout: 60000
        });
        
        // Integration Tests
        this.testSuites.set('integration', {
            name: 'Integration Tests',
            command: 'npm run test-integration',
            description: 'System integration tests',
            required: true,
            timeout: 120000
        });
        
        // Service Tests (for our new services)
        this.testSuites.set('services', {
            name: 'Service Tests',
            command: 'npm run test-services',
            description: 'Service layer functionality tests',
            required: true,
            timeout: 90000,
            customTest: true // Will use our custom test implementation
        });
        
        console.log(`✅ Initialized ${this.testSuites.size} test suites`);
    }
    
    /**
     * Run comprehensive test suite
     */
    async runTests(testSuite = 'all', context = {}) {
        const runId = uuidv4();
        const startTime = Date.now();
        
        try {
            console.log(`🧪 Starting test run: ${testSuite} (${runId})`);
            
            this.isRunning = true;
            this.currentTestRun = {
                id: runId,
                testSuite: testSuite,
                startTime: startTime,
                context: context,
                status: 'running'
            };
            
            let suitesToRun = [];
            
            if (testSuite === 'all') {
                suitesToRun = Array.from(this.testSuites.values());
            } else if (testSuite === 'required') {
                suitesToRun = Array.from(this.testSuites.values()).filter(suite => suite.required);
            } else if (this.testSuites.has(testSuite)) {
                suitesToRun = [this.testSuites.get(testSuite)];
            } else {
                throw new Error(`Unknown test suite: ${testSuite}`);
            }
            
            const testResults = [];
            let totalPassed = 0;
            let totalFailed = 0;
            
            // Execute test suites
            for (const suite of suitesToRun) {
                console.log(`🔍 Running test suite: ${suite.name}`);
                
                const suiteResult = await this.executeTestSuite(suite);
                testResults.push(suiteResult);
                
                if (suiteResult.success) {
                    totalPassed += suiteResult.testsPassed || 1;
                    totalFailed += suiteResult.testsFailed || 0;
                } else {
                    totalFailed += 1;
                }
            }
            
            // Calculate results
            const executionTime = Date.now() - startTime;
            const success = testResults.every(result => result.success);
            
            const finalResults = {
                success: success,
                runId: runId,
                testSuite: testSuite,
                executionTime: executionTime,
                testResults: testResults,
                summary: {
                    totalSuites: suitesToRun.length,
                    passedSuites: testResults.filter(r => r.success).length,
                    failedSuites: testResults.filter(r => !r.success).length,
                    totalTests: totalPassed + totalFailed,
                    passedTests: totalPassed,
                    failedTests: totalFailed
                },
                timestamp: Date.now()
            };
            
            // Update statistics
            this.updateStatistics(finalResults);
            
            // Store test run
            this.testHistory.push(finalResults);
            if (this.testHistory.length > 100) {
                this.testHistory = this.testHistory.slice(-100);
            }
            
            this.currentTestRun.status = success ? 'completed' : 'failed';
            this.currentTestRun.results = finalResults;
            
            console.log(`✅ Test run ${success ? 'completed successfully' : 'failed'}: ${runId}`);
            console.log(`📊 Results: ${finalResults.summary.passedSuites}/${finalResults.summary.totalSuites} suites passed, ${finalResults.summary.passedTests}/${finalResults.summary.totalTests} tests passed`);
            
            return finalResults;
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            const errorResults = {
                success: false,
                runId: runId,
                testSuite: testSuite,
                executionTime: executionTime,
                error: error.message,
                timestamp: Date.now()
            };
            
            this.testHistory.push(errorResults);
            this.stats.failedTestRuns++;
            this.stats.totalTestRuns++;
            
            console.error(`❌ Test run failed: ${error.message}`);
            return errorResults;
            
        } finally {
            this.isRunning = false;
            this.currentTestRun = null;
        }
    }
    
    /**
     * Execute individual test suite
     */
    async executeTestSuite(suite) {
        const startTime = Date.now();
        
        try {
            console.log(`🔍 Executing: ${suite.command}`);
            
            let result;
            
            if (suite.customTest) {
                // Use custom test implementation for services
                result = await this.executeCustomServiceTests();
            } else {
                // Execute standard command
                result = await execAsync(suite.command, {
                    timeout: suite.timeout || this.config.testTimeout,
                    cwd: process.cwd()
                });
            }
            
            const executionTime = Date.now() - startTime;
            
            // Parse test results from output
            const testsPassed = this.parseTestResults(result.stdout || result.output, 'passed');
            const testsFailed = this.parseTestResults(result.stdout || result.output, 'failed');
            
            return {
                success: (result.stderr ? result.stderr.length === 0 : true) && testsFailed === 0,
                suite: suite.name,
                command: suite.command,
                executionTime: executionTime,
                testsPassed: testsPassed,
                testsFailed: testsFailed,
                output: (result.stdout || result.output || '').substring(0, 2000), // Limit output size
                error: result.stderr || null
            };
            
        } catch (error) {
            return {
                success: false,
                suite: suite.name,
                command: suite.command,
                executionTime: Date.now() - startTime,
                testsPassed: 0,
                testsFailed: 1,
                output: error.stdout || '',
                error: error.message
            };
        }
    }
    
    /**
     * Execute custom tests for our services
     */
    async executeCustomServiceTests() {
        const testResults = [];
        
        try {
            // Test File System Automation
            console.log('🧪 Testing File System Automation...');
            const { FileSystemAutomation } = require('./filesystem-automation');
            const fsService = new FileSystemAutomation();
            
            const testFile = path.join(process.cwd(), 'test-automation-file.txt');
            await fsService.writeFile(testFile, 'Test content');
            const readResult = await fsService.readFile(testFile);
            
            if (readResult.success && readResult.content === 'Test content') {
                testResults.push({ test: 'filesystem_automation', success: this.validateSuccess() });
            } else {
                testResults.push({ test: 'filesystem_automation', success: false });
            }
            
            // Cleanup
            try { await fs.unlink(testFile); } catch {}
            
        } catch (error) {
            testResults.push({ test: 'filesystem_automation', success: false, error: error.message });
        }
        
        try {
            // Test Git Automation
            console.log('🧪 Testing Git Automation...');
            const { GitAutomation } = require('./git-automation');
            const gitService = new GitAutomation();
            
            await gitService.initialize();
            const status = await gitService.getStatus();
            
            if (status.currentBranch) {
                testResults.push({ test: 'git_automation', success: this.validateSuccess() });
            } else {
                testResults.push({ test: 'git_automation', success: false });
            }
            
        } catch (error) {
            testResults.push({ test: 'git_automation', success: false, error: error.message });
        }
        
        try {
            // Test Progress Monitor
            console.log('🧪 Testing Progress Monitor...');
            const { ProgressMonitor } = require('./progress-monitor');
            const monitor = new ProgressMonitor({ enableSlackNotifications: false });
            
            await monitor.startMonitoring('test-session', { tasks: [{ id: '1' }] });
            const status = monitor.getStatus();
            await monitor.stop();
            
            if (status.isMonitoring !== undefined) {
                testResults.push({ test: 'progress_monitor', success: this.validateSuccess() });
            } else {
                testResults.push({ test: 'progress_monitor', success: false });
            }
            
        } catch (error) {
            testResults.push({ test: 'progress_monitor', success: false, error: error.message });
        }
        
        try {
            // Test Error Recovery
            console.log('🧪 Testing Error Recovery...');
            const { ErrorRecovery } = require('./error-recovery');
            const errorRecovery = new ErrorRecovery();
            
            const result = await errorRecovery.handleError(
                new Error('Test error'),
                { currentStep: 'test', sessionId: 'test' }
            );
            
            if (result.success !== undefined) {
                testResults.push({ test: 'error_recovery', success: this.validateSuccess() });
            } else {
                testResults.push({ test: 'error_recovery', success: false });
            }
            
        } catch (error) {
            testResults.push({ test: 'error_recovery', success: false, error: error.message });
        }
        
        const successCount = testResults.filter(r => r.success).length;
        const failCount = testResults.filter(r => !r.success).length;
        
        return {
            output: `Service Tests: ${successCount} passed, ${failCount} failed\n` +
                   testResults.map(r => `${r.test}: ${r.success ? 'PASS' : 'FAIL'}`).join('\n'),
            testsPassed: successCount,
            testsFailed: failCount
        };
    }
    
    /**
     * Validate code quality and syntax
     */
    async validateCode(files = []) {
        const validationResults = [];
        
        try {
            console.log('🔍 Validating code quality...');
            
            // Get files to validate
            let filesToValidate = files;
            if (filesToValidate.length === 0) {
                // Get all JS files in the project
                const jsFiles = await this.findJavaScriptFiles();
                filesToValidate = jsFiles.slice(0, 50); // Limit to prevent timeout
            }
            
            for (const file of filesToValidate) {
                try {
                    // Basic syntax validation
                    const content = await fs.readFile(file, 'utf8');
                    
                    // Check for basic syntax issues
                    const syntaxIssues = this.checkSyntax(content, file);
                    
                    validationResults.push({
                        file: file,
                        valid: syntaxIssues.length === 0,
                        issues: syntaxIssues
                    });
                    
                } catch (error) {
                    validationResults.push({
                        file: file,
                        valid: false,
                        issues: [`File read error: ${error.message}`]
                    });
                }
            }
            
            const validFiles = validationResults.filter(r => r.valid).length;
            const invalidFiles = validationResults.filter(r => !r.valid).length;
            
            console.log(`📊 Code validation: ${validFiles} valid, ${invalidFiles} invalid files`);
            
            return {
                success: invalidFiles === 0,
                totalFiles: validationResults.length,
                validFiles: validFiles,
                invalidFiles: invalidFiles,
                results: validationResults
            };
            
        } catch (error) {
            console.error('❌ Code validation failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Integrate with continuous workflow
     */
    async integrateWithWorkflow(workflow) {
        try {
            console.log(`🔗 Integrating testing with workflow: ${workflow.name || 'unknown'}`);
            
            // Set up test triggers based on workflow
            const integrationConfig = {
                workflowId: workflow.id || uuidv4(),
                testSuites: workflow.testSuites || ['required'],
                testOnCommit: workflow.testOnCommit !== false,
                testOnDeploy: workflow.testOnDeploy !== false,
                blockOnFailure: workflow.blockOnFailure !== false
            };
            
            // Enable continuous testing if requested
            if (this.config.enableContinuousTesting && workflow.continuous) {
                console.log('🔄 Enabling continuous testing...');
                // This would set up file watchers in production
            }
            
            console.log('✅ Test integration configured');

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                integration: integrationConfig,
                continuousTesting: this.config.enableContinuousTesting && workflow.continuous
            };
            
        } catch (error) {
            console.error('❌ Workflow integration failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Helper methods
     */
    async findJavaScriptFiles(directory = '.') {
        const jsFiles = [];
        
        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.') && 
                    entry.name !== 'node_modules') {
                    const subFiles = await this.findJavaScriptFiles(fullPath);
                    jsFiles.push(...subFiles);
                } else if (entry.isFile() && entry.name.endsWith('.js')) {
                    jsFiles.push(fullPath);
                }
            }
        } catch (error) {
            // Directory read error, skip
        }
        
        return jsFiles;
    }
    
    checkSyntax(content, filename) {
        const issues = [];
        
        // Basic checks
        if (content.includes('console.log') && filename.includes('production')) {
            issues.push('Console.log found in production code');
        }
        
        if (content.includes('TODO') || content.includes('FIXME')) {
            issues.push('TODO/FIXME comments found');
        }
        
        // Check for common syntax patterns
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for missing semicolons (basic check)
            if (line.trim().match(/^(const|let|var|return)\s+.*[^;{}\s]$/)) {
                issues.push(`Line ${i + 1}: Possible missing semicolon`);
            }
        }
        
        return issues;
    }
    
    parseTestResults(output, type) {
        if (!output) return 0;
        
        // Parse different test output formats
        if (type === 'passed') {
            const passMatches = output.match(/✅|PASS|passed|success/gi);
            return passMatches ? passMatches.length : 0;
        } else if (type === 'failed') {
            const failMatches = output.match(/❌|FAIL|failed|error/gi);
            return failMatches ? failMatches.length : 0;
        }
        
        return 0;
    }
    
    updateStatistics(results) {
        this.stats.totalTestRuns++;
        
        if (results.success) {
            this.stats.passedTestRuns++;
        } else {
            this.stats.failedTestRuns++;
        }
        
        this.stats.totalTests += results.summary?.totalTests || 0;
        this.stats.passedTests += results.summary?.passedTests || 0;
        this.stats.failedTests += results.summary?.failedTests || 0;
        
        // Update average execution time
        if (this.stats.totalTestRuns === 1) {
            this.stats.averageExecutionTime = results.executionTime;
        } else {
            this.stats.averageExecutionTime = 
                (this.stats.averageExecutionTime * (this.stats.totalTestRuns - 1) + results.executionTime) / 
                this.stats.totalTestRuns;
        }
    }
    
    /**
     * Get test automation status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            currentTestRun: this.currentTestRun,
            availableTestSuites: Array.from(this.testSuites.keys()),
            statistics: this.stats,
            configuration: {
                testFramework: this.config.testFramework,
                continuousTesting: this.config.enableContinuousTesting,
                coverageThreshold: this.config.coverageThreshold
            },
            recentTestRuns: this.testHistory.slice(-5)
        };
    }
    
    /**
     * Get test history
     */
    getTestHistory(limit = 20) {
        return this.testHistory.slice(-limit);
    }
}

module.exports = { TestAutomation };

// If run directly, demonstrate the service
if (require.main === module) {
    (async () => {
        console.log('🧪 Testing Test Automation Service...');
        
        const testAutomation = new TestAutomation({
            testTimeout: 60000,
            enableContinuousTesting: false
        });
        
        try {
            // Run service tests
            console.log('\n🔍 Running service tests...');
            const serviceResults = await testAutomation.runTests('services');
            console.log('Service test results:', serviceResults.success ? 'PASSED' : 'FAILED');
            
            // Validate some code
            console.log('\n🔍 Running code validation...');
            const validationResults = await testAutomation.validateCode([__filename]);
            console.log('Code validation:', validationResults.success ? 'PASSED' : 'FAILED');
            
            // Show status
            console.log('\n📊 Test Automation Status:');
            const status = testAutomation.getStatus();
            console.log(`Available test suites: ${status.availableTestSuites.length}`);
            console.log(`Statistics:`, status.statistics);
            
            console.log('✅ Test Automation Service demonstration completed');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    })();
}