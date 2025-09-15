# LonicFLex User Guide - Never Lose Context Again!

**🎉 Welcome to LonicFLex** - The solution to Claude's context loss problem!

## What is LonicFLex?

LonicFLex is a Universal Context System that **preserves your conversations and work across Claude sessions**. No more explaining your project from scratch every time you start a new chat!

### The Problem LonicFLex Solves

❌ **Before LonicFLex**:
- Start new Claude chat → Lose all previous context
- Re-explain your project every time
- Lose track of decisions and progress
- Can't resume long-term projects effectively

✅ **With LonicFLex**:
- **Perfect context preservation** across sessions
- **Resume any project** exactly where you left off
- **Long-term memory** for months-long projects
- **Automatic GitHub and Slack integration**

## Quick Start (5 Minutes)

### 1. Installation
```bash
git clone <repository>
cd LonicFLex
npm install
```

### 2. First Context Creation
```bash
# Create a project for long-term work
/start my-web-app --project --goal="Build a modern web application" --vision="Scalable, user-friendly platform"

# Or create a session for quick tasks
/start fix-bug --session --goal="Fix the login timeout issue"
```

### 3. Start Working!
Your context is now preserved! Work on your project, then when you need to start a new Claude chat:

```bash
# Resume exactly where you left off
/resume my-web-app
```

**That's it!** LonicFLex handles all the complex context preservation automatically.

## Core Concepts

### Sessions vs Projects

#### 🚀 Sessions (Short-term work)
- **Duration**: Days to weeks
- **Use for**: Bug fixes, quick features, experiments
- **Compression**: 70% (more aggressive to save space)
- **Example**: `/start fix-auth-bug --session`

#### 🏗️ Projects (Long-term work)
- **Duration**: Weeks to months  
- **Use for**: Full applications, major features, long-term goals
- **Compression**: 50% (preserves more detail)
- **Example**: `/start e-commerce-platform --project`

### Context Preservation Magic

LonicFLex automatically:
- **Compresses your conversations** intelligently 
- **Preserves key decisions** and code snippets
- **Maintains project knowledge** across sessions
- **Links to external resources** (GitHub, Slack)

## Essential Commands

### Creating Contexts

#### Start a New Project
```bash
/start <project-name> --project --goal="What you want to achieve" --vision="Long-term vision"
```
**Example**:
```bash
/start todo-app --project --goal="Build a React todo application" --vision="Learn modern React with TypeScript"
```

#### Start a Quick Session
```bash
/start <session-name> --session --goal="What you want to fix/build"
```
**Example**:
```bash
/start css-bug --session --goal="Fix the mobile responsive design issues"
```

### Working with Contexts

#### Resume Previous Work
```bash
/resume <context-name>
```
**What happens**: LonicFLex loads all your previous context, decisions, code, and progress!

#### Save Your Progress
```bash
/save <context-name> --status="What you just accomplished"
```
**Example**:
```bash
/save todo-app --status="Completed user authentication and database setup"
```

#### List All Your Contexts
```bash
/list
```
**Example output**:
```
📋 Your Contexts:
🏗️ todo-app (project) - Last active: 2 hours ago
🚀 css-bug (session) - Last active: 1 day ago  
🏗️ api-redesign (project) - Last active: 1 week ago
```

#### Check System Status
```bash
/status
```
**Shows**: System health, active contexts, recent activity

### Advanced Commands

#### Upgrade Session to Project
```bash
/upgrade <session-name> --to-project --goal="Extended goal" --vision="Long-term vision"
```

#### Archive Old Work
```bash
/archive <context-name>
```

#### Context Health Check
```bash
/health <context-name>
```

## Real-World Usage Examples

### Example 1: Building a Web App

**Day 1**: Start the project
```bash
/start inventory-system --project --goal="Build inventory management system" --vision="Help small businesses manage stock efficiently"
```

*Work on initial setup, database design, user authentication...*

**Day 5**: Resume after weekend
```bash
/resume inventory-system
```
**LonicFLex Response**: 
> 🔄 Resumed project: inventory-system
> 📅 Last active: 3 days ago
> 🎯 Goal: Build inventory management system  
> 📊 Progress: User auth complete, database schema ready
> 🔧 Next: Working on product management UI

**Day 30**: Major milestone
```bash
/save inventory-system --status="MVP complete! User testing ready" --important
```

### Example 2: Bug Fixing

**Morning**: Quick bug fix
```bash
/start payment-bug --session --goal="Fix Stripe payment processing error"
```

*Debug the issue, find root cause, implement fix...*

