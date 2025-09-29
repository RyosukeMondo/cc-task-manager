/**
 * Performance optimization utilities and Core Web Vitals monitoring
 * Consolidates performance-related functionality for the dashboard application
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Re-export performance hooks from accessibility module for backward compatibility
export { useWebVitals, performanceUtils as legacyPerformanceUtils, WEB_VITALS_THRESHOLDS as LEGACY_THRESHOLDS } from './accessibility/performance-monitor';

/**
 * Performance metric types
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

export interface WebVitalsMetrics {
  CLS: number | null;
  FID: number | null;
  FCP: number | null;
  LCP: number | null;
  TTFB: number | null;
}

/**
 * Hook for lazy loading components with performance monitoring
 */
export function useLazyLoad<T>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (Component || loading) return;

    setLoading(true);
    const startTime = performance.now();

    try {
      const module = await importFn();
      const loadTime = performance.now() - startTime;

      // Log slow loading components in development
      if (process.env.NODE_ENV === 'development' && loadTime > 1000) {
        console.warn(`Slow component load: ${loadTime}ms`);
      }

      setComponent(module.default);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [Component, loading, importFn]);

  return { Component, loading, error, load };
}

/**
 * Hook for monitoring component render performance
 */
export function useRenderTiming(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;

    return () => {
      const renderTime = performance.now() - renderStartTime.current;

      if (process.env.NODE_ENV === 'development') {
        console.log(`${componentName} render ${renderCount.current}: ${renderTime.toFixed(2)}ms`);

        // Warn about slow renders
        if (renderTime > 16) {
          console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
        }
      }
    };
  });

  return { renderCount: renderCount.current };
}

/**
 * Hook for debouncing state updates to improve performance
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttling function calls to improve performance
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const throttling = useRef(false);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (!throttling.current) {
        throttling.current = true;
        callback(...args);

        setTimeout(() => {
          throttling.current = false;
        }, delay);
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook for implementing virtual scrolling for large lists
 */
export function useVirtualScroll({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
}: {
  items: any[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);

  const visibleItems = items.slice(startIndex, endIndex + 1).map((item, index) => ({
    item,
    index: startIndex + index,
    style: {
      position: 'absolute' as const,
      top: (startIndex + index) * itemHeight,
      height: itemHeight,
      width: '100%',
    },
  }));

  const totalHeight = items.length * itemHeight;

  return {
    visibleItems,
    totalHeight,
    setScrollTop,
  };
}

/**
 * Hook for monitoring memory usage (if available)
 */
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  }>({});

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000);

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

/**
 * Hook for image lazy loading with intersection observer
 */
export function useImageLazyLoad() {
  const [ref, setRef] = useState<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(ref);

    return () => observer.disconnect();
  }, [ref]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return {
    ref: setRef,
    isLoaded,
    isInView,
    handleLoad,
  };
}

/**
 * Performance optimization utilities
 */
export const performanceUtils = {
  /**
   * Preload critical resources
   */
  preloadResource: (href: string, as: string) => {
    if (typeof window === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    document.head.appendChild(link);
  },

  /**
   * Prefetch non-critical resources
   */
  prefetchResource: (href: string) => {
    if (typeof window === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  },

  /**
   * Measure and log performance marks
   */
  mark: (name: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(name);
    }
  },

  /**
   * Measure performance between two marks
   */
  measure: (name: string, startMark: string, endMark: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];

        if (process.env.NODE_ENV === 'development') {
          console.log(`Performance measure: ${name} = ${measure.duration.toFixed(2)}ms`);
        }

        return measure.duration;
      } catch (error) {
        console.warn('Performance measurement failed:', error);
        return 0;
      }
    }
    return 0;
  },

  /**
   * Clear performance marks and measures
   */
  clearMarks: (name?: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      if (name) {
        performance.clearMarks(name);
        performance.clearMeasures(name);
      } else {
        performance.clearMarks();
        performance.clearMeasures();
      }
    }
  },
};

/**
 * Bundle analyzer helper for development
 */
export const bundleAnalyzer = {
  /**
   * Log bundle size information
   */
  logBundleInfo: () => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      console.group('Bundle Analysis');

      // Log resource timing
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const jsResources = resources.filter(r => r.name.includes('.js'));
      const cssResources = resources.filter(r => r.name.includes('.css'));

      console.log('JavaScript resources:', jsResources.length);
      console.log('CSS resources:', cssResources.length);

      // Log largest resources
      const largestResources = resources
        .filter(r => r.transferSize > 0)
        .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
        .slice(0, 5);

      console.table(largestResources.map(r => ({
        name: r.name.split('/').pop(),
        size: `${Math.round((r.transferSize || 0) / 1024)}KB`,
        duration: `${Math.round(r.duration)}ms`,
      })));

      console.groupEnd();
    }
  },
};

/**
 * Core Web Vitals thresholds
 */
export const WEB_VITALS_THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
} as const;

/**
 * Get performance rating based on thresholds
 */
export function getPerformanceRating(
  metric: keyof typeof WEB_VITALS_THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITALS_THRESHOLDS[metric];

  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}