# Epic-Level Test Design - Epic 2: AI Development Workspace

**Date:** 2026-01-20
**Author:** Murat (TEA)
**Epic:** 2 - AI Development Workspace
**Stories:** 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
**Status:** Draft

---

## Executive Summary

This test design covers the AI code editor and file management system. Epic 2 delivers the "code" part of the **Code → Test → Watch → Understand → Iterate** loop.

**Risk Level:** MEDIUM (Monaco integration complexity, data persistence)

---

## Risk Assessment

### Identified Risks

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R2-001 | TECH | Monaco editor fails to load | 2 | 3 | **6** | Fallback textarea + lazy load Monaco | Frontend |
| R2-002 | DATA | User loses unsaved code changes | 2 | 3 | **6** | Auto-save every 30s + localStorage backup | Frontend |
| R2-003 | TECH | Autocomplete suggestions incomplete | 2 | 2 | 4 | Load full game API type definitions | Frontend |
| R2-004 | PERF | Editor slow on large files | 1 | 2 | 2 | Limit file size to 50KB | Frontend |
| R2-005 | DATA | Delete removes wrong file | 1 | 3 | 3 | Confirm dialog + soft delete | Backend |
| R2-006 | BUS | Duplicate creates corrupt copy | 1 | 2 | 2 | Transaction wrapping | Backend |
| R2-007 | SEC | User A can access User B's scripts | 2 | 3 | **6** | RBAC middleware on all script endpoints | Backend |
| R2-008 | TECH | Syntax error detection misses errors | 2 | 2 | 4 | Use Monaco's built-in TypeScript checker | Frontend |

### High-Priority Risks (Score >= 6)

| Risk | Score | Mitigation Status |
|------|-------|-------------------|
| **R2-001** Monaco load failure | 6 | Requires fallback implementation |
| **R2-002** Lost code changes | 6 | Requires auto-save + backup |
| **R2-007** Unauthorized script access | 6 | Requires RBAC tests |

### Risk Summary

- **Total Risks:** 8
- **Critical (9):** 0
- **High (6-8):** 3
- **Medium (4-5):** 2
- **Low (1-3):** 3

---

## Coverage Matrix

### Story 2.1: Create and List AI Files

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-2.1.1 | Create new file with default name | E2E | P0 | - | 1 |
| AC-2.1.2 | File appears in list after creation | E2E | P0 | - | 1 |
| AC-2.1.3 | File list sorted by last modified | E2E | P1 | - | 1 |
| AC-2.1.4 | Click file opens in editor | E2E | P0 | - | 1 |

### Story 2.2: Monaco Editor Integration

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-2.2.1 | Monaco editor loads with file content | E2E | P0 | R2-001 | 1 |
| AC-2.2.2 | JavaScript syntax highlighted | E2E | P1 | - | 1 |
| AC-2.2.3 | Line numbers displayed | E2E | P2 | - | 1 |
| AC-2.2.4 | Standard shortcuts work (Cmd+Z, etc.) | E2E | P1 | - | 1 |

### Story 2.3: Save AI File Changes

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-2.3.1 | Cmd+S saves file to server | E2E | P0 | R2-002 | 1 |
| AC-2.3.2 | "Saved" indicator appears | E2E | P1 | - | 1 |
| AC-2.3.3 | Unsaved changes warning on navigate | E2E | P1 | R2-002 | 1 |
| AC-2.3.4 | Save failure shows error | E2E | P1 | - | 1 |
| AC-2.3.5 | Auto-save every 30 seconds | E2E | P1 | R2-002 | 1 |

### Story 2.4: Game API Autocomplete

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-2.4.1 | "me." shows player method suggestions | E2E | P0 | R2-003 | 1 |
| AC-2.4.2 | "ball." shows ball properties | E2E | P1 | R2-003 | 1 |
| AC-2.4.3 | Tab/Enter inserts suggestion | E2E | P1 | - | 1 |
| AC-2.4.4 | Suggestions include descriptions | E2E | P2 | - | 1 |

