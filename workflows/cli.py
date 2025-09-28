#!/usr/bin/env python3
"""
Unified CLI Interface for Workflow System

This module provides a single command-line interface for all workflow types,
supporting backward compatibility with existing CLI usage patterns while
extending functionality to all workflow types.

Usage:
    # Spec workflow (backward compatible)
    python -m workflows.cli spec --spec-name "Contract Driven" --project /path/to/project

    # Test fix workflow
    python -m workflows.cli test-fix --project /path/to/project --test-command "npm test"

    # Type fix workflow
    python -m workflows.cli type-fix --project /path/to/project --type-command "npx tsc"

    # Build fix workflow
    python -m workflows.cli build-fix --project /path/to/project --build-command "npm run build"

The CLI preserves all existing argument patterns from spec_workflow_automation.py
while providing a unified interface for all workflow types.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional

from .core.workflow_engine import WorkflowEngine
from .core.base_workflow import WorkflowConfig
from .definitions.spec_workflow import SpecWorkflow
from .definitions.test_fix_workflow import TestFixWorkflow
from .definitions.type_fix_workflow import TypeFixWorkflow
from .definitions.build_fix_workflow import BuildFixWorkflow

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)
logger = logging.getLogger(__name__)


def create_common_parser() -> argparse.ArgumentParser:
    """
    Create the main argument parser with common options.

    Returns:
        argparse.ArgumentParser: Configured parser with subcommands
    """
    parser = argparse.ArgumentParser(
        description="Unified workflow automation system for Claude Code",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Spec workflow (backward compatible with spec_workflow_automation.py)
  %(prog)s spec --spec-name "user-auth" --project /path/to/project

  # Test fix workflow
  %(prog)s test-fix --project /path/to/project --test-command "npm test"

  # Type fix workflow
  %(prog)s type-fix --project /path/to/project --type-command "npx tsc"

  # Build fix workflow
  %(prog)s build-fix --project /path/to/project --build-command "npm run build"

For more information about each workflow type, use:
  %(prog)s <workflow-type> --help
        """
    )

    # Add common debug options (migrated from spec_workflow_automation.py)
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    parser.add_argument(
        "--session-log",
        help="File path to log JSONL session data (optional)"
    )

    # Debug options (preserved from original automation)
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
        help="Show tool usage details (enabled by default)"
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
        help="Set max content length before truncation (default: 500)"
    )

    # Execution control options
    parser.add_argument(
        "--max-cycles",
        type=int,
        default=10,
        help="Maximum number of execution cycles (default: 10)"
    )
    parser.add_argument(
        "--max-session-time",
        type=int,
        default=1800,
        help="Maximum session duration in seconds (default: 1800)"
    )

    return parser


def add_spec_workflow_subparser(subparsers):
    """
    Add spec workflow subcommand (backward compatible).

    Args:
        subparsers: Subparser group to add to
    """
    spec_parser = subparsers.add_parser(
        'spec',
        help='Run spec workflow automation (backward compatible)',
        description='Automate spec-workflow task execution with Claude Code'
    )

    # Required arguments (preserved from original automation)
    spec_parser.add_argument(
        "--spec-name",
        required=True,
        help="Name of the specification to work on"
    )
    spec_parser.add_argument(
        "--project",
        required=True,
        help="Path to the target project directory"
    )

    spec_parser.set_defaults(workflow_type='spec')


def add_test_fix_subparser(subparsers):
    """
    Add test-fix workflow subcommand.

    Args:
        subparsers: Subparser group to add to
    """
    test_parser = subparsers.add_parser(
        'test-fix',
        help='Run test fix workflow to resolve failing tests',
        description='Automate fixing test failures until all tests pass'
    )

    test_parser.add_argument(
        "--project",
        required=True,
        help="Path to the target project directory"
    )
    test_parser.add_argument(
        "--test-command",
        default="npm test",
        help="Command to run tests (default: 'npm test')"
    )
    test_parser.add_argument(
        "--test-patterns",
        nargs="*",
        help="Additional test patterns for completion detection"
    )

    test_parser.set_defaults(workflow_type='test-fix')


