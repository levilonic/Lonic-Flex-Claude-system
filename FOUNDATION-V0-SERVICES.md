# LonicFLex Foundation v0 - Service Documentation

**System Status**: 7/7 Services Operational
**Last Updated**: September 17, 2025

## Service Architecture Overview

LonicFLex Foundation v0 consists of 7 microservices running simultaneously to provide a complete development automation platform:

- **Master Service (3007)**: Command processing and run orchestration
- **Webhooks Service (3008)**: External event coordination
- **GitHub Service (3002)**: Repository and PR management
- **Slack Service (3006)**: Team communication and notifications
- **Agents Service (3003)**: Multi-agent workflow coordination
- **Workflows Service (3004)**: Template-based automation pipelines
- **Health Service (3005)**: System monitoring and health checks

## Service Details & REST APIs

### 🎯 Master Service - Port 3007
**Purpose**: Primary `/lx run` command processor and run orchestration

**Endpoints**:
- `GET /health` - Service health status
- `POST /lx/run` - Execute LonicFLex automation command
- `GET /run/:runId/status` - Get specific run status
- `GET /runs` - List active and recent runs
- `GET /stats` - Service statistics and metrics

**Status**: ✅ Operational - Ready to process automation commands

### 🔗 Webhooks Service - Port 3008
**Purpose**: GitHub and Slack webhook coordination

**Endpoints**:
- `GET /health` - Service health status
- `POST /webhook/github` - GitHub webhook handler
- `POST /webhook/slack` - Slack webhook handler

**Status**: ✅ Operational - Webhook endpoints configured

### 🐙 GitHub Service - Port 3002
**Purpose**: GitHub API integration and repository management

**Endpoints**:
- `GET /health` - Service health status
- `POST /branches/create` - Create new branch
- `GET /branches/list` - List repository branches
- `POST /prs/create` - Create pull request
- `GET /prs/list` - List pull requests
- `POST /issues/create` - Create GitHub issue
- `GET /repo/info` - Repository information
- `POST /coordinate` - Cross-service coordination

**Authentication**: ✅ Authenticated as `levilonic` with 4998 API calls remaining
**Status**: ✅ Operational - Full GitHub integration working

### 💬 Slack Service - Port 3006
**Purpose**: Slack bot integration and team notifications

**Configuration**:
- Bot Name: `lonicflex_bot`
- Connection: Socket Mode active
- Authentication: ✅ Connected

**Status**: ✅ Operational - Bot connected and ready for notifications

### 🤖 Agents Service - Port 3003
**Purpose**: Multi-agent coordination and workflow execution

**Endpoints**:
- `GET /health` - Service health status
- `POST /workflow/execute` - Execute agent workflow
- `GET /workflow/:id/status` - Get workflow status
- `POST /workflow/:id/cancel` - Cancel workflow
- `POST /agent/execute` - Execute individual agent
- `GET /agents/available` - List available agent types
- `GET /agents/registry` - Agent pool and capabilities
- `POST /coordinate` - Cross-service coordination

**Available Agent Types**: `github`, `security`, `code`, `deploy`, `comm`, `base`
**Status**: ✅ Operational - 6 agent types available, pool management active

### ⚙️ Workflows Service - Port 3004
**Purpose**: Template-based automation pipeline management

**Endpoints**:
- `GET /health` - Service health status
- `POST /execute` - Execute workflow
- `GET /:workflowId/status` - Get workflow status
- `POST /:workflowId/cancel` - Cancel workflow
- `GET /templates` - List available workflow templates
- `POST /templates` - Create new workflow template
- `POST /coordinate` - Cross-service coordination

**Available Templates**:
- `lonicflex-deploy` - Complete LonicFLex feature deployment
- `branch-management` - Create and manage development branches
- `health-check` - Comprehensive system health validation

**Status**: ✅ Operational - 3 workflow templates available

### 🏥 Health Service - Port 3005
**Purpose**: System monitoring and health coordination

**Monitoring**:
- Active health checks every 60 seconds
- Cross-service health validation
- Alert system operational

**Status**: ✅ Operational - Monitoring 6 services, 0 active alerts

## Port Configuration

```
3000, 3001: Docker Backend (reserved)
3002: GitHub Service ✅
3003: Agents Service ✅
3004: Workflows Service ✅
3005: Health Service ✅
3006: Slack Service ✅
3007: Master Service ✅
3008: Webhooks Service ✅
```

## Service Integration Flow

```
/lx run command → Master Service (3007)
                ↓
         Agents Service (3003) ← → Workflows Service (3004)
                ↓
         GitHub Service (3002) → Webhooks Service (3008)
                ↓
         Slack Service (3006) ← Health Service (3005)
```

## Cross-Service Communication

- **Health Monitoring**: Health Service actively monitors all other services
- **Agent Coordination**: Agents Service coordinates with Workflows for template execution
- **External Integration**: GitHub and Slack services handle external API integration
- **Event Processing**: Webhooks Service handles external events and triggers

## System Capabilities

### Automation Commands
- Execute `/lx run` commands through Master Service
- Automated branch creation and PR management
- Multi-agent workflow coordination
- Template-based pipeline execution

### External Integrations
- GitHub: Repository management, branch/PR operations, issue tracking
- Slack: Team notifications, bot interactions, rich messaging
- Webhooks: External event processing and coordination

### Monitoring & Health
- Real-time service health monitoring
- Cross-service dependency tracking
- Automated alerting and recovery
- Performance metrics and statistics

## Production Status

**Foundation v0 Complete**: ✅ All 7 services operational with full REST API functionality
**Ready for**: Live development automation workflows and `/lx run` commands
**Integration Status**: Cross-service communication established and validated