#!/usr/bin/env python3
"""
Advanced Pattern Detector for Claude Code Behavioral Analysis

Enhanced pattern detection capabilities incorporating insights from:
- Python StateMachine library patterns
- BDD/Gherkin behavioral specification approaches
- Sequential analysis findings
- Advanced statistical pattern recognition
"""

import json
import logging
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict, Counter
import re

logger = logging.getLogger(__name__)


@dataclass
class AdvancedBehavioralPattern:
    """Enhanced behavioral pattern with advanced detection capabilities."""
    name: str
    pattern_type: str
    description: str
    confidence: float
    frequency: int
    triggers: List[str]
    outcomes: List[str]
    examples: List[Dict[str, Any]]

    # Advanced pattern attributes
    temporal_distribution: Dict[str, int]  # Time-based occurrence patterns
    contextual_conditions: List[str]  # Environmental conditions when pattern occurs
    pattern_dependencies: List[str]  # Other patterns this depends on
    statistical_significance: float  # P-value or confidence interval
    evolution_trend: str  # "stable", "increasing", "decreasing", "cyclical"
    performance_impact: Dict[str, float]  # Impact on system performance metrics
    error_correlation: float  # Correlation with error events (0-1)

    # BDD-style specification
    gherkin_scenario: str  # Given-When-Then scenario description
    acceptance_criteria: List[str]  # Testable acceptance criteria

    timing_stats: Optional[Dict[str, float]] = None
    metadata: Dict[str, Any] = None


