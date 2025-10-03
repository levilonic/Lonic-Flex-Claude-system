# Deployment Pipeline

This repository ships with an automated deployment workflow that builds and optionally deploys the LonicFLex multi-agent stack. The pipeline is intentionally conservative - it runs only when triggered manually and supports dry-runs so we can validate assets before touching infrastructure.

## Workflow Overview

- **Workflow file**: `.github/workflows/deploy.yml`
- **Trigger**: `workflow_dispatch` (manual via GitHub UI or `gh workflow run`)
- **Artifacts**: Docker image tarball (`lonicflex-image`), deployment logs per environment
- **Jobs**:
  1. **Build Artifact**
     - Checks out repository and installs dependencies (Node 20)
     - Optionally runs smoke tests (`npm run test:smoke`)
     - Builds Docker image `lonicflex-multi-agent:<tag>` and uploads it as an artifact
  2. **Deploy** (guarded by GitHub Environments)
     - Downloads the image artifact and loads it into Docker
     - Optionally logs into a container registry and pushes the built image
     - Executes `scripts/deploy.sh <environment> <strategy>` when `dry-run` is disabled
     - Always collects deployment logs (if the script produced any)

## Trigger Inputs

| Input          | Type    | Default    | Notes |
| -------------- | ------- | ---------- | ----- |
| `environment`  | choice  | `staging`  | Maps to GitHub Environment; also passed to deployment scripts |
| `strategy`     | choice  | `rolling`  | Accepted values: `rolling`, `blue-green`, `canary`, `recreate` |
| `image-tag`    | string  | `latest`   | Used when building/tagging Docker images |
| `run-tests`    | boolean | `true`     | Executes `npm run test:smoke` before building |
| `dry-run`      | boolean | `true`     | When `true` skips the deployment step and leaves artefacts only |

The dry-run toggle is the safety catch. Start with the default (`true`) to verify the build and produced artefacts; switch to `false` once secrets and infrastructure are ready.

## Required Secrets & Variables

Set the following on GitHub (**Repository Settings > Secrets and Variables**).

| Name | Type | Description |
| ---- | ---- | ----------- |
| `DOCKER_REGISTRY` | environment secret (optional) | Base registry URL (e.g. `ghcr.io/<org>`). Required only if you want the workflow to push images. |
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` | environment secret (optional) | Credentials for the registry above. |
| `SLACK_WEBHOOK_URL` | environment secret (optional) | Used by `scripts/deploy.sh` notifications. |
| `SLACK_BOT_TOKEN` | environment secret (optional) | Required for production deployments (see script pre-checks). |
| `DEPLOY_GITHUB_TOKEN` | environment secret (optional) | Overrides the default GitHub token for API calls during deployment; falls back to Actions token if not set. |
| `BACKUP_ENABLED` | environment variable (optional) | Set to `false` to skip backup step in `deploy.sh`. |
| `LFX_GITHUB_HEALTH_URL` | environment variable | Real GitHub integration health endpoint used by CI smoke checks. |
| `LFX_GITLAB_HEALTH_URL` | environment variable | Real GitLab integration health endpoint. |
| `LFX_JENKINS_HEALTH_URL` | environment variable | Real Jenkins integration health endpoint. |
| `LFX_SLACK_HEALTH_URL` | environment variable | Real Slack integration health endpoint. |
| `LFX_OPTIONAL_SERVICES` | environment variable (optional) | Comma-separated list of service names to treat as optional in smoke checks (e.g. `slack`). |
| `LFX_ADDITIONAL_SERVICES` | environment variable (optional) | JSON array describing additional services `{ "name": "foo", "url": "https://..." }`. |

> **Tip**: Create GitHub *Environments* named `development`, `staging`, and `production`; assign the secrets above per environment and configure required reviewers/approvals as needed.

## Running the Workflow

1. Navigate to **Actions > LonicFLex Deployment > Run workflow**.
2. Choose environment, strategy, and tag (leave `dry-run` enabled for a first pass).
3. Click **Run workflow**. The build job produces the Docker image and uploads it as an artefact.
4. Inspect artefacts/logs. When ready for a real deployment, rerun with `dry-run` set to `false`.

For CLI usage:

```bash
# Dry-run deployment build
gh workflow run deploy.yml \
  -f environment=staging \
  -f strategy=rolling \
  -f image-tag=$(date +%Y%m%d%H%M) \
  -f dry-run=true

# Execute deployment (requires secrets and approvals)
gh workflow run deploy.yml \
  -f environment=staging \
  -f strategy=rolling \
  -f image-tag=$(date +%Y%m%d%H%M) \
  -f dry-run=false
```

## Optional Registry Push

When `DOCKER_REGISTRY` and credentials are provided, the deploy job retags and pushes the image **only when `dry-run` is disabled**. Registry pushes are skipped automatically otherwise.

## Post-Run Artefacts

- `lonicflex-image` - gzip'd `docker save` file of the built image.
- `deployment-logs-<environment>` - contents of the `logs/` directory created by `deploy.sh` (ignored if absent).

These artefacts keep the deployment reproducible and aid debugging if anything fails downstream.

## Future Enhancements

- Wire real service health endpoints into `scripts/check-services-health.js` and feed their results back into the deployment job.
- Integrate staged approvals/notifications (Slack, GitHub comments) per environment.
- Add rollback automation through a dedicated workflow once production infrastructure is connected.

For now, this pipeline gives us a predictable build-and-deploy path controlled from GitHub with clear hand-offs and artefacts.
