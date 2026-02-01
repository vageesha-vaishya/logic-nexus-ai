import { logger } from './logger';
import { onCLS, onINP, onLCP, onFCP, onTTFB, Metric } from 'web-vitals';

/**
 * Initialize Performance Monitoring using Web Vitals
 * Logs LCP, INP, CLS, FCP, TTFB to the system logs
 */
export const initPerformanceMonitoring = () => {
  const logMetric = (metric: Metric) => {
    // Log as INFO normally, but WARN if values are poor
    // Thresholds: https://web.dev/vitals/
    let level = 'INFO';
    let isPoor = false;

    switch (metric.name) {
      case 'CLS':
        if (metric.value > 0.1) isPoor = true; // Needs Improvement > 0.1, Poor > 0.25
        break;
      case 'LCP':
        if (metric.value > 2500) isPoor = true; // Needs Improvement > 2.5s, Poor > 4.0s
        break;
      case 'INP':
        if (metric.value > 200) isPoor = true; // Needs Improvement > 200ms, Poor > 500ms
        break;
    }

    if (isPoor) level = 'WARNING';

    logger.log(level as any, `Web Vital: ${metric.name}`, {
      metric: metric.name,
      value: metric.value,
      rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      delta: metric.delta,
      id: metric.id,
      component: 'PerformanceMonitor'
    });
  };

  // Register Web Vitals listeners
  onCLS(logMetric);
  onINP(logMetric);
  onLCP(logMetric);
  onFCP(logMetric);
  onTTFB(logMetric);

  // Monitor Long Tasks (Main Thread Blocking)
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 100) { // Log tasks taking > 100ms
            logger.warn('Long Task Detected', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
              entryType: entry.entryType,
              component: 'PerformanceMonitor'
            });
          }
        });
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Observer might not be supported
    }
  }

  logger.info('Performance monitoring initialized');
};
