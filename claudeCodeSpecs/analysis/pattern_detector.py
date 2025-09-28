#!/usr/bin/env python3
"""
Pattern Detector for Claude Code Behavioral Analysis

Detects recurring behavioral patterns in runtime data from Claude Code wrapper sessions.
Identifies completion patterns, error patterns, timing behaviors, and interaction sequences.

Leverages patterns from existing automation and wrapper scripts.
"""

import re
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, asdict
from collections import defaultdict, Counter
import statistics

logger = logging.getLogger(__name__)


@dataclass
class BehavioralPattern:
    """Represents a detected behavioral pattern in Claude Code runtime data."""
    name: str
    pattern_type: str  # 'completion', 'error', 'timing', 'sequence', 'cancellation'
    description: str
    frequency: int
    confidence: float  # 0.0 to 1.0
    triggers: List[str]
    conditions: List[str]
    outcomes: List[str]
    timing_stats: Optional[Dict[str, float]] = None
    examples: List[Dict[str, Any]] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.examples is None:
            self.examples = []
        if self.metadata is None:
            self.metadata = {}


@dataclass
class SessionAnalysis:
    """Analysis results for a complete Claude Code session."""
    session_id: str
    start_time: str
    end_time: str
    duration_seconds: float
    event_count: int
    patterns: List[BehavioralPattern]
    anomalies: List[str]
    performance_metrics: Dict[str, Any]
    completion_status: str


