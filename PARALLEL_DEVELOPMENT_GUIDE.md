# Parallel Development Guide

## Overview

This project is set up for **simultaneous parallel development** of 7 navigation features using Git worktrees. Each feature has its own isolated workspace with dedicated feature branch and MCP tools.

## Setup Complete ✅

All 7 worktrees have been created with:
- ✅ Dedicated feature branches
- ✅ Isolated working directories
- ✅ Configured MCP tools (context7, magicuidesign, playwright, serena, spec-workflow)

## Directory Structure

```
cc-task-manager/                           [main branch]
├── worktree/
│   ├── task-list-component/              [feature/task-list-component]
│   ├── tasks-all-page/                   [feature/tasks-all-page]
│   ├── tasks-active-page/                [feature/tasks-active-page]
│   ├── tasks-completed-page/             [feature/tasks-completed-page]
│   ├── analytics-performance-page/       [feature/analytics-performance-page]
│   ├── analytics-trends-page/            [feature/analytics-trends-page]
│   └── settings-page/                    [feature/settings-page]
└── .spec-workflow/specs/                 [shared specs - accessible from all worktrees]
```

## Worktrees and Branches

| Worktree Directory | Feature Branch | Spec Name |
|-------------------|----------------|-----------|
| `worktree/task-list-component` | `feature/task-list-component` | task-list-component |
| `worktree/tasks-all-page` | `feature/tasks-all-page` | tasks-all-page |
| `worktree/tasks-active-page` | `feature/tasks-active-page` | tasks-active-page |
| `worktree/tasks-completed-page` | `feature/tasks-completed-page` | tasks-completed-page |
| `worktree/analytics-performance-page` | `feature/analytics-performance-page` | analytics-performance-page |
| `worktree/analytics-trends-page` | `feature/analytics-trends-page` | analytics-trends-page |
| `worktree/settings-page` | `feature/settings-page` | settings-page |

## How to Use

### 1. Navigate to a Worktree

Each worktree is an independent workspace:

```bash
# Work on task list component
cd worktree/task-list-component

# Work on tasks all page
cd worktree/tasks-all-page

# etc...
```

### 2. Start Development in Any Worktree

Each worktree has Claude Code MCP tools configured:

```bash
cd worktree/task-list-component

# Open Claude Code (MCP tools are automatically available)
claude
```

**Available MCP Tools in Each Worktree:**
- `context7` - Code context and search
- `magicuidesign` - UI component design assistance
- `playwright` - End-to-end testing
- `serena` - IDE assistant with project context
- `spec-workflow` - Spec-workflow automation

### 3. Work on Your Feature

Each worktree is isolated, so you can:
- Make commits independently
- Run tests independently
- Have different dependencies/packages installed
- Work simultaneously without conflicts

**Example workflow:**
```bash
cd worktree/task-list-component

# Check current branch and status
git status
# On branch feature/task-list-component

# Make changes
# ... implement Task 0: Define Task API contract ...

# Commit
git add .
git commit -m "feat: define Task API contract in shared schemas"

# Push feature branch
git push origin feature/task-list-component
```

### 4. Access Shared Specs

All worktrees share the same `.spec-workflow/specs/` directory:

```bash
cd worktree/task-list-component
cat .spec-workflow/specs/task-list-component/tasks.md
```

The specs are accessible from all worktrees because they share the same repository, just different working directories.

## Implementation Order (Recommended)

### Phase 1: Foundation (Must Complete First)
```bash
cd worktree/task-list-component
# Implement Task 0: Define Task API contract
# This creates packages/schemas/src/tasks/task.schemas.ts
```

### Phase 2: Parallel Development (After Phase 1)

**Open 6 Terminal Sessions Simultaneously:**

```bash
# Terminal 1
cd worktree/tasks-all-page

# Terminal 2
cd worktree/tasks-active-page

# Terminal 3
cd worktree/tasks-completed-page

# Terminal 4
cd worktree/analytics-performance-page

# Terminal 5
cd worktree/analytics-trends-page

# Terminal 6
cd worktree/settings-page
```

