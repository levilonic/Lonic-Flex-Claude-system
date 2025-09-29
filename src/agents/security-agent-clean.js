const { info, warn, error } = require('../services/logger');
/**
 * Clean Security Agent - Proper Software Engineering Implementation
 *
 * This replaces the corrupted security-agent.js with:
 * 1. Proper dependency injection using ServiceContainer
 * 2. Real security scanning and verification
 * 3. No validateSuccess({}) empty calls
 * 4. Evidence-based vulnerability detection
 * 5. Single responsibility: Security analysis
 */

const fs = require('fs').promises;
const path = require('path');

class CleanSecurityAgent {
    constructor(sessionId = null, serviceContainer = null) {
        this.sessionId = sessionId || `security-${Date.now()}`;
        this.serviceContainer = serviceContainer;
        this.agentName = 'security-clean';
        this.status = 'created';
        this.database = null;
        this.memory = null;

        // Security patterns to detect
        this.securityPatterns = [
            {
                name: 'Hardcoded API Keys',
                pattern: /(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[=:]\s*['"][A-Za-z0-9]{10,}['"]/i,
                severity: 'critical',
                description: 'Hardcoded API keys or secrets detected'
            },
            {
                name: 'SQL Injection Risk',
                pattern: /\$\{[^}]*\}.*INTO|INSERT.*\$\{|SELECT.*\$\{/i,
                severity: 'high',
                description: 'Potential SQL injection vulnerability'
            },
            {
                name: 'Unsafe Eval Usage',
                pattern: /eval\s*\(/i,
                severity: 'high',
                description: 'Unsafe eval() usage detected'
            },
            {
                name: 'Unsafe File Operations',
                pattern: /fs\.(readFile|writeFile|unlink).*\$\{/i,
                severity: 'medium',
                description: 'File operations with dynamic paths'
            },
            {
                name: 'Debug Console Left',
                pattern: /console\.(log|debug|info)\(/i,
                severity: 'low',
                description: 'Debug console statements in production code'
            }
        ];
    }

    /**
     * Initialize agent with required services
     * Fail fast if dependencies not available
     */
    async initialize() {
        if (!this.serviceContainer) {
            throw new Error('ServiceContainer required for initialization');
        }

        // Get required services
        this.database = this.serviceContainer.getService('database');
        if (!this.database) {
            throw new Error('Database service not available');
        }

        this.memory = this.serviceContainer.getService('memory');
        if (!this.memory) {
            throw new Error('Memory service not available');
        }

        this.status = 'initialized';
        info(`CleanSecurityAgent ${this.sessionId} initialized`);
    }

    /**
     * Scan directory for security vulnerabilities
     * Provides real evidence of findings
     */
    async scanDirectory(directoryPath) {
        if (this.status !== 'initialized') {
            throw new Error('Agent not initialized. Call initialize() first.');
        }

        info(`🔍 Security scanning directory: ${directoryPath}`);

        try {
            const findings = [];
            const scannedFiles = [];

            // Get list of JavaScript files to scan
            const files = await this.getJavaScriptFiles(directoryPath);

            for (const filePath of files) {
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    scannedFiles.push(filePath);

                    // Check each security pattern
                    for (const pattern of this.securityPatterns) {
                        const matches = content.match(pattern.pattern);
                        if (matches) {
                            findings.push({
                                file: filePath,
                                pattern: pattern.name,
                                severity: pattern.severity,
                                description: pattern.description,
                                evidence: matches[0], // Actual match found
                                line: this.findLineNumber(content, matches[0])
                            });
                        }
                    }
                } catch (fileError) {
                    console.warn(`⚠️ Could not scan file ${filePath}: ${fileError.message}`);
                }
            }

            // Record scan results in database
            await this.database.run(
                'INSERT INTO agents (id, session_id, name, status, context_data, result_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    `${this.agentName}-scan-${Date.now()}`,
                    this.sessionId,
                    this.agentName,
                    'completed',
                    JSON.stringify({ operation: 'scanDirectory', directoryPath, filesScanned: scannedFiles.length }),
                    JSON.stringify({ findingsCount: findings.length, findings: findings.slice(0, 5) }), // Sample findings
                    new Date().toISOString()
                ]
            );

            // Calculate risk score based on findings
            const riskScore = this.calculateRiskScore(findings);

            info(`Security scan completed: ${findings.length} findings in ${scannedFiles.length} files`);
            info(`📊 Risk score: ${riskScore}/100`);

            return {
                success: true,
                findings,
                filesScanned: scannedFiles.length,
                riskScore,
                sessionId: this.sessionId,
                evidence: { findings, scannedFiles } // Real evidence
            };

        } catch (error) {
            error(`❌ Security scan failed:`, error.message);

            return {
                success: false,
                error: error.message,
                sessionId: this.sessionId
            };
        }
    }

    /**
     * Get JavaScript files from directory recursively
     */
    async getJavaScriptFiles(directoryPath) {
        const jsFiles = [];

        try {
            const items = await fs.readdir(directoryPath, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(directoryPath, item.name);

                if (item.isDirectory()) {
                    // Skip node_modules and .git directories
                    if (item.name !== 'node_modules' && item.name !== '.git') {
                        const subFiles = await this.getJavaScriptFiles(fullPath);
                        jsFiles.push(...subFiles);
                    }
                } else if (item.isFile() && item.name.endsWith('.js')) {
                    jsFiles.push(fullPath);
                }
            }
        } catch (error) {
            console.warn(`⚠️ Could not read directory ${directoryPath}: ${error.message}`);
        }

        return jsFiles;
    }

    /**
     * Find line number of a match in file content
     */
    findLineNumber(content, match) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(match)) {
                return i + 1;
            }
        }
        return 0;
    }

    /**
     * Calculate risk score based on findings
     */
    calculateRiskScore(findings) {
        const severityScores = {
            critical: 25,
            high: 15,
            medium: 10,
            low: 5
        };

        let totalScore = 0;
        for (const finding of findings) {
            totalScore += severityScores[finding.severity] || 0;
        }

        return Math.min(totalScore, 100); // Cap at 100
    }

    /**
     * Generate security report
     */
    async generateReport() {
        if (this.status !== 'initialized') {
            throw new Error('Agent not initialized');
        }

        try {
            // Get recent scan results from database
            const recentScans = await this.database.getAllSQL(
                'SELECT * FROM agents WHERE session_id = ? AND name = ? ORDER BY created_at DESC LIMIT 5',
                [this.sessionId, this.agentName]
            );

            const report = {
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                scansPerformed: recentScans.length,
                recentActivity: recentScans.map(scan => ({
                    timestamp: scan.created_at,
                    status: scan.status,
                    context: scan.context_data ? JSON.parse(scan.context_data) : null,
                    results: scan.result_data ? JSON.parse(scan.result_data) : null
                }))
            };

            info(`Security report generated for ${recentScans.length} scans`);

            return {
                success: true,
                report,
                sessionId: this.sessionId,
                evidence: recentScans // Real database records
            };

        } catch (error) {
            error(`❌ Report generation failed:`, error.message);

            return {
                success: false,
                error: error.message,
                sessionId: this.sessionId
            };
        }
    }

    /**
     * Clean up agent records (for testing)
     */
    async cleanup() {
        if (!this.database) {
            return;
        }

        try {
            await this.database.run(
                'DELETE FROM agents WHERE session_id = ?',
                [this.sessionId]
            );
            info(`🧹 Cleaned up security agent records for ${this.sessionId}`);
        } catch (error) {
            warn(`Cleanup error: ${error.message}`);
        }
    }

    /**
     * Get current status (no lies)
     */
    getStatus() {
        return {
            agentName: this.agentName,
            sessionId: this.sessionId,
            status: this.status,
            hasServiceContainer: !!this.serviceContainer,
            hasDatabase: !!this.database,
            hasMemory: !!this.memory,
            patternsLoaded: this.securityPatterns.length
        };
    }
}

module.exports = { CleanSecurityAgent };

// For testing - allow direct execution with system startup
if (require.main === module) {
    const { systemStartup } = require('../system-startup');

    async function testCleanSecurityAgent() {
        info('🧪 Testing CleanSecurityAgent...');

        let agent = null;

        try {
            // Initialize system first
            await systemStartup.initialize();
            const serviceContainer = systemStartup.getServiceContainer();

            // Create and test agent
            agent = new CleanSecurityAgent('test-security-agent', serviceContainer);

            info('📝 Agent status before init:', agent.getStatus());

            await agent.initialize();
            info('📝 Agent status after init:', agent.getStatus());

            // Test security scan on current directory (should find issues)
            const scanResult = await agent.scanDirectory('./agents');
            info('📝 Scan result:', scanResult.success ? 'SUCCESS' : 'FAILED');

            if (scanResult.success) {
                info(`Found ${scanResult.findings.length} security findings`);
                info(`Risk score: ${scanResult.riskScore}/100`);

                // Show first few findings
                scanResult.findings.slice(0, 3).forEach(finding => {
                    info(`  ${finding.severity}: ${finding.pattern} in ${finding.file}:${finding.line}`);
                });
            } else {
                info('Error:', scanResult.error);
            }

            // Test report generation
            const reportResult = await agent.generateReport();
            info('📝 Report result:', reportResult.success ? 'SUCCESS' : 'FAILED');

            if (reportResult.success) {
                info(`Report contains ${reportResult.report.scansPerformed} scans`);
            }

            info('🎉 CleanSecurityAgent test completed');

            // Clean up
            await agent.cleanup();
            await systemStartup.shutdown();

        } catch (error) {
            error('❌ Test failed:', error.message);
            error('Stack:', error.stack);

            if (agent) {
                await agent.cleanup();
            }

            process.exit(1);
        }
    }

    testCleanSecurityAgent();
}