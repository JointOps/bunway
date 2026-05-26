#!/bin/bash
# CI performance regression guard.
# Usage: bash benchmark/scripts/ci-check.sh
# Fails with exit code 1 if /json drops below FLOOR req/s.
#
# FLOOR is the post-optimization expected minimum, minus 10% for CI variance.
# After locking baselines with `--baseline`, prefer --check-regression instead.

set -e

FLOOR=${PERF_FLOOR:-55000}

echo "Starting bunWay server for quick benchmark..."
PORT=3099 bun benchmark/servers/bunway.ts &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT

for i in $(seq 1 30); do
  curl -sf "http://localhost:3099/json" > /dev/null 2>&1 && break
  sleep 0.5
done

echo "Running quick /json benchmark (c=100, 10s)..."
RESULT=$(oha -z 10s -c 100 --no-tui --output-format json "http://localhost:3099/json")
RPS=$(echo "$RESULT" | jq -r '.summary.requestsPerSec | floor')

echo "bunWay /json = ${RPS} req/s  (floor: ${FLOOR})"

if [ "$RPS" -lt "$FLOOR" ]; then
  echo "FAIL: performance below floor (${RPS} < ${FLOOR})"
  exit 1
fi
echo "PASS"
