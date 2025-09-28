#!/usr/bin/env python3
"""
Session Manager for Runtime Monitoring

Manages Claude Code session lifecycle, coordinates capture and processing components.
Provides unified interface for runtime monitoring operations.
"""

import asyncio
import json
import logging
import signal
import threading
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable, AsyncGenerator
from dataclasses import dataclass, asdict
from enum import Enum
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

from .capture_engine import CaptureEngine, create_capture_engine
from .event_processor import EventProcessor, create_event_processor

logger = logging.getLogger(__name__)


class SessionState(Enum):
    """Session states for lifecycle management."""
    IDLE = "idle"
    STARTING = "starting"
    ACTIVE = "active"
    MONITORING = "monitoring"
    PROCESSING = "processing"
    STOPPING = "stopping"
    STOPPED = "stopped"
    ERROR = "error"


class MonitoringMode(Enum):
    """Monitoring operation modes."""
    PASSIVE = "passive"  # Just capture events
    ACTIVE = "active"    # Capture and process events
    ANALYSIS = "analysis"  # Full analysis with pattern detection
    VALIDATION = "validation"  # Validation against specifications


@dataclass
class SessionConfiguration:
    """Session configuration parameters."""

    # Session identity
    session_id: str
    project_path: Path
    output_directory: Path

    # Monitoring configuration
    monitoring_mode: MonitoringMode = MonitoringMode.ACTIVE
    auto_start_processing: bool = True
    real_time_analysis: bool = True

    # Capture configuration
    capture_filters: Dict[str, Any] = None
    max_events_in_memory: int = 10000
    auto_save_interval: int = 300  # seconds

    # Processing configuration
    enable_pattern_detection: bool = True
    pattern_detection_threshold: float = 0.7
    performance_monitoring: bool = True

    # Integration configuration
    claude_wrapper_path: Optional[Path] = None
    external_event_source: Optional[str] = None
    webhook_notifications: bool = False

    # Performance limits
    max_processing_time_ms: int = 100
    max_memory_usage_mb: int = 500
    max_session_duration_hours: int = 24

    def __post_init__(self):
        if self.capture_filters is None:
            self.capture_filters = {
                "include_stream_events": True,
                "include_tool_events": True,
                "include_run_events": True,
                "min_content_length": 10
            }


@dataclass
class SessionMetrics:
    """Session monitoring metrics."""

    session_id: str
    start_time: datetime
    last_activity: datetime
    state: SessionState

    # Event metrics
    total_events_captured: int = 0
    total_events_processed: int = 0
    events_per_second: float = 0.0
    average_processing_time_ms: float = 0.0

    # Error metrics
    capture_errors: int = 0
    processing_errors: int = 0
    error_rate: float = 0.0

    # Resource usage
    memory_usage_mb: float = 0.0
    cpu_usage_percent: float = 0.0
    disk_usage_mb: float = 0.0

    # Behavioral metrics
    completion_patterns_detected: int = 0
    tool_usage_events: int = 0
    mcp_tool_usage: int = 0
    specification_validations: int = 0


