# Design Document - Task Creation Modal

## Architecture Overview

The Task Creation Modal provides a form-based UI for creating tasks with validation:

```
Button Click → Dialog Opens → Form (react-hook-form) → Validation (Zod) → API Call (TanStack Query) → Optimistic UI Update
```

### Component Structure

```typescript
TaskCreateDialog (Modal/Sheet)
├── TaskCreateForm (Form with validation)
│   ├── Title Input (required)
│   ├── Description Textarea (optional)
│   ├── Priority Select (default: MEDIUM)
│   └── Tags Multi-Input (optional)
└── useCreateTask (API mutation hook)
```

## Component Design

### TaskCreateDialog

```typescript
// apps/frontend/src/components/tasks/TaskCreateDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskCreateForm } from './TaskCreateForm';

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCreateDialog({ open, onOpenChange }: TaskCreateDialogProps) {
  const handleSuccess = () => {
    onOpenChange(false); // Close dialog on success
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <TaskCreateForm onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Mobile-optimized variant using Sheet (bottom drawer)
export function TaskCreateSheet({ open, onOpenChange }: TaskCreateDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh]">
        <SheetHeader>
          <SheetTitle>Create New Task</SheetTitle>
        </SheetHeader>
        <TaskCreateForm onSuccess={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

// Responsive wrapper (Dialog on desktop, Sheet on mobile)
export function TaskCreateResponsive({ open, onOpenChange }: TaskCreateDialogProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  return isMobile ? (
    <TaskCreateSheet open={open} onOpenChange={onOpenChange} />
  ) : (
    <TaskCreateDialog open={open} onOpenChange={onOpenChange} />
  );
}
```

### TaskCreateForm

```typescript
// apps/frontend/src/components/tasks/TaskCreateForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTaskSchema, type CreateTaskDto } from '@cc-task-manager/schemas';
import { useCreateTask } from '@/hooks/useCreateTask';

interface TaskCreateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TaskCreateForm({ onSuccess, onCancel }: TaskCreateFormProps) {
  const { mutate: createTask, isPending, error } = useCreateTask();

  const form = useForm<CreateTaskDto>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM'
    },
    mode: 'onChange' // Validate on change for real-time feedback
  });

  const onSubmit = (data: CreateTaskDto) => {
    createTask(data, {
      onSuccess: () => {
        toast.success('Task created successfully!');
        form.reset(); // Reset form for next use
        onSuccess?.();
      },
      onError: (error) => {
        // Error handling in useCreateTask hook
        toast.error('Failed to create task. Please try again.');
      }
    });
  };

  // Character count for title
  const titleLength = form.watch('title')?.length || 0;

  // Keyboard shortcut: Ctrl+Enter to submit
  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-4">
      {/* Title Field */}
      <div className="space-y-2">
        <Label htmlFor="title">
          Title <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          placeholder="Enter task title..."
          autoFocus
          {...form.register('title')}
          aria-invalid={!!form.formState.errors.title}
          aria-describedby="title-error"
        />
        <div className="flex justify-between items-center text-sm">
          {form.formState.errors.title ? (
            <p id="title-error" className="text-red-500" role="alert">
              {form.formState.errors.title.message}
            </p>
          ) : (
            <span />
          )}
          <span className={cn('text-muted-foreground', titleLength > 200 && 'text-red-500')}>
            {titleLength}/200
          </span>
        </div>
      </div>

      {/* Description Field */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe what this task should do..."
          rows={4}
          {...form.register('description')}
          aria-invalid={!!form.formState.errors.description}
        />
        {form.formState.errors.description && (
          <p className="text-sm text-red-500" role="alert">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>

      {/* Priority Field */}
      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Select
          value={form.watch('priority')}
          onValueChange={(value) => form.setValue('priority', value as any)}
        >
          <SelectTrigger id="priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Low
              </div>
            </SelectItem>
            <SelectItem value="MEDIUM">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                Medium
              </div>
            </SelectItem>
            <SelectItem value="HIGH">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-orange-500" />
                High
              </div>
            </SelectItem>
            <SelectItem value="URGENT">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                Urgent
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !form.formState.isValid}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Task'
          )}
        </Button>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-muted-foreground text-center">
        Press Ctrl+Enter to submit
      </p>
    </form>
  );
}
```

