#!/usr/bin/env python3
"""
Completion Detection Framework

This module provides pluggable completion detection strategies for different workflow types.
It migrates and enhances the completion detection logic from spec_workflow_automation.py
to support a modular, extensible architecture.

Classes:
    CompletionDetector: Abstract base class for completion detection strategies
    TextPatternDetector: Detects completion based on text patterns in output
    CommandResultDetector: Detects completion based on command execution results
    ToolResultDetector: Detects completion based on tool execution results
    SpecWorkflowDetector: Specialized detector for spec-workflow tools (migrated logic)

The design follows the FR4 requirement for completion detection, providing
clear strategy pattern implementation for different detection approaches while
preserving all existing detection patterns from the legacy automation.
"""

import json
import re
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Union
from pathlib import Path

logger = logging.getLogger(__name__)


class CompletionDetector(ABC):
    """
    Abstract base class for completion detection strategies.

    Establishes the strategy pattern for different completion detection approaches.
    Concrete implementations define specific detection logic for their use case.

    Attributes:
        patterns (List[str]): List of patterns to match for completion detection
        debug_enabled (bool): Whether to enable debug logging for detection
    """

    def __init__(self, patterns: List[str] = None, debug_enabled: bool = False):
        """
        Initialize the completion detector.

        Args:
            patterns (List[str], optional): Patterns to detect for completion
            debug_enabled (bool): Enable debug logging for detection process
        """
        self.patterns = patterns or []
        self.debug_enabled = debug_enabled

    @abstractmethod
    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect if workflow completion criteria are met.

        Args:
            output_data (Dict[str, Any]): Output data from workflow execution

        Returns:
            bool: True if completion is detected, False otherwise
        """
        pass

    def _debug_log(self, message: str) -> None:
        """
        Log debug message if debug is enabled.

        Args:
            message (str): Debug message to log
        """
        if self.debug_enabled:
            logger.debug(f"[{self.__class__.__name__}] {message}")

    def add_pattern(self, pattern: str) -> None:
        """
        Add a completion pattern to the detector.

        Args:
            pattern (str): Pattern to add for completion detection
        """
        if pattern not in self.patterns:
            self.patterns.append(pattern)

    def remove_pattern(self, pattern: str) -> None:
        """
        Remove a completion pattern from the detector.

        Args:
            pattern (str): Pattern to remove from completion detection
        """
        if pattern in self.patterns:
            self.patterns.remove(pattern)


class TextPatternDetector(CompletionDetector):
    """
    Detects completion based on text patterns in output content.

    This detector searches for specific text patterns that indicate workflow
    completion. It supports case-insensitive matching and multiple pattern types.
    """

    def __init__(self, patterns: List[str] = None, case_sensitive: bool = False, debug_enabled: bool = False):
        """
        Initialize the text pattern detector.

        Args:
            patterns (List[str], optional): Text patterns to match
            case_sensitive (bool): Whether pattern matching should be case sensitive
            debug_enabled (bool): Enable debug logging
        """
        super().__init__(patterns, debug_enabled)
        self.case_sensitive = case_sensitive

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect completion based on text patterns in stream events.

        Args:
            output_data (Dict[str, Any]): Output data containing stream events

        Returns:
            bool: True if any completion pattern is found in text content
        """
        try:
            # Only process stream events
            if output_data.get("event") != "stream":
                return False

            payload = output_data.get("payload", {})
            content = payload.get("content", [])

            if not isinstance(content, list):
                return False

            # Search through content items for text
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_content = item.get("text", "")

                    if self._check_text_patterns(text_content):
                        return True

            return False

        except Exception as e:
            self._debug_log(f"Error in text pattern detection: {e}")
            return False

    def _check_text_patterns(self, text_content: str) -> bool:
        """
        Check if text content matches any completion patterns.

        Args:
            text_content (str): Text content to check

        Returns:
            bool: True if any pattern matches
        """
        if not text_content or len(text_content.strip()) == 0:
            return False

        # Prepare text for comparison
        check_text = text_content if self.case_sensitive else text_content.lower()

        self._debug_log(f"Checking text patterns in: {check_text[:100]}...")

        # Check each pattern
        for pattern in self.patterns:
            check_pattern = pattern if self.case_sensitive else pattern.lower()

            if check_pattern in check_text:
                self._debug_log(f"Pattern matched: '{pattern}'")
                logger.info(f"🎯 TEXT PATTERN COMPLETION: '{pattern}' detected!")
                return True

        return False


