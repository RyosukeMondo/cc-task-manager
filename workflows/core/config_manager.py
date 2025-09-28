#!/usr/bin/env python3
"""
Configuration Management System

This module provides flexible configuration loading and management for the workflow
system. It supports multiple configuration formats (YAML/JSON), environment-specific
overrides, and validation to ensure robust configuration handling across all workflow types.

Classes:
    ConfigManager: Main configuration management class
    ConfigSource: Enumeration of configuration sources
    ConfigSchema: Base class for configuration validation

The implementation follows the FR5 requirement for flexible configuration system,
providing environment overrides and validation capabilities while maintaining
backward compatibility with existing configuration approaches.
"""

import os
import json
import yaml
from enum import Enum
from pathlib import Path
from typing import Dict, Any, Optional, Union, List
from dataclasses import dataclass, field
import logging

from .base_workflow import WorkflowConfig

logger = logging.getLogger(__name__)


class ConfigSource(Enum):
    """Configuration source types."""
    FILE = "file"
    ENVIRONMENT = "environment"
    DEFAULT = "default"
    OVERRIDE = "override"


@dataclass
class ConfigSchema:
    """
    Base class for configuration validation.

    Provides common validation patterns and error handling for
    different configuration schemas.
    """

    def validate(self) -> List[str]:
        """
        Validate configuration and return list of errors.

        Returns:
            List[str]: Validation error messages (empty if valid)
        """
        return []


@dataclass
class WorkflowDefaults:
    """Default configuration values for different workflow types."""

    # Spec workflow defaults
    spec: Dict[str, Any] = field(default_factory=lambda: {
        "max_cycles": 10,
        "max_session_time": 1800,  # 30 minutes
        "completion_patterns": [
            "specification is fully implemented",
            "all tasks are marked as completed",
            "all tasks are completed (`[x]`)",
            "specification completed",
            "0 pending tasks"
        ],
        "debug_options": {
            "show_raw_data": False,
            "show_payload_structure": False,
            "show_content_analysis": False,
            "show_tool_details": True,
            "show_stream_metadata": False,
            "show_all_events": False,
            "truncate_long_content": True,
            "max_content_length": 500
        }
    })

    # Test fix workflow defaults
    test_fix: Dict[str, Any] = field(default_factory=lambda: {
        "max_cycles": 15,
        "max_session_time": 2400,  # 40 minutes
        "test_command": "npm test",
        "completion_patterns": [
            "all tests passing",
            "test suite completed successfully",
            "0 failing tests",
            "tests passed"
        ],
        "custom_settings": {
            "retry_patterns": [
                "flaky test",
                "timeout",
                "network error"
            ]
        }
    })

    # Type fix workflow defaults
    type_fix: Dict[str, Any] = field(default_factory=lambda: {
        "max_cycles": 20,
        "max_session_time": 2400,  # 40 minutes
        "type_check_command": "npx tsc --noEmit",
        "completion_patterns": [
            "no type errors",
            "type checking successful",
            "found 0 errors",
            "type check passed"
        ],
        "custom_settings": {
            "incremental_check": True
        }
    })

    # Build fix workflow defaults
    build_fix: Dict[str, Any] = field(default_factory=lambda: {
        "max_cycles": 25,
        "max_session_time": 3600,  # 60 minutes
        "build_command": "npm run build",
        "completion_patterns": [
            "build successful",
            "compilation completed",
            "build completed successfully",
            "no build errors"
        ],
        "custom_settings": {
            "clean_build": False,
            "parallel_jobs": 1
        }
    })

    # Global defaults
    global_defaults: Dict[str, Any] = field(default_factory=lambda: {
        "debug_options": {
            "show_raw_data": False,
            "show_payload_structure": False,
            "show_content_analysis": False,
            "show_tool_details": True,
            "show_stream_metadata": False,
            "show_all_events": False,
            "truncate_long_content": True,
            "max_content_length": 500
        },
        "environment_overrides": {},
        "custom_settings": {}
    })


