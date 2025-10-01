#!/usr/bin/env node

/**
 * SMOKING TEST: GitHub Workflows Validation
 *
 * PURPOSE: Verify our working GitHub workflows are properly configured
 * NOT: Running the workflows (GitHub does that)
 * YES: Validating workflow files exist and are valid YAML
 *
 * This test SMOKES OUT if we accidentally break workflow configuration.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log('🧪 SMOKING TEST: GitHub Workflows Validation\n');

// Define expected working workflows
const EXPECTED_WORKFLOWS = [
    {
        file: '.github/workflows/test-enforcement.yml',
        name: '🔒 Test Enforcement - MANDATORY',
        required: true,
        description: 'Critical: Enforces 100% test coverage'
    },
    {
        file: '.github/workflows/ci.yml',
        name: 'LonicFLex CI/CD Pipeline',
        required: true,
        description: 'Main CI pipeline for testing'
    },
    {
        file: '.github/workflows/security.yml',
        name: 'LonicFLex Security Scan',
        required: true,
        description: 'Security scanning workflow'
    },
    {
        file: '.github/workflows/multi-agent.yml',
        name: 'Multi-Agent System Test',
        required: false,
        description: 'Multi-agent coordination tests'
    }
];

const DEPRECATED_WORKFLOWS = [
    {
        file: '.github/workflows/ci-cd.yml',
        reason: 'Calls non-existent npm scripts (demo-security-scanner, demo-db, etc.)'
    }
];

let passed = 0;
let failed = 0;
const errors = [];

console.log('━━━ Testing Working Workflows ━━━\n');

// Test each expected workflow
for (const workflow of EXPECTED_WORKFLOWS) {
    const filePath = path.join(process.cwd(), workflow.file);

    try {
        // Test 1: File exists
        if (!fs.existsSync(filePath)) {
            failed++;
            errors.push(`❌ MISSING: ${workflow.file}`);
            console.log(`❌ ${workflow.name}`);
            console.log(`   File: ${workflow.file}`);
            console.log(`   Error: File does not exist`);
            console.log();
            continue;
        }

        // Test 2: File is readable
        const content = fs.readFileSync(filePath, 'utf8');

        // Test 3: Valid YAML
        let doc;
        try {
            doc = yaml.load(content);
        } catch (yamlError) {
            failed++;
            errors.push(`❌ INVALID YAML: ${workflow.file}`);
            console.log(`❌ ${workflow.name}`);
            console.log(`   File: ${workflow.file}`);
            console.log(`   Error: Invalid YAML - ${yamlError.message}`);
            console.log();
            continue;
        }

        // Test 4: Has name field
        if (!doc.name) {
            failed++;
            errors.push(`❌ NO NAME: ${workflow.file}`);
            console.log(`❌ ${workflow.name}`);
            console.log(`   File: ${workflow.file}`);
            console.log(`   Error: Missing 'name' field`);
            console.log();
            continue;
        }

        // Test 5: Has jobs
        if (!doc.jobs || Object.keys(doc.jobs).length === 0) {
            failed++;
            errors.push(`❌ NO JOBS: ${workflow.file}`);
            console.log(`❌ ${workflow.name}`);
            console.log(`   File: ${workflow.file}`);
            console.log(`   Error: No jobs defined`);
            console.log();
            continue;
        }

        // Test 6: Verify expected name matches
        if (doc.name !== workflow.name) {
            console.log(`⚠️  ${workflow.name}`);
            console.log(`   File: ${workflow.file}`);
            console.log(`   Warning: Name mismatch - expected "${workflow.name}", found "${doc.name}"`);
            console.log();
        }

        passed++;
        console.log(`✅ ${workflow.name}`);
        console.log(`   File: ${workflow.file}`);
        console.log(`   Jobs: ${Object.keys(doc.jobs).length}`);
        console.log(`   Status: Valid and ready`);
        console.log();

    } catch (error) {
        failed++;
        errors.push(`❌ ERROR: ${workflow.file} - ${error.message}`);
        console.log(`❌ ${workflow.name}`);
        console.log(`   File: ${workflow.file}`);
        console.log(`   Error: ${error.message}`);
        console.log();
    }
}

console.log('━━━ Checking Deprecated Workflows ━━━\n');

// Check deprecated workflows are NOT active
for (const workflow of DEPRECATED_WORKFLOWS) {
    const filePath = path.join(process.cwd(), workflow.file);

    if (fs.existsSync(filePath)) {
        console.log(`⚠️  FOUND: ${workflow.file}`);
        console.log(`   Reason: ${workflow.reason}`);
        console.log(`   Action: Should be moved to .github/workflows/deprecated/`);
        console.log();
    } else {
        console.log(`✅ NOT FOUND: ${workflow.file}`);
        console.log(`   Status: Properly deprecated`);
        console.log();
    }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failed > 0) {
    console.log('❌ SMOKING TEST FAILED: Workflow configuration is broken!\n');
    console.log('Errors:');
    errors.forEach(err => console.log(`  ${err}`));
    process.exit(1);
}

console.log('✅ SMOKING TEST PASSED: All working workflows are properly configured!');
console.log('🎯 GitHub Actions will use these workflows for CI/CD\n');
process.exit(0);
