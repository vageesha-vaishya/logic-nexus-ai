import { useEffect, useMemo } from 'react';
import { debugStore } from '@/lib/debug-store';
import { logger } from '@/lib/logger';

export const useDebug = (moduleName: string, formName?: string) => {
  const fullPath = formName ? `${moduleName}:${formName}` : moduleName;

  // Auto-register in debug store
  useEffect(() => {
    debugStore.registerScope(fullPath);
    
    // Legacy registration
    const config = debugStore.getConfig();
    if (config.modules[moduleName] === undefined) {
      debugStore.registerModule(moduleName);
    }
    if (formName && config.forms[formName] === undefined) {
      debugStore.registerForm(formName);
    }
  }, [moduleName, formName, fullPath]);

  const debug = useMemo(() => {
    const isEnabled = () => {
      const config = debugStore.getConfig();
      if (!config.enabled) return false;

      // Check hierarchy: All parts of the path must be enabled
      // e.g. "Sales", "Sales:Quotes", "Sales:Quotes:Form" must all be true
      const parts = fullPath.split(':');
      let currentPath = '';
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}:${part}` : part;
        if (config.scopes[currentPath] === false) return false;
      }
      return true;
    };

    const createLogger = (level: 'debug' | 'info' | 'warn' | 'error') => (message: string, data?: any) => {
      if (!isEnabled()) return;

      const entry = {
        type: 'app',
        timestamp: new Date().toISOString(),
        module: moduleName,
        form: formName,
        scope: fullPath, // Add scope to log entry
        message,
        data,
        level
      };
      debugStore.addLog(entry);
      
      // Mirror to system logger
      const logPrefix = `[${fullPath}]`;
      const logData = { ...data, module: moduleName, scope: fullPath, fromDebug: true };
      
      if (level === 'error') logger.error(`${logPrefix} ${message}`, logData);
      else if (level === 'warn') logger.warn(`${logPrefix} ${message}`, logData);
      else if (level === 'info') logger.info(`${logPrefix} ${message}`, logData);
      else logger.debug(`${logPrefix} ${message}`, logData);
    };

    return {
      log: createLogger('debug'),
      debug: createLogger('debug'),
      info: createLogger('info'),
      warn: createLogger('warn'),
      error: createLogger('error'),
      group: (label: string) => createLogger('info')(`[GROUP START] ${label}`),
      groupEnd: () => createLogger('info')(`[GROUP END]`),
      isEnabled
    };
  }, [moduleName, formName, fullPath]);

  return debug;
};
