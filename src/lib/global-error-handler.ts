import { logger } from './logger';

/**
 * Initialize global error handlers to capture uncaught exceptions and unhandled rejections
 * that occur outside of the React component tree.
 */
export const initGlobalErrorHandlers = () => {
  // Capture global script errors
  window.onerror = (message, source, lineno, colno, error) => {
    logger.fatal('Uncaught Global Exception (window.onerror)', {
      message: typeof message === 'string' ? message : 'Script Error',
      source,
      lineno,
      colno,
      error: error?.message,
      stack: error?.stack,
      component: 'GlobalErrorHandler'
    });
    // Don't prevent default handler (console logging)
    return false;
  };

  // Capture unhandled promise rejections
  window.onunhandledrejection = (event) => {
    logger.error('Unhandled Promise Rejection', {
      reason: event.reason,
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      component: 'GlobalErrorHandler'
    });
  };

  // Capture resource loading errors (img, script, link, css) using capture phase
  window.addEventListener('error', (event) => {
    // Determine if it's a resource error (target is an element) vs a script error (target is window)
    const target = event.target as HTMLElement;
    if (target && target !== window && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'CSS')) {
      logger.error('Resource Loading Error', {
        tagName: target.tagName,
        src: (target as any).src || (target as any).href,
        outerHTML: target.outerHTML,
        component: 'ResourceLoader'
      });
    }
  }, true); // true = capture phase
  
  console.log('Global error handlers initialized');
};
