/**
 * AMRO Events Producer
 * Kafka producer for publishing work order and task events
 * Fire-and-forget pattern with logging for errors
 */

import { Kafka, Producer, logLevel } from 'kafkajs';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import {
  AmroEvent,
  AmroEventType,
  AmroWorkOrderEvent,
  AmroTaskEvent,
  AmroMaintenanceEvent,
} from './amro-events.types';

/**
 * Configuration constants
 */
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'amro-api-producer';
const KAFKA_TOPIC_WORK_ORDERS = process.env.KAFKA_TOPIC_WORK_ORDERS || 'amro.work-orders';
const KAFKA_TOPIC_TASKS = process.env.KAFKA_TOPIC_TASKS || 'amro.tasks';
const KAFKA_TOPIC_MAINTENANCE_EVENTS = process.env.KAFKA_TOPIC_MAINTENANCE_EVENTS || 'amro.maintenance-events';
const KAFKA_PRODUCER_TIMEOUT = parseInt(process.env.KAFKA_PRODUCER_TIMEOUT || '5000', 10);

/**
 * AMRO Events Producer
 * Singleton pattern for Kafka producer
 */
export class AmroEventsProducer {
  private static instance: AmroEventsProducer;
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private isConnected = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AmroEventsProducer {
    if (!AmroEventsProducer.instance) {
      AmroEventsProducer.instance = new AmroEventsProducer();
    }
    return AmroEventsProducer.instance;
  }

  /**
   * Initialize Kafka connection
   * Call this once on application startup
   */
  async initialize(): Promise<void> {
    if (this.isConnected) {
      logger.warn('AmroEventsProducer already initialized');
      return;
    }

    try {
      this.kafka = new Kafka({
        clientId: KAFKA_CLIENT_ID,
        brokers: KAFKA_BROKERS,
        logLevel: logLevel.ERROR, // Only log errors to reduce noise
        requestTimeout: KAFKA_PRODUCER_TIMEOUT,
        connectionTimeout: KAFKA_PRODUCER_TIMEOUT,
        retry: {
          initialRetryTime: 100,
          retries: 3,
          maxRetryTime: 30000,
          multiplier: 2,
        },
      });

      this.producer = this.kafka.producer({
        // Idempotency configuration
        idempotent: true,
        maxInFlightRequests: 5,
      });

      await this.producer.connect();
      this.isConnected = true;
      logger.info('AmroEventsProducer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AmroEventsProducer', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Publish work order event
   * Fire-and-forget pattern - errors are logged but don't block
   */
  publishWorkOrderEvent(
    tenantId: string,
    userId: string,
    eventType: AmroEventType,
    workPackageData: Record<string, any>,
  ): void {
    if (!this.producer) {
      logger.warn('AmroEventsProducer not initialized, skipping event publication');
      return;
    }

    // Verify event type is work order related
    if (
      !eventType.startsWith('amro.work_order')
    ) {
      logger.error('Invalid event type for work order event', { eventType });
      return;
    }

    const event: AmroWorkOrderEvent = {
      event_type: eventType as
        | AmroEventType.WORK_ORDER_CREATED
        | AmroEventType.WORK_ORDER_UPDATED
        | AmroEventType.WORK_ORDER_DELETED,
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      user_id: userId,
      idempotency_key: `${tenantId}-${workPackageData.id || workPackageData.work_package_id}-${randomUUID()}`,
      data: workPackageData as any,
    };

    // Fire-and-forget publish
    this.publishEvent(KAFKA_TOPIC_WORK_ORDERS, event).catch((error) => {
      logger.error('Failed to publish work order event', {
        eventType,
        tenantId,
        workPackageId: workPackageData.id || workPackageData.work_package_id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Publish task event
   * Fire-and-forget pattern - errors are logged but don't block
   */
  publishTaskEvent(
    tenantId: string,
    userId: string,
    eventType: AmroEventType,
    taskData: Record<string, any>,
  ): void {
    if (!this.producer) {
      logger.warn('AmroEventsProducer not initialized, skipping event publication');
      return;
    }

    // Verify event type is task related
    if (!eventType.startsWith('amro.task')) {
      logger.error('Invalid event type for task event', { eventType });
      return;
    }

    const event: AmroTaskEvent = {
      event_type: eventType as
        | AmroEventType.TASK_CREATED
        | AmroEventType.TASK_UPDATED
        | AmroEventType.TASK_DELETED
        | AmroEventType.TASK_STARTED
        | AmroEventType.TASK_COMPLETED,
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      user_id: userId,
      idempotency_key: `${tenantId}-${taskData.id || taskData.task_id}-${randomUUID()}`,
      data: taskData as any,
    };

    // Fire-and-forget publish
    this.publishEvent(KAFKA_TOPIC_TASKS, event).catch((error) => {
      logger.error('Failed to publish task event', {
        eventType,
        tenantId,
        taskId: taskData.id || taskData.task_id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Publish maintenance event
   * Fire-and-forget pattern - errors are logged but don't block
   */
  publishMaintenanceEvent(
    tenantId: string,
    userId: string,
    maintenanceData: Record<string, any>,
  ): void {
    if (!this.producer) {
      logger.warn('AmroEventsProducer not initialized, skipping event publication');
      return;
    }

    const event: AmroMaintenanceEvent = {
      event_type: AmroEventType.MAINTENANCE_EVENT_RECORDED,
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      user_id: userId,
      idempotency_key: `${tenantId}-${maintenanceData.id || maintenanceData.task_id}-${randomUUID()}`,
      data: maintenanceData as any,
    };

    // Fire-and-forget publish
    this.publishEvent(KAFKA_TOPIC_MAINTENANCE_EVENTS, event).catch((error) => {
      logger.error('Failed to publish maintenance event', {
        tenantId,
        taskId: maintenanceData.task_id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Internal method to publish event to Kafka
   * Serializes event to JSON and publishes to topic
   */
  private async publishEvent(topic: string, event: AmroEvent): Promise<void> {
    if (!this.producer) {
      throw new Error('Producer not initialized');
    }

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: event.tenant_id, // Partition by tenant for ordering
            value: JSON.stringify(event),
            headers: {
              'event_type': event.event_type,
              'event_id': event.event_id,
              'idempotency_key': event.idempotency_key,
              'timestamp': event.timestamp,
            },
          },
        ],
        timeout: KAFKA_PRODUCER_TIMEOUT,
      });
    } catch (error) {
      // Re-throw to be caught by caller's fire-and-forget handler
      throw error;
    }
  }

  /**
   * Graceful shutdown
   * Call this on application termination
   */
  async shutdown(): Promise<void> {
    if (this.producer && this.isConnected) {
      try {
        await this.producer.disconnect();
        this.isConnected = false;
        logger.info('AmroEventsProducer disconnected gracefully');
      } catch (error) {
        logger.error('Error disconnecting AmroEventsProducer', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Check if producer is connected
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

/**
 * Export singleton instance for easy access
 */
export const amroEventsProducer = AmroEventsProducer.getInstance();
