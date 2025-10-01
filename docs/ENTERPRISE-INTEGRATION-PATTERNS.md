# Enterprise Integration Patterns

**Extracted from backups/console-conversion/ folder (2.8MB, 101 files)**
**Date**: October 1, 2025
**Status**: Architectural patterns preserved from console-conversion migration

---

## Purpose of This Document

During a major architectural refactoring ("console-conversion"), the project migrated from a "Heavy Agent Anti-Pattern" to ServiceContainer dependency injection. Before deleting the backup files (all functionality migrated to current codebase), this document preserves valuable integration patterns for future reference.

**Current Status**: All 17 enterprise services and 6 orchestration systems exist in `src/services/` and `src/core/` with improved architecture.

---

## 1. Enterprise Service Integration Pattern

### Architecture Pattern

**Common Structure** (all 17 services follow this):

```javascript
class LonicFlex[Service]Service {
    constructor(config = {}) {
        // Configuration with environment variable fallbacks
        this.config = {
            port: config.port || process.env.[SERVICE]_PORT || 3020,
            serviceName: 'lonicflex-[service]',
            apiUrl: config.apiUrl || process.env.[SERVICE]_URL,
            apiToken: config.apiToken || process.env.[SERVICE]_API_TOKEN,
            requestTimeout: config.requestTimeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            ...config
        };

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.contextManager = new Factor3ContextManager();

        // Service-specific state management with Maps
        this.resources = new Map();  // Efficient state tracking

        // Performance statistics
        this.stats = {
            resourcesCreated: 0,
            resourcesUpdated: 0,
            apiCalls: 0,
            failedCalls: 0,
            averageResponseTime: 0
        };

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: `./logs/lonicflex-[service].log`
                })
            ]
        });

        this.startTime = new Date();
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request timing and logging middleware
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.logger.info('Request completed', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration
                });

                // Rolling average response time calculation
                this.stats.averageResponseTime =
                    (this.stats.averageResponseTime + duration) / 2;
            });
            next();
        });
    }

    setupRoutes() {
        // Standard health check with detailed metrics
        this.app.get('/health', (req, res) => {
            const uptime = Date.now() - this.startTime.getTime();
            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime,
                initialized: true,
                authenticated: this.authenticated,
                stats: this.stats,
                resourceCount: this.resources.size
            });
        });

        // Status endpoint for monitoring
        this.app.get('/status', (req, res) => {
            res.json({
                service: this.config.serviceName,
                status: 'operational',
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                lastHealthCheck: new Date().toISOString()
            });
        });

        // Resource operations with evidence-based validation
        // ... service-specific endpoints
    }
}
```

### Key Patterns Identified

#### 1.1 Configuration Management
- Environment variable fallbacks for all sensitive data
- Timeout and retry configuration
- Port configuration per service (3020-3030 range)

#### 1.2 State Management
- Use of JavaScript `Map` for efficient resource tracking
- Statistics object for performance monitoring
- Rolling average calculations for response times

#### 1.3 Middleware Pattern
- Request timing middleware wraps all endpoints
- Automatic performance tracking
- Winston logger integration

#### 1.4 Health Monitoring
- Standardized `/health` endpoint with uptime tracking
- Resource count reporting
- Authentication status reporting
- Average response time metrics

---

## 2. Authentication Patterns by Service

### 2.1 ServiceNow - OAuth + Basic Auth

```javascript
// Priority: OAuth, fallback to Basic Auth
this.config = {
    instanceUrl: process.env.SERVICENOW_INSTANCE_URL,
    username: process.env.SERVICENOW_USERNAME,
    password: process.env.SERVICENOW_PASSWORD,
    clientId: process.env.SERVICENOW_CLIENT_ID,
    clientSecret: process.env.SERVICENOW_CLIENT_SECRET
};

// OAuth token management
this.authenticated = false;
this.accessToken = null;
this.tokenExpiry = null;

// Priority and urgency mappings
this.priorityMap = {
    'Critical': 1,
    'High': 2,
    'Moderate': 3,
    'Low': 4,
    'Planning': 5
};
```

**Use Cases**:
- Incident management
- Change request workflows
- Approval automation
- SLA tracking

---

### 2.2 JIRA - REST API v3 + API Token

```javascript
this.config = {
    jiraUrl: process.env.JIRA_URL || 'https://your-domain.atlassian.net',
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN,
    webhook: process.env.JIRA_WEBHOOK_SECRET,
    defaultProject: process.env.JIRA_DEFAULT_PROJECT || 'LONIC'
};

// State management
this.projects = new Map();      // projectKey -> project info
this.issues = new Map();        // issueKey -> issue data
this.webhookEvents = [];        // Recent webhook events
```

