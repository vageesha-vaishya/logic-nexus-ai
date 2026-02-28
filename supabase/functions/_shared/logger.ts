import { SupabaseClient, createClient } from '@supabase/supabase-js';
declare const Deno: any;

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
  correlation_id?: string;
  component?: string;
  environment?: string;
  user_id?: string;
}

export class Logger {
  private supabase: SupabaseClient | null = null;
  private context: Record<string, any>;
  private correlationId?: string;
  private component: string;
  private environment: string;

  constructor(
    supabase: SupabaseClient | null,
    context: Record<string, any> = {},
    correlationId?: string,
    component: string = 'EdgeFunction'
  ) {
    this.supabase = supabase;
    this.context = context;
    this.correlationId = correlationId;
    this.component = component;
    // Default to production if not specified, can be overridden by env var
    this.environment = Deno.env.get('SUPABASE_DB_URL') ? 'production' : 'development';
  }

  private maskPII(text: string): string {
    if (!text) return text;
    // Email masking
    let masked = text.replace(/\b[\w.-]+@[\w.-]+\.\w{2,4}\b/g, '***@***.***');
    // Phone masking
    masked = masked.replace(/\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g, '***-***-$3');
    // Credit Card
    masked = masked.replace(/\b(?:\d[ -]*?){13,16}\b/g, '****-****-****-****');
    return masked;
  }

  private maskObject(obj: any): any {
    if (!obj) return obj;
    if (obj instanceof Error) {
      return {
        message: this.maskPII(obj.message),
        name: obj.name,
        stack: obj.stack,
        cause: obj.cause ? this.maskObject(obj.cause) : undefined
      };
    }
    if (typeof obj === 'string') return this.maskPII(obj);
    if (Array.isArray(obj)) return obj.map(i => this.maskObject(i));
    if (typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          newObj[key] = this.maskObject(obj[key]);
        }
      }
      return newObj;
    }
    return obj;
  }

  private async log(level: LogLevel, message: string, data?: Record<string, any>) {
    const safeMessage = this.maskPII(message);
    const safeData = this.maskObject({ ...this.context, ...data });

    const entry: LogEntry = {
      level,
      message: safeMessage,
      metadata: safeData,
      timestamp: new Date().toISOString(),
      correlation_id: this.correlationId,
      component: this.component,
      environment: this.environment,
    };

    // 1. Console Log (JSON structured for Supabase native logging)
    const logString = JSON.stringify(entry);
    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(logString);
        break;
      case LogLevel.WARNING:
        console.warn(logString);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(logString);
        break;
    }

    // 2. Persist to DB (for ERROR/CRITICAL or if explicitly requested)
    // We persist WARNING+ by default in this centralized system
    if (this.supabase && (level === LogLevel.ERROR || level === LogLevel.CRITICAL || level === LogLevel.WARNING)) {
      try {
        await this.supabase.from('system_logs').insert({
          level,
          message: safeMessage,
          metadata: safeData,
          correlation_id: this.correlationId,
          component: this.component,
          environment: this.environment,
          created_at: entry.timestamp
        });
      } catch (err) {
        console.error('Failed to write to system_logs:', err);
      }
    }

    // 3. Trigger Alert (Async, Fire-and-forget) for CRITICAL errors
    // Prevent infinite loops by excluding the alert-notifier itself
    if (this.supabase && level === LogLevel.CRITICAL && this.component !== 'alert-notifier') {
      // We don't await this to avoid blocking the main execution flow
      this.supabase.functions.invoke('alert-notifier', {
        body: entry
      }).then(({ error }) => {
        if (error) console.error('Failed to trigger alert-notifier:', error);
      }).catch(err => console.error('Exception triggering alert-notifier:', err));
    }
  }

  async debug(message: string, data?: Record<string, any>) {
    await this.log(LogLevel.DEBUG, message, data);
  }

  async info(message: string, data?: Record<string, any>) {
    await this.log(LogLevel.INFO, message, data);
  }

  async warn(message: string, data?: Record<string, any>) {
    await this.log(LogLevel.WARNING, message, data);
  }

  async error(message: string, data?: Record<string, any>) {
    await this.log(LogLevel.ERROR, message, data);
  }

  async critical(message: string, data?: Record<string, any>) {
    await this.log(LogLevel.CRITICAL, message, data);
  }

  child(additionalContext: Record<string, any>): Logger {
    return new Logger(this.supabase, { ...this.context, ...additionalContext }, this.correlationId, this.component);
  }

  getCorrelationId(): string | undefined {
    return this.correlationId;
  }
}

/**
 * Middleware wrapper for Deno.serve to automatically handle logging,
 * correlation IDs, and error catching.
 */
export const serveWithLogger = (
  handler: (req: Request, logger: Logger, supabase: SupabaseClient) => Promise<Response>,
  componentName: string = 'edge-function'
) => {
  Deno.serve(async (req: Request) => {
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
    
    // Initial logger (no DB access yet)
    let logger = new Logger(null, {
      method: req.method,
      url: req.url,
      component: componentName
    }, correlationId);

    try {
      // Initialize Supabase Client (Standard Pattern)
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Upgrade logger with DB client
      logger = new Logger(supabase, {
        method: req.method,
        url: req.url,
        component: componentName
      }, correlationId);

      await logger.info(`Request received: ${req.method} ${req.url}`);

      const response = await handler(req, logger, supabase);
      
      return response;
    } catch (error: any) {
      await logger.critical(`Unhandled Exception in ${componentName}`, { 
        error: error.message, 
        stack: error.stack 
      });
      
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', correlation_id: correlationId }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
};
