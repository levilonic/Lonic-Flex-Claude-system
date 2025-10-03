#!/bin/bash
# Codex wrapper with Claude bridge integration
# Use this in Terminal 2 instead of plain 'codex' command

BRIDGE_SCRIPT="$(dirname "$0")/claude-codex-bridge.js"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Register Codex as active
node "$BRIDGE_SCRIPT" register codex

# Show startup banner
echo "🤖 Codex AI (with Claude Bridge)"
echo "📁 Project: $PROJECT_ROOT"
echo "🔗 Bridge: Active"
echo "---"

# Function to check for messages from Claude
check_messages() {
    MESSAGES=$(node "$BRIDGE_SCRIPT" read codex 2>/dev/null)
    if [ ! -z "$MESSAGES" ] && [ "$MESSAGES" != "[]" ]; then
        echo ""
        echo "📨 Message from Claude:"
        echo "$MESSAGES" | jq -r '.[].message' 2>/dev/null || echo "$MESSAGES"
        echo ""
    fi
}

# Set up cleanup on exit
cleanup() {
    node "$BRIDGE_SCRIPT" unregister codex
    echo "👋 Codex unregistered from bridge"
}
trap cleanup EXIT

# Start Codex
codex "$@"
