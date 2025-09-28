#!/usr/bin/env python3
"""
Claude Code Specification System API Package

This package provides unified REST API access to all specification system components
including specification management, runtime monitoring, and validation services.

Components:
- SpecificationAPI: Main specification management and lifecycle operations
- MonitoringAPI: Runtime monitoring and event capture capabilities
- ValidationAPI: Schema validation and compliance testing services
"""

from .specification_api import SpecificationAPI, APIResponse
from .monitoring_api import MonitoringAPI, MonitoringAPIResponse
from .validation_api import ValidationAPI, ValidationAPIResponse

__all__ = [
    "SpecificationAPI",
    "MonitoringAPI",
    "ValidationAPI",
    "APIResponse",
    "MonitoringAPIResponse",
    "ValidationAPIResponse"
]

__version__ = "1.0.0"