import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { TaskList } from './TaskList';
import { TaskStatus, TaskPriority, type Task } from '@/types/task';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock the custom hooks
jest.mock('@/hooks/useTasks', () => ({
  useTasks: jest.fn(),
  useUpdateTask: jest.fn(),
  useDeleteTask: jest.fn(),
}));

// Create a QueryClient for stories
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

/**
 * TaskList is a container component for displaying and managing a list of tasks.
 * It integrates with data fetching hooks, manages state, and provides filtering and sorting capabilities.
 *
 * ## Features
 * - Fetches tasks using useTasks hook with filtering support
 * - Renders TaskItem components for each task
 * - Handles loading, error, and empty states
 * - Manages task status updates and deletions
 * - Real-time updates via WebSocket integration
 * - Filter controls with URL synchronization
 * - Sorting by multiple criteria (date, priority, title)
 * - Accessible with proper ARIA labels and keyboard navigation
 */
const meta = {
  title: 'Components/Tasks/TaskList',
  component: TaskList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A container component for displaying and managing a list of tasks with filtering, sorting, and real-time updates.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      // Mock router
      (useRouter as jest.Mock).mockReturnValue({
        push: fn(),
        replace: fn(),
        refresh: fn(),
      });

      // Mock search params
      (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  argTypes: {
    initialFilters: {
      description: 'Initial filter state',
      control: 'object',
    },
    onTaskEdit: {
      description: 'Callback when task edit is triggered',
      action: 'task-edit',
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text',
    },
  },
  args: {
    onTaskEdit: fn(),
  },
} satisfies Meta<typeof TaskList>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample tasks for stories
const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Implement user authentication',
    description: 'Add JWT-based authentication to the API',
    status: TaskStatus.ACTIVE,
    priority: TaskPriority.HIGH,
    createdAt: new Date('2025-09-15T10:00:00Z').toISOString(),
    updatedAt: new Date('2025-09-20T14:30:00Z').toISOString(),
  },
  {
    id: '2',
    title: 'Build task dashboard',
    description: 'Create a responsive dashboard for managing tasks',
    status: TaskStatus.ACTIVE,
    priority: TaskPriority.MEDIUM,
    createdAt: new Date('2025-09-16T11:00:00Z').toISOString(),
    updatedAt: new Date('2025-09-21T15:00:00Z').toISOString(),
  },
  {
    id: '3',
    title: 'Setup CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment',
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.HIGH,
    createdAt: new Date('2025-09-14T09:00:00Z').toISOString(),
    updatedAt: new Date('2025-09-19T16:00:00Z').toISOString(),
  },
  {
    id: '4',
    title: 'Update documentation',
    description: 'Refresh API documentation with latest changes',
    status: TaskStatus.PENDING,
    priority: TaskPriority.LOW,
    createdAt: new Date('2025-09-17T08:00:00Z').toISOString(),
    updatedAt: new Date('2025-09-17T08:00:00Z').toISOString(),
  },
  {
    id: '5',
    title: 'Fix critical security bug',
    description: 'Patch SQL injection vulnerability in user login',
    status: TaskStatus.ACTIVE,
    priority: TaskPriority.URGENT,
    createdAt: new Date('2025-09-22T07:00:00Z').toISOString(),
    updatedAt: new Date('2025-09-22T12:00:00Z').toISOString(),
  },
];

/**
 * Default TaskList with multiple tasks
 */
