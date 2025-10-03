# PM2 Windows Named Pipe Issue

## Problem
PM2 daemon fails to start on Windows with EPERM error when trying to create named pipes:

```
Error: connect EPERM //./pipe/rpc.sock
  errno: -4048,
  code: 'EPERM',
  syscall: 'connect',
  address: '//./pipe/rpc.sock'
```

## Root Cause
- PM2 uses `pm2-axon` library for RPC communication
- On Windows, it tries to create named pipes (`\\.\pipe\rpc.sock`)
- Node.js 22.x + Windows has permission issues creating these pipes
- The PM2 daemon spawns but fails during socket initialization
- This leaves PM2 in a broken state where all commands fail

## Attempted Fixes
1. ❌ Killed and restarted PM2 daemon
2. ❌ Deleted and recreated .pm2 directory
3. ❌ Tried forcing TCP mode with `PM2_RPC_PORT` environment variable
4. ❌ Upgraded PM2 to latest version (6.0.13)
5. ❌ Attempted admin privileges (UAC prompt blocked)

## Known Issue
- https://github.com/Unitech/pm2/issues/5110
- https://github.com/Unitech/pm2/issues/5267
- This is a long-standing PM2 + Windows + modern Node.js incompatibility

## Production Solution: start-services.js

We've created a production-ready service manager that works flawlessly on Windows:

### Features
- ✅ Starts all 13 services systematically
- ✅ Port conflict detection before startup
- ✅ 10-second startup timeout with graceful handling
- ✅ Health check verification
- ✅ Process tracking with PIDs
- ✅ Graceful shutdown with Ctrl+C
- ✅ Comprehensive startup summary

### Usage
```bash
# Start all services
node start-services.js

# Verify all services are running
curl http://localhost:3007/health  # Master
curl http://localhost:3002/health  # GitHub
curl http://localhost:3006/health  # Slack
# ... etc for all 13 services
```

### Production Status
**✅ 13/13 services running successfully** with start-services.js

All services respond to health checks and handle graceful degradation when external APIs are unavailable.

## Recommendation
Use `start-services.js` as the production service manager for Windows environments. PM2 can be reconsidered when:
1. Deploying to Linux/macOS (PM2 works fine on Unix)
2. PM2 fixes their Windows named pipe issues
3. We need advanced features like clustering or auto-restart (can be added to start-services.js)

---
*Last updated: 2025-10-01*
*Issue status: WORKAROUND IMPLEMENTED*
