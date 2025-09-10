---
description: Save current project state with context preservation for future resumption
allowed-tools: Read(C:\Users\Levi\Desktop\LonicFLex\**), Write(C:\Users\Levi\Desktop\LonicFLex\**), Bash(*), Edit(*)
---

# Project Save - Preserve Project State

**SCENARIO**: Save current project session with intelligent context compression for future resumption, solving the "context window loss" problem.

**YOUR JOB**: Use LonicFLex ProjectAgent to preserve project state following enterprise context preservation patterns.

## 💾 Project Save Protocol

### Usage Patterns

**Save Current Project:**
```
/project-save
```

**Save with Status Update:**
```
/project-save --status="Completed user authentication module"
```

**Save with Importance Marking:**
```
/project-save --important --note="Critical architectural decision made"
```

**Save and Pause Project:**
```
/project-save --pause
```

## 🔧 Implementation Steps

### Step 1: Identify Current Project Context
```javascript
const { MultiAgentCore } = require('./claude-multi-agent-core');
const core = new MultiAgentCore();

// Get current session and linked project
const sessionId = process.env.CLAUDE_SESSION_ID || `session_${Date.now()}`;
const projectSession = await core.dbManager.getSQL(
    'SELECT * FROM project_sessions WHERE session_id = ? AND status = "active"',
    [sessionId]
);
```

### Step 2: Context Compression (Phenomena → Summary)
Use intelligent context compression following research patterns:

```javascript
// Get current Factor 3 context
const contextManager = core.contextManager;
const fullContext = contextManager.generateContextSummary();

// Compress using hybrid approach:
// - Recent messages: Keep last 20 in full
// - Older messages: Intelligent summarization
// - Key decisions: Preserve permanently (importance >= 8)
const compressedContext = {
    summary: fullContext.summary,
    recentMessages: fullContext.recent.slice(-20),
    keyDecisions: fullContext.events.filter(e => e.importance >= 8),
    timestamp: Date.now(),
    session_id: sessionId,
    compression_ratio: fullContext.total_tokens / estimatedCompressedTokens
};
```

### Step 3: Project State Preservation
```javascript
const projectAgent = core.activeAgents.get('project');
const result = await projectAgent.execute({
    action: 'save_project_state',
    projectId: projectSession.project_id,
    contextData: compressedContext,
    status: options.status || 'saved',
    importance: options.important ? 9 : 5
});
```

### Step 4: Add Context Items (High-Value Preservation)
```javascript
// Add important context items that should survive 3+ months
if (options.note) {
    await core.dbManager.addProjectContext(
        projectSession.project_id,
        'milestone',
        options.note,
        { 
            session_id: sessionId,
            save_timestamp: Date.now(),
            user_marked: true
        },
        options.important ? 9 : 6,
        sessionId
    );
}
```

### Step 5: Update PROJECT.md if Needed
```javascript
// Update project worldview (noumena) if significant changes
const projectDir = projectSession.project_dir;
const projectMdPath = path.join(projectDir, 'PROJECT.md');

if (options.status && options.important) {
    // Append to project notes section
    const projectMd = await fs.readFile(projectMdPath, 'utf8');
    const updatedMd = projectMd + `\n\n### Latest Update (${new Date().toISOString()})\n${options.status}`;
    await fs.writeFile(projectMdPath, updatedMd);
}
```

### Step 6: Handle Pause if Requested
```javascript
if (options.pause) {
    await core.dbManager.updateProjectStatus(
        projectSession.project_id, 
        'paused'
    );
    
    // Update project session
    await core.dbManager.runSQL(
        'UPDATE project_sessions SET status = "paused", completed_at = CURRENT_TIMESTAMP WHERE project_id = ? AND session_id = ?',
        [projectSession.project_id, sessionId]
    );
}
```

## 📊 Success Confirmation

**Standard Save:**
```
💾 Project Saved: {project-name}
📅 Saved At: {timestamp}
🔗 Session: {sessionId}
📊 Context Compressed: {compression_ratio}% 
💾 Preservation Level: {importance}/10
```

**Save with Pause:**
```
⏸️  Project Paused: {project-name}
💾 State Preserved: {context_items} items
📅 Can Resume: Anytime with /project-start {project-name} --resume
🎯 Last Status: {status}
```

**Important Milestone Save:**
```
⭐ Important Milestone Saved: {project-name}
📝 Note: {note}
🔒 Long-term Preserved: YES (survives 3+ months)
📈 Context Importance: 9/10
📄 PROJECT.md Updated: YES
```

## 🧠 Context Preservation Strategy

Following enterprise patterns and research findings:

### Immediate Context (Full Preservation)
- Last 20 chat messages
- Current session tasks and status
- Active todos and progress

### Compressed Context (Intelligent Summary)  
- Older chat history → key insights
- Technical decisions made
- Problems solved and solutions found
- Learning and discoveries

### Permanent Context (Long-term Preserved)
- Project goal and vision (noumena)
- Major architectural decisions
- User-marked important items
- Critical milestones and blockers

## 🔄 Cross-Session Continuity

When project is later resumed:
1. **Immediate Context**: Ready for immediate continuation  
2. **Compressed Context**: Available for reference and deep dives
3. **Permanent Context**: Always injected into new sessions
4. **Project Identity**: PROJECT.md provides consistent worldview

## 💡 Integration Notes

This command enables:
- **3+ Month Resumption**: Tested scenario for long-term project continuity
- **Context Window Independence**: No reliance on Claude chat memory
- **Intelligent Compression**: Balances completeness vs efficiency
- **Enterprise Patterns**: Follows database session management best practices

The save mechanism transforms ephemeral chat sessions into persistent, resumable project work environments.