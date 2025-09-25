# Tasks Document

- [ ] 1. Setup project dependencies and configuration
  - File: package.json, src/config/worker.config.ts
  - Install required libraries: @nestjs/bullmq, bullmq, zod, pino, chokidar, lodash-es
  - Create worker configuration schema with Zod validation
  - Purpose: Establish foundation with proven library stack for worker system
  - _Leverage: existing @nestjs/config setup, package.json structure_
  - _Requirements: 1.1, 1.2_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: DevOps Engineer specializing in Node.js project setup and dependency management | Task: Install and configure all required dependencies for the claude-code-manage worker system following requirements 1.1 and 1.2, including @nestjs/bullmq, bullmq, zod, pino, chokidar, and lodash-es with proper version specifications | Restrictions: Use exact versions from design document, ensure compatibility with existing NestJS setup, do not modify existing core dependencies | _Leverage: existing package.json and @nestjs/config patterns | _Requirements: 1.1 (Claude Code Process Invocation), 1.2 (Real-time Process Monitoring) | Success: All dependencies installed correctly, Zod configuration schema validates worker settings, compatible with existing project structure | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_

- [ ] 2. Create Python wrapper script for Claude Code SDK integration
  - File: scripts/claude_wrapper.py
  - Implement Python script with Claude Code SDK integration and structured JSON output
  - Add signal handling for graceful shutdown (SIGTERM/SIGKILL)
  - Purpose: Bridge between Node.js worker and Claude Code Python SDK
  - _Leverage: Claude Code Python SDK documentation and patterns from tech research_
  - _Requirements: 1.1, 1.3_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Python Developer with expertise in Claude Code SDK and inter-process communication | Task: Create Python wrapper script that interfaces with Claude Code SDK, processes stdin prompts, outputs structured JSON to stdout, and handles SIGTERM signals gracefully following requirements 1.1 and 1.3 | Restrictions: Must use structured JSON output only, handle signals properly for graceful shutdown, never log sensitive prompt data | _Leverage: Claude Code SDK best practices from tech research documents | _Requirements: 1.1 (Claude Code Process Invocation), 1.3 (Process Lifecycle Management) | Success: Script successfully invokes Claude Code SDK, outputs valid JSON progress updates, handles shutdown signals gracefully | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_

- [ ] 3. Implement ProcessManager service for process spawning and lifecycle
  - File: src/worker/process-manager.service.ts
  - Create NestJS service using child_process.spawn for secure process creation
  - Add PID tracking, process termination, and health checking methods
  - Purpose: Manage Claude Code process lifecycle with security and reliability
  - _Leverage: NestJS injectable patterns, child_process module, Pino logger_
  - _Requirements: 1.1, 1.3_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Backend Developer specializing in Node.js process management and NestJS services | Task: Implement ProcessManager service using child_process.spawn for secure Claude Code process spawning, PID tracking, and lifecycle management following requirements 1.1 and 1.3 | Restrictions: Must use spawn() not exec() for security, implement proper signal handling, log all process events with correlation IDs | _Leverage: NestJS @Injectable() patterns, existing Pino logger configuration, Zod validation | _Requirements: 1.1 (Claude Code Process Invocation), 1.3 (Process Lifecycle Management) | Success: Service spawns processes securely, tracks PIDs accurately, terminates processes gracefully with SIGTERM/SIGKILL escalation | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_

- [ ] 4. Implement StateMonitor service for real-time process monitoring
  - File: src/worker/state-monitor.service.ts
  - Use chokidar to monitor Claude Code session files for activity detection
  - Implement PID monitoring and state transition logic with lodash utilities
  - Purpose: Provide multi-layer monitoring for process health and activity
  - _Leverage: chokidar file watcher, lodash-es utilities, BullMQ events_
  - _Requirements: 1.2, 1.4_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Systems Engineer with expertise in file system monitoring and real-time state management | Task: Implement StateMonitor service using chokidar for file system monitoring, PID health checks, and state transitions following requirements 1.2 and 1.4 | Restrictions: Must handle file system events reliably, implement proper timeout detection, use awaitWriteFinish for complete file updates | _Leverage: chokidar patterns, lodash-es for data manipulation, BullMQ job progress updates | _Requirements: 1.2 (Real-time Process Monitoring), 1.4 (Basic State Detection) | Success: Service detects file changes accurately, monitors PID health, transitions states correctly (running/active/idle/completed/failed) | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_

- [ ] 5. Create ClaudeCodeClient service for SDK communication abstraction
  - File: src/worker/claude-code-client.service.ts
  - Implement abstraction layer for Python wrapper communication with Zod validation
  - Add structured JSON parsing and error handling for Claude Code responses
  - Purpose: Provide clean interface for Claude Code SDK interactions
  - _Leverage: Zod schemas, existing error handling patterns, @nestjs/config_
  - _Requirements: 1.1, 1.4_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: API Integration Developer with expertise in external service integration and data validation | Task: Create ClaudeCodeClient service that abstracts Python wrapper communication with Zod validation and structured error handling following requirements 1.1 and 1.4 | Restrictions: Must validate all external data with Zod, never expose sensitive prompt information in logs, handle all error scenarios gracefully | _Leverage: Zod validation schemas, @nestjs/config for SDK settings, existing error patterns | _Requirements: 1.1 (Claude Code Process Invocation), 1.4 (Basic State Detection) | Success: Service validates Claude Code configurations, parses responses correctly, provides clean error handling and logging | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_

