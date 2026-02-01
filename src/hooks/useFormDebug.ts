import { useDebug } from './useDebug';
import { useEffect, useRef } from 'react';

export const useFormDebug = (moduleName: string, formName: string, watchValues?: any) => {
  const debug = useDebug(moduleName, formName);
  const initialValuesRef = useRef<any>(null);

  // Log mount
  useEffect(() => {
    if (watchValues && !initialValuesRef.current) {
        initialValuesRef.current = watchValues;
        debug.info('Form Mounted', { initialValues: watchValues });
    }
  }, []);

  return {
    debug, // Expose raw debug instance if needed
    logSubmit: (values: any) => {
      debug.info('Form Submission Initiated', { 
        values,
        timestamp: new Date().toISOString()
      });
    },
    logValidationErrors: (errors: any) => {
      debug.warn('Form Validation Errors', { 
        errors,
        timestamp: new Date().toISOString()
      });
    },
    logResponse: (response: any, metadata?: any) => {
      debug.info('Form Submission Response', { 
        response,
        ...metadata,
        timestamp: new Date().toISOString()
      });
    },
    logError: (error: any, metadata?: any) => {
      debug.error('Form Submission Error', { 
        error,
        ...metadata,
        timestamp: new Date().toISOString()
      });
    }
  };
};
