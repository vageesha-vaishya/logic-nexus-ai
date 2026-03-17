import { describe, expect, it } from 'vitest';
import { buildTenantBrandingStylesheet, resolveTenantBranding } from './brandingResolver';

describe('resolveTenantBranding', () => {
  it('returns fallback defaults when branding is incomplete', () => {
    const branding = resolveTenantBranding({
      tenantId: 'tenant-1',
      tenantName: 'Alpha Logistics',
      tenantSlug: 'alpha-logistics',
    });

    expect(branding.companyName).toBe('Alpha Logistics');
    expect(branding.primaryColor).toBe('#2563EB');
    expect(branding.secondaryColor).toBe('#1D4ED8');
    expect(branding.accentColor).toBe('#F59E0B');
    expect(branding.logoUrl).toBe('');
  });

  it('applies CDN base URL to relative asset paths', () => {
    const branding = resolveTenantBranding({
      tenantId: 'tenant-2',
      tenantName: 'CDN Tenant',
      brandingSettings: {
        logo_url: 'logos/main.png',
        favicon_url: '/favicons/favicon.ico',
        cdn_base_url: 'https://cdn.example.com/tenant-assets/',
      },
    });

    expect(branding.logoUrl).toBe('https://cdn.example.com/tenant-assets/logos/main.png');
    expect(branding.faviconUrl).toBe('https://cdn.example.com/tenant-assets/favicons/favicon.ico');
  });

  it('switches branding by hostname override', () => {
    const source = {
      tenantId: 'tenant-3',
      tenantName: 'Global Freight',
      brandingSettings: {
        primary_color: '#112233',
        domain_overrides: {
          'app.globalfreight.com': {
            primary_color: '#445566',
            company_name: 'Global Freight App',
          },
          'portal.globalfreight.com': {
            primary_color: '#778899',
            company_name: 'Global Freight Portal',
          },
        },
      },
    };

    const appBrand = resolveTenantBranding(source, { hostname: 'app.globalfreight.com' });
    const portalBrand = resolveTenantBranding(source, { hostname: 'portal.globalfreight.com' });

    expect(appBrand.primaryColor).toBe('#445566');
    expect(appBrand.companyName).toBe('Global Freight App');
    expect(portalBrand.primaryColor).toBe('#778899');
    expect(portalBrand.companyName).toBe('Global Freight Portal');
  });

  it('sanitizes custom css in generated stylesheet', () => {
    const branding = resolveTenantBranding({
      tenantId: 'tenant-4',
      tenantName: 'Secure Tenant',
      brandingSettings: {
        custom_css: `
          @import url("https://malicious.test/x.css");
          body { background-image: url("javascript:alert(1)"); }
          .safe { color: #111111; }
        `,
      },
    });

    const css = buildTenantBrandingStylesheet(branding);
    expect(css).not.toContain('@import');
    expect(css).not.toContain('javascript:');
    expect(css).toContain('.safe { color: #111111; }');
  });
});
