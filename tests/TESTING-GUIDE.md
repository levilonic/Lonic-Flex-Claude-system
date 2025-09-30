# LonicFLex Testing Guide

**Last Updated**: 2025-09-30
**Status**: Test infrastructure operational, test discipline enforced

---

## Quick Start

```bash
# Run all tests (smoke + unit + integration)
npm test

# Run smoke tests only (< 30 seconds)
npm run test:smoke

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Install pre-commit hook (blocks broken commits)
node scripts/install-git-hooks.js
```

---

## Testing Philosophy

### Core Principles

1. **Tests are not optional** - If it's not tested, it doesn't exist
2. **Tests must run automatically** - `npm test` is the source of truth
3. **Fast feedback loop** - Smoke tests < 30s, full suite < 5 minutes
4. **Integration over mocking** - Test real behavior with real DB
5. **Fail fast** - Critical test failures stop everything

### Test-Driven Development Workflow

```bash
# 1. Write failing test FIRST
touch tests/unit/test-my-new-feature.js

# 2. Run test - it MUST fail
npm run test:unit

# 3. Implement feature until test passes
# 4. Run ALL tests
npm test

# 5. Commit (pre-commit hook runs smoke tests automatically)
git add .
git commit -m "feat: Add new feature with tests"
```

---

## Test Categories

### Smoke Tests (< 30s, Critical)
**Purpose**: Quick sanity check that core system works

**What it tests**:
- Core system initialization
- Basic module loading
- Command execution
- Database connectivity

**When to run**:
- Before every commit (automatic via pre-commit hook)
- After pulling changes
- Before deploying

```bash
npm run test:smoke
```

### Unit Tests (Individual Modules)
**Purpose**: Test individual components in isolation

**What it tests**:
- Service Container initialization
- Base Agent lifecycle
- Database isolation
- Command registry

**Test database**: Uses in-memory SQLite (`:memory:`)

```bash
npm run test:unit
```

### Integration Tests (Components Together)
**Purpose**: Test how components work together

**What it tests**:
- Universal Context System
- Database operations end-to-end
- Service coordination
- Multi-agent workflows

**Test database**: Isolated test databases (auto-cleanup)

```bash
npm run test:integration
```

### E2E Tests (Real External APIs)
**Purpose**: Test with real GitHub/Slack APIs

**Requirements**:
- `GITHUB_TOKEN` environment variable
- `SLACK_BOT_TOKEN` environment variable

**What it tests**:
- Real GitHub PR reviews
- Real Slack notifications
- End-to-end workflows

```bash
# Skips if tokens not available
npm run test:e2e
```

---

## Writing Tests

### Test Structure

```javascript
/**
 * Test: Feature Name
 * Purpose: What this test validates
 */

const { getInMemoryDb, cleanupTestDb } = require('../test-db-manager');

async function testMyFeature() {
    let testResults = { passed: 0, failed: 0 };

    // Setup
    const db = await getInMemoryDb('my-feature-test');

    try {
        // Test implementation
        const result = await myFeature.doSomething();

        // Assertions
        if (result === expected) {
            console.log('✅ Test passed');
            testResults.passed++;
        } else {
            console.log('❌ Test failed');
            testResults.failed++;
        }

    } finally {
        // Cleanup
        await cleanupTestDb('my-feature-test');
    }

    // Exit code for CI/CD
    process.exit(testResults.failed > 0 ? 1 : 0);
}

testMyFeature();
```

### Test Database Usage

```javascript
const { getInMemoryDb, getTestDb, cleanupTestDb } = require('./test-db-manager');

// Option 1: In-memory database (fastest, no disk I/O)
const db = await getInMemoryDb('my-test');
// ... use db ...
await cleanupTestDb('my-test');

// Option 2: File-based database (for debugging)
const db = await getTestDb('my-test');
// ... use db ...
await cleanupTestDb('my-test');
```

### Test Checklist

Before writing a test, ensure:
- [ ] Test name clearly describes what it validates
- [ ] Test uses isolated database
- [ ] Test cleans up after itself
- [ ] Test exits with code 0 (pass) or 1 (fail)
- [ ] Test output is clear (✅ pass, ❌ fail)
- [ ] Test is added to test-runner.js if critical

---

## Pre-Commit Hook

**Installed**: ✅ (run `node scripts/install-git-hooks.js` if not)

### What It Does

```bash
git commit -m "feat: new feature"
# 🧪 Running smoke tests before commit...
# ▶️  Running: Core System Smoke
# ✅ PASS: Core System Smoke (195ms)
# ▶️  Running: Basic Module Loading
# ✅ PASS: Basic Module Loading (372ms)
# ✅ Smoke tests passed - proceeding with commit
```

### If Tests Fail

```bash
git commit -m "feat: broken feature"
# 🧪 Running smoke tests before commit...
# ❌ FAIL: Core System Smoke
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ❌ COMMIT BLOCKED - Smoke tests failed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Fix the failing tests before committing.
```

### Bypass Hook (NOT RECOMMENDED)

```bash
# Only use in emergencies
git commit --no-verify -m "fix: emergency hotfix"
```

---

## Test Results Interpretation

### Success Output

```
════════════════════════════════════════════════════════════
  TEST RESULTS
════════════════════════════════════════════════════════════

✅ Passed:  10
❌ Failed:  0
⏭️  Skipped: 2
⏱️  Duration: 2.45s

════════════════════════════════════════════════════════════
🎉 ALL TESTS PASSED (100.0%)
════════════════════════════════════════════════════════════
```

