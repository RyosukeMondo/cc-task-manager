#!/usr/bin/env python3
"""
Spec Workflow Implementation

This module implements the SpecWorkflow class that migrates the existing
spec-workflow automation functionality to the new architecture. It ensures
100% backward compatibility with the current spec_workflow_automation.py
while leveraging the new pluggable workflow system.

Classes:
    SpecWorkflow: Concrete implementation for spec-workflow automation

The implementation follows the NFR3 requirement for backward compatibility,
preserving all existing behavior and prompt patterns from the legacy automation.
"""

import logging
from typing import Dict, Any, Optional, List
from pathlib import Path

from ..core.base_workflow import BaseWorkflow, WorkflowConfig
from ..core.completion_detector import SpecWorkflowDetector

logger = logging.getLogger(__name__)


class SpecWorkflow(BaseWorkflow):
    """
    Concrete workflow implementation for spec-workflow automation.

    Migrates the existing spec-workflow functionality from SpecWorkflowAutomation
    class to work with the new architecture while maintaining 100% functional
    compatibility. Preserves all existing prompt templates and completion patterns.

    This workflow handles the execution of spec-workflow tasks using Claude Code
    sessions with the exact same behavior as the legacy automation system.
    """

    def __init__(self, config: WorkflowConfig):
        """
        Initialize the spec workflow with configuration.

        Args:
            config (WorkflowConfig): Workflow configuration with spec_name set

        Raises:
            ValueError: If configuration is invalid for spec workflow
        """
        super().__init__(config)

        # Ensure we have a spec name for spec workflows
        if not config.spec_name:
            raise ValueError("spec_name is required for SpecWorkflow")

        # Configure spec-specific completion detector
        self.spec_detector = SpecWorkflowDetector(debug_enabled=config.debug_options.get('show_tool_details', True))

        logger.info(f"Initialized SpecWorkflow for spec: '{config.spec_name}'")

    def validate_config(self) -> None:
        """
        Validate that the configuration is appropriate for spec workflow.

        Extends base validation with spec-workflow specific requirements.

        Raises:
            ValueError: If configuration is invalid for spec workflows
        """
        super().validate_config()

        # Verify this is a spec workflow type
        if self.config.workflow_type != 'spec':
            raise ValueError(f"SpecWorkflow requires workflow_type='spec', got '{self.config.workflow_type}'")

        # Verify spec name is provided
        if not self.config.spec_name:
            raise ValueError("SpecWorkflow requires spec_name to be set")

        # Validate spec name format (should not be empty or whitespace)
        if not self.config.spec_name.strip():
            raise ValueError("spec_name cannot be empty or whitespace")

        logger.debug(f"SpecWorkflow configuration validated for spec: '{self.config.spec_name}'")

    def get_workflow_prompt(self) -> str:
        """
        Generate the prompt for Claude Code execution.

        Migrates the exact prompt template from the original SpecWorkflowAutomation
        to ensure 100% backward compatibility. The prompt structure and content
        are preserved exactly as they were in the legacy system.

        Returns:
            str: Formatted prompt for Claude Code identical to legacy automation
        """
        # Migrated prompt template from SpecWorkflowAutomation._get_predefined_prompt()
        # This preserves the exact prompt format and instructions from the original
        prompt = f"""spec: {self.config.spec_name}

work on a single task from spec name above of spec-workflow.

1. fetch one task from spec using mcp tool spec-workflow
2. work on task
3. update task status to complete on complete
4. commit changes
5. check remaining task count
6. end session without asking further actions.

Important: Use the mcp__spec-workflow tools to interact with the specification system."""

        logger.debug(f"Generated spec workflow prompt for: '{self.config.spec_name}'")
        return prompt

    def detect_completion(self, output_data: Dict[str, Any]) -> bool:
        """
        Detect if the spec workflow has completed successfully.

        Uses the migrated SpecWorkflowDetector to preserve the exact completion
        detection logic from the original SpecWorkflowAutomation. This ensures
        identical behavior for completion detection patterns.

        Args:
            output_data (Dict[str, Any]): Output data from Claude Code session

        Returns:
            bool: True if spec workflow is complete, False otherwise
        """
        # Use the migrated detector to preserve exact completion logic
        completion_detected = self.spec_detector.detect_completion(output_data)

        if completion_detected:
            logger.info(f"🎉 Spec workflow completion detected for: '{self.config.spec_name}'")
            self.completed = True

        return completion_detected

    def get_execution_options(self) -> Dict[str, Any]:
        """
        Get execution options for Claude Code session.

        Preserves the exact options structure from the original automation
        to ensure backward compatibility with existing session behavior.

        Returns:
            Dict[str, Any]: Options for Claude Code execution identical to legacy
        """
        # Migrated options from SpecWorkflowAutomation._start_claude_session()
        # Preserves exact option names and values for compatibility
        options = {
            "cwd": str(self.config.project_path),
            "exit_on_complete": True,
            "permission_mode": "bypassPermissions"
        }

        logger.debug(f"Generated execution options for spec: '{self.config.spec_name}'")
        return options

    def prepare_workflow_session(self) -> bool:
        """
        Prepare for spec workflow execution.

        Performs spec-workflow specific preparation including validation
        of the spec-workflow environment and configuration.

        Returns:
            bool: True if preparation successful, False otherwise
        """
        try:
            # Verify we're in a valid project with spec-workflow structure
            spec_workflow_dir = self.config.project_path / ".spec-workflow"
            if not spec_workflow_dir.exists():
                logger.warning(f"No .spec-workflow directory found at: {spec_workflow_dir}")
                logger.info("This may be the first run - spec-workflow tools will create structure if needed")

            # Log preparation completion
            logger.info(f"Spec workflow preparation completed for: '{self.config.spec_name}'")
            return True

        except Exception as e:
            logger.error(f"Spec workflow preparation failed: {e}")
            return False

    def cleanup_workflow_session(self) -> None:
        """
        Clean up after spec workflow execution.

        Performs spec-workflow specific cleanup tasks while preserving
        any important state or logs for debugging purposes.
        """
        try:
            # Log session completion
            if self.completed:
                logger.info(f"✅ Spec workflow completed successfully: '{self.config.spec_name}'")
            else:
                logger.info(f"🔄 Spec workflow session ended: '{self.config.spec_name}'")

            # Any additional cleanup specific to spec workflows
            # (Currently none needed, but extension point for future requirements)

        except Exception as e:
            logger.warning(f"Error during spec workflow cleanup: {e}")

    def get_completion_detectors(self) -> List:
        """
        Get spec-workflow specific completion detectors.

        Returns the configured SpecWorkflowDetector to ensure proper
        completion detection using the migrated logic.

        Returns:
            List[CompletionDetector]: List containing the spec workflow detector
        """
        return [self.spec_detector]

    def get_status_info(self) -> Dict[str, Any]:
        """
        Get current spec workflow status information.

        Extends base status with spec-workflow specific information
        for monitoring and debugging purposes.

        Returns:
            Dict[str, Any]: Enhanced status information dictionary
        """
        status = super().get_status_info()

        # Add spec-workflow specific status information
        status.update({
            "spec_name": self.config.spec_name,
            "workflow_implementation": "SpecWorkflow",
            "detector_type": "SpecWorkflowDetector",
            "compatibility_level": "100% (migrated from SpecWorkflowAutomation)"
        })

        return status

    def __str__(self) -> str:
        """String representation of the spec workflow."""
        return f"SpecWorkflow(spec_name='{self.config.spec_name}', " \
               f"project={self.config.project_path.name}, " \
               f"completed={self.completed})"

    def __repr__(self) -> str:
        """Detailed string representation of the spec workflow."""
        return f"SpecWorkflow(" \
               f"spec_name='{self.config.spec_name}', " \
               f"project_path='{self.config.project_path}', " \
               f"session_active={self.session_active}, " \
               f"completed={self.completed}, " \
               f"max_cycles={self.config.max_cycles})"


