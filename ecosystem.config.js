module.exports = {
  apps: [{
    name: 'spec-workflow-automation',
    script: '/usr/bin/python3',
    args: [
      'scripts/spec_workflow_automation.py',
      '--spec-name', 'backend-implementation',
      '--project', '.',
      '--session-log', 'logs/spec-workflow.jsonl'
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
    error_file: 'logs/pm2-spec-workflow-error.log',
    out_file: 'logs/pm2-spec-workflow-out.log',
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
  }]
};
