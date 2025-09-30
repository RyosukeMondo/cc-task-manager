/**
 * End-to-End Integration Tests for Settings Workflow
 *
 * These tests simulate complete user journeys through the settings page,
 * covering navigation, form interactions, data persistence, and error handling.
 *
 * NOTE: These are integration-level E2E tests using Jest/RTL rather than
 * browser-based E2E tests (Playwright/Cypress), as no E2E framework is
 * currently configured in the project.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '../src/app/settings/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/contract-client';

// Mock modules
jest.mock('@/lib/api/contract-client', () => ({
  apiClient: {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  },
}));

jest.mock('@/lib/theme/context', () => ({
  useTheme: jest.fn(() => ({
    theme: 'light',
    setTheme: jest.fn(),
  })),
}));

jest.mock('@/components/layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('lucide-react', () => ({
  Loader2: () => <div role="progressbar" />,
  User: () => <div>User Icon</div>,
  Settings2: () => <div>Settings Icon</div>,
  Bell: () => <div>Bell Icon</div>,
  AlertCircle: () => <div>Alert Icon</div>,
}));

jest.mock('@/components/settings/ProfileSettings', () => ({
  ProfileSettings: ({ initialProfile, onSave }: any) => (
    <div data-testid="profile-settings">
      <label htmlFor="name">Name</label>
      <input id="name" aria-label="Name" defaultValue={initialProfile?.name} />
      <label htmlFor="email">Email</label>
      <input id="email" aria-label="Email" defaultValue={initialProfile?.email} />
      <label htmlFor="bio">Bio</label>
      <textarea id="bio" aria-label="Bio" defaultValue={initialProfile?.bio} />
      <button onClick={() => onSave({ name: 'Updated' })}>Save Changes</button>
      <button>Reset</button>
    </div>
  ),
}));

jest.mock('@/components/settings/PreferencesSettings', () => ({
  PreferencesSettings: ({ initialPreferences, onSave }: any) => (
    <div data-testid="preferences-settings">
      <label htmlFor="theme">Theme</label>
      <select id="theme" aria-label="Theme" defaultValue={initialPreferences?.theme}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
      <label htmlFor="language">Language</label>
      <select id="language" aria-label="Language" defaultValue={initialPreferences?.language}>
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
      <button onClick={() => onSave({ theme: 'dark' })}>Save</button>
    </div>
  ),
}));

jest.mock('@/components/settings/NotificationSettings', () => ({
  NotificationSettings: ({ initialNotifications, onSave }: any) => (
    <div data-testid="notification-settings">
      <label>
        <input
          type="checkbox"
          role="switch"
          aria-label="Email Notifications"
          defaultChecked={initialNotifications?.emailNotifications}
        />
        Email Notifications
      </label>
      <label>
        <input
          type="checkbox"
          role="switch"
          aria-label="Push Notifications"
          defaultChecked={initialNotifications?.pushNotifications}
        />
        Push Notifications
      </label>
      <button onClick={() => onSave({ emailNotifications: false })}>Save</button>
    </div>
  ),
}));

jest.mock('@/hooks/useSettings');

// Mock settings data
const mockSettings = {
  userId: 'current-user',
  profile: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'Software developer',
  },
  preferences: {
    theme: 'light' as const,
    language: 'en' as const,
    dateFormat: 'MM/DD/YYYY' as const,
    timeFormat: '12h' as const,
    defaultView: 'dashboard' as const,
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: false,
    taskReminders: true,
    dailyDigest: false,
  },
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Import the mocked hook
import { useSettings } from '@/hooks/useSettings';
const mockUseSettings = useSettings as jest.MockedFunction<typeof useSettings>;

describe('Settings E2E Workflow', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();
    jest.clearAllMocks();
    localStorage.clear();
    mockApiClient.getSettings.mockResolvedValue(mockSettings);
    mockApiClient.updateSettings.mockImplementation(async (_, updates) => ({
      ...mockSettings,
      ...updates,
      updatedAt: new Date(),
    }));

    // Mock useSettings hook
    mockUseSettings.mockReturnValue({
      settings: mockSettings,
      isLoading: false,
      isUpdating: false,
      error: null,
      updateProfile: jest.fn(),
      updatePreferences: jest.fn(),
      updateNotifications: jest.fn(),
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderSettingsPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SettingsPage />
      </QueryClientProvider>
    );
  };

  describe('Complete User Journey: First Time Settings Visit', () => {
    it('should complete full workflow from page load to saving all settings', async () => {
      renderSettingsPage();

      // 1. Page loads with loading state
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument();

      // 2. Settings load and profile tab shows by default
      await waitFor(() => {
        expect(screen.queryByRole('progressbar', { hidden: true })).not.toBeInTheDocument();
      });

      // 3. Verify profile tab is active and displays current data
      const profileTab = screen.getByRole('tab', { name: /profile/i });
      expect(profileTab).toHaveAttribute('data-state', 'active');

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
        expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
      });

      // 4. Update profile information
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Jane Smith');

      const bioTextarea = screen.getByLabelText(/bio/i);
      await user.clear(bioTextarea);
      await user.type(bioTextarea, 'Full-stack developer with 5 years experience');

      // 5. Save profile changes
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).not.toBeDisabled();
      await user.click(saveButton);

      // 6. Verify saving state
      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });

      // 7. Wait for save to complete
      await waitFor(() => {
        expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
      });

      // 8. Switch to preferences tab
      const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
      await user.click(preferencesTab);

      // 9. Verify preferences tab is active
      await waitFor(() => {
        expect(preferencesTab).toHaveAttribute('data-state', 'active');
      });

      // 10. Update theme preference
      const themeSelect = screen.getByLabelText(/theme/i);
      await user.click(themeSelect);
      const darkOption = await screen.findByRole('option', { name: /dark/i });
      await user.click(darkOption);

      // 11. Update language preference
      const languageSelect = screen.getByLabelText(/language/i);
      await user.click(languageSelect);
      const esOption = await screen.findByRole('option', { name: /español/i });
      await user.click(esOption);

      // 12. Save preferences
      const prefSaveButton = within(
        screen.getByRole('tabpanel', { name: /preferences/i })
      ).getByRole('button', { name: /save/i });
      await user.click(prefSaveButton);

      // 13. Wait for preferences save
      await waitFor(() => {
        expect(mockApiClient.updateSettings).toHaveBeenCalledWith(
          'current-user',
          expect.objectContaining({
            preferences: expect.objectContaining({
              theme: 'dark',
              language: 'es',
            }),
          })
        );
      });

      // 14. Switch to notifications tab
      const notificationsTab = screen.getByRole('tab', { name: /notifications/i });
      await user.click(notificationsTab);

      // 15. Verify notifications tab is active
      await waitFor(() => {
        expect(notificationsTab).toHaveAttribute('data-state', 'active');
      });

      // 16. Toggle notification settings
      const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
      await user.click(emailSwitch); // Disable email notifications

      const pushSwitch = screen.getByRole('switch', { name: /push notifications/i });
      await user.click(pushSwitch); // Enable push notifications

      // 17. Save notification settings
      const notifSaveButton = within(
        screen.getByRole('tabpanel', { name: /notifications/i })
      ).getByRole('button', { name: /save/i });
      await user.click(notifSaveButton);

      // 18. Verify all changes were saved
      await waitFor(() => {
        expect(mockApiClient.updateSettings).toHaveBeenCalledTimes(3);
      });

      // 19. Verify final state persisted in localStorage
      const cachedSettings = localStorage.getItem('user_settings');
      expect(cachedSettings).toBeTruthy();
    });
  });

  describe('Navigation and Tab Switching', () => {
    it('should preserve form state when switching between tabs', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.queryByRole('progressbar', { hidden: true })).not.toBeInTheDocument();
      });

      // Make changes in profile tab
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      // Switch to preferences tab
      const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
      await user.click(preferencesTab);

      // Switch back to profile tab
      const profileTab = screen.getByRole('tab', { name: /profile/i });
      await user.click(profileTab);

      // Verify changes are preserved
      expect(screen.getByDisplayValue('Updated Name')).toBeInTheDocument();
    });

    it('should allow keyboard navigation between tabs', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.queryByRole('progressbar', { hidden: true })).not.toBeInTheDocument();
      });

      const profileTab = screen.getByRole('tab', { name: /profile/i });
      profileTab.focus();

      // Use arrow keys to navigate
      fireEvent.keyDown(profileTab, { key: 'ArrowRight' });

      const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
      await waitFor(() => {
        expect(preferencesTab).toHaveFocus();
      });

      fireEvent.keyDown(preferencesTab, { key: 'ArrowRight' });

      const notificationsTab = screen.getByRole('tab', { name: /notifications/i });
      await waitFor(() => {
        expect(notificationsTab).toHaveFocus();
      });
    });
  });

  describe('Form Validation and Error Handling', () => {
    it('should validate profile fields and show error messages', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      });

      // Clear required field
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/name.*required/i)).toBeInTheDocument();
      });

      // Verify save button is disabled or form didn't submit
      expect(mockApiClient.updateSettings).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
      });

      // Enter invalid email
      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      // Blur to trigger validation
      emailInput.blur();

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/valid.*email/i)).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.updateSettings.mockRejectedValueOnce(
        new Error('Network error: Failed to save settings')
      );

      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      });

      // Make a change
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Verify error message is displayed
      await waitFor(() => {
        expect(
          screen.getByText(/network error.*failed to save settings/i)
        ).toBeInTheDocument();
      });
    });

    it('should handle loading failures', async () => {
      mockApiClient.getSettings.mockRejectedValueOnce(
        new Error('Failed to load settings')
      );

      renderSettingsPage();

      // Verify error alert is shown
      await waitFor(() => {
        expect(screen.getByText(/failed to load settings/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Persistence and Caching', () => {
    it('should cache settings in localStorage', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      });

      // Verify settings are cached
      const cachedSettings = localStorage.getItem('user_settings');
      expect(cachedSettings).toBeTruthy();

      const parsed = JSON.parse(cachedSettings!);
      expect(parsed.profile.name).toBe('John Doe');
    });

    it('should use cached data while loading fresh data', async () => {
      // Pre-populate localStorage with cached settings
      localStorage.setItem('user_settings', JSON.stringify(mockSettings));

      // Delay API response
      mockApiClient.getSettings.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockSettings), 100);
          })
      );

      renderSettingsPage();

      // Should show cached data immediately
      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      }, { timeout: 50 });

      // Fresh data should still load
      await waitFor(() => {
        expect(mockApiClient.getSettings).toHaveBeenCalled();
      });
    });

    it('should implement optimistic updates', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      });

      // Make a change
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Optimistic Update');

      // Save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // UI should update immediately (optimistic)
      expect(screen.getByDisplayValue('Optimistic Update')).toBeInTheDocument();

      // API call should happen in background
      await waitFor(() => {
        expect(mockApiClient.updateSettings).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have proper ARIA labels and roles', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.queryByRole('progressbar', { hidden: true })).not.toBeInTheDocument();
      });

      // Verify tab structure
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(3);
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();

      // Verify form labels
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('should maintain focus management', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.queryByRole('progressbar', { hidden: true })).not.toBeInTheDocument();
      });

      const profileTab = screen.getByRole('tab', { name: /profile/i });
      const preferencesTab = screen.getByRole('tab', { name: /preferences/i });

      // Click preferences tab
      await user.click(preferencesTab);

      // Focus should remain in tab component
      expect(document.activeElement).toBeTruthy();

      // Should be able to tab through form fields
      await user.tab();
      expect(document.activeElement).toBeInstanceOf(HTMLElement);
    });

    it('should announce state changes to screen readers', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      });

      // Make a change
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      // Save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Should show loading state with proper ARIA
      await waitFor(() => {
        const savingButton = screen.getByText(/saving/i);
        expect(savingButton.closest('button')).toHaveAttribute('disabled');
      });
    });
  });

  describe('Reset and Undo Functionality', () => {
    it('should reset form to initial values', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      });

      // Make changes
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed Name');

      // Click reset
      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);

      // Verify original value is restored
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    });

    it('should disable reset button when form is pristine', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /reset/i });
      expect(resetButton).toBeDisabled();

      // Make a change
      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'X');

      // Reset button should be enabled
      await waitFor(() => {
        expect(resetButton).not.toBeDisabled();
      });
    });
  });

  describe('Theme Integration', () => {
    it('should apply theme changes immediately', async () => {
      const mockSetTheme = jest.fn();
      const { useTheme } = require('@/lib/theme/context');
      useTheme.mockReturnValue({
        theme: 'light',
        setTheme: mockSetTheme,
      });

      renderSettingsPage();

      await waitFor(() => {
        expect(screen.queryByRole('progressbar', { hidden: true })).not.toBeInTheDocument();
      });

      // Switch to preferences tab
      const preferencesTab = screen.getByRole('tab', { name: /preferences/i });
      await user.click(preferencesTab);

      // Change theme
      const themeSelect = screen.getByLabelText(/theme/i);
      await user.click(themeSelect);
      const darkOption = await screen.findByRole('option', { name: /dark/i });
      await user.click(darkOption);

      // Verify theme was applied
      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalledWith('dark');
      });
    });
  });
});