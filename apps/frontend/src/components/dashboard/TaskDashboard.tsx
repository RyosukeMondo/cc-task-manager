'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  Cpu,
  MemoryStick,
  Play,
  Pause,
  Square,
  Loader2,
  Wifi,
  WifiOff
} from 'lucide-react';
import { TaskState, TaskStatus } from '@cc-task-manager/types';
import {
  useWebSocketConnection,
  useTaskUpdates,
  useSystemStatus,
  useWebSocketEvent
} from '@/lib/websocket/hooks';
import { TaskUpdateEvent, TaskCreatedEvent, TaskCompletedEvent, TaskErrorEvent } from '@/lib/websocket/types';
import { DashboardLayout, DashboardGrid, MetricCard } from './DashboardLayout';
import { TaskStatusChart, TaskTrendChart, PerformanceChart } from './charts';
import { TaskTable } from '../tables/TaskTable';
import {
  useScreenReaderAnnouncement,
  statusAnnouncements,
  LiveRegion
} from '@/lib/accessibility/screen-reader';

interface TaskDashboardProps {
  className?: string;
  refreshInterval?: number;
}

interface TaskMetrics {
  total: number;
  completed: number;
  failed: number;
  active: number;
  pending: number;
  completionRate: string;
  statusDistribution: Record<TaskState, number>;
}

interface RecentActivity {
  id: string;
  type: 'created' | 'completed' | 'failed' | 'started';
  taskId: string;
  taskName: string;
  timestamp: Date;
  status: TaskState;
}

/**
 * Enhanced task management dashboard with real-time WebSocket updates
 * Provides comprehensive task monitoring with live data visualization
 */
