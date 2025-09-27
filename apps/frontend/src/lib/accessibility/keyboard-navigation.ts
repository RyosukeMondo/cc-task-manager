/**
 * Keyboard navigation utilities
 * Implements WCAG 2.1 AA keyboard accessibility requirements
 */

import { KeyboardEvent, useCallback, useEffect } from 'react';

/**
 * Common keyboard keys for accessibility
 */
export const Keys = {
  TAB: 'Tab',
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

/**
 * Direction for navigation
 */
export type Direction = 'horizontal' | 'vertical' | 'both';

/**
 * Navigation options
 */
export interface NavigationOptions {
  wrap?: boolean;
  direction?: Direction;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Hook for arrow key navigation in lists/menus
 */
export function useArrowNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options: NavigationOptions = {}
) {
  const { wrap = true, direction = 'vertical' } = options;

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="menuitem"]:not([aria-disabled="true"])',
    ].join(', ');

    return Array.from(containerRef.current.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const currentIndex = elements.findIndex(el => el === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    let handled = false;

    switch (event.key) {
      case Keys.ARROW_DOWN:
        if (direction === 'vertical' || direction === 'both') {
          nextIndex = currentIndex + 1;
          if (nextIndex >= elements.length) {
            nextIndex = wrap ? 0 : elements.length - 1;
          }
          handled = true;
        }
        break;

      case Keys.ARROW_UP:
        if (direction === 'vertical' || direction === 'both') {
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) {
            nextIndex = wrap ? elements.length - 1 : 0;
          }
          handled = true;
        }
        break;

      case Keys.ARROW_RIGHT:
        if (direction === 'horizontal' || direction === 'both') {
          nextIndex = currentIndex + 1;
          if (nextIndex >= elements.length) {
            nextIndex = wrap ? 0 : elements.length - 1;
          }
          handled = true;
        }
        break;

      case Keys.ARROW_LEFT:
        if (direction === 'horizontal' || direction === 'both') {
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) {
            nextIndex = wrap ? elements.length - 1 : 0;
          }
          handled = true;
        }
        break;

      case Keys.HOME:
        nextIndex = 0;
        handled = true;
        break;

      case Keys.END:
        nextIndex = elements.length - 1;
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      elements[nextIndex]?.focus();
    }
  }, [getFocusableElements, direction, wrap]);

  return handleKeyDown;
}

/**
 * Hook for handling escape key to close modals/dropdowns
 */
export function useEscapeKey(onEscape: () => void, isActive: boolean = true) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === Keys.ESCAPE) {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown as any);
    return () => document.removeEventListener('keydown', handleKeyDown as any);
  }, [onEscape, isActive]);
}

/**
 * Hook for handling enter/space key activation
 */
export function useActivationKeys(
  onActivate: () => void,
  element?: HTMLElement | null
) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === Keys.ENTER || event.key === Keys.SPACE) {
      event.preventDefault();
      onActivate();
    }
  }, [onActivate]);

  useEffect(() => {
    if (!element) return;

    element.addEventListener('keydown', handleKeyDown as any);
    return () => element.removeEventListener('keydown', handleKeyDown as any);
  }, [element, handleKeyDown]);

  return handleKeyDown;
}

/**
 * Roving tabindex implementation for managing focus in groups
 */
export function useRovingTabIndex(
  containerRef: React.RefObject<HTMLElement>,
  activeIndex: number = 0
) {
  useEffect(() => {
    if (!containerRef.current) return;

    const elements = Array.from(
      containerRef.current.querySelectorAll('[role="tab"], [role="menuitem"], [role="option"]')
    ) as HTMLElement[];

    elements.forEach((element, index) => {
      element.setAttribute('tabindex', index === activeIndex ? '0' : '-1');
    });
  }, [activeIndex]);
}

/**
 * Utility functions for keyboard navigation
 */
export const keyboardUtils = {
  /**
   * Check if element is keyboard focusable
   */
  isFocusable(element: HTMLElement): boolean {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable]'
    ];

    return focusableSelectors.some(selector =>
      element.matches(selector) || element.querySelector(selector) !== null
    );
  },

  /**
   * Get next focusable element in DOM order
   */
  getNextFocusable(current: HTMLElement): HTMLElement | null {
    const focusable = document.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const currentIndex = Array.from(focusable).indexOf(current);
    return (focusable[currentIndex + 1] as HTMLElement) || null;
  },

  /**
   * Get previous focusable element in DOM order
   */
  getPreviousFocusable(current: HTMLElement): HTMLElement | null {
    const focusable = document.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const currentIndex = Array.from(focusable).indexOf(current);
    return (focusable[currentIndex - 1] as HTMLElement) || null;
  },

  /**
   * Check if key event should trigger activation
   */
  isActivationKey(event: KeyboardEvent): boolean {
    return event.key === Keys.ENTER || event.key === Keys.SPACE;
  },

  /**
   * Check if key event is a navigation key
   */
  isNavigationKey(event: KeyboardEvent): boolean {
    return [
      Keys.ARROW_UP,
      Keys.ARROW_DOWN,
      Keys.ARROW_LEFT,
      Keys.ARROW_RIGHT,
      Keys.HOME,
      Keys.END,
      Keys.PAGE_UP,
      Keys.PAGE_DOWN,
    ].includes(event.key as any);
  },
};