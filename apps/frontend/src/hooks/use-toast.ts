/**
 * Simple toast notification hook
 * Provides a basic toast notification system for user feedback
 */

export interface ToastOptions {
  title?: string;
  description: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const toast = ({ title, description, variant = 'default' }: ToastOptions) => {
    // For now, using console.log as a fallback
    // In a full implementation, this would integrate with a toast provider
    if (variant === 'destructive') {
      console.error(`${title ? title + ': ' : ''}${description}`);
    } else {
      console.log(`${title ? title + ': ' : ''}${description}`);
    }
  };

  return { toast };
}
