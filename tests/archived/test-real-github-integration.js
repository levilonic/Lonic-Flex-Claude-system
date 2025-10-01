#!/usr/bin/env node
/**
 * Test REAL GitHub Integration
 *
 * This test verifies that we can actually connect to GitHub and perform operations
 * using the real GitHub API, not mocks.
 */

require('dotenv').config();
const { SimplifiedExternalCoordinator } = require('../../integrations/external-integrations/simplified-external-coordinator');

async function testRealGitHubIntegration() {
    console.log('🔧 Testing REAL GitHub Integration');
    console.log('=' .repeat(50));

    try {
        console.log('\n🚀 1. Initialize External Coordinator with real GitHub token...');
        const coordinator = new SimplifiedExternalCoordinator({
            enableGitHub: true,
            enableSlack: false, // Disable Slack for this test
            github: {
                token: process.env.GITHUB_TOKEN,
                owner: process.env.GITHUB_OWNER || 'levilonic',
                repo: process.env.GITHUB_REPO || 'Lonic-Flex-Claude-system',
                autoCreateBranch: true
            }
        });

        const initResult = await coordinator.initialize();

        console.log('   Results:');
        console.log(`   ✅ GitHub initialized: ${initResult.results.github.initialized}`);
        console.log(`   📍 Repository: ${coordinator.config.github.owner}/${coordinator.config.github.repo}`);

        if (!initResult.results.github.initialized) {
            console.log('❌ GitHub initialization failed:', initResult.results.github.error);
            return false;
        }

        console.log('\n🌿 2. Test creating a REAL GitHub branch...');
        const testContextData = {
            contextId: `test-real-github-${Date.now()}`,
            contextType: 'test',
            task: 'Testing real GitHub integration',
            metadata: {
                testMode: true,
                timestamp: new Date().toISOString()
            }
        };

        const contextResult = await coordinator.onContextCreated(testContextData);

        console.log('   Results:');
        console.log(`   ✅ Context setup successful: ${contextResult.summary.success}`);
        console.log(`   🌿 Branches created: ${contextResult.github.resources.length}`);

        if (contextResult.github.resources.length > 0) {
            const branch = contextResult.github.resources[0];
            console.log(`   📍 Branch URL: ${branch.url}`);
            console.log(`   🏷️  Branch name: ${branch.name}`);
            console.log('\n🎉 SUCCESS: Real GitHub branch created!');
            return true;
        } else {
            console.log('❌ No GitHub branch was created');
            console.log('   Errors:', contextResult.github.errors);
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        return false;
    }
}

async function testRealSlackIntegration() {
    console.log('\n💬 Testing REAL Slack Integration');
    console.log('=' .repeat(50));

    try {
        console.log('\n🚀 1. Initialize External Coordinator with real Slack token...');
        const coordinator = new SimplifiedExternalCoordinator({
            enableGitHub: false, // Disable GitHub for this test
            enableSlack: true,
            slack: {
                token: process.env.SLACK_BOT_TOKEN,
                channel: '#all-lonixflex', // Use the correct channel
                autoNotify: true
            }
        });

        const initResult = await coordinator.initialize();

        console.log('   Results:');
        console.log(`   ✅ Slack initialized: ${initResult.results.slack.initialized}`);
        console.log(`   📍 Channel: ${coordinator.config.slack.channel}`);

        if (!initResult.results.slack.initialized) {
            console.log('❌ Slack initialization failed:', initResult.results.slack.error);
            return false;
        }

        console.log('\n💬 2. Test sending a REAL Slack message...');
        const testContextData = {
            contextId: `test-real-slack-${Date.now()}`,
            contextType: 'test',
            task: 'Testing real Slack integration',
            metadata: {
                testMode: true,
                timestamp: new Date().toISOString()
            }
        };

        const contextResult = await coordinator.onContextCreated(testContextData);

        console.log('   Results:');
        console.log(`   ✅ Context setup successful: ${contextResult.summary.success}`);
        console.log(`   💬 Messages sent: ${contextResult.slack.notifications.length}`);

        if (contextResult.slack.notifications.length > 0) {
            const notification = contextResult.slack.notifications[0];
            console.log(`   📍 Message sent to: ${notification.channel}`);
            console.log(`   🕐 Timestamp: ${notification.ts}`);
            console.log('\n🎉 SUCCESS: Real Slack message sent!');
            return true;
        } else {
            console.log('❌ No Slack message was sent');
            console.log('   Errors:', contextResult.slack.errors);
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        return false;
    }
}

async function main() {
    console.log('🧪 REAL EXTERNAL SYSTEM INTEGRATION TESTS');
    console.log('Testing actual GitHub and Slack API connections (not mocks)');

    const githubSuccess = await testRealGitHubIntegration();
    const slackSuccess = await testRealSlackIntegration();

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS:');
    console.log(`   GitHub Integration: ${githubSuccess ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`   Slack Integration: ${slackSuccess ? '✅ WORKING' : '❌ FAILED'}`);

    if (githubSuccess && slackSuccess) {
        console.log('\n🎉 ALL EXTERNAL INTEGRATIONS ARE WORKING!');
        console.log('   The autonomous AI organization can now:');
        console.log('   • Create actual GitHub branches for projects');
        console.log('   • Send real Slack notifications to your team');
        console.log('   • Coordinate across platforms automatically');
        return true;
    } else {
        console.log('\n⚠️  Some external integrations are not working properly.');
        console.log('   Check your .env file for valid API tokens.');
        return false;
    }
}

// Run the test if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Critical test error:', error);
        process.exit(1);
    });
}

module.exports = { testRealGitHubIntegration, testRealSlackIntegration };