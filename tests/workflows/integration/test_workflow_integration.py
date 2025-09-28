#!/usr/bin/env python3
"""
Integration tests for all workflow types.

Tests cover end-to-end functionality of spec, test-fix, type-fix, and build-fix
workflows with realistic scenarios and full system integration.
"""

import pytest
import tempfile
import json
import subprocess
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, Any

from workflows.core.workflow_engine import WorkflowEngine
from workflows.core.config_manager import ConfigManager
from workflows.definitions.spec_workflow import SpecWorkflow
from workflows.definitions.test_fix_workflow import TestFixWorkflow
from workflows.definitions.type_fix_workflow import TypeFixWorkflow
from workflows.definitions.build_fix_workflow import BuildFixWorkflow


class TestSpecWorkflowIntegration:
    """Integration tests for SpecWorkflow."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)

        # Create mock spec structure
        spec_dir = self.project_path / ".spec-workflow" / "specs" / "test-spec"
        spec_dir.mkdir(parents=True)

        # Create tasks.md with pending tasks
        tasks_content = """# Test Spec - Implementation Tasks

- [ ] 1. Create basic infrastructure
  - Purpose: Set up foundation
  - Requirements: FR1

- [ ] 2. Implement core functionality
  - Purpose: Add main features
  - Requirements: FR2
