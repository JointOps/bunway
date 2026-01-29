#!/bin/bash

# Run benchmarks across all frameworks
# Usage: ./run-comparison.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCHMARK_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="${BENCHMARK_DIR}/results"
SERVERS_DIR="${BENCHMARK_DIR}/servers"

DURATION=${DURATION:-10}
CONNECTIONS=${CONNECTIONS:-100}
WARMUP=${WARMUP:-3}

# Endpoints to benchmark
ENDPOINTS=("/json" "/plaintext" "/route50/123" "/middleware")

# Frameworks to test
declare -A FRAMEWORKS
FRAMEWORKS=(
    ["bunway"]="bun ${SERVERS_DIR}/bunway.ts"
    ["express"]="node ${SERVERS_DIR}/express.js"
    ["elysia"]="bun ${SERVERS_DIR}/elysia.ts"
    ["hono"]="bun ${SERVERS_DIR}/hono.ts"
    ["fastify"]="node ${SERVERS_DIR}/fastify.js"
)

# Create results directory
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="${RESULTS_DIR}/comparison_${TIMESTAMP}.json"

echo "=========================================="
echo "bunWay Benchmark Comparison"
echo "Duration: ${DURATION}s per test"
echo "Connections: ${CONNECTIONS}"
echo "Warmup: ${WARMUP}s"
echo "=========================================="

# Check for autocannon
if ! command -v autocannon &> /dev/null; then
    echo "Error: autocannon is required for this script"
    echo "Install with: npm install -g autocannon"
    exit 1
fi

# Initialize results JSON
echo "{" > "$RESULT_FILE"
echo "  \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULT_FILE"
echo "  \"config\": {" >> "$RESULT_FILE"
echo "    \"duration\": $DURATION," >> "$RESULT_FILE"
echo "    \"connections\": $CONNECTIONS," >> "$RESULT_FILE"
echo "    \"warmup\": $WARMUP" >> "$RESULT_FILE"
echo "  }," >> "$RESULT_FILE"
echo "  \"results\": {" >> "$RESULT_FILE"

FIRST_FW=true

for FW in "${!FRAMEWORKS[@]}"; do
    CMD="${FRAMEWORKS[$FW]}"

    echo ""
    echo "=========================================="
    echo "Testing: $FW"
    echo "Command: $CMD"
    echo "=========================================="

    # Start the server
    PORT=3000 $CMD &
    SERVER_PID=$!

    # Wait for server to be ready
    echo "Waiting for server to start..."
    sleep 2

    # Check if server is running
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "Error: Server failed to start"
        continue
    fi

    # Warmup
    echo "Warming up for ${WARMUP}s..."
    autocannon -c 10 -d "$WARMUP" "http://localhost:3000/json" > /dev/null 2>&1

    if [ "$FIRST_FW" = false ]; then
        echo "," >> "$RESULT_FILE"
    fi
    FIRST_FW=false

    echo "    \"$FW\": {" >> "$RESULT_FILE"

    FIRST_EP=true
    for EP in "${ENDPOINTS[@]}"; do
        EP_NAME=$(echo "$EP" | tr '/' '_' | sed 's/^_//')
        [ -z "$EP_NAME" ] && EP_NAME="root"

        echo "  Benchmarking ${EP}..."

        # Run benchmark and capture JSON output
        RESULT=$(autocannon -c "$CONNECTIONS" -d "$DURATION" -j "http://localhost:3000${EP}" 2>/dev/null)

        # Extract key metrics
        RPS=$(echo "$RESULT" | jq '.requests.average // 0')
        LATENCY_AVG=$(echo "$RESULT" | jq '.latency.average // 0')
        LATENCY_P99=$(echo "$RESULT" | jq '.latency.p99 // 0')
        THROUGHPUT=$(echo "$RESULT" | jq '.throughput.average // 0')
        ERRORS=$(echo "$RESULT" | jq '.errors // 0')

        if [ "$FIRST_EP" = false ]; then
            echo "," >> "$RESULT_FILE"
        fi
        FIRST_EP=false

        echo "      \"$EP_NAME\": {" >> "$RESULT_FILE"
        echo "        \"rps\": $RPS," >> "$RESULT_FILE"
        echo "        \"latency_avg\": $LATENCY_AVG," >> "$RESULT_FILE"
        echo "        \"latency_p99\": $LATENCY_P99," >> "$RESULT_FILE"
        echo "        \"throughput\": $THROUGHPUT," >> "$RESULT_FILE"
        echo "        \"errors\": $ERRORS" >> "$RESULT_FILE"
        echo "      }" >> "$RESULT_FILE"

        echo "    RPS: $RPS, Latency: ${LATENCY_AVG}ms (p99: ${LATENCY_P99}ms)"
    done

    echo "    }" >> "$RESULT_FILE"

    # Stop the server
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    sleep 1
done

echo "" >> "$RESULT_FILE"
echo "  }" >> "$RESULT_FILE"
echo "}" >> "$RESULT_FILE"

echo ""
echo "=========================================="
echo "Benchmark complete!"
echo "Results saved to: $RESULT_FILE"
echo "=========================================="

# Print summary table
echo ""
echo "Summary (JSON endpoint RPS):"
echo "----------------------------"
jq -r '.results | to_entries | .[] | "\(.key): \(.value.json.rps // "N/A") req/s"' "$RESULT_FILE"
