/**
 * PM2 Ecosystem Configuration for LonicFLex Services
 * Only includes production-ready services that actually exist
 *
 * All 13 services tested and verified (see tests/services/)
 */

module.exports = {
  apps: [
    // ==========================================
    // CORE INFRASTRUCTURE SERVICES
    // ==========================================

    // Master Service - /lx run coordinator
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
        SERVICE_NAME: 'lonicflex-master',
        PORT: 3007
      },
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      log_file: './logs/lonicflex-master.log',
      out_file: './logs/lonicflex-master-out.log',
      error_file: './logs/lonicflex-master-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      health_check_http: 'http://localhost:3007/health',
      node_args: ['--max-old-space-size=512']
    },

    // Webhook Service - Event coordination
    {
      name: 'lonicflex-webhook',
      script: '../src/services/lonicflex-webhook-service.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        SERVICE_NAME: 'lonicflex-webhook',
        PORT: 3008
      },
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      log_file: './logs/lonicflex-webhook.log',
      out_file: './logs/lonicflex-webhook-out.log',
      error_file: './logs/lonicflex-webhook-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      health_check_http: 'http://localhost:3008/health',
      node_args: ['--max-old-space-size=512']
    },

    // Workflows Service - Pipeline orchestration
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
      node_args: ['--max-old-space-size=512']
    },

    // Health Service - Monitoring
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
      node_args: ['--max-old-space-size=256']
    },

    // Integration Hub - Cross-service coordination
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
      node_args: ['--max-old-space-size=1024']
    },

    // Permissions Service - RBAC
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
      node_args: ['--max-old-space-size=1024']
    },

    // ==========================================
    // EXTERNAL INTEGRATION SERVICES
    // ==========================================

    // GitHub Integration
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
      node_args: ['--max-old-space-size=512']
    },

    // Slack Integration
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
      node_args: ['--max-old-space-size=512']
    },

    // GitLab Integration
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
      node_args: ['--max-old-space-size=512']
    },

    // Jira Integration
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
        SERVICE_NAME: 'lonicflex-jira',
        PORT: 3021
      },
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      log_file: './logs/lonicflex-jira.log',
      out_file: './logs/lonicflex-jira-out.log',
      error_file: './logs/lonicflex-jira-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      health_check_http: 'http://localhost:3021/health',
      node_args: ['--max-old-space-size=512']
    },

    // ServiceNow Integration
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
        SERVICE_NAME: 'lonicflex-servicenow',
        PORT: 3022
      },
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      log_file: './logs/lonicflex-servicenow.log',
      out_file: './logs/lonicflex-servicenow-out.log',
      error_file: './logs/lonicflex-servicenow-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      health_check_http: 'http://localhost:3022/health',
      node_args: ['--max-old-space-size=512']
    },

    // Linear Integration
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
      node_args: ['--max-old-space-size=512']
    },

    // Jenkins Integration
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
      node_args: ['--max-old-space-size=512']
    }
  ]
};
