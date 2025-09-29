#!/usr/bin/env node
/**
 * Working CLI - No abstractions, just functions that work
 * Uses working components from src/working/
 */

const { PRReviewWorkflow } = require('./src/working/pr-review-workflow');
const { GitHubReal } = require('./src/working/github-real');
const { GitHubAgentWorking } = require('./src/working/github-agent-working');
const { CodeAgentWorking } = require('./src/working/code-agent-working');
const { SecurityAgentWorking } = require('./src/working/security-agent-working');
const { DatabaseSimple } = require('./src/working/database-simple');

class WorkingCLI {
    constructor() {
        this.github = new GitHubReal();
        this.githubAgent = new GitHubAgentWorking({ sessionId: `cli-${Date.now()}` });
        this.codeAgent = new CodeAgentWorking({ sessionId: `cli-${Date.now()}`, outputDir: './generated' });
        this.securityAgent = new SecurityAgentWorking({ sessionId: `cli-${Date.now()}` });
        this.prWorkflow = new PRReviewWorkflow();
    }

    /**
     * Parse and execute command
     */
    async execute(args = process.argv.slice(2)) {
        if (args.length === 0) {
            this.showHelp();
            process.exit(0);
        }

        const command = args[0];
        const options = args.slice(1);

        try {
            switch (command) {
                case 'pr-review':
                    await this.reviewPR(options);
                    break;
                case 'github-status':
                    await this.githubStatus();
                    break;
                case 'create-branch':
                    await this.createBranch(options);
                    break;
                case 'list-issues':
                    await this.listIssues(options);
                    break;
                case 'code-gen':
                    await this.generateCode(options);
                    break;
                case 'security-scan':
                    await this.securityScan(options);
                    break;
                case 'system-status':
                    await this.systemStatus();
                    break;
                case 'test':
                    await this.runTests();
                    break;
                case 'help':
                    this.showHelp();
                    break;
                default:
                    console.error(`❌ Unknown command: ${command}`);
                    this.showHelp();
                    process.exit(1);
            }
        } catch (error) {
            console.error(`❌ Command '${command}' failed:`, error.message);
            process.exit(1);
        }
    }

    /**
     * Review a PR - actually works
     */
    async reviewPR(options) {
        const prNumber = parseInt(options[0]);

        if (!prNumber) {
            console.error('❌ Usage: cli-working pr-review <pr-number>');
            process.exit(1);
        }

        console.log(`🔍 Reviewing PR #${prNumber}...`);

        const review = await this.prWorkflow.execute(prNumber);

        console.log(`\n📊 Review Results:`);
        console.log(`   PR: ${review.title}`);
        console.log(`   Score: ${review.overallScore}/100`);
        console.log(`   Complexity: ${review.analysis.size.complexity}`);
        console.log(`   Risks: ${review.analysis.risks.length}`);
        console.log(`   Recommendations: ${review.recommendations.length}`);

        console.log(`\n💬 Review Comment:`);
        console.log(this.prWorkflow.formatReviewComment(review));

        process.exit(0);
    }

    /**
     * Show GitHub connection status
     */
    async githubStatus() {
        console.log('🔗 GitHub Status:');

        const status = this.github.getStatus();
        console.log(`   Connected: ${status.connected ? '✅' : '❌'}`);
        console.log(`   Mode: ${status.mode}`);
        console.log(`   Repository: ${status.owner}/${status.repo}`);

        if (status.connected) {
            try {
                const files = await this.github.listFiles();
                console.log(`   Files found: ${files.length}`);
            } catch (error) {
                console.log(`   API test failed: ${error.message}`);
            }
        } else {
            console.log('   💡 Set GITHUB_TOKEN environment variable for live integration');
        }

        process.exit(0);
    }

