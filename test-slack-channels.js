const { WebClient } = require('@slack/web-api');
require('dotenv').config();

async function testSlackChannels() {
  console.log('🔍 Discovering available Slack channels...\n');
  
  const web = new WebClient(process.env.SLACK_BOT_TOKEN);
  
  try {
    // Get list of channels
    console.log('1. Fetching public channels...');
    const channelsResult = await web.conversations.list({
      types: 'public_channel'
    });
    
    console.log(`✅ Found ${channelsResult.channels.length} public channels:`);
    channelsResult.channels.forEach(channel => {
      console.log(`   • #${channel.name} (${channel.id}) - ${channel.num_members} members`);
    });
    
    // Test bot permissions
    console.log('\n2. Testing bot permissions...');
    const botChannels = [];
    
    for (const channel of channelsResult.channels) {
      try {
        // Try to get channel info (tests if bot has access)
        await web.conversations.info({ channel: channel.id });
        botChannels.push(channel);
        console.log(`   ✅ #${channel.name} - Bot has access`);
      } catch (error) {
        console.log(`   ❌ #${channel.name} - No access (${error.message})`);
      }
    }
    
    // Find best default channel
    console.log('\n3. Recommending default channel...');
    let defaultChannel = botChannels[0]; // fallback
    
    const preferredNames = ['general', 'claude', 'bots', 'automation', 'notifications'];
    for (const name of preferredNames) {
      const found = botChannels.find(ch => ch.name === name);
      if (found) {
        defaultChannel = found;
        break;
      }
    }
    
    if (defaultChannel) {
      console.log(`✅ Recommended default channel: #${defaultChannel.name} (${defaultChannel.id})`);
      
      // Test sending a message
      console.log('\n4. Testing message sending...');
      const testResult = await web.chat.postMessage({
        channel: defaultChannel.id,
        text: '🤖 Test message from Claude Multi-Agent System - Slack integration working!'
      });
      
      console.log(`✅ Test message sent successfully! (ts: ${testResult.ts})`);
      
      return {
        success: true,
        defaultChannel: `#${defaultChannel.name}`,
        defaultChannelId: defaultChannel.id,
        availableChannels: botChannels.map(ch => ({ name: ch.name, id: ch.id })),
        totalChannels: channelsResult.channels.length
      };
      
    } else {
      console.log('❌ No accessible channels found');
      return { success: false, error: 'No accessible channels' };
    }
    
  } catch (error) {
    console.error('❌ Channel discovery failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the test
testSlackChannels().then(result => {
  console.log('\n📊 Channel Discovery Results:');
  console.log(JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log(`\n✅ Slack channel integration ready!`);
    console.log(`   Use channel: ${result.defaultChannel}`);
    console.log(`   Channel ID: ${result.defaultChannelId}`);
  } else {
    console.log('\n❌ Slack integration needs channel setup');
  }
}).catch(console.error);