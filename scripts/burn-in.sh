#!/bin/bash
# Burn-In Test Runner
# Runs tests multiple times to detect flaky tests
#
# Usage: ./scripts/burn-in.sh [iterations] [specs...]
# Examples:
#   ./scripts/burn-in.sh                    # 10 iterations, all tests
#   ./scripts/burn-in.sh 5                  # 5 iterations, all tests
#   ./scripts/burn-in.sh 10 tests/e2e/auth  # 10 iterations, specific spec

set -e

ITERATIONS=${1:-10}
shift 2>/dev/null || true
SPECS="$@"

echo "=========================================="
echo "BURN-IN TEST RUNNER"
echo "=========================================="
echo "Iterations: $ITERATIONS"
if [ -n "$SPECS" ]; then
  echo "Specs: $SPECS"
else
  echo "Specs: ALL"
fi
echo "=========================================="
echo ""

FAILURES=0

for i in $(seq 1 $ITERATIONS); do
  echo "--- Iteration $i/$ITERATIONS ---"

  if [ -n "$SPECS" ]; then
    npm run test:e2e -- $SPECS || {
      echo "FAILED on iteration $i"
      FAILURES=$((FAILURES + 1))
      # Continue to see total failure count
    }
  else
    npm run test:e2e || {
      echo "FAILED on iteration $i"
      FAILURES=$((FAILURES + 1))
    }
  fi

  echo ""
done

echo "=========================================="
if [ $FAILURES -eq 0 ]; then
  echo "BURN-IN PASSED: $ITERATIONS/$ITERATIONS successful"
  echo "Tests are stable and ready to merge."
  exit 0
else
  echo "BURN-IN FAILED: $FAILURES/$ITERATIONS iterations failed"
  echo "Tests are FLAKY - investigate before merging!"
  exit 1
fi
