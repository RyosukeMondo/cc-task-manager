# Parallel Development System - Guide for Claude Code CLI

This document provides comprehensive instructions for Claude Code CLI on how to set up and use the parallel development automation system.

## Quick Start: Which Approach?

```
┌─────────────────────────────────────────────────────────┐
│ What are you trying to do?                              │
└─────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│ Develop multiple │          │ Automate work in │
│ specs within ONE │          │ a DIFFERENT      │
│ project?         │          │ project?         │
└──────────────────┘          └──────────────────┘
        │                             │
        ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│ SINGLE-PROJECT   │          │ CROSS-PROJECT    │
│                  │          │                  │
│ Use:             │          │ Use:             │
│ • parallel.yaml  │          │ • config.js      │
│ • parallel_dev.js│          │ • generate-      │
│                  │          │   ecosystem.js   │
│ Example:         │          │                  │
│ cc-task-manager  │          │ Example:         │
│ developing its   │          │ cc-task-manager  │
│ own 5 specs      │          │ → mind-training  │
└──────────────────┘          └──────────────────┘
```

**This guide covers BOTH approaches.**

---

## Architecture Overview

### Host/Guest Project Model

The parallel development system uses a **HOST/GUEST architecture**:

```
┌─────────────────────────────────────────────────────────┐
│  HOST PROJECT (cc-task-manager)                         │
│  • Contains automation scripts                          │
│  • Runs Python automation (.venv with claude-code-sdk) │
│  • Manages PM2 processes                                │
│  • Configuration: scripts/config.js                     │
│  • Logs: logs/                                          │
└─────────────────────────────────────────────────────────┘
                       │
                       │ automates
                       ↓
┌─────────────────────────────────────────────────────────┐
│  GUEST PROJECT (e.g., mind-training)                    │
│  • Contains spec files (.spec-workflow/specs/)          │
│  • Contains worktrees (worktree/spec-name/)            │
│  • NO .venv needed                                      │
│  • NO scripts needed                                    │
│  • NO parallel.yaml needed                              │
└─────────────────────────────────────────────────────────┘
```

**Key Principle:**
- **HOST** = Automation runner (needs Python environment)
- **GUEST** = Code being automated (just needs worktrees)

---

## Critical Setup Requirements

### 1. Python Dependencies (CRITICAL - Most Common Failure Point)

**Required packages IN HOST PROJECT ONLY:**
- `claude-code-sdk>=0.0.25` - **MANDATORY** for automation
- `anthropic>=0.69.0` - Claude AI SDK
- `pyyaml>=6.0.1` - For reading YAML configs

**Error if missing:**
```
ERROR - Failed to receive ready event from Claude
ERROR - Failed to start Claude session
```

**Setup commands (HOST project only):**
```bash
# In the cc-task-manager directory (HOST)
cd /home/rmondo/repos/cc-task-manager
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Verify installation
.venv/bin/python3 -c "import claude_code_sdk; print('OK')"
```

**IMPORTANT:** Guest projects do NOT need .venv or Python packages!

---

### 2. Configuration Files

#### For Single-Project Parallel Development (parallel.yaml)
**Use Case:** Developing multiple specs within ONE project (e.g., cc-task-manager itself)

**Location:** `/home/rmondo/repos/cc-task-manager/parallel.yaml`

**Critical settings:**
```yaml
base:
  # MUST be absolute paths
  project_root: /absolute/path/to/project
  worktree_dir: /absolute/path/to/project/worktree

  # Python venv in HOST project
  python_venv: .venv/bin/python3
```

**Usage:**
```bash
node scripts/parallel_dev.js
```

#### For Cross-Project Automation (config.js)
**Use Case:** HOST project automates GUEST projects (e.g., cc-task-manager → mind-training)

**Location:** `/home/rmondo/repos/cc-task-manager/scripts/config.js`

**Add guest project specs:**
```javascript
projects: [
  // ... existing cc-task-manager specs ...

  // Guest project specs (relative to baseCwd)
  ,{
    available: true,
    name: 'mind-session-flow',
    path: '../mind-training/worktree/session-flow-foundation',
    spec: 'session-flow-foundation'
  }
]
```

**Usage:**
```bash
node scripts/generate-ecosystem.js
pm2 delete all
pm2 start ecosystem.config.js
```

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

**HOST Project (cc-task-manager):**
```
cc-task-manager/                        # HOST - Automation runner
├── .venv/                              # ✓ Python with claude-code-sdk
├── requirements.txt                    # ✓ Python dependencies
├── scripts/
│   ├── config.js                       # ✓ SSOT for all projects
│   ├── parallel_dev.js                 # Single-project setup
│   ├── generate-ecosystem.js           # ✓ PM2 config generator
│   ├── remote-automation.sh            # PM2 wrapper
│   └── spec_workflow_automation.py     # ✓ Automation script
├── logs/                               # ✓ All automation logs
├── ecosystem.config.js                 # ✓ Generated PM2 config
├── parallel.yaml (optional)            # For single-project use
└── worktree/ (optional)                # For cc-task-manager's own specs

```

