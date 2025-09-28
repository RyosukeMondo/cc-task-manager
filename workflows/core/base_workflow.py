#!/usr/bin/env python3
"""
Base Workflow System Infrastructure

This module provides the foundational abstract base class and configuration
management for the pluggable workflow system. It establishes the template
method pattern for workflow execution and standardized configuration handling.

Classes:
    BaseWorkflow: Abstract base class defining the workflow interface
    WorkflowConfig: Dataclass for workflow configuration management

The design follows the FR1 requirement for workflow abstraction, providing
clear extension points for custom workflow implementations while maintaining
backward compatibility with existing automation patterns.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from pathlib import Path


@dataclass
class WorkflowConfig:
    """
    Configuration management for workflow system.

    Provides type-safe configuration handling with validation and default values.
    Supports various workflow types with their specific parameters.

    Attributes:
        workflow_type (str): Type of workflow (e.g., 'spec', 'test-fix', 'type-fix')
        project_path (Path): Path to the target project directory
        spec_name (Optional[str]): Name of specification for spec workflows
        max_cycles (int): Maximum number of execution cycles before stopping
        max_session_time (int): Maximum session duration in seconds
        test_command (Optional[str]): Command to run tests for test-fix workflows
        type_check_command (Optional[str]): Command for type checking
        build_command (Optional[str]): Command for building the project
        completion_patterns (List[str]): Text patterns indicating completion
        debug_options (Dict[str, Any]): Debug configuration options
        environment_overrides (Dict[str, str]): Environment variable overrides
        custom_settings (Dict[str, Any]): Workflow-specific custom settings
    """

    # Core configuration
    workflow_type: str
    project_path: Path

    # Workflow-specific settings
    spec_name: Optional[str] = None
    max_cycles: int = 10
    max_session_time: int = 1800  # 30 minutes

    # Command configurations for different workflow types
    test_command: Optional[str] = None
    type_check_command: Optional[str] = None
    build_command: Optional[str] = None

    # Completion detection configuration
    completion_patterns: List[str] = field(default_factory=list)

    # Debug and environment configuration
    debug_options: Dict[str, Any] = field(default_factory=dict)
    environment_overrides: Dict[str, str] = field(default_factory=dict)

    # Extension point for workflow-specific settings
    custom_settings: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """
        Validate configuration after initialization.

        Ensures project path is resolved and required fields are present
        based on workflow type.

        Raises:
            ValueError: If configuration is invalid
            FileNotFoundError: If project path doesn't exist
        """
        # Resolve and validate project path
        self.project_path = Path(self.project_path).resolve()
        if not self.project_path.exists():
            raise FileNotFoundError(f"Project path does not exist: {self.project_path}")

        # Validate workflow type specific requirements
        self._validate_workflow_requirements()

        # Set default completion patterns if none provided
        if not self.completion_patterns:
            self.completion_patterns = self._get_default_completion_patterns()

        # Set default debug options if none provided
        if not self.debug_options:
            self.debug_options = self._get_default_debug_options()

    def _validate_workflow_requirements(self) -> None:
        """
        Validate workflow-specific configuration requirements.

        Raises:
            ValueError: If required configuration is missing for workflow type
        """
        if self.workflow_type == 'spec' and not self.spec_name:
            raise ValueError("spec_name is required for spec workflow type")

        if self.workflow_type == 'test-fix' and not self.test_command:
            # Set default test command if not provided
            self.test_command = self._detect_test_command()

        if self.workflow_type == 'type-fix' and not self.type_check_command:
            # Set default type check command if not provided
            self.type_check_command = self._detect_type_check_command()

        if self.workflow_type == 'build-fix' and not self.build_command:
            # Set default build command if not provided
            self.build_command = self._detect_build_command()

    def _detect_test_command(self) -> str:
        """
        Auto-detect appropriate test command for the project.

        Returns:
            str: Detected test command
        """
        # Check for common test configurations
        if (self.project_path / "package.json").exists():
            return "npm test"
        elif (self.project_path / "pytest.ini").exists() or \
             (self.project_path / "pyproject.toml").exists():
            return "pytest"
        elif (self.project_path / "Cargo.toml").exists():
            return "cargo test"
        else:
            return "npm test"  # Default fallback

    def _detect_type_check_command(self) -> str:
        """
        Auto-detect appropriate type checking command for the project.

        Returns:
            str: Detected type check command
        """
        # Check for TypeScript/JavaScript projects
        if (self.project_path / "tsconfig.json").exists():
            return "npx tsc --noEmit"
        # Check for Python projects with mypy
        elif (self.project_path / "mypy.ini").exists() or \
             any((self.project_path / "pyproject.toml").read_text().__contains__("mypy")
                 if (self.project_path / "pyproject.toml").exists() else False):
            return "mypy ."
        else:
            return "npx tsc --noEmit"  # Default fallback

    def _detect_build_command(self) -> str:
        """
        Auto-detect appropriate build command for the project.

        Returns:
            str: Detected build command
        """
        # Check for common build configurations
        if (self.project_path / "package.json").exists():
            return "npm run build"
        elif (self.project_path / "Cargo.toml").exists():
            return "cargo build"
        elif (self.project_path / "Makefile").exists():
            return "make"
        else:
            return "npm run build"  # Default fallback

    def _get_default_completion_patterns(self) -> List[str]:
        """
        Get default completion patterns based on workflow type.

        Returns:
            List[str]: Default completion patterns
        """
        if self.workflow_type == 'spec':
            return [
                "specification is fully implemented",
                "all tasks are marked as completed",
                "all tasks are completed (`[x]`)",
                "specification completed",
                "0 pending tasks"
            ]
        elif self.workflow_type == 'test-fix':
            return [
                "all tests passing",
                "test suite completed successfully",
                "0 failing tests",
                "tests passed"
            ]
        elif self.workflow_type == 'type-fix':
            return [
                "no type errors",
                "type checking successful",
                "found 0 errors",
                "type check passed"
            ]
        elif self.workflow_type == 'build-fix':
            return [
                "build successful",
                "compilation completed",
                "build completed successfully",
                "no build errors"
            ]
        else:
            return ["completed successfully"]

    def _get_default_debug_options(self) -> Dict[str, Any]:
        """
        Get default debug configuration options.

        Returns:
            Dict[str, Any]: Default debug options
        """
        return {
            'show_raw_data': False,
            'show_payload_structure': False,
            'show_content_analysis': False,
            'show_tool_details': True,
            'show_stream_metadata': False,
            'show_all_events': False,
            'truncate_long_content': True,
            'max_content_length': 500
        }

    def get_setting(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration setting with fallback to default.

        Args:
            key (str): Configuration key to retrieve
            default (Any): Default value if key not found

        Returns:
            Any: Configuration value or default
        """
        # Check custom settings first
        if key in self.custom_settings:
            return self.custom_settings[key]

        # Check standard attributes
        return getattr(self, key, default)

    def update_setting(self, key: str, value: Any) -> None:
        """
        Update a configuration setting.

        Args:
            key (str): Configuration key to update
            value (Any): New value for the setting
        """
        if hasattr(self, key):
            setattr(self, key, value)
        else:
            self.custom_settings[key] = value


