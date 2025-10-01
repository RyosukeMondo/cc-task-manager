import { ContractRegistry } from '@/contracts/ContractRegistry'
import { TypeScriptGenerator } from '@/contracts/TypeScriptGenerator'
import {
  validateProcessConfig,
  validateTaskExecutionRequest,
  validateWorkerConfig,
  validateTaskStatus,
  validateAnalyticsFilter,
  ProcessConfigSchema,
  TaskExecutionRequestSchema,
  WorkerConfigSchema,
  TaskStatusSchema,
  validateUserRegistration,
  validateLoginRequest,
  validateTokenRefresh,
  type UserRegistration,
  type LoginRequest,
  type AuthResponse,
  type UserBase,
  type TokenRefresh
} from '@cc-task-manager/schemas'
import type {
  ProcessConfig,
  TaskExecutionRequest,
  WorkerConfig,
  TaskStatus,
  PerformanceMetrics,
  AnalyticsFilter
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
    return localStorage.getItem('accessToken')
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
  }

  private clearTokens(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('refreshToken')
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

  // ========== Spec: backend-auth-api ==========

  /**
   * Register a new user account
   * @param data User registration data (email, username, password, firstName, lastName)
   * @returns User object without password
   */
  async register(data: UserRegistration): Promise<{ user: UserBase }> {
    const response = await this.request<{ user: UserBase }>(
      'POST',
      '/api/auth/register',
      data,
      validateUserRegistration
    )
    return response
  }

  /**
   * Authenticate user with email/username and password
   * @param credentials Login credentials (identifier, password, rememberMe)
   * @returns Authentication response with tokens and user
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(
      'POST',
      '/api/auth/login',
      credentials,
      validateLoginRequest
    )
    // Store tokens in localStorage
    this.setTokens(response.accessToken, response.refreshToken)
    return response
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken Refresh token string (optional, uses stored token if not provided)
   * @returns New authentication response with fresh tokens
   */
  async refreshToken(refreshToken?: string): Promise<AuthResponse> {
    const token = refreshToken || this.getRefreshToken()
    if (!token) {
      throw new Error('No refresh token available')
    }

    const response = await this.request<AuthResponse>(
      'POST',
      '/api/auth/refresh',
      { refreshToken: token },
      validateTokenRefresh
    )
    // Update stored tokens
    this.setTokens(response.accessToken, response.refreshToken)
    return response
  }

  /**
   * Log out the current user
   * Requires authentication (JWT in Authorization header)
   */
  async logout(): Promise<void> {
    await this.request<void>('POST', '/api/auth/logout')
    // Clear tokens from localStorage
    this.clearTokens()
  }

  /**
   * Get current authenticated user
   * Requires authentication (JWT in Authorization header)
   * @returns User object without password
   */
  async getCurrentUser(): Promise<UserBase> {
    return this.request<UserBase>('GET', '/api/auth/me')
  }

  // Analytics API
  async getPerformanceMetrics(filter?: AnalyticsFilter): Promise<PerformanceMetrics> {
    const queryParams = filter
      ? `?${new URLSearchParams({
          startDate: filter.dateRange.startDate,
          endDate: filter.dateRange.endDate,
          groupBy: filter.groupBy,
          ...(filter.metrics && { metrics: filter.metrics.join(',') }),
          ...(filter.projectId && { projectId: filter.projectId }),
          ...(filter.userId && { userId: filter.userId }),
          ...(filter.tags && { tags: filter.tags.join(',') })
        }).toString()}`
      : ''

    return this.request<PerformanceMetrics>(
      'GET',
      `/api/analytics/performance${queryParams}`,
      undefined,
      undefined,
      'PerformanceMetrics',
      '1.0.0'
    )
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

  // ========== Spec: backend-settings-api ==========

  /**
   * Get current user's settings (auto-creates with defaults if not exists)
   * Requires authentication (JWT in Authorization header)
   * @returns Settings object with all user preferences
   */
  async getSettings(): Promise<import('@cc-task-manager/schemas').SettingsResponse> {
    return this.request('GET', '/api/settings')
  }

  /**
   * Update current user's settings
   * Requires authentication (JWT in Authorization header)
   * @param data Partial settings update (all fields optional)
   * @returns Updated settings object
   */
  async updateSettings(
    data: import('@cc-task-manager/schemas').UpdateSettingsDto
  ): Promise<import('@cc-task-manager/schemas').SettingsResponse> {
    const { updateSettingsSchema } = await import('@cc-task-manager/schemas')
    return this.request(
      'PATCH',
      '/api/settings',
      data,
      (input) => updateSettingsSchema.parse(input)
    )
  }
}

// Export a singleton instance following SOLID principles
export const apiClient = new ContractApiClient()