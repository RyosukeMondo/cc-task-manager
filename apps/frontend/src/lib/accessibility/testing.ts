/**
 * Accessibility testing utilities
 * Provides utilities for automated accessibility testing and validation
 */

import { getContrastRatio, checkContrastCompliance, WCAG_LEVELS } from './color-contrast';

/**
 * Accessibility test results
 */
export interface AccessibilityTestResult {
  passed: boolean;
  violations: AccessibilityViolation[];
  warnings: AccessibilityWarning[];
  score: number;
}

export interface AccessibilityViolation {
  rule: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element: string;
  message: string;
  fix: string;
}

export interface AccessibilityWarning {
  rule: string;
  element: string;
  message: string;
  suggestion: string;
}

/**
 * WCAG 2.1 AA testing rules
 */
const ACCESSIBILITY_RULES = {
  // Color contrast
  COLOR_CONTRAST: {
    id: 'color-contrast',
    name: 'Color Contrast',
    level: 'AA',
    guideline: '1.4.3',
  },

  // Keyboard accessibility
  KEYBOARD_ACCESSIBLE: {
    id: 'keyboard-accessible',
    name: 'Keyboard Accessible',
    level: 'AA',
    guideline: '2.1.1',
  },

  // Focus management
  FOCUS_VISIBLE: {
    id: 'focus-visible',
    name: 'Focus Visible',
    level: 'AA',
    guideline: '2.4.7',
  },

  // ARIA labels
  ARIA_LABELS: {
    id: 'aria-labels',
    name: 'ARIA Labels',
    level: 'AA',
    guideline: '4.1.2',
  },

  // Form labels
  FORM_LABELS: {
    id: 'form-labels',
    name: 'Form Labels',
    level: 'AA',
    guideline: '3.3.2',
  },

  // Heading structure
  HEADING_STRUCTURE: {
    id: 'heading-structure',
    name: 'Heading Structure',
    level: 'AA',
    guideline: '2.4.6',
  },

  // Touch targets
  TOUCH_TARGETS: {
    id: 'touch-targets',
    name: 'Touch Targets',
    level: 'AA',
    guideline: '2.5.5',
  },
} as const;

/**
 * Test color contrast for all text elements
 */
export function testColorContrast(container: HTMLElement): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const textElements = container.querySelectorAll('*');

  textElements.forEach((element) => {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;

    // Skip if no background color or transparent
    if (!backgroundColor || backgroundColor === 'rgba(0, 0, 0, 0)') {
      return;
    }

    try {
      const compliance = checkContrastCompliance(
        rgbToHex(color),
        rgbToHex(backgroundColor)
      );

      if (!compliance.compliant) {
        violations.push({
          rule: ACCESSIBILITY_RULES.COLOR_CONTRAST.id,
          severity: 'serious',
          element: getElementSelector(element),
          message: `Color contrast ratio ${compliance.ratio} does not meet WCAG AA standard (${compliance.requiredRatio})`,
          fix: 'Increase color contrast by using darker text or lighter background colors',
        });
      }
    } catch (error) {
      // Skip elements with invalid colors
    }
  });

  return violations;
}

/**
 * Test keyboard accessibility
 */
export function testKeyboardAccessibility(container: HTMLElement): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const interactiveElements = container.querySelectorAll(
    'button, a, input, select, textarea, [tabindex], [role="button"], [role="link"]'
  );

  interactiveElements.forEach((element) => {
    const tabIndex = element.getAttribute('tabindex');

    // Check for keyboard traps (tabindex > 0)
    if (tabIndex && parseInt(tabIndex) > 0) {
      violations.push({
        rule: ACCESSIBILITY_RULES.KEYBOARD_ACCESSIBLE.id,
        severity: 'serious',
        element: getElementSelector(element),
        message: 'Positive tabindex creates keyboard trap',
        fix: 'Use tabindex="0" or remove tabindex to follow natural tab order',
      });
    }

    // Check for inaccessible elements (tabindex="-1" without proper handling)
    if (tabIndex === '-1' && !element.hasAttribute('aria-hidden')) {
      const isInDialog = element.closest('[role="dialog"]');
      if (!isInDialog) {
        violations.push({
          rule: ACCESSIBILITY_RULES.KEYBOARD_ACCESSIBLE.id,
          severity: 'moderate',
          element: getElementSelector(element),
          message: 'Interactive element is not keyboard accessible',
          fix: 'Remove tabindex="-1" or add proper focus management',
        });
      }
    }
  });

  return violations;
}

