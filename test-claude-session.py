#!/usr/bin/env python3
"""
Python script to test Claude Code session via the worker system
"""

import asyncio
import json
from bullmq import Queue
import os

async def test_claude_code_session():
    """Submit a Claude Code job and wait for results"""

    # Connect to Redis queue
    queue = Queue(
        name="claude-code-queue",
        connection={
            "host": "localhost",
            "port": 6379
        }
    )

    print("🚀 Submitting Claude Code session job...")

    # Create test workspace
    test_workspace = os.path.join(os.getcwd(), 'test-workspace')
    os.makedirs(test_workspace, exist_ok=True)

    # Submit job with real Claude Code prompt
    job_data = {
        "taskId": f"claude-session-{int(asyncio.get_event_loop().time())}",
        "prompt": """
        I'm testing the Claude Code worker system. Please:
        1. Create a simple Python script called 'hello.py' that prints a greeting
        2. Create a README.md file explaining what the script does
        3. List all files in the current directory
        4. Show me the content of the files you created
        """,
        "sessionName": f"test-session-{int(asyncio.get_event_loop().time())}",
        "workingDirectory": test_workspace,
        "options": {
            "timeout": 120,  # 2 minutes timeout
        },
        "timeoutMs": 120000,
    }

    job = await queue.add("claude-code-task", job_data)

    print(f"📋 Job submitted with ID: {job.id}")
    print("⏳ Waiting for Claude Code to process...")
    print("📝 This will test:")
    print("   - Python wrapper → Claude Code CLI integration")
    print("   - File creation and manipulation")
    print("   - Real-time progress monitoring")
    print("   - Complete workflow end-to-end")

    try:
        # Wait for completion (with timeout)
        result = await job.waitUntilFinished()

        print("✅ Claude Code session completed!")
        print("📊 Final Result:")
        print(json.dumps(result, indent=2))

        # Check if files were actually created
        print("\n📁 Checking created files:")
        for file in os.listdir(test_workspace):
            print(f"   - {file}")
            if file.endswith('.py') or file.endswith('.md'):
                with open(os.path.join(test_workspace, file), 'r') as f:
                    print(f"     Content preview: {f.read()[:100]}...")

    except Exception as error:
        print(f"❌ Claude Code session failed: {error}")

    finally:
        await queue.close()

if __name__ == "__main__":
    print("🧪 Claude Code Worker Integration Test")
    print("=" * 50)
    asyncio.run(test_claude_code_session())