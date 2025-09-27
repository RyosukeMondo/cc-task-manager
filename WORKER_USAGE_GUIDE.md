# Claude Code Worker System - Usage Guide

## Overview

Your system provides **three different ways** to run Claude Code tasks:

1. **Direct Python Wrapper** - Simple stdin/stdout interface
2. **NestJS Application with Queue** - Full-featured task management system
3. **Direct CLI Testing** - For debugging Claude Code commands

## Architecture

The system now uses a **monorepo structure** with independent applications:

- **Main Application** (`src/`): Core API and web interface
- **Worker Application** (`apps/worker/`): Independent Claude Code task processor
- **Shared Packages** (`packages/`): Common types, schemas, and utilities

The worker runs as a standalone NestJS application that can be deployed independently from the main application.

---

## Method 1: Direct Python Wrapper (Recommended for Testing)

### Quick Test
```bash
# Test the worker system directly
node test-worker.js
```

### Manual Usage
```bash
# Start the wrapper
python3 scripts/claude_wrapper.py

# Send JSON command via stdin (new schema):
{"action": "prompt", "prompt": "List files in current directory", "options": {"cwd": ".", "permission_mode": "bypassPermissions"}}

# Legacy format (`{"command": ...}`) is still accepted for backward compatibility, but
# the action/prompt schema allows richer orchestration features (cancel, status, shutdown).
```

### Wrapper Features
- ✅ Real-time status updates via JSON
- ✅ Process monitoring with PID tracking
- ✅ Timeout handling (configurable)
- ✅ Graceful shutdown with signal handling
- ✅ Error reporting with stderr capture

---

## Method 2: NestJS Application with Queue System

### Prerequisites
```bash
# Redis must be running for the queue system
sudo apt install redis-server
sudo systemctl start redis-server

# Or using Docker
docker run -d -p 6379:6379 redis:latest
```

> 💡 The `test-bullmq-worker.js` script now checks for Redis automatically. If Redis is not available but Docker is installed, it will start (or reuse) a local container named `claude-redis` based on `redis:7-alpine` before running the test.

### Starting the Applications

#### Main Application
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# The app starts on port 3000 by default
```

#### Worker Application (Independent)
```bash
# Development mode
npm run start:worker:dev

# Production mode
npm run build:worker
npm run start:worker:prod

# Or using workspace commands directly
pnpm --filter @cc-task-manager/worker start:dev
pnpm --filter @cc-task-manager/worker start:prod
```

### Using the Queue System
```javascript
const { Queue, QueueEvents } = require('bullmq');

const queue = new Queue('claude-code-queue', {
  connection: { host: 'localhost', port: 6379 }
});

// Add a task
const job = await queue.add('claude-code-task', {
  taskId: 'unique-task-id',
  prompt: 'Your Claude Code command here',
  sessionName: 'my-session',
  workingDirectory: './workspace',
  options: { timeout: 60 },
  timeoutMs: 60000
});

// Wait for completion
const result = await job.waitUntilFinished(queueEvents);
```

### Queue System Features
- ✅ Task queuing with priority support
- ✅ Worker pool management
- ✅ Job persistence and retry logic
- ✅ Real-time monitoring and logging
- ✅ Graceful shutdown handling
- ✅ BullMQ dashboard integration

---

## Method 3: Direct CLI Testing (For Debugging)

### Simple Test
```bash
# Test if Claude Code works directly
echo 'List files' | timeout 10s claude --print --dangerously-skip-permissions
```

### Interactive Mode
```bash
# Start Claude Code in interactive mode
claude

# Or with a specific command
claude "List the files in this directory"
```

---

## Configuration

### Environment Variables
```bash
# Worker configuration
REDIS_HOST=localhost
REDIS_PORT=6379
WORKER_CONCURRENCY=3
PYTHON_EXECUTABLE=python3

# Claude Code settings
CLAUDE_API_KEY=your-api-key  # If needed
```

### Application Config
The worker now runs as an independent application with its own configuration:
- Worker configuration: `apps/worker/src/` and shared packages
- Main app configuration: `src/config/` for the main application
- Shared configuration: `packages/schemas/` and `packages/types/`
- Worker-specific settings: Worker pool, queue configuration, timeout settings

---

## Testing Your Setup

### 1. Test Worker System
```bash
node test-worker.js
```

### 2. Test Queue System (requires Redis)
```bash
node test-bullmq-worker.js
```

### 3. Test Worker Application Independently
```bash
# Run worker tests
npm run test:worker

# Build worker independently
npm run build:worker

# Start worker in development mode
npm run start:worker:dev
```

### 4. Test Claude Code Directly
```bash
claude --version
claude auth status
```

---

## Troubleshooting

### Common Issues

**Claude Code Timeouts**
- Claude Code CLI may hang on certain commands
- The wrapper includes a 60-second timeout by default
- Use `--dangerously-skip-permissions` for automated execution

**Redis Connection Issues**
```bash
# Check if Redis is running
redis-cli ping

# Start Redis if needed
sudo systemctl start redis-server
```

**Worker Not Processing Jobs**
```bash
# Check main application logs
npm run start:dev

# Check worker application logs
npm run start:worker:dev

# Check worker status in logs
```

**Permission Issues**
- Claude Code may require permissions for file operations
- Use `--dangerously-skip-permissions` in automated environments
- Ensure working directory exists and is writable

### Debug Mode
```bash
# Enable debug logging
DEBUG=* node test-worker.js

# Check Python wrapper logs (output to stderr)
python3 scripts/claude_wrapper.py
```

---

## API Reference

### Python Wrapper Input Format
```json
{
  "action": "prompt",
  "prompt": "Your Claude Code instruction",
  "options": {
    "cwd": "./path/to/workspace",
    "permission_mode": "bypassPermissions"
  }
}

# Legacy payload:
{
  "command": "Your Claude Code prompt",
  "working_directory": "./path/to/workspace",
  "timeout": 60
}
```

### Python Wrapper Output Format
```json
{
  "status": "ready|started|running|completed|failed|error|timeout|shutdown",
  "timestamp": "2025-09-26T21:38:14.560Z",
  "message": "Status description",
  "return_code": 0,
  "stdout_length": 1234,
  "stderr_length": 0,
  "error": "Error description if failed"
}
```

---

## Next Steps

1. **Test the basic wrapper**: Run `node test-worker.js`
2. **Set up Redis**: For queue system testing
3. **Start the main app**: `npm run start:dev`
4. **Start the worker app**: `npm run start:worker:dev`
5. **Create custom tasks**: Use the queue system for your workflows
6. **Monitor workers**: Check logs and queue status

The worker system is functional - the main issue appears to be Claude Code CLI hanging on certain commands. The wrapper handles this gracefully with timeouts and proper error reporting.