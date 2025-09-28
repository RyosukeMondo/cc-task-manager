#!/usr/bin/env python3
"""
Runtime Monitoring Capture Engine

Captures real-time Claude Code behavior for specification generation.
Leverages debug patterns from spec_workflow_automation.py and event handling from claude_wrapper.py.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict
from queue import Queue, Empty
import threading

logger = logging.getLogger(__name__)


@dataclass
class CapturedEvent:
    """Represents a captured Claude Code event with enriched metadata."""

    event_id: str
    timestamp: datetime
    event_type: str
    session_id: Optional[str]
    run_id: Optional[str]
    payload: Dict[str, Any]
    processing_stage: str
    tool_usage: Optional[Dict[str, Any]] = None
    content_analysis: Optional[Dict[str, Any]] = None
    context_metadata: Optional[Dict[str, Any]] = None


class EventCapture:
    """Core event capture functionality with real-time processing."""

    def __init__(self,
                 max_events_in_memory: int = 10000,
                 capture_filter: Optional[Callable[[Dict[str, Any]], bool]] = None):
        self.max_events_in_memory = max_events_in_memory
        self.capture_filter = capture_filter or (lambda x: True)
        self.events: List[CapturedEvent] = []
        self.event_queue = Queue()
        self.session_metadata = {}
        self.current_session_id: Optional[str] = None
        self.current_run_id: Optional[str] = None
        self.capture_active = False
        self.processing_thread: Optional[threading.Thread] = None

    def start_capture(self) -> None:
        """Start capturing events in background."""
        if self.capture_active:
            logger.warning("Capture already active")
            return

        self.capture_active = True
        self.processing_thread = threading.Thread(target=self._process_events, daemon=True)
        self.processing_thread.start()
        logger.info("Event capture started")

    def stop_capture(self) -> None:
        """Stop capturing events and cleanup."""
        if not self.capture_active:
            return

        self.capture_active = False
        if self.processing_thread:
            self.processing_thread.join(timeout=5.0)
        logger.info("Event capture stopped")

    def capture_event(self, raw_event: Dict[str, Any]) -> Optional[str]:
        """Capture a single event from Claude Code output."""
        if not self.capture_active or not self.capture_filter(raw_event):
            return None

        event_id = str(uuid.uuid4())

        # Extract session and run context
        session_id = self._extract_session_id(raw_event)
        run_id = self._extract_run_id(raw_event)

        # Update tracking state
        if session_id and session_id != self.current_session_id:
            self.current_session_id = session_id
            logger.info(f"Session changed to: {session_id}")

        if run_id and run_id != self.current_run_id:
            self.current_run_id = run_id
            logger.info(f"Run changed to: {run_id}")

        # Create enriched event
        captured_event = CapturedEvent(
            event_id=event_id,
            timestamp=datetime.utcnow(),
            event_type=raw_event.get("event", "unknown"),
            session_id=self.current_session_id,
            run_id=self.current_run_id,
            payload=raw_event,
            processing_stage="captured",
            tool_usage=self._extract_tool_usage(raw_event),
            content_analysis=self._analyze_content_structure(raw_event),
            context_metadata=self._extract_context_metadata(raw_event)
        )

        # Queue for processing
        self.event_queue.put(captured_event)

        return event_id

    def _process_events(self) -> None:
        """Background processing of captured events."""
        logger.info("Event processing thread started")

        while self.capture_active:
            try:
                event = self.event_queue.get(timeout=1.0)
                self._process_single_event(event)

                # Memory management
                if len(self.events) > self.max_events_in_memory:
                    # Remove oldest events beyond limit
                    events_to_remove = len(self.events) - self.max_events_in_memory
                    self.events = self.events[events_to_remove:]

            except Empty:
                continue
            except Exception as e:
                logger.error(f"Error processing event: {e}")

        logger.info("Event processing thread stopped")

    def _process_single_event(self, event: CapturedEvent) -> None:
        """Process a single captured event with enrichment."""
        try:
            # Update processing stage
            event.processing_stage = "processing"

            # Enrich with additional analysis
            if event.event_type == "stream":
                self._enrich_stream_event(event)
            elif event.event_type in ["run_started", "run_completed", "run_failed"]:
                self._enrich_run_event(event)
            elif event.event_type in ["tool_call", "tool_result"]:
                self._enrich_tool_event(event)

            # Mark as processed and store
            event.processing_stage = "processed"
            self.events.append(event)

            logger.debug(f"Processed event {event.event_id}: {event.event_type}")

        except Exception as e:
            event.processing_stage = "error"
            logger.error(f"Failed to process event {event.event_id}: {e}")
            self.events.append(event)  # Store even failed events for debugging

    def _extract_session_id(self, raw_event: Dict[str, Any]) -> Optional[str]:
        """Extract session ID from event data."""
        # Check various locations where session ID might be stored
        return (raw_event.get("session_id") or
                raw_event.get("payload", {}).get("session_id") or
                self.current_session_id)

    def _extract_run_id(self, raw_event: Dict[str, Any]) -> Optional[str]:
        """Extract run ID from event data."""
        return (raw_event.get("run_id") or
                raw_event.get("payload", {}).get("run_id") or
                self.current_run_id)

    def _extract_tool_usage(self, raw_event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract tool usage information from event."""
        if raw_event.get("event") != "stream":
            return None

        payload = raw_event.get("payload", {})
        content = payload.get("content", [])

        tools_used = []
        tool_results = []

        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "tool_use":
                        tools_used.append({
                            "tool_id": item.get("id"),
                            "tool_name": item.get("name"),
                            "input_keys": list(item.get("input", {}).keys()),
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    elif item.get("type") == "tool_result":
                        tool_results.append({
                            "tool_use_id": item.get("tool_use_id"),
                            "is_error": item.get("is_error", False),
                            "content_type": type(item.get("content", "")).__name__,
                            "timestamp": datetime.utcnow().isoformat()
                        })

        if tools_used or tool_results:
            return {
                "tools_used": tools_used,
                "tool_results": tool_results,
                "total_tools": len(tools_used),
                "total_results": len(tool_results)
            }

        return None

    def _analyze_content_structure(self, raw_event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Analyze content structure for pattern detection."""
        if raw_event.get("event") != "stream":
            return None

        payload = raw_event.get("payload", {})
        content = payload.get("content", [])

        analysis = {
            "content_items": len(content) if isinstance(content, list) else 0,
            "content_types": {},
            "has_text": False,
            "has_tools": False,
            "text_length": 0,
            "timestamp": datetime.utcnow().isoformat()
        }

        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    item_type = item.get("type", "unknown")
                    analysis["content_types"][item_type] = analysis["content_types"].get(item_type, 0) + 1

                    if item_type == "text" and "text" in item:
                        analysis["has_text"] = True
                        analysis["text_length"] += len(item["text"])
                    elif item_type in ["tool_use", "tool_result"]:
                        analysis["has_tools"] = True

        return analysis

    def _extract_context_metadata(self, raw_event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract contextual metadata for behavioral analysis."""
        metadata = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_source": "claude_code",
        }

        # Add event-specific metadata
        event_type = raw_event.get("event")
        if event_type == "stream":
            payload = raw_event.get("payload", {})
            metadata.update({
                "stream_type": payload.get("type"),
                "has_delta": "delta" in payload,
                "payload_keys": list(payload.keys())
            })
        elif event_type in ["run_started", "run_completed", "run_failed"]:
            metadata.update({
                "run_state": event_type.replace("run_", ""),
                "has_error": "error" in raw_event
            })

        return metadata

    def _enrich_stream_event(self, event: CapturedEvent) -> None:
        """Add specific enrichment for stream events."""
        payload = event.payload.get("payload", {})

        # Detect completion patterns (leveraging automation script patterns)
        content_text = self._extract_text_content(payload)
        if content_text:
            event.context_metadata = event.context_metadata or {}
            event.context_metadata["completion_patterns"] = self._check_completion_patterns(content_text)
            event.context_metadata["text_analysis"] = {
                "length": len(content_text),
                "word_count": len(content_text.split()),
                "has_spec_keywords": any(keyword in content_text.lower() for keyword in
                                       ["specification", "tasks", "completed", "pending"])
            }

    def _enrich_run_event(self, event: CapturedEvent) -> None:
        """Add specific enrichment for run lifecycle events."""
        event.context_metadata = event.context_metadata or {}
        event.context_metadata["run_lifecycle"] = {
            "stage": event.event_type.replace("run_", ""),
            "duration_tracking": True,
            "session_context": event.session_id is not None
        }

    def _enrich_tool_event(self, event: CapturedEvent) -> None:
        """Add specific enrichment for tool events."""
        event.context_metadata = event.context_metadata or {}
        event.context_metadata["tool_analysis"] = {
            "is_mcp_tool": self._is_mcp_tool(event.payload),
            "is_spec_workflow_tool": self._is_spec_workflow_tool(event.payload),
            "has_structured_output": self._has_structured_output(event.payload)
        }

    def _extract_text_content(self, payload: Dict[str, Any]) -> str:
        """Extract all text content from a payload."""
        text_parts = []
        content = payload.get("content", [])

        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_parts.append(item.get("text", ""))

        return " ".join(text_parts)

    def _check_completion_patterns(self, text: str) -> List[str]:
        """Check for completion patterns (from automation script)."""
        patterns = [
            "specification is fully implemented",
            "all tasks are marked as completed",
            "all tasks are completed",
            "0 pending tasks",
            "specification completed"
        ]

        found_patterns = []
        text_lower = text.lower()
        for pattern in patterns:
            if pattern in text_lower:
                found_patterns.append(pattern)

        return found_patterns

    def _is_mcp_tool(self, payload: Dict[str, Any]) -> bool:
        """Check if this is an MCP tool call."""
        content = payload.get("payload", {}).get("content", [])
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "tool_use":
                    tool_name = item.get("name", "")
                    return tool_name.startswith("mcp__")
        return False

    def _is_spec_workflow_tool(self, payload: Dict[str, Any]) -> bool:
        """Check if this is a spec-workflow tool call."""
        content = payload.get("payload", {}).get("content", [])
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "tool_use":
                    tool_name = item.get("name", "")
                    return "spec-workflow" in tool_name
        return False

    def _has_structured_output(self, payload: Dict[str, Any]) -> bool:
        """Check if tool result has structured JSON output."""
        content = payload.get("payload", {}).get("content", [])
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "tool_result":
                    result_content = item.get("content", "")
                    if isinstance(result_content, str):
                        try:
                            json.loads(result_content)
                            return True
                        except:
                            pass
        return False


class CaptureEngine:
    """High-level capture engine with persistence and configuration."""

    def __init__(self,
                 output_directory: Path,
                 capture_config: Optional[Dict[str, Any]] = None):
        self.output_directory = Path(output_directory)
        self.output_directory.mkdir(parents=True, exist_ok=True)

        self.config = capture_config or {
            "max_events_in_memory": 10000,
            "auto_save_interval": 300,  # 5 minutes
            "capture_filters": {
                "include_stream_events": True,
                "include_tool_events": True,
                "include_run_events": True,
                "min_content_length": 10
            },
            "performance_limits": {
                "max_processing_time_ms": 100,
                "max_memory_usage_mb": 500
            }
        }

        self.event_capture = EventCapture(
            max_events_in_memory=self.config["max_events_in_memory"],
            capture_filter=self._create_capture_filter()
        )

        self.capture_session_id = str(uuid.uuid4())
        self.capture_start_time: Optional[datetime] = None
        self.auto_save_task: Optional[asyncio.Task] = None

    def _create_capture_filter(self) -> Callable[[Dict[str, Any]], bool]:
        """Create event filter based on configuration."""
        filters = self.config.get("capture_filters", {})

        def filter_func(event: Dict[str, Any]) -> bool:
            event_type = event.get("event", "")

            # Event type filtering
            if event_type == "stream" and not filters.get("include_stream_events", True):
                return False
            if event_type in ["tool_call", "tool_result"] and not filters.get("include_tool_events", True):
                return False
            if event_type.startswith("run_") and not filters.get("include_run_events", True):
                return False

            # Content length filtering for stream events
            if event_type == "stream":
                payload = event.get("payload", {})
                text_content = self._extract_text_from_payload(payload)
                min_length = filters.get("min_content_length", 0)
                if len(text_content) < min_length:
                    return False

            return True

        return filter_func

    def _extract_text_from_payload(self, payload: Dict[str, Any]) -> str:
        """Helper to extract text for filtering."""
        content = payload.get("content", [])
        text_parts = []

        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_parts.append(item.get("text", ""))

        return " ".join(text_parts)

    def start_capture(self) -> str:
        """Start the capture engine."""
        if self.capture_start_time:
            logger.warning("Capture already running")
            return self.capture_session_id

        self.capture_start_time = datetime.utcnow()
        self.event_capture.start_capture()

        logger.info(f"Capture engine started with session ID: {self.capture_session_id}")

        # Schedule periodic saves
        if self.config.get("auto_save_interval", 0) > 0:
            asyncio.create_task(self._auto_save_loop())

        return self.capture_session_id

    def stop_capture(self) -> Dict[str, Any]:
        """Stop capture and return summary."""
        if not self.capture_start_time:
            logger.warning("Capture not running")
            return {}

        self.event_capture.stop_capture()

        # Cancel auto-save
        if self.auto_save_task:
            self.auto_save_task.cancel()

        # Final save
        summary = self.save_captured_data()

        capture_duration = datetime.utcnow() - self.capture_start_time
        summary.update({
            "capture_session_id": self.capture_session_id,
            "capture_duration_seconds": capture_duration.total_seconds(),
            "total_events_captured": len(self.event_capture.events)
        })

        self.capture_start_time = None
        logger.info(f"Capture stopped. Summary: {summary}")

        return summary

    def capture_event(self, raw_event: Dict[str, Any]) -> Optional[str]:
        """Capture a single event."""
        if not self.capture_start_time:
            logger.warning("Capture not started - event ignored")
            return None

        return self.event_capture.capture_event(raw_event)

    def save_captured_data(self) -> Dict[str, Any]:
        """Save captured data to disk."""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        # Save events
        events_file = self.output_directory / f"events_{timestamp}.jsonl"
        events_saved = 0

        with open(events_file, 'w') as f:
            for event in self.event_capture.events:
                try:
                    json.dump(asdict(event), f, default=str)
                    f.write('\n')
                    events_saved += 1
                except Exception as e:
                    logger.error(f"Failed to save event {event.event_id}: {e}")

        # Save metadata
        metadata_file = self.output_directory / f"metadata_{timestamp}.json"
        metadata = {
            "capture_session_id": self.capture_session_id,
            "capture_start_time": self.capture_start_time.isoformat() if self.capture_start_time else None,
            "save_time": datetime.utcnow().isoformat(),
            "total_events": len(self.event_capture.events),
            "events_saved": events_saved,
            "config": self.config,
            "files": {
                "events": str(events_file),
                "metadata": str(metadata_file)
            }
        }

        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)

        logger.info(f"Saved {events_saved} events to {events_file}")

        return {
            "events_saved": events_saved,
            "events_file": str(events_file),
            "metadata_file": str(metadata_file)
        }

    async def _auto_save_loop(self) -> None:
        """Periodic auto-save loop."""
        interval = self.config.get("auto_save_interval", 300)

        while self.capture_start_time:
            try:
                await asyncio.sleep(interval)
                if self.capture_start_time:  # Check again after sleep
                    self.save_captured_data()
                    logger.info("Auto-save completed")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Auto-save failed: {e}")


# Factory function for easy instantiation
def create_capture_engine(output_directory: str,
                         config: Optional[Dict[str, Any]] = None) -> CaptureEngine:
    """Factory function to create a configured capture engine."""
    return CaptureEngine(Path(output_directory), config)


if __name__ == "__main__":
    # Example usage
    import sys

    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )

    # Create capture engine
    engine = create_capture_engine("./captured_data")

    print("Starting capture engine...")
    session_id = engine.start_capture()

    # Simulate capturing some events
    sample_events = [
        {"event": "ready", "timestamp": datetime.utcnow().isoformat()},
        {
            "event": "stream",
            "payload": {
                "content": [
                    {"type": "text", "text": "Starting task implementation..."}
                ]
            }
        },
        {
            "event": "run_started",
            "run_id": "test-run-123"
        }
    ]

    for event in sample_events:
        event_id = engine.capture_event(event)
        print(f"Captured event: {event_id}")

    # Stop and save
    print("Stopping capture...")
    summary = engine.stop_capture()
    print(f"Capture summary: {summary}")