### useCreateTask Hook

```typescript
// apps/frontend/src/hooks/useCreateTask.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type CreateTaskDto, type Task } from '@cc-task-manager/schemas';
import { apiClient } from '@/lib/api/contract-client';

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskDto) => apiClient.createTask(data),

    // Optimistic update
    onMutate: async (newTask) => {
      // Cancel outgoing refetches (prevent overwriting optimistic update)
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      // Optimistically add new task
      const optimisticTask: Task = {
        id: `temp-${Date.now()}`, // Temporary ID
        ...newTask,
        status: 'PENDING',
        userId: 'current-user', // Will be replaced by real data
        createdAt: new Date(),
        updatedAt: new Date()
      };

      queryClient.setQueryData<Task[]>(['tasks'], (old) => [optimisticTask, ...(old || [])]);

      // Return snapshot for rollback
      return { previousTasks };
    },

    // Rollback on error
    onError: (err, newTask, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
    },

    // Replace optimistic task with real task from server
    onSuccess: (createdTask) => {
      queryClient.setQueryData<Task[]>(['tasks'], (old) => {
        if (!old) return [createdTask];

        // Remove optimistic task, add real task
        return [createdTask, ...old.filter((t) => !t.id.startsWith('temp-'))];
      });

      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
}
```

## Integration with Tasks Page

```typescript
// apps/frontend/src/app/tasks/page.tsx
import { useState } from 'react';
import { TaskCreateResponsive } from '@/components/tasks/TaskCreateDialog';

export default function TasksPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Task
        </Button>
      </div>

      <TaskList />

      <TaskCreateResponsive open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
```

## Validation Schema

```typescript
// packages/schemas/src/task.schema.ts
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),

  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .optional()
    .or(z.literal('')), // Allow empty string

  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
```

## File Structure

```
apps/frontend/src/
├── components/tasks/
│   ├── TaskCreateDialog.tsx          # Dialog/Sheet wrapper
│   ├── TaskCreateForm.tsx            # Form with validation
│   └── TaskList.tsx                  # Existing task list (wire up click)
├── hooks/
│   └── useCreateTask.ts              # API mutation hook (enhance)
├── app/tasks/
│   └── page.tsx                      # Wire up dialog open/close
└── lib/api/
    └── contract-client.ts            # API client (already has createTask method)
```

## Error Handling

### Validation Errors (Frontend)

```typescript
// Handled by react-hook-form + Zod
{
  "title": "Title is required",
  "description": "Description must be 2000 characters or less"
}
```

### API Errors (Backend)

```typescript
// 400 Bad Request
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "title", "message": "Title is required" }
  ]
}

// 401 Unauthorized
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Invalid or expired token"
}

// 500 Internal Server Error
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

### Error Display in Form

```typescript
onError: (error) => {
  if (error.response?.status === 400) {
    // Map backend validation errors to form fields
    const backendErrors = error.response.data.errors;
    backendErrors.forEach(({ field, message }) => {
      form.setError(field as any, { message });
    });
  } else if (error.response?.status === 401) {
    // Redirect to login
    router.push('/login');
  } else {
    // Generic error toast
    toast.error('Failed to create task. Please try again.');
  }
}
```

## Optimistic UI Flow

```
User clicks Submit
    ↓
Form validates (Zod)
    ↓
Optimistic update: Add temp task to list immediately
    ↓
API call: POST /api/tasks
    ↓
Success: Replace temp task with real task from server
    OR
Error: Rollback to previous state, show error
```

## Accessibility Features

```typescript
// ARIA labels and roles
<Input
  aria-label="Task title"
  aria-invalid={!!errors.title}
  aria-describedby="title-error"
  aria-required="true"
