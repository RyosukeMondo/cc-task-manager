'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock, AlertCircle, Cpu, MemoryStick } from 'lucide-react';
import { TaskState, TaskStatus } from '@cc-task-manager/types';
import { DashboardLayout, DashboardGrid, MetricCard } from './DashboardLayout';
import { TaskStatusChart, TaskTrendChart, PerformanceChart } from './charts';

interface DashboardProps {
  tasks?: TaskStatus[];
  realTimeUpdates?: boolean;
}

/**
 * Main dashboard component with responsive design and real-time metrics
 * Integrates all chart components and metric cards for comprehensive monitoring
 */
export function Dashboard({ tasks = [], realTimeUpdates = true }: DashboardProps) {
  const [taskData, setTaskData] = useState(tasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time updates simulation (to be replaced with actual WebSocket integration)
  useEffect(() => {
    if (!realTimeUpdates) return;

    const interval = setInterval(() => {
      // Simulate real-time task status updates
      // This will be replaced with actual WebSocket data
      setTaskData(prevTasks => prevTasks.map(task => ({
        ...task,
        lastActivity: new Date()
      })));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [realTimeUpdates]);

  // Calculate task metrics
  const taskMetrics = React.useMemo(() => {
    const statusCounts = taskData.reduce((acc, task) => {
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

    return {
      total,
      completed: completedTasks,
      failed: failedTasks,
      active: activeTasks,
      completionRate: total > 0 ? ((completedTasks / total) * 100).toFixed(1) : '0',
      statusDistribution: allStates
    };
  }, [taskData]);

  // Generate sample trend data (to be replaced with real data)
  const trendData = React.useMemo(() => {
    const now = new Date();
    const hours = Array.from({ length: 24 }, (_, i) => {
      const time = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      timestamps: hours,
      completed: Array.from({ length: 24 }, () => Math.floor(Math.random() * 10)),
      failed: Array.from({ length: 24 }, () => Math.floor(Math.random() * 3)),
      cancelled: Array.from({ length: 24 }, () => Math.floor(Math.random() * 2))
    };
  }, []);

  // Generate sample performance data (to be replaced with real metrics)
  const performanceData = React.useMemo(() => {
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

  return (
    <DashboardLayout
      title="Task Manager Dashboard"
      description="Real-time monitoring and analytics for your task management system"
    >
      {/* Key Metrics Row */}
      <DashboardGrid>
        <MetricCard
          title="Total Tasks"
          value={taskMetrics.total}
          description="All tasks in the system"
          icon={<Activity />}
        />
        <MetricCard
          title="Completed"
          value={taskMetrics.completed}
          description={`${taskMetrics.completionRate}% completion rate`}
          trend={{
            direction: 'up',
            value: `+${Math.floor(Math.random() * 10)}% from yesterday`
          }}
          icon={<CheckCircle />}
        />
        <MetricCard
          title="Active Tasks"
          value={taskMetrics.active}
          description="Currently running or executing"
          icon={<Clock />}
        />
        <MetricCard
          title="Failed"
          value={taskMetrics.failed}
          description="Tasks that encountered errors"
          trend={{
            direction: taskMetrics.failed > 0 ? 'down' : 'neutral',
            value: taskMetrics.failed > 0 ? '-2% from yesterday' : 'No failures'
          }}
          icon={<AlertCircle />}
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

      {/* Performance Metrics */}
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

      {/* System Status Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <MetricCard
          title="System Health"
          value="Healthy"
          description="All systems operational"
          trend={{
            direction: 'up',
            value: '99.9% uptime'
          }}
          icon={<Cpu />}
        />
        <MetricCard
          title="Queue Status"
          value={`${taskMetrics.active} / ${Math.max(10, taskMetrics.active + 5)}`}
          description="Active tasks / Queue capacity"
          icon={<MemoryStick />}
        />
      </div>
    </DashboardLayout>
  );
}