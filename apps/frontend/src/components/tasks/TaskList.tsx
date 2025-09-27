'use client';

import React, { useState } from 'react';
import { TaskStatus, TaskState } from '@cc-task-manager/types';
import { TaskDisplay } from './TaskDisplay';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Search,
  Filter,
  RefreshCw,
  SortAsc,
  SortDesc,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause
} from 'lucide-react';

interface TaskListProps {
  tasks: TaskStatus[];
  onRefresh?: () => void;
  onTaskSelect?: (task: TaskStatus) => void;
  isLoading?: boolean;
  className?: string;
}

type SortField = 'lastActivity' | 'taskId' | 'state';
type SortDirection = 'asc' | 'desc';

/**
 * TaskList component following Single Responsibility Principle
 * Responsible only for displaying and filtering a list of tasks
 * Uses existing contract-validated TaskStatus types
 */
export function TaskList({
  tasks,
  onRefresh,
  onTaskSelect,
  isLoading = false,
  className
}: TaskListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState<TaskState | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('lastActivity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter tasks based on search term and state filter
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.taskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.progress?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = filterState === 'all' || task.state === filterState;
    return matchesSearch && matchesState;
  });

  // Sort filtered tasks
  const sortedTasks = filteredTasks.sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'lastActivity':
        comparison = new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime();
        break;
      case 'taskId':
        comparison = a.taskId.localeCompare(b.taskId);
        break;
      case 'state':
        comparison = a.state.localeCompare(b.state);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getStateCount = (state: TaskState): number => {
    return tasks.filter(task => task.state === state).length;
  };

  const getStateIcon = (state: TaskState) => {
    switch (state) {
      case TaskState.COMPLETED:
        return <CheckCircle className="h-3 w-3" />;
      case TaskState.FAILED:
        return <XCircle className="h-3 w-3" />;
      case TaskState.RUNNING:
      case TaskState.ACTIVE:
        return <Play className="h-3 w-3" />;
      case TaskState.IDLE:
        return <Pause className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Task Management</CardTitle>
            <CardDescription>
              {tasks.length} total tasks • {sortedTasks.length} filtered
            </CardDescription>
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>

        {/* State Summary */}
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.values(TaskState).map(state => {
            const count = getStateCount(state);
            if (count === 0) return null;

            return (
              <Badge
                key={state}
                variant="outline"
                className="flex items-center gap-1 cursor-pointer"
                onClick={() => setFilterState(filterState === state ? 'all' : state)}
              >
                {getStateIcon(state)}
                {state} ({count})
              </Badge>
            );
          })}
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <Select value={filterState} onValueChange={(value) => setFilterState(value as TaskState | 'all')}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {Object.values(TaskState).map(state => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort('lastActivity')}
              className="flex items-center gap-1"
            >
              {sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              Time
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort('taskId')}
              className="flex items-center gap-1"
            >
              {sortField === 'taskId' && sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              ID
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {sortedTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || filterState !== 'all' ? (
              <div>
                <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No tasks match your current filters</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterState('all');
                  }}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div>
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No tasks found</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTasks.map((task) => (
              <div
                key={task.taskId}
                className={cn(
                  'transition-opacity',
                  onTaskSelect && 'cursor-pointer hover:opacity-80'
                )}
                onClick={() => onTaskSelect?.(task)}
              >
                <TaskDisplay
                  task={task}
                  showDetails={true}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}