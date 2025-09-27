#!/usr/bin/env node

// Import unified configuration
const CONFIG = require('./config.js');

function generateEcosystemConfig() {
  const apps = [];

  // Generate automation apps
  CONFIG.projects.forEach(project => {
    apps.push({
      name: CONFIG.naming.automationPrefix + project.name,
      script: '/usr/bin/python3',
      args: [
        CONFIG.paths.automationScript,
        '--spec-name', project.spec,
        '--project', project.path,
        '--session-log', `${CONFIG.paths.logsDir}/spec-workflow-${project.name}.jsonl`
      ],
      cwd: CONFIG.baseCwd,
      autorestart: false,
      error_file: `${CONFIG.paths.logsDir}/pm2-spec-workflow-${project.name}-error.log`,
      out_file: `${CONFIG.paths.logsDir}/pm2-spec-workflow-${project.name}-out.log`,
      ...CONFIG.pm2Defaults
    });
  });

  // Generate dashboard apps
  CONFIG.projects.forEach(project => {
    const projectPath = project.path === '.' ? CONFIG.baseCwd : project.path;
    apps.push({
      name: CONFIG.naming.dashboardPrefix + project.name,
      script: 'npx',
      args: [
        '-y',
        '@pimzino/spec-workflow-mcp@latest',
        projectPath,
        '--dashboard',
        '--port',
        CONFIG.dashboardPorts[project.name].toString()
      ],
      cwd: CONFIG.baseCwd,
      autorestart: true,
      error_file: `${CONFIG.paths.logsDir}/pm2-dashboard-${project.name}-error.log`,
      out_file: `${CONFIG.paths.logsDir}/pm2-dashboard-${project.name}-out.log`,
      ...CONFIG.pm2Defaults
    });
  });

  // Add static services
  CONFIG.staticServices.forEach(service => {
    apps.push({
      name: service.name,
      script: service.script,
      cwd: service.cwd,
      autorestart: true,
      env: { ...CONFIG.pm2Defaults.env, ...(service.port && { PORT: service.port.toString() }) },
      error_file: `${CONFIG.paths.logsDir}/pm2-${service.name}-error.log`,
      out_file: `${CONFIG.paths.logsDir}/pm2-${service.name}-out.log`,
      ...CONFIG.pm2Defaults
    });
  });

  return { apps };
}

// Generate and write the config
const config = generateEcosystemConfig();
const fs = require('fs');
const path = require('path');

const configContent = `module.exports = ${JSON.stringify(config, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, `../${CONFIG.paths.ecosystemFile}`), configContent);
console.log(`Generated ${CONFIG.paths.ecosystemFile}`);