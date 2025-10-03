#!/usr/bin/env node

'use strict';

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const MODES = {
    VERIFY: 'verify',
    CLEAN: 'clean',
    FULL: 'full'
};

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        mode: MODES.VERIFY,
        push: false
    };

    for (const arg of args) {
        switch (arg) {
            case '--verify':
                options.mode = MODES.VERIFY;
                break;
            case '--clean':
                options.mode = MODES.CLEAN;
                break;
            case '--full':
                options.mode = MODES.FULL;
                break;
            case '--push':
                options.push = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                console.warn(`Unknown option: ${arg}`);
                options.help = true;
                break;
        }
    }

    return options;
}

function printUsage() {
    console.log(`\nLonicFLex Security Cleanup Tool\n--------------------------------`);
    console.log(`Usage: node scripts/security-cleanup.js [options]\n`);
    console.log('Options:');
    console.log('  --verify        Scan repository for secrets (default, safe for CI)');
    console.log('  --clean         Create a clean history branch with secrets removed');
    console.log('  --full          Verify, clean, and optionally push (interactive)');
    console.log('  --push          Push the clean branch (only with --clean/--full)');
    console.log('  --help, -h      Show this help message');
}

class SecurityCleanup {
    constructor() {
        this.secretPatterns = [
            /gh[pousr]_[a-zA-Z0-9]{36}/g,
            /github_pat_[a-zA-Z0-9_]{82}/g,
            /xox[baprs]-[0-9]+-[0-9]+-[a-zA-Z0-9]+/g,
            /AKIA[0-9A-Z]{16}/g,
            /sk_live_[a-zA-Z0-9]{24}/g,
            /pk_live_[a-zA-Z0-9]{24}/g,
            /AIza[0-9A-Za-z\-_]{35}/g
        ];

        this.excludePatterns = [
            /node_modules/,
            /\.git\/(objects|refs|logs)/,
            /package-lock\.json/,
            /yarn\.lock/,
            /\.db$/,
            /\.db-wal$/,
            /\.db-shm$/,
            /\.(png|jpg|jpeg|gif|ico|woff2?|ttf|eot|svg)$/
        ];

        this.foundSecrets = [];
        this.cleanedFiles = [];
        this.scannedFiles = 0;
    }

    async scanDirectory(dirPath = '.') {
        this.foundSecrets = [];
        this.cleanedFiles = [];
        this.scannedFiles = 0;

        console.log('dY"? Starting comprehensive security scan...');
        await this.scanDirectoryRecursive(dirPath);

        console.log(`\ndY"S Scan Results:`);
        console.log(`   Files scanned: ${this.scannedFiles}`);
        console.log(`   Secrets found: ${this.foundSecrets.length}`);
        console.log(`   Files cleaned: ${this.cleanedFiles.length}`);

        if (this.foundSecrets.length > 0) {
            console.log(`\n�s��,?  Secrets found in:`);
            this.foundSecrets.forEach(secret => {
                console.log(`   ${secret.file}:${secret.line} - ${secret.type}`);
            });
        }

        return {
            secretsFound: this.foundSecrets.length,
            filesScanned: this.scannedFiles,
            filesCleaned: this.cleanedFiles.length,
            secrets: this.foundSecrets
        };
    }

