#!/usr/bin/env python3
"""
Parallel Development Setup Script

This script prepares isolated development environments for parallel implementation
of atomic specifications. Each spec gets its own git worktree, feature branch,
and configured MCP servers. Optionally integrates with PM2 automation infrastructure.

Features:
    - Creates git worktrees for parallel development
    - Sets up MCP servers for each specification
    - Generates PM2 automation config and runs ecosystem setup
    - Idempotent operation (can be run multiple times safely)
    - Supports dry-run mode for testing

Usage:
    # Basic setup
    python scripts/prepare_parallel_dev.py

    # Dry run to see what would happen
    python scripts/prepare_parallel_dev.py --dry-run

    # Force cleanup all existing worktrees first
    python scripts/prepare_parallel_dev.py --force-cleanup

    # Skip PM2 automation (only create worktrees)
    python scripts/prepare_parallel_dev.py --skip-automation

    # Custom config file
    python scripts/prepare_parallel_dev.py --config my-config.yaml
"""

import os
import sys
import json
import yaml
import subprocess
import argparse
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Union
from dataclasses import dataclass


@dataclass
class MCPServer:
    """Configuration for an MCP server"""
    name: str
    command: str
    description: str = ""
    required: bool = True


@dataclass
class SpecConfig:
    """Configuration for a specification"""
    name: str
    description: str
    worktree_name: str
    feature_branch: str
    mcp_servers: List[str]
    priority: int = 1


