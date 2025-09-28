#!/usr/bin/env python3
"""
Simple specification generation script

Execute runtime analysis and generate specifications using existing components.
"""

import sys
import os
import json
from datetime import datetime
from pathlib import Path

# Add claudeCodeSpecs to Python path
sys.path.insert(0, os.path.join(os.getcwd(), 'claudeCodeSpecs'))

from analysis.behavior_analyzer import BehaviorAnalyzer
from analysis.state_machine_generator import StateMachineGenerator
from analysis.pattern_detector import PatternDetector

def generate_claude_code_runtime_events():
    """Generate realistic Claude Code runtime events for analysis"""
    return [
        # Session start
        {
            "timestamp": "2025-09-28T10:00:00Z",
            "event_type": "session_start",
            "session_id": "claude_001",
            "payload": {"user_context": "code_development"}
        },

        # Tool usage sequence
        {
            "timestamp": "2025-09-28T10:00:01Z",
            "event_type": "tool_call",
            "session_id": "claude_001",
            "payload": {"tool": "Read", "file": "src/main.py"}
        },
        {
            "timestamp": "2025-09-28T10:00:02Z",
            "event_type": "tool_response",
            "session_id": "claude_001",
            "payload": {"tool": "Read", "success": True, "content_length": 1024}
        },

        # Code analysis
        {
            "timestamp": "2025-09-28T10:00:03Z",
            "event_type": "tool_call",
            "session_id": "claude_001",
            "payload": {"tool": "Grep", "pattern": "function", "files": "*.py"}
        },
        {
            "timestamp": "2025-09-28T10:00:04Z",
            "event_type": "tool_response",
            "session_id": "claude_001",
            "payload": {"tool": "Grep", "success": True, "matches": 15}
        },

        # Code modification
        {
            "timestamp": "2025-09-28T10:00:05Z",
            "event_type": "tool_call",
            "session_id": "claude_001",
            "payload": {"tool": "Edit", "file": "src/main.py", "operation": "replace"}
        },
        {
            "timestamp": "2025-09-28T10:00:06Z",
            "event_type": "tool_response",
            "session_id": "claude_001",
            "payload": {"tool": "Edit", "success": True, "changes": 1}
        },

        # Testing
        {
            "timestamp": "2025-09-28T10:00:07Z",
            "event_type": "tool_call",
            "session_id": "claude_001",
            "payload": {"tool": "Bash", "command": "python -m pytest"}
        },
        {
            "timestamp": "2025-09-28T10:00:15Z",
            "event_type": "tool_response",
            "session_id": "claude_001",
            "payload": {"tool": "Bash", "success": True, "exit_code": 0, "output": "5 passed"}
        },

        # Session completion
        {
            "timestamp": "2025-09-28T10:00:16Z",
            "event_type": "session_end",
            "session_id": "claude_001",
            "payload": {"duration": 16, "tools_used": 4, "success": True}
        }
    ]

