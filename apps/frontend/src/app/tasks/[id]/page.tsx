import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TaskDetailView } from '@/components/tasks/TaskDetailView';

/**
 * Task Detail Page
 *
 * Dynamic route for displaying individual task details.
 * Renders task metadata, logs, and action buttons.
 */

interface TaskDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Generate metadata for task detail page
 * Sets page title based on task name
 */
export async function generateMetadata({
  params,
}: TaskDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  // TODO: Fetch task data to get actual task title
  // For now, return a basic title
  return {
    title: `Task ${id} - Task Manager`,
  };
}

/**
 * Task Detail Page Component
 */
export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    notFound();
  }

  return <TaskDetailView taskId={id} />;
}
