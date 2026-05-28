// Shared helper: HMAC-signed stateless unsubscribe tokens.
//
// Per RFC 8058 + comms-infrastructure.md §4.6, every outbound bulk email must
// carry a `List-Unsubscribe: <url>` header whose URL contains a token that
// the receiving edge function can verify without a DB lookup.
//
// Token format: `<payload>.<signature>` (both URL-safe base64).
//   payload   = base64url(JSON({tenant_id, address, channel_kind, exp, nonce}))
//   signature = base64url(HMAC-SHA256(payload, secret))
//
// The HMAC secret should live in core.secrets (purpose='hmac_unsubscribe') once
// the secrets store is fully wired. For Phase 1 Slice C-D it's read from the
// COMMS_UNSUBSCRIBE_HMAC_SECRET env var.

declare const Deno: any;

export interface UnsubscribePayload {
  tenant_id: string;
  /** Normalised lowercase email (or E.164 phone). */
  address: string;
  /** 'email' | 'sms' | 'whatsapp' | 'push'. */
  channel_kind: string;
  /** Unix seconds. Tokens past this are rejected. */
  exp: number;
  /** 16-byte random nonce, base64url-encoded. Prevents identical tokens. */
  nonce: string;
}

const DEFAULT_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

/** Resolve the HMAC secret from env. Throws if missing — caller must guard. */
function readHmacSecret(): string {
  const secret = Deno?.env?.get?.("COMMS_UNSUBSCRIBE_HMAC_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error(
      "COMMS_UNSUBSCRIBE_HMAC_SECRET is missing or too short (need ≥32 chars)",
    );
  }
  return secret;
}

// ── base64url helpers ────────────────────────────────────────────────────

function base64UrlEncode(bytes: Uint8Array): string {
  let binStr = "";
  for (let i = 0; i < bytes.length; i++) binStr += String.fromCharCode(bytes[i]);
  return btoa(binStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  // Restore padding
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (s.length % 4)) % 4);
  const binStr = atob(padded);
  const out = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) out[i] = binStr.charCodeAt(i);
  return out;
}

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function utf8Decode(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8Encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, utf8Encode(message));
  return base64UrlEncode(new Uint8Array(sigBytes));
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** Normalise an address consistently across token-gen and suppression-check. */
export function normaliseAddress(channelKind: string, address: string): string {
  if (channelKind === "email") return address.trim().toLowerCase();
  // For sms/whatsapp/push we leave the value as-is (assumed already normalised
  // by the caller — phones should be E.164 going in).
  return address.trim();
}

// ── public API ───────────────────────────────────────────────────────────

export async function generateUnsubscribeToken(args: {
  tenant_id: string;
  address: string;
  channel_kind: string;
  ttl_seconds?: number;
  /** Optional override (mostly for tests); production reads from env. */
  secret?: string;
}): Promise<string> {
  if (!args.tenant_id) throw new Error("tenant_id required");
  if (!args.address) throw new Error("address required");
  if (!args.channel_kind) throw new Error("channel_kind required");

  const secret = args.secret ?? readHmacSecret();
  const exp = Math.floor(Date.now() / 1000) + (args.ttl_seconds ?? DEFAULT_TTL_SECONDS);
  const payload: UnsubscribePayload = {
    tenant_id: args.tenant_id,
    address: normaliseAddress(args.channel_kind, args.address),
    channel_kind: args.channel_kind,
    exp,
    nonce: randomNonce(),
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(utf8Encode(payloadJson));
  const sig = await hmacSha256(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export async function verifyUnsubscribeToken(
  token: string,
  options?: { secret?: string; now?: number },
): Promise<UnsubscribePayload | null> {
  if (typeof token !== "string" || token.length === 0) return null;
  const dot = token.indexOf(".");
  if (dot < 0 || dot === token.length - 1) return null;

  const payloadB64 = token.slice(0, dot);
  const submittedSig = token.slice(dot + 1);

  const secret = options?.secret ?? readHmacSecret();
  const expectedSig = await hmacSha256(payloadB64, secret);
  if (!timingSafeEqual(submittedSig, expectedSig)) return null;

  let payload: UnsubscribePayload;
  try {
    payload = JSON.parse(utf8Decode(base64UrlDecode(payloadB64))) as UnsubscribePayload;
  } catch {
    return null;
  }
  if (
    typeof payload.tenant_id !== "string" ||
    typeof payload.address !== "string" ||
    typeof payload.channel_kind !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.nonce !== "string"
  ) {
    return null;
  }
  const nowSec = Math.floor((options?.now ?? Date.now()) / 1000);
  if (nowSec >= payload.exp) return null;
  return payload;
}

/**
 * Compose the full unsubscribe URL. Used by send paths when injecting the
 * `List-Unsubscribe` header into outbound mail.
 *
 *   baseUrl = `https://<project-ref>.supabase.co/functions/v1`
 */
export async function generateUnsubscribeUrl(args: {
  base_url: string;
  tenant_id: string;
  address: string;
  channel_kind: string;
  ttl_seconds?: number;
}): Promise<string> {
  const token = await generateUnsubscribeToken({
    tenant_id: args.tenant_id,
    address: args.address,
    channel_kind: args.channel_kind,
    ttl_seconds: args.ttl_seconds,
  });
  const cleanBase = args.base_url.replace(/\/$/, "");
  return `${cleanBase}/comms-unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Build the two RFC 8058 headers for an outbound bulk message. Add these to
 * the provider request (Resend `headers` field, nodemailer `headers` option,
 * etc.).
 */
export async function buildListUnsubscribeHeaders(args: {
  base_url: string;
  tenant_id: string;
  address: string;
  channel_kind: string;
  mailto_address?: string;          // e.g. 'unsubscribe@sosservices.online'
  ttl_seconds?: number;
}): Promise<{ "List-Unsubscribe": string; "List-Unsubscribe-Post": string }> {
  const unsubUrl = await generateUnsubscribeUrl({
    base_url: args.base_url,
    tenant_id: args.tenant_id,
    address: args.address,
    channel_kind: args.channel_kind,
    ttl_seconds: args.ttl_seconds,
  });
  const parts = [`<${unsubUrl}>`];
  if (args.mailto_address) {
    parts.push(`<mailto:${args.mailto_address}?subject=Unsubscribe>`);
  }
  return {
    "List-Unsubscribe": parts.join(", "),
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
