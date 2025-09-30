#!/usr/bin/env node
/**
 * Rigorous Test Coverage Analyzer
 * Identifies ALL source files that lack comprehensive test coverage
 */

const fs = require('fs');
const path = require('path');

// Color codes for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function findJSFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!file.startsWith('.') && file !== 'node_modules' && file !== 'generated') {
                findJSFiles(filePath, fileList);
            }
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

function getSourceFiles() {
    const srcDir = path.join(__dirname, 'src');
    return findJSFiles(srcDir).map(f => path.relative(__dirname, f));
}

function getTestFiles() {
    const testsDir = path.join(__dirname, 'tests');
    return findJSFiles(testsDir).map(f => path.relative(__dirname, f));
}

function analyzeTestCoverage() {
    console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════`);
    console.log(`🔍 RIGOROUS TEST COVERAGE ANALYSIS`);
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}\n`);

    const sourceFiles = getSourceFiles();
    const testFiles = getTestFiles();

    console.log(`${colors.blue}📊 Source Files Found: ${sourceFiles.length}${colors.reset}`);
    console.log(`${colors.blue}📊 Test Files Found: ${testFiles.length}${colors.reset}\n`);

    // Categorize source files
    const categories = {
        agents: [],
        services: [],
        core: [],
        contextManagement: [],
        database: [],
        memory: [],
        auth: [],
        tools: [],
        working: [],
        other: []
    };

    sourceFiles.forEach(file => {
        if (file.includes('src\\agents\\')) categories.agents.push(file);
        else if (file.includes('src\\services\\')) categories.services.push(file);
        else if (file.includes('src\\core\\')) categories.core.push(file);
        else if (file.includes('src\\context-management\\')) categories.contextManagement.push(file);
        else if (file.includes('src\\database\\')) categories.database.push(file);
        else if (file.includes('src\\memory\\')) categories.memory.push(file);
        else if (file.includes('src\\auth\\')) categories.auth.push(file);
        else if (file.includes('src\\tools\\')) categories.tools.push(file);
        else if (file.includes('src\\working\\')) categories.working.push(file);
        else categories.other.push(file);
    });

    // Check which files have tests
    const tested = new Set();
    const untested = new Set();

    sourceFiles.forEach(sourceFile => {
        const baseName = path.basename(sourceFile, '.js');
        const hasTest = testFiles.some(testFile => {
            return testFile.includes(baseName) ||
                   testFile.includes(baseName.replace(/-/g, '_')) ||
                   testFile.includes(baseName.replace(/_/g, '-'));
        });

        if (hasTest) {
            tested.add(sourceFile);
        } else {
            untested.add(sourceFile);
        }
    });

    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════`);
    console.log(`📈 COVERAGE SUMMARY`);
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}\n`);

    const coveragePercent = ((tested.size / sourceFiles.length) * 100).toFixed(1);
    const color = coveragePercent >= 80 ? colors.green : coveragePercent >= 50 ? colors.yellow : colors.red;

    console.log(`${color}✓ Files with tests: ${tested.size}/${sourceFiles.length} (${coveragePercent}%)${colors.reset}`);
    console.log(`${colors.red}✗ Files without tests: ${untested.size}/${sourceFiles.length}${colors.reset}\n`);

    // Report by category
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════`);
    console.log(`📂 COVERAGE BY CATEGORY`);
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}\n`);

    Object.keys(categories).forEach(category => {
        const files = categories[category];
        if (files.length === 0) return;

        const testedInCategory = files.filter(f => tested.has(f)).length;
        const coveragePct = ((testedInCategory / files.length) * 100).toFixed(1);
        const catColor = coveragePct >= 80 ? colors.green : coveragePct >= 50 ? colors.yellow : colors.red;

        console.log(`${catColor}${category.padEnd(20)} ${testedInCategory.toString().padStart(3)}/${files.length.toString().padEnd(3)} (${coveragePct}%)${colors.reset}`);
    });

    // List untested files
    console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════`);
    console.log(`❌ FILES WITHOUT TEST COVERAGE (${untested.size} files)`);
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}\n`);

    const untestedByCategory = {};
    untested.forEach(file => {
        const category = Object.keys(categories).find(cat => categories[cat].includes(file));
        if (!untestedByCategory[category]) untestedByCategory[category] = [];
        untestedByCategory[category].push(file);
    });

    Object.keys(untestedByCategory).forEach(category => {
        console.log(`${colors.yellow}📁 ${category.toUpperCase()}:${colors.reset}`);
        untestedByCategory[category].forEach(file => {
            console.log(`   ${colors.red}✗${colors.reset} ${file}`);
        });
        console.log('');
    });

    // Critical missing tests
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════`);
    console.log(`🚨 CRITICAL MISSING TESTS`);
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}\n`);

    const criticalFiles = Array.from(untested).filter(file => {
        return file.includes('src\\core\\') ||
               file.includes('src\\services\\') ||
               (file.includes('src\\agents\\') && !file.includes('working'));
    });

    if (criticalFiles.length > 0) {
        console.log(`${colors.red}Found ${criticalFiles.length} CRITICAL files without tests:${colors.reset}\n`);
        criticalFiles.forEach(file => {
            console.log(`   ${colors.red}⚠️  ${file}${colors.reset}`);
        });
    } else {
        console.log(`${colors.green}✅ All critical files have test coverage!${colors.reset}`);
    }

    console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════`);
    console.log(`📊 FINAL VERDICT`);
    console.log(`═══════════════════════════════════════════════════════════════${colors.reset}\n`);

    if (coveragePercent >= 80 && criticalFiles.length === 0) {
        console.log(`${colors.green}✅ EXCELLENT: Test coverage is comprehensive (${coveragePercent}%)${colors.reset}`);
    } else if (coveragePercent >= 50) {
        console.log(`${colors.yellow}⚠️  WARNING: Test coverage is insufficient (${coveragePercent}%)${colors.reset}`);
        console.log(`${colors.yellow}   ${untested.size} files need tests (${criticalFiles.length} are critical)${colors.reset}`);
    } else {
        console.log(`${colors.red}❌ CRITICAL: Test coverage is severely lacking (${coveragePercent}%)${colors.reset}`);
        console.log(`${colors.red}   ${untested.size} files need tests (${criticalFiles.length} are critical)${colors.reset}`);
    }

    console.log('');

    return {
        totalFiles: sourceFiles.length,
        tested: tested.size,
        untested: untested.size,
        coveragePercent: parseFloat(coveragePercent),
        criticalMissing: criticalFiles.length,
        untestedFiles: Array.from(untested),
        criticalFiles
    };
}

// Run analysis
const results = analyzeTestCoverage();

// Exit with error code if coverage is insufficient
if (results.coveragePercent < 80 || results.criticalMissing > 0) {
    process.exit(1);
}
