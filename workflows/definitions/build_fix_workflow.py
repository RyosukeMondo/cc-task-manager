#!/usr/bin/env python3
"""
Build Fix Workflow Implementation

This module implements the BuildFixWorkflow class that automates fixing build errors
until compilation succeeds. It supports various build systems including npm, webpack,
make, cargo, and others through configurable build commands.

Classes:
    BuildFixWorkflow: Concrete implementation for build error resolution automation

The implementation follows the FR2 requirement for build fix workflow type, providing
automated build error analysis and resolution with reliable completion detection.
"""

import logging
from typing import Dict, Any, Optional, List
from pathlib import Path

from ..core.base_workflow import BaseWorkflow, WorkflowConfig
from ..core.completion_detector import CommandResultDetector, TextPatternDetector

logger = logging.getLogger(__name__)


class BuildFixWorkflow(BaseWorkflow):
    """
    Concrete workflow implementation for automated build fix automation.

    This workflow handles the execution of build error resolution using Claude Code
    sessions with command-based completion detection. It supports multiple build
    systems and provides reliable detection of when compilation succeeds.

    The workflow continues until either:
    1. Build succeeds (completion detected)
    2. Maximum cycles reached
    3. Session timeout
    """

    def __init__(self, config: WorkflowConfig):
        """
        Initialize the build fix workflow with configuration.

        Args:
            config (WorkflowConfig): Workflow configuration with build_command set

        Raises:
            ValueError: If configuration is invalid for build fix workflow
        """
        super().__init__(config)

        # Ensure we have a build command for build fix workflows
        if not config.build_command:
            # This will be auto-detected in config validation
            logger.info("No build command specified, will auto-detect based on project structure")

        # Configure build-specific completion detectors
        self.command_detector = CommandResultDetector(
            command_patterns={
                "build": [
                    "build successful",
                    "compilation completed",
                    "build completed successfully",
                    "no build errors",
                    "built successfully",
                    "compilation successful",
                    "✓ build completed",
                    "✅ build succeeded",
                    "0 errors",
                    "0 error",
                    "compiled successfully",
                    "bundle created successfully",
                    # Framework-specific patterns
                    "webpack compiled successfully",  # Webpack
                    "Build succeeded",               # .NET
                    "DONE  Compiled successfully",   # Vue CLI
                    "Compiled successfully!",        # Create React App
                    "Built at:",                     # Webpack dev server
                    "Built target",                  # Webpack
                    "Finished",                      # Cargo
                    "Build finished successfully",   # General
                    "Successfully built",            # Docker/general
                    "make: Nothing to be done",      # Make (already built)
                    "up to date",                    # npm/yarn when nothing to build
                    "Done in",                       # Yarn completion
                    "found 0 vulnerabilities",      # npm build completion
                    "0 packages are looking for funding",  # npm completion
                    "Compiling typescript..."        # TypeScript success
                ]
            },
            debug_enabled=config.debug_options.get('show_tool_details', True)
        )

        # Text pattern detector for additional build completion phrases
        self.text_detector = TextPatternDetector(
            patterns=[
                "build process completed successfully",
                "compilation finished without errors",
                "build is now clean",
                "no more build errors",
                "build errors are fixed",
                "compilation succeeded",
                "build output generated successfully",
                "no compilation errors detected",
                "build completed without issues",
                "project built successfully"
            ],
            case_sensitive=False,
            debug_enabled=config.debug_options.get('show_tool_details', True)
        )

        logger.info(f"Initialized BuildFixWorkflow with build command: '{config.build_command}'")

    def validate_config(self) -> None:
        """
        Validate that the configuration is appropriate for build fix workflow.

        Extends base validation with build-fix specific requirements.

        Raises:
            ValueError: If configuration is invalid for build fix workflows
        """
        super().validate_config()

        # Verify this is a build-fix workflow type
        if self.config.workflow_type != 'build-fix':
            raise ValueError(f"BuildFixWorkflow requires workflow_type='build-fix', got '{self.config.workflow_type}'")

        # Verify build command is available (auto-detection should have set it)
        if not self.config.build_command:
            raise ValueError("BuildFixWorkflow requires build_command to be set or auto-detectable")

        # Validate that build command is reasonable
        if not self.config.build_command.strip():
            raise ValueError("build_command cannot be empty or whitespace")

        logger.debug(f"BuildFixWorkflow configuration validated with command: '{self.config.build_command}'")

    def get_workflow_prompt(self) -> str:
        """
        Generate the prompt for Claude Code execution focused on build fixing.

        Creates a comprehensive prompt that instructs Claude to analyze build failures,
        identify root causes, and implement fixes until compilation succeeds.

        Returns:
            str: Formatted prompt for Claude Code focused on build error resolution
        """
        prompt = f"""Fix build errors in this project until compilation succeeds.

OBJECTIVE: Analyze and fix all build errors in the codebase systematically.

WORKFLOW:
1. Run build to identify failures: `{self.config.build_command}`
2. Analyze each build error carefully:
   - Read compilation error messages and warnings
   - Examine stack traces and file locations
   - Identify the root cause (syntax errors, missing dependencies, configuration issues)
3. Fix the underlying issues:
   - Implement necessary code changes to resolve compilation errors
   - Update configuration files if needed (tsconfig.json, webpack.config.js, etc.)
   - Install missing dependencies if required
   - Ensure fixes don't introduce new issues
4. Re-run build to verify fixes: `{self.config.build_command}`
5. Repeat until build succeeds completely

IMPORTANT GUIDELINES:
- Focus on fixing actual compilation errors, not just warnings
- Read and understand error messages carefully before making changes
- Make minimal, targeted fixes rather than broad changes
- Run builds frequently to verify progress
- Pay attention to dependency issues and version conflicts
- Ensure type safety and maintain code quality
- Check for configuration file issues (tsconfig, webpack, babel, etc.)

COMMON BUILD ERROR TYPES:
- Syntax errors in source code
- Type errors in TypeScript projects
- Missing or incorrect imports/exports
- Dependency version conflicts
- Configuration file issues
- Missing build tools or plugins
- Environment variable problems

COMPLETION CRITERIA:
- Build completes successfully
- No compilation errors remain
- Build command exits with success status
- All necessary output files are generated

BUILD COMMAND: {self.config.build_command}

Begin by running the build to see current errors, then systematically fix each issue."""

        logger.debug(f"Generated build fix workflow prompt with command: '{self.config.build_command}'")
        return prompt

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect if the build fix workflow has completed successfully.

        Uses both command result detection and text pattern detection to identify
        when the build is successful. This provides robust completion detection
        across different build systems and output formats.

        Args:
            output_data (Dict[str, Any]): Output data from Claude Code session

        Returns:
            bool: True if build workflow is complete (build successful), False otherwise
        """
        # Try command result detection first (most reliable)
        if self.command_detector.detect_completion(output_data):
            logger.info(f"🎉 Build fix completion detected via command result for build command: '{self.config.build_command}'")
            self.completed = True
            return True

        # Try text pattern detection as backup
        if self.text_detector.detect_completion(output_data):
            logger.info(f"🎉 Build fix completion detected via text pattern")
            self.completed = True
            return True

        return False

    def get_execution_options(self) -> Dict[str, Any]:
        """
        Get execution options for Claude Code session optimized for build fixing.

        Configures the session for build-focused work with appropriate permissions
        and working directory settings.

        Returns:
            Dict[str, Any]: Options for Claude Code execution optimized for building
        """
        options = {
            "cwd": str(self.config.project_path),
            "exit_on_complete": True,
            "permission_mode": "bypassPermissions"
        }

        logger.debug(f"Generated execution options for build fix workflow")
        return options

    def prepare_workflow_session(self) -> bool:
        """
        Prepare for build fix workflow execution.

        Performs build-specific preparation including validation of build environment
        and ensuring build command is available.

        Returns:
            bool: True if preparation successful, False otherwise
        """
        try:
            # Check if build command looks valid by examining common build files
            build_files_exist = self._check_for_build_files()

            if not build_files_exist:
                logger.warning("No build configuration files detected in project structure")
                logger.info("Will proceed anyway - build setup might be in different locations")

            # Log preparation completion
            logger.info(f"Build fix workflow preparation completed with command: '{self.config.build_command}'")
            return True

        except Exception as e:
            logger.error(f"Build fix workflow preparation failed: {e}")
            return False

    def _check_for_build_files(self) -> bool:
        """
        Check if the project has recognizable build configuration files.

        Returns:
            bool: True if build files are found, False otherwise
        """
        # Common build configuration files
        build_files = [
            "package.json",      # npm/yarn projects
            "tsconfig.json",     # TypeScript projects
            "webpack.config.js", # Webpack projects
            "webpack.config.ts", # TypeScript webpack config
            "vite.config.js",    # Vite projects
            "vite.config.ts",    # TypeScript vite config
            "rollup.config.js",  # Rollup projects
            "Cargo.toml",        # Rust projects
            "Makefile",          # Make projects
            "build.gradle",      # Gradle projects
            "pom.xml",           # Maven projects
            "CMakeLists.txt",    # CMake projects
            "meson.build",       # Meson projects
            "pyproject.toml",    # Python projects with build config
            "setup.py",          # Python setup files
            ".babelrc",          # Babel configuration
            "babel.config.js",   # Babel configuration
            "next.config.js",    # Next.js configuration
            "nuxt.config.js",    # Nuxt.js configuration
            "vue.config.js",     # Vue CLI configuration
        ]

        for build_file in build_files:
            if (self.config.project_path / build_file).exists():
                logger.debug(f"Found build configuration file: {build_file}")
                return True

        return False

    def cleanup_workflow_session(self) -> None:
        """
        Clean up after build fix workflow execution.

        Performs build-specific cleanup tasks while preserving any important
        build logs or artifacts for debugging purposes.
        """
        try:
            # Log session completion
            if self.completed:
                logger.info(f"✅ Build fix workflow completed successfully - build now succeeds!")
            else:
                logger.info(f"🔄 Build fix workflow session ended - build may still be failing")

            # Any additional cleanup specific to build workflows
            # (Currently none needed, but extension point for future requirements)

        except Exception as e:
            logger.warning(f"Error during build fix workflow cleanup: {e}")

    def get_completion_detectors(self) -> List:
        """
        Get build-fix specific completion detectors.

        Returns the configured detectors for robust build completion detection
        across different frameworks and output formats.

        Returns:
            List[CompletionDetector]: List containing build completion detectors
        """
        return [self.command_detector, self.text_detector]

    def get_status_info(self) -> Dict[str, Any]:
        """
        Get current build fix workflow status information.

        Extends base status with build-fix specific information for monitoring
        and debugging purposes.

        Returns:
            Dict[str, Any]: Enhanced status information dictionary
        """
        status = super().get_status_info()

        # Add build-fix specific status information
        status.update({
            "build_command": self.config.build_command,
            "workflow_implementation": "BuildFixWorkflow",
            "detector_types": ["CommandResultDetector", "TextPatternDetector"],
            "build_systems_supported": "npm, webpack, make, cargo, gradle, maven, and others"
        })

        return status

    def __str__(self) -> str:
        """String representation of the build fix workflow."""
        return f"BuildFixWorkflow(build_command='{self.config.build_command}', " \
               f"project={self.config.project_path.name}, " \
               f"completed={self.completed})"

    def __repr__(self) -> str:
        """Detailed string representation of the build fix workflow."""
        return f"BuildFixWorkflow(" \
               f"build_command='{self.config.build_command}', " \
               f"project_path='{self.config.project_path}', " \
               f"session_active={self.session_active}, " \
               f"completed={self.completed}, " \
               f"max_cycles={self.config.max_cycles})"


def create_build_fix_workflow(project_path: Path, build_command: Optional[str] = None, **kwargs) -> BuildFixWorkflow:
    """
    Factory function to create a BuildFixWorkflow instance with configuration.

    Provides a convenient way to create build fix workflows while ensuring
    proper configuration and build command detection.

    Args:
        project_path (Path): Path to the target project directory
        build_command (Optional[str]): Build command to use (auto-detected if None)
        **kwargs: Additional configuration parameters

    Returns:
        BuildFixWorkflow: Configured build fix workflow instance

    Example:
        workflow = create_build_fix_workflow(
            project_path=Path("/path/to/project"),
            build_command="npm run build",
            max_cycles=15
        )
    """
    # Ensure project_path is a Path object
    if isinstance(project_path, str):
        project_path = Path(project_path)

    # Create configuration with build-fix workflow defaults
    config = WorkflowConfig(
        workflow_type='build-fix',
        project_path=project_path,
        build_command=build_command,  # Will be auto-detected if None
        **kwargs
    )

    # Create and return the workflow
    return BuildFixWorkflow(config)