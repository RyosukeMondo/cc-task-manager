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
  TaskStatusSchema,
  validateUserRegistration,
  validateLoginRequest,
  validateTokenRefresh,
  validateTrendFilter,
  type UserRegistration,
  type LoginRequest,
  type AuthResponse,
  type UserBase,
  type TokenRefresh,
  type AnalyticsFilterDto,
  type TrendFilterDto,
  type PerformanceMetricsDto,
  type TrendDataResponseDto
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

  // ========== Spec: backend-tasks-api ==========

  /**
   * Get all tasks for the authenticated user with optional filtering
   * @param filter Optional filter parameters (status, priority, limit, offset)
   * @returns Paginated task list
   */
  async getTasks(filter?: import('@cc-task-manager/schemas').ApiTaskFilterDto): Promise<import('@cc-task-manager/schemas').PaginatedTasksDto> {
    const queryParams = filter
      ? `?${new URLSearchParams({
          ...(filter.status && { status: filter.status }),
          ...(filter.priority && { priority: filter.priority }),
          ...(filter.limit !== undefined && { limit: filter.limit.toString() }),
          ...(filter.offset !== undefined && { offset: filter.offset.toString() })
        }).toString()}`
      : ''

    return this.request<import('@cc-task-manager/schemas').PaginatedTasksDto>(
      'GET',
      `/api/tasks${queryParams}`
    )
  }

  /**
   * Create a new task for the authenticated user
   * @param data Task creation data (title, description, priority)
   * @returns Created task object
   */
  async createTask(data: import('@cc-task-manager/schemas').CreateApiTaskDto): Promise<import('@cc-task-manager/schemas').ApiTaskDto> {
    const { createTaskSchema } = await import('@cc-task-manager/schemas')
    return this.request<import('@cc-task-manager/schemas').ApiTaskDto>(
      'POST',
      '/api/tasks',
      data,
      (d) => createTaskSchema.parse(d)
    )
  }

  /**
   * Get a single task by ID
   * @param id Task ID
   * @returns Task object
   */
  async getTaskById(id: string): Promise<import('@cc-task-manager/schemas').ApiTaskDto> {
    return this.request<import('@cc-task-manager/schemas').ApiTaskDto>(
      'GET',
      `/api/tasks/${id}`
    )
  }

  /**
   * Update an existing task
   * @param id Task ID
   * @param data Task update data (status, priority, errorMessage)
   * @returns Updated task object
   */
  async updateTask(id: string, data: import('@cc-task-manager/schemas').UpdateApiTaskDto): Promise<import('@cc-task-manager/schemas').ApiTaskDto> {
    const { updateTaskSchema } = await import('@cc-task-manager/schemas')
    return this.request<import('@cc-task-manager/schemas').ApiTaskDto>(
      'PATCH',
      `/api/tasks/${id}`,
      data,
      (d) => updateTaskSchema.parse(d)
    )
  }

  /**
   * Delete a task (soft delete)
   * @param id Task ID
   */
  async deleteTask(id: string): Promise<void> {
    return this.request<void>('DELETE', `/api/tasks/${id}`)
  }

  // ========== Spec: backend-analytics-api ==========

  /**
   * Get performance metrics for analytics
   * @param filter Optional analytics filter (startDate, endDate)
   * @returns Performance metrics with completion rate, execution time, and throughput
   */
  async getPerformanceMetrics(filter?: AnalyticsFilterDto): Promise<PerformanceMetricsDto> {
    const queryParams = new URLSearchParams()
    if (filter?.startDate) queryParams.append('startDate', filter.startDate)
    if (filter?.endDate) queryParams.append('endDate', filter.endDate)

    const queryString = queryParams.toString()
    const path = queryString ? `/api/analytics/performance?${queryString}` : '/api/analytics/performance'

    return this.request<PerformanceMetricsDto>(
      'GET',
      path
    )
  }

  /**
   * Get trend data for time-series analytics
   * @param filter Trend filter with groupBy (day/week/month), startDate, endDate
   * @returns Array of trend data points with metrics per period
   */
  async getTrendData(filter: TrendFilterDto): Promise<TrendDataResponseDto> {
    const queryParams = new URLSearchParams()
    queryParams.append('groupBy', filter.groupBy)
    if (filter.startDate) queryParams.append('startDate', filter.startDate)
    if (filter.endDate) queryParams.append('endDate', filter.endDate)

    return this.request<TrendDataResponseDto>(
      'GET',
      `/api/analytics/trends?${queryParams.toString()}`
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