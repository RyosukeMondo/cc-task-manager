'use client';

import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type PaginationState
} from '@tanstack/react-table';
import { WorkerTaskStatus, TaskState } from '@cc-task-manager/types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Pagination } from './Pagination';
import { cn } from '../../lib/utils';
import {
  ArrowUpDown,
  ChevronDown,
  Eye,
  EyeOff,
  Filter,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pause,
  Play,
  Square
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface TaskTableProps {
  tasks: WorkerTaskStatus[];
  onTaskSelect?: (task: WorkerTaskStatus) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
  showSearch?: boolean;
  showColumnVisibility?: boolean;
  initialPageSize?: number;
}

// Task state styling and icons
const getTaskStateConfig = (state: TaskState) => {
  switch (state) {
    case TaskState.PENDING:
      return {
        variant: 'secondary' as const,
        icon: <Clock className="h-3 w-3" />,
        label: 'Pending'
      };
    case TaskState.RUNNING:
      return {
        variant: 'default' as const,
        icon: <Play className="h-3 w-3" />,
        label: 'Running'
      };
    case TaskState.ACTIVE:
      return {
        variant: 'default' as const,
        icon: <Play className="h-3 w-3" />,
        label: 'Active'
      };
    case TaskState.IDLE:
      return {
        variant: 'secondary' as const,
        icon: <Pause className="h-3 w-3" />,
        label: 'Idle'
      };
    case TaskState.COMPLETED:
      return {
        variant: 'outline' as const,
        icon: <CheckCircle className="h-3 w-3 text-green-600" />,
        label: 'Completed'
      };
    case TaskState.FAILED:
      return {
        variant: 'destructive' as const,
        icon: <XCircle className="h-3 w-3" />,
        label: 'Failed'
      };
    case TaskState.CANCELLED:
      return {
        variant: 'outline' as const,
        icon: <Square className="h-3 w-3" />,
        label: 'Cancelled'
      };
    default:
      return {
        variant: 'secondary' as const,
        icon: <AlertCircle className="h-3 w-3" />,
        label: state
      };
  }
};

/**
 * TaskTable component implementing responsive data table with advanced features
 * Following SOLID principles and utilizing TanStack Table for performance
 */
export function TaskTable({
  tasks,
  onTaskSelect,
  onRefresh,
  isLoading = false,
  className,
  showSearch = true,
  showColumnVisibility = true,
  initialPageSize = 10
}: TaskTableProps) {
  // Table state management
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  // Define table columns with responsive behavior
  const columns = useMemo<ColumnDef<WorkerTaskStatus>[]>(
    () => [
      {
        accessorKey: 'taskId',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 hover:bg-transparent"
          >
            Task ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-mono text-sm truncate max-w-[150px]" title={row.getValue('taskId')}>
            {row.getValue('taskId')}
          </div>
        ),
        enableSorting: true,
        enableHiding: false, // Always visible
      },
      {
        accessorKey: 'state',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 hover:bg-transparent"
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const state = row.getValue('state') as TaskState;
          const config = getTaskStateConfig(state);
          return (
            <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
              {config.icon}
              <span className="hidden sm:inline">{config.label}</span>
            </Badge>
          );
        },
        enableSorting: true,
        filterFn: 'equalsString',
      },
      {
        accessorKey: 'progress',
        header: 'Progress',
        cell: ({ row }) => {
          const progress = row.getValue('progress') as string | undefined;
          return (
            <div className="text-sm text-muted-foreground truncate max-w-[200px]" title={progress}>
              {progress || '-'}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'lastActivity',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 hover:bg-transparent"
          >
            Last Activity
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = row.getValue('lastActivity') as Date;
          return (
            <div className="text-sm">
              <div className="hidden md:block">
                {date.toLocaleString()}
              </div>
              <div className="md:hidden">
                {date.toLocaleDateString()}
              </div>
              <div className="text-xs text-muted-foreground md:hidden">
                {date.toLocaleTimeString()}
              </div>
            </div>
          );
        },
        enableSorting: true,
        sortingFn: 'datetime',
      },
      {
        accessorKey: 'pid',
        header: 'PID',
        cell: ({ row }) => {
          const pid = row.getValue('pid') as number | undefined;
          return (
            <div className="text-sm font-mono">
              {pid || '-'}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: 'error',
        header: 'Error',
        cell: ({ row }) => {
          const error = row.getValue('error') as string | undefined;
          return error ? (
            <div
              className="text-sm text-red-600 truncate max-w-[150px] cursor-help"
              title={error}
            >
              {error}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'exitCode',
        header: 'Exit Code',
        cell: ({ row }) => {
          const exitCode = row.getValue('exitCode') as number | undefined;
          return exitCode !== undefined ? (
            <div className={cn(
              'text-sm font-mono',
              exitCode === 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {exitCode}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
        enableSorting: true,
      },
    ],
    []
  );

  // Initialize table with all features
  const table = useReactTable({
    data: tasks,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
    },
  });

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Task Management</CardTitle>
            <div className="text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length} of {tasks.length} tasks
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Global Search */}
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-8 w-full sm:w-[200px]"
                />
              </div>
            )}

            {/* Column Visibility */}
            {showColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <EyeOff className="mr-2 h-4 w-4" />
                    Columns
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[150px]">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Refresh Button */}
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
        </div>
      </CardHeader>

      <CardContent>
        {/* Responsive Table Container */}
        <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-10">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      'transition-colors',
                      onTaskSelect && 'cursor-pointer hover:bg-muted/50'
                    )}
                    onClick={() => onTaskSelect?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Filter className="h-8 w-8 opacity-50" />
                      <p>No tasks found</p>
                      {globalFilter && (
                        <p className="text-sm">
                          Try adjusting your search: "{globalFilter}"
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4">
          <Pagination
            table={table}
            pageSizeOptions={[5, 10, 20, 50, 100]}
          />
        </div>
      </CardContent>
    </Card>
  );
}