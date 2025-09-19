# LonicFLex Governance Middleware Integration Guide

This guide shows how to integrate the Window 3 governance middleware with existing LonicFLex services.

## Quick Integration

Add governance middleware to any Express service with these simple steps:

### 1. Install the middleware

```javascript
const { createGovernanceMiddleware } = require('../middleware/governance-middleware');

// Add to your Express app
const governanceMiddleware = createGovernanceMiddleware({
    governanceServiceUrl: 'http://localhost:3030',
    permissionsServiceUrl: 'http://localhost:3031',
    costManagementServiceUrl: 'http://localhost:3032',
    enableAuditLogging: true,
    enableCostTracking: true,
    enablePolicyEnforcement: true
});

app.use(governanceMiddleware);
```

### 2. Example Integration for GitHub Service

```javascript
// In services/lonicflex-github-service.js
const express = require('express');
const { createGovernanceMiddleware } = require('../middleware/governance-middleware');

class LonicFlexGitHubService {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Add governance middleware BEFORE other middleware
        const governanceMiddleware = createGovernanceMiddleware({
            serviceId: 'lonicflex-github',
            enableAuditLogging: true,
            enableCostTracking: true
        });

        this.app.use(governanceMiddleware);

        // Continue with existing middleware...
        this.app.use(express.json());
        // ... rest of middleware
    }
}
```

### 3. Example Integration for Slack Service

```javascript
// In services/lonicflex-slack-service.js
const express = require('express');
const { createGovernanceMiddleware } = require('../middleware/governance-middleware');

class LonicFlexSlackService {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Governance middleware with Slack-specific settings
        const governanceMiddleware = createGovernanceMiddleware({
            serviceId: 'lonicflex-slack',
            enableRateLimiting: true, // Important for Slack API calls
            enableCostTracking: true,
            requestTimeout: 3000 // Faster timeout for real-time messaging
        });

        this.app.use(governanceMiddleware);

        // Existing middleware...
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }
}
```

## Service-Specific Configurations

### High-Volume Services (Analytics, DataDog)

```javascript
const governanceMiddleware = createGovernanceMiddleware({
    serviceId: 'lonicflex-analytics',
    enableCostTracking: true,
    enablePolicyEnforcement: false, // Disable for performance
    cacheTimeout: 600000, // Longer cache for better performance
    failOpen: true // Don't block on governance errors
});
```

### Security-Critical Services (Master, Webhooks)

```javascript
const governanceMiddleware = createGovernanceMiddleware({
    serviceId: 'lonicflex-master',
    enablePolicyEnforcement: true,
    enableAuditLogging: true,
    enableRateLimiting: true,
    failOpen: false // Block on governance errors
});
```

### External Integration Services (GitHub, Slack, Jira)

```javascript
const governanceMiddleware = createGovernanceMiddleware({
    serviceId: 'lonicflex-external',
    enableCostTracking: true,
    enableRateLimiting: true,
    requestTimeout: 5000 // Longer timeout for external APIs
});
```

## Headers for Governance Context

Services should pass governance context via headers:

```javascript
// Example: Making requests between services
const response = await axios.post('http://localhost:3002/github/repos', data, {
    headers: {
        'x-user-id': userId,
        'x-team-id': teamId,
        'x-role-id': roleId,
        'x-project-id': projectId,
        'x-service-id': 'lonicflex-workflows',
        'x-session-id': sessionId
    }
});
```

## Governance Bypass for Internal Operations

For internal service-to-service communication that should bypass governance:

```javascript
// Skip governance for health checks and internal operations
app.get('/health', (req, res) => {
    // Health checks bypass governance automatically
    res.json({ status: 'healthy' });
});

// For internal service calls, use bypass header
const internalResponse = await axios.post('http://localhost:3030/internal/sync', data, {
    headers: {
        'x-governance-bypass': 'internal-service-call',
        'x-service-id': 'lonicflex-workflows'
    }
});
```

## Integration Status Tracking

After integration, check governance middleware statistics:

