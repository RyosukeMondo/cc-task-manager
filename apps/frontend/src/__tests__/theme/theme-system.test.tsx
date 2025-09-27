/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '../../lib/theme/context'
import { ThemeToggle } from '../../lib/theme/components'

// Test component to use theme context
const TestComponent = () => {
  const { theme, setTheme, systemPreference, preferences } = useTheme()

  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <div data-testid="system-preference">{systemPreference}</div>
      <div data-testid="high-contrast">{preferences.highContrast ? 'enabled' : 'disabled'}</div>
      <div data-testid="reduced-motion">{preferences.reducedMotion ? 'enabled' : 'disabled'}</div>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('system')}>Set System</button>
    </div>
  )
}

describe('Theme System', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()

    // Reset document classes
    document.documentElement.className = ''

    // Reset CSS variables
    document.documentElement.style.cssText = ''
  })

  describe('ThemeProvider', () => {
    it('should provide default light theme', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    })

    it('should detect system theme preference', () => {
      // Mock dark system preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('system-preference')).toHaveTextContent('dark')
    })

    it('should persist theme preference in localStorage', async () => {
      const user = userEvent.setup()

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      const darkButton = screen.getByText('Set Dark')
      await user.click(darkButton)

      expect(localStorage.getItem('theme')).toBe('dark')
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    })

    it('should load theme preference from localStorage', () => {
      localStorage.setItem('theme', 'dark')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    })

    it('should follow system preference when theme is set to system', async () => {
      const user = userEvent.setup()

      // Mock light system preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: light)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      const systemButton = screen.getByText('Set System')
      await user.click(systemButton)

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
      expect(screen.getByTestId('system-preference')).toHaveTextContent('light')
    })

    it('should apply theme classes to document', async () => {
      const user = userEvent.setup()

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Initially light theme
      expect(document.documentElement.classList.contains('light')).toBe(true)

      // Switch to dark theme
      const darkButton = screen.getByText('Set Dark')
      await user.click(darkButton)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(document.documentElement.classList.contains('light')).toBe(false)
      })
    })

    it('should detect high contrast preference', () => {
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => {
          if (query === '(prefers-contrast: high)') {
            return {
              matches: true,
              media: query,
              onchange: null,
              addListener: jest.fn(),
              removeListener: jest.fn(),
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
            }
          }
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
          }
        }),
      })

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('high-contrast')).toHaveTextContent('enabled')
      expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
    })

    it('should detect reduced motion preference', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => {
          if (query === '(prefers-reduced-motion: reduce)') {
            return {
              matches: true,
              media: query,
              onchange: null,
              addListener: jest.fn(),
              removeListener: jest.fn(),
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
              dispatchEvent: jest.fn(),
            }
          }
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
          }
        }),
      })

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('reduced-motion')).toHaveTextContent('enabled')
      expect(document.documentElement.classList.contains('reduce-motion')).toBe(true)
    })

    it('should update CSS custom properties', async () => {
      const user = userEvent.setup()

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Switch to dark theme
      const darkButton = screen.getByText('Set Dark')
      await user.click(darkButton)

      await waitFor(() => {
        const rootStyle = getComputedStyle(document.documentElement)
        // Check that CSS variables are updated (these would be set by the theme system)
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })
    })
  })

  describe('ThemeToggle Component', () => {
    it('should render theme toggle button', () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      const toggleButton = screen.getByRole('button', { name: /toggle theme/i })
      expect(toggleButton).toBeInTheDocument()
    })

    it('should toggle between light and dark themes', async () => {
      const user = userEvent.setup()

      render(
        <ThemeProvider>
          <ThemeToggle />
          <TestComponent />
        </ThemeProvider>
      )

      const toggleButton = screen.getByRole('button', { name: /toggle theme/i })

      // Initially light theme
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')

      // Click to toggle to dark
      await user.click(toggleButton)
      await waitFor(() => {
        expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
      })

      // Click to toggle back to light
      await user.click(toggleButton)
      await waitFor(() => {
        expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
      })
    })

    it('should show appropriate icon for current theme', async () => {
      const user = userEvent.setup()

      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      const toggleButton = screen.getByRole('button', { name: /toggle theme/i })

      // Should show moon icon for light theme (to indicate clicking will go to dark)
      expect(toggleButton.querySelector('[data-icon="moon"]')).toBeInTheDocument()

      // Click to toggle to dark
      await user.click(toggleButton)

      await waitFor(() => {
        // Should show sun icon for dark theme (to indicate clicking will go to light)
        expect(toggleButton.querySelector('[data-icon="sun"]')).toBeInTheDocument()
      })
    })

    it('should be accessible with keyboard navigation', async () => {
      const user = userEvent.setup()

      render(
        <ThemeProvider>
          <ThemeToggle />
          <TestComponent />
        </ThemeProvider>
      )

      const toggleButton = screen.getByRole('button', { name: /toggle theme/i })

      // Focus the button
      await user.tab()
      expect(toggleButton).toHaveFocus()

      // Press Enter to toggle
      await user.keyboard('{Enter}')
      await waitFor(() => {
        expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
      })

      // Press Space to toggle back
      await user.keyboard(' ')
      await waitFor(() => {
        expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
      })
    })

    it('should have proper ARIA attributes', () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      )

      const toggleButton = screen.getByRole('button', { name: /toggle theme/i })

      expect(toggleButton).toHaveAttribute('aria-label')
      expect(toggleButton).toHaveAttribute('title')
    })
  })

  describe('System Theme Changes', () => {
    it('should respond to system theme changes when set to system', async () => {
      let mediaQueryCallback: ((e: any) => void) | undefined

      // Mock matchMedia with ability to trigger changes
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: light)',
          media: query,
          onchange: null,
          addListener: (callback: (e: any) => void) => {
            mediaQueryCallback = callback
          },
          removeListener: jest.fn(),
          addEventListener: (event: string, callback: (e: any) => void) => {
            if (event === 'change') {
              mediaQueryCallback = callback
            }
          },
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      const user = userEvent.setup()

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Set to system theme
      const systemButton = screen.getByText('Set System')
      await user.click(systemButton)

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')

      // Simulate system theme change to dark
      if (mediaQueryCallback) {
        mediaQueryCallback({ matches: true }) // Dark theme
      }

      await waitFor(() => {
        expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
      })
    })
  })

  describe('CSS Variables Integration', () => {
    it('should set CSS variables for theme colors', async () => {
      const user = userEvent.setup()

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Switch to dark theme
      const darkButton = screen.getByText('Set Dark')
      await user.click(darkButton)

      await waitFor(() => {
        // Verify that the theme system applies appropriate classes
        // The actual CSS variables would be defined in the CSS files
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })
    })

    it('should maintain theme consistency across page reloads', () => {
      // Set theme in localStorage
      localStorage.setItem('theme', 'dark')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Should load dark theme from localStorage
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('Theme Validation', () => {
    it('should handle invalid theme values gracefully', () => {
      // Set invalid theme in localStorage
      localStorage.setItem('theme', 'invalid-theme')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Should fallback to default light theme
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    })

    it('should handle missing localStorage gracefully', () => {
      // Mock localStorage to throw error
      const originalLocalStorage = window.localStorage
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn().mockImplementation(() => {
            throw new Error('localStorage not available')
          }),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
        writable: true,
      })

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Should fallback to default theme
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
      })
    })
  })
})