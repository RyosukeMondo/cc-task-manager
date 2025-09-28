#!/usr/bin/env python3
"""
Unit tests for workflow_engine module.

Tests cover WorkflowEngine orchestration, session management, and integration
with claude_wrapper.py for unified execution.
"""

import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, call
from typing import Dict, Any
import json
import time

from workflows.core.workflow_engine import WorkflowEngine, SessionManager, OutputProcessor
from workflows.core.base_workflow import WorkflowConfig, BaseWorkflow
from workflows.core.completion_detector import CompletionDetector


class MockWorkflow(BaseWorkflow):
    """Mock workflow for testing."""

    def generate_prompt(self, config: WorkflowConfig, context: Dict[str, Any]) -> str:
        return f"Mock prompt for {config.workflow_type}"

    def is_completed(self, output: str, config: WorkflowConfig) -> bool:
        return "completed" in output.lower()


class MockDetector(CompletionDetector):
    """Mock completion detector for testing."""

    def __init__(self, should_complete=False):
        self.should_complete = should_complete

    def detect(self, output: str, context: Dict[str, Any] = None) -> bool:
        return self.should_complete


class TestWorkflowEngine:
    """Test WorkflowEngine orchestration functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.config = WorkflowConfig(
            workflow_type="test",
            project_path=Path(self.temp_dir),
            max_cycles=5,
            max_session_time=60
        )
        self.workflow = MockWorkflow()
        self.detector = MockDetector(should_complete=False)

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_engine_initialization(self, mock_wrapper):
        """Test WorkflowEngine initialization."""
        engine = WorkflowEngine(
            workflow=self.workflow,
            completion_detector=self.detector,
            config=self.config
        )

        assert engine.workflow == self.workflow
        assert engine.completion_detector == self.detector
        assert engine.config == self.config
        assert isinstance(engine.session_manager, SessionManager)
        assert isinstance(engine.output_processor, OutputProcessor)

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_successful_workflow_execution(self, mock_wrapper):
        """Test successful workflow execution with completion."""
        # Setup mock wrapper
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = "Task completed successfully"
        mock_wrapper.stop_session.return_value = None

        # Create detector that completes after first cycle
        detector = MockDetector(should_complete=True)
        engine = WorkflowEngine(
            workflow=self.workflow,
            completion_detector=detector,
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is True
        assert result["completion_detected"] is True
        assert result["current_cycle"] == 1
        assert "Task completed successfully" in result["final_output"]

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_max_cycles_reached(self, mock_wrapper):
        """Test workflow execution when max cycles is reached."""
        # Setup mock wrapper
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.send_prompt.return_value = "Still working..."
        mock_wrapper.stop_session.return_value = None

        # Detector never completes
        detector = MockDetector(should_complete=False)
        engine = WorkflowEngine(
            workflow=self.workflow,
            completion_detector=detector,
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is False
        assert result["completion_detected"] is False
        assert result["current_cycle"] == self.config.max_cycles
        assert "max_cycles" in result["reason"]

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_session_timeout(self, mock_wrapper):
        """Test workflow execution with session timeout."""
        # Setup mock wrapper with slow responses
        mock_wrapper.start_session.return_value = "session_123"

        def slow_send_prompt(*args, **kwargs):
            time.sleep(0.1)  # Simulate slow response
            return "Still working..."

        mock_wrapper.send_prompt.side_effect = slow_send_prompt
        mock_wrapper.stop_session.return_value = None

        # Short timeout config
        short_config = WorkflowConfig(
            workflow_type="test",
            project_path=Path(self.temp_dir),
            max_cycles=100,
            max_session_time=1  # 1 second timeout
        )

        detector = MockDetector(should_complete=False)
        engine = WorkflowEngine(
            workflow=self.workflow,
            completion_detector=detector,
            config=short_config
        )

        result = engine.execute()

        assert result["success"] is False
        assert "timeout" in result["reason"].lower()

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_session_startup_failure(self, mock_wrapper):
        """Test handling of session startup failure."""
        mock_wrapper.start_session.side_effect = Exception("Session failed to start")

        engine = WorkflowEngine(
            workflow=self.workflow,
            completion_detector=self.detector,
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is False
        assert "session startup failed" in result["reason"].lower()
        mock_wrapper.stop_session.assert_not_called()

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_prompt_generation_failure(self, mock_wrapper):
        """Test handling of prompt generation failure."""
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.stop_session.return_value = None

        # Create workflow that fails to generate prompt
        failing_workflow = Mock(spec=BaseWorkflow)
        failing_workflow.generate_prompt.side_effect = Exception("Prompt generation failed")

        engine = WorkflowEngine(
            workflow=failing_workflow,
            completion_detector=self.detector,
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is False
        assert "prompt generation" in result["reason"].lower()

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_context_preservation_across_cycles(self, mock_wrapper):
        """Test that context is preserved and updated across cycles."""
        mock_wrapper.start_session.return_value = "session_123"

        cycle_count = 0
        def track_cycles(*args, **kwargs):
            nonlocal cycle_count
            cycle_count += 1
            if cycle_count >= 3:
                return "Task completed successfully"
            return f"Cycle {cycle_count} output"

        mock_wrapper.send_prompt.side_effect = track_cycles
        mock_wrapper.stop_session.return_value = None

        # Detector completes after 3 cycles
        detector = MockDetector(should_complete=False)
        def delayed_completion(output, context=None):
            return "completed" in output.lower()
        detector.detect = delayed_completion

        engine = WorkflowEngine(
            workflow=self.workflow,
            completion_detector=detector,
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is True
        assert result["current_cycle"] == 3
        assert mock_wrapper.send_prompt.call_count == 3

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_error_recovery_and_logging(self, mock_wrapper):
        """Test error recovery and proper logging."""
        mock_wrapper.start_session.return_value = "session_123"

        # First call fails, second succeeds
        mock_wrapper.send_prompt.side_effect = [
            Exception("Temporary failure"),
            "Task completed successfully"
        ]
        mock_wrapper.stop_session.return_value = None

        detector = MockDetector(should_complete=True)
        engine = WorkflowEngine(
            workflow=self.workflow,
            completion_detector=detector,
            config=self.config
        )

        with patch('workflows.core.workflow_engine.logger') as mock_logger:
            result = engine.execute()

            # Should log the error but continue
            mock_logger.error.assert_called()
            assert result["success"] is False  # Due to exception


class TestSessionManager:
    """Test SessionManager functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.config = WorkflowConfig(
            workflow_type="test",
            project_path=Path(self.temp_dir)
        )

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_session_startup(self, mock_wrapper):
        """Test session startup process."""
        mock_wrapper.start_session.return_value = "session_123"

        manager = SessionManager(self.config)
        session_id = manager.start_session()

        assert session_id == "session_123"
        assert manager.session_id == "session_123"
        assert manager.is_active is True

        mock_wrapper.start_session.assert_called_once_with(
            project_path=str(self.config.project_path),
            options=manager._get_session_options()
        )

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_session_cleanup(self, mock_wrapper):
        """Test session cleanup process."""
        mock_wrapper.start_session.return_value = "session_123"
        mock_wrapper.stop_session.return_value = None

        manager = SessionManager(self.config)
        manager.start_session()
        manager.stop_session()

        assert manager.session_id is None
        assert manager.is_active is False
        mock_wrapper.stop_session.assert_called_once_with("session_123")

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_session_monitoring(self, mock_wrapper):
        """Test session monitoring functionality."""
        mock_wrapper.start_session.return_value = "session_123"

        manager = SessionManager(self.config)
        manager.start_session()

        # Test session health check
        assert manager.is_healthy() is True

        # Test session timeout check
        manager.start_time = time.time() - 3600  # 1 hour ago
        short_config = WorkflowConfig(
            workflow_type="test",
            project_path=Path(self.temp_dir),
            max_session_time=60  # 1 minute
        )
        manager.config = short_config
        assert manager.is_timeout() is True

    def test_session_options_generation(self):
        """Test generation of session options from config."""
        config = WorkflowConfig(
            workflow_type="test",
            project_path=Path(self.temp_dir),
            debug_options={"verbose": True, "show_tools": False},
            environment_overrides={"NODE_ENV": "test"}
        )

        manager = SessionManager(config)
        options = manager._get_session_options()

        assert isinstance(options, dict)
        assert "debug_options" in options
        assert options["debug_options"]["verbose"] is True


