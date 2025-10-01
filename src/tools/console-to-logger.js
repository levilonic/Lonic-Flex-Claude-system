#!/usr/bin/env node
/**
 * Console-to-Logger Conversion Tool - Phase 3B
 * Systematically converts console.log/error statements to structured logging
 *
 * Features:
 * - Pattern-based conversion (emojis -> log levels)
 * - Context-aware logger injection
 * - Safe backup and verification
 * - Dry-run and batch modes
 */

const fs = require('fs').promises;
const path = require('path');

class ConsoleToLoggerConverter {
    constructor(options = {}) {
        this.dryRun = options.dryRun || false;
        this.verbose = options.verbose || false;
        this.backupDir = options.backupDir || 'backups/console-conversion';
        this.stats = {
            filesProcessed: 0,
            consoleLogsConverted: 0,
            consoleErrorsConverted: 0,
            patternsDetected: {},
            errors: []
        };

        // Pattern mappings for intelligent conversion
        this.patterns = [
            { regex: /console\.log\((['"`])PASS([^'"`]*?)\1(\s*,\s*(.*?))?\)/g, level: 'info', category: 'success' },
            { regex: /console\.log\((['"`])FAIL([^'"`]*?)\1(\s*,\s*(.*?))?\)/g, level: 'error', category: 'error' },
            { regex: /console\.log\((['"`])WARN([^'"`]*?)\1(\s*,\s*(.*?))?\)/g, level: 'warn', category: 'warning' },
            { regex: /console\.log\((['"`])([^'"`]*?)\1(\s*,\s*(.*?))?\)/g, level: 'debug', category: 'operation' },
            { regex: /console\.log\((['"`])([^'"`]*?)\1(\s*,\s*(.*?))?\)/g, level: 'info', category: 'status' },
            { regex: /console\.log\((['"`])([^'"`]*?)\1(\s*,\s*(.*?))?\)/g, level: 'info', category: 'startup' },
            { regex: /console\.log\((['"`])([^'"`]*?)\1(\s*,\s*(.*?))?\)/g, level: 'info', category: 'target' },
            { regex: /console\.log\((['"`])BUILD([^'"`]*?)\1(\s*,\s*(.*?))?\)/g, level: 'info', category: 'build' },
            { regex: /console\.error\((.*?)\)/g, level: 'error', category: 'error' },
            { regex: /console\.log\((.*?)\)/g, level: 'info', category: 'general' }
        ];
    }

    /**
     * Process a single file for console-to-logger conversion
     */
    async processFile(filePath) {
        try {
            if (this.verbose) {
                console.log(` Processing: ${filePath}`);
            }

            const content = await fs.readFile(filePath, 'utf8');
            const originalContent = content;
            let modifiedContent = content;
            let fileStats = { consoleLog: 0, consoleError: 0, patterns: {} };

            // Check if file needs logger import
            const needsLoggerImport = this.needsLoggerImport(content);
            const loggerContext = this.detectLoggerContext(filePath, content);

            // Apply pattern-based conversions
            for (const pattern of this.patterns) {
                const matches = content.matchAll(pattern.regex);
                for (const match of matches) {
                    const replacement = this.createLoggerReplacement(match, pattern, loggerContext);
                    modifiedContent = modifiedContent.replace(match[0], replacement);

                    // Update stats
                    if (pattern.level === 'error') {
                        fileStats.consoleError++;
                        this.stats.consoleErrorsConverted++;
                    } else {
                        fileStats.consoleLog++;
                        this.stats.consoleLogsConverted++;
                    }

                    if (!fileStats.patterns[pattern.category]) {
                        fileStats.patterns[pattern.category] = 0;
                    }
                    fileStats.patterns[pattern.category]++;

                    if (!this.stats.patternsDetected[pattern.category]) {
                        this.stats.patternsDetected[pattern.category] = 0;
                    }
                    this.stats.patternsDetected[pattern.category]++;
                }
            }

            // Add logger import if needed
            if (needsLoggerImport && (fileStats.consoleLog > 0 || fileStats.consoleError > 0)) {
                modifiedContent = this.addLoggerImport(modifiedContent, loggerContext, filePath);
            }

            // Write changes if not dry run
            if (!this.dryRun && modifiedContent !== originalContent) {
                // Create backup first
                await this.createBackup(filePath, originalContent);
                await fs.writeFile(filePath, modifiedContent, 'utf8');

                if (this.verbose) {
                    console.log(`  PASS Converted: ${fileStats.consoleLog + fileStats.consoleError} statements`);
                }
            } else if (this.dryRun && modifiedContent !== originalContent) {
                console.log(`   Would convert: ${fileStats.consoleLog + fileStats.consoleError} statements in ${filePath}`);
            }

            this.stats.filesProcessed++;
            return fileStats;

        } catch (error) {
            this.stats.errors.push({ file: filePath, error: error.message });
            console.error(`FAIL Error processing ${filePath}: ${error.message}`);
            return null;
        }
    }

    /**
     * Detect if file needs logger import and what type
     */
    needsLoggerImport(content) {
        return !content.includes('this.logger') &&
               !content.includes('const { logger') &&
               !content.includes('require(\'./logger\')') &&
               !content.includes('require(\'../services/logger\')');
    }

    /**
     * Detect logger context based on file location and content
     */
    detectLoggerContext(filePath, content) {
        const context = {
            type: 'standalone',
            category: 'general',
            hasServiceContainer: false,
            isAgent: false,
            isService: false,
            loggerVar: 'logger'
        };

        // Detect file type and context
        if (filePath.includes('src/agents/')) {
            context.type = 'agent';
            context.category = 'agent';
            context.isAgent = true;
            context.hasServiceContainer = content.includes('serviceContainer') || content.includes('this.services');
            context.loggerVar = 'this.logger';
        } else if (filePath.includes('src/services/')) {
            context.type = 'service';
            context.category = 'service';
            context.isService = true;
            context.hasServiceContainer = content.includes('serviceContainer') || content.includes('ServiceContainer');
            context.loggerVar = content.includes('this.') ? 'this.logger' : 'logger';
        } else if (filePath.includes('src/core/')) {
            context.type = 'core';
            context.category = 'system';
        } else if (filePath.includes('src/database/')) {
            context.type = 'database';
            context.category = 'database';
        } else if (filePath.includes('integrations/')) {
            context.type = 'integration';
            context.category = 'integration';
        } else if (filePath.includes('tests/')) {
            context.type = 'test';
            context.category = 'test';
        }

        return context;
    }

    /**
     * Create logger replacement for matched console statement
     */
    createLoggerReplacement(match, pattern, context) {
        let message = '';
        let additionalArgs = '';

        // Handle different match patterns
        if (pattern.category === 'general' || pattern.category === 'error') {
            // For general/error patterns: match[1] contains the entire argument
            message = match[1] || '';
        } else {
            // For emoji patterns: match[1]=quote, match[2]=text, match[4]=additional args
            const quote = match[1] || '"';
            const text = (match[2] || '').trim(); // Trim whitespace from emoji removal
            additionalArgs = match[4] ? `, ${match[4]}` : '';

            // Reconstruct the message with quotes, removing emoji
            message = `${quote}${text}${quote}`;
        }

        // Handle different logger contexts
        let loggerCall = '';
        if (context.hasServiceContainer && context.isAgent) {
            loggerCall = `if (this.logger) { this.logger.${pattern.level}(${message}${additionalArgs}); }`;
        } else if (context.hasServiceContainer) {
            loggerCall = `if (this.logger) { this.logger.${pattern.level}(${message}${additionalArgs}); }`;
        } else {
            loggerCall = `${context.loggerVar}.${pattern.level}(${message}${additionalArgs})`;
        }

        return loggerCall;
    }

    /**
     * Calculate relative path from file to logger service
     */
    calculateLoggerPath(filePath) {
        const path = require('path');
        const fileDir = path.dirname(filePath);
        const loggerPath = path.join('src', 'services', 'logger');

        // Calculate relative path from file directory to logger
        let relativePath = path.relative(fileDir, loggerPath);

        // Normalize path separators and ensure it starts with ./
        relativePath = relativePath.replace(/\\/g, '/');
        if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
            relativePath = './' + relativePath;
        }

        return relativePath;
    }

    /**
     * Add logger import to file based on context
     */
    addLoggerImport(content, context, filePath) {
        if (context.hasServiceContainer) {
            // For files with ServiceContainer, add logger initialization in constructor
            const constructorMatch = content.match(/constructor\([^)]*\)\s*\{/);
            if (constructorMatch) {
                const insertPoint = constructorMatch.index + constructorMatch[0].length;
                const loggerInit = `\n        // Logger service integration\n        const loggerService = this.services ? this.services.getService('logger') : null;\n        this.logger = loggerService ? loggerService.createContextLogger({\n            category: '${context.category}'\n        }) : null;\n`;
                return content.slice(0, insertPoint) + loggerInit + content.slice(insertPoint);
            }
        } else {
            // For standalone files, add logger import at top (after shebang if present)
            const shebangMatch = content.match(/^#!/);
            let insertPoint = 0;

            if (shebangMatch) {
                // Skip shebang line
                const firstNewline = content.indexOf('\n') + 1;
                const importsAfterShebang = content.slice(firstNewline).match(/^((?:const|require|import).*\n)*/);
                insertPoint = firstNewline + (importsAfterShebang ? importsAfterShebang[0].length : 0);
            } else {
                // No shebang, find existing imports
                const importMatch = content.match(/^((?:const|require|import).*\n)*/);
                insertPoint = importMatch ? importMatch[0].length : 0;
            }

            const loggerPath = this.calculateLoggerPath(filePath);
            const loggerImport = `const { ${context.loggerVar} } = require('${loggerPath}');\n`;
            return content.slice(0, insertPoint) + loggerImport + content.slice(insertPoint);
        }

        return content;
    }

    /**
     * Create backup of original file
     */
    async createBackup(filePath, content) {
        const backupPath = path.join(this.backupDir, filePath.replace(/[/\\]/g, '_'));
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, content, 'utf8');
    }

    /**
     * Process a directory recursively
     */
    async processDirectory(dirPath, options = {}) {
        const {
            includeTests = false,
            maxFiles = 100,
            filePattern = /\.js$/
        } = options;

        console.log(`CYCLE Processing directory: ${dirPath}`);

        try {
            const files = await this.findJSFiles(dirPath, includeTests, filePattern);
            const filesToProcess = files.slice(0, maxFiles);

            console.log(` Found ${files.length} files, processing ${filesToProcess.length}`);

            for (const file of filesToProcess) {
                await this.processFile(file);
            }

            this.printStats();
            return this.stats;

        } catch (error) {
            console.error(`FAIL Error processing directory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find all JS files in directory
     */
    async findJSFiles(dirPath, includeTests = false, pattern = /\.js$/) {
        const files = [];

        async function walk(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name === 'archived') {
                        continue;
                    }
                    if (!includeTests && entry.name === 'tests') {
                        continue;
                    }
                    await walk(fullPath);
                } else if (entry.isFile() && pattern.test(entry.name)) {
                    files.push(fullPath);
                }
            }
        }

        await walk(dirPath);
        return files;
    }

    /**
     * Print conversion statistics
     */
    printStats() {
        console.log('\nMETRICS Conversion Statistics:');
        console.log('='.repeat(40));
        console.log(`Files processed: ${this.stats.filesProcessed}`);
        console.log(`console.log converted: ${this.stats.consoleLogsConverted}`);
        console.log(`console.error converted: ${this.stats.consoleErrorsConverted}`);
        console.log(`Total converted: ${this.stats.consoleLogsConverted + this.stats.consoleErrorsConverted}`);

        if (Object.keys(this.stats.patternsDetected).length > 0) {
            console.log('\nPattern breakdown:');
            Object.entries(this.stats.patternsDetected).forEach(([pattern, count]) => {
                console.log(`  ${pattern}: ${count}`);
            });
        }

        if (this.stats.errors.length > 0) {
            console.log(`\nFAIL Errors: ${this.stats.errors.length}`);
            this.stats.errors.forEach(error => {
                console.log(`  ${error.file}: ${error.error}`);
            });
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run'),
        verbose: args.includes('--verbose'),
        includeTests: args.includes('--include-tests')
    };

    const converter = new ConsoleToLoggerConverter(options);

    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Console-to-Logger Conversion Tool

Usage:
  node console-to-logger.js <command> [options]

Commands:
  file <path>           Convert single file
  directory <path>      Convert all JS files in directory
  core                  Convert critical core services
  services              Convert src/services/
  all                   Convert entire src/ directory

Options:
  --dry-run             Show what would be changed without writing
  --verbose             Verbose output
  --include-tests       Include test files in directory conversion
  --help                Show this help

Examples:
  node console-to-logger.js file src/core/system-startup.js --dry-run
  node console-to-logger.js directory src/services --verbose
  node console-to-logger.js core
        `);
        return;
    }

    const command = args[0];
    const target = args[1];

    try {
        switch (command) {
            case 'file':
                if (!target) {
                    throw new Error('File path required');
                }
                await converter.processFile(target);
                converter.printStats();
                break;

            case 'directory':
                if (!target) {
                    throw new Error('Directory path required');
                }
                await converter.processDirectory(target, options);
                break;

            case 'core':
                console.log(' Converting critical core services...');
                const coreFiles = [
                    'src/core/system-startup.js',
                    'src/core/advanced-agent-coordinator.js',
                    'src/core/agent-communication-bus.js',
                    'src/database/sqlite-manager.js'
                ];
                for (const file of coreFiles) {
                    await converter.processFile(file);
                }
                converter.printStats();
                break;

            case 'services':
                await converter.processDirectory('src/services', options);
                break;

            case 'all':
                await converter.processDirectory('src', { ...options, maxFiles: 1000 });
                break;

            default:
                throw new Error(`Unknown command: ${command}`);
        }

        console.log('\nPASS Conversion completed successfully!');

    } catch (error) {
        console.error(`FAIL Conversion failed: ${error.message}`);
        process.exit(1);
    }
}

// Run CLI if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { ConsoleToLoggerConverter };