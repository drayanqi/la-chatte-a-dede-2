# System-Level Test Design - Lachatadede

**Date:** 2026-01-19
**Author:** Murat (TEA) with Pelo
**Status:** Draft
**Phase:** 3 - Solutioning (Pre-Implementation)

---

## Executive Summary

This document defines the test scope and strategy for Lachatadede across all three architectural layers:
- **Frontend**: React + PixiJS + Monaco Editor
- **Backend**: Laravel API Gateway + MySQL
- **Game Engine**: Node.js Deterministic Simulation

**Key Finding**: The **deterministic physics requirement (NFR14)** is the most critical testability concern. All other quality gates depend on it.

---

## Testability Assessment

### Controllability

| Layer | Status | Evidence |
|-------|--------|----------|
| **Frontend** | PASS | React state manageable, Monaco test APIs available, PixiJS canvas mockable |
| **Backend** | PASS | Laravel factories/seeders, Sanctum test helpers, SQLite in-memory support |
| **Game Engine** | PASS | Seeded randomness, deterministic physics, isolated-vm isolation testable |

### Observability

| Layer | Status | Evidence |
|-------|--------|----------|
| **Frontend** | CONCERNS | Debug panel captures console.log but no structured telemetry hooks for test validation |
| **Backend** | PASS | Laravel logging, API responses, DB state all inspectable |
| **Game Engine** | PASS | JSON frame output contains full match state, debug logs per-player per-tick |

### Reliability

| Layer | Status | Evidence |
|-------|--------|----------|
| **Frontend** | PASS | SPA isolation, no server state dependency between tests |
| **Backend** | CONCERNS | Shared MySQL requires transaction wrapping or test DB per worker for parallel tests |
| **Game Engine** | PASS | Determinism is NON-NEGOTIABLE per PRD, JSON files immutable after write |

---

## Architecturally Significant Requirements (ASRs)

| ASR ID | Requirement | Probability | Impact | Score | Category | Test Strategy |
|--------|-------------|-------------|--------|-------|----------|---------------|
| ASR-1 | **Deterministic Physics** - Same inputs = same outputs | 3 | 3 | **9** | TECH | Seed-based regression suite with golden file comparison |
| ASR-2 | **Match simulation < 2s** | 2 | 3 | **6** | PERF | k6 load testing under concurrent simulations |
| ASR-3 | **Sandboxed JS execution** (10ms/tick, 8MB) | 2 | 3 | **6** | SEC | Security fuzzing, timeout/memory enforcement tests |
| ASR-4 | Replay at 60fps | 2 | 2 | 4 | PERF | Canvas rendering benchmarks |
| ASR-5 | Editor response < 100ms | 1 | 2 | 2 | PERF | Monaco cold start measurement |
| ASR-6 | 100 concurrent users | 2 | 2 | 4 | PERF | k6 load test with API endpoints |
| ASR-7 | **Code privacy** - AI code never exposed | 2 | 3 | **6** | SEC | RBAC E2E tests, authorization validation |

### High-Priority Risks (Score >= 6)

1. **ASR-1 (Score 9)**: Determinism - CRITICAL BLOCKER
   - Mitigation: Golden file testing, cross-platform CI validation
   - Owner: Game Engine Team

2. **ASR-2 (Score 6)**: Simulation Performance
   - Mitigation: k6 baseline, performance budget per tick
   - Owner: Game Engine Team

3. **ASR-3 (Score 6)**: Sandbox Security
   - Mitigation: Fuzzing suite, exploit pattern testing
   - Owner: Security/Game Engine Team

4. **ASR-7 (Score 6)**: Code Privacy
   - Mitigation: RBAC E2E suite, authorization middleware tests
   - Owner: Backend Team

---

## Test Levels Strategy

### Frontend (React + PixiJS + Monaco)

| Level | Coverage | Focus | Tools |
|-------|----------|-------|-------|
| Unit | 30% | Utils, validators, state reducers, game API helpers | Vitest |
| Component | 40% | Monaco integration, PixiJS canvas rendering, UI components | Playwright CT / Storybook |
| E2E | 30% | Onboarding, practice match, replay viewing, debug panel | Playwright |

