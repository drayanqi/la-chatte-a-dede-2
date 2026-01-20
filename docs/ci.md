# CI/CD Pipeline Guide

## Overview

This project uses **GitHub Actions** for continuous integration and testing. The pipeline runs on every push to `main`/`develop` and on all pull requests.

## Pipeline Stages

```
lint → unit-tests → e2e-tests (4 shards) → burn-in (PRs only) → merge-reports
```

| Stage | Duration | Purpose |
|-------|----------|---------|
| **Lint** | ~2 min | ESLint + TypeScript type checking |
| **Unit Tests** | ~3 min | Vitest unit tests with coverage |
| **E2E Tests** | ~10 min/shard | Playwright E2E tests (4 parallel shards) |
| **Burn-In** | ~30 min | Flaky test detection (10 iterations) |
| **Merge Reports** | ~1 min | Combine shard results into single report |

**Total pipeline time:** ~15-45 minutes depending on trigger type.

## Triggers

| Event | Stages Run | Burn-In |
|-------|------------|---------|
| Push to `main`/`develop` | All except burn-in | No |
| Pull Request | All stages | Yes (10 iterations) |
| Weekly schedule (Sun 3am UTC) | All stages | Yes (full suite) |

## Running Locally

### Quick Check (no burn-in)
```bash
./scripts/ci-local.sh --quick
```

### Full Pipeline (with burn-in)
```bash
./scripts/ci-local.sh
```

### Burn-In Only
```bash
# 10 iterations, all tests
./scripts/burn-in.sh

# 5 iterations, specific spec
./scripts/burn-in.sh 5 tests/e2e/auth.spec.ts
```

### Selective Testing (changed files only)
```bash
./scripts/test-changed.sh
```

## Debugging Failed CI Runs

### 1. Check Artifacts

Failed jobs upload artifacts to GitHub:
- **test-results/** - Screenshots, traces, videos
- **playwright-report/** - HTML report with failure details

Download from the Actions tab → Select failed run → Artifacts section.

### 2. View Traces

```bash
# After downloading artifacts
npx playwright show-trace test-results/trace.zip
```

### 3. Run Locally

```bash
# Mirror CI environment
./scripts/ci-local.sh

# Debug specific failing test
npm run test:e2e:debug -- tests/e2e/failing.spec.ts
```

### 4. Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Works locally, fails in CI | Timing/race condition | Add explicit waits, check burn-in |
| Flaky failures | Non-deterministic test | Run burn-in locally to reproduce |
| Timeout errors | Slow CI runners | Increase timeout or optimize test |
| Browser not found | Cache miss | Re-run job (browser install cached) |

## Caching

The pipeline caches:
- **npm dependencies** - keyed on `package-lock.json`
- **Playwright browsers** - keyed on `package-lock.json`

Cache TTL: 7 days (GitHub default).

## Parallelization

E2E tests run in **4 parallel shards** using Playwright's built-in sharding:

```bash
# How it works
npm run test:e2e -- --shard=1/4  # Shard 1 runs 25% of tests
npm run test:e2e -- --shard=2/4  # Shard 2 runs next 25%
# etc.
```

To adjust shard count, edit `.github/workflows/test.yml`:
```yaml
matrix:
  shard: [1, 2, 3, 4]  # Change to [1, 2] for 2 shards
```

## Burn-In Testing

**Purpose:** Detect flaky tests before they reach `main`.

**How it works:**
1. Identifies changed test files in the PR
2. Runs those tests 10 times consecutively
3. Fails if ANY iteration fails

**When it runs:**
- On all pull requests
- Weekly on schedule (full suite)

**Adjusting iterations:**
Edit the workflow or use the local script:
```bash
./scripts/burn-in.sh 20  # 20 iterations instead of 10
```

## Badge

Add to your README:
```markdown
[![Tests](https://github.com/drayanqi/la-chatte-a-dede-2/actions/workflows/test.yml/badge.svg)](https://github.com/drayanqi/la-chatte-a-dede-2/actions/workflows/test.yml)
```

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Lint stage | < 2 min | TBD |
| Unit tests | < 3 min | TBD |
| E2E per shard | < 10 min | TBD |
| Total (push) | < 15 min | TBD |
| Total (PR with burn-in) | < 45 min | TBD |

Update these after first few CI runs.
