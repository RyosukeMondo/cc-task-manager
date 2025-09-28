#!/usr/bin/env python3
"""
Error handling and edge case tests for workflow system.

Tests cover error recovery, graceful degradation, input validation,
and edge cases across all workflow components.
"""

import pytest
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, Any
import threading
import time

from workflows.core.base_workflow import WorkflowConfig, BaseWorkflow
from workflows.core.workflow_engine import WorkflowEngine
from workflows.core.config_manager import ConfigManager
from workflows.core.completion_detector import (
    TextPatternDetector,
    CommandResultDetector,
    ToolResultDetector
)
from workflows.definitions.test_fix_workflow import TestFixWorkflow


class TestWorkflowConfigErrorHandling:
    """Test error handling in WorkflowConfig."""

    def test_invalid_project_path_types(self):
        """Test handling of invalid project path types."""
        with pytest.raises((TypeError, ValueError)):
            WorkflowConfig(
                workflow_type="test",
                project_path=None
            )

        with pytest.raises((TypeError, ValueError)):
            WorkflowConfig(
                workflow_type="test",
                project_path=123
            )

        with pytest.raises((TypeError, ValueError)):
            WorkflowConfig(
                workflow_type="test",
                project_path=["not", "a", "path"]
            )

    def test_nonexistent_project_path(self):
        """Test handling of nonexistent project paths."""
        with pytest.raises(FileNotFoundError):
            WorkflowConfig(
                workflow_type="test",
                project_path=Path("/completely/nonexistent/path")
            )

    def test_empty_workflow_type(self):
        """Test handling of empty or invalid workflow types."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Empty string should be allowed but may trigger validation
            config = WorkflowConfig(
                workflow_type="",
                project_path=Path(temp_dir)
            )
            assert config.workflow_type == ""

    def test_negative_max_cycles(self):
        """Test handling of negative max_cycles."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir),
                max_cycles=-1
            )
            # Should accept but may be validated later
            assert config.max_cycles == -1

    def test_invalid_completion_patterns(self):
        """Test handling of invalid completion patterns."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Non-list completion patterns
            with pytest.raises((TypeError, ValueError)):
                WorkflowConfig(
                    workflow_type="test",
                    project_path=Path(temp_dir),
                    completion_patterns="not a list"
                )

    def test_circular_references_in_custom_settings(self):
        """Test handling of circular references in custom settings."""
        with tempfile.TemporaryDirectory() as temp_dir:
            circular_dict = {}
            circular_dict["self"] = circular_dict

            # Should not crash but may limit depth
            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir),
                custom_settings={"circular": circular_dict}
            )
            assert "circular" in config.custom_settings

    def test_very_large_configuration_values(self):
        """Test handling of very large configuration values."""
        with tempfile.TemporaryDirectory() as temp_dir:
            large_list = list(range(1000000))
            large_string = "x" * 1000000

            config = WorkflowConfig(
                workflow_type="test",
                project_path=Path(temp_dir),
                custom_settings={
                    "large_list": large_list,
                    "large_string": large_string
                }
            )
            assert len(config.custom_settings["large_list"]) == 1000000


class TestWorkflowEngineErrorHandling:
    """Test error handling in WorkflowEngine."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.config = WorkflowConfig(
            workflow_type="test",
            project_path=Path(self.temp_dir),
            max_cycles=3
        )

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_session_startup_failure(self, mock_wrapper):
        """Test handling of session startup failures."""
        mock_wrapper.start_session.side_effect = Exception("Connection failed")

        workflow = TestFixWorkflow()
        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=workflow.get_completion_detector(),
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is False
        assert "error" in result or "reason" in result
        mock_wrapper.stop_session.assert_not_called()

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_prompt_generation_failure(self, mock_wrapper):
        """Test handling of prompt generation failures."""
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.stop_session.return_value = None

        failing_workflow = Mock(spec=BaseWorkflow)
        failing_workflow.generate_prompt.side_effect = Exception("Prompt failed")

        from workflows.core.completion_detector import TextPatternDetector
        detector = TextPatternDetector(patterns=["completed"])

        engine = WorkflowEngine(
            workflow=failing_workflow,
            completion_detector=detector,
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is False
        mock_wrapper.stop_session.assert_called_once()

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_claude_wrapper_failure(self, mock_wrapper):
        """Test handling of claude_wrapper failures."""
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.side_effect = Exception("Network timeout")
        mock_wrapper.stop_session.return_value = None

        workflow = TestFixWorkflow()
        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=workflow.get_completion_detector(),
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is False
        mock_wrapper.stop_session.assert_called_once()

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_completion_detector_failure(self, mock_wrapper):
        """Test handling of completion detector failures."""
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = "Task output"
        mock_wrapper.stop_session.return_value = None

        workflow = TestFixWorkflow()
        failing_detector = Mock()
        failing_detector.detect.side_effect = Exception("Detector failed")

        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=failing_detector,
            config=self.config
        )

        result = engine.execute()

        # Should handle detector failure gracefully
        assert isinstance(result, dict)
        mock_wrapper.stop_session.assert_called_once()

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_max_cycles_with_no_progress(self, mock_wrapper):
        """Test handling when max cycles reached with no progress."""
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = "Same output every time"
        mock_wrapper.stop_session.return_value = None

        workflow = TestFixWorkflow()
        never_complete_detector = Mock()
        never_complete_detector.detect.return_value = False

        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=never_complete_detector,
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is False
        assert result["current_cycle"] == self.config.max_cycles
        assert never_complete_detector.detect.call_count == self.config.max_cycles

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_session_cleanup_on_exception(self, mock_wrapper):
        """Test that sessions are properly cleaned up on exceptions."""
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.side_effect = Exception("Critical error")
        mock_wrapper.stop_session.return_value = None

        workflow = TestFixWorkflow()
        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=workflow.get_completion_detector(),
            config=self.config
        )

        # Should not raise exception, should return error result
        result = engine.execute()

        assert isinstance(result, dict)
        assert result["success"] is False
        # Session should be cleaned up
        mock_wrapper.stop_session.assert_called_once_with("session_123")

    def test_invalid_workflow_object(self):
        """Test handling of invalid workflow objects."""
        with pytest.raises(TypeError):
            WorkflowEngine(
                workflow="not a workflow",
                completion_detector=Mock(),
                config=self.config
            )

        with pytest.raises(TypeError):
            WorkflowEngine(
                workflow=None,
                completion_detector=Mock(),
                config=self.config
            )

    def test_invalid_detector_object(self):
        """Test handling of invalid detector objects."""
        workflow = TestFixWorkflow()

        with pytest.raises(TypeError):
            WorkflowEngine(
                workflow=workflow,
                completion_detector="not a detector",
                config=self.config
            )

        with pytest.raises(TypeError):
            WorkflowEngine(
                workflow=workflow,
                completion_detector=None,
                config=self.config
            )


