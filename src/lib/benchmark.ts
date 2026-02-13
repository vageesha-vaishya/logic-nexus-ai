import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

interface BenchmarkResult {
  componentName: string;
  mountTime: number;
  renderCount: number;
  lastRenderTime: number;
}

export const useBenchmark = (componentName: string) => {
  const mountTime = useRef(performance.now());
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  useEffect(() => {
    const now = performance.now();
    const duration = now - mountTime.current;
    
    logger.info(`[Benchmark] ${componentName} mounted`, {
      component: componentName,
      duration: `${duration.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });

    return () => {
      const unmountTime = performance.now();
      logger.info(`[Benchmark] ${componentName} unmounted`, {
        component: componentName,
        lifetime: `${(unmountTime - mountTime.current).toFixed(2)}ms`,
        totalRenders: renderCount.current
      });
    };
  }, [componentName]);

  useEffect(() => {
    const now = performance.now();
    renderCount.current++;
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    if (renderCount.current > 1) { // Skip logging first render as it's covered by mount
      logger.debug(`[Benchmark] ${componentName} re-rendered`, {
        component: componentName,
        renderCount: renderCount.current,
        timeSinceLastRender: `${timeSinceLastRender.toFixed(2)}ms`
      });
    }
  });
};

export const measureAsyncFn = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const end = performance.now();
    logger.info(`[Benchmark] ${name} completed`, {
      operation: name,
      duration: `${(end - start).toFixed(2)}ms`,
      success: true
    });
    return result;
  } catch (error) {
    const end = performance.now();
    logger.error(`[Benchmark] ${name} failed`, {
      operation: name,
      duration: `${(end - start).toFixed(2)}ms`,
      success: false,
      error
    });
    throw error;
  }
};
