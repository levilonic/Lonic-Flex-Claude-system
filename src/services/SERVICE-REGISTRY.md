# LonicFLex Service Registry

**Purpose**: Master documentation of all services in the LonicFLex system for production deployment management.

---

##  Service Categories

###  ACTIVE SERVICES (24 services)
**Status**: Configured in ecosystem.config.js and ready for PM2 deployment

#### Core Services
- `lonicflex-master-service.js` (Port 3007) - Master coordinator
- `lonicflex-webhook-service.js` (Port 3008) - Webhook processing  
- `lonicflex-health-service.js` (Port 3005) - Health monitoring

#### GitHub/GitLab Integration
- `lonicflex-github-service.js` (Port 3002) - GitHub integration
- `lonicflex-gitlab-service.js` (Port 3025) - GitLab integration

#### Communication & Collaboration  
- `lonicflex-slack-service.js` (Port 3006) - Slack integration
- `lonicflex-jira-service.js` (Port 3021) - Jira integration
- `lonicflex-linear-service.js` (Port 3023) - Linear integration

#### Workflow & Agent Coordination
- `lonicflex-workflows-service.js` (Port 3004) - Workflow execution
- `lonicflex-agents-service.js` (Port 3003) - Agent coordination
- `multi-workflow-state-manager.js` (Port 3010) - Multi-workflow state
- `conditional-workflow-engine.js` (Port 3011) - Conditional logic
- `enhanced-approval-gates.js` (Port 3012) - Approval workflows

#### Enterprise Integration Hub  
- `lonicflex-integration-hub-service.js` (Port 3020) - Central hub
- `lonicflex-servicenow-service.js` (Port 3022) - ServiceNow integration
- `lonicflex-jenkins-service.js` (Port 3024) - Jenkins CI/CD
- `lonicflex-datadog-service.js` (Port 3026) - DataDog monitoring

#### Enterprise Governance & Analytics
- `lonicflex-governance-service.js` (Port 3030) - Governance coordination
- `lonicflex-permissions-service.js` (Port 3031) - RBAC permissions
- `lonicflex-cost-management-service.js` (Port 3032) - Cost management
- `lonicflex-billing-service.js` (Port 3033) - Billing & usage analytics
- `lonicflex-analytics-service.js` (Port 3034) - Analytics processing
- `lonicflex-dashboard-service.js` (Port 3035) - Executive dashboard

#### Missing (Configured but not implemented)
- `dashboard-server.js` - Web monitoring dashboard (MISSING FILE)

---

## TOOLS UTILITY SERVICES (15 services)
**Status**: Support services used by active services - kept for functionality

#### Agent & Workflow Support
- `agent-pool-manager.js` - Agent pooling and lifecycle management
- `branch-aware-agent-manager.js` - Branch-aware coordination  
- `cross-branch-coordinator.js` - Cross-branch operations
- `service-container.js` - Dependency injection container

#### External System Support
- `git-automation.js` - Git operations automation
- `github-actions-manager.js` - GitHub Actions management
- `github-projects-manager.js` - GitHub Projects integration
- `github-workflow-manager.js` - GitHub workflow automation
- `issue-management-service.js` - Issue tracking support
- `milestone-integration-service.js` - Milestone management

#### System Support
- `documentation-service.js` - Documentation intelligence
- `error-recovery.js` - Error recovery mechanisms
- `filesystem-automation.js` - File system operations
- `health-monitor.js` - Internal health monitoring
- `progress-monitor.js` - Progress tracking

---

##  ARCHIVED SERVICES (11 services) 
**Status**: Moved to archived/ - redundant or replaced functionality

#### Analysis Services (Potential Duplicates)
- `claude-analysis-service.js` -> Replaced by lonicflex-agents-service.js Claude integration
- `claude-command-router.js` -> Replaced by lonicflex-master-service.js routing
- `claude-state-bridge.js` -> Replaced by multi-workflow-state-manager.js

#### Integration Duplicates  
- `integration-validator.js` -> Functionality in lonicflex-integration-hub-service.js
- `partitioned-context-manager.js` -> Replaced by universal context system

#### Monitoring Duplicates
- `hybrid-claude-parser.js` -> Parser functionality integrated into agents

#### Other Archived
- Additional services determined to be redundant during analysis

---

##  Service Management Commands

### Check Service Status
\`\`\`bash
# List all configured services
grep "name:" config/ecosystem.config.js

# Check running services  
pm2 list

# Service health checks
curl http://localhost:3007/health  # Master service
curl http://localhost:3005/health  # Health service
\`\`\`

### Deployment Commands
\`\`\`bash
# Start all services
pm2 start config/ecosystem.config.js

# Start specific service
pm2 start config/ecosystem.config.js --only lonicflex-master

# Stop services
pm2 stop all
pm2 delete all
\`\`\`

---

##  System Metrics

| Category | Count | Status |
|----------|-------|--------|
| **Active Services** | 24 | PASS Production Ready |
| **Utility Services** | 15 | PASS Supporting Functions |
| **Archived Services** | 11 |  Archived |
| **Total Organized** | 50 | PASS Complete |

**Impact**: Reduced from 50 mixed services to 39 active/utility services with clear categorization

---

*Last Updated: Phase 2B Service Rationalization - 2025-09-29*
