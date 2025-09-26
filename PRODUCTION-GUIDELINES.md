# LonicFLex Production System Guidelines

**CRITICAL**: This is a **real-world, production system**, not a demo or thought exercise.

## 🚨 PRODUCTION SYSTEM MANDATE

Every output you provide must be:
- **Runnable, testable, and immediately usable** in our existing stack
- **Designed to integrate** with the current architecture
- **Continuously improvable** — each working version fuels the next iteration

## 🛠️ CORE PRODUCTION RULES

### 1. No Vague Placeholders
- If mocking is unavoidable, clearly mark it as a mock but still provide runnable code
- All code must be copy-paste ready with filenames, ports, configs included
- Replace TODO comments with actual implementation or explicit next steps

### 2. Anticipate Dependencies and Integration
- Anticipate dependencies, edge cases, and integration issues from the start
- Check existing `package.json`, `ecosystem.config.js`, and service architecture before coding
- Validate against current PM2 services, database schema, and API endpoints

### 3. Explicit Documentation of Decisions
- Explicitly state tradeoffs and architectural decisions
- Inline assumptions and document them so they can be refined later
- Include performance implications and scalability considerations

### 4. Maintain System Continuity
- Maintain continuity with prior work and established patterns
- If context is missing, stop and ask to restore it — do not invent or assume
- Follow existing naming conventions, file structures, and code patterns

### 5. Clear, Executable Outputs
- Outputs must be clear, explicit, and copy-paste ready
- Include complete file paths, port numbers, environment variables
- Provide exact commands for testing and verification

### 6. Documented Assumptions
- Inline assumptions and document them for future refinement
- Mark any temporary solutions with clear upgrade paths
- Include migration strategies for breaking changes

### 7. Stop Rather Than Hallucinate
- If you cannot produce a fully working step, stop and request specifics
- Never provide partial implementations without explicit completion plans
- Request missing context rather than making educated guesses

## 🎯 PRODUCTION MINDSET

### We Are Building, Not Theorizing
- This is a **live build** with real consequences for errors
- Each working component becomes foundation for the next
- Every change affects the running system and other components

### Integration-First Approach
- Every new component must integrate with existing architecture
- Consider impact on Universal Context System, PM2 services, and agent coordination
- Test integration points, not just individual component functionality

### Continuous Improvement Cycle
- Each working version provides feedback for the next iteration
- Build measurable improvements with clear success criteria
- Maintain backward compatibility unless explicitly planned breaking changes

## 🔗 INTEGRATION WITH LONICFLEX ARCHITECTURE

### Respect Existing Systems
- **Universal Context System**: Maintain compatibility with session/project contexts
- **PM2 Service Architecture**: Follow port allocation and service naming conventions
- **Multi-Agent Coordination**: Ensure new code works with agent factory patterns
- **Database Schema**: Use existing SQLite WAL setup and table structures

### Follow Established Patterns
- **Configuration**: Use `ecosystem.config.js` for service definitions
- **Testing**: Implement verification commands that work with existing test suite
- **Documentation**: Update relevant `.md` files with new capabilities
- **Error Handling**: Use established error patterns with proper logging

### Required Integration Points
- All services must have health check endpoints
- New agents must extend BaseAgent and register with AgentFactory
- External integrations must work with SimplifiedExternalCoordinator
- Context preservation must use Factor3ContextManager patterns

## ✅ VERIFICATION REQUIREMENTS

### Before Claiming Success
1. **Run actual test commands** - provide specific commands that prove functionality
2. **Test integration points** - verify new code works with existing services
3. **Document verification steps** - include exact commands in deliverables
4. **Check error scenarios** - test failure modes and recovery

### Production Readiness Checklist
- [ ] Code runs without errors in current environment
- [ ] Integration tests pass with existing services
- [ ] Documentation updated with usage examples
- [ ] Performance impact assessed and documented
- [ ] Error handling implemented with proper logging
- [ ] Backward compatibility maintained or migration path provided

## 🚨 FAILURE MODES TO AVOID

### Common Production Pitfalls
- **Placeholder Hell**: Leaving TODOs or incomplete implementations
- **Integration Blindness**: Building in isolation without considering existing system
- **Assumption Creep**: Making unstated assumptions about environment or usage
- **Documentation Debt**: Not updating system documentation with changes
- **Testing Gaps**: Not providing verification commands or integration tests

### Recovery Strategies
- **When Stuck**: Stop, document current state, request specific guidance
- **When Uncertain**: Provide multiple options with clear tradeoffs
- **When Breaking**: Document impact and provide migration strategy
- **When Incomplete**: Mark clearly as partial with explicit completion plan

## 📋 DELIVERABLE STANDARDS

### Every Deliverable Must Include
1. **Complete, runnable code** with no placeholders
2. **Integration instructions** for existing system
3. **Test/verification commands** with expected outputs
4. **Documentation updates** for affected system components
5. **Performance and scalability notes** where applicable

### Code Quality Requirements
- Follow existing code style and patterns
- Include comprehensive error handling
- Provide meaningful logging at appropriate levels
- Use established configuration patterns
- Implement proper cleanup and resource management

---

**Remember**: This is not academic exercise. Real developers will use this code in production. Every line matters. Every integration point matters. Every assumption matters.

**Success Metric**: Another developer can take your deliverable and deploy it successfully without additional clarification.

---

*This document is loaded automatically during `/lonicflex-init` and applies to all agent personas working on the LonicFLex production system.*