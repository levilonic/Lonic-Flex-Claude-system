# Sub-agent Tactics

## Definition

Sub-agents are "parallel task executors that run independently with their own context window." They represent one of the most powerful features for scaling development workflows in Claude Code.

## Key Characteristics

### Independent Operation
- Perform tasks significantly faster than the interactive Claude instance
- Each sub-agent has a separate context window
- Only their returned results consume space in the main agent's context
- Indicated in the Claude Code UI by a "flashing bubble that turns green when complete"

### Parallel Processing
- Execute multiple tasks simultaneously instead of sequentially
- Dramatically improve development efficiency
- Allow the main agent to coordinate while sub-agents handle specific work
- Enable complex multi-step workflows without sequential waiting

## Types of Sub-Agents

### 1. Manual Sub-Agents
- **Activation**: Provide explicit delegation through the Task tool
- **Control**: Direct control over parallel operations
- **Use Case**: When you need precise control over task delegation
- **Example**: Launching specific research or file operation tasks

### 2. Custom Agents
- **Activation**: Activate automatically based on specialized configurations
- **Context**: Isolated contexts and custom tool access
- **Use Case**: Specialized expertise that activates based on task type
- **Example**: Security agents that automatically review code changes

## Use Cases

### Complex Multi-Step Workflows
- Research and writing files independently on different topics
- Multiple file operations across different parts of a codebase
- Parallel analysis of different system components
- Simultaneous handling of frontend and backend tasks

### Specialized Expertise Requirements
- Security reviews while development continues
- Performance analysis during feature implementation
- Documentation generation alongside code development
- Testing and validation in parallel with development

### Research and Analysis
- Exploring unfamiliar codebases from multiple angles
- Analyzing different architectural approaches simultaneously
- Gathering information from multiple sources in parallel
- Cross-referencing documentation and code simultaneously

## Advanced Technique: Split Role Sub-Agents

### Concept
Utilize multiple sub-agents with different expert roles to analyze tasks from diverse perspectives simultaneously.

### Implementation
- Deploy security expert, senior engineer, and UX specialist sub-agents
- Each analyzes the same task from their specialized viewpoint
- Combine insights for comprehensive understanding
- Validate solutions through multiple expert lenses

### Benefits
- **Multi-Perspective Analysis**: Get insights from different specialist viewpoints
- **Comprehensive Coverage**: Ensure no critical aspects are overlooked  
- **Quality Assurance**: Cross-validate solutions through expert review
- **Risk Mitigation**: Identify potential issues from multiple angles

## Best Practices

### Strategic Deployment
- **Use many small, focused agents instead of few large ones**
- Launch using the Task tool for manual control
- Strategically delegate tasks to optimize efficiency
- Consider the expertise needed for each sub-task

### Performance Optimization
- Leverage parallel processing for complex tasks
- Use sub-agents for tasks requiring multiple file operations
- Deploy different expert roles to validate and analyze work
- Minimize sequential dependencies between sub-agents

### Context Management
- Remember that sub-agents have independent context windows
- Only results consume main agent context, not the sub-agent's work
- Use this to handle large research tasks without context bloat
- Monitor context usage with the /context command

## Integration with Other Features

### Plan Mode
- Use Plan Mode to safely plan sub-agent deployment
- Research optimal sub-agent strategies before execution
- Validate sub-agent approaches without making changes

### Output Styles
- Sub-agents can utilize different Output Styles for specialized personalities
- Main agent personality doesn't affect sub-agent behavior
- Configure sub-agents with appropriate styles for their roles

### Custom Agents
- Custom Agents can automatically deploy as sub-agents
- Specialized configurations trigger appropriate sub-agent types
- Seamless integration between manual and automatic sub-agent deployment

## Performance Advantages

### Speed Benefits
- **Parallel Execution**: Multiple tasks run simultaneously
- **Reduced Wait Time**: No sequential bottlenecks
- **Efficient Resource Utilization**: Maximum use of available processing
- **Faster Completion**: Overall project timeline reduction

### Context Efficiency
- Independent context windows prevent main agent bloat
- Only results consume main context, not intermediate work
- Enables handling of larger projects without context limits
- Better token usage optimization

## Common Patterns

### Research and Implementation
1. Deploy research sub-agent to gather information
2. Deploy implementation sub-agent to write code
3. Deploy validation sub-agent to review and test
4. Coordinate results in main agent

### Multi-Component Development
1. Frontend sub-agent handles UI components
2. Backend sub-agent manages API development  
3. Database sub-agent handles schema and queries
4. Testing sub-agent creates comprehensive test suites

### Analysis and Documentation
1. Code analysis sub-agent reviews existing implementation
2. Documentation sub-agent creates technical documentation
3. Security sub-agent performs security review
4. Performance sub-agent analyzes optimization opportunities

## Troubleshooting

### Common Issues
- Sub-agents not completing: Check task complexity and scope
- Context conflicts: Ensure proper task separation
- Performance issues: Consider sub-agent count and resource usage

### Best Practices for Resolution
- Use Plan Mode to validate sub-agent strategies
- Break down complex tasks into smaller sub-agent operations
- Monitor sub-agent completion through UI indicators
- Leverage the /context command to track resource usage

## Source

Content extracted from [claudelog.com](https://claudelog.com/) documentation on sub-agent tactics and parallel processing strategies.