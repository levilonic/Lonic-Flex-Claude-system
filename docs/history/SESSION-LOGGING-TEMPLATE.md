# Session Logging Template
*Use this template for consistent session documentation*

## For PERMANENT-SESSION-LOG.md (Append new entry)

```markdown
## SESSION YYYY-MM-DD: [Session Focus/Title]
**Duration**: [Time estimate]  
**Persona**: [Agent persona used]  
**Starting Context**: [What triggered this session]  
**Completion**: [Percentage]% [Status]

### Objectives Achieved
- **[Major Goal 1]**: [Specific achievement]
- **[Major Goal 2]**: [Specific achievement]
- **[Technical Implementation]**: [What was built/enhanced]

### Key Technical Achievements  
- [Technical detail 1]: [Specific implementation or improvement]
- [Technical detail 2]: [Specific implementation or improvement]
- [Performance/capability improvement]: [Measurable enhancement]

### Major Discoveries
- **[Discovery Category]**: [Key insight learned]
- **[System/Process Insight]**: [Important pattern or methodology]
- **[User/Communication Intelligence]**: [Communication or workflow preference]

### System Status Changes
- [Component]: [Before] → [After]
- [Capability]: [Previous state] → [New state]
- [Performance metric]: [Old] → [New]

### Files Modified/Created
- `[file-path]`: [Description of changes and line count if significant]
- `[new-file]`: [Purpose and key contents]

### Git Commits
- `[commit-hash]`: [Commit message]
- `[commit-hash]`: [Commit message]

### Intelligence Captured
- **[Pattern Category]**: [Workflow patterns, technical insights, etc.]
- **[User Communication]**: [Communication preferences observed]
- **[Technical Architecture]**: [Architecture insights and patterns]

### Next Session Recommendations
- **[Immediate action]**: [Specific next step with expected outcome]
- **[Strategic improvement]**: [Longer-term enhancement opportunity]

### Completion Metrics
- **Planned Tasks**: [X/Y completed (percentage)]
- **Enhancement Level**: [Minor/Major/Critical]
- **Context Preservation**: [X/10]
- **Documentation Quality**: [Assessment]
- **Git Synchronization**: [Status]

**Session Status**: [✅ COMPLETE / 🔄 IN PROGRESS / ❌ BLOCKED] - [Brief status description]

---
```

## For docs/session-intelligence.txt (Add new line)

```
YYYY-MM-DD | [Focus_Area] | [achievement1,achievement2,achievement3] | [discovery1,discovery2,discovery3] | [STATUS]
```

**Field Guidelines:**
- **Focus_Area**: Use underscores, keep concise (Security_Audit, Agent_Enhancement, etc.)
- **Achievements**: Comma-separated, use underscores for spaces, be specific
- **Discoveries**: Key insights that will help future sessions, use underscores
- **STATUS**: COMPLETE, IN_PROGRESS, BLOCKED, PARTIAL

## For PROJECT-PROGRESS-OVERVIEW.md (Update relevant sections)

**Update these sections as needed:**
- Progress Dashboard percentages
- Recent Velocity section
- Current Phase description
- Next Session Priorities

**Key Metrics to Track:**
- Overall completion percentage
- Component completion status
- Test success rates
- Enhancement levels achieved

## Usage Guidelines

1. **Always use the template** for consistency
2. **Be specific** - avoid vague descriptions
3. **Include evidence** - test results, file changes, commits
4. **Focus on permanent value** - what will help future sessions
5. **Update all three files** when completing a session

## Template Maintenance

This template should evolve based on:
- What information proves most valuable for session continuity
- Changes in project structure or focus areas
- User feedback on documentation usefulness
- New metrics or tracking needs identified

*Template created: 2025-09-11*