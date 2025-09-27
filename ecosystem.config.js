module.exports = {
  apps: [
	  {
    name: 'spec-workflow-automation',
    script: '/usr/bin/python3',
    args: [
      'scripts/spec_workflow_automation.py', '--spec-name', 'frontend-implementation', '--project', '.', '--session-log', 'logs/spec-workflow.jsonl'
    ],
    cwd: '/home/rmondo/repos/cc-task-manager',
    instances: 1,
    autorestart: false,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss', error_file: 'logs/pm2-spec-workflow-error.log', out_file: 'logs/pm2-spec-workflow-out.log',
    merge_logs: true,
    time: true
  }, {
    name: 'spec-workflow-warps',
    script: '/usr/bin/python3',
    args: [ 'scripts/spec_workflow_automation.py', '--spec-name', 'improving-critical-errors', '--project', '../warps', '--session-log', 'logs/spec-workflow-warps.jsonl'
    ],
    cwd: '/home/rmondo/repos/cc-task-manager',
    instances: 1,
    autorestart: false,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss', error_file: 'logs/pm2-spec-workflow-warps-error.log', out_file: 'logs/pm2-spec-workflow-warps-out.log',
    merge_logs: true,
    time: true
  }, {
    name: 'spec-workflow-mind-training',
    script: '/usr/bin/python3',
    args: [
      'scripts/spec_workflow_automation.py', '--spec-name', 'contract-driven-type-safety', '--project', '../mind-training', '--session-log', 'logs/spec-workflow-mind.jsonl'
    ],
    cwd: '/home/rmondo/repos/cc-task-manager',
    instances: 1,
    autorestart: false,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/pm2-spec-workflow-mind-error.log',
    out_file: 'logs/pm2-spec-workflow-mind-out.log',
    merge_logs: true,
    time: true
  }, {
    name: 'spec-workflow-dashboard',
    script: 'npx',
    args: [
      '-y',
      '@pimzino/spec-workflow-mcp@latest',
      '/home/rmondo/repos/cc-task-manager',
      '--dashboard',
      '--port',
      '3401'
    ],
    cwd: '/home/rmondo/repos/cc-task-manager',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/pm2-dashboard-error.log',
    out_file: 'logs/pm2-dashboard-out.log',
    merge_logs: true,
    time: true
  }, {
    name: 'spec-workflow-dashboard-warps',
    script: 'npx',
    args: [
      '-y',
      '@pimzino/spec-workflow-mcp@latest',
      '/home/rmondo/repos/warps',
      '--dashboard',
      '--port',
      '3402'
    ],
    cwd: '/home/rmondo/repos/cc-task-manager',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/pm2-dashboard-warps-error.log',
    out_file: 'logs/pm2-dashboard-warps-out.log',
    merge_logs: true,
    time: true
  }, {
    name: 'spec-workflow-dashboard-mind',
    script: 'npx',
    args: [
      '-y',
      '@pimzino/spec-workflow-mcp@latest',
      '/home/rmondo/repos/mind-training',
      '--dashboard',
      '--port',
      '3403'
    ],
    cwd: '/home/rmondo/repos/cc-task-manager',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/pm2-dashboard-mind-error.log',
    out_file: 'logs/pm2-dashboard-mind-out.log',
    merge_logs: true,
    time: true
  }, {
    name: 'claude-code-viewer',
    script: 'server.js',
    cwd: '/home/rmondo/repos/claude-code-viewer/dist/standalone',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: '3400'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/pm2-claude-code-viewer-error.log',
    out_file: 'logs/pm2-claude-code-viewer-out.log',
    merge_logs: true,
    time: true
  }]
};
