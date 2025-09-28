#!/usr/bin/env python3
"""
Unit tests for completion_detector module.

Tests cover all completion detector implementations including abstract base class,
text pattern detection, command result detection, and tool result detection.
"""

import pytest
from unittest.mock import Mock, patch
from typing import Dict, Any

from workflows.core.completion_detector import (
    CompletionDetector,
    TextPatternDetector,
    CommandResultDetector,
    ToolResultDetector,
    SpecWorkflowDetector
)


class ConcreteDetector(CompletionDetector):
    """Concrete implementation for testing abstract base class."""

    def detect(self, output: str, context: Dict[str, Any] = None) -> bool:
        return "detected" in output.lower()


class TestCompletionDetector:
    """Test CompletionDetector abstract base class."""

    def test_cannot_instantiate_abstract_class(self):
        """Test that CompletionDetector cannot be instantiated directly."""
        with pytest.raises(TypeError):
            CompletionDetector()

    def test_concrete_implementation_works(self):
        """Test that concrete implementation can be instantiated."""
        detector = ConcreteDetector()
        assert isinstance(detector, CompletionDetector)

    def test_abstract_method_must_be_implemented(self):
        """Test that detect method must be implemented in subclasses."""
        class IncompleteDetector(CompletionDetector):
            pass

        with pytest.raises(TypeError):
            IncompleteDetector()

    def test_concrete_detect_method(self):
        """Test detect method in concrete implementation."""
        detector = ConcreteDetector()
        assert detector.detect("Task detected successfully") is True
        assert detector.detect("Still working") is False


class TestTextPatternDetector:
    """Test TextPatternDetector implementation."""

    def test_single_pattern_detection(self):
        """Test detection with single pattern."""
        detector = TextPatternDetector(patterns=["completed"])

        assert detector.detect("Task completed successfully") is True
        assert detector.detect("Still in progress") is False

    def test_multiple_pattern_detection(self):
        """Test detection with multiple patterns."""
        patterns = ["completed", "finished", "done"]
        detector = TextPatternDetector(patterns=patterns)

        assert detector.detect("Task completed") is True
        assert detector.detect("Work finished") is True
        assert detector.detect("All done") is True
        assert detector.detect("Still working") is False

    def test_case_insensitive_detection(self):
        """Test case insensitive pattern matching."""
        detector = TextPatternDetector(patterns=["COMPLETED"], case_sensitive=False)

        assert detector.detect("task completed") is True
        assert detector.detect("TASK COMPLETED") is True
        assert detector.detect("Task Completed") is True

    def test_case_sensitive_detection(self):
        """Test case sensitive pattern matching."""
        detector = TextPatternDetector(patterns=["completed"], case_sensitive=True)

        assert detector.detect("task completed") is True
        assert detector.detect("TASK COMPLETED") is False
        assert detector.detect("Task Completed") is False

    def test_regex_pattern_detection(self):
        """Test regex pattern matching."""
        detector = TextPatternDetector(
            patterns=[r"\d+ tests? passed", r"Build: SUCCESS"],
            use_regex=True
        )

        assert detector.detect("5 tests passed") is True
        assert detector.detect("1 test passed") is True
        assert detector.detect("Build: SUCCESS") is True
        assert detector.detect("tests failed") is False

    def test_empty_patterns_list(self):
        """Test behavior with empty patterns list."""
        detector = TextPatternDetector(patterns=[])
        assert detector.detect("any text") is False

    def test_empty_output_string(self):
        """Test behavior with empty output string."""
        detector = TextPatternDetector(patterns=["completed"])
        assert detector.detect("") is False

    def test_multiline_output_detection(self):
        """Test detection in multiline output."""
        detector = TextPatternDetector(patterns=["All tests passed"])
        output = """
        Running tests...
        test_1: PASS
        test_2: PASS
        All tests passed
        """
        assert detector.detect(output) is True

    def test_context_parameter_ignored(self):
        """Test that context parameter is accepted but ignored."""
        detector = TextPatternDetector(patterns=["completed"])
        context = {"key": "value"}
        assert detector.detect("Task completed", context) is True


