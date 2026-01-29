#!/bin/bash

# Quick benchmark for CI/CD - tests bunWay only
# Usage: ./quick-bench.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCHMARK_DIR="$(dirname "$SCRIPT_DIR")"
SERVERS_DIR="${BENCHMARK_DIR}/servers"

DURATION=${DURATION:-5}
CONNECTIONS=${CONNECTIONS:-50}

echo "Starting bunWay server..."
PORT=3000 bun "${SERVERS_DIR}/bunway.ts" &
SERVER_PID=$!

sleep 2

if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "Error: Server failed to start"
    exit 1
fi

echo "Running quick benchmark..."

# Check for autocannon
if command -v autocannon &> /dev/null; then
    autocannon -c "$CONNECTIONS" -d "$DURATION" -j "http://localhost:3000/json"
else
    echo "Error: autocannon not found"
    echo "Install with: npm install -g autocannon"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

kill $SERVER_PID 2>/dev/null
