#!/bin/bash
# Claude Code wrapper with Codex bridge integration
# Use this in Terminal 1 instead of plain 'claude' command

BRIDGE_SCRIPT="$(dirname "$0")/claude-codex-bridge.js"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Register Claude as active
node "$BRIDGE_SCRIPT" register claude

# Show startup banner
echo "🤖 Claude Code (with Codex Bridge)"
echo "📁 Project: $PROJECT_ROOT"
echo "🔗 Bridge: Active"
echo "---"

# Function to check for messages from Codex
check_messages() {
    MESSAGES=$(node "$BRIDGE_SCRIPT" read claude 2>/dev/null)
    if [ ! -z "$MESSAGES" ] && [ "$MESSAGES" != "[]" ]; then
        echo ""
        echo "📨 Message from Codex:"
        echo "$MESSAGES" | jq -r '.[].message' 2>/dev/null || echo "$MESSAGES"
        echo ""
    fi
}

# Set up cleanup on exit
cleanup() {
    node "$BRIDGE_SCRIPT" unregister claude
    echo "👋 Claude unregistered from bridge"
}
trap cleanup EXIT

# Start Claude Code
claude "$@"
