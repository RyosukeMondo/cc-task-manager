'use client';

import React from 'react';
import { UseFormReturn, FieldPath, FieldValues } from 'react-hook-form';
import { cn } from '../../lib/utils';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertCircle } from 'lucide-react';

/**
 * Base field interface following Liskov Substitution Principle
 * All field variants must be substitutable for this base interface
 */
export interface BaseFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  description?: string;
}

/**
 * Text input field props extending base field
 */
export interface TextFieldProps<T extends FieldValues> extends BaseFieldProps<T> {
  type?: 'text' | 'email' | 'password' | 'url';
  placeholder?: string;
  autoComplete?: string;
}

/**
 * Number input field props extending base field
 */
export interface NumberFieldProps<T extends FieldValues> extends BaseFieldProps<T> {
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

/**
 * Textarea field props extending base field
 */
export interface TextareaFieldProps<T extends FieldValues> extends BaseFieldProps<T> {
  placeholder?: string;
  rows?: number;
  minRows?: number;
  maxRows?: number;
}

/**
 * Select field option interface
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Select field props extending base field
 */
export interface SelectFieldProps<T extends FieldValues> extends BaseFieldProps<T> {
  options: SelectOption[];
  placeholder?: string;
}

/**
 * Utility function to format error messages consistently
 */
const formatErrorMessage = (error: any): string => {
  if (typeof error?.message === 'string') return error.message;
  if (typeof error === 'string') return error;
  return 'Invalid input';
};

/**
 * Error display component for consistent error rendering
 */
interface FieldErrorProps {
  error?: any;
}

function FieldError({ error }: FieldErrorProps) {
  if (!error) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-red-600">
      <AlertCircle className="h-4 w-4" />
      {formatErrorMessage(error)}
    </div>
  );
}

/**
 * Field wrapper component for consistent layout and labeling
 */
interface FieldWrapperProps {
  label: string;
  required?: boolean;
  description?: string;
  error?: any;
  className?: string;
  children: React.ReactNode;
}

function FieldWrapper({
  label,
  required,
  description,
  error,
  className,
  children
}: FieldWrapperProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {children}
      <FieldError error={error} />
    </div>
  );
}

/**
 * TextField component implementing Liskov Substitution Principle
 * Can be substituted anywhere BaseFieldProps is expected
 */
export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  type = 'text',
  placeholder,
  required,
  disabled,
  autoComplete,
  className,
  description
}: TextFieldProps<T>) {
  const { register, formState: { errors } } = form;

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={description}
      error={errors[name]}
      className={className}
    >
      <Input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        {...register(name)}
      />
    </FieldWrapper>
  );
}

/**
 * NumberField component implementing Liskov Substitution Principle
 * Can be substituted anywhere BaseFieldProps is expected
 */
export function NumberField<T extends FieldValues>({
  form,
  name,
  label,
  min,
  max,
  step,
  placeholder,
  required,
  disabled,
  className,
  description
}: NumberFieldProps<T>) {
  const { register, formState: { errors } } = form;

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={description}
      error={errors[name]}
      className={className}
    >
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        {...register(name, { valueAsNumber: true })}
      />
    </FieldWrapper>
  );
}

/**
 * TextareaField component implementing Liskov Substitution Principle
 * Can be substituted anywhere BaseFieldProps is expected
 */
export function TextareaField<T extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  rows = 3,
  required,
  disabled,
  className,
  description
}: TextareaFieldProps<T>) {
  const { register, formState: { errors } } = form;

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={description}
      error={errors[name]}
      className={className}
    >
      <Textarea
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        {...register(name)}
      />
    </FieldWrapper>
  );
}

/**
 * SelectField component implementing Liskov Substitution Principle
 * Can be substituted anywhere BaseFieldProps is expected
 */
export function SelectField<T extends FieldValues>({
  form,
  name,
  label,
  options,
  placeholder,
  required,
  disabled,
  className,
  description
}: SelectFieldProps<T>) {
  const { setValue, watch, formState: { errors } } = form;
  const value = watch(name);

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={description}
      error={errors[name]}
      className={className}
    >
      <Select
        value={value}
        onValueChange={(newValue) => setValue(name, newValue as any)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}