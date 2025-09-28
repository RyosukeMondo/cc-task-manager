"""
Runtime Monitoring Package for Claude Code Wrapper Specifications

This package provides real-time monitoring, capture, and analysis capabilities
for Claude Code behavior to support wrapper specification generation.

Components:
- CaptureEngine: Captures runtime events from Claude Code sessions
- EventProcessor: Processes and analyzes captured events for pattern detection
- SessionManager: Coordinates capture and processing with session lifecycle management

Usage:
    from claudeCodeSpecs.runtime_monitoring import create_session_manager

    session_manager = create_session_manager(
        project_path="/path/to/project",
        output_directory="/path/to/output"
    )

    await session_manager.start_session()
    # ... monitoring happens ...
    summary = await session_manager.stop_session()
"""

from .capture_engine import CaptureEngine, create_capture_engine
from .event_processor import EventProcessor, create_event_processor
from .session_manager import (
    SessionManager,
    SessionConfiguration,
    SessionState,
    MonitoringMode,
    create_session_manager,
    create_default_session_manager
)

__version__ = "1.0.0"
__author__ = "Claude Code Wrapper Specifications Project"

__all__ = [
    # Core classes
    "CaptureEngine",
    "EventProcessor",
    "SessionManager",

    # Configuration and enums
    "SessionConfiguration",
    "SessionState",
    "MonitoringMode",

    # Factory functions
    "create_capture_engine",
    "create_event_processor",
    "create_session_manager",
    "create_default_session_manager"
]