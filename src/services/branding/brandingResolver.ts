import { sanitizeBrandingCss } from '@/lib/utils/sanitizer';
import type { BrandingSettings } from '@/services/quotation/QuotationConfigurationService';

export type TenantBrandingOverride = Partial<{
  logo_url: string;
  company_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  custom_css: string;
  white_label_enabled: boolean;
  favicon_url: string;
  header_text: string;
  sub_header_text: string;
  footer_text: string;
  disclaimer_text: string;
}>;

export interface TenantBrandingSettings extends BrandingSettings {
  custom_css?: string;
  white_label_enabled?: boolean;
  favicon_url?: string;
  cdn_base_url?: string;
  domain_overrides?: Record<string, TenantBrandingOverride>;
  franchise_overrides?: Record<string, TenantBrandingOverride>;
}

export interface TenantBrandingSource {
  tenantId: string;
  tenantName?: string | null;
  tenantSlug?: string | null;
  logoUrl?: string | null;
  domain?: string | null;
  brandingSettings?: unknown;
  tenantSettings?: unknown;
}

export interface TenantBrandingQuery {
  hostname?: string;
  domainCode?: string;
  franchiseId?: string;
}

export interface ResolvedTenantBranding {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  logoUrl: string;
  faviconUrl: string;
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  customCss: string;
  whiteLabelEnabled: boolean;
  headerText: string;
  subHeaderText: string;
  footerText: string;
  disclaimerText: string;
  metadata: {
    domain: string;
    hostname: string;
    resolvedAt: string;
  };
}

const DEFAULT_BRANDING: Omit<ResolvedTenantBranding, 'tenantId' | 'tenantName' | 'tenantSlug' | 'metadata'> = {
  logoUrl: '',
  faviconUrl: '',
  companyName: 'SOS Services',
  primaryColor: '#2563EB',
  secondaryColor: '#1D4ED8',
  accentColor: '#F59E0B',
  fontFamily: 'Inter, system-ui, sans-serif',
  customCss: '',
  whiteLabelEnabled: false,
  headerText: '',
  subHeaderText: '',
  footerText: '',
  disclaimerText: '',
};

function asRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cleanColor(value: unknown, fallback: string): string {
  const v = cleanText(value);
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : fallback;
}

function toOverride(value: unknown): TenantBrandingOverride {
  return asRecord(value) as TenantBrandingOverride;
}

function normalizeBrandingSettings(source: TenantBrandingSource): TenantBrandingSettings {
  const brandingFromTenant = asRecord(source.brandingSettings);
  const settings = asRecord(source.tenantSettings);
  const nestedFromSettings = asRecord(settings.branding_settings);
  const nestedFromLegacy = asRecord(settings.branding);
  return {
    ...nestedFromLegacy,
    ...nestedFromSettings,
    ...brandingFromTenant,
  } as TenantBrandingSettings;
}

function mergeBranding(base: TenantBrandingSettings, override: TenantBrandingOverride): TenantBrandingSettings {
  return {
    ...base,
    ...override,
  };
}

function absoluteAssetUrl(rawUrl: string, cdnBaseUrl: string): string {
  const candidate = cleanText(rawUrl);
  if (!candidate) return '';
  if (/^https?:\/\//i.test(candidate)) return candidate;
  const base = cleanText(cdnBaseUrl).replace(/\/+$/, '');
  if (!base) return candidate;
  const path = candidate.startsWith('/') ? candidate : `/${candidate}`;
  return `${base}${path}`;
}

export function resolveTenantBranding(source: TenantBrandingSource, query: TenantBrandingQuery = {}): ResolvedTenantBranding {
  const branding = normalizeBrandingSettings(source);
  const hostname = cleanText(query.hostname, '');
  const domainCode = cleanText(query.domainCode, '').toLowerCase();
  const franchiseId = cleanText(query.franchiseId, '');

  let merged = { ...branding };
  if (franchiseId && branding.franchise_overrides?.[franchiseId]) {
    merged = mergeBranding(merged, toOverride(branding.franchise_overrides[franchiseId]));
  }

  const domainOverrideKey = hostname || domainCode;
  if (domainOverrideKey && branding.domain_overrides?.[domainOverrideKey]) {
    merged = mergeBranding(merged, toOverride(branding.domain_overrides[domainOverrideKey]));
  }

  const cdnBaseUrl = cleanText(merged.cdn_base_url);
  const logoUrl = absoluteAssetUrl(cleanText(merged.logo_url, source.logoUrl || ''), cdnBaseUrl);
  const faviconUrl = absoluteAssetUrl(cleanText(merged.favicon_url), cdnBaseUrl);
  const companyName = cleanText(merged.company_name, cleanText(source.tenantName, DEFAULT_BRANDING.companyName));

  return {
    tenantId: source.tenantId,
    tenantName: cleanText(source.tenantName, ''),
    tenantSlug: cleanText(source.tenantSlug, ''),
    logoUrl,
    faviconUrl,
    companyName,
    primaryColor: cleanColor(merged.primary_color, DEFAULT_BRANDING.primaryColor),
    secondaryColor: cleanColor(merged.secondary_color, DEFAULT_BRANDING.secondaryColor),
    accentColor: cleanColor(merged.accent_color, DEFAULT_BRANDING.accentColor),
    fontFamily: cleanText(merged.font_family, DEFAULT_BRANDING.fontFamily),
    customCss: sanitizeBrandingCss(cleanText(merged.custom_css, DEFAULT_BRANDING.customCss)),
    whiteLabelEnabled: Boolean(merged.white_label_enabled),
    headerText: cleanText(merged.header_text, DEFAULT_BRANDING.headerText),
    subHeaderText: cleanText(merged.sub_header_text, DEFAULT_BRANDING.subHeaderText),
    footerText: cleanText(merged.footer_text, DEFAULT_BRANDING.footerText),
    disclaimerText: cleanText(merged.disclaimer_text, DEFAULT_BRANDING.disclaimerText),
    metadata: {
      domain: cleanText(source.domain, ''),
      hostname,
      resolvedAt: new Date().toISOString(),
    },
  };
}

export function buildTenantBrandingCssVariables(branding: ResolvedTenantBranding): Record<string, string> {
  return {
    '--tenant-brand-primary': branding.primaryColor,
    '--tenant-brand-secondary': branding.secondaryColor,
    '--tenant-brand-accent': branding.accentColor,
    '--tenant-brand-font': branding.fontFamily,
  };
}

export function buildTenantBrandingStylesheet(branding: ResolvedTenantBranding): string {
  const vars = buildTenantBrandingCssVariables(branding);
  const variableLines = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  const baseCss = `:root {\n${variableLines}\n}\nbody { font-family: var(--tenant-brand-font); }`;
  return `${baseCss}\n${branding.customCss || ''}`.trim();
}