class CommandResultDetector(CompletionDetector):
    """
    Detects completion based on command execution results.

    This detector analyzes command output to determine if specific commands
    (like tests, builds, type checks) have completed successfully.
    """

    def __init__(self, command_patterns: Dict[str, List[str]] = None, debug_enabled: bool = False):
        """
        Initialize the command result detector.

        Args:
            command_patterns (Dict[str, List[str]], optional): Mapping of command types to completion patterns
            debug_enabled (bool): Enable debug logging
        """
        super().__init__(debug_enabled=debug_enabled)
        self.command_patterns = command_patterns or {}

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect completion based on command execution results.

        Args:
            output_data (Dict[str, Any]): Output data containing command results

        Returns:
            bool: True if command completion is detected
        """
        try:
            # Look for tool results that might contain command outputs
            if output_data.get("event") == "stream":
                payload = output_data.get("payload", {})
                content = payload.get("content", [])

                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict) and item.get("type") == "tool_result":
                            tool_content = item.get("content", "")

                            if self._check_command_result(tool_content):
                                return True

            return False

        except Exception as e:
            self._debug_log(f"Error in command result detection: {e}")
            return False

    def _check_command_result(self, command_output: str) -> bool:
        """
        Check if command output indicates completion.

        Args:
            command_output (str): Output from command execution

        Returns:
            bool: True if completion is indicated
        """
        if not command_output:
            return False

        self._debug_log(f"Checking command result: {command_output[:100]}...")

        # Check all command pattern categories
        for command_type, patterns in self.command_patterns.items():
            for pattern in patterns:
                if pattern.lower() in command_output.lower():
                    self._debug_log(f"Command completion detected: {command_type} - {pattern}")
                    logger.info(f"🎯 COMMAND COMPLETION: {command_type} - '{pattern}' detected!")
                    return True

        return False

    def add_command_patterns(self, command_type: str, patterns: List[str]) -> None:
        """
        Add completion patterns for a specific command type.

        Args:
            command_type (str): Type of command (e.g., 'test', 'build', 'type-check')
            patterns (List[str]): Patterns that indicate completion for this command type
        """
        if command_type not in self.command_patterns:
            self.command_patterns[command_type] = []
        self.command_patterns[command_type].extend(patterns)


class ToolResultDetector(CompletionDetector):
    """
    Detects completion based on tool execution results.

    This detector analyzes structured tool outputs to determine completion status.
    It can parse JSON results and check for specific data structures.
    """

    def __init__(self, tool_patterns: Dict[str, Any] = None, debug_enabled: bool = False):
        """
        Initialize the tool result detector.

        Args:
            tool_patterns (Dict[str, Any], optional): Patterns for tool result detection
            debug_enabled (bool): Enable debug logging
        """
        super().__init__(debug_enabled=debug_enabled)
        self.tool_patterns = tool_patterns or {}

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect completion based on tool execution results.

        Args:
            output_data (Dict[str, Any]): Output data containing tool results

        Returns:
            bool: True if tool completion is detected
        """
        try:
            # Process stream events for tool results
            if output_data.get("event") == "stream":
                payload = output_data.get("payload", {})
                content = payload.get("content", [])

                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict) and item.get("type") == "tool_result":
                            if self._check_tool_result(item):
                                return True

            # Also check direct tool result events
            elif output_data.get("event") == "tool_result":
                if self._check_tool_result(output_data):
                    return True

            return False

        except Exception as e:
            self._debug_log(f"Error in tool result detection: {e}")
            return False

    def _check_tool_result(self, tool_result: Dict[str, Any]) -> bool:
        """
        Check if tool result indicates completion.

        Args:
            tool_result (Dict[str, Any]): Tool result data

        Returns:
            bool: True if completion is indicated
        """
        tool_content = tool_result.get("content", "")
        tool_id = tool_result.get("tool_use_id", "unknown")

        self._debug_log(f"Checking tool result: {tool_id}")

        # Try to parse as JSON if it's a string
        if isinstance(tool_content, str):
            try:
                parsed_content = json.loads(tool_content)
                if self._check_parsed_tool_result(parsed_content):
                    return True
            except json.JSONDecodeError:
                # Not JSON, check as text
                if self._check_text_patterns(tool_content):
                    return True

        elif isinstance(tool_content, dict):
            if self._check_parsed_tool_result(tool_content):
                return True

        return False

    def _check_parsed_tool_result(self, parsed_result: Dict[str, Any]) -> bool:
        """
        Check parsed tool result for completion indicators.

        Args:
            parsed_result (Dict[str, Any]): Parsed tool result data

        Returns:
            bool: True if completion is indicated
        """
        # Default implementation checks for success and completion fields
        if parsed_result.get("success") and parsed_result.get("completed"):
            self._debug_log("Tool result indicates completion via success/completed fields")
            logger.info("🎯 TOOL COMPLETION: Tool result indicates completion!")
            return True

        return False


