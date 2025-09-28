"""
Core Workflow System Components

This module contains the foundational components of the workflow system:
- Abstract base classes defining workflow interfaces
- Configuration management for workflow instances
- Execution engine for orchestrating Claude Code sessions
- Completion detection framework for various workflow types

These components establish the plugin architecture and provide the building
blocks for implementing specific workflow types.
"""

from .base_workflow import BaseWorkflow, WorkflowConfig

__all__ = ['BaseWorkflow', 'WorkflowConfig']