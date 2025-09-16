/**
 * PM2 Ecosystem Configuration for LonicFLex Autonomous Execution Service
 * Enables production-ready background service management
 */

module.exports = {
  apps: [
    {
      name: 'lonicflex-execution',
      script: 'claude-execution-service.js',
      args: 'autonomous-session',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G', // Phase 3: Reduced from 2G for better resource management
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'autonomous',
        SERVICE_NAME: 'lonicflex-execution'
      },
      env_development: {
        NODE_ENV: 'development',
        LONICFLEX_MODE: 'development'
      },
      
      // Service configuration
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      
      // Logging
      log_file: './logs/lonicflex-combined.log',
      out_file: './logs/lonicflex-out.log',
      error_file: './logs/lonicflex-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Advanced options
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      
      // Phase 3: Enhanced Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      health_check_http: 'http://localhost:3000/health',

      // Node.js optimization flags
      node_args: ['--max-old-space-size=1024', '--optimize-for-size']
    },
    
    // Web dashboard for monitoring (optional)
    {
      name: 'lonicflex-dashboard',
      script: './monitoring/dashboard-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DASHBOARD_MODE: true
      },
      
      // Logging
      log_file: './logs/dashboard-combined.log',
      out_file: './logs/dashboard-out.log',
      error_file: './logs/dashboard-error.log',
      
      // Only start if dashboard server exists
      ignore_watch: ['node_modules', 'logs', 'database'],
      max_memory_restart: '500M'
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'lonicflex',
      host: 'production-server',
      ref: 'origin/main',
      repo: 'git@github.com:user/lonicflex.git',
      path: '/var/www/lonicflex',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production'
      }
    },
    
    development: {
      user: 'developer',
      host: 'dev-server',
      ref: 'origin/develop',
      repo: 'git@github.com:user/lonicflex.git',
      path: '/var/www/lonicflex-dev',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development',
      env: {
        NODE_ENV: 'development'
      }
    }
  }
};