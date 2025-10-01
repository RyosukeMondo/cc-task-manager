# Parallel Development - Quick Reference

## 🚀 One-Liner Commands

```bash
# Full setup (everything)
node scripts/parallel_dev.js

# Preview what would happen
node scripts/parallel_dev.js --dry-run

# Setup worktrees + MCP only (no PM2)
node scripts/parallel_dev.js --setup-only

# Check if PM2 processes are running
node scripts/parallel_dev.js --verify-only

# Remove all worktrees
node scripts/parallel_dev.js --cleanup

# Help
node scripts/parallel_dev.js --help
```

## 📝 Edit Configuration

Edit `parallel.yaml`:

```yaml
specifications:
  - name: my-spec
    available: true  # true = active, false = disabled
    priority: 1      # lower = setup first
```

Then run:
```bash
node scripts/parallel_dev.js
```

## 📊 Monitor

```bash
# PM2 list
pm2 list

# PM2 monitoring dashboard
pm2 monit

# View logs
./scripts/remote-automation.sh logs task-creation-modal

# Spec-workflow dashboards
open http://localhost:3412  # task-creation-modal
open http://localhost:3413  # task-detail-view
open http://localhost:3414  # queue-management-dashboard
open http://localhost:3415  # system-monitoring-dashboard
```

## 🔄 Common Workflows

### Add New Spec
1. Edit `parallel.yaml` - add spec with `available: true`
2. Run `node scripts/parallel_dev.js`
3. Develop in `worktree/{spec-name}`

### Complete Spec
1. Merge PR to main
2. Edit `parallel.yaml` - set `available: false`
3. Run `node scripts/parallel_dev.js`

### Restart Everything
```bash
pm2 delete all
node scripts/parallel_dev.js
```

### Clean Slate
```bash
node scripts/parallel_dev.js --cleanup
pm2 delete all
node scripts/parallel_dev.js
```

## 🛠️ Troubleshooting

### Worktree stuck?
```bash
git worktree list
git worktree remove worktree/spec-name --force
git worktree prune
```

### MCP not working?
```bash
cd worktree/spec-name
claude mcp list
claude mcp add serena -- uvx --from git+...
```

### PM2 process failed?
```bash
pm2 logs spec-workflow-automation-task-creation-modal
pm2 restart spec-workflow-automation-task-creation-modal
```

## 📁 Files

- `parallel.yaml` - **EDIT THIS** to configure specs
- `scripts/parallel_dev.js` - Main automation script
- `README_PARALLEL_DEV.md` - Full documentation

## ✅ Current Active Specs

As of last run:
- task-creation-modal (port 3412)
- task-detail-view (port 3413)
- queue-management-dashboard (port 3414)
- system-monitoring-dashboard (port 3415)

Check `parallel.yaml` for current state.
