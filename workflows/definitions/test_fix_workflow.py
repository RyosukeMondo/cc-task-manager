#!/usr/bin/env python3
"""
Test Fix Workflow Implementation

This module implements the TestFixWorkflow class that automates fixing failing tests
until all tests pass. It supports multiple testing frameworks including npm test,
pytest, jest, and others through configurable test commands.

Classes:
    TestFixWorkflow: Concrete implementation for test failure resolution automation

The implementation follows the FR2 requirement for test fix workflow type, providing
automated test failure analysis and resolution with reliable completion detection.
"""

import logging
from typing import Dict, Any, Optional, List
from pathlib import Path

from ..core.base_workflow import BaseWorkflow, WorkflowConfig
from ..core.completion_detector import CommandResultDetector, TextPatternDetector

logger = logging.getLogger(__name__)


class TestFixWorkflow(BaseWorkflow):
    """
    Concrete workflow implementation for automated test fix automation.

    This workflow handles the execution of test failure resolution using Claude Code
    sessions with command-based completion detection. It supports multiple testing
    frameworks and provides reliable detection of when all tests pass.

    The workflow continues until either:
    1. All tests pass (completion detected)
    2. Maximum cycles reached
    3. Session timeout
    """

    def __init__(self, config: WorkflowConfig):
        """
        Initialize the test fix workflow with configuration.

        Args:
            config (WorkflowConfig): Workflow configuration with test_command set

        Raises:
            ValueError: If configuration is invalid for test fix workflow
        """
        super().__init__(config)

        # Ensure we have a test command for test fix workflows
        if not config.test_command:
            # This will be auto-detected in config validation
            logger.info("No test command specified, will auto-detect based on project structure")

        # Configure test-specific completion detectors
        self.command_detector = CommandResultDetector(
            command_patterns={
                "test": [
                    "all tests passing",
                    "test suite completed successfully",
                    "0 failing tests",
                    "tests passed",
                    "✓ all tests passed",
                    "passed, 0 failed",
                    "0 failed,",
                    "All tests passed!",
                    "0 failures",
                    "ran 0 tests, passed 0",  # Edge case for no tests
                    "no tests to run",
                    "test run completed",
                    "✅ all tests passed",
                    # Framework-specific patterns
                    "Test Suites: 0 failed",  # Jest
                    "Tests: 0 failed",        # Jest
                    "PASS ",                  # Jest pass indicator
                    "passed (0.0",           # Pytest with timing
                    "0 error",               # General
                    "0 failure",             # General
                ]
            },
            debug_enabled=config.debug_options.get('show_tool_details', True)
        )

        # Text pattern detector for additional test completion phrases
        self.text_detector = TextPatternDetector(
            patterns=[
                "all tests are now passing",
                "test suite is now clean",
                "no more failing tests",
                "tests are fixed",
                "all tests pass successfully",
                "test execution completed without errors",
                "no test failures detected"
            ],
            case_sensitive=False,
            debug_enabled=config.debug_options.get('show_tool_details', True)
        )

        logger.info(f"Initialized TestFixWorkflow with test command: '{config.test_command}'")

    def validate_config(self) -> None:
        """
        Validate that the configuration is appropriate for test fix workflow.

        Extends base validation with test-fix specific requirements.

        Raises:
            ValueError: If configuration is invalid for test fix workflows
        """
        super().validate_config()

        # Verify this is a test-fix workflow type
        if self.config.workflow_type != 'test-fix':
            raise ValueError(f"TestFixWorkflow requires workflow_type='test-fix', got '{self.config.workflow_type}'")

        # Verify test command is available (auto-detection should have set it)
        if not self.config.test_command:
            raise ValueError("TestFixWorkflow requires test_command to be set or auto-detectable")

        # Validate that test command is reasonable
        if not self.config.test_command.strip():
            raise ValueError("test_command cannot be empty or whitespace")

        logger.debug(f"TestFixWorkflow configuration validated with command: '{self.config.test_command}'")

    def get_workflow_prompt(self) -> str:
        """
        Generate the prompt for Claude Code execution focused on test fixing.

        Creates a comprehensive prompt that instructs Claude to analyze test failures,
        identify root causes, and implement fixes until all tests pass.

        Returns:
            str: Formatted prompt for Claude Code focused on test failure resolution
        """
        prompt = f"""Fix failing tests in this project until all tests pass.

OBJECTIVE: Analyze and fix all failing tests in the codebase systematically.

WORKFLOW:
1. Run tests to identify failures: `{self.config.test_command}`
2. Analyze each test failure carefully:
   - Read the test file and understand what it's testing
   - Examine error messages and stack traces
   - Identify the root cause (code bug vs test issue)
3. Fix the underlying issues:
   - Implement necessary code changes to make tests pass
   - Update test files only if they contain actual errors
   - Ensure fixes don't break other functionality
4. Re-run tests to verify fixes: `{self.config.test_command}`
5. Repeat until ALL tests pass

IMPORTANT GUIDELINES:
- Focus on fixing the actual code, not just making tests pass
- Read and understand test intent before making changes
- Make minimal, targeted fixes rather than broad changes
- Run tests frequently to verify progress
- If a test is genuinely wrong, explain why before fixing it
- Ensure type safety and maintain code quality

COMPLETION CRITERIA:
- All tests pass successfully
- No failing tests remain
- Test command exits with success status

TEST COMMAND: {self.config.test_command}

Begin by running the tests to see current failures, then systematically fix each issue."""

        logger.debug(f"Generated test fix workflow prompt with command: '{self.config.test_command}'")
        return prompt

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect if the test fix workflow has completed successfully.

        Uses both command result detection and text pattern detection to identify
        when all tests are passing. This provides robust completion detection
        across different testing frameworks and output formats.

        Args:
            output_data (Dict[str, Any]): Output data from Claude Code session

        Returns:
            bool: True if test workflow is complete (all tests passing), False otherwise
        """
        # Try command result detection first (most reliable)
        if self.command_detector.detect_completion(output_data):
            logger.info(f"🎉 Test fix completion detected via command result for test command: '{self.config.test_command}'")
            self.completed = True
            return True

        # Try text pattern detection as backup
        if self.text_detector.detect_completion(output_data):
            logger.info(f"🎉 Test fix completion detected via text pattern")
            self.completed = True
            return True

        return False

    def get_execution_options(self) -> Dict[str, Any]:
        """
        Get execution options for Claude Code session optimized for test fixing.

        Configures the session for test-focused work with appropriate permissions
        and working directory settings.

        Returns:
            Dict[str, Any]: Options for Claude Code execution optimized for testing
        """
        options = {
            "cwd": str(self.config.project_path),
            "exit_on_complete": True,
            "permission_mode": "bypassPermissions"
        }

        logger.debug(f"Generated execution options for test fix workflow")
        return options

    def prepare_workflow_session(self) -> bool:
        """
        Prepare for test fix workflow execution.

        Performs test-specific preparation including validation of test environment
        and ensuring test command is available.

        Returns:
            bool: True if preparation successful, False otherwise
        """
        try:
            # Check if test command looks valid by examining common test files
            test_files_exist = self._check_for_test_files()

            if not test_files_exist:
                logger.warning("No test files detected in project structure")
                logger.info("Will proceed anyway - tests might be in different locations or patterns")

            # Log preparation completion
            logger.info(f"Test fix workflow preparation completed with command: '{self.config.test_command}'")
            return True

        except Exception as e:
            logger.error(f"Test fix workflow preparation failed: {e}")
            return False

    def _check_for_test_files(self) -> bool:
        """
        Check if the project has recognizable test files.

        Returns:
            bool: True if test files are found, False otherwise
        """
        # Common test file patterns
        test_patterns = [
            "**/test*.py",     # Python test files
            "**/test_*.py",    # Python test files
            "**/*_test.py",    # Python test files
            "**/test/**/*.py", # Python test directory
            "**/tests/**/*.py", # Python tests directory
            "**/*.test.js",    # JavaScript test files
            "**/*.test.ts",    # TypeScript test files
            "**/*.spec.js",    # JavaScript spec files
            "**/*.spec.ts",    # TypeScript spec files
            "**/test/**/*.js", # JavaScript test directory
            "**/tests/**/*.js", # JavaScript tests directory
            "**/test/**/*.ts", # TypeScript test directory
            "**/tests/**/*.ts", # TypeScript tests directory
        ]

        for pattern in test_patterns:
            test_files = list(self.config.project_path.glob(pattern))
            if test_files:
                logger.debug(f"Found test files matching pattern {pattern}: {len(test_files)} files")
                return True

        return False

    def cleanup_workflow_session(self) -> None:
        """
        Clean up after test fix workflow execution.

        Performs test-specific cleanup tasks while preserving any important
        test logs or reports for debugging purposes.
        """
        try:
            # Log session completion
            if self.completed:
                logger.info(f"✅ Test fix workflow completed successfully - all tests now passing!")
            else:
                logger.info(f"🔄 Test fix workflow session ended - tests may still be failing")

            # Any additional cleanup specific to test workflows
            # (Currently none needed, but extension point for future requirements)

        except Exception as e:
            logger.warning(f"Error during test fix workflow cleanup: {e}")

    def get_completion_detectors(self) -> List:
        """
        Get test-fix specific completion detectors.

        Returns the configured detectors for robust test completion detection
        across different frameworks and output formats.

        Returns:
            List[CompletionDetector]: List containing test completion detectors
        """
        return [self.command_detector, self.text_detector]

    def get_status_info(self) -> Dict[str, Any]:
        """
        Get current test fix workflow status information.

        Extends base status with test-fix specific information for monitoring
        and debugging purposes.

        Returns:
            Dict[str, Any]: Enhanced status information dictionary
        """
        status = super().get_status_info()

        # Add test-fix specific status information
        status.update({
            "test_command": self.config.test_command,
            "workflow_implementation": "TestFixWorkflow",
            "detector_types": ["CommandResultDetector", "TextPatternDetector"],
            "test_frameworks_supported": "npm, pytest, jest, cargo, and others"
        })

        return status

    def __str__(self) -> str:
        """String representation of the test fix workflow."""
        return f"TestFixWorkflow(test_command='{self.config.test_command}', " \
               f"project={self.config.project_path.name}, " \
               f"completed={self.completed})"

    def __repr__(self) -> str:
        """Detailed string representation of the test fix workflow."""
        return f"TestFixWorkflow(" \
               f"test_command='{self.config.test_command}', " \
               f"project_path='{self.config.project_path}', " \
               f"session_active={self.session_active}, " \
               f"completed={self.completed}, " \
               f"max_cycles={self.config.max_cycles})"


def create_test_fix_workflow(project_path: Path, test_command: Optional[str] = None, **kwargs) -> TestFixWorkflow:
    """
    Factory function to create a TestFixWorkflow instance with configuration.

    Provides a convenient way to create test fix workflows while ensuring
    proper configuration and test command detection.

    Args:
        project_path (Path): Path to the target project directory
        test_command (Optional[str]): Test command to use (auto-detected if None)
        **kwargs: Additional configuration parameters

    Returns:
        TestFixWorkflow: Configured test fix workflow instance

    Example:
        workflow = create_test_fix_workflow(
            project_path=Path("/path/to/project"),
            test_command="npm test",
            max_cycles=15
        )
    """
    # Ensure project_path is a Path object
    if isinstance(project_path, str):
        project_path = Path(project_path)

    # Create configuration with test-fix workflow defaults
    config = WorkflowConfig(
        workflow_type='test-fix',
        project_path=project_path,
        test_command=test_command,  # Will be auto-detected if None
        **kwargs
    )

    # Create and return the workflow
    return TestFixWorkflow(config)