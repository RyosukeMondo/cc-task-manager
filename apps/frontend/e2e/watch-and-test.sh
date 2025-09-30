#!/bin/bash

# Watch and Test Script - Automates the "access → error → fix → repeat" loop
#
# This script:
# 1. Watches for file changes
# 2. Automatically runs E2E smoke tests on changes
# 3. Shows which pages broke after your changes
#
# Usage:
#   ./e2e/watch-and-test.sh
#
# Or add to package.json:
#   "test:e2e:watch": "./e2e/watch-and-test.sh"

echo "🔍 Starting Watch Mode for E2E Tests"
echo "This will run smoke tests whenever you save a file"
echo ""

# Run tests initially
pnpm test:e2e:smoke

# Watch for changes and re-run
while true; do
  # Use inotifywait if available, otherwise fall back to simple loop
  if command -v inotifywait &> /dev/null; then
    inotifywait -r -e modify,create,delete src/ --exclude '\.next|node_modules'
    echo "📝 File changed, running tests..."
    pnpm test:e2e:smoke
  else
    # Fallback: check every 5 seconds
    sleep 5
    pnpm test:e2e:smoke
  fi
done
