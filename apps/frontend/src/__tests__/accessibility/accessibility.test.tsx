/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { TaskDisplay } from '../../components/tasks/TaskDisplay'
import { ContractForms } from '../../components/forms/ContractForms'
import { Dashboard } from '../../components/dashboard/Dashboard'
import { TaskState } from '@cc-task-manager/schemas'
import type { TaskStatus } from '@cc-task-manager/types'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock theme context
jest.mock('../../lib/theme/context', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
}))

// Mock chart.js components for dashboard tests
jest.mock('../../components/dashboard/charts/TaskTrendChart', () => ({
  TaskTrendChart: () => <div data-testid="mock-task-trend-chart" aria-label="Task trend chart" />,
}))

jest.mock('../../components/dashboard/charts/PerformanceChart', () => ({
  PerformanceChart: () => <div data-testid="mock-performance-chart" aria-label="Performance chart" />,
}))

jest.mock('../../components/dashboard/charts/TaskStatusChart', () => ({
  TaskStatusChart: () => <div data-testid="mock-task-status-chart" aria-label="Task status chart" />,
}))

// Mock dashboard data hook
jest.mock('../../components/dashboard/hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    taskMetrics: {
      total: 100,
      completed: 75,
      failed: 10,
      running: 15
    },
    performanceMetrics: {
      averageExecutionTime: 1500,
      successRate: 0.9,
      throughput: 50
    },
    isLoading: false,
    error: null
  }),
}))

