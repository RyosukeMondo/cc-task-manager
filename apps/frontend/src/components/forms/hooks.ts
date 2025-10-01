'use client';

import { useState, useCallback } from 'react';
import { SubmitHandler, FieldValues } from 'react-hook-form';
import {
  validateProcessConfig,
  validateTaskExecutionRequest,
  validateWorkerConfig,
  validateClaudeCodeOptions,
  validateTaskStatus
} from '@cc-task-manager/schemas';
import type {
  ProcessConfig,
  TaskExecutionRequest,
  WorkerConfig,
  ClaudeCodeOptions,
  WorkerTaskStatus
} from '@cc-task-manager/types';

/**
 * Generic form submission hook with error handling
 * Follows Single Responsibility Principle for form submission logic
 */
export function useFormSubmission<T extends FieldValues>() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    (submitFn: (data: T) => Promise<void>): SubmitHandler<T> => {
      return async (data: T) => {
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        try {
          await submitFn(data);
          setSuccess(true);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Submission failed';
          setError(errorMessage);
          throw err; // Re-throw for component handling
        } finally {
          setIsLoading(false);
        }
      };
    },
    []
  );

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    error,
    success,
    handleSubmit,
    reset
  };
}

/**
 * Hook for Process Config form with validation
 * Uses existing contract validation infrastructure
 */
export function useProcessConfigForm() {
  const { isLoading, error, success, handleSubmit, reset } = useFormSubmission<ProcessConfig>();

  const submitWithValidation = useCallback(
    (submitFn: (data: ProcessConfig) => Promise<void>) => {
      return handleSubmit(async (data) => {
        // Validate using existing contract validation
        const validatedData = validateProcessConfig(data);
        await submitFn(validatedData);
      });
    },
    [handleSubmit]
  );

  return {
    isLoading,
    error,
    success,
    submitWithValidation,
    reset
  };
}

/**
 * Hook for Task Execution Request form with validation
 * Uses existing contract validation infrastructure
 */
export function useTaskExecutionRequestForm() {
  const { isLoading, error, success, handleSubmit, reset } = useFormSubmission<TaskExecutionRequest>();

  const submitWithValidation = useCallback(
    (submitFn: (data: TaskExecutionRequest) => Promise<void>) => {
      return handleSubmit(async (data) => {
        // Validate using existing contract validation
        const validatedData = validateTaskExecutionRequest(data);
        await submitFn(validatedData);
      });
    },
    [handleSubmit]
  );

  return {
    isLoading,
    error,
    success,
    submitWithValidation,
    reset
  };
}

/**
 * Hook for Worker Config form with validation
 * Uses existing contract validation infrastructure
 */
export function useWorkerConfigForm() {
  const { isLoading, error, success, handleSubmit, reset } = useFormSubmission<WorkerConfig>();

  const submitWithValidation = useCallback(
    (submitFn: (data: WorkerConfig) => Promise<void>) => {
      return handleSubmit(async (data) => {
        // Validate using existing contract validation
        const validatedData = validateWorkerConfig(data);
        await submitFn(validatedData);
      });
    },
    [handleSubmit]
  );

  return {
    isLoading,
    error,
    success,
    submitWithValidation,
    reset
  };
}

/**
 * Hook for Claude Code Options form with validation
 * Uses existing contract validation infrastructure
 */
export function useClaudeCodeOptionsForm() {
  const { isLoading, error, success, handleSubmit, reset } = useFormSubmission<ClaudeCodeOptions>();

  const submitWithValidation = useCallback(
    (submitFn: (data: ClaudeCodeOptions) => Promise<void>) => {
      return handleSubmit(async (data) => {
        // Validate using existing contract validation
        const validatedData = validateClaudeCodeOptions(data);
        await submitFn(validatedData);
      });
    },
    [handleSubmit]
  );

  return {
    isLoading,
    error,
    success,
    submitWithValidation,
    reset
  };
}

/**
 * Hook for form state management with local storage persistence
 * Applies Single Responsibility Principle for state persistence
 */
export function useFormPersistence<T extends FieldValues>(key: string) {
  const [savedData, setSavedData] = useState<Partial<T> | null>(null);

  const saveFormData = useCallback(
    (data: Partial<T>) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        setSavedData(data);
      } catch (error) {
        console.warn('Failed to save form data:', error);
      }
    },
    [key]
  );

  const loadFormData = useCallback((): Partial<T> | null => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved) as Partial<T>;
        setSavedData(data);
        return data;
      }
    } catch (error) {
      console.warn('Failed to load form data:', error);
    }
    return null;
  }, [key]);

  const clearFormData = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setSavedData(null);
    } catch (error) {
      console.warn('Failed to clear form data:', error);
    }
  }, [key]);

  return {
    savedData,
    saveFormData,
    loadFormData,
    clearFormData
  };
}

/**
 * Hook for real-time form validation feedback
 * Uses existing contract validation for immediate feedback
 */
export function useRealtimeValidation<T extends FieldValues>(
  validateFn: (data: unknown) => T,
  data: Partial<T>
) {
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
  }>({ isValid: false, errors: [] });

  const validate = useCallback(() => {
    try {
      validateFn(data);
      setValidationResult({ isValid: true, errors: [] });
    } catch (error: any) {
      const errors = error?.issues?.map((issue: any) => issue.message) || [
        error?.message || 'Validation failed'
      ];
      setValidationResult({ isValid: false, errors });
    }
  }, [validateFn, data]);

  return {
    ...validationResult,
    validate
  };
}

/**
 * Pre-configured validation hooks for each contract type
 */
export const useProcessConfigValidation = (data: Partial<ProcessConfig>) =>
  useRealtimeValidation(validateProcessConfig, data);

export const useTaskExecutionRequestValidation = (data: Partial<TaskExecutionRequest>) =>
  useRealtimeValidation(validateTaskExecutionRequest, data);

export const useWorkerConfigValidation = (data: Partial<WorkerConfig>) =>
  useRealtimeValidation(validateWorkerConfig, data);

export const useClaudeCodeOptionsValidation = (data: Partial<ClaudeCodeOptions>) =>
  useRealtimeValidation(validateClaudeCodeOptions, data);

export const useWorkerTaskStatusValidation = (data: Partial<WorkerTaskStatus>) =>
  useRealtimeValidation(validateTaskStatus, data);