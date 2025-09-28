# Extending the Workflow System

This guide provides detailed information on extending the workflow system with custom workflow types, completion detectors, and advanced configurations.

## Table of Contents

- [Custom Workflow Development](#custom-workflow-development)
- [Completion Detection Strategies](#completion-detection-strategies)
- [Configuration Extensions](#configuration-extensions)
- [Advanced Integration](#advanced-integration)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Custom Workflow Development

### Workflow Development Lifecycle

1. **Design Phase**: Define workflow purpose, inputs, and completion criteria
2. **Implementation Phase**: Create workflow class and completion detector
3. **Integration Phase**: Add CLI support and configuration options
4. **Testing Phase**: Create comprehensive tests
5. **Documentation Phase**: Document usage and examples

### Creating a Custom Workflow

#### Step 1: Define Workflow Class

```python
# workflows/definitions/database_migration_workflow.py
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging

from ..core.base_workflow import BaseWorkflow, WorkflowConfig
from ..core.completion_detector import CommandResultDetector, TextPatternDetector

logger = logging.getLogger(__name__)


class DatabaseMigrationWorkflow(BaseWorkflow):
    """
    Workflow for automating database migration tasks.

    This workflow handles database schema migrations, data migrations,
    and verification of migration success across different environments.
    """

    def __init__(self, config: WorkflowConfig):
        super().__init__(config)

        # Initialize migration-specific components
        self.migration_detector = None
        self.verification_detector = None

        logger.info(f"Initialized DatabaseMigrationWorkflow for: {config.project_path}")

    def validate_config(self) -> None:
        """Validate configuration for database migration workflow."""
        super().validate_config()

        # Ensure workflow type is correct
        if self.config.workflow_type != 'db-migration':
            raise ValueError(f"DatabaseMigrationWorkflow requires workflow_type='db-migration'")

        # Validate required migration settings
        migration_config = self.config.custom_settings.get('migration', {})

        if not migration_config.get('database_url'):
            raise ValueError("database_url is required in migration configuration")

        if not migration_config.get('migration_tool'):
            raise ValueError("migration_tool is required (e.g., 'alembic', 'flyway', 'migrate')")

        # Validate migration tool is supported
        supported_tools = ['alembic', 'flyway', 'migrate', 'knex', 'sequelize']
        if migration_config['migration_tool'] not in supported_tools:
            raise ValueError(f"Unsupported migration tool. Supported: {supported_tools}")

        logger.debug("DatabaseMigrationWorkflow configuration validated")

    def get_workflow_prompt(self) -> str:
        """Generate prompt for database migration workflow."""
        migration_config = self.config.custom_settings.get('migration', {})
        migration_tool = migration_config.get('migration_tool', 'alembic')
        target_version = migration_config.get('target_version', 'latest')

        prompt = f"""Database Migration Workflow

You are tasked with performing database migrations safely and reliably.

Migration Configuration:
- Tool: {migration_tool}
- Target Version: {target_version}
- Database: {migration_config.get('database_url', 'configured')}
- Environment: {migration_config.get('environment', 'development')}

Tasks to complete:
1. Analyze current database schema and migration state
2. Review pending migrations for conflicts or issues
3. Execute migrations step by step with verification
4. Validate schema changes and data integrity
5. Run any post-migration scripts or verifications
6. Confirm successful migration completion

Safety Requirements:
- Always backup database before major migrations
- Test migrations on staging environment first
- Verify foreign key constraints remain valid
- Check for data loss or corruption
- Validate application compatibility

Use appropriate migration commands for {migration_tool} and ensure
each step completes successfully before proceeding to the next.

Complete when all migrations are applied successfully and verified."""

        logger.debug(f"Generated database migration prompt for {migration_tool}")
        return prompt

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """Detect if database migration workflow has completed."""
        try:
            # Check if migration completion was detected
            if self.migration_detector.detect_completion(output_data):
                logger.info("Migration completion detected via migration detector")

                # Additional verification if verification detector is configured
                if self.verification_detector:
                    if self.verification_detector.detect_completion(output_data):
                        logger.info("Migration verification completed")
                        self.completed = True
                        return True
                    else:
                        logger.info("Migration completed but verification pending")
                        return False
                else:
                    # No verification required, migration is complete
                    self.completed = True
                    return True

            return False

        except Exception as e:
            logger.error(f"Error detecting migration completion: {e}")
            return False

    def get_execution_options(self) -> Dict[str, Any]:
        """Get execution options for Claude Code session."""
        return {
            "cwd": str(self.config.project_path),
            "exit_on_complete": True,
            "permission_mode": "bypassPermissions",
            "timeout": self.config.custom_settings.get('migration_timeout', 1800)
        }

    def prepare_workflow_session(self) -> bool:
        """Prepare for database migration workflow execution."""
        try:
            migration_config = self.config.custom_settings.get('migration', {})
            migration_tool = migration_config.get('migration_tool')

            # Create appropriate completion detectors based on migration tool
            success_patterns = self._get_success_patterns(migration_tool)
            error_patterns = self._get_error_patterns(migration_tool)

            # Initialize migration completion detector
            self.migration_detector = TextPatternDetector(
                patterns=success_patterns,
                case_sensitive=False
            )

            # Initialize verification detector if verification is enabled
            if migration_config.get('verify_migrations', True):
                verification_patterns = [
                    "migration verification successful",
                    "schema validation passed",
                    "data integrity check passed"
                ]
                self.verification_detector = TextPatternDetector(
                    patterns=verification_patterns,
                    case_sensitive=False
                )

            # Verify migration tool is available
            if not self._verify_migration_tool_available(migration_tool):
                logger.error(f"Migration tool '{migration_tool}' not available")
                return False

            # Check database connectivity
            if not self._check_database_connectivity():
                logger.error("Database connectivity check failed")
                return False

            logger.info("Database migration workflow preparation completed")
            return True

        except Exception as e:
            logger.error(f"Database migration workflow preparation failed: {e}")
            return False

    def cleanup_workflow_session(self) -> None:
        """Clean up after database migration workflow execution."""
        try:
            if self.completed:
                logger.info("✅ Database migration workflow completed successfully")

                # Log migration summary
                migration_config = self.config.custom_settings.get('migration', {})
                logger.info(f"Migration tool: {migration_config.get('migration_tool')}")
                logger.info(f"Target version: {migration_config.get('target_version', 'latest')}")
            else:
                logger.info("🔄 Database migration workflow session ended without completion")

            # Clean up any temporary files or connections
            # (Implementation would depend on specific migration tool)

        except Exception as e:
            logger.warning(f"Error during database migration cleanup: {e}")

    def _get_success_patterns(self, migration_tool: str) -> List[str]:
        """Get success patterns for specific migration tool."""
        patterns = {
            'alembic': [
                "running upgrade",
                "successfully upgraded",
                "migration complete"
            ],
            'flyway': [
                "successfully applied",
                "migration successful",
                "schema history table"
            ],
            'migrate': [
                "migration complete",
                "successfully migrated",
                "up to date"
            ],
            'knex': [
                "batch 1 ran",
                "migration files ran",
                "latest migration"
            ],
            'sequelize': [
                "migration performed",
                "successfully migrated",
                "no pending migrations"
            ]
        }

        return patterns.get(migration_tool, [
            "migration successful",
            "migration complete",
            "successfully migrated"
        ])

    def _get_error_patterns(self, migration_tool: str) -> List[str]:
        """Get error patterns for specific migration tool."""
        return [
            "migration failed",
            "error applying migration",
            "rollback required",
            "constraint violation",
            "foreign key constraint fails"
        ]

    def _verify_migration_tool_available(self, migration_tool: str) -> bool:
        """Verify that the migration tool is available in the environment."""
        import subprocess

        tool_commands = {
            'alembic': ['alembic', '--version'],
            'flyway': ['flyway', '-version'],
            'migrate': ['migrate', '-version'],
            'knex': ['knex', '--version'],
            'sequelize': ['sequelize', '--version']
        }

        command = tool_commands.get(migration_tool)
        if not command:
            return False

        try:
            result = subprocess.run(command, capture_output=True, timeout=10)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def _check_database_connectivity(self) -> bool:
        """Check if database is accessible."""
        # Implementation would depend on database type and connection method
        # This is a placeholder that would need specific implementation
        migration_config = self.config.custom_settings.get('migration', {})
        database_url = migration_config.get('database_url')

        if not database_url:
            return False

        # In a real implementation, you would test the actual connection
        # For now, just verify the URL format
        return database_url.startswith(('postgresql://', 'mysql://', 'sqlite://'))


# Factory function for creating database migration workflows
def create_database_migration_workflow(
    project_path: Path,
    database_url: str,
    migration_tool: str = 'alembic',
    target_version: str = 'latest',
    **kwargs
) -> DatabaseMigrationWorkflow:
    """
    Factory function to create a DatabaseMigrationWorkflow instance.

    Args:
        project_path: Path to the project directory
        database_url: Database connection URL
        migration_tool: Migration tool to use (alembic, flyway, etc.)
        target_version: Target migration version
        **kwargs: Additional configuration parameters

    Returns:
        DatabaseMigrationWorkflow: Configured workflow instance
    """
    # Prepare migration configuration
    migration_config = {
        'database_url': database_url,
        'migration_tool': migration_tool,
        'target_version': target_version,
        'verify_migrations': kwargs.get('verify_migrations', True),
        'environment': kwargs.get('environment', 'development')
    }

    # Create workflow configuration
    config = WorkflowConfig(
        workflow_type='db-migration',
        project_path=project_path,
        max_cycles=kwargs.get('max_cycles', 5),
        max_session_time=kwargs.get('max_session_time', 1800),
        custom_settings={'migration': migration_config},
        debug_options=kwargs.get('debug_options', {})
    )

    return DatabaseMigrationWorkflow(config)
```

#### Step 2: Add CLI Support

```python
# In workflows/cli.py, add the new subparser
def add_database_migration_subparser(subparsers):
    """Add database migration workflow subcommand."""
    db_parser = subparsers.add_parser(
        'db-migration',
        help='Run database migration workflow',
        description='Automate database schema and data migrations'
    )

    db_parser.add_argument(
        "--project",
        required=True,
        help="Path to the target project directory"
    )
    db_parser.add_argument(
        "--database-url",
        required=True,
        help="Database connection URL"
    )
    db_parser.add_argument(
        "--migration-tool",
        choices=['alembic', 'flyway', 'migrate', 'knex', 'sequelize'],
        default='alembic',
        help="Migration tool to use (default: alembic)"
    )
    db_parser.add_argument(
        "--target-version",
        default='latest',
        help="Target migration version (default: latest)"
    )
    db_parser.add_argument(
        "--verify-migrations",
        action="store_true",
        default=True,
        help="Verify migrations after completion (default: True)"
    )

    db_parser.set_defaults(workflow_type='db-migration')

# Update create_workflow_instance function
def create_workflow_instance(config: WorkflowConfig):
    if config.workflow_type == 'db-migration':
        from .definitions.database_migration_workflow import DatabaseMigrationWorkflow
        return DatabaseMigrationWorkflow(config)
    # ... existing workflow types
```

#### Step 3: Configuration Support

```python
# Update create_workflow_config function in cli.py
def create_workflow_config(args: argparse.Namespace) -> WorkflowConfig:
    # ... existing code ...

    elif args.workflow_type == 'db-migration':
        migration_config = {
            'database_url': args.database_url,
            'migration_tool': args.migration_tool,
            'target_version': args.target_version,
            'verify_migrations': args.verify_migrations
        }
        config_params['custom_settings'] = {'migration': migration_config}

    return WorkflowConfig(**config_params)
```

## Completion Detection Strategies

### Custom Completion Detectors

#### Advanced Pattern Detector

```python
from ..core.completion_detector import CompletionDetector
import re
from typing import List, Dict, Any, Pattern

class AdvancedPatternDetector(CompletionDetector):
    """
    Advanced completion detector with regex patterns, context awareness,
    and multi-stage detection.
    """

    def __init__(self,
                 success_patterns: List[str],
                 failure_patterns: List[str] = None,
                 context_patterns: Dict[str, List[str]] = None,
                 require_all_patterns: bool = False):
        super().__init__()

        # Compile regex patterns for better performance
        self.success_regex = [re.compile(pattern, re.IGNORECASE) for pattern in success_patterns]
        self.failure_regex = [re.compile(pattern, re.IGNORECASE) for pattern in (failure_patterns or [])]

        # Context-aware patterns (different patterns for different contexts)
        self.context_patterns = context_patterns or {}
        self.context_regex = {
            context: [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
            for context, patterns in self.context_patterns.items()
        }

        self.require_all_patterns = require_all_patterns
        self.matched_patterns = set()

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """Detect completion using advanced pattern matching."""
        content = self._extract_all_content(output_data)

        if not content:
            return False

        # Check for failure patterns first
        if self._check_failure_patterns(content):
            return False

        # Check context-aware patterns
        context = self._determine_context(content)
        if context and context in self.context_regex:
            return self._check_context_patterns(content, context)

        # Check general success patterns
        return self._check_success_patterns(content)

    def _check_failure_patterns(self, content: str) -> bool:
        """Check if any failure patterns are present."""
        for pattern in self.failure_regex:
            if pattern.search(content):
                return True
        return False

    def _check_success_patterns(self, content: str) -> bool:
        """Check success patterns with optional requirement for all patterns."""
        matched_count = 0

        for i, pattern in enumerate(self.success_regex):
            if pattern.search(content):
                self.matched_patterns.add(i)
                matched_count += 1

                if not self.require_all_patterns:
                    return True

        # If require_all_patterns is True, check if all patterns matched
        if self.require_all_patterns:
            return matched_count == len(self.success_regex)

        return matched_count > 0

    def _determine_context(self, content: str) -> str:
        """Determine the current context based on content."""
        # Implementation to determine context
        # Could look for specific keywords, tool names, etc.
        content_lower = content.lower()

        if 'test' in content_lower and ('pass' in content_lower or 'fail' in content_lower):
            return 'testing'
        elif 'build' in content_lower or 'compile' in content_lower:
            return 'building'
        elif 'migration' in content_lower or 'schema' in content_lower:
            return 'migration'

        return 'general'

    def _check_context_patterns(self, content: str, context: str) -> bool:
        """Check patterns specific to the determined context."""
        context_regex = self.context_regex.get(context, [])

        for pattern in context_regex:
            if pattern.search(content):
                return True

        return False

    def _extract_all_content(self, output_data: Dict[str, Any]) -> str:
        """Extract all textual content from output data."""
        content_parts = []

        # Extract from various possible locations in the output data
        if isinstance(output_data, dict):
            content_parts.extend(self._extract_from_dict(output_data))

        return " ".join(content_parts)

    def _extract_from_dict(self, data: Dict[str, Any], prefix: str = "") -> List[str]:
        """Recursively extract text content from nested dictionaries."""
        content_parts = []

        for key, value in data.items():
            if isinstance(value, str):
                content_parts.append(value)
            elif isinstance(value, dict):
                content_parts.extend(self._extract_from_dict(value, f"{prefix}.{key}"))
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, str):
                        content_parts.append(item)
                    elif isinstance(item, dict):
                        content_parts.extend(self._extract_from_dict(item, f"{prefix}.{key}[]"))

        return content_parts
```

#### Multi-Stage Detector

```python
class MultiStageDetector(CompletionDetector):
    """
    Completion detector that requires multiple stages to be completed
    in sequence before considering the workflow complete.
    """

    def __init__(self, stages: List[Dict[str, Any]]):
        super().__init__()
        self.stages = stages
        self.completed_stages = set()
        self.current_stage = 0

        # Validate stage configuration
        for i, stage in enumerate(stages):
            if 'name' not in stage or 'patterns' not in stage:
                raise ValueError(f"Stage {i} must have 'name' and 'patterns' fields")

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """Detect completion by checking stage progression."""
        content = self._extract_content(output_data)

        if not content:
            return False

        # Check if current stage is completed
        if self._check_current_stage(content):
            self.completed_stages.add(self.current_stage)

            # Move to next stage
            if self.current_stage < len(self.stages) - 1:
                self.current_stage += 1

            # Check if all stages are completed
            if len(self.completed_stages) == len(self.stages):
                return True

        # Also check if any future stages are completed (in case of out-of-order completion)
        for i in range(self.current_stage + 1, len(self.stages)):
            if self._check_stage(content, i):
                self.completed_stages.add(i)

        return len(self.completed_stages) == len(self.stages)

    def _check_current_stage(self, content: str) -> bool:
        """Check if the current stage is completed."""
        return self._check_stage(content, self.current_stage)

    def _check_stage(self, content: str, stage_index: int) -> bool:
        """Check if a specific stage is completed."""
        if stage_index >= len(self.stages):
            return False

        stage = self.stages[stage_index]
        patterns = stage['patterns']
        require_all = stage.get('require_all', False)

        matched_count = 0
        for pattern in patterns:
            if pattern.lower() in content.lower():
                matched_count += 1
                if not require_all:
                    return True

        if require_all:
            return matched_count == len(patterns)

        return False

    def get_progress_info(self) -> Dict[str, Any]:
        """Get information about stage completion progress."""
        return {
            'total_stages': len(self.stages),
            'completed_stages': len(self.completed_stages),
            'current_stage': self.current_stage,
            'stage_names': [stage['name'] for stage in self.stages],
            'completed_stage_names': [
                self.stages[i]['name'] for i in self.completed_stages
            ],
            'progress_percentage': (len(self.completed_stages) / len(self.stages)) * 100
        }
```

## Configuration Extensions

### Advanced Configuration Classes

```python
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Union
from pathlib import Path

@dataclass
class AdvancedWorkflowConfig(WorkflowConfig):
    """Extended configuration with advanced features."""

    # Environment-specific settings
    environment: str = 'development'
    environment_overrides: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    # Retry and resilience settings
    retry_attempts: int = 3
    retry_delay: float = 5.0
    timeout_per_stage: int = 300

    # Monitoring and observability
    enable_monitoring: bool = True
    metrics_endpoint: Optional[str] = None
    log_level: str = 'INFO'

    # Security settings
    security_policy: Dict[str, Any] = field(default_factory=dict)
    allowed_commands: List[str] = field(default_factory=list)

    # Performance settings
    parallel_execution: bool = False
    max_concurrent_tasks: int = 3
    memory_limit: Optional[int] = None

    def get_environment_config(self) -> Dict[str, Any]:
        """Get configuration for the current environment."""
        base_config = {
            'max_cycles': self.max_cycles,
            'max_session_time': self.max_session_time,
            'debug_options': self.debug_options
        }

        # Apply environment-specific overrides
        env_overrides = self.environment_overrides.get(self.environment, {})
        base_config.update(env_overrides)

        return base_config

    def validate_security_policy(self) -> None:
        """Validate security policy configuration."""
        policy = self.security_policy

        if 'restrict_file_access' in policy:
            if not isinstance(policy['restrict_file_access'], bool):
                raise ValueError("restrict_file_access must be boolean")

        if 'allowed_directories' in policy:
            if not isinstance(policy['allowed_directories'], list):
                raise ValueError("allowed_directories must be a list")

            # Validate all paths exist
            for directory in policy['allowed_directories']:
                if not Path(directory).exists():
                    raise ValueError(f"Allowed directory does not exist: {directory}")
```

### Dynamic Configuration Loading

```python
class DynamicConfigLoader:
    """
    Loads configuration from multiple sources with priority:
    1. Command line arguments
    2. Environment variables
    3. Configuration files (YAML/JSON)
    4. Default values
    """

    def __init__(self, project_path: Path):
        self.project_path = project_path
        self.config_sources = []

    def load_config(self, workflow_type: str, **cli_args) -> WorkflowConfig:
        """Load configuration from all sources."""
        config_data = {}

        # 1. Load default configuration
        config_data.update(self._load_defaults(workflow_type))

        # 2. Load from configuration files
        config_data.update(self._load_from_files(workflow_type))

        # 3. Load from environment variables
        config_data.update(self._load_from_environment(workflow_type))

        # 4. Apply CLI arguments (highest priority)
        config_data.update(cli_args)

        return WorkflowConfig(**config_data)

    def _load_defaults(self, workflow_type: str) -> Dict[str, Any]:
        """Load default configuration values."""
        defaults = {
            'workflow_type': workflow_type,
            'project_path': self.project_path,
            'max_cycles': 10,
            'max_session_time': 1800,
            'debug_options': {'show_tool_details': True}
        }

        # Workflow-specific defaults
        workflow_defaults = {
            'spec': {'max_cycles': 15},
            'test-fix': {'max_cycles': 5, 'test_command': 'npm test'},
            'type-fix': {'max_cycles': 5},
            'build-fix': {'max_cycles': 3}
        }

        if workflow_type in workflow_defaults:
            defaults.update(workflow_defaults[workflow_type])

        return defaults

    def _load_from_files(self, workflow_type: str) -> Dict[str, Any]:
        """Load configuration from YAML/JSON files."""
        config_data = {}

        # Try multiple file locations
        config_files = [
            self.project_path / 'workflows.yaml',
            self.project_path / 'workflows.yml',
            self.project_path / 'workflows.json',
            self.project_path / '.workflows.yaml',
            self.project_path / 'config' / 'workflows.yaml'
        ]

        for config_file in config_files:
            if config_file.exists():
                file_config = self._parse_config_file(config_file)

                # Apply global settings
                if 'workflows' in file_config:
                    global_config = file_config['workflows']

                    # Apply general settings
                    for key in ['max_cycles', 'max_session_time', 'debug_options']:
                        if key in global_config:
                            config_data[key] = global_config[key]

                    # Apply workflow-specific settings
                    if workflow_type in global_config:
                        config_data.update(global_config[workflow_type])

                break  # Use first found configuration file

        return config_data

    def _load_from_environment(self, workflow_type: str) -> Dict[str, Any]:
        """Load configuration from environment variables."""
        import os

        config_data = {}

        # General environment variables
        env_mappings = {
            'WORKFLOW_MAX_CYCLES': 'max_cycles',
            'WORKFLOW_MAX_SESSION_TIME': 'max_session_time',
            'WORKFLOW_DEBUG_LEVEL': 'debug_level',
            'WORKFLOW_LOG_LEVEL': 'log_level'
        }

        for env_var, config_key in env_mappings.items():
            value = os.getenv(env_var)
            if value:
                # Type conversion
                if config_key in ['max_cycles', 'max_session_time']:
                    config_data[config_key] = int(value)
                else:
                    config_data[config_key] = value

        # Workflow-specific environment variables
        workflow_env_prefix = f'WORKFLOW_{workflow_type.upper().replace("-", "_")}_'

        for env_var, value in os.environ.items():
            if env_var.startswith(workflow_env_prefix):
                config_key = env_var[len(workflow_env_prefix):].lower()
                config_data[config_key] = value

        return config_data

    def _parse_config_file(self, config_file: Path) -> Dict[str, Any]:
        """Parse configuration file (YAML or JSON)."""
        import yaml
        import json

        try:
            with open(config_file, 'r') as f:
                if config_file.suffix in ['.yaml', '.yml']:
                    return yaml.safe_load(f)
                elif config_file.suffix == '.json':
                    return json.load(f)
                else:
                    raise ValueError(f"Unsupported config file format: {config_file}")
        except Exception as e:
            logger.warning(f"Failed to parse config file {config_file}: {e}")
            return {}
```

## Advanced Integration

### Workflow Orchestration

```python
class WorkflowOrchestrator:
    """
    Orchestrates multiple workflows with dependencies and parallel execution.
    """

    def __init__(self, project_path: Path):
        self.project_path = project_path
        self.workflows = {}
        self.dependencies = {}
        self.execution_order = []

    def add_workflow(self, name: str, workflow: BaseWorkflow, dependencies: List[str] = None):
        """Add a workflow to the orchestrator."""
        self.workflows[name] = workflow
        self.dependencies[name] = dependencies or []

    def execute_workflows(self) -> Dict[str, bool]:
        """Execute all workflows respecting dependencies."""
        results = {}

        # Calculate execution order
        execution_order = self._calculate_execution_order()

        for workflow_name in execution_order:
            workflow = self.workflows[workflow_name]

            # Check if dependencies completed successfully
            deps_satisfied = all(
                results.get(dep, False) for dep in self.dependencies[workflow_name]
            )

            if not deps_satisfied:
                logger.error(f"Dependencies not satisfied for workflow: {workflow_name}")
                results[workflow_name] = False
                continue

            # Execute workflow
            engine = WorkflowEngine(self.project_path)
            success = engine.execute_workflow(workflow)
            results[workflow_name] = success

            if not success:
                logger.error(f"Workflow failed: {workflow_name}")
                break

        return results

    def _calculate_execution_order(self) -> List[str]:
        """Calculate the order of workflow execution based on dependencies."""
        # Topological sort implementation
        visited = set()
        order = []

        def visit(workflow_name: str):
            if workflow_name in visited:
                return

            visited.add(workflow_name)

            for dependency in self.dependencies.get(workflow_name, []):
                visit(dependency)

            order.append(workflow_name)

        for workflow_name in self.workflows:
            visit(workflow_name)

        return order
```

### Plugin System

```python
import importlib
import pkgutil
from typing import Type

class WorkflowPluginManager:
    """
    Manages workflow plugins for dynamic workflow type discovery.
    """

    def __init__(self):
        self.registered_workflows = {}
        self.plugin_paths = ['workflows.definitions', 'workflows.plugins']

    def discover_workflows(self) -> Dict[str, Type[BaseWorkflow]]:
        """Discover all available workflow types."""
        for plugin_path in self.plugin_paths:
            self._scan_package(plugin_path)

        return self.registered_workflows

    def register_workflow(self, workflow_type: str, workflow_class: Type[BaseWorkflow]):
        """Register a workflow type."""
        self.registered_workflows[workflow_type] = workflow_class

    def create_workflow(self, workflow_type: str, config: WorkflowConfig) -> BaseWorkflow:
        """Create a workflow instance of the specified type."""
        if workflow_type not in self.registered_workflows:
            raise ValueError(f"Unknown workflow type: {workflow_type}")

        workflow_class = self.registered_workflows[workflow_type]
        return workflow_class(config)

    def _scan_package(self, package_name: str):
        """Scan a package for workflow classes."""
        try:
            package = importlib.import_module(package_name)

            for _, module_name, _ in pkgutil.iter_modules(package.__path__):
                module = importlib.import_module(f"{package_name}.{module_name}")

                # Look for workflow classes
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)

                    if (isinstance(attr, type) and
                        issubclass(attr, BaseWorkflow) and
                        attr != BaseWorkflow):

                        # Determine workflow type from class
                        workflow_type = self._determine_workflow_type(attr)
                        if workflow_type:
                            self.register_workflow(workflow_type, attr)

        except ImportError:
            pass  # Package not available

    def _determine_workflow_type(self, workflow_class: Type[BaseWorkflow]) -> Optional[str]:
        """Determine workflow type from class name or attributes."""
        class_name = workflow_class.__name__.lower()

        # Map class names to workflow types
        type_mappings = {
            'specworkflow': 'spec',
            'testfixworkflow': 'test-fix',
            'typefixworkflow': 'type-fix',
            'buildfixworkflow': 'build-fix',
            'databasemigrationworkflow': 'db-migration'
        }

        for pattern, workflow_type in type_mappings.items():
            if pattern in class_name:
                return workflow_type

        return None
```

## Best Practices

### 1. Error Handling and Recovery

```python
class ResilientWorkflow(BaseWorkflow):
    """Example of a workflow with robust error handling."""

    def execute_with_retry(self, max_retries: int = 3) -> bool:
        """Execute workflow with automatic retry on failures."""
        for attempt in range(max_retries + 1):
            try:
                success = self._execute_workflow()
                if success:
                    return True

                if attempt < max_retries:
                    logger.warning(f"Workflow attempt {attempt + 1} failed, retrying...")
                    time.sleep(self.config.custom_settings.get('retry_delay', 5))

            except Exception as e:
                logger.error(f"Workflow attempt {attempt + 1} failed with error: {e}")

                if attempt < max_retries:
                    time.sleep(self.config.custom_settings.get('retry_delay', 5))
                else:
                    raise

        return False

    def _execute_workflow(self) -> bool:
        """Execute the workflow with comprehensive error handling."""
        try:
            # Preparation phase
            if not self.prepare_workflow_session():
                raise RuntimeError("Workflow preparation failed")

            # Execution phase with timeout
            with self._execution_timeout():
                result = self._run_workflow()

            return result

        except TimeoutError:
            logger.error("Workflow execution timed out")
            return False
        except Exception as e:
            logger.error(f"Workflow execution failed: {e}")
            return False
        finally:
            self.cleanup_workflow_session()

    @contextmanager
    def _execution_timeout(self):
        """Context manager for workflow execution timeout."""
        import signal

        def timeout_handler(signum, frame):
            raise TimeoutError("Workflow execution timed out")

        timeout = self.config.custom_settings.get('execution_timeout', 1800)

        old_handler = signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(timeout)

        try:
            yield
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)
```

### 2. Testing Custom Workflows

```python
import pytest
from unittest.mock import Mock, patch
from pathlib import Path

class TestDatabaseMigrationWorkflow:
    """Comprehensive tests for custom workflow."""

    @pytest.fixture
    def workflow_config(self):
        """Create test workflow configuration."""
        return WorkflowConfig(
            workflow_type='db-migration',
            project_path=Path('/tmp/test-project'),
            custom_settings={
                'migration': {
                    'database_url': 'postgresql://test:test@localhost/test',
                    'migration_tool': 'alembic',
                    'target_version': 'latest'
                }
            }
        )

    @pytest.fixture
    def workflow(self, workflow_config):
        """Create test workflow instance."""
        return DatabaseMigrationWorkflow(workflow_config)

    def test_workflow_initialization(self, workflow):
        """Test workflow initializes correctly."""
        assert workflow.config.workflow_type == 'db-migration'
        assert workflow.migration_detector is None  # Not initialized until prepare

    def test_config_validation(self, workflow_config):
        """Test configuration validation."""
        # Test valid configuration
        workflow = DatabaseMigrationWorkflow(workflow_config)
        workflow.validate_config()  # Should not raise

        # Test invalid configuration
        invalid_config = workflow_config
        del invalid_config.custom_settings['migration']['database_url']

        with pytest.raises(ValueError, match="database_url is required"):
            workflow = DatabaseMigrationWorkflow(invalid_config)
            workflow.validate_config()

    def test_prompt_generation(self, workflow):
        """Test prompt generation."""
        prompt = workflow.get_workflow_prompt()

        assert "Database Migration Workflow" in prompt
        assert "alembic" in prompt
        assert "latest" in prompt

    @patch('subprocess.run')
    def test_migration_tool_verification(self, mock_run, workflow):
        """Test migration tool availability check."""
        # Mock successful tool check
        mock_run.return_value.returncode = 0

        result = workflow._verify_migration_tool_available('alembic')
        assert result is True

        # Mock failed tool check
        mock_run.return_value.returncode = 1

        result = workflow._verify_migration_tool_available('alembic')
        assert result is False

    def test_completion_detection(self, workflow):
        """Test completion detection logic."""
        # Setup workflow for testing
        workflow.prepare_workflow_session()

        # Test positive completion
        completion_output = {
            'event': 'stream',
            'payload': {
                'content': [
                    {'type': 'text', 'text': 'running upgrade successfully upgraded migration complete'}
                ]
            }
        }

        assert workflow.detect_completion(completion_output) is True

        # Test negative completion
        no_completion_output = {
            'event': 'stream',
            'payload': {
                'content': [
                    {'type': 'text', 'text': 'migration in progress'}
                ]
            }
        }

        workflow.completed = False  # Reset state
        assert workflow.detect_completion(no_completion_output) is False

    @patch.object(DatabaseMigrationWorkflow, '_verify_migration_tool_available')
    @patch.object(DatabaseMigrationWorkflow, '_check_database_connectivity')
    def test_session_preparation(self, mock_db_check, mock_tool_check, workflow):
        """Test workflow session preparation."""
        mock_tool_check.return_value = True
        mock_db_check.return_value = True

        result = workflow.prepare_workflow_session()

        assert result is True
        assert workflow.migration_detector is not None
        assert workflow.verification_detector is not None

    def test_execution_options(self, workflow):
        """Test execution options generation."""
        options = workflow.get_execution_options()

        assert options['cwd'] == str(workflow.config.project_path)
        assert options['exit_on_complete'] is True
        assert options['permission_mode'] == 'bypassPermissions'
```

### 3. Documentation Standards

```python
class WellDocumentedWorkflow(BaseWorkflow):
    """
    Example workflow demonstrating comprehensive documentation standards.

    This workflow serves as a template for documenting custom workflows
    with clear descriptions, usage examples, and implementation details.

    Attributes:
        custom_detector: Custom completion detector for this workflow
        state_tracker: Tracks workflow execution state

    Example:
        Create and execute a well-documented workflow:

        >>> config = WorkflowConfig(
        ...     workflow_type='well-documented',
        ...     project_path=Path('/path/to/project')
        ... )
        >>> workflow = WellDocumentedWorkflow(config)
        >>> engine = WorkflowEngine(config.project_path)
        >>> success = await engine.execute_workflow(workflow)
        >>> print(f"Workflow completed: {success}")

    Note:
        This workflow is designed for demonstration purposes and should
        be adapted for specific use cases.

    See Also:
        BaseWorkflow: The base class for all workflows
        WorkflowEngine: The execution engine for workflows
    """

    def get_workflow_prompt(self) -> str:
        """
        Generate the prompt for Claude Code execution.

        This method creates a detailed prompt that instructs Claude Code
        on the specific tasks to perform for this workflow type.

        Returns:
            str: Formatted prompt text for Claude Code execution

        Raises:
            ValueError: If required configuration is missing

        Example:
            >>> workflow = WellDocumentedWorkflow(config)
            >>> prompt = workflow.get_workflow_prompt()
            >>> print(prompt[:100] + "...")
            Well-documented workflow for demonstrating best practices...
        """
        # Implementation details...
        pass
```

## Examples

### Complete Custom Workflow Example

This example shows a complete implementation of a custom workflow for API testing:

```python
# workflows/definitions/api_testing_workflow.py
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging
import json

from ..core.base_workflow import BaseWorkflow, WorkflowConfig
from ..core.completion_detector import MultiStageDetector

logger = logging.getLogger(__name__)


class ApiTestingWorkflow(BaseWorkflow):
    """
    Workflow for automated API testing with comprehensive test coverage.

    This workflow automates the process of testing REST APIs including:
    - Contract testing
    - Integration testing
    - Performance testing
    - Security testing
    """

    def __init__(self, config: WorkflowConfig):
        super().__init__(config)
        self.test_stages = [
            {
                'name': 'API Discovery',
                'patterns': ['api endpoints discovered', 'swagger documentation loaded'],
                'require_all': False
            },
            {
                'name': 'Contract Testing',
                'patterns': ['contract tests passed', 'schema validation successful'],
                'require_all': True
            },
            {
                'name': 'Integration Testing',
                'patterns': ['integration tests completed', 'all endpoints tested'],
                'require_all': False
            },
            {
                'name': 'Performance Testing',
                'patterns': ['performance tests completed', 'latency within limits'],
                'require_all': True
            }
        ]

        self.multi_stage_detector = MultiStageDetector(self.test_stages)

    def validate_config(self) -> None:
        super().validate_config()

        api_config = self.config.custom_settings.get('api_testing', {})

        if not api_config.get('base_url'):
            raise ValueError("base_url is required for API testing")

        if not api_config.get('test_framework'):
            api_config['test_framework'] = 'postman'  # Default

        supported_frameworks = ['postman', 'newman', 'pytest', 'jest']
        if api_config['test_framework'] not in supported_frameworks:
            raise ValueError(f"Unsupported test framework: {api_config['test_framework']}")

    def get_workflow_prompt(self) -> str:
        api_config = self.config.custom_settings.get('api_testing', {})
        base_url = api_config.get('base_url')
        test_framework = api_config.get('test_framework', 'postman')

        return f"""API Testing Workflow

Test the API comprehensively using {test_framework}.

API Configuration:
- Base URL: {base_url}
- Test Framework: {test_framework}
- Environment: {api_config.get('environment', 'testing')}

Testing Stages:

1. API Discovery
   - Load API documentation (OpenAPI/Swagger)
   - Identify all available endpoints
   - Understand request/response schemas

2. Contract Testing
   - Validate request/response schemas
   - Test required/optional fields
   - Verify data types and formats

3. Integration Testing
   - Test all CRUD operations
   - Verify business logic flows
   - Test error handling and edge cases

4. Performance Testing
   - Measure response times
   - Test concurrent requests
   - Identify performance bottlenecks

Requirements:
- All tests must pass
- Performance must meet SLA requirements
- Security vulnerabilities must be identified
- Generate comprehensive test report

Complete when all testing stages are finished successfully."""

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        completion_detected = self.multi_stage_detector.detect_completion(output_data)

        if completion_detected:
            progress = self.multi_stage_detector.get_progress_info()
            logger.info(f"API testing workflow completed. Progress: {progress}")
            self.completed = True

        return completion_detected

    def get_execution_options(self) -> Dict[str, Any]:
        return {
            "cwd": str(self.config.project_path),
            "exit_on_complete": True,
            "permission_mode": "bypassPermissions",
            "timeout": self.config.custom_settings.get('api_testing', {}).get('timeout', 2400)
        }

    def prepare_workflow_session(self) -> bool:
        try:
            api_config = self.config.custom_settings.get('api_testing', {})

            # Verify test framework is available
            if not self._verify_test_framework(api_config['test_framework']):
                return False

            # Check API connectivity
            if not self._check_api_connectivity(api_config['base_url']):
                return False

            logger.info("API testing workflow preparation completed")
            return True

        except Exception as e:
            logger.error(f"API testing workflow preparation failed: {e}")
            return False

    def _verify_test_framework(self, framework: str) -> bool:
        """Verify the testing framework is available."""
        import subprocess

        framework_commands = {
            'postman': ['newman', '--version'],
            'newman': ['newman', '--version'],
            'pytest': ['pytest', '--version'],
            'jest': ['jest', '--version']
        }

        command = framework_commands.get(framework)
        if not command:
            return False

        try:
            result = subprocess.run(command, capture_output=True, timeout=10)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def _check_api_connectivity(self, base_url: str) -> bool:
        """Check if the API is accessible."""
        try:
            import requests
            response = requests.get(f"{base_url}/health", timeout=10)
            return response.status_code == 200
        except:
            # If health endpoint doesn't exist, try base URL
            try:
                response = requests.get(base_url, timeout=10)
                return response.status_code < 500
            except:
                return False

    def cleanup_workflow_session(self) -> None:
        if self.completed:
            logger.info("✅ API testing workflow completed successfully")

            # Generate test summary
            progress = self.multi_stage_detector.get_progress_info()
            logger.info(f"Test stages completed: {progress['completed_stage_names']}")
        else:
            logger.info("🔄 API testing workflow session ended")


# Factory function
def create_api_testing_workflow(
    project_path: Path,
    base_url: str,
    test_framework: str = 'postman',
    **kwargs
) -> ApiTestingWorkflow:
    """Create an API testing workflow instance."""

    api_config = {
        'base_url': base_url,
        'test_framework': test_framework,
        'environment': kwargs.get('environment', 'testing'),
        'timeout': kwargs.get('timeout', 2400)
    }

    config = WorkflowConfig(
        workflow_type='api-testing',
        project_path=project_path,
        max_cycles=kwargs.get('max_cycles', 8),
        custom_settings={'api_testing': api_config},
        debug_options=kwargs.get('debug_options', {})
    )

    return ApiTestingWorkflow(config)

# Usage example
if __name__ == "__main__":
    # Example usage
    workflow = create_api_testing_workflow(
        project_path=Path("/path/to/api/project"),
        base_url="https://api.example.com",
        test_framework="postman",
        environment="staging"
    )

    # Execute workflow (in practice, this would be done through the engine)
    prompt = workflow.get_workflow_prompt()
    print(prompt)
```

This comprehensive guide provides all the information needed to extend the workflow system with custom functionality while maintaining the system's architectural principles and quality standards.