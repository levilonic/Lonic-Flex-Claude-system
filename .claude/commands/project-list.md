---
description: List all available projects with status and recent activity
allowed-tools: Read(C:\Users\Levi\Desktop\LonicFLex\**), Write(C:\Users\Levi\Desktop\LonicFLex\**), Bash(*), Edit(*)
---

# Project List - View All Project Windows

**SCENARIO**: Display all available project windows with their status, recent activity, and resumption information.

**YOUR JOB**: Use LonicFLex ProjectAgent to provide a clean, actionable overview of all project windows.

## 📋 Project List Protocol

### Usage Patterns

**List All Projects:**
```
/project-list
```

**Filter by Status:**
```
/project-list --active
/project-list --paused  
/project-list --completed
```

**Show Recent Projects Only:**
```
/project-list --recent 5
```

## 🔧 Implementation Steps

### Step 1: Initialize Multi-Agent System
```javascript
const { MultiAgentCore } = require('./claude-multi-agent-core');
const core = new MultiAgentCore();
await core.initialize();
```

### Step 2: Execute Project Listing
```javascript
const sessionId = `session_${Date.now()}`;
await core.initializeSession(sessionId, 'project-management', {
    action: 'list_projects'
});

const projectAgent = core.activeAgents.get('project');
const result = await projectAgent.execute({
    action: 'list_projects',
    limit: options.recent || 10,
    status: options.active ? 'active' : options.paused ? 'paused' : options.completed ? 'completed' : null
});
```

### Step 3: Enhance with Session Information
```javascript
const projects = result.data.projects;
const enhancedProjects = [];

for (const project of projects) {
    // Get recent sessions
    const sessions = await core.dbManager.getProjectSessions(project.id, 3);
    
    // Get context summary
    const context = await core.dbManager.getProjectContext(
        project.id, 
        ['milestone', 'decision'], 
        true  // preserved only
    );
    
    enhancedProjects.push({
        ...project,
        session_count: sessions.length,
        last_session: sessions[0] || null,
        key_context: context.slice(0, 2), // Top 2 most important
        days_since_active: Math.floor((Date.now() - new Date(project.last_active_at)) / (1000 * 60 * 60 * 24))
    });
}
```

## 📊 Display Format

### Compact List View
```
🏗️  Project Windows (5 active, 2 paused)

┌──────────────────┬──────────┬─────────────┬───────────────┐
│ Project Name     │ Status   │ Last Active │ Sessions      │
├──────────────────┼──────────┼─────────────┼───────────────┤
│ user-auth-system │ ⚡ Active │ 2 hrs ago   │ 7 sessions    │
│ api-gateway      │ ⏸️  Paused │ 5 days ago  │ 12 sessions   │  
│ payment-service  │ ✅ Done   │ 1 week ago  │ 15 sessions   │
│ dashboard-ui     │ ⚡ Active │ 1 day ago   │ 3 sessions    │
│ data-pipeline    │ ⏸️  Paused │ 2 weeks ago │ 8 sessions    │
└──────────────────┴──────────┴─────────────┴───────────────┘

💡 Resume: /project-start <name> --resume
💾 Quick Actions: /project-save, /project-pause
```

### Detailed View (with --verbose)
```
🏗️  user-auth-system (⚡ Active)
    🎯 Goal: Build secure JWT authentication system
    📅 Created: 2 weeks ago • Last Active: 2 hours ago  
    📊 Progress: 7 sessions • 45 context items preserved
    🔑 Recent: "JWT middleware implemented and tested"
    ▶️  Resume: /project-start user-auth-system --resume

⏸️  api-gateway (Paused)  
    🎯 Goal: Microservices API gateway with rate limiting
    📅 Created: 1 month ago • Last Active: 5 days ago
    📊 Progress: 12 sessions • 67 context items preserved
    🔑 Recent: "Rate limiting algorithm chosen - token bucket"
    ▶️  Resume: /project-start api-gateway --resume
```

### Status Legend
```
⚡ Active    - Currently being worked on
⏸️  Paused   - Temporarily stopped, can resume  
✅ Completed - Finished successfully
📦 Archived  - Long-term storage, rarely accessed
⚠️  Blocked  - Has unresolved blockers/issues
```

## 🔍 Interactive Features

### Quick Actions Display
```
📋 Project: user-auth-system
   /project-start user-auth-system --resume   # Resume work
   /project-save --status="Current progress"  # Save state  
   /project-pause                            # Pause project
   /project-archive user-auth-system         # Archive project
```

### Recent Activity Highlights
```
🕒 Recent Activity (Last 7 Days):
   • user-auth-system: JWT implementation completed
   • dashboard-ui: React components refactored  
   • api-gateway: Rate limiting research phase
```

### Context Preservation Stats
```
💾 Context Health:
   ✅ user-auth-system: 45 items (95% preserved)
   ⚠️  api-gateway: 67 items (78% preserved) 
   ✅ dashboard-ui: 23 items (100% preserved)
```

## 🚨 Warnings and Alerts

### Stale Projects
```
⚠️  Stale Projects (>30 days inactive):
   • old-prototype (60 days) - Consider archiving
   • abandoned-feature (45 days) - Review status
```

### Context Degradation  
```
⚠️  Context Issues:
   • api-gateway: Some context may be degraded (78% preserved)
   • Recommendation: Review and update important milestones
```

### Storage Warnings
```
📦 Storage: 15 projects, 234 sessions, 1,245 context items
    Database: 45MB • Project Files: 128MB
    💡 Consider archiving completed projects >3 months old
```

## 💡 Integration Notes

The project list integrates with:
- **LonicFLex Database**: Real project and session data
- **File System**: PROJECT.md files and directories  
- **Context Manager**: Preservation status and health
- **Multi-Agent System**: Direct command execution paths

Provides a comprehensive overview enabling users to efficiently manage multiple long-term projects across extended development cycles.