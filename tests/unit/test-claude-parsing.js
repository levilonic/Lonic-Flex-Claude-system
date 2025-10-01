#!/usr/bin/env node
/**
 * Test @claude command parsing functionality
 */

// Import the webhook service class
const { LonicFlexWebhookService } = require('../../src/services/lonicflex-webhook-service');

async function testClaudeCommandParsing() {
    console.log('🧪 Testing @claude Command Parsing\n');

    const webhookService = new LonicFlexWebhookService();

    // Test cases for @claude command parsing
    const testCases = [
        '@claude run health-check',
        '@claude deploy to staging',
        '@claude review this PR',
        '@claude run security-scan target=main',
        '@claude help',
        '@LonicFLex run full-test'
    ];

    console.log('📋 Test Cases:\n');

    for (const testText of testCases) {
        console.log(`Input: "${testText}"`);

        const command = webhookService.extractClaudeCommand(testText);

        if (command) {
            console.log('✅ Parsed Command:', command);
        } else {
            console.log('❌ No command extracted');
        }
        console.log('');
    }

    // Test mention processing logic
    console.log('🔍 Testing @claude Mention Processing:\n');

    const sampleMentionData = {
        type: 'issue',
        action: 'created',
        text: '@claude run health-check',
        repository: {
            name: 'Lonic-Flex-Claude-system',
            full_name: 'levilonic/Lonic-Flex-Claude-system'
        },
        issue: { number: 123 },
        comment: null
    };

    console.log('Sample mention data:');
    console.log(JSON.stringify(sampleMentionData, null, 2));

    try {
        // Test the processing logic (without actually calling services)
        const command = webhookService.extractClaudeCommand(sampleMentionData.text);

        if (command) {
            console.log('\n✅ Command extraction successful:');
            console.log('  Command:', command.command);
            console.log('  Parameters:', command.parameters);
            console.log('  Original text:', command.originalText);

            // Simulate workflow trigger data
            const workflowTrigger = {
                type: 'claude_mention',
                source: sampleMentionData.type,
                command: command.command,
                parameters: command.parameters,
                repository: sampleMentionData.repository.full_name,
                issue: sampleMentionData.issue ? sampleMentionData.issue.number : null,
                requester: 'testuser'
            };

            console.log('\n🎯 Generated Workflow Trigger:');
            console.log(JSON.stringify(workflowTrigger, null, 2));
        } else {
            console.log('\n❌ Command extraction failed');
        }

    } catch (error) {
        console.error('❌ Processing error:', error.message);
    }

    console.log('\n✅ @claude Command Parsing Test Complete!');
}

// Run test
if (require.main === module) {
    testClaudeCommandParsing().catch(console.error);
}

module.exports = { testClaudeCommandParsing };