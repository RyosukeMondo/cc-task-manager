# Parallel Development Workflow

This document explains how to use the parallel development system to work on multiple specifications simultaneously.

## Overview

The parallel development system allows you to:
- Work on multiple specs concurrently in isolated git worktrees
- Each spec gets its own feature branch, MCP servers, and PM2 automation
- Avoid git conflicts by using a local, git-ignored configuration file

## Quick Start

### First Time Setup

1. **Copy the template configuration:**
   ```bash
   cp parallel.yaml.example parallel.yaml
   ```

2. **Edit `parallel.yaml` to activate specs:**
   ```yaml
   specifications:
     - name: analytics-performance-page
       available: true  # 👈 Set to true
       # ...
   ```

3. **Run the setup script:**
   ```bash
   node scripts/parallel_dev.js
   ```

## Configuration

### File Structure

- **`parallel.yaml.example`** - Template with all available options (tracked in git)
- **`parallel.yaml`** - Your active configuration (git-ignored, user-specific)

### Why This Approach?

- ✅ No git conflicts from daily availability changes
- ✅ Each developer can work on different specs independently
- ✅ Template stays updated with new specs and options
- ✅ Your local config persists across git operations

## Common Workflows

### Activate a Single Spec

Edit `parallel.yaml`:
```yaml
specifications:
  - name: analytics-performance-page
    available: true
    # ...
```

Run:
```bash
node scripts/parallel_dev.js
```

### Activate Multiple Specs

Edit `parallel.yaml`:
```yaml
specifications:
  - name: analytics-performance-page
    available: true
  - name: analytics-trends-page
    available: true
  - name: settings-page
    available: true
```

Run:
```bash
node scripts/parallel_dev.js
```

### Preview Changes (Dry Run)

```bash
node scripts/parallel_dev.js --dry-run
```

### Setup Without Starting PM2

```bash
node scripts/parallel_dev.js --setup-only
```

### Verify Running Processes

```bash
node scripts/parallel_dev.js --verify-only
```

### Cleanup All Worktrees

```bash
node scripts/parallel_dev.js --cleanup
```

## What Gets Created

For each available spec, the system creates:

1. **Git Worktree**: `worktree/<spec-name>/`
2. **Feature Branch**: `feature/<spec-name>`
3. **MCP Servers**: Installed in the worktree
4. **PM2 Processes**:
   - `spec-workflow-automation-<spec-name>` - Automation process
   - `spec-workflow-dashboard-<spec-name>` - Dashboard server

## Managing Your Work

### View Dashboards

Dashboards start at port 3412:
- Spec 1: http://localhost:3412
- Spec 2: http://localhost:3413
- Spec 3: http://localhost:3414
- etc.

### Check Logs

```bash
./scripts/remote-automation.sh logs <spec-name>
```

### Monitor All Processes

```bash
pm2 monit
```

### Stop All Processes

```bash
./scripts/remote-automation.sh stop
```

### Delete All Processes

```bash
./scripts/remote-automation.sh delete
```

## Updating Your Configuration

### Adding New Specs

1. Check `parallel.yaml.example` for new specs
2. Copy the spec definition to your `parallel.yaml`
3. Set `available: true` if you want to work on it
4. Run `node scripts/parallel_dev.js`

### Deactivating Specs

1. Edit `parallel.yaml`
2. Set `available: false` for specs you're done with
3. Run `node scripts/parallel_dev.js`
4. The system will clean up those worktrees and processes

## Troubleshooting

### "parallel.yaml not found"

Run the first-time setup:
```bash
cp parallel.yaml.example parallel.yaml
```

### Worktree Already Exists

The script detects existing worktrees and skips creation. This is safe and expected.

### Process Not Starting

1. Check if the worktree exists: `git worktree list`
2. Verify the branch: `cd worktree/<spec-name> && git branch`
3. Check PM2 logs: `pm2 logs spec-workflow-automation-<spec-name>`

### MCP Server Installation Fails

- **Required servers** (context7, serena, spec-workflow) will cause setup to fail
- **Optional servers** (magicuidesign, playwright) failures are warnings only

## Best Practices

1. **Keep parallel.yaml local** - Never commit it, let each developer manage their own
2. **Update from template** - Periodically sync new options from `parallel.yaml.example`
3. **Clean up regularly** - Deactivate specs when done to free resources
4. **One task at a time** - While you *can* run many specs in parallel, focus on 1-3 for better productivity

## Architecture

```
project-root/
├── parallel.yaml.example    # Template (tracked)
├── parallel.yaml            # Your config (git-ignored)
├── worktree/                # Worktrees (git-ignored)
│   ├── spec-1/
│   ├── spec-2/
│   └── spec-3/
├── scripts/
│   ├── parallel_dev.js      # Main setup script
│   └── remote-automation.sh # PM2 management
└── logs/                    # Process logs (git-ignored)
```

## Command Reference

| Command | Description |
|---------|-------------|
| `node scripts/parallel_dev.js` | Full setup and start |
| `node scripts/parallel_dev.js --dry-run` | Preview changes |
| `node scripts/parallel_dev.js --setup-only` | Setup without PM2 |
| `node scripts/parallel_dev.js --verify-only` | Verify processes |
| `node scripts/parallel_dev.js --cleanup` | Remove worktrees |
| `./scripts/remote-automation.sh start` | Start PM2 |
| `./scripts/remote-automation.sh stop` | Stop PM2 |
| `./scripts/remote-automation.sh delete` | Delete PM2 |
| `./scripts/remote-automation.sh logs <spec>` | View logs |