**GUEST Project (e.g., mind-training):**
```
mind-training/                          # GUEST - Just code + specs
├── .spec-workflow/
│   └── specs/
│       └── session-flow-foundation/    # ✓ Spec files
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
├── worktree/                           # ✓ Git worktrees
│   ├── .gitignore                      # * and !.gitignore
│   └── session-flow-foundation/        # ✓ Feature branch
│       ├── apps/
│       └── ...
├── ❌ NO .venv                         # Not needed!
├── ❌ NO scripts/                      # Not needed!
└── ❌ NO parallel.yaml                 # Not needed!
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

## Cross-Project Automation Setup (HOST → GUEST)

### Complete Example: cc-task-manager → mind-training

This is the **recommended approach** for automating specs across multiple projects.

#### Step 1: Prepare GUEST Project (mind-training)

```bash
cd /home/rmondo/repos/mind-training

# 1. Ensure worktree directory exists with .gitignore
mkdir -p worktree
echo "*" > worktree/.gitignore
echo "!.gitignore" >> worktree/.gitignore

# 2. Create worktree for spec (if not already created)
git worktree add -b feature/session-flow-foundation \
  worktree/session-flow-foundation main

# 3. Ensure spec files exist
ls .spec-workflow/specs/session-flow-foundation/
# Should contain: requirements.md, design.md, tasks.md
```

**IMPORTANT:** NO .venv, NO scripts, NO parallel.yaml needed in guest project!

#### Step 2: Configure HOST Project (cc-task-manager)

```bash
cd /home/rmondo/repos/cc-task-manager

# 1. Ensure Python dependencies installed
.venv/bin/python3 -c "import claude_code_sdk; print('OK')"
# If fails: pip install -r requirements.txt

# 2. Edit scripts/config.js - add guest project spec
```

Add to `scripts/config.js`:
```javascript
projects: [
  // ... existing specs ...

  // Guest project: mind-training
  ,{
    available: true,
    name: 'mind-session-flow',  // Unique name
    path: '../mind-training/worktree/session-flow-foundation',  // Relative to baseCwd
    spec: 'session-flow-foundation'  // Matches spec folder name
  }
]
```

#### Step 3: Generate and Start Automation

```bash
cd /home/rmondo/repos/cc-task-manager

# Generate PM2 config from config.js
node scripts/generate-ecosystem.js

# Delete old processes (MUST do this!)
pm2 delete all

# Start all processes
pm2 start ecosystem.config.js

# Or start only the mind-training spec
pm2 start ecosystem.config.js --only \
  spec-workflow-automation-mind-session-flow,\
  spec-workflow-dashboard-mind-session-flow
```

#### Step 4: Monitor Automation

```bash
# View logs
pm2 logs spec-workflow-automation-mind-session-flow

# Check process status
pm2 list | grep mind-session

# View dashboard
# Dashboard port = dashboardPortBase + index in projects array
# Check: http://localhost:3418 (or appropriate port)
```

#### Step 5: Check Results in Guest Project

```bash
cd /home/rmondo/repos/mind-training/worktree/session-flow-foundation

# View git status
git status

# See commits made by automation
git log --oneline -5

# Check tasks progress
cat .spec-workflow/specs/session-flow-foundation/tasks.md
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

### Quick Decision Tree

When asked to set up parallel development:

1. **First:** Determine approach (single-project vs cross-project)
2. **Second:** Check HOST project has Python dependencies
3. **Third:** Configure appropriately (parallel.yaml OR config.js)
4. **Fourth:** Generate and start PM2 processes
5. **Fifth:** Monitor and verify

### Common Troubleshooting Checklist

1. **Python dependencies (HOST only):** Is `claude-code-sdk` installed in HOST's `.venv`?
2. **Cross-project path:** Is guest project path relative to HOST's baseCwd?
3. **PM2 cache:** After config changes, did user run `pm2 delete all` before `pm2 start`?
4. **Worktree setup:** Does worktree directory exist with proper `.gitignore`?
5. **Guest project:** Does guest have .venv or scripts? (Should NOT have them!)

These cover 95% of setup issues.

---

## Quick Reference Table

| Aspect | Single-Project | Cross-Project (HOST → GUEST) |
|--------|---------------|------------------------------|
| **Use Case** | Develop multiple specs in ONE project | Automate work in DIFFERENT project |
| **Configuration File** | `parallel.yaml` | `scripts/config.js` |
| **Setup Script** | `node scripts/parallel_dev.js` | `node scripts/generate-ecosystem.js` |
| **Python venv** | In project root | In HOST only |
| **Guest needs .venv?** | N/A (same project) | ❌ NO |
| **Guest needs scripts?** | N/A (same project) | ❌ NO |
| **Guest needs parallel.yaml?** | N/A (same project) | ❌ NO |
| **Example** | cc-task-manager developing its own specs | cc-task-manager → mind-training |
| **Logs Location** | `logs/` in project root | `logs/` in HOST project |
| **Dashboard Ports** | From `dashboard_port_base` in parallel.yaml | From `dashboardPortBase` in config.js |
| **PM2 Process Names** | `spec-workflow-automation-{spec}` | `spec-workflow-automation-{name}` |

---
