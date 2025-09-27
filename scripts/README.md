# Unified Ecosystem Configuration

## Usage

To add a new project, simply edit `scripts/config.js`:

```javascript
projects: [
  { name: 'cc-task-manager', path: '.', spec: 'frontend-implementation' },
  { name: 'warps', path: '../warps', spec: 'improving-critical-errors' },
  { name: 'mind', path: '../mind-training', spec: 'contract-driven-type-safety' },
  // Add your new project here:
  { name: 'my-project', path: '../my-project', spec: 'my-spec-name' }
]
```

Don't forget to add the port to `dashboardPorts` object:

Then regenerate the config:

```bash
node scripts/generate-ecosystem.js
```

## What it generates

For each project, it creates:
- `spec-workflow-automation-{name}` - Automation process
- `spec-workflow-dashboard-{name}` - Dashboard on auto-assigned port

Current symmetrical configuration:
- **cc-task-manager**: Port 3401, spec: frontend-implementation
- **warps**: Port 3402, spec: improving-critical-errors
- **mind**: Port 3403, spec: contract-driven-type-safety

## Usage with remote-automation.sh

```bash
# All processes (symmetrical)
./scripts/remote-automation.sh start
./scripts/remote-automation.sh stop
./scripts/remote-automation.sh status

# Individual projects
./scripts/remote-automation.sh start cc-task-manager
./scripts/remote-automation.sh logs warps
./scripts/remote-automation.sh restart mind
```

## Benefits

- **Single source of truth**: `scripts/config.js` contains ALL configuration
- **No magic strings**: All constants centralized and reusable
- **Auto-cleanup**: Orphaned processes automatically detected and removed
- **Symmetrical**: Both generation and management scripts use same config
- **KISS principle**: One config file drives everything

## Auto-Cleanup

Both scripts now automatically clean up orphaned processes:
- `./scripts/remote-automation.sh start` - Auto-cleans before starting
- `./scripts/remote-automation.sh cleanup` - Manual cleanup command

Orphaned processes are automatically detected from the unified config.