#!/bin/bash

echo "🧪 Testing Claude Code Worker via HTTP API"
echo "=========================================="

# Create test workspace
mkdir -p test-workspace

# Submit Claude Code job via HTTP (if you add REST endpoints)
curl -X POST http://localhost:3000/api/claude-code/submit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple Node.js express server that responds with Hello World on port 3001",
    "sessionName": "test-api-session",
    "workingDirectory": "'$(pwd)'/test-workspace",
    "options": {
      "timeout": 60
    }
  }'

echo ""
echo "📋 Job submitted! Check the application logs for progress."
echo "📁 Results will appear in: test-workspace/"