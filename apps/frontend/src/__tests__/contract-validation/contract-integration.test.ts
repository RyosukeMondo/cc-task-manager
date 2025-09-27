/**
 * Frontend Contract Integration Tests
 *
 * Extends existing contract validation infrastructure from src/contracts/
 * and packages/schemas to ensure frontend contract compliance
 */

import { z } from 'zod'
import {
  validateProcessConfig,
  validateTaskExecutionRequest,
  validateWorkerConfig,
  validateTaskStatus,
  ProcessConfigSchema,
  TaskExecutionRequestSchema,
  WorkerConfigSchema,
  TaskStatusSchema
} from '@cc-task-manager/schemas'
import { TaskStatus, ProcessConfig, WorkerConfig, TaskExecutionRequest } from '@cc-task-manager/types'
import { TaskState } from '@cc-task-manager/schemas'

// Import existing contract validation utilities
import type { ContractRegistry, ContractMetadata } from '../../../../../src/contracts/ContractRegistry'

describe('Frontend Contract Integration', () => {
  describe('Package Schema Validation', () => {
    it('should validate ProcessConfig using package schemas', () => {
      const validProcessConfig: ProcessConfig = {
        jobId: 'test-job-123',
        sessionName: 'test-session',
        workingDirectory: '/tmp/test',
        pythonExecutable: 'python3',
        wrapperScriptPath: '/path/to/wrapper.py',
        unbuffered: true
      }

      const result = ProcessConfigSchema.safeParse(validProcessConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validProcessConfig)
      }
    })

    it('should validate TaskExecutionRequest using package schemas', () => {
      const validTaskRequest: TaskExecutionRequest = {
        id: 'task-123',
        prompt: 'console.log("Hello World")',
        sessionName: 'test-session',
        workingDirectory: '/tmp/test',
        options: {
          timeout: 15000,
          model: 'claude-3-sonnet'
        },
        timeoutMs: 300000
      }

      const result = TaskExecutionRequestSchema.safeParse(validTaskRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.prompt).toBe('console.log("Hello World")')
        expect(result.data.options?.timeout).toBe(15000)
      }
    })

    it('should validate WorkerConfig using package schemas', () => {
      const validWorkerConfig: WorkerConfig = {
        maxConcurrentTasks: 3,
        processTimeoutMs: 45000,
        gracefulShutdownMs: 5000,
        wrapperScriptPath: '/path/to/wrapper.py',
        queueName: 'test-queue',
        redisHost: 'localhost',
        redisPort: 6379
      }

      const result = WorkerConfigSchema.safeParse(validWorkerConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.maxConcurrentTasks).toBe(3)
        expect(result.data.processTimeoutMs).toBe(45000)
      }
    })

    it('should validate TaskStatus using package schemas', () => {
      const validTaskStatus: TaskStatus = {
        taskId: 'task-123',
        state: TaskState.RUNNING,
        progress: '50%',
        lastActivity: new Date(),
        pid: 1234
      }

      const result = TaskStatusSchema.safeParse(validTaskStatus)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.state).toBe(TaskState.RUNNING)
        expect(result.data.progress).toBe('50%')
        expect(result.data.taskId).toBe('task-123')
      }
    })
  })

  describe('TaskState Enum Integration', () => {
    it('should use TaskState enum from schemas package', () => {
      expect(TaskState.PENDING).toBe('pending')
      expect(TaskState.RUNNING).toBe('running')
      expect(TaskState.COMPLETED).toBe('completed')
      expect(TaskState.FAILED).toBe('failed')
      expect(TaskState.CANCELLED).toBe('cancelled')
    })

    it('should validate TaskState enum values', () => {
      const validStates = Object.values(TaskState)
      const testTaskStatus: TaskStatus = {
        taskId: 'test-task',
        state: TaskState.COMPLETED,
        progress: '100%',
        lastActivity: new Date()
      }

      expect(validStates).toContain(testTaskStatus.state)

      const result = TaskStatusSchema.safeParse(testTaskStatus)
      expect(result.success).toBe(true)
    })

    it('should reject invalid TaskState values', () => {
      const invalidTaskStatus = {
        taskId: 'test-task',
        state: 'invalid_state', // Invalid state
        progress: '100%',
        lastActivity: new Date()
      }

      const result = TaskStatusSchema.safeParse(invalidTaskStatus as any)
      expect(result.success).toBe(false)
    })
  })

  describe('Contract Validation Error Handling', () => {
    it('should provide detailed validation errors for ProcessConfig', () => {
      const invalidProcessConfig = {
        // Missing required fields: jobId, sessionName, workingDirectory, wrapperScriptPath
        pythonExecutable: '', // Invalid: empty string
        unbuffered: 'invalid', // Invalid: string instead of boolean
      }

      const result = ProcessConfigSchema.safeParse(invalidProcessConfig as any)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
        // Check for specific validation errors
        const errorMessages = result.error.issues.map(issue => issue.message)
        expect(errorMessages.some(msg => msg.includes('Required'))).toBe(true)
      }
    })

    it('should provide detailed validation errors for TaskExecutionRequest', () => {
      const invalidTaskRequest = {
        id: '', // Invalid: empty id
        prompt: '', // Invalid: empty prompt
        // Missing sessionName and workingDirectory
        options: {
          timeout: 'invalid', // Invalid: string instead of number
        }
      }

      const result = TaskExecutionRequestSchema.safeParse(invalidTaskRequest as any)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Cross-Package Type Compatibility', () => {
    it('should ensure types from packages/types work with schemas validation', () => {
      // Test that TypeScript types from packages/types are compatible
      // with validation functions from packages/schemas

      const taskStatus: TaskStatus = {
        taskId: 'compatibility-test',
        state: TaskState.RUNNING,
        progress: '75%',
        lastActivity: new Date('2023-01-01T10:30:00Z'),
        pid: 1234
      }

      // This should compile and validate successfully
      const validationResult = TaskStatusSchema.safeParse(taskStatus)
      expect(validationResult.success).toBe(true)

      if (validationResult.success) {
        // Ensure the validated data maintains type safety
        const validatedData: TaskStatus = validationResult.data
        expect(validatedData.taskId).toBe('compatibility-test')
        expect(validatedData.state).toBe(TaskState.RUNNING)
        expect(validatedData.progress).toBe('75%')
      }
    })

    it('should handle optional fields correctly across packages', () => {
      const minimalTaskStatus: TaskStatus = {
        taskId: 'minimal-test',
        state: TaskState.PENDING,
        lastActivity: new Date()
        // progress, pid, error, exitCode are optional
      }

      const result = TaskStatusSchema.safeParse(minimalTaskStatus)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.progress).toBeUndefined()
        expect(result.data.pid).toBeUndefined()
      }
    })
  })

  describe('Legacy Contract System Integration', () => {
    it('should maintain compatibility with existing src/contracts infrastructure', () => {
      // This test ensures that the new package-based validation
      // doesn't break existing contract validation patterns

      // Mock existing contract validation pattern
      const mockContractValidation = (data: any, schema: z.ZodSchema) => {
        return schema.safeParse(data)
      }

      // Use simplified TaskExecutionRequest for legacy compatibility test
      const taskRequest = {
        id: 'legacy-test',
        prompt: 'legacy integration test',
        sessionName: 'legacy-session',
        workingDirectory: '/tmp/legacy',
        options: {
          timeout: 20000
        }
      }

      // Validate using new package schema
      const packageValidation = TaskExecutionRequestSchema.safeParse(taskRequest)

      // Create a simple schema for legacy validation simulation
      const legacySchema = z.object({
        id: z.string(),
        prompt: z.string(),
        sessionName: z.string(),
        workingDirectory: z.string(),
        options: z.object({
          timeout: z.number()
        })
      })

      const legacyValidation = mockContractValidation(taskRequest, legacySchema)

      // Both should succeed
      expect(packageValidation.success).toBe(true)
      expect(legacyValidation.success).toBe(true)

      if (packageValidation.success && legacyValidation.success) {
        expect(packageValidation.data.prompt).toBe(legacyValidation.data.prompt)
      }
    })
  })
})