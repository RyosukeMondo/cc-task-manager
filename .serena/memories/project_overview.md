# Claude Code Task Manager - Project Overview

## Purpose
Claude Code Task Manager is a worker system for Claude Code SDK integration. It provides:
- Queue-based task processing using BullMQ and Redis
- Contract-driven API development with automated validation
- Worker service for executing Claude Code tasks
- Comprehensive contract testing and documentation

## Core Architecture
- **Backend**: NestJS application with TypeScript
- **Queue System**: BullMQ for job processing with Redis backend
- **Contract System**: Zod-based schema validation with auto-generated OpenAPI docs
- **Testing**: Jest with Pact contract testing
- **Documentation**: Swagger UI with contract-generated API docs

## Key Features
1. **Worker Processing**: Concurrent Claude Code task execution
2. **Contract-Driven Development**: Schema-first API design with validation
3. **Queue Management**: Robust job queuing and processing
4. **Interactive Documentation**: Auto-generated Swagger UI from contracts
5. **Type Safety**: Full TypeScript integration with compile-time validation

## Current Status
- ✅ Core worker system operational
- ✅ Contract-driven development system fully implemented (all 14 tasks complete)
- ✅ Queue processing and job management working
- ⚠️ Claude CLI authentication needs configuration for full end-to-end operation