/**
 * Test focus visibility
 */
export function testFocusVisibility(container: HTMLElement): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const focusableElements = container.querySelectorAll(
    'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  focusableElements.forEach((element) => {
    const styles = window.getComputedStyle(element, ':focus');
    const outline = styles.outline;
    const boxShadow = styles.boxShadow;

    // Check if element has visible focus indicator
    const hasFocusIndicator = outline !== 'none' || boxShadow !== 'none';

    if (!hasFocusIndicator) {
      violations.push({
        rule: ACCESSIBILITY_RULES.FOCUS_VISIBLE.id,
        severity: 'serious',
        element: getElementSelector(element),
        message: 'Element lacks visible focus indicator',
        fix: 'Add CSS :focus styles with outline or box-shadow',
      });
    }
  });

  return violations;
}

/**
 * Test ARIA labels and roles
 */
export function testAriaLabels(container: HTMLElement): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];

  // Check buttons without accessible names
  const buttons = container.querySelectorAll('button');
  buttons.forEach((button) => {
    const hasAccessibleName =
      button.textContent?.trim() ||
      button.getAttribute('aria-label') ||
      button.getAttribute('aria-labelledby') ||
      button.querySelector('img')?.getAttribute('alt');

    if (!hasAccessibleName) {
      violations.push({
        rule: ACCESSIBILITY_RULES.ARIA_LABELS.id,
        severity: 'critical',
        element: getElementSelector(button),
        message: 'Button lacks accessible name',
        fix: 'Add text content, aria-label, or aria-labelledby attribute',
      });
    }
  });

  // Check images without alt text
  const images = container.querySelectorAll('img');
  images.forEach((img) => {
    const alt = img.getAttribute('alt');
    const isDecorative = img.getAttribute('role') === 'presentation' ||
                        img.getAttribute('aria-hidden') === 'true';

    if (alt === null && !isDecorative) {
      violations.push({
        rule: ACCESSIBILITY_RULES.ARIA_LABELS.id,
        severity: 'serious',
        element: getElementSelector(img),
        message: 'Image lacks alt attribute',
        fix: 'Add alt attribute with descriptive text or empty alt="" for decorative images',
      });
    }
  });

  return violations;
}

/**
 * Test form labels
 */
export function testFormLabels(container: HTMLElement): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const formControls = container.querySelectorAll('input, select, textarea');

  formControls.forEach((control) => {
    const id = control.getAttribute('id');
    const ariaLabel = control.getAttribute('aria-label');
    const ariaLabelledby = control.getAttribute('aria-labelledby');

    let hasLabel = false;

    // Check for associated label
    if (id) {
      const label = container.querySelector(`label[for="${id}"]`);
      if (label) hasLabel = true;
    }

    // Check for aria-label or aria-labelledby
    if (ariaLabel || ariaLabelledby) hasLabel = true;

    // Check if wrapped in label
    const parentLabel = control.closest('label');
    if (parentLabel) hasLabel = true;

    if (!hasLabel) {
      violations.push({
        rule: ACCESSIBILITY_RULES.FORM_LABELS.id,
        severity: 'critical',
        element: getElementSelector(control),
        message: 'Form control lacks associated label',
        fix: 'Add <label> element, aria-label, or aria-labelledby attribute',
      });
    }
  });

  return violations;
}

/**
 * Test heading structure
 */
