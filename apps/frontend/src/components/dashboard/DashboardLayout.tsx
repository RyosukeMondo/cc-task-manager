'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  headerActions?: React.ReactNode;
}

/**
 * Responsive dashboard layout component
 * Provides consistent structure for dashboard pages with flexible content areas
 */
export function DashboardLayout({
  children,
  title = 'Dashboard',
  description,
  className,
  headerActions
}: DashboardLayoutProps) {
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className || ''}`}>
      <div className="container mx-auto p-4 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div className="flex flex-col space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center space-x-2">
              {headerActions}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="grid gap-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard grid container for organizing cards/widgets
 * Responsive grid that adapts to different screen sizes
 */
export function DashboardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * Dashboard metric card component
 * Displays key metrics with consistent styling
 */
interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  icon?: React.ReactNode;
  loading?: boolean;
}

export function MetricCard({ title, value, description, trend, icon, loading = false }: MetricCardProps) {
  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400'
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="h-4 w-4">{icon}</div>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
            {trend && (
              <p className={`text-xs ${trendColors[trend.direction]} mt-1`}>
                {trend.direction === 'up' && '↗'}
                {trend.direction === 'down' && '↘'}
                {trend.direction === 'neutral' && '→'}
                {trend.value}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}