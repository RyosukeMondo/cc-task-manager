/**
 * SkipNav Accessibility Component
 *
 * Provides accessible skip navigation functionality following WCAG 2.1 AA guidelines.
 * This component allows keyboard users to quickly skip over navigation elements
 * to reach main content areas, improving accessibility and user experience.
 */

import React, { forwardRef } from 'react';

export interface SkipNavProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Target element ID to skip to (usually main content) */
  href: string;
  /** Optional custom className */
  className?: string;
  /** Content to display in the skip link */
  children?: React.ReactNode;
}

/**
 * SkipNav component for WCAG 2.1 AA accessibility compliance
 *
 * Features:
 * - Visually hidden until focused (keyboard accessible)
 * - Provides quick navigation to main content areas
 * - Follows WCAG accessibility guidelines
 * - Proper focus management and tab order
 * - High contrast and readable when focused
 * - Semantic HTML structure
 *
 * @example
 * ```tsx
 * // Basic usage - skip to main content
 * <SkipNav href="#main-content">Skip to main content</SkipNav>
 *
 * // Multiple skip links for comprehensive navigation
 * <>
 *   <SkipNav href="#main-content">Skip to main content</SkipNav>
 *   <SkipNav href="#navigation">Skip to navigation</SkipNav>
 *   <SkipNav href="#search">Skip to search</SkipNav>
 *   <SkipNav href="#footer">Skip to footer</SkipNav>
 * </>
 * ```
 */
export const SkipNav = forwardRef<HTMLAnchorElement, SkipNavProps>(
  ({
    href,
    className = '',
    children = 'Skip to main content',
    ...props
  }, ref) => {
    const baseClasses = [
      // Visually hidden until focused (screen reader accessible)
      'absolute',
      'left-[-10000px]',
      'top-auto',
      'w-[1px]',
      'h-[1px]',
      'overflow-hidden',

      // Focus styles - becomes visible when focused
      'focus:left-[6px]',
      'focus:top-[6px]',
      'focus:w-auto',
      'focus:h-auto',
      'focus:overflow-visible',

      // High contrast visual styling for focus state
      'focus:z-[9999]',
      'focus:bg-blue-600',
      'focus:text-white',
      'focus:px-4',
      'focus:py-2',
      'focus:rounded-md',
      'focus:text-sm',
      'focus:font-semibold',
      'focus:shadow-lg',

      // Accessibility and focus indicators
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-blue-400',
      'focus:ring-offset-2',
      'focus:ring-offset-white',

      // Smooth transitions
      'transition-all',
      'duration-200',
      'ease-in-out',

      // Remove default link styling
      'no-underline',
      'hover:no-underline',
      'focus:no-underline',

      // Ensure proper cursor
      'cursor-pointer'
    ].join(' ');

    return (
      <a
        ref={ref}
        href={href}
        className={`${baseClasses} ${className}`.trim()}
        // Ensure it's the first focusable element
        tabIndex={0}
        // Additional accessibility attributes
        aria-label={`Skip navigation link: ${children}`}
        {...props}
      >
        {children}
      </a>
    );
  }
);

SkipNav.displayName = 'SkipNav';

/**
 * SkipNavContainer component for organizing multiple skip links
 *
 * Provides a container that holds multiple skip navigation links,
 * useful for comprehensive navigation accessibility.
 *
 * @example
 * ```tsx
 * <SkipNavContainer>
 *   <SkipNav href="#main-content">Skip to main content</SkipNav>
 *   <SkipNav href="#sidebar">Skip to sidebar</SkipNav>
 *   <SkipNav href="#footer">Skip to footer</SkipNav>
 * </SkipNavContainer>
 * ```
 */
export interface SkipNavContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const SkipNavContainer: React.FC<SkipNavContainerProps> = ({
  children,
  className = ''
}) => {
  const containerClasses = [
    // Screen reader only until focused
    'sr-only',
    'focus-within:not-sr-only',

    // Positioning when visible
    'focus-within:absolute',
    'focus-within:top-0',
    'focus-within:left-0',
    'focus-within:z-[10000]',

    // Layout for multiple skip links
    'focus-within:flex',
    'focus-within:flex-col',
    'focus-within:gap-1',
    'focus-within:p-2',

    // Background for visibility
    'focus-within:bg-white',
    'focus-within:shadow-lg',
    'focus-within:rounded-md'
  ].join(' ');

  return (
    <nav
      className={`${containerClasses} ${className}`.trim()}
      role="navigation"
      aria-label="Skip navigation links"
    >
      {children}
    </nav>
  );
};

/**
 * Pre-configured skip navigation patterns for common use cases
 */
export const SkipNavPatterns = {
  /**
   * Standard skip to main content
   */
  ToMain: () => (
    <SkipNav href="#main-content">
      Skip to main content
    </SkipNav>
  ),

  /**
   * Skip to primary navigation menu
   */
  ToNavigation: () => (
    <SkipNav href="#navigation">
      Skip to navigation
    </SkipNav>
  ),

  /**
   * Skip to search functionality
   */
  ToSearch: () => (
    <SkipNav href="#search">
      Skip to search
    </SkipNav>
  ),

  /**
   * Skip to page footer
   */
  ToFooter: () => (
    <SkipNav href="#footer">
      Skip to footer
    </SkipNav>
  ),

  /**
   * Skip to sidebar content
   */
  ToSidebar: () => (
    <SkipNav href="#sidebar">
      Skip to sidebar
    </SkipNav>
  ),

  /**
   * Complete skip navigation set for comprehensive accessibility
   */
  Complete: () => (
    <SkipNavContainer>
      <SkipNav href="#main-content">Skip to main content</SkipNav>
      <SkipNav href="#navigation">Skip to navigation</SkipNav>
      <SkipNav href="#search">Skip to search</SkipNav>
      <SkipNav href="#sidebar">Skip to sidebar</SkipNav>
      <SkipNav href="#footer">Skip to footer</SkipNav>
    </SkipNavContainer>
  ),

  /**
   * Dashboard-specific skip navigation
   */
  Dashboard: () => (
    <SkipNavContainer>
      <SkipNav href="#main-content">Skip to dashboard content</SkipNav>
      <SkipNav href="#dashboard-nav">Skip to dashboard navigation</SkipNav>
      <SkipNav href="#task-list">Skip to task list</SkipNav>
      <SkipNav href="#filters">Skip to filters</SkipNav>
    </SkipNavContainer>
  )
} as const;

/**
 * React hook for managing skip navigation targets
 *
 * Ensures that skip navigation targets are properly configured with
 * appropriate accessibility attributes.
 *
 * @param id - The ID to assign to the target element
 * @returns React ref to attach to the target element
 *
 * @example
 * ```tsx
 * function MainContent() {
 *   const mainRef = useSkipNavTarget('main-content');
 *
 *   return (
 *     <main ref={mainRef}>
 *       <h1>Main Content</h1>
 *       // content here
 *     </main>
 *   );
 * }
 * ```
 */
export function useSkipNavTarget(id: string) {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Set ID for skip navigation targeting
    element.id = id;

    // Ensure element can receive programmatic focus
    if (!element.hasAttribute('tabindex')) {
      element.tabIndex = -1;
    }

    // Add accessible description if not already present
    if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
      const readableLabel = id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      element.setAttribute('aria-label', `${readableLabel} section`);
    }

    // Mark as a landmark if it's a main content area
    if (id.includes('main') && element.tagName.toLowerCase() !== 'main') {
      element.setAttribute('role', 'main');
    }
  }, [id]);

  return ref;
}

export default SkipNav;