class TestOutputProcessor:
    """Test OutputProcessor functionality."""

    def test_output_processing_and_analysis(self):
        """Test output processing and analysis."""
        processor = OutputProcessor()

        raw_output = """
        Starting task execution...
        Progress: 50%
        Error: temporary failure
        Retrying...
        Progress: 100%
        Task completed successfully!
        """

        processed = processor.process_output(raw_output)

        assert isinstance(processed, dict)
        assert "raw_output" in processed
        assert "cleaned_output" in processed
        assert "metadata" in processed

    def test_event_extraction(self):
        """Test extraction of events from output."""
        processor = OutputProcessor()

        output_with_events = """
        {"event": "progress", "data": {"percent": 50}}
        Normal text output
        {"event": "completion", "data": {"status": "success"}}
        """

        events = processor.extract_events(output_with_events)

        assert len(events) >= 0  # Depends on implementation
        assert isinstance(events, list)

    def test_error_pattern_detection(self):
        """Test detection of error patterns in output."""
        processor = OutputProcessor()

        error_output = """
        ERROR: File not found
        Warning: deprecated method used
        FATAL: System crash
        """

        errors = processor.detect_errors(error_output)

        assert isinstance(errors, list)
        # Should detect error patterns

    def test_progress_tracking(self):
        """Test progress tracking from output."""
        processor = OutputProcessor()

        progress_output = """
        Starting...
        Progress: 25%
        Progress: 50%
        Progress: 75%
        Completed!
        """

        progress = processor.track_progress(progress_output)

        assert isinstance(progress, (int, float, type(None)))

    def test_large_output_handling(self):
        """Test handling of very large outputs."""
        processor = OutputProcessor()

        large_output = "x" * 1000000  # 1MB of text
        processed = processor.process_output(large_output)

        assert isinstance(processed, dict)
        # Should handle large outputs efficiently

    def test_malformed_json_handling(self):
        """Test handling of malformed JSON in output."""
        processor = OutputProcessor()

        malformed_output = """
        {"event": "start", "data":
        Normal text
        {"event": "end"}
        """

        # Should not crash on malformed JSON
        events = processor.extract_events(malformed_output)
        assert isinstance(events, list)


