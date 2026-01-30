#!/bin/bash

# bunWay Benchmark Suite - Setup Script
# Checks and installs required dependencies for running benchmarks

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          bunWay Benchmark Suite - Setup                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 found: $(command -v $1)"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

echo "Checking required dependencies..."
echo ""

# Check Bun
if check_command bun; then
    echo "  Version: $(bun --version)"
else
    echo ""
    echo -e "${YELLOW}To install Bun:${NC}"
    echo "  curl -fsSL https://bun.sh/install | bash"
    echo ""
fi

# Check Node.js
if check_command node; then
    echo "  Version: $(node --version)"
else
    echo ""
    echo -e "${YELLOW}To install Node.js:${NC}"
    echo "  brew install node"
    echo ""
fi

echo ""
echo "Checking benchmark tools..."
echo ""

TOOL_FOUND=false

# Check oha (preferred)
if check_command oha; then
    TOOL_FOUND=true
    echo "  Version: $(oha --version 2>/dev/null || echo 'unknown')"
fi

# Check wrk
if check_command wrk; then
    TOOL_FOUND=true
fi

# Check bombardier
if check_command bombardier; then
    TOOL_FOUND=true
fi

if [ "$TOOL_FOUND" = false ]; then
    echo ""
    echo -e "${YELLOW}No benchmark tool found!${NC}"
    echo ""
    echo "For accurate benchmarks, install one of these tools:"
    echo ""
    echo "  ${GREEN}oha (Recommended for fast Bun servers):${NC}"
    echo "    brew install oha          # macOS"
    echo "    cargo install oha         # Any platform with Rust"
    echo ""
    echo "  ${GREEN}wrk (Classic, well-tested):${NC}"
    echo "    brew install wrk          # macOS"
    echo "    apt-get install wrk       # Ubuntu/Debian"
    echo ""
    echo "  ${GREEN}bombardier (Cross-platform):${NC}"
    echo "    brew install bombardier   # macOS"
    echo "    go install github.com/codesenberg/bombardier@latest"
    echo ""
fi

echo ""
echo "Checking project dependencies..."
echo ""

# Check if we're in the right directory
if [ -f "package.json" ]; then
    echo -e "${GREEN}✓${NC} package.json found"

    # Check if dependencies are installed
    if [ -d "node_modules" ]; then
        echo -e "${GREEN}✓${NC} node_modules exists"
    else
        echo -e "${YELLOW}!${NC} node_modules not found, running bun install..."
        bun install
    fi
else
    echo -e "${RED}✗${NC} package.json not found"
    echo "  Please run this script from the project root directory"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$TOOL_FOUND" = true ]; then
    echo -e "${GREEN}Setup complete!${NC}"
    echo ""
    echo "Run benchmarks with:"
    echo "  bun run benchmark:fair:quick    # Quick (~3 min)"
    echo "  bun run benchmark:fair          # Full (~20 min)"
else
    echo -e "${YELLOW}Setup incomplete - install a benchmark tool for accurate results${NC}"
    echo ""
    echo "The benchmark will use an internal fallback, but for accurate"
    echo "results with fast Bun servers, please install oha:"
    echo ""
    echo "  brew install oha"
    echo ""
    echo "Then run:"
    echo "  bun run benchmark:fair:quick"
fi

echo ""
