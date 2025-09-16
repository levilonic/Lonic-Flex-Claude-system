# LonicFLex Documentation

## 📚 Documentation Overview

Welcome to the LonicFLex Multi-Agent System documentation. This system implements the 12-Factor Agents methodology with comprehensive integration capabilities.

## 📖 Available Documentation

### API Reference
- **[API Reference](./api-reference.md)** - Complete REST API documentation with endpoints, request/response formats, and examples

### Architecture Guides
- **[12-Factor Agents Methodology](./12-factor-agents.md)** - Core principles and implementation guide
- **[Agent Architecture](./agent-architecture.md)** - Individual agent design and coordination patterns
- **[Integration Guide](./integrations.md)** - Slack, GitHub, and external service integrations

### Deployment Guides  
- **[Production Deployment](./production-deployment.md)** - Complete production deployment guide
- **[Docker Configuration](./docker-guide.md)** - Container orchestration and deployment strategies
- **[CI/CD Pipeline](./cicd-guide.md)** - Automated testing and deployment workflows

### Operation Guides
- **[Monitoring Guide](./monitoring.md)** - Metrics, alerts, and dashboard configuration
- **[Security Guide](./security.md)** - Authentication, authorization, and security best practices
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

### Development Guides
- **[Getting Started](./getting-started.md)** - Quick start guide for development
- **[Configuration Guide](./configuration.md)** - Environment variables and settings
- **[Testing Guide](./testing.md)** - Unit, integration, and end-to-end testing

## 🚀 Quick Start

1. **Installation**
   ```bash
   npm install
   ```

2. **Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Initialize Database**
   ```bash
   npm run demo-db
   ```

4. **Start System**
   ```bash
   npm start
   ```

5. **Access Dashboard**
   ```
   http://localhost:3001
   ```

## 📋 Available Commands

### Core System
- `npm start` - Start multi-agent core system
- `npm run demo` - Run complete system demo
- `npm test` - Run test suite

### Individual Components
- `npm run demo-github-agent` - GitHub integration demo
- `npm run demo-security-agent` - Security scanning demo  
- `npm run demo-deploy-agent` - Deployment automation demo
- `npm run demo-slack-integration` - Slack bot demo
- `npm run demo-monitoring` - Monitoring system demo
- `npm run demo-dashboard` - Metrics dashboard demo

### Development Tools
- `npm run demo-testing-framework` - Run testing framework
- `npm run demo-config-manager` - Configuration management demo
- `npm run demo-error-handler` - Error handling demo

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LonicFLex Multi-Agent System             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Slack Bot     │  │  GitHub Webhook │  │  Dashboard   │ │
│  │   Integration   │  │    Handler      │  │   & API      │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                Multi-Agent Orchestrator                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │   GitHub    │ │  Security   │ │   Deploy    │ │  Code  │ │
│  │   Agent     │ │   Agent     │ │   Agent     │ │ Agent  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │    Comm     │ │    Base     │                            │
│  │   Agent     │ │   Agent     │                            │
│  └─────────────┘ └─────────────┘                            │
├─────────────────────────────────────────────────────────────┤
│        Infrastructure Services                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │  Database   │ │ Monitoring  │ │    Error    │ │ Config │ │
│  │  Manager    │ │   System    │ │   Handler   │ │Manager │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Configuration

### Environment Variables
```env
# Core Settings
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database
DB_PATH=./database/agents.db
DB_WAL_MODE=true

# Slack Integration
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-bot-token

# GitHub Integration  
GITHUB_TOKEN=your-github-token
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Docker
DOCKER_HOST=unix:///var/run/docker.sock
DOCKER_REGISTRY=docker.io

# Monitoring
MONITORING_ENABLED=true
METRICS_RETENTION_DAYS=7
ALERT_WEBHOOK_URL=your-alert-webhook
```

### Agent Configuration
Each agent can be configured via `config/agents.json`:

```json
{
  "github": {
    "enabled": true,
    "timeout": 30000,
    "retries": 3,
    "apiUrl": "https://api.github.com"
  },
  "security": {
    "enabled": true,
    "scanners": ["npm", "docker", "snyk"],
    "severity": "medium"
  },
  "deploy": {
    "enabled": true,
    "strategies": ["rolling", "blue-green", "canary"],
    "healthCheckTimeout": 60000
  }
}
```

## 📊 Monitoring & Observability

### Metrics Dashboard
Access the real-time dashboard at `http://localhost:3001`

**Key Metrics:**
- System health (CPU, memory, uptime)
- Agent performance (success rate, response times)
- Integration status (Slack, GitHub)
- Database performance
- Error rates and alerts

### Log Management
```bash
# View system logs
tail -f logs/system.log

# View agent logs
tail -f logs/agents.log

# View monitoring logs  
tail -f logs/monitoring.log
```

### Alerts
The system monitors for:
- High memory usage (>85%)
- Agent failures (>3 failures)
- Slow response times (>5s)
- High error rates (>5%)
- Database connection issues

## 🔒 Security

### Authentication
- API key authentication for REST endpoints
- OAuth 2.0 for Slack integration
- GitHub webhook signature verification

### Authorization
Role-based access control with levels:
- **Viewer** - Read-only access
- **Operator** - Execute workflows
- **Developer** - Manage agents and configs
- **Admin** - Full system access

### Best Practices
- All secrets stored in environment variables
- Input validation and sanitization
- Rate limiting on all endpoints
- Audit logging for all actions
- Regular security scans

## 🧪 Testing

### Test Types
- **Unit Tests** - Individual component testing
- **Integration Tests** - Service interaction testing
- **End-to-End Tests** - Complete workflow testing
- **Performance Tests** - Load and stress testing
- **Security Tests** - Vulnerability scanning

### Running Tests
```bash
# All tests
npm test

# Specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:security
```

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check database file permissions
ls -la database/agents.db

# Reinitialize database
npm run demo-db
```

**Agent Startup Failures**
```bash
# Check system logs
tail -f logs/system.log

# Verify configuration
npm run demo-config-manager
```

**Integration Issues**
```bash
# Test Slack connection
npm run demo-slack-integration

# Test GitHub webhook
npm run demo-github-webhook
```

### Debug Mode
```bash
DEBUG=* npm start
```

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/humanlayer/12-factor-agents/issues)
- **Discussions**: [GitHub Discussions](https://github.com/humanlayer/12-factor-agents/discussions)
- **Documentation**: This documentation directory
- **Email**: support@lonicflex.dev

## 📜 License

Apache-2.0 License. See [LICENSE](../LICENSE) file for details.

---

*Last updated: September 4, 2025*