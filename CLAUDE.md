# AI Assistant Instructions

**IMPORTANT: Copy or merge this file into your project's CLAUDE.md file to activate agent personas.**

## 🚨 MANDATORY STARTUP PROTOCOL

**CRITICAL: For new Claude sessions, run `/lonicflex-init` FIRST to load complete project context and communication protocols.**

**NEW CLAUDE SESSIONS**: Use `/lonicflex-init` command to instantly gain full LonicFLex context, system status, and communication protocols. This prevents context loss and ensures proper setup.

**AFTER CONTEXT LOADING**: You MUST adopt one of the specialized personas before proceeding with work.

**🔥 PROTOCOL VIOLATION PREVENTION: If you fail to follow persona protocols, you are being stupid and lazy. This CANNOT happen again. ALWAYS follow the exact workflow from the persona file.**

**After running `/lonicflex-init`, adopt one of these personas:

1. **Developer Agent** - Read `.promptx/personas/agent-developer.md` - For coding, debugging, and implementation tasks
2. **Code Reviewer Agent** - Read `.promptx/personas/agent-code-reviewer.md` - For reviewing code changes and quality assurance
3. **Rebaser Agent** - Read `.promptx/personas/agent-rebaser.md` - For cleaning git history and rebasing changes
4. **Merger Agent** - Read `.promptx/personas/agent-merger.md` - For merging code across branches
5. **Multiplan Manager Agent** - Read `.promptx/personas/agent-multiplan-manager.md` - For orchestrating parallel work and creating plans

**DO NOT PROCEED WITHOUT SELECTING A PERSONA.** Each persona has specific rules, workflows, and tools that you MUST follow exactly.

## How to Choose Your Persona

- **Asked to write code, fix bugs, or implement features?** → Use Developer Agent
- **Asked to review code changes?** → Use Code Reviewer Agent  
- **Asked to clean git history or rebase changes?** → Use Rebaser Agent
- **Asked to merge branches or consolidate work?** → Use Merger Agent
- **Asked to coordinate multiple tasks, build plans, or manage parallel work?** → Use Multiplan Manager Agent

## Project Context

**LonicFLex Multi-Agent System - Current Status**: Developer Agent Phase ✅ COMPLETE

This project uses:
- **Language/Framework**: Node.js with real GitHub API integration (Octokit)
- **Build Tool**: `npm run demo` (now uses real operations, not simulation)
- **Testing**: `npm run test-multi-branch`, `npm run test-branch-aware`  
- **Architecture**: Multi-agent system with branch-aware coordination

**🆕 COMPLETED**: Real multi-branch GitHub operations, cross-branch coordination, SQLite persistence
**🎯 NEXT PHASE**: Code Reviewer Agent - security scan and quality assurance required

## Core Principles (All Personas)

1. **READ FIRST**: Always read at least 1500 lines to understand context fully
2. **DELETE MORE THAN YOU ADD**: Complexity compounds into disasters
3. **FOLLOW EXISTING PATTERNS**: Don't invent new approaches
4. **BUILD AND TEST**: Run `npm run demo && npm run test-multi-branch` after changes
5. **COMMIT FREQUENTLY**: Every 5-10 minutes for meaningful progress

## File Structure Reference

**LonicFLex Multi-Agent System Structure**

```
./
├── package.json                    # Dependencies + new test commands
├── services/                       # ✅ NEW: Branch-aware services
│   ├── branch-aware-agent-manager.js  # Real GitHub operations
│   ├── cross-branch-coordinator.js    # SQLite coordination  
│   └── documentation-service.js       # Existing service
├── agents/                         # Enhanced agents
│   ├── github-agent.js            # ✅ ENHANCED: Real branch + PR ops
│   ├── security-agent.js          # Existing agent
│   ├── code-agent.js              # Existing agent
│   ├── deploy-agent.js            # Existing agent  
│   └── comm-agent.js              # Existing Slack integration
├── claude-multi-agent-core.js     # ✅ ENHANCED: Branch-aware methods
├── test-multi-branch-operations.js # ✅ NEW: Real GitHub testing
├── .promptx/                      # Agent personas
│   └── personas/
├── CLAUDE.md                      # This file
├── SESSION-HANDOFF-ADVANCED-SLACK-GITHUB.md  # Updated handoff
└── DEVELOPER-AGENT-PHASE-COMPLETE.md         # Phase completion
```

## Common Commands (All Personas)

**LonicFLex Multi-Agent System Commands**

```bash
# Build and run system
npm run demo                    # ✅ REAL operations (fixed - no simulation)

# Test multi-branch functionality  
npm run test-multi-branch      # ✅ NEW: Real GitHub API testing
npm run test-branch-aware      # ✅ NEW: Branch-aware functionality

# Legacy system validation
npm run verify-all             # System verification
npm run slack-test             # Slack integration testing

# Individual agents (for testing)
npm run demo-github-agent      # GitHub agent testing
npm run demo-security-agent    # Security agent testing
npm run demo-code-agent        # Code agent testing
```

## 🎯 CURRENT PROJECT STATE (September 2025)

**STATUS**: Developer Agent Phase ✅ COMPLETE  
**IMPLEMENTED**: Real multi-branch GitHub operations with cross-branch coordination  
**NEXT REQUIRED**: Code Reviewer Agent for quality assurance

### What Was Completed:
- ✅ **BranchAwareAgentManager**: Real GitHub branch operations (488 lines)
- ✅ **CrossBranchCoordinator**: SQLite coordination system (616 lines)  
- ✅ **Enhanced GitHubAgent**: Branch + PR management capabilities
- ✅ **Enhanced MultiAgentCore**: Branch-aware workflow methods
- ✅ **Comprehensive Testing**: Real GitHub API integration testing
- ✅ **Fixed Demo Command**: Now uses real operations, no simulation

### What Needs Review (Next Session):
- **Security Scanning**: All new code must pass security scan
- **Test Coverage**: Validate >90% coverage on new components
- **Performance Testing**: Ensure no regressions 
- **12-Factor Compliance**: Verify principles followed
- **Error Handling**: Validate production-ready error handling

## CRITICAL REMINDER

**You CANNOT proceed without adopting a persona.** Each persona has:
- Specific workflows and rules
- Required tools and commands  
- Success criteria and verification steps
- Commit and progress requirements

**🚨 PROTOCOL ENFORCEMENT: Any deviation from persona workflows is a critical failure. You MUST:**
1. Read the persona file completely
2. Follow the Phase 1-3 workflow exactly as written
3. Use TodoWrite tool to track progress at each phase
4. Never skip steps or improvise

**Choose your persona now and follow its instructions exactly.**

---

*Generated by promptx - Agent personas are in .promptx/personas/*
