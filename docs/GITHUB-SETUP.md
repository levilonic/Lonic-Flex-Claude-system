# GitHub Integration Setup Guide

## Overview

LonicFLex multi-agent system integrates with GitHub API for repository management, PR/issue handling, and development workflow automation. This guide covers setup requirements and configuration.

## Prerequisites

- GitHub account with repository access
- Node.js and npm installed
- Docker installed (for full workflow)

## Setup Steps

### 1. Create GitHub Personal Access Token

1. **Go to GitHub Settings**:
   - Navigate to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate New Token**:
   - Click "Generate new token (classic)"
   - Set expiration (recommended: 90 days minimum)
   
3. **Required Scopes**:
   ```
   ✅ repo (Full control of private repositories)
   ✅ read:org (Read org and team membership, read org projects)
   ✅ workflow (Update GitHub Action workflows)
   ```

4. **Copy Token**: Save the generated token (starts with `ghp_`)

### 2. Configure Environment Variables

1. **Create/Update .env file**:
   ```bash
   # GitHub Configuration
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_OWNER=your-username-or-org
   GITHUB_REPO=your-repository-name
   GITHUB_WEBHOOK_SECRET=your_webhook_secret_if_needed
   ```

2. **Default Configuration** (if not specified):
   - `GITHUB_OWNER`: defaults to `anthropics`
   - `GITHUB_REPO`: defaults to `claude-code`
   - `GITHUB_API_URL`: defaults to `https://api.github.com`

### 3. Verify Setup

1. **Test GitHub Agent**:
   ```bash
   npm run demo-github-agent
   ```
   - Should show: "✅ GitHub Agent authenticated for owner/repo"

2. **Check API Rate Limits**:
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit
   ```
   - Should show 5000/hour limit for authenticated requests

3. **Test Full Workflow**:
   ```bash
   npm run demo
   ```
   - Should execute: GitHub → Security → Code → Deploy chain

## Current System Status

### ✅ Working Components
- **Authentication**: Token-based API access
- **Repository Access**: Can read public/private repos based on token scope
- **Rate Limiting**: 5000 requests/hour (authenticated)
- **Multi-Agent Integration**: Full GitHub → Deploy workflow functional

### 🔧 Configuration Details
- **Token Storage**: Environment variables (.env file)
- **Auth Manager**: Centralized token management in `auth/auth-manager.js`
- **Agent Integration**: GitHubAgent extends BaseAgent with Octokit integration

## Troubleshooting

### Common Issues

1. **"Bad credentials" Error**:
   - Check token is correctly set in .env
   - Verify token has required scopes
   - Ensure token hasn't expired

2. **"Not Found" Repository Error**:
   - Check GITHUB_OWNER and GITHUB_REPO values
   - Verify token has access to the repository
   - For private repos, ensure token has `repo` scope

3. **Rate Limit Errors**:
   - Authenticated: 5000/hour limit
   - Unauthenticated: 60/hour limit
   - Check current usage with rate_limit API endpoint

### Test Commands

```bash
# Test token validity
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user

# Test repository access  
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/OWNER/REPO

# Check rate limits
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit
```

## Security Best Practices

1. **Token Security**:
   - Never commit tokens to version control
   - Use .env files (already in .gitignore)
   - Set appropriate token expiration
   - Rotate tokens regularly

2. **Scope Limitation**:
   - Only grant minimum required scopes
   - Use read-only scopes where possible
   - Consider repository-specific tokens for production

3. **Environment Separation**:
   - Use different tokens for development/production
   - Separate .env files per environment
   - Monitor token usage in GitHub settings

## Integration Architecture

```
GitHubAgent
├── auth/auth-manager.js     # Token management
├── agents/github-agent.js   # GitHub-specific functionality  
├── @octokit/rest           # GitHub API client
└── .env                    # Environment configuration
```

## API Capabilities

The current integration supports:
- ✅ Repository analysis and metadata
- ✅ Issue management and creation
- ✅ Pull request operations
- ✅ Branch management
- ✅ Rate limiting and error handling
- ✅ Multi-agent workflow coordination

For advanced features like webhooks, repository creation, or organization management, additional token scopes may be required.

---

**Last Updated**: 2025-09-08  
**Status**: All GitHub integration components verified working