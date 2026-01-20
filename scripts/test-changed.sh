#!/bin/bash
# Selective Test Runner
# Runs only tests related to changed files
#
# Usage: ./scripts/test-changed.sh [base-branch]
# Examples:
#   ./scripts/test-changed.sh           # Compare to main
#   ./scripts/test-changed.sh develop   # Compare to develop

set -e

BASE_BRANCH=${1:-main}

echo "=========================================="
echo "SELECTIVE TEST RUNNER"
echo "=========================================="
echo "Base branch: $BASE_BRANCH"
echo "=========================================="
echo ""

# Detect changed files
echo "Detecting changed files..."
CHANGED_FILES=$(git diff --name-only $BASE_BRANCH...HEAD 2>/dev/null || git diff --name-only HEAD~1)

if [ -z "$CHANGED_FILES" ]; then
  echo "No files changed. Nothing to test."
  exit 0
fi

echo "Changed files:"
echo "$CHANGED_FILES" | sed 's/^/  - /'
echo ""

# Find changed test files
CHANGED_SPECS=$(echo "$CHANGED_FILES" | grep -E '\.(spec|test)\.(ts|tsx)$' || echo "")

# Find tests related to changed source files
CHANGED_SRC=$(echo "$CHANGED_FILES" | grep -E '^src/.*\.(ts|tsx)$' || echo "")

RELATED_TESTS=""
if [ -n "$CHANGED_SRC" ]; then
  echo "Looking for tests related to changed source files..."
  for src in $CHANGED_SRC; do
    # Extract component/module name
    name=$(basename "$src" | sed 's/\.[^.]*$//')
    # Find related tests
    found=$(find tests -name "*${name}*" -type f 2>/dev/null || echo "")
    if [ -n "$found" ]; then
      RELATED_TESTS="$RELATED_TESTS $found"
    fi
  done
fi

# Combine all tests to run
ALL_TESTS=$(echo "$CHANGED_SPECS $RELATED_TESTS" | tr ' ' '\n' | sort -u | tr '\n' ' ')

if [ -z "$(echo $ALL_TESTS | tr -d ' ')" ]; then
  echo "No relevant tests found. Running smoke tests..."
  npm run test:e2e -- --grep "@smoke" || npm run test:e2e
else
  echo "Running tests:"
  echo "$ALL_TESTS" | tr ' ' '\n' | sed 's/^/  - /'
  echo ""
  npm run test:e2e -- $ALL_TESTS
fi

echo ""
echo "=========================================="
echo "SELECTIVE TESTS COMPLETE"
echo "=========================================="
