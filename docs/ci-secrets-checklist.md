# CI Secrets Checklist

## Required Secrets

Currently, the CI pipeline does not require any secrets. All tests run against a local dev server.

## Optional Secrets

If you add integrations later, configure these in GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Purpose | When Needed |
|--------|---------|-------------|
| `SLACK_WEBHOOK` | Failure notifications | If Slack integration added |
| `CODECOV_TOKEN` | Coverage reporting | If Codecov integration added |
| `STAGING_URL` | Staging environment tests | If testing against staging |
| `API_KEY` | Backend API access | If backend integration tests |

## Adding Secrets

### GitHub UI
1. Go to repository **Settings**
2. Navigate to **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter name and value
5. Click **Add secret**

### GitHub CLI
```bash
gh secret set SECRET_NAME --body "secret-value"
```

## Using Secrets in Workflow

```yaml
env:
  API_KEY: ${{ secrets.API_KEY }}

steps:
  - name: Run with secret
    run: npm run test:e2e
    env:
      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

## Security Best Practices

1. **Never commit secrets** - Use GitHub Secrets only
2. **Minimal scope** - Only give secrets to jobs that need them
3. **Rotate regularly** - Update secrets periodically
4. **Audit access** - Review who has repository access
5. **No debug output** - Don't print secrets in logs

## Environment Variables

These are NOT secrets but are used in CI:

| Variable | Value | Set In |
|----------|-------|--------|
| `CI` | `true` | Workflow env |
| `NODE_VERSION` | `24` | Workflow env |

## Troubleshooting

### "Secret not found" Error
- Check secret name matches exactly (case-sensitive)
- Ensure secret is set at repository level (not org level unless accessible)

### Secrets Not Working in Forks
- GitHub does not expose secrets to workflows from forks
- PRs from forks run without secrets (by design, for security)
