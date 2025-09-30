'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { UnauthenticatedOnly } from '@/lib/auth/components';

/**
 * Register page component
 */
export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  /**
   * Redirect if already authenticated
   */
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  /**
   * Handle successful registration
   */
  const handleRegisterSuccess = () => {
    // User will be redirected to login page by the form
    console.log('Registration successful');
  };

  /**
   * Handle registration error
   */
  const handleRegisterError = (error: string) => {
    console.error('Registration error:', error);
    // Error is already displayed in the form
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <UnauthenticatedOnly
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Redirecting...</p>
          </div>
        </div>
      }
    >
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
              Task Manager
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Create your account to get started
            </p>
          </div>

          <RegisterForm
            onSuccess={handleRegisterSuccess}
            onError={handleRegisterError}
            redirectUrl="/login"
            className="mt-8"
          />

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <a
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in here
              </a>
            </p>
          </div>
        </div>
      </div>
    </UnauthenticatedOnly>
  );
}