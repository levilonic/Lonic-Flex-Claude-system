# Deprecated GitHub Workflows

This directory contains workflows that have been deprecated and are no longer active.

---

## ci-cd.yml.deprecated

**Deprecated**: October 1, 2025
**Reason**: Workflow calls non-existent npm scripts causing failures

### Issues Found

1. **Line 42**: Calls `npm run demo-security-scanner` - script doesn't exist
2. **Line 77**: Calls `npm run demo-db` - script doesn't exist
3. **Line 85**: Calls `npm run demo-testing-framework` - script doesn't exist
4. **Line 129**: Calls `npm run demo-performance` - script doesn't exist
5. **Multiple deployment scripts**: Not implemented yet

### Why It Was Causing Failures

The workflow was aspirational - designed for a full production CI/CD pipeline that doesn't exist yet. It attempted to run many scripts that were never implemented, causing the "CI/CD Pipeline" workflow to fail on every push.

### Active Workflows (Still Working)

We have 4 working workflows that provide complete CI/CD coverage:

1. **🔒 Test Enforcement - MANDATORY** (`test-enforcement.yml`)
   - Enforces 100% test coverage
   - Required status check for merges
   - **Status**: ✅ Working

2. **LonicFLex CI/CD Pipeline** (`ci.yml`)
   - Runs all tests (universal context, Phase 3A, multi-agent)
   - Tests on Node 18.x and 20.x
   - **Status**: ✅ Working

3. **LonicFLex Security Scan** (`security.yml`)
   - npm audit
   - Security vulnerability scanning
   - **Status**: ✅ Working

4. **LonicFLex Multi-Agent System** (`multi-agent.yml`)
   - Multi-agent coordination tests
   - **Status**: ✅ Working

### Future Restoration

If we need the advanced features from ci-cd.yml in the future:

1. Implement the missing npm scripts:
   - `demo-security-scanner`
   - `demo-db`
   - `demo-testing-framework`
   - `demo-performance`
   - `deploy:dev`, `deploy:staging`, `deploy:production`
   - All the backup and monitoring scripts

2. Test each script works locally

3. Re-enable the workflow incrementally (job by job)

4. Verify with smoking tests before committing

### Lesson Learned

**Never commit workflows that call non-existent scripts.** Always verify scripts exist and work before referencing them in CI/CD.

---

**Verification**: Run `node test-github-workflows.js` to verify all active workflows are properly configured.