class ConfigManager:
    """
    Configuration management class for workflow system.

    Provides flexible configuration loading from multiple sources with
    environment overrides and validation. Supports YAML/JSON formats
    and maintains default configurations for all workflow types.

    Attributes:
        project_path (Path): Path to the project directory
        config_cache (Dict[str, Any]): Cached configuration data
        defaults (WorkflowDefaults): Default configuration values
        environment_prefix (str): Prefix for environment variable overrides
    """

    def __init__(self, project_path: Union[str, Path], environment_prefix: str = "WORKFLOW_"):
        """
        Initialize the configuration manager.

        Args:
            project_path (Union[str, Path]): Path to the project directory
            environment_prefix (str): Prefix for environment variable overrides

        Raises:
            FileNotFoundError: If project path doesn't exist
        """
        self.project_path = Path(project_path).resolve()
        if not self.project_path.exists():
            raise FileNotFoundError(f"Project path does not exist: {self.project_path}")

        self.config_cache: Dict[str, Any] = {}
        self.defaults = WorkflowDefaults()
        self.environment_prefix = environment_prefix

        # Configuration file search paths (in order of precedence)
        self.config_search_paths = [
            self.project_path / "workflows.yaml",
            self.project_path / "workflows.yml",
            self.project_path / "workflows.json",
            self.project_path / ".workflows.yaml",
            self.project_path / ".workflows.yml",
            self.project_path / ".workflows.json",
            self.project_path / "config" / "workflows.yaml",
            self.project_path / "config" / "workflows.yml",
            self.project_path / "config" / "workflows.json"
        ]

        logger.info(f"ConfigManager initialized for project: {self.project_path}")

    def load_workflow_config(self, workflow_type: str, **overrides) -> WorkflowConfig:
        """
        Load complete configuration for a specific workflow type.

        Combines default configuration, file-based configuration, environment
        overrides, and explicit overrides to create a WorkflowConfig instance.

        Args:
            workflow_type (str): Type of workflow (e.g., 'spec', 'test-fix')
            **overrides: Explicit configuration overrides

        Returns:
            WorkflowConfig: Complete workflow configuration

        Raises:
            ValueError: If workflow type is not supported or configuration is invalid
        """
        # Start with global defaults
        config_data = self.defaults.global_defaults.copy()

        # Add workflow-specific defaults
        workflow_defaults = self._get_workflow_defaults(workflow_type)
        config_data = self._deep_merge_config(config_data, workflow_defaults)

        # Load from configuration files
        file_config = self._load_file_config()
        if file_config:
            # Merge global file config
            if "global" in file_config:
                config_data = self._deep_merge_config(config_data, file_config["global"])

            # Merge workflow-specific file config
            if workflow_type in file_config:
                config_data = self._deep_merge_config(config_data, file_config[workflow_type])

        # Apply environment overrides
        env_config = self._load_environment_config(workflow_type)
        config_data = self._deep_merge_config(config_data, env_config)

        # Apply explicit overrides
        config_data = self._deep_merge_config(config_data, overrides)

        # Ensure required fields are present
        config_data["workflow_type"] = workflow_type
        config_data["project_path"] = self.project_path

        # Validate and create WorkflowConfig
        try:
            return WorkflowConfig(**config_data)
        except Exception as e:
            raise ValueError(f"Invalid configuration for workflow type '{workflow_type}': {e}")

    def _deep_merge_config(self, base: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep merge two configuration dictionaries.

        Args:
            base (Dict[str, Any]): Base configuration
            overlay (Dict[str, Any]): Configuration to overlay

        Returns:
            Dict[str, Any]: Merged configuration
        """
        result = base.copy()

        for key, value in overlay.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge_config(result[key], value)
            else:
                result[key] = value

        return result

    def _get_workflow_defaults(self, workflow_type: str) -> Dict[str, Any]:
        """
        Get default configuration for a specific workflow type.

        Args:
            workflow_type (str): Type of workflow

        Returns:
            Dict[str, Any]: Default configuration for the workflow type

        Raises:
            ValueError: If workflow type is not supported
        """
        # Normalize workflow type (handle variants)
        normalized_type = workflow_type.replace("-", "_")

        if hasattr(self.defaults, normalized_type):
            return getattr(self.defaults, normalized_type).copy()
        elif workflow_type in ["spec", "spec-workflow"]:
            return self.defaults.spec.copy()
        elif workflow_type in ["test-fix", "test_fix"]:
            return self.defaults.test_fix.copy()
        elif workflow_type in ["type-fix", "type_fix"]:
            return self.defaults.type_fix.copy()
        elif workflow_type in ["build-fix", "build_fix"]:
            return self.defaults.build_fix.copy()
        else:
            logger.warning(f"Unknown workflow type '{workflow_type}', using global defaults")
            return {}

    def _load_file_config(self) -> Optional[Dict[str, Any]]:
        """
        Load configuration from file sources.

        Searches for configuration files in the defined search paths and
        loads the first found file. Supports YAML and JSON formats.

        Returns:
            Optional[Dict[str, Any]]: Loaded configuration or None if no file found
        """
        # Check cache first
        cache_key = "file_config"
        if cache_key in self.config_cache:
            return self.config_cache[cache_key]

        config_data = None

        for config_path in self.config_search_paths:
            if config_path.exists():
                try:
                    config_data = self._load_config_file(config_path)
                    logger.info(f"Loaded configuration from: {config_path}")
                    break
                except Exception as e:
                    logger.warning(f"Failed to load config from {config_path}: {e}")
                    continue

        # Cache the result
        self.config_cache[cache_key] = config_data
        return config_data

    def _load_config_file(self, config_path: Path) -> Dict[str, Any]:
        """
        Load configuration from a specific file.

        Args:
            config_path (Path): Path to the configuration file

        Returns:
            Dict[str, Any]: Loaded configuration data

        Raises:
            ValueError: If file format is unsupported or invalid
        """
        with open(config_path, 'r') as f:
            content = f.read()

        if config_path.suffix.lower() in ['.yaml', '.yml']:
            return yaml.safe_load(content) or {}
        elif config_path.suffix.lower() == '.json':
            return json.loads(content)
        else:
            raise ValueError(f"Unsupported configuration file format: {config_path.suffix}")

    def _load_environment_config(self, workflow_type: str) -> Dict[str, Any]:
        """
        Load configuration from environment variables.

        Looks for environment variables with the configured prefix and
        converts them to configuration values. Supports nested configuration
        using double underscores (e.g., WORKFLOW_DEBUG__SHOW_RAW_DATA).

        Args:
            workflow_type (str): Type of workflow for workflow-specific overrides

        Returns:
            Dict[str, Any]: Configuration from environment variables
        """
        env_config = {}

        # Global environment overrides
        global_prefix = self.environment_prefix

        # Workflow-specific environment overrides
        workflow_prefix = f"{self.environment_prefix}{workflow_type.upper().replace('-', '_')}_"

        for key, value in os.environ.items():
            config_key = None

            # Check for workflow-specific override first
            if key.startswith(workflow_prefix):
                config_key = key[len(workflow_prefix):].lower()
            # Then check for global override (but not workflow-specific ones for other workflows)
            elif key.startswith(global_prefix):
                # Skip if this is a workflow-specific variable for a different workflow
                remaining_key = key[len(global_prefix):]
                if any(remaining_key.startswith(wf_type.upper().replace('-', '_') + '_')
                       for wf_type in self.get_supported_workflow_types()
                       if wf_type != workflow_type):
                    continue
                config_key = remaining_key.lower()

            if config_key:
                # Convert environment variable to config structure
                self._set_nested_config(env_config, config_key, self._parse_env_value(value))

        return env_config

    def _set_nested_config(self, config: Dict[str, Any], key: str, value: Any) -> None:
        """
        Set a nested configuration value using dot notation.

        Args:
            config (Dict[str, Any]): Configuration dictionary to update
            key (str): Configuration key (supports double underscore for nesting)
            value (Any): Value to set
        """
        # Convert double underscores to nested structure
        parts = key.split('__')

        current = config
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]

        current[parts[-1]] = value

    def _parse_env_value(self, value: str) -> Any:
        """
        Parse environment variable value to appropriate Python type.

        Args:
            value (str): Environment variable value

        Returns:
            Any: Parsed value (bool, int, float, or string)
        """
        # Handle boolean values
        if value.lower() in ('true', 'yes', '1', 'on'):
            return True
        elif value.lower() in ('false', 'no', '0', 'off'):
            return False

        # Handle numeric values
        try:
            if '.' in value:
                return float(value)
            else:
                return int(value)
        except ValueError:
            pass

        # Handle JSON values
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            pass

        # Return as string
        return value

    def get_supported_workflow_types(self) -> List[str]:
        """
        Get list of supported workflow types.

        Returns:
            List[str]: List of supported workflow type names
        """
        return ['spec', 'test-fix', 'type-fix', 'build-fix']

    def validate_config(self, config: WorkflowConfig) -> List[str]:
        """
        Validate a workflow configuration.

        Args:
            config (WorkflowConfig): Configuration to validate

        Returns:
            List[str]: Validation error messages (empty if valid)
        """
        errors = []

        # Validate workflow type
        if config.workflow_type not in self.get_supported_workflow_types():
            errors.append(f"Unsupported workflow type: {config.workflow_type}")

        # Validate project path
        if not config.project_path.exists():
            errors.append(f"Project path does not exist: {config.project_path}")
        elif not config.project_path.is_dir():
            errors.append(f"Project path is not a directory: {config.project_path}")

        # Validate workflow-specific requirements
        if config.workflow_type == 'spec' and not config.spec_name:
            errors.append("spec_name is required for spec workflow type")

        # Validate numeric constraints
        if config.max_cycles <= 0:
            errors.append("max_cycles must be positive")

        if config.max_session_time <= 0:
            errors.append("max_session_time must be positive")

        return errors

    def create_example_config(self, output_path: Optional[Path] = None) -> Path:
        """
        Create an example configuration file.

        Args:
            output_path (Optional[Path]): Path for the example config file

        Returns:
            Path: Path to the created example configuration file
        """
        if output_path is None:
            output_path = self.project_path / "workflows.example.yaml"

        example_config = {
            "global": {
                "debug_options": {
                    "show_tool_details": True,
                    "truncate_long_content": True,
                    "max_content_length": 500
                },
                "environment_overrides": {
                    "NODE_ENV": "development"
                }
            },
            "spec": {
                "max_cycles": 10,
                "max_session_time": 1800,
                "completion_patterns": [
                    "specification is fully implemented",
                    "all tasks are completed"
                ]
            },
            "test-fix": {
                "max_cycles": 15,
                "test_command": "npm test",
                "completion_patterns": [
                    "all tests passing",
                    "0 failing tests"
                ]
            },
            "type-fix": {
                "max_cycles": 20,
                "type_check_command": "npx tsc --noEmit",
                "incremental_check": True
            },
            "build-fix": {
                "max_cycles": 25,
                "build_command": "npm run build",
                "clean_build": False,
                "parallel_jobs": 1
            }
        }

        with open(output_path, 'w') as f:
            yaml.dump(example_config, f, default_flow_style=False, indent=2)

        logger.info(f"Created example configuration file: {output_path}")
        return output_path

    def clear_cache(self) -> None:
        """Clear the configuration cache."""
        self.config_cache.clear()
        logger.debug("Configuration cache cleared")

    def get_cache_info(self) -> Dict[str, Any]:
        """
        Get information about the configuration cache.

        Returns:
            Dict[str, Any]: Cache information and statistics
        """
        return {
            "cache_size": len(self.config_cache),
            "cached_keys": list(self.config_cache.keys()),
            "project_path": str(self.project_path),
            "search_paths": [str(p) for p in self.config_search_paths]
        }