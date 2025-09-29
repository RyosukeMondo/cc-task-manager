'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { LoginCredentials } from '@/lib/auth/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff } from 'lucide-react';

/**
 * Login form validation schema
 */
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * LoginForm component props
 */
interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
  showCard?: boolean;
  redirectUrl?: string;
}

/**
 * LoginForm component for user authentication
 */
export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  className = '',
  showCard = true,
  redirectUrl,
}) => {
  const { login, isLoading, error } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data as LoginCredentials);

      // Reset form on success
      reset();

      // Call success callback
      onSuccess?.();

      // Redirect if URL provided
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      onError?.(errorMessage);
    }
  };

  /**
   * Toggle password visibility
   */
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  /**
   * Form content
   */
  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Display auth error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Email field */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          {...register('email')}
          disabled={isLoading || isSubmitting}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password field */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            {...register('password')}
            disabled={isLoading || isSubmitting}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="pr-10"
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-sm text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || isSubmitting}
      >
        {isLoading || isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </Button>
    </form>
  );

  // Return form with or without card wrapper
  if (showCard) {
    return (
      <Card className={className}>
        <CardHeader className="text-center">
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your account to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>{formContent}</CardContent>
      </Card>
    );
  }

  return <div className={className}>{formContent}</div>;
};

/**
 * Default export
 */
export default LoginForm;