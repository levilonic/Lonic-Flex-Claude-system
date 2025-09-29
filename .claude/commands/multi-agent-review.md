---
allowed-tools: Read,Edit,Bash,Grep,Task
model: claude-sonnet-4-20250514
description: LonicFLex multi-agent orchestration with OneRedOak review integration
argument-hint: [optional: review type - code|security|design|full]
security-profile: full
---

# Multi-Agent Review Orchestration

Comprehensive orchestration of LonicFLex multi-agent system with integrated OneRedOak review methodologies.

## Orchestration Architecture

### Agent Coordination Pattern
```
Supervisor Agent (This Agent)
├── GitHub Integration Agent    → Repository analysis and PR management
├── Enhanced Security Agent     → OWASP-based security assessment
├── Pragmatic Code Reviewer     → 7-category code quality analysis
├── Design Review Agent         → UI/UX and accessibility assessment
├── Deploy Agent               → Container and infrastructure review
└── Context Preservation Agent → Universal context management
```

### Multi-Agent Workflow Types

#### 1. Full Comprehensive Review
**Sequence**: GitHub → Security → Code → Design → Deploy → Integration
- Complete analysis across all domains
- Comprehensive quality gates and checkpoints
- Full context preservation and handoff
- **Duration**: 15-20 minutes for thorough review

#### 2. Security-Focused Review
**Sequence**: GitHub → Enhanced Security → Code (security aspects) → Deploy (security config)
- OWASP Top 10 vulnerability assessment
- Security configuration validation
- Dependency vulnerability scanning
- **Duration**: 8-12 minutes for security focus

#### 3. Code Quality Review
**Sequence**: GitHub → Pragmatic Code Reviewer → Security (code patterns) → Integration
- 7-category pragmatic assessment
- "Net Positive > Perfection" methodology
- Pattern recognition and learning
- **Duration**: 6-10 minutes for code focus

#### 4. Design & Accessibility Review
**Sequence**: Design Review → Code (UI components) → Integration testing
- WCAG 2.1 compliance assessment
- Responsive design validation
- User experience optimization
- **Duration**: 5-8 minutes for design focus

## Multi-Agent Coordination Protocol

### Phase 1: Initialization and Context Setup
```javascript
// Initialize all required agents
const agents = {
    github: new GitHubAgent(sessionId, { repository: currentRepo }),
    security: new EnhancedSecurityAgent(sessionId, { owaspCompliant: true }),
    codeReviewer: new PragmaticCodeReviewer(sessionId, { framework: "7-category" }),
    designReviewer: new DesignReviewAgent(sessionId, { wcagLevel: "AA" }),
    deploy: new DeployAgent(sessionId, { containerSecurity: true }),
    contextManager: new UniversalContextManager(sessionId)
};
```

### Phase 2: Parallel Information Gathering
- **GitHub Analysis**: Repository state, PR changes, file modifications
- **Context Loading**: Previous review history, patterns, lessons learned
- **Environment Assessment**: Current system state and dependencies
- **Scope Definition**: Review boundaries and focus areas

### Phase 3: Sequential Agent Execution
1. **GitHub Agent**: Repository analysis and change detection
2. **Security Agent**: Vulnerability scanning and OWASP assessment
3. **Code Review Agent**: Pragmatic 7-category analysis
4. **Design Agent**: UI/UX and accessibility review (if applicable)
5. **Deploy Agent**: Infrastructure and deployment validation
6. **Integration Validation**: Cross-agent result synthesis

### Phase 4: Result Synthesis and Reporting
- **Unified Report Generation**: Combined findings across all agents
- **Priority Classification**: Critical/High/Medium/Low issue categorization
- **Actionable Recommendations**: Specific implementation guidance
- **Context Preservation**: Results stored for future session continuity

## Agent Communication Protocol

