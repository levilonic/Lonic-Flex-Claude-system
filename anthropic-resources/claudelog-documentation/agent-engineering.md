# Agent Engineering

## Overview

Agent Engineering refers to the systematic creation of specialized AI assistants designed for specific development workflows. While the specific Agent Engineering guide content was not fully accessible from the main site, the concept encompasses creating intelligent project coordinators and specialized assistants.

## Key Concepts

### Orchestrator Agents
- Function as intelligent project coordinators
- Decompose complex requirements into manageable components
- Can be configured with different personalities and specialized roles
- Coordinate between multiple sub-agents and tasks

### Agent Specialization
Agents can be specialized for different domains and personalities:

#### 1. Debugging & Testing Agents
- **Personality**: Playful and investigative
- **Focus**: Bug hunting and testing workflows
- **Use Cases**: Systematic debugging, test case generation, issue identification

#### 2. Code Review & Quality Agents  
- **Personality**: Sharp-eyed and meticulous
- **Focus**: Code quality and review processes
- **Use Cases**: Code analysis, style enforcement, quality assurance

#### 3. Performance & Optimization Agents
- **Personality**: High-energy and focused
- **Focus**: Performance analysis and optimization
- **Use Cases**: Bottleneck identification, optimization strategies, profiling

#### 4. Development & Refactoring Agents
- **Personality**: Gentle and methodical
- **Focus**: Code development and refactoring
- **Use Cases**: Feature implementation, code restructuring, architectural changes

#### 5. Documentation & Communication Agents
- **Personality**: Loving and articulate
- **Focus**: Documentation and communication
- **Use Cases**: Technical writing, API documentation, team communication

#### 6. Operations & Management Agents
- **Personality**: Cool and reliable
- **Focus**: DevOps and project management
- **Use Cases**: Deployment, monitoring, project coordination

## Implementation Strategies

### Agent Configuration
- Configure through CLAUDE.md project files
- Use ~/.claude.json for global agent settings
- Define role-based and split-role agent delegation
- Set up independent context windows for each agent

### Best Practices
- **Use many small, focused agents instead of few large ones**
- Leverage parallel processing for complex tasks
- Strategically assign agents based on specialized roles
- Create clear boundaries and responsibilities for each agent
- Maintain independent context windows to prevent interference

### Integration with Other Systems
- Works alongside Output Styles (which transform main agent personality)
- Integrates with Sub-agent Tactics for parallel execution
- Supports Custom Agent configurations for automatic activation
- Compatible with Plan Mode for safe research and analysis

## Advanced Techniques

### Multi-Perspective Analysis
- Deploy multiple agents with different expert roles simultaneously
- Analyze tasks from security, performance, and architectural perspectives
- Combine insights from diverse specialist viewpoints
- Validate work through multiple expert lenses

### Context Management
- Each agent maintains independent context windows
- Results from agents consume space in main agent's context
- Use /context command to inspect token usage across agents
- Optimize agent deployment to minimize context consumption

## Related Concepts

- **Sub-agent Tactics**: Parallel execution mechanisms
- **Custom Agents**: Automated specialist deployment
- **Output Styles**: Main agent personality transformation
- **Plan Mode**: Safe research and analysis framework

## Source

Content synthesized from [claudelog.com](https://claudelog.com/) documentation on agent engineering fundamentals and specialized AI assistant creation.