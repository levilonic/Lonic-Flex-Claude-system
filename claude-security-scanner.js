const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const winston = require('winston');

class SecurityScanner {
    constructor() {
        this.scanners = new Map();
        this.findings = new Map();
        this.config = {
            enabled: true,
            severity: 'medium',
            scanTypes: ['dependency', 'code', 'container', 'configuration'],
            outputFormat: 'json',
            excludePatterns: ['node_modules', '.git', 'logs', 'temp'],
            reportPath: './security-reports'
        };
        
        this.setupLogger();
        this.initializeScanners();
    }

    setupLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/security.log' }),
                new winston.transports.Console()
            ]
        });
    }

    async initialize() {
        try {
            await this.createDirectories();
            await this.loadConfiguration();
            await this.validateScanners();
            
            this.logger.info('Security scanner initialized');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize security scanner:', error);
            throw error;
        }
    }

    async createDirectories() {
        const dirs = ['security-reports', 'security-reports/dependency', 'security-reports/code', 'security-reports/container'];
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    initializeScanners() {
        // Dependency vulnerability scanner (npm audit)
        this.scanners.set('dependency', {
            name: 'NPM Audit',
            command: 'npm',
            args: ['audit', '--json'],
            enabled: true,
            severity: ['moderate', 'high', 'critical']
        });

        // Code quality scanner (ESLint security rules)
        this.scanners.set('code', {
            name: 'ESLint Security',
            command: 'npx',
            args: ['eslint', '--format', 'json', '--ext', '.js,.ts', '.'],
            enabled: true,
            configFile: '.eslintrc-security.js'
        });

        // Docker container scanner
        this.scanners.set('container', {
            name: 'Docker Security',
            command: 'docker',
            args: ['run', '--rm', '-v', '/var/run/docker.sock:/var/run/docker.sock', 'aquasec/trivy'],
            enabled: false, // Requires Trivy to be installed
            severity: ['MEDIUM', 'HIGH', 'CRITICAL']
        });

        // Configuration security scanner
        this.scanners.set('configuration', {
            name: 'Config Scanner',
            enabled: true,
            patterns: [
                { pattern: /password\s*=\s*["'].*["']/gi, type: 'hardcoded_password' },
                { pattern: /api[_-]?key\s*=\s*["'].*["']/gi, type: 'hardcoded_api_key' },
                { pattern: /secret\s*=\s*["'].*["']/gi, type: 'hardcoded_secret' },
                { pattern: /token\s*=\s*["'].*["']/gi, type: 'hardcoded_token' },
                { pattern: /database.*url\s*=\s*["'].*["']/gi, type: 'database_connection_string' }
            ]
        });
    }

    async scanAll(options = {}) {
        const scanOptions = { ...this.config, ...options };
        const results = {
            scanId: this.generateScanId(),
            timestamp: Date.now(),
            results: {},
            summary: {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0
            }
        };

        this.logger.info(`Starting security scan: ${results.scanId}`);

        for (const scanType of scanOptions.scanTypes) {
            if (this.scanners.has(scanType)) {
                try {
                    this.logger.info(`Running ${scanType} scan...`);
                    const scanResult = await this.runScan(scanType, scanOptions);
                    results.results[scanType] = scanResult;
                    this.updateSummary(results.summary, scanResult);
                } catch (error) {
                    this.logger.error(`Failed to run ${scanType} scan:`, error);
                    results.results[scanType] = { error: error.message };
                }
            }
        }

        await this.saveReport(results);
        this.logger.info(`Security scan completed: ${results.scanId}`);
        
        return results;
    }

    async runScan(scanType, options) {
        const scanner = this.scanners.get(scanType);
        
        switch (scanType) {
            case 'dependency':
                return await this.runDependencyScan(scanner, options);
            case 'code':
                return await this.runCodeScan(scanner, options);
            case 'container':
                return await this.runContainerScan(scanner, options);
            case 'configuration':
                return await this.runConfigurationScan(scanner, options);
            default:
                throw new Error(`Unknown scan type: ${scanType}`);
        }
    }

    async runDependencyScan(scanner, options) {
        try {
            const result = await this.executeCommand(scanner.command, scanner.args);
            const audit = JSON.parse(result.stdout);
            
            const vulnerabilities = [];
            
            if (audit.vulnerabilities) {
                for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
                    vulnerabilities.push({
                        package: name,
                        severity: vuln.severity,
                        title: vuln.title,
                        range: vuln.range,
                        fixAvailable: vuln.fixAvailable,
                        via: vuln.via
                    });
                }
            }

            return {
                scanner: scanner.name,
                vulnerabilities,
                summary: audit.metadata || {}
            };
        } catch (error) {
            // NPM audit returns exit code 1 when vulnerabilities found
            if (error.stdout) {
                try {
                    const audit = JSON.parse(error.stdout);
                    return this.processDependencyResults(audit, scanner);
                } catch (parseError) {
                    throw new Error(`Failed to parse npm audit output: ${parseError.message}`);
                }
            }
            throw error;
        }
    }

    processDependencyResults(audit, scanner) {
        const vulnerabilities = [];
        
        if (audit.vulnerabilities) {
            for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
                if (scanner.severity.includes(vuln.severity)) {
                    vulnerabilities.push({
                        package: name,
                        severity: vuln.severity,
                        title: vuln.title,
                        range: vuln.range,
                        fixAvailable: vuln.fixAvailable
                    });
                }
            }
        }

        return {
            scanner: scanner.name,
            vulnerabilities,
            summary: audit.metadata || {}
        };
    }

    async runCodeScan(scanner, options) {
        const securityRules = await this.createESLintSecurityConfig();
        
        try {
            const result = await this.executeCommand(scanner.command, [...scanner.args, '-c', securityRules]);
            const eslintResults = JSON.parse(result.stdout);
            
            const issues = [];
            eslintResults.forEach(file => {
                file.messages.forEach(message => {
                    if (message.ruleId && message.ruleId.includes('security')) {
                        issues.push({
                            file: file.filePath,
                            line: message.line,
                            column: message.column,
                            severity: this.mapESLintSeverity(message.severity),
                            rule: message.ruleId,
                            message: message.message
                        });
                    }
                });
            });

            return {
                scanner: scanner.name,
                issues,
                filesScanned: eslintResults.length
            };
        } catch (error) {
            if (error.stdout) {
                const eslintResults = JSON.parse(error.stdout);
                return this.processCodeResults(eslintResults, scanner);
            }
            return { scanner: scanner.name, issues: [], error: error.message };
        }
    }

    async runContainerScan(scanner, options) {
        // Placeholder for container scanning
        // In production, this would use tools like Trivy, Clair, or Snyk
        return {
            scanner: scanner.name,
            images: [],
            vulnerabilities: [],
            note: 'Container scanning requires external tools (Trivy, Clair, etc.)'
        };
    }

    async runConfigurationScan(scanner, options) {
        const configFiles = await this.findConfigurationFiles();
        const findings = [];

        for (const file of configFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                
                for (const rule of scanner.patterns) {
                    const matches = [...content.matchAll(rule.pattern)];
                    
                    matches.forEach((match, index) => {
                        const lines = content.substring(0, match.index).split('\n');
                        findings.push({
                            file,
                            line: lines.length,
                            type: rule.type,
                            severity: 'high',
                            message: `Potential ${rule.type.replace('_', ' ')} found`,
                            snippet: match[0].substring(0, 50) + '...'
                        });
                    });
                }
            } catch (error) {
                this.logger.warn(`Failed to scan ${file}:`, error.message);
            }
        }

        return {
            scanner: scanner.name,
            findings,
            filesScanned: configFiles.length
        };
    }

    async findConfigurationFiles() {
        const configPatterns = [
            '**/*.env*',
            '**/*.config.js',
            '**/*.json',
            '**/*.yml',
            '**/*.yaml'
        ];

        const files = [];
        
        for (const pattern of configPatterns) {
            try {
                const matches = await this.glob(pattern);
                files.push(...matches.filter(file => 
                    !this.config.excludePatterns.some(exclude => file.includes(exclude))
                ));
            } catch (error) {
                // Pattern not found, continue
            }
        }

        return [...new Set(files)]; // Remove duplicates
    }

    async createESLintSecurityConfig() {
        const configPath = '.eslintrc-security.js';
        const config = `
module.exports = {
    env: { node: true, es6: true },
    extends: ['plugin:security/recommended'],
    plugins: ['security'],
    rules: {
        'security/detect-buffer-noassert': 'error',
        'security/detect-child-process': 'warn',
        'security/detect-disable-mustache-escape': 'error',
        'security/detect-eval-with-expression': 'error',
        'security/detect-new-buffer': 'error',
        'security/detect-no-csrf-before-method-override': 'error',
        'security/detect-non-literal-fs-filename': 'warn',
        'security/detect-non-literal-regexp': 'warn',
        'security/detect-non-literal-require': 'warn',
        'security/detect-object-injection': 'warn',
        'security/detect-possible-timing-attacks': 'warn',
        'security/detect-pseudoRandomBytes': 'error',
        'security/detect-unsafe-regex': 'error'
    }
};`;

        try {
            await fs.writeFile(configPath, config);
            return configPath;
        } catch (error) {
            this.logger.warn('Could not create ESLint security config, using default');
            return null;
        }
    }

    async glob(pattern) {
        // Simple glob implementation - in production use a proper glob library
        const files = [];
        await this.walkDirectory('.', files, pattern);
        return files;
    }

    async walkDirectory(dir, files, pattern) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && !this.config.excludePatterns.includes(entry.name)) {
                    await this.walkDirectory(fullPath, files, pattern);
                } else if (entry.isFile()) {
                    // Simple pattern matching
                    const ext = pattern.split('.').pop();
                    if (entry.name.endsWith(ext) || pattern === '**/*') {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Directory access error, skip
        }
    }

    mapESLintSeverity(severity) {
        return severity === 2 ? 'high' : 'medium';
    }

    updateSummary(summary, scanResult) {
        if (scanResult.vulnerabilities) {
            scanResult.vulnerabilities.forEach(vuln => {
                summary.total++;
                summary[vuln.severity] = (summary[vuln.severity] || 0) + 1;
            });
        }

        if (scanResult.issues) {
            scanResult.issues.forEach(issue => {
                summary.total++;
                summary[issue.severity] = (summary[issue.severity] || 0) + 1;
            });
        }

        if (scanResult.findings) {
            scanResult.findings.forEach(finding => {
                summary.total++;
                summary[finding.severity] = (summary[finding.severity] || 0) + 1;
            });
        }
    }

    async saveReport(results) {
        const reportPath = path.join(this.config.reportPath, `scan-${results.scanId}.json`);
        await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
        
        // Also save summary for dashboard
        const summaryPath = path.join(this.config.reportPath, 'latest-summary.json');
        await fs.writeFile(summaryPath, JSON.stringify({
            scanId: results.scanId,
            timestamp: results.timestamp,
            summary: results.summary
        }, null, 2));

        this.logger.info(`Security report saved: ${reportPath}`);
    }

    generateScanId() {
        return `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    async executeCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                ...options
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr, code });
                } else {
                    const error = new Error(`Command failed with code ${code}`);
                    error.stdout = stdout;
                    error.stderr = stderr;
                    error.code = code;
                    reject(error);
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    async getLatestReport() {
        try {
            const summaryPath = path.join(this.config.reportPath, 'latest-summary.json');
            const summary = JSON.parse(await fs.readFile(summaryPath, 'utf8'));
            return summary;
        } catch (error) {
            return null;
        }
    }

    async loadConfiguration() {
        try {
            const configPath = path.join(__dirname, 'config', 'security.json');
            const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
            Object.assign(this.config, config);
            
            this.logger.info('Security configuration loaded');
        } catch (error) {
            this.logger.info('Using default security configuration');
        }
    }

    async validateScanners() {
        for (const [type, scanner] of this.scanners) {
            if (!scanner.enabled) continue;
            
            try {
                if (scanner.command) {
                    await this.executeCommand('which', [scanner.command]);
                }
                this.logger.info(`Scanner validated: ${scanner.name}`);
            } catch (error) {
                this.logger.warn(`Scanner not available: ${scanner.name}`);
                scanner.enabled = false;
            }
        }
    }
}

module.exports = { SecurityScanner };

if (require.main === module) {
    const scanner = new SecurityScanner();

    async function demo() {
        console.log('🔒 Starting Security Scanner Demo...\n');
        
        await scanner.initialize();
        
        console.log('🔍 Available scanners:');
        for (const [type, config] of scanner.scanners) {
            const status = config.enabled ? '✅' : '❌';
            console.log(`  ${status} ${config.name} (${type})`);
        }
        console.log();
        
        console.log('🚀 Running security scan...');
        const results = await scanner.scanAll();
        
        console.log(`\n📋 Scan Results (ID: ${results.scanId}):`);
        console.log(`  Total Issues: ${results.summary.total}`);
        console.log(`  Critical: ${results.summary.critical || 0}`);
        console.log(`  High: ${results.summary.high || 0}`);
        console.log(`  Medium: ${results.summary.medium || 0}`);
        console.log(`  Low: ${results.summary.low || 0}`);
        
        console.log('\n📊 Scan Details:');
        for (const [type, result] of Object.entries(results.results)) {
            if (result.error) {
                console.log(`  ❌ ${type}: ${result.error}`);
            } else {
                const count = result.vulnerabilities?.length || result.issues?.length || result.findings?.length || 0;
                console.log(`  ✅ ${type}: ${count} issues found`);
            }
        }
        
        console.log(`\n💾 Report saved to: security-reports/scan-${results.scanId}.json`);
        console.log('✅ Security scan demo completed');
    }

    demo().catch(console.error);
}