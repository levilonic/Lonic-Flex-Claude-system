const { Octokit } = require('@octokit/rest');
require('dotenv').config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function testGitHubAPI() {
  try {
    console.log('🔗 Testing GitHub API connectivity...');
    const { data: user } = await octokit.users.getAuthenticated();
    console.log('✅ GitHub API connected successfully!');
    console.log(`   User: ${user.login}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Public repos: ${user.public_repos}`);
    
    const { data: rateLimit } = await octokit.rateLimit.get();
    console.log(`   Core rate limit: ${rateLimit.resources.core.remaining}/${rateLimit.resources.core.limit}`);
    
    // Test webhook secret configuration
    console.log('\n🔐 Webhook configuration:');
    console.log(`   Secret configured: ${process.env.GITHUB_WEBHOOK_SECRET ? 'YES' : 'NO'}`);
    console.log(`   Secret length: ${process.env.GITHUB_WEBHOOK_SECRET?.length || 0} characters`);
    
  } catch (error) {
    console.error('❌ GitHub API test failed:', error.message);
  }
}

testGitHubAPI();