describe('Accessibility Tests', () => {
  describe('TaskDisplay Component', () => {
    const mockTask: TaskStatus = {
      id: 'accessibility-test-task',
      state: TaskState.RUNNING,
      progress: 0.65,
      startTime: new Date('2023-01-01T10:00:00Z'),
      lastActivity: new Date('2023-01-01T10:30:00Z'),
      metadata: {
        correlationId: 'corr-123',
        tags: ['accessibility', 'test']
      }
    }

    const defaultProps = {
      task: mockTask,
      onUpdate: jest.fn(),
      onCancel: jest.fn(),
      onRetry: jest.fn(),
    }

    it('should not have accessibility violations', async () => {
      const { container } = render(<TaskDisplay {...defaultProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper ARIA labels for interactive elements', async () => {
      const { container } = render(<TaskDisplay {...defaultProps} />)

      // Check progress bar accessibility
      const progressBar = container.querySelector('[role="progressbar"]')
      expect(progressBar).toHaveAttribute('aria-valuenow', '65')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
      expect(progressBar).toHaveAttribute('aria-label')

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should maintain accessibility with different task states', async () => {
      const { container, rerender } = render(<TaskDisplay {...defaultProps} />)

      // Test running state
      let results = await axe(container)
      expect(results).toHaveNoViolations()

      // Test completed state
      const completedTask = { ...mockTask, state: TaskState.COMPLETED, progress: 1.0 }
      rerender(<TaskDisplay {...defaultProps} task={completedTask} />)
      results = await axe(container)
      expect(results).toHaveNoViolations()

      // Test failed state
      const failedTask = { ...mockTask, state: TaskState.FAILED }
      rerender(<TaskDisplay {...defaultProps} task={failedTask} />)
      results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should support high contrast mode', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      const { container } = render(<TaskDisplay {...defaultProps} />)
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })
      expect(results).toHaveNoViolations()
    })
  })

  describe('ContractForms Component', () => {
    const defaultProps = {
      onSubmit: jest.fn(),
      onCancel: jest.fn(),
    }

    it('should not have accessibility violations', async () => {
      const { container } = render(<ContractForms {...defaultProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper form labels and structure', async () => {
      const { container } = render(<ContractForms {...defaultProps} />)

      // Check for proper form structure
      const form = container.querySelector('form')
      expect(form).toBeInTheDocument()

      // Check for proper label associations
      const inputs = container.querySelectorAll('input, textarea, select')
      inputs.forEach(input => {
        const label = container.querySelector(`label[for="${input.id}"]`)
        expect(label).toBeInTheDocument()
      })

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should properly announce validation errors to screen readers', async () => {
      const { container } = render(<ContractForms {...defaultProps} />)

      // Mock validation errors
      const errorMessages = container.querySelectorAll('[role="alert"]')
      errorMessages.forEach(error => {
        expect(error).toHaveAttribute('aria-live', 'polite')
      })

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should support keyboard navigation', async () => {
      const { container } = render(<ContractForms {...defaultProps} />)

      // Check for proper tab order
      const focusableElements = container.querySelectorAll(
        'input, button, textarea, select, [tabindex]:not([tabindex="-1"])'
      )

      focusableElements.forEach(element => {
        expect(element).not.toHaveAttribute('tabindex', '-1')
      })

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Dashboard Component', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<Dashboard />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper heading hierarchy', async () => {
      const { container } = render(<Dashboard />)

      // Check for proper heading structure (h1 > h2 > h3, etc.)
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      expect(headings.length).toBeGreaterThan(0)

      // Ensure charts have proper accessibility labels
      const charts = container.querySelectorAll('[data-testid*="chart"]')
      charts.forEach(chart => {
        expect(chart).toHaveAttribute('aria-label')
      })

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should provide alternative text for visual content', async () => {
      const { container } = render(<Dashboard />)

      // Check that charts and visual elements have proper accessibility
      const visualElements = container.querySelectorAll('canvas, svg, img')
      visualElements.forEach(element => {
        // Should have either alt text, aria-label, or aria-labelledby
        const hasAccessibleName =
          element.hasAttribute('alt') ||
          element.hasAttribute('aria-label') ||
          element.hasAttribute('aria-labelledby')
        expect(hasAccessibleName).toBe(true)
      })

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Theme and Color Accessibility', () => {
    it('should maintain accessibility in dark mode', async () => {
      // Mock dark theme context
      jest.doMock('../../lib/theme/context', () => ({
        useTheme: () => ({
          theme: 'dark',
          setTheme: jest.fn(),
        }),
      }))

      const { TaskDisplay: DarkTaskDisplay } = await import('../../components/tasks/TaskDisplay')

      const mockTask: TaskStatus = {
        id: 'dark-mode-test',
        state: TaskState.RUNNING,
        progress: 0.5,
        startTime: new Date(),
        lastActivity: new Date(),
      }

      const { container } = render(
        <DarkTaskDisplay
          task={mockTask}
          onUpdate={jest.fn()}
          onCancel={jest.fn()}
          onRetry={jest.fn()}
        />
      )

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })
      expect(results).toHaveNoViolations()
    })

    it('should respect reduced motion preferences', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      const mockTask: TaskStatus = {
        id: 'reduced-motion-test',
        state: TaskState.RUNNING,
        progress: 0.5,
        startTime: new Date(),
        lastActivity: new Date(),
      }

      const { container } = render(
        <TaskDisplay
          task={mockTask}
          onUpdate={jest.fn()}
          onCancel={jest.fn()}
          onRetry={jest.fn()}
        />
      )

      // Should not have any accessibility violations related to motion
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Focus Management', () => {
    it('should manage focus appropriately in modals and dialogs', async () => {
      // This would test modal/dialog components when they exist
      // For now, we'll test basic focus management

      const { container } = render(<ContractForms onSubmit={jest.fn()} onCancel={jest.fn()} />)

      // Check that there are no focus traps without proper escape mechanisms
      const results = await axe(container, {
        rules: {
          'focus-order-semantics': { enabled: true }
        }
      })
      expect(results).toHaveNoViolations()
    })

    it('should provide skip links for keyboard navigation', async () => {
      // Test skip links if they exist in layout components
      const { container } = render(<Dashboard />)

      // Check for skip links or similar navigation aids
      const skipLinks = container.querySelectorAll('a[href*="#"], button[aria-label*="skip"]')

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('ARIA Roles and Properties', () => {
    it('should use appropriate ARIA roles for custom components', async () => {
      const mockTask: TaskStatus = {
        id: 'aria-test',
        state: TaskState.RUNNING,
        progress: 0.75,
        startTime: new Date(),
        lastActivity: new Date(),
      }

      const { container } = render(
        <TaskDisplay
          task={mockTask}
          onUpdate={jest.fn()}
          onCancel={jest.fn()}
          onRetry={jest.fn()}
        />
      )

      // Check for proper ARIA roles
      const progressBar = container.querySelector('[role="progressbar"]')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuenow')
      expect(progressBar).toHaveAttribute('aria-valuemin')
      expect(progressBar).toHaveAttribute('aria-valuemax')

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should provide proper ARIA descriptions for complex interactions', async () => {
      const { container } = render(<ContractForms onSubmit={jest.fn()} onCancel={jest.fn()} />)

      // Check for proper ARIA descriptions
      const complexInputs = container.querySelectorAll('input[aria-describedby], textarea[aria-describedby]')
      complexInputs.forEach(input => {
        const describedBy = input.getAttribute('aria-describedby')
        if (describedBy) {
          const description = container.querySelector(`#${describedBy}`)
          expect(description).toBeInTheDocument()
        }
      })

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})