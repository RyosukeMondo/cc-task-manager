module.exports = {
  "apps": [
    {
      "name": "spec-workflow-automation-mind-exercise-ui",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "exercise-ui-concrete-abstract",
        "--project",
        "../mind-training/worktree/exercise-ui-concrete-abstract",
        "--session-log",
        "logs/spec-workflow-mind-exercise-ui.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-exercise-ui-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-exercise-ui-out.log",
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
      "name": "spec-workflow-automation-mind-backend-lifecycle",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "backend-session-lifecycle",
        "--project",
        "../mind-training/worktree/backend-session-lifecycle",
        "--session-log",
        "logs/spec-workflow-mind-backend-lifecycle.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-backend-lifecycle-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-backend-lifecycle-out.log",
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
      "name": "spec-workflow-automation-mind-ai-evaluation",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "ai-evaluation-integration",
        "--project",
        "../mind-training/worktree/ai-evaluation-integration",
        "--session-log",
        "logs/spec-workflow-mind-ai-evaluation.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-mind-ai-evaluation-error.log",
      "out_file": "logs/pm2-spec-workflow-mind-ai-evaluation-out.log",
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
      "name": "spec-workflow-automation-money-foundation",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "foundation-contracts",
        "--project",
        "../money-making-app/worktree/foundation-contracts",
        "--session-log",
        "logs/spec-workflow-money-foundation.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-money-foundation-error.log",
      "out_file": "logs/pm2-spec-workflow-money-foundation-out.log",
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
      "name": "spec-workflow-dashboard-mind-exercise-ui",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/exercise-ui-concrete-abstract",
        "--dashboard",
        "--port",
        "3419"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-exercise-ui-error.log",
      "out_file": "logs/pm2-dashboard-mind-exercise-ui-out.log",
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
      "name": "spec-workflow-dashboard-mind-backend-lifecycle",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/backend-session-lifecycle",
        "--dashboard",
        "--port",
        "3420"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-backend-lifecycle-error.log",
      "out_file": "logs/pm2-dashboard-mind-backend-lifecycle-out.log",
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
      "name": "spec-workflow-dashboard-mind-ai-evaluation",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../mind-training/worktree/ai-evaluation-integration",
        "--dashboard",
        "--port",
        "3421"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-mind-ai-evaluation-error.log",
      "out_file": "logs/pm2-dashboard-mind-ai-evaluation-out.log",
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
      "name": "spec-workflow-dashboard-money-foundation",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "../money-making-app/worktree/foundation-contracts",
        "--dashboard",
        "--port",
        "3424"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-money-foundation-error.log",
      "out_file": "logs/pm2-dashboard-money-foundation-out.log",
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