class TestCompletionDetectorErrorHandling:
    """Test error handling in completion detectors."""

    def test_text_pattern_detector_with_invalid_patterns(self):
        """Test TextPatternDetector with invalid patterns."""
        # None patterns
        with pytest.raises((TypeError, ValueError)):
            TextPatternDetector(patterns=None)

        # Non-string patterns
        detector = TextPatternDetector(patterns=["valid", 123, None])
        # Should handle gracefully or filter invalid patterns
        result = detector.detect("valid pattern found")
        assert isinstance(result, bool)

    def test_text_pattern_detector_with_malformed_regex(self):
        """Test TextPatternDetector with malformed regex patterns."""
        malformed_patterns = [
            "[unclosed bracket",
            "*invalid quantifier",
            "(?invalid group"
        ]

        detector = TextPatternDetector(
            patterns=malformed_patterns,
            use_regex=True
        )

        # Should handle malformed regex gracefully
        result = detector.detect("test text")
        assert isinstance(result, bool)

    def test_command_result_detector_with_missing_context(self):
        """Test CommandResultDetector with missing or invalid context."""
        detector = CommandResultDetector(success_codes=[0])

        # No context
        result = detector.detect("output", None)
        assert result is False

        # Empty context
        result = detector.detect("output", {})
        assert result is False

        # Context without exit_code
        result = detector.detect("output", {"stdout": "text"})
        assert result is False

    def test_command_result_detector_with_invalid_exit_codes(self):
        """Test CommandResultDetector with invalid exit codes."""
        # Non-numeric exit codes in success_codes
        detector = CommandResultDetector(success_codes=[0, "invalid", None])

        context = {"exit_code": 0}
        result = detector.detect("output", context)
        assert isinstance(result, bool)

        # Non-numeric exit code in context
        context = {"exit_code": "not a number"}
        result = detector.detect("output", context)
        assert isinstance(result, bool)

    def test_tool_result_detector_with_malformed_results(self):
        """Test ToolResultDetector with malformed tool results."""
        detector = ToolResultDetector()

        malformed_contexts = [
            {"tool_results": "not a list"},
            {"tool_results": [{"missing_required_fields": True}]},
            {"tool_results": [{"tool": "test"}]},  # missing success
            {"tool_results": [{"success": True}]},  # missing tool
            {"tool_results": ["not a dict"]},
            {"tool_results": [None]},
        ]

        for context in malformed_contexts:
            result = detector.detect("output", context)
            assert isinstance(result, bool)

    def test_detector_with_very_large_input(self):
        """Test detectors with very large input data."""
        detector = TextPatternDetector(patterns=["needle"])

        # Very large text
        large_text = "hay " * 1000000 + "needle"
        result = detector.detect(large_text)
        assert result is True

        # Should not crash or timeout
        assert isinstance(result, bool)

    def test_detector_with_unicode_and_special_characters(self):
        """Test detectors with unicode and special characters."""
        unicode_patterns = ["测试完成", "тест", "🚀 done"]
        detector = TextPatternDetector(patterns=unicode_patterns)

        unicode_text = "测试进行中... 测试完成 ✓"
        result = detector.detect(unicode_text)
        assert result is True

        # Test with control characters and null bytes
        special_text = "test\x00\x01\x02 completed\n\r\t"
        simple_detector = TextPatternDetector(patterns=["completed"])
        result = simple_detector.detect(special_text)
        assert result is True

    def test_concurrent_detector_access(self):
        """Test detector thread safety and concurrent access."""
        detector = TextPatternDetector(patterns=["completed"])

        def detect_in_thread(text_suffix):
            return detector.detect(f"Task {text_suffix} completed")

        # Run multiple detections concurrently
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [
                executor.submit(detect_in_thread, i)
                for i in range(100)
            ]
            results = [future.result() for future in futures]

        # All should succeed
        assert len(results) == 100
        assert all(result is True for result in results)


