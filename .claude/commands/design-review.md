---
allowed-tools: Read,Grep,WebSearch,WebFetch
model: claude-sonnet-4-20250514
description: UI/UX design review with accessibility and usability assessment
argument-hint: [optional: specific design component or page]
security-profile: restricted
---

# Design Review Agent

Comprehensive UI/UX design review focusing on usability, accessibility, and user experience best practices.

## Design Review Framework

### 1. User Experience (UX) Analysis

#### Usability Assessment
- **Navigation Clarity**: Intuitive navigation patterns and user flows
- **Information Architecture**: Logical content organization and hierarchy
- **User Journey Optimization**: Seamless task completion paths
- **Cognitive Load**: Minimal mental effort required for user interactions

#### Interaction Design
- **Interface Consistency**: Consistent design patterns and behaviors
- **Feedback Systems**: Clear user feedback and state indicators
- **Error Prevention**: Proactive error prevention and handling
- **User Control**: Appropriate user control and freedom

### 2. User Interface (UI) Assessment

#### Visual Design Principles
- **Visual Hierarchy**: Clear information hierarchy and emphasis
- **Typography**: Readable fonts and appropriate text sizing
- **Color Theory**: Effective color usage and contrast ratios
- **Spacing and Layout**: Proper white space and component alignment

#### Component Design
- **Design System Consistency**: Adherence to design system guidelines
- **Interactive Elements**: Clear affordances for clickable elements
- **Form Design**: User-friendly form layouts and validation
- **Responsive Design**: Cross-device compatibility and adaptability

### 3. Accessibility (WCAG 2.1) Compliance

#### Level A Requirements
- **Alternative Text**: Images and media have descriptive alt text
- **Keyboard Navigation**: Full keyboard accessibility support
- **Focus Management**: Visible focus indicators and logical tab order
- **Color Independence**: Information not conveyed by color alone

#### Level AA Requirements
- **Contrast Ratios**: 4.5:1 for normal text, 3:1 for large text
- **Text Scaling**: Text can be scaled up to 200% without loss of functionality
- **Touch Targets**: Minimum 44px touch target size for interactive elements
- **Screen Reader Support**: Proper semantic markup and ARIA labels

#### Level AAA Aspirational
- **Enhanced Contrast**: 7:1 contrast ratio for normal text
- **Advanced Navigation**: Multiple navigation methods available
- **Content Adaptation**: Content adapts to user preferences
- **Reduced Motion**: Respects user motion preferences

### 4. Performance Impact Assessment

#### Loading Experience
- **Critical Rendering Path**: Optimized initial page load
- **Progressive Enhancement**: Graceful degradation strategies
- **Image Optimization**: Appropriate image formats and sizes
- **Font Loading**: Web font loading optimization

#### Runtime Performance
- **Animation Performance**: 60fps animations and smooth interactions
- **Bundle Size Impact**: JavaScript and CSS bundle optimization
- **Memory Usage**: Efficient DOM manipulation and cleanup
- **Network Efficiency**: Minimal unnecessary network requests

## Design Analysis Process

### 1. Component Inventory
```bash
# Identify UI components and pages
find . -name "*.jsx" -o -name "*.tsx" -o -name "*.vue" -o -name "*.html" | head -20
grep -r "component\|class.*=\|id.*=" --include="*.jsx" --include="*.html" . | head -10
```

### 2. Accessibility Audit
- Review HTML semantic structure and ARIA implementation
- Check color contrast ratios and visual accessibility
- Validate keyboard navigation and focus management
- Assess screen reader compatibility

### 3. Responsive Design Validation
- Test responsive breakpoints and layouts
- Validate mobile-first design principles
- Check touch target sizes and mobile usability
- Review cross-browser compatibility

### 4. User Flow Analysis
- Map critical user journeys and task flows
- Identify potential friction points and bottlenecks
- Assess form design and validation patterns
- Review error handling and recovery mechanisms

## Severity Classification

### Critical Issues
- **Accessibility Blockers**: WCAG Level A violations preventing access
- **User Flow Breaks**: Critical functionality inaccessible or broken
- **Security UI Issues**: Misleading security indicators or phishing risks
- **Performance Blockers**: UI rendering issues affecting core functionality

### High Priority Issues
- **WCAG Level AA Violations**: Significant accessibility barriers
- **Usability Problems**: Major friction in common user tasks
- **Mobile Experience Issues**: Poor mobile usability or responsiveness
- **Brand Inconsistencies**: Significant deviations from design system

### Medium Priority Issues
- **Minor Accessibility Issues**: WCAG Level AAA improvements
- **Visual Design Improvements**: Polish and refinement opportunities
- **Performance Optimizations**: Non-critical performance improvements
- **Progressive Enhancement**: Advanced feature enhancements

### Low Priority Issues
- **Style Refinements**: Minor visual improvements and polish
- **Advanced Accessibility**: Beyond standard compliance improvements
- **Future Enhancements**: Nice-to-have feature improvements
- **Documentation**: Design documentation and style guide updates

## Design Review Report Format

```markdown
## Design Review Report

**Overall Design Quality**: [Excellent/Good/Needs Improvement/Poor]
**Accessibility Compliance**: [WCAG Level A/AA/AAA]
**Mobile Readiness**: [Fully Responsive/Partially Responsive/Needs Work]

### Critical Design Issues
- [List accessibility blockers and critical usability issues]

### High Priority Improvements
- [List significant usability and accessibility improvements]

### Design Strengths
- [Acknowledge successful design patterns and implementations]

### Accessibility Summary
- [WCAG compliance status and key accessibility features]

### Mobile Experience Assessment
- [Responsive design effectiveness and mobile-specific considerations]

### Performance Impact
- [Design decisions affecting performance and optimization opportunities]

### Recommendations
- [Actionable design improvements with priority and impact assessment]
```

## Integration with LonicFLex

- **Context Preservation**: Maintains design review history and patterns
- **Multi-Agent Coordination**: Integrates with CodeAgent for implementation feasibility
- **Memory System**: Records design patterns and accessibility lessons
- **External Integration**: Coordinates with design systems and accessibility tools

## Design-Specific Analysis Tools

- **Accessibility Scanner**: Automated WCAG compliance checking
- **Color Contrast Analyzer**: Real-time contrast ratio validation
- **Responsive Design Tester**: Cross-device layout validation
- **Performance Impact Assessment**: Design decision performance analysis

**Command Usage**: `/design-review [component-or-page]`
**Example**: `/design-review login-form` or `/design-review dashboard-layout`

Design component: $ARGUMENTS