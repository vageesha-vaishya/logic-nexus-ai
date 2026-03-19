/**
 * AMRO Tracing Instrumentation
 * OpenTelemetry setup for distributed tracing of work order operations
 * Supports both span creation and context propagation for distributed tracing
 */

import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';

/**
 * Get the tracer instance for AMRO service
 * Uses the global OpenTelemetry API to get a tracer
 */
export const tracer = trace.getTracer('amro-service', '0.1.0');

/**
 * Create a span with service and version attributes
 * @param name - Span name (e.g., 'work_package.create')
 * @param attributes - Optional span attributes for context
 * @returns A new span with service metadata
 */
export function createSpan(name: string, attributes?: Record<string, any>): Span {
  return tracer.startSpan(name, {
    attributes: {
      'service.name': 'amro',
      'service.version': process.env.VERSION || '0.1.0',
      'service.namespace': 'amro-api',
      ...attributes,
    },
  });
}

/**
 * Execute an async function within a span context
 * Automatically handles span lifecycle (start, record status, end)
 * Records exceptions and properly sets error status on failure
 *
 * Usage:
 * ```typescript
 * const result = await withSpan(
 *   'work_package.create',
 *   async () => {
 *     // Your async operation
 *     return workOrdersService.createWorkPackage(tenantId, data);
 *   },
 *   { tenant_id: tenantId, user_id: userId }
 * );
 * ```
 *
 * @param spanName - Name of the span (e.g., 'work_package.create')
 * @param fn - Async function to execute within the span
 * @param attributes - Optional span attributes
 * @returns Promise resolving to the function result
 * @throws Re-throws any exception from the wrapped function
 */
export async function withSpan<T>(
  spanName: string,
  fn: () => Promise<T>,
  attributes?: Record<string, any>,
): Promise<T> {
  const span = createSpan(spanName, attributes);

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      // Record the exception in the span
      if (error instanceof Error) {
        span.recordException(error);
      } else {
        span.recordException(new Error(String(error)));
      }

      // Set error status on span
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

      // Re-throw the error for the caller to handle
      throw error;
    } finally {
      // Always end the span, even on error
      span.end();
    }
  });
}

/**
 * Create a child span within an existing span context
 * Used for breaking down operations into smaller traced units
 *
 * @param spanName - Name of the child span
 * @param fn - Sync or async function to execute
 * @param attributes - Optional span attributes
 * @returns Promise resolving to the function result
 */
export async function withChildSpan<T>(
  spanName: string,
  fn: () => T | Promise<T>,
  attributes?: Record<string, any>,
): Promise<T> {
  const span = createSpan(spanName, attributes);

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
      } else {
        span.recordException(new Error(String(error)));
      }

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Add an event to the current active span
 * Useful for recording important milestones within an operation
 *
 * @param name - Event name
 * @param attributes - Optional event attributes
 */
export function recordSpanEvent(name: string, attributes?: Record<string, any>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set an attribute on the current active span
 * Used to add context during operation execution
 *
 * @param key - Attribute key
 * @param value - Attribute value
 */
export function setSpanAttribute(key: string, value: any): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}

/**
 * Get the current active span for manual manipulation if needed
 * Returns null if no span is active
 *
 * @returns The current active span or undefined
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}
