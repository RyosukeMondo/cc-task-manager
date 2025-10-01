'use client';

import { AppLayout } from '@/components/layout';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface TaskDetailViewProps {
  taskId: string;
}

/**
 * TaskDetailView Component
 *
 * Main container for task detail page.
 * Will render TaskDetail, LogViewer, and TaskActions components.
 * TODO: Implement with useTask hook and child components (Tasks 2, 3, 4, 5)
 */
export function TaskDetailView({ taskId }: TaskDetailViewProps) {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/tasks">Tasks</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Task Detail</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* TODO: Implement TaskDetail component (Task 2) */}
        {/* TODO: Implement LogViewer component (Task 3) */}
        {/* TODO: Implement TaskActions component (Task 4) */}

        <div className="text-muted-foreground">
          Task ID: {taskId}
          <br />
          (Components will be implemented in subsequent tasks)
        </div>
      </div>
    </AppLayout>
  );
}