class AdvancedPatternDetector:
    """
    Enhanced pattern detector with sophisticated analysis capabilities.
    """

    def __init__(self):
        self.pattern_templates = self._initialize_pattern_templates()
        self.statistical_thresholds = {
            'min_frequency': 2,
            'min_confidence': 0.6,
            'significance_level': 0.05,
            'correlation_threshold': 0.7
        }

    def _initialize_pattern_templates(self) -> Dict[str, Dict]:
        """Initialize advanced pattern templates based on research."""
        return {
            'state_transition_pattern': {
                'description': "State machine transition pattern with guards and conditions",
                'triggers': ['state_change', 'event_trigger'],
                'detection_logic': self._detect_state_transition_patterns,
                'gherkin_template': "Given {initial_state} When {trigger_event} Then {target_state}"
            },
            'retry_recovery_pattern': {
                'description': "Error recovery pattern with exponential backoff",
                'triggers': ['error', 'retry', 'timeout'],
                'detection_logic': self._detect_retry_patterns,
                'gherkin_template': "Given {error_condition} When {retry_attempt} Then {recovery_outcome}"
            },
            'performance_degradation_pattern': {
                'description': "Progressive performance degradation pattern",
                'triggers': ['slow_response', 'timeout', 'resource_exhaustion'],
                'detection_logic': self._detect_performance_patterns,
                'gherkin_template': "Given {baseline_performance} When {load_increases} Then {performance_degrades}"
            },
            'concurrent_behavior_pattern': {
                'description': "Concurrent operation interaction patterns",
                'triggers': ['parallel_execution', 'resource_contention'],
                'detection_logic': self._detect_concurrency_patterns,
                'gherkin_template': "Given {multiple_operations} When {concurrent_execution} Then {interaction_outcome}"
            },
            'user_interaction_pattern': {
                'description': "User behavior and interaction patterns",
                'triggers': ['user_input', 'user_action', 'ui_interaction'],
                'detection_logic': self._detect_user_patterns,
                'gherkin_template': "Given {user_context} When {user_action} Then {system_response}"
            },
            'data_flow_pattern': {
                'description': "Data transformation and flow patterns",
                'triggers': ['data_input', 'transformation', 'data_output'],
                'detection_logic': self._detect_data_flow_patterns,
                'gherkin_template': "Given {input_data} When {processing_occurs} Then {output_data}"
            }
        }

    def analyze_advanced_session_data(
        self,
        session_events: List[Dict[str, Any]],
        session_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[AdvancedBehavioralPattern]:
        """
        Perform advanced pattern analysis on session data.
        """
        logger.info(f"Advanced analysis of session {session_id} with {len(session_events)} events")

        detected_patterns = []

        # Preprocess events for advanced analysis
        enriched_events = self._enrich_events(session_events, context)

        # Detect patterns using multiple approaches
        for pattern_type, template in self.pattern_templates.items():
            patterns = template['detection_logic'](enriched_events, session_id)
            detected_patterns.extend(patterns)

        # Apply statistical analysis and filtering
        validated_patterns = self._validate_patterns_statistically(detected_patterns, enriched_events)

        # Generate BDD specifications for each pattern
        for pattern in validated_patterns:
            pattern.gherkin_scenario = self._generate_gherkin_scenario(pattern, enriched_events)
            pattern.acceptance_criteria = self._generate_acceptance_criteria(pattern)

        return validated_patterns

    def _enrich_events(self, events: List[Dict[str, Any]], context: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enrich events with additional metadata for advanced analysis."""
        enriched = []

        for i, event in enumerate(events):
            enriched_event = event.copy()

            # Add temporal information
            if 'timestamp' in event:
                enriched_event['event_index'] = i
                enriched_event['time_since_start'] = self._calculate_time_delta(events[0], event)
                if i > 0:
                    enriched_event['time_since_previous'] = self._calculate_time_delta(events[i-1], event)

            # Add sequence context
            enriched_event['preceding_events'] = [e['event'] for e in events[max(0, i-3):i]]
            enriched_event['following_events'] = [e['event'] for e in events[i+1:min(len(events), i+4)]]

            # Add statistical context
            event_type = event.get('event', 'unknown')
            enriched_event['event_frequency'] = sum(1 for e in events if e.get('event') == event_type)
            enriched_event['position_ratio'] = i / len(events) if events else 0

            enriched.append(enriched_event)

        return enriched

    def _detect_state_transition_patterns(self, events: List[Dict[str, Any]], session_id: str) -> List[AdvancedBehavioralPattern]:
        """Detect sophisticated state transition patterns."""
        patterns = []

        # Find state transition sequences
        state_sequences = []
        current_sequence = []

        for event in events:
            if event.get('event') in ['run_started', 'run_completed', 'run_cancelled', 'state']:
                current_sequence.append(event)
            elif current_sequence:
                state_sequences.append(current_sequence)
                current_sequence = []

        if current_sequence:
            state_sequences.append(current_sequence)

        # Analyze transition patterns
        for seq in state_sequences:
            if len(seq) >= 3:  # Minimum for meaningful transition
                pattern = self._create_transition_pattern(seq, session_id)
                if pattern:
                    patterns.append(pattern)

        return patterns

    def _detect_retry_patterns(self, events: List[Dict[str, Any]], session_id: str) -> List[AdvancedBehavioralPattern]:
        """Detect retry and recovery patterns."""
        patterns = []

        # Look for error -> retry -> success/failure sequences
        retry_sequences = []
        i = 0

        while i < len(events):
            event = events[i]
            if event.get('event') in ['error', 'timeout', 'failure']:
                # Look for subsequent retry attempts
                retry_seq = [event]
                j = i + 1

                while j < len(events) and j < i + 10:  # Look ahead up to 10 events
                    next_event = events[j]
                    if next_event.get('event') in ['retry', 'run_started', 'reconnect']:
                        retry_seq.append(next_event)
                    elif next_event.get('event') in ['run_completed', 'run_cancelled', 'success']:
                        retry_seq.append(next_event)
                        break
                    j += 1

                if len(retry_seq) >= 2:
                    retry_sequences.append(retry_seq)
                    i = j
                else:
                    i += 1
            else:
                i += 1

        # Create patterns from retry sequences
        for seq in retry_sequences:
            pattern = self._create_retry_pattern(seq, session_id)
            if pattern:
                patterns.append(pattern)

        return patterns

    def _detect_performance_patterns(self, events: List[Dict[str, Any]], session_id: str) -> List[AdvancedBehavioralPattern]:
        """Detect performance-related patterns."""
        patterns = []

        # Calculate response times and detect degradation
        response_times = []
        for event in events:
            if 'time_since_previous' in event:
                response_times.append(event['time_since_previous'])

        if len(response_times) >= 5:
            # Detect performance trends
            trend = self._analyze_performance_trend(response_times)
            if trend['significance'] > self.statistical_thresholds['significance_level']:
                pattern = self._create_performance_pattern(events, trend, session_id)
                patterns.append(pattern)

        return patterns

    def _detect_concurrency_patterns(self, events: List[Dict[str, Any]], session_id: str) -> List[AdvancedBehavioralPattern]:
        """Detect concurrent behavior patterns."""
        patterns = []

        # Look for overlapping operations (same run_id or parallel timestamps)
        concurrent_groups = defaultdict(list)

        for event in events:
            if 'run_id' in event and event['run_id']:
                concurrent_groups[event['run_id']].append(event)

        # Analyze concurrent operations
        overlapping_operations = []
        for run_id, run_events in concurrent_groups.items():
            if len(run_events) > 1:
                overlapping_operations.append(run_events)

        if overlapping_operations:
            pattern = self._create_concurrency_pattern(overlapping_operations, session_id)
            patterns.append(pattern)

        return patterns

    def _detect_user_patterns(self, events: List[Dict[str, Any]], session_id: str) -> List[AdvancedBehavioralPattern]:
        """Detect user interaction patterns."""
        patterns = []

        # Look for user-initiated events and system responses
        user_interactions = []
        for i, event in enumerate(events):
            if event.get('event') in ['run_started', 'cancel_requested']:
                # Find system response
                response_events = []
                for j in range(i+1, min(i+5, len(events))):
                    response_events.append(events[j])

                user_interactions.append({
                    'trigger': event,
                    'responses': response_events
                })

        if user_interactions:
            pattern = self._create_user_interaction_pattern(user_interactions, session_id)
            patterns.append(pattern)

        return patterns

    def _detect_data_flow_patterns(self, events: List[Dict[str, Any]], session_id: str) -> List[AdvancedBehavioralPattern]:
        """Detect data transformation and flow patterns."""
        patterns = []

        # Look for data input -> processing -> output sequences
        data_flows = []
        for i, event in enumerate(events):
            if event.get('event') == 'stream':
                # This represents data flowing through the system
                flow_context = {
                    'input': events[max(0, i-1)] if i > 0 else None,
                    'processing': event,
                    'output': events[min(len(events)-1, i+1)] if i < len(events)-1 else None
                }
                data_flows.append(flow_context)

        if data_flows:
            pattern = self._create_data_flow_pattern(data_flows, session_id)
            patterns.append(pattern)

        return patterns

    def _create_transition_pattern(self, sequence: List[Dict[str, Any]], session_id: str) -> Optional[AdvancedBehavioralPattern]:
        """Create a state transition pattern from a sequence."""
        if len(sequence) < 2:
            return None

        start_state = sequence[0].get('event', 'unknown')
        end_state = sequence[-1].get('event', 'unknown')
        transition_events = [e.get('event', 'unknown') for e in sequence[1:-1]]

        # Calculate timing statistics
        timing_stats = self._calculate_timing_statistics(sequence)

        # Generate contextual conditions
        conditions = []
        for event in sequence:
            if 'reason' in event:
                conditions.append(f"reason={event['reason']}")
            if 'outcome' in event:
                conditions.append(f"outcome={event['outcome']}")

        return AdvancedBehavioralPattern(
            name=f"{start_state}_to_{end_state}_transition",
            pattern_type="state_transition",
            description=f"State transition from {start_state} to {end_state} via {transition_events}",
            confidence=0.85,
            frequency=1,
            triggers=[start_state] + transition_events,
            outcomes=[end_state],
            examples=[{'sequence': sequence}],
            temporal_distribution={},
            contextual_conditions=conditions,
            pattern_dependencies=[],
            statistical_significance=0.95,
            evolution_trend="stable",
            performance_impact=timing_stats,
            error_correlation=0.0,
            gherkin_scenario="",
            acceptance_criteria=[],
            timing_stats=timing_stats,
            metadata={'session_id': session_id, 'sequence_length': len(sequence)}
        )

    def _create_retry_pattern(self, sequence: List[Dict[str, Any]], session_id: str) -> Optional[AdvancedBehavioralPattern]:
        """Create a retry pattern from an error-recovery sequence."""
        error_event = sequence[0]
        retry_events = [e for e in sequence[1:] if e.get('event') in ['retry', 'run_started']]
        final_outcome = sequence[-1] if sequence else None

        success_rate = 1.0 if final_outcome and final_outcome.get('event') in ['run_completed', 'success'] else 0.0
        retry_count = len(retry_events)

        return AdvancedBehavioralPattern(
            name=f"retry_after_{error_event.get('event', 'error')}",
            pattern_type="retry_recovery",
            description=f"Retry pattern with {retry_count} attempts after {error_event.get('event')}",
            confidence=0.8,
            frequency=1,
            triggers=[error_event.get('event', 'error')],
            outcomes=[final_outcome.get('event', 'unknown') if final_outcome else 'unknown'],
            examples=[{'sequence': sequence}],
            temporal_distribution={},
            contextual_conditions=[f"retry_count={retry_count}"],
            pattern_dependencies=[],
            statistical_significance=0.9,
            evolution_trend="stable",
            performance_impact={'success_rate': success_rate, 'retry_count': retry_count},
            error_correlation=1.0,
            gherkin_scenario="",
            acceptance_criteria=[],
            timing_stats=self._calculate_timing_statistics(sequence),
            metadata={'session_id': session_id, 'retry_count': retry_count, 'success_rate': success_rate}
        )

    def _create_performance_pattern(self, events: List[Dict[str, Any]], trend: Dict, session_id: str) -> AdvancedBehavioralPattern:
        """Create a performance pattern from trend analysis."""
        return AdvancedBehavioralPattern(
            name=f"performance_{trend['direction']}_trend",
            pattern_type="performance",
            description=f"Performance trend showing {trend['direction']} pattern",
            confidence=trend['confidence'],
            frequency=len(events),
            triggers=['performance_measurement'],
            outcomes=[f"performance_{trend['direction']}"],
            examples=[{'trend_data': trend}],
            temporal_distribution={},
            contextual_conditions=[f"trend_slope={trend.get('slope', 0)}"],
            pattern_dependencies=[],
            statistical_significance=trend['significance'],
            evolution_trend=trend['direction'],
            performance_impact=trend.get('impact', {}),
            error_correlation=trend.get('error_correlation', 0.0),
            gherkin_scenario="",
            acceptance_criteria=[],
            timing_stats=trend.get('timing_stats', {}),
            metadata={'session_id': session_id, 'trend_analysis': trend}
        )

    def _create_concurrency_pattern(self, overlapping_ops: List[List[Dict]], session_id: str) -> AdvancedBehavioralPattern:
        """Create a concurrency pattern from overlapping operations."""
        total_ops = sum(len(ops) for ops in overlapping_ops)
        max_concurrent = max(len(ops) for ops in overlapping_ops)

        return AdvancedBehavioralPattern(
            name="concurrent_operations",
            pattern_type="concurrency",
            description=f"Concurrent operations pattern with max {max_concurrent} parallel operations",
            confidence=0.9,
            frequency=len(overlapping_ops),
            triggers=['parallel_execution'],
            outcomes=['concurrent_completion'],
            examples=[{'overlapping_operations': overlapping_ops[:2]}],  # Limit examples
            temporal_distribution={},
            contextual_conditions=[f"max_concurrent={max_concurrent}"],
            pattern_dependencies=[],
            statistical_significance=0.95,
            evolution_trend="stable",
            performance_impact={'concurrency_level': max_concurrent, 'total_operations': total_ops},
            error_correlation=0.1,
            gherkin_scenario="",
            acceptance_criteria=[],
            timing_stats={},
            metadata={'session_id': session_id, 'concurrency_analysis': {
                'max_concurrent': max_concurrent,
                'total_operations': total_ops,
                'overlap_count': len(overlapping_ops)
            }}
        )

    def _create_user_interaction_pattern(self, interactions: List[Dict], session_id: str) -> AdvancedBehavioralPattern:
        """Create a user interaction pattern."""
        avg_response_time = np.mean([
            len(interaction['responses']) for interaction in interactions
        ]) if interactions else 0

        return AdvancedBehavioralPattern(
            name="user_system_interaction",
            pattern_type="user_interaction",
            description=f"User interaction pattern with {len(interactions)} interactions",
            confidence=0.85,
            frequency=len(interactions),
            triggers=['user_action'],
            outcomes=['system_response'],
            examples=interactions[:2],  # Limit examples
            temporal_distribution={},
            contextual_conditions=[f"avg_response_events={avg_response_time}"],
            pattern_dependencies=[],
            statistical_significance=0.9,
            evolution_trend="stable",
            performance_impact={'avg_response_time': avg_response_time},
            error_correlation=0.05,
            gherkin_scenario="",
            acceptance_criteria=[],
            timing_stats={},
            metadata={'session_id': session_id, 'interaction_count': len(interactions)}
        )

    def _create_data_flow_pattern(self, flows: List[Dict], session_id: str) -> AdvancedBehavioralPattern:
        """Create a data flow pattern."""
        return AdvancedBehavioralPattern(
            name="data_stream_flow",
            pattern_type="data_flow",
            description=f"Data flow pattern with {len(flows)} streaming events",
            confidence=0.8,
            frequency=len(flows),
            triggers=['data_input'],
            outcomes=['data_output'],
            examples=flows[:2],  # Limit examples
            temporal_distribution={},
            contextual_conditions=[f"stream_count={len(flows)}"],
            pattern_dependencies=[],
            statistical_significance=0.85,
            evolution_trend="stable",
            performance_impact={'throughput': len(flows)},
            error_correlation=0.0,
            gherkin_scenario="",
            acceptance_criteria=[],
            timing_stats={},
            metadata={'session_id': session_id, 'flow_count': len(flows)}
        )

    def _generate_gherkin_scenario(self, pattern: AdvancedBehavioralPattern, events: List[Dict]) -> str:
        """Generate a Gherkin scenario description for the pattern."""
        template = self.pattern_templates.get(pattern.pattern_type, {}).get('gherkin_template',
            "Given {precondition} When {trigger} Then {outcome}")

        # Extract context for template
        context = {
            'precondition': f"system in initial state",
            'trigger': pattern.triggers[0] if pattern.triggers else "event occurs",
            'outcome': pattern.outcomes[0] if pattern.outcomes else "pattern is observed"
        }

        # Pattern-specific context extraction
        if pattern.pattern_type == 'state_transition':
            context.update({
                'initial_state': pattern.triggers[0] if pattern.triggers else 'initial',
                'trigger_event': pattern.triggers[1] if len(pattern.triggers) > 1 else 'transition',
                'target_state': pattern.outcomes[0] if pattern.outcomes else 'final'
            })
        elif pattern.pattern_type == 'retry_recovery':
            context.update({
                'error_condition': pattern.triggers[0] if pattern.triggers else 'error',
                'retry_attempt': 'retry is attempted',
                'recovery_outcome': pattern.outcomes[0] if pattern.outcomes else 'recovery'
            })

        try:
            scenario = template.format(**context)
        except KeyError:
            scenario = f"Given {context['precondition']} When {context['trigger']} Then {context['outcome']}"

        return f"Scenario: {pattern.name}\n    {scenario}"

    def _generate_acceptance_criteria(self, pattern: AdvancedBehavioralPattern) -> List[str]:
        """Generate acceptance criteria for the pattern."""
        criteria = []

        # Basic criteria
        criteria.append(f"Pattern confidence must be >= {pattern.confidence}")
        criteria.append(f"Pattern must be triggered by: {', '.join(pattern.triggers)}")
        criteria.append(f"Pattern must result in: {', '.join(pattern.outcomes)}")

        # Pattern-specific criteria
        if pattern.pattern_type == 'retry_recovery':
            retry_count = pattern.metadata.get('retry_count', 0)
            success_rate = pattern.metadata.get('success_rate', 0)
            criteria.append(f"Maximum retry attempts should be <= {retry_count + 2}")
            criteria.append(f"Success rate should be >= {success_rate * 0.8}")

        elif pattern.pattern_type == 'performance':
            criteria.append("Performance metrics must be within acceptable bounds")
            criteria.append("Response time degradation should trigger alerts")

        elif pattern.pattern_type == 'concurrency':
            max_concurrent = pattern.metadata.get('concurrency_analysis', {}).get('max_concurrent', 1)
            criteria.append(f"System must handle up to {max_concurrent} concurrent operations")
            criteria.append("No deadlocks or race conditions should occur")

        return criteria

    def _validate_patterns_statistically(self, patterns: List[AdvancedBehavioralPattern], events: List[Dict]) -> List[AdvancedBehavioralPattern]:
        """Apply statistical validation to filter out spurious patterns."""
        validated = []

        for pattern in patterns:
            # Check minimum frequency
            if pattern.frequency < self.statistical_thresholds['min_frequency']:
                continue

            # Check minimum confidence
            if pattern.confidence < self.statistical_thresholds['min_confidence']:
                continue

            # Check statistical significance
            if pattern.statistical_significance < self.statistical_thresholds['significance_level']:
                continue

            validated.append(pattern)

        return validated

    def _calculate_time_delta(self, event1: Dict, event2: Dict) -> float:
        """Calculate time difference between events in seconds."""
        try:
            if 'timestamp' in event1 and 'timestamp' in event2:
                t1 = datetime.fromisoformat(event1['timestamp'].replace('Z', '+00:00'))
                t2 = datetime.fromisoformat(event2['timestamp'].replace('Z', '+00:00'))
                return (t2 - t1).total_seconds()
        except:
            pass
        return 0.0

    def _calculate_timing_statistics(self, events: List[Dict]) -> Dict[str, float]:
        """Calculate timing statistics for a sequence of events."""
        if len(events) < 2:
            return {}

        durations = []
        for i in range(1, len(events)):
            delta = self._calculate_time_delta(events[i-1], events[i])
            if delta > 0:
                durations.append(delta)

        if not durations:
            return {}

        return {
            'min_duration': min(durations),
            'max_duration': max(durations),
            'mean_duration': np.mean(durations),
            'std_duration': np.std(durations),
            'total_duration': sum(durations)
        }

    def _analyze_performance_trend(self, response_times: List[float]) -> Dict:
        """Analyze performance trend using statistical methods."""
        if len(response_times) < 3:
            return {'direction': 'stable', 'confidence': 0.0, 'significance': 0.0}

        # Simple linear regression to detect trend
        x = np.arange(len(response_times))
        y = np.array(response_times)

        # Calculate slope
        slope = np.polyfit(x, y, 1)[0]

        # Determine trend direction
        if slope > 0.1:
            direction = 'degrading'
        elif slope < -0.1:
            direction = 'improving'
        else:
            direction = 'stable'

        # Calculate confidence (simplified)
        variance = np.var(response_times)
        confidence = max(0.5, min(0.95, 1.0 - (variance / np.mean(response_times))))

        return {
            'direction': direction,
            'slope': slope,
            'confidence': confidence,
            'significance': confidence,  # Simplified significance measure
            'impact': {
                'mean_response_time': np.mean(response_times),
                'variance': variance
            }
        }


if __name__ == "__main__":
    # Example usage with advanced pattern detection
    logging.basicConfig(level=logging.INFO)

    # Complex sample session with various patterns
    complex_session = [
        {"event": "run_started", "run_id": "complex-1", "timestamp": "2025-01-01T12:00:00Z"},
        {"event": "stream", "run_id": "complex-1", "timestamp": "2025-01-01T12:00:01Z"},
        {"event": "error", "run_id": "complex-1", "error_type": "timeout", "timestamp": "2025-01-01T12:00:05Z"},
        {"event": "retry", "run_id": "complex-1", "timestamp": "2025-01-01T12:00:06Z"},
        {"event": "stream", "run_id": "complex-1", "timestamp": "2025-01-01T12:00:07Z"},
        {"event": "run_completed", "run_id": "complex-1", "outcome": "completed", "reason": "retry_success", "timestamp": "2025-01-01T12:00:15Z"},
        {"event": "state", "state": "idle", "timestamp": "2025-01-01T12:00:16Z"},
        {"event": "run_started", "run_id": "complex-2", "timestamp": "2025-01-01T12:01:00Z"},
        {"event": "cancel_requested", "run_id": "complex-2", "timestamp": "2025-01-01T12:01:02Z"},
        {"event": "run_cancelled", "run_id": "complex-2", "outcome": "cancelled", "timestamp": "2025-01-01T12:01:03Z"},
        {"event": "state", "state": "idle", "timestamp": "2025-01-01T12:01:04Z"}
    ]

    detector = AdvancedPatternDetector()
    patterns = detector.analyze_advanced_session_data(complex_session, "advanced_test_session")

    print(f"\nDetected {len(patterns)} advanced patterns:")
    for pattern in patterns:
        print(f"\n--- {pattern.name} ---")
        print(f"Type: {pattern.pattern_type}")
        print(f"Confidence: {pattern.confidence:.2f}")
        print(f"Description: {pattern.description}")
        print(f"Gherkin Scenario:\n{pattern.gherkin_scenario}")
        print(f"Acceptance Criteria:")
        for criterion in pattern.acceptance_criteria:
            print(f"  - {criterion}")
        if pattern.performance_impact:
            print(f"Performance Impact: {pattern.performance_impact}")