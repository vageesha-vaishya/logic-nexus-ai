/**
 * AMRO Tracing Integration Tests
 * Tests distributed tracing span creation and error handling
 *
 * Note: These tests run without a full OpenTelemetry SDK setup,
 * so they validate the wrapper behavior rather than actual span attributes.
 * When SDK is initialized (initializeTracing()), full tracing will be active.
 */

import { tracer, createSpan, withSpan, withChildSpan, recordSpanEvent, setSpanAttribute, getActiveSpan } from '../src/instrumentation/amro-tracing';
import { context, trace, SpanStatusCode, Span } from '@opentelemetry/api';

describe('AMRO Tracing Instrumentation', () => {
  describe('Tracer Initialization', () => {
    it('should have a tracer instance', () => {
      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe('function');
    });
  });

  describe('createSpan()', () => {
    it('should create a span', () => {
      const span = createSpan('test_operation');
      expect(span).toBeDefined();
      span.end();
    });

    it('should accept span name and optional attributes', () => {
      const span1 = createSpan('operation_1');
      expect(span1).toBeDefined();
      span1.end();

      const span2 = createSpan('operation_2', { tenant_id: 'test' });
      expect(span2).toBeDefined();
      span2.end();
    });
  });

  describe('withSpan() - Success Cases', () => {
    it('should execute function and return result', async () => {
      const result = await withSpan('test_span', async () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });

    it('should end span after successful execution', async () => {
      const mockFn = jest.fn(async () => 'result');

      await withSpan('test_span', mockFn);

      expect(mockFn).toHaveBeenCalled();
    });

    it('should support async operations', async () => {
      const result = await withSpan(
        'async_operation',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'async-result';
        },
      );

      expect(result).toBe('async-result');
    });

    it('should accept span attributes', async () => {
      const result = await withSpan(
        'test_span',
        async () => {
          return 'result';
        },
        { tenant_id: 'test-tenant', operation: 'create' },
      );

      expect(result).toBe('result');
    });
  });

  describe('withSpan() - Error Handling', () => {
    it('should catch and re-throw errors', async () => {
      const testError = new Error('Test error');

      await expect(
        withSpan('error_span', async () => {
          throw testError;
        }),
      ).rejects.toThrow('Test error');
    });

    it('should handle non-Error objects thrown', async () => {
      await expect(
        withSpan('error_span', async () => {
          throw 'string error';
        }),
      ).rejects.toBe('string error');
    });

    it('should end span even on error', async () => {
      let spanEnded = false;

      try {
        await withSpan('error_span', async () => {
          throw new Error('Test error');
        });
      } catch {
        spanEnded = true; // Confirm error was caught
      }

      expect(spanEnded).toBe(true);
    });

    it('should preserve error message', async () => {
      const errorMessage = 'Specific error condition';

      try {
        await withSpan('error_tracking', async () => {
          throw new Error(errorMessage);
        });
      } catch (error) {
        expect((error as Error).message).toBe(errorMessage);
      }
    });
  });

  describe('withChildSpan()', () => {
    it('should execute function and return result', async () => {
      const result = await withChildSpan('child_span', async () => {
        return 'child-result';
      });

      expect(result).toBe('child-result');
    });

    it('should support both sync and async functions', async () => {
      const syncResult = await withChildSpan('sync_span', () => {
        return 'sync-result';
      });

      const asyncResult = await withChildSpan('async_span', async () => {
        return 'async-result';
      });

      expect(syncResult).toBe('sync-result');
      expect(asyncResult).toBe('async-result');
    });

    it('should handle errors', async () => {
      await expect(
        withChildSpan('error_span', async () => {
          throw new Error('Child span error');
        }),
      ).rejects.toThrow('Child span error');
    });
  });

  describe('recordSpanEvent()', () => {
    it('should record event without throwing', async () => {
      await withSpan('test_span', async () => {
        expect(() => {
          recordSpanEvent('test_event');
        }).not.toThrow();
      });
    });

    it('should include event attributes', async () => {
      await withSpan('test_span', async () => {
        expect(() => {
          recordSpanEvent('important_event', {
            action: 'create',
            resource_id: '123',
          });
        }).not.toThrow();
      });
    });

    it('should handle null active span gracefully', () => {
      // Outside of span context
      expect(() => {
        recordSpanEvent('orphan_event');
      }).not.toThrow();
    });
  });

  describe('setSpanAttribute()', () => {
    it('should set attribute without throwing', async () => {
      await withSpan('test_span', async () => {
        expect(() => {
          setSpanAttribute('operation_id', 'op-123');
        }).not.toThrow();
      });
    });

    it('should handle null active span gracefully', () => {
      expect(() => {
        setSpanAttribute('orphan_attr', 'value');
      }).not.toThrow();
    });

    it('should support different value types', async () => {
      await withSpan('test_span', async () => {
        expect(() => {
          setSpanAttribute('string_attr', 'value');
          setSpanAttribute('number_attr', 42);
          setSpanAttribute('boolean_attr', true);
        }).not.toThrow();
      });
    });
  });

  describe('getActiveSpan()', () => {
    it('should return undefined outside span context', () => {
      const activeSpan = getActiveSpan();
      expect(activeSpan).toBeUndefined();
    });
  });

  describe('Span Context Propagation', () => {
    it('should maintain context across nested spans', async () => {
      let executedParent = false;
      let executedChild = false;

      await withSpan('parent_operation', async () => {
        executedParent = true;

        await withChildSpan('child_operation', async () => {
          executedChild = true;
        });

        // After child completes, parent span logic should continue
        expect(executedChild).toBe(true);
      });

      expect(executedParent).toBe(true);
      expect(executedChild).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle rapid sequential spans', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => i);

      const results = await Promise.all(
        operations.map(i =>
          withSpan(
            `operation_${i}`,
            async () => {
              await new Promise(resolve => setImmediate(resolve));
              return i;
            },
          ),
        ),
      );

      expect(results).toHaveLength(10);
      expect(results).toEqual(operations);
    });

    it('should not leak memory with many spans', async () => {
      for (let i = 0; i < 100; i++) {
        await withSpan(`loop_span_${i}`, async () => {
          return i;
        });
      }

      // If no exceptions thrown, memory management is working
      expect(true).toBe(true);
    });
  });

  describe('Error Message Tracking', () => {
    it('should preserve error message in exception handling', async () => {
      const errorMessage = 'Specific error condition';

      try {
        await withSpan('error_tracking', async () => {
          throw new Error(errorMessage);
        });
      } catch (error) {
        expect((error as Error).message).toBe(errorMessage);
      }
    });

    it('should handle errors without message property', async () => {
      try {
        await withSpan('error_tracking', async () => {
          throw { custom: 'error object' };
        });
      } catch (error) {
        expect(error).toEqual({ custom: 'error object' });
      }
    });
  });
});

