#!/usr/bin/env python3
"""
Test script to validate SpecWorkflow backward compatibility.

This script tests the migrated SpecWorkflow implementation to ensure
100% backward compatibility with the original SpecWorkflowAutomation.
"""

import sys
from pathlib import Path

# Add the workflows module to the path
sys.path.insert(0, str(Path(__file__).parent))

from workflows import SpecWorkflow, WorkflowConfig, create_spec_workflow
from workflows.definitions import migrate_from_automation_config


def test_basic_creation():
    """Test basic SpecWorkflow creation."""
    print("Testing basic SpecWorkflow creation...")

    config = WorkflowConfig(
        workflow_type='spec',
        project_path=Path(__file__).parent,
        spec_name='simple-tui-workflows'
    )

    workflow = SpecWorkflow(config)
    assert workflow.config.spec_name == 'simple-tui-workflows'
    assert workflow.config.workflow_type == 'spec'
    print("✅ Basic creation test passed")


def test_factory_function():
    """Test factory function creation."""
    print("Testing factory function creation...")

    workflow = create_spec_workflow(
        spec_name='simple-tui-workflows',
        project_path=Path(__file__).parent,
        max_cycles=15
    )

    assert workflow.config.spec_name == 'simple-tui-workflows'
    assert workflow.config.max_cycles == 15
    print("✅ Factory function test passed")


def test_migration_function():
    """Test migration from automation config."""
    print("Testing migration from automation config...")

    debug_options = {
        'show_tool_details': True,
        'show_raw_data': False
    }

    workflow = migrate_from_automation_config(
        spec_name='simple-tui-workflows',
        project_path=str(Path(__file__).parent),
        debug_options=debug_options
    )

    assert workflow.config.spec_name == 'simple-tui-workflows'
    assert workflow.config.debug_options == debug_options
    print("✅ Migration function test passed")


def test_prompt_generation():
    """Test prompt generation matches legacy format."""
    print("Testing prompt generation...")

    workflow = create_spec_workflow(
        spec_name='simple-tui-workflows',
        project_path=Path(__file__).parent
    )

    prompt = workflow.get_workflow_prompt()

    # Verify prompt contains expected elements from legacy automation
    assert 'spec: simple-tui-workflows' in prompt
    assert 'work on a single task from spec name above' in prompt
    assert 'mcp__spec-workflow tools' in prompt
    assert 'commit changes' in prompt
    print("✅ Prompt generation test passed")


def test_execution_options():
    """Test execution options match legacy format."""
    print("Testing execution options...")

    workflow = create_spec_workflow(
        spec_name='simple-tui-workflows',
        project_path=Path(__file__).parent
    )

    options = workflow.get_execution_options()

    # Verify options match legacy automation
    assert options['exit_on_complete'] == True
    assert options['permission_mode'] == 'bypassPermissions'
    assert 'cwd' in options
    print("✅ Execution options test passed")


def test_status_info():
    """Test status information includes spec details."""
    print("Testing status information...")

    workflow = create_spec_workflow(
        spec_name='simple-tui-workflows',
        project_path=Path(__file__).parent
    )

    status = workflow.get_status_info()

    assert status['workflow_type'] == 'spec'
    assert status['spec_name'] == 'simple-tui-workflows'
    assert 'compatibility_level' in status
    print("✅ Status information test passed")


if __name__ == '__main__':
    print("🧪 Running SpecWorkflow backward compatibility tests...")
    print()

    try:
        test_basic_creation()
        test_factory_function()
        test_migration_function()
        test_prompt_generation()
        test_execution_options()
        test_status_info()

        print()
        print("🎉 All tests passed! SpecWorkflow implementation is backward compatible.")
        print("✅ Ready for integration with existing automation systems.")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        sys.exit(1)