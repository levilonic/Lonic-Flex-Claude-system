---
description: Start a new project or resume an existing project window
allowed-tools: Read(C:\Users\Levi\Desktop\LonicFLex\**), Write(C:\Users\Levi\Desktop\LonicFLex\**), Bash(*), Edit(*)
---

# Project Start - Initialize Project Window

**SCENARIO**: Create a new project window or resume work on an existing project with full context preservation.

**YOUR JOB**: Use the LonicFLex ProjectAgent to manage project lifecycles following the noumena vs phenomena pattern.

## 🚀 Project Window Protocol

### Usage Patterns

**Create New Project:**
```
/project-start <project-name> --goal="Project objective" --vision="Long-term vision"
```

**Resume Existing Project:**
```  
/project-start <project-name> --resume
```

**Create Project with Full Context:**
```
/project-start <project-name> --goal="Build user auth system" --vision="Secure, scalable authentication" --context="React app needs JWT auth with role-based permissions"
```

## 🎯 Implementation Steps

### Step 1: Initialize Multi-Agent System
```javascript
const { MultiAgentCore } = require('./claude-multi-agent-core');
const core = new MultiAgentCore();
await core.initialize();
```

### Step 2: Execute Project Creation/Resume
Parse the command arguments and determine action:

- **New Project**: Use ProjectAgent's `create_project` action
- **Resume Project**: Use ProjectAgent's `load_project` action
- **Project Name**: Extract from first argument after `/project-start`
- **Options**: Parse `--goal`, `--vision`, `--context`, `--resume` flags

### Step 3: Project Agent Execution
```javascript
const sessionId = `session_${Date.now()}`;
const workflow = await core.initializeSession(sessionId, 'project-management', {
    action: isResume ? 'load_project' : 'create_project',
    projectName: projectName,
    goal: options.goal,
    vision: options.vision,
    context: options.context
});

const agent = core.activeAgents.get('project');
const result = await agent.execute(workflow.context);
```

### Step 4: Create PROJECT.md (Noumena)
For new projects, the ProjectAgent will create:

```markdown
# {project-name}

## Project Goal
{goal from --goal flag or prompt user}

## Project Vision  
{vision from --vision flag or prompt user}

## Context
{context from --context flag or prompt user}

## Key Requirements
- Add key requirements here

## Success Criteria
- Define success metrics and completion criteria  

## Notes
Additional notes and considerations

---
*Project created: {timestamp}*
*Session: {sessionId}*
```

### Step 5: Link Session to Project (Phenomena)
```javascript
// Link current session to project for context tracking
await core.dbManager.linkSessionToProject(
    result.data.project_id,
    sessionId,
    'execution'
);
```

### Step 6: Context Injection for Resume
If resuming existing project:
- Load preserved context from previous sessions
- Inject project worldview from PROJECT.md
- Display project status and last activity
- Show recent session history

## 🔄 Success Confirmation

**For New Projects:**
```
✅ Project Created: {project-name}
📁 Project Directory: ./projects/{project-name}/
📄 Identity File: PROJECT.md
🔗 Session Linked: {sessionId}
🎯 Goal: {goal}
```

**For Resumed Projects:**
```
🔄 Project Resumed: {project-name}  
📅 Last Active: {last_active_date}
📊 Previous Sessions: {session_count}
🎯 Goal: {goal}
📝 Recent Context: {context_summary}
```

## 🚨 Error Handling

- **Project Not Found**: Offer to create new project with same name
- **Invalid Project Name**: Sanitize and suggest valid alternatives
- **Database Connection Issues**: Fall back to file-based project creation
- **Permission Issues**: Check directory permissions for ./projects/

## 💡 Integration Notes

This command integrates with:
- **LonicFLex MultiAgentCore**: Project workflow orchestration
- **SQLite Database**: Project and session persistence  
- **Factor 3 Context Manager**: Context preservation across sessions
- **Claude Code Memory System**: Long-term project learning

The command creates a persistent "project window" that survives beyond individual chat sessions, solving the core problem of context loss between Claude conversations.