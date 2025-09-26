#!/bin/bash

set -euo pipefail

echo "🚀 Claude Code Worker - Single Reliable Test"
echo "==========================================="
echo "This script aligns with test-worker.js and runs it directly."
echo ""

# Prerequisite checks
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed or not on PATH. Please install Node.js and try again."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3 is not installed or not on PATH. Please install Python 3 and try again."
  exit 1
fi

# Ensure Python wrapper exists (used by test-worker.js)
if [ ! -f scripts/claude_wrapper.py ]; then
  echo "❌ Missing required file: scripts/claude_wrapper.py"
  exit 1
fi

# Ensure the working directory used by test-worker.js exists
mkdir -p ./test-workspace

echo "⚡ Running: node test-worker.js"
echo ""
node test-worker.js
exit $?