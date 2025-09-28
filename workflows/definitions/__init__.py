#!/usr/bin/env python3
"""
Workflow Definitions Package

This package contains concrete implementations of various workflow types
that inherit from the BaseWorkflow abstract class.

Available Workflows:
    - SpecWorkflow: Automates spec-workflow task execution
    - TestFixWorkflow: Automates test failure resolution
    - TypeFixWorkflow: Automates type error resolution
    - BuildFixWorkflow: Automates build error resolution
"""

from .spec_workflow import SpecWorkflow, create_spec_workflow, migrate_from_automation_config

__all__ = [
    'SpecWorkflow',
    'create_spec_workflow',
    'migrate_from_automation_config'
]