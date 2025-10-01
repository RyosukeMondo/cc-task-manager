# Parallel Development System - Guide for Claude Code CLI

This document provides comprehensive instructions for Claude Code CLI on how to set up and use the parallel development automation system.

## Critical Setup Requirements

### 1. Python Dependencies (CRITICAL - Most Common Failure Point)

**Required packages:**
- `claude-code-sdk>=0.0.25` - **MANDATORY** for automation
- `anthropic>=0.69.0` - Claude AI SDK

**Error if missing:**
```
ERROR - Failed to receive ready event from Claude
ERROR - Failed to start Claude session
```

**Setup commands:**
```bash
# In the cc-task-manager directory
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Validation:**
The script `scripts/parallel_dev.js` now automatically validates these dependencies before starting.

---

### 2. Configuration Files

#### parallel.yaml
**Location:** `/home/rmondo/repos/cc-task-manager/parallel.yaml`

**Critical settings:**
```yaml
base:
  # MUST be absolute paths
  project_root: /absolute/path/to/project
  worktree_dir: /absolute/path/to/project/worktree

  # Python venv path (relative to project_root)
  python_venv: .venv/bin/python3
```

**Important notes:**
- `worktree_dir` MUST be an absolute path or worktrees will be created in wrong location
- The automation script uses `cc-task-manager/.venv/bin/python3` for its own operations
- Each target project should have its own venv as specified in `python_venv`

---

### 3. PM2 Configuration Changes

**CRITICAL:** PM2 caches configuration. After any changes to:
- `parallel.yaml`
- `scripts/generate-ecosystem.js`
- Python paths
- Environment variables

You MUST run:
```bash
pm2 delete all
pm2 start ecosystem.config.js
```

**DO NOT use `pm2 restart` - it will NOT pick up configuration changes!**

---

## System Architecture

### Directory Structure
```
cc-task-manager/
├── .venv/                          # Python venv for automation scripts
├── requirements.txt                # Python dependencies (CRITICAL)
├── parallel.yaml                   # Configuration (git-ignored)
├── parallel.yaml.example           # Template
├── worktree/                       # Git worktrees (git-ignored)
│   └── .gitignore                  # Contains: * and !.gitignore
├── scripts/
│   ├── parallel_dev.js             # Main orchestration script
│   ├── generate-ecosystem.js       # PM2 config generator
│   ├── remote-automation.sh        # PM2 wrapper
│   └── claude_wrapper.py           # Python automation script
└── logs/                           # Automation logs

target-project/
├── .venv/                          # Project-specific Python venv
└── worktree/                       # Worktrees for this project
    ├── spec-name-1/                # Feature branch worktree
    └── spec-name-2/
```

---

## Workflow Phases

### Phase 0: Python Dependency Validation
**Added to scripts/parallel_dev.js**

Checks:
1. Python venv exists at `project_root/.venv/bin/python3`
2. `claude-code-sdk` is installed
3. `anthropic` is installed

**Errors provide clear installation instructions**

---

### Phase 1: Worktree Setup
Creates git worktrees for each `available: true` spec:
```bash
git worktree add -b feature/spec-name worktree/spec-name main
```

**Location determined by:** `base.worktree_dir` (must be absolute path)

---

### Phase 2: MCP Server Installation
For each spec, installs configured MCP servers in the worktree:
```bash
cd worktree/spec-name
npx @upstash/context7-mcp@latest
uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd) --enable-web-dashboard false
# ... etc
```

---

### Phase 3: Update config.js
Updates `scripts/config.js` in main branch with availability flags from `parallel.yaml`

---

### Phase 4: Generate PM2 Config
Runs `scripts/generate-ecosystem.js` to create `ecosystem.config.js`

**Python path resolution:**
- Automation script: Always uses `cc-task-manager/.venv/bin/python3`
- Target project: Uses path from `parallel.yaml` (for future use)

---

### Phase 5: Start PM2 Processes
```bash
pm2 delete all  # MUST delete, not restart
pm2 start ecosystem.config.js
```

Creates for each spec:
- `spec-workflow-automation-{spec-name}` - Runs automation
- `spec-workflow-dashboard-{spec-name}` - Web dashboard (port 3412+)

---

### Phase 6: Verification
Checks all expected PM2 processes are online:
```bash
pm2 jlist
```

---

## Common Issues and Solutions

### Issue 1: "Failed to receive ready event from Claude"
**Root Cause:** `claude-code-sdk` not installed

**Solution:**
```bash
cd /home/rmondo/repos/cc-task-manager
source .venv/bin/activate
pip install -r requirements.txt
```

**Prevention:** Script now validates before starting (Phase 0)

---

### Issue 2: Worktrees Created in Wrong Location
**Root Cause:** `worktree_dir` in `parallel.yaml` is relative path

**Solution:** Use absolute path:
```yaml
base:
  worktree_dir: /home/rmondo/repos/target-project/worktree
```

---

### Issue 3: PM2 Not Picking Up Config Changes
**Root Cause:** PM2 caches configuration

**Solution:**
```bash
pm2 delete all
pm2 start ecosystem.config.js
```

**Never use:** `pm2 restart` after config changes

---

### Issue 4: Python venv Not Found
**Root Cause:** Venv not created in project directory

**Solution:**
```bash
cd /path/to/project
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Files Created/Modified

### NEW FILES
1. **requirements.txt** - Python dependencies
2. **scripts/parallel_how_to.md** - This document

### MODIFIED FILES
1. **scripts/parallel_dev.js**
   - Added `validatePythonDependencies()` method
   - Validates `claude-code-sdk` and `anthropic` installation
   - Provides clear error messages with installation instructions
   - Runs as Phase 0 before any other operations

