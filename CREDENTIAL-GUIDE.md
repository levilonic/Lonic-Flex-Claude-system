# Quick Credential Acquisition Guide

**Status**: 2/7 services ready (GitHub ✅, Slack ✅)
**Need**: 5 services (GitLab, Jira, ServiceNow, Linear, Jenkins)

---

## Run This Command

```bash
node acquire-credentials.js
```

The script will walk you through each service interactively.

---

## URLs to Visit (Use MCP Chrome DevTools)

### 1. GitLab (2 minutes)
**URL**: https://gitlab.com/-/profile/personal_access_tokens

**Steps**:
1. Click "Add new token"
2. Name: `LonicFLex Integration`
3. Scopes: `api`, `read_repository`, `write_repository`
4. Click "Create personal access token"
5. Copy token (starts with `glpat-`)

---

### 2. Jira (3 minutes)
**URL**: https://id.atlassian.com/manage-profile/security/api-tokens

**Steps**:
1. Click "Create API token"
2. Label: `LonicFLex Integration`
3. Click "Create"
4. Copy token
5. Also need:
   - Your Jira instance URL (e.g., `https://yourcompany.atlassian.net`)
   - Your Atlassian email address

---

### 3. ServiceNow (10 minutes - requires signup)
**URL**: https://developer.servicenow.com

**Steps**:
1. Sign up for free developer account
2. Request a Personal Developer Instance (PDI)
3. Wait ~5-10 minutes for instance creation
4. Check email for instance details:
   - Instance URL (e.g., `https://dev123456.service-now.com`)
   - Username: `admin`
   - Password: (in email)

**Alternative**: Skip for now, set placeholder values

---

### 4. Linear (2 minutes)
**URL**: https://linear.app/settings/api

**Steps**:
1. Click "Create new token"
2. Name: `LonicFLex Integration`
3. Scopes: Keep default (full access)
4. Click "Create"
5. Copy token (starts with `lin_api_`)

---

### 5. Jenkins (Optional - can skip)
**URL**: http://localhost:8080 (if running locally)

**Steps**:
1. If you have Jenkins: Go to your name → Configure → API Token → Generate
2. If you DON'T have Jenkins: Enter placeholder values:
   - URL: `http://localhost:8080`
   - Username: `admin`
   - Token: `placeholder_jenkins_token`

**We can set up Jenkins later and update credentials**

---

## Priority Order (if you want to do incrementally)

1. **GitLab** - Fastest (2 min)
2. **Linear** - Fast (2 min)
3. **Jira** - Medium (3 min)
4. **Jenkins** - Use placeholders (30 sec)
5. **ServiceNow** - Slowest (10 min - requires instance provisioning)

---

## After Gathering Credentials

```bash
# Validate all credentials
node validate-credentials.js

# Should show: 7/7 services ready ✅

# Then start services
pm2 start config/ecosystem.config.js

# Check logs
pm2 logs
```

---

## Notes

- **All tokens are stored in .env file** (already in .gitignore)
- **GitLab/Jira/Linear** are quick (5-7 minutes total)
- **ServiceNow** takes longest (wait for instance provisioning)
- **Jenkins** can be skipped with placeholders
- The acquisition script validates tokens as you enter them
- You can stop and resume anytime - it skips already-configured services

---

## Ready?

```bash
node acquire-credentials.js
```
