# ATDD Checklist - Epic 1 & Epic 2

**Date:** 2026-01-20
**Author:** Murat (TEA)
**Status:** RED Phase Complete
**Epics:** 1 (Authentication), 2 (AI Workspace)

---

## Summary

This document tracks the acceptance test-driven development for Epic 1 and Epic 2. All tests are in **RED phase** (failing) and ready for implementation.

---

## Failing Tests Created

### Epic 1: User Authentication (`tests/e2e/auth.spec.ts`)

| Test ID | Scenario | Status |
|---------|----------|--------|
| AUTH-001 | Register with valid email/password | RED |
| AUTH-002 | Register with duplicate email fails | RED |
| AUTH-003 | Password mismatch validation | RED |
| AUTH-004 | Login with valid credentials | RED |
| AUTH-005 | Login with invalid credentials fails | RED |
| AUTH-006 | Logout terminates session | RED |
| AUTH-007 | Protected routes require auth | RED |

**File:** `tests/e2e/auth.spec.ts` (130 lines, already exists)

### Epic 2: AI Workspace (`tests/e2e/workspace.spec.ts`)

| Test ID | Scenario | Status |
|---------|----------|--------|
| WS-001 | Create new AI file with default name | RED |
| WS-002 | Display created file in file list | RED |
| WS-003 | Open file in editor when clicked | RED |
| WS-004 | Show confirmation before delete | RED |
| WS-005 | Remove file after confirmed delete | RED |
| WS-006 | Monaco editor loads with content | RED |
| WS-007 | Save file with Cmd+S | RED |
| WS-008 | Autocomplete shows "me." methods | RED |
| WS-009 | Highlight syntax errors | RED |
| WS-010 | RBAC: Cannot access other user's scripts | RED |

**File:** `tests/e2e/workspace.spec.ts` (NEW - 231 lines)

---

## Supporting Infrastructure

### Data Factories (Existing)

| Factory | File | Methods |
|---------|------|---------|
| UserFactory | `tests/support/fixtures/factories/user-factory.ts` | `create()`, `createAuthenticated()`, `cleanup()` |
| ScriptFactory | `tests/support/fixtures/factories/script-factory.ts` | `create()`, `createStarter()`, `cleanup()` |
| MatchFactory | `tests/support/fixtures/factories/match-factory.ts` | `createTactic()`, `createPractice()` |

### Test Fixtures (Existing)

| Fixture | File | Provides |
|---------|------|----------|
| Base fixtures | `tests/support/fixtures/index.ts` | `userFactory`, `scriptFactory`, `matchFactory` |

---

## Required data-testid Attributes

### Authentication Pages

```
Login Page:
- email-input          # Email input field
- password-input       # Password input field
- login-button         # Submit button
- error-message        # Error message container

Registration Page:
- email-input          # Email input field
- password-input       # Password input field
- confirm-password-input # Password confirmation
- name-input           # Display name
- register-button      # Submit button

User Menu:
- user-menu            # User dropdown trigger
- logout-button        # Logout action
```

### Workspace Page

```
File Management:
- new-file-button      # Create new file
- file-list            # Container for file list
- file-list-item       # Individual file entry
- delete-button        # Delete file action
- confirm-dialog       # Confirmation modal
- confirm-delete-button # Confirm delete action

Editor:
- save-indicator       # Shows "Saved" status
- editor-container     # Monaco editor wrapper

Monaco-specific (CSS classes, not data-testid):
- .monaco-editor       # Editor root
- .monaco-list-row     # Autocomplete suggestion
- .squiggly-error      # Syntax error underline
- .view-lines          # Editor content area
```

---

## Mock Requirements

### Backend API Endpoints Needed

```
Authentication:
POST /register         # Create user account
POST /login            # Authenticate user
POST /logout           # End session
GET  /user             # Get current user

Scripts:
GET    /scripts        # List user's scripts
POST   /scripts        # Create new script
GET    /scripts/:id    # Get script by ID
PUT    /scripts/:id    # Update script
DELETE /scripts/:id    # Delete script
```

### Expected Response Schemas

