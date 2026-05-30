// Phase 6 Step 11 — template lookup + render.
//
// Looks up comms.templates by (tenant_id, intent_kind, channel_kind,
// language), resolves current_version_id → comms.template_versions row,
// renders {{var}} substitutions against the intent payload + the
// recipient context, returns the rendered subject/html/text along with
// the version_id for audit pinning.
//
// Substitution syntax:
//   {{var}}        HTML-escape the substituted string (default-safe)
//   {{var_raw}}    Insert verbatim (no escape) — for pre-rendered HTML
//                  fragments. Trailing `_raw` lookups still resolve to
//                  the same payload key minus the suffix.
//
// Missing variables substitute to empty string with a logged WARN —
// fail-open rather than block a send for a tiny copy gap.

import { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
  templateVersionId: string;
}

export interface TemplateRenderResult {
  rendered: RenderedTemplate | null;
  // If no active template exists for this tenant/intent — the worker
  // should fall back to payload.subject/html. This is intentional so
  // ad-hoc intents (test rows, one-off emits) keep working.
}

export class TemplateRenderer {
  constructor(private supabase: SupabaseClient) {}

  async render(args: {
    tenantId: string;
    intentKind: string;
    channelKind: string;
    language?: string;
    variables: Record<string, unknown>;
  }): Promise<TemplateRenderResult> {
    const language = args.language || 'en';
    try {
      const { data: tpl, error: tplErr } = await (this.supabase as any)
        .schema('comms')
        .from('templates')
        .select('id, current_version_id')
        .eq('tenant_id', args.tenantId)
        .eq('intent_kind', args.intentKind)
        .eq('channel_kind', args.channelKind)
        .eq('language', language)
        .eq('is_active', true)
        .maybeSingle();
      if (tplErr) {
        logger.warn('template lookup failed', { error: tplErr.message, intentKind: args.intentKind });
        return { rendered: null };
      }
      if (!tpl?.current_version_id) {
        return { rendered: null };
      }
      const { data: version, error: verErr } = await (this.supabase as any)
        .schema('comms')
        .from('template_versions')
        .select('id, subject_template, body_html_template, body_text_template')
        .eq('id', tpl.current_version_id)
        .maybeSingle();
      if (verErr || !version) {
        logger.warn('template version lookup failed', {
          templateId: tpl.id,
          versionId: tpl.current_version_id,
          error: verErr?.message,
        });
        return { rendered: null };
      }
      return {
        rendered: {
          subject: renderString(version.subject_template, args.variables, { escapeHtml: false }),
          html: renderString(version.body_html_template, args.variables, { escapeHtml: true }),
          text: version.body_text_template
            ? renderString(version.body_text_template, args.variables, { escapeHtml: false })
            : stripHtml(renderString(version.body_html_template, args.variables, { escapeHtml: true })),
          templateVersionId: version.id,
        },
      };
    } catch (err) {
      logger.warn('template renderer threw', {
        error: err instanceof Error ? err.message : String(err),
        intentKind: args.intentKind,
      });
      return { rendered: null };
    }
  }
}

// ── Internals ──────────────────────────────────────────────────────────

function renderString(
  template: string,
  vars: Record<string, unknown>,
  opts: { escapeHtml: boolean },
): string {
  return template.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_, rawKey: string) => {
    const wantsRaw = rawKey.endsWith('_raw');
    const key = wantsRaw ? rawKey.slice(0, -4) : rawKey;
    const value = vars[key];
    if (value === undefined || value === null) {
      logger.info('template variable missing', { key });
      return '';
    }
    const str = String(value);
    if (!opts.escapeHtml || wantsRaw) return str;
    return escapeHtml(str);
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
