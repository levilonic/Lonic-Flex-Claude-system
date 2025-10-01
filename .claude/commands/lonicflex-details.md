---
description: Deep dive into LonicFLex 12-factor principles and technical specifications
allowed-tools: Read(C:\Users\Levi\Desktop\LonicFLex\**)
---

# LonicFLex Details - 12-Factor Principles & Technical Deep Dive

**Prerequisites**: Must have completed `/lonicflex-init` first

## 🎯 12-FACTOR AGENT PRINCIPLES

### Core Principles Documentation
**Location**: `content/` directory  
**Key Files**:
- [Factor 1: Natural Language to Tool Calls](../../content/factor-1-natural-language-to-tool-calls.md)
- [Factor 2: Own Your Prompts](../../content/factor-2-own-your-prompts.md)  
- [Factor 3: Own Your Context Window](../../content/factor-3-own-your-context-window.md)
- [Factor 4: Tools Are Structured Outputs](../../content/factor-4-tools-are-structured-outputs.md)
- [Factor 5: Unify Execution State](../../content/factor-5-unify-execution-state.md)
- [Factor 6: Launch, Pause, Resume](../../content/factor-6-launch-pause-resume.md)
- [Factor 7: Contact Humans with Tools](../../content/factor-7-contact-humans-with-tools.md)
- [Factor 8: Own Your Control Flow](../../content/factor-8-own-your-control-flow.md)
- [Factor 9: Compact Errors](../../content/factor-9-compact-errors.md)
- [Factor 10: Small, Focused Agents](../../content/factor-10-small-focused-agents.md)
- [Factor 11: Trigger from Anywhere](../../content/factor-11-trigger-from-anywhere.md)
- [Factor 12: Stateless Reducer](../../content/factor-12-stateless-reducer.md)

## 🔧 COMPLIANCE IMPLEMENTATION

### Factor 3 Implementation (Anti-Auto-Compact)
**File**: `factor3-context-manager.js`  
**Status**: ✅ WORKING  
**Purpose**: Custom XML context format to prevent context window issues

### Factor 5 Implementation (Database State)  
**File**: `database/sqlite-manager.js`  
**Status**: ✅ WORKING  
**Purpose**: Unified execution state across all agents

### Factor 10 Implementation (Small Agents)
**File**: `agents/base-agent.js`  
**Status**: ✅ WORKING  
**Rule**: Maximum 8 execution steps per agent (enforced)

### Factor 12 Implementation (State Management)
**File**: `12-factor-compliance-tracker.js`  
**Status**: ✅ WORKING  
**Purpose**: State transition validation and logging

## 📊 CURRENT PROJECT STATUS

### Completed Phases (from PROGRESS-CHECKPOINT.md)
**READ**: [Full Progress Checkpoint](../../PROJECT.md)

**Phase 1-3**: ✅ COMPLETE (15+ of 41 tasks)  
- Core infrastructure built
- Multi-agent coordination working  
- Real agent implementations (no more theatre)
- Database and memory systems operational

**Major Achievement**: Eliminated "implementation theatre" - agents now make real API calls

## 🗂️ PROJECT STRUCTURE

### Agent System (`agents/`)
- **BaseAgent**: Core functionality, Factor 10 compliance
- **Specialized Agents**: GitHub, Security, Code, Deploy, Communication
- **Agent Factory**: Registration and instantiation system

### Database System (`database/`)  
- **SQLite Manager**: WAL mode, session tracking, event logging
- **Schema**: Sessions, agents, events, locks, memory tables

### Memory System (`memory/`)
- **Memory Manager**: Learning and verification
- **Status Verifier**: Anti-bullshit verification system

### Configuration (`auth/`, `.env`)
- **Authentication**: GitHub, Slack API tokens configured
- **Environment**: Production settings, security config

## 🛠️ DEVELOPMENT WORKFLOWS

### Testing Individual Agents
```bash
npm run agents:base     # Core agent functionality
npm run agents:github   # GitHub integration  
npm run agents:security # Security scanning
npm run agents:code     # Claude Code integration
node src/agents/deploy-agent.js   # Docker deployment (broken)
node src/agents/comm-agent.js     # Slack coordination
```

### Multi-Agent Testing
```bash
GITHUB_TOKEN=token npm run demo  # Full workflow
npm run verify-all               # Verify all claims  
npm run verify-discrepancies     # Check honesty
```

### Database Management
```bash
node src/database/sqlite-manager.js     # Test database operations
echo "Auth not implemented"   # Test authentication system
node src/memory/memory-manager.js # Test memory/learning system
```

## 📚 WORKSHOPS & EXAMPLES

**Location**: `workshops/` directory  
**Available**:
- 2025-05: Complete walkthrough sections (00-12)
- 2025-05-17: Alternative workshop version
- 2025-07-16: Latest workshop materials

**External Resources**: `anthropic-resources/`  
- Examples, tutorials, SDKs, courses
- Anthropic cookbook patterns  
- Computer use demos

## 🎯 NEXT LEVEL COMMANDS

For even deeper technical details:
- `/lonicflex-advanced` - Architecture patterns and advanced concepts
- `/lonicflex-troubleshoot` - Common issues and debugging

**Current Focus**: Foundation is solid, deployment infrastructure needs Docker repair