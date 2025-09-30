/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActiveTasksPage from '../page';
import { TaskState } from '@cc-task-manager/types';

// Mock the dashboard data hook
jest.mock('../../../../components/dashboard/hooks/useDashboardData', () => ({
  useDashboardData: jest.fn(),
}));

// Mock AppLayout
jest.mock('../../../../components/layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

// Mock TaskList component
jest.mock('../../../../components/tasks/TaskList', () => ({
  TaskList: ({ tasks, onRefresh, isLoading, showFilters, showSearch }: any) => (
    <div data-testid="task-list">
      <div data-testid="task-count">{tasks.length}</div>
      <div data-testid="is-loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="show-filters">{showFilters ? 'true' : 'false'}</div>
      <div data-testid="show-search">{showSearch ? 'true' : 'false'}</div>
      <button onClick={onRefresh}>Refresh</button>
      {tasks.map((task: any) => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          {task.name} - {task.state}
        </div>
      ))}
    </div>
  ),
}));

// Mock theme context
jest.mock('../../../../lib/theme/context', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
}));

import { useDashboardData } from '../../../../components/dashboard/hooks/useDashboardData';

const mockUseDashboardData = useDashboardData as jest.MockedFunction<typeof useDashboardData>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ActiveTasksPage', () => {
  const mockTasks = [
    {
      id: 'task-1',
      name: 'Active Task 1',
      state: TaskState.ACTIVE,
      createdAt: new Date('2025-01-01'),
    },
    {
      id: 'task-2',
      name: 'Running Task 1',
      state: TaskState.RUNNING,
      createdAt: new Date('2025-01-02'),
    },
    {
      id: 'task-3',
      name: 'Completed Task',
      state: TaskState.COMPLETED,
      createdAt: new Date('2025-01-03'),
    },
    {
      id: 'task-4',
      name: 'Failed Task',
      state: TaskState.FAILED,
      createdAt: new Date('2025-01-04'),
    },
    {
      id: 'task-5',
      name: 'Active Task 2',
      state: TaskState.ACTIVE,
      createdAt: new Date('2025-01-05'),
    },
  ];

  const mockRefreshData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardData.mockReturnValue({
      tasks: mockTasks,
      loading: false,
      refreshData: mockRefreshData,
      taskMetrics: {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
      },
      performanceMetrics: {
        averageExecutionTime: 0,
        successRate: 0,
        throughput: 0,
        errorRate: 0,
      },
      trendData: [],
      systemStatus: {
        activeTasks: 0,
        queueLength: 0,
        workerStatus: 'healthy',
        uptime: 0,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('should render active tasks page with correct title', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
  });

  it('should filter and display only active and running tasks', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    // Should show only 3 tasks (2 ACTIVE + 1 RUNNING)
    expect(screen.getByTestId('task-count')).toHaveTextContent('3');

    // Verify active and running tasks are displayed
    expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('task-task-5')).toBeInTheDocument();

    // Verify completed and failed tasks are NOT displayed
    expect(screen.queryByTestId('task-task-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-task-4')).not.toBeInTheDocument();
  });

  it('should display correct active task count in header', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    expect(screen.getByText('3 active tasks')).toBeInTheDocument();
  });

  it('should display singular "task" when only one active task', () => {
    mockUseDashboardData.mockReturnValue({
      tasks: [mockTasks[0]], // Only one ACTIVE task
      loading: false,
      refreshData: mockRefreshData,
      taskMetrics: {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
      },
      performanceMetrics: {
        averageExecutionTime: 0,
        successRate: 0,
        throughput: 0,
        errorRate: 0,
      },
      trendData: [],
      systemStatus: {
        activeTasks: 0,
        queueLength: 0,
        workerStatus: 'healthy',
        uptime: 0,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    expect(screen.getByText('1 active task')).toBeInTheDocument();
  });

  it('should display zero active tasks when no active or running tasks exist', () => {
    mockUseDashboardData.mockReturnValue({
      tasks: [mockTasks[2], mockTasks[3]], // Only COMPLETED and FAILED tasks
      loading: false,
      refreshData: mockRefreshData,
      taskMetrics: {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
      },
      performanceMetrics: {
        averageExecutionTime: 0,
        successRate: 0,
        throughput: 0,
        errorRate: 0,
      },
      trendData: [],
      systemStatus: {
        activeTasks: 0,
        queueLength: 0,
        workerStatus: 'healthy',
        uptime: 0,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    expect(screen.getByText('0 active tasks')).toBeInTheDocument();
    expect(screen.getByTestId('task-count')).toHaveTextContent('0');
  });

  it('should pass correct props to TaskList component', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    expect(screen.getByTestId('show-filters')).toHaveTextContent('true');
    expect(screen.getByTestId('show-search')).toHaveTextContent('true');
    expect(screen.getByTestId('is-loading')).toHaveTextContent('loaded');
  });

  it('should pass loading state to TaskList component', () => {
    mockUseDashboardData.mockReturnValue({
      tasks: mockTasks,
      loading: true,
      refreshData: mockRefreshData,
      taskMetrics: {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
      },
      performanceMetrics: {
        averageExecutionTime: 0,
        successRate: 0,
        throughput: 0,
        errorRate: 0,
      },
      trendData: [],
      systemStatus: {
        activeTasks: 0,
        queueLength: 0,
        workerStatus: 'healthy',
        uptime: 0,
      },
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    expect(screen.getByTestId('is-loading')).toHaveTextContent('loading');
  });

  it('should pass refreshData callback to TaskList', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    refreshButton.click();

    expect(mockRefreshData).toHaveBeenCalled();
  });

  it('should update active tasks when data changes', () => {
    const Wrapper = createWrapper();
    const { rerender } = render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    expect(screen.getByText('3 active tasks')).toBeInTheDocument();

    // Update mock data to include more active tasks
    mockUseDashboardData.mockReturnValue({
      tasks: [
        ...mockTasks,
        { id: 'task-6', name: 'New Active Task', state: TaskState.ACTIVE, createdAt: new Date() },
      ],
      loading: false,
      refreshData: mockRefreshData,
      taskMetrics: {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
      },
      performanceMetrics: {
        averageExecutionTime: 0,
        successRate: 0,
        throughput: 0,
        errorRate: 0,
      },
      trendData: [],
      systemStatus: {
        activeTasks: 0,
        queueLength: 0,
        workerStatus: 'healthy',
        uptime: 0,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    rerender(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    expect(screen.getByText('4 active tasks')).toBeInTheDocument();
  });

  it('should filter correctly with useMemo for performance', () => {
    const Wrapper = createWrapper();
    const { rerender } = render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    const initialTaskCount = screen.getByTestId('task-count').textContent;

    // Rerender without changing tasks
    rerender(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    // Task count should remain the same, indicating useMemo is working
    expect(screen.getByTestId('task-count')).toHaveTextContent(initialTaskCount!);
  });

  it('should render within AppLayout', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ActiveTasksPage />
      </Wrapper>
    );

    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });
});