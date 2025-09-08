# LonicFLex API Reference

## Overview

LonicFLex Multi-Agent System API provides endpoints for managing and orchestrating AI agents following the 12-Factor methodology.

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All API endpoints require authentication via API key in the Authorization header:
```
Authorization: Bearer your-api-key
```

---

## Core Endpoints

### Multi-Agent Core

#### Initialize Session
```http
POST /api/v1/sessions
```

Creates a new agent session for workflow execution.

**Request Body:**
```json
{
  "workflowType": "bug_fix|deployment|security_scan|code_review|integration|communication",
  "context": {
    "repository": "string",
    "branch": "string",
    "environment": "development|staging|production",
    "priority": "low|medium|high|critical"
  }
}
```

**Response:**
```json
{
  "sessionId": "string",
  "status": "initialized",
  "workflowType": "string",
  "timestamp": "2025-09-04T00:00:00.000Z",
  "agents": ["github", "code", "security", "deploy", "comm", "base"]
}
```

#### Execute Workflow
```http
POST /api/v1/sessions/{sessionId}/execute
```

Executes the workflow for a given session.

**Response:**
```json
{
  "sessionId": "string",
  "status": "completed|failed|in_progress",
  "results": {
    "agentResults": {},
    "finalContext": "string",
    "duration": "number"
  },
  "timestamp": "2025-09-04T00:00:00.000Z"
}
```

#### Get Session Status
```http
GET /api/v1/sessions/{sessionId}
```

**Response:**
```json
{
  "sessionId": "string",
  "status": "initialized|running|completed|failed",
  "workflowType": "string",
  "progress": {
    "currentAgent": "string",
    "completedSteps": "number",
    "totalSteps": "number"
  },
  "created": "2025-09-04T00:00:00.000Z",
  "updated": "2025-09-04T00:00:00.000Z"
}
```

---

## Agent Management

### Individual Agents

#### GitHub Agent
```http
POST /api/v1/agents/github/execute
```

**Request Body:**
```json
{
  "action": "create_pr|merge_pr|create_issue|update_status",
  "repository": "string",
  "data": {
    "title": "string",
    "body": "string",
    "branch": "string"
  }
}
```

#### Security Agent
```http
POST /api/v1/agents/security/scan
```

**Request Body:**
```json
{
  "target": "repository|container|configuration",
  "scanType": "vulnerability|dependency|code_quality",
  "options": {
    "severity": "low|medium|high|critical",
    "reportFormat": "json|html|pdf"
  }
}
```

#### Deploy Agent
```http
POST /api/v1/agents/deploy/execute
```

**Request Body:**
```json
{
  "environment": "development|staging|production",
  "strategy": "rolling|blue-green|canary|recreate",
  "config": {
    "replicas": "number",
    "healthcheck": "boolean",
    "rollback": "boolean"
  }
}
```

---

## Integration APIs

### Slack Integration

#### Send Message
```http
POST /api/v1/integrations/slack/message
```

**Request Body:**
```json
{
  "channel": "string",
  "message": "string",
  "user": "string",
  "attachments": [
    {
      "title": "string",
      "text": "string",
      "color": "good|warning|danger"
    }
  ]
}
```

#### Execute Slash Command
```http
POST /api/v1/integrations/slack/command
```

**Request Body:**
```json
{
  "command": "/claude-agent|/deploy|/security-scan",
  "parameters": "string",
  "user": "string",
  "channel": "string"
}
```

### GitHub Webhooks

#### Process Webhook
```http
POST /api/v1/integrations/github/webhook
```

**Headers:**
```
X-GitHub-Event: push|pull_request|issues|release
X-Hub-Signature-256: sha256=signature
```

**Request Body:** GitHub webhook payload

---

## Monitoring & Metrics

### System Metrics
```http
GET /api/v1/metrics
```

**Query Parameters:**
- `category`: system|agents|database|slack|github
- `timeRange`: milliseconds (default: 3600000)

