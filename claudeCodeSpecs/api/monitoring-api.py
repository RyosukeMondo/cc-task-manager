#!/usr/bin/env python3
"""
Monitoring API - Runtime Monitoring and Event Capture API

This module provides REST API endpoints for accessing runtime monitoring
capabilities, event capture, and real-time behavioral analysis.

Requirements satisfied: 4.1, 4.2 - Runtime monitoring programmatic access
"""

import asyncio
import json
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from runtime_monitoring.capture_engine import EventCapture, CapturedEvent
from runtime_monitoring.event_processor import EventProcessor
from runtime_monitoring.session_manager import SessionManager

logger = logging.getLogger(__name__)


@dataclass
class MonitoringAPIResponse:
    """Standardized monitoring API response format"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str = None
    session_id: Optional[str] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MonitoringAPI:
    """
    Runtime monitoring API providing access to event capture, session management,
    and real-time behavioral analysis capabilities.
    """

    def __init__(self, data_dir: str = "claudeCodeSpecs/runtime-data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # Initialize monitoring components
        self.event_capture = EventCapture()
        self.event_processor = EventProcessor()
        self.session_manager = SessionManager(str(self.data_dir))

        # Active monitoring state
        self.active_sessions = {}
        self.monitoring_enabled = False

    # Session Management Endpoints

    async def start_monitoring_session(self, session_config: Dict[str, Any] = None) -> MonitoringAPIResponse:
        """Start a new monitoring session"""
        try:
            session_config = session_config or {}
            session_id = self.session_manager.start_session(
                session_type=session_config.get("type", "runtime_monitoring"),
                metadata=session_config.get("metadata", {})
            )

            self.active_sessions[session_id] = {
                "started_at": datetime.utcnow().isoformat(),
                "config": session_config,
                "event_count": 0
            }

            return MonitoringAPIResponse(
                success=True,
                session_id=session_id,
                data={
                    "session_id": session_id,
                    "started_at": self.active_sessions[session_id]["started_at"],
                    "config": session_config
                }
            )

        except Exception as e:
            logger.error(f"Failed to start monitoring session: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    async def stop_monitoring_session(self, session_id: str) -> MonitoringAPIResponse:
        """Stop an active monitoring session"""
        try:
            if session_id not in self.active_sessions:
                return MonitoringAPIResponse(
                    success=False,
                    error=f"Session '{session_id}' not found or not active"
                )

            # Get session summary
            session_data = self.active_sessions[session_id]
            session_summary = self.session_manager.end_session(session_id)

            # Remove from active sessions
            del self.active_sessions[session_id]

            return MonitoringAPIResponse(
                success=True,
                session_id=session_id,
                data={
                    "session_id": session_id,
                    "stopped_at": datetime.utcnow().isoformat(),
                    "duration": session_summary.get("duration"),
                    "event_count": session_data["event_count"],
                    "summary": session_summary
                }
            )

        except Exception as e:
            logger.error(f"Failed to stop monitoring session {session_id}: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    async def list_active_sessions(self) -> MonitoringAPIResponse:
        """List all active monitoring sessions"""
        try:
            sessions = []
            for session_id, session_data in self.active_sessions.items():
                sessions.append({
                    "session_id": session_id,
                    "started_at": session_data["started_at"],
                    "event_count": session_data["event_count"],
                    "config": session_data["config"]
                })

            return MonitoringAPIResponse(
                success=True,
                data={
                    "sessions": sessions,
                    "count": len(sessions)
                }
            )

        except Exception as e:
            logger.error(f"Failed to list active sessions: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    async def get_session_status(self, session_id: str) -> MonitoringAPIResponse:
        """Get status of a specific monitoring session"""
        try:
            if session_id not in self.active_sessions:
                return MonitoringAPIResponse(
                    success=False,
                    error=f"Session '{session_id}' not found or not active"
                )

            session_data = self.active_sessions[session_id]
            current_time = datetime.utcnow()
            started_time = datetime.fromisoformat(session_data["started_at"])
            duration = (current_time - started_time).total_seconds()

            return MonitoringAPIResponse(
                success=True,
                session_id=session_id,
                data={
                    "session_id": session_id,
                    "status": "active",
                    "started_at": session_data["started_at"],
                    "duration_seconds": duration,
                    "event_count": session_data["event_count"],
                    "config": session_data["config"]
                }
            )

        except Exception as e:
            logger.error(f"Failed to get session status for {session_id}: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    # Event Capture Endpoints

    async def capture_event(self, event_data: Dict[str, Any], session_id: str = None) -> MonitoringAPIResponse:
        """Capture a single event"""
        try:
            # Create captured event
            captured_event = CapturedEvent(
                event_id=event_data.get("event_id", f"evt_{datetime.utcnow().timestamp()}"),
                timestamp=datetime.fromisoformat(event_data.get("timestamp", datetime.utcnow().isoformat())),
                event_type=event_data.get("event_type", "unknown"),
                session_id=session_id,
                run_id=event_data.get("run_id"),
                payload=event_data.get("payload", {}),
                processing_stage=event_data.get("processing_stage", "captured"),
                tool_usage=event_data.get("tool_usage"),
                content_analysis=event_data.get("content_analysis"),
                context_metadata=event_data.get("context_metadata")
            )

            # Store event
            self.event_capture.capture_event(asdict(captured_event))

            # Update session event count if session is active
            if session_id and session_id in self.active_sessions:
                self.active_sessions[session_id]["event_count"] += 1

            return MonitoringAPIResponse(
                success=True,
                session_id=session_id,
                data={
                    "event_id": captured_event.event_id,
                    "captured_at": captured_event.timestamp.isoformat(),
                    "event_type": captured_event.event_type
                }
            )

        except Exception as e:
            logger.error(f"Failed to capture event: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    async def get_events(self, session_id: str = None, event_type: str = None,
                        limit: int = 100, offset: int = 0) -> MonitoringAPIResponse:
        """Get captured events with optional filtering"""
        try:
            events = self.event_capture.get_events()

            # Apply filters
            if session_id:
                events = [e for e in events if e.session_id == session_id]

            if event_type:
                events = [e for e in events if e.event_type == event_type]

            # Apply pagination
            total_count = len(events)
            events = events[offset:offset + limit]

            # Convert to dict format
            events_data = [asdict(event) for event in events]

            return MonitoringAPIResponse(
                success=True,
                data={
                    "events": events_data,
                    "count": len(events_data),
                    "total_count": total_count,
                    "offset": offset,
                    "limit": limit
                }
            )

        except Exception as e:
            logger.error(f"Failed to get events: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    async def get_event_by_id(self, event_id: str) -> MonitoringAPIResponse:
        """Get a specific event by ID"""
        try:
            events = self.event_capture.get_events()
            event = next((e for e in events if e.event_id == event_id), None)

            if not event:
                return MonitoringAPIResponse(
                    success=False,
                    error=f"Event '{event_id}' not found"
                )

            return MonitoringAPIResponse(
                success=True,
                data=asdict(event)
            )

        except Exception as e:
            logger.error(f"Failed to get event {event_id}: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    # Event Processing Endpoints

    async def process_events(self, session_id: str = None) -> MonitoringAPIResponse:
        """Process captured events for analysis"""
        try:
            events = self.event_capture.get_events()

            if session_id:
                events = [e for e in events if e.session_id == session_id]

            # Process events
            processing_result = await self.event_processor.process_event_batch(events)

            return MonitoringAPIResponse(
                success=True,
                session_id=session_id,
                data={
                    "processed_count": len(events),
                    "processing_result": processing_result,
                    "processed_at": datetime.utcnow().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"Failed to process events: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    async def get_event_statistics(self, session_id: str = None,
                                  time_range_hours: int = 24) -> MonitoringAPIResponse:
        """Get event statistics and analytics"""
        try:
            events = self.event_capture.get_events()

            # Apply filters
            if session_id:
                events = [e for e in events if e.session_id == session_id]

            # Filter by time range
            cutoff_time = datetime.utcnow() - timedelta(hours=time_range_hours)
            events = [e for e in events if e.timestamp > cutoff_time]

            # Calculate statistics
            statistics = {
                "total_events": len(events),
                "time_range_hours": time_range_hours,
                "event_types": {},
                "processing_stages": {},
                "sessions": set(),
                "events_per_hour": {}
            }

            for event in events:
                # Event type distribution
                event_type = event.event_type
                statistics["event_types"][event_type] = statistics["event_types"].get(event_type, 0) + 1

                # Processing stage distribution
                stage = event.processing_stage
                statistics["processing_stages"][stage] = statistics["processing_stages"].get(stage, 0) + 1

                # Session tracking
                if event.session_id:
                    statistics["sessions"].add(event.session_id)

                # Events per hour
                hour_key = event.timestamp.strftime("%Y-%m-%d %H:00")
                statistics["events_per_hour"][hour_key] = statistics["events_per_hour"].get(hour_key, 0) + 1

            # Convert set to count
            statistics["unique_sessions"] = len(statistics["sessions"])
            del statistics["sessions"]

            return MonitoringAPIResponse(
                success=True,
                session_id=session_id,
                data=statistics
            )

        except Exception as e:
            logger.error(f"Failed to get event statistics: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    # System Control Endpoints

    async def enable_monitoring(self) -> MonitoringAPIResponse:
        """Enable system-wide monitoring"""
        try:
            self.monitoring_enabled = True
            return MonitoringAPIResponse(
                success=True,
                data={
                    "monitoring_enabled": True,
                    "enabled_at": datetime.utcnow().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"Failed to enable monitoring: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    async def disable_monitoring(self) -> MonitoringAPIResponse:
        """Disable system-wide monitoring"""
        try:
            self.monitoring_enabled = False
            return MonitoringAPIResponse(
                success=True,
                data={
                    "monitoring_enabled": False,
                    "disabled_at": datetime.utcnow().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"Failed to disable monitoring: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    async def get_monitoring_status(self) -> MonitoringAPIResponse:
        """Get overall monitoring system status"""
        try:
            status = {
                "monitoring_enabled": self.monitoring_enabled,
                "active_sessions": len(self.active_sessions),
                "total_events": len(self.event_capture.get_events()),
                "data_directory": str(self.data_dir),
                "timestamp": datetime.utcnow().isoformat()
            }

            return MonitoringAPIResponse(success=True, data=status)

        except Exception as e:
            logger.error(f"Failed to get monitoring status: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))

    # Data Export Endpoints

    async def export_session_data(self, session_id: str, format: str = "json") -> MonitoringAPIResponse:
        """Export session data in specified format"""
        try:
            if session_id not in self.active_sessions:
                # Check if it's a completed session
                session_data = self.session_manager.get_session_data(session_id)
                if not session_data:
                    return MonitoringAPIResponse(
                        success=False,
                        error=f"Session '{session_id}' not found"
                    )
            else:
                session_data = self.active_sessions[session_id]

            # Get events for session
            events = [e for e in self.event_capture.get_events() if e.session_id == session_id]

            export_data = {
                "session_id": session_id,
                "session_data": session_data,
                "events": [asdict(event) for event in events],
                "exported_at": datetime.utcnow().isoformat(),
                "format": format
            }

            if format.lower() == "json":
                return MonitoringAPIResponse(
                    success=True,
                    session_id=session_id,
                    data=export_data
                )
            else:
                return MonitoringAPIResponse(
                    success=False,
                    error=f"Unsupported export format: {format}"
                )

        except Exception as e:
            logger.error(f"Failed to export session data for {session_id}: {e}")
            return MonitoringAPIResponse(success=False, error=str(e))


# CLI interface for testing
if __name__ == "__main__":
    import asyncio

    async def main():
        api = MonitoringAPI()

        print("Testing Monitoring API...")

        # Get monitoring status
        status = await api.get_monitoring_status()
        print(f"Monitoring Status: {status.success}")
        if status.success:
            print(f"  Enabled: {status.data['monitoring_enabled']}")
            print(f"  Active Sessions: {status.data['active_sessions']}")
            print(f"  Total Events: {status.data['total_events']}")

        # Start a test session
        session_response = await api.start_monitoring_session({
            "type": "test_session",
            "metadata": {"test": True}
        })
        print(f"Start Session: {session_response.success}")
        if session_response.success:
            session_id = session_response.data["session_id"]
            print(f"  Session ID: {session_id}")

            # Capture a test event
            event_response = await api.capture_event({
                "event_type": "test_event",
                "payload": {"message": "test event"},
                "processing_stage": "captured"
            }, session_id)
            print(f"  Capture Event: {event_response.success}")

            # Get session status
            status_response = await api.get_session_status(session_id)
            print(f"  Session Status: {status_response.success}")
            if status_response.success:
                print(f"    Events: {status_response.data['event_count']}")

            # Stop session
            stop_response = await api.stop_monitoring_session(session_id)
            print(f"  Stop Session: {stop_response.success}")

    asyncio.run(main())