"""
Workflow System Package

This package provides a pluggable workflow system for automating various
development tasks using Claude Code. The system is built around abstract
base classes that define common interfaces while allowing for workflow-specific
implementations.

Core Components:
    - BaseWorkflow: Abstract base class for all workflows
    - WorkflowConfig: Configuration management for workflows
    - WorkflowEngine: Execution engine for running workflows
    - CompletionDetector: Framework for detecting workflow completion

Workflow Types:
    - SpecWorkflow: Specification-driven development workflow
    - TestFixWorkflow: Automated test failure resolution
    - TypeFixWorkflow: Type error resolution workflow
    - BuildFixWorkflow: Build error resolution workflow

The system maintains backward compatibility with existing automation while
providing a clean, extensible architecture for new workflow types.
"""

from .core.base_workflow import BaseWorkflow, WorkflowConfig
from .core.workflow_engine import WorkflowEngine, create_workflow_engine
from .definitions import SpecWorkflow, create_spec_workflow

__all__ = [
    'BaseWorkflow',
    'WorkflowConfig',
    'WorkflowEngine',
    'create_workflow_engine',
    'SpecWorkflow',
    'create_spec_workflow'
]
__version__ = '1.0.0'