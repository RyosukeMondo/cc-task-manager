#!/usr/bin/env node

/**
 * Parallel Development Setup - SSOT Script
 *
 * ============================================================================
 * WHEN TO USE THIS SCRIPT:
 * ============================================================================
 * Use this for SINGLE-PROJECT parallel development (developing multiple specs
 * within ONE project using parallel.yaml configuration).
 *
 * For CROSS-PROJECT automation (e.g., cc-task-manager → mind-training):
 * → Edit scripts/config.js and use generate-ecosystem.js instead
 * → See parallel_how_to.md for complete cross-project setup guide
 * ============================================================================
 *
 * Comprehensive automation for parallel spec development:
 * 1. Create git worktrees for each available spec
 * 2. Create/checkout feature branches
 * 3. Install MCP servers in each worktree
 * 4. Update main branch config.js with available specs
 * 5. Generate ecosystem.config.js
 * 6. Start PM2 automation processes
 * 7. Verify all processes are running
 *
 * Usage:
 *   node scripts/parallel_dev.js                 # Full setup and start
 *   node scripts/parallel_dev.js --dry-run       # Preview without changes
 *   node scripts/parallel_dev.js --setup-only    # Setup without starting PM2
 *   node scripts/parallel_dev.js --verify-only   # Only verify running processes
 *   node scripts/parallel_dev.js --cleanup       # Remove all worktrees
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  const { silent = false, ignoreError = false, cwd } = options;
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
      cwd: cwd || process.cwd(),
    });
    return silent ? result.trim() : '';
  } catch (error) {
    if (!ignoreError) {
      throw error;
    }
    return '';
  }
}

class ParallelDevSetup {
  constructor(configPath, options = {}) {
    this.configPath = configPath;
    this.options = options;
    this.config = null;
    this.projectRoot = process.cwd();
  }

  loadConfig() {
    log('📖 Loading configuration from parallel.yaml...', 'blue');

    // Check if parallel.yaml exists
    if (!fs.existsSync(this.configPath)) {
      log('✗ parallel.yaml not found!', 'red');
      log('', 'reset');
      log('First time setup:', 'yellow');
      log('  1. Copy the template: cp parallel.yaml.example parallel.yaml', 'cyan');
      log('  2. Edit parallel.yaml and set available: true for specs you want to develop', 'cyan');
      log('  3. Run this script again: node scripts/parallel_dev.js', 'cyan');
      log('', 'reset');
      throw new Error('parallel.yaml not found - see instructions above');
    }

    const configContent = fs.readFileSync(this.configPath, 'utf8');
    this.config = yaml.load(configContent);

    // Validate config
    if (!this.config.specifications || !Array.isArray(this.config.specifications)) {
      throw new Error('Invalid config: specifications array not found');
    }

    log(`✓ Loaded ${this.config.specifications.length} specifications`, 'green');
  }

  // Phase 0: Validate Python dependencies
  validatePythonDependencies() {
    log(`\n🐍 Phase 0: Validating Python dependencies...`, 'cyan');

    const pythonPath = path.join(this.projectRoot, this.config.base.python_venv);

    if (!fs.existsSync(pythonPath)) {
      log(`  ✗ Python venv not found: ${pythonPath}`, 'red');
      log('', 'reset');
      log('Setup Python virtual environment:', 'yellow');
      log('  1. python3 -m venv .venv', 'cyan');
      log('  2. source .venv/bin/activate', 'cyan');
      log('  3. pip install -r requirements.txt', 'cyan');
      log('', 'reset');
      throw new Error('Python venv not found - see instructions above');
    }

    // Check if claude-code-sdk is installed
    try {
      const checkCommand = `${pythonPath} -c "import claude_code_sdk; print(claude_code_sdk.__version__)"`;
      const version = execCommand(checkCommand, { silent: true });
      log(`  ✓ claude-code-sdk installed: v${version}`, 'green');
    } catch (error) {
      log(`  ✗ claude-code-sdk not installed!`, 'red');
      log('', 'reset');
      log('Install required Python package:', 'yellow');
      log('  source .venv/bin/activate', 'cyan');
      log('  pip install -r requirements.txt', 'cyan');
      log('', 'reset');
      log('Or install manually:', 'yellow');
      log('  pip install claude-code-sdk>=0.0.25', 'cyan');
      log('', 'reset');
      throw new Error('claude-code-sdk not installed - required for automation');
    }

    // Check if anthropic is installed
    try {
      const checkCommand = `${pythonPath} -c "import anthropic; print(anthropic.__version__)"`;
      const version = execCommand(checkCommand, { silent: true });
      log(`  ✓ anthropic installed: v${version}`, 'green');
    } catch (error) {
      log(`  ⚠ anthropic package not installed`, 'yellow');
      log('  Install with: pip install anthropic>=0.69.0', 'cyan');
    }
  }

  getAvailableSpecs() {
    return this.config.specifications
      .filter(spec => spec.available === true)
      .sort((a, b) => a.priority - b.priority);
  }

  getAllSpecs() {
    return this.config.specifications;
  }

  // Phase 1: Create worktrees and feature branches
  setupWorktrees() {
    const availableSpecs = this.getAvailableSpecs();
    log(`\n🌳 Phase 1: Setting up worktrees for ${availableSpecs.length} specs...`, 'cyan');

    for (const spec of availableSpecs) {
      const worktreePath = path.join(this.config.base.worktree_dir, spec.name);
      const branchName = `feature/${spec.name}`;

      log(`\n  Processing: ${spec.name}`, 'bright');

      // Check if worktree already exists
      const existingWorktrees = execCommand('git worktree list', { silent: true });
      const worktreeExists = existingWorktrees.includes(worktreePath);

      if (worktreeExists) {
        log(`  ✓ Worktree already exists: ${worktreePath}`, 'yellow');
        continue;
      }

      if (this.options.dryRun) {
        log(`  [DRY RUN] Would create worktree: ${worktreePath}`, 'yellow');
        log(`  [DRY RUN] Would create branch: ${branchName}`, 'yellow');
        continue;
      }

      // Check if branch exists
      const branchExists = execCommand(`git rev-parse --verify ${branchName}`, {
        silent: true,
        ignoreError: true
      });

      if (branchExists) {
        log(`  ✓ Branch exists, checking out: ${branchName}`, 'green');
        execCommand(`git worktree add ${worktreePath} ${branchName}`);
      } else {
        log(`  ✓ Creating new branch and worktree: ${branchName}`, 'green');
        execCommand(`git worktree add -b ${branchName} ${worktreePath} ${this.config.base.base_branch}`);
      }

      log(`  ✓ Worktree created: ${worktreePath}`, 'green');
    }
  }

  // Phase 2: Install MCP servers
  setupMCPServers() {
    const availableSpecs = this.getAvailableSpecs();
    log(`\n🔧 Phase 2: Installing MCP servers...`, 'cyan');

    for (const spec of availableSpecs) {
      const worktreePath = path.join(this.projectRoot, this.config.base.worktree_dir, spec.name);

      if (!fs.existsSync(worktreePath)) {
        log(`  ⚠ Worktree not found, skipping MCP setup: ${spec.name}`, 'yellow');
        continue;
      }

      log(`\n  Installing MCP servers for: ${spec.name}`, 'bright');

      for (const mcpServerName of spec.mcp_servers) {
        const mcpServer = this.config.mcp_servers.find(s => s.name === mcpServerName);
        if (!mcpServer) {
          log(`    ⚠ MCP server definition not found: ${mcpServerName}`, 'yellow');
          continue;
        }

        // Replace {project_path} placeholder
        let command = mcpServer.command.replace('{project_path}', worktreePath);

        // Full command with cd
        const fullCommand = `cd ${worktreePath} && ${command}`;

        if (this.options.dryRun) {
          log(`    [DRY RUN] Would run: ${fullCommand}`, 'yellow');
          continue;
        }

        try {
          log(`    Installing: ${mcpServerName}...`, 'blue');
          execCommand(fullCommand, { silent: false });
          log(`    ✓ Installed: ${mcpServerName}`, 'green');
        } catch (error) {
          if (mcpServer.required) {
            log(`    ✗ Failed to install required MCP server: ${mcpServerName}`, 'red');
            throw error;
          } else {
            log(`    ⚠ Failed to install optional MCP server: ${mcpServerName}`, 'yellow');
          }
        }
      }
    }
  }

  // Phase 3: Update config.js in main branch
  updateConfigJS() {
    log(`\n📝 Phase 3: Updating scripts/config.js...`, 'cyan');

    const configJSPath = path.join(this.projectRoot, 'scripts/config.js');

    if (!fs.existsSync(configJSPath)) {
      log(`  ✗ scripts/config.js not found!`, 'red');
      throw new Error('scripts/config.js not found');
    }

    if (this.options.dryRun) {
      log(`  [DRY RUN] Would update config.js with available specs`, 'yellow');
      return;
    }

    // Read current config.js
    let configContent = fs.readFileSync(configJSPath, 'utf8');

    // Find the projects array and update available flags
    const allSpecs = this.getAllSpecs();

    for (const spec of allSpecs) {
      // Match pattern: { available: true/false, name: 'spec-name', ...}
      const pattern = new RegExp(
        `(\\{\\s*available:\\s*)(true|false)(\\s*,\\s*name:\\s*['"]${spec.name}['"])`,
        'g'
      );

      const newAvailable = spec.available ? 'true' : 'false';
      configContent = configContent.replace(pattern, `$1${newAvailable}$3`);
    }

    fs.writeFileSync(configJSPath, configContent, 'utf8');
    log(`  ✓ Updated config.js with availability flags`, 'green');
  }

  // Phase 4: Generate ecosystem.config.js
  generateEcosystem() {
    log(`\n🏗️  Phase 4: Generating ecosystem.config.js...`, 'cyan');

    if (this.options.dryRun) {
      log(`  [DRY RUN] Would run: node scripts/generate-ecosystem.js`, 'yellow');
      return;
    }

    const generateScript = path.join(this.projectRoot, 'scripts/generate-ecosystem.js');

    if (!fs.existsSync(generateScript)) {
      log(`  ✗ scripts/generate-ecosystem.js not found!`, 'red');
      throw new Error('generate-ecosystem.js not found');
    }

    try {
      execCommand('node scripts/generate-ecosystem.js');
      log(`  ✓ Generated ecosystem.config.js`, 'green');
    } catch (error) {
      log(`  ✗ Failed to generate ecosystem.config.js`, 'red');
      throw error;
    }
  }

  // Phase 5: Start PM2 processes
  startAutomation() {
    log(`\n🚀 Phase 5: Starting PM2 automation...`, 'cyan');

    if (this.options.dryRun) {
      log(`  [DRY RUN] Would run: ./scripts/remote-automation.sh start`, 'yellow');
      return;
    }

    const automationScript = path.join(this.projectRoot, 'scripts/remote-automation.sh');

    if (!fs.existsSync(automationScript)) {
      log(`  ✗ scripts/remote-automation.sh not found!`, 'red');
      throw new Error('remote-automation.sh not found');
    }

    try {
      // First delete all processes
      log(`  Stopping existing PM2 processes...`, 'blue');
      execCommand('./scripts/remote-automation.sh delete', { ignoreError: true });

      // Start new processes
      log(`  Starting PM2 processes...`, 'blue');
      execCommand('./scripts/remote-automation.sh start');

      log(`  ✓ PM2 automation started`, 'green');
    } catch (error) {
      log(`  ✗ Failed to start PM2 automation`, 'red');
      throw error;
    }
  }

  // Phase 6: Verify processes
  verifyProcesses() {
    log(`\n✅ Phase 6: Verifying PM2 processes...`, 'cyan');

    if (this.options.dryRun) {
      log(`  [DRY RUN] Would verify PM2 processes`, 'yellow');
      return;
    }

    try {
      const pm2List = execCommand('pm2 jlist', { silent: true });
      const processes = JSON.parse(pm2List);

      const availableSpecs = this.getAvailableSpecs();
      const expectedProcesses = [];

      // Build expected process names
      for (const spec of availableSpecs) {
        expectedProcesses.push(`spec-workflow-automation-${spec.name}`);
        expectedProcesses.push(`spec-workflow-dashboard-${spec.name}`);
      }

      // Add static services
      if (this.config.static_services) {
        for (const service of this.config.static_services) {
          expectedProcesses.push(service.name);
        }
      }

      log(`\n  Expected processes: ${expectedProcesses.length}`, 'bright');
      log(`  Running processes: ${processes.length}`, 'bright');

      let allRunning = true;

      for (const expectedName of expectedProcesses) {
        const process = processes.find(p => p.name === expectedName);

        if (!process) {
          log(`  ✗ Missing: ${expectedName}`, 'red');
          allRunning = false;
        } else if (process.pm2_env.status !== 'online') {
          log(`  ✗ Not online: ${expectedName} (${process.pm2_env.status})`, 'red');
          allRunning = false;
        } else {
          log(`  ✓ Running: ${expectedName}`, 'green');
        }
      }

      if (allRunning) {
        log(`\n  ✓ All expected processes are running!`, 'green');
      } else {
        log(`\n  ⚠ Some processes are not running correctly`, 'yellow');
      }

      return allRunning;
    } catch (error) {
      log(`  ✗ Failed to verify processes`, 'red');
      log(`  Error: ${error.message}`, 'red');
      return false;
    }
  }

  // Cleanup: Remove all worktrees
  cleanup() {
    log(`\n🧹 Cleaning up worktrees...`, 'cyan');

    const worktreeList = execCommand('git worktree list --porcelain', { silent: true });
    const worktrees = worktreeList.split('\n\n').filter(w => w.includes('worktree/'));

    for (const worktree of worktrees) {
      const pathMatch = worktree.match(/worktree (.+)/);
      if (pathMatch) {
        const worktreePath = pathMatch[1];

        if (this.options.dryRun) {
          log(`  [DRY RUN] Would remove: ${worktreePath}`, 'yellow');
          continue;
        }

        try {
          execCommand(`git worktree remove ${worktreePath} --force`);
          log(`  ✓ Removed: ${worktreePath}`, 'green');
        } catch (error) {
          log(`  ⚠ Failed to remove: ${worktreePath}`, 'yellow');
        }
      }
    }

    // Prune deleted worktrees
    if (!this.options.dryRun) {
      execCommand('git worktree prune');
      log(`  ✓ Pruned deleted worktrees`, 'green');
    }
  }

  // Main execution
  async run() {
    try {
      log('\n╔════════════════════════════════════════════════════════════╗', 'bright');
      log('║        Parallel Development Setup - SSOT Script           ║', 'bright');
      log('╚════════════════════════════════════════════════════════════╝\n', 'bright');

      this.loadConfig();

      if (this.options.cleanup) {
        this.cleanup();
        return;
      }

      if (this.options.verifyOnly) {
        this.verifyProcesses();
        return;
      }

      // Full setup flow
      this.validatePythonDependencies();
      this.setupWorktrees();
      this.setupMCPServers();

      if (!this.options.setupOnly) {
        this.updateConfigJS();
        this.generateEcosystem();
        this.startAutomation();
        this.verifyProcesses();
      }

      log('\n╔════════════════════════════════════════════════════════════╗', 'green');
      log('║                  ✓ Setup Complete!                        ║', 'green');
      log('╚════════════════════════════════════════════════════════════╝\n', 'green');

      const availableSpecs = this.getAvailableSpecs();
      log('📊 Summary:', 'bright');
      log(`  • Worktrees created: ${availableSpecs.length}`, 'blue');
      log(`  • MCP servers installed: ${availableSpecs.length * availableSpecs[0].mcp_servers.length}`, 'blue');
      log(`  • PM2 processes: ${availableSpecs.length * 2} (automation + dashboard)`, 'blue');

      log('\n🎯 Next steps:', 'bright');
      log(`  • View dashboards: http://localhost:${this.config.base.dashboard_port_base}-${this.config.base.dashboard_port_base + availableSpecs.length - 1}`, 'cyan');
      log(`  • Check logs: ./scripts/remote-automation.sh logs <spec-name>`, 'cyan');
      log(`  • Monitor: pm2 monit`, 'cyan');

    } catch (error) {
      log('\n✗ Setup failed!', 'red');
      log(`Error: ${error.message}`, 'red');
      process.exit(1);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  setupOnly: args.includes('--setup-only'),
  verifyOnly: args.includes('--verify-only'),
  cleanup: args.includes('--cleanup'),
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Parallel Development Setup - SSOT Script

Usage:
  node scripts/parallel_dev.js [options]

Options:
  --dry-run       Preview all actions without making changes
  --setup-only    Only setup worktrees and MCP servers (no PM2 start)
  --verify-only   Only verify PM2 processes are running
  --cleanup       Remove all worktrees and branches
  --help, -h      Show this help message

Examples:
  node scripts/parallel_dev.js                 # Full setup and start
  node scripts/parallel_dev.js --dry-run       # Preview changes
  node scripts/parallel_dev.js --setup-only    # Setup without PM2
  node scripts/parallel_dev.js --verify-only   # Check processes
  node scripts/parallel_dev.js --cleanup       # Clean up worktrees
  `);
  process.exit(0);
}

// Check for js-yaml dependency
try {
  require.resolve('js-yaml');
} catch (e) {
  log('✗ Missing dependency: js-yaml', 'red');
  log('Installing js-yaml...', 'blue');
  execSync('npm install js-yaml', { stdio: 'inherit' });
}

// Run the setup
const configPath = path.join(process.cwd(), 'parallel.yaml');
const setup = new ParallelDevSetup(configPath, options);
setup.run();
