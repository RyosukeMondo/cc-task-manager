#!/usr/bin/env python3
"""
Extract Claude Code Specifications Script

This script analyzes the claudeCodeSpecs app, session data, and claude_wrapper.py
to compile comprehensive Claude Code specification information.
"""

import json
import os
import sys
import logging
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('claude_specs_extraction.log')
    ]
)
logger = logging.getLogger(__name__)

class ClaudeCodeSpecExtractor:
    """Extract and analyze Claude Code specifications from multiple sources."""

    def __init__(self):
        self.base_dir = Path.cwd()
        self.specs_data = {
            "extraction_timestamp": datetime.utcnow().isoformat(),
            "source_analysis": {},
            "session_patterns": {},
            "wrapper_interface": {},
            "sdk_specifications": {},
            "comprehensive_spec": {}
        }

    def analyze_session_data(self):
        """Analyze Claude session JSONL files for behavioral patterns."""
        logger.info("Analyzing Claude session data...")

        claude_dir = Path.home() / ".claude"
        session_files = list(claude_dir.rglob("*.jsonl"))

        patterns = {
            "tool_usage": {},
            "message_types": {},
            "session_structures": {},
            "error_patterns": {},
            "workflow_patterns": {}
        }

        for session_file in session_files[:10]:  # Analyze first 10 files
            try:
                logger.info(f"Processing session file: {session_file}")
                with open(session_file, 'r') as f:
                    for line_num, line in enumerate(f):
                        if line.strip():
                            try:
                                data = json.loads(line.strip())
                                self._analyze_session_entry(data, patterns)
                            except json.JSONDecodeError as e:
                                logger.warning(f"JSON decode error in {session_file}:{line_num}: {e}")
                        if line_num > 100:  # Limit analysis per file
                            break
            except Exception as e:
                logger.error(f"Error processing {session_file}: {e}")

        self.specs_data["session_patterns"] = patterns
        logger.info(f"Analyzed {len(session_files)} session files")

    def _analyze_session_entry(self, data: Dict[str, Any], patterns: Dict[str, Any]):
        """Analyze individual session entry for patterns."""

        # Track message types
        msg_type = data.get("type", "unknown")
        patterns["message_types"][msg_type] = patterns["message_types"].get(msg_type, 0) + 1

        # Analyze tool usage
        if "message" in data and isinstance(data["message"], dict):
            content = data["message"].get("content", [])
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "tool_use":
                        tool_name = item.get("name", "unknown")
                        patterns["tool_usage"][tool_name] = patterns["tool_usage"].get(tool_name, 0) + 1

        # Track session metadata
        if "sessionId" in data:
            session_id = data["sessionId"]
            if session_id not in patterns["session_structures"]:
                patterns["session_structures"][session_id] = {
                    "version": data.get("version"),
                    "cwd": data.get("cwd"),
                    "gitBranch": data.get("gitBranch"),
                    "message_count": 0
                }
            patterns["session_structures"][session_id]["message_count"] += 1

    def analyze_wrapper_interface(self):
        """Analyze claude_wrapper.py for STDIO interface specifications."""
        logger.info("Analyzing claude_wrapper.py STDIO interface...")

        wrapper_file = self.base_dir / "scripts" / "claude_wrapper.py"
        if not wrapper_file.exists():
            logger.error(f"claude_wrapper.py not found at {wrapper_file}")
            return

        interface_spec = {
            "input_commands": {},
            "output_events": {},
            "json_schemas": {},
            "state_management": {},
            "error_handling": {}
        }

        try:
            with open(wrapper_file, 'r') as f:
                content = f.read()

            # Extract command handling patterns
            command_patterns = re.findall(r'action == "(\w+)"', content)
            for cmd in command_patterns:
                interface_spec["input_commands"][cmd] = {"discovered_in": "handle_command"}

            # Extract output event patterns
            event_patterns = re.findall(r'"event": "(\w+)"', content)
            for event in event_patterns:
                interface_spec["output_events"][event] = {"discovered_in": "output_json calls"}

            # Extract JSON schema patterns
            json_patterns = re.findall(r'"(\w+)": (\w+)', content)
            for field, field_type in json_patterns:
                if field not in interface_spec["json_schemas"]:
                    interface_spec["json_schemas"][field] = set()
                interface_spec["json_schemas"][field].add(field_type)

            # Convert sets to lists for JSON serialization
            for field in interface_spec["json_schemas"]:
                interface_spec["json_schemas"][field] = list(interface_spec["json_schemas"][field])

            self.specs_data["wrapper_interface"] = interface_spec
            logger.info("Wrapper interface analysis completed")

        except Exception as e:
            logger.error(f"Error analyzing wrapper interface: {e}")

    def analyze_specs_app(self):
        """Analyze the claudeCodeSpecs application structure."""
        logger.info("Analyzing claudeCodeSpecs application...")

        specs_dir = self.base_dir / "claudeCodeSpecs"
        if not specs_dir.exists():
            logger.error(f"claudeCodeSpecs directory not found at {specs_dir}")
            return

        app_structure = {
            "components": {},
            "apis": {},
            "schemas": {},
            "documentation": {}
        }

        # Analyze directory structure
        for subdir in specs_dir.iterdir():
            if subdir.is_dir():
                component_files = list(subdir.rglob("*.py"))
                app_structure["components"][subdir.name] = {
                    "file_count": len(component_files),
                    "files": [f.name for f in component_files]
                }

        # Look for API files
        api_files = list(specs_dir.rglob("*api*.py"))
        for api_file in api_files:
            try:
                with open(api_file, 'r') as f:
                    content = f.read()

                # Extract class definitions
                class_matches = re.findall(r'class (\w+)', content)
                function_matches = re.findall(r'def (\w+)', content)

                app_structure["apis"][api_file.name] = {
                    "classes": class_matches,
                    "functions": function_matches
                }
            except Exception as e:
                logger.warning(f"Error analyzing {api_file}: {e}")

        self.specs_data["source_analysis"] = app_structure
        logger.info("Specs app analysis completed")

    def compile_comprehensive_spec(self):
        """Compile comprehensive Claude Code specification."""
        logger.info("Compiling comprehensive specification...")

        comprehensive = {
            "claude_code_overview": {
                "description": "Claude Code is an agentic coding tool with CLI, TypeScript, and Python SDKs",
                "key_features": [
                    "Context management with automatic compaction",
                    "Rich tool ecosystem (file ops, code execution, web search, MCP)",
                    "Advanced permissions and fine-grained control",
                    "Built-in error handling and session management",
                    "Optimized Claude integration with prompt caching"
                ],
                "availability": ["CLI", "TypeScript SDK (@anthropic-ai/claude-code)", "Python SDK (claude-code-sdk)"]
            },
            "session_management": {
                "format": "JSONL files in ~/.claude/projects/*/sessions/",
                "key_fields": ["type", "message", "sessionId", "timestamp", "version", "cwd", "gitBranch"],
                "message_types": list(self.specs_data.get("session_patterns", {}).get("message_types", {}).keys())
            },
            "stdio_interface": {
                "input_format": "JSON lines on STDIN",
                "output_format": "JSON events on STDOUT",
                "commands": list(self.specs_data.get("wrapper_interface", {}).get("input_commands", {}).keys()),
                "events": list(self.specs_data.get("wrapper_interface", {}).get("output_events", {}).keys())
            },
            "tool_ecosystem": {
                "discovered_tools": list(self.specs_data.get("session_patterns", {}).get("tool_usage", {}).keys()),
                "usage_patterns": self.specs_data.get("session_patterns", {}).get("tool_usage", {})
            },
            "behavioral_patterns": {
                "session_structures": len(self.specs_data.get("session_patterns", {}).get("session_structures", {})),
                "workflow_patterns": self.specs_data.get("session_patterns", {}).get("workflow_patterns", {})
            }
        }

        self.specs_data["comprehensive_spec"] = comprehensive
        logger.info("Comprehensive specification compiled")

    def run_extraction(self):
        """Run complete extraction process."""
        logger.info("Starting Claude Code specification extraction...")

        self.analyze_specs_app()
        self.analyze_wrapper_interface()
        self.analyze_session_data()
        self.compile_comprehensive_spec()

        # Save results
        output_file = self.base_dir / "claude_code_specifications.json"
        with open(output_file, 'w') as f:
            json.dump(self.specs_data, f, indent=2, sort_keys=True)

        logger.info(f"Extraction completed. Results saved to {output_file}")

        # Print summary
        print("\n" + "="*50)
        print("CLAUDE CODE SPECIFICATION EXTRACTION SUMMARY")
        print("="*50)

        spec = self.specs_data["comprehensive_spec"]
        print(f"Session message types found: {len(spec['session_management']['message_types'])}")
        print(f"STDIO commands discovered: {len(spec['stdio_interface']['commands'])}")
        print(f"STDIO events discovered: {len(spec['stdio_interface']['events'])}")
        print(f"Tools discovered in sessions: {len(spec['tool_ecosystem']['discovered_tools'])}")

        print(f"\nTop 10 most used tools:")
        tool_usage = spec['tool_ecosystem']['usage_patterns']
        sorted_tools = sorted(tool_usage.items(), key=lambda x: x[1], reverse=True)[:10]
        for tool, count in sorted_tools:
            print(f"  {tool}: {count} uses")

        print(f"\nSTDIO Commands: {', '.join(spec['stdio_interface']['commands'])}")
        print(f"STDIO Events: {', '.join(spec['stdio_interface']['events'])}")

        return self.specs_data

if __name__ == "__main__":
    extractor = ClaudeCodeSpecExtractor()
    results = extractor.run_extraction()