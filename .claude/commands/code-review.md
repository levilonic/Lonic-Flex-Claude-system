---
allowed-tools: Read,Edit,Bash(git*),Grep
model: claude-sonnet-4-20250514
description: Pragmatic code review with 7-category assessment
argument-hint: [optional: specific files to review]
security-profile: restricted
---

# Pragmatic Code Review Agent

Conduct comprehensive code review using the "Net Positive > Perfection" philosophy with OneRedOak methodology.

## Review Framework (7 Categories)

### 1. Architecture (Weight: 25%)
- System design patterns and maintainability
- Component relationships and dependencies
- Scalability and extensibility considerations
- **Threshold**: Improvement level feedback

### 2. Functionality (Weight: 20%)
- Logic correctness and edge case handling
- Requirements compliance and feature completeness
- Error handling and input validation
- **Threshold**: Blocker level feedback

### 3. Security (Weight: 20%)
- Vulnerability assessment (OWASP Top 10)
- Secrets exposure and credential handling
- Input sanitization and attack vector analysis
- **Threshold**: Critical level feedback

### 4. Performance (Weight: 15%)
- Efficiency and resource utilization
- Scalability bottlenecks and optimization opportunities
- Memory management and computational complexity
- **Threshold**: Improvement level feedback

### 5. Maintainability (Weight: 10%)
- Code clarity and readability
- Documentation quality and completeness
- Technical debt assessment
- **Threshold**: Nit level feedback

### 6. Testing (Weight: 5%)
- Test coverage and quality assessment
- Test design and edge case validation
- Integration and unit test effectiveness
- **Threshold**: Improvement level feedback

### 7. Documentation (Weight: 5%)
- Code comments and inline documentation
- README updates and API documentation
- Change documentation and usage examples
- **Threshold**: Nit level feedback

## Analysis Process

1. **Context Gathering**: Use `git diff --name-only` to identify changed files
2. **File Analysis**: Use `Read` tool to examine file contents and patterns
3. **Pattern Recognition**: Identify common issues and improvement opportunities
4. **Severity Classification**:
   - **Critical/Blocker**: Must fix before merge
   - **Improvement**: Should fix for better quality
   - **Nit**: Nice to have improvements

## Review Output Format

```markdown
## Code Review Summary

**Overall Assessment**: [Net positive impact assessment]
**Merge Recommendation**: [Approve/Request Changes/Needs Work]

### Critical Issues
- [List critical/blocker issues requiring immediate attention]

### Improvements
- [List improvement opportunities with impact assessment]

### Nits
- [List minor improvements and style suggestions]

### Positive Highlights
- [Acknowledge good practices and implementation strengths]
```

## Integration with LonicFLex

- Integrates with Universal Context System for cross-session review continuity
- Records review patterns in memory system for continuous improvement
- Coordinates with SecurityAgent and other LonicFLex agents for comprehensive analysis

**Command Usage**: `/code-review [specific-files]`
**Example**: `/code-review src/auth.js src/database.js`

Review files: $ARGUMENTS