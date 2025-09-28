#!/usr/bin/env python3
"""
Change Detector - Behavioral evolution tracking for Claude Code

This module implements change detection system for tracking behavioral evolution
in Claude Code, identifying patterns, state transitions, and specification updates.
"""

import json
import logging
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, asdict
from pathlib import Path
from enum import Enum
import difflib
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChangeType(Enum):
    """Types of changes detected"""
    BEHAVIORAL = "behavioral"
    API = "api"
    CONFIGURATION = "configuration"
    DOCUMENTATION = "documentation"
    PROTOCOL = "protocol"
    STATE_MACHINE = "state_machine"

class ChangeSeverity(Enum):
    """Severity levels for changes"""
    CRITICAL = "critical"      # Breaking changes
    MAJOR = "major"           # Significant functionality changes
    MINOR = "minor"           # Small improvements or additions
    PATCH = "patch"           # Bug fixes or minor tweaks

@dataclass
class BehavioralChange:
    """Represents a detected behavioral change"""
    change_id: str
    change_type: ChangeType
    severity: ChangeSeverity
    title: str
    description: str
    timestamp: datetime
    source: str
    old_behavior: Optional[Dict[str, Any]]
    new_behavior: Optional[Dict[str, Any]]
    affected_components: List[str]
    confidence_score: float
    metadata: Dict[str, Any]

@dataclass
class ChangePattern:
    """Represents a pattern of changes over time"""
    pattern_id: str
    pattern_type: str
    frequency: float
    changes: List[str]  # Change IDs
    trend: str  # "increasing", "decreasing", "stable"
    confidence: float

@dataclass
class StateTransition:
    """Represents a state machine transition change"""
    from_state: str
    to_state: str
    trigger: str
    old_behavior: Optional[str]
    new_behavior: Optional[str]
    timestamp: datetime

