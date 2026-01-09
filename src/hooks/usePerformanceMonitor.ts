import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function usePerformanceMonitor(componentName: string, threshold = 100) {
  const startTime = useRef(performance.now());
  const rendered = useRef(false);

  useEffect(() => {
    if (!rendered.current) {
      const endTime = performance.now();
      const duration = endTime - startTime.current;
      
      console.log(`[Performance] ${componentName} rendered in ${duration.toFixed(2)}ms`);
      
      if (duration > threshold) {
        console.warn(`[Performance] ${componentName} took longer than ${threshold}ms to render`);
      }
      
      rendered.current = true;
    }
  });
}