def create_spec_workflow(spec_name: str, project_path: Path, **kwargs) -> SpecWorkflow:
    """
    Factory function to create a SpecWorkflow instance with configuration.

    Provides a convenient way to create spec workflows while ensuring
    proper configuration and maintaining backward compatibility.

    Args:
        spec_name (str): Name of the specification to work on
        project_path (Path): Path to the target project directory
        **kwargs: Additional configuration parameters

    Returns:
        SpecWorkflow: Configured spec workflow instance

    Example:
        workflow = create_spec_workflow(
            spec_name="user-authentication",
            project_path=Path("/path/to/project"),
            max_cycles=15,
            debug_options={'show_tool_details': True}
        )
    """
    # Ensure project_path is a Path object
    if isinstance(project_path, str):
        project_path = Path(project_path)

    # Create configuration with spec workflow defaults
    config = WorkflowConfig(
        workflow_type='spec',
        project_path=project_path,
        spec_name=spec_name,
        **kwargs
    )

    # Create and return the workflow
    return SpecWorkflow(config)


def migrate_from_automation_config(spec_name: str, project_path: str,
                                 debug_options: Optional[Dict[str, Any]] = None) -> SpecWorkflow:
    """
    Create a SpecWorkflow from legacy SpecWorkflowAutomation configuration.

    This function helps migrate from the old automation system by accepting
    the same parameters and creating an equivalent SpecWorkflow instance.

    Args:
        spec_name (str): Name of the specification (from automation)
        project_path (str): Project path (from automation)
        debug_options (Optional[Dict[str, Any]]): Debug options (from automation)

    Returns:
        SpecWorkflow: Equivalent workflow instance

    Example:
        # Migrating from old automation initialization:
        # automation = SpecWorkflowAutomation(spec_name, project_path, debug_options=debug_opts)

        # New workflow system:
        workflow = migrate_from_automation_config(spec_name, project_path, debug_opts)
    """
    # Convert string path to Path object
    project_path_obj = Path(project_path).resolve()

    # Create configuration matching automation defaults
    config = WorkflowConfig(
        workflow_type='spec',
        project_path=project_path_obj,
        spec_name=spec_name,
        max_cycles=10,  # Default from automation
        max_session_time=1800,  # 30 minutes default from automation
        debug_options=debug_options or {},
        # Preserve any custom settings from legacy system
        custom_settings={}
    )

    logger.info(f"Migrated SpecWorkflowAutomation config to SpecWorkflow for spec: '{spec_name}'")
    return SpecWorkflow(config)