```typescript
// POST /register, POST /login
{
  id: string;
  email: string;
  name: string;
  token: string;
  rating?: number;
}

// GET /scripts
[
  {
    id: string;
    name: string;
    code: string;
    createdAt: string;
    updatedAt: string;
  }
]

// POST /scripts, PUT /scripts/:id
{
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## Implementation Checklist

### Epic 1: Authentication

#### Story 1.1: User Registration

- [ ] Create `/register` route (Laravel)
- [ ] Implement registration form component (React)
- [ ] Add email validation (frontend + backend)
- [ ] Add password validation (min 8 chars)
- [ ] Add password confirmation matching
- [ ] Hash passwords with bcrypt
- [ ] Return auth token on success
- [ ] Handle duplicate email error
- [ ] Add data-testid attributes
- [ ] Run test: `npm run test:e2e -- auth.spec.ts --grep "registration"`
- [ ] ✅ Tests pass (green phase)

#### Story 1.2: User Login

- [ ] Create `/login` route (Laravel)
- [ ] Implement login form component (React)
- [ ] Validate credentials against database
- [ ] Return auth token on success
- [ ] Return error for invalid credentials
- [ ] Add data-testid attributes
- [ ] Run test: `npm run test:e2e -- auth.spec.ts --grep "login"`
- [ ] ✅ Tests pass (green phase)

#### Story 1.3: User Logout

- [ ] Create `/logout` route (Laravel)
- [ ] Invalidate auth token
- [ ] Clear frontend auth state
- [ ] Redirect to login page
- [ ] Add data-testid attributes
- [ ] Run test: `npm run test:e2e -- auth.spec.ts --grep "logout"`
- [ ] ✅ Tests pass (green phase)

#### Story 1.4: Starter AI Template

- [ ] Create starter AI code template
- [ ] Auto-create on user registration
- [ ] Wrap in transaction (user + script)
- [ ] Run test: `npm run test:e2e -- auth.spec.ts --grep "starter"`
- [ ] ✅ Tests pass (green phase)

---

### Epic 2: AI Workspace

#### Story 2.1: Create and List AI Files

- [ ] Create `/scripts` GET endpoint (list)
- [ ] Create `/scripts` POST endpoint (create)
- [ ] Implement file list component (React)
- [ ] Implement "New File" button
- [ ] Default name "NewAI.js"
- [ ] Sort by last modified
- [ ] Add data-testid attributes
- [ ] Run test: `npm run test:e2e -- workspace.spec.ts --grep "create|list"`
- [ ] ✅ Tests pass (green phase)

#### Story 2.2: Monaco Editor Integration

- [ ] Install @monaco-editor/react
- [ ] Create editor wrapper component
- [ ] Load file content into editor
- [ ] Configure JavaScript language mode
- [ ] Enable syntax highlighting
- [ ] Run test: `npm run test:e2e -- workspace.spec.ts --grep "Monaco"`
- [ ] ✅ Tests pass (green phase)

#### Story 2.3: Save AI File Changes

- [ ] Create `/scripts/:id` PUT endpoint
- [ ] Implement Cmd+S handler
- [ ] Show "Saved" indicator
- [ ] Handle save errors gracefully
- [ ] Add data-testid="save-indicator"
- [ ] Run test: `npm run test:e2e -- workspace.spec.ts --grep "save"`
- [ ] ✅ Tests pass (green phase)

#### Story 2.4: Game API Autocomplete

- [ ] Create game API type definitions
- [ ] Register with Monaco languages
- [ ] Configure autocomplete provider
- [ ] Include: me, ball, goal, teammates, opponents
- [ ] Add descriptions to suggestions
- [ ] Run test: `npm run test:e2e -- workspace.spec.ts --grep "autocomplete"`
- [ ] ✅ Tests pass (green phase)

#### Story 2.5: Code Error Detection

- [ ] Enable Monaco TypeScript/JavaScript validation
- [ ] Configure error markers
- [ ] Display red squiggles on errors
- [ ] Run test: `npm run test:e2e -- workspace.spec.ts --grep "error"`
- [ ] ✅ Tests pass (green phase)

#### Stories 2.6-2.8: Rename, Duplicate, Delete

- [ ] Create `/scripts/:id` DELETE endpoint
- [ ] Implement rename inline edit
- [ ] Implement duplicate functionality
- [ ] Implement delete with confirmation
- [ ] Add RBAC middleware (owner only)
- [ ] Add data-testid attributes
- [ ] Run test: `npm run test:e2e -- workspace.spec.ts`
- [ ] ✅ Tests pass (green phase)

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

- ✅ All tests written and failing
- ✅ Factories exist for user, script creation
- ✅ Fixtures provide auto-cleanup
- ✅ data-testid requirements documented
- ✅ API contracts documented

### GREEN Phase (DEV Team)

1. Pick one failing test
2. Implement minimal code to make it pass
3. Run test to verify green
4. Move to next test
5. Repeat until all tests pass

**Recommended order:**
1. Auth endpoints (Epic 1) first
2. Script CRUD endpoints (Epic 2)
3. Frontend components
4. Monaco integration
5. Autocomplete configuration

### REFACTOR Phase (DEV Team)

1. All tests passing (green)
2. Improve code quality
3. Extract duplications
4. Optimize performance
5. Ensure tests still pass

---

## Running Tests

```bash
# Run all E2E tests (will fail until implemented)
npm run test:e2e

# Run Epic 1 tests only
npm run test:e2e -- auth.spec.ts

# Run Epic 2 tests only
npm run test:e2e -- workspace.spec.ts

# Run specific test by name
npm run test:e2e -- --grep "login"

# Run in headed mode (see browser)
npm run test:e2e -- --headed

# Debug specific test
npm run test:e2e -- workspace.spec.ts --debug
```

---

## Test Count Summary

| Epic | P0 Tests | P1 Tests | Total |
|------|----------|----------|-------|
| Epic 1 | 7 | 6 | 13 |
| Epic 2 | 10 | 16 | 26 |
| **Total** | **17** | **22** | **39** |

**Estimated Implementation Effort:** ~35 hours

---

## Next Steps

1. **DEV Team:** Review this checklist
2. **DEV Team:** Start with Epic 1 (auth) - foundational
3. **DEV Team:** Run `npm run test:e2e -- auth.spec.ts` to see failures
4. **DEV Team:** Implement one test at a time
5. **TEA:** Available for test debugging and updates

---

**Generated by:** BMad TEA Agent
**Workflow:** `_bmad/bmm/testarch/atdd`
