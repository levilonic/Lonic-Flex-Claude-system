/**
 * PM2 Ecosystem Configuration for LonicFLex Autonomous Execution Service
 * Enables production-ready background service management
 */

module.exports = {
  apps: [
    // Master Command System - /lx run processor
    {
      name: 'lonicflex-master',
      script: 'services/lonicflex-master-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'master',
        SERVICE_NAME: 'lonicflex-master',
        PORT: 3007
      },

      // Service configuration
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      // Logging
      log_file: './logs/lonicflex-master.log',
      out_file: './logs/lonicflex-master-out.log',
      error_file: './logs/lonicflex-master-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Health monitoring
      health_check_http: 'http://localhost:3007/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // Webhook Coordination Service
    {
      name: 'lonicflex-webhooks',
      script: 'services/lonicflex-webhook-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'webhooks',
        SERVICE_NAME: 'lonicflex-webhooks',
        PORT: 3008
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-webhooks.log',
      out_file: './logs/lonicflex-webhooks-out.log',
      error_file: './logs/lonicflex-webhooks-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3008/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // GitHub Integration Service
    {
      name: 'lonicflex-github',
      script: 'services/lonicflex-github-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'github',
        SERVICE_NAME: 'lonicflex-github',
        PORT: 3002
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-github.log',
      out_file: './logs/lonicflex-github-out.log',
      error_file: './logs/lonicflex-github-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3002/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // Slack Integration Service
    {
      name: 'lonicflex-slack',
      script: 'services/lonicflex-slack-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'slack',
        SERVICE_NAME: 'lonicflex-slack',
        PORT: 3006
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-slack.log',
      out_file: './logs/lonicflex-slack-out.log',
      error_file: './logs/lonicflex-slack-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // Multi-Agent Coordination Service
    {
      name: 'lonicflex-agents',
      script: 'services/lonicflex-agents-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'agents',
        SERVICE_NAME: 'lonicflex-agents',
        PORT: 3003
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-agents.log',
      out_file: './logs/lonicflex-agents-out.log',
      error_file: './logs/lonicflex-agents-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3003/health',
      node_args: ['--max-old-space-size=1024', '--optimize-for-size']
    },

    // Workflow Orchestration Service
    {
      name: 'lonicflex-workflows',
      script: 'services/lonicflex-workflows-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'workflows',
        SERVICE_NAME: 'lonicflex-workflows',
        PORT: 3004
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-workflows.log',
      out_file: './logs/lonicflex-workflows-out.log',
      error_file: './logs/lonicflex-workflows-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3004/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // Health Monitoring Service
    {
      name: 'lonicflex-health',
      script: 'services/lonicflex-health-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'health',
        SERVICE_NAME: 'lonicflex-health',
        PORT: 3005
      },

      min_uptime: '10s',
      max_restarts: 10, // Health monitor should be extra resilient
      restart_delay: 2000,

      log_file: './logs/lonicflex-health.log',
      out_file: './logs/lonicflex-health-out.log',
      error_file: './logs/lonicflex-health-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3005/health',
      node_args: ['--max-old-space-size=256', '--optimize-for-size']
    },
    
    // Web dashboard for monitoring (optional - DISABLED: monitoring/dashboard-server.js doesn't exist)
    /*
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
    },
    */

    // ==========================================
    // WINDOW 1: ENTERPRISE MULTI-WORKFLOW STATE MANAGEMENT SERVICES
    // ==========================================

    // Enhanced Multi-Workflow State Manager
    {
      name: 'lonicflex-multi-workflow-state',
      script: 'services/multi-workflow-state-manager.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'multi-workflow-state',
        SERVICE_NAME: 'lonicflex-multi-workflow-state',
        PORT: 3010
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-multi-workflow-state.log',
      out_file: './logs/lonicflex-multi-workflow-state-out.log',
      error_file: './logs/lonicflex-multi-workflow-state-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3010/health',
      node_args: ['--max-old-space-size=1024', '--optimize-for-size']
    },

    // Conditional Workflow Logic Engine
    {
      name: 'lonicflex-conditional-workflow',
      script: 'services/conditional-workflow-engine.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'conditional-workflow',
        SERVICE_NAME: 'lonicflex-conditional-workflow',
        PORT: 3011
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-conditional-workflow.log',
      out_file: './logs/lonicflex-conditional-workflow-out.log',
      error_file: './logs/lonicflex-conditional-workflow-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3011/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // Enhanced Approval Gates Coordinator
    {
      name: 'lonicflex-approval-gates',
      script: 'services/enhanced-approval-gates.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'approval-gates',
        SERVICE_NAME: 'lonicflex-approval-gates',
        PORT: 3012
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-approval-gates.log',
      out_file: './logs/lonicflex-approval-gates-out.log',
      error_file: './logs/lonicflex-approval-gates-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3012/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
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