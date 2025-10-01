# Parallel Development Setup - SSOT

Comprehensive automation for parallel specification development with zero merge conflicts.

## 🎯 Overview

This system enables multiple developers to work on different specifications simultaneously:
- ✅ **Git Worktrees**: Isolated development environments per spec
- ✅ **Feature Branches**: Dedicated branch for each spec
- ✅ **MCP Servers**: Auto-configured AI assistance tools
- ✅ **PM2 Automation**: Automated development and dashboards
- ✅ **Zero Conflicts**: File ownership prevents merge conflicts

## 📁 Files

- `parallel.yaml` - **SSOT configuration** for all specs and settings
- `scripts/parallel_dev.js` - **Unified setup script** for complete automation

## 🚀 Quick Start

```bash
# Full setup (worktrees + MCP + PM2)
node scripts/parallel_dev.js

# Preview without changes
node scripts/parallel_dev.js --dry-run

# Setup only (no PM2 start)
node scripts/parallel_dev.js --setup-only

# Verify PM2 processes
node scripts/parallel_dev.js --verify-only

# Clean up all worktrees
node scripts/parallel_dev.js --cleanup
```

## 📋 What It Does

### Phase 1: Worktrees
- Creates `worktree/{spec-name}` for each available spec
- Creates/checks out `feature/{spec-name}` branch
- Reuses existing worktrees if already present

### Phase 2: MCP Servers
Installs configured MCP servers in each worktree:
- **context7**: Official library documentation
- **magicuidesign**: UI component generation
- **playwright**: Browser testing automation
- **serena**: Semantic code understanding
- **spec-workflow**: Specification management

### Phase 3: Config Update
- Updates `scripts/config.js` with availability flags
- Sets `available: true` for active specs
- Sets `available: false` for completed specs

### Phase 4: Ecosystem Generation
- Runs `scripts/generate-ecosystem.js`
- Generates PM2 configuration from config.js

### Phase 5: PM2 Start
- Stops existing PM2 processes
- Starts automation + dashboard for each spec
- Runs via `scripts/remote-automation.sh`

### Phase 6: Verification
- Lists all running PM2 processes
- Verifies expected processes are online
- Reports missing or failed processes

## ⚙️ Configuration

Edit `parallel.yaml` to manage specifications:

```yaml
specifications:
  - name: my-new-spec
    description: Description of the spec
    available: true        # Set to true to activate
    priority: 1           # Lower = setup first
    spec_file: my-new-spec
    mcp_servers:          # Which MCP servers to install
      - context7
      - serena
      - spec-workflow
```

## 📊 Monitoring

After setup, you can monitor progress:

```bash
# PM2 dashboard
pm2 monit

# View logs for specific spec
./scripts/remote-automation.sh logs task-creation-modal

# Check all processes
pm2 list

# View spec-workflow dashboards
# http://localhost:3412 - task-creation-modal
# http://localhost:3413 - task-detail-view
# http://localhost:3414 - queue-management-dashboard
# http://localhost:3415 - system-monitoring-dashboard
```

## 🔄 Workflow

1. **Add spec to parallel.yaml**
   ```yaml
   - name: new-feature
     available: true
     priority: 10
   ```

2. **Run setup**
   ```bash
   node scripts/parallel_dev.js
   ```

3. **Develop in worktree**
   ```bash
   cd worktree/new-feature
   # Work on tasks, AI assists via MCP servers
   ```

4. **Monitor automation**
   - Dashboard: http://localhost:{port}
   - Logs: `./scripts/remote-automation.sh logs new-feature`

5. **Complete and merge**
   ```bash
   cd worktree/new-feature
   git push origin feature/new-feature
   # Create PR, merge to main
   ```

6. **Mark as complete**
   ```yaml
   - name: new-feature
     available: false  # Change to false
   ```

7. **Re-run setup** (removes from active automation)
   ```bash
   node scripts/parallel_dev.js
   ```

## 🛠️ Troubleshooting

### Worktree Issues

