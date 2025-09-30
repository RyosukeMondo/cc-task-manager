#!/bin/bash

# Start development environment
echo "🚀 Starting CC Task Manager Development Environment..."

# Start Docker services
echo "📦 Starting Docker containers (PostgreSQL + Redis)..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Start backend
echo "🔧 Starting backend..."
cd apps/backend
node dist/apps/backend/src/main.js &
BACKEND_PID=$!
cd ../..

# Start frontend
echo "🎨 Starting frontend..."
cd apps/frontend
npx pnpm dev &
FRONTEND_PID=$!
cd ../..

echo ""
echo "✅ Development environment started!"
echo ""
echo "📍 Services:"
echo "   - Frontend: http://localhost:3006"
echo "   - Backend:  http://localhost:3005/api"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo ""
echo "📝 Processes:"
echo "   - Backend PID: $BACKEND_PID"
echo "   - Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop: docker compose down"
echo "         kill $BACKEND_PID $FRONTEND_PID"
echo ""