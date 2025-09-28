# Workflow System Documentation

A unified, extensible automation system for Claude Code workflows with pluggable architecture and backward compatibility.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Workflow Types](#workflow-types)
- [Configuration](#configuration)
- [Extension Points](#extension-points)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## Overview

The workflow system provides a unified interface for automating various development tasks using Claude Code sessions. It replaces the legacy `spec_workflow_automation.py` system with a more flexible, extensible architecture that supports multiple workflow types while maintaining 100% backward compatibility.

### Key Features

- **Multiple Workflow Types**: Spec, test-fix, type-fix, build-fix workflows
- **Pluggable Architecture**: Easy to extend with custom workflow types
- **Backward Compatibility**: Seamless migration from legacy automation
- **Unified CLI**: Single interface for all workflow types
- **Configuration Management**: Flexible YAML/JSON configuration system
- **Session Management**: Robust Claude Code session orchestration
- **Error Recovery**: Advanced error handling and recovery mechanisms

### System Requirements

- Python 3.8+
- Claude Code installed and configured
- Project with appropriate structure for chosen workflow type

## Quick Start

### Installation

The workflow system is included in this project. No additional installation required.

### Basic Usage

```bash
# Navigate to project root first
cd /path/to/cc-task-manager

# Spec workflow (most common)
python3 -m workflows spec --spec-name "my-feature" --project /path/to/project

# Test fix workflow
python3 -m workflows test-fix --project /path/to/project --test-command "npm test"

# Type fix workflow
python3 -m workflows type-fix --project /path/to/project --type-command "npx tsc"

# Build fix workflow
python3 -m workflows build-fix --project /path/to/project --build-command "npm run build"

# With global options (note: global options come before workflow type)
python3 -m workflows --max-cycles 5 --verbose test-fix --project /path/to/project
```

### Python API

```python
from workflows.definitions.spec_workflow import create_spec_workflow
from workflows.core.workflow_engine import WorkflowEngine
from pathlib import Path

# Create workflow
workflow = create_spec_workflow(
    spec_name="user-authentication",
    project_path=Path("/path/to/project")
)

# Execute workflow (note: WorkflowEngine takes the full config, not just project_path)
engine = WorkflowEngine(workflow.config)
success = await engine.execute_workflow(workflow)
```

## Architecture

### Core Components

```
workflows/
├── core/                    # Core system components
│   ├── base_workflow.py     # Abstract base class for all workflows
│   ├── workflow_engine.py   # Execution engine for workflow orchestration
│   ├── completion_detector.py # Pluggable completion detection system
│   └── config_manager.py    # Configuration management system
├── definitions/             # Concrete workflow implementations
│   ├── spec_workflow.py     # Spec workflow (migrated from legacy)
│   ├── test_fix_workflow.py # Test failure resolution workflow
│   ├── type_fix_workflow.py # Type error resolution workflow
│   └── build_fix_workflow.py # Build error resolution workflow
├── validation/             # System validation and testing
├── cli.py                  # Unified command-line interface
└── __main__.py            # Module entry point
```

### Design Principles

1. **Template Method Pattern**: BaseWorkflow defines the workflow structure
2. **Strategy Pattern**: Pluggable completion detectors for different detection strategies
3. **Factory Pattern**: Factory functions for creating configured workflow instances
4. **Observer Pattern**: Event-driven session monitoring and state management

### Data Flow

```
CLI Input → Configuration → Workflow Instance → Engine → Claude Code Session
    ↓                                                           ↓
Output ← Completion Detection ← Session Monitoring ← Session Output
```

## Workflow Types

### Spec Workflow

Automates spec-workflow task execution using Claude Code sessions.

**Purpose**: Execute tasks from specification files until all tasks are completed.

**Usage**:
```bash
# From project root directory
cd /path/to/cc-task-manager
python3 -m workflows spec --spec-name "user-auth" --project /path/to/project
```

**Configuration**:
```python
config = WorkflowConfig(
    workflow_type='spec',
    spec_name='user-authentication',
    project_path=Path('/project/path'),
    max_cycles=10,
    max_session_time=1800
)
```

**Completion Detection**: Detects completion via spec-workflow MCP tool results and task file analysis.

### Test Fix Workflow

Automates fixing failing tests until all tests pass.

**Purpose**: Analyze test failures, implement fixes, and verify test success.

**Usage**:
```bash
# From project root directory
cd /path/to/cc-task-manager
python3 -m workflows test-fix --project /path/to/project --test-command "npm test"
```

**Configuration**:
```python
config = WorkflowConfig(
    workflow_type='test-fix',
    project_path=Path('/project/path'),
    test_command='npm test',
    completion_patterns=['All tests passed', 'Tests: 0 failed']
)
```

**Completion Detection**: Monitors test command output for success patterns.

### Type Fix Workflow

Automates fixing type errors until type checking passes.

**Purpose**: Resolve TypeScript, mypy, or other type checker errors.

**Usage**:
```bash
# From project root directory
cd /path/to/cc-task-manager
python3 -m workflows type-fix --project /path/to/project --type-command "npx tsc"
```

**Configuration**:
```python
config = WorkflowConfig(
    workflow_type='type-fix',
    project_path=Path('/project/path'),
    type_check_command='npx tsc --noEmit',
    completion_patterns=['Found 0 errors']
)
```

**Completion Detection**: Monitors type checker output for zero errors.

### Build Fix Workflow

Automates fixing build errors until compilation succeeds.

**Purpose**: Resolve compilation errors and build system issues.

**Usage**:
```bash
# From project root directory
cd /path/to/cc-task-manager
python3 -m workflows build-fix --project /path/to/project --build-command "npm run build"
```

**Configuration**:
```python
config = WorkflowConfig(
    workflow_type='build-fix',
    project_path=Path('/project/path'),
    build_command='npm run build',
    completion_patterns=['Build successful', 'Compiled successfully']
)
```

**Completion Detection**: Monitors build command output for success indicators.

## Configuration

### Configuration Files

The system supports multiple configuration formats:

#### YAML Configuration (workflows.yaml)
```yaml
workflows:
  # Global defaults
  max_cycles: 10
  max_session_time: 1800
  debug_options:
    show_tool_details: true
    truncate_long_content: true

  # Workflow-specific settings
  spec:
    max_cycles: 15
    completion_timeout: 300

  test-fix:
    test_command: "npm test"
    max_cycles: 5
    completion_patterns:
      - "All tests passed"
      - "Tests: 0 failed"

  type-fix:
    type_check_command: "npx tsc --noEmit"
    completion_patterns:
      - "Found 0 errors"

  build-fix:
    build_command: "npm run build"
    completion_patterns:
      - "Build successful"
      - "Compiled successfully"
```

#### JSON Configuration (workflows.json)
```json
{
  "workflows": {
    "max_cycles": 10,
    "max_session_time": 1800,
    "spec": {
      "max_cycles": 15
    },
    "test-fix": {
      "test_command": "npm test"
    }
  }
}
```

### Environment Variables

Override configuration values using environment variables:

```bash
export WORKFLOW_MAX_CYCLES=20
export WORKFLOW_DEBUG_LEVEL=debug
export WORKFLOW_SESSION_TIMEOUT=3600
```

### Debug Options

Control debugging output with granular options:

```python
debug_options = {
    'show_raw_data': False,           # Show complete raw JSON data
    'show_all_events': False,         # Show all events with full data
    'show_payload_structure': False,  # Show payload structure analysis
    'show_content_analysis': False,   # Show content structure analysis
    'show_stream_metadata': False,    # Show stream metadata
    'show_tool_details': True,        # Show tool usage details (default)
    'truncate_long_content': True,    # Truncate long content
    'max_content_length': 500         # Max content length before truncation
}
```

## Extension Points

### Creating Custom Workflows

The system is designed to be easily extensible. Create custom workflows by extending `BaseWorkflow`:

#### 1. Define Custom Workflow Class

```python
# workflows/definitions/my_custom_workflow.py
from ..core.base_workflow import BaseWorkflow, WorkflowConfig
from ..core.completion_detector import CommandResultDetector

class MyCustomWorkflow(BaseWorkflow):
    """Custom workflow for specific automation needs."""

    def validate_config(self) -> None:
        """Validate custom workflow configuration."""
        super().validate_config()
        # Add custom validation logic
        if not self.config.custom_field:
            raise ValueError("custom_field is required")

    def get_workflow_prompt(self) -> str:
        """Generate prompt for Claude Code execution."""
        return f"""
        Custom workflow prompt for: {self.config.custom_field}

        1. Analyze the current state
        2. Execute custom logic
        3. Verify completion
        4. Report results
        """

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """Detect if workflow has completed."""
        # Implement custom completion detection logic
        return self.custom_detector.detect_completion(output_data)

    def get_execution_options(self) -> Dict[str, Any]:
        """Get Claude Code execution options."""
        return {
            "cwd": str(self.config.project_path),
            "exit_on_complete": True,
            "permission_mode": "bypassPermissions"
        }

    def prepare_workflow_session(self) -> bool:
        """Prepare for workflow execution."""
        # Custom preparation logic
        self.custom_detector = CommandResultDetector(
            command="my-custom-command",
            success_patterns=["Custom task completed"]
        )
        return True

    def cleanup_workflow_session(self) -> None:
        """Clean up after workflow execution."""
        # Custom cleanup logic
        pass
```

#### 2. Create Factory Function

```python
def create_my_custom_workflow(custom_field: str, project_path: Path, **kwargs) -> MyCustomWorkflow:
    """Factory function for creating custom workflow instances."""
    config = WorkflowConfig(
        workflow_type='my-custom',
        project_path=project_path,
        custom_field=custom_field,
        **kwargs
    )
    return MyCustomWorkflow(config)
```

#### 3. Add CLI Support

```python
# In workflows/cli.py, add new subparser
def add_my_custom_subparser(subparsers):
    """Add custom workflow subcommand."""
    custom_parser = subparsers.add_parser(
        'my-custom',
        help='Run my custom workflow',
        description='Execute custom automation tasks'
    )

    custom_parser.add_argument("--project", required=True)
    custom_parser.add_argument("--custom-field", required=True)
    custom_parser.set_defaults(workflow_type='my-custom')
```

#### 4. Register in Factory

```python
# In create_workflow_instance function
def create_workflow_instance(config: WorkflowConfig):
    if config.workflow_type == 'my-custom':
        return MyCustomWorkflow(config)
    # ... existing workflow types
```

### Custom Completion Detectors

Create specialized completion detection strategies:

```python
from ..core.completion_detector import CompletionDetector

class CustomPatternDetector(CompletionDetector):
    """Custom completion detector for specific patterns."""

    def __init__(self, custom_patterns: List[str]):
        super().__init__()
        self.custom_patterns = custom_patterns

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """Implement custom detection logic."""
        # Extract relevant content from output_data
        content = self._extract_content(output_data)

        # Check for custom patterns
        for pattern in self.custom_patterns:
            if pattern in content.lower():
                return True

        return False

    def _extract_content(self, output_data: Dict[str, Any]) -> str:
        """Extract text content from Claude output."""
        # Implementation specific to your needs
        pass
```

### Configuration Extensions

Extend the configuration system for custom requirements:

```python
@dataclass
class CustomWorkflowConfig(WorkflowConfig):
    """Extended configuration for custom workflows."""
    custom_field: Optional[str] = None
    custom_options: Dict[str, Any] = field(default_factory=dict)

    def validate_custom_config(self) -> None:
        """Validate custom configuration fields."""
        if self.workflow_type == 'my-custom' and not self.custom_field:
            raise ValueError("custom_field required for my-custom workflow")
```

## Migration Guide

### From Legacy spec_workflow_automation.py

The migration is designed to be seamless with zero downtime.

#### Automatic Migration

Use the migration tool for automatic transition:

```bash
# Check migration readiness
python scripts/migrate_to_workflows.py --check

# Perform full migration
python scripts/migrate_to_workflows.py --full-migration

# Validate migration
python scripts/migrate_to_workflows.py --validate
```

#### Manual Migration

##### 1. Update CLI Usage

```bash
# Before
python scripts/spec_workflow_automation.py --spec-name "my-spec" --project /path

# After (from cc-task-manager project root)
cd /path/to/cc-task-manager
python3 -m workflows spec --spec-name "my-spec" --project /path
```

##### 2. Update Python Imports

```python
# Before
from scripts.spec_workflow_automation import SpecWorkflowAutomation
automation = SpecWorkflowAutomation(spec_name, project_path, debug_options=debug_opts)
success = automation.run()

# After
from workflows.cli import run_spec_workflow_automation
exit_code = run_spec_workflow_automation(spec_name, project_path, debug_opts)
success = exit_code == 0
```

##### 3. Update PM2 Configuration

```javascript
// Before
{
  script: 'scripts/spec_workflow_automation.py',
  args: ['--spec-name', 'my-spec', '--project', process.cwd()]
}

// After
{
  script: 'python',
  args: ['-m', 'workflows.cli', 'spec', '--spec-name', 'my-spec', '--project', process.cwd()]
}
```

#### Backward Compatibility

The migration creates compatibility wrappers that allow existing code to continue working with deprecation warnings:

```python
# This still works (with warnings)
from scripts.spec_workflow_automation import SpecWorkflowAutomation
automation = SpecWorkflowAutomation(spec_name, project_path)
automation.run()
```

## Troubleshooting

### Common Issues

#### Module Import Errors

**Problem**: `ModuleNotFoundError: No module named 'workflows'`

**Solutions**:
1. Ensure you're running from the project root directory
2. Check that the workflows directory exists and has `__init__.py`
3. Verify Python path includes the project directory

```bash
# Check current directory
pwd

# Verify workflows module exists
ls -la workflows/

# Run from project root (cc-task-manager directory, not target project)
cd /path/to/cc-task-manager
python3 -m workflows --help
```

#### Workflow Execution Failures

**Problem**: Workflow starts but fails to complete or detect completion

**Solutions**:
1. Enable debug logging to see detailed execution
2. Check Claude Code session logs
3. Verify completion detection patterns

```bash
# Enable verbose debugging (note: global options before workflow type)
cd /path/to/cc-task-manager
python3 -m workflows --debug-all --verbose spec --spec-name "my-spec" --project .

# Check session logs
tail -f logs/workflow_session.log
```

#### Configuration Issues

**Problem**: Configuration not loading or invalid values

**Solutions**:
1. Validate configuration file syntax
2. Check environment variable names
3. Verify required fields are present

```bash
# Validate YAML syntax
python -c "import yaml; yaml.safe_load(open('workflows.yaml'))"

# Check configuration loading
python -c "from workflows.core.config_manager import ConfigManager; print(ConfigManager.load_config('.'))"
```

#### PM2 Integration Issues

**Problem**: PM2 processes fail to start with new workflow system

**Solutions**:
1. Check ecosystem.config.js syntax
2. Verify Python executable path
3. Test workflow manually first

```bash
# Test workflow manually (from cc-task-manager root)
cd /path/to/cc-task-manager
python3 -m workflows spec --spec-name "test" --project .

# Check PM2 process logs
pm2 logs spec-workflow

# Restart PM2 processes
pm2 restart ecosystem.config.js
```

### Debug Modes

#### Basic Debugging
```bash
# From cc-task-manager root directory
cd /path/to/cc-task-manager
python3 -m workflows --verbose spec --spec-name "my-spec" --project .
```

#### Advanced Debugging
```bash
# From cc-task-manager root directory
cd /path/to/cc-task-manager
python3 -m workflows --debug-all --debug-tools --debug-content --verbose \
  spec --spec-name "my-spec" --project .
```

#### Session Logging
```bash
# From cc-task-manager root directory
cd /path/to/cc-task-manager
python3 -m workflows --session-log session.jsonl --debug-full \
  spec --spec-name "my-spec" --project .
```

### Performance Optimization

#### Memory Usage
- Use `--max-content 200` to reduce memory usage for large outputs
- Enable `--debug-tools` only (disable other debug options)
- Set appropriate `max_session_time` limits

#### Execution Speed
- Optimize completion detection patterns
- Use specific patterns instead of generic ones
- Adjust `max_cycles` based on typical workflow length

### Getting Help

1. **Check Logs**: Always start with workflow and session logs
2. **Enable Debug Mode**: Use `--debug-all --verbose` for detailed output
3. **Validate Configuration**: Ensure all required fields are present
4. **Test Components**: Test individual components (workflows, detectors) separately
5. **Migration Issues**: Check migration logs and backup files

## API Reference

### Core Classes

#### BaseWorkflow

Abstract base class for all workflows.

```python
class BaseWorkflow(ABC):
    def __init__(self, config: WorkflowConfig)
    def validate_config(self) -> None
    def get_workflow_prompt(self) -> str  # Abstract
    def detect_completion(self, output_data: Dict[str, Any]) -> bool  # Abstract
    def get_execution_options(self) -> Dict[str, Any]  # Abstract
    def prepare_workflow_session(self) -> bool
    def cleanup_workflow_session(self) -> None
    def get_status_info(self) -> Dict[str, Any]
```

#### WorkflowConfig

Configuration dataclass for workflow parameters.

```python
@dataclass
class WorkflowConfig:
    workflow_type: str
    project_path: Path
    spec_name: Optional[str] = None
    max_cycles: int = 10
    max_session_time: int = 1800
    debug_options: Dict[str, Any] = field(default_factory=dict)
    completion_patterns: List[str] = field(default_factory=list)
    custom_settings: Dict[str, Any] = field(default_factory=dict)
```

#### WorkflowEngine

Execution engine for workflow orchestration.

```python
class WorkflowEngine:
    def __init__(self, config: WorkflowConfig)
    async def execute_workflow(self, workflow: BaseWorkflow) -> bool
    def start_claude_session(self, workflow: BaseWorkflow) -> bool
    def monitor_session(self, workflow: BaseWorkflow) -> bool
    def shutdown_session(self) -> None
```

### Completion Detectors

#### CompletionDetector

Abstract base class for completion detection strategies.

```python
class CompletionDetector(ABC):
    def detect_completion(self, output_data: Dict[str, Any]) -> bool  # Abstract
```

#### SpecWorkflowDetector

Specialized detector for spec-workflow completion.

```python
class SpecWorkflowDetector(CompletionDetector):
    def __init__(self, debug_enabled: bool = True)
    def detect_completion(self, output_data: Dict[str, Any]) -> bool
```

#### CommandResultDetector

Detector for command execution results.

```python
class CommandResultDetector(CompletionDetector):
    def __init__(self, command: str, success_patterns: List[str])
    def detect_completion(self, output_data: Dict[str, Any]) -> bool
```

#### TextPatternDetector

Detector for text pattern matching.

```python
class TextPatternDetector(CompletionDetector):
    def __init__(self, patterns: List[str], case_sensitive: bool = False)
    def detect_completion(self, output_data: Dict[str, Any]) -> bool
```

### Factory Functions

#### create_spec_workflow
```python
def create_spec_workflow(spec_name: str, project_path: Path, **kwargs) -> SpecWorkflow
```

#### migrate_from_automation_config
```python
def migrate_from_automation_config(spec_name: str, project_path: str,
                                 debug_options: Optional[Dict[str, Any]] = None) -> SpecWorkflow
```

#### run_spec_workflow_automation
```python
def run_spec_workflow_automation(spec_name: str, project_path: str,
                                debug_options: Optional[Dict[str, Any]] = None) -> int
```

### CLI Interface

The unified CLI provides access to all workflow types:

```bash
# From cc-task-manager project root
cd /path/to/cc-task-manager
python3 -m workflows [global-options] <workflow-type> [workflow-options]
```

#### Common Options
- `--project PATH`: Project directory path (required)
- `--verbose`: Enable verbose logging
- `--session-log FILE`: Log session data to file
- `--debug-*`: Various debug options
- `--max-cycles N`: Maximum execution cycles
- `--max-session-time N`: Maximum session duration (seconds)

#### Spec Workflow Options
- `--spec-name NAME`: Specification name (required)

#### Test Fix Workflow Options
- `--test-command CMD`: Test command to run
- `--test-patterns PATTERN [...]`: Additional test success patterns

#### Type Fix Workflow Options
- `--type-command CMD`: Type check command to run
- `--type-patterns PATTERN [...]`: Additional type success patterns

#### Build Fix Workflow Options
- `--build-command CMD`: Build command to run
- `--build-patterns PATTERN [...]`: Additional build success patterns

---

## Contributing

### Adding New Workflow Types

1. Create workflow class extending `BaseWorkflow`
2. Implement required abstract methods
3. Add factory function
4. Update CLI interface
5. Add tests and documentation
6. Update this README

### Code Style

- Follow PEP 8 style guidelines
- Use type hints for all functions
- Include comprehensive docstrings
- Add logging for important operations
- Write unit tests for new functionality

### Testing

```bash
# Run all tests
python -m pytest tests/

# Run specific workflow tests
python -m pytest tests/test_spec_workflow.py

# Run validation tests
python -m pytest tests/test_validation.py
```

---

*For more information, see individual module documentation and the migration guide.*