```javascript
// Add stats endpoint to your service
app.get('/governance/stats', (req, res) => {
    if (req.governanceMiddleware) {
        res.json(req.governanceMiddleware.getStats());
    } else {
        res.json({ error: 'Governance middleware not available' });
    }
});
```

## Troubleshooting

### Common Issues

1. **Performance Impact**: Use appropriate caching and disable non-essential features for high-volume endpoints
2. **Service Availability**: Configure `failOpen: true` for non-critical governance checks
3. **Timeout Issues**: Adjust `requestTimeout` based on service requirements
4. **Cache Issues**: Clear caches during maintenance with `clearCaches()`

### Monitoring Integration

```javascript
// Monitor governance middleware performance
setInterval(() => {
    const stats = governanceMiddleware.getStats();
    console.log('Governance stats:', stats);

    // Alert on high violation rates
    if (stats.policyViolations > 100) {
        // Send alert to monitoring system
    }
}, 60000);
```

## Gradual Rollout Strategy

1. **Phase 1**: Enable governance middleware with `failOpen: true` and audit logging only
2. **Phase 2**: Enable cost tracking and basic policy enforcement
3. **Phase 3**: Enable rate limiting and full policy enforcement
4. **Phase 4**: Set `failOpen: false` for production governance enforcement

## Services Integration Checklist

- [ ] Master Service (lonicflex-master-service.js)
- [ ] Webhook Service (lonicflex-webhook-service.js)
- [ ] GitHub Service (lonicflex-github-service.js)
- [ ] Slack Service (lonicflex-slack-service.js)
- [ ] Agents Service (lonicflex-agents-service.js)
- [ ] Health Service (lonicflex-health-service.js)
- [ ] Workflows Service (lonicflex-workflows-service.js)
- [ ] Integration Hub Service (lonicflex-integration-hub-service.js)
- [ ] Jira Service (lonicflex-jira-service.js)
- [ ] ServiceNow Service (lonicflex-servicenow-service.js)
- [ ] Linear Service (lonicflex-linear-service.js)
- [ ] Jenkins Service (lonicflex-jenkins-service.js)
- [ ] GitLab Service (lonicflex-gitlab-service.js)
- [ ] DataDog Service (lonicflex-datadog-service.js) ✅ Enhanced
- [ ] Multi-Workflow State Service
- [ ] Cross System Integration Service
- [ ] Unified Command Service

**Window 3 Services** (Already integrated):
- ✅ Governance Service (lonicflex-governance-service.js)
- ✅ Permissions Service (lonicflex-permissions-service.js)
- ✅ Cost Management Service (lonicflex-cost-management-service.js)
- ✅ Billing Service (lonicflex-billing-service.js)
- ✅ Analytics Service (lonicflex-analytics-service.js)
- ✅ Dashboard Service (lonicflex-dashboard-service.js)

## Example Complete Integration

```javascript
const express = require('express');
const { createGovernanceMiddleware } = require('../middleware/governance-middleware');

class ExampleServiceWithGovernance {
    constructor() {
        this.app = express();
        this.setupGovernance();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupGovernance() {
        // Configure governance middleware
        this.governanceMiddleware = createGovernanceMiddleware({
            serviceId: 'example-service',
            enableAuditLogging: true,
            enableCostTracking: true,
            enablePolicyEnforcement: true,
            enableRateLimiting: true
        });

        // Apply governance middleware
        this.app.use(this.governanceMiddleware);
    }

    setupMiddleware() {
        this.app.use(express.json());
        // ... other middleware
    }

    setupRoutes() {
        // Routes automatically have governance applied
        this.app.get('/api/data', async (req, res) => {
            // req.governanceContext is available
            const { userId, teamId, projectId } = req.governanceContext;

            // Your business logic here
            res.json({ data: 'success' });
        });

        // Governance stats endpoint
        this.app.get('/governance/stats', (req, res) => {
            res.json(this.governanceMiddleware.getStats());
        });
    }
}
```

This integration provides comprehensive enterprise governance across all LonicFLex services while maintaining performance and reliability.