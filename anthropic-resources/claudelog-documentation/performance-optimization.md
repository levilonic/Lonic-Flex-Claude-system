# Performance and Usage Optimization

## Usage Limits and Restrictions

### Plan-Based Limits
- **Pro Plan ($20/month)**: Lower limits compared to Max plans, restricted to Claude 4 Sonnet model
- **Max 5x**: 5x higher usage limits, "supports all-day Sonnet coding without limits"  
- **Max 20x**: Even higher limits for intensive development workflows
- Limits include daily message counts, API rate limits, and context window constraints

### Limit Types
- **Daily Message Counts**: Varies by subscription plan
- **API Rate Limits**: Requests per minute/hour restrictions
- **Context Window Constraints**: Token limits per conversation
- **Model Access**: Some plans restrict available models

## Model Performance Characteristics

### Claude 4 Opus
- **Strengths**: Superior reasoning capabilities, best for complex problems
- **Cost**: 5x more expensive than Sonnet
- **Best For**: Planning, architecture decisions, complex debugging
- **When to Use**: Complex analysis, architectural decisions, difficult problem-solving

### Claude 4 Sonnet  
- **Strengths**: Best balance of performance and speed
- **Cost**: Standard pricing, most cost-effective
- **Best For**: Implementation, routine development tasks
- **When to Use**: Code implementation, standard development work, daily tasks

### Claude Haiku
- **Strengths**: Fast execution, low cost
- **Limitations**: Suitable only for simple tasks
- **Best For**: Simple operations, quick queries
- **When to Use**: Basic tasks, simple code generation, quick questions

## Model Selection Strategies

### Strategic Model Switching
- **Planning Phase**: Use Opus for architecture and complex planning
- **Implementation Phase**: Use Sonnet for code implementation and execution
- **Review Phase**: Use Opus for complex analysis, Sonnet for routine review
- **Quick Tasks**: Use Haiku for simple, straightforward operations

### Cost Optimization
- Strategic model switching optimizes both quality and cost
- Use Opus sparingly for high-value, complex decisions
- Leverage Sonnet for bulk development work
- Reserve Haiku for simple, routine operations

### Quality Optimization
- "Multiple Plan Mode iterations with Sonnet can achieve results approaching Opus-quality intelligence"
- Use Plan Mode to maximize Sonnet effectiveness
- Combine multiple Sonnet sessions for complex analysis
- Strategic iteration can substitute for more expensive model usage

## Performance Considerations

### Platform Performance
- **Native Linux**: "Claude Code typically runs more efficiently on native Linux due to direct system access"
- **WSL2**: "Introduces virtualization layers that can impact performance"
- **Recommendation**: Use native Linux for optimal performance when possible

### System Resource Impact
- Performance depends on system resources and model selected
- WSL2 may introduce slight performance overhead
- Network connectivity affects response times
- Local system performance impacts overall experience

### Response Time Factors
- Model selection significantly impacts response speed
- Server load and demand fluctuations affect performance
- Network latency influences overall responsiveness
- Task complexity determines processing time

## Optimization Techniques

### Context Management
- **Use lean file structures** to minimize token consumption
- **Organize code into smaller, focused files** for better context efficiency
- **Use /compact command** to manage context window when approaching limits
- **Provide clear reading boundaries** to help Claude focus on relevant code

### Workflow Optimization
- **Use Plan Mode** for safe research before execution to prevent costly mistakes
- **Leverage sub-agents** for parallel processing to reduce overall completion time
- **Use CLAUDE.md** for project-specific instructions to reduce repetitive context
- **Employ ultrathink** for complex problem-solving to maximize model effectiveness

### Strategic Usage Patterns
- **Avoid using the last fifth of the context window** to prevent performance degradation
- **Use /clear at logical breakpoints** to maintain optimal context size
- **Add "ultrathink" for complex analysis** to improve reasoning quality
- **Use terminal bell notifications** for task completion alerts to improve workflow

### File and Project Organization
- Break large files into smaller, focused components
- Use explicit numbered steps in instructions for clarity
- Maintain clear project structure and documentation
- Implement consistent naming conventions and organization

## Monitoring and Management

### Usage Tracking
- **CC Usage Tool**: Install with `npm install -g ccusage` to track token consumption
- **Anthropic Console**: Check usage for API users through web interface
- **Built-in Monitoring**: Use /context command to inspect current usage
- **Regular Review**: Monitor usage patterns to identify optimization opportunities

### Context Inspection
- **Use /context command** to display token usage breakdown across:
  - System Prompt
  - System tools
  - MCP tools  
  - Memory files
  - Custom Agents
  - Messages

### Optimization Analysis
- Ask Claude in Plan Mode with "ultrathink" to analyze context inefficiencies
- Identify high token-consuming tools that may not provide sufficient value
- Look for opportunities to reduce unnecessary context consumption
- Regular context cleanup and management

## Limit Recovery and Management

### Recovery Strategies
- **Limit Reset**: Limits typically reset periodically (daily/monthly depending on plan)
- **Model Switching**: Use different models when limits are reached
- **Plan Mode Usage**: Leverage Plan Mode for research without execution limits
- **Strategic Timing**: Schedule intensive work during limit reset periods

### Prevention Strategies
- **Monitor Usage Regularly**: Use CC usage tool and /context command
- **Strategic Model Selection**: Choose appropriate model for task complexity
- **Context Management**: Keep conversations focused and organized
- **Batch Operations**: Group related tasks to minimize overhead

### Emergency Techniques
- Switch to Plan Mode for continued research capability
- Use sub-agents to distribute processing load
- Implement strategic model switching to work within limits
- Utilize multiple Plan Mode iterations for complex problem-solving

## Advanced Optimization Techniques

### Permutation Frameworks
- Build similar features with shared function signatures
- Create reliable variation generation for consistent development
- Use templates and patterns to reduce context consumption
- Implement systematic feature replication strategies

### Multi-Agent Optimization
- Use many small, focused agents instead of few large ones
- Leverage parallel processing to reduce total time
- Implement specialized agents for specific domains
- Coordinate agent results efficiently to minimize context usage

### Context Engineering
- Design conversations to maximize information density
- Use structured approaches to problem-solving
- Implement clear information hierarchies
- Maintain focus on high-value activities

## Performance Troubleshooting

### Common Issues
- **Slow Responses**: Check server status, model selection, and network connectivity
- **Context Limit Errors**: Use /compact, /clear, or reorganize conversation structure
- **Usage Limit Reached**: Switch models, use Plan Mode, or wait for limit reset
- **Inconsistent Performance**: Monitor demand fluctuations and server status

### Diagnostic Steps
1. Check https://status.anthropic.com/ for server status
2. Verify current model and plan limitations
3. Use /context to inspect token usage
4. Review recent usage patterns with monitoring tools
5. Test with simpler tasks to isolate performance issues

### Resolution Strategies
- Strategic model switching based on task requirements
- Context management and cleanup techniques
- Usage pattern optimization and planning
- System and network optimization where applicable

## Source

Content extracted from [claudelog.com](https://claudelog.com/) documentation on performance optimization, usage management, and strategic development approaches.