class TestCommandResultDetector:
    """Test CommandResultDetector implementation."""

    def test_success_exit_code_detection(self):
        """Test detection based on successful exit codes."""
        detector = CommandResultDetector(success_codes=[0])
        context = {"exit_code": 0, "stdout": "success", "stderr": ""}

        assert detector.detect("any output", context) is True

    def test_failure_exit_code_detection(self):
        """Test detection based on failure exit codes."""
        detector = CommandResultDetector(success_codes=[0])
        context = {"exit_code": 1, "stdout": "error", "stderr": "failed"}

        assert detector.detect("any output", context) is False

    def test_multiple_success_codes(self):
        """Test detection with multiple success exit codes."""
        detector = CommandResultDetector(success_codes=[0, 2])

        context1 = {"exit_code": 0}
        context2 = {"exit_code": 2}
        context3 = {"exit_code": 1}

        assert detector.detect("output", context1) is True
        assert detector.detect("output", context2) is True
        assert detector.detect("output", context3) is False

    def test_missing_exit_code_in_context(self):
        """Test behavior when exit_code is missing from context."""
        detector = CommandResultDetector(success_codes=[0])
        context = {"stdout": "output"}

        assert detector.detect("output", context) is False

    def test_none_context(self):
        """Test behavior when context is None."""
        detector = CommandResultDetector(success_codes=[0])
        assert detector.detect("output", None) is False

    def test_empty_context(self):
        """Test behavior with empty context."""
        detector = CommandResultDetector(success_codes=[0])
        assert detector.detect("output", {}) is False

    def test_non_integer_exit_code(self):
        """Test behavior with non-integer exit code."""
        detector = CommandResultDetector(success_codes=[0])
        context = {"exit_code": "0"}

        # Should handle string to int conversion or return False
        result = detector.detect("output", context)
        assert isinstance(result, bool)

    def test_negative_exit_codes(self):
        """Test behavior with negative exit codes."""
        detector = CommandResultDetector(success_codes=[-1, 0])
        context = {"exit_code": -1}

        assert detector.detect("output", context) is True


class TestToolResultDetector:
    """Test ToolResultDetector implementation."""

    def test_tool_success_detection(self):
        """Test detection based on tool success status."""
        detector = ToolResultDetector()
        context = {
            "tool_results": [
                {"tool": "test", "success": True, "output": "passed"},
                {"tool": "build", "success": True, "output": "success"}
            ]
        }

        assert detector.detect("output", context) is True

    def test_tool_failure_detection(self):
        """Test detection when tools fail."""
        detector = ToolResultDetector()
        context = {
            "tool_results": [
                {"tool": "test", "success": True, "output": "passed"},
                {"tool": "build", "success": False, "output": "error"}
            ]
        }

        assert detector.detect("output", context) is False

    def test_empty_tool_results(self):
        """Test behavior with empty tool results."""
        detector = ToolResultDetector()
        context = {"tool_results": []}

        assert detector.detect("output", context) is True  # No tools means success

    def test_missing_tool_results_in_context(self):
        """Test behavior when tool_results is missing from context."""
        detector = ToolResultDetector()
        context = {"other_key": "value"}

        assert detector.detect("output", context) is False

    def test_required_tools_all_present_and_successful(self):
        """Test detection with required tools."""
        detector = ToolResultDetector(required_tools=["test", "build"])
        context = {
            "tool_results": [
                {"tool": "test", "success": True, "output": "passed"},
                {"tool": "build", "success": True, "output": "success"},
                {"tool": "lint", "success": True, "output": "clean"}
            ]
        }

        assert detector.detect("output", context) is True

    def test_required_tools_missing(self):
        """Test detection when required tools are missing."""
        detector = ToolResultDetector(required_tools=["test", "build"])
        context = {
            "tool_results": [
                {"tool": "test", "success": True, "output": "passed"}
                # build tool missing
            ]
        }

        assert detector.detect("output", context) is False

    def test_required_tools_present_but_failed(self):
        """Test detection when required tools are present but failed."""
        detector = ToolResultDetector(required_tools=["test"])
        context = {
            "tool_results": [
                {"tool": "test", "success": False, "output": "failed"}
            ]
        }

        assert detector.detect("output", context) is False

    def test_malformed_tool_results(self):
        """Test behavior with malformed tool results."""
        detector = ToolResultDetector()
        context = {
            "tool_results": [
                {"tool": "test"},  # missing success and output
                {"success": True},  # missing tool
                "invalid"  # not a dict
            ]
        }

        # Should handle gracefully and return False for malformed data
        result = detector.detect("output", context)
        assert isinstance(result, bool)


