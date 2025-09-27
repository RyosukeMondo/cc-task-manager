export { ContractApiClient, apiClient } from './contract-client'
export { ReactQueryProvider } from './providers'
export {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useProcesses,
  useCreateProcess,
  useWorkers,
  useCreateWorker,
  useLogin,
  useLogout,
  useRefreshToken,
  useAvailableContracts,
  useGenerateClientTypes,
  useInvalidateOnTaskUpdate,
  queryKeys
} from './hooks'

// Re-export contract types for convenience
export type {
  ProcessConfig,
  TaskExecutionRequest,
  WorkerConfig,
  TaskStatus
} from '@cc-task-manager/types'