**Use Cases**:
- Issue creation and tracking
- Sprint management
- Webhook event handling
- Project coordination

---

### 2.3 Linear - GraphQL API + OAuth

```javascript
this.config = {
    apiUrl: 'https://api.linear.app/graphql',
    apiToken: process.env.LINEAR_API_TOKEN,
    webhookSecret: process.env.LINEAR_WEBHOOK_SECRET,
    defaultTeamId: process.env.LINEAR_DEFAULT_TEAM
};

// GraphQL-specific state
this.teams = new Map();
this.projects = new Map();
this.issues = new Map();
this.users = new Map();

// Rate limiting tracking
this.rateLimitRemaining = 1000;
this.rateLimitReset = null;
```

**Use Cases**:
- Modern issue tracking
- Real-time subscriptions
- Team management
- Timeline tracking

---

### 2.4 DataDog - HTTP API v1/v2 + API Keys

```javascript
this.config = {
    apiUrl: 'https://api.datadoghq.com',
    apiKey: process.env.DATADOG_API_KEY,
    appKey: process.env.DATADOG_APP_KEY
};

// Enterprise monitoring state
this.metrics = new Map();
this.dashboards = new Map();
this.monitors = new Map();
this.serviceHealth = new Map();
this.costMetrics = new Map();
this.governanceMetrics = new Map();
this.alertCorrelation = new Map();

// Enterprise-specific stats
this.stats = {
    metricsSubmitted: 0,
    logsSubmitted: 0,
    dashboardsCreated: 0,
    monitorsCreated: 0,
    alertsReceived: 0,
    servicesMonitored: 0,
    costAlertsTriggered: 0,
    governanceViolations: 0,
    resourceOptimizationSuggestions: 0
};
```

**Use Cases**:
- Infrastructure monitoring
- Cost tracking
- Governance compliance
- Performance baselines
- Alert correlation

---

### 2.5 Jenkins - REST API + User Token

```javascript
this.config = {
    jenkinsUrl: process.env.JENKINS_URL,
    username: process.env.JENKINS_USERNAME,
    apiToken: process.env.JENKINS_API_TOKEN
};

// Pipeline state
this.jobs = new Map();
this.builds = new Map();
this.nodes = new Map();
```

**Use Cases**:
- CI/CD pipeline management
- Build triggering
- Job monitoring
- Node management

---

### 2.6 GitLab - REST API + Personal Access Token

```javascript
this.config = {
    gitlabUrl: process.env.GITLAB_URL || 'https://gitlab.com',
    accessToken: process.env.GITLAB_ACCESS_TOKEN,
    defaultGroup: process.env.GITLAB_DEFAULT_GROUP
};

// Repository state
this.projects = new Map();
this.mergeRequests = new Map();
this.pipelines = new Map();
```

**Use Cases**:
- Merge request automation
- Pipeline management
- Repository coordination
- Group management

---

## 3. Rate Limiting and Retry Patterns

### 3.1 Exponential Backoff with Retry

```javascript
async makeApiCall(method, endpoint, data = null, retryCount = 0) {
    try {
        const response = await axios({
            method,
            url: `${this.config.apiUrl}${endpoint}`,
            headers: this.getAuthHeaders(),
            data,
            timeout: this.config.requestTimeout
        });

        this.stats.apiCalls++;
        return response.data;

    } catch (error) {
        this.stats.failedCalls++;

        // Retry logic with exponential backoff
        if (retryCount < this.config.retryAttempts) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            this.logger.warn(`API call failed, retrying in ${delay}ms`, {
                endpoint,
                retryCount: retryCount + 1,
                error: error.message
            });

            await new Promise(resolve => setTimeout(resolve, delay));
            return this.makeApiCall(method, endpoint, data, retryCount + 1);
        }

        throw error;
    }
}
```

### 3.2 Rate Limit Tracking (Linear Example)

