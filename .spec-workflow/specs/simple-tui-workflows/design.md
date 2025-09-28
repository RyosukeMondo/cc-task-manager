# Simple TUI Workflows - Technical Design

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CLI Entry     │────│  Workflow Engine │────│ Claude Wrapper  │
│   (cli.py)      │    │ (workflow_engine │    │ (existing)      │
└─────────────────┘    │     .py)         │    └─────────────────┘
                       └──────────────────┘
                                │
                       ┌──────────────────┐
                       │  Workflow        │
                       │  Definitions     │
                       │  (plugins)       │
                       └──────────────────┘
                                │
                    ┌─────────────────────────────┐
                    │    Completion Detectors     │
                    │  (pluggable strategies)     │
                    └─────────────────────────────┘
```

## Core Components

### 1. Base Workflow Class (`base_workflow.py`)

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

@dataclass
class WorkflowConfig:
    name: str
    max_cycles: int = 10
    max_session_time: int = 1800
    debug_options: Dict[str, Any] = None

class BaseWorkflow(ABC):
    def __init__(self, config: WorkflowConfig):
        self.config = config

    @abstractmethod
    def get_prompt_template(self) -> str:
        """Return prompt template with {variables}"""
        pass

    @abstractmethod
    def get_completion_detectors(self) -> List['CompletionDetector']:
        """Return list of completion detection strategies"""
        pass

    @abstractmethod
    def format_prompt(self, **kwargs) -> str:
        """Format template with provided variables"""
        pass

    def get_debug_options(self) -> Dict[str, Any]:
        """Return debug configuration"""
        return self.config.debug_options or {}
```

### 2. Completion Detection System (`completion_detector.py`)

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import subprocess
import re
import json

class CompletionDetector(ABC):
    @abstractmethod
    def check_completion(self, output_data: Dict[str, Any]) -> bool:
        """Check if workflow should complete based on output"""
        pass

class TextPatternDetector(CompletionDetector):
    def __init__(self, patterns: List[str]):
        self.patterns = patterns

    def check_completion(self, output_data: Dict[str, Any]) -> bool:
        # Implementation similar to existing _check_text_for_completion_patterns
        pass

class CommandResultDetector(CompletionDetector):
    def __init__(self, command: str, expected_exit_code: int = 0):
        self.command = command
        self.expected_exit_code = expected_exit_code

    def check_completion(self, output_data: Dict[str, Any]) -> bool:
        # Execute command and check exit code
        pass

class ToolResultDetector(CompletionDetector):
    def __init__(self, tool_patterns: Dict[str, Any]):
        self.tool_patterns = tool_patterns

    def check_completion(self, output_data: Dict[str, Any]) -> bool:
        # Parse tool results similar to existing spec-workflow detection
        pass
```

### 3. Workflow Engine (`workflow_engine.py`)

```python
class WorkflowEngine:
    def __init__(self, workflow: BaseWorkflow, project_path: str):
        self.workflow = workflow
        self.project_path = project_path
        self.claude_process = None
        self.session_active = False
        self.completed = False

    def run(self, **prompt_variables) -> bool:
        """Execute workflow with provided variables"""
        # Reuse most logic from existing SpecWorkflowAutomation.run()
        # but use workflow.get_completion_detectors() instead of hardcoded detection
        pass

    def _detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """Check all completion detectors"""
        for detector in self.workflow.get_completion_detectors():
            if detector.check_completion(output_data):
                return True
        return False
```

### 4. Configuration Manager (`config_manager.py`)

```python
import yaml
from pathlib import Path
from typing import Dict, Any

class ConfigManager:
    @staticmethod
    def load_workflow_config(workflow_name: str) -> WorkflowConfig:
        """Load workflow configuration from YAML/JSON"""
        pass

    @staticmethod
    def get_default_config(workflow_name: str) -> WorkflowConfig:
        """Get default configuration for workflow type"""
        pass

    @staticmethod
    def merge_configs(base: WorkflowConfig, override: Dict[str, Any]) -> WorkflowConfig:
        """Merge base config with runtime overrides"""
        pass
```

## Workflow Implementations

### 1. Spec Workflow (`spec_workflow.py`)
```python
class SpecWorkflow(BaseWorkflow):
    def get_prompt_template(self) -> str:
        return """spec: {spec_name}

work on a single task from spec name above of spec-workflow.

1. fetch one task from spec using mcp tool spec-workflow
2. work on task
3. update task status to complete on complete
4. commit changes
5. check remaining task count
6. end session without asking further actions.

Important: Use the mcp__spec-workflow tools to interact with the specification system."""

    def get_completion_detectors(self) -> List[CompletionDetector]:
        return [
            ToolResultDetector({
                "success": True,
                "data.taskProgress.completed": "equals_total"
            }),
            TextPatternDetector([
                "all tasks are marked as completed",
                "specification is fully implemented",
                "0 pending tasks"
            ])
        ]