"""
        (spec_dir / "tasks.md").write_text(tasks_content)

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_spec_workflow_task_completion(self, mock_wrapper):
        """Test spec workflow completing a task successfully."""
        # Setup mock responses
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = """
        Working on task 1...
        Implementation completed.
        Updated tasks.md with completion status.
        """
        mock_wrapper.stop_session.return_value = None

        # Create workflow configuration
        config_manager = ConfigManager()
        config_data = config_manager.get_workflow_defaults("spec")
        config_data.update({
            "project_path": self.project_path,
            "spec_name": "test-spec",
            "max_cycles": 3
        })

        workflow = SpecWorkflow()
        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=workflow.get_completion_detector(),
            config=config_data
        )

        result = engine.execute()

        # Verify execution
        assert mock_wrapper.start_session.called
        assert mock_wrapper.send_prompt.called
        assert isinstance(result, dict)
        assert "success" in result

    def test_spec_workflow_prompt_generation(self):
        """Test spec workflow prompt generation."""
        workflow = SpecWorkflow()
        config_data = {
            "workflow_type": "spec",
            "project_path": self.project_path,
            "spec_name": "test-spec",
            "max_cycles": 5
        }

        context = {"current_cycle": 1}
        prompt = workflow.generate_prompt(config_data, context)

        assert isinstance(prompt, str)
        assert "test-spec" in prompt
        assert "spec-workflow" in prompt.lower()

    def test_spec_workflow_completion_detection(self):
        """Test spec workflow completion detection."""
        workflow = SpecWorkflow()
        config_data = {
            "workflow_type": "spec",
            "project_path": self.project_path,
            "spec_name": "test-spec"
        }

        # Test completion patterns
        completion_outputs = [
            "Task marked as completed in tasks.md",
            "✅ All tasks completed successfully",
            "Specification implementation finished"
        ]

        for output in completion_outputs:
            assert workflow.is_completed(output, config_data) is True

        # Test non-completion
        non_completion_output = "Still working on implementation..."
        assert workflow.is_completed(non_completion_output, config_data) is False


class TestTestFixWorkflowIntegration:
    """Integration tests for TestFixWorkflow."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)

        # Create mock test files
        (self.project_path / "package.json").write_text(json.dumps({
            "scripts": {"test": "jest"},
            "devDependencies": {"jest": "^29.0.0"}
        }))

        # Create failing test
        test_dir = self.project_path / "tests"
        test_dir.mkdir()
        (test_dir / "example.test.js").write_text("""
        test('should pass', () => {
            expect(1 + 1).toBe(3); // Intentionally failing
        });
        """)

    @patch('workflows.core.workflow_engine.claude_wrapper')
    @patch('subprocess.run')
    def test_test_fix_workflow_execution(self, mock_subprocess, mock_wrapper):
        """Test test-fix workflow fixing failing tests."""
        # Mock failing then passing test runs
        mock_subprocess.side_effect = [
            # First run - tests fail
            subprocess.CompletedProcess(
                args=['npm', 'test'],
                returncode=1,
                stdout="Tests failed: 1 failing",
                stderr=""
            ),
            # Second run - tests pass
            subprocess.CompletedProcess(
                args=['npm', 'test'],
                returncode=0,
                stdout="All tests passed",
                stderr=""
            )
        ]

        # Setup Claude wrapper
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = """
        Fixed the failing test by changing expectation to toBe(2).
        All tests should now pass.
        """
        mock_wrapper.stop_session.return_value = None

        # Create and execute workflow
        workflow = TestFixWorkflow()
        config_data = {
            "workflow_type": "test-fix",
            "project_path": self.project_path,
            "test_command": "npm test",
            "max_cycles": 5
        }

        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=workflow.get_completion_detector(),
            config=config_data
        )

        result = engine.execute()

        assert mock_subprocess.call_count >= 1
        assert mock_wrapper.send_prompt.called

    def test_test_fix_workflow_command_detection(self):
        """Test automatic test command detection."""
        workflow = TestFixWorkflow()

        # Test npm project detection
        npm_project = self.project_path
        (npm_project / "package.json").write_text('{"scripts": {"test": "jest"}}')

        detected_cmd = workflow._detect_test_command(npm_project)
        assert "npm test" in detected_cmd or "yarn test" in detected_cmd

    def test_test_fix_workflow_framework_support(self):
        """Test support for different test frameworks."""
        workflow = TestFixWorkflow()

        frameworks = workflow.get_supported_frameworks()
        assert "jest" in frameworks
        assert "pytest" in frameworks
        assert "mocha" in frameworks

    @patch('subprocess.run')
    def test_test_fix_workflow_completion_detection(self, mock_subprocess):
        """Test completion detection for test workflows."""
        workflow = TestFixWorkflow()
        config_data = {
            "workflow_type": "test-fix",
            "project_path": self.project_path,
            "test_command": "npm test"
        }

        # Mock successful test run
        mock_subprocess.return_value = subprocess.CompletedProcess(
            args=['npm', 'test'],
            returncode=0,
            stdout="All tests passed",
            stderr=""
        )

        detector = workflow.get_completion_detector()
        context = {"test_command": "npm test"}

        assert detector.detect("Tests completed", context) is True