export const Default: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      useTasks.mockReturnValue({
        tasks: sampleTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: {},
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
};

/**
 * TaskList in loading state
 */
export const Loading: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      useTasks.mockReturnValue({
        tasks: [],
        isLoading: true,
        isError: false,
        error: null,
        filters: {},
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
};

/**
 * TaskList with error state
 */
export const Error: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      useTasks.mockReturnValue({
        tasks: [],
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch tasks from the server'),
        filters: {},
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
};

/**
 * TaskList with empty state (no tasks)
 */
export const Empty: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      useTasks.mockReturnValue({
        tasks: [],
        isLoading: false,
        isError: false,
        error: null,
        filters: {},
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
};

/**
 * TaskList with filtered results (no matches)
 */
export const EmptyWithFilters: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      useTasks.mockReturnValue({
        tasks: [],
        isLoading: false,
        isError: false,
        error: null,
        filters: { status: [TaskStatus.COMPLETED] },
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
  args: {
    initialFilters: {
      status: [TaskStatus.COMPLETED],
    },
  },
};

/**
 * TaskList with only pending tasks
 */
export const FilteredByStatus: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      const filteredTasks = sampleTasks.filter(t => t.status === TaskStatus.PENDING);

      useTasks.mockReturnValue({
        tasks: filteredTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: { status: [TaskStatus.PENDING] },
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
  args: {
    initialFilters: {
      status: [TaskStatus.PENDING],
    },
  },
};

/**
 * TaskList with only high priority tasks
 */
export const FilteredByPriority: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      const filteredTasks = sampleTasks.filter(t => t.priority === TaskPriority.HIGH);

      useTasks.mockReturnValue({
        tasks: filteredTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: { priority: [TaskPriority.HIGH] },
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
  args: {
    initialFilters: {
      priority: [TaskPriority.HIGH],
    },
  },
};

/**
 * TaskList with search filter applied
 */
export const FilteredBySearch: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      const filteredTasks = sampleTasks.filter(t =>
        t.title.toLowerCase().includes('auth') ||
        t.description.toLowerCase().includes('auth')
      );

      useTasks.mockReturnValue({
        tasks: filteredTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: { search: 'auth' },
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
  args: {
    initialFilters: {
      search: 'auth',
    },
  },
};

/**
 * TaskList with single task
 */
export const SingleTask: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      useTasks.mockReturnValue({
        tasks: [sampleTasks[0]],
        isLoading: false,
        isError: false,
        error: null,
        filters: {},
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
};

/**
 * TaskList with many tasks
 */
export const ManyTasks: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      // Generate 20 tasks
      const manyTasks = Array.from({ length: 20 }, (_, i) => ({
        id: `task-${i + 1}`,
        title: `Task ${i + 1}: ${['Implement', 'Fix', 'Update', 'Review', 'Deploy'][i % 5]} ${['authentication', 'dashboard', 'API', 'tests', 'documentation'][i % 5]}`,
        description: `Description for task ${i + 1}`,
        status: [TaskStatus.PENDING, TaskStatus.ACTIVE, TaskStatus.COMPLETED, TaskStatus.FAILED][i % 4],
        priority: [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT][i % 4],
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - i * 43200000).toISOString(),
      }));

      useTasks.mockReturnValue({
        tasks: manyTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: {},
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
};

/**
 * TaskList with all task statuses
 */
export const AllStatuses: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      const allStatusTasks: Task[] = [
        {
          ...sampleTasks[0],
          id: '1',
          status: TaskStatus.PENDING,
          title: 'Pending Task',
        },
        {
          ...sampleTasks[0],
          id: '2',
          status: TaskStatus.ACTIVE,
          title: 'Active Task',
        },
        {
          ...sampleTasks[0],
          id: '3',
          status: TaskStatus.COMPLETED,
          title: 'Completed Task',
        },
        {
          ...sampleTasks[0],
          id: '4',
          status: TaskStatus.FAILED,
          title: 'Failed Task',
        },
        {
          ...sampleTasks[0],
          id: '5',
          status: TaskStatus.CANCELLED,
          title: 'Cancelled Task',
        },
      ];

      useTasks.mockReturnValue({
        tasks: allStatusTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: {},
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
};

/**
 * TaskList with all priority levels
 */
export const AllPriorities: Story = {
  decorators: [
    (Story) => {
      const { useTasks, useUpdateTask, useDeleteTask } = require('@/hooks/useTasks');

      const allPriorityTasks: Task[] = [
        {
          ...sampleTasks[0],
          id: '1',
          priority: TaskPriority.LOW,
          title: 'Low Priority Task',
        },
        {
          ...sampleTasks[0],
          id: '2',
          priority: TaskPriority.MEDIUM,
          title: 'Medium Priority Task',
        },
        {
          ...sampleTasks[0],
          id: '3',
          priority: TaskPriority.HIGH,
          title: 'High Priority Task',
        },
        {
          ...sampleTasks[0],
          id: '4',
          priority: TaskPriority.URGENT,
          title: 'Urgent Priority Task',
        },
      ];

      useTasks.mockReturnValue({
        tasks: allPriorityTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: {},
        setFilters: fn(),
      });

      useUpdateTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      useDeleteTask.mockReturnValue({
        mutateAsync: fn(),
        isPending: false,
      });

      return <Story />;
    },
  ],
};