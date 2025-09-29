#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Import unified configuration from YAML
const configPath = path.join(__dirname, 'config.yaml');

if (!fs.existsSync(configPath)) {
  console.error('❌ config.yaml not found. Please run prepare_parallel_dev.py first.');
  process.exit(1);
}

const CONFIG_RAW = yaml.load(fs.readFileSync(configPath, 'utf8'));

// Transform YAML config to match the expected structure
const CONFIG = {
  baseCwd: CONFIG_RAW.base_cwd,
  naming: {
    automationPrefix: CONFIG_RAW.naming.automation_prefix,
    dashboardPrefix: CONFIG_RAW.naming.dashboard_prefix
  },
  paths: {
    ecosystemFile: CONFIG_RAW.paths.ecosystem_file,
    logsDir: CONFIG_RAW.paths.logs_dir,
    automationScript: CONFIG_RAW.paths.automation_script
  },
  pm2Defaults: CONFIG_RAW.pm2_defaults,
  staticServices: CONFIG_RAW.static_services || [],
  computed: {
    availableProjects: CONFIG_RAW.projects.filter(p => p.available),
    dashboardPorts: {}
  }
};

// Calculate dashboard ports
CONFIG.computed.availableProjects.forEach((project, index) => {
  CONFIG.computed.dashboardPorts[project.name] = CONFIG_RAW.dashboard_port_base + index;
});

function generateEcosystemConfig() {
  const apps = [];

  // Generate automation apps
  CONFIG.computed.availableProjects.forEach(project => {
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
  CONFIG.computed.availableProjects.forEach(project => {
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
        CONFIG.computed.dashboardPorts[project.name].toString()
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

const configContent = `module.exports = ${JSON.stringify(config, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, `../${CONFIG.paths.ecosystemFile}`), configContent);
console.log(`✅ Generated ${CONFIG.paths.ecosystemFile} from config.yaml`);