# Claude Code ↔ Codex Integration for VS Code Split Terminal

Seamless communication between Claude Code and Codex running in split terminals.

## 🚀 Quick Start

### Setup (One Time)
```bash
# Make wrappers executable
chmod +x .vscode-integration/claude-wrapper.sh
chmod +x .vscode-integration/codex-wrapper.sh

# Add to your shell profile for easy access (optional)
echo 'alias claude-bridge="$PWD/.vscode-integration/claude-wrapper.sh"' >> ~/.bashrc
echo 'alias codex-bridge="$PWD/.vscode-integration/codex-wrapper.sh"' >> ~/.bashrc
source ~/.bashrc
```

### Usage

**In VS Code:**
1. Open integrated terminal (Ctrl+\` or Cmd+\`)
2. Split terminal (click split icon or Ctrl+Shift+5)

**Terminal 1 (Claude Code):**
```bash
./.vscode-integration/claude-wrapper.sh
# Or if you set up aliases:
# claude-bridge
```

**Terminal 2 (Codex):**
```bash
./.vscode-integration/codex-wrapper.sh
# Or if you set up aliases:
# codex-bridge
```

## 🔧 Manual Control

### Send Messages Between AIs
```bash
# From Claude to Codex
node .vscode-integration/claude-codex-bridge.js send claude codex "I'm implementing auth, handle the tests"

# From Codex to Claude
node .vscode-integration/claude-codex-bridge.js send codex claude "Tests are ready, proceed with integration"
```

### Check Shared Context
```bash
# View current shared context
node .vscode-integration/claude-codex-bridge.js context

# Update context (both AIs can see)
node .vscode-integration/claude-codex-bridge.js update '{"currentTask":"Build authentication","files":["src/auth.js","tests/auth.test.js"]}'
```

### Read Messages
```bash
# Claude reads messages from Codex
node .vscode-integration/claude-codex-bridge.js read claude

# Codex reads messages from Claude
node .vscode-integration/claude-codex-bridge.js read codex
```

### Monitor Changes
```bash
# Watch for context updates in real-time
node .vscode-integration/claude-codex-bridge.js watch
```

## 🎯 Common Workflows

### 1. Parallel Development
**Claude (Terminal 1):** Implements feature
**Codex (Terminal 2):** Writes tests simultaneously

```bash
# Claude updates context
node .vscode-integration/claude-codex-bridge.js update '{"currentTask":"Auth implementation","files":["src/auth.js"],"status":"in-progress"}'

# Codex sees update and starts tests
# Context automatically shared
```

### 2. Code Review Flow
**Claude:** Makes changes
**Codex:** Reviews changes

```bash
# Claude signals completion
node .vscode-integration/claude-codex-bridge.js send claude codex "Auth module complete, ready for review"

# Codex reads message and reviews
node .vscode-integration/claude-codex-bridge.js read codex
```

### 3. Handoff Pattern
**Claude:** Works on backend
**Codex:** Takes over frontend

```bash
# Context handoff
node .vscode-integration/claude-codex-bridge.js update '{
  "currentTask":"Frontend integration",
  "decisions":["REST API at /api/auth","JWT tokens","Rate limiting enabled"],
  "handoff":"Claude→Codex"
}'
```

## 📂 Bridge Files Location

All bridge data is stored in `.vscode-integration/bridge/`:
- `messages.json` - Message queue between AIs
- `shared-context.json` - Current task context
- `state.json` - Active AI registration

**Auto-synced** - Changes detected automatically within 1 second.

## 🔥 Advanced: LonicFLex Integration

The bridge integrates with LonicFLex's Universal Context System:

```javascript
const ClaudeCodexBridge = require('./.vscode-integration/claude-codex-bridge');
const bridge = new ClaudeCodexBridge();

// In your LonicFLex agents
bridge.updateContext({
  currentTask: 'Multi-agent PR review',
  activeAgents: ['claude', 'codex'],
  files: ['src/auth.js', 'tests/auth.test.js']
});

// Listen for updates
bridge.on('message', ({ from, to, message }) => {
  console.log(`${from} → ${to}: ${message}`);
});

bridge.on('context-update', (context) => {
  console.log('Context changed:', context);
});
```

## 🛠️ Troubleshooting

### Bridge not working?
```bash
# Check bridge status
node .vscode-integration/claude-codex-bridge.js context

# Clear stale messages
node .vscode-integration/claude-codex-bridge.js clear
```

### Messages not syncing?
```bash
# Verify bridge directory exists
ls -la .vscode-integration/bridge/

# Check file permissions
chmod -R 755 .vscode-integration/
```

### Start fresh?
```bash
# Remove bridge data
rm -rf .vscode-integration/bridge/

# Re-run bridge command to recreate
node .vscode-integration/claude-codex-bridge.js context
```

## 💡 Tips

1. **Keep context updated** - Both AIs benefit from shared context
2. **Use messages for coordination** - Avoid duplicate work
3. **Watch mode is your friend** - Monitor changes in third terminal
4. **Leverage LonicFLex agents** - Integrate with existing multi-agent system

## 🎬 Example Session

**Terminal 1 (Claude):**
```
> Implement user authentication
> Update context: "Building JWT auth with refresh tokens"
> Send to Codex: "Auth service ready for testing"
```

**Terminal 2 (Codex):**
```
> Read messages from Claude
> Context shows: JWT auth implementation
> Write comprehensive auth tests
> Send to Claude: "Tests passing, 95% coverage"
```

**Terminal 3 (Monitor):**
```bash
node .vscode-integration/claude-codex-bridge.js watch
# Shows real-time updates from both AIs
```

---

**Need help?** Check `claude-codex-bridge.js` source code or run without args for CLI help.