class PatternDetector:
    """Detects and analyzes behavioral patterns in Claude Code runtime data."""

    def __init__(self):
        # Completion detection patterns from automation script analysis
        self.completion_patterns = {
            'successful_completion': [
                r'run_completed.*outcome.*completed.*reason.*ok',
                r'auto_shutdown.*exit_on_complete.*true',
                r'state.*idle.*after.*run_completed'
            ],
            'limit_completion': [
                r'limit_notice.*detected',
                r'run_completed.*reason.*limit_reached',
                r'limit_reached.*true.*treating.*completed'
            ],
            'cancellation_completion': [
                r'cancel_requested.*run_id',
                r'run_cancelled.*outcome.*cancelled',
                r'cancel_scope.*cancel'
            ]
        }

        # Error patterns from wrapper analysis
        self.error_patterns = {
            'sdk_errors': [
                r'run_failed.*reason.*sdk_error',
                r'ProcessError.*EPIPE.*Broken pipe',
                r'Claude Code process failed'
            ],
            'validation_errors': [
                r'error.*Missing prompt',
                r'error.*Invalid ClaudeCodeOptions',
                r'error.*Agent is busy'
            ],
            'unexpected_errors': [
                r'run_failed.*reason.*unexpected',
                r'Unexpected Claude Code failure',
                r'failed to cancel task_group'
            ]
        }

        # Timing behavior patterns
        self.timing_thresholds = {
            'fast_completion': 5.0,     # seconds
            'normal_completion': 30.0,  # seconds
            'slow_completion': 120.0,   # seconds
            'timeout_threshold': 300.0  # seconds
        }

        # Session lifecycle patterns from claude_wrapper.py
        self.lifecycle_sequences = {
            'standard_flow': ['run_started', 'stream', 'run_completed', 'state'],
            'cancelled_flow': ['run_started', 'stream', 'cancel_requested', 'run_cancelled', 'state'],
            'error_flow': ['run_started', 'stream', 'run_failed', 'state'],
            'limit_flow': ['run_started', 'stream', 'limit_notice', 'run_completed', 'state']
        }

    def analyze_session_data(self, events: List[Dict[str, Any]], session_id: str = None) -> SessionAnalysis:
        """
        Analyze a complete session's event data for behavioral patterns.

        Args:
            events: List of event dictionaries from runtime monitoring
            session_id: Optional session identifier

        Returns:
            SessionAnalysis: Complete analysis of the session
        """
        if not events:
            raise ValueError("No events provided for analysis")

        logger.info(f"Analyzing session with {len(events)} events")

        session_id = session_id or self._extract_session_id(events)
        start_time, end_time, duration = self._calculate_session_timing(events)

        patterns = []

        # Detect different types of patterns
        patterns.extend(self._detect_completion_patterns(events))
        patterns.extend(self._detect_error_patterns(events))
        patterns.extend(self._detect_timing_patterns(events))
        patterns.extend(self._detect_sequence_patterns(events))
        patterns.extend(self._detect_cancellation_patterns(events))

        # Identify anomalies
        anomalies = self._detect_anomalies(events)

        # Calculate performance metrics
        performance_metrics = self._calculate_performance_metrics(events)

        # Determine completion status
        completion_status = self._determine_completion_status(events, patterns)

        return SessionAnalysis(
            session_id=session_id,
            start_time=start_time,
            end_time=end_time,
            duration_seconds=duration,
            event_count=len(events),
            patterns=patterns,
            anomalies=anomalies,
            performance_metrics=performance_metrics,
            completion_status=completion_status
        )

    def _extract_session_id(self, events: List[Dict[str, Any]]) -> str:
        """Extract session ID from events, or generate one."""
        for event in events:
            if 'session_id' in event:
                return event['session_id']
            if 'run_id' in event:
                return f"run_{event['run_id']}"
        return f"session_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    def _calculate_session_timing(self, events: List[Dict[str, Any]]) -> Tuple[str, str, float]:
        """Calculate session start time, end time, and duration."""
        timestamps = []
        for event in events:
            if 'timestamp' in event:
                try:
                    ts = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
                    timestamps.append(ts)
                except ValueError:
                    continue

        if not timestamps:
            now = datetime.utcnow()
            return now.isoformat(), now.isoformat(), 0.0

        start_time = min(timestamps)
        end_time = max(timestamps)
        duration = (end_time - start_time).total_seconds()

        return start_time.isoformat(), end_time.isoformat(), duration

    def _detect_completion_patterns(self, events: List[Dict[str, Any]]) -> List[BehavioralPattern]:
        """Detect completion-related behavioral patterns."""
        patterns = []

        # Combine events into text for pattern matching
        event_text = ' '.join([json.dumps(event) for event in events])

        for pattern_name, regexes in self.completion_patterns.items():
            matches = []
            total_confidence = 0.0

            for regex in regexes:
                match_count = len(re.findall(regex, event_text, re.IGNORECASE))
                if match_count > 0:
                    matches.append(regex)
                    total_confidence += match_count

            if matches:
                confidence = min(total_confidence / len(regexes), 1.0)

                pattern = BehavioralPattern(
                    name=pattern_name,
                    pattern_type='completion',
                    description=f"Detected {pattern_name} pattern in session",
                    frequency=len(matches),
                    confidence=confidence,
                    triggers=self._extract_triggers_for_pattern(events, matches),
                    conditions=self._extract_conditions_for_pattern(events, matches),
                    outcomes=self._extract_outcomes_for_pattern(events, matches),
                    examples=self._extract_examples_for_pattern(events, matches[:3])
                )
                patterns.append(pattern)

        return patterns

    def _detect_error_patterns(self, events: List[Dict[str, Any]]) -> List[BehavioralPattern]:
        """Detect error-related behavioral patterns."""
        patterns = []

        event_text = ' '.join([json.dumps(event) for event in events])

        for pattern_name, regexes in self.error_patterns.items():
            matches = []
            error_events = []

            for regex in regexes:
                if re.search(regex, event_text, re.IGNORECASE):
                    matches.append(regex)
                    # Find specific events that match
                    for event in events:
                        if re.search(regex, json.dumps(event), re.IGNORECASE):
                            error_events.append(event)

            if matches:
                pattern = BehavioralPattern(
                    name=pattern_name,
                    pattern_type='error',
                    description=f"Detected {pattern_name} in session",
                    frequency=len(error_events),
                    confidence=0.9,  # High confidence for explicit error patterns
                    triggers=[event.get('event', 'unknown') for event in error_events],
                    conditions=[event.get('reason', 'unknown') for event in error_events],
                    outcomes=[event.get('outcome', 'error') for event in error_events],
                    examples=error_events[:3]
                )
                patterns.append(pattern)

        return patterns

    def _detect_timing_patterns(self, events: List[Dict[str, Any]]) -> List[BehavioralPattern]:
        """Detect timing-related behavioral patterns."""
        patterns = []

        # Find run start and completion events
        runs = defaultdict(dict)
        for event in events:
            run_id = event.get('run_id')
            if not run_id:
                continue

            event_type = event.get('event', '')
            timestamp = event.get('timestamp')

            if timestamp:
                runs[run_id][event_type] = timestamp

        # Analyze timing for each run
        durations = []
        timing_categories = {'fast': 0, 'normal': 0, 'slow': 0, 'timeout': 0}

        for run_id, run_events in runs.items():
            if 'run_started' in run_events and 'run_completed' in run_events:
                try:
                    start = datetime.fromisoformat(run_events['run_started'].replace('Z', '+00:00'))
                    end = datetime.fromisoformat(run_events['run_completed'].replace('Z', '+00:00'))
                    duration = (end - start).total_seconds()
                    durations.append(duration)

                    # Categorize timing
                    if duration < self.timing_thresholds['fast_completion']:
                        timing_categories['fast'] += 1
                    elif duration < self.timing_thresholds['normal_completion']:
                        timing_categories['normal'] += 1
                    elif duration < self.timing_thresholds['slow_completion']:
                        timing_categories['slow'] += 1
                    else:
                        timing_categories['timeout'] += 1

                except ValueError:
                    continue

        if durations:
            timing_stats = {
                'min_duration': min(durations),
                'max_duration': max(durations),
                'mean_duration': statistics.mean(durations),
                'median_duration': statistics.median(durations),
                'std_duration': statistics.stdev(durations) if len(durations) > 1 else 0.0
            }

            # Create pattern for dominant timing category
            dominant_category = max(timing_categories, key=timing_categories.get)
            if timing_categories[dominant_category] > 0:
                pattern = BehavioralPattern(
                    name=f"{dominant_category}_execution_timing",
                    pattern_type='timing',
                    description=f"Session shows {dominant_category} execution timing pattern",
                    frequency=timing_categories[dominant_category],
                    confidence=timing_categories[dominant_category] / len(durations),
                    triggers=['run_started'],
                    conditions=[f"execution_time_{dominant_category}"],
                    outcomes=['run_completed'],
                    timing_stats=timing_stats
                )
                patterns.append(pattern)

        return patterns

    def _detect_sequence_patterns(self, events: List[Dict[str, Any]]) -> List[BehavioralPattern]:
        """Detect event sequence patterns."""
        patterns = []

        # Extract event sequence
        event_sequence = [event.get('event', 'unknown') for event in events]

        for flow_name, expected_sequence in self.lifecycle_sequences.items():
            # Check if this sequence appears in the events
            sequence_matches = self._find_subsequence_matches(event_sequence, expected_sequence)

            if sequence_matches:
                pattern = BehavioralPattern(
                    name=f"{flow_name}_sequence",
                    pattern_type='sequence',
                    description=f"Detected {flow_name} event sequence pattern",
                    frequency=len(sequence_matches),
                    confidence=1.0 if len(sequence_matches) > 0 else 0.0,
                    triggers=[expected_sequence[0]],
                    conditions=[f"follows_{flow_name}_pattern"],
                    outcomes=[expected_sequence[-1]],
                    metadata={'expected_sequence': expected_sequence, 'matches': sequence_matches}
                )
                patterns.append(pattern)

        return patterns

    def _detect_cancellation_patterns(self, events: List[Dict[str, Any]]) -> List[BehavioralPattern]:
        """Detect cancellation-related patterns."""
        patterns = []

        cancellation_events = [
            event for event in events
            if event.get('event') in ['cancel_requested', 'run_cancelled', 'cancel_ignored']
        ]

        if cancellation_events:
            # Analyze cancellation success rate
            cancel_requests = len([e for e in cancellation_events if e.get('event') == 'cancel_requested'])
            cancel_successes = len([e for e in cancellation_events if e.get('event') == 'run_cancelled'])
            cancel_ignored = len([e for e in cancellation_events if e.get('event') == 'cancel_ignored'])

            success_rate = cancel_successes / cancel_requests if cancel_requests > 0 else 0.0

            pattern = BehavioralPattern(
                name='cancellation_behavior',
                pattern_type='cancellation',
                description=f"Cancellation pattern with {success_rate:.1%} success rate",
                frequency=len(cancellation_events),
                confidence=1.0,
                triggers=['user_cancel', 'system_cancel'],
                conditions=[
                    f"cancel_requests={cancel_requests}",
                    f"cancel_successes={cancel_successes}",
                    f"cancel_ignored={cancel_ignored}"
                ],
                outcomes=['run_cancelled', 'cancel_ignored'],
                metadata={'success_rate': success_rate}
            )
            patterns.append(pattern)

        return patterns

    def _find_subsequence_matches(self, sequence: List[str], subsequence: List[str]) -> List[int]:
        """Find all positions where subsequence appears in sequence."""
        matches = []
        for i in range(len(sequence) - len(subsequence) + 1):
            if sequence[i:i+len(subsequence)] == subsequence:
                matches.append(i)
        return matches

    def _extract_triggers_for_pattern(self, events: List[Dict[str, Any]], pattern_matches: List[str]) -> List[str]:
        """Extract triggers associated with a pattern."""
        triggers = set()
        for event in events:
            event_str = json.dumps(event)
            for pattern in pattern_matches:
                if re.search(pattern, event_str, re.IGNORECASE):
                    triggers.add(event.get('event', 'unknown'))
        return list(triggers)

    def _extract_conditions_for_pattern(self, events: List[Dict[str, Any]], pattern_matches: List[str]) -> List[str]:
        """Extract conditions associated with a pattern."""
        conditions = set()
        for event in events:
            if event.get('reason'):
                conditions.add(f"reason={event['reason']}")
            if event.get('outcome'):
                conditions.add(f"outcome={event['outcome']}")
        return list(conditions)

    def _extract_outcomes_for_pattern(self, events: List[Dict[str, Any]], pattern_matches: List[str]) -> List[str]:
        """Extract outcomes associated with a pattern."""
        outcomes = set()
        for event in events:
            if event.get('outcome'):
                outcomes.add(event['outcome'])
            elif event.get('state'):
                outcomes.add(f"state={event['state']}")
        return list(outcomes)

    def _extract_examples_for_pattern(self, events: List[Dict[str, Any]], pattern_matches: List[str]) -> List[Dict[str, Any]]:
        """Extract example events that match the pattern."""
        examples = []
        for event in events:
            event_str = json.dumps(event)
            for pattern in pattern_matches:
                if re.search(pattern, event_str, re.IGNORECASE) and len(examples) < 3:
                    examples.append(event)
                    break
        return examples

    def _detect_anomalies(self, events: List[Dict[str, Any]]) -> List[str]:
        """Detect anomalous behaviors in the event stream."""
        anomalies = []

        # Check for unexpected event sequences
        event_types = [event.get('event', 'unknown') for event in events]

        # Anomaly: Multiple run_started without run_completed
        start_count = event_types.count('run_started')
        complete_count = event_types.count('run_completed') + event_types.count('run_cancelled') + event_types.count('run_failed')

        if start_count > complete_count:
            anomalies.append(f"Incomplete runs detected: {start_count} started, {complete_count} completed")

        # Anomaly: Events without timestamps
        events_without_timestamps = sum(1 for event in events if not event.get('timestamp'))
        if events_without_timestamps > 0:
            anomalies.append(f"{events_without_timestamps} events missing timestamps")

        # Anomaly: Long gaps between events
        timestamps = []
        for event in events:
            if event.get('timestamp'):
                try:
                    ts = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
                    timestamps.append(ts)
                except ValueError:
                    continue

        if len(timestamps) > 1:
            gaps = [(timestamps[i+1] - timestamps[i]).total_seconds() for i in range(len(timestamps)-1)]
            large_gaps = [gap for gap in gaps if gap > 60]  # Gaps > 1 minute
            if large_gaps:
                anomalies.append(f"Large timing gaps detected: {len(large_gaps)} gaps > 60 seconds")

        return anomalies

    def _calculate_performance_metrics(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate performance metrics from events."""
        metrics = {}

        # Event frequency
        event_types = Counter([event.get('event', 'unknown') for event in events])
        metrics['event_frequency'] = dict(event_types)

        # Stream events analysis
        stream_events = [event for event in events if event.get('event') == 'stream']
        metrics['stream_event_count'] = len(stream_events)

        # Error rate
        error_events = [event for event in events if event.get('event') in ['error', 'run_failed']]
        metrics['error_rate'] = len(error_events) / len(events) if events else 0.0

        # Completion rate
        completion_events = [event for event in events if event.get('event') == 'run_completed']
        start_events = [event for event in events if event.get('event') == 'run_started']
        metrics['completion_rate'] = len(completion_events) / len(start_events) if start_events else 0.0

        return metrics

    def _determine_completion_status(self, events: List[Dict[str, Any]], patterns: List[BehavioralPattern]) -> str:
        """Determine the overall completion status of the session."""
        completion_patterns = [p for p in patterns if p.pattern_type == 'completion']
        error_patterns = [p for p in patterns if p.pattern_type == 'error']

        # Check final events
        final_events = events[-3:] if len(events) >= 3 else events
        final_event_types = [event.get('event', '') for event in final_events]

        if 'run_completed' in final_event_types:
            return 'completed'
        elif 'run_cancelled' in final_event_types:
            return 'cancelled'
        elif 'run_failed' in final_event_types or error_patterns:
            return 'failed'
        elif 'auto_shutdown' in final_event_types:
            return 'shutdown'
        else:
            return 'unknown'

    def export_analysis(self, analysis: SessionAnalysis, format: str = 'json') -> str:
        """Export session analysis in specified format."""
        if format == 'json':
            return json.dumps(asdict(analysis), indent=2, default=str)
        elif format == 'summary':
            return self._generate_summary_report(analysis)
        else:
            raise ValueError(f"Unsupported export format: {format}")

    def _generate_summary_report(self, analysis: SessionAnalysis) -> str:
        """Generate a human-readable summary report."""
        lines = [
            f"# Session Analysis Report",
            f"",
            f"**Session ID:** {analysis.session_id}",
            f"**Duration:** {analysis.duration_seconds:.1f} seconds",
            f"**Events:** {analysis.event_count}",
            f"**Status:** {analysis.completion_status}",
            f"",
            f"## Detected Patterns ({len(analysis.patterns)})",
        ]

        for pattern in analysis.patterns:
            lines.extend([
                f"",
                f"### {pattern.name} ({pattern.pattern_type})",
                f"- **Frequency:** {pattern.frequency}",
                f"- **Confidence:** {pattern.confidence:.2f}",
                f"- **Description:** {pattern.description}",
            ])

        if analysis.anomalies:
            lines.extend([
                f"",
                f"## Anomalies ({len(analysis.anomalies)})",
            ])
            for anomaly in analysis.anomalies:
                lines.append(f"- {anomaly}")

        return "\\n".join(lines)


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)

    # Sample events for testing
    sample_events = [
        {"event": "run_started", "run_id": "test-1", "timestamp": "2025-01-01T10:00:00Z"},
        {"event": "stream", "run_id": "test-1", "timestamp": "2025-01-01T10:00:01Z"},
        {"event": "stream", "run_id": "test-1", "timestamp": "2025-01-01T10:00:02Z"},
        {"event": "run_completed", "run_id": "test-1", "outcome": "completed", "reason": "ok", "timestamp": "2025-01-01T10:00:10Z"},
        {"event": "state", "state": "idle", "timestamp": "2025-01-01T10:00:11Z"}
    ]

    detector = PatternDetector()
    analysis = detector.analyze_session_data(sample_events, "test-session")

    print("Session Analysis:")
    print(detector.export_analysis(analysis, 'json'))