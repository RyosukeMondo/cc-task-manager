# Claude Code Comprehensive Specification

**Generated:** 2025-09-29
**Based on:** SDK Documentation, Session Analysis, Wrapper Interface, and Behavioral Patterns

## Executive Summary

Claude Code is an agentic coding tool that provides AI-powered programming assistance through multiple interfaces: CLI, TypeScript SDK, and Python SDK. It features sophisticated context management, a rich tool ecosystem, and advanced session management capabilities.

## 1. Core Architecture

### 1.1 Overview
- **Primary Interface**: Command-line tool with SDK integrations
- **Communication Protocol**: STDIO-based JSON message exchange
- **Session Management**: JSONL file persistence in `~/.claude/projects/*/sessions/`
- **Context Management**: Automatic compaction and prompt caching

### 1.2 Availability
- **CLI**: Global npm package `@anthropic-ai/claude-code`
- **TypeScript SDK**: `@anthropic-ai/claude-code` on NPM
- **Python SDK**: `claude-code-sdk` on PyPI

## 2. STDIO Interface Specification

### 2.1 Communication Protocol

Claude Code uses a JSON-based STDIO interface for wrapper implementations:

**Input Format**: JSON lines on STDIN
**Output Format**: JSON events on STDOUT

### 2.2 Input Commands

| Command | Description | Required Fields |
|---------|-------------|-----------------|
| `prompt` | Execute a Claude Code query | `prompt`, `options` |
| `cancel` | Cancel running operation | `run_id` (optional) |
| `status` | Get current system status | None |
| `shutdown` | Gracefully shutdown wrapper | None |

### 2.3 Output Events

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `ready` | System initialization complete | `state`, `version` |
| `run_started` | Operation began | `run_id`, `options` |
| `stream` | Real-time operation output | `payload`, `run_id` |
| `run_completed` | Operation finished successfully | `outcome`, `reason` |
| `run_failed` | Operation failed | `error`, `traceback` |
| `run_cancelled` | Operation was cancelled | `reason` |
| `run_terminated` | Operation terminated unexpectedly | `reason` |
| `limit_notice` | Rate/usage limit encountered | `message` |
| `auto_shutdown` | Automatic shutdown triggered | `reason` |
| `error` | General error occurred | `error`, `details` |
| `status` | Status response | `state`, `active_run` |
| `state` | State change notification | `state` |
| `shutdown` | Shutdown complete | `reason` |
| `signal` | Signal received | `signal` |
| `fatal` | Fatal error | `error`, `traceback` |

## 3. Session Management

### 3.1 Session File Format

Sessions are stored as JSONL files in `~/.claude/projects/[project-path]/[session-id].jsonl`

**Key Fields:**
- `type`: Message type (`user`, `assistant`, `summary`)
- `message`: Message content and metadata
- `sessionId`: Unique session identifier
- `timestamp`: ISO timestamp
- `version`: Claude Code version
- `cwd`: Working directory
- `gitBranch`: Current git branch

### 3.2 Message Types

1. **user**: User input messages
2. **assistant**: Claude responses
3. **summary**: Session summaries
4. **unknown**: Unclassified messages

## 4. Tool Ecosystem

### 4.1 Core Tools (Native)

| Tool | Usage Count | Purpose |
|------|-------------|---------|
| `TodoWrite` | 24 | Task management and tracking |
| `Bash` | 19 | Shell command execution |
| `Read` | 15 | File reading operations |
| `Edit` | 7 | File editing operations |
| `Write` | 5 | File creation operations |
| `Glob` | 4 | File pattern matching |

### 4.2 MCP Tools (Model Context Protocol)

#### Spec Workflow Tools
- `mcp__spec-workflow__manage-tasks` (20 uses)
- `mcp__spec-workflow__spec-status`
- `mcp__spec-workflow__spec-workflow-guide`
- `mcp__spec-workflow__create-spec-doc`
- `mcp__spec-workflow__request-approval`

#### Serena Tools (Semantic Code Analysis)
- `mcp__serena__list_dir` (13 uses)
- `mcp__serena__read_file` (10 uses)
- `mcp__serena__search_for_pattern` (7 uses)
- `mcp__serena__find_symbol` (6 uses)
- `mcp__serena__activate_project` (5 uses)

