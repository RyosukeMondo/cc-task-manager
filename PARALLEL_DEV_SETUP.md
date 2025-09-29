# Parallel Development Setup

This guide explains how to use the automated parallel development environment setup for the CC Task Manager project.

## 🚀 Quick Start

```bash
# Set up all development environments
python scripts/prepare_parallel_dev.py

# Or do a dry run first
python scripts/prepare_parallel_dev.py --dry-run
```

## 📁 What Gets Created

The script creates isolated development environments:

```
worktree/
├── database-schema-completion/     # Worktree for database spec
├── task-crud-api/                  # Worktree for API spec
├── bullmq-integration/             # Worktree for queue spec
├── dashboard-frontend/             # Worktree for frontend spec
├── claude-code-wrapper-integration/ # Worktree for wrapper spec
└── realtime-websocket-events/      # Worktree for WebSocket spec
```

Each worktree includes:
- ✅ **Isolated Git Worktree** with feature branch
- ✅ **Configured MCP Servers** for the specific domain
- ✅ **Complete Specification** (requirements, design, tasks)
- ✅ **Programming Principles** enforcement
- ✅ **Development README** with workflow guidance

## 🔧 Configuration

The setup is controlled by `parallel.yaml`:

```yaml
specifications:
  - name: database-schema-completion
    description: Complete database schema with repositories and testing
    priority: 1
    mcp_servers:
      - serena        # Semantic code understanding
      - spec-workflow # Specification management

mcp_servers:
  - name: serena
    command: claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
    description: Serena semantic code understanding
    required: true
```

## 🏃‍♂️ Developer Workflow

### 1. Choose Your Specification

Pick a worktree based on your expertise:
- **Backend Developers**: `database-schema-completion`, `task-crud-api`, `bullmq-integration`
- **Frontend Developers**: `dashboard-frontend`
- **Integration Specialists**: `claude-code-wrapper-integration`, `realtime-websocket-events`

### 2. Start Development

```bash
# Navigate to your assigned worktree
cd worktree/task-crud-api

# Read the specification
cat .spec-workflow/specs/task-crud-api/tasks.md

# Start implementing
# Mark task as in-progress: [ ] → [-]
# Follow SOLID principles and task prompts
# Mark task as complete: [-] → [x]
```

### 3. Use MCP Servers

Each worktree has pre-configured MCP servers:
- **Serena**: Semantic code understanding and project memory
- **Context7**: Official library documentation
- **Magic UI**: UI component generation (frontend only)
- **Spec Workflow**: Specification management

### 4. Commit and Push

```bash
# Regular commits
git add .
git commit -m "feat(task-crud-api): implement user authentication guard"

# Push feature branch
git push origin feature/task-crud-api

# Create PR when complete
```

## 📋 Available Commands

```bash
# Basic usage
python scripts/prepare_parallel_dev.py

# Dry run (see what would happen)
python scripts/prepare_parallel_dev.py --dry-run

# Custom config file
python scripts/prepare_parallel_dev.py --config my-config.yaml

# Create default config
python scripts/prepare_parallel_dev.py --create-config

# Help
python scripts/prepare_parallel_dev.py --help
```

## 🛠️ Advanced Configuration

### Custom MCP Servers

Add new MCP servers to `parallel.yaml`:

```yaml
mcp_servers:
  - name: my-custom-server
    command: claude mcp add my-server npx my-package@latest
    description: Custom development server
    required: false
```

### Specification Priorities

Control setup order with priorities (lower = first):

```yaml
specifications:
  - name: critical-spec
    priority: 1  # Set up first
  - name: optional-spec
    priority: 10 # Set up last
```

### Environment-Specific Setup

Use different configs for different environments:

```bash
# Development
python scripts/prepare_parallel_dev.py --config dev-parallel.yaml

# Production
python scripts/prepare_parallel_dev.py --config prod-parallel.yaml
```

## 🔍 Troubleshooting

### Git Worktree Issues

```bash
# List all worktrees
git worktree list

# Remove specific worktree
git worktree remove worktree/spec-name

# Prune deleted worktrees
git worktree prune
```

### MCP Server Issues

```bash
# Check MCP servers in worktree
cd worktree/spec-name
claude mcp list

# Re-add failed server
claude mcp add server-name [command]
```

### Clean Slate Setup

```bash
# Remove all worktrees and start fresh
rm -rf worktree/
git worktree prune
python scripts/prepare_parallel_dev.py
```

## 📊 Monitoring Progress

Each worktree tracks progress in `tasks.md`:
- `[ ]` = Pending task
- `[-]` = In progress
- `[x]` = Completed task

Use the spec-workflow MCP server to check overall progress across all specifications.

## 🎯 Quality Standards

All implementations must follow:
- ✅ **SOLID Principles** (SRP, OCP, LSP, ISP, DIP)
- ✅ **KISS** (Keep It Simple, Stupid)
- ✅ **DRY/SSOT** (Single Source of Truth)
- ✅ **Contract-driven Design**
- ✅ **Fail-fast Validation**

Each task includes detailed prompts with role, restrictions, and success criteria to ensure consistent quality across all parallel development streams.