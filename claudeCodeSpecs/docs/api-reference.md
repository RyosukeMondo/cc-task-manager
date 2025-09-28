# Claude Code Specification System API Reference

## Overview

The Claude Code Specification System provides a comprehensive REST API for managing Claude Code wrapper specifications, runtime monitoring, and validation. The API consists of three main components:

- **Specification API**: Core specification management and lifecycle operations
- **Monitoring API**: Runtime monitoring and event capture capabilities
- **Validation API**: Schema validation and compliance testing

All APIs follow RESTful conventions and return standardized JSON responses.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

Currently, the API operates without authentication. This may change in future versions for production deployments.

## Response Format

All API endpoints return responses in the following standardized format:

```typescript
interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  version: string;
}
```

## Error Handling

Error responses include detailed error messages and appropriate HTTP status codes:

- `400 Bad Request`: Invalid request data or parameters
- `404 Not Found`: Requested resource does not exist
- `500 Internal Server Error`: Server-side processing error

Example error response:
```json
{
  "success": false,
  "error": "Specification 'invalid-spec' not found",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "version": "1.0.0"
}
```

---

## Specification API

### Base Path: `/specifications`

The Specification API manages Claude Code specifications, schemas, and generated documentation.

#### List Specifications

**GET** `/specifications`

Returns a list of all available specifications and schemas.

**Response:**
```json
{
  "success": true,
  "data": {
    "specifications": [
      {
        "name": "test_specification",
        "type": "generated",
        "path": "/path/to/spec.json",
        "version": "1.0.0",
        "generated_at": "2023-12-01T10:00:00.000Z",
        "size": 2048
      }
    ],
    "count": 1
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "version": "1.0.0"
}
```

#### Get Specification

**GET** `/specifications/{spec_name}`

Retrieves a specific specification by name.

**Parameters:**
- `spec_name` (path): Name of the specification to retrieve

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "test_specification",
    "version": "1.0.0",
    "generated_at": "2023-12-01T10:00:00.000Z",
    "schemas": {...},
    "behavioral_patterns": {...}
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "version": "1.0.0"
}
```

#### Create Specification

**POST** `/specifications/{spec_name}`

Creates a new specification with the provided data.

**Parameters:**
- `spec_name` (path): Name for the new specification

**Request Body:**
```json
{
  "version": "1.0.0",
  "description": "Custom specification",
  "schemas": {...},
  "behavioral_patterns": {...}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Specification created successfully",
    "path": "/path/to/spec.json"
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "version": "1.0.0"
}
```

#### Update Specification

**PUT** `/specifications/{spec_name}`

Updates an existing specification.

**Parameters:**
- `spec_name` (path): Name of the specification to update

**Request Body:**
```json
{
  "version": "1.1.0",
  "description": "Updated specification",
  "schemas": {...}
}
```

#### Delete Specification

**DELETE** `/specifications/{spec_name}`

Deletes a specification.

**Parameters:**
- `spec_name` (path): Name of the specification to delete

#### Get Schema

**GET** `/specifications/schemas/{schema_type}`

Retrieves a specific schema by type.

**Parameters:**
- `schema_type` (path): Type of schema (`commands`, `events`, `states`)

**Response:**
```json
{
  "success": true,
  "data": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {...}
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "version": "1.0.0"
}
```

#### Generate Specification

**POST** `/specifications/generate`

Triggers specification generation from runtime data.

**Request Body:**
```json
{
  "wrapper_name": "TestClaudeCodeWrapper",
  "data_source": "runtime_monitoring",
  "options": {
    "include_behavioral_analysis": true,
    "generate_documentation": true
  }
}
```

---

## Monitoring API

### Base Path: `/monitoring`

The Monitoring API provides access to runtime monitoring, event capture, and session management.

#### Get System Status

**GET** `/monitoring/status`

Returns current monitoring system status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "active",
    "active_sessions": 2,
    "events_captured": 1250,
    "last_event": "2023-12-01T10:00:00.000Z",
    "uptime": "2h 15m 30s"
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "session_id": null
}
```

#### Start Monitoring Session

**POST** `/monitoring/sessions`

Creates a new monitoring session.

**Request Body:**
```json
{
  "session_name": "test_session",
  "capture_options": {
    "capture_commands": true,
    "capture_events": true,
    "capture_states": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "session-abc123",
    "session_name": "test_session",
    "started_at": "2023-12-01T10:00:00.000Z",
    "status": "active"
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "session_id": "session-abc123"
}
```

#### List Sessions

**GET** `/monitoring/sessions`

Returns list of all monitoring sessions.

**Query Parameters:**
- `status` (optional): Filter by session status (`active`, `stopped`, `archived`)
- `limit` (optional): Maximum number of sessions to return (default: 100)

#### Get Session

**GET** `/monitoring/sessions/{session_id}`

Retrieves details of a specific session.

**Parameters:**
- `session_id` (path): ID of the session to retrieve

#### Stop Session

**POST** `/monitoring/sessions/{session_id}/stop`

Stops an active monitoring session.

#### Get Events

**GET** `/monitoring/events`

Retrieves captured events with optional filtering.

