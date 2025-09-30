module.exports = {
  "apps": [
    {
      "name": "spec-workflow-automation-analytics-performance",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "analytics-performance-page",
        "--project",
        "worktree/analytics-performance-page",
        "--session-log",
        "logs/spec-workflow-analytics-performance.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-analytics-performance-error.log",
      "out_file": "logs/pm2-spec-workflow-analytics-performance-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-automation-analytics-trends",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "analytics-trends-page",
        "--project",
        "worktree/analytics-trends-page",
        "--session-log",
        "logs/spec-workflow-analytics-trends.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-analytics-trends-error.log",
      "out_file": "logs/pm2-spec-workflow-analytics-trends-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-automation-settings",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "settings-page",
        "--project",
        "worktree/settings-page",
        "--session-log",
        "logs/spec-workflow-settings.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-settings-error.log",
      "out_file": "logs/pm2-spec-workflow-settings-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-automation-task-list",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "task-list-component",
        "--project",
        "worktree/task-list-component",
        "--session-log",
        "logs/spec-workflow-task-list.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-task-list-error.log",
      "out_file": "logs/pm2-spec-workflow-task-list-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-automation-tasks-active",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "tasks-active-page",
        "--project",
        "worktree/tasks-active-page",
        "--session-log",
        "logs/spec-workflow-tasks-active.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-tasks-active-error.log",
      "out_file": "logs/pm2-spec-workflow-tasks-active-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-automation-tasks-all",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "tasks-all-page",
        "--project",
        "worktree/tasks-all-page",
        "--session-log",
        "logs/spec-workflow-tasks-all.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-tasks-all-error.log",
      "out_file": "logs/pm2-spec-workflow-tasks-all-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-automation-tasks-completed",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "tasks-completed-page",
        "--project",
        "worktree/tasks-completed-page",
        "--session-log",
        "logs/spec-workflow-tasks-completed.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-tasks-completed-error.log",
      "out_file": "logs/pm2-spec-workflow-tasks-completed-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-dashboard-analytics-performance",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/analytics-performance-page",
        "--dashboard",
        "--port",
        "3401"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-analytics-performance-error.log",
      "out_file": "logs/pm2-dashboard-analytics-performance-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-dashboard-analytics-trends",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/analytics-trends-page",
        "--dashboard",
        "--port",
        "3402"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-analytics-trends-error.log",
      "out_file": "logs/pm2-dashboard-analytics-trends-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-dashboard-settings",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/settings-page",
        "--dashboard",
        "--port",
        "3403"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-settings-error.log",
      "out_file": "logs/pm2-dashboard-settings-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-dashboard-task-list",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/task-list-component",
        "--dashboard",
        "--port",
        "3404"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-task-list-error.log",
      "out_file": "logs/pm2-dashboard-task-list-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-dashboard-tasks-active",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/tasks-active-page",
        "--dashboard",
        "--port",
        "3405"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-tasks-active-error.log",
      "out_file": "logs/pm2-dashboard-tasks-active-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-dashboard-tasks-all",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/tasks-all-page",
        "--dashboard",
        "--port",
        "3406"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-tasks-all-error.log",
      "out_file": "logs/pm2-dashboard-tasks-all-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "spec-workflow-dashboard-tasks-completed",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/tasks-completed-page",
        "--dashboard",
        "--port",
        "3407"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-tasks-completed-error.log",
      "out_file": "logs/pm2-dashboard-tasks-completed-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    },
    {
      "name": "claude-code-viewer",
      "script": "server.js",
      "cwd": "/home/rmondo/repos/claude-code-viewer/dist/standalone",
      "autorestart": true,
      "env": {
        "NODE_ENV": "production"
      },
      "error_file": "logs/pm2-claude-code-viewer-error.log",
      "out_file": "logs/pm2-claude-code-viewer-out.log",
      "instances": 1,
      "watch": false,
      "max_memory_restart": "1G",
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "time": true
    }
  ]
};