### Story 2.5: Code Error Detection

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-2.5.1 | Syntax errors underlined in red | E2E | P0 | R2-008 | 1 |
| AC-2.5.2 | Hover shows error message | E2E | P1 | - | 1 |
| AC-2.5.3 | Error icon in gutter | E2E | P2 | - | 1 |
| AC-2.5.4 | Valid code shows no errors | E2E | P1 | - | 1 |

### Story 2.6: Rename AI File

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-2.6.1 | Double-click enables rename | E2E | P1 | - | 1 |
| AC-2.6.2 | Enter saves new name | E2E | P1 | - | 1 |
| AC-2.6.3 | Invalid name shows validation error | E2E | P1 | - | 1 |
| AC-2.6.4 | File list updates after rename | E2E | P1 | - | 1 |

### Story 2.7: Duplicate AI File

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-2.7.1 | Duplicate creates "Copy of [name]" | E2E | P1 | R2-006 | 1 |
| AC-2.7.2 | Duplicate has same code as original | E2E | P1 | - | 1 |
| AC-2.7.3 | Original and copy are independent | E2E | P1 | - | 1 |

### Story 2.8: Delete AI File

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| AC-2.8.1 | Delete shows confirmation dialog | E2E | P0 | R2-005 | 1 |
| AC-2.8.2 | Confirm removes file from list | E2E | P0 | - | 1 |
| AC-2.8.3 | Cancel preserves file | E2E | P1 | - | 1 |
| AC-2.8.4 | Deleted file closes in editor | E2E | P1 | - | 1 |

### Security Tests (Cross-cutting)

| AC ID | Acceptance Criteria | Test Level | Priority | Risk Link | Test Count |
|-------|---------------------|------------|----------|-----------|------------|
| SEC-2.1 | User cannot list another user's scripts | API | P0 | R2-007 | 1 |
| SEC-2.2 | User cannot read another user's script | API | P0 | R2-007 | 1 |
| SEC-2.3 | User cannot update another user's script | API | P0 | R2-007 | 1 |
| SEC-2.4 | User cannot delete another user's script | API | P0 | R2-007 | 1 |

---

## Test Scenarios

### P0 - Critical (Run on every commit)

| ID | Scenario | Level | File |
|----|----------|-------|------|
| E2-P0-001 | Create new AI file | E2E | `workspace.spec.ts` |
| E2-P0-002 | File appears in list | E2E | `workspace.spec.ts` |
| E2-P0-003 | Click file opens editor | E2E | `workspace.spec.ts` |
| E2-P0-004 | Monaco editor loads | E2E | `workspace.spec.ts` |
| E2-P0-005 | Save file with Cmd+S | E2E | `workspace.spec.ts` |
| E2-P0-006 | Autocomplete shows "me." methods | E2E | `editor.spec.ts` |
| E2-P0-007 | Syntax errors highlighted | E2E | `editor.spec.ts` |
| E2-P0-008 | Delete with confirmation | E2E | `workspace.spec.ts` |
| E2-P0-009 | RBAC: Cannot access other's scripts | API | `scripts-api.test.ts` |

### P1 - High (Run on PR to main)

| ID | Scenario | Level | File |
|----|----------|-------|------|
| E2-P1-001 | JavaScript syntax highlighting | E2E | `editor.spec.ts` |
| E2-P1-002 | Standard keyboard shortcuts | E2E | `editor.spec.ts` |
| E2-P1-003 | "Saved" indicator on save | E2E | `workspace.spec.ts` |
| E2-P1-004 | Unsaved changes warning | E2E | `workspace.spec.ts` |
| E2-P1-005 | Auto-save every 30s | E2E | `workspace.spec.ts` |
| E2-P1-006 | Save failure shows error | E2E | `workspace.spec.ts` |
| E2-P1-007 | Ball autocomplete suggestions | E2E | `editor.spec.ts` |
| E2-P1-008 | Tab inserts autocomplete | E2E | `editor.spec.ts` |
| E2-P1-009 | Hover shows error message | E2E | `editor.spec.ts` |
| E2-P1-010 | Valid code shows no errors | E2E | `editor.spec.ts` |
| E2-P1-011 | Rename file inline | E2E | `workspace.spec.ts` |
| E2-P1-012 | Invalid name validation | E2E | `workspace.spec.ts` |
| E2-P1-013 | Duplicate creates copy | E2E | `workspace.spec.ts` |
| E2-P1-014 | Duplicate is independent | E2E | `workspace.spec.ts` |
| E2-P1-015 | Cancel delete preserves file | E2E | `workspace.spec.ts` |
| E2-P1-016 | File list sorted by modified | E2E | `workspace.spec.ts` |

