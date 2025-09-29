#!/usr/bin/env node

/**
 * Systematic Require Path Fixer
 *
 * This script fixes all require() statements across the codebase to reflect
 * the new directory structure after reorganization.
 */

const fs = require('fs');
const path = require('path');

// Directory mappings: old path -> new path
const PATH_MAPPINGS = {
    // Core mappings
    './factor3-context-manager': '../context-management/factor3-context-manager',
    './context-management/factor3-context-manager': './factor3-context-manager',
    './context-management/context-scope-manager': './context-scope-manager',
    './context-management/long-term-persistence': './long-term-persistence',
    './context-management/context-health-monitor': './context-health-monitor',
    './context-management/context-window-monitor': './context-window-monitor',
    './context-management/token-counter': './token-counter',

    // External integrations
    './external-integrations/simplified-external-coordinator': '../../integrations/external-integrations/simplified-external-coordinator',

    // Claude integrations
    './claude-multi-agent-core': '../../integrations/claude/claude-multi-agent-core',
    './system-startup': '../../src/core/system-startup',
    './agents/minimal-agent': '../../src/agents/minimal-agent',
    './agents/github-agent-clean': '../../src/agents/github-agent-clean',
    './agents/security-agent-clean': '../../src/agents/security-agent-clean',

    // Services
    './services/service-container': '../services/service-container',
    '../12-factor-compliance-tracker': '../core/12-factor-compliance-tracker',

    // Documentation
    '../docs/anthropic-docs-manager': '../../docs/anthropic-docs-manager',

    // Database
    '../factor3-context-manager': '../context-management/factor3-context-manager',
};

// Additional patterns that need context-aware fixing
const CONTEXT_PATTERNS = [
    {
        // Files in src/core/ trying to require context management
        fromDir: 'src/core',
        pattern: /require\(['"]\.\/factor3-context-manager['"]\)/g,
        replacement: "require('../context-management/factor3-context-manager')"
    },
    {
        // Files in src/database/ trying to require context management
        fromDir: 'src/database',
        pattern: /require\(['"]\.\.\/factor3-context-manager['"]\)/g,
        replacement: "require('../context-management/factor3-context-manager')"
    }
];

function getAllJSFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !['node_modules', '.git', '_archive'].includes(entry.name)) {
            getAllJSFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

function fixRequirePaths(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const relativePath = path.relative('.', filePath);

    // Apply global mappings
    for (const [oldPath, newPath] of Object.entries(PATH_MAPPINGS)) {
        const oldPattern = new RegExp(`require\\(['"]${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`, 'g');
        const newRequire = `require('${newPath}')`;

        if (content.includes(oldPath)) {
            console.log(`📝 ${relativePath}: ${oldPath} -> ${newPath}`);
            content = content.replace(oldPattern, newRequire);
            modified = true;
        }
    }

    // Apply context-aware patterns
    for (const pattern of CONTEXT_PATTERNS) {
        const fileDir = path.dirname(filePath);
        if (fileDir.includes(pattern.fromDir)) {
            if (pattern.pattern.test(content)) {
                console.log(`🎯 ${relativePath}: Context-aware fix for ${pattern.fromDir}`);
                content = content.replace(pattern.pattern, pattern.replacement);
                modified = true;
            }
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }

    return false;
}

function main() {
    console.log('🔧 Starting systematic require path fixes...\n');

    const allFiles = getAllJSFiles('.');
    let totalFixed = 0;

    for (const filePath of allFiles) {
        try {
            if (fixRequirePaths(filePath)) {
                totalFixed++;
            }
        } catch (error) {
            console.error(`❌ Error fixing ${filePath}: ${error.message}`);
        }
    }

    console.log(`\n✅ Fixed require paths in ${totalFixed} files`);
    console.log('🧪 Testing critical paths...\n');

    // Test key files
    const testFiles = [
        'tests/integration/test-universal-context.js',
        'tests/phase-tests/test-phase3a-integration.js'
    ];

    for (const testFile of testFiles) {
        try {
            require.cache = {}; // Clear require cache
            require(path.resolve(testFile));
            console.log(`✅ ${testFile}: Can be required successfully`);
        } catch (error) {
            console.log(`❌ ${testFile}: ${error.message}`);
        }
    }
}

if (require.main === module) {
    main();
}

module.exports = { fixRequirePaths, PATH_MAPPINGS };