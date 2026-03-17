# Tenant Branding API Documentation

## Overview

Tenant Branding API provides tenant-scoped branding resolution for multi-tenant and multi-franchise deployments.

It supports:
- Domain-based and franchise-based branding overrides
- White-label toggles
- CDN asset URL normalization
- Sanitized custom CSS delivery
- Versioned API responses for integration safety

## Endpoint: Resolve Branding

### `GET /api/v1/tenant-branding`

Returns resolved branding JSON for the authenticated tenant scope.

### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `hostname` | string | No | Hostname used for domain override matching |
| `domain_code` | string | No | Platform domain code override key |
| `franchise_id` | string | No | Franchise override key |

### Response
```json
{
  "data": {
    "tenantId": "uuid",
    "tenantName": "Acme Logistics",
    "tenantSlug": "acme-logistics",
    "logoUrl": "https://cdn.example.com/tenant/logo.png",
    "faviconUrl": "https://cdn.example.com/tenant/favicon.ico",
    "companyName": "Acme Logistics",
    "primaryColor": "#2563EB",
    "secondaryColor": "#1D4ED8",
    "accentColor": "#F59E0B",
    "fontFamily": "Inter, system-ui, sans-serif",
    "customCss": ".tenant-header { letter-spacing: 0.02em; }",
    "whiteLabelEnabled": true,
    "headerText": "Global Freight Solutions",
    "subHeaderText": "Enterprise",
    "footerText": "All rights reserved",
    "disclaimerText": "Confidential",
    "metadata": {
      "domain": "acme.com",
      "hostname": "portal.acme.com",
      "resolvedAt": "2026-03-17T13:00:00.000Z"
    }
  },
  "correlationId": "corr-uuid",
  "version": "v1"
}
```

## Endpoint: Render Stylesheet

### `GET /api/v1/tenant-branding.css`

Returns a generated CSS stylesheet with resolved variables and sanitized custom CSS.

### Query Parameters
Uses the same parameters as `/api/v1/tenant-branding`.

### Response Headers
- `Content-Type: text/css; charset=utf-8`
- `Cache-Control: public, max-age=300`

## Data Contract for `branding_settings`

Stored in `public.tenants.branding_settings` as JSONB.

```json
{
  "logo_url": "logos/main.png",
  "favicon_url": "favicons/main.ico",
  "company_name": "Acme Logistics",
  "primary_color": "#2563EB",
  "secondary_color": "#1D4ED8",
  "accent_color": "#F59E0B",
  "font_family": "Inter, system-ui, sans-serif",
  "custom_css": ".tenant-header{font-weight:600;}",
  "white_label_enabled": true,
  "cdn_base_url": "https://cdn.example.com/tenant-assets",
  "domain_overrides": {
    "portal.acme.com": {
      "primary_color": "#0F172A",
      "company_name": "Acme Portal"
    }
  },
  "franchise_overrides": {
    "franchise-uuid": {
      "logo_url": "logos/franchise-a.png"
    }
  }
}
```

## Security and Validation

- Tenant scope is enforced server-side through authenticated access context resolution.
- HTTPS and API rate limiting are enforced before branding resolution.
- Custom CSS is sanitized to remove script-like and unsafe constructs.
- Correlation ID is returned for traceability and support workflows.

## Franchisee Integration Notes

- Franchise systems should call `/api/v1/tenant-branding` with `franchise_id`.
- White-label portals should load `/api/v1/tenant-branding.css` in the shell layout.
- Relative asset paths are automatically rewritten using `cdn_base_url`.
- Clients should persist `version` checks to support future `/api/v2` migrations.
