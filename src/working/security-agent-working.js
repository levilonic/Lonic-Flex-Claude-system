/**
 * Working Security Agent - Real security scanning functions
 * No inheritance, just functions that actually check for vulnerabilities
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class SecurityAgentWorking {
    constructor(options = {}) {
        this.agentName = 'security';
        this.sessionId = options.sessionId;
    }

    /**
     * Scan files for potential secrets/keys
     */
    async scanForSecrets(filePath) {
        const secrets = [];

        const secretPatterns = [
            { name: 'API Key', pattern: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/ },
            { name: 'GitHub Token', pattern: /gh[ps]_[a-zA-Z0-9]{36,}/ },
            { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
            { name: 'Private Key', pattern: /-----BEGIN (RSA )?PRIVATE KEY-----/ },
            { name: 'Password', pattern: /password\s*[:=]\s*['"][^'"]{8,}['"]/ },
            { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}/ },
            { name: 'Database URL', pattern: /mongodb:\/\/.*:.*@/ }
        ];

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                secretPatterns.forEach(pattern => {
                    if (pattern.pattern.test(line)) {
                        secrets.push({
                            type: pattern.name,
                            line: index + 1,
                            content: line.trim(),
                            severity: 'HIGH'
                        });
                    }
                });
            });

        } catch (error) {
            throw new Error(`Failed to scan ${filePath}: ${error.message}`);
        }

        return secrets;
    }

    /**
     * Run npm audit for dependency vulnerabilities
     */
    async scanDependencies(projectPath = '.') {
        return new Promise((resolve) => {
            const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            const auditProcess = spawn(npmCommand, ['audit', '--json'], {
                cwd: projectPath,
                stdio: 'pipe',
                shell: true
            });

            let output = '';
            let error = '';

            auditProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            auditProcess.stderr.on('data', (data) => {
                error += data.toString();
            });

            auditProcess.on('close', (code) => {
                try {
                    const auditData = JSON.parse(output);
                    resolve({
                        success: true,
                        vulnerabilities: auditData.vulnerabilities || {},
                        metadata: auditData.metadata || {},
                        exitCode: code
                    });
                } catch (parseError) {
                    resolve({
                        success: false,
                        error: 'Failed to parse npm audit output',
                        rawOutput: output,
                        rawError: error,
                        exitCode: code
                    });
                }
            });
        });
    }

    /**
     * Scan files for insecure patterns
     */
    async scanForInsecurePatterns(filePath) {
        const issues = [];

        const insecurePatterns = [
            { name: 'eval() usage', pattern: /\beval\s*\(/, severity: 'HIGH' },
            { name: 'innerHTML usage', pattern: /\.innerHTML\s*=/, severity: 'MEDIUM' },
            { name: 'document.write()', pattern: /document\.write\s*\(/, severity: 'MEDIUM' },
            { name: 'SQL injection risk', pattern: /query\s*\(\s*['"`].*\$\{/, severity: 'HIGH' },
            { name: 'Hard-coded localhost', pattern: /localhost:\d+/, severity: 'LOW' },
            { name: 'console.log in production', pattern: /console\.(log|debug|info)/, severity: 'LOW' },
            { name: 'TODO/FIXME comments', pattern: /\/\/\s*(TODO|FIXME|HACK)/, severity: 'INFO' }
        ];

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                insecurePatterns.forEach(pattern => {
                    if (pattern.pattern.test(line)) {
                        issues.push({
                            type: pattern.name,
                            line: index + 1,
                            content: line.trim(),
                            severity: pattern.severity
                        });
                    }
                });
            });

        } catch (error) {
            throw new Error(`Failed to scan ${filePath}: ${error.message}`);
        }

        return issues;
    }

    /**
     * Scan directory recursively
     */
    async scanDirectory(dirPath, extensions = ['.js', '.ts', '.json', '.env']) {
        const results = {
            files: [],
            secrets: [],
            issues: [],
            totalFiles: 0
        };

        const self = this;
        async function scanRecursive(currentPath) {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                if (entry.isDirectory()) {
                    // Skip node_modules and .git
                    if (!['node_modules', '.git', '.vscode'].includes(entry.name)) {
                        await scanRecursive(fullPath);
                    }
                } else {
                    const ext = path.extname(entry.name);
                    if (extensions.includes(ext)) {
                        results.totalFiles++;
                        results.files.push(fullPath);

                        // Scan for secrets
                        const secrets = await self.scanForSecrets(fullPath);
                        results.secrets.push(...secrets.map(s => ({ ...s, file: fullPath })));

                        // Scan for insecure patterns
                        const issues = await self.scanForInsecurePatterns(fullPath);
                        results.issues.push(...issues.map(i => ({ ...i, file: fullPath })));
                    }
                }
            }
        }

        await scanRecursive(dirPath);
        return results;
    }

    /**
     * Execute security workflow
     */
    async executeWorkflow(context) {
        const results = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            context
        };

        try {
            if (context.action === 'scan-file') {
                const secrets = await this.scanForSecrets(context.filePath);
                const issues = await this.scanForInsecurePatterns(context.filePath);

                results.secrets = secrets;
                results.issues = issues;
                results.file = context.filePath;

            } else if (context.action === 'scan-directory') {
                results.scan = await this.scanDirectory(context.path);

            } else if (context.action === 'audit-dependencies') {
                results.audit = await this.scanDependencies(context.path);

            } else if (context.action === 'full-scan') {
                // Comprehensive security scan
                results.scan = await this.scanDirectory(context.path || '.');
                results.audit = await this.scanDependencies(context.path || '.');

            } else {
                throw new Error(`Unknown action: ${context.action}`);
            }

            results.success = true;
            return results;

        } catch (error) {
            results.success = false;
            results.error = error.message;
            throw error;
        }
    }

    /**
     * Get security report summary
     */
    generateReport(scanResults) {
        const summary = {
            totalFiles: scanResults.scan?.totalFiles || 0,
            secretsFound: scanResults.scan?.secrets?.length || 0,
            issuesFound: scanResults.scan?.issues?.length || 0,
            vulnerabilities: 0
        };

        if (scanResults.audit?.vulnerabilities) {
            summary.vulnerabilities = Object.keys(scanResults.audit.vulnerabilities).length;
        }

        const severityCounts = {
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0,
            INFO: 0
        };

        [...(scanResults.scan?.secrets || []), ...(scanResults.scan?.issues || [])]
            .forEach(item => {
                severityCounts[item.severity]++;
            });

        return { summary, severityCounts };
    }

    /**
     * Get status and capabilities
     */
    getStatus() {
        return {
            agent: this.agentName,
            capabilities: [
                'scan-file',
                'scan-directory',
                'audit-dependencies',
                'full-scan'
            ],
            patterns: {
                secrets: 7,
                insecure: 7
            }
        };
    }
}

module.exports = { SecurityAgentWorking };

// Test if run directly
if (require.main === module) {
    async function testSecurityAgent() {
        console.log('🧪 Testing SecurityAgentWorking...\n');

        const agent = new SecurityAgentWorking({ sessionId: 'test-session' });
        console.log('Status:', agent.getStatus());

        try {
            // Test file scan
            const result = await agent.executeWorkflow({
                action: 'scan-file',
                filePath: __filename
            });

            console.log('✅ File scan completed');
            console.log(`   Secrets found: ${result.secrets.length}`);
            console.log(`   Issues found: ${result.issues.length}`);

            if (result.issues.length > 0) {
                console.log('   Issues:');
                result.issues.forEach(issue => {
                    console.log(`     Line ${issue.line}: ${issue.type} (${issue.severity})`);
                });
            }

        } catch (error) {
            console.error('❌ Security agent test failed:', error.message);
        }
    }

    testSecurityAgent();
}