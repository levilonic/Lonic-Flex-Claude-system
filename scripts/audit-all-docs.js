#!/usr/bin/env node

/**
 * Audit ALL markdown files and generate fix report
 * Finds: broken paths, fake commands, unverified claims, undefined terms
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FullDocAuditor {
    constructor() {
        this.issues = [];
        this.files = [];
    }

    /**
     * Find all markdown files
     */
    findAllMarkdownFiles() {
        const output = execSync('find . -name "*.md" -not -path "*/node_modules/*"', {
            encoding: 'utf8'
        });
        this.files = output.trim().split('\n').filter(f => f);
        return this.files;
    }

    /**
     * Check if file exists
     */
    fileExists(filepath) {
        try {
            return fs.existsSync(filepath);
        } catch {
            return false;
        }
    }

    /**
     * Audit single markdown file
     */
    auditFile(filepath) {
        const content = fs.readFileSync(filepath, 'utf8');
        const issues = [];

        // Check for npm run commands that don't exist
        const npmCommandRegex = /npm run ([a-z-:]+)/g;
        let match;
        while ((match = npmCommandRegex.exec(content)) !== null) {
            const command = match[1];
            try {
                execSync(`npm run ${command} --silent`, { stdio: 'ignore', timeout: 1000 });
            } catch (error) {
                issues.push({
                    type: 'BROKEN_COMMAND',
                    line: content.substring(0, match.index).split('\n').length,
                    value: `npm run ${command}`,
                    message: 'Command not found in package.json'
                });
            }
        }

        // Check for file references
        const fileRefRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
        while ((match = fileRefRegex.exec(content)) !== null) {
            const refPath = match[2];
            const resolvedPath = path.resolve(path.dirname(filepath), refPath);
            if (!this.fileExists(resolvedPath)) {
                issues.push({
                    type: 'BROKEN_LINK',
                    line: content.substring(0, match.index).split('\n').length,
                    value: refPath,
                    message: 'Referenced file does not exist'
                });
            }
        }

        // Check for unverified percentage claims
        const percentRegex = /(\d+)%\s+(success|accuracy|pass|complete)/gi;
        while ((match = percentRegex.exec(content)) !== null) {
            issues.push({
                type: 'UNVERIFIED_CLAIM',
                line: content.substring(0, match.index).split('\n').length,
                value: match[0],
                message: 'Percentage claim needs verification'
            });
        }

        // Check for test count claims
        const testCountRegex = /(\d+\/\d+)\s+test/gi;
        while ((match = testCountRegex.exec(content)) !== null) {
            issues.push({
                type: 'UNVERIFIED_CLAIM',
                line: content.substring(0, match.index).split('\n').length,
                value: match[0],
                message: 'Test count claim needs verification'
            });
        }

        // Check for undefined technical terms
        const terms = [
            'Factor 3', 'WAL mode', 'Universal Context', 'Phase 3A',
            'SimplifiedExternalCoordinator', 'MultiAgentCore'
        ];
        for (const term of terms) {
            if (content.includes(term)) {
                // Check if term is defined nearby (within 500 chars before first use)
                const firstUse = content.indexOf(term);
                const contextBefore = content.substring(Math.max(0, firstUse - 500), firstUse);
                const hasDefinition = contextBefore.includes(':') || contextBefore.includes('is a') ||
                                     contextBefore.includes('means') || contextBefore.includes('refers to');

                if (!hasDefinition && firstUse < 1000) { // Only flag if term appears early without definition
                    issues.push({
                        type: 'UNDEFINED_TERM',
                        line: content.substring(0, firstUse).split('\n').length,
                        value: term,
                        message: 'Technical term used without definition'
                    });
                }
            }
        }

        // Check file size (warn if too long)
        const lines = content.split('\n').length;
        if (lines > 500) {
            issues.push({
                type: 'FORMATTING',
                line: 1,
                value: `${lines} lines`,
                message: 'File is very long, consider splitting'
            });
        }

        return issues;
    }

    /**
     * Run full audit
     */
    async run() {
        console.log('📋 LonicFLex Complete Documentation Audit');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const files = this.findAllMarkdownFiles();
        console.log(`Found ${files.length} markdown files\n`);

        const categories = {
            personas: files.filter(f => f.includes('.promptx/personas/')),
            commands: files.filter(f => f.includes('.claude/commands/')),
            content: files.filter(f => f.includes('content/')),
            docs: files.filter(f => f.includes('docs/') && !f.includes('archived')),
            contexts: files.filter(f => f.includes('data/contexts/projects/')),
            history: files.filter(f => f.includes('docs/history/')),
            root: files.filter(f => !f.includes('/'))
        };

        const report = {
            BROKEN_COMMAND: [],
            BROKEN_LINK: [],
            UNVERIFIED_CLAIM: [],
            UNDEFINED_TERM: [],
            FORMATTING: []
        };

        console.log('Auditing files...\n');

        for (const [category, categoryFiles] of Object.entries(categories)) {
            console.log(`━━━ ${category.toUpperCase()} (${categoryFiles.length} files) ━━━`);

            for (const file of categoryFiles) {
                const issues = this.auditFile(file);
                if (issues.length > 0) {
                    console.log(`  📄 ${file}`);
                    for (const issue of issues) {
                        console.log(`     ${issue.type}: Line ${issue.line} - ${issue.message}`);
                        console.log(`        Value: "${issue.value}"`);
                        report[issue.type].push({ file, ...issue });
                    }
                }
            }
            console.log('');
        }

        // Generate summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 AUDIT SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const totalIssues = Object.values(report).reduce((sum, arr) => sum + arr.length, 0);

        for (const [type, issues] of Object.entries(report)) {
            if (issues.length > 0) {
                console.log(`${type}: ${issues.length} issues`);
            }
        }

        console.log(`\nTotal Issues Found: ${totalIssues}`);
        console.log(`Files with Issues: ${new Set(Object.values(report).flat().map(i => i.file)).size}`);
        console.log(`Clean Files: ${files.length - new Set(Object.values(report).flat().map(i => i.file)).size}`);

        // Save detailed report
        fs.writeFileSync('doc-audit-report.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Detailed report saved to: doc-audit-report.json');

        console.log('\n━━━ RECOMMENDATIONS ━━━');
        if (report.BROKEN_COMMAND.length > 0) {
            console.log(`⚠️  Fix ${report.BROKEN_COMMAND.length} broken npm commands`);
        }
        if (report.BROKEN_LINK.length > 0) {
            console.log(`⚠️  Fix ${report.BROKEN_LINK.length} broken file links`);
        }
        if (report.UNVERIFIED_CLAIM.length > 0) {
            console.log(`⚠️  Verify or remove ${report.UNVERIFIED_CLAIM.length} unverified claims`);
        }
        if (report.UNDEFINED_TERM.length > 0) {
            console.log(`⚠️  Define ${report.UNDEFINED_TERM.length} technical terms`);
        }

        return report;
    }
}

// Run audit
const auditor = new FullDocAuditor();
auditor.run().catch(error => {
    console.error('❌ Audit failed:', error.message);
    process.exit(1);
});