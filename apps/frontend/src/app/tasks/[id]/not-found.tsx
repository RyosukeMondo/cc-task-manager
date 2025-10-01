import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/layout';

/**
 * 404 page for non-existent tasks
 * Displays when task ID is not found
 */
export default function TaskNotFound() {
  return (
    <AppLayout>
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <FileQuestion className="h-16 w-16 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Task Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              The task you're looking for doesn't exist or has been deleted.
            </p>
            <Button asChild>
              <Link href="/tasks">Back to Tasks</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
