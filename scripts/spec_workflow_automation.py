#!/usr/bin/env python3
"""
Spec Workflow Automation Script

Automates the execution of spec-workflow tasks using Claude Code sessions.
Monitors Claude Code output and handles session lifecycle automatically.

Usage:
    python scripts/spec_workflow_automation.py --spec-name "Contract Driven" --project "/home/rmondo/repos/cc-task-manager"

Debug Options:
    --debug-raw         Show complete raw JSON data (most verbose)
    --debug-all         Show all events with full data (very verbose)
    --debug-payload     Show payload structure analysis
    --debug-content     Show content structure analysis
    --debug-metadata    Show stream metadata
    --debug-tools       Show tool usage details (default: enabled)
    --debug-full        Don't truncate long content
    --max-content N     Set max content length before truncation (default: 500)

Debug Levels (from least to most verbose):
    1. Default: Tool usage only
    2. --debug-metadata: + stream metadata
    3. --debug-payload: + payload structure
    4. --debug-content: + content analysis
    5. --debug-all: + all events with data
    6. --debug-raw: + complete raw JSON (maximum verbosity)
"""

import argparse
import asyncio
import json
import logging
import re
import subprocess
import sys
import signal
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)
logger = logging.getLogger(__name__)


class SpecWorkflowAutomation:
    """Automates spec-workflow task execution using Claude Code sessions."""

    def __init__(self, spec_name: str, project_path: str, session_log_file: Optional[str] = None, debug_options: Optional[Dict[str, bool]] = None):
        self.spec_name = spec_name
        self.project_path = Path(project_path).resolve()
        self.claude_process: Optional[subprocess.Popen] = None
        self.session_active = False
        self.spec_completed = False
        self.shutdown_requested = False
        self.current_run_id: Optional[str] = None
        self.session_log_file = session_log_file

        # Debug configuration options
        self.debug_options = debug_options or {
            'show_raw_data': False,
            'show_payload_structure': False,
            'show_content_analysis': False,
            'show_tool_details': True,
            'show_stream_metadata': False,
            'show_all_events': False,
            'truncate_long_content': True,
            'max_content_length': 500
        }

        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum: int, frame) -> None:
        """Handle shutdown signals gracefully."""
        logger.info(f"Received signal {signum}, initiating shutdown...")
        self.shutdown_requested = True
        if self.claude_process:
            self._shutdown_claude_session()

    def _get_predefined_prompt(self) -> str:
        """Get the predefined prompt for spec workflow automation."""
        return f"""spec: {self.spec_name}

work on a single task from spec name above of spec-workflow.

1. fetch one task from spec using mcp tool spec-workflow
2. work on task
3. update task status to complete on complete
4. commit changes
5. check remaining task count
6. end session without asking further actions.

Important: Use the mcp__spec-workflow tools to interact with the specification system."""

    def _start_claude_session(self) -> bool:
        """Start a new Claude Code session."""
        try:
            logger.info("Starting new Claude Code session...")

            # Get the path to claude_wrapper.py relative to this script's location
            script_dir = Path(__file__).parent
            wrapper_path = script_dir / "claude_wrapper.py"

            # Start the claude wrapper process in the target project directory
            self.claude_process = subprocess.Popen(
                [sys.executable, str(wrapper_path)],
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

            # Send the prompt
            prompt_payload = {
                "action": "prompt",
                "prompt": self._get_predefined_prompt(),
                "options": {
                    "cwd": str(self.project_path),
                    "exit_on_complete": True,
                    "permission_mode": "bypassPermissions"
                }
            }

            self._send_command(prompt_payload)
            self.session_active = True
            logger.info("Claude session started successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to start Claude session: {e}")
            return False

    def _wait_for_ready(self, timeout: int = 30) -> bool:
        """Wait for Claude to send ready event."""
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

    def _send_command(self, command: Dict[str, Any]) -> None:
        """Send a command to Claude process."""
        if self.claude_process and self.claude_process.stdin:
            try:
                command_json = json.dumps(command)
                self.claude_process.stdin.write(command_json + "\n")
                self.claude_process.stdin.flush()
                logger.debug(f"Sent command: {command.get('action', 'unknown')}")
            except Exception as e:
                logger.error(f"Failed to send command: {e}")

    def _shutdown_claude_session(self) -> None:
        """Shutdown the current Claude session gracefully."""
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

    def _check_text_for_completion_patterns(self, text_content: str) -> bool:
        """Check a text string for completion patterns - LIMITED to specific completion indicators.

        Only detects completion when Claude explicitly states that all tasks are marked as completed
        in the tasks file, indicating genuine spec completion analysis.
        """
        if not text_content or len(text_content.strip()) == 0:
            return False

        text_lower = text_content.lower()
        logger.debug(f"🔍 Checking limited completion patterns in: {text_lower[:100]}...")

        # HARDCODED ROBUST patterns - cast a wide net for completion detection
        specific_completion_patterns = [
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

        for pattern in specific_completion_patterns:
            if pattern in text_lower:
                logger.info(f"🎯 SPECIFIC COMPLETION PATTERN: '{pattern}' detected!")
                return True

        return False

    def _detect_spec_workflow_completion(self, output_data: Dict[str, Any]) -> bool:
        """Detect if spec-workflow indicates completion."""
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

                                # Debug: Log ALL text content being examined for completion patterns
                                if len(text_content.strip()) > 10:  # Only log substantial content
                                    logger.debug(f"🔍 Examining text for completion patterns: {text_content[:200]}...")

                                # Use helper function to check for completion patterns
                                if self._check_text_for_completion_patterns(text_content):
                                    return True


                            # Check tool results - ONLY from spec-workflow tools
                            elif item.get("type") == "tool_result":
                                tool_result_content = item.get("content")

                                # Check if this is from a spec-workflow tool
                                tool_use_id = item.get("tool_use_id", "")

                                # Enhanced debug logging for ALL tool results
                                logger.info(f"🔧 TOOL RESULT DETECTED - ID: {tool_use_id}")
                                logger.info(f"🔧 Tool result content type: {type(tool_result_content)}")
                                logger.info(f"🔧 Tool result content preview: {str(tool_result_content)[:300]}...")

                                # Parse the tool result content if it's a string
                                if isinstance(tool_result_content, str):
                                    try:
                                        result_data = json.loads(tool_result_content)

                                        # Enhanced logging for JSON tool results
                                        logger.info(f"🔧 Parsed JSON tool result keys: {list(result_data.keys()) if isinstance(result_data, dict) else 'not a dict'}")

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

                                            logger.info(f"🔧 Tool result has spec fields: {has_spec_fields}")
                                            if has_spec_fields:
                                                logger.info(f"🔧 Available data fields: {list(data.keys())}")

                                            if not has_spec_fields:
                                                logger.debug("Tool result doesn't contain spec-workflow fields, ignoring")
                                                continue

                                            logger.info(f"🎯 SPEC-WORKFLOW TOOL RESULT DETECTED!")

                                            # Check task progress (primary completion indicator)
                                            task_progress = data.get("taskProgress", {})
                                            if task_progress:
                                                total = task_progress.get("total", 0)
                                                completed = task_progress.get("completed", 0)

                                                logger.info(f"📊 Spec-workflow task progress: {completed}/{total}")

                                                if total > 0 and completed == total:
                                                    logger.info("🎯 RELIABLE COMPLETION: All tasks completed via spec-workflow taskProgress!")
                                                    return True

                                            # Check overall status (secondary completion indicator)
                                            overall_status = data.get("overallStatus")
                                            logger.info(f"📊 Overall status: {overall_status}")
                                            if overall_status == "completed":
                                                logger.info("🎯 RELIABLE COMPLETION: Overall status completed via spec-workflow!")
                                                return True

                                    except json.JSONDecodeError as e:
                                        logger.debug(f"Failed to parse tool result as JSON: {e}")
                                        # DISABLED: String pattern matching in tool results to prevent false positives
                                        # Only structured JSON data from spec-workflow tools should trigger completion

            return False

        except Exception as e:
            logger.debug(f"Error checking spec workflow completion: {e}")
            return False

    def _log_session_data(self, data: Dict[str, Any]) -> None:
        """Log session data to file if configured."""
        if self.session_log_file:
            try:
                with open(self.session_log_file, 'a', encoding='utf-8') as f:
                    f.write(json.dumps(data, ensure_ascii=False) + '\n')
            except Exception as e:
                logger.warning(f"Failed to write session log: {e}")

    def _debug_log_data(self, data: Dict[str, Any]) -> None:
        """Comprehensive debug logging with configurable options."""
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
        """Analyze the structure of content for debugging."""
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
        """Extract readable content from Claude stream data."""
        try:
            payload = data.get("payload", {})
            content_parts = []
            max_length = self.debug_options.get('max_content_length', 500)

            # Direct message/text content
            if "message" in payload:
                msg = payload['message']
                if self.debug_options.get('truncate_long_content') and len(str(msg)) > max_length:
                    msg = str(msg)[:max_length] + "..."
                content_parts.append(f"Message: {msg}")

            # Content array (typical for Claude responses)
            content = payload.get("content", [])
            if isinstance(content, list):
                for i, item in enumerate(content):
                    if isinstance(item, dict):
                        if item.get("type") == "text" and "text" in item:
                            text = item['text']
                            if self.debug_options.get('truncate_long_content') and len(text) > max_length:
                                text = text[:max_length] + "..."
                            content_parts.append(f"Text[{i}]: {text}")
                        elif item.get("type") == "tool_use":
                            tool_name = item.get("name", "unknown")
                            tool_input = item.get("input", {})
                            input_str = json.dumps(tool_input, indent=2)
                            if self.debug_options.get('truncate_long_content') and len(input_str) > max_length:
                                input_str = input_str[:max_length] + "..."
                            content_parts.append(f"Tool[{i}]: {tool_name} with {input_str}")
                        elif item.get("type") == "tool_result":
                            tool_id = item.get("tool_use_id", "unknown")
                            result = item.get("content", "")
                            if self.debug_options.get('truncate_long_content') and len(str(result)) > max_length:
                                result = str(result)[:max_length] + "..."
                            content_parts.append(f"ToolResult[{i}]: {tool_id} -> {result}")
                        elif "text" in item:
                            text = item['text']
                            if self.debug_options.get('truncate_long_content') and len(text) > max_length:
                                text = text[:max_length] + "..."
                            content_parts.append(f"Content[{i}]: {text}")

            # Tool results (direct in payload)
            if "result" in payload:
                result = payload["result"]
                result_str = str(result)
                if self.debug_options.get('truncate_long_content') and len(result_str) > max_length:
                    if isinstance(result, dict):
                        result_str = json.dumps(result, indent=2)[:max_length] + "..."
                    else:
                        result_str = result_str[:max_length] + "..."
                content_parts.append(f"Result: {result_str}")

            # Error content
            if "error" in payload:
                error = payload['error']
                if self.debug_options.get('truncate_long_content') and len(str(error)) > max_length:
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

    def _monitor_claude_output(self) -> bool:
        """Monitor Claude output and handle state changes."""
        if not self.claude_process or not self.claude_process.stdout:
            return False

        # Check if process is still running
        if self.claude_process.poll() is not None:
            logger.warning(f"Claude process terminated with exit code: {self.claude_process.returncode}")
            return True

        try:
            line = self.claude_process.stdout.readline()
            if not line:
                # Check if process is still alive
                if self.claude_process.poll() is not None:
                    logger.warning("Claude process ended, no more output")
                    return True
                # No output but process still running - this is normal for brief moments
                return False

            data = json.loads(line.strip())
            event = data.get("event")

            # Log all session data to file if configured
            self._log_session_data(data)

            # Use comprehensive debug logging
            self._debug_log_data(data)

            # Enhanced logging for different event types
            if event == "stream":
                # Log ALL payload structure for debugging
                payload = data.get("payload", {})
                logger.debug(f"🔍 STREAM PAYLOAD KEYS: {list(payload.keys())}")

                # Log tool usage specifically
                content = payload.get("content", [])
                if isinstance(content, list):
                    for i, item in enumerate(content):
                        if isinstance(item, dict):
                            item_type = item.get("type", "unknown")
                            item_keys = list(item.keys())
                            logger.debug(f"🔍 Content[{i}] type: {item_type}, keys: {item_keys}")

                            # Detect tool use by structure (has id, name, input)
                            if "name" in item and "input" in item and "id" in item:
                                tool_name = item.get("name", "unknown")
                                logger.info(f"🔧 TOOL USED: {tool_name}")
                                if "spec-workflow" in tool_name or "spec_status" in tool_name:
                                    logger.info(f"🎯 SPEC-WORKFLOW TOOL DETECTED: {tool_name}")

                            # Detect tool result by structure (has tool_use_id, content, is_error)
                            elif "tool_use_id" in item and "content" in item:
                                logger.info(f"🔧 TOOL RESULT FOUND IN CONTENT[{i}]")
                                tool_result_content = item.get("content")
                                logger.info(f"🔧 Tool result content: {str(tool_result_content)[:200]}...")

                                # Try to parse as JSON for spec-workflow data
                                if isinstance(tool_result_content, str):
                                    try:
                                        result_data = json.loads(tool_result_content)
                                        if (isinstance(result_data, dict) and
                                            result_data.get("success") and
                                            "data" in result_data):

                                            data_obj = result_data["data"]
                                            if "taskProgress" in data_obj:
                                                task_progress = data_obj["taskProgress"]
                                                total = task_progress.get("total", 0)
                                                completed = task_progress.get("completed", 0)
                                                logger.info(f"🎯 SPEC TOOL RESULT: {completed}/{total} tasks")

                                                if total > 0 and completed == total:
                                                    logger.info("🎯 COMPLETION DETECTED via tool result structure!")
                                                    return True
                                    except:
                                        pass

                                # ROBUST: Check if this is a tasks.md file with all [x] completed
                                if isinstance(tool_result_content, str):
                                    # Check if this looks like a tasks file (has task markers)
                                    has_task_markers = bool(re.search(r'- \[[x ]\]', tool_result_content, re.IGNORECASE))

                                    if has_task_markers:
                                        logger.info("🔍 TASKS FILE DETECTED - Analyzing completion status...")

                                        # Count [x] vs [ ] tasks in the content
                                        completed_tasks = len(re.findall(r'- \[x\]', tool_result_content, re.IGNORECASE))
                                        pending_tasks = len(re.findall(r'- \[ \]', tool_result_content, re.IGNORECASE))
                                        total_tasks = completed_tasks + pending_tasks

                                        logger.info(f"🔍 TASK ANALYSIS DETAILS:")
                                        logger.info(f"   - Completed tasks [x]: {completed_tasks}")
                                        logger.info(f"   - Pending tasks [ ]: {pending_tasks}")
                                        logger.info(f"   - Total tasks: {total_tasks}")

                                        # Show sample of found patterns for debugging
                                        completed_matches = re.findall(r'- \[x\].*', tool_result_content, re.IGNORECASE)[:3]
                                        pending_matches = re.findall(r'- \[ \].*', tool_result_content, re.IGNORECASE)[:3]

                                        logger.info(f"🔍 Sample completed tasks: {completed_matches}")
                                        logger.info(f"🔍 Sample pending tasks: {pending_matches}")

                                        if total_tasks > 0 and pending_tasks == 0 and completed_tasks >= 3:
                                            logger.info("🎯 *** COMPLETION DETECTED *** All tasks marked [x] in tasks file!")
                                            logger.info("🚨 TRIGGERING IMMEDIATE SPEC COMPLETION!")
                                            return True
                                        else:
                                            logger.info(f"🔍 Not complete: {pending_tasks} pending tasks remain")

                                    # Also try to parse as potential spec-workflow JSON (verbose logging)
                                    elif "{" in tool_result_content and "}" in tool_result_content:
                                        logger.info("🔍 JSON-like content detected, attempting parse...")
                                        try:
                                            result_data = json.loads(tool_result_content)
                                            logger.info(f"🔍 JSON parsed successfully, keys: {list(result_data.keys()) if isinstance(result_data, dict) else 'not dict'}")

                                            if isinstance(result_data, dict):
                                                logger.info(f"🔍 JSON structure analysis:")
                                                logger.info(f"   - Has 'success': {result_data.get('success')}")
                                                logger.info(f"   - Has 'data': {'data' in result_data}")

                                                if result_data.get("success") and "data" in result_data:
                                                    data_obj = result_data["data"]
                                                    logger.info(f"🔍 Data object keys: {list(data_obj.keys()) if isinstance(data_obj, dict) else 'not dict'}")

                                                    if "taskProgress" in data_obj:
                                                        task_progress = data_obj["taskProgress"]
                                                        total = task_progress.get("total", 0)
                                                        completed = task_progress.get("completed", 0)
                                                        logger.info(f"🎯 *** SPEC-WORKFLOW TOOL RESULT *** {completed}/{total} tasks")

                                                        if total > 0 and completed == total:
                                                            logger.info("🎯 *** COMPLETION DETECTED *** via spec-workflow taskProgress!")
                                                            logger.info("🚨 TRIGGERING IMMEDIATE SPEC COMPLETION!")
                                                            return True
                                        except Exception as e:
                                            logger.debug(f"🔍 JSON parse failed (not an error): {e}")

                            # Legacy detection for explicit types
                            elif item.get("type") == "tool_use":
                                tool_name = item.get("name", "unknown")
                                logger.info(f"🔧 TOOL USED (legacy): {tool_name}")

                            elif item.get("type") == "tool_result":
                                logger.info(f"🔧 TOOL RESULT FOUND (legacy) IN CONTENT[{i}]")

                # Also check if tool results are at payload level
                if "tool_result" in payload:
                    logger.info(f"🔧 TOOL RESULT FOUND AT PAYLOAD LEVEL")
                if "result" in payload:
                    logger.info(f"🔧 RESULT FOUND AT PAYLOAD LEVEL")

                # Also check result field in ResultMessage for completion patterns
                if payload.get("message_type") == "ResultMessage" and "result" in payload:
                    result_text = payload["result"]
                    if isinstance(result_text, str) and len(result_text.strip()) > 10:
                        logger.debug(f"🔍 Examining ResultMessage result for completion patterns: {result_text[:200]}...")
                        # Check for completion patterns in result text
                        if self._check_text_for_completion_patterns(result_text):
                            self.spec_completed = True
                            logger.info("🎉 COMPLETION DETECTED in ResultMessage result field!")
                        else:
                            logger.debug("❌ No completion patterns found in ResultMessage result field")

            elif event == "run_started":
                self.current_run_id = data.get("run_id")
                logger.info(f"Run started: {self.current_run_id}")

            elif event == "run_completed":
                logger.info("Run completed successfully")
                self.session_active = False

                # If we detected completion during this run, exit immediately
                if self.spec_completed:
                    logger.info("🚀 SPEC COMPLETION DETECTED DURING THIS RUN - TRIGGERING IMMEDIATE EXIT!")

                return True

            elif event == "run_failed":
                error_msg = data.get('error', 'Unknown error')
                logger.error(f"Run failed: {error_msg}")
                logger.debug(f"Full error data: {json.dumps(data, indent=2)}")
                self.session_active = False
                return True

            elif event == "run_cancelled":
                logger.info("Run was cancelled")
                self.session_active = False
                return True

            elif event == "auto_shutdown":
                logger.info("Claude initiated auto-shutdown")
                self.session_active = False
                return True

            elif event == "shutdown":
                logger.info("Claude session shutdown")
                self.session_active = False
                return True

            elif event == "state":
                state = data.get("state")
                logger.info(f"Claude state changed to: {state}")
                if state == "idle":
                    self.session_active = False
                    return True

            elif event == "tool_result":
                # Handle tool result events directly
                logger.info(f"🔧 DIRECT TOOL RESULT EVENT DETECTED!")
                logger.info(f"🔧 Tool result data keys: {list(data.keys())}")

                # Check if this is a spec-workflow tool result
                tool_result = data.get("result", {})
                if isinstance(tool_result, dict):
                    if (tool_result.get("success") and "data" in tool_result and
                        "taskProgress" in tool_result.get("data", {})):

                        task_data = tool_result["data"]
                        task_progress = task_data.get("taskProgress", {})
                        total = task_progress.get("total", 0)
                        completed = task_progress.get("completed", 0)

                        logger.info(f"🎯 DIRECT TOOL RESULT - Task progress: {completed}/{total}")

                        if total > 0 and completed == total:
                            logger.info("🎯 COMPLETION DETECTED via direct tool result event!")
                            self.spec_completed = True

            else:
                # Log other events with their data
                logger.debug(f"Event '{event}': {json.dumps(data, indent=2)}")

            # Check for spec workflow completion
            if self._detect_spec_workflow_completion(data):
                self.spec_completed = True
                logger.info("🎉 SPEC WORKFLOW COMPLETION DETECTED!")
                logger.info("🚨 SETTING COMPLETION FLAG AND FORCING SESSION END!")
                return True  # Force session end immediately

            return False

        except json.JSONDecodeError:
            # Ignore malformed JSON
            return False
        except Exception as e:
            logger.error(f"Error monitoring output: {e}")
            return False

    def run(self) -> bool:
        """Main automation loop."""
        logger.info(f"Starting spec workflow automation for: {self.spec_name}")
        logger.info(f"Working in project directory: {self.project_path}")

        # Verify project directory exists
        if not self.project_path.exists():
            logger.error(f"Project directory does not exist: {self.project_path}")
            return False

        cycle_count = 0
        max_cycles = 10  # Prevent infinite loops

        while not self.shutdown_requested and cycle_count < max_cycles:
            cycle_count += 1
            logger.info(f"Starting automation cycle {cycle_count}")

            # Start new Claude session
            if not self._start_claude_session():
                logger.error("Failed to start Claude session")
                return False

            # Monitor the session
            session_ended = False
            monitoring_start = time.time()
            max_session_time = 1800  # 30 minutes max per session

            while (self.session_active and
                   not self.shutdown_requested and
                   not session_ended and
                   not self.spec_completed and  # Exit immediately if completion detected
                   time.time() - monitoring_start < max_session_time):

                session_ended = self._monitor_claude_output()

                # Check for immediate exit if completion was detected during monitoring
                if self.spec_completed:
                    logger.info("🚀 COMPLETION DETECTED DURING MONITORING - BREAKING OUT OF LOOP!")
                    break

                if not session_ended:
                    time.sleep(0.1)  # Small delay to prevent busy waiting

            # Clean up session
            if self.claude_process:
                self._shutdown_claude_session()

            # Check if we should stop immediately after session ends
            if self.spec_completed:
                logger.info("🎉 SPEC WORKFLOW AUTOMATION COMPLETED SUCCESSFULLY!")
                logger.info("✅ ALL TASKS COMPLETED. EXITING AUTOMATION.")
                logger.info("🛑 Calling sys.exit(0) to stop PM2 process...")
                sys.exit(0)  # Clean exit stops PM2 process

            if self.shutdown_requested:
                logger.info("Shutdown requested, stopping automation")
                return True

            # Wait a bit before next cycle
            if cycle_count < max_cycles:
                logger.info("Waiting before next cycle...")
                time.sleep(2)

        if cycle_count >= max_cycles:
            logger.warning(f"Reached maximum cycles ({max_cycles}), stopping automation")

        return self.spec_completed


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Automate spec-workflow task execution with Claude Code"
    )
    parser.add_argument(
        "--spec-name",
        required=True,
        help="Name of the specification to work on"
    )
    parser.add_argument(
        "--project",
        required=True,
        help="Path to the target project directory"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    parser.add_argument(
        "--session-log",
        help="File path to log JSONL session data (optional)"
    )

    # Debug options
    parser.add_argument(
        "--debug-raw",
        action="store_true",
        help="Show complete raw JSON data for all events (most verbose)"
    )
    parser.add_argument(
        "--debug-all",
        action="store_true",
        help="Show all events with full data (very verbose)"
    )
    parser.add_argument(
        "--debug-payload",
        action="store_true",
        help="Show payload structure analysis"
    )
    parser.add_argument(
        "--debug-content",
        action="store_true",
        help="Show content structure analysis"
    )
    parser.add_argument(
        "--debug-metadata",
        action="store_true",
        help="Show stream metadata"
    )
    parser.add_argument(
        "--debug-tools",
        action="store_true",
        default=True,
        help="Show tool usage details (default: enabled)"
    )
    parser.add_argument(
        "--debug-full",
        action="store_true",
        help="Don't truncate long content (show full text)"
    )
    parser.add_argument(
        "--max-content",
        type=int,
        default=500,
        help="Maximum content length before truncation (default: 500)"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        # Setup debug options based on arguments
        debug_options = {
            'show_raw_data': getattr(args, 'debug_raw', False),
            'show_payload_structure': getattr(args, 'debug_payload', False),
            'show_content_analysis': getattr(args, 'debug_content', False),
            'show_tool_details': getattr(args, 'debug_tools', True),
            'show_stream_metadata': getattr(args, 'debug_metadata', False),
            'show_all_events': getattr(args, 'debug_all', False),
            'truncate_long_content': not getattr(args, 'debug_full', False),
            'max_content_length': getattr(args, 'max_content', 500)
        }

        automation = SpecWorkflowAutomation(args.spec_name, args.project, args.session_log, debug_options)
        success = automation.run()
        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        logger.info("Automation interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Automation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()