Each can work independently!

## Merging Strategy

### Option 1: Sequential Merging (Safer)
```bash
# Merge task-list-component first
git checkout main
git merge feature/task-list-component
git push origin main

# Then merge task pages
git merge feature/tasks-all-page
git push origin main

# Continue...
```

### Option 2: Pull Requests (Recommended)
```bash
# From each worktree, push your feature branch
cd worktree/task-list-component
git push origin feature/task-list-component

# Create PR on GitHub: feature/task-list-component → main
# Review, approve, merge
```

### Option 3: Parallel Merge (Advanced)
```bash
# After all features are complete, merge all at once
git checkout main
git merge feature/task-list-component
git merge feature/tasks-all-page
git merge feature/tasks-active-page
# ... etc
git push origin main
```

## Benefits of This Setup

✅ **True Parallel Development**
- Work on 7 features simultaneously
- No branch switching needed
- Each workspace isolated

✅ **No Merge Conflicts**
- Each spec creates files in different locations
- Independent navigation section uncomments
- Clean atomic changes

✅ **Consistent Tooling**
- Same MCP tools in every workspace
- Same spec-workflow setup
- Same project context

✅ **Easy Context Switching**
- Just `cd` to different worktree
- No git checkout needed
- All changes preserved

## Viewing All Worktrees

```bash
# List all worktrees with their branches
git worktree list

# Output:
# /home/rmondo/repos/cc-task-manager              9102d81 [main]
# /home/rmondo/repos/cc-task-manager/worktree/... 9102d81 [feature/...]
```

## Checking Branch Status Across Worktrees

```bash
# See all local branches
git branch -a

# See which worktree is on which branch
git worktree list
```

## Cleaning Up After Completion

When all features are merged:

```bash
# Remove a worktree
git worktree remove worktree/task-list-component

# Delete the feature branch (if merged)
git branch -d feature/task-list-component

# Delete remote branch
git push origin --delete feature/task-list-component
```

## Tips for Parallel Development

1. **Start with task-list-component** - It defines the Task contract needed by other specs

2. **Check dependencies** - Some specs depend on contracts from others:
   - tasks-*-page → requires task-list-component Task 0
   - analytics-trends-page → requires analytics-performance-page Task 0

3. **Commit frequently** - Each worktree is independent, commit often

4. **Use descriptive commits** - Since you're working in parallel, clear commit messages help

5. **Push feature branches** - Push your feature branches regularly to backup work

6. **Test in isolation** - Each worktree can run tests independently

## Troubleshooting

### Issue: Changes in one worktree affect another
**Solution:** This shouldn't happen - each worktree is isolated. If you see this, you may be modifying shared files like `package.json` or `.spec-workflow/specs/`.

### Issue: Can't see my changes from another worktree
**Solution:** This is expected - each worktree is on a different branch. To share changes, commit and merge branches.

### Issue: MCP tools not working in worktree
**Solution:**
```bash
cd worktree/<spec-name>
# Re-run MCP setup
claude mcp add context7 npx @upstash/context7-mcp@latest
# ... etc
```

### Issue: Want to sync changes from main
**Solution:**
```bash
cd worktree/<spec-name>
git fetch origin
git merge origin/main
# Or: git rebase origin/main
```

## Contract-First Enforcement

All specs enforce contract-first development:
- ✅ Task 0 must be completed first
- ✅ Contracts defined in `packages/schemas/`
- ✅ No duplicate type definitions
- ✅ Shared schemas between frontend/backend

See `.spec-workflow/specs/CONTRACT_FIRST_REQUIREMENTS.md` for details.

## Summary

You now have 7 isolated workspaces ready for parallel development:

```bash
# Work on any feature by navigating to its worktree
cd worktree/task-list-component
cd worktree/tasks-all-page
cd worktree/analytics-performance-page
# ... etc

# Each has its own:
# - Feature branch
# - Working directory
# - MCP tools configured
# - Access to shared specs
```

**Happy parallel developing!** 🚀