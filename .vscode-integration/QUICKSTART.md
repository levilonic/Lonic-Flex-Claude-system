# 🚀 Claude + Codex Split Terminal - Quick Start

## Instant Setup (30 seconds)

### 1. Open VS Code Split Terminal
```bash
# Press Ctrl+` (or Cmd+` on Mac) to open terminal
# Click the split icon (or Ctrl+Shift+5) to split terminal
```

### 2. Start Both AIs

**Left Terminal (Claude Code):**
```bash
node .vscode-integration/claude-codex-bridge.js register claude
claude
```

**Right Terminal (Codex):**
```bash
node .vscode-integration/claude-codex-bridge.js register codex
codex
```

### 3. Work Seamlessly

Both AIs now share context automatically!

## 🎯 Common Commands

### Send Messages
```bash
# Claude → Codex
node .vscode-integration/claude-codex-bridge.js send claude codex "Starting feature X"

# Codex → Claude
node .vscode-integration/claude-codex-bridge.js send codex claude "Tests ready"
```

### Check Messages
```bash
# In Claude terminal
node .vscode-integration/claude-codex-bridge.js read claude

# In Codex terminal
node .vscode-integration/claude-codex-bridge.js read codex
```

### Share Context
```bash
# Update shared context (both AIs see this)
node .vscode-integration/claude-codex-bridge.js update '{"currentTask":"Auth","files":["src/auth.js"]}'

# View current context
node .vscode-integration/claude-codex-bridge.js context
```

## 💡 Pro Tips

1. **Keep context updated** - Both AIs work better with shared context
2. **Send messages for handoffs** - Coordinate work between AIs
3. **Open 3rd terminal for monitoring** - Run `watch` command
4. **Cleanup on exit** - Run unregister when done

```bash
# When finished
node .vscode-integration/claude-codex-bridge.js unregister claude
node .vscode-integration/claude-codex-bridge.js unregister codex
```

## 🔥 Example Workflow

```bash
# Terminal 1 (Claude)
node .vscode-integration/claude-codex-bridge.js register claude
node .vscode-integration/claude-codex-bridge.js update '{"currentTask":"Build auth system"}'
claude
> "Implement JWT authentication..."

# Terminal 2 (Codex)
node .vscode-integration/claude-codex-bridge.js register codex
node .vscode-integration/claude-codex-bridge.js read codex  # Sees Claude's context
codex
> "Write tests for JWT auth..."

# Terminal 3 (Monitor)
node .vscode-integration/claude-codex-bridge.js watch
# Shows real-time updates
```

That's it! You're ready to work with Claude and Codex seamlessly.

---

**Full docs:** See `.vscode-integration/README.md`
**Troubleshooting:** Run `node .vscode-integration/claude-codex-bridge.js` for help