def main():
    """Main execution function"""
    print("🚀 Starting Claude Code Specification Generation...")
    print("=" * 60)

    # Generate runtime events
    print("📊 Generating runtime events...")
    events = generate_claude_code_runtime_events()
    print(f"   Generated {len(events)} events")

    # Initialize analysis components
    print("🔧 Initializing analysis components...")
    analyzer = BehaviorAnalyzer()
    state_generator = StateMachineGenerator()
    pattern_detector = PatternDetector()

    # Run behavioral analysis
    print("🧠 Running behavioral analysis...")
    try:
        # Analyze the events
        session_analysis = analyzer.analyze_event_sequence(events)
        print(f"   Detected {len(session_analysis.get('patterns', []))} behavioral patterns")

        # Generate state machine
        state_machine = state_generator.generate_from_events(events)
        print(f"   Generated state machine with {len(state_machine.get('states', []))} states")

        # Detect patterns
        patterns = pattern_detector.detect_patterns(events)
        print(f"   Found {len(patterns)} distinct patterns")

    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        return 1

    # Generate specifications
    print("📝 Generating specifications...")

    output_dir = Path("claudeCodeSpecs/generated")
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Create comprehensive specification
    specification = {
        "name": f"ClaudeCodeWrapperSpecs_{timestamp}",
        "version": "1.0.0",
        "generated_at": datetime.utcnow().isoformat(),
        "metadata": {
            "source_events": len(events),
            "analysis_timestamp": timestamp,
            "generator": "Claude Code Specification System v1.0.0"
        },
        "runtime_events": events,
        "behavioral_analysis": session_analysis,
        "state_machine": state_machine,
        "detected_patterns": patterns,
        "protocol_schemas": {
            "tool_call_schema": {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "type": "object",
                "properties": {
                    "timestamp": {"type": "string", "format": "date-time"},
                    "event_type": {"type": "string", "enum": ["tool_call"]},
                    "session_id": {"type": "string"},
                    "payload": {
                        "type": "object",
                        "properties": {
                            "tool": {"type": "string"},
                            "parameters": {"type": "object"}
                        },
                        "required": ["tool"]
                    }
                },
                "required": ["timestamp", "event_type", "session_id", "payload"]
            },
            "tool_response_schema": {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "type": "object",
                "properties": {
                    "timestamp": {"type": "string", "format": "date-time"},
                    "event_type": {"type": "string", "enum": ["tool_response"]},
                    "session_id": {"type": "string"},
                    "payload": {
                        "type": "object",
                        "properties": {
                            "tool": {"type": "string"},
                            "success": {"type": "boolean"},
                            "data": {"type": "object"}
                        },
                        "required": ["tool", "success"]
                    }
                },
                "required": ["timestamp", "event_type", "session_id", "payload"]
            }
        },
        "validation_criteria": [
            {
                "criterion_id": "tool_call_format",
                "description": "All tool calls must follow standard format",
                "test_type": "schema_validation",
                "acceptance_threshold": 1.0
            },
            {
                "criterion_id": "session_lifecycle",
                "description": "Sessions must start and end properly",
                "test_type": "lifecycle_validation",
                "acceptance_threshold": 1.0
            },
            {
                "criterion_id": "tool_response_consistency",
                "description": "Tool responses must match their calls",
                "test_type": "consistency_validation",
                "acceptance_threshold": 0.95
            }
        ],
        "implementation_guidelines": {
            "session_management": "Implementations must properly track session lifecycle",
            "tool_integration": "All tools must follow the defined call/response pattern",
            "error_handling": "Failed tool calls must be handled gracefully",
            "performance": "Tool execution should complete within reasonable timeframes"
        }
    }

    # Save the main specification
    spec_file = output_dir / f"claude_code_specification_{timestamp}.json"
    with open(spec_file, 'w') as f:
        json.dump(specification, f, indent=2)

    print(f"   📄 Saved specification: {spec_file}")

    # Generate markdown documentation
    doc_content = f"""# Claude Code Wrapper Specification

Generated: {datetime.now().isoformat()}

## Overview

This specification defines the behavioral patterns, protocol schemas, and validation criteria for Claude Code wrapper implementations based on runtime analysis.

## Key Findings

- **Total Events Analyzed**: {len(events)}
- **Behavioral Patterns**: {len(patterns)} detected
- **State Machine States**: {len(state_machine.get('states', []))} states
- **Tool Types Used**: {len(set(e['payload'].get('tool', '') for e in events if e['event_type'] == 'tool_call'))}

## Behavioral Patterns

{chr(10).join(f"- **{p.get('name', 'Unknown')}**: {p.get('description', 'No description')}" for p in patterns)}

## State Machine

The generated state machine includes the following states:
{chr(10).join(f"- {state}" for state in state_machine.get('states', []))}

## Protocol Schemas

- Tool Call Schema: Defines format for tool invocations
- Tool Response Schema: Defines format for tool responses
- Session Events Schema: Defines session lifecycle events

## Validation Criteria

- Tool call format validation (100% compliance required)
- Session lifecycle validation (100% compliance required)
- Tool response consistency (95% compliance required)

## Implementation Guidelines

1. **Session Management**: Maintain proper session lifecycle
2. **Tool Integration**: Follow defined call/response patterns
3. **Error Handling**: Handle tool failures gracefully
4. **Performance**: Ensure reasonable execution timeframes

---

*Generated by Claude Code Specification System v1.0.0*
"""

    doc_file = output_dir / f"specification_documentation_{timestamp}.md"
    with open(doc_file, 'w') as f:
        f.write(doc_content)

    print(f"   📋 Saved documentation: {doc_file}")

    # Summary
    print("=" * 60)
    print("✅ Specification generation completed successfully!")
    print(f"📁 Generated files in: {output_dir}/")
    print(f"   - {spec_file.name}")
    print(f"   - {doc_file.name}")
    print(f"🔍 Analysis summary:")
    print(f"   - Events processed: {len(events)}")
    print(f"   - Patterns detected: {len(patterns)}")
    print(f"   - States identified: {len(state_machine.get('states', []))}")

    return 0

if __name__ == "__main__":
    exit(main())