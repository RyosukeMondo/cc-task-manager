import { ContractRegistry } from '@/contracts/ContractRegistry'
import { TypeScriptGenerator } from '@/contracts/TypeScriptGenerator'
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
import type {
  ProcessConfig,
  TaskExecutionRequest,
  WorkerConfig,
  TaskStatus
} from '@cc-task-manager/types'

/**
 * Contract-driven API client using existing ContractRegistry infrastructure
 * Implements Single Responsibility Principle (SRP) for API communication
 */
export class ContractApiClient {
  private readonly contractRegistry: ContractRegistry
  private readonly typeGenerator: TypeScriptGenerator
  private readonly baseUrl: string

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') {
    this.baseUrl = baseUrl
    this.contractRegistry = new ContractRegistry()
    this.typeGenerator = new TypeScriptGenerator(this.contractRegistry)
  }

  /**
   * Make a type-safe API request using dual validation (contract + schema package)
   * Implements Dependency Inversion Principle (DIP) with contract abstractions
   */
  async request<T>(
    method: string,
    path: string,
    data?: unknown,
    schemaValidator?: (data: unknown) => unknown,
    contractName?: string,
    contractVersion?: string
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Add auth token if available
        ...(this.getAuthToken() && {
          Authorization: `Bearer ${this.getAuthToken()}`
        }),
      },
    }

    let validatedData = data

    // First: Validate using package schemas (SSOT from @cc-task-manager/schemas)
    if (data && schemaValidator) {
      try {
        validatedData = schemaValidator(data)
      } catch (error) {
        throw new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Second: Additional contract validation if specified (legacy support)
    if (validatedData && contractName && contractVersion) {
      const validation = this.contractRegistry.validateAgainstContract(
        contractName,
        contractVersion,
        validatedData
      )

      if (!validation.success) {
        throw new Error(`Contract validation failed: ${validation.error}`)
      }

      validatedData = validation.data
    }

    if (validatedData) {
      options.body = JSON.stringify(validatedData)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
  }

  // Task Management API - using existing contract types
  async getTasks(): Promise<TaskStatus[]> {
    return this.request<TaskStatus[]>('GET', '/api/tasks')
  }

  async createTask(task: TaskExecutionRequest): Promise<TaskStatus> {
    return this.request<TaskStatus>(
      'POST',
      '/api/tasks',
      task,
      validateTaskExecutionRequest,
      'TaskExecutionRequest',
      '1.0.0'
    )
  }

  async updateTask(taskId: string, updates: Partial<TaskStatus>): Promise<TaskStatus> {
    return this.request<TaskStatus>(
      'PATCH',
      `/api/tasks/${taskId}`,
      updates,
      (data) => TaskStatusSchema.partial().parse(data),
      'TaskStatus',
      '1.0.0'
    )
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.request<void>('DELETE', `/api/tasks/${taskId}`)
  }

  // Process Management API - using existing contract types
  async getProcesses(): Promise<ProcessConfig[]> {
    return this.request<ProcessConfig[]>('GET', '/api/processes')
  }

  async createProcess(config: ProcessConfig): Promise<ProcessConfig> {
    return this.request<ProcessConfig>(
      'POST',
      '/api/processes',
      config,
      validateProcessConfig,
      'ProcessConfig',
      '1.0.0'
    )
  }

  // Worker Management API - using existing contract types
  async getWorkers(): Promise<WorkerConfig[]> {
    return this.request<WorkerConfig[]>('GET', '/api/workers')
  }

  async createWorker(config: WorkerConfig): Promise<WorkerConfig> {
    return this.request<WorkerConfig>(
      'POST',
      '/api/workers',
      config,
      validateWorkerConfig,
      'WorkerConfig',
      '1.0.0'
    )
  }

  // Authentication API
  async login(credentials: { username: string; password: string }): Promise<{
    token: string;
    user: { id: string; username: string; role: string };
  }> {
    return this.request('POST', '/api/auth/login', credentials)
  }

  async logout(): Promise<void> {
    return this.request('POST', '/api/auth/logout')
  }

  async refreshToken(): Promise<{ token: string }> {
    return this.request('POST', '/api/auth/refresh')
  }

  // Contract metadata and discovery
  async getAvailableContracts(): Promise<string[]> {
    return this.contractRegistry.getContractNames()
  }

  async generateClientTypes(contractName: string, version: string): Promise<string | null> {
    return this.typeGenerator.generateTypeScriptModule(contractName, version, {
      includeImports: true,
      includeComments: true,
      clientApiGeneration: true,
      outputFormat: 'interface'
    })
  }
}

// Export a singleton instance following SOLID principles
export const apiClient = new ContractApiClient()