class ParallelDevSetup:
    """Main class for setting up parallel development environments"""

    def __init__(self, project_root: Path, config_file: Path, dry_run: bool = False, skip_automation: bool = False):
        self.project_root = project_root
        self.config_file = config_file
        self.dry_run = dry_run
        self.skip_automation = skip_automation
        self.worktree_dir = project_root / "worktree"

        # Load configuration
        self.config = self._load_config()
        self.specs = self._parse_specs()
        self.mcp_servers = self._parse_mcp_servers()

    def _load_config(self) -> Dict:
        """Load configuration from YAML or JSON file"""
        try:
            with open(self.config_file, 'r') as f:
                if self.config_file.suffix.lower() in ['.yaml', '.yml']:
                    return yaml.safe_load(f)
                else:
                    return json.load(f)
        except FileNotFoundError:
            print(f"❌ Configuration file not found: {self.config_file}")
            sys.exit(1)
        except (yaml.YAMLError, json.JSONDecodeError) as e:
            print(f"❌ Error parsing configuration file: {e}")
            sys.exit(1)

    def _parse_specs(self) -> List[SpecConfig]:
        """Parse specification configurations"""
        specs = []
        for spec_data in self.config.get('specifications', []):
            # Generate worktree and branch names
            spec_name = spec_data['name']
            worktree_name = spec_name.replace('_', '-').replace(' ', '-').lower()
            feature_branch = f"feature/{spec_name.replace('_', '-').replace(' ', '-').lower()}"

            spec = SpecConfig(
                name=spec_name,
                description=spec_data.get('description', ''),
                worktree_name=worktree_name,
                feature_branch=feature_branch,
                mcp_servers=spec_data.get('mcp_servers', []),
                priority=spec_data.get('priority', 1)
            )
            specs.append(spec)

        # Sort by priority
        specs.sort(key=lambda x: x.priority)
        return specs

    def _parse_mcp_servers(self) -> Dict[str, MCPServer]:
        """Parse MCP server configurations"""
        servers = {}
        for server_data in self.config.get('mcp_servers', []):
            server = MCPServer(
                name=server_data['name'],
                command=server_data['command'],
                description=server_data.get('description', ''),
                required=server_data.get('required', True)
            )
            servers[server.name] = server
        return servers

    def _run_command(self, cmd: List[str], cwd: Optional[Path] = None, check: bool = True) -> subprocess.CompletedProcess:
        """Execute a command with proper error handling"""
        if self.dry_run:
            print(f"🔍 DRY RUN: {' '.join(cmd)}")
            if cwd:
                print(f"    CWD: {cwd}")
            # Return mock result for dry run
            return subprocess.CompletedProcess(cmd, 0, stdout="mock-output", stderr="")

        try:
            result = subprocess.run(
                cmd,
                cwd=cwd or self.project_root,
                capture_output=True,
                text=True,
                check=check
            )
            return result
        except subprocess.CalledProcessError as e:
            print(f"❌ Command failed: {' '.join(cmd)}")
            print(f"   Error: {e.stderr}")
            if check:
                raise
            return e

    def _ensure_clean_git_state(self):
        """Ensure git repository is in clean state"""
        print("🔍 Checking git repository state...")

        # Check if we're in a git repository
        result = self._run_command(['git', 'rev-parse', '--git-dir'], check=False)
        if result.returncode != 0:
            print("❌ Not in a git repository")
            sys.exit(1)

        # Check for uncommitted changes
        result = self._run_command(['git', 'status', '--porcelain'])
        if result.stdout.strip():
            print("⚠️  Warning: Repository has uncommitted changes")
            if self.dry_run:
                print("🔍 DRY RUN: Would ask for user confirmation, proceeding...")
            else:
                response = input("Continue anyway? (y/N): ")
                if response.lower() != 'y':
                    print("Aborted by user")
                    sys.exit(1)

        # Ensure we're on main branch
        result = self._run_command(['git', 'branch', '--show-current'])
        current_branch = result.stdout.strip()
        if current_branch != 'main':
            print(f"📋 Switching from {current_branch} to main branch...")
            self._run_command(['git', 'checkout', 'main'])

        # Pull latest changes
        print("📥 Pulling latest changes...")
        self._run_command(['git', 'pull', 'origin', 'main'])

    def _check_existing_branch(self, branch_name: str) -> bool:
        """Check if a branch already exists"""
        result = self._run_command(['git', 'branch', '--list', branch_name], check=False)
        return bool(result.stdout.strip())

    def _check_existing_worktree(self, worktree_path: Path) -> bool:
        """Check if a worktree already exists at the given path"""
        result = self._run_command(['git', 'worktree', 'list', '--porcelain'], check=False)
        if result.returncode != 0:
            return False

        for line in result.stdout.split('\n'):
            if line.startswith('worktree '):
                existing_path = Path(line[9:])  # Remove 'worktree ' prefix
                if existing_path == worktree_path:
                    return True
        return False

    def _create_worktree(self, spec: SpecConfig) -> Path:
        """Create git worktree for specification"""
        worktree_path = self.worktree_dir / spec.worktree_name

        print(f"🌳 Creating worktree: {spec.worktree_name}")

        # Check if worktree already exists
        if self._check_existing_worktree(worktree_path):
            print(f"✅ Worktree already exists: {worktree_path}")
            return worktree_path

        # Remove existing worktree directory if it exists but not registered
        if worktree_path.exists():
            print(f"♻️  Removing unregistered worktree directory: {worktree_path}")
            if not self.dry_run:
                shutil.rmtree(worktree_path)

        # Create worktree directory
        if not self.dry_run:
            self.worktree_dir.mkdir(exist_ok=True)

        # Check if branch already exists
        branch_exists = self._check_existing_branch(spec.feature_branch)

        if branch_exists:
            print(f"🌿 Branch {spec.feature_branch} already exists, creating worktree from it")
            # Create worktree from existing branch
            self._run_command([
                'git', 'worktree', 'add',
                str(worktree_path),
                spec.feature_branch
            ])
        else:
            print(f"🌿 Creating new branch: {spec.feature_branch}")
            # Create worktree with new branch
            self._run_command([
                'git', 'worktree', 'add',
                str(worktree_path),
                '-b', spec.feature_branch
            ])

        return worktree_path

    def _setup_mcp_servers(self, spec: SpecConfig, worktree_path: Path):
        """Set up MCP servers for the specification"""
        print(f"🔧 Setting up MCP servers for {spec.name}...")

        for server_name in spec.mcp_servers:
            if server_name not in self.mcp_servers:
                print(f"⚠️  Warning: Unknown MCP server '{server_name}' for {spec.name}")
                continue

            server = self.mcp_servers[server_name]
            print(f"   📡 Adding MCP server: {server.name}")

            # Special handling for serena server (needs project path)
            if server.name == 'serena':
                cmd_parts = server.command.split()
                # Replace $(pwd) with actual worktree path
                cmd_parts = [part.replace('$(pwd)', str(worktree_path)) for part in cmd_parts]
                cmd = cmd_parts  # Use complete command as-is
            else:
                # Parse command and build claude mcp add command
                cmd_parts = server.command.split()
                if cmd_parts[:3] == ['claude', 'mcp', 'add']:
                    cmd = cmd_parts
                else:
                    cmd = ['claude', 'mcp', 'add', server.name] + cmd_parts[2:]  # Assume command starts with server name

            try:
                self._run_command(cmd, cwd=worktree_path, check=False)
            except subprocess.CalledProcessError as e:
                if server.required:
                    print(f"❌ Failed to add required MCP server: {server.name}")
                    raise
                else:
                    print(f"⚠️  Failed to add optional MCP server: {server.name}")

    def _create_spec_readme(self, spec: SpecConfig, worktree_path: Path):
        """Create README for the specification worktree"""
        readme_path = worktree_path / "README_SPEC.md"

        content = f"""# {spec.name.replace('-', ' ').title()} Development Environment

This is an isolated development environment for the **{spec.name}** specification.

## Specification Details

- **Name**: {spec.name}
- **Description**: {spec.description}
- **Feature Branch**: {spec.feature_branch}
- **Priority**: {spec.priority}

## MCP Servers Configured

{chr(10).join(f'- **{server}**: {self.mcp_servers.get(server, MCPServer(server, "", "Unknown server")).description}' for server in spec.mcp_servers)}

## Development Workflow

1. **Start Development**:
   ```bash
   cd {worktree_path.relative_to(self.project_root)}
   ```

2. **Check Specification Tasks**:
   ```bash
   ls .spec-workflow/specs/{spec.name}/
   # Review: requirements.md, design.md, tasks.md
   ```

3. **Implement Tasks**:
   - Mark tasks as in-progress by changing `[ ]` to `[-]` in tasks.md
   - Follow SOLID principles and programming best practices
   - Mark tasks as complete by changing `[-]` to `[x]`

4. **Test Implementation**:
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

5. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat({spec.name}): implement [task description]"
   ```

6. **Push and Create PR**:
   ```bash
   git push origin {spec.feature_branch}
   # Create PR from {spec.feature_branch} to main
   ```

## Programming Principles

This specification enforces:
- ✅ **SOLID Principles** (SRP, OCP, LSP, ISP, DIP)
- ✅ **KISS** (Keep It Simple, Stupid)
- ✅ **DRY/SSOT** (Don't Repeat Yourself / Single Source of Truth)
- ✅ **Contract-driven Design**
- ✅ **Fail-fast Validation**

## Important Notes

- This is an isolated worktree - changes here don't affect the main branch
- MCP servers are pre-configured for this specification
- Follow the task prompts in `.spec-workflow/specs/{spec.name}/tasks.md`
- Each task includes detailed role, restrictions, and success criteria

## Getting Help

- Check task prompts for detailed guidance
- Use MCP servers for documentation and assistance
- Refer to steering documents in `.spec-workflow/steering/`
"""

        if not self.dry_run:
            with open(readme_path, 'w') as f:
                f.write(content)

        print(f"📝 Created specification README: {readme_path.name}")

    def setup_specification(self, spec: SpecConfig):
        """Set up complete development environment for a specification"""
        print(f"\n🚀 Setting up {spec.name} (Priority: {spec.priority})")
        print(f"   📖 {spec.description}")

        # Create worktree
        worktree_path = self._create_worktree(spec)

        # Set up MCP servers
        self._setup_mcp_servers(spec, worktree_path)

        # Create specification README
        self._create_spec_readme(spec, worktree_path)

        print(f"✅ {spec.name} environment ready at: {worktree_path}")
        return worktree_path

    def cleanup_worktrees(self, force_cleanup: bool = False):
        """Clean up existing worktrees (only removes ones not in current config unless forced)"""
        if not self.worktree_dir.exists():
            return

        # List existing worktrees
        result = self._run_command(['git', 'worktree', 'list', '--porcelain'], check=False)
        if result.returncode != 0:
            return

        existing_worktrees = []
        for line in result.stdout.split('\n'):
            if line.startswith('worktree '):
                worktree_path = Path(line[9:])  # Remove 'worktree ' prefix
                if worktree_path.parent == self.worktree_dir:
                    existing_worktrees.append(worktree_path)

        if not existing_worktrees:
            return

        # Get current spec worktree names
        current_spec_paths = {self.worktree_dir / spec.worktree_name for spec in self.specs}

        worktrees_to_remove = []
        if force_cleanup:
            worktrees_to_remove = existing_worktrees
            print("🧹 Force cleaning up ALL existing worktrees...")
        else:
            # Only remove worktrees that are not in current configuration
            worktrees_to_remove = [path for path in existing_worktrees if path not in current_spec_paths]
            if worktrees_to_remove:
                print("🧹 Cleaning up outdated worktrees...")

        for worktree_path in worktrees_to_remove:
            print(f"♻️  Removing worktree: {worktree_path.name}")
            try:
                self._run_command(['git', 'worktree', 'remove', str(worktree_path)], check=False)
            except subprocess.CalledProcessError:
                # Force remove if needed
                if worktree_path.exists() and not self.dry_run:
                    shutil.rmtree(worktree_path)

    def _generate_config_yaml(self, setup_paths: List[tuple]):
        """Generate or update the config.yaml file for PM2 automation"""
        config_yaml_path = self.project_root / "scripts" / "config.yaml"

        print("📝 Generating PM2 automation config...")

        # Calculate dashboard ports incrementally
        dashboard_port_base = 3401
        projects = []

        for i, (spec, path) in enumerate(setup_paths):
            projects.append({
                'name': spec.worktree_name,
                'path': f"./worktree/{spec.worktree_name}",
                'spec': spec.name,
                'available': True
            })

        # Add the main project
        projects.insert(0, {
            'name': 'cc-task-manager',
            'path': '.',
            'spec': 'claude-code-wrapper-specs',
            'available': False
        })

        # Load any existing additional projects from current config.yaml
        existing_projects = []
        if config_yaml_path.exists():
            try:
                with open(config_yaml_path, 'r') as f:
                    existing_config = yaml.safe_load(f)
                    existing_projects = [p for p in existing_config.get('projects', [])
                                      if p.get('name') not in [proj['name'] for proj in projects]]
            except Exception as e:
                print(f"⚠️  Warning: Could not load existing config.yaml: {e}")

        # Add existing projects that aren't worktrees
        projects.extend(existing_projects)

        config_data = {
            'base_cwd': str(self.project_root),
            'projects': projects,
            'dashboard_port_base': dashboard_port_base,
            'static_services': [
                {
                    'name': 'claude-code-viewer',
                    'script': 'server.js',
                    'cwd': '/home/rmondo/repos/claude-code-viewer/dist/standalone',
                    'port': 3400
                }
            ],
            'naming': {
                'automation_prefix': 'spec-workflow-automation-',
                'dashboard_prefix': 'spec-workflow-dashboard-'
            },
            'automation': {
                'max_cycles': 50,
                'max_session_time': 1800  # 30 minutes
            },
            'pm2_defaults': {
                'instances': 1,
                'watch': False,
                'max_memory_restart': '1G',
                'env': {
                    'NODE_ENV': 'production'
                },
                'log_date_format': 'YYYY-MM-DD HH:mm:ss',
                'merge_logs': True,
                'time': True
            },
            'paths': {
                'logs_dir': 'logs',
                'ecosystem_file': 'ecosystem.config.js',
                'automation_script': 'scripts/spec_workflow_automation.py'
            }
        }

        if not self.dry_run:
            config_yaml_path.parent.mkdir(exist_ok=True)
            with open(config_yaml_path, 'w') as f:
                yaml.dump(config_data, f, default_flow_style=False, sort_keys=False)

        print(f"✅ Generated config.yaml with {len(projects)} projects")
        return config_yaml_path

    def _run_ecosystem_generation(self):
        """Run the ecosystem generation script"""
        print("⚙️  Generating PM2 ecosystem configuration...")

        ecosystem_script = self.project_root / "scripts" / "generate-ecosystem.js"
        if not ecosystem_script.exists():
            print(f"⚠️  Warning: Ecosystem script not found: {ecosystem_script}")
            return

        try:
            self._run_command(['node', 'scripts/generate-ecosystem.js'], cwd=self.project_root)
            print("✅ PM2 ecosystem configuration generated")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to generate ecosystem: {e}")
            raise

    def _run_pm2_automation(self):
        """Run PM2 automation script with delete and start commands"""
        print("🚀 Managing PM2 processes...")

        automation_script = self.project_root / "scripts" / "remote-automation.sh"
        if not automation_script.exists():
            print(f"⚠️  Warning: Automation script not found: {automation_script}")
            return

        try:
            # First, delete existing processes
            print("🧹 Stopping existing PM2 processes...")
            self._run_command(['scripts/remote-automation.sh', 'delete'], cwd=self.project_root)

            # Then start new processes
            print("▶️  Starting PM2 processes...")
            self._run_command(['scripts/remote-automation.sh', 'start'], cwd=self.project_root)

            print("✅ PM2 automation complete")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to run PM2 automation: {e}")
            raise

    def run(self, force_cleanup: bool = False):
        """Execute the complete parallel development setup"""
        print("🏗️  Parallel Development Environment Setup")
        print("=" * 50)

        if self.dry_run:
            print("🔍 DRY RUN MODE - No actual changes will be made\n")

        if self.skip_automation:
            print("⏭️  SKIP AUTOMATION MODE - PM2 setup will be skipped\n")

        print(f"📁 Project Root: {self.project_root}")
        print(f"📋 Configuration: {self.config_file}")
        print(f"🎯 Specifications: {len(self.specs)}")
        print(f"🔧 MCP Servers: {len(self.mcp_servers)}")

        # Ensure clean git state
        self._ensure_clean_git_state()

        # Clean up existing worktrees
        self.cleanup_worktrees(force_cleanup)

        # Set up each specification
        setup_paths = []
        for spec in self.specs:
            try:
                path = self.setup_specification(spec)
                setup_paths.append((spec, path))
            except Exception as e:
                print(f"❌ Failed to set up {spec.name}: {e}")
                continue

        # Skip automation if requested
        if not self.skip_automation:
            # Generate PM2 automation config
            try:
                self._generate_config_yaml(setup_paths)
            except Exception as e:
                print(f"⚠️  Warning: Failed to generate config.yaml: {e}")

            # Run ecosystem generation
            try:
                self._run_ecosystem_generation()
            except Exception as e:
                print(f"⚠️  Warning: Failed to generate ecosystem: {e}")

            # Run PM2 automation
            try:
                self._run_pm2_automation()
            except Exception as e:
                print(f"⚠️  Warning: Failed to run PM2 automation: {e}")

        # Print summary
        print("\n" + "=" * 50)
        print("🎉 Parallel Development Setup Complete!")
        print(f"📈 Successfully set up {len(setup_paths)} environments:")

        for spec, path in setup_paths:
            print(f"   🌳 {spec.name}: {path}")

        next_steps = [
            "1. Each developer can work in their assigned worktree",
            "2. Follow the tasks in .spec-workflow/specs/[spec-name]/tasks.md"
        ]

        if not self.skip_automation:
            next_steps.append("3. PM2 processes are running for automation and dashboards")
            next_steps.append("4. Commit regularly and push to feature branches")
            next_steps.append("5. Create PRs when specifications are complete")
        else:
            next_steps.append("3. Run with --no-skip-automation to set up PM2 processes")
            next_steps.append("4. Commit regularly and push to feature branches")
            next_steps.append("5. Create PRs when specifications are complete")

        print(f"\n💡 Next steps:")
        for step in next_steps:
            print(f"   {step}")

        return setup_paths


