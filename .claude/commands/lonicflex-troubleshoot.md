---
description: Common LonicFLex issues, debugging steps, and solutions
allowed-tools: Bash(npm run:*), Read(C:\Users\Levi\Desktop\LonicFLex\**)
---

# LonicFLex Troubleshooting Guide

**Purpose**: Quick resolution of common issues and debugging workflows

## 🚨 CURRENT KNOWN ISSUES

### 1. Docker Engine Connection Failure
**Error**: `connect ENOENT //./pipe/docker_engine`  
**Affected**: DeployAgent, multi-agent workflow  
**Status**: ❌ BLOCKING

**Diagnosis**:
```bash
node src/agents/deploy-agent.js
# Expected: Docker connection error
```

**Solutions**:
1. **Install Docker Desktop** (Windows)
2. **Start Docker Engine**:
   ```bash
   # Check if Docker is running
   docker --version
   docker ps
   ```
3. **Verify Docker Daemon**: Ensure Docker service is started
4. **Test Fix**: `node src/agents/deploy-agent.js` should work after Docker starts

### 2. Unverified Agent Status  
**Issue**: 5/6 agents not tested  
**Risk**: Unknown functionality, possible failures

**Quick Test All Agents**:
```bash
npm run agents:github   # Test GitHub integration
npm run agents:security # Test security scanning  
npm run agents:code     # Test Claude Code integration
node src/agents/comm-agent.js     # Test Slack integration
```

**If Agent Fails**:
1. Check error message for missing dependencies
2. Verify API tokens in `.env` file
3. Test network connectivity
4. Check agent-specific requirements

## 🔧 DEBUGGING WORKFLOWS

### Agent Execution Debugging
```bash
# Test individual agent
echo "Demo not implemented: [agent-name]-agent

# Test with verbose output
DEBUG=* npm run agents:base

# Check database state after agent run
sqlite3 database/claude-agents.db "SELECT * FROM agents ORDER BY created_at DESC LIMIT 5;"
```

### Multi-Agent Workflow Debugging
```bash
# Run with GitHub token
GITHUB_TOKEN=ghp_your_token_here npm run demo

# Check where workflow fails
npm run demo 2>&1 | grep -E "(Agent|❌|Error)"

# Verify agent creation
npm run demo 2>&1 | grep "Created real agent"
```

### Database Issues
```bash
# Test database connectivity  
node src/database/sqlite-manager.js

# Check database file exists
ls -la database/claude-agents.db

# Inspect database contents
sqlite3 database/claude-agents.db ".tables"
sqlite3 database/claude-agents.db ".schema sessions"
```

### Memory System Issues
```bash
# Test memory system
node src/memory/memory-manager.js

# Run verification system
npm run verify-all

# Check for discrepancies
npm run verify-discrepancies
```

## ⚠️ COMMON ERROR PATTERNS

### "Module Not Found" Errors
**Cause**: Missing dependencies or incorrect imports

**Fix**:
```bash
# Install all dependencies
npm install

# Check for missing packages
npm ls

# Verify import paths in error stack trace
```

### "Permission Denied" Errors  
**Cause**: File permissions or security restrictions

**Fix**:
```bash
# Check file permissions
ls -la [problematic-file]

# Fix permissions if needed (Linux/Mac)
chmod +x [file]

# On Windows, run as administrator if needed
```

### API Authentication Errors
**Symptoms**: "token not configured", "unauthorized", "forbidden"

**Fix**:
```bash
# Check .env file exists and has tokens
cat .env | grep TOKEN

# Verify token format
# GitHub: ghp_*
# Slack: xoxb-*, xapp-*, etc.

# Test API connectivity
curl -H "Authorization: token YOUR_GITHUB_TOKEN" https://api.github.com/user
```

### Database Lock Errors
**Symptoms**: "database is locked", "SQLITE_BUSY"

**Fix**:
```bash
# Check for running processes
ps aux | grep node

# Kill hanging processes
killall node

# Remove lock files if present
rm -f database/claude-agents.db-*

# Restart affected processes
```

