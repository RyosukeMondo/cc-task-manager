/**
 * Frontend Contract Integration Tests
 *
 * Extends existing contract validation infrastructure from src/contracts/
 * and packages/schemas to ensure frontend contract compliance
 */

import { z } from 'zod'
import { validateProcessConfig, validateTaskExecutionRequest, validateWorkerConfig, validateTaskStatus } from '@cc-task-manager/schemas'
import { TaskStatus, ProcessConfig, WorkerConfig, TaskExecutionRequest } from '@cc-task-manager/types'
import { TaskState } from '@cc-task-manager/schemas'

// Import existing contract validation utilities
import type { ContractRegistry, ContractMetadata } from '../../../../../src/contracts/ContractRegistry'

describe('Frontend Contract Integration', () => {
  describe('Package Schema Validation', () => {
    it('should validate ProcessConfig using package schemas', () => {
      const validProcessConfig: ProcessConfig = {
        timeout: 30000,
        retryCount: 3,
        maxConcurrentTasks: 5,
        environment: 'development',
        logging: {
          level: 'info',
          enableDetailedLogs: true
        }
      }

      const result = validateProcessConfig(validProcessConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validProcessConfig)
      }
    })

    it('should validate TaskExecutionRequest using package schemas', () => {
      const validTaskRequest: TaskExecutionRequest = {
        task: 'console.log("Hello World")',
        options: {
          timeout: 15000,
          workingDirectory: '/tmp',
          environmentVariables: { NODE_ENV: 'test' }
        }
      }

      const result = validateTaskExecutionRequest(validTaskRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.task).toBe('console.log("Hello World")')
        expect(result.data.options?.timeout).toBe(15000)
      }
    })

    it('should validate WorkerConfig using package schemas', () => {
      const validWorkerConfig: WorkerConfig = {
        maxConcurrentTasks: 3,
        timeout: 45000,
        retryAttempts: 2,
        enableHealthCheck: true
      }

      const result = validateWorkerConfig(validWorkerConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validWorkerConfig)
      }
    })

    it('should validate TaskStatus using package schemas', () => {
      const validTaskStatus: TaskStatus = {
        id: 'task-123',
        state: TaskState.RUNNING,
        progress: 0.5,
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: {
          correlationId: 'corr-123',
          tags: ['test', 'validation']
        }
      }

      const result = validateTaskStatus(validTaskStatus)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.state).toBe(TaskState.RUNNING)
        expect(result.data.progress).toBe(0.5)
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
        id: 'test-task',
        state: TaskState.COMPLETED,
        progress: 1.0,
        startTime: new Date(),
        lastActivity: new Date()
      }

      expect(validStates).toContain(testTaskStatus.state)

      const result = validateTaskStatus(testTaskStatus)
      expect(result.success).toBe(true)
    })

    it('should reject invalid TaskState values', () => {
      const invalidTaskStatus = {
        id: 'test-task',
        state: 'invalid_state', // Invalid state
        progress: 1.0,
        startTime: new Date(),
        lastActivity: new Date()
      }

      const result = validateTaskStatus(invalidTaskStatus as any)
      expect(result.success).toBe(false)
    })
  })

  describe('Contract Validation Error Handling', () => {
    it('should provide detailed validation errors for ProcessConfig', () => {
      const invalidProcessConfig = {
        timeout: -1000, // Invalid: negative timeout
        retryCount: 'invalid', // Invalid: string instead of number
        maxConcurrentTasks: 0, // Invalid: zero concurrent tasks
      }

      const result = validateProcessConfig(invalidProcessConfig as any)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
        // Check for specific validation errors
        const errorMessages = result.error.issues.map(issue => issue.message)
        expect(errorMessages.some(msg => msg.includes('timeout') || msg.includes('number'))).toBe(true)
      }
    })

    it('should provide detailed validation errors for TaskExecutionRequest', () => {
      const invalidTaskRequest = {
        task: '', // Invalid: empty task
        options: {
          timeout: 'invalid', // Invalid: string instead of number
          workingDirectory: null, // Invalid: null value
        }
      }

      const result = validateTaskExecutionRequest(invalidTaskRequest as any)
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
        id: 'compatibility-test',
        state: TaskState.RUNNING,
        progress: 0.75,
        startTime: new Date('2023-01-01T10:00:00Z'),
        lastActivity: new Date('2023-01-01T10:30:00Z'),
        metadata: {
          correlationId: 'test-correlation',
          tags: ['compatibility', 'test']
        }
      }

      // This should compile and validate successfully
      const validationResult = validateTaskStatus(taskStatus)
      expect(validationResult.success).toBe(true)

      if (validationResult.success) {
        // Ensure the validated data maintains type safety
        const validatedData: TaskStatus = validationResult.data
        expect(validatedData.id).toBe('compatibility-test')
        expect(validatedData.state).toBe(TaskState.RUNNING)
        expect(validatedData.progress).toBe(0.75)
      }
    })

    it('should handle optional fields correctly across packages', () => {
      const minimalTaskStatus: TaskStatus = {
        id: 'minimal-test',
        state: TaskState.PENDING,
        progress: 0,
        startTime: new Date(),
        lastActivity: new Date()
        // metadata is optional
      }

      const result = validateTaskStatus(minimalTaskStatus)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.metadata).toBeUndefined()
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

      // Use TaskExecutionRequest validation as an example
      const taskRequest: TaskExecutionRequest = {
        task: 'legacy integration test',
        options: {
          timeout: 20000
        }
      }

      // Simulate validation using both new package validation and legacy pattern
      const packageValidation = validateTaskExecutionRequest(taskRequest)

      // Create a simple schema for legacy validation simulation
      const legacySchema = z.object({
        task: z.string(),
        options: z.object({
          timeout: z.number()
        }).optional()
      })

      const legacyValidation = mockContractValidation(taskRequest, legacySchema)

      // Both should succeed
      expect(packageValidation.success).toBe(true)
      expect(legacyValidation.success).toBe(true)

      if (packageValidation.success && legacyValidation.success) {
        expect(packageValidation.data.task).toBe(legacyValidation.data.task)
      }
    })
  })
})