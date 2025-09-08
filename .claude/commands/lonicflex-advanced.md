---
description: Advanced LonicFLex architecture patterns and development concepts
allowed-tools: Read(C:\Users\Levi\Desktop\LonicFLex\**)
---

# LonicFLex Advanced - Architecture & Development Patterns

**Prerequisites**: Complete `/lonicflex-init` and `/lonicflex-details` first

## 🏗️ ADVANCED ARCHITECTURE PATTERNS

### Multi-Agent Coordination Engine
**File**: `claude-multi-agent-core.js`  
**Pattern**: Sequential execution with state handoff
```javascript
// Agent execution flow
const workflow = ['github', 'security', 'code', 'deploy'];
for (const agentName of workflow) {
    const result = await this.executeAgent(agentName, context);
    context = { ...context, ...result.handoffContext };
}
```

### BaseAgent Extension Pattern
**Template**: All agents extend BaseAgent for consistency
```javascript
class SpecializedAgent extends BaseAgent {
    constructor(sessionId, config) {
        super('agent-name', sessionId, config);
        this.executionSteps = ['step1', 'step2', ...]; // Max 8
    }
    
    async executeWorkflow(context, progressCallback) {
        // Implementation follows Factor 10 principles
    }
}
```

### Memory-Driven Learning System
**Pattern**: Agents learn from execution patterns
```javascript
// Success pattern recording
await this.memoryManager.recordPattern(
    'success',
    { agent: this.agentName, context },
    'action_taken',
    'successful_outcome',
    confidenceScore
);

// Mistake lesson recording  
await this.memoryManager.recordLesson(
    'mistake',
    this.agentName,
    'What went wrong',
    'Prevention rule',
    'verification_command'
);
```

## 🔧 DEVELOPMENT PATTERNS

### Error Handling (Factor 9: Compact Errors)
```javascript
// Compact error handling with Factor 9 compliance
try {
    const result = await this.execute();
} catch (error) {
    const compactError = this.compliance.handleError(error, {
        agent: this.agentName,
        step: this.currentStep
    });
    
    await this.updateProgress(this.progress, `error: ${compactError.message}`, 'failed');
    throw error;
}
```

### State Management (Factor 12: Stateless Reducer)
```javascript
// Pure state transitions
applyStateTransition(currentState, event, data = {}) {
    return this.compliance.applyStateTransition(currentState, event, {
        ...data,
        agent: this.agentName,
        timestamp: Date.now()
    });
}
```

### Context Management (Factor 3: Own Your Context Window)
```javascript  
// XML context generation for efficient token usage
generateHandoffContext() {
    return {
        from_agent: this.agentName,
        result: this.result,
        context_xml: this.contextManager.getCurrentContext(),
        execution_summary: {
            steps_completed: this.executionSteps.length,
            final_state: this.state,
            success: this.state === 'completed'
        }
    };
}
```

## 📊 DATABASE PATTERNS

### Session Management
```sql
-- Session with metadata tracking
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    workflow_type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER,
    metadata TEXT
);
```

### Agent State Persistence (Factor 5)
```sql  
-- Unified execution state
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    agent_name TEXT NOT NULL,
    status TEXT DEFAULT 'idle',
    progress INTEGER DEFAULT 0,
    current_step TEXT,
    result TEXT,
    error TEXT,
    config TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### Event Sourcing Pattern
```sql
-- Complete audit trail
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_id TEXT,
    event_type TEXT NOT NULL,
    event_data TEXT,
    timestamp INTEGER DEFAULT (strftime('%s', 'now'))
);
```

## 🐳 DOCKER DEPLOYMENT PATTERNS

### Real Infrastructure Deployment (Post-Theatre)
**Pattern**: Replace all `setTimeout()` with real operations
```javascript
// BEFORE (theatre):
await new Promise(resolve => setTimeout(resolve, 2000));
return { fake: 'result' };

