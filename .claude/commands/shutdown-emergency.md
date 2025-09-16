---
description: Emergency shutdown with critical flow preservation for immediate session recovery
allowed-tools: Read(C:\Users\Levi\Desktop\LonicFLex\**), Write(C:\Users\Levi\Desktop\LonicFLex\**), Bash(*), Edit(*)

---

# Emergency Shutdown - Flow Preservation

**CRITICAL SCENARIO**: Context window at 2% or you need to shut down immediately while mid-task.

**YOUR ONLY JOB**: Save exactly what's needed to resume your current work flow instantly in a new Claude chat.

## 🚨 Emergency Protocol

### Step 1: Capture Current Task State
**What you're working on RIGHT NOW**:
- Current task/objective
- Approach/strategy being used
- Exact step you're on in the process
- What you just completed (research, planning, coding, etc.)
- Next immediate action needed

### Step 2: Save Critical Context
**To `current-session-context.xml`**:
```xml
<emergency_shutdown>
    <timestamp>[current timestamp]</timestamp>
    <context_level>[percentage]% - EMERGENCY SHUTDOWN</context_level>
    <current_task>
        [What you're working on right now]
    </current_task>
    <progress_state>
        [Exactly where you are in the process]
    </progress_state>
    <key_findings>
        [Critical discoveries/decisions made this session]
    </key_findings>
    <next_action>
        [Immediate next step to continue work]
    </next_action>
    <resume_instruction>
        [How to pick up exactly where you left off]
    </resume_instruction>
</emergency_shutdown>
```

### Step 3: Emergency Git Commit
Commit whatever state exists immediately:
```bash
git add -A
git commit -m "Emergency shutdown - preserving work in progress

Current task: [brief description]
Next step: [immediate action]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4: Quick Status Update
Update `CURRENT-SESSION-STATUS.md` with one line:
```markdown
**EMERGENCY SHUTDOWN**: Working on [task], next step: [action] - Resume with /lonicflex-init
```

## 🎯 Success Criteria
- Current work flow state preserved
- Critical context saved to XML
- Changes committed to git
- Can resume immediately in new session

**Integration**: When you run `/lonicflex-init` in new session, it will detect emergency shutdown context and offer to resume immediately.