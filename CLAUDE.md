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

**LonicFLex Universal Context System - Current Status**: 🎉 PHASE 3A COMPLETE ✅

This project uses:
- **Language/Framework**: Node.js with Universal Context preservation system
- **Build Tool**: `node demo-phase3a-real-workflow.js` (real-world context workflows)
- **Testing**: `node test-universal-context.js`, `node test-phase3a-integration.js`  
- **Architecture**: Universal Context System with external integrations (GitHub + Slack)
- **Command Interface**: `/start`, `/save`, `/resume`, `/list`, `/switch`, `/status`

**🎉 UNIVERSAL CONTEXT SYSTEM PHASES COMPLETED**: 
✅ Phase 2: Universal Context System - 98.2% test success rate
✅ Phase 2A: Universal Context Engine - 100% test success rate
✅ Phase 2B: Unified Command System - 100% test success rate  
✅ Phase 2C: Multi-Context Workspace - 95.5% test success rate
✅ Phase 3A: External System Integration - 100% test success rate

**🚀 SYSTEM READY**: Production-ready context preservation system that solves Claude chat context loss with external integrations

## Core Principles (All Personas)

1. **READ FIRST**: Always read at least 1500 lines to understand context fully
2. **DELETE MORE THAN YOU ADD**: Complexity compounds into disasters
3. **FOLLOW EXISTING PATTERNS**: Don't invent new approaches
4. **BUILD AND TEST**: Run `npm run demo && npm run test-multi-branch` after changes
5. **COMMIT FREQUENTLY**: Every 5-10 minutes for meaningful progress

## File Structure Reference

**LonicFLex Universal Context System Structure**

```
./
├── universal-context-commands.js   # ✅ Complete CLI interface with external integration
├── factor3-context-manager.js     # ✅ Enhanced with universal context support
├── context-management/            # ✅ Context preservation core
│   ├── context-scope-manager.js   # Session vs project logic
│   ├── context-window-monitor.js  # Real-time monitoring
│   ├── context-pruner.js          # Intelligent compression
│   └── token-counter.js           # Performance optimization
├── external-integrations/         # ✅ Phase 3A: External system integration
│   ├── simplified-external-coordinator.js  # Production API coordination
│   ├── github-context-integration.js       # Automatic branch creation
│   └── slack-context-integration.js        # Rich team notifications
├── memory/                        # Learning and verification
│   ├── memory-manager.js          # Lesson recording
│   └── status-verifier.js         # Anti-bullshit verification
├── test-universal-context.js      # ✅ Core system testing (100% success)
├── test-phase3a-integration.js    # ✅ External integration testing (100% success)
├── demo-phase3a-real-workflow.js  # ✅ Real-world validation
├── .promptx/                      # Agent personas
│   └── personas/
├── CLAUDE.md                      # This file
└── current-session-context.xml    # Factor 3 context preservation
```

## Common Commands (All Personas)

**LonicFLex Universal Context System Commands**

```bash
# Core Universal Context System
node test-universal-context.js        # ✅ Universal Context System (100% success)
node test-unified-commands.js         # ✅ Command interface (100% success)
node test-multi-context-workspace.js  # ✅ Multi-context support (95.5% success)

# External System Integration
node test-phase3a-integration.js      # ✅ External integration (100% success)
node demo-phase3a-real-workflow.js    # ✅ Real-world workflow validation

# Context Commands (CLI Interface)
# /start <context-name> [--session|--project] --goal="..."
# /save [context-name] - Save current state
# /resume <context-name> - Resume previous work
# /list - Show all contexts
# /switch <context-name> - Switch to different context
# /status - System health check

# Context Testing Components
node context-management/context-scope-manager.js    # Session vs project logic
node external-integrations/simplified-external-coordinator.js  # External APIs
```

## 🎯 CURRENT PROJECT STATE (September 2025)

**STATUS**: 🎉 PHASE 3A COMPLETE ✅  
**IMPLEMENTED**: Universal Context System with external integrations (GitHub + Slack)  
**SYSTEM STATUS**: Production-ready context preservation system solving Claude chat context loss

### Universal Context System Phases Completed:
**Phase 2 - Universal Context System (98.2% test success rate)**: 
- ✅ **Phase 2A**: Universal Context Engine (100% test success) - Core context preservation
- ✅ **Phase 2B**: Unified Command System (100% test success) - CLI interface with /start, /save, /resume
- ✅ **Phase 2C**: Multi-Context Workspace (95.5% test success) - Simultaneous sessions + projects

**Phase 3A - External System Integration (100% test success rate)**:
- ✅ **SimplifiedExternalCoordinator**: Production-ready API coordination (498 lines)
- ✅ **GitHub Integration**: Automatic branch creation for every context
- ✅ **Slack Integration**: Rich formatted notifications with context details
- ✅ **Real-World Validation**: Comprehensive testing and workflow demos

### Core Capabilities Delivered:
- ✅ **Context Preservation**: Cross-session context survival with intelligent compression (70%+ efficiency)
- ✅ **Multi-Context Support**: Simultaneous sessions and projects with perfect isolation
- ✅ **External Integration**: Automatic GitHub branch creation and Slack team notifications
- ✅ **Command Interface**: Complete CLI with auto-detection and error handling
- ✅ **Performance**: Sub-2-second context operations with real-time monitoring

### Phase 3B Ready:
🚀 **Next Phase**: Advanced Context Features - Long-term persistence, health monitoring, performance optimization

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

## 🎯 Universal Context System Usage

**Production Ready**: The system is ready for immediate use to solve Claude chat context loss.

**Basic Usage**:
```bash
# Create a session context for quick tasks
/start fix-auth-bug --session --goal="Fix authentication timeout"

# Create a project context for long-term work  
/start ai-review-system --project --vision="Intelligent code analysis system"

# Resume previous work
/resume fix-auth-bug

# List all contexts
/list

# Check system status
/status
```

**With External Integrations** (requires GITHUB_TOKEN and SLACK_BOT_TOKEN):
- Automatic GitHub branch creation: `context/session-{name}` or `context/project-{name}`
- Real-time Slack notifications with rich formatting and context details
- Team coordination through external system integration

---

*Generated by promptx - Agent personas are in .promptx/personas/*