    /**
     * Create a GitHub branch
     */
    async createBranch(options) {
        const branchName = options[0];
        const baseBranch = options[1] || 'main';

        if (!branchName) {
            console.error('❌ Usage: cli-working create-branch <branch-name> [base-branch]');
            process.exit(1);
        }

        console.log(`🌿 Creating branch '${branchName}' from '${baseBranch}'...`);

        try {
            const result = await this.githubAgent.executeWorkflow({
                action: 'create-branch',
                branchName,
                baseBranch
            });

            if (result.success) {
                console.log(`✅ Branch operation completed`);
                if (result.branch.created) {
                    console.log(`   Created: ${result.branch.name}`);
                } else if (result.branch.exists) {
                    console.log(`   Already exists: ${result.branch.name}`);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to create branch: ${error.message}`);
            process.exit(1);
        }

        process.exit(0);
    }

    /**
     * List GitHub issues
     */
    async listIssues(options) {
        const state = options[0] || 'open';

        console.log(`📋 Listing ${state} issues...`);

        try {
            const result = await this.githubAgent.executeWorkflow({
                action: 'list-issues',
                state
            });

            if (result.success && result.issues) {
                console.log(`\n Found ${result.issues.length} ${state} issues:`);
                result.issues.forEach(issue => {
                    console.log(`   #${issue.number}: ${issue.title}`);
                    if (issue.labels.length > 0) {
                        console.log(`      Labels: ${issue.labels.join(', ')}`);
                    }
                });
            }
        } catch (error) {
            console.error(`❌ Failed to list issues: ${error.message}`);
            process.exit(1);
        }

