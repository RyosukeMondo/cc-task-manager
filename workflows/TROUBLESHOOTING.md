# Workflow System Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the workflow system.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Debug Modes](#debug-modes)
- [Log Analysis](#log-analysis)
- [Migration Issues](#migration-issues)
- [Performance Problems](#performance-problems)
- [Integration Issues](#integration-issues)
- [Recovery Procedures](#recovery-procedures)

## Quick Diagnostics

### System Health Check

Run this command to perform a quick system health check:

```bash
python -m workflows.cli --help && echo "✅ CLI working" || echo "❌ CLI broken"
```

### Verbose Testing

Test a workflow with maximum debug information:

```bash
python -m workflows.cli spec \
  --spec-name "test" \
  --project . \
  --debug-all \
  --debug-tools \
  --debug-content \
  --verbose \
  --session-log debug.jsonl
```

### Configuration Validation

Check if your configuration is valid:

```bash
python -c "
from workflows.core.config_manager import ConfigManager
from pathlib import Path
try:
    config = ConfigManager.load_config(Path('.'))
    print('✅ Configuration valid')
    print(f'Loaded: {config}')
except Exception as e:
    print(f'❌ Configuration error: {e}')
"
```

## Common Issues

### 1. Module Import Errors

#### Problem: `ModuleNotFoundError: No module named 'workflows'`

**Symptoms:**
- Error when running `python -m workflows.cli`
- Import errors in Python scripts

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Wrong working directory | `cd` to project root directory |
| Missing `__init__.py` files | Ensure all workflow directories have `__init__.py` |
| Python path issues | Run from project root or add to PYTHONPATH |
| Virtual environment not activated | Activate the correct virtual environment |

**Diagnostic Commands:**
```bash
# Check current directory
pwd

# Verify workflows directory structure
ls -la workflows/
ls -la workflows/__init__.py
ls -la workflows/core/__init__.py

# Check Python path
python -c "import sys; print('\n'.join(sys.path))"

# Test import manually
python -c "import workflows; print('Import successful')"
```

**Quick Fix:**
```bash
# From project root
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python -m workflows.cli --help
```

### 2. Workflow Execution Failures

#### Problem: Workflow starts but doesn't complete

**Symptoms:**
- Workflow runs but never detects completion
- Session times out without finishing
- Partial execution with no clear error

**Diagnostic Steps:**

1. **Enable Full Debug Mode:**
```bash
python -m workflows.cli spec \
  --spec-name "your-spec" \
  --project . \
  --debug-all \
  --debug-tools \
  --verbose \
  --session-log execution.jsonl
```

2. **Check Completion Patterns:**
```bash
# For spec workflows, check if spec-workflow tools are working
grep -i "spec.*workflow" execution.jsonl
grep -i "completion" execution.jsonl
grep -i "taskProgress" execution.jsonl
```

3. **Analyze Session Log:**
```bash
# Look for error patterns
grep -i "error\|fail\|exception" execution.jsonl

# Check tool usage
grep -i "tool.*use\|tool.*result" execution.jsonl

# Check Claude's responses
jq '.payload.content[]?.text' execution.jsonl | head -20
```

**Common Causes & Solutions:**

| Issue | Cause | Solution |
|-------|-------|----------|
| MCP tools not available | Claude Code doesn't have required MCP tools | Verify MCP tool installation |
| Wrong completion patterns | Detector looking for wrong text patterns | Update completion detector patterns |
| Session timeout | Task takes longer than configured timeout | Increase `max_session_time` |
| Spec-workflow structure missing | No `.spec-workflow` directory | Run spec-workflow setup first |

### 3. Configuration Issues

#### Problem: Configuration not loading or invalid values

**Symptoms:**
- Default values used instead of configuration
- Error about missing required fields
- Environment variables not being applied

**Diagnostic Commands:**
```bash
# Check configuration files exist
ls -la workflows.yaml workflows.yml workflows.json

# Validate YAML syntax
python -c "import yaml; print(yaml.safe_load(open('workflows.yaml')))" 2>/dev/null || echo "Invalid YAML"

# Check environment variables
env | grep WORKFLOW

# Test configuration loading
python -c "
from workflows.core.config_manager import ConfigManager
from pathlib import Path
try:
    config = ConfigManager.load_config(Path('.'))
    print('Configuration loaded successfully')
    print(f'Max cycles: {config.get(\"max_cycles\", \"not set\")}')
except Exception as e:
    print(f'Configuration error: {e}')
"
```

**Common Configuration Problems:**

| Problem | Solution |
|---------|----------|
| YAML syntax errors | Use `yamllint workflows.yaml` to check syntax |
| Wrong file location | Place config files in project root |
| Environment variables not set | Use correct `WORKFLOW_` prefix |
| Invalid data types | Ensure numbers are not quoted in YAML |

### 4. PM2 Integration Issues

#### Problem: PM2 processes fail to start with new workflow system

**Symptoms:**
- PM2 shows processes as "errored" or "stopped"
- PM2 logs show module import errors
- Processes start but immediately exit

**Diagnostic Steps:**

1. **Check PM2 Status:**
```bash
pm2 status
pm2 logs --lines 50
```

2. **Test Workflow Manually:**
```bash
# Test the exact command PM2 is trying to run
python -m workflows.cli spec --spec-name "test" --project .
```

3. **Check Ecosystem Configuration:**
```bash
# Validate ecosystem.config.js syntax
node -c ecosystem.config.js

# Show PM2 configuration
pm2 ecosystem
```

**Common PM2 Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| Wrong Python path | PM2 using system Python instead of project Python | Specify full Python path in config |
| Missing environment variables | PM2 environment doesn't include required vars | Add `env` section to ecosystem.config.js |
| Working directory issues | PM2 not running from correct directory | Set `cwd` in ecosystem.config.js |
| Module path issues | Python can't find workflows module | Use absolute paths or set PYTHONPATH |

**Fixed Ecosystem Configuration Example:**
```javascript
module.exports = {
  apps: [{
    name: 'spec-workflow',
    script: '/usr/bin/python3', // Full Python path
    args: ['-m', 'workflows.cli', 'spec', '--spec-name', 'my-spec', '--project', process.cwd()],
    cwd: process.cwd(),
    env: {
      PYTHONPATH: process.cwd(),
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log'
  }]
};
```

### 5. Claude Code Session Issues

#### Problem: Claude Code sessions fail to start or respond

**Symptoms:**
- "Failed to start Claude session" errors
- Sessions start but no output received
- Connection timeouts

**Diagnostic Steps:**

1. **Test Claude Code Directly:**
```bash
# Test if Claude Code works manually
claude-code --help

# Test session creation
echo '{"action": "prompt", "prompt": "hello", "options": {"cwd": "."}}' | claude-code
```

2. **Check Session Logs:**
```bash
# Look for Claude Code specific errors
tail -f logs/workflow_session.log
grep -i "claude.*session\|ready\|shutdown" logs/workflow_session.log
```

3. **Verify Claude Code Configuration:**
```bash
# Check Claude Code configuration
claude-code config list
```

**Common Session Issues:**

| Issue | Solution |
|-------|----------|
| Claude Code not installed | Install Claude Code from official source |
| Invalid authentication | Run `claude-code auth` to authenticate |
| Network connectivity issues | Check internet connection and proxy settings |
| Permission issues | Ensure Claude Code has necessary permissions |

## Debug Modes

### Debug Levels (from least to most verbose)

1. **Basic Logging:**
```bash
python -m workflows.cli spec --spec-name "test" --project . --verbose
```

2. **Tool Usage Details:**
```bash
python -m workflows.cli spec --spec-name "test" --project . --debug-tools
```

3. **Content Analysis:**
```bash
python -m workflows.cli spec --spec-name "test" --project . --debug-content --debug-tools
```

4. **Stream Metadata:**
```bash
python -m workflows.cli spec --spec-name "test" --project . --debug-metadata --debug-tools
```

5. **Payload Structure:**
```bash
python -m workflows.cli spec --spec-name "test" --project . --debug-payload --debug-tools
```

6. **All Events:**
```bash
python -m workflows.cli spec --spec-name "test" --project . --debug-all
```

7. **Raw Data (Maximum Verbosity):**
```bash
python -m workflows.cli spec --spec-name "test" --project . --debug-raw
```

### Session Logging

**Enable Session Logging:**
```bash
python -m workflows.cli spec \
  --spec-name "test" \
  --project . \
  --session-log session.jsonl \
  --debug-tools
```

**Analyze Session Logs:**
```bash
# Count different event types
jq -r '.event' session.jsonl | sort | uniq -c

# Show all tool usage
jq 'select(.event == "stream") | .payload.content[]? | select(.type == "tool_use") | .name' session.jsonl

# Show tool results
jq 'select(.event == "stream") | .payload.content[]? | select(.type == "tool_result") | .content' session.jsonl

# Show Claude's text responses
jq -r 'select(.event == "stream") | .payload.content[]? | select(.type == "text") | .text' session.jsonl
```

## Log Analysis

### Understanding Log Patterns

**Normal Workflow Execution:**
```
INFO - Starting spec workflow automation for: my-spec
INFO - Working in project directory: /path/to/project
INFO - Starting automation cycle 1
INFO - Starting new Claude Code session...
INFO - Claude session started successfully
DEBUG - TOOL EVENT: spec-workflow tools detected
INFO - Task progress: 5/12 tasks completed
INFO - COMPLETION DETECTED via spec-workflow taskProgress!
INFO - Spec workflow automation completed successfully
```

**Failed Workflow Patterns:**
```
ERROR - Failed to start Claude session
ERROR - Tool result parsing failed
WARNING - Reached maximum cycles (10), stopping automation
ERROR - Session timeout after 1800 seconds
```

### Log Analysis Commands

```bash
# Check for errors
grep -i "error\|fail\|exception" logs/*.log

# Monitor real-time logs
tail -f logs/workflow_session.log

# Count completion attempts
grep -c "completion" logs/workflow_session.log

# Show tool usage statistics
grep "TOOL.*USED" logs/workflow_session.log | sort | uniq -c

# Find session timeouts
grep -i "timeout\|expired" logs/*.log
```

## Migration Issues

### Legacy System Conflicts

#### Problem: Both old and new systems running simultaneously

**Symptoms:**
- Conflicting PM2 processes
- File locks or permission errors
- Inconsistent behavior

**Solution:**
```bash
# Stop all PM2 processes
pm2 stop all

# Kill any spec-workflow processes
pkill -f "spec_workflow_automation"

# Clean PM2 process list
pm2 delete all

# Start with clean migration
python scripts/migrate_to_workflows.py --full-migration
```

### Migration Validation Failures

#### Problem: Migration validation fails

**Diagnostic Steps:**
```bash
# Run migration validation
python scripts/migrate_to_workflows.py --validate

# Check specific validation components
python -c "
import workflows.cli
import workflows.definitions.spec_workflow
print('✅ All imports successful')
"

# Test CLI interface
python -m workflows.cli --help

# Test compatibility wrapper
python scripts/spec_workflow_automation_compat.py --help
```

### Configuration Migration Issues

#### Problem: Old configuration not properly migrated

**Manual Migration Steps:**
```bash
# Backup old configuration
cp ecosystem.config.js ecosystem.config.js.backup

# Regenerate configuration
python scripts/migrate_to_workflows.py --migrate-pm2

# Validate new configuration
node -c ecosystem.config.js
```

## Performance Problems

### Slow Workflow Execution

#### Problem: Workflows taking longer than expected

**Diagnostic Steps:**

1. **Profile Execution Time:**
```bash
time python -m workflows.cli spec --spec-name "test" --project .
```

2. **Check Resource Usage:**
```bash
# Monitor during execution
top -p $(pgrep -f "workflows.cli")
```

3. **Analyze Bottlenecks:**
```bash
# Enable timing debug
python -m workflows.cli spec \
  --spec-name "test" \
  --project . \
  --debug-metadata \
  --session-log timing.jsonl

# Analyze timing data
jq 'select(.timestamp) | {event: .event, time: .timestamp}' timing.jsonl
```

**Common Performance Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| Long session startup | Claude Code cold start | Implement session pooling |
| Slow completion detection | Complex pattern matching | Optimize completion patterns |
| Memory usage growth | Debug logging accumulation | Reduce debug verbosity |
| Frequent tool calls | Inefficient workflow prompts | Optimize prompt instructions |

### Memory Usage Issues

#### Problem: High memory consumption

**Monitoring:**
```bash
# Monitor memory usage
ps aux | grep workflows.cli
cat /proc/$(pgrep workflows.cli)/status | grep VmRSS
```

**Solutions:**
```bash
# Reduce content size limits
python -m workflows.cli spec \
  --spec-name "test" \
  --project . \
  --max-content 200 \
  --debug-tools

# Disable verbose debug modes
# Remove --debug-all, --debug-raw options
```

## Integration Issues

### MCP Tool Integration

#### Problem: MCP tools not working correctly

**Diagnostic Steps:**
```bash
# Check if MCP tools are available
python -c "
import sys
sys.path.append('.')
try:
    # Test importing MCP-related modules
    print('Testing MCP integration...')
    # Add your specific MCP tool tests here
    print('✅ MCP tools available')
except Exception as e:
    print(f'❌ MCP tools error: {e}')
"
```

### External Tool Integration

#### Problem: External tools (npm, pytest, etc.) not working

**Diagnostic Steps:**
```bash
# Test external tools directly
npm --version
pytest --version
npx tsc --version

# Check PATH in workflow environment
python -c "import os; print(os.environ.get('PATH', 'PATH not set'))"
```

## Recovery Procedures

### Emergency Rollback

If the new workflow system is completely broken:

```bash
# 1. Stop all processes
pm2 stop all

# 2. Restore from backup
if [ -d migration_backup/backup_* ]; then
    latest_backup=$(ls -td migration_backup/backup_* | head -1)
    echo "Restoring from: $latest_backup"

    # Restore ecosystem config
    cp "$latest_backup/ecosystem.config.js" . 2>/dev/null || echo "No ecosystem backup"

    # Restore scripts
    cp -r "$latest_backup/scripts/"* scripts/ 2>/dev/null || echo "No scripts backup"
fi

# 3. Restart with old system
pm2 start ecosystem.config.js
```

### Partial Recovery

If only specific workflows are broken:

```bash
# 1. Identify working workflows
python -m workflows.cli --help

# 2. Test individual workflow types
python -m workflows.cli spec --spec-name "test" --project . --debug-tools

# 3. Use compatibility wrapper for broken workflows
python scripts/spec_workflow_automation_compat.py --help
```

### Clean Reinstall

For complete system reset:

```bash
# 1. Backup current state
python scripts/migrate_to_workflows.py --create-backup

# 2. Remove workflow system
rm -rf workflows/

# 3. Reinstall from clean source
git checkout workflows/

# 4. Reconfigure
python scripts/migrate_to_workflows.py --full-migration
```

## Getting Additional Help

### Collecting Diagnostic Information

Before seeking help, collect this information:

```bash
# System information
python --version
pip list | grep -E "(claude|workflow)"
uname -a

# Workflow system status
python -m workflows.cli --help
python scripts/migrate_to_workflows.py --validate

# Recent logs
tail -50 logs/workflow_session.log
tail -50 logs/pm2-*.log

# Configuration
cat workflows.yaml 2>/dev/null || echo "No workflows.yaml"
cat ecosystem.config.js | grep -v "password\|token\|key"
```

### Reporting Issues

When reporting issues, include:

1. **Error Description**: What were you trying to do?
2. **Error Messages**: Full error text and stack traces
3. **System Information**: OS, Python version, workflow system version
4. **Configuration**: Sanitized configuration files
5. **Logs**: Relevant log excerpts (with sensitive data removed)
6. **Reproduction Steps**: Exact commands to reproduce the issue

### Support Resources

1. **Documentation**: Check `workflows/README.md` and `workflows/EXTENDING.md`
2. **Migration Guide**: See `MIGRATION_GUIDE.md` for migration-specific issues
3. **Validation Tool**: Use `python scripts/migrate_to_workflows.py --validate`
4. **Debug Mode**: Always try with `--debug-all --verbose` first

---

*For complex issues, consider running the workflow system in a clean environment to isolate configuration or environment-specific problems.*