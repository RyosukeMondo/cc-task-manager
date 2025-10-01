'use client';

import * as React from 'react';
import { TaskCreateDialog } from './TaskCreateDialog';
import { TaskCreateForm } from './TaskCreateForm';

interface TaskCreateResponsiveProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCreateResponsive({
  open,
  onOpenChange,
}: TaskCreateResponsiveProps) {
  const handleSuccess = () => {
    // Close the modal on success
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Close the modal on cancel
    onOpenChange(false);
  };

  return (
    <TaskCreateDialog open={open} onOpenChange={onOpenChange}>
      <TaskCreateForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </TaskCreateDialog>
  );
}
