#!/bin/bash

# Install pre-commit hook for documentation verification
# Usage: bash scripts/install-verification-hook.sh

HOOK_FILE=".git/hooks/pre-commit"

echo "📝 Installing documentation verification pre-commit hook..."

# Create hook content
cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash

# Pre-commit hook: Verify documentation accuracy
echo "🔍 Verifying documentation accuracy..."

npm run verify:docs --silent

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Documentation verification failed!"
    echo "   Fix documentation issues before committing."
    echo ""
    echo "To skip this check (not recommended):"
    echo "  git commit --no-verify"
    echo ""
    exit 1
fi

echo "✅ Documentation verified!"
exit 0
EOF

# Make executable
chmod +x "$HOOK_FILE"

echo "✅ Pre-commit hook installed!"
echo ""
echo "Now every commit will verify documentation accuracy."
echo "To disable: rm .git/hooks/pre-commit"
echo ""