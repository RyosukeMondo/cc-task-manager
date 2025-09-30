# Development Guide

## Quick Start with Docker + PM2

### Prerequisites
- Node.js 18+
- pnpm
- Docker & Docker Compose
- PM2 (`npm install -g pm2`)

### Start Everything

**Option 1: All-in-one command**
```bash
npm run dev
```
This will:
1. Start PostgreSQL and Redis in Docker containers
2. Start backend (port 3005) and frontend (port 3006) with PM2

**Option 2: Step-by-step**
```bash
# 1. Start Docker services (PostgreSQL + Redis)
npm run docker:up

# 2. Run database migrations (first time only)
npm run db:migrate

# 3. Start backend and frontend with PM2
pm2 start ecosystem.app.config.js

# 4. View logs
pm2 logs
```

### Stop Everything
```bash
npm run dev:stop
```
Or:
```bash
pm2 stop ecosystem.app.config.js
npm run docker:down
```

## Available Commands

### Docker Commands
- `npm run docker:up` - Start PostgreSQL and Redis
- `npm run docker:down` - Stop containers (keeps data)
- `npm run docker:clean` - Stop and remove all data
- `npm run docker:logs` - View container logs
- `npm run docker:restart` - Restart containers

### Database Commands
- `npm run db:migrate` - Run Prisma migrations
- `npm run db:seed` - Seed database with test data
- `npm run db:studio` - Open Prisma Studio (database GUI)

### PM2 Commands
- `pm2 list` - Show running processes
- `pm2 logs` - View all logs
- `pm2 logs cc-task-manager-backend` - View backend logs only
- `pm2 logs cc-task-manager-frontend` - View frontend logs only
- `pm2 restart all` - Restart all processes
- `pm2 stop all` - Stop all processes
- `pm2 delete all` - Delete all processes

## Service URLs

- **Frontend**: http://localhost:3006
- **Backend API**: http://localhost:3005/api
- **Prisma Studio**: http://localhost:5555 (when running `npm run db:studio`)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Database Credentials

Default credentials (defined in docker-compose.yml):
- **Host**: localhost
- **Port**: 5432
- **Database**: cc_task_manager
- **User**: user
- **Password**: password

Connection string:
```
postgresql://user:password@localhost:5432/cc_task_manager
```

## Troubleshooting

### Port already in use
```bash
# Check what's using the port
sudo lsof -i :3005
sudo lsof -i :5432

# Kill the process if needed
sudo kill -9 <PID>
```

### Reset everything
```bash
# Stop all services
pm2 delete all
npm run docker:clean

# Start fresh
npm run docker:up
npm run db:migrate
pm2 start ecosystem.app.config.js
```

### Database connection issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View PostgreSQL logs
npm run docker:logs

# Restart PostgreSQL
docker restart cc-task-manager-postgres
```

### PM2 processes not starting
```bash
# Check PM2 status
pm2 status

# View error logs
pm2 logs --err

# Restart specific service
pm2 restart cc-task-manager-backend
```