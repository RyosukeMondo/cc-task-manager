'use client';

import React from 'react';
import { type Table } from '@tanstack/react-table';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface PaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showPageInfo?: boolean;
  className?: string;
}

/**
 * Reusable Pagination component for data tables
 * Provides navigation controls and page size selection
 * Optimized for performance with large datasets
 */
export function Pagination<TData>({
  table,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  showPageInfo = true,
  className
}: PaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex + 1;
  const totalPages = table.getPageCount();
  const pageSize = table.getState().pagination.pageSize;
  const totalItems = table.getFilteredRowModel().rows.length;
  const startItem = table.getState().pagination.pageIndex * pageSize + 1;
  const endItem = Math.min(startItem + pageSize - 1, totalItems);

  return (
    <div className={cn(
      'flex flex-col sm:flex-row items-center justify-between gap-4 text-sm',
      className
    )}>
      {/* Page Info */}
      {showPageInfo && (
        <div className="flex-1 text-muted-foreground">
          {totalItems > 0 ? (
            <>
              <span className="hidden sm:inline">
                Showing {startItem} to {endItem} of {totalItems} results
              </span>
              <span className="sm:hidden">
                {startItem}-{endItem} of {totalItems}
              </span>
            </>
          ) : (
            'No results'
          )}
        </div>
      )}

      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        {/* First Page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          className="h-8 w-8 p-0"
          aria-label="Go to first page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous Page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="h-8 w-8 p-0"
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page Numbers for larger screens */}
        <div className="hidden md:flex items-center gap-1">
          {getPageNumbers(currentPage, totalPages).map((pageNum, index) => (
            pageNum === '...' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => table.setPageIndex((pageNum as number) - 1)}
                className="h-8 w-8 p-0"
                aria-label={`Go to page ${pageNum}`}
                aria-current={pageNum === currentPage ? 'page' : undefined}
              >
                {pageNum}
              </Button>
            )
          ))}
        </div>

        {/* Page indicator for smaller screens */}
        <div className="md:hidden flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        {/* Next Page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="h-8 w-8 p-0"
          aria-label="Go to next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          className="h-8 w-8 p-0"
          aria-label="Go to last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Page Size Selector */}
      {showPageSizeSelector && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden sm:inline">Rows per page</span>
          <span className="text-muted-foreground sm:hidden">Per page</span>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/**
 * Generate page numbers for pagination display
 * Shows first, last, current, and surrounding pages with ellipsis
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    // Show all pages if total is 7 or less
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];

  // Always show first page
  pages.push(1);

  if (currentPage <= 4) {
    // Show pages 1-5 + ellipsis + last
    for (let i = 2; i <= 5; i++) {
      pages.push(i);
    }
    pages.push('...');
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 3) {
    // Show first + ellipsis + last 5 pages
    pages.push('...');
    for (let i = totalPages - 4; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Show first + ellipsis + current-1, current, current+1 + ellipsis + last
    pages.push('...');
    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      pages.push(i);
    }
    pages.push('...');
    pages.push(totalPages);
  }

  return pages;
}

/**
 * Pagination Quick Jump component for power users
 */
interface PaginationQuickJumpProps<TData> {
  table: Table<TData>;
  className?: string;
}

export function PaginationQuickJump<TData>({
  table,
  className
}: PaginationQuickJumpProps<TData>) {
  const [pageInput, setPageInput] = React.useState('');
  const totalPages = table.getPageCount();

  const handleJump = () => {
    const page = parseInt(pageInput);
    if (page >= 1 && page <= totalPages) {
      table.setPageIndex(page - 1);
      setPageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJump();
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">Go to page:</span>
      <input
        type="number"
        min="1"
        max={totalPages}
        value={pageInput}
        onChange={(e) => setPageInput(e.target.value)}
        onKeyPress={handleKeyPress}
        className="w-16 px-2 py-1 text-sm border rounded"
        placeholder="1"
      />
      <Button
        size="sm"
        onClick={handleJump}
        disabled={!pageInput || parseInt(pageInput) < 1 || parseInt(pageInput) > totalPages}
      >
        Go
      </Button>
    </div>
  );
}