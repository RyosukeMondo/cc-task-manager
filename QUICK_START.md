# Quick Start - Parallel Development

## 🚀 Ready to Start!

All 7 worktrees are configured and ready. Pick a feature and start coding!

## Start Working (Choose One)

```bash
# Option 1: Task List Component (START HERE - Required First)
cd worktree/task-list-component
# Spec: .spec-workflow/specs/task-list-component/

# Option 2: Tasks All Page
cd worktree/tasks-all-page
# Spec: .spec-workflow/specs/tasks-all-page/

# Option 3: Tasks Active Page
cd worktree/tasks-active-page
# Spec: .spec-workflow/specs/tasks-active-page/

# Option 4: Tasks Completed Page
cd worktree/tasks-completed-page
# Spec: .spec-workflow/specs/tasks-completed-page/

# Option 5: Analytics Performance Page
cd worktree/analytics-performance-page
# Spec: .spec-workflow/specs/analytics-performance-page/

# Option 6: Analytics Trends Page
cd worktree/analytics-trends-page
# Spec: .spec-workflow/specs/analytics-trends-page/

# Option 7: Settings Page
cd worktree/settings-page
# Spec: .spec-workflow/specs/settings-page/
```

## Each Worktree Has

✅ **Dedicated Feature Branch:** `feature/{spec-name}`
✅ **MCP Tools Configured:**
- context7 (code search)
- magicuidesign (UI design)
- playwright (E2E testing)
- serena (IDE assistant)
- spec-workflow (spec automation)

✅ **Access to Specs:** `.spec-workflow/specs/{spec-name}/`

## Basic Workflow

```bash
# 1. Navigate to worktree
cd worktree/task-list-component

# 2. Check you're on the right branch
git status
# On branch feature/task-list-component

# 3. Read the spec
cat .spec-workflow/specs/task-list-component/tasks.md

# 4. Start with Task 0 (Contract First!)
# Implement Task 0: Define API contract in packages/schemas/

# 5. Commit your work
git add .
git commit -m "feat: implement task 0 - define API contract"

# 6. Push your feature branch
git push origin feature/task-list-component

# 7. Continue with remaining tasks...
```

## Recommended Order

1. **task-list-component** (Required first - creates Task schemas)
2. Then all others in parallel:
   - tasks-all-page
   - tasks-active-page
   - tasks-completed-page
   - analytics-performance-page (creates Analytics schemas)
   - settings-page (creates Settings schemas)
3. **analytics-trends-page** (after analytics-performance-page)

## View All Worktrees

```bash
git worktree list
```

## Need Help?

- Full guide: `PARALLEL_DEVELOPMENT_GUIDE.md`
- Contract requirements: `.spec-workflow/specs/CONTRACT_FIRST_REQUIREMENTS.md`
- Implementation summary: `.spec-workflow/specs/IMPLEMENTATION_SUMMARY.md`

**Happy coding! 🎉**
