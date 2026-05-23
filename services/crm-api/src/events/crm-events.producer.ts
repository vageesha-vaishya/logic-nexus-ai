import { Kafka, Producer, logLevel } from 'kafkajs';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { CrmEventType, CrmLeadEvent } from './crm-events.types.js';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'crm-api-producer';
const KAFKA_TOPIC_CRM_LEADS = process.env.KAFKA_TOPIC_CRM_LEADS || 'crm.leads';
const KAFKA_PRODUCER_TIMEOUT = parseInt(process.env.KAFKA_PRODUCER_TIMEOUT || '5000', 10);

export class CrmEventsProducer {
  private static instance: CrmEventsProducer;
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): CrmEventsProducer {
    if (!CrmEventsProducer.instance) {
      CrmEventsProducer.instance = new CrmEventsProducer();
    }
    return CrmEventsProducer.instance;
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
        multiplier: 2
      }
    });
    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5
    });
    await this.producer.connect();
    this.isConnected = true;
  }

  publishLeadEvent(
    tenantId: string,
    franchiseId: string | null,
    userId: string,
    eventType: CrmEventType,
    leadData: Record<string, unknown>
  ): void {
    if (!this.producer) {
      logger.warn('CrmEventsProducer not initialized, skipping event publication');
      return;
    }

    const event: CrmLeadEvent = {
      event_type: eventType,
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
      user_id: userId,
      idempotency_key: `${tenantId}-${leadData.id ?? randomUUID()}-${randomUUID()}`,
      data: leadData
    };

    this.publishEvent(KAFKA_TOPIC_CRM_LEADS, event).catch((error) => {
      logger.error('Failed to publish lead event', {
        eventType,
        tenantId,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }

  private async publishEvent(topic: string, event: CrmLeadEvent): Promise<void> {
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
            timestamp: event.timestamp
          }
        }
      ]
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

export const crmEventsProducer = CrmEventsProducer.getInstance();