class TestConfigManagerErrorHandling:
    """Test error handling in ConfigManager."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.config_dir = Path(self.temp_dir)

    def test_loading_nonexistent_config_file(self):
        """Test loading nonexistent configuration files."""
        manager = ConfigManager(search_paths=[str(self.config_dir)])

        with pytest.raises(FileNotFoundError):
            manager.load_config("nonexistent.json")

    def test_loading_corrupted_json_config(self):
        """Test loading corrupted JSON configuration files."""
        corrupted_file = self.config_dir / "corrupted.json"
        corrupted_file.write_text('{"workflow_type": "test", "invalid": }')

        manager = ConfigManager(search_paths=[str(self.config_dir)])

        with pytest.raises(json.JSONDecodeError):
            manager.load_config("corrupted.json")

    def test_loading_corrupted_yaml_config(self):
        """Test loading corrupted YAML configuration files."""
        corrupted_file = self.config_dir / "corrupted.yaml"
        corrupted_file.write_text("""
        workflow_type: test
        invalid_yaml:
          - item1
         - item2  # Invalid indentation
        """)

        manager = ConfigManager(search_paths=[str(self.config_dir)])

        with pytest.raises(Exception):  # YAML parsing error
            manager.load_config("corrupted.yaml")

    def test_permission_denied_config_file(self):
        """Test handling of permission denied errors."""
        restricted_file = self.config_dir / "restricted.json"
        restricted_file.write_text('{"workflow_type": "test"}')
        restricted_file.chmod(0o000)  # Remove all permissions

        manager = ConfigManager(search_paths=[str(self.config_dir)])

        try:
            with pytest.raises(PermissionError):
                manager.load_config("restricted.json")
        finally:
            # Restore permissions for cleanup
            restricted_file.chmod(0o644)

    def test_config_validation_with_invalid_schema(self):
        """Test configuration validation with invalid schemas."""
        manager = ConfigManager()

        invalid_configs = [
            {},  # Empty config
            {"workflow_type": None},  # None workflow type
            {"workflow_type": 123},  # Non-string workflow type
            {"max_cycles": "not a number"},  # Invalid type
            {"completion_patterns": "not a list"},  # Invalid type
        ]

        for config in invalid_configs:
            with pytest.raises((ValueError, TypeError)):
                manager.validate_config(config, strict=True)

    def test_environment_override_with_invalid_values(self):
        """Test environment overrides with invalid values."""
        config_data = {"workflow_type": "test", "max_cycles": 10}
        config_file = self.config_dir / "env_test.json"
        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        # Invalid environment values
        invalid_env = {
            "WORKFLOW_MAX_CYCLES": "not_a_number",
            "WORKFLOW_MAX_SESSION_TIME": "invalid",
        }

        with patch.dict('os.environ', invalid_env):
            manager = ConfigManager(search_paths=[str(self.config_dir)])
            # Should handle invalid env values gracefully
            config = manager.load_config("env_test.json", apply_env_overrides=True)
            # Values might be filtered out or converted
            assert isinstance(config, dict)

    def test_cache_corruption_handling(self):
        """Test handling of cache corruption."""
        manager = ConfigManager(cache_size=10)

        # Manually corrupt cache
        manager.cache["corrupted"] = "not a dict"
        manager.cache[123] = {"invalid_key_type": True}

        # Should handle gracefully
        config_data = {"workflow_type": "test"}
        config_file = self.config_dir / "test.json"
        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager.search_paths = [str(self.config_dir)]
        config = manager.load_config("test.json")
        assert config["workflow_type"] == "test"

    def test_concurrent_cache_access_corruption(self):
        """Test cache corruption under concurrent access."""
        manager = ConfigManager(cache_size=5)

        def modify_cache():
            for i in range(50):
                manager.cache[f"key_{i}"] = {"data": i}
                # Simulate cache operations
                if len(manager.cache) > manager.cache_size:
                    # Simulate cache eviction
                    keys_to_remove = list(manager.cache.keys())[:-manager.cache_size]
                    for key in keys_to_remove:
                        manager.cache.pop(key, None)
                time.sleep(0.001)

        # Run concurrent cache modifications
        threads = [threading.Thread(target=modify_cache) for _ in range(5)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        # Cache should still be functional
        assert isinstance(manager.cache, dict)
        assert len(manager.cache) <= manager.cache_size


class TestWorkflowDefinitionErrorHandling:
    """Test error handling in specific workflow definitions."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)

    def test_test_fix_workflow_with_missing_test_command(self):
        """Test TestFixWorkflow with missing test command."""
        workflow = TestFixWorkflow()
        config_data = {
            "workflow_type": "test-fix",
            "project_path": self.project_path,
            "test_command": None  # Missing command
        }

        # Should handle gracefully or provide default
        context = {"cycle": 1}
        prompt = workflow.generate_prompt(config_data, context)
        assert isinstance(prompt, str)

    def test_workflow_with_invalid_project_structure(self):
        """Test workflows with invalid project structures."""
        # Empty project directory
        empty_project = self.project_path / "empty"
        empty_project.mkdir()

        workflow = TestFixWorkflow()
        config_data = {
            "workflow_type": "test-fix",
            "project_path": empty_project,
            "test_command": "npm test"
        }

        # Should handle empty projects gracefully
        context = {"cycle": 1}
        prompt = workflow.generate_prompt(config_data, context)
        assert isinstance(prompt, str)

    def test_workflow_completion_with_ambiguous_output(self):
        """Test workflow completion detection with ambiguous output."""
        workflow = TestFixWorkflow()
        config_data = {
            "workflow_type": "test-fix",
            "project_path": self.project_path
        }

        ambiguous_outputs = [
            "",  # Empty output
            "test",  # Ambiguous
            "completed but also failed",  # Mixed signals
            "Test: PASS\nTest: FAIL",  # Mixed results
        ]

        for output in ambiguous_outputs:
            result = workflow.is_completed(output, config_data)
            assert isinstance(result, bool)

    def test_workflow_with_circular_dependencies(self):
        """Test handling of circular dependencies in workflow context."""
        workflow = TestFixWorkflow()

        circular_context = {}
        circular_context["self"] = circular_context
        circular_context["cycle"] = 1

        config_data = {
            "workflow_type": "test-fix",
            "project_path": self.project_path
        }

        # Should handle circular references gracefully
        try:
            prompt = workflow.generate_prompt(config_data, circular_context)
            assert isinstance(prompt, str)
        except RecursionError:
            pytest.fail("Workflow should handle circular references gracefully")


