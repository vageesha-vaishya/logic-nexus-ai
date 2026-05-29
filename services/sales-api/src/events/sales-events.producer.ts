// Phase 4 Sales Step 4 — sales-api Kafka producer.
// Mirrors the shape of crm-api/src/events/crm-events.producer.ts but
// emits to a sales-namespaced topic (default sales.leads) and uses
// SalesEventType. The producer is deliberately a per-service singleton
// rather than shared with crm-api — keeps the event contract scoped to
// the publishing domain.

import { Kafka, Producer, logLevel } from 'kafkajs';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { SalesEventType, SalesLeadEvent } from './sales-events.types.js';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const KAFKA_CLIENT_ID = process.env.SALES_API_KAFKA_CLIENT_ID || 'sales-api-producer';
const KAFKA_TOPIC_SALES_LEADS = process.env.KAFKA_TOPIC_SALES_LEADS || 'sales.leads';
const KAFKA_PRODUCER_TIMEOUT = parseInt(process.env.KAFKA_PRODUCER_TIMEOUT || '5000', 10);

export class SalesEventsProducer {
  private static instance: SalesEventsProducer;
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): SalesEventsProducer {
    if (!SalesEventsProducer.instance) {
      SalesEventsProducer.instance = new SalesEventsProducer();
    }
    return SalesEventsProducer.instance;
  }

  async initialize(): Promise<void> {
    if (this.isConnected) {
      return;
    }
    this.kafka = new Kafka({
      clientId: KAFKA_CLIENT_ID,
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.ERROR,
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
      idempotent: true,
      maxInFlightRequests: 5,
    });
    await this.producer.connect();
    this.isConnected = true;
  }

  publishLeadEvent(
    tenantId: string,
    franchiseId: string | null,
    userId: string,
    eventType: SalesEventType,
    leadData: Record<string, unknown>,
  ): void {
    if (!this.producer) {
      logger.warn('SalesEventsProducer not initialized, skipping event publication');
      return;
    }

    const event: SalesLeadEvent = {
      event_type: eventType,
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
      user_id: userId,
      idempotency_key: `${tenantId}-${leadData.id ?? randomUUID()}-${randomUUID()}`,
      data: leadData,
    };

    this.publishEvent(KAFKA_TOPIC_SALES_LEADS, event).catch((error) => {
      logger.error('Failed to publish lead event', {
        eventType,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private async publishEvent(topic: string, event: SalesLeadEvent): Promise<void> {
    if (!this.producer) {
      throw new Error('Producer not initialized');
    }
    await this.producer.send({
      topic,
      messages: [
        {
          key: event.tenant_id,
          value: JSON.stringify(event),
          headers: {
            event_type: event.event_type,
            event_id: event.event_id,
            idempotency_key: event.idempotency_key,
            timestamp: event.timestamp,
          },
        },
      ],
    });
  }

  async shutdown(): Promise<void> {
    if (this.producer && this.isConnected) {
      await this.producer.disconnect();
      this.producer = null;
      this.kafka = null;
      this.isConnected = false;
    }
  }
}

export const salesEventsProducer = SalesEventsProducer.getInstance();
