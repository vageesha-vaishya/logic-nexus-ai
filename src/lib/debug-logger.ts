import { debugStore } from '@/lib/debug-store';
import { logger } from '@/lib/logger';

export const createDebugLogger = (moduleName: string, formName?: string) => {
    // Register module/form in debug store if not present
    const config = debugStore.getConfig();
    if (config.modules[moduleName] === undefined) {
        debugStore.registerModule(moduleName);
    }
    if (formName && config.forms[formName] === undefined) {
        debugStore.registerForm(formName);
    }

    const createLogger = (level: 'debug' | 'info' | 'warn' | 'error') => (message: string, data?: any) => {
      const config = debugStore.getConfig();
      if (!config.enabled) return;

      const isModuleEnabled = config.modules[moduleName];
      const isFormEnabled = formName ? config.forms[formName] : true;

      if (isModuleEnabled) {
        if (!formName || isFormEnabled) {
          const entry = {
            type: 'app',
            timestamp: new Date().toISOString(),
            module: moduleName,
            form: formName,
            message,
            data,
            level
          } as const;
          
          debugStore.addLog(entry);
          
          // Mirror to system logger with appropriate level
          const logPrefix = `[${moduleName}${formName ? `:${formName}` : ''}]`;
          if (level === 'error') logger.error(`${logPrefix} ${message}`, { ...data, module: moduleName });
          else if (level === 'warn') logger.warn(`${logPrefix} ${message}`, data);
          else if (level === 'info') logger.info(`${logPrefix} ${message}`, data);
          else logger.debug(`${logPrefix} ${message}`, data);
        }
      }
    };

    return {
      log: createLogger('debug'),
      debug: createLogger('debug'),
      info: createLogger('info'),
      warn: createLogger('warn'),
      error: createLogger('error'),
      group: (label: string) => createLogger('info')(`[GROUP START] ${label}`),
      groupEnd: () => createLogger('info')(`[GROUP END]`),
      isEnabled: () => {
          const config = debugStore.getConfig();
          return config.enabled && (config.modules[moduleName] === true) && (!formName || config.forms[formName] === true);
      }
    };
};
