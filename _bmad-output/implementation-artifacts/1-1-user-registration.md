# Story 1.1: User Registration

Status: done

## Story

As a visitor,
I want to create an account with email and password,
So that I can access the platform and save my AI code.

## Acceptance Criteria

1. **Given** I am on the registration page, **When** I enter a valid email, password (min 8 chars), and password confirmation, **Then** my account is created and I am logged in automatically, **And** I am redirected to the main workspace.

2. **Given** I enter an email that already exists, **When** I submit the registration form, **Then** I see an error message "Email already registered".

3. **Given** I enter mismatched passwords, **When** I submit the form, **Then** I see an error message "Passwords do not match".

## Tasks / Subtasks

### Backend Tasks (Laravel)

- [x] Task 1: Create User Migration & Model (AC: #1)
  - [x] Create `users` table migration with: id (UUID), email (unique), username, password_hash, points (default 0), created_at
  - [x] Create User model with fillable fields and hidden password_hash
  - [x] Configure Laravel Sanctum for token-based auth

- [x] Task 2: Implement Registration Endpoint (AC: #1, #2, #3)
  - [x] Create `POST /api/register` endpoint in `AuthController.php`
  - [x] Implement request validation: email (required, email, unique), password (required, min:8, confirmed), name (required)
  - [x] Hash password using bcrypt before storing
  - [x] Return 201 with user data and auth token on success
  - [x] Return 422 with "Email already registered" on duplicate email
  - [x] Return 422 with "Passwords do not match" on confirmation mismatch

- [x] Task 3: Auto-provision Starter Script (AC: #1)
  - [x] After user creation, create default "StarterAI.js" script in `scripts` table
  - [x] Starter AI must contain working code that scores against Easy bot
  - [x] Demonstrate basic API usage: `me.moveTo`, `me.isClosestToBall`
  - [x] All comments in starter script must be in English

### Frontend Tasks (React)

- [x] Task 4: Create Auth Store (Zustand) (AC: #1, #2, #3)
  - [x] Create `/src/stores/authStore.ts` following editorStore.ts pattern
  - [x] Define `AuthState`: user, isAuthenticated, isLoading, error
  - [x] Define `AuthActions`: register(), login(), logout(), clearError(), reset()
  - [x] Implement register action with API call to `POST /api/register`
  - [x] Handle success (set user, isAuthenticated = true, clear error)
  - [x] Handle errors (set error message from API response)

- [x] Task 5: Create Register Page Component (AC: #1, #2, #3)
  - [x] Create `/src/pages/RegisterPage.tsx`
  - [x] Use inline styles following AppShell.tsx pattern (dark theme #1e1e1e)
  - [x] Implement form with data-testid attributes (CRITICAL for E2E):
    - `[data-testid="email-input"]`
    - `[data-testid="password-input"]`
    - `[data-testid="confirm-password-input"]`
    - `[data-testid="name-input"]`
    - `[data-testid="register-button"]`
  - [x] Display error messages below form on validation failure
  - [x] Show loading state during submission

- [x] Task 6: Configure React Router (AC: #1)
  - [x] Install react-router-dom if not present
  - [x] Create route for `/register` pointing to RegisterPage
  - [x] Create route for `/workspace` (main authenticated view)
  - [x] Implement redirect to `/workspace` on successful registration
  - [x] Create ProtectedRoute component for authenticated routes

- [x] Task 7: Add User Menu to Header (AC: #1)
  - [x] Add `[data-testid="user-menu"]` to Header component when authenticated
  - [x] Display user email/name in menu
  - [x] Include logout button with `[data-testid="logout-button"]`

### Testing Tasks

- [x] Task 8: Unit Tests for Auth Store (AC: #1, #2, #3)
  - [x] Create `/tests/unit/stores/auth-store.test.ts`
  - [x] Test successful registration updates state correctly
  - [x] Test duplicate email error is handled
  - [x] Test password mismatch error is handled
  - [x] Test reset() clears all state
  - [x] Follow BDD pattern: Given/When/Then comments

- [x] Task 9: E2E Tests Already Exist - Verify Pass (AC: #1, #2, #3)
  - [x] E2E tests in `/tests/e2e/auth.spec.ts` already written (ATDD)
  - [x] Verify all registration tests pass after implementation
  - [x] Tests cover: successful registration, duplicate email, password mismatch

## Dev Notes

### Architecture Compliance

**IMPORTANT: All code, comments, variable names, and table names MUST be in English.**

**Backend (Laravel):**
- Service: `lachatadede-api/` as per backend-architecture.md
- Controller: `app/Http/Controllers/AuthController.php`
- Model: `app/Models/User.php`
- Auth: Laravel Sanctum for token-based authentication
- API prefix: `/api/*` (all routes under api.php)
- Database tables: Use English names (`users`, `scripts`, `tactics`, `matches`, etc.)

**Frontend (React):**
- State: Zustand store (NOT Redux) - see `src/stores/editorStore.ts` for pattern
- Styling: Inline styles via `Record<string, React.CSSProperties>` (NO CSS files)
- Theme: VSCode Dark (`#1e1e1e` background, `#d4d4d4` text)
- TypeScript: Strict mode enabled (tsconfig.json)
- Comments: All comments in English (existing French comments in codebase are legacy)

### Critical Technical Requirements

**Data Selectors (MANDATORY):**
All interactive elements MUST have `data-testid` attributes. E2E tests in `/tests/e2e/auth.spec.ts` depend on these exact selectors:
- `email-input`, `password-input`, `confirm-password-input`, `name-input`, `register-button`
- `user-menu`, `logout-button`

**Password Requirements:**
- Minimum 8 characters (validated both client and server side)
- Bcrypt hashing on server (Laravel default)

**Session Handling:**
- Use HTTP-only cookie named `auth_token`
- Cookie domain: `localhost`, path: `/`
- Frontend stores user in authStore, checks cookie for persistence

**API Endpoint:**
```
POST /api/register
Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "password_confirmation": "SecurePass123!",
  "name": "Test User"
}

Success Response (201):
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "Test User",
    "points": 0
  },
  "token": "plaintext_token"
}

Error Response (422):
{
  "message": "Email already registered" | "Passwords do not match",
  "errors": { "email": [...] | "password": [...] }
}
```

### Database Schema Reference

From `database-schema.md` (adapted to English):
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  username        VARCHAR(50) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  points          INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

**Note:** The original schema uses French names (`utilisateur`, `script_ia`, `tactique`, etc.). For implementation, use English equivalents:
- `utilisateur` → `users`
- `script_ia` → `scripts`
- `tactique` → `tactics`
- `tactique_joueur` → `tactic_players`
- `match` → `matches`
- `match_frame` → `match_frames`

### Zustand Store Pattern

Follow the pattern from `editorStore.ts` (use English comments):
```typescript
/**
 * Auth Store - Authentication state management
 * OWNER: Dev Team
 */

import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  username: string;
  points: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  register: (email: string, password: string, passwordConfirmation: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState,

  register: async (email, password, passwordConfirmation, name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, password_confirmation: passwordConfirmation, name }),
      });

      if (!response.ok) {
        const data = await response.json();
        set({ error: data.message, isLoading: false });
        return;
      }

      const data = await response.json();
      set({ user: data.user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error) {
      set({ error: 'Registration failed. Please try again.', isLoading: false });
    }
  },

  reset: () => set(initialState),
}));
```

### Styling Reference

From `ux-design-specification.md` - use these color tokens:
```typescript
const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1e1e1e',  // --bg-primary
    color: '#d4d4d4',            // --text-primary
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    backgroundColor: '#252526',   // --bg-secondary
    border: '1px solid #3c3c3c', // --border
    borderRadius: '8px',
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
  },
  input: {
    backgroundColor: '#2d2d2d',   // --bg-tertiary
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    color: '#d4d4d4',
    padding: '8px 12px',
    width: '100%',
    marginBottom: '16px',
  },
  button: {
    backgroundColor: '#007acc',   // --accent
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 20px',
    cursor: 'pointer',
    width: '100%',
  },
  error: {
    color: '#f14c4c',             // --error
    fontSize: '12px',
    marginTop: '8px',
  },
};
```

### Project Structure Notes

**New files to create:**
```
src/
├── pages/
│   └── RegisterPage.tsx          # NEW
├── stores/
│   └── authStore.ts              # NEW
├── components/
│   └── auth/
│       └── ProtectedRoute.tsx    # NEW
└── types/
    └── auth.ts                   # NEW (User type if not in shared.ts)

tests/
└── unit/stores/
    └── auth-store.test.ts        # NEW
```

**Files to modify:**
- `src/App.tsx` - Add React Router setup
- `src/components/layout/Header.tsx` - Add user menu when authenticated

### Test Structure Reference

From `/tests/unit/stores/editor-store.test.ts` (all comments in English):
```typescript
/**
 * Auth Store Unit Tests
 *
 * Tests authentication state management including registration,
 * login, logout, and error handling.
 *
 * @priority high
 * @category unit/stores
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

describe('Auth Store', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  describe('Registration', () => {
    it('should register new user with valid credentials', async () => {
      // GIVEN: Initial unauthenticated state
      const store = useAuthStore.getState();
      expect(store.isAuthenticated).toBe(false);

      // WHEN: Registering with valid email and password
      // Mock the API call to return success
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: { id: '1', email: 'test@example.com', username: 'Test', points: 0 },
          token: 'test-token'
        })
      } as Response);

      await store.register('test@example.com', 'Password123!', 'Password123!', 'Test');

      // THEN: User should be authenticated
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.email).toBe('test@example.com');
    });

    it('should show error for duplicate email', async () => {
      // GIVEN: API returns duplicate email error
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Email already registered' })
      } as Response);

      // WHEN: Attempting to register with existing email
      await useAuthStore.getState().register('existing@example.com', 'Password123!', 'Password123!', 'Test');

      // THEN: Error should be set
      expect(useAuthStore.getState().error).toBe('Email already registered');
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: User Registration]
- [Source: _bmad-output/planning-artifacts/prd.md#User Account Management]
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Service Laravel]
- [Source: _bmad-output/planning-artifacts/database-schema.md#UTILISATEUR] - Use English table name `users`
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Color System]
- [Source: tests/e2e/auth.spec.ts] - E2E test expectations (ATDD)
- [Source: src/stores/editorStore.ts] - Zustand store pattern reference (ignore French comments, use English)

**Language Note:** Planning artifacts may contain French names (legacy). All implementation code MUST use English for:
- Table names, column names
- Variable names, function names
- Comments and documentation
- Error messages (user-facing can be English or localized later)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed missing `useEffect` import in `src/components/layout/AppShell.tsx`
- Removed undefined `handleCanvasReady` function call in `AppShell.tsx`
- Fixed E2E test fixtures base URL to include trailing slash (`http://localhost:8000/api/`)
- Updated logout E2E test to use proper UI login flow instead of cookie-only auth

### Completion Notes List

- All 9 story tasks completed and verified
- Backend implementation was already complete (User model, migration, AuthController with registration, login, logout endpoints)
- Frontend implementation was already complete (AuthStore, RegisterPage, LoginPage, ProtectedRoute, Header with user menu)
- Unit tests: 118 tests passing including 14 auth store tests
- E2E tests: 7 auth tests passing on Chromium (registration, login, logout, error handling, protected routes)
- Build succeeds with no TypeScript errors
- All acceptance criteria verified:
  - AC#1: Registration creates account, logs in automatically, redirects to workspace
  - AC#2: Duplicate email shows "Email already registered" error
  - AC#3: Password mismatch shows "Passwords do not match" error

### File List

**Backend (existing - verified):**
- lachatadede-api/database/migrations/0001_01_01_000000_create_users_table.php
- lachatadede-api/app/Models/User.php
- lachatadede-api/app/Models/Script.php
- lachatadede-api/app/Http/Controllers/AuthController.php
- lachatadede-api/routes/api.php
- lachatadede-api/config/sanctum.php

**Frontend (existing - verified):**
- src/stores/authStore.ts
- src/pages/RegisterPage.tsx
- src/pages/LoginPage.tsx
- src/pages/WorkspacePage.tsx
- src/pages/index.ts
- src/components/auth/ProtectedRoute.tsx
- src/components/auth/index.ts
- src/components/layout/Header.tsx
- src/App.tsx

**Frontend (modified):**
- src/components/layout/AppShell.tsx (fixed missing useEffect import, removed undefined function call)

**Tests (existing - verified):**
- tests/unit/stores/auth-store.test.ts
- tests/e2e/auth.spec.ts (modified logout test to use UI login flow)

**Test Fixtures (modified):**
- tests/support/fixtures/index.ts (fixed baseURL trailing slash)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Review Date:** 2026-01-25
**Result:** PASSED with fixes applied

### Issues Found and Fixed

**HIGH Severity (3 - all fixed):**
1. ✅ Auth cookie not HTTP-only - Added server-side HTTP-only cookie setting in AuthController
2. ✅ CORS not configured for credentials - Enabled `supports_credentials` and restricted origins
3. ✅ Missing client-side password validation - Added validation before API call in RegisterPage

**MEDIUM Severity (5 - all fixed):**
4. ✅ Git vs Story File List discrepancy - Updated file list below
5. ✅ Username uniqueness validation missing - Added uniqueness check in AuthController
6. ✅ User delete endpoint security - Added auth check (self-delete or test env only)
7. ✅ Session restoration not implemented - Added `restoreSession()` action and App.tsx integration
8. ✅ Missing E2E test for min password - Added test case for 8-char minimum

**LOW Severity (4 - documented for future):**
- RegisterPage uses `<a>` instead of React Router `<Link>` (minor perf impact)
- French comments in AppShell.tsx (legacy)
- Missing `data-testid` on error display
- Console error logging could be enhanced

### Files Modified in Review

**Backend:**
- lachatadede-api/app/Http/Controllers/AuthController.php (HTTP-only cookie, username validation, auth on delete)
- lachatadede-api/config/cors.php (credentials support, origin restrictions)

**Frontend:**
- src/stores/authStore.ts (session restoration, localStorage token storage)
- src/components/auth/ProtectedRoute.tsx (wait for session restoration)
- src/pages/RegisterPage.tsx (client-side password validation, removed HTML5 minLength)
- src/App.tsx (session restoration on mount)

**Tests:**
- tests/e2e/auth.spec.ts (added min password test, unique usernames)
- tests/unit/stores/auth-store.test.ts (localStorage mock)

## Change Log

- 2026-01-25: Story 1.1 implementation verified and completed. Fixed TypeScript build errors in AppShell.tsx. Fixed E2E test fixtures for API URL resolution. All tests passing.
- 2026-01-25: Code review completed. Fixed 3 HIGH and 5 MEDIUM issues. Added session restoration, HTTP-only cookies, client-side validation, username uniqueness. All 8 E2E tests and 118 unit tests passing.
