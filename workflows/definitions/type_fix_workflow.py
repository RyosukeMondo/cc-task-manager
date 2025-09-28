#!/usr/bin/env python3
"""
Type Fix Workflow Implementation

This module implements the TypeFixWorkflow class that automates fixing type errors
until type checking passes. It supports multiple type checkers including TypeScript tsc,
Python mypy, and others through configurable type check commands.

Classes:
    TypeFixWorkflow: Concrete implementation for type error resolution automation

The implementation follows the FR2 requirement for type fix workflow type, providing
automated type error analysis and resolution with reliable completion detection.
"""

import logging
from typing import Dict, Any, Optional, List
from pathlib import Path

from ..core.base_workflow import BaseWorkflow, WorkflowConfig
from ..core.completion_detector import CommandResultDetector, TextPatternDetector

logger = logging.getLogger(__name__)


class TypeFixWorkflow(BaseWorkflow):
    """
    Concrete workflow implementation for automated type error fix automation.

    This workflow handles the execution of type error resolution using Claude Code
    sessions with command-based completion detection. It supports multiple type checkers
    and provides reliable detection of when type checking passes.

    The workflow continues until either:
    1. Type checking passes (completion detected)
    2. Maximum cycles reached
    3. Session timeout
    """

    def __init__(self, config: WorkflowConfig):
        """
        Initialize the type fix workflow with configuration.

        Args:
            config (WorkflowConfig): Workflow configuration with type_check_command set

        Raises:
            ValueError: If configuration is invalid for type fix workflow
        """
        super().__init__(config)

        # Ensure we have a type check command for type fix workflows
        if not config.type_check_command:
            # This will be auto-detected in config validation
            logger.info("No type check command specified, will auto-detect based on project structure")

        # Configure type-specific completion detectors
        self.command_detector = CommandResultDetector(
            command_patterns={
                "typecheck": [
                    "no type errors",
                    "type checking successful",
                    "found 0 errors",
                    "type check passed",
                    "✓ type check passed",
                    "0 errors found",
                    "Success: no issues found",
                    "No errors found",
                    "All files pass type checking",
                    "Type checking completed successfully",
                    "✅ type check successful",
                    # TypeScript-specific patterns
                    "Found 0 errors",              # tsc output
                    "Compilation complete",        # tsc success
                    "tsc --noEmit completed",     # tsc noEmit success
                    "No TypeScript errors",       # Custom messages
                    # Python mypy-specific patterns
                    "Success: no issues found",   # mypy success
                    "mypy: Success",              # mypy success variant
                    "0 error",                    # mypy error count
                    "0 note",                     # mypy note count
                    # Generic success patterns
                    "✓",                          # Check mark
                    "PASSED",                     # Generic pass
                    "OK",                         # Generic OK
                    "All good",                   # Informal success
                ]
            },
            debug_enabled=config.debug_options.get('show_tool_details', True)
        )

        # Text pattern detector for additional type completion phrases
        self.text_detector = TextPatternDetector(
            patterns=[
                "all type errors are now fixed",
                "type checking is now clean",
                "no more type errors",
                "types are fixed",
                "all type checks pass successfully",
                "type checking completed without errors",
                "no type errors detected",
                "type system is satisfied",
                "static type analysis passed",
                "type validation successful"
            ],
            case_sensitive=False,
            debug_enabled=config.debug_options.get('show_tool_details', True)
        )

        logger.info(f"Initialized TypeFixWorkflow with type check command: '{config.type_check_command}'")

    def validate_config(self) -> None:
        """
        Validate that the configuration is appropriate for type fix workflow.

        Extends base validation with type-fix specific requirements.

        Raises:
            ValueError: If configuration is invalid for type fix workflows
        """
        super().validate_config()

        # Verify this is a type-fix workflow type
        if self.config.workflow_type != 'type-fix':
            raise ValueError(f"TypeFixWorkflow requires workflow_type='type-fix', got '{self.config.workflow_type}'")

        # Verify type check command is available (auto-detection should have set it)
        if not self.config.type_check_command:
            raise ValueError("TypeFixWorkflow requires type_check_command to be set or auto-detectable")

        # Validate that type check command is reasonable
        if not self.config.type_check_command.strip():
            raise ValueError("type_check_command cannot be empty or whitespace")

        logger.debug(f"TypeFixWorkflow configuration validated with command: '{self.config.type_check_command}'")

    def get_workflow_prompt(self) -> str:
        """
        Generate the prompt for Claude Code execution focused on type error fixing.

        Creates a comprehensive prompt that instructs Claude to analyze type errors,
        identify root causes, and implement fixes until type checking passes.

        Returns:
            str: Formatted prompt for Claude Code focused on type error resolution
        """
        prompt = f"""Fix type errors in this project until type checking passes completely.

OBJECTIVE: Analyze and fix all type errors in the codebase systematically.

WORKFLOW:
1. Run type checking to identify errors: `{self.config.type_check_command}`
2. Analyze each type error carefully:
   - Read the error message and understand the type mismatch
   - Examine the source code and identify the root cause
   - Determine if it's a genuine type issue or incorrect type annotations
3. Fix the underlying type issues:
   - Add missing type annotations where needed
   - Fix incorrect type declarations
   - Resolve type mismatches in function calls and assignments
   - Update interface/type definitions as necessary
   - Ensure generic types are properly constrained
4. Re-run type checking to verify fixes: `{self.config.type_check_command}`
5. Repeat until ALL type errors are resolved

IMPORTANT GUIDELINES:
- Focus on fixing actual type safety issues, not just satisfying the checker
- Maintain type safety - don't use 'any' or type assertions unless absolutely necessary
- Prefer explicit type annotations over implicit ones for clarity
- Make minimal, targeted fixes rather than broad changes
- Run type checker frequently to verify progress
- Understand the intent of the code before changing types
- Ensure changes don't break runtime functionality

COMPLETION CRITERIA:
- Type checking passes with zero errors
- No type errors remain in the codebase
- Type check command exits with success status

TYPE CHECK COMMAND: {self.config.type_check_command}

Begin by running the type checker to see current errors, then systematically fix each type issue."""

        logger.debug(f"Generated type fix workflow prompt with command: '{self.config.type_check_command}'")
        return prompt

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect if the type fix workflow has completed successfully.

        Uses both command result detection and text pattern detection to identify
        when type checking is passing. This provides robust completion detection
        across different type checkers and output formats.

        Args:
            output_data (Dict[str, Any]): Output data from Claude Code session

        Returns:
            bool: True if type workflow is complete (type checking passes), False otherwise
        """
        # Try command result detection first (most reliable)
        if self.command_detector.detect_completion(output_data):
            logger.info(f"🎉 Type fix completion detected via command result for type check command: '{self.config.type_check_command}'")
            self.completed = True
            return True

        # Try text pattern detection as backup
        if self.text_detector.detect_completion(output_data):
            logger.info(f"🎉 Type fix completion detected via text pattern")
            self.completed = True
            return True

        return False

    def get_execution_options(self) -> Dict[str, Any]:
        """
        Get execution options for Claude Code session optimized for type fixing.

        Configures the session for type-focused work with appropriate permissions
        and working directory settings.

        Returns:
            Dict[str, Any]: Options for Claude Code execution optimized for type checking
        """
        options = {
            "cwd": str(self.config.project_path),
            "exit_on_complete": True,
            "permission_mode": "bypassPermissions"
        }

        logger.debug(f"Generated execution options for type fix workflow")
        return options

    def prepare_workflow_session(self) -> bool:
        """
        Prepare for type fix workflow execution.

        Performs type-specific preparation including validation of type checking environment
        and ensuring type check command is available.

        Returns:
            bool: True if preparation successful, False otherwise
        """
        try:
            # Check if type check command looks valid by examining common type-related files
            type_files_exist = self._check_for_type_files()

            if not type_files_exist:
                logger.warning("No type configuration files detected in project structure")
                logger.info("Will proceed anyway - types might be configured differently")

            # Log preparation completion
            logger.info(f"Type fix workflow preparation completed with command: '{self.config.type_check_command}'")
            return True

        except Exception as e:
            logger.error(f"Type fix workflow preparation failed: {e}")
            return False

    def _check_for_type_files(self) -> bool:
        """
        Check if the project has recognizable type configuration files.

        Returns:
            bool: True if type files are found, False otherwise
        """
        # Common type configuration files
        type_config_files = [
            "tsconfig.json",      # TypeScript config
            "jsconfig.json",      # JavaScript with types config
            "mypy.ini",           # Python mypy config
            "pyproject.toml",     # Python project config (may have mypy section)
            ".mypy.ini",          # Alternative mypy config
            "setup.cfg",          # Python setup config (may have mypy section)
            "tox.ini",            # Python tox config (may have mypy section)
        ]

        for config_file in type_config_files:
            if (self.config.project_path / config_file).exists():
                logger.debug(f"Found type configuration file: {config_file}")
                return True

        # Also check for TypeScript/JavaScript files with types
        ts_patterns = [
            "**/*.ts",     # TypeScript files
            "**/*.tsx",    # TypeScript React files
            "**/*.d.ts",   # TypeScript definition files
        ]

        for pattern in ts_patterns:
            type_files = list(self.config.project_path.glob(pattern))
            if type_files:
                logger.debug(f"Found TypeScript files matching pattern {pattern}: {len(type_files)} files")
                return True

        # Check for Python files with type annotations (sample a few)
        py_files = list(self.config.project_path.glob("**/*.py"))[:10]  # Sample first 10
        for py_file in py_files:
            try:
                content = py_file.read_text(encoding='utf-8')
                if any(keyword in content for keyword in ['typing.', 'from typing', ': str', ': int', ': bool', '-> ']):
                    logger.debug(f"Found Python file with type annotations: {py_file.name}")
                    return True
            except Exception:
                continue  # Skip files we can't read

        return False

    def cleanup_workflow_session(self) -> None:
        """
        Clean up after type fix workflow execution.

        Performs type-specific cleanup tasks while preserving any important
        type checking logs or reports for debugging purposes.
        """
        try:
            # Log session completion
            if self.completed:
                logger.info(f"✅ Type fix workflow completed successfully - type checking now passes!")
            else:
                logger.info(f"🔄 Type fix workflow session ended - type errors may still remain")

            # Any additional cleanup specific to type workflows
            # (Currently none needed, but extension point for future requirements)

        except Exception as e:
            logger.warning(f"Error during type fix workflow cleanup: {e}")

    def get_completion_detectors(self) -> List:
        """
        Get type-fix specific completion detectors.

        Returns the configured detectors for robust type completion detection
        across different type checkers and output formats.

        Returns:
            List[CompletionDetector]: List containing type completion detectors
        """
        return [self.command_detector, self.text_detector]

    def get_status_info(self) -> Dict[str, Any]:
        """
        Get current type fix workflow status information.

        Extends base status with type-fix specific information for monitoring
        and debugging purposes.

        Returns:
            Dict[str, Any]: Enhanced status information dictionary
        """
        status = super().get_status_info()

        # Add type-fix specific status information
        status.update({
            "type_check_command": self.config.type_check_command,
            "workflow_implementation": "TypeFixWorkflow",
            "detector_types": ["CommandResultDetector", "TextPatternDetector"],
            "type_checkers_supported": "TypeScript tsc, Python mypy, and others"
        })

        return status

    def __str__(self) -> str:
        """String representation of the type fix workflow."""
        return f"TypeFixWorkflow(type_check_command='{self.config.type_check_command}', " \
               f"project={self.config.project_path.name}, " \
               f"completed={self.completed})"

    def __repr__(self) -> str:
        """Detailed string representation of the type fix workflow."""
        return f"TypeFixWorkflow(" \
               f"type_check_command='{self.config.type_check_command}', " \
               f"project_path='{self.config.project_path}', " \
               f"session_active={self.session_active}, " \
               f"completed={self.completed}, " \
               f"max_cycles={self.config.max_cycles})"


def create_type_fix_workflow(project_path: Path, type_check_command: Optional[str] = None, **kwargs) -> TypeFixWorkflow:
    """
    Factory function to create a TypeFixWorkflow instance with configuration.

    Provides a convenient way to create type fix workflows while ensuring
    proper configuration and type check command detection.

    Args:
        project_path (Path): Path to the target project directory
        type_check_command (Optional[str]): Type check command to use (auto-detected if None)
        **kwargs: Additional configuration parameters

    Returns:
        TypeFixWorkflow: Configured type fix workflow instance

    Example:
        workflow = create_type_fix_workflow(
            project_path=Path("/path/to/project"),
            type_check_command="npx tsc --noEmit",
            max_cycles=15
        )
    """
    # Ensure project_path is a Path object
    if isinstance(project_path, str):
        project_path = Path(project_path)

    # Create configuration with type-fix workflow defaults
    config = WorkflowConfig(
        workflow_type='type-fix',
        project_path=project_path,
        type_check_command=type_check_command,  # Will be auto-detected if None
        **kwargs
    )

    # Create and return the workflow
    return TypeFixWorkflow(config)