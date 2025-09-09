#!/usr/bin/env node

const { App } = require('@slack/bolt');
require('dotenv').config();

console.log('🔍 Testing Simple Slack App...');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000
});

// Simple slash command handler
app.command('/claude-agent', async ({ command, ack, respond, client }) => {
  console.log('📩 Received /claude-agent command:', command.text);
  
  // Acknowledge the command request
  await ack();
  
  try {
    await respond({
      text: `✅ Command received! Arguments: "${command.text}"`
    });
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error('❌ Error responding:', error);
    await respond({
      text: `❌ Error: ${error.message}`
    });
  }
});

// App mention handler
app.event('app_mention', async ({ event, client, logger }) => {
  console.log('📩 Received app mention:', event.text);
  
  try {
    await client.chat.postMessage({
      channel: event.channel,
      text: `👋 Hi there! You mentioned me: "${event.text}"`
    });
    console.log('✅ App mention response sent');
  } catch (error) {
    console.error('❌ Error responding to mention:', error);
  }
});

// Start the app
(async () => {
  try {
    await app.start();
    console.log('🚀 Simple Slack test app is running!');
    console.log('📱 Try these commands in Slack:');
    console.log('   • /claude-agent test');
    console.log('   • @claude_multiagent_sys hello');
  } catch (error) {
    console.error('❌ Failed to start app:', error);
  }
})();