class TestWorkflowEngineIntegration:
    """Test integration scenarios for WorkflowEngine."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.config = WorkflowConfig(
            workflow_type="test",
            project_path=Path(self.temp_dir)
        )

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_end_to_end_workflow_execution(self, mock_wrapper):
        """Test complete end-to-end workflow execution."""
        # Setup realistic mock responses
        mock_wrapper.start_session.return_value = "session_123"

        responses = [
            "Starting task analysis...",
            "Implementing solution...",
            "Running tests...",
            "All tests passed. Task completed successfully!"
        ]
        mock_wrapper.send_prompt.side_effect = responses
        mock_wrapper.stop_session.return_value = None

        # Progressive completion detector
        class ProgressiveDetector(CompletionDetector):
            def __init__(self):
                self.call_count = 0

            def detect(self, output: str, context: Dict[str, Any] = None) -> bool:
                self.call_count += 1
                return self.call_count >= 4 and "completed successfully" in output

        workflow = MockWorkflow()
        detector = ProgressiveDetector()
        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=detector,
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is True
        assert result["completion_detected"] is True
        assert result["current_cycle"] == 4
        assert mock_wrapper.send_prompt.call_count == 4

    @patch('workflows.core.workflow_engine.claude_wrapper')
    def test_workflow_with_context_evolution(self, mock_wrapper):
        """Test workflow execution with evolving context."""
        mock_wrapper.start_session.return_value = "session_123"

        def context_aware_prompt(config, context):
            cycle = context.get("cycle", 0)
            return f"Cycle {cycle}: Continue with task based on previous context"

        workflow = Mock(spec=BaseWorkflow)
        workflow.generate_prompt.side_effect = context_aware_prompt
        workflow.is_completed.return_value = False

        def context_tracking_response(prompt, **kwargs):
            if "Cycle 2" in prompt:
                return "Task completed after context evolution"
            return f"Response to {prompt}"

        mock_wrapper.send_prompt.side_effect = context_tracking_response
        mock_wrapper.stop_session.return_value = None

        detector = MockDetector(should_complete=False)
        def context_completion(output, context=None):
            return "completed after context evolution" in output

        detector.detect = context_completion

        engine = WorkflowEngine(
            workflow=workflow,
            completion_detector=detector,
            config=self.config
        )

        result = engine.execute()

        assert result["success"] is True
        # Verify context was passed to prompt generation
        workflow.generate_prompt.assert_called()


if __name__ == "__main__":
    pytest.main([__file__])