- [ ] 6. Implement WorkerService orchestration layer
  - File: src/worker/worker.service.ts
  - Create main service that coordinates ProcessManager, StateMonitor, and ClaudeCodeClient
  - Implement task execution workflow with BullMQ integration
  - Purpose: Orchestrate all worker components for complete task management
  - _Leverage: ProcessManager, StateMonitor, ClaudeCodeClient services, BullMQ patterns_
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Software Architect with expertise in service orchestration and workflow management | Task: Implement WorkerService that orchestrates ProcessManager, StateMonitor, and ClaudeCodeClient for complete task execution workflow following all requirements 1.1-1.4 | Restrictions: Must coordinate all services properly, handle failures gracefully, maintain task state consistency throughout execution | _Leverage: All previously created worker services, BullMQ job management, NestJS dependency injection | _Requirements: 1.1 (Process Invocation), 1.2 (Process Monitoring), 1.3 (Lifecycle Management), 1.4 (State Detection) | Success: Service coordinates all components seamlessly, executes tasks end-to-end, handles errors and state transitions correctly | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_

- [ ] 7. Create BullMQ processor for worker task handling
  - File: src/worker/claude-code.processor.ts
  - Implement BullMQ processor that uses WorkerService for task execution
  - Add job progress reporting and error handling with retry logic
  - Purpose: Integrate worker system with job queue for scalable task processing
  - _Leverage: @nestjs/bullmq patterns, WorkerService, existing BullMQ configuration_
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Queue System Developer with expertise in BullMQ and job processing | Task: Create BullMQ processor that integrates WorkerService for scalable task processing with progress reporting and retry logic following all requirements | Restrictions: Must handle job lifecycle properly, report progress accurately, implement proper retry strategies, maintain job state consistency | _Leverage: @nestjs/bullmq decorators, WorkerService orchestration, existing queue configuration | _Requirements: All requirements 1.1-1.4 | Success: Processor handles jobs reliably, reports progress in real-time, implements retry logic, integrates with existing queue system | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_

- [ ] 8. Add worker module integration to NestJS application
  - File: src/worker/worker.module.ts, src/app.module.ts
  - Create WorkerModule with all services and BullMQ processor registration
  - Integrate module into main application with proper dependency injection
  - Purpose: Integrate worker system into existing NestJS application architecture
  - _Leverage: NestJS module patterns, existing app.module.ts structure_
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: NestJS Developer with expertise in module architecture and dependency injection | Task: Create WorkerModule that exports all worker services and integrates with main application following NestJS best practices for all requirements | Restrictions: Must follow existing module patterns, configure dependency injection properly, do not break existing application structure | _Leverage: Existing NestJS module patterns, app.module.ts structure, dependency injection configuration | _Requirements: All requirements 1.1-1.4 | Success: WorkerModule is properly configured, all services are injectable, integration with main app works seamlessly | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_

- [ ] 9. Create comprehensive unit tests for all worker services
  - File: tests/worker/process-manager.service.spec.ts, tests/worker/state-monitor.service.spec.ts, tests/worker/claude-code-client.service.spec.ts, tests/worker/worker.service.spec.ts
  - Write unit tests with mocked dependencies for all services
  - Test error scenarios, edge cases, and process lifecycle events
  - Purpose: Ensure reliability and catch regressions in worker system
  - _Leverage: Jest testing patterns, NestJS testing utilities, mock factories_
  - _Requirements: All requirements for quality assurance_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer with expertise in unit testing and Jest framework | Task: Create comprehensive unit tests for all worker services with proper mocking and edge case coverage ensuring quality for all requirements | Restrictions: Must mock all external dependencies, test both success and failure scenarios, maintain test isolation and reliability | _Leverage: Jest patterns, NestJS testing module, existing test utilities | _Requirements: Validate all requirements through comprehensive testing | Success: All services have high test coverage, edge cases are tested, tests run reliably and independently | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_

- [ ] 10. Create integration test for complete worker workflow
  - File: tests/integration/claude-code-worker.integration.spec.ts
  - Test full task execution workflow from BullMQ job to completion
  - Include Python wrapper integration and real Claude Code SDK interaction
  - Purpose: Validate end-to-end functionality and system integration
  - _Leverage: Test utilities, real Python wrapper, BullMQ test patterns_
  - _Requirements: All requirements end-to-end validation_
  - _Prompt: Implement the task for spec claude-code-manage, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Integration Test Engineer with expertise in end-to-end testing and system validation | Task: Create comprehensive integration test that validates complete worker workflow from job submission to completion, including real Claude Code SDK interaction | Restrictions: Must test real system integration, handle async operations properly, ensure test cleanup and isolation | _Leverage: BullMQ testing patterns, Python wrapper script, existing integration test utilities | _Requirements: End-to-end validation of all requirements 1.1-1.4 | Success: Integration test validates complete workflow, demonstrates system feasibility, covers real Claude Code SDK interaction | Instructions: First set this task to in-progress [-] in tasks.md, then mark complete [x] when finished_