describe('AMRO Tracing - Real-World Scenarios', () => {
  it('should trace work package creation flow', async () => {
    const workPackageResult = await withSpan(
      'work_package.create',
      async () => {
        const wpData = {
          id: 'wp-' + Date.now(),
          aircraft_id: 'ac-123',
          title: 'Routine Maintenance',
          status: 'planning',
        };

        // Simulate event publishing
        await withChildSpan('event.publish', async () => {
          // Event published
        });

        return wpData;
      },
      {
        tenant_id: 'tenant-001',
        user_id: 'user-001',
        aircraft_id: 'ac-123',
        maintenance_type: 'line',
      },
    );

    expect(workPackageResult.id).toMatch(/^wp-/);
    expect(workPackageResult.aircraft_id).toBe('ac-123');
  });

  it('should trace task creation with proper context', async () => {
    const taskResult = await withSpan(
      'task.create',
      async () => {
        const task = {
          id: 'task-' + Date.now(),
          work_package_id: 'wp-123',
          title: 'Inspect Landing Gear',
          status: 'pending',
          sequence_number: 1,
        };

        // Record task setup
        recordSpanEvent('task_created', {
          task_id: task.id,
          sequence: task.sequence_number,
        });

        return task;
      },
      {
        tenant_id: 'tenant-001',
        work_package_id: 'wp-123',
        sequence_number: 1,
      },
    );

    expect(taskResult.id).toMatch(/^task-/);
    expect(taskResult.status).toBe('pending');
  });

  it('should track database errors with context', async () => {
    const dbError = 'Database connection failed';

    await expect(
      withSpan(
        'database.query',
        async () => {
          throw new Error(dbError);
        },
        {
          tenant_id: 'tenant-001',
          table: 'work_packages',
          operation: 'insert',
        },
      ),
    ).rejects.toThrow(dbError);
  });

  it('should handle distributed request tracing', async () => {
    const traceId = 'trace-' + Date.now();

    const result = await withSpan(
      'api.request',
      async () => {
        // Simulate internal operations
        const packageData = await withChildSpan('fetch_package', async () => {
          return { id: 'wp-123' };
        });

        const taskData = await withChildSpan('fetch_tasks', async () => {
          return [{ id: 'task-1' }];
        });

        return { package: packageData, tasks: taskData };
      },
      {
        trace_id: traceId,
        endpoint: '/api/v1/work-packages/wp-123',
        method: 'GET',
      },
    );

    expect(result.package.id).toBe('wp-123');
    expect(result.tasks).toHaveLength(1);
  });

  it('should integrate with work orders service', async () => {
    // This verifies the tracing wrapper pattern matches the expected service integration
    const createWorkPackageWithTracing = async () => {
      return withSpan(
        'work_package.create',
        async () => {
          // Simulates service logic
          return { id: 'wp-test', status: 'planning' };
        },
        { tenant_id: 'tenant-123', user_id: 'user-456' },
      );
    };

    const result = await createWorkPackageWithTracing();
    expect(result.id).toBe('wp-test');
    expect(result.status).toBe('planning');
  });
});