class BaseWorkflow(ABC):
    """
    Abstract base class for all workflow implementations.

    Establishes the template method pattern for workflow execution with
    standardized lifecycle methods and extension points. Concrete workflows
    implement the abstract methods to define their specific behavior.

    The workflow lifecycle follows these phases:
    1. Initialization and validation
    2. Prompt generation for Claude Code
    3. Execution monitoring and control
    4. Completion detection and cleanup

    Attributes:
        config (WorkflowConfig): Configuration for this workflow instance
        session_active (bool): Whether a session is currently active
        completed (bool): Whether the workflow has completed successfully
    """

    def __init__(self, config: WorkflowConfig):
        """
        Initialize the workflow with configuration.

        Args:
            config (WorkflowConfig): Workflow configuration

        Raises:
            ValueError: If configuration is invalid for this workflow type
        """
        self.config = config
        self.session_active = False
        self.completed = False

        # Validate that this workflow can handle the configured type
        self.validate_config()

    def validate_config(self) -> None:
        """
        Validate that the configuration is appropriate for this workflow.

        Base implementation performs basic validation. Subclasses should
        override to add workflow-specific validation.

        Raises:
            ValueError: If configuration is invalid
        """
        if not isinstance(self.config, WorkflowConfig):
            raise ValueError("config must be an instance of WorkflowConfig")

        if not self.config.project_path.exists():
            raise ValueError(f"Project path does not exist: {self.config.project_path}")

    @abstractmethod
    def get_workflow_prompt(self) -> str:
        """
        Generate the prompt for Claude Code execution.

        This is the primary extension point for workflow implementations.
        The prompt should provide Claude with clear instructions for the
        specific workflow type and desired outcomes.

        Returns:
            str: Formatted prompt for Claude Code
        """
        pass

    @abstractmethod
    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect if the workflow has completed successfully.

        Analyzes Claude Code output to determine if the workflow objectives
        have been achieved. Implementation should check for workflow-specific
        completion indicators.

        Args:
            output_data (Dict[str, Any]): Output data from Claude Code session

        Returns:
            bool: True if workflow is complete, False otherwise
        """
        pass

    def get_execution_options(self) -> Dict[str, Any]:
        """
        Get execution options for Claude Code session.

        Base implementation provides standard options. Subclasses can
        override to customize session behavior.

        Returns:
            Dict[str, Any]: Options for Claude Code execution
        """
        return {
            "cwd": str(self.config.project_path),
            "exit_on_complete": True,
            "permission_mode": "bypassPermissions"
        }

    def prepare_session(self) -> bool:
        """
        Prepare for workflow execution.

        Performs any necessary setup before starting the Claude Code session.
        Base implementation handles common preparation tasks.

        Returns:
            bool: True if preparation successful, False otherwise
        """
        try:
            # Validate project state
            if not self.config.project_path.is_dir():
                raise ValueError(f"Project path is not a directory: {self.config.project_path}")

            # Reset completion state
            self.completed = False

            # Workflow-specific preparation
            return self.prepare_workflow_session()

        except Exception as e:
            print(f"Session preparation failed: {e}")
            return False

    def prepare_workflow_session(self) -> bool:
        """
        Workflow-specific session preparation.

        Subclasses can override this method to perform workflow-specific
        preparation tasks before execution begins.

        Returns:
            bool: True if preparation successful, False otherwise
        """
        return True

    def cleanup_session(self) -> None:
        """
        Clean up after workflow execution.

        Performs cleanup tasks after the Claude Code session ends.
        Base implementation handles common cleanup.
        """
        self.session_active = False
        self.cleanup_workflow_session()

    def cleanup_workflow_session(self) -> None:
        """
        Workflow-specific session cleanup.

        Subclasses can override this method to perform workflow-specific
        cleanup tasks after execution completes.
        """
        pass

    def get_status_info(self) -> Dict[str, Any]:
        """
        Get current workflow status information.

        Provides information about the workflow state for monitoring
        and debugging purposes.

        Returns:
            Dict[str, Any]: Status information dictionary
        """
        return {
            "workflow_type": self.config.workflow_type,
            "project_path": str(self.config.project_path),
            "session_active": self.session_active,
            "completed": self.completed,
            "max_cycles": self.config.max_cycles,
            "max_session_time": self.config.max_session_time
        }

    def __str__(self) -> str:
        """String representation of the workflow."""
        return f"{self.__class__.__name__}(type={self.config.workflow_type}, " \
               f"project={self.config.project_path.name})"

    def __repr__(self) -> str:
        """Detailed string representation of the workflow."""
        return f"{self.__class__.__name__}(" \
               f"workflow_type='{self.config.workflow_type}', " \
               f"project_path='{self.config.project_path}', " \
               f"session_active={self.session_active}, " \
               f"completed={self.completed})"