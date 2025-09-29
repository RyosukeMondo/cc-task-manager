/**
 * SkipNav Component
 *
 * Provides accessible skip navigation functionality following WCAG 2.1 AA guidelines.
 * Allows keyboard users to quickly skip over navigation elements to reach main content.
 */

import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface SkipNavProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Target element ID to skip to (usually main content) */
  href: string;
  /** Optional custom className */
  className?: string;
  /** Content to display in the skip link */
  children?: React.ReactNode;
}

/**
 * SkipNav component for accessibility
 *
 * This component creates a skip navigation link that:
 * - Is visually hidden until focused (keyboard accessible)
 * - Provides a quick way to skip navigation elements
 * - Follows WCAG accessibility guidelines
 * - Has proper focus management
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SkipNav href="#main-content">Skip to main content</SkipNav>
 *
 * // Multiple skip links
 * <>
 *   <SkipNav href="#main-content">Skip to main content</SkipNav>
 *   <SkipNav href="#navigation">Skip to navigation</SkipNav>
 *   <SkipNav href="#footer">Skip to footer</SkipNav>
 * </>
 * ```
 */
export const SkipNav = forwardRef<HTMLAnchorElement, SkipNavProps>(
  ({
    href,
    className,
    children = 'Skip to main content',
    ...props
  }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        className={cn(
          // Base styles - visually hidden until focused
          'absolute left-[-9999px] top-auto w-[1px] h-[1px] overflow-hidden',
          // Focus styles - becomes visible and accessible when focused
          'focus:left-[6px] focus:top-[6px] focus:w-auto focus:h-auto focus:overflow-visible',
          // Visual styling when focused
          'focus:z-[9999] focus:bg-primary focus:text-primary-foreground',
          'focus:px-3 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium',
          'focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          // Transition for smooth appearance
          'transition-all duration-150 ease-in-out',
          // Ensure proper text decoration
          'no-underline hover:no-underline focus:no-underline',
          className
        )}
        // Ensure proper tab order (should be first focusable element)
        tabIndex={0}
        {...props}
      >
        {children}
      </a>
    );
  }
);

SkipNav.displayName = 'SkipNav';

/**
 * SkipNavContainer component
 *
 * A container component that can hold multiple skip navigation links.
 * Useful when you have multiple skip targets on a page.
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
  className
}) => {
  return (
    <div
      className={cn(
        'sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-0 focus-within:left-0 focus-within:z-[9999]',
        'focus-within:flex focus-within:gap-2 focus-within:p-2',
        className
      )}
      role="navigation"
      aria-label="Skip navigation"
    >
      {children}
    </div>
  );
};

/**
 * Common skip navigation patterns
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
   * Skip to navigation menu
   */
  ToNavigation: () => (
    <SkipNav href="#navigation">
      Skip to navigation
    </SkipNav>
  ),

  /**
   * Skip to search
   */
  ToSearch: () => (
    <SkipNav href="#search">
      Skip to search
    </SkipNav>
  ),

  /**
   * Skip to footer
   */
  ToFooter: () => (
    <SkipNav href="#footer">
      Skip to footer
    </SkipNav>
  ),

  /**
   * Complete skip navigation set for typical application
   */
  Complete: () => (
    <SkipNavContainer>
      <SkipNav href="#main-content">Skip to main content</SkipNav>
      <SkipNav href="#navigation">Skip to navigation</SkipNav>
      <SkipNav href="#search">Skip to search</SkipNav>
      <SkipNav href="#footer">Skip to footer</SkipNav>
    </SkipNavContainer>
  ),
} as const;

/**
 * Hook for managing skip navigation targets
 *
 * Ensures that skip navigation targets are properly set up with
 * appropriate attributes for accessibility.
 *
 * @example
 * ```tsx
 * function MainContent() {
 *   const mainRef = useSkipNavTarget('main-content');
 *
 *   return (
 *     <main ref={mainRef}>
 *       Main content here
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

    // Set ID for skip navigation
    element.id = id;

    // Ensure element can receive focus
    if (!element.hasAttribute('tabindex')) {
      element.tabIndex = -1;
    }

    // Add accessible label if not present
    if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
      element.setAttribute('aria-label', `${id.replace('-', ' ')} section`);
    }

    return () => {
      // Cleanup is generally not needed for these attributes
      // as they should persist for the lifetime of the component
    };
  }, [id]);

  return ref;
}

export default SkipNav;