**Afternoon**: Resume after meeting
```bash
/resume payment-bug
```
**LonicFLex Response**:
> 🚀 Resumed session: payment-bug
> 🐛 Issue: Stripe payment processing error in checkout.js:247
> 🔍 Root cause: Missing webhook signature validation
> 📝 Solution: Added signature verification, testing needed

### Example 3: Learning Project

**Week 1**: Start learning
```bash
/start learn-react --project --goal="Master React hooks and context" --vision="Become proficient in modern React development"
```

**Week 4**: Check progress
```bash
/resume learn-react
```
**LonicFLex Response**:
> 📚 Learning project: learn-react
> ✅ Completed: useState, useEffect, custom hooks
> 🔄 Current: Context API and useReducer
> 📖 Resources: [Links to tutorials, code examples]
> 🎯 Next: Build a complex state management example

## GitHub & Slack Integration

### GitHub Integration (Optional)

When you set `GITHUB_TOKEN`, LonicFLex automatically:
- **Creates branches** for your contexts: `context/project-todo-app`
- **Links work to repositories**
- **Tracks commits and PRs**

**Setup**:
```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### Slack Integration (Optional)

When you set `SLACK_BOT_TOKEN`, your team gets:
- **Real-time notifications** when you start/resume contexts
- **Progress updates** when you save important milestones
- **Context sharing** with team members

**Setup**:
```bash
export SLACK_BOT_TOKEN=xoxb_your_token_here
export SLACK_SIGNING_SECRET=your_signing_secret
```

## Best Practices

### 💡 Naming Contexts
- **Use descriptive names**: `user-auth-system` not `proj1`
- **Include technology**: `react-todo-app` not `todo-app`
- **Be consistent**: Use hyphens, not spaces

### 💡 Save Frequently
```bash
# After completing major tasks
/save my-project --status="Completed user registration flow"

# Before taking breaks
/save my-project --status="Debugging payment integration, found issue in webhook handler"

# Mark important milestones
/save my-project --status="MVP ready for user testing!" --important
```

### 💡 Project vs Session Decision
**Choose Project when**:
- Work will take more than a week
- Multiple features/components involved
- Learning or exploration involved
- Team collaboration needed

**Choose Session when**:
- Quick bug fixes (< 1 day)
- Small feature additions
- One-off experiments
- Temporary work

### 💡 Context Hygiene
```bash
# Regularly check what you have
/list

# Archive completed work
/archive old-project-name

# Health check for important projects
/health critical-project --maintenance
```

## Troubleshooting

### Context Not Loading?
```bash
# Check if context exists
/list

# Check context health
/health <context-name>

# Check system status
/status
```

### Lost Some Context?
```bash
# Try resuming with health check
/resume <context-name>
/health <context-name>

# Check for archived contexts
/list --archived
```

### System Running Slow?
```bash
# Clean up old contexts
/cleanup --retention-days=30

# Run health check
npm run context-health
```

## Advanced Features

### Long-Term Persistence (3+ Months)

LonicFLex automatically manages long-term storage:
- **Active** (0-7 days): Full context, instant access
- **Dormant** (1-4 weeks): Compressed, fast restore
- **Sleeping** (1-3 months): High compression, medium restore  
- **Deep Sleep** (3+ months): Maximum compression, full restore

**All restores happen in under 1 second!**

### Context Health Monitoring

LonicFLex continuously monitors your contexts:
- **Health Score**: 0-100% context integrity
- **Automatic Maintenance**: Cleanup and optimization
- **Proactive Alerts**: When context needs attention

### Multi-Context Workflows

Work on multiple projects simultaneously:
```bash
# Switch between contexts
/switch frontend-work
/switch backend-api
/switch documentation

# Each maintains perfect isolation!
```

## Support & Help

### Getting Help
```bash
# Built-in help
/help

# System status
/status

# Context health
/health <context-name>
```

### Common Commands Quick Reference
```bash
# Essential
/start <name> --project --goal="..."     # Create project
/start <name> --session --goal="..."     # Create session  
/resume <name>                           # Resume work
/save <name> --status="..."              # Save progress
/list                                    # Show all contexts

# Maintenance
/status                                  # System health
/health <name>                           # Context health
/archive <name>                          # Archive old work
/cleanup                                 # Clean up system
```

---

**🎉 You're ready to use LonicFLex!** Never lose context again and build amazing projects with perfect continuity across Claude sessions.

**Need help?** Check the [Technical Documentation](TECHNICAL-DOCUMENTATION.md) or run `/help` in the system.

---

*Generated by LonicFLex Phase 7 - User Guide*