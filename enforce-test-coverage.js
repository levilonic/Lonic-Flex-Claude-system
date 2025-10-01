#!/usr/bin/env node
/**
 * 🔒 TEST COVERAGE ENFORCEMENT - BLOCKING MODE
 * Enforces 100% test coverage - BLOCKS if not met
 */

const { execSync } = require('child_process');

console.log('\n🔒 ENFORCING TEST COVERAGE REQUIREMENTS\n');
console.log('══════════════════════════════════════════════════════════════\n');

let exitCode = 0;

// Run coverage analysis
try {
    const output = execSync('node analyze-test-coverage.js', { encoding: 'utf8', stdio: 'pipe' });

    // Extract coverage percentage
    const coverageMatch = output.match(/Files with tests: (\d+)\/(\d+) \((\d+\.\d+)%\)/);

    if (coverageMatch) {
        const testedFiles = parseInt(coverageMatch[1]);
        const totalFiles = parseInt(coverageMatch[2]);
        const coveragePercent = parseFloat(coverageMatch[3]);

        console.log(`📊 Coverage Status:`);
        console.log(`   Files with tests: ${testedFiles}/${totalFiles}`);
        console.log(`   Coverage: ${coveragePercent}%`);
        console.log('');

        // ENFORCEMENT RULES
        const MINIMUM_COVERAGE = 100.0;
        const MAXIMUM_UNTESTED = 0;

        const untestedFiles = totalFiles - testedFiles;

        // Check Rule 1: Coverage threshold
        if (coveragePercent < MINIMUM_COVERAGE) {
            console.log(`❌ RULE VIOLATION: Coverage below ${MINIMUM_COVERAGE}%`);
            console.log(`   Current: ${coveragePercent}%`);
            console.log(`   Required: ${MINIMUM_COVERAGE}%`);
            console.log('');
            exitCode = 1;
        } else {
            console.log(`✅ RULE PASSED: Coverage at ${coveragePercent}%`);
        }

        // Check Rule 2: No untested files
        if (untestedFiles > MAXIMUM_UNTESTED) {
            console.log(`❌ RULE VIOLATION: ${untestedFiles} untested files found`);
            console.log(`   Required: ${MAXIMUM_UNTESTED} untested files`);
            console.log('');

            // Show which files are untested
            console.log('Untested files:');
            const untestedMatch = output.match(/❌.*\n/g);
            if (untestedMatch) {
                untestedMatch.slice(0, 10).forEach(line => console.log('  ' + line.trim()));
                if (untestedMatch.length > 10) {
                    console.log(`  ... and ${untestedMatch.length - 10} more`);
                }
            }
            console.log('');
            exitCode = 1;
        } else {
            console.log(`✅ RULE PASSED: All ${totalFiles} files have tests`);
        }

        console.log('');
        console.log('══════════════════════════════════════════════════════════════');

        if (exitCode === 0) {
            console.log('🎉 ENFORCEMENT PASSED: All rules satisfied!');
            console.log('✅ Safe to commit/merge');
        } else {
            console.log('🚨 ENFORCEMENT FAILED: Rules violated!');
            console.log('❌ Commit/merge BLOCKED');
            console.log('');
            console.log('Actions required:');
            console.log('1. Add tests for untested files');
            console.log('2. Run: node analyze-test-coverage.js');
            console.log('3. Run: npm test');
            console.log('4. Try again');
        }

        console.log('══════════════════════════════════════════════════════════════\n');

    } else {
        console.log('⚠️  Could not parse coverage output');
        console.log(output);
        exitCode = 1;
    }

} catch (error) {
    console.log('❌ Coverage analysis failed:', error.message);
    exitCode = 1;
}

process.exit(exitCode);
