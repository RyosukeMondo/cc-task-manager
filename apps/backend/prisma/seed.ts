const { PrismaClient } = require('@prisma/client');
// Note: bcrypt would be used for password hashing in production

const prisma = new PrismaClient();

// =============================================================================
// SEEDING FUNCTIONS - Following SOLID principles for focused responsibilities
// =============================================================================

/**
 * User seeding function following SRP - Single responsibility for user creation
 */
async function seedUsers() {
  console.log('🌱 Seeding users...');

  const users = await prisma.user.createMany({
    data: [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'admin@claudecode.dev',
        username: 'admin',
        firstName: 'Claude',
        lastName: 'Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        password: 'hashed_admin123', // Note: In production, use bcrypt.hash('admin123', 10)
        lastLoginAt: new Date(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'developer@claudecode.dev',
        username: 'developer',
        firstName: 'Dev',
        lastName: 'User',
        role: 'USER',
        status: 'ACTIVE',
        password: 'hashed_dev123', // Note: In production, use bcrypt.hash('dev123', 10)
        lastLoginAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        email: 'tester@claudecode.dev',
        username: 'tester',
        firstName: 'Test',
        lastName: 'Engineer',
        role: 'USER',
        status: 'ACTIVE',
        password: 'hashed_test123', // Note: In production, use bcrypt.hash('test123', 10)
        lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        email: 'inactive@claudecode.dev',
        username: 'inactive',
        firstName: 'Inactive',
        lastName: 'User',
        role: 'USER',
        status: 'INACTIVE',
        password: 'hashed_inactive123', // Note: In production, use bcrypt.hash('inactive123', 10)
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${users.count} users`);
  return users;
}

/**
 * Project seeding function following SRP - Single responsibility for project creation
 */
async function seedProjects() {
  console.log('🌱 Seeding projects...');

  const projects = await prisma.project.createMany({
    data: [
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'Claude Code Core',
        description: 'Core Claude Code task management and automation system',
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Web Interface',
        description: 'Frontend web application for Claude Code task management',
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440003',
        name: 'Mobile App',
        description: 'Mobile application for Claude Code task monitoring',
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440004',
        name: 'DevOps Pipeline',
        description: 'CI/CD and infrastructure automation project',
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${projects.count} projects`);
  return projects;
}

/**
 * Task seeding function following SRP - Single responsibility for regular task creation
 */
async function seedTasks() {
  console.log('🌱 Seeding regular tasks...');

  const tasks = await prisma.task.createMany({
    data: [
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        title: 'Setup database schema',
        description: 'Create comprehensive database schema for Claude Code entities',
        status: 'DONE',
        priority: 'HIGH',
        createdById: '550e8400-e29b-41d4-a716-446655440001',
        assigneeId: '550e8400-e29b-41d4-a716-446655440002',
        projectId: '660e8400-e29b-41d4-a716-446655440001',
        tags: ['database', 'schema', 'setup'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        title: 'Implement authentication API',
        description: 'Build JWT-based authentication system with role-based access control',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        createdById: '550e8400-e29b-41d4-a716-446655440001',
        assigneeId: '550e8400-e29b-41d4-a716-446655440002',
        projectId: '660e8400-e29b-41d4-a716-446655440001',
        tags: ['auth', 'api', 'security'],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440003',
        title: 'Create React components',
        description: 'Build reusable UI components for the web interface',
        status: 'TODO',
        priority: 'MEDIUM',
        createdById: '550e8400-e29b-41d4-a716-446655440002',
        assigneeId: '550e8400-e29b-41d4-a716-446655440003',
        projectId: '660e8400-e29b-41d4-a716-446655440002',
        tags: ['frontend', 'react', 'components'],
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${tasks.count} regular tasks`);
  return tasks;
}

/**
 * Claude task seeding function following SRP - Single responsibility for Claude task creation
 * Creates comprehensive scenarios for testing different task types and statuses
 */
async function seedClaudeTasks() {
  console.log('🌱 Seeding Claude tasks...');

  const claudeTasks = await prisma.claudeTask.createMany({
    data: [
      {
        id: '880e8400-e29b-41d4-a716-446655440001',
        title: 'Code Review Assistant',
        description: 'Automated code review for pull requests using Claude AI',
        prompt: '/review --file=src/auth.ts --focus=security',
        config: {
          timeout: 300,
          maxRetries: 3,
          reviewDepth: 'comprehensive',
          includeTests: true,
        },
        status: 'COMPLETED',
        priority: 'HIGH',
        createdById: '550e8400-e29b-41d4-a716-446655440001',
        projectId: '660e8400-e29b-41d4-a716-446655440001',
        tags: ['code-review', 'ai', 'automation'],
        estimatedDuration: 300,
        actualDuration: 245,
        scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        startedAt: new Date(Date.now() - 90 * 60 * 1000),
        completedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: '880e8400-e29b-41d4-a716-446655440002',
        title: 'Database Migration Generator',
        description: 'Generate Prisma migrations based on schema changes',
        prompt: '/generate migration --from=user-schema --to=enhanced-schema',
        config: {
          timeout: 600,
          maxRetries: 2,
          validateSchema: true,
          backupData: true,
        },
        status: 'RUNNING',
        priority: 'URGENT',
        createdById: '550e8400-e29b-41d4-a716-446655440002',
        projectId: '660e8400-e29b-41d4-a716-446655440001',
        tags: ['database', 'migration', 'prisma'],
        estimatedDuration: 600,
        scheduledAt: new Date(Date.now() - 30 * 60 * 1000),
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        id: '880e8400-e29b-41d4-a716-446655440003',
        title: 'Test Case Generator',
        description: 'Generate comprehensive test cases for new API endpoints',
        prompt: '/test --generate --endpoints=auth,tasks,projects --coverage=90%',
        config: {
          timeout: 900,
          maxRetries: 3,
          testTypes: ['unit', 'integration', 'e2e'],
          mockData: true,
        },
        status: 'QUEUED',
        priority: 'MEDIUM',
        createdById: '550e8400-e29b-41d4-a716-446655440003',
        projectId: '660e8400-e29b-41d4-a716-446655440001',
        tags: ['testing', 'automation', 'coverage'],
        estimatedDuration: 900,
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      {
        id: '880e8400-e29b-41d4-a716-446655440004',
        title: 'Documentation Updater',
        description: 'Update API documentation based on code changes',
        prompt: '/docs --update --format=openapi --include=examples',
        config: {
          timeout: 180,
          maxRetries: 2,
          includeExamples: true,
          validateSchema: true,
        },
        status: 'FAILED',
        priority: 'LOW',
        createdById: '550e8400-e29b-41d4-a716-446655440002',
        projectId: '660e8400-e29b-41d4-a716-446655440002',
        tags: ['documentation', 'api', 'openapi'],
        estimatedDuration: 180,
        scheduledAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        startedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      },
      {
        id: '880e8400-e29b-41d4-a716-446655440005',
        title: 'Performance Optimizer',
        description: 'Analyze and optimize database query performance',
        prompt: '/optimize --target=database --analyze=queries --threshold=100ms',
        config: {
          timeout: 1200,
          maxRetries: 1,
          analysisDepth: 'deep',
          includeIndexes: true,
        },
        status: 'PENDING',
        priority: 'MEDIUM',
        createdById: '550e8400-e29b-41d4-a716-446655440001',
        projectId: '660e8400-e29b-41d4-a716-446655440001',
        tags: ['performance', 'database', 'optimization'],
        estimatedDuration: 1200,
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${claudeTasks.count} Claude tasks`);
  return claudeTasks;
}

/**
 * Task execution seeding function following SRP - Single responsibility for execution tracking
 */
async function seedTaskExecutions() {
  console.log('🌱 Seeding task executions...');

  const executions = await prisma.taskExecution.createMany({
    data: [
      {
        id: '990e8400-e29b-41d4-a716-446655440001',
        taskId: '880e8400-e29b-41d4-a716-446655440001',
        status: 'COMPLETED',
        progress: 1.0,
        workerId: 'worker-01',
        processId: 'proc-1234',
        sessionId: 'sess-abcd-1234',
        cpuUsage: 45.2,
        memoryUsage: 524288000, // 500MB
        diskUsage: 1048576, // 1MB
        retryCount: 0,
        startedAt: new Date(Date.now() - 90 * 60 * 1000),
        completedAt: new Date(Date.now() - 30 * 60 * 1000),
        lastHeartbeat: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: '990e8400-e29b-41d4-a716-446655440002',
        taskId: '880e8400-e29b-41d4-a716-446655440002',
        status: 'RUNNING',
        progress: 0.65,
        workerId: 'worker-02',
        processId: 'proc-5678',
        sessionId: 'sess-efgh-5678',
        cpuUsage: 78.5,
        memoryUsage: 1073741824, // 1GB
        diskUsage: 2097152, // 2MB
        retryCount: 0,
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
        lastHeartbeat: new Date(Date.now() - 30 * 1000), // 30 seconds ago
      },
      {
        id: '990e8400-e29b-41d4-a716-446655440003',
        taskId: '880e8400-e29b-41d4-a716-446655440004',
        status: 'FAILED',
        progress: 0.25,
        workerId: 'worker-03',
        processId: 'proc-9012',
        sessionId: 'sess-ijkl-9012',
        cpuUsage: 12.3,
        memoryUsage: 268435456, // 256MB
        diskUsage: 512000, // 500KB
        errorMessage: 'API documentation schema validation failed',
        errorCode: 'SCHEMA_VALIDATION_ERROR',
        stackTrace: 'Error: Schema validation failed\\n  at validateSchema (line 45)\\n  at updateDocs (line 123)',
        retryCount: 2,
        startedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
        lastHeartbeat: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${executions.count} task executions`);
  return executions;
}

/**
 * Queue job seeding function following SRP - Single responsibility for queue management
 */
async function seedQueueJobs() {
  console.log('🌱 Seeding queue jobs...');

  const queueJobs = await prisma.queueJob.createMany({
    data: [
      {
        id: 'aa0e8400-e29b-41d4-a716-446655440001',
        taskId: '880e8400-e29b-41d4-a716-446655440001',
        queueName: 'claude-tasks',
        jobId: 'job-001',
        status: 'COMPLETED',
        priority: 10,
        delay: 0,
        maxAttempts: 3,
        backoffType: 'EXPONENTIAL',
        backoffDelay: 2000,
        jobData: {
          taskId: '880e8400-e29b-41d4-a716-446655440001',
          prompt: '/review --file=src/auth.ts --focus=security',
          config: { timeout: 300, maxRetries: 3 },
        },
        jobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
        result: {
          success: true,
          reviewResults: {
            securityIssues: 2,
            codeQuality: 'good',
            suggestions: 5,
          },
        },
        processedAt: new Date(Date.now() - 90 * 60 * 1000),
        finishedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: 'aa0e8400-e29b-41d4-a716-446655440002',
        taskId: '880e8400-e29b-41d4-a716-446655440002',
        queueName: 'claude-tasks',
        jobId: 'job-002',
        status: 'ACTIVE',
        priority: 15,
        delay: 0,
        maxAttempts: 2,
        backoffType: 'EXPONENTIAL',
        backoffDelay: 2000,
        jobData: {
          taskId: '880e8400-e29b-41d4-a716-446655440002',
          prompt: '/generate migration --from=user-schema --to=enhanced-schema',
          config: { timeout: 600, maxRetries: 2 },
        },
        jobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
        processedAt: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        id: 'aa0e8400-e29b-41d4-a716-446655440003',
        taskId: '880e8400-e29b-41d4-a716-446655440003',
        queueName: 'claude-tasks',
        jobId: 'job-003',
        status: 'WAITING',
        priority: 5,
        delay: 3600000, // 1 hour delay
        maxAttempts: 3,
        backoffType: 'EXPONENTIAL',
        backoffDelay: 2000,
        jobData: {
          taskId: '880e8400-e29b-41d4-a716-446655440003',
          prompt: '/test --generate --endpoints=auth,tasks,projects --coverage=90%',
          config: { timeout: 900, maxRetries: 3 },
        },
        jobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${queueJobs.count} queue jobs`);
  return queueJobs;
}

/**
 * Job attempt seeding function following SRP - Single responsibility for retry tracking
 */
async function seedJobAttempts() {
  console.log('🌱 Seeding job attempts...');

  const attempts = await prisma.jobAttempt.createMany({
    data: [
      {
        id: 'bb0e8400-e29b-41d4-a716-446655440001',
        queueJobId: 'aa0e8400-e29b-41d4-a716-446655440001',
        attemptNumber: 1,
        status: 'COMPLETED',
        result: {
          success: true,
          executionTime: 245000,
          reviewResults: {
            securityIssues: 2,
            codeQuality: 'good',
          },
        },
        startedAt: new Date(Date.now() - 90 * 60 * 1000),
        finishedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: 'bb0e8400-e29b-41d4-a716-446655440002',
        queueJobId: 'aa0e8400-e29b-41d4-a716-446655440002',
        attemptNumber: 1,
        status: 'PROCESSING',
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        id: 'bb0e8400-e29b-41d4-a716-446655440003',
        queueJobId: 'aa0e8400-e29b-41d4-a716-446655440001',
        attemptNumber: 2,
        status: 'FAILED',
        error: 'Timeout exceeded during code analysis phase',
        startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        finishedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${attempts.count} job attempts`);
  return attempts;
}

/**
 * Execution log seeding function following SRP - Single responsibility for log storage
 */
async function seedExecutionLogs() {
  console.log('🌱 Seeding execution logs...');

  const logs = await prisma.executionLog.createMany({
    data: [
      {
        id: 'cc0e8400-e29b-41d4-a716-446655440001',
        executionId: '990e8400-e29b-41d4-a716-446655440001',
        level: 'INFO',
        source: 'CLAUDE',
        message: 'Starting code review analysis',
        details: {
          file: 'src/auth.ts',
          focus: 'security',
          analysisDepth: 'comprehensive',
        },
        component: 'code-reviewer',
        operation: 'analyze',
        correlationId: 'corr-001',
        timestamp: new Date(Date.now() - 90 * 60 * 1000),
      },
      {
        id: 'cc0e8400-e29b-41d4-a716-446655440002',
        executionId: '990e8400-e29b-41d4-a716-446655440001',
        level: 'WARN',
        source: 'CLAUDE',
        message: 'Potential security issue detected',
        details: {
          issueType: 'sql-injection',
          line: 47,
          severity: 'medium',
          suggestion: 'Use parameterized queries',
        },
        component: 'security-analyzer',
        operation: 'scan',
        correlationId: 'corr-001',
        timestamp: new Date(Date.now() - 85 * 60 * 1000),
      },
      {
        id: 'cc0e8400-e29b-41d4-a716-446655440003',
        executionId: '990e8400-e29b-41d4-a716-446655440002',
        level: 'DEBUG',
        source: 'SYSTEM',
        message: 'Migration generation progress',
        details: {
          phase: 'schema-analysis',
          progress: 0.65,
          tablesProcessed: 13,
          totalTables: 20,
        },
        component: 'migration-generator',
        operation: 'generate',
        correlationId: 'corr-002',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        id: 'cc0e8400-e29b-41d4-a716-446655440004',
        executionId: '990e8400-e29b-41d4-a716-446655440003',
        level: 'ERROR',
        source: 'CLAUDE',
        message: 'Schema validation failed',
        details: {
          validationErrors: [
            'Missing required field: description',
            'Invalid enum value: UNKNOWN_STATUS',
          ],
          schemaPath: 'schemas/api.json',
        },
        component: 'schema-validator',
        operation: 'validate',
        correlationId: 'corr-003',
        timestamp: new Date(Date.now() - 2.2 * 60 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${logs.count} execution logs`);
  return logs;
}

/**
 * System metrics seeding function following SRP - Single responsibility for metrics tracking
 */
async function seedSystemMetrics() {
  console.log('🌱 Seeding system metrics...');

  const metrics = await prisma.systemMetric.createMany({
    data: [
      {
        id: 'dd0e8400-e29b-41d4-a716-446655440001',
        executionId: '990e8400-e29b-41d4-a716-446655440001',
        metricType: 'COUNTER',
        metricName: 'code_lines_analyzed',
        value: 1247,
        unit: 'lines',
        workerId: 'worker-01',
        queueName: 'claude-tasks',
        tags: {
          language: 'typescript',
          complexity: 'medium',
        },
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        id: 'dd0e8400-e29b-41d4-a716-446655440002',
        executionId: '990e8400-e29b-41d4-a716-446655440002',
        metricType: 'GAUGE',
        metricName: 'memory_usage_mb',
        value: 1024,
        unit: 'MB',
        workerId: 'worker-02',
        queueName: 'claude-tasks',
        tags: {
          process: 'migration-generator',
          phase: 'analysis',
        },
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        id: 'dd0e8400-e29b-41d4-a716-446655440003',
        executionId: '990e8400-e29b-41d4-a716-446655440001',
        metricType: 'TIMER',
        metricName: 'analysis_duration_ms',
        value: 245000,
        unit: 'ms',
        workerId: 'worker-01',
        queueName: 'claude-tasks',
        tags: {
          operation: 'code-review',
          result: 'success',
        },
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: 'dd0e8400-e29b-41d4-a716-446655440004',
        executionId: null,
        metricType: 'GAUGE',
        metricName: 'queue_depth',
        value: 15,
        unit: 'jobs',
        workerId: null,
        queueName: 'claude-tasks',
        tags: {
          status: 'waiting',
          priority: 'normal',
        },
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${metrics.count} system metrics`);
  return metrics;
}

/**
 * Task result seeding function following SRP - Single responsibility for result storage
 */
async function seedTaskResults() {
  console.log('🌱 Seeding task results...');

  const results = await prisma.taskResult.createMany({
    data: [
      {
        id: 'ee0e8400-e29b-41d4-a716-446655440001',
        taskId: '880e8400-e29b-41d4-a716-446655440001',
        status: 'SUCCESS',
        summary: 'Code review completed successfully with 2 security recommendations',
        output: {
          securityIssues: [
            {
              type: 'sql-injection',
              severity: 'medium',
              line: 47,
              description: 'Potential SQL injection vulnerability',
              recommendation: 'Use parameterized queries',
            },
            {
              type: 'weak-validation',
              severity: 'low',
              line: 89,
              description: 'Input validation could be stronger',
              recommendation: 'Add email format validation',
            },
          ],
          codeQuality: {
            score: 8.5,
            maintainability: 'good',
            complexity: 'moderate',
          },
          suggestions: [
            'Consider extracting validation logic to separate function',
            'Add error handling for database connection failures',
            'Implement rate limiting for authentication endpoints',
          ],
        },
        executionTime: 245000,
        tokensUsed: 15420,
        costEstimate: 0.23,
      },
      {
        id: 'ee0e8400-e29b-41d4-a716-446655440002',
        taskId: '880e8400-e29b-41d4-a716-446655440004',
        status: 'FAILURE',
        summary: 'Documentation update failed due to schema validation errors',
        output: {
          error: 'Schema validation failed',
          validationErrors: [
            'Missing required field: description in User schema',
            'Invalid enum value: UNKNOWN_STATUS in Task schema',
          ],
          partialResults: {
            processedEndpoints: 12,
            totalEndpoints: 25,
            generatedExamples: 8,
          },
        },
        executionTime: 125000,
        tokensUsed: 8950,
        costEstimate: 0.13,
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${results.count} task results`);
  return results;
}

/**
 * Result file seeding function following SRP - Single responsibility for file attachment tracking
 */
async function seedResultFiles() {
  console.log('🌱 Seeding result files...');

  const files = await prisma.resultFile.createMany({
    data: [
      {
        id: 'ff0e8400-e29b-41d4-a716-446655440001',
        resultId: 'ee0e8400-e29b-41d4-a716-446655440001',
        filename: 'code-review-report.html',
        contentType: 'text/html',
        size: 45678,
        path: '/tmp/results/code-review-report-001.html',
        checksum: 'sha256:a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3',
      },
      {
        id: 'ff0e8400-e29b-41d4-a716-446655440002',
        resultId: 'ee0e8400-e29b-41d4-a716-446655440001',
        filename: 'security-analysis.json',
        contentType: 'application/json',
        size: 12345,
        path: '/tmp/results/security-analysis-001.json',
        checksum: 'sha256:b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4',
      },
      {
        id: 'ff0e8400-e29b-41d4-a716-446655440003',
        resultId: 'ee0e8400-e29b-41d4-a716-446655440002',
        filename: 'validation-errors.log',
        contentType: 'text/plain',
        size: 2345,
        path: '/tmp/results/validation-errors-002.log',
        checksum: 'sha256:c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5',
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${files.count} result files`);
  return files;
}

/**
 * User session seeding function following SRP - Single responsibility for session management
 */
async function seedUserSessions() {
  console.log('🌱 Seeding user sessions...');

  const sessions = await prisma.session.createMany({
    data: [
      {
        id: 'gg0e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        deviceInfo: 'Chrome 118.0.0.0 on macOS 14.0',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        refreshToken: 'refresh_token_admin_' + Date.now(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        lastActive: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      },
      {
        id: 'gg0e8400-e29b-41d4-a716-446655440002',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        deviceInfo: 'Firefox 118.0 on Ubuntu 22.04',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:118.0) Gecko/20100101 Firefox/118.0',
        refreshToken: 'refresh_token_dev_' + Date.now(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        id: 'gg0e8400-e29b-41d4-a716-446655440003',
        userId: '550e8400-e29b-41d4-a716-446655440003',
        deviceInfo: 'Mobile Safari on iOS 17.0',
        ipAddress: '10.0.0.50',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        refreshToken: 'refresh_token_test_' + Date.now(),
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Expired 1 day ago
        lastActive: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${sessions.count} user sessions`);
  return sessions;
}

// =============================================================================
// MAIN SEEDING FUNCTION - Following OCP principle for extensible seeding
// =============================================================================

/**
 * Main seeding function following SOLID principles:
 * - SRP: Each seeding function has single responsibility
 * - OCP: Easy to extend with new seeding functions
 * - DIP: Depends on Prisma abstraction, not concrete implementation
 */
async function main() {
  console.log('🚀 Starting database seeding...');

  try {
    // Fail-fast validation: Check database connection
    await prisma.$connect();
    console.log('✅ Database connection established');

    // Execute seeding functions in proper dependency order
    await seedUsers();
    await seedProjects();
    await seedTasks();
    await seedClaudeTasks();
    await seedTaskExecutions();
    await seedQueueJobs();
    await seedJobAttempts();
    await seedExecutionLogs();
    await seedSystemMetrics();
    await seedTaskResults();
    await seedResultFiles();
    await seedUserSessions();

    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📊 Seeded data summary:');
    console.log('  - 4 Users (admin, developer, tester, inactive)');
    console.log('  - 4 Projects (core, web, mobile, devops)');
    console.log('  - 3 Regular Tasks (various statuses)');
    console.log('  - 5 Claude Tasks (comprehensive scenarios)');
    console.log('  - 3 Task Executions (completed, running, failed)');
    console.log('  - 3 Queue Jobs (various statuses)');
    console.log('  - 3 Job Attempts (retry scenarios)');
    console.log('  - 4 Execution Logs (various levels)');
    console.log('  - 4 System Metrics (performance data)');
    console.log('  - 2 Task Results (success and failure)');
    console.log('  - 3 Result Files (attachments)');
    console.log('  - 3 User Sessions (active and expired)');
    console.log('');
    console.log('🔧 Use this data for development and testing scenarios');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute main function with proper error handling
main()
  .catch((e) => {
    console.error('❌ Seeding process failed:', e);
    process.exit(1);
  });