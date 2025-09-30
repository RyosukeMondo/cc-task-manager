#!/usr/bin/env node

// Unified configuration for spec-workflow ecosystem
// Single source of truth for all scripts

const CONFIG = {
  // Base paths
  baseCwd: '/home/rmondo/repos/cc-task-manager',

  // Projects configuration - just add your projects here
  projects: [
     { available: true, name: 'analytics-performance', path: 'worktree/analytics-performance-page', spec: 'analytics-performance-page' }
    ,{ available: true, name: 'analytics-trends', path: 'worktree/analytics-trends-page', spec: 'analytics-trends-page' }
    ,{ available: true, name: 'settings', path: 'worktree/settings-page', spec: 'settings-page' }
    ,{ available: true, name: 'task-list', path: 'worktree/task-list-component', spec: 'task-list-component' }
    ,{ available: true, name: 'tasks-active', path: 'worktree/tasks-active-page', spec: 'tasks-active-page' }
    ,{ available: true, name: 'tasks-all', path: 'worktree/tasks-all-page', spec: 'tasks-all-page' }
    ,{ available: true, name: 'tasks-completed', path: 'worktree/tasks-completed-page', spec: 'tasks-completed-page' }
    ,{ available: false, name: 'warps', path: '../warps', spec: 'battle-e2e-testing' }
    ,{ available: false, name: 'mind-advanced-evaluation-metrics', path: '../mind-training/worktree/advanced-evaluation-metrics', spec: 'advanced-evaluation-metrics' }
    ,{ available: false, name: 'wa-tools', path: '../wa-tools', spec: 'fix-all-existing-tests' }
  ],

  // Dashboard port base (ports will be assigned incrementally from this base)
  dashboardPortBase: 3401,

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
  },

  // Automation settings
  automation: {
    maxCycles: 50,  // Maximum automation cycles before stopping
    maxSessionTime: 1800,  // 30 minutes max per session (in seconds)
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
  // Available projects only
  get availableProjects() {
    return CONFIG.projects.filter(p => p.available);
  },

  // Dashboard port assignments (computed incrementally)
  get dashboardPorts() {
    const ports = {};
    CONFIG.projects.forEach((project, index) => {
      ports[project.name] = CONFIG.dashboardPortBase + index;
    });
    return ports;
  },

  // Expected process names (only for available projects)
  get expectedAutomationProcesses() {
    return this.availableProjects.map(p => CONFIG.naming.automationPrefix + p.name);
  },
  get expectedDashboardProcesses() {
    return this.availableProjects.map(p => CONFIG.naming.dashboardPrefix + p.name);
  },

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
      console.log(CONFIG.computed.availableProjects.map(p => p.name).join(' '));
      break;
    case 'available-projects':
      console.log(CONFIG.computed.availableProjects.map(p => p.name).join(' '));
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
      // Return empty array since we don't predefine orphaned processes
      // They are detected dynamically by comparing against expected processes
      console.log('');
      break;
    case 'project-details':
      const projectName = process.argv[3];
      const project = CONFIG.projects.find(p => p.name === projectName);
      if (project) {
        console.log(JSON.stringify(project));
      }
      break;
    case 'max-cycles':
      console.log(CONFIG.automation.maxCycles);
      break;
    case 'max-session-time':
      console.log(CONFIG.automation.maxSessionTime);
      break;
    default:
      console.log(JSON.stringify(CONFIG, null, 2));
  }
}