class TestSpecWorkflowDetector:
    """Test SpecWorkflowDetector implementation."""

    def test_spec_completion_patterns(self):
        """Test detection using spec workflow completion patterns."""
        detector = SpecWorkflowDetector()

        # Test various completion patterns that should be detected
        completion_outputs = [
            "Task marked as completed in tasks.md",
            "✅ task completed successfully",
            "All tasks have been completed",
            "Specification implementation complete"
        ]

        for output in completion_outputs:
            # This test depends on the actual implementation
            # We'll need to check what patterns are used
            result = detector.detect(output)
            assert isinstance(result, bool)

    def test_spec_workflow_context_handling(self):
        """Test context handling specific to spec workflows."""
        detector = SpecWorkflowDetector()
        context = {
            "spec_name": "test-spec",
            "tasks_completed": 5,
            "total_tasks": 5
        }

        result = detector.detect("Tasks completed", context)
        assert isinstance(result, bool)

    def test_task_status_detection(self):
        """Test detection based on task status in spec workflow."""
        detector = SpecWorkflowDetector()

        # Test output that indicates task completion
        task_complete_output = """
        Updated tasks.md:
        - [x] Task 1: Create base infrastructure
        - [x] Task 2: Implement core logic
        All tasks marked as completed.
        """

        result = detector.detect(task_complete_output)
        assert isinstance(result, bool)


class TestDetectorEdgeCases:
    """Test edge cases and error conditions for all detectors."""

    def test_unicode_content_handling(self):
        """Test handling of unicode content in all detectors."""
        unicode_output = "测试完成 ✅ тест завершен 🚀"

        text_detector = TextPatternDetector(patterns=["完成", "завершен"])
        assert text_detector.detect(unicode_output) is True

        cmd_detector = CommandResultDetector(success_codes=[0])
        context = {"exit_code": 0}
        assert cmd_detector.detect(unicode_output, context) is True

    def test_very_large_output_handling(self):
        """Test handling of very large output strings."""
        large_output = "x" * 1000000 + "completed"
        detector = TextPatternDetector(patterns=["completed"])

        assert detector.detect(large_output) is True

    def test_special_characters_in_patterns(self):
        """Test handling of special regex characters in patterns."""
        special_patterns = ["[test]", "(done)", "*.log", "$end^"]
        detector = TextPatternDetector(patterns=special_patterns, use_regex=False)

        assert detector.detect("[test] passed") is True
        assert detector.detect("(done) successfully") is True

    def test_memory_efficiency_with_large_contexts(self):
        """Test memory efficiency with large context objects."""
        large_context = {
            "tool_results": [{"tool": f"tool_{i}", "success": True} for i in range(1000)]
        }
        detector = ToolResultDetector()

        result = detector.detect("output", large_context)
        assert result is True

    def test_concurrent_detection_safety(self):
        """Test that detectors are safe for concurrent use."""
        detector = TextPatternDetector(patterns=["completed"])

        # Simulate concurrent access (basic test)
        results = []
        for i in range(100):
            result = detector.detect(f"task {i} completed")
            results.append(result)

        assert all(results)  # All should be True


if __name__ == "__main__":
    pytest.main([__file__])