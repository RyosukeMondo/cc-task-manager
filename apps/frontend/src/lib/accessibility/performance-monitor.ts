/**
 * Performance monitoring utilities for Core Web Vitals
 * Implements performance optimization and monitoring for WCAG 2.1 AA compliance
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Core Web Vitals thresholds
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: {
    GOOD: 2500,
    NEEDS_IMPROVEMENT: 4000,
  },
  FID: {
    GOOD: 100,
    NEEDS_IMPROVEMENT: 300,
  },
  CLS: {
    GOOD: 0.1,
    NEEDS_IMPROVEMENT: 0.25,
  },
  FCP: {
    GOOD: 1800,
    NEEDS_IMPROVEMENT: 3000,
  },
  TTFB: {
    GOOD: 800,
    NEEDS_IMPROVEMENT: 1800,
  },
} as const;

/**
 * Performance metric types
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

/**
 * Performance observer callback type
 */
type PerformanceCallback = (metric: PerformanceMetric) => void;

/**
 * Hook for monitoring Core Web Vitals
 */
export function useWebVitals(onMetric?: PerformanceCallback) {
  const metricsRef = useRef<Map<string, PerformanceMetric>>(new Map());

  const reportMetric = useCallback((metric: PerformanceMetric) => {
    metricsRef.current.set(metric.name, metric);
    onMetric?.(metric);
  }, [onMetric]);

  useEffect(() => {
    // Largest Contentful Paint (LCP)
    const observeLCP = () => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;

          if (lastEntry) {
            const value = lastEntry.startTime;
            reportMetric({
              name: 'LCP',
              value,
              rating: value <= WEB_VITALS_THRESHOLDS.LCP.GOOD
                ? 'good'
                : value <= WEB_VITALS_THRESHOLDS.LCP.NEEDS_IMPROVEMENT
                ? 'needs-improvement'
                : 'poor',
              timestamp: Date.now(),
            });
          }
        });

        try {
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
          // Fallback for browsers that don't support LCP
          console.warn('LCP measurement not supported');
        }

        return () => observer.disconnect();
      }
    };

    // First Input Delay (FID)
    const observeFID = () => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            const value = entry.processingStart - entry.startTime;
            reportMetric({
              name: 'FID',
              value,
              rating: value <= WEB_VITALS_THRESHOLDS.FID.GOOD
                ? 'good'
                : value <= WEB_VITALS_THRESHOLDS.FID.NEEDS_IMPROVEMENT
                ? 'needs-improvement'
                : 'poor',
              timestamp: Date.now(),
            });
          });
        });

        try {
          observer.observe({ entryTypes: ['first-input'] });
        } catch (e) {
          console.warn('FID measurement not supported');
        }

        return () => observer.disconnect();
      }
    };

    // Cumulative Layout Shift (CLS)
    const observeCLS = () => {
      if ('PerformanceObserver' in window) {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              reportMetric({
                name: 'CLS',
                value: clsValue,
                rating: clsValue <= WEB_VITALS_THRESHOLDS.CLS.GOOD
                  ? 'good'
                  : clsValue <= WEB_VITALS_THRESHOLDS.CLS.NEEDS_IMPROVEMENT
                  ? 'needs-improvement'
                  : 'poor',
                timestamp: Date.now(),
              });
            }
          });
        });

        try {
          observer.observe({ entryTypes: ['layout-shift'] });
        } catch (e) {
          console.warn('CLS measurement not supported');
        }

        return () => observer.disconnect();
      }
    };

    // First Contentful Paint (FCP)
    const observeFCP = () => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.name === 'first-contentful-paint') {
              const value = entry.startTime;
              reportMetric({
                name: 'FCP',
                value,
                rating: value <= WEB_VITALS_THRESHOLDS.FCP.GOOD
                  ? 'good'
                  : value <= WEB_VITALS_THRESHOLDS.FCP.NEEDS_IMPROVEMENT
                  ? 'needs-improvement'
                  : 'poor',
                timestamp: Date.now(),
              });
            }
          });
        });

        try {
          observer.observe({ entryTypes: ['paint'] });
        } catch (e) {
          console.warn('FCP measurement not supported');
        }

        return () => observer.disconnect();
      }
    };

    // Initialize observers
    const cleanupFunctions = [
      observeLCP(),
      observeFID(),
      observeCLS(),
      observeFCP(),
    ].filter(Boolean);

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup?.());
    };
  }, [reportMetric]);

  return {
    metrics: metricsRef.current,
    getMetric: (name: string) => metricsRef.current.get(name),
    getAllMetrics: () => Array.from(metricsRef.current.values()),
  };
}

/**
 * Hook for monitoring component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStartRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  useEffect(() => {
    renderStartRef.current = performance.now();
    renderCountRef.current += 1;

    return () => {
      const renderTime = performance.now() - renderStartRef.current;

      // Log slow renders (> 16ms for 60fps)
      if (renderTime > 16) {
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }

      // Performance mark for DevTools
      if ('performance' in window && 'mark' in performance) {
        performance.mark(`${componentName}-render-${renderCountRef.current}`);
      }
    };
  });

  return {
    renderCount: renderCountRef.current,
    markRender: (label: string) => {
      if ('performance' in window && 'mark' in performance) {
        performance.mark(`${componentName}-${label}`);
      }
    },
  };
}

/**
 * Memory usage monitoring
 */
export function useMemoryMonitoring() {
  const getMemoryInfo = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  }, []);

  const [memoryInfo, setMemoryInfo] = useState(getMemoryInfo());

  useEffect(() => {
    const interval = setInterval(() => {
      setMemoryInfo(getMemoryInfo());
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [getMemoryInfo]);

  return memoryInfo;
}

/**
 * Network performance monitoring
 */
export function useNetworkMonitoring() {
  const [connectionInfo, setConnectionInfo] = useState<{
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }>({});

  useEffect(() => {
    const updateConnection = () => {
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        setConnectionInfo({
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
          rtt: conn.rtt,
          saveData: conn.saveData,
        });
      }
    };

    updateConnection();

    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      conn.addEventListener('change', updateConnection);
      return () => conn.removeEventListener('change', updateConnection);
    }
  }, []);

  return connectionInfo;
}

/**
 * Performance optimization utilities
 */
export const performanceUtils = {
  /**
   * Debounce function for performance optimization
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  /**
   * Throttle function for performance optimization
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Measure function execution time
   */
  measureExecutionTime<T extends (...args: any[]) => any>(
    func: T,
    label?: string
  ): T {
    return ((...args: Parameters<T>) => {
      const start = performance.now();
      const result = func(...args);
      const end = performance.now();

      const executionTime = end - start;
      const name = label || func.name || 'anonymous';

      if (executionTime > 10) {
        console.warn(`Slow execution detected in ${name}: ${executionTime.toFixed(2)}ms`);
      }

      return result;
    }) as T;
  },

  /**
   * Check if user prefers reduced motion
   */
  prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  /**
   * Check if user is on a slow connection
   */
  isSlowConnection(): boolean {
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      return conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';
    }
    return false;
  },

  /**
   * Lazy load images with intersection observer
   */
  createLazyImageObserver(
    onIntersect: (entry: IntersectionObserverEntry) => void
  ): IntersectionObserver {
    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onIntersect(entry);
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.01,
      }
    );
  },
};

