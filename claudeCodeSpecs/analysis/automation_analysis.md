# Spec Workflow Automation Analysis

## Core Architecture

### Class: SpecWorkflowAutomation
**Purpose**: Automates spec-workflow task execution using Claude Code sessions
**Pattern**: Session lifecycle management with completion detection

### Key Components

#### 1. Configuration Management
- `max_cycles`: Maximum automation cycles (default: 50)
- `max_session_time`: Maximum session duration (default: 1800s)
- `debug_options`: Comprehensive debugging configuration
- Loads config values from `scripts/config.js`

#### 2. Session Lifecycle
1. Start Claude session via subprocess
2. Wait for ready event
3. Send predefined prompt
4. Monitor output stream
5. Detect completion patterns
6. Shutdown session gracefully
7. Repeat until completion or max cycles

#### 3. Debug System
**Levels**: raw → all events → payload → content → metadata → tools
**Options**:
- `show_raw_data`: Complete JSON dumps
- `show_all_events`: All events with data
- `show_payload_structure`: Payload analysis
- `show_content_analysis`: Content structure analysis
- `show_stream_metadata`: Stream metadata
- `show_tool_details`: Tool usage details
- `truncate_long_content`: Content length control

## Automation Protocol

### Predefined Prompt Template
```
spec: {spec_name}

work on a single task from spec name above of spec-workflow.

1. fetch one task from spec using mcp tool spec-workflow
2. work on task
3. update task status to complete on complete
4. commit changes
5. check remaining task count
6. end session without asking further actions.

Important: Use the mcp__spec-workflow tools to interact with the specification system.
```

### Session Configuration
```json
{
  "action": "prompt",
  "prompt": "predefined_template",
  "options": {
    "cwd": "/project/path",
    "exit_on_complete": true,
    "permission_mode": "bypassPermissions"
  }
}
```

## Completion Detection System

### Primary Detection (Most Reliable)
**Spec-workflow tool results** with JSON structure:
```json
{
  "success": true,
  "data": {
    "taskProgress": {
      "total": number,
      "completed": number,
      "pending": number
    },
    "overallStatus": "completed"
  }
}
```

### Secondary Detection (Text Patterns)
**Specific completion patterns**:
- "specification is fully implemented"
- "all tasks are marked as completed"
- "all tasks are completed (`[x]`)"
- "all X tasks are completed" (hardcoded numbers)
- " 0 pending tasks" (with leading space)
- "no pending tasks", "zero pending tasks"
- "specification status: completed"

### Fallback Detection (Conservative)
**Tasks file analysis** (with truncation warnings):
- Count `[x]` vs `[ ]` markers
- Only trigger if ≥10 completed tasks and 0 pending
- Warn about potential truncation

## Event Processing Pipeline

### Stream Event Handling
1. Parse JSON from Claude stdout
2. Log to session file if configured
3. Apply debug filtering based on options
4. Extract content from payload
5. Analyze for tool usage patterns
6. Check completion indicators
7. Update automation state

### Tool Detection Logic
**Tool Usage Patterns**:
- Structure-based: `{name, input, id}` → tool_use
- Result-based: `{tool_use_id, content}` → tool_result
- Spec-workflow specific: Contains taskProgress data

### Content Analysis Pipeline
1. **Direct text content**: Check completion patterns
2. **Tool results**: Parse JSON for spec data
3. **Tasks file content**: Fallback pattern matching
4. **Result messages**: Check result field patterns

## Error Handling & Recovery

### Process Management
- Subprocess monitoring with timeout
- Graceful shutdown with 10s timeout
- Force termination after 5s additional wait
- Process cleanup in finally blocks

### Signal Handling
- SIGINT/SIGTERM → graceful shutdown
- Cancel active Claude process
- Clean state management

### Failure Modes
1. **Claude process failure**: Log and restart
2. **JSON parse errors**: Skip malformed lines
3. **Timeout**: Force session end and retry
4. **Max cycles reached**: Stop automation

## Debug Output System

### Content Extraction Hierarchy
1. **Direct payload message**
2. **Content array items** (text, tool_use, tool_result)
3. **Payload result field**
4. **Error content**
5. **Additional payload keys**

### Debug Formatting
- Truncation based on `max_content_length`
- Type-specific formatting for tools vs text
- Structure analysis for debugging
- Sample pattern matching for tasks

## Configuration Integration

### External Config Loading
- Uses `scripts/config.js` via Node.js subprocess
- Fallback to default values on failure
- Runtime config value resolution
- Error handling for missing config script

### Debug Configuration Matrix
```
--debug-raw     : Maximum verbosity (all JSON)
--debug-all     : All events with data
--debug-payload : Payload structure analysis
--debug-content : Content structure analysis
--debug-metadata: Stream metadata
--debug-tools   : Tool usage details (default)
--debug-full    : No content truncation
--max-content N : Truncation threshold
```

## Automation Control Flow

### Main Loop Structure
```python
while not shutdown_requested and cycle < max_cycles:
    start_claude_session()
    while session_active and not completed:
        monitor_output()
        check_completion()
        handle_events()
    shutdown_session()
    if completed: sys.exit(0)
    wait_between_cycles()
```

### Exit Conditions
1. **Completion detected**: Immediate sys.exit(0)
2. **Shutdown requested**: Graceful return True
3. **Max cycles reached**: Warning and return False
4. **Process failure**: Error return False

### State Transitions
```
idle -> starting_session -> session_active -> monitoring ->
  -> completion_detected -> shutdown -> exit
  -> session_failed -> cleanup -> retry
  -> max_cycles -> stop
```