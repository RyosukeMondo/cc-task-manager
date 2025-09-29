'use client';

import React, { useState } from 'react';
import { TaskState } from '@cc-task-manager/types';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Label } from '../ui/label';
import {
  Filter,
  FilterX,
  Calendar as CalendarIcon,
  SortAsc,
  SortDesc,
  Settings,
  Save,
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause
} from 'lucide-react';

export type SortField = 'lastActivity' | 'taskId' | 'state' | 'priority';
export type SortDirection = 'asc' | 'desc';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskFilters {
  status: TaskState[];
  priority: TaskPriority[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  search: string;
}

export interface TaskSorting {
  field: SortField;
  direction: SortDirection;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: TaskFilters;
  sorting: TaskSorting;
}

interface TaskFiltersProps {
  filters: TaskFilters;
  sorting: TaskSorting;
  onFiltersChange: (filters: TaskFilters) => void;
  onSortingChange: (sorting: TaskSorting) => void;
  className?: string;
  taskCounts?: Record<TaskState, number>;
  showPresets?: boolean;
}

const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'active',
    name: 'Active Tasks',
    filters: {
      status: [TaskState.RUNNING, TaskState.ACTIVE],
      priority: [],
      dateRange: { start: null, end: null },
      search: ''
    },
    sorting: { field: 'lastActivity', direction: 'desc' }
  },
  {
    id: 'completed',
    name: 'Completed Today',
    filters: {
      status: [TaskState.COMPLETED],
      priority: [],
      dateRange: {
        start: new Date(new Date().setHours(0, 0, 0, 0)),
        end: new Date()
      },
      search: ''
    },
    sorting: { field: 'lastActivity', direction: 'desc' }
  },
  {
    id: 'high-priority',
    name: 'High Priority',
    filters: {
      status: [],
      priority: ['high', 'urgent'],
      dateRange: { start: null, end: null },
      search: ''
    },
    sorting: { field: 'priority', direction: 'desc' }
  }
];

/**
 * TaskFilters component following Single Responsibility Principle
 * Handles all filtering, sorting, and preset management functionality
 * Separated from TaskList for better modularity and reusability
 */
export function TaskFilters({
  filters,
  sorting,
  onFiltersChange,
  onSortingChange,
  className,
  taskCounts = {} as Record<TaskState, number>,
  showPresets = true
}: TaskFiltersProps) {
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>(() => {
    // Load saved presets from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskFilterPresets');
      return saved ? [...DEFAULT_PRESETS, ...JSON.parse(saved)] : DEFAULT_PRESETS;
    }
    return DEFAULT_PRESETS;
  });

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

  const toggleStatusFilter = (status: TaskState) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];

    onFiltersChange({
      ...filters,
      status: newStatus
    });
  };

  const togglePriorityFilter = (priority: TaskPriority) => {
    const newPriority = filters.priority.includes(priority)
      ? filters.priority.filter(p => p !== priority)
      : [...filters.priority, priority];

    onFiltersChange({
      ...filters,
      priority: newPriority
    });
  };

  const updateDateRange = (field: 'start' | 'end', date: Date | null) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: date
      }
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: [],
      priority: [],
      dateRange: { start: null, end: null },
      search: ''
    });
  };

  const toggleSort = (field: SortField) => {
    if (sorting.field === field) {
      onSortingChange({
        field,
        direction: sorting.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      onSortingChange({
        field,
        direction: 'desc'
      });
    }
  };

  const applyPreset = (preset: FilterPreset) => {
    onFiltersChange(preset.filters);
    onSortingChange(preset.sorting);
  };

  const saveCurrentAsPreset = () => {
    const name = prompt('Enter preset name:');
    if (!name) return;

    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      name,
      filters,
      sorting
    };

    const customPresets = savedPresets.filter(p => !DEFAULT_PRESETS.find(dp => dp.id === p.id));
    const updatedPresets = [...DEFAULT_PRESETS, ...customPresets, newPreset];
    setSavedPresets(updatedPresets);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskFilterPresets', JSON.stringify(customPresets.concat(newPreset)));
    }
  };

  const hasActiveFilters = filters.status.length > 0 ||
                          filters.priority.length > 0 ||
                          filters.dateRange.start ||
                          filters.dateRange.end ||
                          filters.search.length > 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters & Sorting
          </CardTitle>
          <div className="flex items-center gap-2">
            {showPresets && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-1" />
                    Presets
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Filter Presets</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={saveCurrentAsPreset}
                        disabled={!hasActiveFilters}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {savedPresets.map(preset => (
                        <Button
                          key={preset.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => applyPreset(preset)}
                        >
                          {preset.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
              >
                <FilterX className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Filters */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Status</Label>
          <div className="flex flex-wrap gap-2">
            {Object.values(TaskState).map(state => {
              const count = taskCounts[state] || 0;
              const isActive = filters.status.includes(state);

              return (
                <Badge
                  key={state}
                  variant={isActive ? "default" : "outline"}
                  className="flex items-center gap-1 cursor-pointer hover:bg-muted"
                  onClick={() => toggleStatusFilter(state)}
                >
                  {getStateIcon(state)}
                  {state} ({count})
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Priority Filters */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Priority</Label>
          <div className="flex flex-wrap gap-2">
            {(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map(priority => {
              const isActive = filters.priority.includes(priority);

              return (
                <Badge
                  key={priority}
                  variant={isActive ? "default" : "outline"}
                  className="cursor-pointer hover:bg-muted capitalize"
                  onClick={() => togglePriorityFilter(priority)}
                >
                  {priority}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Date Range Filter */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Date Range</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-start text-left font-normal"
                  size="sm"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange.start ? filters.dateRange.start.toLocaleDateString() : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.start || undefined}
                  onSelect={(date) => updateDateRange('start', date || null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-start text-left font-normal"
                  size="sm"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange.end ? filters.dateRange.end.toLocaleDateString() : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.end || undefined}
                  onSelect={(date) => updateDateRange('end', date || null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Sorting Controls */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Sort by</Label>
          <div className="flex flex-wrap gap-2">
            {([
              { field: 'lastActivity' as SortField, label: 'Last Activity' },
              { field: 'taskId' as SortField, label: 'Task ID' },
              { field: 'state' as SortField, label: 'Status' },
              { field: 'priority' as SortField, label: 'Priority' }
            ]).map(({ field, label }) => {
              const isActive = sorting.field === field;
              const Icon = sorting.direction === 'asc' ? SortAsc : SortDesc;

              return (
                <Button
                  key={field}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleSort(field)}
                  className="flex items-center gap-1"
                >
                  {isActive && <Icon className="h-3 w-3" />}
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}