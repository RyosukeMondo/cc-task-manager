/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '../page';
import { useSettings } from '@/hooks/useSettings';
import type { Settings } from '@cc-task-manager/schemas';

// Mock the hooks and components
jest.mock('@/hooks/useSettings');
jest.mock('@/components/layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
jest.mock('@/components/settings/ProfileSettings', () => ({
  ProfileSettings: ({ initialProfile, onSave, isLoading, isSaving, error, autoSave }: any) => (
    <div data-testid="profile-settings">
      <div data-testid="profile-loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="profile-saving">{isSaving ? 'saving' : 'idle'}</div>
      <div data-testid="profile-error">{error?.message}</div>
      <div data-testid="profile-auto-save">{autoSave ? 'enabled' : 'disabled'}</div>
      <button onClick={() => onSave({ name: 'Test User' })}>Save Profile</button>
    </div>
  ),
}));
jest.mock('@/components/settings/PreferencesSettings', () => ({
  PreferencesSettings: ({ initialPreferences, onSave, isLoading, isSaving, error, autoSave }: any) => (
    <div data-testid="preferences-settings">
      <div data-testid="preferences-loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="preferences-saving">{isSaving ? 'saving' : 'idle'}</div>
      <div data-testid="preferences-error">{error?.message}</div>
      <div data-testid="preferences-auto-save">{autoSave ? 'enabled' : 'disabled'}</div>
      <button onClick={() => onSave({ theme: 'dark' })}>Save Preferences</button>
    </div>
  ),
}));
jest.mock('@/components/settings/NotificationSettings', () => ({
  NotificationSettings: ({ initialNotifications, onSave, isLoading, isSaving, error, autoSave }: any) => (
    <div data-testid="notification-settings">
      <div data-testid="notification-loading">{isLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="notification-saving">{isSaving ? 'saving' : 'idle'}</div>
      <div data-testid="notification-error">{error?.message}</div>
      <div data-testid="notification-auto-save">{autoSave ? 'enabled' : 'disabled'}</div>
      <button onClick={() => onSave({ emailNotifications: true })}>Save Notifications</button>
    </div>
  ),
}));
jest.mock('@/lib/theme/context', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
}));

const mockUseSettings = useSettings as jest.MockedFunction<typeof useSettings>;

