/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDisplay } from '../../../components/tasks/TaskDisplay'
import { TaskState } from '@cc-task-manager/schemas'
import type { TaskStatus } from '@cc-task-manager/types'

// Mock the theme context
jest.mock('../../../lib/theme/context', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
}))

describe('TaskDisplay', () => {
  const mockTask: TaskStatus = {
    id: 'test-task-123',
    state: TaskState.RUNNING,
    progress: 0.65,
    startTime: new Date('2023-01-01T10:00:00Z'),
    lastActivity: new Date('2023-01-01T10:30:00Z'),
    metadata: {
      correlationId: 'corr-123',
      tags: ['test', 'component']
    }
  }

  const defaultProps = {
    task: mockTask,
    onUpdate: jest.fn(),
    onCancel: jest.fn(),
    onRetry: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render task information correctly', () => {
    render(<TaskDisplay {...defaultProps} />)

    expect(screen.getByText('test-task-123')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
  })

  it('should display task state correctly for different states', () => {
    // Test completed state
    const completedTask = { ...mockTask, state: TaskState.COMPLETED, progress: 1.0 }
    const { rerender } = render(<TaskDisplay {...defaultProps} task={completedTask} />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()

    // Test failed state
    const failedTask = { ...mockTask, state: TaskState.FAILED }
    rerender(<TaskDisplay {...defaultProps} task={failedTask} />)
    expect(screen.getByText('Failed')).toBeInTheDocument()

    // Test pending state
    const pendingTask = { ...mockTask, state: TaskState.PENDING, progress: 0 }
    rerender(<TaskDisplay {...defaultProps} task={pendingTask} />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('should handle task metadata display', () => {
    render(<TaskDisplay {...defaultProps} />)

    // Check correlation ID is displayed
    expect(screen.getByText(/corr-123/)).toBeInTheDocument()

    // Check tags are displayed
    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('component')).toBeInTheDocument()
  })

  it('should handle tasks without metadata gracefully', () => {
    const taskWithoutMetadata = {
      ...mockTask,
      metadata: undefined
    }

    render(<TaskDisplay {...defaultProps} task={taskWithoutMetadata} />)

    // Should still render basic task information
    expect(screen.getByText('test-task-123')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<TaskDisplay {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(defaultProps.onCancel).toHaveBeenCalledWith('test-task-123')
  })

  it('should call onRetry when retry button is clicked for failed tasks', async () => {
    const user = userEvent.setup()
    const failedTask = { ...mockTask, state: TaskState.FAILED }

    render(<TaskDisplay {...defaultProps} task={failedTask} />)

    const retryButton = screen.getByRole('button', { name: /retry/i })
    await user.click(retryButton)

    expect(defaultProps.onRetry).toHaveBeenCalledWith('test-task-123')
  })

  it('should not show retry button for non-failed tasks', () => {
    render(<TaskDisplay {...defaultProps} />)

    const retryButton = screen.queryByRole('button', { name: /retry/i })
    expect(retryButton).not.toBeInTheDocument()
  })

  it('should not show cancel button for completed tasks', () => {
    const completedTask = { ...mockTask, state: TaskState.COMPLETED }
    render(<TaskDisplay {...defaultProps} task={completedTask} />)

    const cancelButton = screen.queryByRole('button', { name: /cancel/i })
    expect(cancelButton).not.toBeInTheDocument()
  })

  it('should format timestamps correctly', () => {
    render(<TaskDisplay {...defaultProps} />)

    // Should display formatted start time
    expect(screen.getByText(/10:00/)).toBeInTheDocument()
    // Should display formatted last activity
    expect(screen.getByText(/10:30/)).toBeInTheDocument()
  })

  it('should handle progress bar accessibility', () => {
    render(<TaskDisplay {...defaultProps} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar).toHaveAttribute('aria-valuenow', '65')
    expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    expect(progressBar).toHaveAttribute('aria-label', 'Task progress: 65%')
  })

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<TaskDisplay {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })

    // Focus should be able to reach the cancel button
    await user.tab()
    expect(cancelButton).toHaveFocus()

    // Enter key should trigger cancel
    await user.keyboard('{Enter}')
    expect(defaultProps.onCancel).toHaveBeenCalledWith('test-task-123')
  })

  it('should update when task props change', async () => {
    const { rerender } = render(<TaskDisplay {...defaultProps} />)

    expect(screen.getByText('65%')).toBeInTheDocument()

    const updatedTask = { ...mockTask, progress: 0.85 }
    rerender(<TaskDisplay {...defaultProps} task={updatedTask} />)

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument()
    })
  })
})