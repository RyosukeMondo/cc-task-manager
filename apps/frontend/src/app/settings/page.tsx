'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { PreferencesSettings } from '@/components/settings/PreferencesSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { useSettings } from '@/hooks/useSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Settings2, Bell, AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';

/**
 * Settings page for managing user preferences
 * Provides organized access to profile, preferences, and notification settings
 */
export default function SettingsPage() {
  // TODO: Get actual user ID from auth context/session
  const userId = 'current-user';

  const {
    settings,
    isLoading,
    isUpdating,
    error,
    updateProfile,
    updatePreferences,
    updateNotifications,
  } = useSettings(userId);

  const [activeTab, setActiveTab] = useState('profile');

  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Global error alert */}
        {error && !isLoading && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error
                ? error.message
                : 'Failed to load settings. Please try again.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Global loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Settings tabs */}
        {!isLoading && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                <span>Preferences</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </TabsTrigger>
            </TabsList>

            {/* Profile tab */}
            <TabsContent value="profile">
              <ProfileSettings
                initialProfile={settings?.profile}
                onSave={updateProfile}
                isLoading={isLoading}
                isSaving={isUpdating}
                error={error instanceof Error ? error : null}
                autoSave={false}
              />
            </TabsContent>

            {/* Preferences tab */}
            <TabsContent value="preferences">
              <PreferencesSettings
                initialPreferences={settings?.preferences}
                onSave={updatePreferences}
                isLoading={isLoading}
                isSaving={isUpdating}
                error={error instanceof Error ? error : null}
                autoSave={false}
              />
            </TabsContent>

            {/* Notifications tab */}
            <TabsContent value="notifications">
              <NotificationSettings
                initialNotifications={settings?.notifications}
                onSave={updateNotifications}
                isLoading={isLoading}
                isSaving={isUpdating}
                error={error instanceof Error ? error : null}
                autoSave={false}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}