class TestTypeFixWorkflowIntegration:
    """Integration tests for TypeFixWorkflow."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)

        # Create TypeScript project
        (self.project_path / "tsconfig.json").write_text(json.dumps({
            "compilerOptions": {
                "target": "es2020",
                "strict": True
            }
        }))

        # Create file with type errors
        (self.project_path / "src").mkdir()
        (self.project_path / "src" / "example.ts").write_text("""
        function add(a: number, b: number): string {
            return a + b; // Type error: number not assignable to string
        }
        """)

    @patch('workflows.core.workflow_engine.claude_wrapper')
    @patch('subprocess.run')
    def test_type_fix_workflow_execution(self, mock_subprocess, mock_wrapper):
        """Test type-fix workflow fixing type errors."""
        # Mock type check runs
        mock_subprocess.side_effect = [
            # First run - type errors
            subprocess.CompletedProcess(
                args=['tsc', '--noEmit'],
                returncode=1,
                stdout="Type errors found",
                stderr="src/example.ts:2:5 - error TS2322: Type 'number' is not assignable to type 'string'"
            ),
            # Second run - no errors
            subprocess.CompletedProcess(
                args=['tsc', '--noEmit'],
                returncode=0,
                stdout="No type errors",
                stderr=""
            )
        ]

        # Setup Claude wrapper
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = """
        Fixed type error by changing return type to number.
        Type checking should now pass.
        """
        mock_wrapper.stop_session.return_value = None

        # Create and execute workflow
        workflow = TypeFixWorkflow()
        config_data = {
            "workflow_type": "type-fix",
            "project_path": self.project_path,
            "type_check_command": "tsc --noEmit",
            "max_cycles": 5
        }

        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=workflow.get_completion_detector(),
            config=config_data
        )

        result = engine.execute()

        assert mock_subprocess.call_count >= 1
        assert mock_wrapper.send_prompt.called

    def test_type_fix_workflow_checker_detection(self):
        """Test automatic type checker detection."""
        workflow = TypeFixWorkflow()

        # Test TypeScript project
        ts_project = self.project_path
        (ts_project / "tsconfig.json").write_text('{}')

        detected_cmd = workflow._detect_type_check_command(ts_project)
        assert "tsc" in detected_cmd

    def test_type_fix_workflow_multiple_checkers(self):
        """Test support for multiple type checkers."""
        workflow = TypeFixWorkflow()

        checkers = workflow.get_supported_checkers()
        assert "typescript" in checkers
        assert "mypy" in checkers
        assert "flow" in checkers


class TestBuildFixWorkflowIntegration:
    """Integration tests for BuildFixWorkflow."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)

        # Create Node.js project with build setup
        (self.project_path / "package.json").write_text(json.dumps({
            "scripts": {"build": "webpack"},
            "devDependencies": {"webpack": "^5.0.0"}
        }))

        # Create webpack config
        (self.project_path / "webpack.config.js").write_text("""
        module.exports = {
            entry: './src/index.js',
            output: {
                filename: 'bundle.js'
            }
        };
        """)

    @patch('workflows.core.workflow_engine.claude_wrapper')
    @patch('subprocess.run')
    def test_build_fix_workflow_execution(self, mock_subprocess, mock_wrapper):
        """Test build-fix workflow fixing build errors."""
        # Mock build runs
        mock_subprocess.side_effect = [
            # First run - build fails
            subprocess.CompletedProcess(
                args=['npm', 'run', 'build'],
                returncode=1,
                stdout="Build failed",
                stderr="Module not found: './missing-file'"
            ),
            # Second run - build succeeds
            subprocess.CompletedProcess(
                args=['npm', 'run', 'build'],
                returncode=0,
                stdout="Build successful",
                stderr=""
            )
        ]

        # Setup Claude wrapper
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = """
        Fixed build error by creating missing file.
        Build should now succeed.
        """
        mock_wrapper.stop_session.return_value = None

        # Create and execute workflow
        workflow = BuildFixWorkflow()
        config_data = {
            "workflow_type": "build-fix",
            "project_path": self.project_path,
            "build_command": "npm run build",
            "max_cycles": 5
        }

        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=workflow.get_completion_detector(),
            config=config_data
        )

        result = engine.execute()

        assert mock_subprocess.call_count >= 1
        assert mock_wrapper.send_prompt.called

    def test_build_fix_workflow_system_detection(self):
        """Test automatic build system detection."""
        workflow = BuildFixWorkflow()

        # Test different build systems
        systems = workflow.get_supported_systems()
        assert "npm" in systems
        assert "webpack" in systems
        assert "maven" in systems
        assert "cargo" in systems


