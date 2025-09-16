# Claude Documentation Search

Instantly search and access comprehensive Anthropic Claude documentation without context window abuse.

## Usage

```bash
/claude-docs [search|quick|snippet|capabilities] [query] [--category=<category>]
```

## Commands

### Search Documentation
```bash
/claude-docs search "api authentication"
/claude-docs search "tool use patterns" --category=code_examples
```

### Quick Access
```bash
/claude-docs quick getting_started
/claude-docs quick api_reference
/claude-docs quick code_examples
```

### Context Snippets (for immediate injection)
```bash
/claude-docs snippet "authentication"
/claude-docs snippet "agent patterns"
```

### Discover Capabilities
```bash
/claude-docs capabilities
```

## Categories

- `api_reference` - Authentication, endpoints, models, parameters
- `code_examples` - Jupyter notebooks, implementation patterns  
- `agent_development` - 12-factor agents, architecture patterns
- `sdk_integration` - Python/TypeScript SDKs, platform integrations
- `learning_resources` - Courses, tutorials, training materials

## Examples

**Find API authentication info:**
```bash
/claude-docs search "authentication" --category=api_reference
```

**Get a quick code example:**
```bash
/claude-docs quick code_examples
```

**Inject tool use knowledge:**
```bash
/claude-docs snippet "tool use"
```

## Features

- ✅ Memory-efficient search (no context abuse)
- ✅ Cached results for fast access
- ✅ Context-ready snippets for injection
- ✅ Comprehensive local documentation index
- ✅ Smart categorization and relevance scoring