### P2 - Medium (Run nightly)

| ID | Scenario | Level | File |
|----|----------|-------|------|
| E2-P2-001 | Line numbers displayed | E2E | `editor.spec.ts` |
| E2-P2-002 | Autocomplete descriptions | E2E | `editor.spec.ts` |
| E2-P2-003 | Error icon in gutter | E2E | `editor.spec.ts` |
| E2-P2-004 | Large file performance (50KB) | E2E | `editor.spec.ts` |

---

## Test Data Requirements

### Factories Needed

```typescript
// Script factory
scriptFactory.create({ token, name?, code? })
scriptFactory.createStarter(token)
scriptFactory.createWithSyntaxError(token)

// For RBAC tests
userFactory.createTwo() // Returns [userA, userB] with tokens
```

### Test Data

| Data | Purpose | Source |
|------|---------|--------|
| Valid JS code | Editor tests | `'me.moveTo(ball.position);'` |
| Invalid JS code | Error detection | `'me.moveTo(ball.position'` (missing paren) |
| Game API calls | Autocomplete tests | `'me.', 'ball.', 'goal.'` |
| Long file content | Performance tests | 50KB of valid JS |

---

## Execution Order

### Smoke Tests (< 2 min)

1. E2-P0-004: Monaco editor loads
2. E2-P0-005: Save file with Cmd+S

### P0 Tests (< 10 min)

All 9 P0 scenarios (including RBAC)

### P1 Tests (< 15 min)

All 16 P1 scenarios after P0 passes

### P2 Tests (< 5 min)

All 4 P2 scenarios (nightly only)

---

## Quality Gate Criteria

| Criterion | Threshold | Enforcement |
|-----------|-----------|-------------|
| P0 tests | 100% pass | Block merge |
| P1 tests | >= 95% pass | Block merge |
| P2 tests | >= 90% pass | Warning |
| RBAC tests (SEC-2.*) | 100% pass | Block deploy |
| High-risk tests (R2-001, R2-002, R2-007) | 100% pass | Block deploy |
| Coverage (editor/workspace modules) | >= 80% | Block merge |

---

## Resource Estimates

| Priority | Test Count | Effort (hours) |
|----------|------------|----------------|
| P0 | 9 | 9 |
| P1 | 16 | 12 |
| P2 | 4 | 2 |
| **Total** | **29** | **23 hours** |

---

## Dependencies

- **Backend:** Script CRUD API endpoints must exist
- **Frontend:** Monaco editor integration must be complete
- **Auth:** Epic 1 must be complete (tests require authenticated user)

---

## Monaco-Specific Test Considerations

### Editor Interaction

Monaco editor requires special handling in Playwright:

```typescript
// Wait for Monaco to load
await page.waitForSelector('.monaco-editor');

// Type in editor (use keyboard, not fill)
await page.keyboard.type('me.moveTo(ball.position);');

// Trigger autocomplete
await page.keyboard.press('Control+Space');

// Wait for autocomplete popup
await page.waitForSelector('.monaco-list-row');

// Save with keyboard
await page.keyboard.press('Meta+s'); // Cmd+S on Mac
```

### Autocomplete Assertions

```typescript
// Verify autocomplete contains expected methods
const suggestions = await page.locator('.monaco-list-row').allTextContents();
expect(suggestions).toContain('moveTo');
expect(suggestions).toContain('kick');
expect(suggestions).toContain('isClosestToBall');
```

---

## Notes

- Monaco editor tests are inherently slower than standard E2E tests
- Consider using Playwright's `page.evaluate()` for direct Monaco API access
- Auto-save tests need `page.clock` to manipulate time
- RBAC tests should use API-level testing (faster, more reliable)

---

**Generated by:** BMad TEA Agent
**Workflow:** `_bmad/bmm/testarch/test-design` (Epic-Level Mode)