def add_type_fix_subparser(subparsers):
    """
    Add type-fix workflow subcommand.

    Args:
        subparsers: Subparser group to add to
    """
    type_parser = subparsers.add_parser(
        'type-fix',
        help='Run type fix workflow to resolve type errors',
        description='Automate fixing type errors until type checking passes'
    )

    type_parser.add_argument(
        "--project",
        required=True,
        help="Path to the target project directory"
    )
    type_parser.add_argument(
        "--type-command",
        help="Command to run type checking (e.g., 'npx tsc', 'mypy .')"
    )
    type_parser.add_argument(
        "--type-patterns",
        nargs="*",
        help="Additional type error patterns for completion detection"
    )

    type_parser.set_defaults(workflow_type='type-fix')


def add_build_fix_subparser(subparsers):
    """
    Add build-fix workflow subcommand.

    Args:
        subparsers: Subparser group to add to
    """
    build_parser = subparsers.add_parser(
        'build-fix',
        help='Run build fix workflow to resolve build errors',
        description='Automate fixing build errors until compilation succeeds'
    )

    build_parser.add_argument(
        "--project",
        required=True,
        help="Path to the target project directory"
    )
    build_parser.add_argument(
        "--build-command",
        help="Command to run build (e.g., 'npm run build', 'make', 'cargo build')"
    )
    build_parser.add_argument(
        "--build-patterns",
        nargs="*",
        help="Additional build success patterns for completion detection"
    )

    build_parser.set_defaults(workflow_type='build-fix')


def parse_arguments() -> argparse.Namespace:
    """
    Parse command line arguments for all workflow types.

    Returns:
        argparse.Namespace: Parsed arguments
    """
    parser = create_common_parser()

    # Add subcommands for different workflow types
    subparsers = parser.add_subparsers(
        dest='workflow_type',
        title='Workflow Types',
        description='Available workflow automation types',
        help='Type of workflow to execute'
    )

    # Add workflow-specific subparsers
    add_spec_workflow_subparser(subparsers)
    add_test_fix_subparser(subparsers)
    add_type_fix_subparser(subparsers)
    add_build_fix_subparser(subparsers)

    args = parser.parse_args()

    # Validate required workflow type
    if not args.workflow_type:
        parser.error("Must specify a workflow type. Use --help to see available options.")

    return args


def create_debug_options(args: argparse.Namespace) -> Dict[str, Any]:
    """
    Create debug options dictionary from parsed arguments.

    Preserves exact debug option structure from spec_workflow_automation.py
    for backward compatibility.

    Args:
        args: Parsed command line arguments

    Returns:
        Dict[str, Any]: Debug options configuration
    """
    return {
        'show_raw_data': args.debug_raw,
        'show_all_events': args.debug_all,
        'show_payload_analysis': args.debug_payload,
        'show_content_analysis': args.debug_content,
        'show_metadata': args.debug_metadata,
        'show_tool_details': args.debug_tools,
        'show_full_content': args.debug_full,
        'max_content_length': args.max_content,
        'session_log_file': args.session_log
    }


def create_workflow_config(args: argparse.Namespace) -> WorkflowConfig:
    """
    Create workflow configuration from parsed arguments.

    Args:
        args: Parsed command line arguments

    Returns:
        WorkflowConfig: Configured workflow configuration

    Raises:
        ValueError: If configuration is invalid for workflow type
    """
    # Get project path (handle both --project and --project-path for compatibility)
    project_path = getattr(args, 'project', None)
    if not project_path:
        raise ValueError("Project path is required")

    # Convert to Path object
    project_path = Path(project_path).resolve()

    # Create base configuration
    config_params = {
        'workflow_type': args.workflow_type,
        'project_path': project_path,
        'max_cycles': args.max_cycles,
        'max_session_time': args.max_session_time,
        'debug_options': create_debug_options(args)
    }

    # Add workflow-specific parameters
    if args.workflow_type == 'spec':
        config_params['spec_name'] = args.spec_name

    elif args.workflow_type == 'test-fix':
        config_params['test_command'] = args.test_command
        if hasattr(args, 'test_patterns') and args.test_patterns:
            config_params['completion_patterns'] = args.test_patterns

    elif args.workflow_type == 'type-fix':
        if hasattr(args, 'type_command') and args.type_command:
            config_params['type_check_command'] = args.type_command
        if hasattr(args, 'type_patterns') and args.type_patterns:
            config_params['completion_patterns'] = args.type_patterns

    elif args.workflow_type == 'build-fix':
        if hasattr(args, 'build_command') and args.build_command:
            config_params['build_command'] = args.build_command
        if hasattr(args, 'build_patterns') and args.build_patterns:
            config_params['completion_patterns'] = args.build_patterns

    return WorkflowConfig(**config_params)


