const { App } = require('@slack/bolt');
require('dotenv').config();

async function testSocketMode() {
  console.log('🔌 Testing Socket Mode configuration...\n');
  
  console.log('Environment check:');
  console.log(`SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN?.substring(0, 15)}...`);
  console.log(`SLACK_APP_TOKEN: ${process.env.SLACK_APP_TOKEN?.substring(0, 15)}...`);
  console.log(`SLACK_SIGNING_SECRET: ${process.env.SLACK_SIGNING_SECRET?.substring(0, 8)}...`);
  
  try {
    // Create app with Socket Mode
    const app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: true,
      appToken: process.env.SLACK_APP_TOKEN,
      port: process.env.PORT || 3000
    });
    
    console.log('\n✅ Slack App created successfully with Socket Mode');
    
    // Add a simple event listener to test connection
    app.message('hello', async ({ message, say }) => {
      console.log('📩 Message received:', message.text);
      await say('Hello! Claude Multi-Agent System is connected!');
    });
    
    console.log('🎯 Event listener added for "hello" messages');
    
    // Try to start the app
    console.log('\n🚀 Attempting to start Socket Mode connection...');
    
    // Set a timeout for the connection attempt
    const startPromise = app.start();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000);
    });
    
    await Promise.race([startPromise, timeoutPromise]);
    
    console.log('✅ Socket Mode connection established successfully!');
    console.log('🎉 Slack integration is now fully operational!');
    console.log('\nYou can now:');
    console.log('   • Use /claude-agent commands in Slack');
    console.log('   • @mention the bot for natural language workflows');
    console.log('   • Get real-time progress updates');
    
  } catch (error) {
    console.error('❌ Socket Mode test failed:', error.message);
    
    if (error.message.includes('invalid_auth')) {
      console.log('\n🔍 Troubleshooting steps:');
      console.log('1. Check if Socket Mode is enabled in your Slack app settings');
      console.log('2. Verify the App Token has "connections:write" scope');
      console.log('3. Make sure you reinstalled the app after adding scopes');
      console.log('4. Try regenerating the App Token');
    }
  }
}

testSocketMode();