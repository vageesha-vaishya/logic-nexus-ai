/**
 * AMRO Events Producer Unit Tests
 * Tests for Kafka event publishing with mocked KafkaJS
 */

import { AmroEventsProducer } from '../src/events/amro-events.producer';
import { AmroEventType } from '../src/events/amro-events.types';
import { Kafka, Producer } from 'kafkajs';

// Mock KafkaJS
jest.mock('kafkajs');

describe('AmroEventsProducer', () => {
  let mockProducer: jest.Mocked<Producer>;
  let mockKafka: jest.Mocked<Kafka>;

  beforeEach(() => {
    // Clear singleton instance
    (AmroEventsProducer as any).instance = undefined;

    // Setup mock producer
    mockProducer = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Setup mock Kafka client
    mockKafka = {
      producer: jest.fn().mockReturnValue(mockProducer),
    } as any;

    // Mock the Kafka constructor
    (Kafka as jest.Mock).mockImplementation(() => mockKafka);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize producer successfully', async () => {
      const producer = AmroEventsProducer.getInstance();
      await producer.initialize();

      expect(Kafka).toHaveBeenCalled();
      expect(mockKafka.producer).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotent: true,
          maxInFlightRequests: 5,
        }),
      );
      expect(mockProducer.connect).toHaveBeenCalled();
      expect(producer.isReady()).toBe(true);
    });

    it('should not initialize twice', async () => {
      const producer = AmroEventsProducer.getInstance();
      await producer.initialize();
      await producer.initialize(); // Second call

      expect(mockProducer.connect).toHaveBeenCalledTimes(1);
    });

    it('should be a singleton', () => {
      const producer1 = AmroEventsProducer.getInstance();
      const producer2 = AmroEventsProducer.getInstance();

      expect(producer1).toBe(producer2);
    });
  });

  describe('Work Order Events', () => {
    beforeEach(async () => {
      const producer = AmroEventsProducer.getInstance();
      await producer.initialize();
      jest.clearAllMocks();
    });

    it('should publish work order created event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishWorkOrderEvent(
        'tenant-123',
        'user-456',
        AmroEventType.WORK_ORDER_CREATED,
        {
          id: 'wp-789',
          work_package_id: 'wp-789',
          work_package_number: 'WP-001',
          aircraft_id: 'ac-123',
          title: 'Line Maintenance',
          status: 'planning',
          maintenance_type: 'line',
          estimated_cost: 5000,
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'amro.work-orders',
          messages: expect.arrayContaining([
            expect.objectContaining({
              key: 'tenant-123',
              headers: expect.objectContaining({
                'event_type': 'amro.work_order.created',
              }),
            }),
          ]),
        }),
      );
    });

    it('should publish work order updated event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishWorkOrderEvent(
        'tenant-123',
        'user-456',
        AmroEventType.WORK_ORDER_UPDATED,
        {
          id: 'wp-789',
          work_package_id: 'wp-789',
          work_package_number: 'WP-001',
          aircraft_id: 'ac-123',
          title: 'Line Maintenance - Updated',
          status: 'approved',
          maintenance_type: 'line',
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'amro.work-orders',
          messages: expect.arrayContaining([
            expect.objectContaining({
              headers: expect.objectContaining({
                'event_type': 'amro.work_order.updated',
              }),
            }),
          ]),
        }),
      );
    });

    it('should publish work order deleted event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishWorkOrderEvent(
        'tenant-123',
        'user-456',
        AmroEventType.WORK_ORDER_DELETED,
        {
          id: 'wp-789',
          work_package_id: 'wp-789',
          work_package_number: 'WP-001',
          aircraft_id: 'ac-123',
          title: 'Line Maintenance',
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'amro.work-orders',
          messages: expect.arrayContaining([
            expect.objectContaining({
              headers: expect.objectContaining({
                'event_type': 'amro.work_order.deleted',
              }),
            }),
          ]),
        }),
      );
    });
  });

  describe('Task Events', () => {
    beforeEach(async () => {
      const producer = AmroEventsProducer.getInstance();
      await producer.initialize();
      jest.clearAllMocks();
    });

    it('should publish task created event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishTaskEvent(
        'tenant-123',
        'user-456',
        AmroEventType.TASK_CREATED,
        {
          id: 'task-789',
          task_id: 'task-789',
          task_number: 'TASK-001',
          work_package_id: 'wp-123',
          title: 'Inspect hydraulics',
          status: 'pending',
          sequence_number: 1,
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'amro.tasks',
          messages: expect.arrayContaining([
            expect.objectContaining({
              key: 'tenant-123',
              headers: expect.objectContaining({
                'event_type': 'amro.task.created',
              }),
            }),
          ]),
        }),
      );
    });

    it('should publish task updated event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishTaskEvent(
        'tenant-123',
        'user-456',
        AmroEventType.TASK_UPDATED,
        {
          id: 'task-789',
          task_id: 'task-789',
          task_number: 'TASK-001',
          work_package_id: 'wp-123',
          title: 'Inspect hydraulics',
          status: 'in_progress',
          assigned_to: 'mechanic-123',
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'amro.tasks',
          messages: expect.arrayContaining([
            expect.objectContaining({
              headers: expect.objectContaining({
                'event_type': 'amro.task.updated',
              }),
            }),
          ]),
        }),
      );
    });

    it('should publish task deleted event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishTaskEvent(
        'tenant-123',
        'user-456',
        AmroEventType.TASK_DELETED,
        {
          id: 'task-789',
          task_id: 'task-789',
          task_number: 'TASK-001',
          work_package_id: 'wp-123',
          title: 'Inspect hydraulics',
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'amro.tasks',
          messages: expect.arrayContaining([
            expect.objectContaining({
              headers: expect.objectContaining({
                'event_type': 'amro.task.deleted',
              }),
            }),
          ]),
        }),
      );
    });

    it('should publish task started event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishTaskEvent(
        'tenant-123',
        'user-456',
        AmroEventType.TASK_STARTED,
        {
          id: 'task-789',
          task_id: 'task-789',
          task_number: 'TASK-001',
          work_package_id: 'wp-123',
          title: 'Inspect hydraulics',
          status: 'in_progress',
          assigned_to: 'mechanic-123',
          started_at: new Date().toISOString(),
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'amro.tasks',
          messages: expect.arrayContaining([
            expect.objectContaining({
              key: 'tenant-123',
              headers: expect.objectContaining({
                'event_type': 'amro.task.started',
              }),
            }),
          ]),
        }),
      );
    });

    it('should publish task completed event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishTaskEvent(
        'tenant-123',
        'user-456',
        AmroEventType.TASK_COMPLETED,
        {
          id: 'task-789',
          task_id: 'task-789',
          task_number: 'TASK-001',
          work_package_id: 'wp-123',
          title: 'Inspect hydraulics',
          status: 'completed',
          assigned_to: 'mechanic-123',
          completed_at: new Date().toISOString(),
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'amro.tasks',
          messages: expect.arrayContaining([
            expect.objectContaining({
              headers: expect.objectContaining({
                'event_type': 'amro.task.completed',
              }),
            }),
          ]),
        }),
      );
    });
  });

  describe('Event Format', () => {
    beforeEach(async () => {
      const producer = AmroEventsProducer.getInstance();
      await producer.initialize();
      jest.clearAllMocks();
    });

    it('should include idempotency key in headers', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishWorkOrderEvent(
        'tenant-123',
        'user-456',
        AmroEventType.WORK_ORDER_CREATED,
        {
          id: 'wp-789',
          work_package_id: 'wp-789',
          work_package_number: 'WP-001',
          aircraft_id: 'ac-123',
          title: 'Line Maintenance',
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      const call = mockProducer.send.mock.calls[0][0];
      expect(call.messages[0].headers).toHaveProperty('idempotency_key');
      expect(call.messages[0].headers?.idempotency_key).toMatch(/^tenant-123-/);
    });

    it('should partition by tenant ID', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishWorkOrderEvent(
        'tenant-abc',
        'user-456',
        AmroEventType.WORK_ORDER_CREATED,
        {
          id: 'wp-789',
          work_package_id: 'wp-789',
          work_package_number: 'WP-001',
          aircraft_id: 'ac-123',
          title: 'Line Maintenance',
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      const call = mockProducer.send.mock.calls[0][0];
      expect(call.messages[0].key).toBe('tenant-abc');
    });

    it('should serialize event data to JSON', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishWorkOrderEvent(
        'tenant-123',
        'user-456',
        AmroEventType.WORK_ORDER_CREATED,
        {
          id: 'wp-789',
          work_package_id: 'wp-789',
          work_package_number: 'WP-001',
          aircraft_id: 'ac-123',
          title: 'Line Maintenance',
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      const call = mockProducer.send.mock.calls[0][0];
      const message = call.messages[0];
      const payload = JSON.parse(message.value as string);

      expect(payload.event_type).toMatch(/^amro\./);
      expect(payload.event_id).toBeDefined();
      expect(payload.timestamp).toBeDefined();
      expect(payload.tenant_id).toBe('tenant-123');
      expect(payload.user_id).toBe('user-456');
      expect(payload.idempotency_key).toBeDefined();
      expect(payload.data).toBeDefined();
    });
  });

  describe('Maintenance Events', () => {
    beforeEach(async () => {
      const producer = AmroEventsProducer.getInstance();
      await producer.initialize();
      jest.clearAllMocks();
    });

    it('should publish maintenance event recorded event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishMaintenanceEvent(
        'tenant-123',
        'user-456',
        {
          id: 'maint-123456',
          task_id: 'task-789',
          task_number: 'TASK-001',
          work_package_id: 'wp-123',
          executed_by: 'mechanic-123',
          evidence_captured: true,
          event_type: 'execution',
          sign_off_date: new Date().toISOString(),
          notes: 'Component replaced successfully',
          recorded_at: new Date().toISOString(),
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'amro.maintenance-events',
          messages: expect.arrayContaining([
            expect.objectContaining({
              key: 'tenant-123',
              headers: expect.objectContaining({
                'event_type': 'amro.maintenance_event.recorded',
              }),
            }),
          ]),
        }),
      );
    });

    it('should include task and execution details in maintenance event', async () => {
      const producer = AmroEventsProducer.getInstance();

      producer.publishMaintenanceEvent(
        'tenant-123',
        'user-456',
        {
          id: 'maint-123456',
          task_id: 'task-789',
          task_number: 'TASK-001',
          work_package_id: 'wp-123',
          executed_by: 'mechanic-123',
          evidence_captured: true,
          event_type: 'sign_off',
          sign_off_date: new Date().toISOString(),
          notes: 'All checks passed',
          recorded_at: new Date().toISOString(),
        },
      );

      // Let promises settle
      await new Promise(resolve => setImmediate(resolve));

      const call = mockProducer.send.mock.calls[0][0];
      const message = call.messages[0];
      const payload = JSON.parse(message.value as string);

      expect(payload.event_type).toBe('amro.maintenance_event.recorded');
      expect(payload.data.task_id).toBe('task-789');
      expect(payload.data.task_number).toBe('TASK-001');
      expect(payload.data.executed_by).toBe('mechanic-123');
      expect(payload.data.evidence_captured).toBe(true);
      expect(payload.data.event_type).toBe('sign_off');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const producer = AmroEventsProducer.getInstance();
      await producer.initialize();
      jest.clearAllMocks();
    });

    it('should not throw on publish error (fire-and-forget)', (done) => {
      const producer = AmroEventsProducer.getInstance();
      mockProducer.send.mockRejectedValue(new Error('Kafka error'));

      expect(() => {
        producer.publishWorkOrderEvent(
          'tenant-123',
          'user-456',
          AmroEventType.WORK_ORDER_CREATED,
          {
            id: 'wp-789',
            work_package_id: 'wp-789',
            work_package_number: 'WP-001',
            aircraft_id: 'ac-123',
            title: 'Line Maintenance',
          },
        );
      }).not.toThrow();

      done();
    });

    it('should handle invalid event type gracefully', () => {
      const producer = AmroEventsProducer.getInstance();

      // Invalid event type should not throw
      expect(() => {
        producer.publishWorkOrderEvent(
          'tenant-123',
          'user-456',
          'invalid.event.type' as any,
          { id: 'wp-789' },
        );
      }).not.toThrow();
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      const producer = AmroEventsProducer.getInstance();
      await producer.initialize();
    });

    it('should disconnect producer gracefully', async () => {
      const producer = AmroEventsProducer.getInstance();
      await producer.shutdown();

      expect(mockProducer.disconnect).toHaveBeenCalled();
      expect(producer.isReady()).toBe(false);
    });

    it('should handle shutdown when not connected', async () => {
      (AmroEventsProducer as any).instance = undefined;
      const producer = AmroEventsProducer.getInstance();

      // Should not throw
      await producer.shutdown();
    });
  });
});