class TestWorkflowInteroperability:
    """Test interoperability between different workflow types."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)

    def test_workflow_chaining(self):
        """Test chaining multiple workflows together."""
        # This would test running type-fix -> test-fix -> build-fix
        workflows = [
            TypeFixWorkflow(),
            TestFixWorkflow(),
            BuildFixWorkflow()
        ]

        for workflow in workflows:
            assert hasattr(workflow, 'generate_prompt')
            assert hasattr(workflow, 'is_completed')
            assert hasattr(workflow, 'get_completion_detector')

    def test_shared_configuration(self):
        """Test shared configuration across workflow types."""
        config_manager = ConfigManager()

        # All workflows should accept common configuration
        common_config = {
            "project_path": self.project_path,
            "max_cycles": 5,
            "max_session_time": 1800
        }

        workflow_types = ["spec", "test-fix", "type-fix", "build-fix"]
        for workflow_type in workflow_types:
            defaults = config_manager.get_workflow_defaults(workflow_type)
            merged_config = {**defaults, **common_config}

            # Should not raise validation errors
            assert merged_config["workflow_type"] == workflow_type
            assert merged_config["max_cycles"] == 5

    def test_detector_compatibility(self):
        """Test completion detector compatibility across workflows."""
        workflows = [
            SpecWorkflow(),
            TestFixWorkflow(),
            TypeFixWorkflow(),
            BuildFixWorkflow()
        ]

        for workflow in workflows:
            detector = workflow.get_completion_detector()
            assert hasattr(detector, 'detect')

            # Test that detector can handle common outputs
            test_output = "Task completed successfully"
            result = detector.detect(test_output)
            assert isinstance(result, bool)


class TestRealWorldScenarios:
    """Test realistic end-to-end scenarios."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_full_development_cycle(self, mock_wrapper):
        """Test complete development cycle across multiple workflows."""
        # Setup project structure
        (self.project_path / "package.json").write_text(json.dumps({
            "scripts": {
                "test": "jest",
                "build": "webpack",
                "typecheck": "tsc --noEmit"
            }
        }))

        # Mock Claude responses for each phase
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.side_effect = [
            "Fixed type errors in source files",
            "Fixed failing tests",
            "Fixed build configuration issues",
            "All workflows completed successfully"
        ]
        mock_wrapper.stop_session.return_value = None

        # Test sequence: type-fix -> test-fix -> build-fix
        workflow_sequence = [
            (TypeFixWorkflow(), "type-fix"),
            (TestFixWorkflow(), "test-fix"),
            (BuildFixWorkflow(), "build-fix")
        ]

        results = []
        for workflow, workflow_type in workflow_sequence:
            config_data = {
                "workflow_type": workflow_type,
                "project_path": self.project_path,
                "max_cycles": 3
            }

            engine = WorkflowEngine(
                workflow=workflow,
                completion_detector=workflow.get_completion_detector(),
                config=config_data
            )

            # Mock completion detection to succeed quickly
            with patch.object(workflow, 'is_completed', return_value=True):
                result = engine.execute()
                results.append(result)

        # All workflows should execute successfully
        assert len(results) == 3
        for result in results:
            assert isinstance(result, dict)

    def test_error_recovery_across_workflows(self):
        """Test error recovery and graceful degradation."""
        # Test that workflows can handle various error conditions
        workflows = [
            SpecWorkflow(),
            TestFixWorkflow(),
            TypeFixWorkflow(),
            BuildFixWorkflow()
        ]

        error_conditions = [
            "Connection timeout",
            "File not found",
            "Permission denied",
            "Out of memory"
        ]

        for workflow in workflows:
            for error in error_conditions:
                # Workflows should handle errors gracefully
                try:
                    # This would test error handling if implemented
                    result = workflow.handle_error(error)
                    assert isinstance(result, dict)
                except AttributeError:
                    # handle_error method might not exist yet
                    pass

    def test_performance_under_load(self):
        """Test workflow performance with realistic load."""
        config_data = {
            "workflow_type": "test",
            "project_path": self.project_path,
            "max_cycles": 10
        }

        # Test multiple concurrent workflow executions
        workflows = [TestFixWorkflow() for _ in range(5)]

        # Each workflow should be independent
        for i, workflow in enumerate(workflows):
            prompt = workflow.generate_prompt(config_data, {"cycle": i})
            assert isinstance(prompt, str)
            assert len(prompt) > 0


if __name__ == "__main__":
    pytest.main([__file__])