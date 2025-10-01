'use client';

import React, { useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Queue Dashboard Error Boundary
 * Displays error message with retry button when page fails to load
 *
 * Spec: queue-management-dashboard
 */
export default function QueueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Queue dashboard error:', error);
  }, [error]);

  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[600px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Failed to Load Queue Dashboard</CardTitle>
            <CardDescription>
              {error.message || 'An unexpected error occurred while loading the queue dashboard'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error.digest && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground font-mono">
                  Error ID: {error.digest}
                </p>
              </div>
            )}
            <Button
              onClick={reset}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
