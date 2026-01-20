# Epic-Level Test Design - Epic 1: User Authentication & Onboarding

**Date:** 2026-01-20
**Author:** Murat (TEA)
**Epic:** 1 - User Authentication & Onboarding
**Stories:** 1.1, 1.2, 1.3, 1.4
**Status:** Draft

---

## Executive Summary

This test design covers the authentication and onboarding flows for Lachatadede. Epic 1 is foundational—all other epics depend on authenticated users.

**Risk Level:** LOW-MEDIUM (standard auth patterns, but security-critical)

---

## Risk Assessment

### Identified Risks

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R1-001 | SEC | Password stored insecurely | 1 | 3 | 3 | Use bcrypt with cost factor 12 | Backend |
| R1-002 | SEC | Session token predictable | 1 | 3 | 3 | Use Laravel Sanctum's secure token generation | Backend |
| R1-003 | SEC | Brute force login attacks | 2 | 2 | 4 | Rate limiting (5 attempts/min) | Backend |
| R1-004 | BUS | User cannot recover from forgotten password | 2 | 2 | 4 | Implement password reset (MVP+) | Backend |
| R1-005 | DATA | Starter AI not created on registration | 2 | 2 | 4 | Transaction wrapping for user + AI creation | Backend |
| R1-006 | SEC | XSS in registration form | 1 | 3 | 3 | Input sanitization + CSP headers | Frontend |

### High-Priority Risks (Score >= 6)

**None identified.** Epic 1 uses standard authentication patterns with well-tested Laravel Sanctum.

### Risk Summary

- **Total Risks:** 6
- **Critical (9):** 0
- **High (6-8):** 0
- **Medium (4-5):** 3
- **Low (1-3):** 3

---

## Coverage Matrix

### Story 1.1: User Registration

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-1.1.1 | Valid registration creates account and logs in | E2E | P0 | - | 1 |
| AC-1.1.2 | Duplicate email shows error | E2E | P0 | - | 1 |
| AC-1.1.3 | Password mismatch shows error | E2E | P1 | - | 1 |
| AC-1.1.4 | Password validation (min 8 chars) | Unit | P1 | - | 1 |
| AC-1.1.5 | Email format validation | Unit | P1 | - | 1 |

### Story 1.2: User Login

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-1.2.1 | Valid credentials authenticate user | E2E | P0 | R1-002 | 1 |
| AC-1.2.2 | Invalid credentials show error | E2E | P0 | R1-003 | 1 |
| AC-1.2.3 | Session persists across refresh | E2E | P1 | - | 1 |
| AC-1.2.4 | Rate limiting after failed attempts | API | P1 | R1-003 | 1 |

### Story 1.3: User Logout

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-1.3.1 | Logout terminates session | E2E | P0 | - | 1 |
| AC-1.3.2 | Protected routes redirect after logout | E2E | P0 | - | 1 |

### Story 1.4: Starter AI Template

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-1.4.1 | New user receives StarterAI.js | E2E | P0 | R1-005 | 1 |
| AC-1.4.2 | Starter AI has working code | Unit | P1 | - | 1 |
| AC-1.4.3 | No duplicate starter on existing users | API | P2 | - | 1 |

---

## Test Scenarios

### P0 - Critical (Run on every commit)

| ID | Scenario | Level | File |
|----|----------|-------|------|
| E1-P0-001 | Register with valid email/password | E2E | `auth.spec.ts` |
| E1-P0-002 | Register with duplicate email fails | E2E | `auth.spec.ts` |
| E1-P0-003 | Login with valid credentials | E2E | `auth.spec.ts` |
| E1-P0-004 | Login with invalid credentials fails | E2E | `auth.spec.ts` |
| E1-P0-005 | Logout terminates session | E2E | `auth.spec.ts` |
| E1-P0-006 | Protected routes require auth | E2E | `auth.spec.ts` |
| E1-P0-007 | New user gets starter AI | E2E | `auth.spec.ts` |

### P1 - High (Run on PR to main)

| ID | Scenario | Level | File |
|----|----------|-------|------|
| E1-P1-001 | Password mismatch validation | E2E | `auth.spec.ts` |
| E1-P1-002 | Session persists on page refresh | E2E | `auth.spec.ts` |
| E1-P1-003 | Rate limiting after 5 failed logins | API | `auth-api.test.ts` |
| E1-P1-004 | Password minimum 8 characters | Unit | `validators.test.ts` |
| E1-P1-005 | Email format validation | Unit | `validators.test.ts` |
| E1-P1-006 | Starter AI code is syntactically valid | Unit | `starter-ai.test.ts` |

### P2 - Medium (Run nightly)

| ID | Scenario | Level | File |
|----|----------|-------|------|
| E1-P2-001 | Existing user doesn't get duplicate starter | API | `auth-api.test.ts` |
| E1-P2-002 | Password with special characters accepted | Unit | `validators.test.ts` |
| E1-P2-003 | Long email addresses handled | Unit | `validators.test.ts` |

---

## Test Data Requirements

### Factories Needed

```typescript
// User factory
userFactory.create({ email?, password?, name? })
userFactory.createAuthenticated() // Returns user with token

// Script factory (for starter AI verification)
scriptFactory.createStarter(token) // Creates starter AI for user
```

### Test Data

| Data | Purpose | Source |
|------|---------|--------|
| Valid email | Registration tests | `faker.internet.email()` |
| Valid password | Login tests | `'SecurePass123!'` (static) |
| Invalid email format | Validation tests | `'not-an-email'` |
| Weak password | Validation tests | `'123'` |

---

## Execution Order

### Smoke Tests (< 2 min)

1. E1-P0-003: Login with valid credentials
2. E1-P0-006: Protected routes require auth

### P0 Tests (< 5 min)

All 7 P0 scenarios in parallel (independent tests)

### P1 Tests (< 10 min)

All 6 P1 scenarios after P0 passes

### P2 Tests (< 5 min)

All 3 P2 scenarios (nightly only)

---

## Quality Gate Criteria

| Criterion | Threshold | Enforcement |
|-----------|-----------|-------------|
| P0 tests | 100% pass | Block merge |
| P1 tests | >= 95% pass | Block merge |
| P2 tests | >= 90% pass | Warning |
| Security tests (R1-*) | 100% pass | Block deploy |
| Coverage (auth module) | >= 80% | Block merge |

---

## Resource Estimates

| Priority | Test Count | Effort (hours) |
|----------|------------|----------------|
| P0 | 7 | 7 |
| P1 | 6 | 4 |
| P2 | 3 | 1.5 |
| **Total** | **16** | **12.5 hours** |

---

## Dependencies

- **Backend:** Laravel Sanctum auth endpoints must exist
- **Frontend:** Login/Register forms must exist
- **Database:** Users table with proper schema

---

## Notes

- E2E tests for Epic 1 already exist in `tests/e2e/auth.spec.ts`
- Tests are currently aspirational (require backend)
- Consider adding OAuth tests in future iteration (FR1 mentions OAuth)

---

**Generated by:** BMad TEA Agent
**Workflow:** `_bmad/bmm/testarch/test-design` (Epic-Level Mode)
