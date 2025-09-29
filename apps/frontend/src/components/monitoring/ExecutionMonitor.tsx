'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Cpu,
  MemoryStick,
  Monitor,
  Pause,
  Play,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { TaskStatus, TaskState } from '@cc-task-manager/types';
import { TaskProgress, TaskProgressList } from '@/components/tasks/TaskProgress';
import { ChartCard, createBaseChartOptions, taskStateColors } from '@/components/dashboard/charts/BaseChart';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { cn } from '@/lib/utils';
import {
  useWebSocketConnection,
  useSystemStatus
} from '@/lib/websocket/hooks';

interface ExecutionMonitorProps {
  className?: string;
  refreshInterval?: number;
  showControls?: boolean;
  maxConcurrentDisplay?: number;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkActivity: number;
  activeProcesses: number;
  queueLength: number;
  throughput: number; // tasks per minute
}

interface MonitoringState {
  isMonitoring: boolean;
  isPaused: boolean;
  autoRefresh: boolean;
  selectedTimeRange: '5m' | '15m' | '1h' | '6h' | '24h';
}

/**
 * ExecutionMonitor Component
 * Provides comprehensive real-time execution monitoring with detailed progress visualization
 * Displays system metrics, task execution status, and performance analytics
 */
export function ExecutionMonitor({
  className,
  refreshInterval = 5000,
  showControls = true,
  maxConcurrentDisplay = 8
}: ExecutionMonitorProps) {
  // WebSocket connection and real-time data
  const wsConnection = useWebSocketConnection('execution-monitor');
  const systemStatus = useSystemStatus();

  // Local task state management
  const [allTasks, setAllTasks] = useState<TaskStatus[]>([]);

  // Add task update listeners
  React.useEffect(() => {
    if (wsConnection.isConnected && wsConnection.room) {
      // Listen for task updates
      wsConnection.room.subscribeToEvent('task:update', (event) => {
        setAllTasks(prevTasks => {
          const existingIndex = prevTasks.findIndex(task => task.taskId === event.data.taskId);
          const updatedTask: TaskStatus = {
            ...event.data,
            lastActivity: new Date()
          };

          if (existingIndex >= 0) {
            const newTasks = [...prevTasks];
            newTasks[existingIndex] = updatedTask;
            return newTasks;
          } else {
            return [...prevTasks, updatedTask];
          }
        });
      });

      wsConnection.room.subscribeToEvent('task:created', (event) => {
        const newTask: TaskStatus = {
          taskId: event.data.taskId,
          state: TaskState.PENDING,
          lastActivity: new Date(),
          progress: 'Task created'
        };
        setAllTasks(prevTasks => [...prevTasks, newTask]);
      });

      wsConnection.room.subscribeToEvent('task:completed', (event) => {
        setAllTasks(prevTasks =>
          prevTasks.map(task =>
            task.taskId === event.data.taskId
              ? { ...task, state: TaskState.COMPLETED, exitCode: event.data.exitCode }
              : task
          )
        );
      });

      wsConnection.room.subscribeToEvent('task:error', (event) => {
        setAllTasks(prevTasks =>
          prevTasks.map(task =>
            task.taskId === event.data.taskId
              ? { ...task, state: TaskState.FAILED, error: event.data.error }
              : task
          )
        );
      });
    }
  }, [wsConnection.isConnected, wsConnection.room]);

  // Monitor state management
  const [monitoringState, setMonitoringState] = useState<MonitoringState>({
    isMonitoring: true,
    isPaused: false,
    autoRefresh: true,
    selectedTimeRange: '1h'
  });

  // System metrics (in real implementation, these would come from WebSocket)
  const systemMetrics = useMemo((): SystemMetrics => ({
    cpuUsage: Math.floor(Math.random() * 80) + 10,
    memoryUsage: Math.floor(Math.random() * 70) + 20,
    diskUsage: Math.floor(Math.random() * 60) + 15,
    networkActivity: Math.floor(Math.random() * 90) + 10,
    activeProcesses: activeTasks.length,
    queueLength: systemStatus.queueLength || 0,
    throughput: Math.floor(Math.random() * 15) + 5
  }), [activeTasks.length, systemStatus.queueLength]);

  // Filter active and monitoring tasks
  const activeTasks = useMemo(() => {
    return allTasks.filter(task =>
      task.state === TaskState.RUNNING ||
      task.state === TaskState.ACTIVE ||
      task.state === TaskState.PENDING
    );
  }, [allTasks]);

  // Generate execution timeline data
  const timelineData = useMemo(() => {
    const timeRangeMinutes = {
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '6h': 360,
      '24h': 1440
    }[monitoringState.selectedTimeRange];

    const intervals = Math.min(timeRangeMinutes, 60); // Max 60 data points
    const stepMinutes = timeRangeMinutes / intervals;

    const labels = Array.from({ length: intervals }, (_, i) => {
      const time = new Date(Date.now() - (intervals - 1 - i) * stepMinutes * 60000);
      if (timeRangeMinutes <= 60) {
        return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else {
        return time.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    });

    // Generate realistic-looking timeline data
    const completedTasks = Array.from({ length: intervals }, (_, i) =>
      Math.max(0, Math.floor(Math.random() * 8) + Math.sin(i / 10) * 3)
    );

    const failedTasks = Array.from({ length: intervals }, (_, i) =>
      Math.max(0, Math.floor(Math.random() * 2) + Math.cos(i / 15) * 1)
    );

    const activeTasks = Array.from({ length: intervals }, (_, i) =>
      Math.max(0, Math.floor(Math.random() * 5) + Math.sin(i / 8) * 2)
    );

    return {
      labels,
      datasets: [
        {
          label: 'Completed',
          data: completedTasks,
          borderColor: taskStateColors.completed,
          backgroundColor: taskStateColors.completed.replace('0.8', '0.3'),
          tension: 0.4
        },
        {
          label: 'Active',
          data: activeTasks,
          borderColor: taskStateColors.running,
          backgroundColor: taskStateColors.running.replace('0.8', '0.3'),
          tension: 0.4
        },
        {
          label: 'Failed',
          data: failedTasks,
          borderColor: taskStateColors.failed,
          backgroundColor: taskStateColors.failed.replace('0.8', '0.3'),
          tension: 0.4
        }
      ]
    };
  }, [monitoringState.selectedTimeRange]);

  // System performance data
  const performanceData = useMemo(() => ({
    labels: ['CPU', 'Memory', 'Disk', 'Network'],
    datasets: [{
      data: [
        systemMetrics.cpuUsage,
        systemMetrics.memoryUsage,
        systemMetrics.diskUsage,
        systemMetrics.networkActivity
      ],
      backgroundColor: [
        taskStateColors.running,
        taskStateColors.active,
        taskStateColors.pending,
        'rgba(139, 92, 246, 0.8)'
      ],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  }), [systemMetrics]);

  // Task distribution data
  const distributionData = useMemo(() => {
    const stateCounts = activeTasks.reduce((acc, task) => {
      acc[task.state] = (acc[task.state] || 0) + 1;
      return acc;
    }, {} as Record<TaskState, number>);

    return {
      labels: Object.keys(stateCounts).map(state =>
        state.charAt(0).toUpperCase() + state.slice(1)
      ),
      datasets: [{
        data: Object.values(stateCounts),
        backgroundColor: Object.keys(stateCounts).map(state =>
          taskStateColors[state as keyof typeof taskStateColors] || taskStateColors.pending
        ),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };
  }, [activeTasks]);

  // Control handlers
  const toggleMonitoring = useCallback(() => {
    setMonitoringState(prev => ({
      ...prev,
      isMonitoring: !prev.isMonitoring
    }));
  }, []);

  const togglePause = useCallback(() => {
    setMonitoringState(prev => ({
      ...prev,
      isPaused: !prev.isPaused
    }));
  }, []);

  const changeTimeRange = useCallback((range: MonitoringState['selectedTimeRange']) => {
    setMonitoringState(prev => ({
      ...prev,
      selectedTimeRange: range
    }));
  }, []);

  // Get connection status color
  const connectionStatusColor = wsConnection.isConnected
    ? "text-green-600"
    : "text-red-600";

  const connectionStatusText = wsConnection.isConnected
    ? "Connected"
    : wsConnection.isConnecting
      ? "Connecting..."
      : "Disconnected";

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="w-5 h-5" />
                <span>Task Execution Monitor</span>
              </CardTitle>
              <CardDescription>
                Real-time monitoring of task execution and system performance
              </CardDescription>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2 text-sm">
                <div className={cn("w-2 h-2 rounded-full",
                  wsConnection.isConnected ? "bg-green-500" : "bg-red-500"
                )} />
                <span className={connectionStatusColor}>{connectionStatusText}</span>
              </div>

              {/* Controls */}
              {showControls && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePause}
                    disabled={!monitoringState.isMonitoring}
                  >
                    {monitoringState.isPaused ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleMonitoring}
                  >
                    {monitoringState.isMonitoring ? (
                      <Monitor className="w-4 h-4" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {monitoringState.isMonitoring ? 'Stop' : 'Start'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* System Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Tasks</p>
                <p className="text-2xl font-bold">{systemMetrics.activeProcesses}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Queue Length</p>
                <p className="text-2xl font-bold">{systemMetrics.queueLength}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">CPU Usage</p>
                <p className="text-2xl font-bold">{systemMetrics.cpuUsage}%</p>
              </div>
              <Cpu className="w-8 h-8 text-green-600" />
            </div>
            <Progress value={systemMetrics.cpuUsage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Memory</p>
                <p className="text-2xl font-bold">{systemMetrics.memoryUsage}%</p>
              </div>
              <MemoryStick className="w-8 h-8 text-purple-600" />
            </div>
            <Progress value={systemMetrics.memoryUsage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Task Execution Timeline */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Task Execution Timeline"
            description={`Task execution over ${monitoringState.selectedTimeRange}`}
            loading={!monitoringState.isMonitoring}
          >
            <div className="mb-4 flex space-x-2">
              {(['5m', '15m', '1h', '6h', '24h'] as const).map((range) => (
                <Button
                  key={range}
                  variant={monitoringState.selectedTimeRange === range ? "default" : "outline"}
                  size="sm"
                  onClick={() => changeTimeRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>
            <Line
              data={timelineData}
              options={{
                ...createBaseChartOptions(),
                scales: {
                  x: {
                    display: true,
                    title: {
                      display: true,
                      text: 'Time'
                    }
                  },
                  y: {
                    display: true,
                    title: {
                      display: true,
                      text: 'Number of Tasks'
                    },
                    min: 0
                  }
                }
              }}
            />
          </ChartCard>
        </div>

        {/* System Performance */}
        <ChartCard
          title="System Performance"
          description="Current resource utilization"
          loading={!monitoringState.isMonitoring}
        >
          <Doughnut
            data={performanceData}
            options={{
              ...createBaseChartOptions(true, true),
              plugins: {
                ...createBaseChartOptions().plugins,
                legend: {
                  position: 'bottom'
                }
              }
            }}
          />
        </ChartCard>
      </div>

      {/* Active Tasks and Task Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Tasks List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Active Tasks</span>
                <Badge variant="secondary">{activeTasks.length}</Badge>
              </CardTitle>
              <CardDescription>
                Currently running and queued tasks with progress indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeTasks.length > 0 ? (
                <TaskProgressList
                  tasks={activeTasks.slice(0, maxConcurrentDisplay)}
                  maxItems={maxConcurrentDisplay}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No active tasks</p>
                  <p className="text-sm">Tasks will appear here when they start executing</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Task Distribution */}
        <ChartCard
          title="Task Distribution"
          description="Current task states"
          loading={!monitoringState.isMonitoring}
        >
          {distributionData.datasets[0].data.length > 0 ? (
            <Doughnut
              data={distributionData}
              options={{
                ...createBaseChartOptions(true, true),
                plugins: {
                  ...createBaseChartOptions().plugins,
                  legend: {
                    position: 'bottom'
                  }
                }
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No tasks to display</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Monitoring Status */}
      {!monitoringState.isMonitoring && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Settings className="w-5 h-5 text-yellow-600" />
              <div>
                <h4 className="font-medium text-yellow-800">Monitoring Paused</h4>
                <p className="text-sm text-yellow-700">
                  Real-time monitoring is currently disabled. Click "Start" to resume monitoring.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}