**Exit Code**: 0 (success)

### Failure Output

```
════════════════════════════════════════════════════════════
  TEST RESULTS
════════════════════════════════════════════════════════════

✅ Passed:  8
❌ Failed:  2
⏭️  Skipped: 0
⏱️  Duration: 1.89s

────────────────────────────────────────────────────────────
  FAILURES
────────────────────────────────────────────────────────────

❌ Database Integration
   Error: Connection timeout...

❌ Service Container Integration
   Error: Service initialization failed...

════════════════════════════════════════════════════════════
💥 TESTS FAILED (80.0% pass rate)
════════════════════════════════════════════════════════════
```

**Exit Code**: 1 (failure)

---

## Debugging Failed Tests

### Step 1: Run Specific Category

```bash
# Isolate the failing category
npm run test:unit
# or
npm run test:integration
```

### Step 2: Run Individual Test

```bash
# Run the specific test file directly
node tests/unit/test-base-agent.js
```

### Step 3: Add Debug Output

```javascript
// Add console.log statements
console.log('DEBUG: Value of x:', x);
console.log('DEBUG: Database state:', await db.getStats());
```

### Step 4: Use Test Database File

```javascript
// Change from in-memory to file-based for inspection
const db = await getTestDb('debug-test');
// Database file: data/test-databases/test-debug-test-<timestamp>.db
```

---

## Common Test Patterns

### Testing Database Operations

```javascript
const db = await getInMemoryDb('db-test');

// Create test data
await db.createSession('test-session', 'test-workflow', { foo: 'bar' });

// Test query
const session = await db.getSession('test-session');
assert(session.workflow_type === 'test-workflow');

await cleanupTestDb('db-test');
```

### Testing Agents

```javascript
const { ServiceContainer } = require('../src/services/service-container');
const { BaseAgent } = require('../src/agents/base-agent');

const container = new ServiceContainer();
await container.initialize();

const agent = new BaseAgent('test-agent', 'test-session', container);
await agent.initialize();

const result = await agent.execute({ task: 'test' });
assert(result.status === 'completed');

await container.shutdown();
```

### Testing with External APIs

```javascript
// Check for token
if (!process.env.GITHUB_TOKEN) {
    console.log('⏭️  Skipped: No GITHUB_TOKEN');
    process.exit(0);
}

// Use real API
const github = new GitHubReal({ token: process.env.GITHUB_TOKEN });
const prs = await github.listPRs();
assert(Array.isArray(prs));
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test:smoke
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm test # Full suite
```

### Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed
- **Non-zero**: Test runner crashed

---

## Test Maintenance

### Adding New Tests

1. Create test file in appropriate directory:
   - `tests/unit/` - Unit tests
   - `tests/integration/` - Integration tests
   - `tests/e2e/` - End-to-end tests

2. Follow test structure template (see above)

3. Add to `tests/test-runner.js` if critical:
```javascript
unit: [
    // ... existing tests
    {
        name: 'My New Feature',
        file: 'tests/unit/test-my-feature.js',
        timeout: 30000,
        critical: true,
        description: 'Tests my new feature functionality'
    }
]
```

4. Run tests: `npm test`

5. Commit: `git commit -m "test: add tests for new feature"`

### Removing Old Tests

1. Move to `tests/archived/` (don't delete - keep for reference)
2. Remove from `test-runner.js` if registered
3. Document why test was archived in commit message

### Test Coverage Goals

- **Core System**: 90%+ coverage
- **Database Layer**: 90%+ coverage
- **Service Container**: 85%+ coverage
- **Agent System**: 80%+ coverage
- **Integrations**: 70%+ coverage

---

## Troubleshooting

### Pre-commit hook not running

```bash
# Reinstall hook
node scripts/install-git-hooks.js

# Verify hook exists
ls -la .git/hooks/pre-commit

# Make executable (Unix/Mac)
chmod +x .git/hooks/pre-commit
```

### Tests hang or timeout

```bash
# Increase timeout in test-runner.js
timeout: 60000  // 60 seconds

# Or skip slow tests
npm run test:smoke  # Fast tests only
```

### Database locked errors

```bash
# Clean up orphaned test databases
rm data/test-databases/*.db

# Or use in-memory DB
const db = await getInMemoryDb('test-name');
```

### Module not found errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check file paths in test
node tests/unit/test-my-feature.js
```

---

## Best Practices

### ✅ DO

- Write tests BEFORE implementing features (TDD)
- Use descriptive test names
- Clean up test databases
- Run full test suite before pushing
- Keep tests fast (< 5 minutes total)
- Test error cases, not just happy paths

### ❌ DON'T

- Skip tests to "move fast"
- Commit without running tests
- Use production database in tests
- Leave test databases on disk
- Mock everything (test real behavior)
- Write tests after feature is "done"

---

## Support

### Questions?

1. Check `tests/TEST-INVENTORY.md` for test catalog
2. Look at existing tests for examples
3. Read test output carefully (it's designed to be helpful)

### Found a Bug?

1. Write a test that reproduces the bug (it should fail)
2. Fix the bug
3. Verify test passes
4. Commit both test and fix

---

**Remember**: Tests are not a burden, they're your safety net. They let you refactor with confidence and catch regressions before they reach production.