    async scanDirectoryRecursive(dirPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative('.', fullPath);

            if (this.excludePatterns.some(pattern => pattern.test(relativePath))) {
                continue;
            }

            if (entry.isDirectory()) {
                await this.scanDirectoryRecursive(fullPath);
            } else if (entry.isFile()) {
                await this.scanFile(fullPath, relativePath);
                this.scannedFiles += 1;
            }
        }
    }

    async scanFile(filePath, relativePath) {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        let fileModified = false;
        let cleanedContent = content;

        lines.forEach((line, lineIndex) => {
            this.secretPatterns.forEach(pattern => {
                const matches = line.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        this.foundSecrets.push({
                            file: relativePath,
                            line: lineIndex + 1,
                            type: this.identifySecretType(match),
                            value: match
                        });
                    });

                    const replacement = '[REDACTED_SECRET]';
                    cleanedContent = cleanedContent.replace(pattern, replacement);
                    fileModified = true;
                }
            });
        });

        if (fileModified) {
            await fs.writeFile(filePath, cleanedContent, 'utf8');
            this.cleanedFiles.push(relativePath);
        }
    }

    identifySecretType(secret) {
        if (secret.startsWith('gh')) {
            return 'GitHub Token';
        }
        if (secret.startsWith('xox')) {
            return 'Slack Token';
        }
        if (secret.startsWith('AKIA')) {
            return 'AWS Access Key';
        }
        if (secret.startsWith('sk_live_') || secret.startsWith('pk_live_')) {
            return 'Stripe Key';
        }
        if (secret.startsWith('AIza')) {
            return 'Google API Key';
        }
        return 'Unknown Secret';
    }

    async cleanGitHistory({ push = false, scanResult } = {}) {
        console.log('dY"5 Cleaning git history to remove secrets...');

        const result = scanResult || await this.scanDirectory('.');
        if (result.secretsFound > 0) {
            console.log(`�s��,?  Found ${result.secretsFound} secrets, cleaned ${result.filesCleaned} files`);
        }

        const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        console.log(`dY"? Current branch: ${currentBranch}`);

        const cleanBranch = 'clean-export-' + Date.now();
        console.log(`dYO� Creating clean branch: ${cleanBranch}`);

        execSync(`git checkout --orphan ${cleanBranch}`, { stdio: 'inherit' });
        execSync('git add -A', { stdio: 'inherit' });

        const commitMessage = [
            'Clean repository export - secrets removed',
            '',
            `Security scan: ${result.secretsFound} secret(s) redacted`,
            `Files scanned: ${result.filesScanned}`,
            `Timestamp: ${new Date().toISOString()}`
        ].join('\n');

        execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });

        console.log(`�o. Clean branch created: ${cleanBranch}`);
        console.log('dYs? Ready to push clean branch to GitHub');

        let pushed = false;
        if (push) {
            pushed = this.pushCleanBranch(cleanBranch);
        }

        return {
            originalBranch: currentBranch,
            cleanBranch,
            secretsRemoved: result.secretsFound,
            filesScanned: result.filesScanned,
            pushed
        };
    }

    pushCleanBranch(branchName) {
        console.log(`dYs? Pushing clean branch: ${branchName}`);
        try {
            execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });
            console.log(`�o. Successfully pushed clean branch: ${branchName}`);
            return true;
        } catch (error) {
            console.error('�?O Push failed:', error.message);
            return false;
        }
    }
}

async function runVerify(cleanup) {
    const result = await cleanup.scanDirectory('.');

    if (result.secretsFound > 0) {
        console.error(`\n?s��,?  ${result.secretsFound} potential secret(s) detected. See log for details.`);
        process.exit(1);
    }

    console.log('\n�o. No secrets detected.');
}

async function runClean(cleanup, { push }) {
    const result = await cleanup.cleanGitHistory({ push });

    console.log('\ndY"< Cleanup Summary:');
    console.log(`   Original branch: ${result.originalBranch}`);
    console.log(`   Clean branch: ${result.cleanBranch}`);
    console.log(`   Secrets removed: ${result.secretsRemoved}`);
    console.log(`   Files scanned: ${result.filesScanned}`);
    if (push) {
        console.log(result.pushed ? '�o. Clean branch pushed to origin.' : '�?O Failed to push clean branch. Please push manually.');
    }
}

async function runFull(cleanup, options) {
    await runVerify(cleanup);
    await runClean(cleanup, options);
}

async function main() {
    const options = parseArgs();

    if (options.help) {
        printUsage();
        return;
    }

    const cleanup = new SecurityCleanup();

    if (options.mode === MODES.VERIFY) {
        await runVerify(cleanup);
    } else if (options.mode === MODES.CLEAN) {
        await runClean(cleanup, options);
    } else {
        await runFull(cleanup, options);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('\n�?O Security cleanup failed:', error.message);
        process.exit(1);
    });
}

module.exports = { SecurityCleanup };