class ChangeDetector:
    """
    Behavioral evolution tracking system for Claude Code

    Features:
    - Behavioral pattern detection and analysis
    - API change identification and classification
    - State machine evolution tracking
    - Change severity assessment
    - Trend analysis and prediction
    - Specification update recommendations
    """

    def __init__(self, data_dir: str = "claudeCodeSpecs/research"):
        self.data_dir = Path(data_dir)
        self.changes_file = self.data_dir / "behavioral_changes.json"
        self.patterns_file = self.data_dir / "change_patterns.json"
        self.states_file = self.data_dir / "state_transitions.json"
        self.snapshots_dir = self.data_dir / "snapshots"

        # Ensure directories exist
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)

        # Load existing data
        self.changes: List[BehavioralChange] = self._load_changes()
        self.patterns: List[ChangePattern] = self._load_patterns()
        self.state_transitions: List[StateTransition] = self._load_state_transitions()

    def _generate_change_id(self, source: str, timestamp: datetime) -> str:
        """Generate unique change ID"""
        content = f"{source}_{timestamp.isoformat()}"
        return hashlib.sha256(content.encode()).hexdigest()[:12]

    def _load_changes(self) -> List[BehavioralChange]:
        """Load existing behavioral changes"""
        if not self.changes_file.exists():
            return []

        try:
            with open(self.changes_file, 'r') as f:
                data = json.load(f)

            changes = []
            for change_dict in data.get('changes', []):
                # Convert enums and datetime
                change_dict['change_type'] = ChangeType(change_dict['change_type'])
                change_dict['severity'] = ChangeSeverity(change_dict['severity'])
                change_dict['timestamp'] = datetime.fromisoformat(change_dict['timestamp'])
                changes.append(BehavioralChange(**change_dict))

            return changes

        except Exception as e:
            logger.error(f"Error loading changes: {e}")
            return []

    def _save_changes(self):
        """Save behavioral changes to file"""
        try:
            changes_data = {
                'timestamp': datetime.now().isoformat(),
                'total_changes': len(self.changes),
                'changes': []
            }

            for change in self.changes:
                change_dict = asdict(change)
                change_dict['change_type'] = change.change_type.value
                change_dict['severity'] = change.severity.value
                change_dict['timestamp'] = change.timestamp.isoformat()
                changes_data['changes'].append(change_dict)

            with open(self.changes_file, 'w') as f:
                json.dump(changes_data, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Error saving changes: {e}")

    def _load_patterns(self) -> List[ChangePattern]:
        """Load change patterns"""
        if not self.patterns_file.exists():
            return []

        try:
            with open(self.patterns_file, 'r') as f:
                data = json.load(f)

            return [ChangePattern(**pattern) for pattern in data.get('patterns', [])]

        except Exception as e:
            logger.error(f"Error loading patterns: {e}")
            return []

    def _save_patterns(self):
        """Save change patterns to file"""
        try:
            patterns_data = {
                'timestamp': datetime.now().isoformat(),
                'total_patterns': len(self.patterns),
                'patterns': [asdict(pattern) for pattern in self.patterns]
            }

            with open(self.patterns_file, 'w') as f:
                json.dump(patterns_data, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Error saving patterns: {e}")

    def _load_state_transitions(self) -> List[StateTransition]:
        """Load state transitions"""
        if not self.states_file.exists():
            return []

        try:
            with open(self.states_file, 'r') as f:
                data = json.load(f)

            transitions = []
            for trans_dict in data.get('transitions', []):
                trans_dict['timestamp'] = datetime.fromisoformat(trans_dict['timestamp'])
                transitions.append(StateTransition(**trans_dict))

            return transitions

        except Exception as e:
            logger.error(f"Error loading state transitions: {e}")
            return []

    def _save_state_transitions(self):
        """Save state transitions to file"""
        try:
            transitions_data = {
                'timestamp': datetime.now().isoformat(),
                'total_transitions': len(self.state_transitions),
                'transitions': []
            }

            for transition in self.state_transitions:
                trans_dict = asdict(transition)
                trans_dict['timestamp'] = transition.timestamp.isoformat()
                transitions_data['transitions'].append(trans_dict)

            with open(self.states_file, 'w') as f:
                json.dump(transitions_data, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Error saving state transitions: {e}")

    def create_snapshot(self, source: str, data: Dict[str, Any]) -> str:
        """Create a snapshot of current system state"""
        timestamp = datetime.now()
        snapshot_id = f"{source}_{timestamp.strftime('%Y%m%d_%H%M%S')}"
        snapshot_file = self.snapshots_dir / f"{snapshot_id}.json"

        snapshot_data = {
            'snapshot_id': snapshot_id,
            'source': source,
            'timestamp': timestamp.isoformat(),
            'data': data
        }

        try:
            with open(snapshot_file, 'w') as f:
                json.dump(snapshot_data, f, indent=2, default=str)

            logger.info(f"Created snapshot: {snapshot_id}")
            return snapshot_id

        except Exception as e:
            logger.error(f"Error creating snapshot: {e}")
            return ""

    def compare_snapshots(self, snapshot1_id: str, snapshot2_id: str) -> List[BehavioralChange]:
        """Compare two snapshots and detect changes"""
        snapshot1_file = self.snapshots_dir / f"{snapshot1_id}.json"
        snapshot2_file = self.snapshots_dir / f"{snapshot2_id}.json"

        if not snapshot1_file.exists() or not snapshot2_file.exists():
            logger.error("One or both snapshots not found")
            return []

        try:
            with open(snapshot1_file, 'r') as f:
                snapshot1 = json.load(f)

            with open(snapshot2_file, 'r') as f:
                snapshot2 = json.load(f)

            return self._analyze_snapshot_differences(snapshot1, snapshot2)

        except Exception as e:
            logger.error(f"Error comparing snapshots: {e}")
            return []

    def _analyze_snapshot_differences(self, snapshot1: Dict, snapshot2: Dict) -> List[BehavioralChange]:
        """Analyze differences between two snapshots"""
        changes = []
        timestamp = datetime.now()

        # Compare API endpoints
        api_changes = self._detect_api_changes(
            snapshot1.get('data', {}).get('api', {}),
            snapshot2.get('data', {}).get('api', {})
        )
        changes.extend(api_changes)

        # Compare behavioral patterns
        behavior_changes = self._detect_behavior_changes(
            snapshot1.get('data', {}).get('behaviors', {}),
            snapshot2.get('data', {}).get('behaviors', {})
        )
        changes.extend(behavior_changes)

        # Compare state machines
        state_changes = self._detect_state_machine_changes(
            snapshot1.get('data', {}).get('states', {}),
            snapshot2.get('data', {}).get('states', {})
        )
        changes.extend(state_changes)

        return changes

    def _detect_api_changes(self, old_api: Dict, new_api: Dict) -> List[BehavioralChange]:
        """Detect API-related changes"""
        changes = []
        timestamp = datetime.now()

        # Check for new endpoints
        old_endpoints = set(old_api.get('endpoints', {}).keys())
        new_endpoints = set(new_api.get('endpoints', {}).keys())

        added_endpoints = new_endpoints - old_endpoints
        removed_endpoints = old_endpoints - new_endpoints

        for endpoint in added_endpoints:
            change = BehavioralChange(
                change_id=self._generate_change_id(f"api_add_{endpoint}", timestamp),
                change_type=ChangeType.API,
                severity=ChangeSeverity.MINOR,
                title=f"New API endpoint added: {endpoint}",
                description=f"New endpoint '{endpoint}' was added to the API",
                timestamp=timestamp,
                source="api_comparison",
                old_behavior=None,
                new_behavior=new_api.get('endpoints', {}).get(endpoint),
                affected_components=[endpoint],
                confidence_score=0.95,
                metadata={'endpoint': endpoint, 'action': 'added'}
            )
            changes.append(change)

        for endpoint in removed_endpoints:
            change = BehavioralChange(
                change_id=self._generate_change_id(f"api_remove_{endpoint}", timestamp),
                change_type=ChangeType.API,
                severity=ChangeSeverity.MAJOR,
                title=f"API endpoint removed: {endpoint}",
                description=f"Endpoint '{endpoint}' was removed from the API",
                timestamp=timestamp,
                source="api_comparison",
                old_behavior=old_api.get('endpoints', {}).get(endpoint),
                new_behavior=None,
                affected_components=[endpoint],
                confidence_score=0.95,
                metadata={'endpoint': endpoint, 'action': 'removed'}
            )
            changes.append(change)

        # Check for modified endpoints
        common_endpoints = old_endpoints & new_endpoints
        for endpoint in common_endpoints:
            old_spec = old_api.get('endpoints', {}).get(endpoint, {})
            new_spec = new_api.get('endpoints', {}).get(endpoint, {})

            if old_spec != new_spec:
                severity = self._assess_api_change_severity(old_spec, new_spec)
                change = BehavioralChange(
                    change_id=self._generate_change_id(f"api_modify_{endpoint}", timestamp),
                    change_type=ChangeType.API,
                    severity=severity,
                    title=f"API endpoint modified: {endpoint}",
                    description=f"Endpoint '{endpoint}' specification was modified",
                    timestamp=timestamp,
                    source="api_comparison",
                    old_behavior=old_spec,
                    new_behavior=new_spec,
                    affected_components=[endpoint],
                    confidence_score=0.90,
                    metadata={'endpoint': endpoint, 'action': 'modified'}
                )
                changes.append(change)

        return changes

    def _detect_behavior_changes(self, old_behaviors: Dict, new_behaviors: Dict) -> List[BehavioralChange]:
        """Detect behavioral pattern changes"""
        changes = []
        timestamp = datetime.now()

        # Compare behavior patterns
        old_patterns = set(old_behaviors.get('patterns', {}).keys())
        new_patterns = set(new_behaviors.get('patterns', {}).keys())

        added_patterns = new_patterns - old_patterns
        removed_patterns = old_patterns - new_patterns

        for pattern in added_patterns:
            change = BehavioralChange(
                change_id=self._generate_change_id(f"behavior_add_{pattern}", timestamp),
                change_type=ChangeType.BEHAVIORAL,
                severity=ChangeSeverity.MINOR,
                title=f"New behavioral pattern: {pattern}",
                description=f"New behavioral pattern '{pattern}' was detected",
                timestamp=timestamp,
                source="behavior_comparison",
                old_behavior=None,
                new_behavior=new_behaviors.get('patterns', {}).get(pattern),
                affected_components=[pattern],
                confidence_score=0.85,
                metadata={'pattern': pattern, 'action': 'added'}
            )
            changes.append(change)

        for pattern in removed_patterns:
            change = BehavioralChange(
                change_id=self._generate_change_id(f"behavior_remove_{pattern}", timestamp),
                change_type=ChangeType.BEHAVIORAL,
                severity=ChangeSeverity.MAJOR,
                title=f"Behavioral pattern removed: {pattern}",
                description=f"Behavioral pattern '{pattern}' is no longer detected",
                timestamp=timestamp,
                source="behavior_comparison",
                old_behavior=old_behaviors.get('patterns', {}).get(pattern),
                new_behavior=None,
                affected_components=[pattern],
                confidence_score=0.85,
                metadata={'pattern': pattern, 'action': 'removed'}
            )
            changes.append(change)

        return changes

    def _detect_state_machine_changes(self, old_states: Dict, new_states: Dict) -> List[BehavioralChange]:
        """Detect state machine changes"""
        changes = []
        timestamp = datetime.now()

        # Compare state transitions
        old_transitions = old_states.get('transitions', [])
        new_transitions = new_states.get('transitions', [])

        # Convert to sets for comparison
        old_trans_set = {f"{t.get('from', '')}->{t.get('to', '')}" for t in old_transitions}
        new_trans_set = {f"{t.get('from', '')}->{t.get('to', '')}" for t in new_transitions}

        added_transitions = new_trans_set - old_trans_set
        removed_transitions = old_trans_set - new_trans_set

        for transition in added_transitions:
            change = BehavioralChange(
                change_id=self._generate_change_id(f"state_add_{transition}", timestamp),
                change_type=ChangeType.STATE_MACHINE,
                severity=ChangeSeverity.MINOR,
                title=f"New state transition: {transition}",
                description=f"New state transition '{transition}' was added",
                timestamp=timestamp,
                source="state_comparison",
                old_behavior=None,
                new_behavior={'transition': transition},
                affected_components=[transition],
                confidence_score=0.90,
                metadata={'transition': transition, 'action': 'added'}
            )
            changes.append(change)

        for transition in removed_transitions:
            change = BehavioralChange(
                change_id=self._generate_change_id(f"state_remove_{transition}", timestamp),
                change_type=ChangeType.STATE_MACHINE,
                severity=ChangeSeverity.MAJOR,
                title=f"State transition removed: {transition}",
                description=f"State transition '{transition}' was removed",
                timestamp=timestamp,
                source="state_comparison",
                old_behavior={'transition': transition},
                new_behavior=None,
                affected_components=[transition],
                confidence_score=0.90,
                metadata={'transition': transition, 'action': 'removed'}
            )
            changes.append(change)

        return changes

    def _assess_api_change_severity(self, old_spec: Dict, new_spec: Dict) -> ChangeSeverity:
        """Assess the severity of an API change"""
        # Breaking changes
        if (old_spec.get('required_params', []) != new_spec.get('required_params', []) or
            old_spec.get('response_schema') != new_spec.get('response_schema')):
            return ChangeSeverity.CRITICAL

        # Significant changes
        if (old_spec.get('method') != new_spec.get('method') or
            old_spec.get('path') != new_spec.get('path')):
            return ChangeSeverity.MAJOR

        # Minor changes
        return ChangeSeverity.MINOR

    def add_change(self, change: BehavioralChange):
        """Add a new behavioral change"""
        self.changes.append(change)
        self._save_changes()
        logger.info(f"Added behavioral change: {change.title}")

    def get_changes_by_type(self, change_type: ChangeType) -> List[BehavioralChange]:
        """Get changes filtered by type"""
        return [change for change in self.changes if change.change_type == change_type]

    def get_changes_by_severity(self, severity: ChangeSeverity) -> List[BehavioralChange]:
        """Get changes filtered by severity"""
        return [change for change in self.changes if change.severity == severity]

    def get_recent_changes(self, hours: int = 24) -> List[BehavioralChange]:
        """Get changes from the last N hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [change for change in self.changes if change.timestamp > cutoff_time]

    def analyze_change_patterns(self) -> List[ChangePattern]:
        """Analyze patterns in detected changes"""
        patterns = []

        # Group changes by type and analyze frequency
        change_types = {}
        for change in self.changes:
            change_type = change.change_type.value
            if change_type not in change_types:
                change_types[change_type] = []
            change_types[change_type].append(change)

        for change_type, type_changes in change_types.items():
            if len(type_changes) >= 3:  # Need minimum changes to detect pattern
                # Calculate frequency (changes per day)
                if type_changes:
                    time_span = (type_changes[-1].timestamp - type_changes[0].timestamp).days + 1
                    frequency = len(type_changes) / max(time_span, 1)

                    # Determine trend
                    recent_changes = [c for c in type_changes if
                                      c.timestamp > datetime.now() - timedelta(days=7)]
                    older_changes = [c for c in type_changes if
                                     c.timestamp <= datetime.now() - timedelta(days=7)]

                    if len(recent_changes) > len(older_changes):
                        trend = "increasing"
                    elif len(recent_changes) < len(older_changes):
                        trend = "decreasing"
                    else:
                        trend = "stable"

                    pattern = ChangePattern(
                        pattern_id=f"pattern_{change_type}_{datetime.now().strftime('%Y%m%d')}",
                        pattern_type=change_type,
                        frequency=frequency,
                        changes=[c.change_id for c in type_changes],
                        trend=trend,
                        confidence=min(0.5 + (len(type_changes) * 0.1), 0.95)
                    )
                    patterns.append(pattern)

        self.patterns = patterns
        self._save_patterns()
        return patterns

    def generate_change_report(self) -> Dict[str, Any]:
        """Generate comprehensive change report"""
        recent_changes = self.get_recent_changes(24)
        critical_changes = self.get_changes_by_severity(ChangeSeverity.CRITICAL)
        patterns = self.analyze_change_patterns()

        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_changes': len(self.changes),
                'recent_changes_24h': len(recent_changes),
                'critical_changes': len(critical_changes),
                'detected_patterns': len(patterns)
            },
            'recent_changes': [asdict(change) for change in recent_changes[-10:]],
            'critical_changes': [asdict(change) for change in critical_changes[-5:]],
            'change_patterns': [asdict(pattern) for pattern in patterns],
            'recommendations': self._generate_recommendations(recent_changes, critical_changes, patterns)
        }

        return report

    def _generate_recommendations(self, recent_changes: List[BehavioralChange],
                                  critical_changes: List[BehavioralChange],
                                  patterns: List[ChangePattern]) -> List[str]:
        """Generate recommendations based on detected changes"""
        recommendations = []

        if critical_changes:
            recommendations.append(
                f"URGENT: {len(critical_changes)} critical changes detected. "
                "Immediate specification updates required."
            )

        if len(recent_changes) > 10:
            recommendations.append(
                "High change frequency detected. Consider more frequent monitoring."
            )

        increasing_patterns = [p for p in patterns if p.trend == "increasing"]
        if increasing_patterns:
            recommendations.append(
                f"Increasing change patterns detected in: "
                f"{', '.join([p.pattern_type for p in increasing_patterns])}"
            )

        api_changes = [c for c in recent_changes if c.change_type == ChangeType.API]
        if api_changes:
            recommendations.append(
                f"API changes detected. Update client libraries and documentation."
            )

        return recommendations


def main():
    """Example usage of Change Detector"""
    detector = ChangeDetector()

    # Create example snapshots
    snapshot1_data = {
        'api': {
            'endpoints': {
                '/api/v1/chat': {'method': 'POST', 'params': ['message']},
                '/api/v1/status': {'method': 'GET', 'params': []}
            }
        },
        'behaviors': {
            'patterns': {
                'request_validation': {'enabled': True, 'strict': False}
            }
        },
        'states': {
            'transitions': [
                {'from': 'idle', 'to': 'processing', 'trigger': 'request'}
            ]
        }
    }

    snapshot2_data = {
        'api': {
            'endpoints': {
                '/api/v1/chat': {'method': 'POST', 'params': ['message', 'context']},
                '/api/v1/status': {'method': 'GET', 'params': []},
                '/api/v2/chat': {'method': 'POST', 'params': ['message']}
            }
        },
        'behaviors': {
            'patterns': {
                'request_validation': {'enabled': True, 'strict': True}
            }
        },
        'states': {
            'transitions': [
                {'from': 'idle', 'to': 'processing', 'trigger': 'request'},
                {'from': 'processing', 'to': 'complete', 'trigger': 'response'}
            ]
        }
    }

    # Create snapshots
    snapshot1_id = detector.create_snapshot("system_v1", snapshot1_data)
    snapshot2_id = detector.create_snapshot("system_v2", snapshot2_data)

    # Compare snapshots
    changes = detector.compare_snapshots(snapshot1_id, snapshot2_id)

    # Add changes to detector
    for change in changes:
        detector.add_change(change)

    # Generate report
    report = detector.generate_change_report()

    print("Change Detection Report:")
    print(f"Total changes: {report['summary']['total_changes']}")
    print(f"Recent changes: {report['summary']['recent_changes_24h']}")
    print(f"Critical changes: {report['summary']['critical_changes']}")

    if report['recommendations']:
        print("\nRecommendations:")
        for rec in report['recommendations']:
            print(f"- {rec}")


if __name__ == "__main__":
    main()