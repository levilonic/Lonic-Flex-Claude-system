// ecosystem.config.cjs
/**
 * Simple PM2 Configuration - JUST THE WORKING API SERVER
 * Reads all secrets and environment variables from .env
 */
// ecosystem.config.cjs
/**
 * Simple PM2 Configuration - JUST THE WORKING API SERVER
 * Reads all secrets and environment variables from .env
 */
require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'lonicflex-api',
      script: './src/working/api-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
        GITHUB_OWNER: process.env.GITHUB_OWNER || 'levilonic',
        GITHUB_REPO: process.env.GITHUB_REPO || 'Lonic-Flex-Claude-system'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
        GITHUB_OWNER: process.env.GITHUB_OWNER || 'levilonic',
        GITHUB_REPO: process.env.GITHUB_REPO || 'Lonic-Flex-Claude-system'
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-api.log',
      out_file: './logs/lonicflex-api-out.log',
      error_file: './logs/lonicflex-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3000/health',

      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    }
  ]
};
