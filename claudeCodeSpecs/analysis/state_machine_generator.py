#!/usr/bin/env python3
"""
State Machine Generator for Claude Code Behavioral Analysis

Analyzes runtime data to generate formal state machines and behavioral specifications.
Transforms observed event sequences into state transition diagrams and behavioral contracts.

Leverages completion detection patterns from existing automation scripts.
"""

from datetime import datetime
from typing import Dict, List, Any, Set, Tuple, Optional
import json
import logging
from dataclasses import dataclass, asdict
from collections import defaultdict, Counter
import re

logger = logging.getLogger(__name__)


@dataclass
class StateTransition:
    """Represents a transition between wrapper states."""
    from_state: str
    to_state: str
    trigger_event: str
    conditions: List[str]
    frequency: int = 1
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class StateMachine:
    """Complete state machine definition for Claude Code wrapper behavior."""
    name: str
    initial_state: str
    states: Set[str]
    transitions: List[StateTransition]
    final_states: Set[str]
    error_states: Set[str]
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class StateMachineGenerator:
    """Generates formal state machines from runtime behavior analysis."""

    def __init__(self):
        self.event_patterns = {
            # Core lifecycle events from claude_wrapper.py
            'lifecycle': [
                'run_started', 'stream', 'run_completed', 'run_cancelled',
                'run_failed', 'run_terminated', 'auto_shutdown'
            ],
            'state_changes': ['state', 'status'],
            'errors': ['error', 'run_failed', 'cancel_ignored'],
            'signals': ['signal', 'limit_notice'],
            'control': ['cancel_requested']
        }

        # State mapping based on claude_wrapper.py analysis
        self.known_states = {
            'idle', 'executing', 'terminating', 'cancelled', 'failed', 'completed'
        }

        # Completion detection patterns from automation script
        self.completion_patterns = [
            r'run_completed.*outcome.*completed',
            r'auto_shutdown.*exit_on_complete',
            r'limit_reached.*true',
            r'state.*idle'
        ]

    def analyze_event_sequence(self, events: List[Dict[str, Any]]) -> StateMachine:
        """
        Analyze a sequence of runtime events to generate a state machine.

        Args:
            events: List of event dictionaries from runtime monitoring

        Returns:
            StateMachine: Formal state machine definition
        """
        logger.info(f"Analyzing {len(events)} events for state machine generation")

        transitions = []
        states = set()
        current_state = 'idle'  # Default initial state

        for i, event in enumerate(events):
            event_type = event.get('event', 'unknown')
            new_state = self._extract_state_from_event(event)

            if new_state and new_state != current_state:
                transition = StateTransition(
                    from_state=current_state,
                    to_state=new_state,
                    trigger_event=event_type,
                    conditions=self._extract_conditions(event),
                    metadata={
                        'timestamp': event.get('timestamp'),
                        'run_id': event.get('run_id'),
                        'event_index': i
                    }
                )
                transitions.append(transition)
                states.add(current_state)
                states.add(new_state)
                current_state = new_state

        # Consolidate duplicate transitions
        consolidated_transitions = self._consolidate_transitions(transitions)

        # Identify final and error states
        final_states = self._identify_final_states(consolidated_transitions, states)
        error_states = self._identify_error_states(consolidated_transitions, states)

        return StateMachine(
            name="ClaudeCodeWrapper",
            initial_state='idle',
            states=states,
            transitions=consolidated_transitions,
            final_states=final_states,
            error_states=error_states,
            metadata={
                'generated_at': datetime.utcnow().isoformat(),
                'source_events': len(events),
                'unique_transitions': len(consolidated_transitions)
            }
        )

    def _extract_state_from_event(self, event: Dict[str, Any]) -> Optional[str]:
        """Extract state information from an event."""
        # Direct state field
        if 'state' in event:
            return event['state']

        # Infer state from event type
        event_type = event.get('event', '')

        state_mappings = {
            'run_started': 'executing',
            'run_completed': 'completed',
            'run_cancelled': 'cancelled',
            'run_failed': 'failed',
            'run_terminated': 'terminated',
            'auto_shutdown': 'idle',
            'status': event.get('state', 'unknown')
        }

        return state_mappings.get(event_type)

    def _extract_conditions(self, event: Dict[str, Any]) -> List[str]:
        """Extract conditions that triggered this state transition."""
        conditions = []

        # Check for specific conditions in event
        if event.get('reason'):
            conditions.append(f"reason={event['reason']}")

        if event.get('outcome'):
            conditions.append(f"outcome={event['outcome']}")

        if event.get('limit_reached'):
            conditions.append("limit_reached=true")

        if event.get('exit_on_complete'):
            conditions.append("exit_on_complete=true")

        return conditions

    def _consolidate_transitions(self, transitions: List[StateTransition]) -> List[StateTransition]:
        """Consolidate duplicate transitions and count frequencies."""
        transition_map = {}

        for transition in transitions:
            key = (transition.from_state, transition.to_state, transition.trigger_event)

            if key in transition_map:
                # Merge conditions and increment frequency
                existing = transition_map[key]
                existing.frequency += 1
                existing.conditions.extend(transition.conditions)
                existing.conditions = list(set(existing.conditions))  # Remove duplicates
            else:
                transition_map[key] = transition

        return list(transition_map.values())

    def _identify_final_states(self, transitions: List[StateTransition], states: Set[str]) -> Set[str]:
        """Identify states that represent successful completion."""
        final_states = set()

        # States that typically indicate completion
        completion_indicators = {'completed', 'idle'}

        # States that have no outgoing transitions (terminal states)
        outgoing_states = {t.from_state for t in transitions}
        terminal_states = states - outgoing_states

        final_states.update(completion_indicators & states)
        final_states.update(terminal_states - {'failed', 'cancelled', 'terminated'})

        return final_states

    def _identify_error_states(self, transitions: List[StateTransition], states: Set[str]) -> Set[str]:
        """Identify states that represent error conditions."""
        error_indicators = {'failed', 'cancelled', 'terminated'}
        return error_indicators & states

    def generate_mermaid_diagram(self, state_machine: StateMachine) -> str:
        """Generate a Mermaid state diagram from the state machine."""
        lines = ["stateDiagram-v2"]

        # Add states
        for state in state_machine.states:
            if state in state_machine.final_states:
                lines.append(f"    {state} --> [*]")
            elif state in state_machine.error_states:
                lines.append(f"    state {state} {{")
                lines.append(f"        {state} : ERROR")
                lines.append(f"    }}")

        # Add transitions
        for transition in state_machine.transitions:
            label = f"{transition.trigger_event}"
            if transition.conditions:
                label += f"\\n[{', '.join(transition.conditions[:2])}]"
            if transition.frequency > 1:
                label += f"\\n({transition.frequency}x)"

            lines.append(f"    {transition.from_state} --> {transition.to_state} : {label}")

        return "\\n".join(lines)

    def export_state_machine(self, state_machine: StateMachine, format: str = 'json') -> str:
        """Export state machine in specified format."""
        if format == 'json':
            return json.dumps(asdict(state_machine), indent=2, default=str)
        elif format == 'mermaid':
            return self.generate_mermaid_diagram(state_machine)
        else:
            raise ValueError(f"Unsupported export format: {format}")

    def validate_state_machine(self, state_machine: StateMachine) -> Dict[str, Any]:
        """Validate the generated state machine for completeness and consistency."""
        issues = []
        warnings = []

        # Check for unreachable states
        reachable_states = {state_machine.initial_state}
        for transition in state_machine.transitions:
            if transition.from_state in reachable_states:
                reachable_states.add(transition.to_state)

        unreachable = state_machine.states - reachable_states
        if unreachable:
            warnings.append(f"Unreachable states: {unreachable}")

        # Check for missing final states
        if not state_machine.final_states:
            issues.append("No final states identified")

        # Check for isolated states
        transition_states = set()
        for transition in state_machine.transitions:
            transition_states.add(transition.from_state)
            transition_states.add(transition.to_state)

        isolated = state_machine.states - transition_states - {state_machine.initial_state}
        if isolated:
            warnings.append(f"Isolated states: {isolated}")

        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'warnings': warnings,
            'coverage': len(reachable_states) / len(state_machine.states) if state_machine.states else 0
        }


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)

    # Sample events for testing
    sample_events = [
        {"event": "run_started", "state": "executing", "run_id": "test-1", "timestamp": "2025-01-01T10:00:00Z"},
        {"event": "stream", "run_id": "test-1", "timestamp": "2025-01-01T10:00:01Z"},
        {"event": "run_completed", "outcome": "completed", "reason": "ok", "timestamp": "2025-01-01T10:00:10Z"},
        {"event": "state", "state": "idle", "timestamp": "2025-01-01T10:00:11Z"}
    ]

    generator = StateMachineGenerator()
    state_machine = generator.analyze_event_sequence(sample_events)

    print("Generated State Machine:")
    print(generator.export_state_machine(state_machine, 'json'))

    print("\nValidation Results:")
    validation = generator.validate_state_machine(state_machine)
    print(json.dumps(validation, indent=2))