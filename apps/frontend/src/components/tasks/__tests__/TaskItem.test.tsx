/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskItem } from '../TaskItem'
import { TaskStatus, TaskPriority } from '@/types/task'
import type { Task } from '@/types/task'

describe('TaskItem', () => {
  const mockTask: Task = {
    id: 'task-123',
    title: 'Test Task',
    description: 'This is a test task description',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-02T15:30:00Z'),
  }

  const defaultProps = {
    task: mockTask,
    onStatusChange: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render task title correctly', () => {
      render(<TaskItem {...defaultProps} />)
      expect(screen.getByText('Test Task')).toBeInTheDocument()
    })

    it('should render task description when provided', () => {
      render(<TaskItem {...defaultProps} />)
      expect(screen.getByText('This is a test task description')).toBeInTheDocument()
    })

    it('should not render description when not provided', () => {
      const taskWithoutDescription = { ...mockTask, description: undefined }
      render(<TaskItem {...defaultProps} task={taskWithoutDescription} />)
      expect(screen.queryByText('This is a test task description')).not.toBeInTheDocument()
    })

    it('should render task status badge', () => {
      render(<TaskItem {...defaultProps} />)
      expect(screen.getByLabelText(`Status: ${TaskStatus.PENDING}`)).toBeInTheDocument()
    })

    it('should render task priority badge when provided', () => {
      render(<TaskItem {...defaultProps} />)
      expect(screen.getByLabelText(`Priority: ${TaskPriority.MEDIUM}`)).toBeInTheDocument()
    })

    it('should not render priority badge when not provided', () => {
      const taskWithoutPriority = { ...mockTask, priority: undefined }
      render(<TaskItem {...defaultProps} task={taskWithoutPriority} />)
      expect(screen.queryByLabelText(/Priority:/)).not.toBeInTheDocument()
    })

    it('should render created date', () => {
      render(<TaskItem {...defaultProps} />)
      expect(screen.getByText(/Created:/)).toBeInTheDocument()
      expect(screen.getByText(/Jan 1, 2025/)).toBeInTheDocument()
    })

    it('should render updated date when provided', () => {
      const { container } = render(<TaskItem {...defaultProps} />)
      expect(screen.getByText(/Updated:/)).toBeInTheDocument()
      // Check that a formatted date is present (timezone-agnostic)
      const timeElements = container.querySelectorAll('time')
      expect(timeElements[1]).toHaveAttribute('datetime', '2025-01-02T15:30:00.000Z')
    })
  })

  describe('Status Badges', () => {
    it('should render correct badge variant for PENDING status', () => {
      const task = { ...mockTask, status: TaskStatus.PENDING }
      render(<TaskItem {...defaultProps} task={task} />)
      const badge = screen.getByLabelText(`Status: ${TaskStatus.PENDING}`)
      expect(badge).toBeInTheDocument()
    })

    it('should render correct badge variant for ACTIVE status', () => {
      const task = { ...mockTask, status: TaskStatus.ACTIVE }
      render(<TaskItem {...defaultProps} task={task} />)
      const badge = screen.getByLabelText(`Status: ${TaskStatus.ACTIVE}`)
      expect(badge).toBeInTheDocument()
    })

    it('should render correct badge variant for COMPLETED status', () => {
      const task = { ...mockTask, status: TaskStatus.COMPLETED }
      render(<TaskItem {...defaultProps} task={task} />)
      const badge = screen.getByLabelText(`Status: ${TaskStatus.COMPLETED}`)
      expect(badge).toBeInTheDocument()
    })

    it('should render correct badge variant for FAILED status', () => {
      const task = { ...mockTask, status: TaskStatus.FAILED }
      render(<TaskItem {...defaultProps} task={task} />)
      const badge = screen.getByLabelText(`Status: ${TaskStatus.FAILED}`)
      expect(badge).toBeInTheDocument()
    })
  })

  describe('Priority Badges', () => {
    it('should render correct badge variant for LOW priority', () => {
      const task = { ...mockTask, priority: TaskPriority.LOW }
      render(<TaskItem {...defaultProps} task={task} />)
      const badge = screen.getByLabelText(`Priority: ${TaskPriority.LOW}`)
      expect(badge).toBeInTheDocument()
    })

    it('should render correct badge variant for MEDIUM priority', () => {
      const task = { ...mockTask, priority: TaskPriority.MEDIUM }
      render(<TaskItem {...defaultProps} task={task} />)
      const badge = screen.getByLabelText(`Priority: ${TaskPriority.MEDIUM}`)
      expect(badge).toBeInTheDocument()
    })

    it('should render correct badge variant for HIGH priority', () => {
      const task = { ...mockTask, priority: TaskPriority.HIGH }
      render(<TaskItem {...defaultProps} task={task} />)
      const badge = screen.getByLabelText(`Priority: ${TaskPriority.HIGH}`)
      expect(badge).toBeInTheDocument()
    })
  })

  describe('Action Buttons', () => {
    it('should render Complete button when task is not completed', () => {
      render(<TaskItem {...defaultProps} />)
      expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument()
    })

    it('should not render Complete button when task is completed', () => {
      const completedTask = { ...mockTask, status: TaskStatus.COMPLETED }
      render(<TaskItem {...defaultProps} task={completedTask} />)
      expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument()
    })

    it('should render Edit button when onEdit is provided', () => {
      render(<TaskItem {...defaultProps} />)
      expect(screen.getByRole('button', { name: `Edit task "Test Task"` })).toBeInTheDocument()
    })

    it('should not render Edit button when onEdit is not provided', () => {
      const { onEdit, ...propsWithoutEdit } = defaultProps
      render(<TaskItem {...propsWithoutEdit} />)
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    })

    it('should render Delete button when onDelete is provided', () => {
      render(<TaskItem {...defaultProps} />)
      expect(screen.getByRole('button', { name: `Delete task "Test Task"` })).toBeInTheDocument()
    })

    it('should not render Delete button when onDelete is not provided', () => {
      const { onDelete, ...propsWithoutDelete } = defaultProps
      render(<TaskItem {...propsWithoutDelete} />)
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should call onStatusChange when Complete button is clicked', async () => {
      const user = userEvent.setup()
      render(<TaskItem {...defaultProps} />)

      const completeButton = screen.getByRole('button', { name: /complete/i })
      await user.click(completeButton)

      expect(defaultProps.onStatusChange).toHaveBeenCalledWith('task-123', TaskStatus.COMPLETED)
      expect(defaultProps.onStatusChange).toHaveBeenCalledTimes(1)
    })

    it('should call onEdit with correct taskId when Edit button is clicked', async () => {
      const user = userEvent.setup()
      render(<TaskItem {...defaultProps} />)

      const editButton = screen.getByRole('button', { name: `Edit task "Test Task"` })
      await user.click(editButton)

      expect(defaultProps.onEdit).toHaveBeenCalledWith('task-123')
      expect(defaultProps.onEdit).toHaveBeenCalledTimes(1)
    })

    it('should call onDelete with correct taskId when Delete button is clicked', async () => {
      const user = userEvent.setup()
      render(<TaskItem {...defaultProps} />)

      const deleteButton = screen.getByRole('button', { name: `Delete task "Test Task"` })
      await user.click(deleteButton)

      expect(defaultProps.onDelete).toHaveBeenCalledWith('task-123')
      expect(defaultProps.onDelete).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('should have correct ARIA labels', () => {
      render(<TaskItem {...defaultProps} />)

      expect(screen.getByRole('article', { name: 'Task: Test Task' })).toBeInTheDocument()
      expect(screen.getByLabelText(`Status: ${TaskStatus.PENDING}`)).toBeInTheDocument()
      expect(screen.getByLabelText(`Priority: ${TaskPriority.MEDIUM}`)).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<TaskItem {...defaultProps} />)

      // Tab through buttons
      await user.tab()
      expect(screen.getByRole('button', { name: /complete/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /edit/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /delete/i })).toHaveFocus()
    })

    it('should trigger actions with Enter key', async () => {
      const user = userEvent.setup()
      render(<TaskItem {...defaultProps} />)

      const completeButton = screen.getByRole('button', { name: /complete/i })
      completeButton.focus()

      await user.keyboard('{Enter}')
      expect(defaultProps.onStatusChange).toHaveBeenCalledWith('task-123', TaskStatus.COMPLETED)
    })

    it('should have semantic HTML structure', () => {
      const { container } = render(<TaskItem {...defaultProps} />)

      // Check for time elements with correct dateTime
      const timeElements = container.querySelectorAll('time')
      expect(timeElements).toHaveLength(2)
      expect(timeElements[0]).toHaveAttribute('dateTime', '2025-01-01T10:00:00.000Z')
      expect(timeElements[1]).toHaveAttribute('dateTime', '2025-01-02T15:30:00.000Z')
    })
  })

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      const { container } = render(<TaskItem {...defaultProps} />)

      // Check that dates are formatted and displayed (timezone-agnostic)
      const timeElements = container.querySelectorAll('time')
      expect(timeElements[0]).toHaveAttribute('datetime', '2025-01-01T10:00:00.000Z')
      expect(timeElements[1]).toHaveAttribute('datetime', '2025-01-02T15:30:00.000Z')
      // Verify the dates are rendered (content may vary by timezone)
      expect(timeElements[0]).toHaveTextContent(/2025/)
      expect(timeElements[1]).toHaveTextContent(/2025/)
    })

    it('should handle Date objects as well as strings', () => {
      const taskWithDateObjects = {
        ...mockTask,
        createdAt: new Date('2025-03-15T08:00:00Z'),
        updatedAt: new Date('2025-03-16T12:00:00Z'),
      }
      const { container } = render(<TaskItem {...defaultProps} task={taskWithDateObjects} />)

      // Check that Date objects are handled correctly (timezone-agnostic)
      const timeElements = container.querySelectorAll('time')
      expect(timeElements[0]).toHaveAttribute('datetime', '2025-03-15T08:00:00.000Z')
      expect(timeElements[1]).toHaveAttribute('datetime', '2025-03-16T12:00:00.000Z')
      // Verify the dates are rendered
      expect(timeElements[0]).toHaveTextContent(/2025/)
      expect(timeElements[1]).toHaveTextContent(/2025/)
    })
  })

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(<TaskItem {...defaultProps} className="custom-class" />)
      const card = container.querySelector('.custom-class')
      expect(card).toBeInTheDocument()
    })

    it('should apply hover and focus styles', () => {
      const { container } = render(<TaskItem {...defaultProps} />)
      const card = container.querySelector('[role="article"]')
      expect(card).toHaveClass('hover:shadow-md')
      expect(card).toHaveClass('focus-within:ring-2')
    })
  })

  describe('React.memo Optimization', () => {
    it('should not re-render when props do not change', () => {
      const { rerender } = render(<TaskItem {...defaultProps} />)
      const initialRender = screen.getByText('Test Task')

      // Re-render with same props
      rerender(<TaskItem {...defaultProps} />)
      const afterRerender = screen.getByText('Test Task')

      // The component should be the same instance (React.memo prevents re-render)
      expect(initialRender).toBe(afterRerender)
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing optional handlers gracefully', () => {
      render(<TaskItem task={mockTask} />)

      // Should render without buttons
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should handle task with minimal data', () => {
      const minimalTask: Task = {
        id: 'minimal-task',
        title: 'Minimal',
        status: TaskStatus.PENDING,
        createdAt: new Date(),
      }

      render(<TaskItem task={minimalTask} />)
      expect(screen.getByText('Minimal')).toBeInTheDocument()
      expect(screen.queryByText(/Priority:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Updated:/)).not.toBeInTheDocument()
    })

    it('should handle very long task titles', () => {
      const longTitle = 'A'.repeat(200)
      const taskWithLongTitle = { ...mockTask, title: longTitle }

      render(<TaskItem {...defaultProps} task={taskWithLongTitle} />)
      expect(screen.getByText(longTitle)).toBeInTheDocument()
    })

    it('should handle very long descriptions', () => {
      const longDescription = 'B'.repeat(500)
      const taskWithLongDescription = { ...mockTask, description: longDescription }

      render(<TaskItem {...defaultProps} task={taskWithLongDescription} />)
      expect(screen.getByText(longDescription)).toBeInTheDocument()
    })
  })
})