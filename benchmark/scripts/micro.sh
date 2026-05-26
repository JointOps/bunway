#!/bin/bash
# Runs all micro-benchmarks in sequence using bun:bench

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MICRO_DIR="${SCRIPT_DIR}/../micro"

echo "=== bunWay Micro-Benchmarks ==="
echo ""

for bench in router pipeline response request pathname cookie crypto; do
  FILE="${MICRO_DIR}/${bench}.bench.ts"
  if [ -f "$FILE" ]; then
    echo "--- ${bench}.bench.ts ---"
    bun run "$FILE"
    echo ""
  else
    echo "SKIP: ${FILE} not found"
  fi
done
