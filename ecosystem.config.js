module.exports = {
  "apps": [
    {
      "name": "spec-workflow-automation-cc-task-manager",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "frontend-implementation",
        "--project",
        ".",
        "--session-log",
        "logs/spec-workflow-cc-task-manager.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-cc-task-manager-error.log",
      "out_file": "logs/pm2-spec-workflow-cc-task-manager-out.log",
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
      "name": "spec-workflow-automation-warps",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "improving-critical-errors",
        "--project",
        "../warps",
        "--session-log",
        "logs/spec-workflow-warps.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-warps-error.log",
      "out_file": "logs/pm2-spec-workflow-warps-out.log",
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
      "name": "spec-workflow-automation-mind",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "contract-driven-type-safety",
        "--project",
        "../mind-training",
        "--session-log",
        "logs/spec-workflow-mind.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-out.log",
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
      "name": "spec-workflow-automation-wa-tools",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "todo-refactoring",
        "--project",
        "../wa-tools",
        "--session-log",
        "logs/spec-workflow-wa-tools.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-wa-tools-error.log",
      "out_file": "logs/pm2-spec-workflow-wa-tools-out.log",
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
      "name": "spec-workflow-dashboard-cc-task-manager",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "/home/rmondo/repos/cc-task-manager",
        "--dashboard",
        "--port",
        "3401"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-cc-task-manager-error.log",
      "out_file": "logs/pm2-dashboard-cc-task-manager-out.log",
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
      "name": "spec-workflow-dashboard-warps",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../warps",
        "--dashboard",
        "--port",
        "3402"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-warps-error.log",
      "out_file": "logs/pm2-dashboard-warps-out.log",
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
      "name": "spec-workflow-dashboard-mind",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training",
        "--dashboard",
        "--port",
        "3403"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-error.log",
      "out_file": "logs/pm2-dashboard-mind-out.log",
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
      "name": "spec-workflow-dashboard-wa-tools",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../wa-tools",
        "--dashboard",
        "--port",
        "3404"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-wa-tools-error.log",
      "out_file": "logs/pm2-dashboard-wa-tools-out.log",
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
