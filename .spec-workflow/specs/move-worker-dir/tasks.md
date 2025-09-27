# Tasks Document

- [x] 1. Create apps directory structure and worker application skeleton
  - File: apps/worker/package.json, apps/worker/src/main.ts, apps/worker/tsconfig.json
  - Create the basic application structure following the monorepo pattern
  - Set up independent package.json with NestJS application dependencies
  - Purpose: Establish worker as standalone application
  - _Leverage: Existing NestJS configuration patterns, root package.json workspace setup_
  - _Requirements: 2.1, 3.1_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: DevOps Engineer specializing in monorepo architecture and NestJS applications | Task: Create apps/worker directory structure with independent package.json, main.ts entry point, and tsconfig.json following requirements 2.1 and 3.1, establishing worker as standalone NestJS application in monorepo | Restrictions: Do not modify existing worker code yet, maintain compatibility with existing dependencies, follow workspace package conventions | Success: Apps directory created with proper worker structure, package.json includes correct NestJS dependencies, tsconfig configured for independent compilation_

- [ ] 2. Move worker source code to apps/worker/src
  - File: apps/worker/src/ (all worker TypeScript files)
  - Relocate all files from src/worker/ to apps/worker/src/ maintaining directory structure
  - Preserve file organization: processors, claude-code, monitoring subdirectories
  - Purpose: Organize worker source code in new application structure
  - _Leverage: Existing worker file organization, current import patterns_
  - _Requirements: 3.2, 3.3_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Backend Developer with expertise in code organization and file system operations | Task: Move all worker source files from src/worker/ to apps/worker/src/ following requirements 3.2 and 3.3, preserving existing directory structure and file organization | Restrictions: Do not modify file contents during move, maintain exact directory structure, preserve file permissions and timestamps | Success: All worker files relocated correctly, directory structure preserved under apps/worker/src/, no files lost or corrupted_

- [ ] 3. Update import paths throughout worker application
  - File: apps/worker/src/ (all TypeScript files with imports)
  - Fix all import statements to reflect new file locations and workspace packages
  - Update relative imports between worker modules
  - Purpose: Ensure all module dependencies resolve correctly in new structure
  - _Leverage: TypeScript compiler error reporting, existing import patterns_
  - _Requirements: 1.3, 2.2_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer with expertise in module systems and import resolution | Task: Update all import paths in worker application following requirements 1.3 and 2.2, fixing relative imports and configuring workspace package imports | Restrictions: Do not change functionality, only update import paths, ensure all imports resolve correctly, maintain type safety | Success: All imports resolve without errors, TypeScript compilation succeeds, no broken dependencies_

- [ ] 4. Configure worker as workspace package in root package.json
  - File: package.json (root), apps/worker/package.json
  - Add worker to workspaces configuration in root package.json
  - Configure proper workspace dependencies and scripts
  - Purpose: Integrate worker into monorepo build and dependency management
  - _Leverage: Existing workspace configuration, npm workspace patterns_
  - _Requirements: 2.1_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Package Manager specialist with expertise in npm workspaces and monorepo configuration | Task: Configure worker as workspace package following requirement 2.1, adding to root package.json workspaces and setting up proper dependency management | Restrictions: Do not break existing workspace configuration, maintain dependency version consistency, ensure workspace scripts work correctly | Success: Worker recognized as workspace package, dependencies resolve correctly, npm workspace commands work for worker_

- [ ] 5. Update configuration imports to use shared packages
  - File: apps/worker/src/worker.module.ts, apps/worker/src/main.ts
  - Update configuration imports to use @cc-task-manager/schemas and @cc-task-manager/types
  - Replace relative config imports with workspace package imports
  - Purpose: Use shared configuration patterns and maintain consistency
  - _Leverage: Existing configuration structure, shared workspace packages_
  - _Requirements: 1.2, 2.2_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Configuration Engineer with expertise in NestJS configuration and workspace packages | Task: Update configuration imports following requirements 1.2 and 2.2, replacing relative imports with workspace package imports from @cc-task-manager/schemas and @cc-task-manager/types | Restrictions: Maintain existing configuration behavior, do not change configuration values, ensure type safety preserved | Success: Configuration imports use workspace packages, all configuration loads correctly, type safety maintained_