class EventSourceManager:
    """Manages different event sources for monitoring."""

    def __init__(self):
        self.active_sources: Dict[str, Any] = {}
        self.event_callbacks: List[Callable[[Dict[str, Any]], None]] = []

    def add_event_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Add callback for receiving events."""
        self.event_callbacks.append(callback)

    def remove_event_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Remove event callback."""
        if callback in self.event_callbacks:
            self.event_callbacks.remove(callback)

    def start_claude_wrapper_source(self, wrapper_path: Path, project_path: Path) -> str:
        """Start Claude wrapper as event source."""
        source_id = f"claude_wrapper_{int(time.time())}"

        try:
            # Start the claude wrapper process
            process = subprocess.Popen(
                [sys.executable, str(wrapper_path)],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=0,
                cwd=project_path
            )

            self.active_sources[source_id] = {
                "type": "claude_wrapper",
                "process": process,
                "start_time": datetime.utcnow(),
                "status": "starting"
            }

            # Start monitoring thread
            monitor_thread = threading.Thread(
                target=self._monitor_claude_wrapper,
                args=(source_id, process),
                daemon=True
            )
            monitor_thread.start()

            logger.info(f"Started Claude wrapper source: {source_id}")
            return source_id

        except Exception as e:
            logger.error(f"Failed to start Claude wrapper source: {e}")
            raise

    def start_file_source(self, file_path: Path) -> str:
        """Start file-based event source (reading JSONL)."""
        source_id = f"file_source_{int(time.time())}"

        self.active_sources[source_id] = {
            "type": "file_source",
            "file_path": file_path,
            "start_time": datetime.utcnow(),
            "status": "active"
        }

        # Start file monitoring thread
        monitor_thread = threading.Thread(
            target=self._monitor_file_source,
            args=(source_id, file_path),
            daemon=True
        )
        monitor_thread.start()

        logger.info(f"Started file source: {source_id}")
        return source_id

    def stop_source(self, source_id: str) -> bool:
        """Stop an event source."""
        if source_id not in self.active_sources:
            logger.warning(f"Source {source_id} not found")
            return False

        source = self.active_sources[source_id]

        try:
            if source["type"] == "claude_wrapper":
                process = source["process"]
                if process and process.poll() is None:
                    # Send shutdown command
                    try:
                        shutdown_payload = {"action": "shutdown"}
                        process.stdin.write(json.dumps(shutdown_payload) + "\n")
                        process.stdin.flush()
                        process.wait(timeout=10)
                    except:
                        process.terminate()
                        process.wait(timeout=5)

            source["status"] = "stopped"
            del self.active_sources[source_id]
            logger.info(f"Stopped source: {source_id}")
            return True

        except Exception as e:
            logger.error(f"Error stopping source {source_id}: {e}")
            return False

    def stop_all_sources(self) -> None:
        """Stop all active event sources."""
        source_ids = list(self.active_sources.keys())
        for source_id in source_ids:
            self.stop_source(source_id)

    def _monitor_claude_wrapper(self, source_id: str, process: subprocess.Popen) -> None:
        """Monitor Claude wrapper process output."""
        logger.info(f"Starting Claude wrapper monitoring for {source_id}")

        try:
            while process.poll() is None and source_id in self.active_sources:
                line = process.stdout.readline()
                if line:
                    try:
                        event_data = json.loads(line.strip())
                        event_data["source_id"] = source_id
                        event_data["source_type"] = "claude_wrapper"

                        # Notify all callbacks
                        for callback in self.event_callbacks:
                            try:
                                callback(event_data)
                            except Exception as e:
                                logger.error(f"Event callback error: {e}")

                    except json.JSONDecodeError:
                        # Skip malformed JSON
                        continue

        except Exception as e:
            logger.error(f"Error monitoring Claude wrapper {source_id}: {e}")

        finally:
            if source_id in self.active_sources:
                self.active_sources[source_id]["status"] = "stopped"
            logger.info(f"Stopped monitoring Claude wrapper {source_id}")

    def _monitor_file_source(self, source_id: str, file_path: Path) -> None:
        """Monitor file source for new events."""
        logger.info(f"Starting file monitoring for {source_id}")

        try:
            # Read existing file if it exists
            if file_path.exists():
                with open(file_path, 'r') as f:
                    for line in f:
                        if line.strip():
                            try:
                                event_data = json.loads(line.strip())
                                event_data["source_id"] = source_id
                                event_data["source_type"] = "file_source"

                                for callback in self.event_callbacks:
                                    try:
                                        callback(event_data)
                                    except Exception as e:
                                        logger.error(f"Event callback error: {e}")

                            except json.JSONDecodeError:
                                continue

            # Monitor for new lines (tail -f behavior)
            last_position = file_path.stat().st_size if file_path.exists() else 0

            while source_id in self.active_sources:
                try:
                    if file_path.exists():
                        current_size = file_path.stat().st_size
                        if current_size > last_position:
                            with open(file_path, 'r') as f:
                                f.seek(last_position)
                                for line in f:
                                    if line.strip():
                                        try:
                                            event_data = json.loads(line.strip())
                                            event_data["source_id"] = source_id
                                            event_data["source_type"] = "file_source"

                                            for callback in self.event_callbacks:
                                                try:
                                                    callback(event_data)
                                                except Exception as e:
                                                    logger.error(f"Event callback error: {e}")

                                        except json.JSONDecodeError:
                                            continue

                            last_position = current_size

                    time.sleep(1)  # Check for updates every second

                except Exception as e:
                    logger.error(f"Error reading file {file_path}: {e}")
                    time.sleep(5)  # Wait longer on error

        except Exception as e:
            logger.error(f"Error monitoring file source {source_id}: {e}")

        finally:
            if source_id in self.active_sources:
                self.active_sources[source_id]["status"] = "stopped"
            logger.info(f"Stopped monitoring file source {source_id}")


