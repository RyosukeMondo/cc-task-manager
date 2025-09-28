#!/usr/bin/env python3
"""
Behavior Analyzer for Claude Code Behavioral Analysis

Main orchestrator that combines state machine generation and pattern detection
to create formal behavioral specifications from runtime observations.

Transforms runtime observations into formal behavioral specifications following
requirements 2.1, 2.2, and 2.3.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

from .state_machine_generator import StateMachineGenerator, StateMachine
from .pattern_detector import PatternDetector, SessionAnalysis, BehavioralPattern

logger = logging.getLogger(__name__)


@dataclass
class BehavioralSpecification:
    """Complete behavioral specification for Claude Code wrapper."""
    name: str
    version: str
    generated_at: str
    state_machine: StateMachine
    behavioral_patterns: List[BehavioralPattern]
    session_analyses: List[SessionAnalysis]
    compliance_rules: List[Dict[str, Any]]
    validation_criteria: List[Dict[str, Any]]
    performance_benchmarks: Dict[str, Any]
    documentation: Dict[str, str]
    metadata: Dict[str, Any]


class BehaviorAnalyzer:
    """
    Main analyzer that orchestrates state machine generation and pattern detection
    to produce formal behavioral specifications.
    """

    def __init__(self, output_dir: str = "claudeCodeSpecs/generated"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.state_machine_generator = StateMachineGenerator()
        self.pattern_detector = PatternDetector()

        # Specification templates and rules
        self.compliance_rules_template = [
            {
                "rule_id": "state_transitions",
                "description": "All state transitions must follow defined state machine",
                "validation": "state_machine_compliance",
                "severity": "error"
            },
            {
                "rule_id": "completion_detection",
                "description": "Completion patterns must be correctly identified",
                "validation": "completion_pattern_compliance",
                "severity": "error"
            },
            {
                "rule_id": "error_handling",
                "description": "Error conditions must be properly handled and reported",
                "validation": "error_handling_compliance",
                "severity": "warning"
            },
            {
                "rule_id": "timing_constraints",
                "description": "Operations must complete within acceptable time bounds",
                "validation": "timing_compliance",
                "severity": "warning"
            }
        ]

    def generate_behavioral_specification(
        self,
        runtime_sessions: List[List[Dict[str, Any]]],
        spec_name: str = "ClaudeCodeWrapper",
        version: str = "1.0.0"
    ) -> BehavioralSpecification:
        """
        Generate complete behavioral specification from multiple runtime sessions.

        Args:
            runtime_sessions: List of session event lists from runtime monitoring
            spec_name: Name for the generated specification
            version: Version of the specification

        Returns:
            BehavioralSpecification: Complete formal specification
        """
        logger.info(f"Generating behavioral specification from {len(runtime_sessions)} sessions")

        if not runtime_sessions:
            raise ValueError("No runtime sessions provided for analysis")

        # Combine all events for state machine generation
        all_events = []
        session_analyses = []

        for i, session_events in enumerate(runtime_sessions):
            session_id = f"session_{i+1}"

            # Analyze individual session
            session_analysis = self.pattern_detector.analyze_session_data(
                session_events, session_id
            )
            session_analyses.append(session_analysis)

            # Add events to combined dataset
            all_events.extend(session_events)

        # Generate state machine from all events
        state_machine = self.state_machine_generator.analyze_event_sequence(all_events)

        # Collect all behavioral patterns
        all_patterns = []
        for analysis in session_analyses:
            all_patterns.extend(analysis.patterns)

        # Consolidate and prioritize patterns
        consolidated_patterns = self._consolidate_patterns(all_patterns)

        # Generate compliance rules based on observed patterns
        compliance_rules = self._generate_compliance_rules(state_machine, consolidated_patterns)

        # Generate validation criteria
        validation_criteria = self._generate_validation_criteria(state_machine, consolidated_patterns)

        # Calculate performance benchmarks
        performance_benchmarks = self._calculate_performance_benchmarks(session_analyses)

        # Generate documentation
        documentation = self._generate_documentation(
            state_machine, consolidated_patterns, session_analyses
        )

        spec = BehavioralSpecification(
            name=spec_name,
            version=version,
            generated_at=datetime.utcnow().isoformat(),
            state_machine=state_machine,
            behavioral_patterns=consolidated_patterns,
            session_analyses=session_analyses,
            compliance_rules=compliance_rules,
            validation_criteria=validation_criteria,
            performance_benchmarks=performance_benchmarks,
            documentation=documentation,
            metadata={
                "source_sessions": len(runtime_sessions),
                "total_events": len(all_events),
                "generation_tool": "BehaviorAnalyzer",
                "requirements_covered": ["2.1", "2.2", "2.3"]
            }
        )

        logger.info(f"Generated specification with {len(consolidated_patterns)} patterns and {len(compliance_rules)} rules")
        return spec

    def _consolidate_patterns(self, patterns: List[BehavioralPattern]) -> List[BehavioralPattern]:
        """Consolidate duplicate patterns and prioritize by frequency and confidence."""
        pattern_map = {}

        for pattern in patterns:
            key = (pattern.name, pattern.pattern_type)

            if key in pattern_map:
                # Merge patterns with same name and type
                existing = pattern_map[key]
                existing.frequency += pattern.frequency
                existing.confidence = max(existing.confidence, pattern.confidence)
                existing.examples.extend(pattern.examples[:2])  # Add a few more examples
                existing.metadata['merged_from'] = existing.metadata.get('merged_from', 0) + 1
            else:
                pattern_map[key] = pattern

        # Sort by relevance (frequency * confidence)
        consolidated = list(pattern_map.values())
        consolidated.sort(key=lambda p: p.frequency * p.confidence, reverse=True)

        return consolidated

    def _generate_compliance_rules(
        self,
        state_machine: StateMachine,
        patterns: List[BehavioralPattern]
    ) -> List[Dict[str, Any]]:
        """Generate compliance rules based on observed behavior."""
        rules = self.compliance_rules_template.copy()

        # Add pattern-specific rules
        for pattern in patterns:
            if pattern.pattern_type == 'completion' and pattern.confidence > 0.8:
                rules.append({
                    "rule_id": f"completion_{pattern.name}",
                    "description": f"Completion pattern '{pattern.name}' must be followed",
                    "validation": f"completion_pattern_{pattern.name}",
                    "severity": "error",
                    "pattern_triggers": pattern.triggers,
                    "expected_outcomes": pattern.outcomes
                })

            elif pattern.pattern_type == 'timing' and pattern.timing_stats:
                rules.append({
                    "rule_id": f"timing_{pattern.name}",
                    "description": f"Timing pattern '{pattern.name}' performance constraints",
                    "validation": f"timing_pattern_{pattern.name}",
                    "severity": "warning",
                    "max_duration": pattern.timing_stats.get('max_duration', 300),
                    "expected_duration": pattern.timing_stats.get('mean_duration', 30)
                })

        # Add state machine rules
        rules.append({
            "rule_id": "valid_state_transitions",
            "description": "All state transitions must be valid according to state machine",
            "validation": "state_machine_validation",
            "severity": "error",
            "valid_transitions": [
                {
                    "from": t.from_state,
                    "to": t.to_state,
                    "trigger": t.trigger_event
                }
                for t in state_machine.transitions
            ]
        })

        return rules

    def _generate_validation_criteria(
        self,
        state_machine: StateMachine,
        patterns: List[BehavioralPattern]
    ) -> List[Dict[str, Any]]:
        """Generate validation criteria for wrapper implementations."""
        criteria = []

        # State machine validation
        criteria.append({
            "criterion_id": "state_machine_compliance",
            "description": "Implementation must follow defined state machine",
            "test_type": "behavioral",
            "validation_method": "state_transition_testing",
            "acceptance_threshold": 1.0,  # Must be 100% compliant
            "test_scenarios": [
                f"Transition from {t.from_state} to {t.to_state} via {t.trigger_event}"
                for t in state_machine.transitions
            ]
        })

        # Pattern validation
        high_confidence_patterns = [p for p in patterns if p.confidence > 0.8]
        for pattern in high_confidence_patterns:
            criteria.append({
                "criterion_id": f"pattern_{pattern.name}_validation",
                "description": f"Implementation must exhibit {pattern.name} pattern",
                "test_type": "pattern_detection",
                "validation_method": "runtime_pattern_analysis",
                "acceptance_threshold": pattern.confidence * 0.9,  # Allow 10% tolerance
                "pattern_triggers": pattern.triggers,
                "expected_outcomes": pattern.outcomes
            })

        # Performance validation
        criteria.append({
            "criterion_id": "performance_compliance",
            "description": "Implementation must meet performance benchmarks",
            "test_type": "performance",
            "validation_method": "timing_analysis",
            "acceptance_threshold": 0.9,  # 90% of operations within bounds
            "benchmarks": self._extract_performance_criteria(patterns)
        })

        return criteria

    def _extract_performance_criteria(self, patterns: List[BehavioralPattern]) -> Dict[str, Any]:
        """Extract performance criteria from timing patterns."""
        criteria = {}

        timing_patterns = [p for p in patterns if p.pattern_type == 'timing' and p.timing_stats]

        if timing_patterns:
            # Use the most representative timing pattern
            primary_pattern = max(timing_patterns, key=lambda p: p.frequency)
            stats = primary_pattern.timing_stats

            criteria = {
                "max_execution_time": stats.get('max_duration', 300),
                "expected_execution_time": stats.get('mean_duration', 30),
                "acceptable_deviation": stats.get('std_duration', 10) * 2,  # 2 standard deviations
                "timeout_threshold": 300  # 5 minutes
            }

        return criteria

    def _calculate_performance_benchmarks(self, analyses: List[SessionAnalysis]) -> Dict[str, Any]:
        """Calculate performance benchmarks from session analyses."""
        benchmarks = {
            "session_metrics": {
                "avg_duration": 0.0,
                "avg_events_per_session": 0.0,
                "completion_rate": 0.0,
                "error_rate": 0.0
            },
            "pattern_metrics": {
                "avg_patterns_per_session": 0.0,
                "most_common_patterns": [],
                "pattern_confidence_avg": 0.0
            }
        }

        if not analyses:
            return benchmarks

        # Session metrics
        total_duration = sum(a.duration_seconds for a in analyses)
        total_events = sum(a.event_count for a in analyses)
        completed_sessions = sum(1 for a in analyses if a.completion_status == 'completed')
        failed_sessions = sum(1 for a in analyses if a.completion_status == 'failed')

        benchmarks["session_metrics"] = {
            "avg_duration": total_duration / len(analyses),
            "avg_events_per_session": total_events / len(analyses),
            "completion_rate": completed_sessions / len(analyses),
            "error_rate": failed_sessions / len(analyses)
        }

        # Pattern metrics
        all_patterns = []
        for analysis in analyses:
            all_patterns.extend(analysis.patterns)

        if all_patterns:
            pattern_counts = {}
            total_confidence = 0

            for pattern in all_patterns:
                pattern_counts[pattern.name] = pattern_counts.get(pattern.name, 0) + 1
                total_confidence += pattern.confidence

            most_common = sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True)[:5]

            benchmarks["pattern_metrics"] = {
                "avg_patterns_per_session": len(all_patterns) / len(analyses),
                "most_common_patterns": [{"name": name, "frequency": freq} for name, freq in most_common],
                "pattern_confidence_avg": total_confidence / len(all_patterns)
            }

        return benchmarks

    def _generate_documentation(
        self,
        state_machine: StateMachine,
        patterns: List[BehavioralPattern],
        analyses: List[SessionAnalysis]
    ) -> Dict[str, str]:
        """Generate human-readable documentation for the specification."""
        docs = {}

        # State machine documentation
        docs["state_machine"] = self._document_state_machine(state_machine)

        # Pattern documentation
        docs["behavioral_patterns"] = self._document_patterns(patterns)

        # Usage examples
        docs["usage_examples"] = self._generate_usage_examples(patterns, analyses)

        # Implementation guidelines
        docs["implementation_guidelines"] = self._generate_implementation_guidelines(state_machine, patterns)

        return docs

    def _document_state_machine(self, state_machine: StateMachine) -> str:
        """Generate documentation for the state machine."""
        lines = [
            f"# {state_machine.name} State Machine",
            "",
            f"This state machine represents the behavioral states and transitions for the Claude Code wrapper.",
            "",
            f"## States ({len(state_machine.states)})",
            ""
        ]

        for state in sorted(state_machine.states):
            state_type = "Final" if state in state_machine.final_states else "Error" if state in state_machine.error_states else "Normal"
            lines.append(f"- **{state}** ({state_type})")

        lines.extend([
            "",
            f"## Transitions ({len(state_machine.transitions)})",
            ""
        ])

        for transition in state_machine.transitions:
            conditions_str = f" [{', '.join(transition.conditions)}]" if transition.conditions else ""
            frequency_str = f" (observed {transition.frequency}x)" if transition.frequency > 1 else ""
            lines.append(f"- {transition.from_state} → {transition.to_state} on `{transition.trigger_event}`{conditions_str}{frequency_str}")

        return "\\n".join(lines)

    def _document_patterns(self, patterns: List[BehavioralPattern]) -> str:
        """Generate documentation for behavioral patterns."""
        lines = [
            "# Behavioral Patterns",
            "",
            f"This section describes {len(patterns)} behavioral patterns observed in Claude Code wrapper runtime.",
            ""
        ]

        patterns_by_type = {}
        for pattern in patterns:
            patterns_by_type.setdefault(pattern.pattern_type, []).append(pattern)

        for pattern_type, type_patterns in patterns_by_type.items():
            lines.extend([
                f"## {pattern_type.title()} Patterns ({len(type_patterns)})",
                ""
            ])

            for pattern in type_patterns:
                lines.extend([
                    f"### {pattern.name}",
                    f"**Confidence:** {pattern.confidence:.2f} | **Frequency:** {pattern.frequency}",
                    "",
                    pattern.description,
                    ""
                ])

                if pattern.triggers:
                    lines.append(f"**Triggers:** {', '.join(pattern.triggers)}")
                if pattern.outcomes:
                    lines.append(f"**Outcomes:** {', '.join(pattern.outcomes)}")

                lines.append("")

        return "\\n".join(lines)

    def _generate_usage_examples(self, patterns: List[BehavioralPattern], analyses: List[SessionAnalysis]) -> str:
        """Generate usage examples based on observed patterns."""
        lines = [
            "# Usage Examples",
            "",
            "These examples are derived from real runtime observations.",
            ""
        ]

        # Pick representative examples from high-confidence patterns
        high_confidence_patterns = [p for p in patterns if p.confidence > 0.8 and p.examples]

        for pattern in high_confidence_patterns[:3]:  # Top 3 patterns
            if pattern.examples:
                lines.extend([
                    f"## {pattern.name} Example",
                    "",
                    f"Pattern: {pattern.description}",
                    "",
                    "```json",
                    json.dumps(pattern.examples[0], indent=2),
                    "```",
                    ""
                ])

        return "\\n".join(lines)

    def _generate_implementation_guidelines(self, state_machine: StateMachine, patterns: List[BehavioralPattern]) -> str:
        """Generate implementation guidelines."""
        lines = [
            "# Implementation Guidelines",
            "",
            "Guidelines for implementing Claude Code wrappers that comply with this specification.",
            "",
            "## State Management",
            "",
            f"Your implementation must maintain state according to the {state_machine.name} state machine:",
            ""
        ]

        # State management guidelines
        for state in sorted(state_machine.states):
            lines.append(f"- **{state}**: Handle state-specific logic and valid transitions")

        # Pattern implementation guidelines
        completion_patterns = [p for p in patterns if p.pattern_type == 'completion' and p.confidence > 0.8]
        if completion_patterns:
            lines.extend([
                "",
                "## Completion Detection",
                "",
                "Implement robust completion detection based on these observed patterns:",
                ""
            ])

            for pattern in completion_patterns:
                lines.extend([
                    f"### {pattern.name}",
                    f"- Monitor for triggers: {', '.join(pattern.triggers)}",
                    f"- Expected outcomes: {', '.join(pattern.outcomes)}",
                    ""
                ])

        return "\\n".join(lines)

    def save_specification(self, spec: BehavioralSpecification, filename: Optional[str] = None) -> Path:
        """Save the behavioral specification to disk."""
        if filename is None:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"{spec.name}_behavioral_spec_{timestamp}.json"

        output_path = self.output_dir / filename

        with open(output_path, 'w') as f:
            json.dump(asdict(spec), f, indent=2, default=str)

        logger.info(f"Saved behavioral specification to {output_path}")
        return output_path

    def export_specification_artifacts(self, spec: BehavioralSpecification) -> Dict[str, Path]:
        """Export specification as separate artifact files."""
        artifacts = {}

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        base_name = f"{spec.name}_{timestamp}"

        # State machine diagram
        state_machine_mermaid = self.state_machine_generator.generate_mermaid_diagram(spec.state_machine)
        mermaid_path = self.output_dir / f"{base_name}_state_machine.mmd"
        with open(mermaid_path, 'w') as f:
            f.write(state_machine_mermaid)
        artifacts['state_machine_diagram'] = mermaid_path

        # Documentation files
        for doc_type, content in spec.documentation.items():
            doc_path = self.output_dir / f"{base_name}_{doc_type}.md"
            with open(doc_path, 'w') as f:
                f.write(content)
            artifacts[f'documentation_{doc_type}'] = doc_path

        # Compliance rules JSON
        rules_path = self.output_dir / f"{base_name}_compliance_rules.json"
        with open(rules_path, 'w') as f:
            json.dump(spec.compliance_rules, f, indent=2)
        artifacts['compliance_rules'] = rules_path

        # Validation criteria JSON
        validation_path = self.output_dir / f"{base_name}_validation_criteria.json"
        with open(validation_path, 'w') as f:
            json.dump(spec.validation_criteria, f, indent=2)
        artifacts['validation_criteria'] = validation_path

        logger.info(f"Exported {len(artifacts)} specification artifacts")
        return artifacts


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)

    # Sample runtime sessions for testing
    sample_session_1 = [
        {"event": "run_started", "run_id": "test-1", "timestamp": "2025-01-01T10:00:00Z"},
        {"event": "stream", "run_id": "test-1", "timestamp": "2025-01-01T10:00:01Z"},
        {"event": "run_completed", "run_id": "test-1", "outcome": "completed", "reason": "ok", "timestamp": "2025-01-01T10:00:10Z"},
        {"event": "state", "state": "idle", "timestamp": "2025-01-01T10:00:11Z"}
    ]

    sample_session_2 = [
        {"event": "run_started", "run_id": "test-2", "timestamp": "2025-01-01T11:00:00Z"},
        {"event": "stream", "run_id": "test-2", "timestamp": "2025-01-01T11:00:01Z"},
        {"event": "cancel_requested", "run_id": "test-2", "timestamp": "2025-01-01T11:00:05Z"},
        {"event": "run_cancelled", "run_id": "test-2", "outcome": "cancelled", "timestamp": "2025-01-01T11:00:06Z"},
        {"event": "state", "state": "idle", "timestamp": "2025-01-01T11:00:07Z"}
    ]

    analyzer = BehaviorAnalyzer()
    spec = analyzer.generate_behavioral_specification([sample_session_1, sample_session_2])

    # Save specification
    spec_path = analyzer.save_specification(spec)
    print(f"Specification saved to: {spec_path}")

    # Export artifacts
    artifacts = analyzer.export_specification_artifacts(spec)
    print(f"Exported artifacts: {list(artifacts.keys())}")