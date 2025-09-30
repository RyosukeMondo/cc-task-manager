#!/bin/bash

# Start development environment
echo "🚀 Starting CC Task Manager Development Environment..."

# Kill any existing PM2 processes and clean ports
echo "🧹 Cleaning up existing processes..."
pm2 delete all 2>/dev/null || true

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

sleep 3

# Verify ports are free
echo "Verifying ports are clear..."
for i in {1..15}; do
  if ! lsof -ti:3005,3006 >/dev/null 2>&1; then
    echo "✅ Ports 3005 and 3006 are clear"
    break
  fi
  echo "⏳ Waiting for ports to be freed... ($i/15)"
  lsof -ti:3005,3006 | xargs -r kill -9 2>/dev/null || true
  sleep 2
done

# Final check
if lsof -ti:3005,3006 >/dev/null 2>&1; then
  echo "❌ ERROR: Ports still in use after cleanup:"
  lsof -ti:3005,3006 | while read pid; do
    ps -p $pid -o pid,cmd
  done
  exit 1
fi

# Start Docker services
echo "📦 Starting Docker containers (PostgreSQL + Redis)..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Create logs directory if it doesn't exist
mkdir -p logs

# Start applications with PM2
echo "🚀 Starting applications with PM2..."
pm2 start ecosystem.app.config.js

echo ""
echo "✅ Development environment started!"
echo ""
echo "📍 Services:"
echo "   - Frontend: http://localhost:3006"
echo "   - Backend:  http://localhost:3005/api"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo ""
echo "📝 PM2 Commands:"
echo "   - pm2 status           - Check application status"
echo "   - pm2 logs             - View all logs"
echo "   - pm2 logs backend     - View backend logs only"
echo "   - pm2 logs frontend    - View frontend logs only"
echo "   - pm2 restart all      - Restart both services"
echo "   - pm2 stop all         - Stop both services"
echo ""
echo "To stop everything:"
echo "   ./stop-dev.sh"
echo ""