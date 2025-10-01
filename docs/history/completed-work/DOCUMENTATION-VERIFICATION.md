# Documentation Verification System

**Purpose**: Ensure documentation claims match reality through automated testing.

## 📊 Current Status

**Documentation Accuracy**: **95.0%** (19/20 verifications pass)

**Last Verified**: 2025-09-30

## 🔍 What Gets Verified

### ✅ Verified Claims (19 passing)

**README.md**:
- ✅ `npm run test:core` works
- ✅ `npm run core system:health` works
- ✅ `npm run demo` works
- ✅ All claimed files exist (sqlite-manager, factor3-context-manager, base-agent, command-executor)
- ✅ SQLite WAL mode code exists
- ✅ GitHub integration files exist

**CORE-SYSTEM.md**:
- ✅ `system:health` command works
- ✅ `system:info` command works
- ✅ `gh:list-prs` command works
- ✅ `db:status` command works
- ✅ command-executor.js line count is accurate

**PROJECT.md**:
- ✅ All claimed directories exist (src/, integrations/, tests/, config/)

**npm scripts**:
- ✅ `npm run context:test` works

### ❌ Failed Verifications (1 failing)

- ❌ `npm run integration:test` - Dependencies missing (claude-multi-agent-core archived)

### ⚠️ Warnings (3 items)

- ⚠️ PROJECT.md claims "100% success rate" - needs verification
- ⚠️ PROJECT.md claims "28/28 tests" - needs verification
- ⚠️ PROJECT.md claims "87.5% success rate" - needs verification

## 🚀 Usage

### Run Verification

```bash
# Run full verification suite
npm run verify:docs

# Expected output:
# ✅ PASSED: 19 verifications
# ❌ FAILED: 1 verifications
# ⚠️  WARNINGS: 3 items need attention
# 📈 Documentation Accuracy: 95.0%
```

### Verify Before Committing

```bash
# Check if your documentation changes are accurate
npm run verify:docs

# Fix any failures before committing
```

## 🛠️ How It Works

**`verify-docs.js`** performs these checks:

1. **Command Execution**: Runs npm commands mentioned in docs
2. **File Existence**: Checks claimed files/directories exist
3. **Code Search**: Verifies code features exist in source
4. **Output Validation**: Confirms commands produce expected output
5. **Accuracy Scoring**: Calculates percentage of verified claims

### Verification Methods

```javascript
// Example verifications:
runCommand('npm run test:core')         // Execute and check output
fileExists('src/database/sqlite-manager.js')  // File existence
fileContains('file.js', 'WAL')          // Code feature search
```

## 📋 Adding New Verifications

### Step 1: Add Verification Method

```javascript
// In verify-docs.js
verifyMyFeature() {
    console.log('\n━━━ Verifying My Feature ━━━\n');

    const result = this.runCommand('npm run my-feature');
    if (result.success) {
        this.results.passed.push('my-feature works');
        console.log('✅ PASS: my-feature');
    } else {
        this.results.failed.push('my-feature broken');
        console.log('❌ FAIL: my-feature');
    }
}
```

### Step 2: Call in run() Method

```javascript
async run() {
    this.verifyReadme();
    this.verifyCoreSystem();
    this.verifyMyFeature();  // Add here
    this.generateReport();
}
```

## 🎯 Best Practices

### Documentation Writing

1. **Make testable claims**:
   - ✅ "Run `npm run test:core` to test"
   - ❌ "Tests should pass"

2. **Include verification commands**:
   - ✅ "System is healthy (verify: `npm run core system:health`)"
   - ❌ "System is healthy"

3. **Update after changes**:
   - ✅ Run `npm run verify:docs` after doc updates
   - ❌ Update docs without verification

### Code Changes

1. **Update tests when APIs change**
2. **Fix broken verifications immediately**
3. **Add verifications for new features**

## 🔧 Fixing Failures

### Common Issues

**Command not found**:
```bash
# Issue: npm run integration:test fails
# Fix: Update package.json script path or fix dependencies
```

**File not found**:
```bash
# Issue: Claimed file doesn't exist
# Fix: Update documentation with correct path or create file
```

**Output doesn't match**:
```bash
# Issue: Command runs but output unexpected
# Fix: Update expected output in verification or fix command
```

## 📈 Target Metrics

- **Critical**: Documentation accuracy ≥ 90%
- **Warning**: Documentation accuracy ≥ 80%
- **Failing**: Documentation accuracy < 80%

## 🚨 CI/CD Integration

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash
npm run verify:docs
if [ $? -ne 0 ]; then
    echo "❌ Documentation verification failed"
    exit 1
fi
```

### GitHub Actions

```yaml
# .github/workflows/verify-docs.yml
name: Verify Documentation
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run verify:docs
```

## 📊 Verification History

| Date | Accuracy | Passed | Failed | Warnings |
|------|----------|--------|--------|----------|
| 2025-09-30 | 95.0% | 19 | 1 | 3 |

## 🔍 Next Steps

1. **Fix integration:test** - Resolve claude-multi-agent-core dependency
2. **Verify test claims** - Run actual tests to confirm "28/28" and "87.5%" claims
3. **Add agent verification** - Test agent personas work as documented
4. **Add command verification** - Test .claude/commands/ slash commands
5. **Automate verification** - Add pre-commit hook and CI/CD integration

---

**Philosophy**: Documentation should be **verifiable, not just believable**. Every claim should have a test that proves or disproves it.

**Remember**: `npm run verify:docs` before every commit!