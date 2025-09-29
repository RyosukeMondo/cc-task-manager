module.exports = {
  "apps": [
    {
      "name": "spec-workflow-automation-database-schema-completion",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "database-schema-completion",
        "--project",
        "./worktree/database-schema-completion",
        "--session-log",
        "logs/spec-workflow-database-schema-completion.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-database-schema-completion-error.log",
      "out_file": "logs/pm2-spec-workflow-database-schema-completion-out.log",
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
      "name": "spec-workflow-automation-task-crud-api",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "task-crud-api",
        "--project",
        "./worktree/task-crud-api",
        "--session-log",
        "logs/spec-workflow-task-crud-api.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-task-crud-api-error.log",
      "out_file": "logs/pm2-spec-workflow-task-crud-api-out.log",
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
      "name": "spec-workflow-automation-bullmq-integration",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "bullmq-integration",
        "--project",
        "./worktree/bullmq-integration",
        "--session-log",
        "logs/spec-workflow-bullmq-integration.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-bullmq-integration-error.log",
      "out_file": "logs/pm2-spec-workflow-bullmq-integration-out.log",
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
      "name": "spec-workflow-automation-dashboard-frontend",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "dashboard-frontend",
        "--project",
        "./worktree/dashboard-frontend",
        "--session-log",
        "logs/spec-workflow-dashboard-frontend.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-dashboard-frontend-error.log",
      "out_file": "logs/pm2-spec-workflow-dashboard-frontend-out.log",
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
      "name": "spec-workflow-automation-claude-code-wrapper-integration",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "claude-code-wrapper-integration",
        "--project",
        "./worktree/claude-code-wrapper-integration",
        "--session-log",
        "logs/spec-workflow-claude-code-wrapper-integration.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-claude-code-wrapper-integration-error.log",
      "out_file": "logs/pm2-spec-workflow-claude-code-wrapper-integration-out.log",
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
      "name": "spec-workflow-automation-realtime-websocket-events",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "realtime-websocket-events",
        "--project",
        "./worktree/realtime-websocket-events",
        "--session-log",
        "logs/spec-workflow-realtime-websocket-events.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-realtime-websocket-events-error.log",
      "out_file": "logs/pm2-spec-workflow-realtime-websocket-events-out.log",
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
        "battle-e2e-testing",
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
      "name": "spec-workflow-automation-mind-advanced-evaluation-metrics",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "advanced-evaluation-metrics",
        "--project",
        "../mind-training/worktree/advanced-evaluation-metrics",
        "--session-log",
        "logs/spec-workflow-mind-advanced-evaluation-metrics.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-advanced-evaluation-metrics-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-advanced-evaluation-metrics-out.log",
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
      "name": "spec-workflow-automation-mind-authentication-flow",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "authentication-flow",
        "--project",
        "../mind-training/worktree/authentication-flow",
        "--session-log",
        "logs/spec-workflow-mind-authentication-flow.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-authentication-flow-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-authentication-flow-out.log",
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
      "name": "spec-workflow-automation-mind-real-time-sync-backend",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "real-time-sync-backend",
        "--project",
        "../mind-training/worktree/real-time-sync-backend",
        "--session-log",
        "logs/spec-workflow-mind-real-time-sync-backend.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-real-time-sync-backend-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-real-time-sync-backend-out.log",
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
      "name": "spec-workflow-automation-mind-real-time-sync-ui",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "real-time-sync-ui",
        "--project",
        "../mind-training/worktree/real-time-sync-ui",
        "--session-log",
        "logs/spec-workflow-mind-real-time-sync-ui.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-real-time-sync-ui-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-real-time-sync-ui-out.log",
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
      "name": "spec-workflow-automation-mind-skill-radar-charts",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "skill-radar-charts",
        "--project",
        "../mind-training/worktree/skill-radar-charts",
        "--session-log",
        "logs/spec-workflow-mind-skill-radar-charts.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-skill-radar-charts-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-skill-radar-charts-out.log",
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
      "name": "spec-workflow-automation-mind-user-dashboard",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "user-dashboard",
        "--project",
        "../mind-training/worktree/user-dashboard",
        "--session-log",
        "logs/spec-workflow-mind-user-dashboard.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-user-dashboard-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-user-dashboard-out.log",
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
      "name": "spec-workflow-automation-mind-training-content-generator",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "training-content-generator",
        "--project",
        "../mind-training/worktree/training-content-generator",
        "--session-log",
        "logs/spec-workflow-mind-training-content-generator.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-training-content-generator-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-training-content-generator-out.log",
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
      "name": "spec-workflow-automation-mind-training-session-ui",
      "script": "/usr/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "training-session-ui",
        "--project",
        "../mind-training/worktree/training-session-ui",
        "--session-log",
        "logs/spec-workflow-mind-training-session-ui.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-training-session-ui-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-training-session-ui-out.log",
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
      "name": "spec-workflow-dashboard-database-schema-completion",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "./worktree/database-schema-completion",
        "--dashboard",
        "--port",
        "3401"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-database-schema-completion-error.log",
      "out_file": "logs/pm2-dashboard-database-schema-completion-out.log",
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
      "name": "spec-workflow-dashboard-task-crud-api",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "./worktree/task-crud-api",
        "--dashboard",
        "--port",
        "3402"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-task-crud-api-error.log",
      "out_file": "logs/pm2-dashboard-task-crud-api-out.log",
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
      "name": "spec-workflow-dashboard-bullmq-integration",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "./worktree/bullmq-integration",
        "--dashboard",
        "--port",
        "3403"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-bullmq-integration-error.log",
      "out_file": "logs/pm2-dashboard-bullmq-integration-out.log",
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
      "name": "spec-workflow-dashboard-dashboard-frontend",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "./worktree/dashboard-frontend",
        "--dashboard",
        "--port",
        "3404"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-dashboard-frontend-error.log",
      "out_file": "logs/pm2-dashboard-dashboard-frontend-out.log",
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
      "name": "spec-workflow-dashboard-claude-code-wrapper-integration",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "./worktree/claude-code-wrapper-integration",
        "--dashboard",
        "--port",
        "3405"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-claude-code-wrapper-integration-error.log",
      "out_file": "logs/pm2-dashboard-claude-code-wrapper-integration-out.log",
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
      "name": "spec-workflow-dashboard-realtime-websocket-events",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "./worktree/realtime-websocket-events",
        "--dashboard",
        "--port",
        "3406"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-realtime-websocket-events-error.log",
      "out_file": "logs/pm2-dashboard-realtime-websocket-events-out.log",
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
        "3407"
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
      "name": "spec-workflow-dashboard-mind-advanced-evaluation-metrics",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/advanced-evaluation-metrics",
        "--dashboard",
        "--port",
        "3408"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-advanced-evaluation-metrics-error.log",
      "out_file": "logs/pm2-dashboard-mind-advanced-evaluation-metrics-out.log",
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
      "name": "spec-workflow-dashboard-mind-authentication-flow",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/authentication-flow",
        "--dashboard",
        "--port",
        "3409"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-authentication-flow-error.log",
      "out_file": "logs/pm2-dashboard-mind-authentication-flow-out.log",
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
      "name": "spec-workflow-dashboard-mind-real-time-sync-backend",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/real-time-sync-backend",
        "--dashboard",
        "--port",
        "3410"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-real-time-sync-backend-error.log",
      "out_file": "logs/pm2-dashboard-mind-real-time-sync-backend-out.log",
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
      "name": "spec-workflow-dashboard-mind-real-time-sync-ui",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/real-time-sync-ui",
        "--dashboard",
        "--port",
        "3411"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-real-time-sync-ui-error.log",
      "out_file": "logs/pm2-dashboard-mind-real-time-sync-ui-out.log",
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
      "name": "spec-workflow-dashboard-mind-skill-radar-charts",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/skill-radar-charts",
        "--dashboard",
        "--port",
        "3412"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-skill-radar-charts-error.log",
      "out_file": "logs/pm2-dashboard-mind-skill-radar-charts-out.log",
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
      "name": "spec-workflow-dashboard-mind-user-dashboard",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/user-dashboard",
        "--dashboard",
        "--port",
        "3413"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-user-dashboard-error.log",
      "out_file": "logs/pm2-dashboard-mind-user-dashboard-out.log",
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
      "name": "spec-workflow-dashboard-mind-training-content-generator",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/training-content-generator",
        "--dashboard",
        "--port",
        "3414"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-training-content-generator-error.log",
      "out_file": "logs/pm2-dashboard-mind-training-content-generator-out.log",
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
      "name": "spec-workflow-dashboard-mind-training-session-ui",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/training-session-ui",
        "--dashboard",
        "--port",
        "3415"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-training-session-ui-error.log",
      "out_file": "logs/pm2-dashboard-mind-training-session-ui-out.log",
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