## 5. SDK Specifications

### 5.1 Key Features

1. **Context Management**
   - Automatic compaction to prevent context overflow
   - Prompt caching for up to one hour
   - Session persistence across interactions

2. **Tool Ecosystem**
   - File operations (read, write, edit, glob)
   - Code execution capabilities
   - Web search integration
   - MCP (Model Context Protocol) extensibility

3. **Advanced Permissions**
   - Fine-grained control over agent capabilities
   - Permission mode configuration
   - Security boundaries

4. **Production Essentials**
   - Built-in error handling and recovery
   - Session management and state tracking
   - Monitoring and observability

### 5.2 Authentication

**Basic Authentication:**
- Set `ANTHROPIC_API_KEY` environment variable
- Retrieve API key from Claude Console

**Third-party Providers:**
- Amazon Bedrock (with appropriate credentials)
- Google Vertex AI (with service account setup)

### 5.3 IDE Integrations

**Supported IDEs:**
- VS Code (beta extension)
- JetBrains IDEs (beta extension)

**Features:**
- Inline edit proposals
- Terminal integration
- File tracking and review

## 6. Behavioral Patterns

### 6.1 Session Structures
- Analyzed 8 distinct session patterns
- Average session length varies by task complexity
- Version tracking across sessions (format: "1.0.x")

### 6.2 Workflow Patterns
- Task-oriented interactions dominate usage
- Heavy MCP tool usage for complex operations
- Progressive task breakdown and completion tracking

### 6.3 Error Patterns
- Graceful degradation with limit notices
- Retry logic for transient failures
- Comprehensive error reporting with context

## 7. Implementation Guidelines

### 7.1 Wrapper Implementation

When implementing a Claude Code wrapper:

1. **STDIO Handling**
   - Read JSON lines from STDIN
   - Write JSON events to STDOUT
   - Handle EOF and signal interruption

2. **Session Management**
   - Maintain session state across operations
   - Persist important session metadata
   - Support session resumption

3. **Error Handling**
   - Implement comprehensive error recovery
   - Provide detailed error context
   - Support graceful degradation

### 7.2 Tool Integration

1. **Native Tools**
   - Implement core file operations
   - Support shell command execution
   - Provide task management capabilities

2. **MCP Integration**
   - Connect to specialized MCP servers
   - Route complex operations to appropriate tools
   - Maintain tool capability discovery

## 8. Monitoring and Observability

### 8.1 Event Tracking
- All operations generate trackable events
- Session-level metrics and patterns
- Performance and usage analytics

### 8.2 Health Monitoring
- System status endpoints
- Resource usage tracking
- Error rate monitoring

## 9. Future Considerations

### 9.1 Emerging Patterns
- Increased MCP tool adoption
- More sophisticated workflow orchestration
- Enhanced context management strategies

### 9.2 Extension Points
- Custom MCP server development
- Tool ecosystem expansion
- Advanced permission models

---

## Appendices

### A. Complete Tool Usage Statistics

```
TodoWrite: 24 uses
mcp__spec-workflow__manage-tasks: 20 uses
Bash: 19 uses
Read: 15 uses
mcp__serena__list_dir: 13 uses
mcp__serena__read_file: 10 uses
Edit: 7 uses
mcp__serena__search_for_pattern: 7 uses
mcp__serena__find_symbol: 6 uses
mcp__serena__activate_project: 5 uses
```

### B. STDIO Command Reference

**Input Commands:** prompt, cancel, status, shutdown
**Output Events:** ready, run_started, stream, run_completed, run_failed, run_cancelled, run_terminated, limit_notice, auto_shutdown, error, status, state, shutdown, signal, fatal

### C. Session File Example Structure

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "..."
  },
  "sessionId": "uuid",
  "timestamp": "2025-09-29T10:00:00.000Z",
  "version": "1.0.128",
  "cwd": "/path/to/project",
  "gitBranch": "main"
}
```

---

**Note**: This specification is based on analysis of actual Claude Code behavior, session data, and SDK documentation as of September 2025. Implementation details may evolve as the platform develops.