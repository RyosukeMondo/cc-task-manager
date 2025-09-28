#!/usr/bin/env python3
"""
Compliance Checker for Claude Code Wrapper Implementations

This module provides comprehensive compliance checking for Claude Code wrapper
implementations against behavioral specifications and protocol requirements.
It validates state machine compliance, error handling patterns, and session
lifecycle management.

Requirements satisfied: 5.1, 5.2, 5.4 - Wrapper compliance validation
"""

import json
import os
import sys
import time
import subprocess
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

from schema_validator import SchemaValidator, SchemaType, ValidationResult


class ComplianceLevel(Enum):
    """Compliance testing levels"""
    BASIC = "basic"           # Protocol and schema validation only
    STANDARD = "standard"     # Includes behavioral pattern validation
    COMPREHENSIVE = "comprehensive"  # Full state machine and edge case validation


class ComplianceStatus(Enum):
    """Status of individual compliance checks"""
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    SKIP = "skip"


@dataclass
class ComplianceCheck:
    """Individual compliance check definition"""
    name: str
    description: str
    level: ComplianceLevel
    category: str
    required: bool = True
    status: ComplianceStatus = ComplianceStatus.SKIP
    details: str = ""
    error_message: str = ""


@dataclass
class ComplianceReport:
    """Comprehensive compliance validation report"""
    wrapper_name: str
    validation_date: str
    compliance_level: ComplianceLevel
    overall_status: ComplianceStatus
    compliance_score: float
    passed_checks: List[str] = field(default_factory=list)
    failed_checks: List[ComplianceCheck] = field(default_factory=list)
    warnings: List[ComplianceCheck] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    test_summary: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert report to dictionary for JSON serialization"""
        return {
            "wrapper_name": self.wrapper_name,
            "validation_date": self.validation_date,
            "compliance_level": self.compliance_level.value,
            "overall_status": self.overall_status.value,
            "compliance_score": self.compliance_score,
            "passed_checks": self.passed_checks,
            "failed_checks": [
                {
                    "name": check.name,
                    "description": check.description,
                    "category": check.category,
                    "error_message": check.error_message,
                    "details": check.details
                }
                for check in self.failed_checks
            ],
            "warnings": [
                {
                    "name": check.name,
                    "description": check.description,
                    "category": check.category,
                    "details": check.details
                }
                for check in self.warnings
            ],
            "recommendations": self.recommendations,
            "test_summary": self.test_summary
        }


class WrapperInterface:
    """
    Interface for testing Claude Code wrapper implementations.

    This class provides a standardized interface for interacting with
    wrapper implementations during compliance testing.
    """

    def __init__(self, wrapper_path: str, working_dir: Optional[str] = None):
        """
        Initialize wrapper interface.

        Args:
            wrapper_path: Path to wrapper executable or script
            working_dir: Working directory for wrapper execution
        """
        self.wrapper_path = Path(wrapper_path)
        self.working_dir = Path(working_dir) if working_dir else Path.cwd()
        self.process: Optional[subprocess.Popen] = None
        self.session_active = False

    def start_session(self, session_name: str = "compliance_test") -> bool:
        """
        Start a wrapper session for testing.

        Args:
            session_name: Name for the test session

        Returns:
            True if session started successfully
        """
        try:
            # Command to start wrapper (adjust based on actual wrapper interface)
            cmd = [str(self.wrapper_path), "--session", session_name]

            self.process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=self.working_dir,
                text=True,
                bufsize=1
            )

            self.session_active = True
            return True

        except Exception as e:
            print(f"Failed to start wrapper session: {e}")
            return False

    def send_command(self, command: Dict[str, Any], timeout: float = 30.0) -> Tuple[bool, List[Dict]]:
        """
        Send command to wrapper and collect responses.

        Args:
            command: Command dictionary to send
            timeout: Timeout for response collection

        Returns:
            Tuple of (success, list of response events)
        """
        if not self.session_active or not self.process:
            return False, []

        try:
            # Send command as JSON
            command_json = json.dumps(command) + "\n"
            self.process.stdin.write(command_json)
            self.process.stdin.flush()

            # Collect responses with timeout
            responses = []
            start_time = time.time()

            while time.time() - start_time < timeout:
                if self.process.poll() is not None:
                    break

                # Non-blocking read with timeout
                line = self.process.stdout.readline()
                if line:
                    try:
                        response = json.loads(line.strip())
                        responses.append(response)

                        # Check for completion events
                        if response.get("event") in ["run_completed", "error", "shutdown"]:
                            break

                    except json.JSONDecodeError:
                        continue

                time.sleep(0.1)

            return True, responses

        except Exception as e:
            print(f"Error sending command: {e}")
            return False, []

    def shutdown(self) -> bool:
        """
        Shutdown the wrapper session.

        Returns:
            True if shutdown successful
        """
        if not self.session_active:
            return True

        try:
            # Send shutdown command
            shutdown_cmd = {"action": "shutdown"}
            self.send_command(shutdown_cmd, timeout=10.0)

            # Terminate process if still running
            if self.process and self.process.poll() is None:
                self.process.terminate()
                self.process.wait(timeout=5.0)

            self.session_active = False
            return True

        except Exception as e:
            print(f"Error during shutdown: {e}")
            return False


class ComplianceChecker:
    """
    Comprehensive compliance checker for Claude Code wrapper implementations.

    Validates wrapper implementations against protocol specifications,
    behavioral patterns, and state machine requirements.
    """

    def __init__(self, schemas_dir: Optional[Path] = None):
        """
        Initialize compliance checker.

        Args:
            schemas_dir: Path to schema directory for validation
        """
        self.schema_validator = SchemaValidator(schemas_dir)
        self.checks: List[ComplianceCheck] = []
        self._initialize_checks()

    def _initialize_checks(self) -> None:
        """Initialize all compliance checks based on requirements"""

        # Protocol Compliance Checks (Basic Level)
        self.checks.extend([
            ComplianceCheck(
                "schema_command_validation",
                "Commands must conform to JSON schema specification",
                ComplianceLevel.BASIC,
                "Protocol",
                required=True
            ),
            ComplianceCheck(
                "schema_event_validation",
                "Events must conform to JSON schema specification",
                ComplianceLevel.BASIC,
                "Protocol",
                required=True
            ),
            ComplianceCheck(
                "required_commands_support",
                "Must support all required command types (prompt, cancel, status, shutdown)",
                ComplianceLevel.BASIC,
                "Protocol",
                required=True
            ),
            ComplianceCheck(
                "required_events_emission",
                "Must emit all required event types (ready, run_started, run_completed)",
                ComplianceLevel.BASIC,
                "Protocol",
                required=True
            )
        ])

        # Behavioral Compliance Checks (Standard Level)
        self.checks.extend([
            ComplianceCheck(
                "session_lifecycle_compliance",
                "Session must follow proper startup -> ready -> running -> completed lifecycle",
                ComplianceLevel.STANDARD,
                "Behavior",
                required=True
            ),
            ComplianceCheck(
                "cancellation_behavior",
                "Must handle cancellation requests properly with cleanup",
                ComplianceLevel.STANDARD,
                "Behavior",
                required=True
            ),
            ComplianceCheck(
                "error_handling_patterns",
                "Must emit proper error events and maintain recoverable state",
                ComplianceLevel.STANDARD,
                "Behavior",
                required=True
            ),
            ComplianceCheck(
                "timeout_behavior",
                "Must handle timeouts gracefully without hanging",
                ComplianceLevel.STANDARD,
                "Behavior",
                required=True
            )
        ])

        # Advanced Compliance Checks (Comprehensive Level)
        self.checks.extend([
            ComplianceCheck(
                "concurrent_session_handling",
                "Must handle multiple concurrent sessions properly",
                ComplianceLevel.COMPREHENSIVE,
                "Advanced",
                required=False
            ),
            ComplianceCheck(
                "state_persistence",
                "Must maintain state consistency across session lifecycle",
                ComplianceLevel.COMPREHENSIVE,
                "Advanced",
                required=False
            ),
            ComplianceCheck(
                "resource_cleanup",
                "Must properly clean up resources on shutdown or error",
                ComplianceLevel.COMPREHENSIVE,
                "Advanced",
                required=True
            ),
            ComplianceCheck(
                "edge_case_resilience",
                "Must handle edge cases like invalid JSON, network issues, etc.",
                ComplianceLevel.COMPREHENSIVE,
                "Advanced",
                required=False
            )
        ])

    def validate_wrapper(self, wrapper_path: str, level: ComplianceLevel = ComplianceLevel.STANDARD,
                         working_dir: Optional[str] = None) -> ComplianceReport:
        """
        Perform comprehensive compliance validation of wrapper implementation.

        Args:
            wrapper_path: Path to wrapper executable
            level: Compliance level to test
            working_dir: Working directory for wrapper execution

        Returns:
            ComplianceReport with detailed validation results
        """
        wrapper_name = Path(wrapper_path).name
        report = ComplianceReport(
            wrapper_name=wrapper_name,
            validation_date=time.strftime("%Y-%m-%d %H:%M:%S"),
            compliance_level=level,
            overall_status=ComplianceStatus.PASS
        )

        # Filter checks by compliance level
        applicable_checks = [
            check for check in self.checks
            if self._is_check_applicable(check, level)
        ]

        # Initialize test interface
        wrapper = WrapperInterface(wrapper_path, working_dir)

        try:
            # Run all applicable checks
            for check in applicable_checks:
                self._run_compliance_check(wrapper, check, report)

        except Exception as e:
            # Handle unexpected errors during testing
            error_check = ComplianceCheck(
                "test_execution_error",
                "Unexpected error during compliance testing",
                level,
                "System",
                required=True,
                status=ComplianceStatus.FAIL,
                error_message=str(e)
            )
            report.failed_checks.append(error_check)

        finally:
            # Ensure cleanup
            wrapper.shutdown()

        # Calculate final compliance score and status
        self._calculate_compliance_score(report, applicable_checks)

        return report

    def _is_check_applicable(self, check: ComplianceCheck, level: ComplianceLevel) -> bool:
        """Determine if a check applies to the specified compliance level"""
        level_hierarchy = {
            ComplianceLevel.BASIC: [ComplianceLevel.BASIC],
            ComplianceLevel.STANDARD: [ComplianceLevel.BASIC, ComplianceLevel.STANDARD],
            ComplianceLevel.COMPREHENSIVE: [ComplianceLevel.BASIC, ComplianceLevel.STANDARD, ComplianceLevel.COMPREHENSIVE]
        }
        return check.level in level_hierarchy[level]

    def _run_compliance_check(self, wrapper: WrapperInterface, check: ComplianceCheck,
                             report: ComplianceReport) -> None:
        """Execute individual compliance check"""

        try:
            if check.name == "schema_command_validation":
                self._check_command_schema_compliance(wrapper, check, report)
            elif check.name == "schema_event_validation":
                self._check_event_schema_compliance(wrapper, check, report)
            elif check.name == "required_commands_support":
                self._check_required_commands(wrapper, check, report)
            elif check.name == "required_events_emission":
                self._check_required_events(wrapper, check, report)
            elif check.name == "session_lifecycle_compliance":
                self._check_session_lifecycle(wrapper, check, report)
            elif check.name == "cancellation_behavior":
                self._check_cancellation_behavior(wrapper, check, report)
            elif check.name == "error_handling_patterns":
                self._check_error_handling(wrapper, check, report)
            elif check.name == "timeout_behavior":
                self._check_timeout_behavior(wrapper, check, report)
            elif check.name == "resource_cleanup":
                self._check_resource_cleanup(wrapper, check, report)
            else:
                # Skip checks that aren't implemented yet
                check.status = ComplianceStatus.SKIP
                check.details = "Check implementation pending"

        except Exception as e:
            check.status = ComplianceStatus.FAIL
            check.error_message = f"Check execution failed: {e}"

    def _check_command_schema_compliance(self, wrapper: WrapperInterface,
                                       check: ComplianceCheck, report: ComplianceReport) -> None:
        """Validate that wrapper accepts valid commands and rejects invalid ones"""

        # Test valid commands
        valid_commands = [
            {"action": "prompt", "prompt": "test prompt"},
            {"action": "status"},
            {"action": "cancel"},
            {"action": "shutdown"}
        ]

        # Test invalid commands
        invalid_commands = [
            {"action": "invalid_action"},
            {"prompt": "missing action field"},
            {"action": "prompt"},  # missing required prompt field
            {}  # empty command
        ]

        valid_count = 0
        invalid_rejected = 0

        # Start session for testing
        if not wrapper.start_session("schema_test"):
            check.status = ComplianceStatus.FAIL
            check.error_message = "Failed to start wrapper session"
            return

        # Test valid commands
        for cmd in valid_commands:
            validation_result = self.schema_validator.validate_command(cmd)
            if validation_result.is_valid:
                success, responses = wrapper.send_command(cmd, timeout=5.0)
                if success:
                    valid_count += 1

        # Test invalid commands (should be rejected)
        for cmd in invalid_commands:
            validation_result = self.schema_validator.validate_command(cmd)
            if not validation_result.is_valid:
                success, responses = wrapper.send_command(cmd, timeout=5.0)
                # Check if wrapper properly rejected invalid command
                if not success or any(r.get("event") == "error" for r in responses):
                    invalid_rejected += 1

        # Evaluate results
        if valid_count == len(valid_commands) and invalid_rejected == len(invalid_commands):
            check.status = ComplianceStatus.PASS
            check.details = f"Accepted {valid_count}/{len(valid_commands)} valid commands, rejected {invalid_rejected}/{len(invalid_commands)} invalid commands"
            report.passed_checks.append(check.name)
        else:
            check.status = ComplianceStatus.FAIL
            check.error_message = f"Command validation failed: {valid_count}/{len(valid_commands)} valid accepted, {invalid_rejected}/{len(invalid_commands)} invalid rejected"
            report.failed_checks.append(check)

    def _check_event_schema_compliance(self, wrapper: WrapperInterface,
                                     check: ComplianceCheck, report: ComplianceReport) -> None:
        """Validate that wrapper emits schema-compliant events"""

        if not wrapper.start_session("event_schema_test"):
            check.status = ComplianceStatus.FAIL
            check.error_message = "Failed to start wrapper session"
            return

        # Send a simple prompt and collect events
        test_command = {"action": "prompt", "prompt": "echo 'test'"}
        success, responses = wrapper.send_command(test_command, timeout=10.0)

        if not success:
            check.status = ComplianceStatus.FAIL
            check.error_message = "Failed to get responses from wrapper"
            return

        valid_events = 0
        invalid_events = []

        # Validate each event against schema
        for response in responses:
            validation_result = self.schema_validator.validate_event(response)
            if validation_result.is_valid:
                valid_events += 1
            else:
                invalid_events.append({
                    "event": response,
                    "errors": validation_result.errors
                })

        # Evaluate results
        if len(invalid_events) == 0:
            check.status = ComplianceStatus.PASS
            check.details = f"All {valid_events} events passed schema validation"
            report.passed_checks.append(check.name)
        else:
            check.status = ComplianceStatus.FAIL
            check.error_message = f"{len(invalid_events)} events failed schema validation"
            check.details = f"Invalid events: {invalid_events}"
            report.failed_checks.append(check)

    def _check_required_commands(self, wrapper: WrapperInterface,
                               check: ComplianceCheck, report: ComplianceReport) -> None:
        """Check that wrapper supports all required command types"""

        required_commands = ["prompt", "status", "cancel", "shutdown"]
        supported_commands = []

        if not wrapper.start_session("command_support_test"):
            check.status = ComplianceStatus.FAIL
            check.error_message = "Failed to start wrapper session"
            return

        for cmd_type in required_commands:
            if cmd_type == "prompt":
                test_cmd = {"action": cmd_type, "prompt": "test"}
            else:
                test_cmd = {"action": cmd_type}

            success, responses = wrapper.send_command(test_cmd, timeout=5.0)
            if success and responses:
                supported_commands.append(cmd_type)

        # Evaluate support
        if len(supported_commands) == len(required_commands):
            check.status = ComplianceStatus.PASS
            check.details = f"Supports all required commands: {supported_commands}"
            report.passed_checks.append(check.name)
        else:
            missing = set(required_commands) - set(supported_commands)
            check.status = ComplianceStatus.FAIL
            check.error_message = f"Missing support for commands: {list(missing)}"
            report.failed_checks.append(check)

    def _check_required_events(self, wrapper: WrapperInterface,
                             check: ComplianceCheck, report: ComplianceReport) -> None:
        """Check that wrapper emits all required event types"""

        required_events = ["ready", "run_started", "run_completed"]
        observed_events = set()

        if not wrapper.start_session("event_emission_test"):
            check.status = ComplianceStatus.FAIL
            check.error_message = "Failed to start wrapper session"
            return

        # Send test command and observe events
        test_command = {"action": "prompt", "prompt": "echo 'test'"}
        success, responses = wrapper.send_command(test_command, timeout=15.0)

        if success:
            for response in responses:
                if "event" in response:
                    observed_events.add(response["event"])

        # Evaluate event emission
        missing_events = set(required_events) - observed_events
        if len(missing_events) == 0:
            check.status = ComplianceStatus.PASS
            check.details = f"Emitted all required events: {list(observed_events)}"
            report.passed_checks.append(check.name)
        else:
            check.status = ComplianceStatus.FAIL
            check.error_message = f"Missing required events: {list(missing_events)}"
            report.failed_checks.append(check)

    def _check_session_lifecycle(self, wrapper: WrapperInterface,
                               check: ComplianceCheck, report: ComplianceReport) -> None:
        """Validate proper session lifecycle management"""

        if not wrapper.start_session("lifecycle_test"):
            check.status = ComplianceStatus.FAIL
            check.error_message = "Failed to start wrapper session"
            return

        # Monitor session lifecycle through simple command
        test_command = {"action": "prompt", "prompt": "echo 'lifecycle test'"}
        success, responses = wrapper.send_command(test_command, timeout=10.0)

        if not success:
            check.status = ComplianceStatus.FAIL
            check.error_message = "Session lifecycle test failed"
            return

        # Analyze event sequence for proper lifecycle
        events = [r.get("event") for r in responses if "event" in r]

        # Check for expected lifecycle pattern
        has_ready = "ready" in events
        has_started = "run_started" in events
        has_completed = "run_completed" in events or "error" in events

        if has_ready and has_started and has_completed:
            check.status = ComplianceStatus.PASS
            check.details = f"Proper lifecycle observed: {events}"
            report.passed_checks.append(check.name)
        else:
            check.status = ComplianceStatus.FAIL
            check.error_message = f"Incomplete lifecycle pattern: ready={has_ready}, started={has_started}, completed={has_completed}"
            report.failed_checks.append(check)

    def _check_cancellation_behavior(self, wrapper: WrapperInterface,
                                   check: ComplianceCheck, report: ComplianceReport) -> None:
        """Test cancellation behavior"""
        # This would implement cancellation testing
        # For now, mark as pending implementation
        check.status = ComplianceStatus.SKIP
        check.details = "Cancellation behavior testing not yet implemented"

    def _check_error_handling(self, wrapper: WrapperInterface,
                            check: ComplianceCheck, report: ComplianceReport) -> None:
        """Test error handling patterns"""
        # This would implement error handling testing
        check.status = ComplianceStatus.SKIP
        check.details = "Error handling testing not yet implemented"

    def _check_timeout_behavior(self, wrapper: WrapperInterface,
                              check: ComplianceCheck, report: ComplianceReport) -> None:
        """Test timeout behavior"""
        # This would implement timeout testing
        check.status = ComplianceStatus.SKIP
        check.details = "Timeout behavior testing not yet implemented"

    def _check_resource_cleanup(self, wrapper: WrapperInterface,
                              check: ComplianceCheck, report: ComplianceReport) -> None:
        """Test resource cleanup"""
        # This would implement resource cleanup testing
        check.status = ComplianceStatus.SKIP
        check.details = "Resource cleanup testing not yet implemented"

    def _calculate_compliance_score(self, report: ComplianceReport, checks: List[ComplianceCheck]) -> None:
        """Calculate overall compliance score and status"""

        total_checks = len(checks)
        passed_count = len(report.passed_checks)
        failed_count = len(report.failed_checks)
        warning_count = len(report.warnings)

        # Calculate score as percentage of passed required checks
        required_checks = [c for c in checks if c.required]
        required_passed = len([c for c in required_checks if c.name in report.passed_checks])

        if len(required_checks) > 0:
            report.compliance_score = (required_passed / len(required_checks)) * 100
        else:
            report.compliance_score = 100.0

        # Determine overall status
        if failed_count == 0:
            report.overall_status = ComplianceStatus.PASS
        elif required_passed == len(required_checks):
            report.overall_status = ComplianceStatus.WARNING
        else:
            report.overall_status = ComplianceStatus.FAIL

        # Generate summary
        report.test_summary = {
            "total_checks": total_checks,
            "passed": passed_count,
            "failed": failed_count,
            "warnings": warning_count,
            "skipped": total_checks - passed_count - failed_count - warning_count
        }

        # Generate recommendations
        if failed_count > 0:
            report.recommendations.append("Address all failed compliance checks before production use")
        if warning_count > 0:
            report.recommendations.append("Review warning items for potential improvements")
        if report.compliance_score < 100:
            report.recommendations.append("Ensure all required protocol features are properly implemented")


def main():
    """
    CLI interface for compliance checking.

    Usage:
        python compliance-checker.py <wrapper_path> [--level=<level>] [--working-dir=<dir>]
    """
    if len(sys.argv) < 2:
        print("Usage: python compliance-checker.py <wrapper_path> [--level=<level>] [--working-dir=<dir>]")
        print("Levels: basic, standard, comprehensive")
        sys.exit(1)

    wrapper_path = sys.argv[1]
    level = ComplianceLevel.STANDARD
    working_dir = None

    # Parse optional arguments
    for arg in sys.argv[2:]:
        if arg.startswith("--level="):
            level_str = arg.split("=", 1)[1].lower()
            try:
                level = ComplianceLevel(level_str)
            except ValueError:
                print(f"Invalid level: {level_str}")
                sys.exit(1)
        elif arg.startswith("--working-dir="):
            working_dir = arg.split("=", 1)[1]

    # Validate wrapper path
    if not os.path.exists(wrapper_path):
        print(f"Wrapper not found: {wrapper_path}")
        sys.exit(1)

    # Run compliance check
    checker = ComplianceChecker()
    report = checker.validate_wrapper(wrapper_path, level, working_dir)

    # Output report
    print(json.dumps(report.to_dict(), indent=2))

    # Exit with appropriate code
    if report.overall_status == ComplianceStatus.PASS:
        sys.exit(0)
    elif report.overall_status == ComplianceStatus.WARNING:
        sys.exit(1)
    else:
        sys.exit(2)


if __name__ == "__main__":
    main()