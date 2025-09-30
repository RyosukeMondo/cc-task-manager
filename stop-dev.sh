#!/bin/bash

echo "🛑 Stopping CC Task Manager Development Environment..."

# Stop PM2 applications
echo "Stopping PM2 applications..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

sleep 2

# Kill processes on ports 3005 and 3006 (repeat multiple times)
echo "Cleaning up any remaining processes..."
for i in {1..5}; do
  lsof -ti:3005,3006 | xargs -r kill -9 2>/dev/null || true
  sleep 1
done

# Kill any remaining node/nest/pnpm processes
pkill -9 -f "ts-node" 2>/dev/null || true
pkill -9 -f "node.*main.js" 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "nest start" 2>/dev/null || true
pkill -9 -f "pnpm.*start:dev" 2>/dev/null || true
pkill -9 -f "pnpm dev" 2>/dev/null || true

sleep 2

# Final aggressive cleanup - kill any remaining processes on the ports
lsof -ti:3005,3006 | xargs -r kill -9 2>/dev/null || true

# Use fuser as alternative port cleanup (more aggressive)
fuser -k 3005/tcp 2>/dev/null || true
fuser -k 3006/tcp 2>/dev/null || true

sleep 1

# Extra check - kill parent processes too if needed
if lsof -ti:3005,3006 >/dev/null 2>&1; then
  echo "Found stubborn processes, killing parent processes..."
  lsof -ti:3005,3006 | while read pid; do
    ppid=$(ps -p $pid -o ppid= 2>/dev/null | tr -d ' ')
    [ -n "$ppid" ] && kill -9 $ppid 2>/dev/null || true
    kill -9 $pid 2>/dev/null || true
  done
fi

sleep 1

# Stop Docker containers
echo "Stopping Docker containers..."
docker compose down

echo ""
echo "✅ Development environment stopped!"
echo ""
echo "💡 Tip: Use 'pm2 status' to verify all processes are stopped"
echo ""