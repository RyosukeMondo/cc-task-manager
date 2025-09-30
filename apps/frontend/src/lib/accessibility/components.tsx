'use client';

/**
 * Accessible React components following WCAG 2.1 AA standards
 * Provides reusable components with built-in accessibility features
 */

import React, { forwardRef, useId } from 'react';
import { useFocusTrap, useFocusRestore } from './focus-management';
import { useEscapeKey, useArrowNavigation } from './keyboard-navigation';
import { LiveRegion } from './screen-reader';
import { button, dialog, formField } from './aria-helpers';
import { useWebVitals, useRenderPerformance } from './performance-monitor';
import { useReducedMotion } from './performance-hooks';

/**
 * Accessible Skip Link component
 */
interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const SkipLink = forwardRef<HTMLAnchorElement, SkipLinkProps>(
  ({ href, children, className = '', ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        className={`skip-link ${className}`}
        {...props}
      >
        {children}
      </a>
    );
  }
);

SkipLink.displayName = 'SkipLink';

/**
 * Accessible Modal/Dialog component
 */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = '',
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useFocusTrap(isOpen);
  const { saveFocus, restoreFocus } = useFocusRestore();

  useEscapeKey(onClose, isOpen);

  React.useEffect(() => {
    if (isOpen) {
      saveFocus();
      document.body.style.overflow = 'hidden';
    } else {
      restoreFocus();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, saveFocus, restoreFocus]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={containerRef}
        className={`relative z-10 w-full max-w-md max-h-[90vh] overflow-auto bg-white rounded-lg shadow-lg ${className}`}
        {...dialog.create(titleId, description ? descriptionId : undefined)}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="btn-accessible p-2"
              aria-label="Close dialog"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {description && (
            <p id={descriptionId} className="text-sm text-gray-600 mb-4">
              {description}
            </p>
          )}

          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * Accessible Form Field component
 */
interface FormFieldProps {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  children: React.ReactElement;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helpText,
  required = false,
  children,
  className = '',
}) => {
  const fieldId = useId();
  const hasError = Boolean(error);

  const childWithProps = React.cloneElement(children, {
    ...formField.create(fieldId, hasError, required),
    ...children.props,
  });

  return (
    <div className={`space-y-2 ${className}`}>
      <label
        htmlFor={fieldId}
        className="form-label-accessible"
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {childWithProps}

      {helpText && (
        <div
          {...formField.helpText(fieldId)}
          className="form-help-accessible"
        >
          {helpText}
        </div>
      )}

      {error && (
        <div
          {...formField.errorMessage(fieldId)}
          className="form-error-accessible"
        >
          {error}
        </div>
      )}
    </div>
  );
};

/**
 * Accessible Button component
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading = false, children, className = '', ...props }, ref) => {
    const baseClasses = 'btn-accessible';
    const variantClasses = {
      primary: 'btn-primary-accessible',
      secondary: 'btn-secondary-accessible',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    };
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={isLoading || props.disabled}
        aria-disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && (
          <span
            className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
            aria-hidden="true"
          />
        )}
        <span className={isLoading ? 'sr-only' : ''}>{children}</span>
        {isLoading && <span aria-live="polite">Loading...</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Accessible Menu component
 */
interface MenuProps {
  trigger: React.ReactElement;
  items: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
  className?: string;
}

export const Menu: React.FC<MenuProps> = ({ trigger, items, className = '' }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuId = useId();
  const menuRef = React.useRef<HTMLUListElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const handleArrowNavigation = useArrowNavigation(menuRef, {
    direction: 'vertical',
    wrap: true,
  });

  useEscapeKey(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, isOpen);

  const triggerWithProps = React.cloneElement(trigger, {
    ref: triggerRef,
    ...button.menu(isOpen, menuId),
    onClick: () => setIsOpen(!isOpen),
    ...trigger.props,
  });

  return (
    <div className={`relative ${className}`}>
      {triggerWithProps}

      {isOpen && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          className="absolute top-full left-0 z-10 min-w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1"
          onKeyDown={handleArrowNavigation}
        >
          {items.map((item, index) => (
            <li key={index} role="none">
              <button
                role="menuitem"
                disabled={item.disabled}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:bg-gray-100 focus:outline-none"
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Accessible Progress Bar component
 */
interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showValue = true,
  className = '',
}) => {
  const percentage = Math.round((value / max) * 100);
  const progressId = useId();

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex justify-between items-center">
          <label htmlFor={progressId} className="text-sm font-medium">
            {label}
          </label>
          {showValue && (
            <span className="text-sm text-gray-600" aria-live="polite">
              {percentage}%
            </span>
          )}
        </div>
      )}

      <div
        className="w-full bg-gray-200 rounded-full h-2"
        aria-hidden="true"
      >
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div
        id={progressId}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || `Progress: ${percentage}%`}
        className="sr-only"
      >
        {percentage}% complete
      </div>
    </div>
  );
};

/**
 * Accessible Announcement component for status updates
 */
interface AnnouncementProps {
  message: string;
  type?: 'status' | 'alert';
  clearDelay?: number;
}

export const Announcement: React.FC<AnnouncementProps> = ({
  message,
  type = 'status',
  clearDelay = 5000,
}) => {
  return (
    <LiveRegion
      message={message}
      priority={type === 'alert' ? 'assertive' : 'polite'}
      clearDelay={clearDelay}
    />
  );
};

/**
 * Performance Monitor component for Core Web Vitals tracking
 */
interface PerformanceMonitorProps {
  children: React.ReactNode;
  enableDevMode?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  children,
  enableDevMode = process.env.NODE_ENV === 'development',
}) => {
  useRenderPerformance('App');

  const { getAllMetrics } = useWebVitals((metric) => {
    // Log performance metrics in development
    if (enableDevMode) {
      console.log(`Performance metric: ${metric.name} = ${metric.value}ms (${metric.rating})`);
    }

    // Send metrics to analytics in production
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      // You can integrate with your analytics service here
      // Example: analytics.track('web-vital', metric);
    }
  });

  const { prefersReducedMotion } = useReducedMotion();

  React.useEffect(() => {
    // Apply reduced motion preferences globally
    if (prefersReducedMotion) {
      document.documentElement.style.setProperty('--animation-duration', '0s');
      document.documentElement.style.setProperty('--transition-duration', '0s');
    } else {
      document.documentElement.style.removeProperty('--animation-duration');
      document.documentElement.style.removeProperty('--transition-duration');
    }
  }, [prefersReducedMotion]);

  return <>{children}</>;
};