def create_default_config(config_path: Path):
    """Create a default configuration file"""
    config = {
        "specifications": [
            {
                "name": "database-schema-completion",
                "description": "Complete database schema with repositories and testing",
                "priority": 1,
                "mcp_servers": ["serena", "spec-workflow"]
            },
            {
                "name": "task-crud-api",
                "description": "Task CRUD API with authentication and real-time events",
                "priority": 2,
                "mcp_servers": ["serena", "context7", "spec-workflow"]
            },
            {
                "name": "bullmq-integration",
                "description": "Queue system integration with monitoring and scaling",
                "priority": 3,
                "mcp_servers": ["serena", "context7", "spec-workflow"]
            },
            {
                "name": "dashboard-frontend",
                "description": "Next.js dashboard with real-time updates and responsive design",
                "priority": 4,
                "mcp_servers": ["serena", "context7", "magicuidesign", "spec-workflow"]
            },
            {
                "name": "claude-code-wrapper-integration",
                "description": "Claude Code wrapper integration with streaming and caching",
                "priority": 5,
                "mcp_servers": ["serena", "context7", "spec-workflow"]
            },
            {
                "name": "realtime-websocket-events",
                "description": "WebSocket event system with scaling and monitoring",
                "priority": 6,
                "mcp_servers": ["serena", "context7", "spec-workflow"]
            }
        ],
        "mcp_servers": [
            {
                "name": "dev3000",
                "command": "claude mcp add --transport http dev3000 http://localhost:3684/api/mcp/mcp",
                "description": "Local development MCP server",
                "required": False
            },
            {
                "name": "context7",
                "command": "claude mcp add context7 npx @upstash/context7-mcp@latest",
                "description": "Context7 documentation and code examples",
                "required": True
            },
            {
                "name": "magicuidesign",
                "command": "claude mcp add magicuidesign npx @magicuidesign/mcp@latest",
                "description": "Magic UI design components",
                "required": False
            },
            {
                "name": "playwright",
                "command": "claude mcp add playwright npx @playwright/mcp@latest",
                "description": "Playwright browser testing",
                "required": False
            },
            {
                "name": "serena",
                "command": "claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)",
                "description": "Serena semantic code understanding",
                "required": True
            },
            {
                "name": "spec-workflow",
                "command": "claude mcp add spec-workflow npx @pimzino/spec-workflow-mcp@latest $(pwd)",
                "description": "Specification workflow management",
                "required": True
            }
        ]
    }

    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    print(f"📝 Created default configuration: {config_path}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Set up parallel development environments for atomic specifications"
    )
    parser.add_argument(
        '--config', '-c',
        type=Path,
        default=Path('parallel.yaml'),
        help='Configuration file (YAML or JSON)'
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help='Show what would be done without making changes'
    )
    parser.add_argument(
        '--create-config',
        action='store_true',
        help='Create a default configuration file'
    )
    parser.add_argument(
        '--force-cleanup',
        action='store_true',
        help='Force cleanup of ALL existing worktrees before setup'
    )
    parser.add_argument(
        '--skip-automation',
        action='store_true',
        help='Skip PM2 automation setup (only create worktrees and MCP servers)'
    )

    args = parser.parse_args()

    # Get project root
    project_root = Path.cwd()

    # Create default config if requested
    if args.create_config:
        create_default_config(args.config)
        return

    # Check if config file exists
    if not args.config.exists():
        print(f"❌ Configuration file not found: {args.config}")
        print(f"💡 Create a default config with: python {sys.argv[0]} --create-config")
        sys.exit(1)

    # Set up parallel development environments
    try:
        setup = ParallelDevSetup(project_root, args.config, args.dry_run, args.skip_automation)
        setup.run(args.force_cleanup)
    except KeyboardInterrupt:
        print("\n⏹️  Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()