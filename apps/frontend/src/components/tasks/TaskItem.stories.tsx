import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { TaskItem } from './TaskItem';
import { TaskStatus, TaskPriority } from '@/types/task';

/**
 * TaskItem is a presentational component for displaying a single task.
 * It features status badges, priority indicators, and interactive action buttons.
 *
 * ## Features
 * - Displays task details (title, description, status, priority, timestamps)
 * - Status badges with visual distinction
 * - Priority indicators
 * - Interactive buttons for actions
 * - Accessible with ARIA labels
 * - Responsive design
 */
const meta = {
  title: 'Components/Tasks/TaskItem',
  component: TaskItem,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A presentational component for displaying a single task with status badges, priority indicators, and action buttons.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    task: {
      description: 'The task object to display',
      control: 'object',
    },
    onStatusChange: {
      description: 'Callback when task status changes',
      action: 'status-changed',
    },
    onEdit: {
      description: 'Callback when edit button is clicked',
      action: 'edit-clicked',
    },
    onDelete: {
      description: 'Callback when delete button is clicked',
      action: 'delete-clicked',
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text',
    },
  },
  args: {
    onStatusChange: fn(),
    onEdit: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof TaskItem>;

export default meta;
type Story = StoryObj<typeof meta>;

// Base task for reuse
const baseTask = {
  id: '1',
  title: 'Implement user authentication',
  description: 'Add JWT-based authentication to the API',
  status: TaskStatus.PENDING,
  priority: TaskPriority.HIGH,
  createdAt: new Date('2025-09-15T10:00:00Z').toISOString(),
  updatedAt: new Date('2025-09-20T14:30:00Z').toISOString(),
};

/**
 * Default TaskItem with all props populated
 */
export const Default: Story = {
  args: {
    task: baseTask,
  },
};

/**
 * TaskItem in pending state
 */
export const Pending: Story = {
  args: {
    task: {
      ...baseTask,
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
    },
  },
};

/**
 * TaskItem in active/running state
 */
export const Active: Story = {
  args: {
    task: {
      ...baseTask,
      id: '2',
      title: 'Build task dashboard',
      description: 'Create a responsive dashboard for managing tasks',
      status: TaskStatus.ACTIVE,
      priority: TaskPriority.HIGH,
    },
  },
};

/**
 * TaskItem in completed state
 */
export const Completed: Story = {
  args: {
    task: {
      ...baseTask,
      id: '3',
      title: 'Setup CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing and deployment',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.MEDIUM,
    },
  },
};

/**
 * TaskItem in failed state
 */
export const Failed: Story = {
  args: {
    task: {
      ...baseTask,
      id: '4',
      title: 'Deploy to production',
      description: 'Deploy the application to production environment',
      status: TaskStatus.FAILED,
      priority: TaskPriority.URGENT,
    },
  },
};

/**
 * TaskItem with low priority
 */
export const LowPriority: Story = {
  args: {
    task: {
      ...baseTask,
      id: '5',
      title: 'Update documentation',
      description: 'Refresh API documentation with latest changes',
      status: TaskStatus.PENDING,
      priority: TaskPriority.LOW,
    },
  },
};

/**
 * TaskItem with high priority
 */
export const HighPriority: Story = {
  args: {
    task: {
      ...baseTask,
      id: '6',
      title: 'Fix critical security bug',
      description: 'Patch SQL injection vulnerability in user login',
      status: TaskStatus.ACTIVE,
      priority: TaskPriority.HIGH,
    },
  },
};

/**
 * TaskItem with urgent priority
 */
export const UrgentPriority: Story = {
  args: {
    task: {
      ...baseTask,
      id: '7',
      title: 'Server outage response',
      description: 'Investigate and resolve production server downtime',
      status: TaskStatus.ACTIVE,
      priority: TaskPriority.URGENT,
    },
  },
};

/**
 * TaskItem without description
 */
export const NoDescription: Story = {
  args: {
    task: {
      ...baseTask,
      id: '8',
      title: 'Quick task without details',
      description: '',
      status: TaskStatus.PENDING,
      priority: TaskPriority.LOW,
    },
  },
};

/**
 * TaskItem with long title and description
 */
export const LongContent: Story = {
  args: {
    task: {
      ...baseTask,
      id: '9',
      title: 'Implement comprehensive end-to-end testing framework with full coverage across all application modules',
      description: 'Set up a complete end-to-end testing framework using Playwright that covers all critical user journeys including authentication, task management, real-time updates, and error handling scenarios. This should include integration with CI/CD pipeline and automated reporting.',
      status: TaskStatus.ACTIVE,
      priority: TaskPriority.MEDIUM,
    },
  },
};

/**
 * TaskItem without action handlers (view-only mode)
 */
export const ViewOnly: Story = {
  args: {
    task: baseTask,
    onStatusChange: undefined,
    onEdit: undefined,
    onDelete: undefined,
  },
};

/**
 * TaskItem with only status change enabled
 */
export const StatusChangeOnly: Story = {
  args: {
    task: baseTask,
    onEdit: undefined,
    onDelete: undefined,
  },
};

/**
 * TaskItem with custom className
 */
export const WithCustomClass: Story = {
  args: {
    task: baseTask,
    className: 'border-2 border-blue-500',
  },
};

/**
 * Multiple TaskItems showcasing different states
 */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-4">
      <TaskItem
        task={{
          ...baseTask,
          id: '1',
          status: TaskStatus.PENDING,
          title: 'Pending Task',
        }}
        onStatusChange={fn()}
        onEdit={fn()}
        onDelete={fn()}
      />
      <TaskItem
        task={{
          ...baseTask,
          id: '2',
          status: TaskStatus.ACTIVE,
          title: 'Active Task',
        }}
        onStatusChange={fn()}
        onEdit={fn()}
        onDelete={fn()}
      />
      <TaskItem
        task={{
          ...baseTask,
          id: '3',
          status: TaskStatus.COMPLETED,
          title: 'Completed Task',
        }}
        onStatusChange={fn()}
        onEdit={fn()}
        onDelete={fn()}
      />
      <TaskItem
        task={{
          ...baseTask,
          id: '4',
          status: TaskStatus.FAILED,
          title: 'Failed Task',
        }}
        onStatusChange={fn()}
        onEdit={fn()}
        onDelete={fn()}
      />
    </div>
  ),
};

/**
 * Multiple TaskItems showcasing different priorities
 */
export const AllPriorities: Story = {
  render: () => (
    <div className="space-y-4">
      <TaskItem
        task={{
          ...baseTask,
          id: '1',
          priority: TaskPriority.LOW,
          title: 'Low Priority Task',
        }}
        onStatusChange={fn()}
        onEdit={fn()}
        onDelete={fn()}
      />
      <TaskItem
        task={{
          ...baseTask,
          id: '2',
          priority: TaskPriority.MEDIUM,
          title: 'Medium Priority Task',
        }}
        onStatusChange={fn()}
        onEdit={fn()}
        onDelete={fn()}
      />
      <TaskItem
        task={{
          ...baseTask,
          id: '3',
          priority: TaskPriority.HIGH,
          title: 'High Priority Task',
        }}
        onStatusChange={fn()}
        onEdit={fn()}
        onDelete={fn()}
      />
      <TaskItem
        task={{
          ...baseTask,
          id: '4',
          priority: TaskPriority.URGENT,
          title: 'Urgent Priority Task',
        }}
        onStatusChange={fn()}
        onEdit={fn()}
        onDelete={fn()}
      />
    </div>
  ),
};