module.exports = {
  "apps": [
    {
      "name": "spec-workflow-automation-backend-tasks-api",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "backend-tasks-api",
        "--project",
        "worktree/backend-tasks-api",
        "--session-log",
        "logs/spec-workflow-backend-tasks-api.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-backend-tasks-api-error.log",
      "out_file": "logs/pm2-spec-workflow-backend-tasks-api-out.log",
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
      "name": "spec-workflow-automation-backend-analytics-api",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "backend-analytics-api",
        "--project",
        "worktree/backend-analytics-api",
        "--session-log",
        "logs/spec-workflow-backend-analytics-api.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-backend-analytics-api-error.log",
      "out_file": "logs/pm2-spec-workflow-backend-analytics-api-out.log",
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
      "name": "spec-workflow-automation-backend-settings-api",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "backend-settings-api",
        "--project",
        "worktree/backend-settings-api",
        "--session-log",
        "logs/spec-workflow-backend-settings-api.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-backend-settings-api-error.log",
      "out_file": "logs/pm2-spec-workflow-backend-settings-api-out.log",
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
      "name": "spec-workflow-dashboard-backend-tasks-api",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/backend-tasks-api",
        "--dashboard",
        "--port",
        "3409"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-backend-tasks-api-error.log",
      "out_file": "logs/pm2-dashboard-backend-tasks-api-out.log",
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
      "name": "spec-workflow-dashboard-backend-analytics-api",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/backend-analytics-api",
        "--dashboard",
        "--port",
        "3410"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-backend-analytics-api-error.log",
      "out_file": "logs/pm2-dashboard-backend-analytics-api-out.log",
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
      "name": "spec-workflow-dashboard-backend-settings-api",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/backend-settings-api",
        "--dashboard",
        "--port",
        "3411"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-backend-settings-api-error.log",
      "out_file": "logs/pm2-dashboard-backend-settings-api-out.log",
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
