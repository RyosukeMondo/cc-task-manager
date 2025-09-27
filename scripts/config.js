#!/usr/bin/env node

// Unified configuration for spec-workflow ecosystem
// Single source of truth for all scripts

const CONFIG = {
  // Base paths
  baseCwd: '/home/rmondo/repos/cc-task-manager',

  // Projects configuration - just add your projects here
  projects: [
    { name: 'cc-task-manager', path: '.', spec: 'frontend-implementation' },
    { name: 'warps', path: '../warps', spec: 'improving-critical-errors' },
    { name: 'mind', path: '../mind-training', spec: 'contract-driven-type-safety' }
  ],

  // Dashboard port assignments
  dashboardPorts: {
    'cc-task-manager': 3401,
    'warps': 3402,
    'mind': 3403
  },

  // Static services
  staticServices: [
    {
      name: 'claude-code-viewer',
      script: 'server.js',
      cwd: '/home/rmondo/repos/claude-code-viewer/dist/standalone',
      port: 3400
    }
  ],

  // Naming patterns
  naming: {
    automationPrefix: 'spec-workflow-automation-',
    dashboardPrefix: 'spec-workflow-dashboard-',

    // Legacy/orphaned process names to clean up
    orphanedProcesses: [
      'spec-workflow-automation-main',
      'spec-workflow-dashboard',
      'spec-workflow-cc-task-manager'
    ]
  },

  // Common PM2 settings
  pm2Defaults: {
    instances: 1,
    watch: false,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production' },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    time: true
  },

  // Paths and files
  paths: {
    logsDir: 'logs',
    ecosystemFile: 'ecosystem.config.js',
    automationScript: 'scripts/spec_workflow_automation.py'
  }
};

// Computed properties
CONFIG.computed = {
  // Expected process names
  expectedAutomationProcesses: CONFIG.projects.map(p => CONFIG.naming.automationPrefix + p.name),
  expectedDashboardProcesses: CONFIG.projects.map(p => CONFIG.naming.dashboardPrefix + p.name),

  // All expected processes
  get allExpectedProcesses() {
    return [
      ...this.expectedAutomationProcesses,
      ...this.expectedDashboardProcesses,
      ...CONFIG.staticServices.map(s => s.name)
    ];
  }
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

// Export for bash scripts (when called directly)
if (require.main === module) {
  const action = process.argv[2];

  switch (action) {
    case 'projects':
      console.log(CONFIG.projects.map(p => p.name).join(' '));
      break;
    case 'expected-automation':
      console.log(CONFIG.computed.expectedAutomationProcesses.join(' '));
      break;
    case 'expected-dashboard':
      console.log(CONFIG.computed.expectedDashboardProcesses.join(' '));
      break;
    case 'all-expected':
      console.log(CONFIG.computed.allExpectedProcesses.join(' '));
      break;
    case 'orphaned':
      console.log(CONFIG.naming.orphanedProcesses.join(' '));
      break;
    case 'project-details':
      const projectName = process.argv[3];
      const project = CONFIG.projects.find(p => p.name === projectName);
      if (project) {
        console.log(JSON.stringify(project));
      }
      break;
    default:
      console.log(JSON.stringify(CONFIG, null, 2));
  }
}