class SessionManager:
    """Main session manager for runtime monitoring."""

    def __init__(self, config: SessionConfiguration):
        self.config = config
        self.session_id = config.session_id
        self.state = SessionState.IDLE

        # Core components
        self.capture_engine: Optional[CaptureEngine] = None
        self.event_processor: Optional[EventProcessor] = None
        self.event_source_manager = EventSourceManager()

        # Session state
        self.start_time: Optional[datetime] = None
        self.metrics = SessionMetrics(
            session_id=self.session_id,
            start_time=datetime.utcnow(),
            last_activity=datetime.utcnow(),
            state=self.state
        )

        # Threading and async
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.shutdown_requested = False
        self.monitoring_task: Optional[asyncio.Task] = None

        # Event handling
        self.event_handlers: Dict[str, List[Callable]] = defaultdict(list)
        self.event_queue = asyncio.Queue()

        # Setup signal handlers
        self._setup_signal_handlers()

    def _setup_signal_handlers(self) -> None:
        """Setup signal handlers for graceful shutdown."""
        def signal_handler(signum, frame):
            logger.info(f"Received signal {signum}, initiating shutdown...")
            self.shutdown_requested = True
            asyncio.create_task(self.stop_session())

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    def add_event_handler(self, event_type: str, handler: Callable[[Dict[str, Any]], None]) -> None:
        """Add event handler for specific event type."""
        self.event_handlers[event_type].append(handler)

    def remove_event_handler(self, event_type: str, handler: Callable[[Dict[str, Any]], None]) -> None:
        """Remove event handler."""
        if handler in self.event_handlers[event_type]:
            self.event_handlers[event_type].remove(handler)

    async def start_session(self) -> bool:
        """Start the monitoring session."""
        if self.state != SessionState.IDLE:
            logger.warning(f"Session {self.session_id} already started")
            return False

        try:
            logger.info(f"Starting monitoring session {self.session_id}")
            self._update_state(SessionState.STARTING)

            # Create output directories
            self.config.output_directory.mkdir(parents=True, exist_ok=True)

            # Initialize capture engine
            capture_config = {
                "max_events_in_memory": self.config.max_events_in_memory,
                "auto_save_interval": self.config.auto_save_interval,
                "capture_filters": self.config.capture_filters,
                "performance_limits": {
                    "max_processing_time_ms": self.config.max_processing_time_ms,
                    "max_memory_usage_mb": self.config.max_memory_usage_mb
                }
            }

            self.capture_engine = create_capture_engine(
                str(self.config.output_directory),
                capture_config
            )

            # Initialize event processor if needed
            if self.config.monitoring_mode in [MonitoringMode.ACTIVE, MonitoringMode.ANALYSIS]:
                processor_config = {
                    "max_processing_time_ms": self.config.max_processing_time_ms,
                    "enable_real_time_analysis": self.config.real_time_analysis,
                    "pattern_detection_threshold": self.config.pattern_detection_threshold
                }

                self.event_processor = create_event_processor(processor_config)

            # Setup event source callbacks
            self.event_source_manager.add_event_callback(self._handle_incoming_event)

            # Start capture engine
            capture_session_id = self.capture_engine.start_capture()
            logger.info(f"Capture engine started with session: {capture_session_id}")

            # Start monitoring task
            self.monitoring_task = asyncio.create_task(self._monitoring_loop())

            self.start_time = datetime.utcnow()
            self.metrics.start_time = self.start_time
            self._update_state(SessionState.ACTIVE)

            logger.info(f"Session {self.session_id} started successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to start session {self.session_id}: {e}")
            self._update_state(SessionState.ERROR)
            return False

    async def stop_session(self) -> Dict[str, Any]:
        """Stop the monitoring session and return summary."""
        if self.state in [SessionState.STOPPED, SessionState.STOPPING]:
            logger.warning(f"Session {self.session_id} already stopped")
            return {}

        try:
            logger.info(f"Stopping monitoring session {self.session_id}")
            self._update_state(SessionState.STOPPING)

            # Stop monitoring task
            if self.monitoring_task:
                self.monitoring_task.cancel()
                try:
                    await self.monitoring_task
                except asyncio.CancelledError:
                    pass

            # Stop event sources
            self.event_source_manager.stop_all_sources()

            # Stop capture engine
            capture_summary = {}
            if self.capture_engine:
                capture_summary = self.capture_engine.stop_capture()

            # Get processing summary
            processing_summary = {}
            if self.event_processor:
                processing_summary = self.event_processor.get_processing_summary()

            # Calculate final metrics
            session_duration = datetime.utcnow() - self.start_time if self.start_time else timedelta(0)

            summary = {
                "session_id": self.session_id,
                "duration_seconds": session_duration.total_seconds(),
                "final_state": self.state.value,
                "metrics": asdict(self.metrics),
                "capture_summary": capture_summary,
                "processing_summary": processing_summary,
                "config": asdict(self.config)
            }

            # Save session summary
            await self._save_session_summary(summary)

            self._update_state(SessionState.STOPPED)
            logger.info(f"Session {self.session_id} stopped successfully")

            return summary

        except Exception as e:
            logger.error(f"Error stopping session {self.session_id}: {e}")
            self._update_state(SessionState.ERROR)
            return {"error": str(e)}

    def start_claude_wrapper_monitoring(self, project_path: Optional[Path] = None) -> str:
        """Start monitoring a Claude wrapper process."""
        if not self.config.claude_wrapper_path:
            raise ValueError("Claude wrapper path not configured")

        target_project = project_path or self.config.project_path

        return self.event_source_manager.start_claude_wrapper_source(
            self.config.claude_wrapper_path,
            target_project
        )

    def start_file_monitoring(self, file_path: Path) -> str:
        """Start monitoring a file for events."""
        return self.event_source_manager.start_file_source(file_path)

    def _handle_incoming_event(self, event_data: Dict[str, Any]) -> None:
        """Handle incoming event from any source."""
        try:
            # Update metrics
            self.metrics.total_events_captured += 1
            self.metrics.last_activity = datetime.utcnow()

            # Update events per second
            if self.start_time:
                elapsed = (datetime.utcnow() - self.start_time).total_seconds()
                if elapsed > 0:
                    self.metrics.events_per_second = self.metrics.total_events_captured / elapsed

            # Capture event
            if self.capture_engine:
                event_id = self.capture_engine.capture_event(event_data)
                if not event_id:
                    self.metrics.capture_errors += 1

            # Process event if processor is available
            if (self.event_processor and
                self.config.monitoring_mode in [MonitoringMode.ACTIVE, MonitoringMode.ANALYSIS]):

                try:
                    processed_event = self.event_processor.process_event(event_data)
                    self.metrics.total_events_processed += 1

                    # Update processing metrics
                    processing_times = [processed_event.processing_duration_ms]
                    if processing_times:
                        self.metrics.average_processing_time_ms = sum(processing_times) / len(processing_times)

                    # Check for special patterns
                    if processed_event.completion_indicators:
                        self.metrics.completion_patterns_detected += 1

                    if processed_event.tool_analysis.get("tools_called"):
                        self.metrics.tool_usage_events += 1

                    # Notify event handlers
                    for handler in self.event_handlers.get("processed_event", []):
                        try:
                            handler(asdict(processed_event))
                        except Exception as e:
                            logger.error(f"Event handler error: {e}")

                except Exception as e:
                    logger.error(f"Event processing error: {e}")
                    self.metrics.processing_errors += 1

            # Calculate error rate
            total_events = max(self.metrics.total_events_captured, 1)
            self.metrics.error_rate = (self.metrics.capture_errors + self.metrics.processing_errors) / total_events

            # Notify raw event handlers
            for handler in self.event_handlers.get("raw_event", []):
                try:
                    handler(event_data)
                except Exception as e:
                    logger.error(f"Raw event handler error: {e}")

        except Exception as e:
            logger.error(f"Error handling incoming event: {e}")

    async def _monitoring_loop(self) -> None:
        """Main monitoring loop for session management."""
        logger.info(f"Starting monitoring loop for session {self.session_id}")

        try:
            while not self.shutdown_requested and self.state == SessionState.ACTIVE:
                # Update resource usage metrics
                await self._update_resource_metrics()

                # Check session duration limits
                if self.start_time:
                    duration_hours = (datetime.utcnow() - self.start_time).total_seconds() / 3600
                    if duration_hours > self.config.max_session_duration_hours:
                        logger.warning(f"Session duration limit reached: {duration_hours} hours")
                        break

                # Check memory usage limits
                if self.metrics.memory_usage_mb > self.config.max_memory_usage_mb:
                    logger.warning(f"Memory usage limit exceeded: {self.metrics.memory_usage_mb} MB")
                    # Could implement memory cleanup here

                await asyncio.sleep(10)  # Update every 10 seconds

        except asyncio.CancelledError:
            logger.info("Monitoring loop cancelled")
        except Exception as e:
            logger.error(f"Error in monitoring loop: {e}")
            self._update_state(SessionState.ERROR)

    async def _update_resource_metrics(self) -> None:
        """Update resource usage metrics."""
        try:
            import psutil
            process = psutil.Process()

            # Memory usage
            memory_info = process.memory_info()
            self.metrics.memory_usage_mb = memory_info.rss / (1024 * 1024)

            # CPU usage
            self.metrics.cpu_usage_percent = process.cpu_percent()

            # Disk usage for output directory
            if self.config.output_directory.exists():
                total_size = sum(
                    f.stat().st_size for f in self.config.output_directory.rglob('*') if f.is_file()
                )
                self.metrics.disk_usage_mb = total_size / (1024 * 1024)

        except ImportError:
            # psutil not available
            pass
        except Exception as e:
            logger.debug(f"Error updating resource metrics: {e}")

    async def _save_session_summary(self, summary: Dict[str, Any]) -> None:
        """Save session summary to file."""
        try:
            summary_file = self.config.output_directory / f"session_summary_{self.session_id}.json"
            with open(summary_file, 'w') as f:
                json.dump(summary, f, indent=2, default=str)
            logger.info(f"Session summary saved to: {summary_file}")
        except Exception as e:
            logger.error(f"Failed to save session summary: {e}")

    def _update_state(self, new_state: SessionState) -> None:
        """Update session state and notify handlers."""
        old_state = self.state
        self.state = new_state
        self.metrics.state = new_state

        logger.info(f"Session {self.session_id} state: {old_state.value} -> {new_state.value}")

        # Notify state change handlers
        for handler in self.event_handlers.get("state_change", []):
            try:
                handler({
                    "session_id": self.session_id,
                    "old_state": old_state.value,
                    "new_state": new_state.value,
                    "timestamp": datetime.utcnow().isoformat()
                })
            except Exception as e:
                logger.error(f"State change handler error: {e}")

    def get_session_status(self) -> Dict[str, Any]:
        """Get current session status."""
        return {
            "session_id": self.session_id,
            "state": self.state.value,
            "metrics": asdict(self.metrics),
            "active_sources": list(self.event_source_manager.active_sources.keys()),
            "config": asdict(self.config),
            "uptime_seconds": (datetime.utcnow() - self.start_time).total_seconds() if self.start_time else 0
        }

    async def export_session_data(self, include_events: bool = True,
                                 include_processed: bool = True) -> Dict[str, Any]:
        """Export all session data."""
        export_summary = {"session_id": self.session_id, "export_time": datetime.utcnow().isoformat()}

        try:
            # Export captured events
            if include_events and self.capture_engine:
                events_summary = self.capture_engine.save_captured_data()
                export_summary["captured_events"] = events_summary

            # Export processed events
            if include_processed and self.event_processor:
                processed_file = self.config.output_directory / f"processed_events_{self.session_id}.jsonl"
                events_exported = self.event_processor.export_processed_events(processed_file)
                export_summary["processed_events"] = {
                    "events_exported": events_exported,
                    "file_path": str(processed_file)
                }

            # Export session metrics
            metrics_file = self.config.output_directory / f"metrics_{self.session_id}.json"
            with open(metrics_file, 'w') as f:
                json.dump(asdict(self.metrics), f, indent=2, default=str)
            export_summary["metrics_file"] = str(metrics_file)

            logger.info(f"Session data exported: {export_summary}")
            return export_summary

        except Exception as e:
            logger.error(f"Error exporting session data: {e}")
            export_summary["error"] = str(e)
            return export_summary


