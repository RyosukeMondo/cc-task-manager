'use client'

import { Dashboard } from '@/components/dashboard'
import { useAuth } from '@/lib/auth/hooks'
import { redirect } from 'next/navigation'
import { useEffect } from 'react'

export default function HomePage() {
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      redirect('/unauthorized')
    }
  }, [user, isLoading])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  return <Dashboard />
}