**Key Test Scenarios (Frontend)**:
- Monaco editor loads with autocomplete for game API
- PixiJS canvas renders players, ball, field correctly
- Debug panel filters logs by player
- Timeline scrubber navigates tick-by-tick
- Keyboard shortcuts work (Space, Arrow keys, Cmd+Enter)

### Backend (Laravel API)

| Level | Coverage | Focus | Tools |
|-------|----------|-------|-------|
| Unit | 40% | PointsService (Elo), GameEngineService, validators | PHPUnit |
| Integration | 50% | API contracts, DB operations, Sanctum auth, Laravel→Node HTTP | PHPUnit + SQLite |
| E2E | 10% | Full auth flow, ranked queue, match lifecycle | Playwright API |

**Key Test Scenarios (Backend)**:
- User registration, login, logout with Sanctum tokens
- CRUD operations for scripts, tactics, matches
- Leaderboard ranking calculations
- Match creation triggers Node.js simulation
- JSON frame import and storage
- Authorization: user cannot access another user's scripts

### Game Engine (Node.js/TypeScript)

| Level | Coverage | Focus | Tools |
|-------|----------|-------|-------|
| Unit | 60% | Physics (Player, Ball, Field), determinism verification | Vitest |
| Integration | 30% | Sandbox execution, script validation, JSON frame generation | Vitest + isolated-vm |
| E2E | 10% | Full simulation via API (Laravel → Node → JSON) | Playwright API |

**Key Test Scenarios (Game Engine)**:
- **CRITICAL**: Same seed + same scripts = identical JSON output
- Tick execution at 30fps (5400 ticks = 3 minutes)
- Script timeout enforcement (10ms/tick)
- Memory limit enforcement (8MB/script)
- Goal detection and scoring
- Player movement and collision physics
- Ball physics (kicking, bouncing)

### Overall Test Pyramid

```
             ┌─────────────┐
             │    E2E      │  15% - Critical journeys
             │  (Playwright)│
         ┌───┴─────────────┴───┐
         │    Integration      │  35% - API contracts, DB ops
         │  (PHPUnit/Vitest)   │
     ┌───┴─────────────────────┴───┐
     │         Unit                │  50% - Business logic, physics
     │   (PHPUnit/Vitest/Jest)     │
     └─────────────────────────────┘
```

---

## NFR Testing Approach

### Security (SEC)

| Test | Level | Tool | Threshold |
|------|-------|------|-----------|
| Unauthenticated access blocked | E2E | Playwright | 100% |
| RBAC: User A cannot see User B's scripts | E2E | Playwright | 100% |
| Sandbox: No filesystem/network/process access | Integration | Vitest | 100% |
| Sandbox: Timeout enforcement (10ms/tick) | Integration | Vitest | 100% |
| Sandbox: Memory limit (8MB) | Integration | Vitest | 100% |
| SQL injection blocked | E2E | Playwright | 100% |
| XSS sanitized | E2E | Playwright | 100% |

### Performance (PERF)

| Test | Level | Tool | Threshold |
|------|-------|------|-----------|
| Match simulation time | Load | k6 | < 2 seconds |
| API response time (p95) | Load | k6 | < 500ms |
| Initial page load | E2E | Playwright + Lighthouse | < 3 seconds |
| Editor response | E2E | Playwright | < 100ms |
| Replay rendering | E2E | Playwright | 60fps |
| Concurrent users | Load | k6 | 100 users |

### Reliability (DATA/OPS)

| Test | Level | Tool | Threshold |
|------|-------|------|-----------|
| **Determinism regression** | Unit | Vitest | 100% (golden file match) |
| Match persistence | Integration | PHPUnit | 100% |
| Rankings calculation | Unit | PHPUnit | 100% |
| Error recovery | E2E | Playwright | Graceful degradation |
| JSON file integrity | Integration | Vitest | No corruption |

### Maintainability

| Metric | Tool | Threshold |
|--------|------|-----------|
| Test coverage (Frontend) | Vitest | >= 80% |
| Test coverage (Backend) | PHPUnit | >= 80% |
| Test coverage (Engine) | Vitest | >= 90% |
| Code duplication | jscpd | < 5% |
| Vulnerabilities | npm audit | 0 critical/high |

---

## Test Environment Requirements