```bash
# List all worktrees
git worktree list

# Remove specific worktree
git worktree remove worktree/spec-name

# Clean up deleted worktrees
git worktree prune
```

### MCP Server Issues

```bash
# Check MCP servers in worktree
cd worktree/spec-name
claude mcp list

# Re-add MCP server
claude mcp add server-name [command]
```

### PM2 Issues

```bash
# View all processes
pm2 list

# Restart specific process
pm2 restart spec-workflow-automation-task-creation-modal

# View logs
pm2 logs spec-workflow-automation-task-creation-modal

# Stop all
pm2 stop all

# Delete all and restart
pm2 delete all
node scripts/parallel_dev.js
```

### Clean Slate

```bash
# Remove all worktrees
node scripts/parallel_dev.js --cleanup

# Stop all PM2 processes
pm2 delete all

# Start fresh
node scripts/parallel_dev.js
```

## 📖 Architecture

### File Ownership
Each spec owns specific files to prevent conflicts:

| Spec Type | Owned Files | Shared Files |
|-----------|-------------|--------------|
| Backend API | `apps/backend/src/{module}/**/*` | `schema.prisma` (append only) |
| Frontend Page | `apps/frontend/src/app/{page}/**/*` | `Navigation.tsx` (append only) |
| Frontend Component | `apps/frontend/src/components/{name}/**/*` | `contract-client.ts` (append only) |

### Shared File Strategy
Shared files use section comments:

```typescript
// ========== Spec: task-creation-modal ==========
export const createTask = () => { ... }

// ========== Spec: task-detail-view ==========
export const getTask = () => { ... }
```

### MCP Server Commands
Defined in `parallel.yaml`, supports placeholders:
- `{project_path}` - Replaced with worktree path

```yaml
mcp_servers:
  - name: serena
    command: uvx --from git+... --project {project_path}
```

## 🎯 Best Practices

1. **Always use --dry-run first** to preview changes
2. **One spec per developer** to avoid conflicts
3. **Complete specs before moving on** to maintain quality
4. **Monitor dashboards** to track automation progress
5. **Mark completed specs** as `available: false` in config
6. **Regular commits** in feature branches
7. **Clean worktrees** when specs are merged to main

## 📚 Related Files

- `scripts/config.js` - Generated config for PM2 (updated by parallel_dev.js)
- `ecosystem.config.js` - PM2 configuration (generated)
- `scripts/generate-ecosystem.js` - Ecosystem generator (used by parallel_dev.js)
- `scripts/remote-automation.sh` - PM2 process manager (used by parallel_dev.js)

## 🔒 Safety

The script includes safety features:
- ✅ Idempotent: Can run multiple times safely
- ✅ Dry-run mode: Preview before executing
- ✅ Reuses existing worktrees
- ✅ Preserves existing branches
- ✅ Non-destructive updates to config.js
- ✅ Graceful error handling

## 📝 Example Session

```bash
# 1. Setup parallel development for 4 specs
$ node scripts/parallel_dev.js --dry-run
📖 Loading configuration from parallel.yaml...
✓ Loaded 14 specifications
🌳 Phase 1: Setting up worktrees for 4 specs...
...

# 2. Looks good, run for real
$ node scripts/parallel_dev.js
✓ Setup Complete!
📊 Summary:
  • Worktrees created: 4
  • MCP servers installed: 20
  • PM2 processes: 8 (automation + dashboard)

# 3. Monitor progress
$ pm2 list
┌────┬──────────────────────────┬─────────┬────────┐
│ id │ name                     │ status  │ uptime │
├────┼──────────────────────────┼─────────┼────────┤
│ 0  │ spec-workflow-automation │ online  │ 5m     │
│ 1  │ spec-workflow-dashboard  │ online  │ 5m     │
└────┴──────────────────────────┴─────────┴────────┘

# 4. Check spec progress
$ open http://localhost:3412

# 5. When done, mark as complete and re-run
$ vim parallel.yaml  # Set available: false
$ node scripts/parallel_dev.js
```

---

**Questions?** Check `parallel.yaml` for configuration or run `node scripts/parallel_dev.js --help`
