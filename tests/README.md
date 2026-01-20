# Lachatadede Test Suite

This directory contains the complete test infrastructure for Lachatadede.

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests only
npm run test:e2e
```

## Test Architecture

```
tests/
├── e2e/                          # End-to-End tests (Playwright)
│   ├── auth.spec.ts              # Authentication flows
│   └── practice-match.spec.ts    # Core game loop tests
├── unit/                         # Unit tests (Vitest)
│   └── game-api.test.ts          # Game API function tests
├── support/                      # Test infrastructure
│   ├── fixtures/                 # Playwright fixtures
│   │   ├── index.ts              # Merged fixtures export
│   │   └── factories/            # Data factories
│   │       ├── user-factory.ts   # User creation + cleanup
│   │       ├── script-factory.ts # AI script creation + cleanup
│   │       └── match-factory.ts  # Match/tactic creation + cleanup
│   ├── helpers/                  # Utility functions
│   └── vitest-setup.ts           # Vitest global setup
└── README.md                     # This file
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Run once
npm run test:unit

# Watch mode (TDD)
npm run test:unit:watch

# With coverage report
npm run test:unit:coverage
```

### E2E Tests (Playwright)

```bash
# Run all browsers (chromium, firefox, webkit)
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Debug mode (headed, paused)
npm run test:e2e:debug

# Headed mode (watch tests run)
npm run test:e2e:headed

# View HTML report
npm run test:report
```

### Filtering Tests

```bash
# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run tests matching pattern
npx playwright test -g "should allow login"

# Run in specific browser
npx playwright test --project=chromium
```

## Writing Tests

### E2E Tests

Use the custom fixtures for data setup:

```typescript
import { test, expect } from '../support/fixtures';

test('user can start practice match', async ({
  page,
  userFactory,
  scriptFactory,
  matchFactory,
}) => {
  // Create test data (auto-cleanup after test)
  const user = await userFactory.createAuthenticated();
  const script = await scriptFactory.createStarter(user.token!);
  const tactic = await matchFactory.createTactic({
    token: user.token!,
    scriptIds: [script.id, script.id, script.id, script.id, script.id],
  });

  // Set auth cookie
  await page.context().addCookies([
    { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
  ]);

  // Test UI
  await page.goto('/workspace');
  await expect(page.locator('[data-testid="practice-button"]')).toBeVisible();
});
```

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('GameAPI', () => {
  it('should calculate distance correctly', () => {
    const result = distanceTo({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(result).toBe(5);
  });
});
```

## Selector Strategy

Use `data-testid` attributes for reliable test selectors:

```tsx
// In component
<button data-testid="login-button">Login</button>

// In test
await page.click('[data-testid="login-button"]');
```

**Avoid**:
- CSS class selectors (`.btn-primary`)
- XPath
- Text content (fragile, i18n issues)

## Fixtures & Factories

### Available Fixtures

| Fixture | Description | Auto-cleanup |
|---------|-------------|--------------|
| `userFactory` | Create test users | ✅ |
| `scriptFactory` | Create AI scripts | ✅ |
| `matchFactory` | Create matches and tactics | ✅ |
| `apiContext` | Direct API requests | ✅ |

### Factory Methods

**UserFactory**
- `create(overrides)` - Create user
- `createAuthenticated(overrides)` - Create user with auth token

**ScriptFactory**
- `create(overrides)` - Create custom script
- `createStarter(token)` - Create default starter AI
- `createGoalkeeper(token)` - Create goalkeeper AI

**MatchFactory**
- `createTactic({ token, scriptIds })` - Create team tactic
- `createPractice({ token, tacticId })` - Start practice match
- `waitForCompletion(matchId, token)` - Wait for simulation

## Best Practices

### DO

- ✅ Use `data-testid` selectors
- ✅ Use factories for test data
- ✅ Keep tests focused (one scenario per test)
- ✅ Use `waitForResponse` instead of `waitForTimeout`
- ✅ Clean up test data (factories do this automatically)

### DON'T

- ❌ Use hard waits (`page.waitForTimeout(3000)`)
- ❌ Use conditional logic in tests (if/else)
- ❌ Hide assertions in helper functions
- ❌ Share state between tests
- ❌ Test implementation details

## CI Integration

Tests run automatically in GitHub Actions:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:unit
      - run: npm run test:e2e
```

## Debugging

### Playwright

```bash
# Debug mode (opens browser with inspector)
npm run test:e2e:debug

# UI mode (interactive test runner)
npm run test:e2e:ui

# View trace on failure
# Traces are auto-captured on failure in test-results/
```

### Vitest

```bash
# Watch mode with instant feedback
npm run test:unit:watch

# Run single test
npx vitest run -t "should calculate distance"
```

## Coverage

```bash
# Generate coverage report
npm run test:unit:coverage

# Report location: test-results/coverage/index.html
```

**Thresholds**:
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Test Reports

| Report | Location | Command |
|--------|----------|---------|
| Playwright HTML | `test-results/html/` | `npm run test:report` |
| Playwright JUnit | `test-results/junit.xml` | - |
| Vitest Coverage | `test-results/coverage/` | `npm run test:unit:coverage` |
| Vitest JUnit | `test-results/junit-unit.xml` | - |

## Related Documentation

- [Test Design (System-Level)](./_bmad-output/planning-artifacts/test-design-system.md)
- [PRD Requirements](./_bmad-output/planning-artifacts/prd.md)
- [Architecture](./_bmad-output/planning-artifacts/backend-architecture.md)

---

**Generated by**: BMad TEA Agent - Test Framework Module
