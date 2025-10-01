#!/bin/bash

# Batch fix all documentation issues
# Fixes: fake commands, broken links, relative paths

echo "🔧 Fixing all documentation issues..."

# Fix 1: Replace fake demo commands with real ones
echo "Fixing fake npm run demo-* commands..."
find .claude .promptx -name "*.md" -type f -exec sed -i \
  -e 's/npm run demo-base-agent/npm run agents:base/g' \
  -e 's/npm run demo-github-agent/npm run agents:github/g' \
  -e 's/npm run demo-security-agent/npm run agents:security/g' \
  -e 's/npm run demo-code-agent/npm run agents:code/g' \
  -e 's/npm run demo-deploy-agent/node src\/agents\/deploy-agent.js/g' \
  -e 's/npm run demo-comm-agent/node src\/agents\/comm-agent.js/g' \
  -e 's/npm run demo-db/node src\/database\/sqlite-manager.js/g' \
  -e 's/npm run demo-auth/echo "Auth not implemented"/g' \
  -e 's/npm run demo-memory/node src\/memory\/memory-manager.js/g' \
  -e 's/npm run demo-security-scanner/echo "Security scanner not implemented"/g' \
  -e 's/npm run demo-testing-framework/npm run test/g' \
  -e 's/npm run demo-monitoring/echo "Monitoring not implemented"/g' \
  -e 's/npm run demo-performance/echo "Performance not implemented"/g' \
  -e 's/npm run demo-error-handler/echo "Error handler not implemented"/g' \
  -e 's/npm run demo-progress/echo "Progress not implemented"/g' \
  -e 's/npm run demo-/echo "Demo not implemented: /g' \
  {} +

# Fix 2: Fix broken content/ file links
echo "Fixing broken content/ file links..."
find .claude -name "*.md" -type f -exec sed -i \
  -e 's|../content/factor-|../../content/factor-|g' \
  {} +

# Fix 3: Fix broken .promptx links
echo "Fixing broken .promptx links..."
find .claude -name "*.md" -type f -exec sed -i \
  -e 's|\.promptx/personas/|../../.promptx/personas/|g' \
  {} +

# Fix 4: Fix broken root file links
echo "Fixing broken root file links..."
find .claude -name "*.md" -type f -exec sed -i \
  -e 's|\.\./PROGRESS-CHECKPOINT\.md|../../PROJECT.md|g' \
  -e 's|\.\./SYSTEM-STATUS\.md|../../PROJECT.md|g' \
  -e 's|\.\./AGENT-REGISTRY\.md|../../docs/AGENT-REGISTRY.md|g' \
  -e 's|\.\./INFRASTRUCTURE-MAP\.md|../../docs/INFRASTRUCTURE-MAP.md|g' \
  {} +

echo "✅ Documentation fixes applied!"
echo ""
echo "Run 'npm run verify:docs' to verify fixes"