## 🔍 VERIFICATION COMMANDS

### System Health Check
```bash
# Quick system status
npm run verify-all

# Check all major systems
node src/database/sqlite-manager.js && echo "✅ Database OK"
npm run agents:base && echo "✅ Base Agent OK" 
node src/memory/memory-manager.js && echo "✅ Memory System OK"
node factor3-context-manager.js && echo "✅ Context Manager OK"
```

### Agent Status Check
```bash
# Test each agent individually
for agent in base github security code deploy comm; do
  echo "Testing $agent agent..."
  echo "Demo not implemented: $agent-agent && echo "✅ $agent OK" || echo "❌ $agent FAILED"
done
```

### Infrastructure Check
```bash
# Check Docker
docker --version && docker ps && echo "✅ Docker OK" || echo "❌ Docker FAILED"

# Check Node.js
node --version && npm --version && echo "✅ Node.js OK"

# Check database file
ls -la database/ && echo "✅ Database files exist"
```

## 🛠️ STEP-BY-STEP REPAIR

### Full System Repair Sequence
1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Verify Core Systems**:
   ```bash
   node src/database/sqlite-manager.js
   npm run agents:base
   npm run verify-all
   ```

3. **Fix Docker (if needed)**:
   ```bash
   # Install Docker Desktop
   # Start Docker Engine
   docker --version  # Verify installation
   ```

4. **Test All Agents**:
   ```bash
   npm run agents:github
   npm run agents:security  
   npm run agents:code
   node src/agents/comm-agent.js
   node src/agents/deploy-agent.js  # Should work after Docker fix
   ```

5. **Full Workflow Test**:
   ```bash
   GITHUB_TOKEN=ghp_your_token_here npm run demo
   ```

## 📊 PERFORMANCE ISSUES

### Slow Agent Execution
**Causes**: Database locks, API rate limits, network issues

**Diagnosis**:
```bash
# Time agent execution
time npm run agents:base

# Check database performance
sqlite3 database/claude-agents.db "EXPLAIN QUERY PLAN SELECT * FROM agents;"

# Monitor network activity during API calls
```

### Memory Usage Issues
**Symptoms**: High RAM usage, slow responses

**Fix**:
- Check for memory leaks in agent cleanup
- Monitor process memory: `ps aux | grep node`
- Restart services if memory usage grows

### Database Performance  
**Symptoms**: Slow queries, timeouts

**Fix**:
```bash
# Optimize database
sqlite3 database/claude-agents.db "VACUUM;"
sqlite3 database/claude-agents.db "ANALYZE;"

# Check database size
ls -lh database/claude-agents.db
```

## 🆘 EMERGENCY PROCEDURES

### Complete System Reset
**WARNING**: This deletes all data
```bash
# Stop all processes
killall node

# Remove database
rm -f database/claude-agents.db*

# Clear logs
rm -f *.log

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Test basic functionality
npm run agents:base
```

### Backup Current State
```bash  
# Before major changes
cp database/claude-agents.db database/backup-$(date +%Y%m%d).db
cp .env .env.backup
tar -czf lonicflex-backup-$(date +%Y%m%d).tar.gz database/ .env *.js agents/ memory/
```

## 📞 GETTING HELP

### Information to Provide
1. **Error Message**: Full stack trace
2. **Command Executed**: Exact command that failed  
3. **System Info**: OS, Node.js version, Docker status
4. **Recent Changes**: What was modified before issue
5. **Test Results**: Output of verification commands

### Quick Info Collection
```bash
echo "=== SYSTEM INFO ==="
node --version
npm --version  
docker --version 2>/dev/null || echo "Docker not available"

echo "=== ERROR REPRODUCTION ==="
npm run verify-all

echo "=== RECENT LOGS ==="
ls -la *.log 2>/dev/null || echo "No log files found"
```

**Remember**: Follow the communication protocol - provide actual test results, not assumptions about what might be wrong.