# LonicFLex Environment Setup

All external integrations now require real credentials before the services will start in `operationalMode=full`. Use this guide to populate `.env` and verify each dependency.

## 1. Create Your `.env`

```bash
cp .env.example .env
```

Fill in each value using the instructions below. **Leave the `LFX_ALLOW_MOCK_*` flags set to `false` unless you are intentionally running a temporary mock smoke test.**

## 2. Health Endpoints

Set the health URLs that the CI smoke checks will call. These must point to the real running services (HTTP/S accessible from GitHub Actions).

| Variable | Purpose |
| --- | --- |
| `LFX_GITHUB_HEALTH_URL` | Health endpoint for the GitHub integration service. |
| `LFX_GITLAB_HEALTH_URL` | Health endpoint for the GitLab integration service. |
| `LFX_JENKINS_HEALTH_URL` | Health endpoint for the Jenkins integration service. |
| `LFX_SLACK_HEALTH_URL` | Health endpoint for the Slack integration service. |
| `LFX_OPTIONAL_SERVICES` | Comma-separated list of service names to treat as optional (e.g. `slack`). |
| `LFX_ADDITIONAL_SERVICES` | JSON array of extra services `{"name":"foo","url":"https://..."}`. |

If a required endpoint is missing when CI runs in strict mode, the pipeline will fail.

## 3. GitHub Service

| Variable | Purpose |
| --- | --- |
| `GITHUB_OWNER` / `GITHUB_REPO` | Repository that `/lx run` and the core CLI will target. |
| `GITHUB_TOKEN` | Fine-grained PAT with `repo` and `workflow` scopes. |

Verification steps:
```bash
node start-services.js lonicflex-github
curl http://localhost:3002/health | jq '.operationalMode'
# Expect: "full"
```

## 4. Slack Service

| Variable | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Bot token (`xoxb-...`) with chat:write + channels:history. |
| `SLACK_APP_TOKEN` | App-level token (`xapp-...`) for Socket Mode. |
| `SLACK_SIGNING_SECRET` | Used for request signature validation. |

After setting the variables, restart the service and confirm:
```bash
node start-services.js lonicflex-slack
curl http://localhost:3006/health | jq '.operationalMode'
```

## 5. GitLab Service

| Variable | Purpose |
| --- | --- |
| `GITLAB_URL` | Base GitLab host (defaults to `https://gitlab.com`). |
| `GITLAB_ACCESS_TOKEN` | Personal access token with `api` scope. |

Check the health endpoint:
```bash
node start-services.js lonicflex-gitlab
curl http://localhost:3025/health | jq '.operationalMode'
```

## 6. Jenkins Service

| Variable | Purpose |
| --- | --- |
| `JENKINS_URL` | Jenkins base URL. |
| `JENKINS_USERNAME` | Username for API calls. |
| `JENKINS_API_TOKEN` | API token associated with the user. |

Verify:
```bash
node start-services.js lonicflex-jenkins
curl http://localhost:3024/health | jq '.operationalMode'
```

## 7. Run the Service Health Smoke Test

Once all tokens are set and the services are running:
```bash
npm run smoke:services
```
This script polls the `/health` endpoints for GitHub, Slack, GitLab, and Jenkins and fails if any are not healthy/full.

## 8. Troubleshooting

- `operationalMode: mock` -> A mock flag (`LFX_ALLOW_MOCK_*`) is true. Reset it to `false` to require real credentials.
- `operationalMode: failed` -> The service threw during initialisation. Check the logs under `logs/`.
- `400/401` responses -> Token scopes are insufficient or incorrect. Regenerate the token and restart the service.

Keep this file alongside `.env` in source control (without secrets) so new engineers can spin up the stack quickly.
