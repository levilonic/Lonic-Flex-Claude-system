# LonicFLex Infrastructure Map

**Purpose**: Technical architecture overview, database schema, and system integration points

## 🗄️ DATABASE ARCHITECTURE

### SQLite Database (`database/sqlite-manager.js`)
**Status**: ✅ WORKING  
**Location**: `./database/claude-agents.db` (created dynamically)  
**Mode**: WAL (Write-Ahead Logging)

**Core Tables**:
```sql
-- Session tracking
sessions (id, workflow_type, status, created_at, completed_at, metadata)

-- Agent instances  
agents (id, session_id, agent_name, status, progress, current_step, result, error, config, created_at, updated_at)

-- Event logging
events (id, session_id, agent_id, event_type, event_data, timestamp)

-- Resource locking
resource_locks (id, resource_name, agent_id, session_id, expires_at, created_at)

-- Memory system tables
memory_lessons (id, lesson_type, agent_context, description, prevention_rule, verification_command, created_at)
memory_patterns (id, pattern_type, context_signature, action_taken, outcome, confidence_score, occurrence_count, created_at, last_seen)

-- Status verification (anti-bullshit system)
status_verifications (id, task_id, claimed_status, verified_status, verification_command, verification_output, discrepancy, agent_name, session_id, verification_timestamp)
```

**Indexes**: Optimized for agent queries, session lookups, event filtering

## 🐳 DOCKER ARCHITECTURE  

### Docker Infrastructure
**Status**: ❌ BROKEN (Engine not running)  
**Manager**: `claude-docker-manager.js`  
**Network**: `lonicflex-network`  
**Volume Prefix**: `lonicflex-deploy`

**Docker Compose Services** (`docker-compose.yml`):
```yaml
services:
  lonicflex:       # Main app (port 3000)
  redis:           # Caching (port 6379)  
  monitoring:      # Dashboard (port 3001)
  nginx:           # Load balancer (ports 80/443)
  backup:          # Database backup
  security:        # Security scanning
  performance:     # Performance optimization
  loki:            # Log aggregation (port 3100)
  prometheus:      # Metrics (port 9090)
  grafana:         # Dashboards (port 3002)
```

**Container Management**:
- Image building: `dockerManager.buildAgentImage()`
- Container deployment: `dockerManager.runContainer()`
- Health checks: HTTP GET `/health` endpoints
- Network isolation: Custom bridge network

## 🧠 MEMORY SYSTEM ARCHITECTURE

### Memory Manager (`memory/memory-manager.js`)
**Status**: ✅ WORKING  
**Features**: Lesson recording, pattern recognition, verification

**Key Functions**:
- `recordLesson(type, context, description, rule, command)`
- `verifyTaskCompletion(taskId, claimed, command, agent)`
- `recordPattern(type, context, action, outcome, confidence)`
- `executeCommand(command)` - Real shell execution

### Status Verifier (`memory/status-verifier.js`)  
**Status**: ✅ WORKING  
**Purpose**: Anti-bullshit verification system

**Verification Commands Map**:
- Multi-Agent Core: `grep "🤖 Executing real agent"`
- Database: `npm run demo-db | grep "✅ Database initialized"`
- Base Agent: `npm run demo-base-agent | grep "completed"`
- Individual agents: `npm run demo-*-agent` patterns

## 🔄 FACTOR 3 CONTEXT SYSTEM

### Context Manager (`factor3-context-manager.js`)
**Status**: ✅ WORKING  
**Purpose**: Anti-auto-compact XML context format

**XML Structure**:
```xml
<workflow_context>
  <event_type timestamp="ISO8601">
    {JSON data}
  </event_type>
</workflow_context>
```

**Integration**: Embedded in BaseAgent, prevents context window issues

## 🎯 MULTI-AGENT COORDINATION

### Core System (`claude-multi-agent-core.js`)
**Status**: ⚠️ PARTIAL (works until Docker step)  
**Workflow**: GitHub → Security → Code → Deploy

**Agent Creation Pattern**:
```javascript
const agents = {
  github: new GitHubAgent(sessionId),
  security: new SecurityAgent(sessionId), 
  code: new CodeAgent(sessionId),
  deploy: new DeployAgent(sessionId)
};
```

**Execution Flow**:
1. Initialize all agents with database
2. Execute sequentially with handoff context  
3. Each agent logs progress and results
4. Generate final workflow summary

## 🔐 AUTHENTICATION SYSTEM

### Auth Manager (`auth/auth-manager.js`)
**Status**: ⚠️ CONFIGURED (not fully tested)  
**Tokens Available**:
- ✅ GITHUB_TOKEN: `ghp_your_token_here`
- ✅ SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN
- ⚠️ API connectivity not verified

**Token Management**:
- Environment variable loading
- Encrypted config support (not used currently)  
- Validation and error reporting

## 📁 FILE STRUCTURE OVERVIEW

```
LonicFLex/
├── agents/              # Agent implementations
│   ├── base-agent.js    # ✅ Core agent class  
│   ├── deploy-agent.js  # ❌ Docker-dependent
│   ├── github-agent.js  # ⚠️ Unverified
│   └── [other-agents]   # ⚠️ Unverified
├── database/            # Data persistence
│   └── sqlite-manager.js # ✅ Working
├── memory/              # Learning system
│   ├── memory-manager.js    # ✅ Working  
│   └── status-verifier.js   # ✅ Working
├── auth/                # Authentication
│   └── auth-manager.js  # ⚠️ Configured
├── content/             # 12-factor documentation
├── .claude/commands/    # Slash commands
└── [core files]        # Multi-agent coordination
```

## 🔌 INTEGRATION POINTS

### Internal Integration
- **BaseAgent** → All specialized agents (inheritance)
- **SQLiteManager** → All agents (persistence)
- **MemoryManager** → BaseAgent (learning)
- **AuthManager** → API-dependent agents
- **DockerManager** → DeployAgent (broken)

### External Integration  
- **GitHub API** → GitHubAgent (configured, not tested)
- **Slack API** → CommAgent (configured, not tested)
- **Docker Engine** → DeployAgent (broken connection)
- **Claude API** → CodeAgent (unknown status)

## ⚡ PERFORMANCE CHARACTERISTICS

### Database Performance
- **SQLite WAL mode**: Concurrent read/write support
- **Connection pooling**: Single connection per agent
- **Indexing**: Optimized for common queries
- **Backup strategy**: Defined but not tested

### Memory Usage
- **Context caching**: Lessons and patterns cached  
- **Session management**: Clean agent lifecycle
- **Resource cleanup**: Proper disposal patterns

## 🚨 CRITICAL DEPENDENCIES

### Working Dependencies
- ✅ Node.js runtime
- ✅ NPM package ecosystem  
- ✅ File system access
- ✅ SQLite database engine

### Broken Dependencies
- ❌ Docker Engine (required for deployments)
- ❌ Docker network configuration

### Unknown Dependencies  
- ⚠️ External API connectivity
- ⚠️ Redis for caching (optional)
- ⚠️ Network access for webhooks

**SUMMARY**: Solid foundation with database and memory systems working, Docker infrastructure needs repair for full functionality.