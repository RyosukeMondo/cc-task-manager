/**
 * @jest-environment jsdom
 *
 * NOTE: These tests currently fail due to a project-wide React testing environment issue
 * where React loads in production mode instead of development mode.
 * This causes "act(...) is not supported in production builds of React" errors.
 *
 * This issue affects all tests in the frontend package and needs to be addressed
 * at the jest.config.js level or by upgrading/configuring React test dependencies.
 *
 * The test logic itself is correct and follows existing test patterns in the codebase.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TasksPage from '../page';
import { TaskState } from '@cc-task-manager/types';
import type { TaskStatus } from '@cc-task-manager/types';

// Mock the WebSocket hooks
jest.mock('@/lib/websocket/hooks', () => ({
  useWebSocketConnection: jest.fn(() => ({
    isConnected: true,
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
  useWebSocketEvent: jest.fn(),
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
  TaskList: ({ tasks, isLoading, showFilters, showSearch, onRefresh }: any) => (
    <div data-testid="task-list">
      <div data-testid="task-count">{tasks.length}</div>
      <div data-testid="is-loading">{isLoading.toString()}</div>
      <div data-testid="show-filters">{showFilters.toString()}</div>
      <div data-testid="show-search">{showSearch.toString()}</div>
      <button data-testid="refresh-button" onClick={onRefresh}>Refresh</button>
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

// Mock the Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className }: any) => (
    <button data-testid="create-task-button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

import { useWebSocketEvent } from '@/lib/websocket/hooks';

const mockUseWebSocketEvent = useWebSocketEvent as jest.MockedFunction<typeof useWebSocketEvent>;

describe('TasksPage', () => {
  const mockTask1: TaskStatus = {
    id: 'task-1',
    taskId: 'task-1',
    state: TaskState.RUNNING,
    progress: 0.5,
    startTime: new Date('2025-09-30T10:00:00Z'),
    lastActivity: new Date('2025-09-30T12:00:00Z'),
    metadata: {
      correlationId: 'corr-1',
      tags: ['test'],
    },
  };

  const mockTask2: TaskStatus = {
    id: 'task-2',
    taskId: 'task-2',
    state: TaskState.COMPLETED,
    progress: 1.0,
    startTime: new Date('2025-09-30T09:00:00Z'),
    lastActivity: new Date('2025-09-30T11:00:00Z'),
    metadata: {
      correlationId: 'corr-2',
      tags: ['completed'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render page header with title', () => {
    render(<TasksPage />);

    expect(screen.getByText('All Tasks')).toBeInTheDocument();
  });

  it('should render AppLayout wrapper', () => {
    render(<TasksPage />);

    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('should display "No tasks yet" when tasks list is empty', () => {
    render(<TasksPage />);

    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
  });

  it('should display task statistics when tasks exist', async () => {
    let taskUpdateHandler: any;
    mockUseWebSocketEvent.mockImplementation((event: string, handler: any) => {
      if (event === 'task:update') {
        taskUpdateHandler = handler;
      }
    });

    render(<TasksPage />);

    // Simulate task updates
    taskUpdateHandler({ data: mockTask1 });
    taskUpdateHandler({ data: mockTask2 });

    await waitFor(() => {
      expect(screen.getByText(/2 total tasks/)).toBeInTheDocument();
    });

    expect(screen.getByText(/1 completed/)).toBeInTheDocument();
    expect(screen.getByText(/1 active/)).toBeInTheDocument();
  });

  it('should render create task button', () => {
    render(<TasksPage />);

    const createButton = screen.getByTestId('create-task-button');
    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveTextContent('Create Task');
  });

  it('should log message when create task button is clicked', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    render(<TasksPage />);

    const createButton = screen.getByTestId('create-task-button');
    fireEvent.click(createButton);

    expect(consoleSpy).toHaveBeenCalledWith('Create task clicked');

    consoleSpy.mockRestore();
  });

  it('should render TaskList component', () => {
    render(<TasksPage />);

    expect(screen.getByTestId('task-list')).toBeInTheDocument();
  });

  it('should pass correct props to TaskList', async () => {
    render(<TasksPage />);

    // Wait for loading to complete
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(screen.getByTestId('show-filters')).toHaveTextContent('true');
      expect(screen.getByTestId('show-search')).toHaveTextContent('true');
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });
  });

  it('should show loading state initially', () => {
    render(<TasksPage />);

    expect(screen.getByTestId('is-loading')).toHaveTextContent('true');
  });

  it('should transition from loading to loaded state', async () => {
    render(<TasksPage />);

    expect(screen.getByTestId('is-loading')).toHaveTextContent('true');

    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });
  });

  it('should handle refresh action', async () => {
    render(<TasksPage />);

    // Wait for initial loading to complete
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Click refresh
    const refreshButton = screen.getByTestId('refresh-button');
    fireEvent.click(refreshButton);

    // Should be loading again
    expect(screen.getByTestId('is-loading')).toHaveTextContent('true');

    // Advance timer to complete refresh
    jest.advanceTimersByTime(500);

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });
  });

  it('should handle task:update events', async () => {
    let taskUpdateHandler: any;
    mockUseWebSocketEvent.mockImplementation((event: string, handler: any) => {
      if (event === 'task:update') {
        taskUpdateHandler = handler;
      }
    });

    render(<TasksPage />);

    // Simulate task update event
    taskUpdateHandler({ data: mockTask1 });

    await waitFor(() => {
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    });
  });

  it('should update existing task on task:update event', async () => {
    let taskUpdateHandler: any;
    mockUseWebSocketEvent.mockImplementation((event: string, handler: any) => {
      if (event === 'task:update') {
        taskUpdateHandler = handler;
      }
    });

    render(<TasksPage />);

    // Add task
    taskUpdateHandler({ data: mockTask1 });

    await waitFor(() => {
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    });

    // Update same task
    const updatedTask = { ...mockTask1, state: TaskState.COMPLETED };
    taskUpdateHandler({ data: updatedTask });

    await waitFor(() => {
      expect(screen.getByTestId('task-task-1')).toHaveTextContent('COMPLETED');
    });

    // Should still have only one task
    expect(screen.getByTestId('task-count')).toHaveTextContent('1');
  });

  it('should handle task:created events', async () => {
    let taskCreatedHandler: any;
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    mockUseWebSocketEvent.mockImplementation((event: string, handler: any) => {
      if (event === 'task:created') {
        taskCreatedHandler = handler;
      }
    });

    render(<TasksPage />);

    taskCreatedHandler({ data: { taskId: 'new-task-1' } });

    expect(consoleSpy).toHaveBeenCalledWith('New task created:', 'new-task-1');

    consoleSpy.mockRestore();
  });

  it('should handle task:completed events', async () => {
    let taskUpdateHandler: any;
    let taskCompletedHandler: any;

    mockUseWebSocketEvent.mockImplementation((event: string, handler: any) => {
      if (event === 'task:update') {
        taskUpdateHandler = handler;
      } else if (event === 'task:completed') {
        taskCompletedHandler = handler;
      }
    });

    render(<TasksPage />);

    // Add running task
    taskUpdateHandler({ data: mockTask1 });

    await waitFor(() => {
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    });

    // Complete the task
    taskCompletedHandler({ data: { taskId: 'task-1', exitCode: 0 } });

    await waitFor(() => {
      expect(screen.getByTestId('task-task-1')).toHaveTextContent('COMPLETED');
    });
  });

  it('should handle task:error events', async () => {
    let taskUpdateHandler: any;
    let taskErrorHandler: any;

    mockUseWebSocketEvent.mockImplementation((event: string, handler: any) => {
      if (event === 'task:update') {
        taskUpdateHandler = handler;
      } else if (event === 'task:error') {
        taskErrorHandler = handler;
      }
    });

    render(<TasksPage />);

    // Add running task
    taskUpdateHandler({ data: mockTask1 });

    await waitFor(() => {
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    });

    // Task encounters error
    taskErrorHandler({ data: { taskId: 'task-1', error: 'Something went wrong' } });

    await waitFor(() => {
      expect(screen.getByTestId('task-task-1')).toHaveTextContent('FAILED');
    });
  });

  it('should display singular task count correctly', async () => {
    let taskUpdateHandler: any;
    mockUseWebSocketEvent.mockImplementation((event: string, handler: any) => {
      if (event === 'task:update') {
        taskUpdateHandler = handler;
      }
    });

    render(<TasksPage />);

    taskUpdateHandler({ data: mockTask1 });

    await waitFor(() => {
      expect(screen.getByText(/1 total task •/)).toBeInTheDocument();
    });
  });

  it('should use WebSocket connection for real-time updates', () => {
    const { useWebSocketConnection } = require('@/lib/websocket/hooks');

    render(<TasksPage />);

    expect(useWebSocketConnection).toHaveBeenCalledWith('task-all-page');
  });

  it('should display all task states in statistics', async () => {
    let taskUpdateHandler: any;
    mockUseWebSocketEvent.mockImplementation((event: string, handler: any) => {
      if (event === 'task:update') {
        taskUpdateHandler = handler;
      }
    });

    render(<TasksPage />);

    const completedTask: TaskStatus = {
      ...mockTask1,
      id: 'task-completed',
      taskId: 'task-completed',
      state: TaskState.COMPLETED,
    };

    const failedTask: TaskStatus = {
      ...mockTask1,
      id: 'task-failed',
      taskId: 'task-failed',
      state: TaskState.FAILED,
    };

    taskUpdateHandler({ data: mockTask1 }); // running
    taskUpdateHandler({ data: completedTask });
    taskUpdateHandler({ data: failedTask });

    await waitFor(() => {
      const stats = screen.getByText(/3 total tasks/);
      expect(stats).toBeInTheDocument();
      expect(screen.getByText(/1 completed/)).toBeInTheDocument();
      expect(screen.getByText(/1 active/)).toBeInTheDocument();
      expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    });
  });
});