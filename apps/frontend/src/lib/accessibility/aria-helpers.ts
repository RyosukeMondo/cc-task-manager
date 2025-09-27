/**
 * ARIA helpers for improved accessibility
 * Provides utilities for ARIA attributes and screen reader support
 */

import { useId } from 'react';

/**
 * Generate unique IDs for form controls and labels
 */
export function useAccessibleId(prefix: string = 'accessible') {
  return useId() || `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * ARIA live region types
 */
export type LiveRegionPoliteness = 'off' | 'polite' | 'assertive';

/**
 * ARIA live region utilities
 */
export const liveRegion = {
  /**
   * Create ARIA live region attributes
   */
  create: (politeness: LiveRegionPoliteness = 'polite', atomic: boolean = true) => ({
    'aria-live': politeness,
    'aria-atomic': atomic.toString(),
  }),

  /**
   * Status message attributes (for success/error messages)
   */
  status: {
    'aria-live': 'polite' as const,
    'aria-atomic': 'true',
    role: 'status',
  },

  /**
   * Alert attributes (for urgent messages)
   */
  alert: {
    'aria-live': 'assertive' as const,
    'aria-atomic': 'true',
    role: 'alert',
  },
};

/**
 * Form field accessibility helpers
 */
export const formField = {
  /**
   * Create accessible form field attributes
   */
  create: (id: string, hasError: boolean = false, isRequired: boolean = false) => ({
    id,
    'aria-invalid': hasError,
    'aria-required': isRequired,
    ...(hasError && { 'aria-describedby': `${id}-error` }),
  }),

  /**
   * Create error message attributes
   */
  errorMessage: (fieldId: string) => ({
    id: `${fieldId}-error`,
    role: 'alert',
    'aria-live': 'polite' as const,
  }),

  /**
   * Create help text attributes
   */
  helpText: (fieldId: string) => ({
    id: `${fieldId}-help`,
  }),
};

/**
 * Button accessibility helpers
 */
export const button = {
  /**
   * Create accessible button attributes
   */
  create: (expanded?: boolean, controls?: string) => ({
    type: 'button' as const,
    ...(expanded !== undefined && { 'aria-expanded': expanded }),
    ...(controls && { 'aria-controls': controls }),
  }),

  /**
   * Toggle button attributes
   */
  toggle: (pressed: boolean, label?: string) => ({
    type: 'button' as const,
    'aria-pressed': pressed,
    ...(label && { 'aria-label': label }),
  }),

  /**
   * Menu button attributes
   */
  menu: (expanded: boolean, menuId: string) => ({
    type: 'button' as const,
    'aria-expanded': expanded,
    'aria-controls': menuId,
    'aria-haspopup': 'menu' as const,
  }),
};

/**
 * Dialog/Modal accessibility helpers
 */
export const dialog = {
  /**
   * Create accessible dialog attributes
   */
  create: (labelledBy?: string, describedBy?: string) => ({
    role: 'dialog',
    'aria-modal': 'true',
    ...(labelledBy && { 'aria-labelledby': labelledBy }),
    ...(describedBy && { 'aria-describedby': describedBy }),
  }),

  /**
   * Backdrop attributes
   */
  backdrop: {
    'aria-hidden': 'true' as const,
  },
};

/**
 * Navigation accessibility helpers
 */
export const navigation = {
  /**
   * Main navigation attributes
   */
  main: {
    role: 'navigation',
    'aria-label': 'Main navigation',
  },

  /**
   * Breadcrumb navigation attributes
   */
  breadcrumb: {
    role: 'navigation',
    'aria-label': 'Breadcrumb',
  },

  /**
   * Pagination navigation attributes
   */
  pagination: {
    role: 'navigation',
    'aria-label': 'Pagination',
  },
};

/**
 * Table accessibility helpers
 */
export const table = {
  /**
   * Create accessible table attributes
   */
  create: (caption?: string) => ({
    role: 'table',
    ...(caption && { 'aria-label': caption }),
  }),

  /**
   * Column header attributes
   */
  columnHeader: (sortDirection?: 'ascending' | 'descending' | 'none') => ({
    role: 'columnheader',
    ...(sortDirection && { 'aria-sort': sortDirection }),
  }),

  /**
   * Row header attributes
   */
  rowHeader: {
    role: 'rowheader',
  },
};

/**
 * Loading state accessibility helpers
 */
export const loading = {
  /**
   * Loading spinner attributes
   */
  spinner: (label: string = 'Loading') => ({
    role: 'status',
    'aria-label': label,
    'aria-live': 'polite' as const,
  }),

  /**
   * Progress bar attributes
   */
  progressBar: (value: number, max: number = 100, label?: string) => ({
    role: 'progressbar',
    'aria-valuenow': value,
    'aria-valuemin': 0,
    'aria-valuemax': max,
    ...(label && { 'aria-label': label }),
  }),
};

/**
 * Utility to create accessible descriptions
 */
export function createAccessibleDescription(
  baseDescription: string,
  additionalInfo?: string[]
): string {
  const parts = [baseDescription];
  if (additionalInfo && additionalInfo.length > 0) {
    parts.push(...additionalInfo);
  }
  return parts.join('. ');
}