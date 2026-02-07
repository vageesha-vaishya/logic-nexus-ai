import { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from "@sentry/react";
import { debugStore } from './debug-store';

// Client-side Logger for React/Browser
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  FATAL = 'FATAL',
}

// Map legacy 'warn' to 'WARNING' if needed, but for now we enforce the new enum
export const LogLevelAlias = {
  WARN: LogLevel.WARNING,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  correlation_id?: string;
  component?: string;
  environment?: string;
  user_id?: string;
}

const isProduction = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.PROD : false;
const FLUSH_INTERVAL = 5000; // 5 seconds
const BATCH_SIZE = 10;

class LoggerService {
  private static instance: LoggerService;
  private context: Record<string, any> = {};
  private supabase: SupabaseClient | null = null;
  private buffer: LogEntry[] = [];
  private flushTimer: any = null;
  private correlationId: string | undefined;
  private isInternalLogging: boolean = false;

  private constructor() {
    // Capture environment metadata
    if (typeof window !== 'undefined') {
      this.context = {
        userAgent: window.navigator.userAgent,
        language: window.navigator.language,
        platform: window.navigator.platform,
        screen: {
          width: window.screen.width,
          height: window.screen.height,
        },
        url: window.location.href,
      };
      
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);
      window.addEventListener('beforeunload', () => this.flush(true));
      
      // Listen for URL changes (SPA navigation)
      window.addEventListener('popstate', () => {
        this.context.url = window.location.href;
      });
    }
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  initialize(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Intercept global console methods to capture logs from third-party libraries
   * or parts of the app that don't use the logger directly.
   */
  enableConsoleInterception() {
    if (typeof window === 'undefined') return;

    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    console.log = (...args) => {
      if (!this.isInternalLogging) {
        this.log(LogLevel.INFO, args.map(String).join(' '), { component: 'Console', args });
      }
      originalConsole.log.apply(console, args);
    };

    console.warn = (...args) => {
      if (!this.isInternalLogging) {
        this.log(LogLevel.WARNING, args.map(String).join(' '), { component: 'Console', args });
      }
      originalConsole.warn.apply(console, args);
    };

    console.error = (...args) => {
      if (!this.isInternalLogging) {
        this.log(LogLevel.ERROR, args.map(String).join(' '), { component: 'Console', args });
      }
      originalConsole.error.apply(console, args);
    };
    
    // We intentionally don't intercept console.debug to reduce noise
    
    this.info('Console interception enabled');
  }

  setContext(context: Record<string, any>) {
    this.context = { ...this.context, ...context };
  }

  setCorrelationId(id: string) {
    this.correlationId = id;
  }

  getCorrelationId(): string {
    if (!this.correlationId) {
      this.correlationId = crypto.randomUUID();
    }
    return this.correlationId;
  }

  private maskPII(text: string): string {
    if (!text) return text;
    // Email masking
    let masked = text.replace(/\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g, '***@***.***');
    // Phone masking (simple US/International format)
    masked = masked.replace(/\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g, '***-***-$3');
    // Credit Card (simple 13-16 digit)
    masked = masked.replace(/\b(?:\d[ -]*?){13,16}\b/g, '****-****-****-****');
    return masked;
  }

  private maskObject(obj: any, depth = 0, seen = new WeakSet()): any {
    if (!obj) return obj;
    if (depth > 5) return '[Depth Limit Exceeded]'; // Prevent deep recursion
    
    if (typeof obj === 'string') return this.maskPII(obj);
    
    if (typeof obj === 'object') {
      if (seen.has(obj)) return '[Circular Reference]';
      seen.add(obj);

      if (Array.isArray(obj)) {
        return obj.map(i => this.maskObject(i, depth + 1, seen));
      }

      const newObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // Mask sensitive keys
          if (/password|secret|token|auth|key|pass/i.test(key)) {
            newObj[key] = '***MASKED***';
          } else {
            newObj[key] = this.maskObject(obj[key], depth + 1, seen);
          }
        }
      }
      return newObj;
    }
    return obj;
  }

  private async log(level: LogLevel, message: string, data?: Record<string, any>) {
    // Extract stack trace from Error objects if present
    if (data) {
      if (data.error instanceof Error) {
        data = {
          ...data,
          error: data.error.message,
          stack: data.error.stack,
          error_name: data.error.name
        };
      }
      // Handle direct Error object passed as data (edge case)
      else if (data instanceof Error) {
         const err = data as Error;
         data = {
           message: err.message,
           stack: err.stack,
           name: err.name
         };
      }
    }

    // Apply PII Masking
    const safeMessage = this.maskPII(message);
    
    // Safety check for data masking to prevent main thread blocking
    let safeData;
    try {
      safeData = this.maskObject({ ...this.context, ...data });
    } catch (e) {
      console.error('Error masking log data:', e);
      safeData = { error: 'Failed to mask data' };
    }

    const entry: LogEntry = {
      level,
      message: safeMessage,
      context: safeData,
      timestamp: new Date().toISOString(),
      correlation_id: this.correlationId,
      component: data?.component || 'Client',
      environment: isProduction ? 'production' : 'development',
    };

    // Console output
    this.isInternalLogging = true;
    try {
      const style = this.getStyle(level);
      const consoleArgs = [
        `%c[${level}] ${message}`,
        style,
        entry.context || ''
      ];
      
      // Use appropriate console method
      switch (level) {
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
        case LogLevel.FATAL:
          console.error(...consoleArgs);
          break;
        case LogLevel.WARNING:
          console.warn(...consoleArgs);
          break;
        default:
          // In production, suppress DEBUG logs in console unless forced
          if (!isProduction || level !== LogLevel.DEBUG) {
            console.log(...consoleArgs);
          }
      }
    } finally {
      this.isInternalLogging = false;
    }

    // Queue for persistence
    this.buffer.push(entry);

    // Sentry Integration for Errors
    if ([LogLevel.ERROR, LogLevel.CRITICAL, LogLevel.FATAL].includes(level)) {
      const sentryLevel = (level === LogLevel.CRITICAL ? 'fatal' : level.toLowerCase()) as Sentry.SeverityLevel;
      Sentry.withScope((scope) => {
        scope.setLevel(sentryLevel);
        
        // Add context data as extras
        if (entry.context) {
          scope.setExtras(entry.context);
        }
        
        // Add component tag
        if (entry.component) {
          scope.setTag('component', entry.component);
        }

        // Reconstruct Error object if stack trace is available for better reporting
        if (entry.context?.stack) {
          const simulatedError = new Error(entry.message);
          simulatedError.stack = entry.context.stack;
          if (entry.context.error_name) {
            simulatedError.name = entry.context.error_name;
          }
          Sentry.captureException(simulatedError);
        } else {
          Sentry.captureMessage(entry.message);
        }
      });
    }

    // Forward to DebugStore for real-time UI (unless it originated from useDebug)
    // We check both the data object and context for the flag
    const isFromDebug = data?.fromDebug || (entry.context && entry.context.fromDebug);
    
    if (!isFromDebug) {
      debugStore.addLog({
        type: 'app',
        timestamp: entry.timestamp,
        module: entry.component || 'System',
        form: undefined,
        message: entry.message,
        data: entry.context,
        level: entry.level.toLowerCase()
      });
    }

    if (this.buffer.length >= BATCH_SIZE) {
      this.flush();
    }

    // 3. Trigger Alert for CRITICAL (Immediate, Fire-and-forget)
    if (this.supabase && level === LogLevel.CRITICAL) {
      // Map 'context' to 'metadata' to match server-side logger structure
      const alertPayload = {
        ...entry,
        metadata: entry.context 
      };
      
      this.supabase.functions.invoke('alert-notifier', {
        body: alertPayload
      }).then(({ error }) => {
        if (error) console.error('Failed to trigger alert-notifier:', error);
      }).catch(err => console.error('Exception triggering alert-notifier:', err));
    }
  }

  private async flush(isUrgent = false) {
    if (this.buffer.length === 0 || !this.supabase) return;

    // specific handling for user_id to satisfy RLS
    let userId: string | undefined;
    try {
      const { data } = await this.supabase.auth.getSession();
      userId = data.session?.user?.id;
    } catch (e) {
      // ignore auth errors during flush
    }

    const chunk = [...this.buffer];
    this.buffer = [];

    // Transform to DB schema
    const rows = chunk.map(log => ({
      level: log.level,
      message: log.message,
      metadata: log.context,
      correlation_id: log.correlation_id,
      component: log.component,
      environment: log.environment,
      created_at: log.timestamp,
      user_id: userId, // Explicitly provide user_id for RLS check
    }));

    try {
      if (isUrgent && navigator.sendBeacon) {
        // Beacon API is better for unload, but requires a dedicated endpoint usually.
        // For Supabase, we might use fetch with keepalive if supported.
        // Since Supabase client uses fetch, we rely on it.
        // We can't easily force keepalive on supabase client calls without custom fetch.
        // Best effort:
        await this.supabase.from('system_logs').insert(rows);
      } else {
        await this.supabase.from('system_logs').insert(rows);
      }
    } catch (err) {
      console.error('Failed to flush logs to Supabase', err);
      // Re-queue failed logs? Maybe, but risk of loop. For now, drop.
    }
  }

  private getStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return 'color: #9E9E9E';
      case LogLevel.INFO: return 'color: #2196F3';
      case LogLevel.WARNING: return 'color: #FFC107';
      case LogLevel.ERROR: return 'color: #F44336; font-weight: bold';
      case LogLevel.CRITICAL: return 'color: #FFFFFF; background-color: #F44336; font-weight: bold; padding: 2px 4px; border-radius: 2px;';
      case LogLevel.FATAL: return 'color: #FFFFFF; background-color: #D32F2F; font-weight: 900; padding: 4px 6px; border-radius: 2px; border: 1px solid #B71C1C;';
      default: return '';
    }
  }

  debug(message: string, data?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, any>) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, any>) {
    this.log(LogLevel.WARNING, message, data);
  }

  error(message: string, data?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, data);
  }

  critical(message: string, data?: Record<string, any>) {
    this.log(LogLevel.CRITICAL, message, data);
  }

  fatal(message: string, data?: Record<string, any>) {
    this.log(LogLevel.FATAL, message, data);
  }
}

export const logger = LoggerService.getInstance();
