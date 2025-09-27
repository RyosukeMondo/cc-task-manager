/**
 * Performance optimization hooks
 * Implements Core Web Vitals monitoring and optimization strategies
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebVitals, performanceUtils, WEB_VITALS_THRESHOLDS } from './performance-monitor';

/**
 * Hook for optimizing images with lazy loading and responsive loading
 */
export function useOptimizedImage(src: string, options: {
  lazy?: boolean;
  sizes?: string;
  priority?: boolean;
} = {}) {
  const { lazy = true, sizes, priority = false } = options;
  const [isLoaded, setIsLoaded] = useState(!lazy);
  const [isInView, setIsInView] = useState(!lazy);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!lazy || priority) {
      setIsInView(true);
      return;
    }

    const observer = performanceUtils.createLazyImageObserver((entry) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.unobserve(entry.target);
      }
    });

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [lazy, priority]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return {
    imgRef,
    src: isInView ? src : undefined,
    isLoaded,
    isInView,
    onLoad: handleLoad,
    loading: lazy && !priority ? 'lazy' as const : 'eager' as const,
    sizes,
  };
}

/**
 * Hook for debounced search with performance optimization
 */
export function useOptimizedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const debouncedSearch = useCallback(
    performanceUtils.debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await searchFn(searchQuery);
        setResults(searchResults);
      } catch (err) {
        if (!abortControllerRef.current.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setResults([]);
        }
      } finally {
        if (!abortControllerRef.current.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, delay),
    [searchFn, delay]
  );

  useEffect(() => {
    debouncedSearch(query);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, debouncedSearch]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
  };
}

/**
 * Hook for optimizing scroll performance with throttling
 */
export function useOptimizedScroll(
  onScroll: (scrollInfo: { scrollY: number; scrollDirection: 'up' | 'down' }) => void,
  throttleMs: number = 16 // ~60fps
) {
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    const scrollDirection = scrollY > lastScrollY.current ? 'down' : 'up';

    if (!ticking.current) {
      requestAnimationFrame(() => {
        onScroll({ scrollY, scrollDirection });
        lastScrollY.current = scrollY;
        ticking.current = false;
      });
      ticking.current = true;
    }
  }, [onScroll]);

  const throttledScroll = useCallback(
    performanceUtils.throttle(handleScroll, throttleMs),
    [handleScroll, throttleMs]
  );

  useEffect(() => {
    window.addEventListener('scroll', throttledScroll, { passive: true });
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [throttledScroll]);
}

/**
 * Hook for monitoring and optimizing component performance
 */
export function usePerformanceOptimization(componentName: string) {
  const { metrics, getMetric } = useWebVitals();
  const renderCount = useRef(0);
  const [performanceIssues, setPerformanceIssues] = useState<string[]>([]);

  useEffect(() => {
    renderCount.current += 1;

    // Check for performance issues
    const issues: string[] = [];

    // Check Core Web Vitals
    const lcp = getMetric('LCP');
    const fid = getMetric('FID');
    const cls = getMetric('CLS');

    if (lcp && lcp.value > WEB_VITALS_THRESHOLDS.LCP.NEEDS_IMPROVEMENT) {
      issues.push('Largest Contentful Paint is slow - consider optimizing images and reducing render-blocking resources');
    }

    if (fid && fid.value > WEB_VITALS_THRESHOLDS.FID.NEEDS_IMPROVEMENT) {
      issues.push('First Input Delay is high - consider reducing JavaScript execution time');
    }

    if (cls && cls.value > WEB_VITALS_THRESHOLDS.CLS.NEEDS_IMPROVEMENT) {
      issues.push('Cumulative Layout Shift detected - ensure proper sizing for dynamic content');
    }

    // Check render frequency
    if (renderCount.current > 10) {
      const avgRenderTime = performance.now() / renderCount.current;
      if (avgRenderTime > 16) { // 60fps threshold
        issues.push(`${componentName} is rendering slowly (${avgRenderTime.toFixed(2)}ms average)`);
      }
    }

    setPerformanceIssues(issues);
  });

  return {
    metrics: Array.from(metrics.values()),
    renderCount: renderCount.current,
    performanceIssues,
    optimizationSuggestions: {
      shouldUseVirtualization: renderCount.current > 100,
      shouldMemoize: renderCount.current > 50,
      shouldLazyLoad: true,
    },
  };
}

/**
 * Hook for adaptive loading based on network conditions
 */
export function useAdaptiveLoading() {
  const [networkInfo, setNetworkInfo] = useState({
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false,
  });

  useEffect(() => {
    const updateNetworkInfo = () => {
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        setNetworkInfo({
          effectiveType: conn.effectiveType || '4g',
          downlink: conn.downlink || 10,
          rtt: conn.rtt || 100,
          saveData: conn.saveData || false,
        });
      }
    };

    updateNetworkInfo();

    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      conn.addEventListener('change', updateNetworkInfo);
      return () => conn.removeEventListener('change', updateNetworkInfo);
    }
  }, []);

  const getLoadingStrategy = useCallback(() => {
    const isSlowConnection = networkInfo.effectiveType === '2g' ||
                           networkInfo.effectiveType === 'slow-2g' ||
                           networkInfo.saveData;

    return {
      shouldPreload: !isSlowConnection,
      imageQuality: isSlowConnection ? 'low' : 'high',
      enableLazyLoading: true,
      enableVirtualization: isSlowConnection,
      maxConcurrentRequests: isSlowConnection ? 2 : 6,
      shouldCompress: isSlowConnection,
    };
  }, [networkInfo]);

  return {
    networkInfo,
    loadingStrategy: getLoadingStrategy(),
    isSlowConnection: performanceUtils.isSlowConnection(),
  };
}

/**
 * Hook for reduced motion preferences and animation optimization
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return {
    prefersReducedMotion,
    getAnimationConfig: useCallback((duration: number) => ({
      duration: prefersReducedMotion ? 0 : duration,
      easing: prefersReducedMotion ? 'linear' : 'ease-out',
    }), [prefersReducedMotion]),
  };
}

/**
 * Hook for battery-aware performance optimization
 */
export function useBatteryOptimization() {
  const [batteryInfo, setBatteryInfo] = useState({
    charging: true,
    level: 1,
    chargingTime: 0,
    dischargingTime: Infinity,
  });

  useEffect(() => {
    const updateBatteryInfo = (battery: any) => {
      setBatteryInfo({
        charging: battery.charging,
        level: battery.level,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      });
    };

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        updateBatteryInfo(battery);

        battery.addEventListener('chargingchange', () => updateBatteryInfo(battery));
        battery.addEventListener('levelchange', () => updateBatteryInfo(battery));
      });
    }
  }, []);

  const shouldOptimizeForBattery = !batteryInfo.charging && batteryInfo.level < 0.2;

  return {
    batteryInfo,
    shouldOptimizeForBattery,
    getOptimizationStrategy: useCallback(() => ({
      reduceAnimations: shouldOptimizeForBattery,
      lowerRefreshRate: shouldOptimizeForBattery,
      disableBackgroundSync: shouldOptimizeForBattery,
      reducePolling: shouldOptimizeForBattery,
    }), [shouldOptimizeForBattery]),
  };
}