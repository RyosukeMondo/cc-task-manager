#!/usr/bin/env python3
"""
Entry point for workflows package when executed as a module.

This allows the workflows package to be executed as:
    python -m workflows <workflow-type> [options]

This provides the unified CLI interface for all workflow types.
"""

from .cli import sync_main

if __name__ == "__main__":
    exit(sync_main())