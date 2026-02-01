import { onCLS, onINP, onLCP, onTTFB, onFCP, Metric } from 'web-vitals';
import { logger, LogLevel } from './logger';

/**
 * Performance Monitor
 * Captures Web Vitals and reports them to the system logs.
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private initialized = false;

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public initialize() {
    if (this.initialized) return;
    
    // Check if running in browser
    if (typeof window === 'undefined') return;

    try {
      onCLS(this.logMetric);
      onINP(this.logMetric);
      onLCP(this.logMetric);
      onTTFB(this.logMetric);
      onFCP(this.logMetric); // First Contentful Paint
      
      this.initialized = true;
      logger.info('Performance monitoring initialized');
    } catch (error) {
      logger.error('Failed to initialize performance monitoring', { error });
    }
  }

  private logMetric = (metric: Metric) => {
    // Determine log level based on metric rating (good, needs-improvement, poor)
    let level = LogLevel.INFO;
    
    // Web Vitals thresholds
    // CLS: > 0.1 (needs improvement), > 0.25 (poor)
    // LCP: > 2500ms (needs improvement), > 4000ms (poor)
    // INP: > 200ms (needs improvement), > 500ms (poor)
    
    // Simple rating logic
    // (Note: metric.rating is available in newer web-vitals versions)
    
    const context = {
        name: metric.name,
        value: metric.value,
        delta: metric.delta,
        id: metric.id,
        rating: (metric as any).rating || 'unknown',
        navigationType: (metric as any).navigationType || 'unknown',
        component: 'PerformanceMonitor'
    };

    if ((metric as any).rating === 'poor') {
        level = LogLevel.WARNING;
    }

    logger.log(level, `Web Vital: ${metric.name}`, context);
  };
}

export const performanceMonitor = PerformanceMonitor.getInstance();