/>

// Error announcements
<p id="title-error" role="alert">
  {errors.title?.message}
</p>

// Focus management
useEffect(() => {
  if (open) {
    // Auto-focus title field when dialog opens
    titleInputRef.current?.focus();
  }
}, [open]);

// Keyboard navigation
- Tab: Navigate between fields
- Enter in title: Move to description (not submit)
- Ctrl+Enter: Submit form
- Escape: Close dialog
```

## Responsive Design

### Desktop (≥640px)

- Dialog centered on screen
- Max width: 600px
- Backdrop overlay

### Mobile (<640px)

- Sheet from bottom
- Full width
- 90% viewport height
- Swipe down to close

## Testing Strategy

```typescript
// apps/frontend/e2e/task-create.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Task Creation Modal', () => {
  test('should open modal when clicking Create Task button', async ({ page }) => {
    await page.goto('/tasks');
    await page.click('button:has-text("Create Task")');

    await expect(page.locator('dialog')).toBeVisible();
    await expect(page.locator('input[placeholder*="task title"]')).toBeFocused();
  });

  test('should validate required title field', async ({ page }) => {
    await page.goto('/tasks');
    await page.click('button:has-text("Create Task")');

    // Try to submit without title
    await page.click('button:has-text("Create Task")'); // Submit button

    await expect(page.locator('text=Title is required')).toBeVisible();
  });

  test('should create task successfully', async ({ page }) => {
    await page.goto('/tasks');
    await page.click('button:has-text("Create Task")');

    // Fill form
    await page.fill('input[placeholder*="task title"]', 'Test Task');
    await page.fill('textarea', 'This is a test task');
    await page.selectOption('select', 'HIGH');

    // Submit
    await page.click('button:has-text("Create Task")');

    // Verify success
    await expect(page.locator('text=Task created successfully')).toBeVisible();
    await expect(page.locator('dialog')).not.toBeVisible();
    await expect(page.locator('text=Test Task')).toBeVisible(); // In task list
  });

  test('should show optimistic UI update', async ({ page }) => {
    await page.goto('/tasks');
    await page.click('button:has-text("Create Task")');

    await page.fill('input[placeholder*="task title"]', 'Optimistic Task');
    await page.click('button:has-text("Create Task")');

    // Task should appear immediately (optimistic)
    await expect(page.locator('text=Optimistic Task')).toBeVisible({ timeout: 100 });
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/tasks', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ message: 'Server error' }) });
    });

    await page.goto('/tasks');
    await page.click('button:has-text("Create Task")');
    await page.fill('input[placeholder*="task title"]', 'Error Task');
    await page.click('button:has-text("Create Task")');

    // Verify error toast
    await expect(page.locator('text=Failed to create task')).toBeVisible();
    // Dialog should remain open
    await expect(page.locator('dialog')).toBeVisible();
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    await page.goto('/tasks');
    await page.click('button:has-text("Create Task")');

    await page.fill('input[placeholder*="task title"]', 'Keyboard Task');
    await page.keyboard.press('Control+Enter'); // Ctrl+Enter to submit

    await expect(page.locator('text=Task created successfully')).toBeVisible();
  });
});
```

## Performance Optimizations

1. **Code Splitting**: Lazy load dialog component
2. **Debounced Validation**: Validate after 300ms of no typing
3. **Memoization**: Memoize form handlers
4. **Optimistic UI**: Instant feedback without waiting for API

```typescript
// Lazy load dialog
const TaskCreateDialog = lazy(() => import('./TaskCreateDialog'));

// Debounced character count
const debouncedTitle = useDebounce(title, 300);
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_TASK_CREATE_ENABLED=true
NEXT_PUBLIC_MAX_TASK_TITLE_LENGTH=200
NEXT_PUBLIC_MAX_TASK_DESCRIPTION_LENGTH=2000
```

This design provides a polished, accessible, and performant task creation experience!
