# Output Styles Documentation

## Definition

"Output Styles enable complete personality transformation of Claude Code by replacing the system prompt while preserving all tools and capabilities."

Output Styles represent a fundamental transformation mechanism that changes how Claude Code behaves and communicates while maintaining full functionality.

## Key Concept

Unlike other Claude Code mechanics that augment or add context, Output Styles **completely replace the system prompt**, fundamentally transforming the main agent's core personality and communication style.

## Built-in Output Styles

### 1. Default
- **Description**: Standard software engineering approach
- **Personality**: Professional, technical, focused
- **Use Case**: Regular development tasks and code implementation
- **Communication**: Direct, concise, technically oriented

### 2. Explanatory  
- **Description**: Adds educational insights between tasks
- **Personality**: Teaching-oriented, detailed explanations
- **Use Case**: Learning environments, complex implementations
- **Communication**: Includes reasoning, background context, educational value

### 3. Learning
- **Description**: Collaboration mode with TODO markers
- **Personality**: Collaborative, step-by-step guidance
- **Use Case**: Pair programming, guided development
- **Communication**: Uses TODO(human) markers for collaboration points

## How to Change Output Styles

### Interactive Menu
```bash
/output-style
```
- Access the complete menu of available styles
- Browse descriptions and select interactively
- Preview style characteristics before switching

### Direct Style Switching
```bash
/output-style [style-name]
```
- Switch directly to a specific style
- Immediate activation without menu navigation
- Faster workflow for familiar styles

### Persistence
- Changes automatically save to `.claude/settings.local.json` at the project level
- Project-specific style preferences maintained
- Consistent experience across sessions within the same project

## Creating Custom Output Styles

### Interactive Creation
```bash
/output-style:new I want an output style that...
```
- Describe your desired personality and behavior
- Claude helps design and implement the custom style
- Guided creation process with validation

### Storage Locations

#### User-Level Styles
- **Location**: `~/.claude/output-styles`
- **Scope**: Available across all projects
- **Use Case**: Personal preferences and general-purpose styles

#### Project-Level Styles  
- **Location**: `.claude/output-styles`
- **Scope**: Project-specific styles
- **Use Case**: Styles tailored to specific project needs or team preferences

### Custom Style Format
- Saved as markdown files with style definitions
- Contains personality instructions and behavior modifications
- Maintains compatibility with all Claude Code tools and capabilities

## Key Differences from Other Mechanics

### Output Styles vs. CLAUDE.md
- **Output Styles**: Replace system prompt, change core personality
- **CLAUDE.md**: Adds project context, preserves original personality

### Output Styles vs. --append-system-prompt
- **Output Styles**: Complete replacement of system behavior
- **--append-system-prompt**: Augments existing behavior

### Output Styles vs. Custom Agents
- **Output Styles**: Transform main agent personality
- **Custom Agents**: Create separate specialist agents

## Advanced Usage Patterns

### Project-Specific Styles
- Create styles tailored to specific project requirements
- Align communication style with team preferences
- Adapt personality to project complexity and domain

### Role-Based Styles
- Different styles for different development phases
- Planning style vs. implementation style vs. review style
- Context-appropriate communication and behavior

### Learning and Mentorship Styles
- Educational styles for junior developers
- Collaborative styles for pair programming
- Explanatory styles for complex domain work

## Best Practices

### Style Selection Strategy
- **Default**: For routine development work
- **Explanatory**: When learning new concepts or complex implementations
- **Learning**: For collaborative development and mentorship
- **Custom**: For specialized project needs or team alignment

### Style Switching Timing
- Switch styles based on task type and complexity
- Consider audience (self, team, documentation)
- Align style with project phase (research, implementation, review)

### Custom Style Development
- Start with clear personality and behavior goals
- Test styles with typical project tasks
- Iterate based on effectiveness and team feedback
- Document style purposes and use cases

## Technical Implementation

### System Prompt Replacement
- Complete replacement of core system instructions
- Preservation of all tool access and capabilities
- Maintenance of technical functionality while changing personality

### Context Integration
- Styles work seamlessly with sub-agents and custom agents
- Compatible with Plan Mode and other Claude Code features
- Proper integration with project configuration and settings

### Performance Considerations
- No performance impact from style switching
- Styles stored locally for fast access
- Minimal overhead for personality transformation

## Troubleshooting

### Common Issues
- Style not persisting: Check `.claude/settings.local.json` permissions
- Custom styles not loading: Verify file format and location
- Unexpected behavior: Ensure style definitions are clear and comprehensive

### Resolution Strategies
- Use `/output-style` to verify current style
- Check configuration files for proper format
- Test custom styles incrementally
- Use default style as baseline for comparison

## Integration Examples

### Development Workflow Integration
```bash
# Start with planning style
/output-style explanatory

# Switch to implementation style  
/output-style default

# Switch to review/collaboration style
/output-style learning
```

### Project Team Integration
- Define team-preferred styles in project documentation
- Create project-specific styles for consistent communication
- Use collaborative styles for pair programming sessions
- Maintain style documentation for team onboarding

## Source

Content extracted from [claudelog.com](https://claudelog.com/) documentation on Output Styles and personality transformation systems.