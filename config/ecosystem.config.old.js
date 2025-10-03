/**
 * PM2 Ecosystem Configuration for LonicFLex Autonomous Execution Service
 * Enables production-ready background service management
 */

module.exports = {
  apps: [
    // Master Command System - /lx run processor
    {
      name: 'lonicflex-master',
      script: '../src/services/lonicflex-master-service.js',
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
      script: '../src/services/lonicflex-webhook-service.js',
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
      script: '../src/services/lonicflex-github-service.js',
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
      script: '../src/services/lonicflex-slack-service.js',
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
      script: '../src/services/lonicflex-agents-service.js',
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
      script: '../src/services/lonicflex-workflows-service.js',
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
      script: '../src/services/lonicflex-health-service.js',
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
      script: '../src/services/multi-workflow-state-manager.js',
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
      script: '../src/services/conditional-workflow-engine.js',
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
      script: '../src/services/enhanced-approval-gates.js',
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
    },

    // ==========================================
    // WINDOW 2: CROSS-SYSTEM INTEGRATION HUB SERVICES
    // ==========================================

    // Central Integration Hub Service
    {
      name: 'lonicflex-integration-hub',
      script: '../src/services/lonicflex-integration-hub-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'integration-hub',
        SERVICE_NAME: 'lonicflex-integration-hub',
        PORT: 3020
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-integration-hub.log',
      out_file: './logs/lonicflex-integration-hub-out.log',
      error_file: './logs/lonicflex-integration-hub-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3020/health',
      node_args: ['--max-old-space-size=1024', '--optimize-for-size']
    },

    // Jira Integration Service
    {
      name: 'lonicflex-jira',
      script: '../src/services/lonicflex-jira-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'jira-integration',
        SERVICE_NAME: 'lonicflex-jira',
        PORT: 3021,
        // Real configuration - services work without external APIs
        JIRA_URL: 'https://lonicflex-internal.atlassian.net',
        JIRA_EMAIL: 'system@lonicflex.local',
        JIRA_API_TOKEN: 'internal_system_token',
        JIRA_PROJECT: 'LONIC'
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-jira.log',
      out_file: './logs/lonicflex-jira-out.log',
      error_file: './logs/lonicflex-jira-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3021/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // ServiceNow Integration Service
    {
      name: 'lonicflex-servicenow',
      script: '../src/services/lonicflex-servicenow-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'servicenow-integration',
        SERVICE_NAME: 'lonicflex-servicenow',
        PORT: 3022,
        // Real ServiceNow API configuration
        SERVICENOW_INSTANCE_URL: 'https://dev212076.service-now.com',
        SERVICENOW_USERNAME: 'admin',
        SERVICENOW_PASSWORD: 'w*K6aS^atOI8'
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-servicenow.log',
      out_file: './logs/lonicflex-servicenow-out.log',
      error_file: './logs/lonicflex-servicenow-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3022/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // Linear Integration Service
    {
      name: 'lonicflex-linear',
      script: '../src/services/lonicflex-linear-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'linear-integration',
        SERVICE_NAME: 'lonicflex-linear',
        PORT: 3023
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-linear.log',
      out_file: './logs/lonicflex-linear-out.log',
      error_file: './logs/lonicflex-linear-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3023/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // Jenkins CI/CD Integration Service
    {
      name: 'lonicflex-jenkins',
      script: '../src/services/lonicflex-jenkins-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'jenkins-integration',
        SERVICE_NAME: 'lonicflex-jenkins',
        PORT: 3024
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-jenkins.log',
      out_file: './logs/lonicflex-jenkins-out.log',
      error_file: './logs/lonicflex-jenkins-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3024/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // GitLab Integration Service
    {
      name: 'lonicflex-gitlab',
      script: '../src/services/lonicflex-gitlab-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'gitlab-integration',
        SERVICE_NAME: 'lonicflex-gitlab',
        PORT: 3025
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-gitlab.log',
      out_file: './logs/lonicflex-gitlab-out.log',
      error_file: './logs/lonicflex-gitlab-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3025/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // DataDog Monitoring Integration Service
    {
      name: 'lonicflex-datadog',
      script: '../src/services/lonicflex-datadog-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'datadog-integration',
        SERVICE_NAME: 'lonicflex-datadog',
        PORT: 3026
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-datadog.log',
      out_file: './logs/lonicflex-datadog-out.log',
      error_file: './logs/lonicflex-datadog-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3026/health',
      node_args: ['--max-old-space-size=512', '--optimize-for-size']
    },

    // ===== WINDOW 3: ENTERPRISE GOVERNANCE & ANALYTICS SERVICES =====

    // Governance Coordination Service
    {
      name: 'lonicflex-governance',
      script: '../src/services/lonicflex-governance-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'governance',
        SERVICE_NAME: 'lonicflex-governance',
        PORT: 3030
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-governance.log',
      out_file: './logs/lonicflex-governance-out.log',
      error_file: './logs/lonicflex-governance-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3030/health',
      node_args: ['--max-old-space-size=1024', '--optimize-for-size']
    },

    // Permissions and RBAC Service
    {
      name: 'lonicflex-permissions',
      script: '../src/services/lonicflex-permissions-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'permissions',
        SERVICE_NAME: 'lonicflex-permissions',
        PORT: 3031
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-permissions.log',
      out_file: './logs/lonicflex-permissions-out.log',
      error_file: './logs/lonicflex-permissions-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3031/health',
      node_args: ['--max-old-space-size=1024', '--optimize-for-size']
    },

    // Cost Management Service
    {
      name: 'lonicflex-cost-management',
      script: '../src/services/lonicflex-cost-management-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'cost-management',
        SERVICE_NAME: 'lonicflex-cost-management',
        PORT: 3032
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-cost-management.log',
      out_file: './logs/lonicflex-cost-management-out.log',
      error_file: './logs/lonicflex-cost-management-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3032/health',
      node_args: ['--max-old-space-size=1024', '--optimize-for-size']
    },

    // Billing and Usage Analytics Service
    {
      name: 'lonicflex-billing',
      script: '../src/services/lonicflex-billing-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'billing',
        SERVICE_NAME: 'lonicflex-billing',
        PORT: 3033
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-billing.log',
      out_file: './logs/lonicflex-billing-out.log',
      error_file: './logs/lonicflex-billing-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3033/health',
      node_args: ['--max-old-space-size=1024', '--optimize-for-size']
    },

    // Analytics Processing Engine
    {
      name: 'lonicflex-analytics',
      script: '../src/services/lonicflex-analytics-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2048M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'analytics',
        SERVICE_NAME: 'lonicflex-analytics',
        PORT: 3034
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-analytics.log',
      out_file: './logs/lonicflex-analytics-out.log',
      error_file: './logs/lonicflex-analytics-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3034/health',
      node_args: ['--max-old-space-size=2048', '--optimize-for-size']
    },

    // Executive Dashboard Service
    {
      name: 'lonicflex-dashboard',
      script: '../src/services/lonicflex-dashboard-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LONICFLEX_MODE: 'dashboard',
        SERVICE_NAME: 'lonicflex-dashboard',
        PORT: 3035
      },

      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,

      log_file: './logs/lonicflex-dashboard.log',
      out_file: './logs/lonicflex-dashboard-out.log',
      error_file: './logs/lonicflex-dashboard-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      health_check_http: 'http://localhost:3035/health',
      node_args: ['--max-old-space-size=1024', '--optimize-for-size']
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