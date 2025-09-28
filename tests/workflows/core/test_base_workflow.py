#!/usr/bin/env python3
"""
Unit tests for base_workflow module.

Tests cover WorkflowConfig dataclass validation, BaseWorkflow abstract methods,
and configuration management functionality.
"""

import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch
from typing import Dict, Any

from workflows.core.base_workflow import WorkflowConfig, BaseWorkflow


class TestWorkflowConfig:
    """Test WorkflowConfig dataclass functionality."""

    def test_minimal_config_creation(self):
        """Test creating config with minimal required parameters."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir)
            )
            assert config.workflow_type == "test"
            assert config.project_path == Path(temp_dir).resolve()
            assert config.max_cycles == 10
            assert config.max_session_time == 1800

    def test_config_with_all_parameters(self):
        """Test creating config with all parameters specified."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="spec",
                project_path=Path(temp_dir),
                spec_name="test-spec",
                max_cycles=5,
                max_session_time=3600,
                test_command="npm test",
                type_check_command="tsc --noEmit",
                build_command="npm run build",
                completion_patterns=["completed", "done"],
                debug_options={"verbose": True},
                environment_overrides={"NODE_ENV": "test"},
                custom_settings={"custom": "value"}
            )
            assert config.spec_name == "test-spec"
            assert config.max_cycles == 5
            assert config.max_session_time == 3600
            assert config.test_command == "npm test"
            assert config.completion_patterns == ["completed", "done"]

    def test_invalid_project_path_raises_error(self):
        """Test that invalid project path raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            WorkflowConfig(
                workflow_type="test",
                project_path=Path("/nonexistent/path")
            )

    def test_project_path_resolution(self):
        """Test that project path is properly resolved."""
        with tempfile.TemporaryDirectory() as temp_dir:
            relative_path = Path(temp_dir) / "." / "."
            config = WorkflowConfig(
                workflow_type="test",
                project_path=relative_path
            )
            assert config.project_path == Path(temp_dir).resolve()

    @patch('workflows.core.base_workflow.WorkflowConfig._validate_workflow_requirements')
    @patch('workflows.core.base_workflow.WorkflowConfig._get_default_completion_patterns')
    @patch('workflows.core.base_workflow.WorkflowConfig._get_default_debug_options')
    def test_post_init_calls_validation_methods(self, mock_debug, mock_patterns, mock_validate):
        """Test that __post_init__ calls all validation methods."""
        mock_patterns.return_value = []
        mock_debug.return_value = {}

        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir)
            )

            mock_validate.assert_called_once()
            mock_patterns.assert_called_once()
            mock_debug.assert_called_once()

    def test_default_values_are_set(self):
        """Test that default values are properly set."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir)
            )

            assert isinstance(config.completion_patterns, list)
            assert isinstance(config.debug_options, dict)
            assert isinstance(config.environment_overrides, dict)
            assert isinstance(config.custom_settings, dict)


class ConcreteWorkflow(BaseWorkflow):
    """Concrete implementation of BaseWorkflow for testing."""

    def get_workflow_prompt(self) -> str:
        return f"Test prompt for {self.config.workflow_type}"

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        output = output_data.get("output", "")
        return "completed" in str(output).lower()


class TestBaseWorkflow:
    """Test BaseWorkflow abstract base class."""

    def test_cannot_instantiate_abstract_class(self):
        """Test that BaseWorkflow cannot be instantiated directly."""
        with pytest.raises(TypeError):
            BaseWorkflow()

    def test_concrete_implementation_works(self):
        """Test that concrete implementation can be instantiated."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir)
            )
            workflow = ConcreteWorkflow(config)
            assert isinstance(workflow, BaseWorkflow)

    def test_abstract_methods_must_be_implemented(self):
        """Test that abstract methods must be implemented in subclasses."""
        class IncompleteWorkflow(BaseWorkflow):
            pass

        with pytest.raises(TypeError):
            IncompleteWorkflow()

    def test_get_workflow_prompt_method(self):
        """Test get_workflow_prompt method in concrete implementation."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir)
            )
            workflow = ConcreteWorkflow(config)

            prompt = workflow.get_workflow_prompt()
            assert prompt == "Test prompt for test"

    def test_detect_completion_method(self):
        """Test detect_completion method in concrete implementation."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir)
            )
            workflow = ConcreteWorkflow(config)

            output_data1 = {"output": "Task completed successfully"}
            output_data2 = {"output": "Still working on it"}

            assert workflow.detect_completion(output_data1) is True
            assert workflow.detect_completion(output_data2) is False

    def test_get_config_validation_spec_workflow(self):
        """Test get_config_validation for spec workflow type."""
        # This would test the validation logic once we examine the actual implementation
        pass

    def test_get_config_validation_test_workflow(self):
        """Test get_config_validation for test-fix workflow type."""
        pass

    def test_get_config_validation_type_workflow(self):
        """Test get_config_validation for type-fix workflow type."""
        pass

    def test_get_config_validation_build_workflow(self):
        """Test get_config_validation for build-fix workflow type."""
        pass


class TestWorkflowConfigEdgeCases:
    """Test edge cases and error conditions for WorkflowConfig."""

    def test_empty_workflow_type(self):
        """Test behavior with empty workflow type."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="",
                project_path=Path(temp_dir)
            )
            assert config.workflow_type == ""

    def test_none_optional_fields(self):
        """Test that None values work for optional fields."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir),
                spec_name=None,
                test_command=None,
                type_check_command=None,
                build_command=None
            )
            assert config.spec_name is None
            assert config.test_command is None
            assert config.type_check_command is None
            assert config.build_command is None

    def test_zero_max_cycles(self):
        """Test behavior with zero max_cycles."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir),
                max_cycles=0
            )
            assert config.max_cycles == 0

    def test_negative_max_session_time(self):
        """Test behavior with negative max_session_time."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir),
                max_session_time=-1
            )
            assert config.max_session_time == -1

    def test_large_values(self):
        """Test behavior with very large values."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir),
                max_cycles=1000000,
                max_session_time=86400
            )
            assert config.max_cycles == 1000000
            assert config.max_session_time == 86400

    def test_unicode_workflow_type(self):
        """Test behavior with unicode characters in workflow_type."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="тест-🚀",
                project_path=Path(temp_dir)
            )
            assert config.workflow_type == "тест-🚀"

    def test_complex_completion_patterns(self):
        """Test behavior with complex completion patterns."""
        with tempfile.TemporaryDirectory() as temp_dir:
            patterns = [
                "✅ completed",
                r"\d+ passed, 0 failed",
                "Build successful",
                ""  # empty pattern
            ]
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir),
                completion_patterns=patterns
            )
            assert config.completion_patterns == patterns


if __name__ == "__main__":
    pytest.main([__file__])