export function testHeadingStructure(container: HTMLElement): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');

  let previousLevel = 0;

  headings.forEach((heading) => {
    const level = parseInt(heading.tagName.substring(1));

    // Check for skipped heading levels
    if (level > previousLevel + 1) {
      violations.push({
        rule: ACCESSIBILITY_RULES.HEADING_STRUCTURE.id,
        severity: 'moderate',
        element: getElementSelector(heading),
        message: `Heading level ${level} skips level ${previousLevel + 1}`,
        fix: `Use h${previousLevel + 1} instead of h${level} to maintain proper hierarchy`,
      });
    }

    previousLevel = level;
  });

  return violations;
}

/**
 * Test touch target sizes
 */
export function testTouchTargets(container: HTMLElement): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const touchTargets = container.querySelectorAll('button, a, input[type="button"], input[type="submit"]');

  touchTargets.forEach((target) => {
    const rect = target.getBoundingClientRect();
    const minSize = 44; // WCAG AA minimum touch target size

    if (rect.width < minSize || rect.height < minSize) {
      violations.push({
        rule: ACCESSIBILITY_RULES.TOUCH_TARGETS.id,
        severity: 'moderate',
        element: getElementSelector(target),
        message: `Touch target is too small (${rect.width}x${rect.height}px). Minimum size is ${minSize}x${minSize}px`,
        fix: 'Increase padding or dimensions to meet minimum touch target size',
      });
    }
  });

  return violations;
}

/**
 * Run comprehensive accessibility test
 */
export function runAccessibilityTest(container: HTMLElement = document.body): AccessibilityTestResult {
  const violations: AccessibilityViolation[] = [
    ...testColorContrast(container),
    ...testKeyboardAccessibility(container),
    ...testFocusVisibility(container),
    ...testAriaLabels(container),
    ...testFormLabels(container),
    ...testHeadingStructure(container),
    ...testTouchTargets(container),
  ];

  const warnings: AccessibilityWarning[] = [];

  // Calculate accessibility score
  const totalTests = Object.keys(ACCESSIBILITY_RULES).length;
  const criticalViolations = violations.filter(v => v.severity === 'critical').length;
  const seriousViolations = violations.filter(v => v.severity === 'serious').length;
  const moderateViolations = violations.filter(v => v.severity === 'moderate').length;

  const score = Math.max(0, 100 - (
    criticalViolations * 25 +
    seriousViolations * 15 +
    moderateViolations * 10
  ));

  return {
    passed: violations.length === 0,
    violations,
    warnings,
    score,
  };
}

/**
 * Utility functions
 */
function getElementSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  if (element.className) return `.${element.className.split(' ')[0]}`;
  return element.tagName.toLowerCase();
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g);
  if (!match) return '#000000';

  const [r, g, b] = match.map(Number);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Performance test for accessibility features
 */
export function testAccessibilityPerformance(): {
  score: number;
  metrics: Record<string, number>;
  recommendations: string[];
} {
  const metrics: Record<string, number> = {};
  const recommendations: string[] = [];

  // Test focus management performance
  const focusStart = performance.now();
  const focusableElements = document.querySelectorAll(
    'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  metrics.focusableElementCount = focusableElements.length;
  metrics.focusQueryTime = performance.now() - focusStart;

  // Test ARIA query performance
  const ariaStart = performance.now();
  const ariaElements = document.querySelectorAll('[aria-label], [aria-labelledby], [role]');
  metrics.ariaElementCount = ariaElements.length;
  metrics.ariaQueryTime = performance.now() - ariaStart;

  // Analyze performance and provide recommendations
  if (metrics.focusableElementCount > 100) {
    recommendations.push('Consider implementing virtual focus management for large lists');
  }

  if (metrics.focusQueryTime > 10) {
    recommendations.push('Focus queries are slow - consider caching focusable elements');
  }

  if (metrics.ariaQueryTime > 5) {
    recommendations.push('ARIA queries are slow - optimize DOM structure');
  }

  const score = Math.max(0, 100 - (
    (metrics.focusQueryTime > 10 ? 20 : 0) +
    (metrics.ariaQueryTime > 5 ? 15 : 0) +
    (metrics.focusableElementCount > 100 ? 10 : 0)
  ));

  return { score, metrics, recommendations };
}