export function TaskDashboard({ className, refreshInterval = 30000 }: TaskDashboardProps) {
  // WebSocket connection and real-time data
  const wsConnection = useWebSocketConnection('task-dashboard');
  const systemStatus = useSystemStatus();

  // Local state for task data and metrics
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<string>('');

  // Screen reader announcements
  const { announce } = useScreenReaderAnnouncement();

  // Real-time task update handlers
  useWebSocketEvent('task:update', (event: TaskUpdateEvent) => {
    setTasks(prevTasks => {
      const existingIndex = prevTasks.findIndex(task => task.id === event.data.id);
      if (existingIndex >= 0) {
        // Update existing task
        const newTasks = [...prevTasks];
        newTasks[existingIndex] = event.data;
        return newTasks;
      } else {
        // Add new task
        return [...prevTasks, event.data];
      }
    });

    // Add to recent activity
    const activityData = {
      id: `update-${event.data.id}-${Date.now()}`,
      type: 'started' as const,
      taskId: event.data.id,
      taskName: event.data.sessionName || `Task ${event.data.id.slice(0, 8)}`,
      timestamp: new Date(),
      status: event.data.state
    };
    addRecentActivity(activityData);

    // Announce task status change to screen readers
    const statusMessage = `Task ${activityData.taskName} status changed to ${event.data.state}`;
    announce(statusMessage, 'polite');
    setLiveMessage(statusMessage);
  });

  useWebSocketEvent('task:created', (event: TaskCreatedEvent) => {
    const activityData = {
      id: `created-${event.data.taskId}-${Date.now()}`,
      type: 'created' as const,
      taskId: event.data.taskId,
      taskName: event.data.sessionName,
      timestamp: new Date(),
      status: TaskState.PENDING
    };
    addRecentActivity(activityData);

    // Announce new task creation
    const message = statusAnnouncements.updated(`New task "${event.data.sessionName}" created`);
    announce(message, 'polite');
    setLiveMessage(message);
  });

  useWebSocketEvent('task:completed', (event: TaskCompletedEvent) => {
    // Update task status to completed
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === event.data.taskId
          ? { ...task, state: TaskState.COMPLETED, exitCode: event.data.exitCode }
          : task
      )
    );

    const activityData = {
      id: `completed-${event.data.taskId}-${Date.now()}`,
      type: 'completed' as const,
      taskId: event.data.taskId,
      taskName: `Task ${event.data.taskId.slice(0, 8)}`,
      timestamp: new Date(),
      status: TaskState.COMPLETED
    };
    addRecentActivity(activityData);

    // Announce task completion
    const message = statusAnnouncements.updated(`Task ${activityData.taskName} completed successfully`);
    announce(message, 'assertive');
    setLiveMessage(message);
  });

  useWebSocketEvent('task:error', (event: TaskErrorEvent) => {
    // Update task status to failed
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === event.data.taskId
          ? { ...task, state: TaskState.FAILED, errorMessage: event.data.error }
          : task
      )
    );

    const activityData = {
      id: `error-${event.data.taskId}-${Date.now()}`,
      type: 'failed' as const,
      taskId: event.data.taskId,
      taskName: `Task ${event.data.taskId.slice(0, 8)}`,
      timestamp: new Date(),
      status: TaskState.FAILED
    };
    addRecentActivity(activityData);

    // Announce task failure
    const message = statusAnnouncements.error(`Task ${activityData.taskName}`, event.data.error);
    announce(message, 'assertive');
    setLiveMessage(message);
  });

  // Helper function to add recent activity
  const addRecentActivity = (activity: RecentActivity) => {
    setRecentActivity(prev => {
      const newActivities = [activity, ...prev].slice(0, 10); // Keep only last 10
      return newActivities;
    });
  };

  // Calculate task metrics from current task data
  const taskMetrics: TaskMetrics = useMemo(() => {
    const statusCounts = tasks.reduce((acc, task) => {
      acc[task.state] = (acc[task.state] || 0) + 1;
      return acc;
    }, {} as Record<TaskState, number>);

    // Ensure all states are represented
    const allStates: Record<TaskState, number> = {
      [TaskState.PENDING]: 0,
      [TaskState.RUNNING]: 0,
      [TaskState.ACTIVE]: 0,
      [TaskState.IDLE]: 0,
      [TaskState.COMPLETED]: 0,
      [TaskState.FAILED]: 0,
      [TaskState.CANCELLED]: 0,
      ...statusCounts
    };

    const total = Object.values(allStates).reduce((sum, count) => sum + count, 0);
    const completedTasks = allStates[TaskState.COMPLETED];
    const failedTasks = allStates[TaskState.FAILED];
    const activeTasks = allStates[TaskState.RUNNING] + allStates[TaskState.ACTIVE];
    const pendingTasks = allStates[TaskState.PENDING] + allStates[TaskState.IDLE];

    return {
      total,
      completed: completedTasks,
      failed: failedTasks,
      active: activeTasks,
      pending: pendingTasks,
      completionRate: total > 0 ? ((completedTasks / total) * 100).toFixed(1) : '0',
      statusDistribution: allStates
    };
  }, [tasks]);

  // Generate trend data for charts (last 24 hours)
  const trendData = useMemo(() => {
    const now = new Date();
    const hours = Array.from({ length: 24 }, (_, i) => {
      const time = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });

    // In a real implementation, this would come from historical data
    return {
      timestamps: hours,
      completed: Array.from({ length: 24 }, () => Math.floor(Math.random() * 10)),
      failed: Array.from({ length: 24 }, () => Math.floor(Math.random() * 3)),
      cancelled: Array.from({ length: 24 }, () => Math.floor(Math.random() * 2))
    };
  }, []);

  // Generate performance data (last hour, 5-minute intervals)
  const performanceData = useMemo(() => {
    const intervals = Array.from({ length: 12 }, (_, i) => {
      const time = new Date(Date.now() - (11 - i) * 5 * 60 * 1000);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      labels: intervals,
      executionTimes: Array.from({ length: 12 }, () => Math.floor(Math.random() * 5000) + 1000),
      memoryUsage: Array.from({ length: 12 }, () => Math.floor(Math.random() * 500) + 100),
      cpuUsage: Array.from({ length: 12 }, () => Math.floor(Math.random() * 80) + 10)
    };
  }, []);

  // Connection status indicator
  const ConnectionStatus = () => (
    <div className="flex items-center space-x-2 text-sm">
      {wsConnection.isConnected ? (
        <>
          <Wifi className="w-4 h-4 text-green-500" />
          <span className="text-green-600">Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-red-500" />
          <span className="text-red-600">Disconnected</span>
        </>
      )}
    </div>
  );

  // Status indicator for different activity types
  const getActivityIcon = (type: RecentActivity['type'], status: TaskState) => {
    switch (type) {
      case 'created':
        return <div className="w-2 h-2 bg-blue-500 rounded-full" />;
      case 'started':
        return <Play className="w-3 h-3 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full" />;
    }
  };

  // Format activity message
  const formatActivityMessage = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'created':
        return `Task "${activity.taskName}" was created`;
      case 'started':
        return `Task "${activity.taskName}" started execution`;
      case 'completed':
        return `Task "${activity.taskName}" completed successfully`;
      case 'failed':
        return `Task "${activity.taskName}" failed with error`;
      default:
        return `Task "${activity.taskName}" status updated`;
    }
  };

  // Initialize loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      // Announce when dashboard is ready
      const message = statusAnnouncements.loaded('Task dashboard');
      announce(message, 'polite');
      setLiveMessage(message);
    }, 1000);

    return () => clearTimeout(timer);
  }, [announce]);

  // Handle connection errors
  useEffect(() => {
    if (wsConnection.error) {
      setError(wsConnection.error);
      // Announce connection errors
      const message = statusAnnouncements.error('WebSocket connection', wsConnection.error);
      announce(message, 'assertive');
      setLiveMessage(message);
    } else {
      setError(null);
    }
  }, [wsConnection.error, announce]);

  // Announce connection status changes
  useEffect(() => {
    if (wsConnection.isConnected) {
      const message = 'Real-time connection established. Dashboard is now live.';
      announce(message, 'polite');
      setLiveMessage(message);
    } else if (!wsConnection.isConnecting) {
      const message = 'Real-time connection lost. Data may not be current.';
      announce(message, 'assertive');
      setLiveMessage(message);
    }
  }, [wsConnection.isConnected, wsConnection.isConnecting, announce]);

  return (
    <DashboardLayout
      title="Task Management Dashboard"
      description="Real-time monitoring and analytics for your task execution system"
      className={className}
      headerActions={<ConnectionStatus />}
    >
      {/* Key Metrics Row */}
      <DashboardGrid>
        <MetricCard
          title="Total Tasks"
          value={taskMetrics.total}
          description="All tasks in the system"
          icon={<Activity className="w-4 h-4" />}
          loading={loading}
        />
        <MetricCard
          title="Completed"
          value={taskMetrics.completed}
          description={`${taskMetrics.completionRate}% completion rate`}
          trend={{
            direction: taskMetrics.completed > taskMetrics.failed ? 'up' : 'neutral',
            value: `${taskMetrics.completed} successful`
          }}
          icon={<CheckCircle className="w-4 h-4" />}
          loading={loading}
        />
        <MetricCard
          title="Active Tasks"
          value={taskMetrics.active}
          description="Currently running or executing"
          icon={<Clock className="w-4 h-4" />}
          loading={loading}
        />
        <MetricCard
          title="Failed"
          value={taskMetrics.failed}
          description="Tasks that encountered errors"
          trend={{
            direction: taskMetrics.failed === 0 ? 'neutral' : 'down',
            value: taskMetrics.failed === 0 ? 'No failures' : `${taskMetrics.failed} errors`
          }}
          icon={<AlertCircle className="w-4 h-4" />}
          loading={loading}
        />
      </DashboardGrid>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TaskStatusChart
          data={taskMetrics.statusDistribution}
          loading={loading}
          error={error}
          className="lg:col-span-1"
        />
        <TaskTrendChart
          data={trendData}
          timeRange="24h"
          loading={loading}
          error={error}
          className="lg:col-span-1"
        />
      </div>

      {/* Performance and System Health */}
      <div className="grid gap-6 lg:grid-cols-3">
        <PerformanceChart
          data={performanceData}
          metric="execution"
          title="Task Execution Times"
          description="Average execution time per task"
          loading={loading}
          error={error}
        />
        <PerformanceChart
          data={performanceData}
          metric="memory"
          title="Memory Usage"
          description="System memory consumption"
          loading={loading}
          error={error}
        />
        <PerformanceChart
          data={performanceData}
          metric="cpu"
          title="CPU Usage"
          description="Processor utilization"
          loading={loading}
          error={error}
        />
      </div>

      {/* Task Data Table */}
      <TaskTable
        tasks={tasks}
        onTaskSelect={(task) => {
          // Handle task selection - could open task details modal
          console.log('Selected task:', task);
        }}
        onRefresh={() => {
          // Handle manual refresh
          announce('Refreshing task data...', 'polite');
          setLiveMessage('Refreshing task data...');
        }}
        isLoading={loading}
        initialPageSize={10}
      />

      {/* System Status and Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Health */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold leading-none tracking-tight">System Health</h3>
              {wsConnection.isConnected ? (
                <span className="text-sm text-green-600">Operational</span>
              ) : (
                <span className="text-sm text-red-600">Disconnected</span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Tasks</span>
                <span className="font-medium">{systemStatus.activeTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Queue Length</span>
                <span className="font-medium">{systemStatus.queueLength}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Worker Status</span>
                <span className={`font-medium ${
                  systemStatus.workerStatus === 'healthy' ? 'text-green-600' :
                  systemStatus.workerStatus === 'degraded' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {systemStatus.workerStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Uptime</span>
                <span className="font-medium">
                  {Math.floor(systemStatus.uptime / 3600)}h {Math.floor((systemStatus.uptime % 3600) / 60)}m
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <h3 className="font-semibold leading-none tracking-tight">Recent Activity</h3>
            <p className="text-sm text-muted-foreground">Live task updates</p>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4">
                    {getActivityIcon(activity.type, activity.status)}
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{formatActivityMessage(activity)}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                  <p className="text-xs">Task updates will appear here in real-time</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status Banner */}
      {!wsConnection.isConnected && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center space-x-3">
            <WifiOff className="w-5 h-5 text-yellow-600" />
            <div>
              <h4 className="font-medium text-yellow-800">Connection Lost</h4>
              <p className="text-sm text-yellow-700">
                Real-time updates are unavailable. Attempting to reconnect...
              </p>
            </div>
            {wsConnection.isConnecting && (
              <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <h4 className="font-medium text-red-800">Dashboard Error</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Live region for screen reader announcements */}
      <LiveRegion message={liveMessage} priority="polite" clearDelay={3000} />
    </DashboardLayout>
  );
}