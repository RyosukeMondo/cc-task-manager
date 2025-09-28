#!/usr/bin/env python3
"""
Workflow Engine

This module provides the unified execution engine for all workflow types.
It orchestrates Claude Code sessions using the existing claude_wrapper.py
and migrates core execution logic from SpecWorkflowAutomation class.

Classes:
    WorkflowEngine: Main execution engine for workflow orchestration
    SessionManager: Manages Claude Code session lifecycle
    OutputProcessor: Processes and monitors Claude Code output streams

The design follows the FR3 requirement for execution engine, providing
unified execution capabilities while preserving all existing automation
functionality and error handling patterns.
"""

import asyncio
import json
import logging
import subprocess
import sys
import signal
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List, Union

from .base_workflow import BaseWorkflow, WorkflowConfig
from .completion_detector import CompletionDetector, detect_completion_with_multiple_strategies, create_default_detectors

logger = logging.getLogger(__name__)


class SessionManager:
    """
    Manages Claude Code session lifecycle using claude_wrapper.py.

    Handles session startup, communication, monitoring, and cleanup
    while preserving all existing debug and logging functionality.
    """

    def __init__(self, project_path: Path, debug_options: Dict[str, Any] = None):
        """
        Initialize session manager.

        Args:
            project_path (Path): Path to the target project directory
            debug_options (Dict[str, Any], optional): Debug configuration options
        """
        self.project_path = project_path
        self.claude_process: Optional[subprocess.Popen] = None
        self.session_active = False
        self.current_run_id: Optional[str] = None
        self.debug_options = debug_options or {}

        # Get the path to claude_wrapper.py relative to this script's location
        self.wrapper_path = Path(__file__).parent.parent.parent / "scripts" / "claude_wrapper.py"

        if not self.wrapper_path.exists():
            raise FileNotFoundError(f"Claude wrapper not found at: {self.wrapper_path}")

    def start_session(self) -> bool:
        """
        Start a new Claude Code session.

        Returns:
            bool: True if session started successfully, False otherwise
        """
        try:
            logger.info("Starting new Claude Code session...")

            # Start the claude wrapper process in the target project directory
            self.claude_process = subprocess.Popen(
                [sys.executable, str(self.wrapper_path)],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=0,  # Unbuffered for real-time output
                cwd=self.project_path
            )

            # Wait for ready event
            if not self._wait_for_ready():
                logger.error("Failed to receive ready event from Claude")
                return False

            self.session_active = True
            logger.info("Claude session started successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to start Claude session: {e}")
            return False

    def _wait_for_ready(self, timeout: int = 30) -> bool:
        """
        Wait for Claude to send ready event.

        Args:
            timeout (int): Maximum time to wait for ready event

        Returns:
            bool: True if ready event received, False if timeout
        """
        start_time = time.time()

        while time.time() - start_time < timeout:
            if self.claude_process and self.claude_process.stdout:
                try:
                    line = self.claude_process.stdout.readline()
                    if line:
                        data = json.loads(line.strip())
                        if data.get("event") == "ready":
                            return True
                except (json.JSONDecodeError, AttributeError):
                    continue
            time.sleep(0.1)

        return False

    def send_prompt(self, prompt: str, options: Dict[str, Any] = None) -> bool:
        """
        Send a prompt to the Claude session.

        Args:
            prompt (str): Prompt text to send
            options (Dict[str, Any], optional): Execution options

        Returns:
            bool: True if prompt sent successfully, False otherwise
        """
        if not self.session_active or not self.claude_process:
            logger.error("Cannot send prompt: no active session")
            return False

        try:
            # Prepare prompt payload with preserved option structure
            prompt_payload = {
                "action": "prompt",
                "prompt": prompt,
                "options": options or {}
            }

            # Set default options if not provided
            if "cwd" not in prompt_payload["options"]:
                prompt_payload["options"]["cwd"] = str(self.project_path)
            if "exit_on_complete" not in prompt_payload["options"]:
                prompt_payload["options"]["exit_on_complete"] = True
            if "permission_mode" not in prompt_payload["options"]:
                prompt_payload["options"]["permission_mode"] = "bypassPermissions"

            self._send_command(prompt_payload)
            logger.info("Prompt sent to Claude session")
            return True

        except Exception as e:
            logger.error(f"Failed to send prompt: {e}")
            return False

    def _send_command(self, command: Dict[str, Any]) -> None:
        """
        Send a command to Claude process.

        Args:
            command (Dict[str, Any]): Command payload to send
        """
        if self.claude_process and self.claude_process.stdin:
            try:
                command_json = json.dumps(command)
                self.claude_process.stdin.write(command_json + "\n")
                self.claude_process.stdin.flush()
                logger.debug(f"Sent command: {command.get('action', 'unknown')}")
            except Exception as e:
                logger.error(f"Failed to send command: {e}")

    def shutdown_session(self) -> None:
        """
        Shutdown the current Claude session gracefully.
        """
        if not self.claude_process:
            return

        logger.info("Shutting down Claude session...")

        try:
            # Send shutdown command
            shutdown_payload = {"action": "shutdown"}
            self._send_command(shutdown_payload)

            # Wait for process to terminate gracefully
            try:
                self.claude_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                logger.warning("Claude process didn't terminate gracefully, forcing...")
                self.claude_process.terminate()
                try:
                    self.claude_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    logger.warning("Killing Claude process...")
                    self.claude_process.kill()

        except Exception as e:
            logger.error(f"Error during shutdown: {e}")

        finally:
            self.claude_process = None
            self.session_active = False
            self.current_run_id = None

    def is_process_alive(self) -> bool:
        """
        Check if the Claude process is still running.

        Returns:
            bool: True if process is alive, False otherwise
        """
        if not self.claude_process:
            return False
        return self.claude_process.poll() is None

    def read_output_line(self) -> Optional[str]:
        """
        Read a single line of output from Claude process.

        Returns:
            Optional[str]: Output line or None if no output available
        """
        if not self.claude_process or not self.claude_process.stdout:
            return None

        try:
            line = self.claude_process.stdout.readline()
            return line.strip() if line else None
        except Exception as e:
            logger.debug(f"Error reading output line: {e}")
            return None


