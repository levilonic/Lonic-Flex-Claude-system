# Documentation Search Command

Advanced documentation search with multiple output formats and filtering options.

## Usage

```bash
/doc-search <query> [options]
```

## Options

- `--category=<category>` - Search within specific category
- `--format=<format>` - Output format: summary, detailed, links-only  
- `--limit=<number>` - Maximum results (default: 5)
- `--include-context` - Include context snippet for immediate injection

## Examples

### Basic Search
```bash
/doc-search "rate limits"
/doc-search "deployment strategies" --category=agent_development
```

### Formatted Output
```bash
/doc-search "authentication" --format=detailed
/doc-search "code examples" --format=links-only --limit=10
```

### Context Injection Ready
```bash
/doc-search "tool use" --include-context
```

### Category-Specific Search
```bash
/doc-search "python sdk" --category=sdk_integration
/doc-search "jupyter notebooks" --category=code_examples  
```

## Advanced Features

### Search History
Access recent searches:
```bash
/doc-search --history
```

### Memory Management
```bash
/doc-search --memory-stats
/doc-search --clear-cache
```

### Capabilities Discovery
```bash
/doc-search --capabilities
```

## Integration

This command integrates with:
- LonicFLex Documentation Manager
- Anthropic resource index
- Claude Code documentation
- Local caching system