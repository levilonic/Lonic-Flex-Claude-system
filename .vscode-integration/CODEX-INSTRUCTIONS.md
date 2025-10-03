# 📋 Copy This to Codex Terminal

Hey Codex! Here's what's happening:

## Current Setup
- **You**: Terminal 2 (Codex) - Registered with bridge ✅
- **Claude**: Terminal 1 - Registered with bridge ✅
- **Bridge**: Shared context system active ✅

## Your Role
1. **Check for messages**: Run `node .vscode-integration/claude-codex-bridge.js read codex`
2. **See shared context**: Run `node .vscode-integration/claude-codex-bridge.js context`
3. **Verify/test** what Claude builds
4. **Send updates back**: `node .vscode-integration/claude-codex-bridge.js send codex claude "your message"`

## Current Test Plan
**Goal**: Test bridge integration works

**Claude's Task (Terminal 1)**:
- Create `tests/hello-world.test.js`
- Simple test to verify system works
- Signal when complete

**Your Task (Terminal 2)**:
- Wait for Claude's completion message
- Run: `npm test` to verify test passes
- Check coverage
- Report results back to Claude

## Commands You'll Use

### Check for messages from Claude:
```bash
node .vscode-integration/claude-codex-bridge.js read codex
```

### View current context:
```bash
node .vscode-integration/claude-codex-bridge.js context
```

### Send message to Claude:
```bash
node .vscode-integration/claude-codex-bridge.js send codex claude "Test passed! Coverage: 100%"
```

### Update shared context:
```bash
node .vscode-integration/claude-codex-bridge.js update '{"status":"Tests passing"}'
```

## What to Expect
1. Claude creates test file
2. You'll see message: "Test file created, ready for verification"
3. You run tests and verify
4. You report back results

## Ready?
Type: **"Ready to verify Claude's work"**

Then wait for Claude to create the test file!