describe('SettingsPage', () => {
  const mockSettings: Settings = {
    userId: 'current-user',
    profile: {
      name: 'John Doe',
      email: 'john@example.com',
      avatar: 'https://example.com/avatar.jpg',
      bio: 'Test bio',
    },
    preferences: {
      theme: 'light',
      language: 'en',
      dateFormat: 'yyyy-MM-dd',
      timeFormat: '24h',
      defaultView: 'dashboard',
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: false,
      taskReminders: true,
      dailyDigest: false,
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  const defaultMockReturn = {
    settings: mockSettings,
    isLoading: false,
    isUpdating: false,
    error: null,
    updateProfile: jest.fn(),
    updatePreferences: jest.fn(),
    updateNotifications: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSettings.mockReturnValue(defaultMockReturn);
  });

  it('should render settings page with header', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage your account settings and preferences')).toBeInTheDocument();
  });

  it('should render within AppLayout', () => {
    render(<SettingsPage />);

    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('should display loading state when settings are loading', () => {
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      isLoading: true,
    });

    render(<SettingsPage />);

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('should display error alert when there is an error', () => {
    const error = new Error('Failed to load settings');
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      error,
      isLoading: false,
    });

    render(<SettingsPage />);

    expect(screen.getByText('Failed to load settings')).toBeInTheDocument();
  });

  it('should display generic error message for non-Error objects', () => {
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      error: 'string error' as any,
      isLoading: false,
    });

    render(<SettingsPage />);

    expect(screen.getByText('Failed to load settings. Please try again.')).toBeInTheDocument();
  });

  it('should render tabs when settings are loaded', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('tab', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /preferences/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument();
  });

  it('should display profile tab by default', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('profile-settings')).toBeVisible();
  });

  it('should switch to preferences tab when clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
    await user.click(preferencesTab);

    await waitFor(() => {
      expect(preferencesTab).toHaveAttribute('data-state', 'active');
      expect(screen.getByTestId('preferences-settings')).toBeVisible();
    });
  });

  it('should switch to notifications tab when clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const notificationsTab = screen.getByRole('tab', { name: /notifications/i });
    await user.click(notificationsTab);

    await waitFor(() => {
      expect(notificationsTab).toHaveAttribute('data-state', 'active');
      expect(screen.getByTestId('notification-settings')).toBeVisible();
    });
  });

  it('should pass correct props to ProfileSettings component', () => {
    render(<SettingsPage />);

    expect(screen.getByTestId('profile-settings')).toBeInTheDocument();
    expect(screen.getByTestId('profile-loading')).toHaveTextContent('loaded');
    expect(screen.getByTestId('profile-saving')).toHaveTextContent('idle');
    expect(screen.getByTestId('profile-auto-save')).toHaveTextContent('disabled');
  });

  it('should pass correct props to PreferencesSettings component', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
    await user.click(preferencesTab);

    await waitFor(() => {
      expect(screen.getByTestId('preferences-settings')).toBeInTheDocument();
      expect(screen.getByTestId('preferences-loading')).toHaveTextContent('loaded');
      expect(screen.getByTestId('preferences-saving')).toHaveTextContent('idle');
      expect(screen.getByTestId('preferences-auto-save')).toHaveTextContent('disabled');
    });
  });

  it('should pass correct props to NotificationSettings component', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const notificationsTab = screen.getByRole('tab', { name: /notifications/i });
    await user.click(notificationsTab);

    await waitFor(() => {
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
      expect(screen.getByTestId('notification-loading')).toHaveTextContent('loaded');
      expect(screen.getByTestId('notification-saving')).toHaveTextContent('idle');
      expect(screen.getByTestId('notification-auto-save')).toHaveTextContent('disabled');
    });
  });

  it('should call updateProfile when profile is saved', async () => {
    const user = userEvent.setup();
    const updateProfile = jest.fn();
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      updateProfile,
    });

    render(<SettingsPage />);

    const saveButton = screen.getByText('Save Profile');
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({ name: 'Test User' });
    });
  });

  it('should call updatePreferences when preferences are saved', async () => {
    const user = userEvent.setup();
    const updatePreferences = jest.fn();
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      updatePreferences,
    });

    render(<SettingsPage />);

    const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
    await user.click(preferencesTab);

    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeVisible();
    });

    const saveButton = screen.getByText('Save Preferences');
    await user.click(saveButton);

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
    });
  });

  it('should call updateNotifications when notifications are saved', async () => {
    const user = userEvent.setup();
    const updateNotifications = jest.fn();
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      updateNotifications,
    });

    render(<SettingsPage />);

    const notificationsTab = screen.getByRole('tab', { name: /notifications/i });
    await user.click(notificationsTab);

    await waitFor(() => {
      expect(screen.getByText('Save Notifications')).toBeVisible();
    });

    const saveButton = screen.getByText('Save Notifications');
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateNotifications).toHaveBeenCalledWith({ emailNotifications: true });
    });
  });

  it('should pass isUpdating state to all setting components', () => {
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      isUpdating: true,
    });

    render(<SettingsPage />);

    expect(screen.getByTestId('profile-saving')).toHaveTextContent('saving');
  });

  it('should pass error state to all setting components', async () => {
    const user = userEvent.setup();
    const error = new Error('Update failed');
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      error,
    });

    render(<SettingsPage />);

    expect(screen.getByTestId('profile-error')).toHaveTextContent('Update failed');

    // Switch to preferences tab
    await user.click(screen.getByRole('tab', { name: /preferences/i }));
    await waitFor(() => {
      expect(screen.getByTestId('preferences-error')).toHaveTextContent('Update failed');
    });

    // Switch to notifications tab
    await user.click(screen.getByRole('tab', { name: /notifications/i }));
    await waitFor(() => {
      expect(screen.getByTestId('notification-error')).toHaveTextContent('Update failed');
    });
  });

  it('should support keyboard navigation through tabs', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const profileTab = screen.getByRole('tab', { name: /profile/i });
    const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
    const notificationsTab = screen.getByRole('tab', { name: /notifications/i });

    profileTab.focus();
    expect(profileTab).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(preferencesTab).toHaveFocus();
    });

    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(notificationsTab).toHaveFocus();
    });

    await user.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(preferencesTab).toHaveFocus();
    });
  });

  it('should maintain tab state across re-renders', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SettingsPage />);

    // Switch to preferences tab
    await user.click(screen.getByRole('tab', { name: /preferences/i }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /preferences/i })).toHaveAttribute('data-state', 'active');
    });

    // Re-render with updated settings
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      isUpdating: true,
    });
    rerender(<SettingsPage />);

    // Should still be on preferences tab
    expect(screen.getByRole('tab', { name: /preferences/i })).toHaveAttribute('data-state', 'active');
  });

  it('should not display tabs during loading', () => {
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      isLoading: true,
    });

    render(<SettingsPage />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('should hide error alert during loading', () => {
    mockUseSettings.mockReturnValue({
      ...defaultMockReturn,
      error: new Error('Test error'),
      isLoading: true,
    });

    render(<SettingsPage />);

    expect(screen.queryByText('Test error')).not.toBeInTheDocument();
  });

  it('should render all tab icons', () => {
    render(<SettingsPage />);

    const profileTab = screen.getByRole('tab', { name: /profile/i });
    const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
    const notificationsTab = screen.getByRole('tab', { name: /notifications/i });

    expect(profileTab.querySelector('svg')).toBeInTheDocument();
    expect(preferencesTab.querySelector('svg')).toBeInTheDocument();
    expect(notificationsTab.querySelector('svg')).toBeInTheDocument();
  });

  it('should have proper ARIA labels for accessibility', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3);
  });
});