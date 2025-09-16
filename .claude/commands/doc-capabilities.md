# Documentation Capabilities Discovery

Discover all available documentation resources and capabilities in the LonicFLex system.

## Usage

```bash
/doc-capabilities [detailed]
```

## Quick Reference

### Available Documentation Sources
- **Anthropic Cookbook** - Interactive examples and notebooks
- **12-Factor Agents** - Agent development methodology  
- **Quickstarts** - Ready-to-run project templates
- **Courses** - Structured learning materials
- **SDKs** - Official Python and TypeScript SDKs
- **Tutorials** - Step-by-step guides
- **Claude Code Docs** - Terminal AI assistant documentation

### Search Categories
- `api_reference` - API docs, authentication, endpoints
- `code_examples` - Implementation patterns, examples
- `agent_development` - 12-factor patterns, architecture  
- `sdk_integration` - SDK usage, platform integrations
- `learning_resources` - Courses, tutorials, training

### Quick Access Keys
- `getting_started` - New user introduction
- `api_reference` - API documentation
- `code_examples` - Code samples and patterns
- `agent_patterns` - Agent development patterns  
- `quickstart_projects` - Ready-to-run templates
- `python_sdk` - Python SDK documentation
- `typescript_sdk` - TypeScript SDK documentation

## Examples

### Basic Capabilities
```bash
/doc-capabilities
```

### Detailed Information
```bash  
/doc-capabilities detailed
```

## Integration Commands

After discovering capabilities, use:

```bash
# Search specific categories
/claude-docs search "query" --category=api_reference

# Quick access to resources
/claude-docs quick getting_started

# Get context snippets
/claude-docs snippet "authentication"
```

## Self-Discovery Workflow

1. **Discover capabilities**: `/doc-capabilities`
2. **Explore categories**: Use returned category names in searches
3. **Access resources**: Use quick access keys for instant access
4. **Search efficiently**: Use category filters for targeted results
5. **Inject context**: Use snippets for immediate knowledge injection

## Memory Efficient

- All capability information cached locally
- No external API calls required
- Context-window friendly output
- Structured for easy consumption