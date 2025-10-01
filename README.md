# CC Task Manager - Parallel Development System

Automated parallel development system for managing multiple feature specifications simultaneously using Claude Code CLI, PM2, and git worktrees.

## Quick Start

### 1. Python Environment Setup

**CRITICAL:** The automation system requires Python packages that are not installed by default.

```bash
# Create Python virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # On Linux/Mac
# or
.venv\Scripts\activate     # On Windows

# Install required dependencies
pip install -r requirements.txt
```

### Required Python Dependencies

- **`claude-code-sdk>=0.0.25`** - **MANDATORY** for automation to work
  - Without this package, automation will fail with cryptic error: "Failed to receive ready event from Claude"
- **`anthropic>=0.69.0`** - Claude AI SDK

### 2. Configuration Setup

```bash
# Copy configuration template
cp parallel.yaml.example parallel.yaml

# Edit parallel.yaml
# - Set project_root to absolute path of target project
# - Set worktree_dir to absolute path where worktrees should be created
# - Set available: true for specs you want to develop
```

**Important:** Use absolute paths for `project_root` and `worktree_dir` to avoid worktrees being created in the wrong location.

### 3. Run Parallel Development

```bash
# Full setup and start automation
node scripts/parallel_dev.js

# Preview what would happen (dry run)
node scripts/parallel_dev.js --dry-run

# Setup worktrees and MCP servers only (no PM2 start)
node scripts/parallel_dev.js --setup-only
```

## System Overview

This system automates parallel development of multiple features by:

1. Creating isolated git worktrees for each specification
2. Installing required MCP servers in each worktree
3. Generating PM2 configuration for parallel automation
4. Running Claude Code CLI automation for each spec
5. Providing web dashboards to monitor progress

## Architecture

```
cc-task-manager/
├── .venv/                      # Python environment (REQUIRED)
│   └── bin/python3            # Used by automation scripts
├── requirements.txt           # Python dependencies (CRITICAL)
├── parallel.yaml              # Your configuration (git-ignored)
├── parallel.yaml.example      # Configuration template
├── worktree/                  # Git worktrees directory
│   ├── .gitignore            # Prevents committing worktree contents
│   ├── spec-name-1/          # Feature branch worktree
│   └── spec-name-2/
├── scripts/
│   ├── parallel_dev.js        # Main orchestration script
│   ├── parallel_how_to.md     # Detailed guide for Claude Code CLI
│   ├── generate-ecosystem.js  # PM2 config generator
│   ├── remote-automation.sh   # PM2 wrapper script
│   └── claude_wrapper.py      # Python automation script
├── logs/                      # Automation logs (JSONL format)
└── ecosystem.config.js        # Generated PM2 configuration
```

## Configuration

### parallel.yaml Structure

```yaml
base:
  # IMPORTANT: Use absolute paths
  project_root: /absolute/path/to/project
  worktree_dir: /absolute/path/to/project/worktree
  base_branch: main
  python_venv: .venv/bin/python3
  dashboard_port_base: 3412

specifications:
  - name: feature-name
    description: Feature description
    available: true  # Set to true to activate
    priority: 1
    spec_file: feature-name
    mcp_servers:
      - context7
      - serena
      - spec-workflow

mcp_servers:
  - name: context7
    command: npx @upstash/context7-mcp@latest
    required: true
  # ... more servers ...
```

## Common Commands

### Setup and Management
```bash
# Setup everything and start PM2
node scripts/parallel_dev.js

# Preview changes without executing
node scripts/parallel_dev.js --dry-run

# Setup worktrees only (no PM2)
node scripts/parallel_dev.js --setup-only

# Verify PM2 processes are running
node scripts/parallel_dev.js --verify-only

# Clean up all worktrees
node scripts/parallel_dev.js --cleanup
```

### PM2 Process Management
```bash
# Start all processes
./scripts/remote-automation.sh start

# Stop all processes
./scripts/remote-automation.sh stop

# Delete all processes
./scripts/remote-automation.sh delete

# View logs for specific spec
./scripts/remote-automation.sh logs spec-name

# List all processes
pm2 list

# Monitor processes in real-time
pm2 monit
```

### Git Worktree Management
```bash
# List all worktrees
git worktree list

# Manually remove a worktree
git worktree remove worktree/spec-name

# Clean up deleted worktrees
git worktree prune
```

## Troubleshooting

### Error: "Failed to receive ready event from Claude"

**Cause:** `claude-code-sdk` Python package not installed

**Solution:**
```bash
cd /home/rmondo/repos/cc-task-manager
source .venv/bin/activate
pip install -r requirements.txt
```

The system now validates this automatically before starting (Phase 0).

### Error: "Worktrees created in wrong location"

**Cause:** `worktree_dir` in `parallel.yaml` uses relative path

**Solution:** Update `parallel.yaml` to use absolute path:
```yaml
base:
  worktree_dir: /absolute/path/to/project/worktree
```

### PM2 Not Picking Up Configuration Changes

**Cause:** PM2 caches configuration

**Solution:** After changing `parallel.yaml` or `generate-ecosystem.js`:
```bash
pm2 delete all
pm2 start ecosystem.config.js
```

**Important:** `pm2 restart` will NOT pick up configuration changes. You MUST use `pm2 delete all` first.

### Error: "Python venv not found"

**Cause:** Virtual environment not created

**Solution:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Validation

The system now automatically validates critical dependencies before starting:

- ✓ Python virtual environment exists
- ✓ `claude-code-sdk` is installed
- ✓ `anthropic` is installed
- ✓ Configuration file exists
- ✓ Paths are properly configured

If validation fails, clear error messages with installation instructions are provided.

## Dashboard Access

Each specification gets a web dashboard on a sequential port:

- First spec: http://localhost:3412
- Second spec: http://localhost:3413
- Third spec: http://localhost:3414
- etc.

Base port is configured in `parallel.yaml`: `base.dashboard_port_base`

## Automation Behavior

Each spec automation:

- Reads requirements from `specs/{spec-name}/requirements.md`
- Starts Claude Code session with configured MCP servers
- Sends spec requirements as initial prompt
- Monitors progress and logs all interactions
- Stops after completion or timeout (default: 50 cycles or 30 minutes)
- Logs written to `logs/spec-workflow-{spec-name}.jsonl`

## Best Practices

1. **Always use absolute paths** in `parallel.yaml` for `project_root` and `worktree_dir`
2. **Install Python dependencies first** - automation won't work without `claude-code-sdk`
3. **Use `pm2 delete all` before `pm2 start`** when configuration changes
4. **Commit `worktree/.gitignore`** to prevent accidentally committing worktree contents
5. **Keep `parallel.yaml` git-ignored** to avoid conflicts
6. **Monitor logs** during automation to catch issues early

## Development Workflow

1. Create specification in `specs/{spec-name}/requirements.md`
2. Add spec to `parallel.yaml` with `available: false`
3. Test spec manually first
4. Set `available: true` in `parallel.yaml` when ready
5. Run `node scripts/parallel_dev.js`
6. Monitor progress via dashboard or logs
7. Review completed work in feature branch
8. Merge feature branch to main when satisfied
9. Set `available: false` in `parallel.yaml`

## Additional Documentation

- **`scripts/parallel_how_to.md`** - Comprehensive guide for Claude Code CLI with detailed troubleshooting and workflow information

## Requirements

- Node.js (for PM2 and scripts)
- Python 3.x (for automation)
- Git (for worktrees)
- PM2 (installed via npm)

## License

[Your License]
