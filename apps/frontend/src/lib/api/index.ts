export { ContractApiClient, apiClient } from './contract-client'
export { ReactQueryProvider } from './providers'

// Re-export contract types for convenience
export type {
  ProcessConfig,
  TaskExecutionRequest,
  WorkerConfig,
  TaskStatus
} from '@cc-task-manager/types'