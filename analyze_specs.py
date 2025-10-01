#!/usr/bin/env python3
import os
import re
from pathlib import Path

specs_dir = Path(".spec-workflow/specs")
results = []

for spec_path in sorted(specs_dir.iterdir()):
    if spec_path.is_dir():
        spec_name = spec_path.name
        tasks_file = spec_path / "tasks.md"

        has_tasks = "✓" if tasks_file.exists() else "✗"

        if tasks_file.exists():
            content = tasks_file.read_text()
            completed = len(re.findall(r'^\- \[x\]', content, re.MULTILINE))
            pending = len(re.findall(r'^\- \[ \]', content, re.MULTILINE))
            inprogress = len(re.findall(r'^\- \[-\]', content, re.MULTILINE))
            total = completed + pending + inprogress
            status = f"✓{completed} ⏳{inprogress} ⏸{pending} (Total: {total})"
        else:
            status = "No tasks.md"

        results.append(f"{has_tasks:3} | {spec_name:40} | {status}")

print("\nSpec Completion Analysis:")
print("=" * 100)
print(f"{'T':3} | {'Spec Name':40} | {'Status'}")
print("-" * 100)
for line in results:
    print(line)
print("=" * 100)
print(f"\nTotal specs: {len(results)}")
print(f"With tasks.md: {sum(1 for r in results if '✓' in r.split('|')[0])}")
print(f"Without tasks.md: {sum(1 for r in results if '✗' in r.split('|')[0])}")
