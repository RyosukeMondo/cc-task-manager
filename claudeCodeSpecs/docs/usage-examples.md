# Usage Examples and Guides

## Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [Basic Usage Examples](#basic-usage-examples)
3. [Advanced Integration Patterns](#advanced-integration-patterns)
4. [Monitoring and Analysis](#monitoring-and-analysis)
5. [Validation and Testing](#validation-and-testing)
6. [Error Handling and Troubleshooting](#error-handling-and-troubleshooting)
7. [Best Practices](#best-practices)

---

## Quick Start Guide

### Installation and Setup

```bash
# Clone the specification system
git clone <repository-url>
cd claude-code-specification-system

# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies for schemas
cd claudeCodeSpecs/schemas
npm install
npm run build

# Return to root and start the API server
cd ../..
python -m claudeCodeSpecs.api.unified-api
```

### Basic API Usage

```python
import requests

# Check API health
response = requests.get("http://localhost:8000/health")
print(response.json())

# List available specifications
specs = requests.get("http://localhost:8000/api/v1/specifications")
print(f"Available specifications: {specs.json()['data']['count']}")
```

---

## Basic Usage Examples

### 1. Schema Validation

#### Validate a Command

```python
import requests

def validate_claude_command(command_data):
    """Validate a Claude Code command against the schema"""
    payload = {
        "schema_type": "commands",
        "data": command_data
    }

    response = requests.post(
        "http://localhost:8000/api/v1/validation/validate",
        json=payload
    )

    result = response.json()
    if result["success"]:
        if result["data"]["valid"]:
            print("✅ Command is valid")
        else:
            print("❌ Command validation failed:")
            for error in result["data"]["validation_errors"]:
                print(f"  - {error}")
    else:
        print(f"Validation request failed: {result['error']}")

# Example: Valid command
valid_command = {
    "action": "prompt",
    "prompt": "Write a hello world function in Python",
    "options": {
        "timeout": 30000,
        "model": "claude-3-5-sonnet-20241022"
    }
}

validate_claude_command(valid_command)

# Example: Invalid command
invalid_command = {
    "action": "invalid_action",
    "prompt": 123  # Should be string, not number
}

validate_claude_command(invalid_command)
```

#### Validate Events

```python
def validate_claude_event(event_data):
    """Validate a Claude Code event against the schema"""
    payload = {
        "schema_type": "events",
        "data": event_data
    }

    response = requests.post(
        "http://localhost:8000/api/v1/validation/validate",
        json=payload
    )

    return response.json()

# Example: Run started event
run_started_event = {
    "event": "run_started",
    "timestamp": "2023-12-01T10:00:00.000Z",
    "state": "executing",
    "run_id": "run-abc123",
    "prompt": "Write a hello world function",
    "session_id": "session-xyz789"
}

result = validate_claude_event(run_started_event)
print(f"Event validation result: {result['data']['valid']}")
```

### 2. Runtime Monitoring

#### Start a Monitoring Session

```python
import requests
import time

class MonitoringSession:
    def __init__(self, base_url="http://localhost:8000/api/v1"):
        self.base_url = base_url
        self.session_id = None

    def start(self, session_name):
        """Start a new monitoring session"""
        payload = {
            "session_name": session_name,
            "capture_options": {
                "capture_commands": True,
                "capture_events": True,
                "capture_states": True
            }
        }

        response = requests.post(
            f"{self.base_url}/monitoring/sessions",
            json=payload
        )

        if response.status_code == 200:
            result = response.json()
            self.session_id = result["data"]["session_id"]
            print(f"✅ Started monitoring session: {self.session_id}")
            return True
        else:
            print(f"❌ Failed to start session: {response.text}")
            return False

    def get_events(self, limit=10):
        """Get recent events from the session"""
        if not self.session_id:
            print("No active session")
            return []

        params = {
            "session_id": self.session_id,
            "limit": limit
        }

        response = requests.get(
            f"{self.base_url}/monitoring/events",
            params=params
        )

        if response.status_code == 200:
            return response.json()["data"]["events"]
        else:
            print(f"Failed to get events: {response.text}")
            return []

    def stop(self):
        """Stop the monitoring session"""
        if not self.session_id:
            return

        response = requests.post(
            f"{self.base_url}/monitoring/sessions/{self.session_id}/stop"
        )

        if response.status_code == 200:
            print(f"✅ Stopped monitoring session: {self.session_id}")
        else:
            print(f"❌ Failed to stop session: {response.text}")

# Usage example
monitor = MonitoringSession()
if monitor.start("test_wrapper_session"):
    # Simulate some activity
    time.sleep(5)

    # Check for events
    events = monitor.get_events()
    print(f"Captured {len(events)} events")

    for event in events:
        print(f"  {event['timestamp']}: {event['event_type']}")

    # Stop monitoring
    monitor.stop()
```

#### Real-time Event Streaming

```python
import websocket
import json
import threading

class EventStreamer:
    def __init__(self, ws_url="ws://localhost:8000/api/v1/monitoring/stream"):
        self.ws_url = ws_url
        self.ws = None

    def on_message(self, ws, message):
        """Handle incoming event messages"""
        try:
            event = json.loads(message)
            if event["type"] == "event":
                data = event["data"]
                print(f"🔔 {data['event_type']} at {data['timestamp']}")
                if data.get('data'):
                    print(f"   Data: {json.dumps(data['data'], indent=2)}")
        except json.JSONDecodeError:
            print(f"Invalid message: {message}")

    def on_error(self, ws, error):
        print(f"WebSocket error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        print("WebSocket connection closed")

    def on_open(self, ws):
        print("✅ Connected to event stream")

    def start(self, session_id=None, event_types=None):
        """Start event streaming"""
        url = self.ws_url
        params = []

        if session_id:
            params.append(f"session_id={session_id}")
        if event_types:
            params.append(f"event_types={','.join(event_types)}")

        if params:
            url += "?" + "&".join(params)

        self.ws = websocket.WebSocketApp(
            url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )

        # Run in a separate thread
        ws_thread = threading.Thread(target=self.ws.run_forever)
        ws_thread.daemon = True
        ws_thread.start()

        return ws_thread

# Usage example
streamer = EventStreamer()
thread = streamer.start(event_types=["run_started", "run_completed", "error"])

# Keep the main thread alive
import time
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nShutting down...")
    if streamer.ws:
        streamer.ws.close()
```

---

## Advanced Integration Patterns

### 1. Custom Wrapper with Integrated Monitoring

```python
import subprocess
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

class MonitoredClaudeWrapper:
    """
    Example wrapper that integrates with the specification system
    for comprehensive monitoring and validation
    """

    def __init__(self, spec_api_url="http://localhost:8000/api/v1"):
        self.spec_api_url = spec_api_url
        self.session_id = None
        self.process = None

    def start_monitoring(self, session_name: str) -> bool:
        """Start monitoring session for this wrapper instance"""
        payload = {
            "session_name": session_name,
            "capture_options": {
                "capture_commands": True,
                "capture_events": True,
                "capture_states": True
            }
        }

        response = requests.post(
            f"{self.spec_api_url}/monitoring/sessions",
            json=payload
        )

        if response.status_code == 200:
            self.session_id = response.json()["data"]["session_id"]
            return True
        return False

    def validate_command(self, command: Dict[str, Any]) -> bool:
        """Validate command before execution"""
        payload = {
            "schema_type": "commands",
            "data": command
        }

        response = requests.post(
            f"{self.spec_api_url}/validation/validate",
            json=payload
        )

        if response.status_code == 200:
            result = response.json()
            return result["data"]["valid"]
        return False

    def capture_event(self, event_type: str, data: Dict[str, Any]):
        """Capture custom events during execution"""
        if not self.session_id:
            return

        payload = {
            "event_type": event_type,
            "data": data,
            "session_id": self.session_id
        }

        requests.post(
            f"{self.spec_api_url}/monitoring/events",
            json=payload
        )

    def execute_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a Claude Code command with full monitoring"""

        # 1. Validate command
        if not self.validate_command(command):
            return {
                "success": False,
                "error": "Command validation failed"
            }

        # 2. Capture command execution start
        run_id = f"run-{int(time.time())}"
        self.capture_event("run_started", {
            "run_id": run_id,
            "command": command,
            "timestamp": datetime.utcnow().isoformat()
        })

        try:
            # 3. Execute the actual command
            # (This would integrate with your actual Claude Code execution)
            result = self._execute_claude_command(command)

            # 4. Capture successful completion
            self.capture_event("run_completed", {
                "run_id": run_id,
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            })

            return result

        except Exception as e:
            # 5. Capture errors
            self.capture_event("run_failed", {
                "run_id": run_id,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })

            return {
                "success": False,
                "error": str(e)
            }

    def _execute_claude_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Placeholder for actual Claude Code execution"""
        # This would contain your actual Claude Code integration
        time.sleep(2)  # Simulate processing time
        return {
            "success": True,
            "output": f"Executed: {command.get('prompt', 'Unknown command')}"
        }

# Usage example
wrapper = MonitoredClaudeWrapper()

# Start monitoring
if wrapper.start_monitoring("production_wrapper"):
    print("✅ Monitoring started")

    # Execute commands with full monitoring
    commands = [
        {
            "action": "prompt",
            "prompt": "Write a Python function to calculate fibonacci numbers",
            "options": {"timeout": 30000}
        },
        {
            "action": "prompt",
            "prompt": "Explain the time complexity of the fibonacci function",
            "options": {"timeout": 15000}
        }
    ]

    for cmd in commands:
        print(f"\nExecuting: {cmd['prompt'][:50]}...")
        result = wrapper.execute_command(cmd)
        print(f"Result: {result['success']}")
        if not result['success']:
            print(f"Error: {result['error']}")
```

### 2. Automated Compliance Testing

```python
import asyncio
from pathlib import Path

class ComplianceTester:
    """Automated compliance testing for Claude Code wrappers"""

    def __init__(self, spec_api_url="http://localhost:8000/api/v1"):
        self.spec_api_url = spec_api_url

    async def run_full_compliance_check(self, wrapper_path: str) -> Dict[str, Any]:
        """Run comprehensive compliance check on a wrapper implementation"""

        print("🔍 Starting compliance check...")

        # 1. Schema validation tests
        schema_results = await self._test_schema_compliance(wrapper_path)

        # 2. Behavioral pattern tests
        behavioral_results = await self._test_behavioral_compliance(wrapper_path)

        # 3. Performance tests
        performance_results = await self._test_performance_compliance(wrapper_path)

        # 4. Generate comprehensive report
        report = {
            "wrapper_path": wrapper_path,
            "test_timestamp": datetime.utcnow().isoformat(),
            "schema_compliance": schema_results,
            "behavioral_compliance": behavioral_results,
            "performance_compliance": performance_results,
            "overall_score": self._calculate_overall_score([
                schema_results, behavioral_results, performance_results
            ])
        }

        return report

    async def _test_schema_compliance(self, wrapper_path: str) -> Dict[str, Any]:
        """Test wrapper against schema requirements"""
        print("  📋 Testing schema compliance...")

        # Load test commands and events
        test_cases = self._load_test_cases()
        results = []

        for test_case in test_cases:
            payload = {
                "schema_type": test_case["type"],
                "data": test_case["data"]
            }

            response = requests.post(
                f"{self.spec_api_url}/validation/validate",
                json=payload
            )

            if response.status_code == 200:
                result = response.json()
                results.append({
                    "test_case": test_case["name"],
                    "passed": result["data"]["valid"],
                    "errors": result["data"].get("validation_errors", [])
                })

        passed = sum(1 for r in results if r["passed"])
        return {
            "total_tests": len(results),
            "passed_tests": passed,
            "failed_tests": len(results) - passed,
            "score": passed / len(results) if results else 0,
            "details": results
        }

    async def _test_behavioral_compliance(self, wrapper_path: str) -> Dict[str, Any]:
        """Test wrapper behavioral patterns"""
        print("  🎭 Testing behavioral compliance...")

        # Start monitoring session for behavioral analysis
        session_payload = {
            "session_name": f"compliance_test_{int(time.time())}",
            "capture_options": {
                "capture_commands": True,
                "capture_events": True,
                "capture_states": True
            }
        }

        session_response = requests.post(
            f"{self.spec_api_url}/monitoring/sessions",
            json=session_payload
        )

        if session_response.status_code != 200:
            return {"error": "Failed to start monitoring session"}

        session_id = session_response.json()["data"]["session_id"]

        try:
            # Execute behavioral test scenarios
            test_scenarios = self._get_behavioral_scenarios()
            scenario_results = []

            for scenario in test_scenarios:
                result = await self._execute_behavioral_scenario(
                    wrapper_path, scenario, session_id
                )
                scenario_results.append(result)

            # Analyze captured behavioral data
            behavioral_analysis = await self._analyze_behavioral_data(session_id)

            return {
                "scenarios_tested": len(test_scenarios),
                "scenarios_passed": sum(1 for r in scenario_results if r["passed"]),
                "behavioral_patterns": behavioral_analysis,
                "score": sum(r["score"] for r in scenario_results) / len(scenario_results)
            }

        finally:
            # Stop monitoring session
            requests.post(
                f"{self.spec_api_url}/monitoring/sessions/{session_id}/stop"
            )

    def _load_test_cases(self) -> List[Dict[str, Any]]:
        """Load schema validation test cases"""
        return [
            {
                "name": "valid_prompt_command",
                "type": "commands",
                "data": {
                    "action": "prompt",
                    "prompt": "Test prompt",
                    "options": {"timeout": 30000}
                }
            },
            {
                "name": "valid_run_started_event",
                "type": "events",
                "data": {
                    "event": "run_started",
                    "timestamp": "2023-12-01T10:00:00.000Z",
                    "state": "executing",
                    "run_id": "test-run",
                    "prompt": "Test prompt"
                }
            },
            # Add more test cases...
        ]

# Usage example
async def main():
    tester = ComplianceTester()

    # Test a wrapper implementation
    wrapper_path = "/path/to/claude/wrapper"
    results = await tester.run_full_compliance_check(wrapper_path)

    print(f"\n📊 Compliance Report:")
    print(f"Overall Score: {results['overall_score']:.2%}")
    print(f"Schema Compliance: {results['schema_compliance']['score']:.2%}")
    print(f"Behavioral Compliance: {results['behavioral_compliance']['score']:.2%}")
    print(f"Performance Compliance: {results['performance_compliance']['score']:.2%}")

# Run the compliance test
asyncio.run(main())
```

---

## Monitoring and Analysis

### 1. Real-time Dashboard Data

```python
import requests
import json
from datetime import datetime, timedelta

class SpecificationDashboard:
    """Create dashboard data for specification system monitoring"""

    def __init__(self, api_url="http://localhost:8000/api/v1"):
        self.api_url = api_url

    def get_system_overview(self) -> Dict[str, Any]:
        """Get comprehensive system overview"""
        overview = {}

        # Get monitoring status
        status_response = requests.get(f"{self.api_url}/monitoring/status")
        if status_response.status_code == 200:
            overview["monitoring"] = status_response.json()["data"]

        # Get specification count
        specs_response = requests.get(f"{self.api_url}/specifications")
        if specs_response.status_code == 200:
            specs_data = specs_response.json()["data"]
            overview["specifications"] = {
                "total": specs_data["count"],
                "by_type": self._group_specs_by_type(specs_data["specifications"])
            }

        # Get recent events
        events_response = requests.get(f"{self.api_url}/monitoring/events?limit=100")
        if events_response.status_code == 200:
            events = events_response.json()["data"]["events"]
            overview["recent_activity"] = self._analyze_recent_events(events)

        return overview

    def get_performance_metrics(self, hours: int = 24) -> Dict[str, Any]:
        """Get performance metrics for the specified time period"""
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)

        params = {
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "limit": 10000
        }

        response = requests.get(f"{self.api_url}/monitoring/events", params=params)

        if response.status_code != 200:
            return {"error": "Failed to fetch events"}

        events = response.json()["data"]["events"]

        return {
            "total_events": len(events),
            "events_by_type": self._count_events_by_type(events),
            "events_by_hour": self._group_events_by_hour(events),
            "average_session_duration": self._calculate_avg_session_duration(events),
            "error_rate": self._calculate_error_rate(events)
        }

    def _group_specs_by_type(self, specs: List[Dict]) -> Dict[str, int]:
        """Group specifications by type"""
        by_type = {}
        for spec in specs:
            spec_type = spec.get("type", "unknown")
            by_type[spec_type] = by_type.get(spec_type, 0) + 1
        return by_type

    def _analyze_recent_events(self, events: List[Dict]) -> Dict[str, Any]:
        """Analyze recent event activity"""
        if not events:
            return {"no_recent_activity": True}

        event_types = [event["event_type"] for event in events]

        return {
            "last_event_time": events[0]["timestamp"] if events else None,
            "most_common_events": self._get_most_common(event_types, 5),
            "unique_sessions": len(set(
                event.get("session_id") for event in events
                if event.get("session_id")
            ))
        }

    def _get_most_common(self, items: List[str], limit: int) -> List[Dict[str, Any]]:
        """Get most common items with counts"""
        from collections import Counter
        counter = Counter(items)
        return [
            {"item": item, "count": count}
            for item, count in counter.most_common(limit)
        ]

# Usage example
dashboard = SpecificationDashboard()

# Get system overview
overview = dashboard.get_system_overview()
print("📊 System Overview:")
print(f"  Active Sessions: {overview.get('monitoring', {}).get('active_sessions', 0)}")
print(f"  Total Specifications: {overview.get('specifications', {}).get('total', 0)}")

# Get performance metrics
metrics = dashboard.get_performance_metrics(hours=6)
print(f"\n📈 Performance (Last 6 hours):")
print(f"  Total Events: {metrics.get('total_events', 0)}")
print(f"  Error Rate: {metrics.get('error_rate', 0):.2%}")
```

### 2. Behavioral Pattern Analysis

```python
import json
import numpy as np
from collections import defaultdict, Counter
from typing import List, Dict, Any

class BehavioralAnalyzer:
    """Analyze behavioral patterns from captured events"""

    def __init__(self, api_url="http://localhost:8000/api/v1"):
        self.api_url = api_url

    def analyze_session_patterns(self, session_id: str) -> Dict[str, Any]:
        """Analyze behavioral patterns for a specific session"""

        # Get all events for the session
        params = {"session_id": session_id, "limit": 10000}
        response = requests.get(f"{self.api_url}/monitoring/events", params=params)

        if response.status_code != 200:
            return {"error": "Failed to fetch session events"}

        events = response.json()["data"]["events"]

        return {
            "session_id": session_id,
            "total_events": len(events),
            "event_sequence": self._analyze_event_sequence(events),
            "timing_patterns": self._analyze_timing_patterns(events),
            "state_transitions": self._analyze_state_transitions(events),
            "command_patterns": self._analyze_command_patterns(events),
            "anomalies": self._detect_anomalies(events)
        }

    def _analyze_event_sequence(self, events: List[Dict]) -> Dict[str, Any]:
        """Analyze the sequence of events"""
        if not events:
            return {}

        # Sort events by timestamp
        sorted_events = sorted(events, key=lambda e: e["timestamp"])

        # Extract event type sequence
        sequence = [event["event_type"] for event in sorted_events]

        # Find common patterns
        patterns = self._find_sequence_patterns(sequence)

        return {
            "sequence_length": len(sequence),
            "unique_event_types": len(set(sequence)),
            "common_patterns": patterns,
            "sequence_summary": sequence[:10]  # First 10 events
        }

    def _analyze_timing_patterns(self, events: List[Dict]) -> Dict[str, Any]:
        """Analyze timing patterns between events"""
        if len(events) < 2:
            return {}

        # Sort events by timestamp
        sorted_events = sorted(events, key=lambda e: e["timestamp"])

        # Calculate intervals between events
        intervals = []
        for i in range(1, len(sorted_events)):
            prev_time = datetime.fromisoformat(sorted_events[i-1]["timestamp"].replace('Z', '+00:00'))
            curr_time = datetime.fromisoformat(sorted_events[i]["timestamp"].replace('Z', '+00:00'))
            interval = (curr_time - prev_time).total_seconds()
            intervals.append(interval)

        if not intervals:
            return {}

        return {
            "average_interval": np.mean(intervals),
            "median_interval": np.median(intervals),
            "min_interval": min(intervals),
            "max_interval": max(intervals),
            "std_interval": np.std(intervals),
            "interval_distribution": self._create_distribution(intervals)
        }

    def _analyze_state_transitions(self, events: List[Dict]) -> Dict[str, Any]:
        """Analyze state transition patterns"""
        state_events = [
            event for event in events
            if event.get("data", {}).get("state")
        ]

        if len(state_events) < 2:
            return {}

        # Sort by timestamp
        sorted_events = sorted(state_events, key=lambda e: e["timestamp"])

        # Extract state transitions
        transitions = []
        for i in range(1, len(sorted_events)):
            prev_state = sorted_events[i-1]["data"]["state"]
            curr_state = sorted_events[i]["data"]["state"]
            if prev_state != curr_state:
                transitions.append((prev_state, curr_state))

        transition_counts = Counter(transitions)

        return {
            "total_transitions": len(transitions),
            "unique_transitions": len(transition_counts),
            "transition_frequency": dict(transition_counts),
            "most_common_transitions": transition_counts.most_common(5)
        }

    def _find_sequence_patterns(self, sequence: List[str], min_length: int = 2, max_length: int = 5) -> List[Dict]:
        """Find repeating patterns in event sequence"""
        patterns = Counter()

        for length in range(min_length, min(max_length + 1, len(sequence))):
            for i in range(len(sequence) - length + 1):
                pattern = tuple(sequence[i:i+length])
                patterns[pattern] += 1

        # Return patterns that occur more than once
        return [
            {
                "pattern": list(pattern),
                "frequency": count,
                "length": len(pattern)
            }
            for pattern, count in patterns.items()
            if count > 1
        ]

# Usage example
analyzer = BehavioralAnalyzer()

# Analyze a specific session
session_analysis = analyzer.analyze_session_patterns("session-abc123")

print("🎭 Behavioral Analysis Results:")
print(f"Total Events: {session_analysis.get('total_events', 0)}")
print(f"Average Event Interval: {session_analysis.get('timing_patterns', {}).get('average_interval', 0):.2f}s")
print(f"State Transitions: {session_analysis.get('state_transitions', {}).get('total_transitions', 0)}")

# Print common patterns
patterns = session_analysis.get('event_sequence', {}).get('common_patterns', [])
if patterns:
    print("\n🔍 Common Event Patterns:")
    for pattern in patterns[:3]:  # Top 3 patterns
        print(f"  Pattern: {' → '.join(pattern['pattern'])} (occurs {pattern['frequency']} times)")
```

---

## Best Practices

### 1. Error Handling and Resilience

```python
import requests
import time
from functools import wraps
from typing import Callable, Any

def retry_on_failure(max_retries: int = 3, delay: float = 1.0):
    """Decorator for retrying API calls on failure"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None

            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except requests.RequestException as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        print(f"Attempt {attempt + 1} failed, retrying in {delay}s...")
                        time.sleep(delay)
                    else:
                        print(f"All {max_retries} attempts failed")

            raise last_exception
        return wrapper
    return decorator

class RobustSpecClient:
    """Robust specification API client with error handling"""

    def __init__(self, base_url="http://localhost:8000/api/v1", timeout=30):
        self.base_url = base_url
        self.timeout = timeout

    @retry_on_failure(max_retries=3, delay=2.0)
    def validate_with_fallback(self, schema_type: str, data: Any) -> Dict[str, Any]:
        """Validate data with fallback to local validation if API fails"""
        try:
            # Try API validation first
            response = requests.post(
                f"{self.base_url}/validation/validate",
                json={"schema_type": schema_type, "data": data},
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()

        except requests.RequestException:
            # Fallback to local validation
            print("⚠️ API validation failed, falling back to local validation")
            return self._local_validation(schema_type, data)

    def _local_validation(self, schema_type: str, data: Any) -> Dict[str, Any]:
        """Basic local validation as fallback"""
        # Implement basic validation rules
        if schema_type == "commands":
            required_fields = ["action"]
            valid = all(field in data for field in required_fields)
        elif schema_type == "events":
            required_fields = ["event", "timestamp"]
            valid = all(field in data for field in required_fields)
        else:
            valid = True  # Default to valid for unknown types

        return {
            "success": True,
            "data": {
                "valid": valid,
                "validation_source": "local_fallback",
                "validation_errors": [] if valid else ["Missing required fields"]
            }
        }

    def safe_monitor_events(self, session_id: str, max_events: int = 1000) -> List[Dict]:
        """Safely retrieve events with pagination"""
        all_events = []
        page_size = 100
        offset = 0

        while len(all_events) < max_events:
            try:
                params = {
                    "session_id": session_id,
                    "limit": min(page_size, max_events - len(all_events)),
                    "offset": offset
                }

                response = requests.get(
                    f"{self.base_url}/monitoring/events",
                    params=params,
                    timeout=self.timeout
                )

                if response.status_code != 200:
                    print(f"⚠️ Failed to fetch events: {response.status_code}")
                    break

                events = response.json()["data"]["events"]
                if not events:
                    break  # No more events

                all_events.extend(events)
                offset += len(events)

            except requests.RequestException as e:
                print(f"⚠️ Error fetching events: {e}")
                break

        return all_events
```

### 2. Performance Optimization

```python
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor

class OptimizedSpecClient:
    """High-performance specification client with async operations"""

    def __init__(self, base_url="http://localhost:8000/api/v1"):
        self.base_url = base_url
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def batch_validate(self, validation_requests: List[Dict]) -> List[Dict]:
        """Validate multiple items concurrently"""
        async def validate_single(request):
            async with self.session.post(
                f"{self.base_url}/validation/validate",
                json=request
            ) as response:
                result = await response.json()
                result["request_id"] = request.get("request_id")
                return result

        # Execute validations concurrently
        tasks = [validate_single(req) for req in validation_requests]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "success": False,
                    "error": str(result),
                    "request_id": validation_requests[i].get("request_id")
                })
            else:
                processed_results.append(result)

        return processed_results

    async def stream_events_efficiently(self, session_id: str, callback: Callable):
        """Efficiently stream events with backpressure handling"""
        last_timestamp = None
        batch_size = 50

        while True:
            try:
                params = {
                    "session_id": session_id,
                    "limit": batch_size
                }

                if last_timestamp:
                    params["start_time"] = last_timestamp

                async with self.session.get(
                    f"{self.base_url}/monitoring/events",
                    params=params
                ) as response:

                    if response.status != 200:
                        await asyncio.sleep(1)
                        continue

                    data = await response.json()
                    events = data["data"]["events"]

                    if not events:
                        await asyncio.sleep(0.5)  # No new events, wait briefly
                        continue

                    # Process events in batch
                    await callback(events)

                    # Update timestamp for next batch
                    last_timestamp = events[-1]["timestamp"]

            except Exception as e:
                print(f"Error in event streaming: {e}")
                await asyncio.sleep(2)

# Usage example
async def main():
    async with OptimizedSpecClient() as client:
        # Batch validation example
        validation_requests = [
            {
                "request_id": f"req-{i}",
                "schema_type": "commands",
                "data": {
                    "action": "prompt",
                    "prompt": f"Test prompt {i}"
                }
            }
            for i in range(10)
        ]

        results = await client.batch_validate(validation_requests)
        successful = sum(1 for r in results if r.get("success"))
        print(f"✅ Validated {successful}/{len(results)} requests successfully")

        # Efficient event streaming
        async def handle_events(events):
            print(f"📥 Received {len(events)} events")
            # Process events here

        # This would run indefinitely
        # await client.stream_events_efficiently("session-123", handle_events)

# Run async example
# asyncio.run(main())
```

### 3. Production Deployment Guidelines

```python
import logging
import os
from pathlib import Path
import yaml

class ProductionConfig:
    """Production configuration for specification system"""

    def __init__(self, config_file: str = "production.yaml"):
        self.config = self._load_config(config_file)
        self._setup_logging()

    def _load_config(self, config_file: str) -> Dict[str, Any]:
        """Load production configuration"""
        default_config = {
            "api": {
                "host": "0.0.0.0",
                "port": 8000,
                "workers": 4,
                "timeout": 30,
                "max_request_size": "10MB"
            },
            "monitoring": {
                "max_events_per_session": 100000,
                "session_timeout": 3600,
                "cleanup_interval": 300,
                "retention_days": 30
            },
            "validation": {
                "cache_schemas": True,
                "max_validation_size": "1MB",
                "concurrent_validations": 50
            },
            "security": {
                "rate_limit": "1000/hour",
                "enable_cors": False,
                "allowed_origins": []
            },
            "storage": {
                "data_directory": "/var/lib/claude-code-specs",
                "backup_enabled": True,
                "backup_interval": 86400
            }
        }

        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                user_config = yaml.safe_load(f)
                # Merge with defaults
                default_config.update(user_config)

        return default_config

    def _setup_logging(self):
        """Setup production logging"""
        log_level = self.config.get("logging", {}).get("level", "INFO")
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

        logging.basicConfig(
            level=getattr(logging, log_level),
            format=log_format,
            handlers=[
                logging.FileHandler("/var/log/claude-code-specs/app.log"),
                logging.StreamHandler()
            ]
        )

# Example production.yaml
PRODUCTION_CONFIG = """
api:
  host: "0.0.0.0"
  port: 8000
  workers: 8
  timeout: 60

monitoring:
  max_events_per_session: 500000
  session_timeout: 7200
  retention_days: 90

security:
  rate_limit: "5000/hour"
  enable_cors: true
  allowed_origins:
    - "https://your-dashboard.com"
    - "https://your-app.com"

storage:
  data_directory: "/opt/claude-code-specs/data"
  backup_enabled: true
  backup_interval: 43200  # 12 hours

logging:
  level: "INFO"
"""

# Health check endpoint
def health_check():
    """Health check for load balancers"""
    try:
        # Check API availability
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code != 200:
            return False

        # Check database connectivity
        # Add your database checks here

        # Check disk space
        import shutil
        _, _, free = shutil.disk_usage("/")
        if free < 1024 * 1024 * 1024:  # Less than 1GB free
            return False

        return True

    except Exception as e:
        logging.error(f"Health check failed: {e}")
        return False

# Monitoring setup
def setup_monitoring():
    """Setup production monitoring"""
    import psutil

    def log_system_metrics():
        """Log system metrics periodically"""
        cpu_percent = psutil.cpu_percent()
        memory_percent = psutil.virtual_memory().percent
        disk_percent = psutil.disk_usage('/').percent

        logging.info(f"System metrics - CPU: {cpu_percent}%, Memory: {memory_percent}%, Disk: {disk_percent}%")

    # Schedule metrics logging every 5 minutes
    import threading
    import time

    def metrics_loop():
        while True:
            log_system_metrics()
            time.sleep(300)  # 5 minutes

    metrics_thread = threading.Thread(target=metrics_loop, daemon=True)
    metrics_thread.start()

# Error handling and alerting
class ProductionErrorHandler:
    """Production error handling and alerting"""

    def __init__(self, webhook_url: str = None):
        self.webhook_url = webhook_url

    def handle_critical_error(self, error: Exception, context: str):
        """Handle critical errors with alerting"""
        error_msg = f"CRITICAL ERROR in {context}: {str(error)}"

        # Log the error
        logging.critical(error_msg, exc_info=True)

        # Send alert if webhook configured
        if self.webhook_url:
            self._send_alert(error_msg)

    def _send_alert(self, message: str):
        """Send alert to configured webhook"""
        try:
            payload = {
                "text": f"🚨 Claude Code Specs Alert: {message}",
                "timestamp": datetime.utcnow().isoformat()
            }
            requests.post(self.webhook_url, json=payload, timeout=10)
        except Exception as e:
            logging.error(f"Failed to send alert: {e}")

print("✅ Production deployment guide loaded")
print("📖 See usage-examples.md for complete implementation details")
```

This comprehensive guide provides practical examples for integrating with and using the Claude Code Specification System in various scenarios, from basic validation to advanced production deployments.