class TestSystemResourceExhaustion:
    """Test system behavior under resource exhaustion."""

    def test_memory_exhaustion_handling(self):
        """Test handling when system memory is low."""
        # Create very large objects to stress memory
        large_objects = []
        try:
            # This test might be skipped on systems with sufficient memory
            for i in range(100):
                large_objects.append([0] * 1000000)  # ~8MB per object

            # System should still be able to create simple workflows
            workflow = TestFixWorkflow()
            config = {
                "workflow_type": "test-fix",
                "project_path": Path("/tmp"),
                "max_cycles": 1
            }

            prompt = workflow.generate_prompt(config, {"cycle": 1})
            assert isinstance(prompt, str)

        except MemoryError:
            # Expected if system runs out of memory
            pass
        finally:
            # Cleanup
            large_objects.clear()

    def test_disk_space_exhaustion_handling(self):
        """Test handling when disk space is low."""
        # This is difficult to test safely without actually filling disk
        # Would need mock or controlled environment
        pass

    def test_high_cpu_load_handling(self):
        """Test workflow performance under high CPU load."""
        import multiprocessing

        def cpu_intensive_task():
            # CPU intensive task
            for i in range(1000000):
                _ = i ** 2

        # Start CPU intensive tasks
        processes = []
        try:
            for _ in range(multiprocessing.cpu_count()):
                p = multiprocessing.Process(target=cpu_intensive_task)
                p.start()
                processes.append(p)

            # Workflow should still function under load
            workflow = TestFixWorkflow()
            config = {
                "workflow_type": "test-fix",
                "project_path": Path("/tmp"),
                "max_cycles": 1
            }

            start_time = time.time()
            prompt = workflow.generate_prompt(config, {"cycle": 1})
            execution_time = time.time() - start_time

            assert isinstance(prompt, str)
            # Should complete within reasonable time even under load
            assert execution_time < 5.0

        finally:
            # Cleanup processes
            for p in processes:
                p.terminate()
                p.join()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])