### Local Development
- Docker Compose for Laravel + Node + MySQL
- SQLite in-memory for fast Laravel tests
- Node.js test runner for engine tests
- Playwright for E2E (headed mode for debugging)

### CI/CD (GitHub Actions)
- Sharded Playwright tests (4 workers)
- Parallel PHPUnit tests
- k6 load tests on staging environment
- Coverage reports uploaded to Codecov

### Staging
- Production-like VPS (Docker Compose)
- Seeded test data for performance testing
- k6 load tests against staging API

---

## Testability Concerns

| ID | Concern | Severity | Impact | Recommendation |
|----|---------|----------|--------|----------------|
| TC-1 | Floating-point determinism across platforms | HIGH | Breaks determinism tests | Use fixed-point math OR validate Docker CI = production |
| TC-2 | Monaco Editor mocking in tests | MEDIUM | Slow component tests | Use Playwright CT for real Monaco, mock only for units |
| TC-3 | PixiJS canvas assertions | MEDIUM | Hard to verify rendering | Snapshot testing + visual regression in E2E |
| TC-4 | Laravel ↔ Node.js communication | MEDIUM | Integration test complexity | Docker Compose for true integration OR mock Node endpoints |
| TC-5 | Parallel MySQL tests | MEDIUM | State pollution | DB transactions with rollback OR separate test DBs |
| TC-6 | isolated-vm security testing | MEDIUM | Unknown vulnerabilities | Create fuzzing suite with known JS sandbox exploits |

### Blockers for Solutioning Gate

- **TC-1 MUST be resolved** before determinism tests can be trusted
- **ASR-1 (determinism)** requires golden file infrastructure

---

## Recommendations for Sprint 0

### Framework Setup (TF workflow)

1. **Frontend**: Initialize Playwright + Vitest
   - Configure Playwright CT for component testing
   - Set up Vitest for unit tests
   - Create base fixtures (auth, API mocking)

2. **Backend**: Configure PHPUnit + SQLite
   - Enable SQLite in-memory for fast tests
   - Create database factories for User, Script, Tactic, Match
   - Set up Sanctum test helpers

3. **Game Engine**: Initialize Vitest + isolated-vm test harness
   - Create determinism test infrastructure (golden files)
   - Set up sandbox security test fixtures
   - Create physics unit test helpers

### CI Pipeline Setup (CI workflow)

1. **GitHub Actions** workflows:
   - `test-frontend.yml`: Vitest + Playwright CT + Playwright E2E
   - `test-backend.yml`: PHPUnit (unit + integration)
   - `test-engine.yml`: Vitest (unit + integration)
   - `test-e2e.yml`: Playwright E2E (cross-layer)
   - `test-performance.yml`: k6 load tests (staging only)

2. **Quality Gates**:
   - Coverage >= 80% (block merge if below)
   - All P0 tests pass (100%)
   - No critical security vulnerabilities

---

## Quality Gate Criteria

### Pass/Fail Thresholds

| Criterion | Threshold | Enforcement |
|-----------|-----------|-------------|
| P0 tests (critical) | 100% pass | Block deploy |
| P1 tests (high) | >= 95% pass | Block deploy |
| P2/P3 tests | >= 90% pass | Warning |
| Determinism regression | 100% golden file match | Block deploy |
| Security tests | 100% pass | Block deploy |
| Performance (simulation) | < 2s p95 | Block deploy |
| Coverage | >= 80% | Block merge |

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] Determinism tests pass (seed replay = identical output)
- [ ] Security tests pass (sandbox, RBAC, injection)
- [ ] Performance targets met (< 2s simulation)
- [ ] No critical/high vulnerabilities

---

## Follow-on Workflows

After this System-Level Test Design is approved:

1. **TF (Test Framework)** - Initialize Playwright + Vitest + PHPUnit infrastructure
2. **CI (Continuous Integration)** - Set up GitHub Actions quality pipeline
3. **TD (Test Design)** per epic - Create detailed test scenarios per epic
4. **AT (ATDD)** per story - Generate failing acceptance tests before implementation

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: _____________ Date: _______
- [ ] Tech Lead: _____________ Date: _______
- [ ] QA Lead (Murat): _____________ Date: _______

**Comments:**

---

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/bmm/testarch/test-design` (System-Level Mode)
**Version**: 4.0 (BMad v6)