```

### 2. Test Fix Workflow (`test_fix_workflow.py`)
```python
class TestFixWorkflow(BaseWorkflow):
    def get_prompt_template(self) -> str:
        return """Fix failing tests in project: {project_path}

1. Run test command: {test_command}
2. Analyze failing tests
3. Fix issues one by one
4. Re-run tests to verify fixes
5. Continue until all tests pass
6. Commit changes when complete

Focus on test failures only, don't modify unrelated code."""

    def get_completion_detectors(self) -> List[CompletionDetector]:
        return [
            CommandResultDetector("{test_command}", 0),
            TextPatternDetector([
                "all tests passed",
                "0 failing",
                "test suite completed successfully"
            ])
        ]
```

### 3. Type Fix Workflow (`type_fix_workflow.py`)
```python
class TypeFixWorkflow(BaseWorkflow):
    def get_prompt_template(self) -> str:
        return """Fix TypeScript/type errors in project: {project_path}

1. Run type check: {typecheck_command}
2. Analyze type errors
3. Fix type issues systematically
4. Re-run type check to verify
5. Continue until no type errors
6. Commit changes when clean

Focus only on type errors, maintain existing functionality."""

    def get_completion_detectors(self) -> List[CompletionDetector]:
        return [
            CommandResultDetector("{typecheck_command}", 0),
            TextPatternDetector([
                "no type errors",
                "compilation successful",
                "found 0 errors"
            ])
        ]
```

### 4. Build Fix Workflow (`build_fix_workflow.py`)
```python
class BuildFixWorkflow(BaseWorkflow):
    def get_prompt_template(self) -> str:
        return """Fix build errors in project: {project_path}

1. Run build command: {build_command}
2. Analyze build failures
3. Fix compilation/dependency issues
4. Re-run build to verify
5. Continue until build succeeds
6. Commit changes when complete

Fix only build-blocking issues, don't optimize or refactor."""

    def get_completion_detectors(self) -> List[CompletionDetector]:
        return [
            CommandResultDetector("{build_command}", 0),
            TextPatternDetector([
                "build successful",
                "compilation complete",
                "no build errors"
            ])
        ]
```

## CLI Interface (`cli.py`)

```python
import argparse
from pathlib import Path
from workflows.core.workflow_engine import WorkflowEngine
from workflows.definitions import (
    SpecWorkflow, TestFixWorkflow, TypeFixWorkflow, BuildFixWorkflow
)

WORKFLOWS = {
    'spec': SpecWorkflow,
    'test-fix': TestFixWorkflow,
    'type-fix': TypeFixWorkflow,
    'build-fix': BuildFixWorkflow,
}

def main():
    parser = argparse.ArgumentParser(description="Generalized workflow automation")
    parser.add_argument('workflow', choices=WORKFLOWS.keys(), help="Workflow type")
    parser.add_argument('--project', required=True, help="Project path")

    # Workflow-specific arguments
    parser.add_argument('--spec-name', help="Spec name (for spec workflow)")
    parser.add_argument('--test-command', default="npm test", help="Test command")
    parser.add_argument('--typecheck-command', default="tsc --noEmit", help="Type check command")
    parser.add_argument('--build-command', default="npm run build", help="Build command")

    # Common options
    parser.add_argument('--max-cycles', type=int, default=10)
    parser.add_argument('--debug', action='store_true')

    args = parser.parse_args()

    # Create workflow instance
    workflow_class = WORKFLOWS[args.workflow]
    config = WorkflowConfig(
        name=args.workflow,
        max_cycles=args.max_cycles,
        debug_options={'show_tool_details': args.debug}
    )
    workflow = workflow_class(config)

    # Prepare prompt variables
    prompt_vars = {
        'project_path': args.project,
        'spec_name': args.spec_name,
        'test_command': args.test_command,
        'typecheck_command': args.typecheck_command,
        'build_command': args.build_command,
    }

    # Execute workflow
    engine = WorkflowEngine(workflow, args.project)
    success = engine.run(**prompt_vars)

    exit(0 if success else 1)

if __name__ == "__main__":
    main()
```

## Usage Examples

```bash
# Existing spec workflow
python workflows/cli.py spec --project /path/to/project --spec-name "Auth System"

# Fix failing tests
python workflows/cli.py test-fix --project /path/to/project --test-command "pytest"

# Fix TypeScript errors
python workflows/cli.py type-fix --project /path/to/project --typecheck-command "tsc --noEmit"

# Fix build issues
python workflows/cli.py build-fix --project /path/to/project --build-command "npm run build"
```

## Migration Path

1. **Phase 1**: Create core abstractions and migrate spec workflow
2. **Phase 2**: Implement test-fix, type-fix, build-fix workflows
3. **Phase 3**: Add configuration system and advanced completion detection
4. **Phase 4**: Optimize for parallel execution and GUI integration

## Benefits

- **Extensibility**: New workflows require <50 lines of code
- **Maintainability**: Clear separation of concerns, testable components
- **Reusability**: Core engine handles all orchestration logic
- **Flexibility**: Pluggable completion detection and configuration
- **Future-Proof**: Architecture supports GUI integration and advanced features