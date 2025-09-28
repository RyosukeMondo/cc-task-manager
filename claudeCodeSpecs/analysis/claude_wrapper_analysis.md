# Claude Wrapper Analysis

## Core Architecture

### Class: ClaudeCodeWrapper
**Purpose**: High-level orchestrator around the Claude Code Python SDK
**State Management**: Manages session state, run lifecycle, and cancellation

### Key Components

#### 1. State Management
- `shutdown_requested`: Boolean flag for graceful shutdown
- `state`: Current wrapper state ("idle", "executing")
- `current_run`: Dictionary containing active run context
- `current_run_done_event`: Async event for run completion
- `last_session_id`: Session persistence for resume functionality

#### 2. Signal Handling
- Handles SIGTERM and SIGINT for graceful shutdown
- Cancels active runs when signals received
- Emits termination events with metadata

#### 3. Command Protocol
**Input Format**: JSON objects via STDIN
**Output Format**: Structured JSON events via STDOUT

#### 4. Event Types Emitted
- `ready`: Wrapper initialized and ready for commands
- `run_started`: New prompt execution begun
- `stream`: Real-time Claude response data
- `run_completed`: Successful prompt completion
- `run_failed`: Execution error with details
- `run_cancelled`: User or system cancellation
- `auto_shutdown`: Exit on completion triggered
- `shutdown`: Wrapper shutdown complete
- `state`: State change notifications
- `error`: Input validation or processing errors
- `limit_notice`: Rate/usage limit detection
- `signal`: Signal handling events

## Command Interface

### Action Types
1. **prompt**: Execute Claude query with options
2. **cancel**: Cancel active run (optional run_id)
3. **status**: Get current wrapper state
4. **shutdown**: Graceful shutdown request

### Prompt Command Structure
```json
{
  "action": "prompt",
  "prompt": "string",
  "run_id": "optional-uuid",
  "options": {
    "cwd": "/path/to/working/directory",
    "exit_on_complete": boolean,
    "permission_mode": "bypassPermissions|ask|...",
    "resume_last_session": boolean,
    "session_id": "optional-session-uuid"
  }
}
```

### Cancel Command Structure
```json
{
  "action": "cancel",
  "run_id": "optional-target-run-id"
}
```

## Event Stream Format

### Stream Events
```json
{
  "event": "stream",
  "timestamp": "ISO-8601",
  "run_id": "uuid",
  "payload": {
    "message_type": "string",
    "content": [],
    "result": "any",
    "error": "string"
  }
}
```

### Run Lifecycle Events
```json
{
  "event": "run_started|run_completed|run_failed",
  "timestamp": "ISO-8601",
  "run_id": "uuid",
  "version": 1,
  "outcome": "running|completed|failed",
  "reason": "string",
  "tags": []
}
```

## State Machine

```
idle -> (prompt) -> executing -> (completion) -> idle
                               -> (error) -> idle
                               -> (cancel) -> idle
```

## Error Handling Patterns

### 1. ProcessError (Claude SDK)
- EPIPE/Broken pipe: Suppress as expected
- Rate limits: Convert to completion if limit notice seen
- Other errors: Emit run_failed event

### 2. Validation Errors
- Missing prompt: Emit error event
- Invalid options: Emit error with details
- JSON decode errors: Emit error with raw input

### 3. Cancellation Handling
- Graceful: Cancel scope, emit cancelled event
- Forced: Terminate process, emit terminated event

## Session Management

### Session Persistence
- Captures session_id from Claude responses
- Supports resume_last_session option
- Maintains session context across runs

### Option Processing
- Dynamic options based on ClaudeCodeOptions signature
- Backward compatibility for legacy parameters
- Working directory alias support

## Completion Detection

### Exit Conditions
1. `exit_on_complete` option triggers auto-shutdown
2. Rate/usage limits treated as successful completion
3. Signal handling triggers graceful shutdown
4. Manual shutdown command

### Auto-shutdown Sequence
1. Set shutdown_requested flag
2. Cancel active task group
3. Emit auto_shutdown event
4. Allow cleanup in finally blocks