#!/bin/bash

set -euo pipefail

echo "🚀 Claude Code Worker - Single Reliable Test"
echo "==========================================="
echo "This script aligns with test-worker.js and runs it directly."
echo ""

# Resolve script directory (so paths work regardless of caller CWD)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
WRAPPER_PATH="${DIR}/../../../scripts/claude_wrapper.py"
if [ ! -f "$WRAPPER_PATH" ]; then
  echo "❌ Missing required file: $WRAPPER_PATH"
  exit 1
fi

# Ensure the working directory used by test-worker.js exists (next to this script)
mkdir -p "${DIR}/test-workspace"

echo "⚡ Running: node ${DIR}/test-worker.js"
echo ""
node "${DIR}/test-worker.js"
exit $?