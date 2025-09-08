# Custom Agents

## Overview

Custom agents are specialized AI assistants designed for specific tasks and workflows that enable "task delegation and parallel processing" within development environments. They represent automated specialist deployment that activates based on specialized configurations.

## Key Characteristics

### Automation and Specialization
- Can be configured with different personalities and roles
- Operate with independent context windows
- Capable of performing parallel, asynchronous tasks
- Automatically activate based on task type and configuration

### Configuration Integration
- Customizable through CLAUDE.md project configuration
- Configurable via ~/.claude.json settings
- Support role-based and split-role agent delegation
- Seamless integration with manual sub-agent deployment

### Context Independence
- Each custom agent maintains its own context window
- Results consume main agent context, not intermediate work
- Prevents context pollution from specialized processing
- Enables handling of complex, multi-faceted projects

## Agent Personality Categories

### 1. Debugging & Testing Agents
- **Personality**: Playful and investigative
- **Focus**: Bug hunting and systematic testing
- **Capabilities**:
  - Systematic debugging approaches
  - Test case generation and validation
  - Issue identification and reproduction
  - Root cause analysis

### 2. Code Review & Quality Agents
- **Personality**: Sharp-eyed and meticulous  
- **Focus**: Code quality and review processes
- **Capabilities**:
  - Code analysis and style enforcement
  - Quality assurance and standards compliance
  - Security vulnerability identification
  - Best practice enforcement

### 3. Performance & Optimization Agents
- **Personality**: High-energy and focused
- **Focus**: Performance analysis and optimization
- **Capabilities**:
  - Bottleneck identification and analysis
  - Optimization strategy development
  - Performance profiling and measurement
  - Resource usage analysis

### 4. Development & Refactoring Agents
- **Personality**: Gentle and methodical
- **Focus**: Code development and architectural changes
- **Capabilities**:
  - Feature implementation and development
  - Code restructuring and refactoring
  - Architectural decision making
  - Pattern implementation

### 5. Documentation & Communication Agents
- **Personality**: Loving and articulate
- **Focus**: Technical writing and communication
- **Capabilities**:
  - Technical documentation creation
  - API documentation and examples
  - Team communication facilitation
  - Knowledge base maintenance

### 6. Operations & Management Agents
- **Personality**: Cool and reliable
- **Focus**: DevOps and project coordination
- **Capabilities**:
  - Deployment and infrastructure management
  - Monitoring and alerting setup
  - Project coordination and planning
  - Process optimization

## Implementation Strategies

### Configuration Setup

#### Global Configuration (~/.claude.json)
```json
{
  "customAgents": {
    "securityReviewer": {
      "personality": "security-focused",
      "activationTriggers": ["security", "authentication", "authorization"],
      "tools": ["security-scan", "vulnerability-check"]
    }
  }
}
```

#### Project Configuration (CLAUDE.md)
```markdown
## Custom Agents

### Security Agent
- Automatically activates for security-related changes
- Performs security reviews on authentication code
- Validates authorization implementations

### Performance Agent  
- Monitors for performance-critical changes
- Suggests optimization strategies
- Analyzes resource usage patterns
```

### Best Practices

#### Agent Sizing and Focus
- **Use many small, focused agents instead of few large ones**
- Create specialized agents for specific domains
- Avoid overlapping responsibilities between agents
- Maintain clear boundaries and expertise areas

#### Parallel Processing Optimization
- Leverage parallel processing for complex tasks
- Strategically assign agents based on specialized roles
- Coordinate results through main agent
- Minimize sequential dependencies

#### Context Management
- Design agents to minimize context consumption
- Use independent contexts for isolated processing
- Return only essential results to main context
- Monitor usage through /context command

## Advanced Techniques

### Multi-Agent Coordination
- Deploy multiple custom agents simultaneously
- Coordinate specialized expertise across domains
- Enable comprehensive analysis from multiple perspectives
- Validate solutions through diverse expert review

### Conditional Activation
- Configure agents to activate based on file types, keywords, or patterns
- Set up automatic deployment for specific workflows
- Create context-sensitive agent selection
- Enable adaptive expertise based on project needs

### Integration Patterns
- Combine with manual sub-agent deployment for hybrid approaches
- Integrate with Output Styles for personality consistency
- Use with Plan Mode for safe agent strategy validation
- Coordinate with existing development workflows

## Common Use Cases

### Automated Code Review
- Security agents automatically review authentication changes
- Performance agents analyze optimization opportunities
- Quality agents enforce coding standards and best practices
- Documentation agents ensure proper technical documentation

### Specialized Development Workflows
- Frontend agents handle UI/UX specific tasks
- Backend agents manage API and database operations
- DevOps agents handle deployment and infrastructure
- Testing agents create comprehensive test suites

### Multi-Domain Analysis
- Security perspective on new features
- Performance impact analysis
- User experience evaluation
- Maintenance and scalability assessment

## Performance Considerations

### Resource Optimization
- Independent context windows prevent main agent bloat
- Parallel execution reduces overall completion time
- Specialized expertise improves solution quality
- Automated activation reduces manual overhead

### Scalability Benefits
- Handle larger projects through agent specialization
- Maintain consistent expertise across project growth
- Enable team-like collaboration through multiple perspectives
- Support complex multi-component development

## Integration with Other Features

### Sub-agent Tactics
- Custom agents can deploy as automatic sub-agents
- Manual sub-agents can utilize custom agent configurations
- Hybrid manual/automatic deployment strategies
- Seamless integration between approaches

### Output Styles
- Custom agents can utilize specialized Output Styles
- Maintain personality consistency across agent types
- Configure communication styles appropriate to agent roles
- Enable style switching based on agent activation

### Plan Mode
- Use Plan Mode to design custom agent strategies
- Validate agent deployment approaches safely
- Research optimal agent configurations
- Test agent interactions before implementation

## Troubleshooting

### Common Issues
- Agents not activating: Check activation triggers and configuration
- Context conflicts: Ensure proper agent separation and scope
- Performance issues: Monitor agent resource usage and optimization

### Resolution Strategies
- Use /context to inspect agent resource consumption
- Validate configuration syntax and trigger patterns
- Test agent activation with simple scenarios
- Monitor agent completion and result integration

## Source

Content extracted from [claudelog.com](https://claudelog.com/) documentation on custom agents and automated specialist deployment systems.