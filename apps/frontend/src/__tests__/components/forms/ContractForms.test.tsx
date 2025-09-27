/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContractForms } from '../../../components/forms/ContractForms'
import { validateTaskExecutionRequest } from '@cc-task-manager/schemas'

// Mock the form context and validation
jest.mock('../../../lib/theme/context', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
}))

jest.mock('@cc-task-manager/schemas', () => ({
  ...jest.requireActual('@cc-task-manager/schemas'),
  validateTaskExecutionRequest: jest.fn(),
}))

const mockValidateTaskExecutionRequest = validateTaskExecutionRequest as jest.MockedFunction<typeof validateTaskExecutionRequest>

describe('ContractForms', () => {
  const defaultProps = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockValidateTaskExecutionRequest.mockReturnValue({
      success: true,
      data: {
        task: 'test task',
        options: { timeout: 30000 }
      }
    })
  })

  it('should render task execution form', () => {
    render(<ContractForms {...defaultProps} />)

    expect(screen.getByLabelText(/task/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/timeout/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('should validate form input using contract validation', async () => {
    const user = userEvent.setup()
    render(<ContractForms {...defaultProps} />)

    const taskInput = screen.getByLabelText(/task/i)
    const timeoutInput = screen.getByLabelText(/timeout/i)
    const submitButton = screen.getByRole('button', { name: /submit/i })

    await user.type(taskInput, 'console.log("Hello World")')
    await user.clear(timeoutInput)
    await user.type(timeoutInput, '25000')

    await user.click(submitButton)

    await waitFor(() => {
      expect(mockValidateTaskExecutionRequest).toHaveBeenCalledWith({
        task: 'console.log("Hello World")',
        options: {
          timeout: 25000
        }
      })
    })

    expect(defaultProps.onSubmit).toHaveBeenCalledWith({
      task: 'console.log("Hello World")',
      options: { timeout: 25000 }
    })
  })

  it('should display validation errors from contract validation', async () => {
    const user = userEvent.setup()

    // Mock validation failure
    mockValidateTaskExecutionRequest.mockReturnValue({
      success: false,
      error: {
        issues: [
          {
            path: ['task'],
            message: 'Task cannot be empty',
            code: 'too_small'
          },
          {
            path: ['options', 'timeout'],
            message: 'Timeout must be at least 1000ms',
            code: 'too_small'
          }
        ]
      }
    } as any)

    render(<ContractForms {...defaultProps} />)

    const taskInput = screen.getByLabelText(/task/i)
    const timeoutInput = screen.getByLabelText(/timeout/i)
    const submitButton = screen.getByRole('button', { name: /submit/i })

    await user.clear(taskInput)
    await user.clear(timeoutInput)
    await user.type(timeoutInput, '500')

    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Task cannot be empty')).toBeInTheDocument()
      expect(screen.getByText('Timeout must be at least 1000ms')).toBeInTheDocument()
    })

    // Should not call onSubmit when validation fails
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('should handle real-time validation', async () => {
    const user = userEvent.setup()
    render(<ContractForms {...defaultProps} />)

    const taskInput = screen.getByLabelText(/task/i)

    // Start typing
    await user.type(taskInput, 'test')

    // Should trigger real-time validation
    await waitFor(() => {
      expect(mockValidateTaskExecutionRequest).toHaveBeenCalled()
    })
  })

  it('should populate optional fields correctly', async () => {
    const user = userEvent.setup()
    render(<ContractForms {...defaultProps} />)

    const workingDirectoryInput = screen.getByLabelText(/working directory/i)
    const taskInput = screen.getByLabelText(/task/i)

    await user.type(taskInput, 'test task')
    await user.type(workingDirectoryInput, '/tmp/test')

    const submitButton = screen.getByRole('button', { name: /submit/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockValidateTaskExecutionRequest).toHaveBeenCalledWith({
        task: 'test task',
        options: {
          timeout: 30000, // default value
          workingDirectory: '/tmp/test'
        }
      })
    })
  })

  it('should handle environment variables input', async () => {
    const user = userEvent.setup()
    render(<ContractForms {...defaultProps} />)

    const taskInput = screen.getByLabelText(/task/i)
    const envVarsInput = screen.getByLabelText(/environment variables/i)

    await user.type(taskInput, 'echo $TEST_VAR')
    await user.type(envVarsInput, 'TEST_VAR=hello\nANOTHER_VAR=world')

    const submitButton = screen.getByRole('button', { name: /submit/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockValidateTaskExecutionRequest).toHaveBeenCalledWith({
        task: 'echo $TEST_VAR',
        options: {
          timeout: 30000,
          environmentVariables: {
            TEST_VAR: 'hello',
            ANOTHER_VAR: 'world'
          }
        }
      })
    })
  })

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<ContractForms {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(defaultProps.onCancel).toHaveBeenCalled()
  })

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup()
    render(<ContractForms {...defaultProps} />)

    const taskInput = screen.getByLabelText(/task/i)
    const submitButton = screen.getByRole('button', { name: /submit/i })

    await user.type(taskInput, 'test task')
    await user.click(submitButton)

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalled()
    })

    // Form should be reset
    expect(taskInput).toHaveValue('')
  })

  it('should maintain accessibility standards', () => {
    render(<ContractForms {...defaultProps} />)

    // All form inputs should have proper labels
    const taskInput = screen.getByLabelText(/task/i)
    const timeoutInput = screen.getByLabelText(/timeout/i)

    expect(taskInput).toHaveAttribute('aria-required', 'true')
    expect(timeoutInput).toHaveAttribute('type', 'number')

    // Error messages should be properly associated
    const submitButton = screen.getByRole('button', { name: /submit/i })
    expect(submitButton).toBeEnabled()
  })

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<ContractForms {...defaultProps} />)

    // Tab through form elements
    await user.tab()
    expect(screen.getByLabelText(/task/i)).toHaveFocus()

    await user.tab()
    expect(screen.getByLabelText(/timeout/i)).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: /submit/i })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus()
  })

  it('should handle form submission with Enter key', async () => {
    const user = userEvent.setup()
    render(<ContractForms {...defaultProps} />)

    const taskInput = screen.getByLabelText(/task/i)
    await user.type(taskInput, 'test task')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalled()
    })
  })
})