### Context Handoff Pattern
```xml
<multi_agent_context>
    <session_id>{{ sessionId }}</session_id>
    <review_type>{{ reviewType }}</review_type>
    <previous_agent_results>
        <github_analysis>{{ githubResults }}</github_analysis>
        <security_findings>{{ securityResults }}</security_findings>
        <code_review_results>{{ codeResults }}</code_review_results>
    </previous_agent_results>
    <next_agent_focus>{{ focusAreas }}</next_agent_focus>
</multi_agent_context>
```

### Resource Coordination
- **Database Locks**: SQLite-based resource coordination
- **Context Sharing**: Universal context system integration
- **Memory Synchronization**: Cross-agent pattern sharing
- **Error Propagation**: Graceful failure handling across agents

## Review Execution Commands

### Full Comprehensive Review
```bash
# Complete multi-agent analysis
node claude-multi-agent-core.js --review-type=full --preserve-context=true
```

### Targeted Review Types
```bash
# Security-focused review
/multi-agent-review security

# Code quality focused review
/multi-agent-review code

# Design and accessibility review
/multi-agent-review design

# Custom review with specific agents
/multi-agent-review github,security,code
```

## Quality Gates and Checkpoints

### Critical Quality Gates
- **Security Gate**: No critical vulnerabilities (OWASP Critical/High)
- **Functionality Gate**: Core functionality preserved and working
- **Performance Gate**: No significant performance regressions
- **Accessibility Gate**: WCAG Level AA compliance maintained

### Validation Checkpoints
- **Agent Completion**: Each agent reports successful completion
- **Context Preservation**: Universal context successfully updated
- **Integration Testing**: Multi-agent results properly synthesized
- **Memory Learning**: Patterns recorded for future improvements

## Integration with OneRedOak Patterns

### Dual-Loop Architecture
- **Automated Loop**: GitHub Actions triggering multi-agent workflows
- **Interactive Loop**: Manual slash command orchestration
- **Hybrid Execution**: Combining automated and interactive review cycles

### Tool Restriction Enforcement
- **Security Profile Adherence**: Agents respect defined tool restrictions
- **Escalation Protocols**: Secure tool access when required
- **Audit Trail**: Complete tool usage tracking and logging

## Multi-Agent Report Format

```markdown
## Multi-Agent Review Report

**Review Type**: [Full/Security/Code/Design/Custom]
**Agents Executed**: [List of participating agents]
**Overall Status**: [Pass/Conditional Pass/Needs Work/Fail]

### Executive Summary
- [High-level assessment across all agent findings]
- [Critical issues requiring immediate attention]
- [Overall quality and readiness assessment]

### Agent-Specific Findings

#### GitHub Analysis
- [Repository state, changes, and context]

#### Security Assessment
- [OWASP compliance and vulnerability findings]

#### Code Quality Review
- [7-category pragmatic assessment results]

#### Design Review (if applicable)
- [UI/UX and accessibility assessment]

#### Deployment Review (if applicable)
- [Infrastructure and deployment readiness]

### Synthesized Recommendations
- [Cross-agent insights and coordinated recommendations]
- [Priority-ordered action items with agent attribution]

### Context Preservation Summary
- [Patterns learned and context preserved for future sessions]
```

## Performance and Optimization

### Parallel Execution Optimization
- **Independent Agent Tasks**: Run compatible agents in parallel
- **Resource Pool Management**: Efficient SQLite connection pooling
- **Memory Optimization**: Context sharing without duplication
- **Caching Strategy**: Intermediate result caching for efficiency

### Error Handling and Resilience
- **Graceful Degradation**: Continue with available agents if some fail
- **Retry Mechanisms**: Automatic retry for transient failures
- **Rollback Capabilities**: Ability to revert to previous stable state
- **Diagnostic Integration**: Comprehensive error reporting and debugging

**Command Usage**: `/multi-agent-review [review-type]`
**Example**: `/multi-agent-review full` or `/multi-agent-review security`

Review type: $ARGUMENTS