'use client';

import React, { useState, useMemo } from 'react';
import { TaskStatus, TaskState } from '@cc-task-manager/types';
import { TaskDisplay } from './TaskDisplay';
import { TaskFilters, TaskFilters as TaskFiltersType, TaskSorting, TaskPriority } from './TaskFilters';
import { TaskSearch } from './TaskSearch';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  RefreshCw,
  Filter,
  Clock
} from 'lucide-react';

interface TaskListProps {
  tasks: TaskStatus[];
  onRefresh?: () => void;
  onTaskSelect?: (task: TaskStatus) => void;
  isLoading?: boolean;
  className?: string;
  showFilters?: boolean;
  showSearch?: boolean;
}

/**
 * TaskList component following Single Responsibility Principle
 * Now uses modular TaskFilters and TaskSearch components
 * Responsible only for orchestrating task display and coordinating filters
 */
export function TaskList({
  tasks,
  onRefresh,
  onTaskSelect,
  isLoading = false,
  className,
  showFilters = true,
  showSearch = true
}: TaskListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredBySearch, setFilteredBySearch] = useState<TaskStatus[]>(tasks);
  const [filters, setFilters] = useState<TaskFiltersType>({
    status: [],
    priority: [],
    dateRange: { start: null, end: null },
    search: ''
  });
  const [sorting, setSorting] = useState<TaskSorting>({
    field: 'lastActivity',
    direction: 'desc'
  });

  // Apply comprehensive filtering logic
  const finalFilteredTasks = useMemo(() => {
    let filtered = filteredBySearch;

    // Apply status filters
    if (filters.status.length > 0) {
      filtered = filtered.filter(task => filters.status.includes(task.state));
    }

    // Apply date range filters
    if (filters.dateRange.start || filters.dateRange.end) {
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.lastActivity);
        const startMatch = !filters.dateRange.start || taskDate >= filters.dateRange.start;
        const endMatch = !filters.dateRange.end || taskDate <= filters.dateRange.end;
        return startMatch && endMatch;
      });
    }

    // Note: Priority filtering would need to be added to TaskStatus type
    // For now, we'll skip priority filtering since it's not in the current schema

    return filtered;
  }, [filteredBySearch, filters]);

  // Apply sorting
  const sortedTasks = useMemo(() => {
    const sorted = [...finalFilteredTasks];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sorting.field) {
        case 'lastActivity':
          comparison = new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime();
          break;
        case 'taskId':
          comparison = a.taskId.localeCompare(b.taskId);
          break;
        case 'state':
          comparison = a.state.localeCompare(b.state);
          break;
        case 'priority':
          // Priority sorting would be implemented here when priority is added to schema
          comparison = 0;
          break;
      }

      return sorting.direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [finalFilteredTasks, sorting]);

  // Get task counts for each state
  const taskCounts = useMemo(() => {
    const counts = {} as Record<TaskState, number>;
    Object.values(TaskState).forEach(state => {
      counts[state] = tasks.filter(task => task.state === state).length;
    });
    return counts;
  }, [tasks]);

  // Handle search results from TaskSearch component
  const handleSearchResults = (results: TaskStatus[]) => {
    setFilteredBySearch(results);
  };

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Search Component */}
      {showSearch && (
        <TaskSearch
          tasks={tasks}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchResults={handleSearchResults}
          placeholder="Search tasks by ID, progress, or error..."
          showAdvancedOptions={true}
          debounceMs={300}
        />
      )}

      {/* Filters Component */}
      {showFilters && (
        <TaskFilters
          filters={filters}
          sorting={sorting}
          onFiltersChange={setFilters}
          onSortingChange={setSorting}
          taskCounts={taskCounts}
          showPresets={true}
        />
      )}

      {/* Task List Display */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Task List</CardTitle>
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
        </CardHeader>

        <CardContent>
          {sortedTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || filters.status.length > 0 || filters.dateRange.start || filters.dateRange.end ? (
                <div>
                  <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No tasks match your current filters</p>
                  <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
                </div>
              ) : (
                <div>
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No tasks found</p>
                  <p className="text-sm mt-1">Tasks will appear here when they are created</p>
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
    </div>
  );
}