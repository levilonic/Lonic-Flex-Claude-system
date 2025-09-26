#!/usr/bin/env node

/**
 * Test Context Continuation Fix
 * Verifies that persona system respects active session context
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Context Continuation Fix...\n');

// Test 1: Verify session context has active work section
console.log('📋 Test 1: Session Context Format');
try {
    const sessionContext = fs.readFileSync('current-session-context.xml', 'utf8');

    if (sessionContext.includes('<active_work status="IN_PROGRESS">')) {
        console.log('✅ Active work section found in session context');
    } else {
        console.log('❌ Active work section missing from session context');
        process.exit(1);
    }

    if (sessionContext.includes('<immediate_next>')) {
        console.log('✅ Immediate next action clearly specified');
    } else {
        console.log('❌ Immediate next action not specified');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Error reading session context:', error.message);
    process.exit(1);
}

// Test 2: Verify persona files have context-first rules
console.log('\n📋 Test 2: Persona Files Updated');
const personaFiles = [
    '.promptx/personas/agent-developer.md',
    '.promptx/personas/agent-code-reviewer.md',
    '.promptx/personas/agent-rebaser.md',
    '.promptx/personas/agent-merger.md',
    '.promptx/personas/agent-multiplan-manager.md',
    '.promptx/personas/agent-init.md'
];

for (const personaFile of personaFiles) {
    try {
        const content = fs.readFileSync(personaFile, 'utf8');

        if (content.includes('CONTEXT CONTINUATION (HIGHEST PRIORITY)')) {
            console.log(`✅ ${path.basename(personaFile)} has context-first rule`);
        } else {
            console.log(`❌ ${path.basename(personaFile)} missing context-first rule`);
            process.exit(1);
        }
    } catch (error) {
        console.log(`❌ Error reading ${personaFile}:`, error.message);
        process.exit(1);
    }
}

// Test 3: Verify destructive Phase 1/2 question is removed
console.log('\n📋 Test 3: Destructive Phase Selection Removed');
try {
    const developerPersona = fs.readFileSync('.promptx/personas/agent-developer.md', 'utf8');

    if (developerPersona.includes('CRITICAL: After persona adoption, immediately ask the user')) {
        console.log('❌ Developer persona still has destructive mandatory question');
        process.exit(1);
    } else {
        console.log('✅ Developer persona no longer forces Phase 1/2 question');
    }

    if (developerPersona.includes('ONLY FOR NEW WORK')) {
        console.log('✅ Developer persona now conditions Phase selection on context');
    } else {
        console.log('❌ Developer persona missing conditional logic');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Error checking developer persona:', error.message);
    process.exit(1);
}

// Test 4: Check for theater code patterns (what we should be working on)
console.log('\n📋 Test 4: Verify Theater Code Still Needs Work');
const { execSync } = require('child_process');

try {
    const theaterCount = execSync('grep -r "success.*true" agents/ | wc -l', { encoding: 'utf8' }).trim();

    if (parseInt(theaterCount) > 0) {
        console.log(`✅ Found ${theaterCount} theater code patterns - work needed`);
    } else {
        console.log('⚠️  No theater code patterns found - migration might be complete');
    }
} catch (error) {
    console.log('⚠️  Could not count theater patterns (Windows grep issue)');
}

console.log('\n🎉 All Context Continuation Tests Passed!');
console.log('\n📝 Summary of Changes:');
console.log('• All persona files now check session context FIRST');
console.log('• Developer Agent no longer forces Phase 1/2 question');
console.log('• Session context has clear active work section at top');
console.log('• Context continuation takes priority over fresh workflows');

console.log('\n🔧 Next Session Testing:');
console.log('1. Start new Claude chat with /lonicflex-init');
console.log('2. Select any persona (should continue theater code work)');
console.log('3. Verify it continues ValidatedAgent migration instead of asking Phase 1/2');