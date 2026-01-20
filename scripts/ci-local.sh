#!/bin/bash
# Local CI Mirror
# Runs the same checks as CI pipeline locally
#
# Usage: ./scripts/ci-local.sh [--quick]
# Options:
#   --quick   Skip burn-in (faster feedback)

set -e

QUICK_MODE=false
if [ "$1" == "--quick" ]; then
  QUICK_MODE=true
fi

echo "=========================================="
echo "LOCAL CI PIPELINE"
echo "=========================================="
if [ "$QUICK_MODE" == true ]; then
  echo "Mode: QUICK (no burn-in)"
else
  echo "Mode: FULL (with burn-in)"
fi
echo "=========================================="
echo ""

# Stage 1: Lint
echo "--- Stage 1: Lint & Type Check ---"
npm run lint || { echo "Lint FAILED"; exit 1; }
npx tsc --noEmit || { echo "Type check FAILED"; exit 1; }
echo "Lint passed"
echo ""

# Stage 2: Unit Tests
echo "--- Stage 2: Unit Tests ---"
npm run test:unit || { echo "Unit tests FAILED"; exit 1; }
echo "Unit tests passed"
echo ""

# Stage 3: E2E Tests
echo "--- Stage 3: E2E Tests ---"
npm run test:e2e || { echo "E2E tests FAILED"; exit 1; }
echo "E2E tests passed"
echo ""

# Stage 4: Burn-In (if not quick mode)
if [ "$QUICK_MODE" == false ]; then
  echo "--- Stage 4: Burn-In (3 iterations) ---"
  for i in {1..3}; do
    echo "Burn-in iteration $i/3"
    npm run test:e2e || { echo "Burn-in FAILED on iteration $i"; exit 1; }
  done
  echo "Burn-in passed"
  echo ""
fi

echo "=========================================="
echo "LOCAL CI PASSED"
echo "=========================================="
echo ""
echo "Ready to push!"
