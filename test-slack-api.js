const { WebClient } = require('@slack/web-api');
require('dotenv').config();

async function testSlackAPI() {
  console.log('🤖 Testing Slack API connectivity...\n');
  
  // Test Bot Token first
  console.log('1. Testing Bot Token...');
  const web = new WebClient(process.env.SLACK_BOT_TOKEN);
  
  try {
    const authResult = await web.auth.test();
    console.log('✅ Bot Token is valid!');
    console.log(`   User: ${authResult.user}`);
    console.log(`   User ID: ${authResult.user_id}`);
    console.log(`   Team: ${authResult.team}`);
    console.log(`   Team ID: ${authResult.team_id}`);
    console.log(`   URL: ${authResult.url}`);
    
    // Test getting team info
    console.log('\n2. Testing team information...');
    const teamInfo = await web.team.info();
    console.log('✅ Team info retrieved successfully!');
    console.log(`   Team name: ${teamInfo.team.name}`);
    console.log(`   Team domain: ${teamInfo.team.domain}`);
    
  } catch (error) {
    console.error('❌ Bot Token test failed:', error.message);
    return;
  }
  
  // Test App Token (for Socket Mode)
  console.log('\n3. Testing App Token for Socket Mode...');
  const { App } = require('@slack/bolt');
  
  try {
    const app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: false,  // Disable socket mode for this test
      appToken: process.env.SLACK_APP_TOKEN
    });
    
    console.log('✅ App configuration created successfully!');
    console.log('   Socket Mode: Disabled for testing');
    console.log('   Tokens configured: Bot + App + Signing Secret');
    
    console.log('\n🔍 Environment variables check:');
    console.log(`   SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN ? 'SET' : 'MISSING'} (${process.env.SLACK_BOT_TOKEN?.substring(0, 10)}...)`);
    console.log(`   SLACK_SIGNING_SECRET: ${process.env.SLACK_SIGNING_SECRET ? 'SET' : 'MISSING'} (${process.env.SLACK_SIGNING_SECRET?.length} chars)`);
    console.log(`   SLACK_APP_TOKEN: ${process.env.SLACK_APP_TOKEN ? 'SET' : 'MISSING'} (${process.env.SLACK_APP_TOKEN?.substring(0, 10)}...)`);
    
  } catch (error) {
    console.error('❌ App configuration failed:', error.message);
  }
}

testSlackAPI().catch(console.error);