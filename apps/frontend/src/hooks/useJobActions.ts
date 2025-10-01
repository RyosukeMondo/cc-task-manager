'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/contract-client'
import { useToast } from '@/components/feedback/Toast'

/**
 * Hook to manage job actions (retry, cancel, retry all) with mutations
 *
 * Features:
 * - retryJob: Retry a single failed job
 * - cancelJob: Cancel a pending or active job
 * - retryAllFailed: Retry all failed jobs in bulk
 * - Automatic cache invalidation on success
 * - Success toasts for user feedback
 * - Error handling with error toasts
 *
 * @returns Job action mutation functions and loading states
 */
export function useJobActions() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Retry a single job
  const retryJob = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiClient.retryJob(jobId)
    },
    onSuccess: (_data, jobId) => {
      // Invalidate queue query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['queue'] })

      // Show success toast
      toast({
        variant: 'success',
        title: 'Job Retried',
        description: `Job ${jobId.substring(0, 8)}... has been queued for retry`,
      })
    },
    onError: (error: Error, jobId) => {
      // Show error toast
      toast({
        variant: 'destructive',
        title: 'Retry Failed',
        description: `Failed to retry job ${jobId.substring(0, 8)}...: ${error.message}`,
      })
    },
  })

  // Cancel a pending or active job
  const cancelJob = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiClient.cancelJob(jobId)
    },
    onSuccess: (_data, jobId) => {
      // Invalidate queue query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['queue'] })

      // Show success toast
      toast({
        variant: 'success',
        title: 'Job Cancelled',
        description: `Job ${jobId.substring(0, 8)}... has been cancelled`,
      })
    },
    onError: (error: Error, jobId) => {
      // Show error toast
      toast({
        variant: 'destructive',
        title: 'Cancel Failed',
        description: `Failed to cancel job ${jobId.substring(0, 8)}...: ${error.message}`,
      })
    },
  })

  // Retry all failed jobs
  const retryAllFailed = useMutation({
    mutationFn: async () => {
      return await apiClient.retryAllFailedJobs()
    },
    onSuccess: (data) => {
      // Invalidate queue query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['queue'] })

      // Show success toast with count
      toast({
        variant: 'success',
        title: 'Jobs Retried',
        description: `${data.count} failed ${data.count === 1 ? 'job has' : 'jobs have'} been queued for retry`,
      })
    },
    onError: (error: Error) => {
      // Show error toast
      toast({
        variant: 'destructive',
        title: 'Retry All Failed',
        description: `Failed to retry jobs: ${error.message}`,
      })
    },
  })

  return {
    retryJob: retryJob.mutate,
    cancelJob: cancelJob.mutate,
    retryAllFailed: retryAllFailed.mutate,
    isPending: retryJob.isPending || cancelJob.isPending || retryAllFailed.isPending,
  }
}
