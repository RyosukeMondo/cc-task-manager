"""
Claude Code Behavioral Analysis Engine

This package provides tools for analyzing Claude Code wrapper behavior and generating
formal behavioral specifications from runtime observations.

Components:
- state_machine_generator: Generates state machines from event sequences
- pattern_detector: Detects behavioral patterns in runtime data
- behavior_analyzer: Main orchestrator for generating behavioral specifications
"""

from .state_machine_generator import StateMachineGenerator, StateMachine, StateTransition
from .pattern_detector import PatternDetector, BehavioralPattern, SessionAnalysis
from .behavior_analyzer import BehaviorAnalyzer, BehavioralSpecification

__all__ = [
    'StateMachineGenerator',
    'StateMachine',
    'StateTransition',
    'PatternDetector',
    'BehavioralPattern',
    'SessionAnalysis',
    'BehaviorAnalyzer',
    'BehavioralSpecification'
]

__version__ = "1.0.0"