- [ ] 6. Move and update worker tests to new structure
  - File: apps/worker/src/tests/ (moved from src/worker/tests/)
  - Relocate worker tests and update import paths
  - Update test configuration to work with new application structure
  - Purpose: Maintain test coverage and ensure tests work in new structure
  - _Leverage: Existing test files, Jest configuration patterns_
  - _Requirements: 1.5_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer with expertise in Jest testing and test migration | Task: Move worker tests and update configuration following requirement 1.5, ensuring all tests work in new application structure | Restrictions: Do not modify test logic, only update imports and configuration, maintain test coverage, preserve test isolation | Success: All worker tests relocated and working, import paths updated correctly, test coverage maintained_

- [ ] 7. Create worker application main.ts entry point
  - File: apps/worker/src/main.ts
  - Implement standalone NestJS application bootstrap
  - Configure application-specific settings and graceful shutdown
  - Purpose: Enable worker to run as independent application
  - _Leverage: Existing NestJS bootstrap patterns, worker module structure_
  - _Requirements: 2.1, 2.2_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: NestJS Developer with expertise in application bootstrap and lifecycle management | Task: Create worker application entry point following requirements 2.1 and 2.2, implementing NestJS bootstrap with proper configuration and graceful shutdown | Restrictions: Do not duplicate existing backend configuration, maintain worker-specific settings, ensure proper error handling | Success: Worker runs as standalone application, graceful shutdown works correctly, application-specific configuration loaded_

- [ ] 8. Update build configuration for independent worker compilation
  - File: apps/worker/tsconfig.json, apps/worker/nest-cli.json
  - Configure TypeScript compilation for worker application
  - Set up NestJS CLI configuration for independent builds
  - Purpose: Enable independent building and deployment of worker
  - _Leverage: Existing TypeScript configuration, NestJS CLI patterns_
  - _Requirements: 2.1_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Build Engineer with expertise in TypeScript compilation and NestJS CLI | Task: Configure build system for independent worker compilation following requirement 2.1, setting up TypeScript and NestJS CLI for standalone builds | Restrictions: Do not break existing build processes, ensure compatibility with workspace packages, maintain build performance | Success: Worker compiles independently, build artifacts generated correctly, no circular dependencies_

- [ ] 9. Remove old src/worker directory and update references
  - File: src/worker/ (delete), src/app.module.ts, other files importing WorkerModule
  - Remove the old worker directory after successful migration
  - Update any remaining references to old worker location
  - Purpose: Clean up obsolete code and complete the migration
  - _Leverage: Search and replace tools, dependency analysis_
  - _Requirements: 1.4_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Cleanup Specialist with expertise in code migration and dependency management | Task: Remove old worker directory and update references following requirement 1.4, completing the migration safely | Restrictions: Verify all functionality works before deletion, do not remove files still in use, ensure no broken imports remain | Success: Old worker directory removed, no broken references, all imports point to new location_

- [ ] 10. Update documentation and scripts for new worker structure
  - File: README.md, package.json scripts, docker configurations
  - Update documentation to reflect new worker application structure
  - Modify build and development scripts to handle worker independently
  - Purpose: Ensure development workflow supports new structure
  - _Leverage: Existing documentation patterns, script configurations_
  - _Requirements: 2.3_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Documentation Engineer with expertise in technical writing and development workflows | Task: Update documentation and scripts following requirement 2.3, reflecting new worker application structure and independent operation | Restrictions: Maintain existing script functionality, ensure documentation accuracy, preserve development workflow efficiency | Success: Documentation updated correctly, scripts work with new structure, development workflow uninterrupted_

- [ ] 11. Verify worker functionality and run integration tests
  - File: All worker-related functionality
  - Test worker startup, job processing, and queue integration
  - Verify all existing functionality works in new structure
  - Purpose: Ensure migration completed successfully without functionality loss
  - _Leverage: Existing test suites, integration test patterns_
  - _Requirements: 1.1, 1.5_
  - _Prompt: Implement the task for spec move-worker-dir, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer with expertise in integration testing and system validation | Task: Verify worker functionality following requirements 1.1 and 1.5, running comprehensive tests to ensure migration success | Restrictions: Do not modify functionality during testing, report any issues found, ensure all tests pass before completion | Success: All worker functionality verified, integration tests pass, no regression issues detected_