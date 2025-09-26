#!/bin/bash

echo "🚀 Claude Code Worker - Quick Test Commands"
echo "==========================================="

echo ""
echo "1️⃣  Test Direct Python Wrapper (Simplest)"
echo "   Command: node test-worker.js"
echo ""

echo "2️⃣  Test Queue System (Full System)"
echo "   Command: node simple-test.js"
echo "   Note: Requires Redis running"
echo ""

echo "3️⃣  Start Full NestJS Application"
echo "   Command: npm run start:dev"
echo "   URL: http://localhost:3000"
echo ""

echo "4️⃣  Check Claude Code Status"
echo "   Commands:"
echo "   - claude --version"
echo "   - claude auth status"
echo ""

echo "5️⃣  Manual Python Wrapper Test"
echo "   Command: python3 scripts/claude_wrapper.py"
echo "   Input: {\"action\": \"prompt\", \"prompt\": \"echo hello\", \"options\": {\"cwd\": \".\", \"permission_mode\": \"bypassPermissions\"}}"
echo "   (Legacy format with {\"command\": ...} still works, but new schema is preferred)"
echo ""

echo "Choose your test (1-5):"