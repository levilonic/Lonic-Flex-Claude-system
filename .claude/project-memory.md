# LonicFLex Project Memory - Documentation Integration

## 🎯 ANTHROPIC DOCUMENTATION ACCESS

### Quick Documentation Commands
Always use these commands for instant documentation access:

```bash
# Search documentation efficiently
node docs/doc-search.js search "api authentication"
node docs/doc-search.js capabilities  
node docs/doc-search.js snippet "tool use"

# Quick access to common docs
node docs/doc-search.js quick getting_started
node docs/doc-search.js quick api_reference
node docs/doc-search.js quick code_examples
```

### Documentation Shortcuts (Memory-Efficient)

**API Reference**: @anthropic-resources/examples/anthropic-cookbook/skills/retrieval_augmented_generation/data/anthropic_docs.json
**Code Examples**: @anthropic-resources/examples/anthropic-cookbook/
**Agent Patterns**: @anthropic-resources/12-factor-agents/
**SDKs**: @anthropic-resources/sdks/

### Context-Efficient Documentation Injection

When you need specific Claude documentation knowledge:
1. Use `node docs/doc-search.js snippet <topic>` for 300-char summaries
2. Access structured chunks from anthropic_docs.json directly 
3. Never load full documentation files into context
4. Use the documentation manager cache system

### Available Documentation Categories

- **api_reference**: Authentication, endpoints, models, parameters
- **code_examples**: Jupyter notebooks, implementation patterns  
- **agent_development**: 12-factor agents, architecture patterns
- **sdk_integration**: Python/TypeScript SDKs, platform integrations
- **learning_resources**: Courses, tutorials, training materials

### Self-Discovery Commands

```bash
# Discover your current capabilities
node docs/doc-search.js capabilities

# Get memory-efficient context snippets  
node docs/doc-search.js snippet "authentication"
node docs/doc-search.js snippet "tool use patterns"
node docs/doc-search.js snippet "agent architecture"

# Search by category for targeted results
node docs/doc-search.js category api_reference "rate limits"
node docs/doc-search.js category code_examples "tool use"
```

### Integration with LonicFLex Patterns

- Extend BaseAgent with documentation awareness
- Use Factor 3 context manager for documentation handoffs
- Integrate with SQLite for documentation caching
- Follow 12-factor compliance for documentation tools

### Memory Management

- Documentation manager uses LRU cache (max 50 items)
- Context snippets limited to 300 characters 
- Search results paginated (default 5 items)
- History tracking with 20 item limit

## 🚀 USAGE IN DEVELOPMENT

Always reference local documentation before making API calls or architectural decisions. Use the documentation search tool to enhance your knowledge without context window abuse.

**Remember**: You have complete Anthropic documentation locally. Use it!