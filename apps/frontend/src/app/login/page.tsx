'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/LoginForm';
import { UnauthenticatedOnly } from '@/lib/auth/components';

/**
 * Login page component
 */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  // Get return URL from search params
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  /**
   * Redirect if already authenticated
   */
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(returnUrl);
    }
  }, [isAuthenticated, isLoading, router, returnUrl]);

  /**
   * Handle successful login
   * Note: Redirect is handled by the useEffect above when isAuthenticated becomes true
   */
  const handleLoginSuccess = () => {
    // Redirect is handled by useEffect - no manual redirect needed here
    // This prevents double-redirect issues
  };

  /**
   * Handle login error
   */
  const handleLoginError = (error: string) => {
    console.error('Login error:', error);
    // Error is already displayed in the form via auth context
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
              Professional task management dashboard
            </p>
          </div>

          <LoginForm
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            redirectUrl={returnUrl}
            className="mt-8"
          />

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <a
                href="/register"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign up here
              </a>
            </p>
          </div>
        </div>
      </div>
    </UnauthenticatedOnly>
  );
}