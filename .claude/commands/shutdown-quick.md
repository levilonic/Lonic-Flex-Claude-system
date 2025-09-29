---
description: Quick shutdown capturing essential discoveries and patterns for future sessions
allowed-tools: Read(C:\Users\Levi\Desktop\LonicFLex\**), Write(C:\Users\Levi\Desktop\LonicFLex\**), Bash(*), Edit(*)

---

# Quick Shutdown - Essential Patterns Capture

**SCENARIO**: Need to close in 2-3 minutes but want to save key insights from this session.

**YOUR JOB**: Capture the important stuff without bloating future context windows.

## 🔄 Quick Protocol

### Step 1: Identify Key Discoveries
**What matters for future sessions**:
- Major system discoveries (like "MultiplanManager already implemented!")
- Important workflow insights that worked well
- User preference patterns observed
- Critical decisions made and why
- System reality vs documentation gaps

### Step 2: Save to Session Memory
**Create/append to**: `memory/session-[DATE]-insights.md`

```markdown
# Session [DATE]: Quick Insights Capture

## 🎯 Key Discoveries
- [Major finding #1]
- [Major finding #2] 
- [System state reality check]

## 💡 Workflow Patterns That Worked
- [Approach that was effective]
- [Tool/command that saved time]
- [Communication pattern user preferred]

## 🚨 Critical Decisions Made
- [Decision] → Because [reason]
- [Choice] → Based on [evidence]

## 🔄 Next Session Recommendations
- [Suggested next steps]
- [Areas to explore]
- [Things to remember]
```

### Step 3: Quick Git Commit
```bash
git add -A
git commit -m "Quick shutdown - session insights captured

Key discoveries: [brief list]
Workflow improvements identified

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4: Update Project Memory
**Add key insights to**: `.claude/project-memory.md`

Add one section under relevant category:
```markdown
### [DATE] Session Insights
- **System Discovery**: [key finding]
- **Workflow Pattern**: [what worked well]
- **User Preference**: [communication/approach preference]
```

## 🎯 Success Criteria  
- Important discoveries preserved in searchable format
- Workflow patterns captured for reuse
- Project memory updated with key insights
- Changes committed cleanly

**Integration**: Insights become part of your searchable knowledge base via `node docs/doc-search.js search "pattern"` or similar searches in future sessions.