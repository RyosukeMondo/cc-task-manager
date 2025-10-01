module.exports = {
  "apps": [
    {
      "name": "spec-workflow-automation-backend-auth-api",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "backend-auth-api",
        "--project",
        ".",
        "--session-log",
        "logs/spec-workflow-backend-auth-api.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-backend-auth-api-error.log",
      "out_file": "logs/pm2-spec-workflow-backend-auth-api-out.log",
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
      "name": "spec-workflow-dashboard-backend-auth-api",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "/home/rmondo/repos/cc-task-manager",
        "--dashboard",
        "--port",
        "3408"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-backend-auth-api-error.log",
      "out_file": "logs/pm2-dashboard-backend-auth-api-out.log",
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
