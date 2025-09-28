# Migration Guide for Claude Code Wrapper Developers

## Overview

This guide helps existing Claude Code wrapper developers migrate to use the Claude Code Specification System. Whether you're maintaining a legacy wrapper or building a new one, this guide provides step-by-step instructions for adopting the specification system.

## Table of Contents

1. [Migration Assessment](#migration-assessment)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Schema Migration](#schema-migration)
4. [Runtime Monitoring Integration](#runtime-monitoring-integration)
5. [Validation Integration](#validation-integration)
6. [API Integration](#api-integration)
7. [Testing and Validation](#testing-and-validation)
8. [Production Deployment](#production-deployment)
9. [Common Migration Issues](#common-migration-issues)
10. [Migration Tools and Utilities](#migration-tools-and-utilities)

---

## Migration Assessment

### Current Wrapper Analysis

Before starting migration, assess your current wrapper implementation:

#### 1. Inventory Your Current Implementation

```bash
# Run this assessment script to analyze your wrapper
python -c "
import os
import json
from pathlib import Path

def analyze_wrapper(wrapper_path):
    analysis = {
        'files': [],
        'dependencies': [],
        'apis': [],
        'event_handling': False,
        'schema_validation': False
    }

    # Scan for Python files
    for file in Path(wrapper_path).rglob('*.py'):
        analysis['files'].append(str(file))

        # Check for event handling patterns
        content = file.read_text()
        if any(keyword in content for keyword in ['event', 'callback', 'listener']):
            analysis['event_handling'] = True

        # Check for validation patterns
        if any(keyword in content for keyword in ['validate', 'schema', 'json']):
            analysis['schema_validation'] = True

    # Check package dependencies
    requirements_file = Path(wrapper_path) / 'requirements.txt'
    if requirements_file.exists():
        analysis['dependencies'] = requirements_file.read_text().splitlines()

    return analysis

# Analyze current directory
result = analyze_wrapper('.')
print(json.dumps(result, indent=2))
"
```

#### 2. Compatibility Matrix

| Feature | Legacy Wrapper | Specification System | Migration Required |
|---------|----------------|---------------------|-------------------|
| Command Structure | Custom format | JSON Schema validated | ✅ Yes |
| Event Handling | Ad-hoc events | Standardized events | ✅ Yes |
| State Management | Custom states | Defined state machine | ✅ Yes |
| Validation | Manual/None | Automated schema validation | ✅ Yes |
| Monitoring | Basic logging | Comprehensive monitoring | ✅ Yes |
| API Access | Direct integration | REST API | ⚠️ Optional |

#### 3. Migration Complexity Assessment

Run this assessment to determine migration complexity:

```python
def assess_migration_complexity(wrapper_path):
    """Assess the complexity of migrating a wrapper to the specification system"""

    complexity_score = 0
    factors = []

    # Check file count
    py_files = list(Path(wrapper_path).rglob('*.py'))
    if len(py_files) > 10:
        complexity_score += 2
        factors.append(f"Large codebase ({len(py_files)} Python files)")
    elif len(py_files) > 5:
        complexity_score += 1
        factors.append(f"Medium codebase ({len(py_files)} Python files)")

    # Check for custom event handling
    for file in py_files:
        content = file.read_text()
        if 'class' in content and 'event' in content.lower():
            complexity_score += 2
            factors.append("Custom event handling detected")
            break

    # Check for custom validation
    for file in py_files:
        content = file.read_text()
        if any(pattern in content for pattern in ['validate', 'check', 'verify']):
            complexity_score += 1
            factors.append("Custom validation logic detected")
            break

    # Determine complexity level
    if complexity_score <= 2:
        level = "LOW"
        estimated_time = "1-2 days"
    elif complexity_score <= 4:
        level = "MEDIUM"
        estimated_time = "3-5 days"
    else:
        level = "HIGH"
        estimated_time = "1-2 weeks"

    return {
        "complexity_level": level,
        "complexity_score": complexity_score,
        "estimated_migration_time": estimated_time,
        "factors": factors
    }

# Run assessment
assessment = assess_migration_complexity("/path/to/your/wrapper")
print(f"Migration Complexity: {assessment['complexity_level']}")
print(f"Estimated Time: {assessment['estimated_migration_time']}")
```

---

## Pre-Migration Checklist

### 1. Environment Setup

```bash
# 1. Install the specification system
git clone <claude-code-specs-repo>
cd claude-code-specification-system

# 2. Install dependencies
pip install -r requirements.txt

# 3. Install schema package
cd claudeCodeSpecs/schemas
npm install
npm run build

# 4. Test the system
cd ../..
python -m claudeCodeSpecs.api.unified-api &
curl http://localhost:8000/health

# 5. Create backup of current wrapper
cp -r /path/to/your/wrapper /path/to/wrapper-backup-$(date +%Y%m%d)
```

### 2. Migration Planning

Create a migration plan document:

```markdown
# Migration Plan for [Wrapper Name]

## Current State
- Wrapper version: X.Y.Z
- Files to migrate: [list]
- Dependencies: [list]
- Custom features: [list]

## Target State
- Schema compliance: ✅
- Monitoring integration: ✅
- Validation integration: ✅
- API integration: ⚠️ (optional)

## Migration Steps
1. [ ] Schema migration (estimated: X hours)
2. [ ] Event handling update (estimated: X hours)
3. [ ] Validation integration (estimated: X hours)
4. [ ] Testing and validation (estimated: X hours)

## Rollback Plan
- Backup location: [path]
- Rollback procedure: [steps]
```

---

## Schema Migration

### 1. Command Structure Migration

#### Legacy Command Format
```python
# Old format - custom command structure
def execute_command(command_text, working_dir=None, timeout=None):
    return {
        "command": command_text,
        "working_directory": working_dir,
        "timeout": timeout or 30000
    }
```

#### New Schema-Compliant Format
```python
# New format - schema-validated command structure
import requests

def validate_and_execute_command(action, prompt, options=None):
    """Execute command with schema validation"""

    # Construct command according to schema
    command = {
        "action": action,
        "prompt": prompt,
        "options": options or {}
    }

    # Validate against schema
    validation_result = requests.post(
        "http://localhost:8000/api/v1/validation/validate",
        json={
            "schema_type": "commands",
            "data": command
        }
    )

    if not validation_result.json()["data"]["valid"]:
        raise ValueError(f"Invalid command: {validation_result.json()['data']['validation_errors']}")

    # Execute the validated command
    return execute_validated_command(command)

def execute_validated_command(command):
    """Execute a pre-validated command"""
    # Your existing execution logic here
    pass
```

### 2. Automated Command Migration Script

```python
#!/usr/bin/env python3
"""
Script to automatically migrate legacy command formats to schema-compliant format
"""

import ast
import re
from pathlib import Path
from typing import List, Dict, Any

class CommandMigrator:
    """Migrates legacy command formats to schema-compliant format"""

    def __init__(self, wrapper_path: str):
        self.wrapper_path = Path(wrapper_path)
        self.backup_path = self.wrapper_path.parent / f"{self.wrapper_path.name}_backup"

    def migrate_wrapper(self):
        """Migrate entire wrapper to use schema-compliant commands"""

        # Create backup
        self._create_backup()

        # Find Python files
        py_files = list(self.wrapper_path.rglob("*.py"))

        migration_results = []
        for file_path in py_files:
            result = self._migrate_file(file_path)
            migration_results.append(result)

        return migration_results

    def _create_backup(self):
        """Create backup of original wrapper"""
        import shutil
        if self.backup_path.exists():
            shutil.rmtree(self.backup_path)
        shutil.copytree(self.wrapper_path, self.backup_path)
        print(f"✅ Backup created at {self.backup_path}")

    def _migrate_file(self, file_path: Path) -> Dict[str, Any]:
        """Migrate a single Python file"""

        original_content = file_path.read_text()
        migrated_content = original_content
        changes = []

        # Pattern 1: Legacy command dictionary
        legacy_pattern = r'{\s*["\']command["\']:\s*([^,}]+),?\s*([^}]*)\s*}'

        def replace_command(match):
            command_value = match.group(1)
            additional_fields = match.group(2)

            # Build new format
            new_command = f'{{\n    "action": "prompt",\n    "prompt": {command_value}'

            if additional_fields.strip():
                # Parse additional fields and convert to options
                new_command += f',\n    "options": {{{additional_fields}}}'

            new_command += '\n}'

            changes.append(f"Converted legacy command format")
            return new_command

        migrated_content = re.sub(legacy_pattern, replace_command, migrated_content)

        # Pattern 2: Function calls with old parameter names
        migrated_content = re.sub(
            r'execute_command\(([^,]+),?\s*working_dir=([^,)]+)',
            r'execute_command(action="prompt", prompt=\1, options={"working_directory": \2}',
            migrated_content
        )

        # Write migrated content
        if migrated_content != original_content:
            file_path.write_text(migrated_content)
            changes.append("Updated function calls")

        return {
            "file": str(file_path),
            "migrated": migrated_content != original_content,
            "changes": changes
        }

# Usage example
migrator = CommandMigrator("/path/to/your/wrapper")
results = migrator.migrate_wrapper()

print("Migration Results:")
for result in results:
    if result["migrated"]:
        print(f"✅ {result['file']}: {', '.join(result['changes'])}")
    else:
        print(f"➖ {result['file']}: No changes needed")
```

---

## Runtime Monitoring Integration

### 1. Basic Monitoring Integration

```python
import requests
from datetime import datetime
from typing import Dict, Any, Optional

class MonitoredWrapper:
    """Wrapper class with integrated runtime monitoring"""

    def __init__(self, wrapper_name: str, monitoring_api_url: str = "http://localhost:8000/api/v1"):
        self.wrapper_name = wrapper_name
        self.monitoring_api_url = monitoring_api_url
        self.session_id = None

    def start_monitoring_session(self) -> bool:
        """Start a monitoring session for this wrapper instance"""
        payload = {
            "session_name": f"{self.wrapper_name}_{int(datetime.now().timestamp())}",
            "capture_options": {
                "capture_commands": True,
                "capture_events": True,
                "capture_states": True
            }
        }

        try:
            response = requests.post(
                f"{self.monitoring_api_url}/monitoring/sessions",
                json=payload,
                timeout=10
            )

            if response.status_code == 200:
                self.session_id = response.json()["data"]["session_id"]
                print(f"✅ Monitoring session started: {self.session_id}")
                return True
            else:
                print(f"❌ Failed to start monitoring: {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Monitoring unavailable: {e}")
            return False

    def capture_event(self, event_type: str, data: Dict[str, Any]):
        """Capture a custom event"""
        if not self.session_id:
            return  # Silent fail if monitoring not available

        payload = {
            "event_type": event_type,
            "data": {
                **data,
                "wrapper_name": self.wrapper_name,
                "timestamp": datetime.utcnow().isoformat()
            },
            "session_id": self.session_id
        }

        try:
            requests.post(
                f"{self.monitoring_api_url}/monitoring/events",
                json=payload,
                timeout=5  # Short timeout for monitoring
            )
        except Exception:
            pass  # Silent fail for monitoring

    def execute_with_monitoring(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Execute command with full monitoring"""

        run_id = f"run_{int(datetime.now().timestamp())}"

        # Capture command execution start
        self.capture_event("run_started", {
            "run_id": run_id,
            "command": command
        })

        try:
            # Execute the actual command (your existing logic)
            result = self._execute_command(command)

            # Capture successful completion
            self.capture_event("run_completed", {
                "run_id": run_id,
                "success": True,
                "result_summary": {
                    "output_length": len(str(result.get("output", ""))),
                    "execution_time": result.get("execution_time", 0)
                }
            })

            return result

        except Exception as e:
            # Capture failure
            self.capture_event("run_failed", {
                "run_id": run_id,
                "error": str(e),
                "error_type": type(e).__name__
            })

            raise  # Re-raise the exception

    def _execute_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Your existing command execution logic"""
        # Replace this with your actual implementation
        import time
        time.sleep(1)  # Simulate execution
        return {
            "success": True,
            "output": f"Executed: {command.get('prompt', 'Unknown command')}",
            "execution_time": 1.0
        }

    def stop_monitoring(self):
        """Stop the monitoring session"""
        if self.session_id:
            try:
                requests.post(
                    f"{self.monitoring_api_url}/monitoring/sessions/{self.session_id}/stop",
                    timeout=10
                )
                print(f"✅ Monitoring session stopped: {self.session_id}")
            except Exception as e:
                print(f"⚠️ Error stopping monitoring: {e}")
            finally:
                self.session_id = None

# Migration example: Convert existing wrapper
class LegacyWrapper:
    """Your existing wrapper implementation"""

    def execute(self, command_text, working_dir=None):
        # Your existing implementation
        return {"output": f"Executed: {command_text}"}

# Migrate to monitored wrapper
class MigratedWrapper(MonitoredWrapper):
    """Migrated wrapper with monitoring"""

    def __init__(self):
        super().__init__("MigratedWrapper")
        self.legacy_wrapper = LegacyWrapper()

        # Start monitoring if available
        self.start_monitoring_session()

    def execute(self, command_text, working_dir=None):
        """Migrate legacy execute method"""

        # Convert to new command format
        command = {
            "action": "prompt",
            "prompt": command_text,
            "options": {
                "working_directory": working_dir
            } if working_dir else {}
        }

        # Execute with monitoring
        return self.execute_with_monitoring(command)

    def _execute_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Execute using legacy wrapper"""
        prompt = command.get("prompt", "")
        working_dir = command.get("options", {}).get("working_directory")

        # Call legacy implementation
        legacy_result = self.legacy_wrapper.execute(prompt, working_dir)

        # Convert to new format
        return {
            "success": True,
            "output": legacy_result.get("output", ""),
            "execution_time": 1.0  # You might want to measure this
        }

# Usage
wrapper = MigratedWrapper()
result = wrapper.execute("Write a hello world function")
print(f"Result: {result}")
wrapper.stop_monitoring()
```

### 2. Automatic Event Detection

```python
import functools
import inspect
from datetime import datetime

def monitor_method(event_type: str = None):
    """Decorator to automatically monitor method calls"""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(self, *args, **kwargs):
            # Auto-generate event type if not provided
            actual_event_type = event_type or f"method_{func.__name__}_called"

            # Capture method call start
            if hasattr(self, 'capture_event'):
                call_data = {
                    "method": func.__name__,
                    "args_count": len(args),
                    "kwargs_keys": list(kwargs.keys()),
                    "start_time": datetime.utcnow().isoformat()
                }
                self.capture_event(f"{actual_event_type}_started", call_data)

            try:
                # Execute the method
                result = func(self, *args, **kwargs)

                # Capture successful completion
                if hasattr(self, 'capture_event'):
                    self.capture_event(f"{actual_event_type}_completed", {
                        "method": func.__name__,
                        "success": True,
                        "end_time": datetime.utcnow().isoformat()
                    })

                return result

            except Exception as e:
                # Capture failure
                if hasattr(self, 'capture_event'):
                    self.capture_event(f"{actual_event_type}_failed", {
                        "method": func.__name__,
                        "error": str(e),
                        "error_type": type(e).__name__,
                        "end_time": datetime.utcnow().isoformat()
                    })

                raise  # Re-raise the exception

        return wrapper
    return decorator

# Apply to existing wrapper methods
class AutoMonitoredWrapper(MonitoredWrapper):
    """Wrapper with automatic method monitoring"""

    @monitor_method("command_execution")
    def execute_command(self, command):
        """Automatically monitored command execution"""
        return self._execute_command(command)

    @monitor_method("validation")
    def validate_input(self, data):
        """Automatically monitored validation"""
        # Your validation logic here
        return True

    @monitor_method("state_change")
    def change_state(self, new_state):
        """Automatically monitored state changes"""
        # Your state change logic here
        pass
```

---

## Validation Integration

### 1. Schema Validation Integration

```python
import requests
from typing import Dict, Any, List

class ValidatedWrapper(MonitoredWrapper):
    """Wrapper with integrated schema validation"""

    def __init__(self, wrapper_name: str, validation_api_url: str = "http://localhost:8000/api/v1"):
        super().__init__(wrapper_name, validation_api_url)
        self.validation_api_url = validation_api_url
        self._validation_cache = {}  # Cache validation results

    def validate_command(self, command: Dict[str, Any]) -> bool:
        """Validate command against schema"""

        # Check cache first
        command_hash = hash(str(sorted(command.items())))
        if command_hash in self._validation_cache:
            return self._validation_cache[command_hash]

        try:
            response = requests.post(
                f"{self.validation_api_url}/validation/validate",
                json={
                    "schema_type": "commands",
                    "data": command
                },
                timeout=10
            )

            if response.status_code == 200:
                result = response.json()
                is_valid = result["data"]["valid"]

                if not is_valid:
                    errors = result["data"].get("validation_errors", [])
                    print(f"❌ Command validation failed: {errors}")

                # Cache the result
                self._validation_cache[command_hash] = is_valid
                return is_valid
            else:
                print(f"⚠️ Validation service unavailable: {response.status_code}")
                return True  # Fail open - allow execution if validation unavailable

        except Exception as e:
            print(f"⚠️ Validation error: {e}")
            return True  # Fail open

    def validate_event(self, event: Dict[str, Any]) -> bool:
        """Validate event against schema"""

        try:
            response = requests.post(
                f"{self.validation_api_url}/validation/validate",
                json={
                    "schema_type": "events",
                    "data": event
                },
                timeout=5
            )

            if response.status_code == 200:
                return response.json()["data"]["valid"]

        except Exception:
            pass

        return True  # Fail open for events

    def execute_with_validation(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Execute command with validation"""

        # Validate command before execution
        if not self.validate_command(command):
            return {
                "success": False,
                "error": "Command validation failed",
                "error_type": "validation_error"
            }

        # Execute with monitoring (from parent class)
        return self.execute_with_monitoring(command)

    def capture_validated_event(self, event_type: str, data: Dict[str, Any]):
        """Capture event with validation"""

        event = {
            "event": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }

        # Validate event before capturing
        if self.validate_event(event):
            self.capture_event(event_type, data)
        else:
            print(f"⚠️ Invalid event not captured: {event_type}")

# Migration helper for batch validation
def migrate_legacy_commands(legacy_commands: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Migrate and validate a batch of legacy commands"""

    migrated_commands = []
    validation_errors = []

    for i, legacy_cmd in enumerate(legacy_commands):
        try:
            # Convert legacy format to new format
            migrated_cmd = convert_legacy_command(legacy_cmd)

            # Validate the migrated command
            validation_response = requests.post(
                "http://localhost:8000/api/v1/validation/validate",
                json={
                    "schema_type": "commands",
                    "data": migrated_cmd
                }
            )

            if validation_response.status_code == 200:
                validation_result = validation_response.json()
                if validation_result["data"]["valid"]:
                    migrated_commands.append(migrated_cmd)
                else:
                    validation_errors.append({
                        "index": i,
                        "command": legacy_cmd,
                        "errors": validation_result["data"]["validation_errors"]
                    })
            else:
                validation_errors.append({
                    "index": i,
                    "command": legacy_cmd,
                    "errors": ["Validation service unavailable"]
                })

        except Exception as e:
            validation_errors.append({
                "index": i,
                "command": legacy_cmd,
                "errors": [f"Migration error: {str(e)}"]
            })

    return migrated_commands, validation_errors

def convert_legacy_command(legacy_cmd: Dict[str, Any]) -> Dict[str, Any]:
    """Convert legacy command format to schema-compliant format"""

    # Handle different legacy formats
    if "command" in legacy_cmd:
        # Format 1: {"command": "text", "working_directory": "path", ...}
        return {
            "action": "prompt",
            "prompt": legacy_cmd["command"],
            "options": {
                key: value for key, value in legacy_cmd.items()
                if key not in ["command"]
            }
        }
    elif "prompt" in legacy_cmd and "action" not in legacy_cmd:
        # Format 2: {"prompt": "text", "timeout": 30000, ...}
        return {
            "action": "prompt",
            "prompt": legacy_cmd["prompt"],
            "options": {
                key: value for key, value in legacy_cmd.items()
                if key not in ["prompt"]
            }
        }
    else:
        # Already in new format or unknown format
        return legacy_cmd

# Example migration script
def migrate_wrapper_commands():
    """Example script to migrate all commands in a wrapper"""

    # Load legacy commands from your wrapper
    legacy_commands = [
        {"command": "Write a hello world function", "working_directory": "/tmp", "timeout": 30000},
        {"command": "Explain the code", "timeout": 15000},
        {"prompt": "Debug this error", "model": "claude-3-sonnet"},  # Mixed format
    ]

    print(f"Migrating {len(legacy_commands)} commands...")

    migrated, errors = migrate_legacy_commands(legacy_commands)

    print(f"✅ Successfully migrated: {len(migrated)}")
    print(f"❌ Failed to migrate: {len(errors)}")

    if errors:
        print("\nMigration errors:")
        for error in errors:
            print(f"  Command {error['index']}: {error['errors']}")

    return migrated, errors

# Run migration
if __name__ == "__main__":
    migrated_commands, migration_errors = migrate_wrapper_commands()
```

---

## API Integration

### 1. Optional API Client Integration

```python
import requests
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

@dataclass
class APIConfig:
    """Configuration for API integration"""
    base_url: str = "http://localhost:8000/api/v1"
    timeout: int = 30
    retry_attempts: int = 3
    enable_caching: bool = True

class SpecificationAPIClient:
    """Client for integrating with the specification API"""

    def __init__(self, config: APIConfig = None):
        self.config = config or APIConfig()
        self._cache = {} if self.config.enable_caching else None

    def get_specifications(self) -> Optional[List[Dict[str, Any]]]:
        """Get list of available specifications"""
        try:
            response = requests.get(
                f"{self.config.base_url}/specifications",
                timeout=self.config.timeout
            )

            if response.status_code == 200:
                return response.json()["data"]["specifications"]

        except Exception as e:
            print(f"Failed to fetch specifications: {e}")

        return None

    def get_schema(self, schema_type: str) -> Optional[Dict[str, Any]]:
        """Get a specific schema with caching"""

        # Check cache first
        if self._cache and schema_type in self._cache:
            return self._cache[schema_type]

        try:
            response = requests.get(
                f"{self.config.base_url}/specifications/schemas/{schema_type}",
                timeout=self.config.timeout
            )

            if response.status_code == 200:
                schema = response.json()["data"]

                # Cache the result
                if self._cache:
                    self._cache[schema_type] = schema

                return schema

        except Exception as e:
            print(f"Failed to fetch schema {schema_type}: {e}")

        return None

    def start_monitoring(self, session_name: str) -> Optional[str]:
        """Start a monitoring session via API"""
        try:
            response = requests.post(
                f"{self.config.base_url}/monitoring/sessions",
                json={"session_name": session_name},
                timeout=self.config.timeout
            )

            if response.status_code == 200:
                return response.json()["data"]["session_id"]

        except Exception as e:
            print(f"Failed to start monitoring: {e}")

        return None

    def validate_data(self, schema_type: str, data: Any) -> bool:
        """Validate data against schema via API"""
        try:
            response = requests.post(
                f"{self.config.base_url}/validation/validate",
                json={
                    "schema_type": schema_type,
                    "data": data
                },
                timeout=self.config.timeout
            )

            if response.status_code == 200:
                return response.json()["data"]["valid"]

        except Exception as e:
            print(f"Validation failed: {e}")

        return True  # Fail open

class APIIntegratedWrapper(ValidatedWrapper):
    """Wrapper with full API integration"""

    def __init__(self, wrapper_name: str, api_config: APIConfig = None):
        super().__init__(wrapper_name)
        self.api_client = SpecificationAPIClient(api_config)

        # Load schemas on initialization
        self._load_schemas()

    def _load_schemas(self):
        """Load and cache schemas"""
        print("Loading schemas...")

        schemas = ["commands", "events", "states"]
        for schema_type in schemas:
            schema = self.api_client.get_schema(schema_type)
            if schema:
                print(f"✅ Loaded {schema_type} schema")
            else:
                print(f"⚠️ Failed to load {schema_type} schema")

    def validate_command(self, command: Dict[str, Any]) -> bool:
        """Enhanced validation using API client"""
        return self.api_client.validate_data("commands", command)

    def get_compliance_report(self) -> Optional[Dict[str, Any]]:
        """Get compliance report for this wrapper"""
        try:
            # This would be a custom endpoint for compliance reporting
            response = requests.post(
                f"{self.api_client.config.base_url}/validation/compliance",
                json={
                    "wrapper_name": self.wrapper_name,
                    "session_id": self.session_id
                },
                timeout=self.api_client.config.timeout
            )

            if response.status_code == 200:
                return response.json()["data"]

        except Exception as e:
            print(f"Failed to get compliance report: {e}")

        return None
```

---

## Testing and Validation

### 1. Migration Testing Framework

```python
import unittest
import json
from pathlib import Path
from typing import Dict, Any, List

class MigrationTestSuite(unittest.TestCase):
    """Test suite for validating wrapper migration"""

    def setUp(self):
        """Set up test environment"""
        self.wrapper = APIIntegratedWrapper("TestWrapper")
        self.test_commands = self._load_test_commands()

    def _load_test_commands(self) -> List[Dict[str, Any]]:
        """Load test commands for validation"""
        return [
            {
                "action": "prompt",
                "prompt": "Write a hello world function",
                "options": {"timeout": 30000}
            },
            {
                "action": "prompt",
                "prompt": "Explain this code",
                "options": {"model": "claude-3-sonnet"}
            },
            {
                "action": "status"
            }
        ]

    def test_schema_compliance(self):
        """Test that all commands are schema compliant"""
        for i, command in enumerate(self.test_commands):
            with self.subTest(command_index=i):
                is_valid = self.wrapper.validate_command(command)
                self.assertTrue(is_valid, f"Command {i} failed validation: {command}")

    def test_monitoring_integration(self):
        """Test monitoring integration"""
        # Test session start
        session_started = self.wrapper.start_monitoring_session()
        self.assertTrue(session_started, "Failed to start monitoring session")

        # Test event capture
        self.wrapper.capture_event("test_event", {"test": "data"})

        # Test session stop
        self.wrapper.stop_monitoring()

    def test_command_execution(self):
        """Test command execution with monitoring and validation"""
        for command in self.test_commands:
            with self.subTest(command=command):
                try:
                    result = self.wrapper.execute_with_validation(command)
                    self.assertIn("success", result)
                except Exception as e:
                    self.fail(f"Command execution failed: {e}")

    def test_error_handling(self):
        """Test error handling for invalid commands"""
        invalid_commands = [
            {"action": "invalid_action"},  # Invalid action
            {"prompt": "test"},  # Missing action
            {"action": "prompt"},  # Missing prompt
        ]

        for command in invalid_commands:
            with self.subTest(command=command):
                is_valid = self.wrapper.validate_command(command)
                self.assertFalse(is_valid, f"Invalid command passed validation: {command}")

class PerformanceTestSuite(unittest.TestCase):
    """Performance tests for migrated wrapper"""

    def setUp(self):
        self.wrapper = APIIntegratedWrapper("PerformanceTestWrapper")

    def test_validation_performance(self):
        """Test validation performance"""
        import time

        command = {
            "action": "prompt",
            "prompt": "Test command",
            "options": {"timeout": 30000}
        }

        # Measure validation time
        start_time = time.time()
        for _ in range(100):
            self.wrapper.validate_command(command)
        end_time = time.time()

        avg_time = (end_time - start_time) / 100
        self.assertLess(avg_time, 0.1, f"Validation too slow: {avg_time:.3f}s per command")

    def test_monitoring_overhead(self):
        """Test monitoring overhead"""
        import time

        command = {
            "action": "prompt",
            "prompt": "Test command"
        }

        # Time without monitoring
        start_time = time.time()
        for _ in range(10):
            self.wrapper._execute_command(command)
        no_monitoring_time = time.time() - start_time

        # Time with monitoring
        self.wrapper.start_monitoring_session()
        start_time = time.time()
        for _ in range(10):
            self.wrapper.execute_with_monitoring(command)
        monitoring_time = time.time() - start_time
        self.wrapper.stop_monitoring()

        overhead = (monitoring_time - no_monitoring_time) / no_monitoring_time
        self.assertLess(overhead, 0.1, f"Monitoring overhead too high: {overhead:.1%}")

def run_migration_tests():
    """Run all migration tests"""

    # Create test suite
    suite = unittest.TestSuite()

    # Add test cases
    suite.addTest(unittest.makeSuite(MigrationTestSuite))
    suite.addTest(unittest.makeSuite(PerformanceTestSuite))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Generate report
    print(f"\n{'='*50}")
    print("MIGRATION TEST REPORT")
    print(f"{'='*50}")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")

    if result.failures:
        print(f"\nFailures:")
        for test, traceback in result.failures:
            print(f"  - {test}: {traceback}")

    if result.errors:
        print(f"\nErrors:")
        for test, traceback in result.errors:
            print(f"  - {test}: {traceback}")

    return result.wasSuccessful()

# Example validation script
def validate_migration(wrapper_path: str) -> Dict[str, Any]:
    """Comprehensive migration validation"""

    validation_results = {
        "schema_compliance": False,
        "monitoring_integration": False,
        "api_integration": False,
        "performance_acceptable": False,
        "errors": []
    }

    try:
        # Test schema compliance
        wrapper = APIIntegratedWrapper("ValidationWrapper")
        test_command = {
            "action": "prompt",
            "prompt": "Test validation",
            "options": {"timeout": 30000}
        }

        if wrapper.validate_command(test_command):
            validation_results["schema_compliance"] = True
        else:
            validation_results["errors"].append("Schema validation failed")

        # Test monitoring integration
        if wrapper.start_monitoring_session():
            validation_results["monitoring_integration"] = True
            wrapper.stop_monitoring()
        else:
            validation_results["errors"].append("Monitoring integration failed")

        # Test API integration
        specifications = wrapper.api_client.get_specifications()
        if specifications is not None:
            validation_results["api_integration"] = True
        else:
            validation_results["errors"].append("API integration failed")

        # Run performance tests
        test_success = run_migration_tests()
        validation_results["performance_acceptable"] = test_success

    except Exception as e:
        validation_results["errors"].append(f"Validation error: {str(e)}")

    return validation_results

if __name__ == "__main__":
    # Run validation
    results = validate_migration("/path/to/migrated/wrapper")

    print("Migration Validation Results:")
    for check, passed in results.items():
        if check != "errors":
            status = "✅" if passed else "❌"
            print(f"{status} {check}: {passed}")

    if results["errors"]:
        print(f"\nErrors encountered:")
        for error in results["errors"]:
            print(f"  - {error}")
```

---

## Common Migration Issues

### 1. Schema Validation Failures

**Issue**: Legacy commands fail schema validation

**Solution**:
```python
def fix_schema_validation_issues():
    """Common fixes for schema validation issues"""

    # Issue 1: Missing required fields
    def fix_missing_action(command):
        if "action" not in command and "command" in command:
            command["action"] = "prompt"
            command["prompt"] = command.pop("command")
        return command

    # Issue 2: Incorrect field types
    def fix_field_types(command):
        if "timeout" in command.get("options", {}):
            timeout = command["options"]["timeout"]
            if isinstance(timeout, str):
                command["options"]["timeout"] = int(timeout)
        return command

    # Issue 3: Unknown fields
    def remove_unknown_fields(command):
        known_fields = ["action", "prompt", "options"]
        return {k: v for k, v in command.items() if k in known_fields}

    return [fix_missing_action, fix_field_types, remove_unknown_fields]

# Apply fixes
def apply_schema_fixes(command):
    """Apply all schema fixes to a command"""
    fixes = fix_schema_validation_issues()

    for fix in fixes:
        command = fix(command)

    return command
```

### 2. Monitoring Integration Issues

**Issue**: Monitoring events not captured

**Solution**:
```python
def debug_monitoring_issues():
    """Debug and fix monitoring integration issues"""

    # Check API connectivity
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code != 200:
            print("❌ Monitoring API not available")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to monitoring API: {e}")
        return False

    # Check session creation
    try:
        payload = {"session_name": "debug_session"}
        response = requests.post(
            "http://localhost:8000/api/v1/monitoring/sessions",
            json=payload,
            timeout=10
        )

        if response.status_code == 200:
            session_id = response.json()["data"]["session_id"]
            print(f"✅ Monitoring session created: {session_id}")

            # Cleanup
            requests.post(
                f"http://localhost:8000/api/v1/monitoring/sessions/{session_id}/stop"
            )
            return True
        else:
            print(f"❌ Failed to create session: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Session creation failed: {e}")
        return False

# Auto-retry monitoring integration
class RobustMonitoringWrapper(MonitoredWrapper):
    """Wrapper with robust monitoring that handles failures gracefully"""

    def start_monitoring_session(self) -> bool:
        """Start monitoring with retry logic"""
        max_retries = 3

        for attempt in range(max_retries):
            if super().start_monitoring_session():
                return True

            print(f"Monitoring attempt {attempt + 1} failed, retrying...")
            time.sleep(2 ** attempt)  # Exponential backoff

        print("⚠️ Monitoring unavailable, continuing without monitoring")
        return False

    def capture_event(self, event_type: str, data: Dict[str, Any]):
        """Capture event with error handling"""
        try:
            super().capture_event(event_type, data)
        except Exception as e:
            # Log error but don't fail the operation
            print(f"⚠️ Failed to capture event {event_type}: {e}")
```

### 3. Performance Issues

**Issue**: Migration causes performance degradation

**Solution**:
```python
import threading
import queue
from typing import Optional

class PerformantMonitoringWrapper(MonitoredWrapper):
    """High-performance wrapper with async monitoring"""

    def __init__(self, wrapper_name: str):
        super().__init__(wrapper_name)
        self._event_queue = queue.Queue()
        self._monitoring_thread: Optional[threading.Thread] = None
        self._stop_monitoring = threading.Event()

    def start_monitoring_session(self) -> bool:
        """Start monitoring with background thread"""
        if super().start_monitoring_session():
            # Start background monitoring thread
            self._start_background_monitoring()
            return True
        return False

    def _start_background_monitoring(self):
        """Start background thread for event processing"""
        self._monitoring_thread = threading.Thread(
            target=self._process_events_background,
            daemon=True
        )
        self._monitoring_thread.start()

    def _process_events_background(self):
        """Process events in background thread"""
        while not self._stop_monitoring.is_set():
            try:
                # Get event from queue with timeout
                event_data = self._event_queue.get(timeout=1.0)

                # Send event to API
                requests.post(
                    f"{self.monitoring_api_url}/monitoring/events",
                    json=event_data,
                    timeout=5
                )

                self._event_queue.task_done()

            except queue.Empty:
                continue  # No events to process
            except Exception as e:
                print(f"Background monitoring error: {e}")

    def capture_event(self, event_type: str, data: Dict[str, Any]):
        """Non-blocking event capture"""
        if not self.session_id:
            return

        event_data = {
            "event_type": event_type,
            "data": {
                **data,
                "wrapper_name": self.wrapper_name,
                "timestamp": datetime.utcnow().isoformat()
            },
            "session_id": self.session_id
        }

        try:
            # Add to queue for background processing
            self._event_queue.put_nowait(event_data)
        except queue.Full:
            # Queue is full, drop the event
            print("⚠️ Event queue full, dropping event")

    def stop_monitoring(self):
        """Stop monitoring and cleanup background thread"""
        if self._monitoring_thread:
            self._stop_monitoring.set()
            self._monitoring_thread.join(timeout=5)

        super().stop_monitoring()
```

---

## Migration Tools and Utilities

### 1. Migration Checklist Tool

```python
#!/usr/bin/env python3
"""
Migration checklist tool for Claude Code wrapper migration
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any

class MigrationChecklist:
    """Interactive migration checklist tool"""

    def __init__(self, wrapper_path: str):
        self.wrapper_path = Path(wrapper_path)
        self.checklist = self._load_checklist()

    def _load_checklist(self) -> Dict[str, Any]:
        """Load migration checklist"""
        return {
            "pre_migration": [
                {"task": "Create backup of wrapper", "completed": False, "required": True},
                {"task": "Install specification system", "completed": False, "required": True},
                {"task": "Test API connectivity", "completed": False, "required": True},
                {"task": "Analyze current wrapper", "completed": False, "required": True},
            ],
            "schema_migration": [
                {"task": "Migrate command format", "completed": False, "required": True},
                {"task": "Update event handling", "completed": False, "required": True},
                {"task": "Validate schema compliance", "completed": False, "required": True},
            ],
            "monitoring_integration": [
                {"task": "Add monitoring wrapper class", "completed": False, "required": True},
                {"task": "Integrate event capture", "completed": False, "required": True},
                {"task": "Test monitoring functionality", "completed": False, "required": True},
            ],
            "validation_integration": [
                {"task": "Add validation methods", "completed": False, "required": True},
                {"task": "Integrate schema validation", "completed": False, "required": True},
                {"task": "Test validation pipeline", "completed": False, "required": True},
            ],
            "testing": [
                {"task": "Run migration test suite", "completed": False, "required": True},
                {"task": "Performance testing", "completed": False, "required": False},
                {"task": "Integration testing", "completed": False, "required": True},
            ],
            "deployment": [
                {"task": "Update documentation", "completed": False, "required": False},
                {"task": "Deploy to staging", "completed": False, "required": False},
                {"task": "Deploy to production", "completed": False, "required": False},
            ]
        }

    def run_interactive_checklist(self):
        """Run interactive migration checklist"""
        print("🔄 Claude Code Wrapper Migration Checklist")
        print("=" * 50)

        for category, tasks in self.checklist.items():
            print(f"\n📋 {category.replace('_', ' ').title()}")
            print("-" * 30)

            for i, task in enumerate(tasks):
                status = "✅" if task["completed"] else "⭕"
                required = "(Required)" if task["required"] else "(Optional)"
                print(f"{status} {task['task']} {required}")

                if not task["completed"]:
                    response = input(f"Mark '{task['task']}' as completed? (y/n): ").lower()
                    if response == 'y':
                        task["completed"] = True
                        print("✅ Marked as completed")

        # Summary
        self._print_summary()

    def _print_summary(self):
        """Print migration summary"""
        print("\n" + "=" * 50)
        print("📊 Migration Summary")
        print("=" * 50)

        total_required = 0
        completed_required = 0
        total_optional = 0
        completed_optional = 0

        for category, tasks in self.checklist.items():
            for task in tasks:
                if task["required"]:
                    total_required += 1
                    if task["completed"]:
                        completed_required += 1
                else:
                    total_optional += 1
                    if task["completed"]:
                        completed_optional += 1

        required_percentage = (completed_required / total_required * 100) if total_required > 0 else 0
        optional_percentage = (completed_optional / total_optional * 100) if total_optional > 0 else 0

        print(f"Required tasks: {completed_required}/{total_required} ({required_percentage:.1f}%)")
        print(f"Optional tasks: {completed_optional}/{total_optional} ({optional_percentage:.1f}%)")

        if completed_required == total_required:
            print("\n🎉 All required migration tasks completed!")
            print("Your wrapper is ready for production use.")
        else:
            remaining = total_required - completed_required
            print(f"\n⚠️ {remaining} required tasks remaining")
            print("Complete all required tasks before deploying to production.")

    def save_progress(self, filename: str = "migration_progress.json"):
        """Save migration progress"""
        with open(filename, 'w') as f:
            json.dump(self.checklist, f, indent=2)
        print(f"✅ Progress saved to {filename}")

    def load_progress(self, filename: str = "migration_progress.json"):
        """Load migration progress"""
        try:
            with open(filename, 'r') as f:
                self.checklist = json.load(f)
            print(f"✅ Progress loaded from {filename}")
        except FileNotFoundError:
            print(f"⚠️ No saved progress found at {filename}")

def main():
    """Main function for migration checklist tool"""
    if len(sys.argv) != 2:
        print("Usage: python migration_checklist.py <wrapper_path>")
        sys.exit(1)

    wrapper_path = sys.argv[1]
    checklist = MigrationChecklist(wrapper_path)

    # Try to load existing progress
    checklist.load_progress()

    # Run interactive checklist
    checklist.run_interactive_checklist()

    # Save progress
    checklist.save_progress()

if __name__ == "__main__":
    main()
```

### 2. Automated Migration Script

```python
#!/usr/bin/env python3
"""
Automated migration script for Claude Code wrappers
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path
from datetime import datetime

class AutoMigrator:
    """Automated migration tool"""

    def __init__(self, wrapper_path: str, spec_system_path: str):
        self.wrapper_path = Path(wrapper_path)
        self.spec_system_path = Path(spec_system_path)
        self.backup_path = self.wrapper_path.parent / f"{self.wrapper_path.name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def migrate(self):
        """Run automated migration"""
        print("🤖 Starting automated migration...")

        try:
            # Step 1: Create backup
            self._create_backup()

            # Step 2: Install dependencies
            self._install_dependencies()

            # Step 3: Migrate code
            self._migrate_code()

            # Step 4: Run tests
            self._run_tests()

            print("🎉 Automated migration completed successfully!")

        except Exception as e:
            print(f"❌ Migration failed: {e}")
            print("🔄 Rolling back changes...")
            self._rollback()
            raise

    def _create_backup(self):
        """Create backup of wrapper"""
        print("📦 Creating backup...")
        shutil.copytree(self.wrapper_path, self.backup_path)
        print(f"✅ Backup created at {self.backup_path}")

    def _install_dependencies(self):
        """Install specification system dependencies"""
        print("📥 Installing dependencies...")

        # Install Python dependencies
        requirements_file = self.spec_system_path / "requirements.txt"
        if requirements_file.exists():
            subprocess.run([
                sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
            ], check=True)

        # Install Node.js dependencies for schemas
        schema_dir = self.spec_system_path / "claudeCodeSpecs" / "schemas"
        if (schema_dir / "package.json").exists():
            subprocess.run(["npm", "install"], cwd=schema_dir, check=True)
            subprocess.run(["npm", "run", "build"], cwd=schema_dir, check=True)

        print("✅ Dependencies installed")

    def _migrate_code(self):
        """Apply automated code migrations"""
        print("🔄 Migrating code...")

        # Apply command migrator
        migrator = CommandMigrator(str(self.wrapper_path))
        results = migrator.migrate_wrapper()

        migrated_files = sum(1 for r in results if r["migrated"])
        print(f"✅ Migrated {migrated_files} files")

        # Add monitoring integration
        self._add_monitoring_integration()

        # Add validation integration
        self._add_validation_integration()

    def _add_monitoring_integration(self):
        """Add monitoring integration to main wrapper file"""
        print("📊 Adding monitoring integration...")

        # Find main wrapper file
        main_files = list(self.wrapper_path.glob("*wrapper*.py"))
        if not main_files:
            main_files = list(self.wrapper_path.glob("main.py"))

        if main_files:
            main_file = main_files[0]
            self._inject_monitoring_code(main_file)
            print(f"✅ Added monitoring to {main_file}")

    def _add_validation_integration(self):
        """Add validation integration"""
        print("✅ Adding validation integration...")

        # This would add validation code to the wrapper
        # Implementation depends on wrapper structure
        pass

    def _inject_monitoring_code(self, file_path: Path):
        """Inject monitoring code into a Python file"""
        content = file_path.read_text()

        # Add import at the top
        if "from claudeCodeSpecs" not in content:
            import_line = "\nfrom claudeCodeSpecs.api.monitoring_api import MonitoringAPI\n"

            # Find the right place to insert import
            lines = content.split('\n')
            insert_index = 0

            for i, line in enumerate(lines):
                if line.startswith('import ') or line.startswith('from '):
                    insert_index = i + 1

            lines.insert(insert_index, import_line.strip())
            content = '\n'.join(lines)

        # Add monitoring initialization
        if "MonitoringAPI()" not in content:
            # This is a simplified injection - real implementation would be more sophisticated
            content += "\n\n# Auto-generated monitoring integration\n"
            content += "monitoring_api = MonitoringAPI()\n"

        file_path.write_text(content)

    def _run_tests(self):
        """Run migration tests"""
        print("🧪 Running tests...")

        # Run the test suite
        test_success = run_migration_tests()

        if test_success:
            print("✅ All tests passed")
        else:
            raise Exception("Migration tests failed")

    def _rollback(self):
        """Rollback migration changes"""
        if self.backup_path.exists():
            # Remove modified wrapper
            if self.wrapper_path.exists():
                shutil.rmtree(self.wrapper_path)

            # Restore from backup
            shutil.copytree(self.backup_path, self.wrapper_path)
            print(f"🔄 Rolled back to backup at {self.backup_path}")

def main():
    """Main function for automated migration"""
    if len(sys.argv) != 3:
        print("Usage: python auto_migrate.py <wrapper_path> <spec_system_path>")
        sys.exit(1)

    wrapper_path = sys.argv[1]
    spec_system_path = sys.argv[2]

    migrator = AutoMigrator(wrapper_path, spec_system_path)
    migrator.migrate()

if __name__ == "__main__":
    main()
```

This comprehensive migration guide provides Claude Code wrapper developers with all the tools and knowledge needed to successfully migrate to the specification system while maintaining functionality and adding powerful new capabilities for monitoring, validation, and compliance.