```javascript
async executeGraphQLQuery(query, variables = {}) {
    // Check rate limit before making call
    if (this.rateLimitRemaining <= 10) {
        const waitTime = this.rateLimitReset - Date.now();
        if (waitTime > 0) {
            this.logger.warn(`Rate limit low, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    const response = await axios.post(this.config.apiUrl, {
        query,
        variables
    }, {
        headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json'
        }
    });

    // Update rate limit from response headers
    this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'] || 1000);
    this.rateLimitReset = parseInt(response.headers['x-ratelimit-reset'] || Date.now() + 60000);

    return response.data;
}
```

---

## 4. Webhook Handling Pattern

### 4.1 Webhook Verification and Processing

```javascript
setupWebhookEndpoint() {
    this.app.post('/webhooks', async (req, res) => {
        try {
            // Verify webhook signature
            const signature = req.headers['x-webhook-signature'];
            if (!this.verifyWebhookSignature(req.body, signature)) {
                this.logger.warn('Invalid webhook signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }

            // Process webhook event
            const event = req.body;
            this.webhookEvents.push({
                timestamp: new Date().toISOString(),
                type: event.type,
                data: event.data
            });

            // Maintain recent events only (last 100)
            if (this.webhookEvents.length > 100) {
                this.webhookEvents.shift();
            }

            this.stats.webhooksReceived++;

            // Emit event for processing
            this.emit('webhook_received', event);

            res.json({ success: true, received: true });

        } catch (error) {
            this.logger.error('Webhook processing failed', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });
}

verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const expected = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
    );
}
```

---

## 5. Evidence-Based Response Pattern

### 5.1 Validation Evidence in Responses

```javascript
this.app.post('/resources/create', async (req, res) => {
    try {
        const resource = await this.createResource(req.body);

        // Evidence-based validation
        const evidence = {
            resourceCreated: !!resource,
            resourceId: !!resource.id,
            resourceData: !!resource && typeof resource === 'object',
            apiCallSuccessful: true
        };

        const operationSuccess = evidence.resourceCreated && evidence.resourceId;

        res.json({
            success: operationSuccess,
            resource,
            message: `Resource ${resource.id} created successfully`,
            evidence: evidence  // Transparency for debugging
        });

    } catch (error) {
        this.logger.error('Resource creation failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
            evidence: {
                resourceCreated: false,
                apiCallSuccessful: false
            }
        });
    }
});
```

---

## 6. Multi-Agent Orchestration Patterns

### 6.1 Simultaneous Agent Coordination

**Pattern**: Collaborative agents work concurrently while coordinating through Universal Context

```javascript
const AGENT_STATES = {
    IDLE: 'idle',
    INITIALIZING: 'initializing',
    WORKING: 'working',
    WAITING: 'waiting',
    COORDINATING: 'coordinating',
    BLOCKED: 'blocked',
    COMPLETED: 'completed',
    ERROR: 'error'
};

const COORDINATION_MESSAGES = {
    REQUEST_HELP: 'request_help',
    OFFER_HELP: 'offer_help',
    SHARE_INSIGHT: 'share_insight',
    REPORT_PROGRESS: 'report_progress',
    REQUEST_RESOURCE: 'request_resource',
    RELEASE_RESOURCE: 'release_resource',
    COORDINATE_TASK: 'coordinate_task',
    RESOLVE_CONFLICT: 'resolve_conflict'
};

class CollaborativeAgent extends EventEmitter {
    constructor(baseAgent, workspace, roleAssignment) {
        super();

        this.state = AGENT_STATES.IDLE;
        this.currentTask = null;
        this.blockers = [];
        this.collaborations = new Map();
        this.insights = [];
        this.resourcesHeld = new Set();

        // Communication system
        this.messageQueue = [];
        this.waitingForResponse = new Map();
        this.collaborationHistory = [];
    }

    async startCollaborativeWork() {
        this.setState(AGENT_STATES.INITIALIZING);
        await this.initializeWithWorkspaceContext();

        this.setState(AGENT_STATES.WORKING);
        this.startWorkLoop();
        this.startCommunicationProcessing();
    }
}
```

### 6.2 Hierarchical-Distributed Hybrid Coordination

```javascript
class AdvancedAgentCoordinator extends EventEmitter {
    constructor(config = {}) {
        super();

        this.coordinationMode = config.coordinationMode || 'hybrid';

        // Core coordination components
        this.hierarchicalCoordinator = new HierarchicalCoordinator(this);
        this.distributedCoordinator = new DistributedCoordinator(this);
        this.consensusEngine = new ConsensusEngine(this);
        this.handoffManager = new AdvancedHandoffManager(this);

        // Decision-making framework
        this.decisionMatrix = new CoordinationDecisionMatrix();
        this.conflictResolver = new ConflictResolutionEngine();
    }
}
```

**Coordination Modes**:
- **Hierarchical**: Leader agent delegates tasks to subordinates
- **Distributed**: Peer-to-peer coordination without central authority
- **Hybrid**: Dynamic switching based on project requirements

---

## 7. ServiceContainer Migration Pattern

### 7.1 OLD Pattern (Heavy Agent Anti-Pattern)

```javascript
// BEFORE: Heavy Agent Anti-Pattern
class EnhancedCodeAgent {
    constructor(agentName, sessionId, config = {}) {
        this.agentName = agentName;
        this.sessionId = sessionId;

        // Agent creates its own dependencies (ANTI-PATTERN)
        this.db = new SQLiteManager();
        this.contextManager = new Factor3ContextManager();
        this.githubService = new GitHubService();
        this.slackService = new SlackService();

        // Context explosion: every agent duplicates services
    }
}
```

### 7.2 NEW Pattern (ServiceContainer Dependency Injection)

```javascript
// AFTER: ServiceContainer Dependency Injection
class EnhancedCodeAgent extends ValidatedAgent {
    constructor(sessionId, serviceContainer, config = {}) {
        super('code', sessionId, serviceContainer, {
            maxSteps: 8,
            timeout: 90000,
            ...config
        });

        // Services injected via container (CORRECT PATTERN)
        // this.serviceContainer.db
        // this.serviceContainer.contextManager
        // this.serviceContainer.githubService
        // this.serviceContainer.slackService

        // No duplication, shared resources, controlled lifecycle
    }
}
```

**Benefits**:
- Eliminates context explosion
- Prevents resource duplication
- Enables centralized service management
- Improves testability (mock injection)
- Facilitates lifecycle management

---

## 8. Integration Summary

### Services Implemented (All in `src/services/`)

| Service | Authentication | Primary Use Case | Key Features |
|---------|---------------|------------------|--------------|
| **ServiceNow** | OAuth/Basic | ITSM workflows | Incidents, changes, approvals, SLA |
| **JIRA** | API Token | Issue tracking | Issues, sprints, webhooks |
| **Linear** | GraphQL OAuth | Modern tracking | Real-time subscriptions, teams |
| **DataDog** | API Keys | Monitoring | Metrics, dashboards, alerts, costs |
| **Jenkins** | User Token | CI/CD | Jobs, builds, pipelines |
| **GitLab** | PAT | Repository | MRs, pipelines, groups |
| **GitHub** | OAuth/PAT | Repository | PRs, issues, actions |
| **Slack** | OAuth | Communication | Messages, channels, webhooks |
| **Analytics** | Internal | Metrics | Usage tracking, insights |
| **Billing** | Internal | Cost management | Usage tracking, invoicing |
| **Governance** | Internal | Compliance | Policy enforcement, audits |
| **Health** | Internal | System monitoring | Service health, dependencies |
| **Dashboard** | Internal | Visualization | Metrics display, reporting |
| **Webhooks** | Internal | Event routing | Cross-system coordination |
| **Workflows** | Internal | Automation | Multi-step processes |
| **Integration Hub** | Internal | Service coordination | Cross-system workflows |
| **Master Service** | Internal | System orchestration | Service management |

---

## 9. Key Takeaways

### What to Preserve
1. **Authentication patterns** - Each service has proven auth strategy
2. **Rate limiting** - Exponential backoff and retry logic
3. **Webhook verification** - Signature-based security
4. **Evidence-based responses** - Transparency in validation
5. **Performance tracking** - Rolling averages and statistics
6. **Microservice architecture** - Express-based service pattern
7. **Coordination patterns** - Multi-agent collaboration strategies

### What NOT to Do
1. **Heavy Agent Anti-Pattern** - Never instantiate dependencies in constructors
2. **Direct service coupling** - Always use ServiceContainer
3. **Missing retry logic** - Always implement exponential backoff
4. **Ignoring rate limits** - Track and respect API limits
5. **Unverified webhooks** - Always validate signatures
6. **Hardcoded credentials** - Use environment variables

---

## 10. Migration History

**Source**: `backups/console-conversion/` folder (2.8MB, 101 files)

**Status**: All functionality migrated to current codebase (`src/services/`, `src/core/`)

**Architectural Changes**:
- ServiceContainer dependency injection implemented ✅
- Heavy Agent Anti-Pattern eliminated ✅
- All 17 enterprise services operational ✅
- Advanced agent coordination operational ✅

**Files Preserved**: This documentation only - all code deleted after extraction

**Date**: October 1, 2025

---

*This document preserves architectural patterns from the console-conversion migration for future reference and knowledge transfer.*