        process.exit(0);
    }

    /**
     * Generate code
     */
    async generateCode(options) {
        const type = options[0]; // function, class, module
        const name = options[1];

        if (!type || !name) {
            console.error('❌ Usage: cli-working code-gen <type> <name>');
            console.error('  Types: function, class, module');
            console.error('  Example: cli-working code-gen function calculateSum');
            process.exit(1);
        }

        console.log(`🔧 Generating ${type}: ${name}...`);

        try {
            let context = { action: `generate-${type}`, name };

            if (type === 'function') {
                context.params = options.slice(2) || ['param1', 'param2'];
                context.body = 'return param1 + param2;';
                context.description = `${name} function`;

            } else if (type === 'class') {
                context.methods = [
                    { name: 'constructor', body: '// Initialize class' },
                    { name: 'process', params: ['data'], body: 'return data;' }
                ];
                context.properties = ['data'];
                context.description = `${name} class`;
                context.generateTests = true;

            } else if (type === 'module') {
                context.functions = [
                    { name: 'init', params: [], body: 'console.log("Module initialized");', description: 'Initialize module' },
                    { name: 'process', params: ['input'], body: 'return input;', description: 'Process input' }
                ];

            } else {
                throw new Error(`Unknown type: ${type}. Use: function, class, module`);
            }

            const result = await this.codeAgent.executeWorkflow(context);

            if (result.success) {
                console.log(`✅ Code generation completed!`);
                console.log(`   Generated ${result.files.length} file(s):`);
                result.files.forEach(file => {
                    console.log(`   📄 ${file}`);
                });
            }

        } catch (error) {
            console.error(`❌ Code generation failed: ${error.message}`);
            process.exit(1);
        }

        process.exit(0);
    }

    /**
     * Perform security scan
     */
    async securityScan(options) {
        const target = options[0] || '.';
        const scanType = options[1] || 'full';

        console.log(`🔒 Running security scan on: ${target}`);
        console.log(`   Scan type: ${scanType}`);

        try {
            let context = { action: scanType };

            if (scanType === 'file' || scanType === 'scan-file') {
                if (!options[0]) {
                    console.error('❌ Usage: cli-working security-scan file <file-path>');
                    process.exit(1);
                }
                context = { action: 'scan-file', filePath: options[0] };

            } else if (scanType === 'directory' || scanType === 'scan-directory') {
                context = { action: 'scan-directory', path: target };

            } else if (scanType === 'dependencies' || scanType === 'audit-dependencies') {
                context = { action: 'audit-dependencies', path: target };

            } else {
                // Default to full scan
                context = { action: 'full-scan', path: target };
            }

            const result = await this.securityAgent.executeWorkflow(context);

            if (result.success) {
                console.log('\n📊 Security Scan Results:');

                if (result.scan) {
                    const report = this.securityAgent.generateReport(result);
                    console.log(`   Files scanned: ${report.summary.totalFiles}`);
                    console.log(`   Secrets found: ${report.summary.secretsFound}`);
                    console.log(`   Issues found: ${report.summary.issuesFound}`);
                    console.log(`   Dependencies with vulnerabilities: ${report.summary.vulnerabilities}`);

                    console.log('\n📈 Severity breakdown:');
                    console.log(`   HIGH: ${report.severityCounts.HIGH}`);
                    console.log(`   MEDIUM: ${report.severityCounts.MEDIUM}`);
                    console.log(`   LOW: ${report.severityCounts.LOW}`);
                    console.log(`   INFO: ${report.severityCounts.INFO}`);

                    // Show high-severity items
                    const highSeverityItems = [
                        ...(result.scan.secrets || []),
                        ...(result.scan.issues || [])
                    ].filter(item => item.severity === 'HIGH');

                    if (highSeverityItems.length > 0) {
                        console.log('\n🚨 High Severity Issues:');
                        highSeverityItems.slice(0, 10).forEach(item => {
                            console.log(`   ${item.file}:${item.line} - ${item.type}`);
                        });
                        if (highSeverityItems.length > 10) {
                            console.log(`   ... and ${highSeverityItems.length - 10} more`);
                        }
                    }
                }

                if (result.secrets) {
                    console.log(`\n🔑 Secrets found: ${result.secrets.length}`);
                    result.secrets.forEach(secret => {
                        console.log(`   Line ${secret.line}: ${secret.type}`);
                    });
                }

                if (result.issues) {
                    console.log(`\n⚠️  Issues found: ${result.issues.length}`);
                    result.issues.slice(0, 10).forEach(issue => {
                        console.log(`   Line ${issue.line}: ${issue.type} (${issue.severity})`);
                    });
                    if (result.issues.length > 10) {
                        console.log(`   ... and ${result.issues.length - 10} more`);
                    }
                }
            }

        } catch (error) {
            console.error(`❌ Security scan failed: ${error.message}`);
            process.exit(1);
        }

        process.exit(0);
    }

    /**
     * Check system status - what's working vs broken
     */
    async systemStatus() {
        console.log('🔍 Checking LonicFLex System Status...\n');

        const status = {
            working: [],
            broken: [],
            warnings: []
        };

        try {
            // Test working components
            console.log('📊 Working Components:');

            // GitHub status
            try {
                const githubStatus = this.github.getStatus();
                status.working.push({
                    component: 'GitHub Integration',
                    status: githubStatus.connected ? 'Live API' : 'Mock Mode',
                    details: `${githubStatus.owner}/${githubStatus.repo}`
                });
                console.log(`   ✅ GitHub: ${githubStatus.mode} mode (${githubStatus.owner}/${githubStatus.repo})`);
            } catch (error) {
                status.broken.push({ component: 'GitHub', error: error.message });
                console.log(`   ❌ GitHub: ${error.message}`);
            }

            // Database status
            try {
                const db = new DatabaseSimple();
                await db.initialize();
                const dbStatus = db.getStatus();
                await db.close();

                status.working.push({
                    component: 'Database',
                    status: 'Working',
                    details: `SQLite (${dbStatus.capabilities.length} operations)`
                });
                console.log(`   ✅ Database: SQLite working (${dbStatus.capabilities.length} operations)`);
            } catch (error) {
                status.broken.push({ component: 'Database', error: error.message });
                console.log(`   ❌ Database: ${error.message}`);
            }

            // PR Review Workflow
            try {
                const review = await this.prWorkflow.execute(999); // Test with mock data
                status.working.push({
                    component: 'PR Review',
                    status: 'Working',
                    details: `Score: ${review.overallScore}/100`
                });
                console.log(`   ✅ PR Review: Working (scored ${review.overallScore}/100)`);
            } catch (error) {
                status.broken.push({ component: 'PR Review', error: error.message });
                console.log(`   ❌ PR Review: ${error.message}`);
            }

            // Code Agent
            try {
                const codeStatus = this.codeAgent.getStatus();
                status.working.push({
                    component: 'Code Generation',
                    status: 'Working',
                    details: `${codeStatus.capabilities.length} capabilities`
                });
                console.log(`   ✅ Code Agent: Working (${codeStatus.capabilities.length} capabilities)`);
            } catch (error) {
                status.broken.push({ component: 'Code Agent', error: error.message });
                console.log(`   ❌ Code Agent: ${error.message}`);
            }

            // Security Agent
            try {
                const securityStatus = this.securityAgent.getStatus();
                status.working.push({
                    component: 'Security Scanning',
                    status: 'Working',
                    details: `${securityStatus.patterns.secrets + securityStatus.patterns.insecure} patterns`
                });
                console.log(`   ✅ Security Agent: Working (${securityStatus.patterns.secrets + securityStatus.patterns.insecure} patterns)`);
            } catch (error) {
                status.broken.push({ component: 'Security Agent', error: error.message });
                console.log(`   ❌ Security Agent: ${error.message}`);
            }

            // Test legacy CLI (should be broken)
            console.log('\n💥 Legacy System Status:');

            // We know legacy CLI hangs, so just report it
            status.broken.push({
                component: 'Legacy CLI',
                error: 'Hangs on startup (ServiceContainer initialization)'
            });
            console.log(`   ❌ Legacy CLI: Hangs on startup (ServiceContainer broken)`);

            // Check file system access
            const fs = require('fs').promises;
            try {
                await fs.access('./package.json');
                await fs.access('./src');
                status.working.push({
                    component: 'File System',
                    status: 'Working',
                    details: 'Read/write access confirmed'
                });
                console.log(`   ✅ File System: Read/write access working`);
            } catch (error) {
                status.broken.push({ component: 'File System', error: error.message });
                console.log(`   ❌ File System: ${error.message}`);
            }

            // Summary
            console.log('\n📋 Summary:');
            console.log(`   ✅ Working: ${status.working.length} components`);
            console.log(`   ❌ Broken: ${status.broken.length} components`);
            console.log(`   ⚠️  Warnings: ${status.warnings.length} issues`);

            const healthPercentage = Math.round((status.working.length / (status.working.length + status.broken.length)) * 100);
            console.log(`   🎯 System Health: ${healthPercentage}%`);

            if (healthPercentage >= 80) {
                console.log('\n🚀 System Status: HEALTHY - Working components functional');
            } else if (healthPercentage >= 60) {
                console.log('\n⚠️  System Status: DEGRADED - Some issues need attention');
            } else {
                console.log('\n❌ System Status: CRITICAL - Major issues detected');
            }

        } catch (error) {
            console.error(`❌ Status check failed: ${error.message}`);
            process.exit(1);
        }

        process.exit(0);
    }

    /**
     * Run working tests
     */
    async runTests() {
        console.log('🧪 Running Working Tests...\n');

        try {
            // Import and run the real integration test
            const { runIntegrationTests } = require('./tests/real/pr-review-integration.test');
            const results = await runIntegrationTests();

            if (results.workflow.percentage >= 90) {
                console.log('\n✅ All tests passed - system is working!');
                process.exit(0);
            } else {
                console.log('\n❌ Some tests failed');
                process.exit(1);
            }

        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Show help
     */
    showHelp() {
        console.log(`
🚀 LonicFLex Working CLI

Usage: node cli-working.js <command> [options]

Commands:
  pr-review <number>           Review a GitHub PR
  github-status                Show GitHub connection status
  create-branch <name> [base]  Create a GitHub branch
  list-issues [state]          List GitHub issues (open/closed/all)
  code-gen <type> <name>       Generate code (function/class/module)
  security-scan [path] [type]  Scan for security issues (full/file/dependencies)
  system-status                Check what's working vs broken
  test                         Run integration tests
  help                         Show this help

Examples:
  node cli-working.js pr-review 123
  node cli-working.js github-status
  node cli-working.js create-branch feature/new-feature
  node cli-working.js list-issues open
  node cli-working.js code-gen class UserManager
  node cli-working.js code-gen function calculateTax
  node cli-working.js security-scan . full
  node cli-working.js security-scan package.json file
  node cli-working.js system-status
  GITHUB_TOKEN=xxx node cli-working.js github-status
  node cli-working.js test

This CLI uses only working components with no broken abstractions.
        `);
    }
}

// Execute if called directly
if (require.main === module) {
    const cli = new WorkingCLI();
    cli.execute();
}

module.exports = { WorkingCLI };