# Claude Code Protocol Schemas

This package provides comprehensive JSON schemas and TypeScript interfaces for Claude Code wrapper communication protocols.

## Features

- **JSON Schema Validation**: Complete JSON schemas for commands, events, and states
- **TypeScript Support**: Generated TypeScript interfaces with Zod validation
- **Runtime Validation**: Safe parsing and validation functions
- **Protocol Documentation**: Comprehensive documentation of all supported communication patterns

## Installation

```bash
npm install @claude-code-wrapper-specs/schemas
```

## Usage

### Basic Validation

```typescript
import { validateCommand, validateEvent } from '@claude-code-wrapper-specs/schemas';

// Validate a command
const command = validateCommand({
  action: 'prompt',
  prompt: 'Hello Claude',
  options: { timeout: 60000 }
});

// Validate an event
const event = validateEvent({
  event: 'run_started',
  timestamp: new Date().toISOString(),
  run_id: 'run-123',
  prompt: 'Hello Claude'
});
```

### Type-Safe Usage

```typescript
import type {
  PromptCommand,
  RunStartedEvent,
  WrapperState
} from '@claude-code-wrapper-specs/schemas';

function handleCommand(cmd: PromptCommand) {
  console.log(`Executing: ${cmd.prompt}`);
}

function handleEvent(event: RunStartedEvent) {
  console.log(`Run ${event.run_id} started with prompt: ${event.prompt}`);
}
```

### Schema Access

```typescript
import {
  CommandSchema,
  EventSchema,
  SCHEMA_METADATA
} from '@claude-code-wrapper-specs/schemas';

// Access Zod schemas directly
const result = CommandSchema.safeParse(unknownData);

// Get schema metadata
console.log(SCHEMA_METADATA.version);
console.log(SCHEMA_METADATA.commands.supported);
```

## Supported Protocols

### Commands
- `prompt`: Execute a Claude Code prompt
- `cancel`: Cancel current execution
- `status`: Get wrapper status
- `shutdown`: Shutdown wrapper
- Legacy command format (backward compatibility)

### Events
- **Lifecycle**: `ready`, `shutdown`
- **Execution**: `run_started`, `run_completed`, `run_cancelled`, `run_terminated`, `run_failed`
- **Runtime**: `stream`, `status`, `error`, `fatal`, `signal`, `state`
- **Control**: `cancel_requested`, `cancel_ignored`, `limit_notice`, `auto_shutdown`

### States
- **Wrapper**: `idle`, `executing`, `terminating`
- **Session**: `none`, `initializing`, `active`, `completing`, `terminated`
- **Run**: `pending`, `starting`, `running`, `streaming`, `cancelling`, `completed`, `failed`, `cancelled`, `terminated`

## Schema Files

The package includes three main JSON schema files:

- `commands.json`: Command structure validation
- `events.json`: Event structure validation
- `states.json`: State management and transitions

These schemas follow JSON Schema Draft 2020-12 and can be used with any JSON Schema validator.

## Development

```bash
# Build TypeScript
npm run build

# Development mode
npm run dev

# Clean build files
npm run clean
```

## Validation Examples

### Command Validation

```typescript
// Valid prompt command
const promptCmd = {
  action: 'prompt',
  prompt: 'Write a hello world function',
  options: {
    timeout: 30000,
    model: 'claude-3-5-sonnet-20241022'
  }
};

// Valid cancel command
const cancelCmd = {
  action: 'cancel'
};

// Legacy command format (still supported)
const legacyCmd = {
  command: 'Write a hello world function',
  working_directory: '/path/to/project'
};
```

### Event Validation

```typescript
// Run started event
const runStarted = {
  event: 'run_started',
  timestamp: '2023-12-01T10:00:00.000Z',
  state: 'executing',
  run_id: 'run-abc123',
  prompt: 'Write a hello world function',
  session_id: 'session-xyz789'
};

// Stream event
const streamEvent = {
  event: 'stream',
  timestamp: '2023-12-01T10:00:05.000Z',
  state: 'executing',
  run_id: 'run-abc123',
  chunk: 'def hello_world():',
  chunk_type: 'text'
};

// Error event
const errorEvent = {
  event: 'error',
  timestamp: '2023-12-01T10:00:10.000Z',
  state: 'idle',
  error: 'Timeout exceeded',
  active_run_id: null
};
```

## License

MIT