**Response:**
```json
{
  "system": [
    {
      "timestamp": 1725408000000,
      "memory": {
        "rss": 52428800,
        "heapTotal": 16777216,
        "heapUsed": 10485760,
        "percentage": 62.5
      },
      "cpu": {
        "user": 1000000,
        "system": 500000
      },
      "uptime": 3600
    }
  ]
}
```

### Alerts
```http
GET /api/v1/alerts
```

**Query Parameters:**
- `status`: active|resolved|acknowledged
- `timeRange`: milliseconds (default: 86400000)

**Response:**
```json
[
  {
    "id": "alert_1725408000000",
    "type": "high_memory",
    "message": "Memory usage exceeds threshold",
    "data": {
      "current": 87.5,
      "threshold": 85
    },
    "timestamp": 1725408000000,
    "status": "active"
  }
]
```

### Health Check
```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "uptime": 3600,
  "memory": {
    "rss": 52428800,
    "heapTotal": 16777216,
    "heapUsed": 10485760
  },
  "services": {
    "database": "healthy",
    "slack": "healthy",
    "github": "healthy",
    "docker": "healthy"
  },
  "timestamp": 1725408000000
}
```

---

## Configuration Management

### Get Configuration
```http
GET /api/v1/config
```

**Response:**
```json
{
  "environment": "development",
  "agents": {
    "github": { "enabled": true, "timeout": 30000 },
    "security": { "enabled": true, "scanners": ["npm", "docker"] }
  },
  "integrations": {
    "slack": { "enabled": true, "webhook_url": "..." },
    "github": { "enabled": true, "api_url": "..." }
  },
  "compliance": {
    "score": 100,
    "factors": 12
  }
}
```

### Update Configuration
```http
PUT /api/v1/config
```

**Request Body:** Configuration object (partial updates supported)

---

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": "string",
    "timestamp": "2025-09-04T00:00:00.000Z",
    "requestId": "string"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Rate Limited
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable

---

## Rate Limiting

All endpoints are rate limited:
- **Standard**: 1000 requests/hour per API key
- **Webhooks**: 10000 requests/hour per endpoint
- **Monitoring**: 100 requests/minute per API key

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1725411600
```

---

## WebSocket API

### Real-time Events
```
ws://localhost:3000/ws
```

Subscribe to real-time events:

**Connection:**
```json
{
  "type": "subscribe",
  "events": ["agent.started", "agent.completed", "alert.triggered", "metrics.updated"]
}
```

**Event Format:**
```json
{
  "type": "agent.completed",
  "sessionId": "string",
  "agentName": "string",
  "data": {},
  "timestamp": "2025-09-04T00:00:00.000Z"
}
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const LonicFlexAPI = require('@lonicflex/api-client');

const client = new LonicFlexAPI({
  baseURL: 'http://localhost:3000/api/v1',
  apiKey: 'your-api-key'
});

// Initialize session
const session = await client.sessions.create({
  workflowType: 'bug_fix',
  context: {
    repository: 'myorg/myrepo',
    branch: 'main'
  }
});

// Execute workflow
const result = await client.sessions.execute(session.sessionId);
```

### Python
```python
from lonicflex import LonicFlexAPI

client = LonicFlexAPI(
    base_url='http://localhost:3000/api/v1',
    api_key='your-api-key'
)

# Initialize session
session = client.sessions.create({
    'workflowType': 'deployment',
    'context': {
        'environment': 'production',
        'strategy': 'blue-green'
    }
})

# Execute workflow
result = client.sessions.execute(session['sessionId'])
```

---

## Testing

### Test Endpoints
```http
POST /api/v1/test/simulate
```

Simulate agent workflows for testing purposes.

**Request Body:**
```json
{
  "scenario": "success|failure|timeout",
  "agents": ["github", "security"],
  "duration": 5000
}
```

---

## Versioning

The API uses semantic versioning. Current version: **v1.0.0**

Version headers:
```
API-Version: 1.0.0
Accept-Version: 1.x
```

---

## Support

- **Documentation**: `/docs`
- **OpenAPI Spec**: `/api/v1/openapi.json`
- **Health Dashboard**: `/dashboard`
- **Issues**: GitHub Issues
- **Email**: support@lonicflex.dev