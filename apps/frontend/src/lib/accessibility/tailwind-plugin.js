/**
 * Tailwind CSS plugin for accessibility utilities
 * Adds WCAG 2.1 AA compliant utilities and screen reader classes
 */

const plugin = require('tailwindcss/plugin');

const accessibilityPlugin = plugin(function({ addUtilities, addComponents, theme }) {
  // Screen reader utilities
  addUtilities({
    '.sr-only': {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      borderWidth: '0',
    },
    '.not-sr-only': {
      position: 'static',
      width: 'auto',
      height: 'auto',
      padding: '0',
      margin: '0',
      overflow: 'visible',
      clip: 'auto',
      whiteSpace: 'normal',
    },
    '.sr-only-focusable': {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      borderWidth: '0',
      '&:focus': {
        position: 'static',
        width: 'auto',
        height: 'auto',
        padding: '0.5rem',
        margin: '0',
        overflow: 'visible',
        clip: 'auto',
        whiteSpace: 'normal',
        zIndex: '50',
      },
    },
  });

  // Focus utilities
  addUtilities({
    '.focus-visible-ring': {
      '&:focus-visible': {
        outline: '2px solid transparent',
        outlineOffset: '2px',
        boxShadow: `0 0 0 2px ${theme('colors.ring')}`,
      },
    },
    '.focus-within-ring': {
      '&:focus-within': {
        outline: '2px solid transparent',
        outlineOffset: '2px',
        boxShadow: `0 0 0 2px ${theme('colors.ring')}`,
      },
    },
    '.skip-to-content': {
      position: 'absolute',
      left: '-9999px',
      zIndex: '999',
      padding: '0.5rem 1rem',
      backgroundColor: theme('colors.primary.DEFAULT'),
      color: theme('colors.primary.foreground'),
      textDecoration: 'none',
      '&:focus': {
        left: '1rem',
        top: '1rem',
      },
    },
  });

  // High contrast mode utilities
  addUtilities({
    '.high-contrast': {
      '@media (prefers-contrast: high)': {
        borderWidth: '2px',
        borderColor: 'currentColor',
      },
    },
    '.high-contrast-text': {
      '@media (prefers-contrast: high)': {
        color: theme('colors.foreground'),
        backgroundColor: theme('colors.background'),
      },
    },
  });

  // Reduced motion utilities
  addUtilities({
    '.motion-safe': {
      '@media (prefers-reduced-motion: no-preference)': {
        // Animations will be applied only when motion is safe
      },
    },
    '.motion-reduce': {
      '@media (prefers-reduced-motion: reduce)': {
        animationDuration: '0.01ms !important',
        animationIterationCount: '1 !important',
        transitionDuration: '0.01ms !important',
        scrollBehavior: 'auto !important',
      },
    },
  });

  // Accessible button components
  addComponents({
    '.btn-accessible': {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '44px', // WCAG minimum touch target size
      minWidth: '44px',
      padding: '0.5rem 1rem',
      fontSize: theme('fontSize.base'),
      fontWeight: theme('fontWeight.medium'),
      lineHeight: theme('lineHeight.none'),
      borderRadius: theme('borderRadius.md'),
      border: '2px solid transparent',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s ease-in-out',
      '&:focus-visible': {
        outline: '2px solid transparent',
        outlineOffset: '2px',
        boxShadow: `0 0 0 2px ${theme('colors.ring')}`,
      },
      '&:disabled': {
        opacity: '0.5',
        cursor: 'not-allowed',
      },
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
      },
    },
    '.btn-primary-accessible': {
      backgroundColor: theme('colors.primary.DEFAULT'),
      color: theme('colors.primary.foreground'),
      '&:hover:not(:disabled)': {
        backgroundColor: theme('colors.primary.DEFAULT'),
        opacity: '0.9',
      },
      '&:active:not(:disabled)': {
        transform: 'translateY(1px)',
      },
    },
    '.btn-secondary-accessible': {
      backgroundColor: theme('colors.secondary.DEFAULT'),
      color: theme('colors.secondary.foreground'),
      borderColor: theme('colors.border'),
      '&:hover:not(:disabled)': {
        backgroundColor: theme('colors.secondary.DEFAULT'),
        opacity: '0.9',
      },
      '&:active:not(:disabled)': {
        transform: 'translateY(1px)',
      },
    },
  });

  // Accessible form components
  addComponents({
    '.form-input-accessible': {
      display: 'block',
      width: '100%',
      minHeight: '44px',
      padding: '0.75rem',
      fontSize: theme('fontSize.base'),
      lineHeight: theme('lineHeight.tight'),
      color: theme('colors.foreground'),
      backgroundColor: theme('colors.background'),
      border: `2px solid ${theme('colors.border')}`,
      borderRadius: theme('borderRadius.md'),
      outline: 'none',
      transition: 'border-color 0.2s ease-in-out',
      '&:focus': {
        borderColor: theme('colors.ring'),
        boxShadow: `0 0 0 1px ${theme('colors.ring')}`,
      },
      '&:invalid': {
        borderColor: theme('colors.destructive.DEFAULT'),
      },
      '&[aria-invalid="true"]': {
        borderColor: theme('colors.destructive.DEFAULT'),
      },
      '&:disabled': {
        opacity: '0.5',
        cursor: 'not-allowed',
      },
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
      },
    },
    '.form-label-accessible': {
      display: 'block',
      fontSize: theme('fontSize.sm'),
      fontWeight: theme('fontWeight.medium'),
      color: theme('colors.foreground'),
      marginBottom: theme('spacing.2'),
    },
    '.form-error-accessible': {
      display: 'block',
      fontSize: theme('fontSize.sm'),
      color: theme('colors.destructive.DEFAULT'),
      marginTop: theme('spacing.1'),
    },
    '.form-help-accessible': {
      display: 'block',
      fontSize: theme('fontSize.sm'),
      color: theme('colors.muted.foreground'),
      marginTop: theme('spacing.1'),
    },
  });

  // Skip link component
  addComponents({
    '.skip-link': {
      position: 'absolute',
      left: '-9999px',
      zIndex: '9999',
      padding: '0.5rem 1rem',
      backgroundColor: theme('colors.primary.DEFAULT'),
      color: theme('colors.primary.foreground'),
      textDecoration: 'none',
      borderRadius: theme('borderRadius.md'),
      fontSize: theme('fontSize.sm'),
      fontWeight: theme('fontWeight.medium'),
      '&:focus': {
        left: '1rem',
        top: '1rem',
      },
    },
  });
});

module.exports = accessibilityPlugin;