module.exports = {
  "apps": [
    {
      "name": "spec-workflow-automation-task-creation-modal",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "task-creation-modal",
        "--project",
        "worktree/task-creation-modal",
        "--session-log",
        "logs/spec-workflow-task-creation-modal.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-task-creation-modal-error.log",
      "out_file": "logs/pm2-spec-workflow-task-creation-modal-out.log",
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
      "name": "spec-workflow-automation-task-detail-view",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "task-detail-view",
        "--project",
        "worktree/task-detail-view",
        "--session-log",
        "logs/spec-workflow-task-detail-view.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-task-detail-view-error.log",
      "out_file": "logs/pm2-spec-workflow-task-detail-view-out.log",
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
      "name": "spec-workflow-automation-queue-management-dashboard",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "queue-management-dashboard",
        "--project",
        "worktree/queue-management-dashboard",
        "--session-log",
        "logs/spec-workflow-queue-management-dashboard.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-queue-management-dashboard-error.log",
      "out_file": "logs/pm2-spec-workflow-queue-management-dashboard-out.log",
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
      "name": "spec-workflow-automation-system-monitoring-dashboard",
      "script": "/home/rmondo/repos/cc-task-manager/.venv/bin/python3",
      "args": [
        "scripts/spec_workflow_automation.py",
        "--spec-name",
        "system-monitoring-dashboard",
        "--project",
        "worktree/system-monitoring-dashboard",
        "--session-log",
        "logs/spec-workflow-system-monitoring-dashboard.jsonl"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": false,
      "error_file": "logs/pm2-spec-workflow-system-monitoring-dashboard-error.log",
      "out_file": "logs/pm2-spec-workflow-system-monitoring-dashboard-out.log",
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
      "name": "spec-workflow-dashboard-task-creation-modal",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/task-creation-modal",
        "--dashboard",
        "--port",
        "3412"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-task-creation-modal-error.log",
      "out_file": "logs/pm2-dashboard-task-creation-modal-out.log",
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
      "name": "spec-workflow-dashboard-task-detail-view",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/task-detail-view",
        "--dashboard",
        "--port",
        "3413"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-task-detail-view-error.log",
      "out_file": "logs/pm2-dashboard-task-detail-view-out.log",
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
      "name": "spec-workflow-dashboard-queue-management-dashboard",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/queue-management-dashboard",
        "--dashboard",
        "--port",
        "3414"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-queue-management-dashboard-error.log",
      "out_file": "logs/pm2-dashboard-queue-management-dashboard-out.log",
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
      "name": "spec-workflow-dashboard-system-monitoring-dashboard",
      "script": "npx",
      "args": [
        "-y",
        "@pimzino/spec-workflow-mcp@latest",
        "worktree/system-monitoring-dashboard",
        "--dashboard",
        "--port",
        "3415"
      ],
      "cwd": "/home/rmondo/repos/cc-task-manager",
      "autorestart": true,
      "error_file": "logs/pm2-dashboard-system-monitoring-dashboard-error.log",
      "out_file": "logs/pm2-dashboard-system-monitoring-dashboard-out.log",
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
