'use client';

import React from 'react';
import { useForm, UseFormReturn, FieldValues, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodSchema } from 'zod';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';

/**
 * Base form configuration interface
 * Follows Interface Segregation Principle by separating form concerns
 */
export interface BaseFormConfig<T extends FieldValues> {
  schema: ZodSchema<T>;
  defaultValues?: Partial<T>;
  title?: string;
  description?: string;
  submitText?: string;
  loadingText?: string;
  className?: string;
}

/**
 * Base form props extending configuration
 * Applies Dependency Inversion Principle with abstract submission interface
 */
export interface BaseFormProps<T extends FieldValues> extends BaseFormConfig<T> {
  onSubmit: SubmitHandler<T>;
  isLoading?: boolean;
  children: (form: UseFormReturn<T, any, undefined>) => React.ReactNode;
}

/**
 * BaseForm component following Single Responsibility Principle
 * Responsible only for form structure, validation, and submission handling
 * Uses existing contract validation through zodResolver
 *
 * @template T - Form data type constrained to FieldValues
 */
export function BaseForm<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  isLoading = false,
  title,
  description,
  submitText = 'Submit',
  loadingText = 'Submitting...',
  className,
  children
}: BaseFormProps<T>) {
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
    mode: 'onChange' // Enable real-time validation
  });

  const { handleSubmit, formState: { isSubmitting, isValid } } = form;

  const handleFormSubmit: SubmitHandler<T> = async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      // Error handling is managed by parent component
      console.error('Form submission error:', error);
      throw error;
    }
  };

  const isFormLoading = isSubmitting || isLoading;

  return (
    <Card className={cn('w-full', className)}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {children(form as any)}

          <Button
            type="submit"
            disabled={isFormLoading || !isValid}
            className="w-full"
          >
            {isFormLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isFormLoading ? loadingText : submitText}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}