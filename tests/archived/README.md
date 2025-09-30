# Archived Tests

Tests in this directory are archived because they reference features that have been removed from the codebase.

## Archived on 2025-09-30

### Reason: Missing Files (Removed Features)

1. **test-long-term-persistence.js**
   - Missing: `./long-term-persistence`
   - Missing: `./context-health-monitor`
   - Missing: `../context-management/factor3-context-manager`

2. **test-unified-commands.js**
   - Missing: `./universal-context-commands`

3. **test-enhanced-github-integration.js**
   - Missing: `../../src/agents/enhanced-github-agent`

4. **test-multi-agent-integration.js**
   - Missing: `../../claude-multi-agent-core`

5. **test-multi-branch-operations.js**
   - Missing: `../../integrations/claude/claude-multi-agent-core`

6. **test-real-github-integration.js**
   - Missing: `../../integrations/external-integrations/simplified-external-coordinator`

7. **test-window1-multi-workflow-state.js**
   - Missing: `../../src/services/claude-state-bridge`

## When to Restore

These tests can be restored when:
- The features are re-implemented
- The required files are created
- The tests are updated to match new API signatures

## Recommendation

Rather than restoring these tests, consider writing NEW tests for CURRENT functionality using TDD approach.
