#!/bin/bash

# Run a single benchmark against a running server
# Usage: ./run-single.sh [endpoint] [duration] [connections]

ENDPOINT=${1:-"/json"}
DURATION=${2:-10}
CONNECTIONS=${3:-100}
URL="http://localhost:3000${ENDPOINT}"

echo "=========================================="
echo "Benchmark: ${ENDPOINT}"
echo "Duration: ${DURATION}s"
echo "Connections: ${CONNECTIONS}"
echo "URL: ${URL}"
echo "=========================================="

# Check if autocannon is available
if command -v autocannon &> /dev/null; then
    echo "Using autocannon..."
    autocannon -c "$CONNECTIONS" -d "$DURATION" -j "$URL"
# Check if wrk is available
elif command -v wrk &> /dev/null; then
    echo "Using wrk..."
    wrk -t4 -c"$CONNECTIONS" -d"${DURATION}s" "$URL"
else
    echo "Error: Neither autocannon nor wrk is installed."
    echo "Install with: npm install -g autocannon"
    echo "Or: brew install wrk"
    exit 1
fi
