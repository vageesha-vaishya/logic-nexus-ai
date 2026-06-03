// Phase 6 comms-api — FCM push provider implementation.
//
// Uses firebase-admin/messaging. The Python markets-worker has its
// own FCM HTTP v1 dispatcher (services/markets-worker/.../push/fcm.py);
// they share the FCM_SERVICE_ACCOUNT_JSON env var so operators only
// rotate the service-account key in one place. Tested separately —
// firebase-admin maintains its own connection pool per app.
//
// SDK import restricted to this directory via eslint
// COMMS_PROVIDER_SDK_BANS.

import admin from 'firebase-admin';
import type { app as FirebaseApp } from 'firebase-admin';

import { logger } from '../utils/logger.js';
import type { OutboundPush, PushProvider, PushSendResult } from './push-provider.js';

// FCM error codes that mean "this token will never work again".
//   registration-token-not-registered → the install/app was uninstalled
//                                       or token was rotated.
//   invalid-registration-token        → never was a valid token.
//   invalid-argument                  → payload bug, not a transient
//                                       infra issue; bail rather than retry.
//   mismatched-credential             → token issued under a different
//                                       Firebase project.
//   third-party-auth-error            → APNs cert revoked.
const FCM_PERMANENT_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/mismatched-credential',
  'messaging/third-party-auth-error',
]);

// FCM errors where the token specifically is to blame — the worker
// logs these so a cleanup job can deactivate the row in
// markets.push_tokens.
const TOKEN_INVALIDATION_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

interface FcmErrorShape {
  code?: string;
  message?: string;
  errorInfo?: { code?: string; message?: string };
}

function fcmCode(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const e = err as FcmErrorShape;
  return e.errorInfo?.code || e.code || '';
}

export class FcmPushProvider implements PushProvider {
  readonly name = 'fcm';
  private app: FirebaseApp.App;

  constructor(serviceAccountJson: string, projectId?: string) {
    // Parse the service account JSON. Throws on bad JSON — the
    // factory in push-provider.ts catches this and falls back to
    // NullPushProvider rather than crashing the worker boot.
    const credentials = JSON.parse(serviceAccountJson) as admin.ServiceAccount;

    // Re-use an existing app named 'comms-api' if the worker has
    // re-instantiated us (test restart, hot reload). Avoids the
    // "Firebase app already exists" thrash.
    const appName = 'comms-api-fcm';
    const existing = admin.apps.find((a): a is FirebaseApp.App => a?.name === appName);
    if (existing) {
      this.app = existing;
      logger.info('FCM provider re-using existing firebase-admin app', { appName });
      return;
    }
    this.app = admin.initializeApp(
      {
        credential: admin.credential.cert(credentials),
        ...(projectId ? { projectId } : {}),
      },
      appName,
    );
    logger.info('FCM provider initialized', {
      appName,
      projectId: projectId || credentials.projectId,
    });
  }

  async send(msg: OutboundPush): Promise<PushSendResult> {
    if (!msg.token) {
      return {
        ok: false,
        providerName: this.name,
        errorText: 'push token missing',
        permanent: true,
      };
    }
    try {
      const messageId = await admin.messaging(this.app).send({
        token: msg.token,
        notification: {
          title: msg.title,
          body: msg.body,
        },
        ...(msg.data && Object.keys(msg.data).length > 0 ? { data: msg.data } : {}),
      });
      return {
        ok: true,
        providerName: this.name,
        providerMessageId: messageId,
      };
    } catch (err) {
      const code = fcmCode(err);
      const permanent = FCM_PERMANENT_CODES.has(code);
      const invalidToken = TOKEN_INVALIDATION_CODES.has(code) ? msg.token : undefined;
      const errorText = `fcm error ${code || 'unknown'}: ${
        err instanceof Error ? err.message : String(err)
      }`;
      if (invalidToken) {
        logger.info('FCM token invalidated by provider', { token_prefix: msg.token.slice(0, 12) });
      }
      return {
        ok: false,
        providerName: this.name,
        errorText,
        permanent,
        invalidToken,
      };
    }
  }
}