# Factory functions
def create_session_manager(project_path: str,
                          output_directory: str,
                          session_id: Optional[str] = None,
                          **config_kwargs) -> SessionManager:
    """Create a configured session manager."""

    if session_id is None:
        session_id = f"session_{int(time.time())}"

    config = SessionConfiguration(
        session_id=session_id,
        project_path=Path(project_path),
        output_directory=Path(output_directory),
        **config_kwargs
    )

    return SessionManager(config)


def create_default_session_manager(project_path: str) -> SessionManager:
    """Create a session manager with default settings."""
    return create_session_manager(
        project_path=project_path,
        output_directory=f"{project_path}/runtime_monitoring_output",
        monitoring_mode=MonitoringMode.ACTIVE,
        auto_start_processing=True,
        real_time_analysis=True
    )


if __name__ == "__main__":
    # Example usage
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )

    async def main():
        # Create session manager
        session_manager = create_default_session_manager("/tmp/test_project")

        # Add event handlers
        def on_completion_detected(event_data):
            print(f"Completion detected: {event_data.get('completion_indicators', [])}")

        session_manager.add_event_handler("processed_event", on_completion_detected)

        # Start session
        success = await session_manager.start_session()
        if not success:
            print("Failed to start session")
            return

        # Simulate some monitoring time
        print("Session started, monitoring for 30 seconds...")
        await asyncio.sleep(30)

        # Stop session
        summary = await session_manager.stop_session()
        print(f"Session stopped. Summary: {summary}")

    # Run example
    asyncio.run(main())