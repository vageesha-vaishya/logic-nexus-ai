// Phase 6 comms-api — Push provider abstraction.
//
// Mirrors sms-provider.ts. Direct imports of provider SDKs
// (firebase-admin, @aws-sdk/client-sns, etc.) are restricted to this
// directory via eslint COMMS_PROVIDER_SDK_BANS. Callers route through
// getPushProvider() so suppression checks, delivery_events, and the
// retry / permanent classification stay consistent across channels.
//
// FCM is the only provider today; APNs (Apple Push) and OneSignal can
// be added without touching the worker once the demand is there.

import { FcmPushProvider } from './fcm.js';

export interface OutboundPush {
  tenantId: string;
  /** Recipient FCM device token. One push delivery row per token. */
  token: string;
  /** Notification banner/heads-up title. <= 60 chars renders consistently. */
  title: string;
  /** Notification body. <= 240 chars across iOS/Android display limits. */
  body: string;
  /**
   * App-level data payload — these key-value pairs are delivered as a
   * data message and read by the app's foreground handler. Keep keys
   * short; FCM caps the total message size at ~4 KB.
   */
  data?: Record<string, string>;
}

export interface PushSendResult {
  ok: boolean;
  providerMessageId?: string;
  errorText?: string;
  /** Provider name as it goes into comms.deliveries.provider. */
  providerName: string;
  /**
   * True for terminal errors (token unregistered, invalid arg, account
   * mismatch). The worker stops retrying + marks the row failed.
   * Operators or a periodic cleanup job then flip markets.push_tokens
   * .is_active=false based on the error hint.
   */
  permanent?: boolean;
  /**
   * When the failure is the recipient token specifically (UNREGISTERED
   * / INVALID_TOKEN), the worker logs this so a cleanup job can
   * deactivate the stale row in markets.push_tokens. NULL otherwise.
   */
  invalidToken?: string;
}

export interface PushProvider {
  readonly name: string;
  send(msg: OutboundPush): Promise<PushSendResult>;
}

// No-op provider used when FCM isn't configured (no service-account
// JSON in env). Returns permanent=true + descriptive error_text so
// the row lands in 'failed' rather than looping.
export class NullPushProvider implements PushProvider {
  readonly name = 'null';

  async send(_msg: OutboundPush): Promise<PushSendResult> {
    return {
      ok: false,
      providerName: this.name,
      errorText:
        'no push provider configured (set FCM_SERVICE_ACCOUNT_JSON to enable real sends)',
      permanent: true,
    };
  }
}

let cached: PushProvider | null = null;

/** Test helper — never used in production. */
export function resetPushProviderForTesting(): void {
  cached = null;
}

export function getPushProvider(): PushProvider {
  if (cached) return cached;
  const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    cached = new NullPushProvider();
    return cached;
  }
  try {
    cached = new FcmPushProvider(serviceAccountJson, process.env.FCM_PROJECT_ID);
    return cached;
  } catch {
    // Bad JSON / missing project id / firebase-admin init error — fall
    // through to Null so the worker still boots; misconfig surfaces in
    // the first delivery's error_text.
    cached = new NullPushProvider();
    return cached;
  }
}