2. **parallel.yaml.example**
   - Updated `worktree_dir` to use absolute path
   - Added comments about path requirements

3. **README.md**
   - Added Python setup instructions
   - Documented `requirements.txt`
   - Explained `claude-code-sdk` requirement

---

## Usage Examples

### Example 1: First Time Setup
```bash
# Clone repository
git clone <repo-url> cc-task-manager
cd cc-task-manager

# Setup Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create configuration
cp parallel.yaml.example parallel.yaml
# Edit parallel.yaml - set project_root and worktree_dir to absolute paths

# Mark specs as available
# Edit parallel.yaml - set available: true for desired specs

# Run setup
node scripts/parallel_dev.js
```

---

### Example 2: Add New Spec to Parallel Development
```bash
# Edit parallel.yaml
# Change available: false to available: true for the spec

# Run setup
node scripts/parallel_dev.js

# PM2 will automatically create worktree and start automation
```

---

### Example 3: Troubleshooting Setup Issues
```bash
# Preview what would happen (no changes made)
node scripts/parallel_dev.js --dry-run

# Validate Python dependencies are installed
node scripts/parallel_dev.js
# (Will fail fast if claude-code-sdk not installed)

# Check PM2 processes
pm2 list
pm2 logs spec-workflow-automation-spec-name

# View automation session logs
cat logs/spec-workflow-spec-name.jsonl | jq .
```

---

### Example 4: Update Configuration
```bash
# Edit parallel.yaml or scripts/generate-ecosystem.js
# Make your changes

# MUST delete and restart (not just restart!)
pm2 delete all
pm2 start ecosystem.config.js

# Verify
pm2 list
```

---

### Example 5: Clean Up All Worktrees
```bash
# Remove all worktrees
node scripts/parallel_dev.js --cleanup

# Stop all PM2 processes
./scripts/remote-automation.sh delete
```

---

## Automation Script Behavior

### scripts/claude_wrapper.py
**Python path:** Always uses `cc-task-manager/.venv/bin/python3`

**Requirements:**
- `claude-code-sdk>=0.0.25` - **CRITICAL**
- `anthropic>=0.69.0`

**Configuration:**
- `MAX_CYCLES` - Default: 50 cycles per session
- `MAX_SESSION_TIME` - Default: 1800 seconds (30 minutes)
- Session logs: `logs/spec-workflow-{spec-name}.jsonl`

**Process flow:**
1. Load spec file from `specs/{spec-name}/requirements.md`
2. Start Claude Code session with MCP servers
3. Send spec requirements as initial prompt
4. Wait for ready event (fails if `claude-code-sdk` not installed)
5. Monitor for completion or timeout
6. Log all interactions to JSONL file
7. Exit when complete or max cycles/time reached

---

## Dashboard Access

Each spec gets a dashboard on sequential ports:
- Spec 1: http://localhost:3412
- Spec 2: http://localhost:3413
- Spec 3: http://localhost:3414
- etc.

Base port configured in `parallel.yaml`: `base.dashboard_port_base`

---

## Best Practices

1. **Always use absolute paths** in `parallel.yaml` for `project_root` and `worktree_dir`

2. **Validate Python setup** before running parallel development:
   ```bash
   .venv/bin/python3 -c "import claude_code_sdk; print('OK')"
   ```

3. **After config changes**, always use `pm2 delete all` before `pm2 start`

4. **Monitor logs** during automation:
   ```bash
   pm2 logs spec-workflow-automation-spec-name
   # or
   tail -f logs/spec-workflow-spec-name.jsonl | jq .
   ```

5. **Commit worktree/.gitignore** to repository:
   ```
   *
   !.gitignore
   ```

6. **Keep parallel.yaml git-ignored** to avoid conflicts

7. **Use --dry-run** to preview changes before executing

---

## Quick Reference Commands

```bash
# Setup
node scripts/parallel_dev.js                 # Full setup and start
node scripts/parallel_dev.js --dry-run       # Preview only
node scripts/parallel_dev.js --setup-only    # Setup without PM2

# Management
./scripts/remote-automation.sh start         # Start PM2 processes
./scripts/remote-automation.sh stop          # Stop all
./scripts/remote-automation.sh delete        # Delete all
./scripts/remote-automation.sh logs <spec>   # View logs

# Verification
node scripts/parallel_dev.js --verify-only   # Check processes
pm2 list                                     # List all processes
pm2 monit                                    # Real-time monitor

# Cleanup
node scripts/parallel_dev.js --cleanup       # Remove worktrees
git worktree list                            # List worktrees
git worktree prune                           # Clean deleted worktrees
```

---

## Error Messages You Might See

### "Failed to receive ready event from Claude"
→ `claude-code-sdk` not installed. Run: `pip install claude-code-sdk>=0.0.25`

### "Python venv not found"
→ Create venv: `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`

### "Worktree already exists"
→ Safe to ignore - worktree already set up from previous run

### PM2 process shows "errored" status
→ Check logs: `pm2 logs <process-name>`
→ Common cause: Python dependency missing

### "parallel.yaml not found"
→ Copy template: `cp parallel.yaml.example parallel.yaml`

---

## Summary for Claude Code CLI

When asked to set up or troubleshoot parallel development:

1. **First check:** Is `claude-code-sdk` installed in `.venv`?
2. **Second check:** Are paths in `parallel.yaml` absolute?
3. **Third check:** After config changes, did user run `pm2 delete all` before `pm2 start`?
4. **Fourth check:** Does worktree directory exist and have correct `.gitignore`?
5. **Fifth check:** Are MCP servers installing correctly in worktrees?

These cover 95% of setup issues.