class SpecWorkflowDetector(CompletionDetector):
    """
    Specialized detector for spec-workflow tool completion.

    This detector migrates the complex completion detection logic from
    spec_workflow_automation.py to work with the new framework. It handles
    the specific patterns and data structures used by spec-workflow tools.
    """

    def __init__(self, debug_enabled: bool = False):
        """
        Initialize the spec-workflow detector with migrated patterns.

        Args:
            debug_enabled (bool): Enable debug logging
        """
        # Migrated completion patterns from the original automation
        spec_patterns = [
            # Original patterns
            "specification is fully implemented",
            "all tasks are marked as completed",
            "all tasks are marked as completed (`[x]`)",
            "all tasks in the tasks file are completed",
            "all tasks are completed (`[x]`)",

            # Hardcoded numeric patterns for common task counts
            "all 12 tasks are completed",
            "all 15 tasks are completed",
            "all 10 tasks are completed",
            "all 8 tasks are completed",
            "all 6 tasks are completed",

            # Zero pending patterns
            "0 pending tasks",
            "with 0 pending tasks",
            "0 tasks remaining",
            "no pending tasks",
            "no remaining tasks",

            # Status completion patterns
            "specification shows that all",
            "specification status: completed",
            "overall status: completed",
            "spec completed",
            "spec is completed",
            "specification completed",

            # Combined patterns from the logs
            "all 12 tasks are completed with 0 pending tasks",
            "shows that all 12 tasks are completed",
            "specification shows that all 12 tasks are completed"
        ]

        super().__init__(spec_patterns, debug_enabled)

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect spec-workflow completion using migrated logic.

        This method preserves the exact detection logic from the original
        spec_workflow_automation.py while adapting it to the new framework.

        Args:
            output_data (Dict[str, Any]): Output data from Claude Code session

        Returns:
            bool: True if spec-workflow completion is detected
        """
        try:
            # Check for completion indicators in stream events
            if output_data.get("event") == "stream":
                payload = output_data.get("payload", {})
                content = payload.get("content", [])

                # Look through content items for completion indicators
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict):
                            # Check text content for completion patterns
                            if item.get("type") == "text":
                                text_content = item.get("text", "")

                                # Debug: Log text content being examined
                                if len(text_content.strip()) > 10:
                                    self._debug_log(f"Examining text for completion patterns: {text_content[:200]}...")

                                # Use migrated pattern checking logic
                                if self._check_spec_text_patterns(text_content):
                                    return True

                            # Check tool results - ONLY from spec-workflow tools
                            elif item.get("type") == "tool_result":
                                if self._check_spec_tool_result(item):
                                    return True

                # Also check result field in ResultMessage for completion patterns
                if payload.get("message_type") == "ResultMessage" and "result" in payload:
                    result_text = payload["result"]
                    if isinstance(result_text, str) and len(result_text.strip()) > 10:
                        self._debug_log(f"Examining ResultMessage result for completion patterns: {result_text[:200]}...")
                        if self._check_spec_text_patterns(result_text):
                            logger.info("🎉 COMPLETION DETECTED in ResultMessage result field!")
                            return True

            # Also check direct tool result events
            elif output_data.get("event") == "tool_result":
                self._debug_log("DIRECT TOOL RESULT EVENT DETECTED!")
                tool_result = output_data.get("result", {})
                if self._check_spec_tool_result_data(tool_result):
                    return True

            return False

        except Exception as e:
            self._debug_log(f"Error checking spec workflow completion: {e}")
            return False

    def _check_spec_text_patterns(self, text_content: str) -> bool:
        """
        Check text for spec-workflow completion patterns (migrated logic).

        Args:
            text_content (str): Text content to check

        Returns:
            bool: True if completion pattern is found
        """
        if not text_content or len(text_content.strip()) == 0:
            return False

        text_lower = text_content.lower()
        self._debug_log(f"Checking spec completion patterns in: {text_lower[:100]}...")

        # Check each migrated pattern
        for pattern in self.patterns:
            if pattern.lower() in text_lower:
                self._debug_log(f"Spec pattern matched: '{pattern}'")
                logger.info(f"🎯 SPEC TEXT PATTERN COMPLETION: '{pattern}' detected!")
                return True

        return False

    def _check_spec_tool_result(self, tool_result_item: Dict[str, Any]) -> bool:
        """
        Check tool result item for spec-workflow completion (migrated logic).

        Args:
            tool_result_item (Dict[str, Any]): Tool result item from content

        Returns:
            bool: True if spec completion is detected
        """
        tool_result_content = tool_result_item.get("content")
        tool_use_id = tool_result_item.get("tool_use_id", "")

        self._debug_log(f"TOOL RESULT DETECTED - ID: {tool_use_id}")
        self._debug_log(f"Tool result content type: {type(tool_result_content)}")
        self._debug_log(f"Tool result content preview: {str(tool_result_content)[:300]}...")

        # Parse the tool result content if it's a string
        if isinstance(tool_result_content, str):
            try:
                result_data = json.loads(tool_result_content)
                return self._check_spec_tool_result_data(result_data)
            except json.JSONDecodeError:
                # Check if this looks like a tasks file (fallback analysis)
                return self._check_tasks_file_content(tool_result_content)

        elif isinstance(tool_result_content, dict):
            return self._check_spec_tool_result_data(tool_result_content)

        return False

    def _check_spec_tool_result_data(self, result_data: Dict[str, Any]) -> bool:
        """
        Check parsed spec-workflow tool result data (migrated logic).

        Args:
            result_data (Dict[str, Any]): Parsed tool result data

        Returns:
            bool: True if spec completion is detected
        """
        self._debug_log(f"Parsed JSON tool result keys: {list(result_data.keys()) if isinstance(result_data, dict) else 'not a dict'}")

        # STRICT: Only check completion for spec-workflow tool results
        # Look for spec-workflow specific data structures
        if (isinstance(result_data, dict) and
            result_data.get("success") and
            "data" in result_data):

            data = result_data["data"]

            # Verify this looks like spec-workflow data (has spec-specific fields)
            has_spec_fields = any(field in data for field in [
                "taskProgress", "overallStatus", "specName", "name",
                "completedTasks", "pendingTasks", "phases", "currentPhase"
            ])

            self._debug_log(f"Tool result has spec fields: {has_spec_fields}")
            if has_spec_fields:
                self._debug_log(f"Available data fields: {list(data.keys())}")

            if not has_spec_fields:
                self._debug_log("Tool result doesn't contain spec-workflow fields, ignoring")
                return False

            logger.info("🎯 SPEC-WORKFLOW TOOL RESULT DETECTED!")

            # Check task progress (primary completion indicator)
            task_progress = data.get("taskProgress", {})
            if task_progress:
                total = task_progress.get("total", 0)
                completed = task_progress.get("completed", 0)
                pending = task_progress.get("pending", 0)

                logger.info(f"📊 Spec-workflow task progress: {completed}/{total}, {pending} pending")

                if total > 0 and completed == total and pending == 0:
                    logger.info("🎯 RELIABLE COMPLETION: All tasks completed via spec-workflow taskProgress!")
                    return True

            # Check overall status (secondary completion indicator)
            overall_status = data.get("overallStatus")
            self._debug_log(f"Overall status: {overall_status}")
            if overall_status == "completed":
                logger.info("🎯 RELIABLE COMPLETION: Overall status completed via spec-workflow!")
                return True

        return False

    def _check_tasks_file_content(self, content: str) -> bool:
        """
        Check tasks file content for completion (fallback, migrated logic).

        Args:
            content (str): Tasks file content

        Returns:
            bool: True if completion is detected
        """
        # Check if this looks like a tasks file (has task markers)
        has_task_markers = bool(re.search(r'- \[[x ]\]', content, re.IGNORECASE))

        if has_task_markers:
            self._debug_log("TASKS FILE DETECTED (fallback analysis) - May be truncated!")

            # Count [x] vs [ ] tasks in the content
            completed_tasks = len(re.findall(r'- \[x\]', content, re.IGNORECASE))
            pending_tasks = len(re.findall(r'- \[ \]', content, re.IGNORECASE))
            total_tasks = completed_tasks + pending_tasks

            self._debug_log(f"FALLBACK TASK ANALYSIS (may be incomplete):")
            self._debug_log(f"   - Completed tasks [x]: {completed_tasks}")
            self._debug_log(f"   - Pending tasks [ ]: {pending_tasks}")
            self._debug_log(f"   - Total visible tasks: {total_tasks}")

            # Show sample of found patterns for debugging
            completed_matches = re.findall(r'- \[x\].*', content, re.IGNORECASE)[:3]
            pending_matches = re.findall(r'- \[ \].*', content, re.IGNORECASE)[:3]

            self._debug_log(f"Sample completed tasks: {completed_matches}")
            self._debug_log(f"Sample pending tasks: {pending_matches}")

            # CONSERVATIVE: Only trigger if we see a reasonable number of completed tasks
            # and no pending tasks, but warn about potential truncation
            if total_tasks >= 10 and pending_tasks == 0 and completed_tasks >= 10:
                logger.info("🎯 *** FALLBACK COMPLETION DETECTED *** All visible tasks marked [x]!")
                logger.warning("⚠️ WARNING: This is based on potentially truncated tasks file")
                return True
            else:
                self._debug_log(f"FALLBACK: Not enough evidence for completion ({total_tasks} visible tasks, {pending_tasks} pending)")
                self._debug_log("Need authoritative spec-workflow tool result for reliable detection")

        return False


def create_default_detectors() -> List[CompletionDetector]:
    """
    Create default completion detectors for common workflow types.

    Returns:
        List[CompletionDetector]: List of configured completion detectors
    """
    detectors = []

    # Text pattern detector with common completion phrases
    text_detector = TextPatternDetector([
        "completed successfully",
        "all tasks complete",
        "workflow finished",
        "implementation complete"
    ])
    detectors.append(text_detector)

    # Command result detector for common build/test commands
    command_detector = CommandResultDetector({
        "test": [
            "all tests passing",
            "test suite completed successfully",
            "0 failing tests",
            "tests passed"
        ],
        "build": [
            "build successful",
            "compilation completed",
            "build completed successfully",
            "no build errors"
        ],
        "type-check": [
            "no type errors",
            "type checking successful",
            "found 0 errors",
            "type check passed"
        ]
    })
    detectors.append(command_detector)

    # Spec-workflow detector (migrated from automation)
    spec_detector = SpecWorkflowDetector()
    detectors.append(spec_detector)

    return detectors


def detect_completion_with_multiple_strategies(output_data: Dict[str, Any],
                                             detectors: List[CompletionDetector] = None) -> bool:
    """
    Detect completion using multiple detection strategies.

    Args:
        output_data (Dict[str, Any]): Output data from workflow execution
        detectors (List[CompletionDetector], optional): List of detectors to use

    Returns:
        bool: True if any detector indicates completion
    """
    if detectors is None:
        detectors = create_default_detectors()

    for detector in detectors:
        try:
            if detector.detect_completion(output_data):
                logger.info(f"🎯 COMPLETION DETECTED by {detector.__class__.__name__}!")
                return True
        except Exception as e:
            logger.warning(f"Error in {detector.__class__.__name__}: {e}")

    return False