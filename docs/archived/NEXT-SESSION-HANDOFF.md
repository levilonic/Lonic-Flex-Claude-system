# NEXT SESSION HANDOFF - PM2 SERVICES SURGICAL FIX

## SESSION CONTEXT
**Date**: 2025-09-28
**Phase**: Surgical Fix Preparation Complete
**Status**: Ready to execute PM2 services architecture repair

## CRITICAL DISCOVERY
**ROOT CAUSE IDENTIFIED**: 27 PM2 services are each creating their own `SQLiteManager` and `Factor3ContextManager` instances instead of using the shared `ServiceContainer`, causing:
- Database lock conflicts (27 services fighting over 1 SQLite file)
- Port collisions during PM2 restarts
- Memory duplication and resource waste
- Circular dependency issues

## PROVEN WORKING SYSTEM
**File**: `claude-multi-agent-core.js` (425 lines)
- ✅ All 3 workflows functional (minimal, security-scan, github-check)
- ✅ Uses `systemStartup.getServiceContainer()` for shared resources
- ✅ Agents receive ServiceContainer via dependency injection
- ✅ Single SQLiteManager instance, no conflicts

## BROKEN PATTERN VS CORRECT PATTERN

### BROKEN (Current - 27 services do this):
```javascript
// In service constructor:
this.db = new SQLiteManager();              // ❌ CREATES OWN INSTANCE
this.contextManager = new Factor3ContextManager(); // ❌ COMPETING RESOURCE
```

### CORRECT (Target pattern):
```javascript
// In service constructor:
this.serviceContainer = null;               // ✅ WILL RECEIVE SHARED CONTAINER

// In initialize():
this.serviceContainer = await getSharedServiceContainer();
this.db = this.serviceContainer.getService('database');     // ✅ SHARED INSTANCE
this.contextManager = this.serviceContainer.getService('contextManager'); // ✅ SHARED
```

## FILES REQUIRING SURGICAL FIX

### High Priority (Core functionality):
1. `services/lonicflex-master-service.js` - Run coordination (Port 3007)
2. `services/lonicflex-agents-service.js` - Agent management (Port 3003)
3. `services/lonicflex-workflows-service.js` - Workflow execution (Port 3004)
4. `services/lonicflex-health-service.js` - Health monitoring (Port 3005)

### Medium Priority (External integrations):
- `services/lonicflex-github-service.js` - GitHub API (Port 3002)
- `services/lonicflex-slack-service.js` - Slack integration (Port 3006)
- `services/lonicflex-webhook-service.js` - Webhook handling

### Ecosystem:
- `ecosystem.config.js` - 20+ services defined with port assignments

## WORKING SERVICECONTAINER EXISTS
**File**: `services/service-container.js`
- Creates ONE SQLiteManager instance (lines 43-44)
- Provides shared services to prevent resource duplication
- Integration: Working system uses this via `systemStartup.initialize()`

## NEXT SESSION EXECUTION PLAN

### Phase 1: Start with Master Service
1. **Fix `lonicflex-master-service.js`** first
2. **Replace** `this.db = new SQLiteManager()` with ServiceContainer usage
3. **Test** single service starts without errors
4. **Verify** shared database access works

### Phase 2: Systematic Service Repair
1. **Apply same pattern** to agents, workflows, health services
2. **Test each service** individually before moving to next
3. **Fix circular dependencies** (agents-service importing core)

### Phase 3: Integration Testing
1. **Start all services** via PM2
2. **Verify** no port conflicts or database locks
3. **Test** inter-service communication
4. **Validate** all HTTP endpoints functional

## SUCCESS CRITERIA
- ✅ All PM2 services start without EADDRINUSE errors
- ✅ Services use shared database via ServiceContainer
- ✅ No resource conflicts or competing instances
- ✅ Maintain existing HTTP API endpoints
- ✅ Preserve service boundaries and specialization

## CRITICAL FILES PRESERVED
- `claude-multi-agent-core.js` - Working main system
- `system-startup.js` - ServiceContainer initialization
- `services/service-container.js` - Dependency injection pattern
- `factor3-context-manager.js` - Context management
- `12-factor-compliance-tracker.js` - Compliance tracking
- `ecosystem.config.js` - PM2 service definitions

## ARCHITECTURAL VISION
**Goal**: Maintain 20+ service architecture but fix resource sharing
**Approach**: Surgical repair of dependency injection
**Preserve**: Service boundaries and external integrations
**Fix**: Shared database and context management
**Result**: Production-ready microservices architecture

---
**READY FOR SURGICAL FIX EXECUTION**