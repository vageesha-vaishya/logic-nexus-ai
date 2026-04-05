import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { resolveUimAccess } from './_shared';

type WebhookAdapter = {
  adapter_id: string;
  provider: string;
  target_url: string;
  secret_ref: string;
  subscribed_events: string[];
  active: boolean;
  created_at: string;
};

const adapters = new Map<string, WebhookAdapter>();

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function assertRequired(value: unknown, field: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseEvents(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    enforceHttps(req);
    enforceRateLimit(req);
    const access = await resolveUimAccess(req, ctx);

    if (req.method === 'GET') {
      res.status(200).json({
        version: 'v2',
        interface: 'uim-webhook-adapter-framework',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: access.tenantId,
          adapters: [...adapters.values()],
        },
      });
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const body = parseBody(req.body);
    const action = String(body.action || '').trim().toLowerCase();

    if (action === 'register-adapter') {
      const adapterId = assertRequired(body.adapter_id, 'adapter_id');
      const provider = assertRequired(body.provider, 'provider');
      const targetUrl = assertRequired(body.target_url, 'target_url');
      const secretRef = assertRequired(body.secret_ref, 'secret_ref');
      const subscribedEvents = parseEvents(body.subscribed_events);
      const nextAdapter: WebhookAdapter = {
        adapter_id: adapterId,
        provider,
        target_url: targetUrl,
        secret_ref: secretRef,
        subscribed_events: subscribedEvents,
        active: true,
        created_at: new Date().toISOString(),
      };
      adapters.set(adapterId, nextAdapter);
      res.status(200).json({
        version: 'v2',
        interface: 'uim-webhook-adapter-framework',
        correlationId: ctx.correlationId,
        output: {
          action: 'register-adapter',
          adapter: nextAdapter,
        },
      });
      return;
    }

    if (action === 'dispatch-event') {
      const adapterId = assertRequired(body.adapter_id, 'adapter_id');
      const eventType = assertRequired(body.event_type, 'event_type');
      const adapter = adapters.get(adapterId);
      if (!adapter || !adapter.active) throw new Error('adapter_id is not registered/active');
      if (!adapter.subscribed_events.includes(eventType)) throw new Error('adapter is not subscribed to event_type');
      const payload = parseBody(body.payload);
      res.status(200).json({
        version: 'v2',
        interface: 'uim-webhook-adapter-framework',
        correlationId: ctx.correlationId,
        output: {
          action: 'dispatch-event',
          dispatch_id: `${adapterId}-${Date.now()}`,
          adapter_id: adapterId,
          event_type: eventType,
          status: 'queued',
          target_url: adapter.target_url,
          payload_size: JSON.stringify(payload).length,
        },
      });
      return;
    }

    if (action === 'deactivate-adapter') {
      const adapterId = assertRequired(body.adapter_id, 'adapter_id');
      const adapter = adapters.get(adapterId);
      if (!adapter) throw new Error('adapter_id is not registered');
      const updated: WebhookAdapter = {
        ...adapter,
        active: false,
      };
      adapters.set(adapterId, updated);
      res.status(200).json({
        version: 'v2',
        interface: 'uim-webhook-adapter-framework',
        correlationId: ctx.correlationId,
        output: {
          action: 'deactivate-adapter',
          adapter: updated,
        },
      });
      return;
    }

    res.status(400).json({
      error: 'Unsupported action. Use register-adapter, dispatch-event, or deactivate-adapter',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