def create_workflow_instance(config: WorkflowConfig):
    """
    Create the appropriate workflow instance based on configuration.

    Args:
        config: Workflow configuration

    Returns:
        BaseWorkflow: Configured workflow instance

    Raises:
        ValueError: If workflow type is not supported
    """
    if config.workflow_type == 'spec':
        return SpecWorkflow(config)
    elif config.workflow_type == 'test-fix':
        return TestFixWorkflow(config)
    elif config.workflow_type == 'type-fix':
        return TypeFixWorkflow(config)
    elif config.workflow_type == 'build-fix':
        return BuildFixWorkflow(config)
    else:
        raise ValueError(f"Unsupported workflow type: {config.workflow_type}")


async def run_workflow(workflow) -> int:
    """
    Execute the workflow using the workflow engine.

    Args:
        workflow: Configured workflow instance

    Returns:
        int: Exit code (0 for success, 1 for failure)
    """
    try:
        # Create and configure workflow engine
        engine = WorkflowEngine(workflow.config)

        logger.info(f"🚀 Starting {workflow.config.workflow_type} workflow...")
        logger.info(f"📁 Project: {workflow.config.project_path}")

        if workflow.config.workflow_type == 'spec':
            logger.info(f"📋 Spec: {workflow.config.spec_name}")

        # Execute workflow
        success = await engine.execute_workflow(workflow)

        if success:
            logger.info(f"✅ {workflow.config.workflow_type} workflow completed successfully!")
            return 0
        else:
            logger.error(f"❌ {workflow.config.workflow_type} workflow failed to complete")
            return 1

    except KeyboardInterrupt:
        logger.warning("🛑 Workflow interrupted by user")
        return 130  # Standard exit code for SIGINT
    except Exception as e:
        logger.error(f"💥 Workflow execution failed: {e}")
        if hasattr(workflow.config, 'debug_options') and workflow.config.debug_options.get('show_raw_data'):
            logger.exception("Full error details:")
        return 1


def setup_logging(args: argparse.Namespace) -> None:
    """
    Configure logging based on command line arguments.

    Args:
        args: Parsed command line arguments
    """
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Verbose logging enabled")

    # Additional debug logging setup if needed
    if args.debug_raw or args.debug_all:
        logging.getLogger().setLevel(logging.DEBUG)


async def main() -> int:
    """
    Main entry point for the unified CLI interface.

    Returns:
        int: Exit code for the application
    """
    try:
        # Parse command line arguments
        args = parse_arguments()

        # Setup logging
        setup_logging(args)

        # Create workflow configuration
        config = create_workflow_config(args)

        # Create workflow instance
        workflow = create_workflow_instance(config)

        # Execute workflow
        return await run_workflow(workflow)

    except Exception as e:
        logger.error(f"CLI initialization failed: {e}")
        return 1


def sync_main() -> int:
    """
    Synchronous wrapper for main() to handle asyncio.

    Returns:
        int: Exit code for the application
    """
    try:
        return asyncio.run(main())
    except KeyboardInterrupt:
        logger.warning("🛑 Application interrupted by user")
        return 130


if __name__ == "__main__":
    sys.exit(sync_main())


# Backward compatibility function for spec workflow automation
def run_spec_workflow_automation(spec_name: str, project_path: str,
                                debug_options: Optional[Dict[str, Any]] = None) -> int:
    """
    Backward compatibility function for existing spec workflow automation.

    This function provides a direct Python API that matches the original
    SpecWorkflowAutomation interface for existing code that imports and
    uses the automation programmatically.

    Args:
        spec_name: Name of the specification to work on
        project_path: Path to the target project directory
        debug_options: Debug configuration options

    Returns:
        int: Exit code (0 for success, 1 for failure)

    Example:
        # Old usage:
        # automation = SpecWorkflowAutomation(spec_name, project_path, debug_options)
        # automation.run()

        # New usage (backward compatible):
        # exit_code = run_spec_workflow_automation(spec_name, project_path, debug_options)
    """
    try:
        # Create configuration from parameters
        config = WorkflowConfig(
            workflow_type='spec',
            project_path=Path(project_path).resolve(),
            spec_name=spec_name,
            debug_options=debug_options or {}
        )

        # Create workflow instance
        workflow = SpecWorkflow(config)

        # Execute workflow synchronously
        return asyncio.run(run_workflow(workflow))

    except Exception as e:
        logger.error(f"Spec workflow automation failed: {e}")
        return 1