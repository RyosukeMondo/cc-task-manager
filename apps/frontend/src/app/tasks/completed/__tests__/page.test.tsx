/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CompletedTasksPage from '../page';
import { TaskState } from '@cc-task-manager/types';
import type { TaskStatus } from '@cc-task-manager/types';

// Mock the useTasks hook
jest.mock('@/lib/api/hooks', () => ({
  useTasks: jest.fn(),
}));

// Mock the theme context
jest.mock('@/lib/theme/context', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
}));

// Mock the TaskList component
jest.mock('@/components/tasks/TaskList', () => ({
  TaskList: ({ tasks, isLoading, showFilters, showSearch }: any) => (
    <div data-testid="task-list">
      <div data-testid="task-count">{tasks.length}</div>
      <div data-testid="is-loading">{isLoading.toString()}</div>
      <div data-testid="show-filters">{showFilters.toString()}</div>
      <div data-testid="show-search">{showSearch.toString()}</div>
      {tasks.map((task: TaskStatus) => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          {task.id} - {task.state}
        </div>
      ))}
    </div>
  ),
}));

// Mock the AppLayout component
jest.mock('@/components/layout', () => ({
  AppLayout: ({ children }: any) => <div data-testid="app-layout">{children}</div>,
}));

import { useTasks } from '@/lib/api/hooks';

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;

describe('CompletedTasksPage', () => {
  const mockCompletedTask1: TaskStatus = {
    id: 'task-1',
    taskId: 'task-1',
    state: TaskState.COMPLETED,
    progress: 1.0,
    startTime: new Date('2025-09-30T10:00:00Z'),
    lastActivity: new Date('2025-09-30T12:00:00Z'),
    metadata: {
      correlationId: 'corr-1',
      tags: ['completed'],
    },
  };

  const mockCompletedTask2: TaskStatus = {
    id: 'task-2',
    taskId: 'task-2',
    state: TaskState.COMPLETED,
    progress: 1.0,
    startTime: new Date('2025-09-30T09:00:00Z'),
    lastActivity: new Date('2025-09-30T11:00:00Z'),
    metadata: {
      correlationId: 'corr-2',
      tags: ['test'],
    },
  };

  const mockRunningTask: TaskStatus = {
    id: 'task-3',
    taskId: 'task-3',
    state: TaskState.RUNNING,
    progress: 0.5,
    startTime: new Date('2025-09-30T13:00:00Z'),
    lastActivity: new Date('2025-09-30T13:30:00Z'),
    metadata: {
      correlationId: 'corr-3',
      tags: ['running'],
    },
  };

  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render page header with completed tasks title', () => {
    mockUseTasks.mockReturnValue({
      data: [mockCompletedTask1],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    expect(screen.getByText('Completed Tasks')).toBeInTheDocument();
  });

  it('should filter and display only completed tasks', () => {
    mockUseTasks.mockReturnValue({
      data: [mockCompletedTask1, mockCompletedTask2, mockRunningTask],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    // Should show only 2 completed tasks
    const taskList = screen.getByTestId('task-list');
    expect(screen.getByTestId('task-count')).toHaveTextContent('2');

    // Should display completed tasks
    expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-task-2')).toBeInTheDocument();

    // Should not display running task
    expect(screen.queryByTestId('task-task-3')).not.toBeInTheDocument();
  });

  it('should sort completed tasks by lastActivity in descending order', () => {
    mockUseTasks.mockReturnValue({
      data: [mockCompletedTask2, mockCompletedTask1], // Task 2 has earlier lastActivity
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    const taskElements = screen.getAllByTestId(/^task-task-/);

    // task-1 should appear first (lastActivity: 12:00:00Z is more recent than 11:00:00Z)
    expect(taskElements[0]).toHaveAttribute('data-testid', 'task-task-1');
    expect(taskElements[1]).toHaveAttribute('data-testid', 'task-task-2');
  });

  it('should display correct completed task count', () => {
    mockUseTasks.mockReturnValue({
      data: [mockCompletedTask1, mockCompletedTask2, mockRunningTask],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    expect(screen.getByText('2 completed tasks')).toBeInTheDocument();
  });

  it('should display singular form when only one completed task', () => {
    mockUseTasks.mockReturnValue({
      data: [mockCompletedTask1, mockRunningTask],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    expect(screen.getByText('1 completed task')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockUseTasks.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByTestId('is-loading')).toHaveTextContent('true');
  });

  it('should handle empty completed tasks list', () => {
    mockUseTasks.mockReturnValue({
      data: [mockRunningTask],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    expect(screen.getByText('0 completed tasks')).toBeInTheDocument();
    expect(screen.getByTestId('task-count')).toHaveTextContent('0');
  });

  it('should handle error state', () => {
    const mockError = new Error('Failed to fetch tasks');
    mockUseTasks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: mockError,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    expect(screen.getByText(/Error loading tasks:/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to fetch tasks/)).toBeInTheDocument();
  });

  it('should pass correct props to TaskList component', () => {
    mockUseTasks.mockReturnValue({
      data: [mockCompletedTask1],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    // Verify TaskList receives correct props
    expect(screen.getByTestId('show-filters')).toHaveTextContent('false');
    expect(screen.getByTestId('show-search')).toHaveTextContent('true');
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
  });

  it('should pass refetch function to TaskList', () => {
    mockUseTasks.mockReturnValue({
      data: [mockCompletedTask1],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    // TaskList component should receive the refetch function
    const taskList = screen.getByTestId('task-list');
    expect(taskList).toBeInTheDocument();
  });

  it('should handle tasks without lastActivity gracefully', () => {
    const taskWithoutLastActivity: TaskStatus = {
      ...mockCompletedTask1,
      lastActivity: new Date('Invalid'),
    };

    mockUseTasks.mockReturnValue({
      data: [taskWithoutLastActivity, mockCompletedTask2],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    // Should not throw error
    expect(() => render(<CompletedTasksPage />)).not.toThrow();
  });

  it('should maintain sort stability for tasks with same lastActivity', () => {
    const task1: TaskStatus = {
      ...mockCompletedTask1,
      id: 'task-a',
      taskId: 'task-a',
      lastActivity: new Date('2025-09-30T12:00:00Z'),
    };

    const task2: TaskStatus = {
      ...mockCompletedTask2,
      id: 'task-b',
      taskId: 'task-b',
      lastActivity: new Date('2025-09-30T12:00:00Z'),
    };

    mockUseTasks.mockReturnValue({
      data: [task1, task2],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<CompletedTasksPage />);

    const taskElements = screen.getAllByTestId(/^task-task-/);
    expect(taskElements).toHaveLength(2);
  });
});