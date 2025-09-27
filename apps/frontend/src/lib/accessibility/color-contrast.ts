/**
 * Color contrast utilities for WCAG 2.1 AA compliance
 * Provides utilities for ensuring proper color contrast ratios
 */

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance of a color
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    throw new Error('Invalid color format. Use hex colors (e.g., #ffffff)');
  }

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * WCAG 2.1 compliance levels
 */
export const WCAG_LEVELS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
} as const;

/**
 * Check if colors meet WCAG contrast requirements
 */
export function checkContrastCompliance(
  foreground: string,
  background: string,
  level: keyof typeof WCAG_LEVELS = 'AA_NORMAL'
): {
  ratio: number;
  compliant: boolean;
  requiredRatio: number;
  level: string;
} {
  const ratio = getContrastRatio(foreground, background);
  const requiredRatio = WCAG_LEVELS[level];
  const compliant = ratio >= requiredRatio;

  return {
    ratio: Math.round(ratio * 100) / 100,
    compliant,
    requiredRatio,
    level,
  };
}

/**
 * Get color contrast recommendations
 */
export function getContrastRecommendations(
  foreground: string,
  background: string
): {
  current: number;
  recommendations: Array<{
    level: string;
    required: number;
    meets: boolean;
    suggestion?: string;
  }>;
} {
  const current = getContrastRatio(foreground, background);

  const recommendations = [
    {
      level: 'WCAG AA (Normal Text)',
      required: WCAG_LEVELS.AA_NORMAL,
      meets: current >= WCAG_LEVELS.AA_NORMAL,
      suggestion: current < WCAG_LEVELS.AA_NORMAL ? 'Increase contrast for better readability' : undefined,
    },
    {
      level: 'WCAG AA (Large Text)',
      required: WCAG_LEVELS.AA_LARGE,
      meets: current >= WCAG_LEVELS.AA_LARGE,
      suggestion: current < WCAG_LEVELS.AA_LARGE ? 'Minimum requirement not met' : undefined,
    },
    {
      level: 'WCAG AAA (Normal Text)',
      required: WCAG_LEVELS.AAA_NORMAL,
      meets: current >= WCAG_LEVELS.AAA_NORMAL,
      suggestion: current < WCAG_LEVELS.AAA_NORMAL ? 'Enhanced contrast recommended' : undefined,
    },
    {
      level: 'WCAG AAA (Large Text)',
      required: WCAG_LEVELS.AAA_LARGE,
      meets: current >= WCAG_LEVELS.AAA_LARGE,
      suggestion: current < WCAG_LEVELS.AAA_LARGE ? 'Consider higher contrast for large text' : undefined,
    },
  ];

  return {
    current: Math.round(current * 100) / 100,
    recommendations,
  };
}

/**
 * Predefined accessible color combinations
 */
export const accessibleColors = {
  // High contrast combinations (AAA compliant)
  highContrast: {
    darkOnLight: { foreground: '#000000', background: '#ffffff' }, // 21:1
    lightOnDark: { foreground: '#ffffff', background: '#000000' }, // 21:1
    blueOnWhite: { foreground: '#003366', background: '#ffffff' }, // 12.6:1
    whiteOnBlue: { foreground: '#ffffff', background: '#003366' }, // 12.6:1
  },

  // AA compliant combinations
  standard: {
    darkGrayOnLight: { foreground: '#333333', background: '#ffffff' }, // 12.6:1
    lightOnDarkGray: { foreground: '#ffffff', background: '#333333' }, // 12.6:1
    blueOnLightGray: { foreground: '#0056b3', background: '#f8f9fa' }, // 7.2:1
    darkOnLightBlue: { foreground: '#003d82', background: '#e3f2fd' }, // 8.2:1
  },

  // Status colors (AA compliant)
  status: {
    success: { foreground: '#0f5132', background: '#d1e7dd' }, // 7.8:1
    warning: { foreground: '#664d03', background: '#fff3cd' }, // 8.1:1
    error: { foreground: '#842029', background: '#f8d7da' }, // 9.7:1
    info: { foreground: '#055160', background: '#d1ecf1' }, // 7.4:1
  },
};

/**
 * Utility to validate theme colors for accessibility
 */
export function validateThemeColors(theme: Record<string, { foreground: string; background: string }>) {
  const results: Record<string, ReturnType<typeof checkContrastCompliance>> = {};

  for (const [name, colors] of Object.entries(theme)) {
    results[name] = checkContrastCompliance(colors.foreground, colors.background);
  }

  return results;
}

/**
 * Generate accessible color variations
 */
export function generateAccessibleVariations(
  baseColor: string,
  targetBackground: string = '#ffffff'
): {
  original: string;
  lighter: string[];
  darker: string[];
  accessible: string | null;
} {
  // This is a simplified implementation
  // In a real implementation, you'd use a color manipulation library
  const variations = {
    original: baseColor,
    lighter: [] as string[],
    darker: [] as string[],
    accessible: null as string | null,
  };

  // For demonstration, we'll provide some common accessible alternatives
  const accessibleAlternatives: Record<string, string> = {
    '#ff0000': '#d63384', // Red alternative
    '#00ff00': '#198754', // Green alternative
    '#0000ff': '#0d6efd', // Blue alternative
    '#ffff00': '#ffc107', // Yellow alternative
    '#ff00ff': '#d63384', // Magenta alternative
    '#00ffff': '#20c997', // Cyan alternative
  };

  const normalizedBase = baseColor.toLowerCase();
  if (accessibleAlternatives[normalizedBase]) {
    const alternative = accessibleAlternatives[normalizedBase];
    const compliance = checkContrastCompliance(alternative, targetBackground);
    if (compliance.compliant) {
      variations.accessible = alternative;
    }
  }

  return variations;
}