**Query Parameters:**
- `session_id` (optional): Filter by session ID
- `event_type` (optional): Filter by event type
- `start_time` (optional): Start time for event range (ISO 8601)
- `end_time` (optional): End time for event range (ISO 8601)
- `limit` (optional): Maximum number of events (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "event_id": "evt-123",
        "event_type": "run_started",
        "timestamp": "2023-12-01T10:00:00.000Z",
        "session_id": "session-abc123",
        "data": {...}
      }
    ],
    "count": 1,
    "total_count": 1250
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

#### Capture Event

**POST** `/monitoring/events`

Manually capture an event.

**Request Body:**
```json
{
  "event_type": "custom_event",
  "data": {...},
  "session_id": "session-abc123"
}
```

---

## Validation API

### Base Path: `/validation`

The Validation API provides schema validation, compliance checking, and testing capabilities.

#### Validate Data

**POST** `/validation/validate`

Validates data against a specific schema.

**Request Body:**
```json
{
  "schema_type": "commands",
  "data": {
    "action": "prompt",
    "prompt": "Hello Claude"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "schema_type": "commands",
    "validation_errors": []
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "validation_id": "val-123"
}
```

#### Run Compliance Check

**POST** `/validation/compliance`

Runs comprehensive compliance checks against specifications.

**Request Body:**
```json
{
  "wrapper_implementation": "path/to/wrapper",
  "specification": "test_specification",
  "tests": ["schema_validation", "behavioral_compliance", "state_transitions"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "compliance_score": 0.95,
    "passed_tests": 18,
    "failed_tests": 1,
    "total_tests": 19,
    "results": [...],
    "recommendations": [...]
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "validation_id": "comp-456"
}
```

#### Get Validation Results

**GET** `/validation/results/{validation_id}`

Retrieves results of a previous validation.

**Parameters:**
- `validation_id` (path): ID of the validation to retrieve

#### List Validation History

**GET** `/validation/history`

Returns history of validation operations.

**Query Parameters:**
- `limit` (optional): Maximum number of results (default: 50)
- `type` (optional): Filter by validation type (`schema`, `compliance`)

#### Run Test Suite

**POST** `/validation/test-suite`

Executes a comprehensive test suite against a wrapper implementation.

**Request Body:**
```json
{
  "wrapper_path": "path/to/wrapper",
  "test_configuration": {
    "timeout": 30000,
    "concurrent_tests": 5,
    "test_types": ["unit", "integration", "behavioral"]
  }
}
```

---

## WebSocket API

### Event Streaming

Real-time event streaming is available via WebSocket connection:

```
ws://localhost:8000/api/v1/monitoring/stream
```

**Connection Parameters:**
- `session_id` (optional): Subscribe to specific session events
- `event_types` (optional): Comma-separated list of event types to receive

**Message Format:**
```json
{
  "type": "event",
  "data": {
    "event_id": "evt-123",
    "event_type": "run_started",
    "timestamp": "2023-12-01T10:00:00.000Z",
    "session_id": "session-abc123",
    "data": {...}
  }
}
```

---

## Code Examples

### Python Client Example

```python
import requests
import json

class ClaudeCodeSpecClient:
    def __init__(self, base_url="http://localhost:8000/api/v1"):
        self.base_url = base_url

    def list_specifications(self):
        response = requests.get(f"{self.base_url}/specifications")
        return response.json()

    def validate_command(self, command_data):
        payload = {
            "schema_type": "commands",
            "data": command_data
        }
        response = requests.post(
            f"{self.base_url}/validation/validate",
            json=payload
        )
        return response.json()

    def start_monitoring(self, session_name):
        payload = {"session_name": session_name}
        response = requests.post(
            f"{self.base_url}/monitoring/sessions",
            json=payload
        )
        return response.json()

# Usage
client = ClaudeCodeSpecClient()
specs = client.list_specifications()
print(f"Found {specs['data']['count']} specifications")
```

### JavaScript/TypeScript Client Example

```typescript
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  version: string;
}

class ClaudeCodeSpecClient {
  constructor(private baseUrl = 'http://localhost:8000/api/v1') {}

  async listSpecifications(): Promise<APIResponse> {
    const response = await fetch(`${this.baseUrl}/specifications`);
    return response.json();
  }

  async validateCommand(commandData: any): Promise<APIResponse> {
    const response = await fetch(`${this.baseUrl}/validation/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schema_type: 'commands',
        data: commandData
      })
    });
    return response.json();
  }

  async startMonitoring(sessionName: string): Promise<APIResponse> {
    const response = await fetch(`${this.baseUrl}/monitoring/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_name: sessionName })
    });
    return response.json();
  }
}

// Usage
const client = new ClaudeCodeSpecClient();
const specs = await client.listSpecifications();
console.log(`Found ${specs.data.count} specifications`);
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default Limit**: 1000 requests per hour per IP
- **Burst Limit**: 100 requests per minute per IP
- **Headers**: Rate limit information is included in response headers

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1638360000
```

---

## Versioning

The API follows semantic versioning. Current version is `v1`. Future versions will maintain backward compatibility where possible.

Version information is included in all responses via the `version` field.

---

## Support

For API support and questions:
- Documentation: `/docs`
- Health Check: `/health`
- OpenAPI Spec: `/openapi.json`