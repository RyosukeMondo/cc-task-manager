'use client';

/**
 * Screen reader utilities
 * Provides utilities for screen reader support and content announcements
 */

import React, { useEffect, useRef } from 'react';

/**
 * Screen reader only content utilities
 */
export const screenReader = {
  /**
   * CSS class for screen reader only content
   */
  onlyClass: 'sr-only',

  /**
   * CSS class for content visible when focused (skip links)
   */
  focusableClass: 'sr-only focus:not-sr-only',

  /**
   * Create screen reader only content
   */
  only: (content: string) => ({
    className: 'sr-only',
    children: content,
  }),

  /**
   * Create visually hidden but accessible content
   */
  hidden: (content: string) => ({
    className: 'sr-only',
    'aria-hidden': 'false',
    children: content,
  }),
};

/**
 * Hook for announcing content to screen readers
 */
export function useScreenReaderAnnouncement() {
  const announcementRef = useRef<HTMLDivElement | null>(null);

  const announce = (
    message: string,
    priority: 'polite' | 'assertive' = 'polite',
    delay: number = 100
  ) => {
    // Clear any existing announcement
    if (announcementRef.current) {
      announcementRef.current.textContent = '';
    }

    setTimeout(() => {
      if (!announcementRef.current) {
        // Create announcement element
        const element = document.createElement('div');
        element.setAttribute('aria-live', priority);
        element.setAttribute('aria-atomic', 'true');
        element.className = 'sr-only';
        element.style.position = 'absolute';
        element.style.left = '-10000px';
        element.style.width = '1px';
        element.style.height = '1px';
        element.style.overflow = 'hidden';

        document.body.appendChild(element);
        announcementRef.current = element;
      }

      // Update the announcement
      announcementRef.current.setAttribute('aria-live', priority);
      announcementRef.current.textContent = message;
    }, delay);
  };

  const clear = () => {
    if (announcementRef.current) {
      announcementRef.current.textContent = '';
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (announcementRef.current && announcementRef.current.parentNode) {
        announcementRef.current.parentNode.removeChild(announcementRef.current);
      }
    };
  }, []);

  return { announce, clear };
}

/**
 * Hook for managing dynamic content announcements
 */
export function useDynamicAnnouncement(
  content: string,
  shouldAnnounce: boolean = true,
  priority: 'polite' | 'assertive' = 'polite'
) {
  const { announce } = useScreenReaderAnnouncement();
  const previousContent = useRef<string>('');

  useEffect(() => {
    if (shouldAnnounce && content && content !== previousContent.current) {
      announce(content, priority);
      previousContent.current = content;
    }
  }, [content, shouldAnnounce, priority, announce]);
}

/**
 * Screen reader status announcements for loading states
 */
export const statusAnnouncements = {
  loading: (resource?: string) =>
    resource ? `Loading ${resource}` : 'Loading',

  loaded: (resource?: string) =>
    resource ? `${resource} loaded successfully` : 'Content loaded successfully',

  error: (resource?: string, error?: string) => {
    const base = resource ? `Error loading ${resource}` : 'An error occurred';
    return error ? `${base}: ${error}` : base;
  },

  saved: (resource?: string) =>
    resource ? `${resource} saved successfully` : 'Changes saved successfully',

  deleted: (resource?: string) =>
    resource ? `${resource} deleted successfully` : 'Item deleted successfully',

  updated: (resource?: string) =>
    resource ? `${resource} updated successfully` : 'Content updated successfully',

  progress: (current: number, total: number, resource?: string) => {
    const percentage = Math.round((current / total) * 100);
    const base = `Progress: ${percentage}%`;
    return resource ? `${base} - ${resource}` : base;
  },
};

/**
 * Utility for creating accessible status messages
 */
export function createStatusMessage(
  type: keyof typeof statusAnnouncements,
  ...args: any[]
): string {
  const messageFunction = statusAnnouncements[type];
  if (typeof messageFunction === 'function') {
    return messageFunction(...args);
  }
  return messageFunction;
}

/**
 * Component for managing live region announcements
 */
export interface LiveRegionProps {
  message: string;
  priority?: 'polite' | 'assertive';
  clearDelay?: number;
}

export function LiveRegion({
  message,
  priority = 'polite',
  clearDelay = 5000
}: LiveRegionProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && elementRef.current) {
      elementRef.current.textContent = message;

      // Clear the message after delay to avoid repeated announcements
      if (clearDelay > 0) {
        const timeout = setTimeout(() => {
          if (elementRef.current) {
            elementRef.current.textContent = '';
          }
        }, clearDelay);

        return () => clearTimeout(timeout);
      }
    }
  }, [message, clearDelay]);

  return (
    <div
      ref={elementRef}
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    />
  );
}