// AFTER (real):
const result = await this.dockerManager.buildAgentImage(agentType, buildContext);
return { actual: result };
```

### Health Check Patterns
```javascript
// Real HTTP health checks with retry logic
async waitForReadiness(instances, timeout = 60000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        let allReady = true;
        for (const instance of instances) {
            const response = await axios.get(`${instance.endpoint}/health`);
            if (response.status !== 200) allReady = false;
        }
        if (allReady) return true;
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error(`Instances not ready after ${timeout}ms`);
}
```

## 🧠 ADVANCED MEMORY PATTERNS

### Verification Command Mapping
```javascript
const taskVerificationMap = new Map([
    ['Multi-Agent Core', 'node claude-multi-agent-core.js 2>&1 | grep "🤖 Executing real agent"'],
    ['Database operations', 'npm run demo-db 2>&1 | grep "✅ Database initialized"'],
    ['Agent functionality', 'npm run demo-base-agent 2>&1 | grep "✅.*completed"']
]);
```

### Anti-Bullshit Verification System
```javascript  
async verifyTaskCompletion(taskId, claimedStatus, verificationCommand) {
    const result = await this.executeCommand(verificationCommand);
    const verifiedStatus = result.exitCode === 0 && !result.output.includes('❌') 
        ? 'completed' : 'failed';
    const discrepancy = (claimedStatus !== verifiedStatus);
    
    if (discrepancy) {
        await this.recordLesson('mistake', agentName, 
            `False claim: "${taskId}" claimed "${claimedStatus}" but verified "${verifiedStatus}"`);
    }
    
    return { taskId, claimed: claimedStatus, verified: verifiedStatus, discrepancy };
}
```

## 🔄 INTEGRATION PATTERNS

### API Authentication Pattern
```javascript
class AuthManager {
    async validateAgent(agentName) {
        const tokens = await this.loadTokens();
        const requiredTokens = this.getRequiredTokensForAgent(agentName);
        
        for (const tokenName of requiredTokens) {
            if (!tokens[tokenName]) {
                throw new Error(`${tokenName} not configured for ${agentName}`);
            }
        }
        
        return tokens;
    }
}
```

### External API Integration
```javascript
// GitHub API pattern with rate limiting
async makeGitHubRequest(endpoint, options = {}) {
    const response = await this.octokit.request(endpoint, options);
    
    // Log API usage for rate limiting
    await this.logEvent('github_api_call', {
        endpoint,
        rate_limit_remaining: response.headers['x-ratelimit-remaining']
    });
    
    return response.data;
}
```

## 📈 PERFORMANCE OPTIMIZATION

### Context Caching (Factor 3)
- Hot cache: Active workflow context
- Warm cache: Recent session data  
- Cold storage: Historical patterns
- Eviction: LRU with usage patterns

### Database Optimization
- WAL mode for concurrent access
- Prepared statements for repeated queries
- Connection pooling for multi-agent scenarios
- Indexed queries for session/agent lookups

## 🔒 SECURITY PATTERNS

### Input Validation
```javascript
validateAgentInput(input) {
    // Sanitize commands to prevent injection
    const sanitized = input.replace(/[;&|`$(){}[\]]/g, '');
    if (sanitized !== input) {
        throw new Error('Invalid characters in agent input');
    }
    return sanitized;
}
```

### Resource Locking  
```javascript
// Prevent race conditions between agents
async executeWithLock(resourceName, operation) {
    const acquired = await this.acquireResourceLock(resourceName);
    if (!acquired) throw new Error(`Resource ${resourceName} locked`);
    
    try {
        return await operation();
    } finally {
        await this.releaseResourceLock(resourceName);
    }
}
```

## 🎯 ADVANCED DEBUGGING

### Trace Analysis
```bash
# Follow agent execution
npm run demo 2>&1 | grep -E "(Agent|Progress|Error)"

# Memory system analysis  
npm run verify-all 2>&1 | grep -E "(VERIFIED|DISCREPANCY)"

# Database state inspection
sqlite3 database/claude-agents.db ".dump sessions"
```

### Performance Profiling
- Agent execution timing
- Database query performance
- Memory usage patterns
- API response times

**Next Level**: Master these patterns to build robust, scalable agent systems following 12-factor principles.