class OutputProcessor:
    """
    Processes and monitors Claude Code output streams.

    Migrates the complex output processing and completion detection logic
    from SpecWorkflowAutomation while preserving all debug and logging functionality.
    """

    def __init__(self, completion_detectors: List[CompletionDetector] = None,
                 debug_options: Dict[str, Any] = None, session_log_file: Optional[str] = None):
        """
        Initialize output processor.

        Args:
            completion_detectors (List[CompletionDetector], optional): Completion detection strategies
            debug_options (Dict[str, Any], optional): Debug configuration options
            session_log_file (Optional[str]): File path to log JSONL session data
        """
        self.completion_detectors = completion_detectors or create_default_detectors()
        self.debug_options = debug_options or {}
        self.session_log_file = session_log_file
        self.completion_detected = False

    def process_output_line(self, line: str) -> Dict[str, Any]:
        """
        Process a single line of Claude output.

        Args:
            line (str): JSON line from Claude output

        Returns:
            Dict[str, Any]: Parsed output data with processing results
        """
        try:
            data = json.loads(line)
            event = data.get("event")

            # Log session data to file if configured
            self._log_session_data(data)

            # Use comprehensive debug logging (migrated from automation)
            self._debug_log_data(data)

            # Check for completion using configured detectors
            if detect_completion_with_multiple_strategies(data, self.completion_detectors):
                self.completion_detected = True
                logger.info("🎉 WORKFLOW COMPLETION DETECTED!")

            # Return processed data with metadata
            return {
                "event": event,
                "data": data,
                "completion_detected": self.completion_detected,
                "timestamp": datetime.utcnow().isoformat()
            }

        except json.JSONDecodeError:
            # Ignore malformed JSON, but log for debugging
            logger.debug(f"Ignoring malformed JSON: {line[:100]}...")
            return {
                "event": "parse_error",
                "data": {"raw_line": line},
                "completion_detected": False,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error processing output line: {e}")
            return {
                "event": "processing_error",
                "data": {"error": str(e), "raw_line": line},
                "completion_detected": False,
                "timestamp": datetime.utcnow().isoformat()
            }

    def _log_session_data(self, data: Dict[str, Any]) -> None:
        """
        Log session data to file if configured (migrated from automation).

        Args:
            data (Dict[str, Any]): Session data to log
        """
        if self.session_log_file:
            try:
                with open(self.session_log_file, 'a', encoding='utf-8') as f:
                    f.write(json.dumps(data, ensure_ascii=False) + '\n')
            except Exception as e:
                logger.warning(f"Failed to write session log: {e}")

    def _debug_log_data(self, data: Dict[str, Any]) -> None:
        """
        Comprehensive debug logging with configurable options (migrated from automation).

        Args:
            data (Dict[str, Any]): Data to debug log
        """
        try:
            event = data.get("event", "unknown")

            # Always show raw data structure if enabled
            if self.debug_options.get('show_raw_data'):
                logger.debug(f"RAW DATA: {json.dumps(data, indent=2)}")
                return

            # Show all events if enabled
            if self.debug_options.get('show_all_events'):
                logger.debug(f"EVENT: {event} | DATA: {json.dumps(data, indent=2)}")
                return

            # For stream events, show detailed analysis
            if event == "stream":
                payload = data.get("payload", {})

                if self.debug_options.get('show_payload_structure'):
                    logger.debug(f"PAYLOAD STRUCTURE: {list(payload.keys())}")

                if self.debug_options.get('show_stream_metadata'):
                    metadata = {k: v for k, v in data.items() if k != "payload"}
                    if metadata:
                        logger.debug(f"STREAM METADATA: {metadata}")

                # Content analysis
                readable_content = self._extract_readable_content(data)
                if readable_content != "No readable content":
                    if self.debug_options.get('show_content_analysis'):
                        logger.debug(f"CONTENT ANALYSIS: {self._analyze_content_structure(payload)}")
                    logger.debug(f"Claude stream: {readable_content}")

            # Tool usage details
            elif self.debug_options.get('show_tool_details'):
                if event in ["tool_call", "tool_result"]:
                    logger.debug(f"TOOL EVENT: {event} | {json.dumps(data, indent=2)}")

        except Exception as e:
            logger.debug(f"Debug logging failed: {e}")

    def _analyze_content_structure(self, payload: Dict[str, Any]) -> str:
        """
        Analyze the structure of content for debugging (migrated from automation).

        Args:
            payload (Dict[str, Any]): Payload data to analyze

        Returns:
            str: Content structure analysis
        """
        analysis = []

        # Check payload keys
        analysis.append(f"Keys: {list(payload.keys())}")

        # Analyze content array
        content = payload.get("content", [])
        if isinstance(content, list):
            content_types = [item.get("type", "unknown") if isinstance(item, dict) else type(item).__name__ for item in content]
            analysis.append(f"Content types: {content_types}")

            # Count different content types
            type_counts = {}
            for item in content:
                if isinstance(item, dict):
                    item_type = item.get("type", "unknown")
                    type_counts[item_type] = type_counts.get(item_type, 0) + 1
            if type_counts:
                analysis.append(f"Type counts: {type_counts}")

        # Check for tool-related content
        if any("tool" in str(k).lower() for k in payload.keys()):
            tool_keys = [k for k in payload.keys() if "tool" in str(k).lower()]
            analysis.append(f"Tool keys: {tool_keys}")

        return " | ".join(analysis)

    def _extract_readable_content(self, data: Dict[str, Any]) -> str:
        """
        Extract readable content from Claude stream data (migrated from automation).

        Args:
            data (Dict[str, Any]): Stream data to extract content from

        Returns:
            str: Readable content or "No readable content"
        """
        try:
            payload = data.get("payload", {})
            content_parts = []
            max_length = self.debug_options.get('max_content_length', 500)

            # Direct message/text content
            if "message" in payload:
                msg = payload['message']
                if self.debug_options.get('truncate_long_content', True) and len(str(msg)) > max_length:
                    msg = str(msg)[:max_length] + "..."
                content_parts.append(f"Message: {msg}")

            # Content array (typical for Claude responses)
            content = payload.get("content", [])
            if isinstance(content, list):
                for i, item in enumerate(content):
                    if isinstance(item, dict):
                        if item.get("type") == "text" and "text" in item:
                            text = item['text']
                            if self.debug_options.get('truncate_long_content', True) and len(text) > max_length:
                                text = text[:max_length] + "..."
                            content_parts.append(f"Text[{i}]: {text}")
                        elif item.get("type") == "tool_use":
                            tool_name = item.get("name", "unknown")
                            tool_input = item.get("input", {})
                            input_str = json.dumps(tool_input, indent=2)
                            if self.debug_options.get('truncate_long_content', True) and len(input_str) > max_length:
                                input_str = input_str[:max_length] + "..."
                            content_parts.append(f"Tool[{i}]: {tool_name} with {input_str}")
                        elif item.get("type") == "tool_result":
                            tool_id = item.get("tool_use_id", "unknown")
                            result = item.get("content", "")
                            if self.debug_options.get('truncate_long_content', True) and len(str(result)) > max_length:
                                result = str(result)[:max_length] + "..."
                            content_parts.append(f"ToolResult[{i}]: {tool_id} -> {result}")
                        elif "text" in item:
                            text = item['text']
                            if self.debug_options.get('truncate_long_content', True) and len(text) > max_length:
                                text = text[:max_length] + "..."
                            content_parts.append(f"Content[{i}]: {text}")

            # Tool results (direct in payload)
            if "result" in payload:
                result = payload["result"]
                result_str = str(result)
                if self.debug_options.get('truncate_long_content', True) and len(result_str) > max_length:
                    if isinstance(result, dict):
                        result_str = json.dumps(result, indent=2)[:max_length] + "..."
                    else:
                        result_str = result_str[:max_length] + "..."
                content_parts.append(f"Result: {result_str}")

            # Error content
            if "error" in payload:
                error = payload['error']
                if self.debug_options.get('truncate_long_content', True) and len(str(error)) > max_length:
                    error = str(error)[:max_length] + "..."
                content_parts.append(f"Error: {error}")

            # Additional payload keys for debugging
            if self.debug_options.get('show_payload_structure'):
                other_keys = [k for k in payload.keys() if k not in ["content", "message", "result", "error"]]
                if other_keys:
                    content_parts.append(f"Other keys: {other_keys}")

            return " | ".join(content_parts) if content_parts else "No readable content"

        except Exception as e:
            return f"Content extraction failed: {e}"

    def reset(self) -> None:
        """Reset processor state for new workflow execution."""
        self.completion_detected = False

    def add_completion_detector(self, detector: CompletionDetector) -> None:
        """
        Add a completion detector to the processor.

        Args:
            detector (CompletionDetector): Detector to add
        """
        if detector not in self.completion_detectors:
            self.completion_detectors.append(detector)

    def remove_completion_detector(self, detector: CompletionDetector) -> None:
        """
        Remove a completion detector from the processor.

        Args:
            detector (CompletionDetector): Detector to remove
        """
        if detector in self.completion_detectors:
            self.completion_detectors.remove(detector)


class WorkflowEngine:
    """
    Main execution engine for workflow orchestration.

    Provides unified execution capabilities for all workflow types while
    preserving existing automation functionality. Migrates core execution
    logic from SpecWorkflowAutomation class with enhanced error handling.
    """

    def __init__(self, config: WorkflowConfig):
        """
        Initialize workflow engine with configuration.

        Args:
            config (WorkflowConfig): Workflow configuration
        """
        self.config = config
        self.session_manager = SessionManager(config.project_path, config.debug_options)
        self.output_processor = OutputProcessor(
            debug_options=config.debug_options,
            session_log_file=config.custom_settings.get('session_log_file')
        )

        self.shutdown_requested = False
        self.workflow_completed = False
        self.current_cycle = 0

        # Setup signal handlers (migrated from automation)
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum: int, frame) -> None:
        """
        Handle shutdown signals gracefully (migrated from automation).

        Args:
            signum (int): Signal number
            frame: Signal frame
        """
        logger.info(f"Received signal {signum}, initiating shutdown...")
        self.shutdown_requested = True
        if self.session_manager:
            self.session_manager.shutdown_session()

    def execute_workflow(self, workflow: BaseWorkflow) -> bool:
        """
        Execute a workflow using the unified engine.

        Args:
            workflow (BaseWorkflow): Workflow to execute

        Returns:
            bool: True if workflow completed successfully, False otherwise
        """
        logger.info(f"Starting workflow execution: {workflow}")
        logger.info(f"Working in project directory: {self.config.project_path}")

        # Verify project directory exists
        if not self.config.project_path.exists():
            logger.error(f"Project directory does not exist: {self.config.project_path}")
            return False

        try:
            # Validate workflow configuration
            workflow.validate_config()

            # Prepare workflow for execution
            if not workflow.prepare_session():
                logger.error("Workflow preparation failed")
                return False

            # Get workflow-specific completion detectors
            workflow_detectors = self._get_workflow_detectors(workflow)
            for detector in workflow_detectors:
                self.output_processor.add_completion_detector(detector)

            # Execute workflow cycles
            success = self._execute_workflow_cycles(workflow)

            return success

        except Exception as e:
            logger.error(f"Workflow execution failed: {e}")
            return False
        finally:
            # Cleanup
            workflow.cleanup_session()
            if self.session_manager.session_active:
                self.session_manager.shutdown_session()

    def _get_workflow_detectors(self, workflow: BaseWorkflow) -> List[CompletionDetector]:
        """
        Get workflow-specific completion detectors.

        Args:
            workflow (BaseWorkflow): Workflow to get detectors for

        Returns:
            List[CompletionDetector]: List of workflow-specific detectors
        """
        # This can be extended by workflow types to provide custom detectors
        # For now, return empty list since default detectors are already configured
        return []

    def _execute_workflow_cycles(self, workflow: BaseWorkflow) -> bool:
        """
        Execute workflow in cycles until completion or limits reached.

        Args:
            workflow (BaseWorkflow): Workflow to execute

        Returns:
            bool: True if workflow completed successfully
        """
        self.current_cycle = 0

        while (not self.shutdown_requested and
               self.current_cycle < self.config.max_cycles and
               not self.workflow_completed):

            self.current_cycle += 1
            logger.info(f"Starting workflow cycle {self.current_cycle}")

            # Reset processor state for new cycle
            self.output_processor.reset()

            # Start new Claude session
            if not self.session_manager.start_session():
                logger.error("Failed to start Claude session")
                return False

            # Send workflow prompt
            prompt = workflow.get_workflow_prompt()
            options = workflow.get_execution_options()

            if not self.session_manager.send_prompt(prompt, options):
                logger.error("Failed to send workflow prompt")
                return False

            # Monitor session execution
            session_completed = self._monitor_session_execution()

            # Clean up session
            self.session_manager.shutdown_session()

            # Check completion status
            if self.output_processor.completion_detected:
                logger.info("🎉 WORKFLOW COMPLETED SUCCESSFULLY!")
                logger.info("✅ ALL OBJECTIVES ACHIEVED. EXITING EXECUTION.")
                self.workflow_completed = True
                return True

            if self.shutdown_requested:
                logger.info("Shutdown requested, stopping workflow")
                return False

            # Wait before next cycle if not at limit
            if self.current_cycle < self.config.max_cycles:
                logger.info("Waiting before next cycle...")
                time.sleep(2)

        # Check why we exited the loop
        if self.current_cycle >= self.config.max_cycles:
            logger.warning(f"Reached maximum cycles ({self.config.max_cycles}), stopping workflow")

        return self.workflow_completed

    def _monitor_session_execution(self) -> bool:
        """
        Monitor Claude session execution until completion or timeout.

        Returns:
            bool: True if session completed normally, False if terminated
        """
        monitoring_start = time.time()
        max_session_time = self.config.max_session_time

        while (self.session_manager.session_active and
               not self.shutdown_requested and
               not self.output_processor.completion_detected and
               time.time() - monitoring_start < max_session_time):

            # Check if process is still alive
            if not self.session_manager.is_process_alive():
                logger.warning("Claude process terminated unexpectedly")
                break

            # Read and process output
            line = self.session_manager.read_output_line()
            if line:
                result = self.output_processor.process_output_line(line)

                # Handle specific events
                event = result.get("event")
                if event in ["run_completed", "run_failed", "run_cancelled", "auto_shutdown", "shutdown"]:
                    logger.info(f"Session ended with event: {event}")
                    break
                elif event == "run_started":
                    data = result.get("data", {})
                    run_id = data.get("run_id")
                    logger.info(f"Run started: {run_id}")

                # Check for immediate completion
                if result.get("completion_detected"):
                    logger.info("🚀 COMPLETION DETECTED DURING MONITORING!")
                    break
            else:
                # Small delay to prevent busy waiting
                time.sleep(0.1)

        # Check timeout
        if time.time() - monitoring_start >= max_session_time:
            logger.warning(f"Session monitoring timeout ({max_session_time}s)")

        return True

    def get_execution_status(self) -> Dict[str, Any]:
        """
        Get current execution status information.

        Returns:
            Dict[str, Any]: Status information dictionary
        """
        return {
            "workflow_type": self.config.workflow_type,
            "project_path": str(self.config.project_path),
            "current_cycle": self.current_cycle,
            "max_cycles": self.config.max_cycles,
            "session_active": self.session_manager.session_active,
            "workflow_completed": self.workflow_completed,
            "completion_detected": self.output_processor.completion_detected,
            "shutdown_requested": self.shutdown_requested,
            "timestamp": datetime.utcnow().isoformat()
        }

    def request_shutdown(self) -> None:
        """Request graceful shutdown of the engine."""
        logger.info("Shutdown requested via API")
        self.shutdown_requested = True
        if self.session_manager.session_active:
            self.session_manager.shutdown_session()

    def __str__(self) -> str:
        """String representation of the workflow engine."""
        return f"WorkflowEngine(type={self.config.workflow_type}, " \
               f"project={self.config.project_path.name}, " \
               f"cycle={self.current_cycle}/{self.config.max_cycles})"

    def __repr__(self) -> str:
        """Detailed string representation of the workflow engine."""
        return f"WorkflowEngine(" \
               f"workflow_type='{self.config.workflow_type}', " \
               f"project_path='{self.config.project_path}', " \
               f"current_cycle={self.current_cycle}, " \
               f"max_cycles={self.config.max_cycles}, " \
               f"session_active={self.session_manager.session_active}, " \
               f"completed={self.workflow_completed})"


def create_workflow_engine(workflow_type: str, project_path: Union[str, Path], **kwargs) -> WorkflowEngine:
    """
    Factory function to create a workflow engine with configuration.

    Args:
        workflow_type (str): Type of workflow to create engine for
        project_path (Union[str, Path]): Path to the target project
        **kwargs: Additional configuration parameters

    Returns:
        WorkflowEngine: Configured workflow engine

    Example:
        engine = create_workflow_engine(
            workflow_type="spec",
            project_path="/path/to/project",
            spec_name="my-feature",
            max_cycles=15
        )
    """
    # Convert path if needed
    if isinstance(project_path, str):
        project_path = Path(project_path)

    # Create configuration
    config = WorkflowConfig(
        workflow_type=workflow_type,
        project_path=project_path,
        **kwargs
    )

    # Create and return engine
    return WorkflowEngine(config)