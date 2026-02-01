import { useMemo } from 'react';
import { logger } from '@/lib/logger';

export function useSystemLogger(componentName: string) {
  return useMemo(() => ({
    debug: (message: string, data?: Record<string, any>) => 
      logger.debug(message, { ...data, component: componentName }),
    info: (message: string, data?: Record<string, any>) => 
      logger.info(message, { ...data, component: componentName }),
    warn: (message: string, data?: Record<string, any>) => 
      logger.warn(message, { ...data, component: componentName }),
    error: (message: string, data?: Record<string, any>) => 
      logger.error(message, { ...data, component: componentName }),
    critical: (message: string, data?: Record<string, any>) => 
      logger.critical(message, { ...data, component: componentName }),
  }), [componentName]);
}
