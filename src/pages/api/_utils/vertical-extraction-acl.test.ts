import { afterEach, describe, expect, it } from 'vitest';
import {
  getAclCompatibilityAdapter,
  mapCanonicalLeadToLegacyRow,
  mapLegacyLeadToCanonicalDto,
  resetAclExtractionConfigs,
  resolveAclWritePlan,
  setAclModuleExtractionConfig,
  translateLegacySchemaRecord,
} from './vertical-extraction-acl';

describe('vertical extraction acl mappers', () => {
  afterEach(() => {
    resetAclExtractionConfigs();
  });

  it('maps legacy crm lead row to canonical dto', () => {
    const canonical = mapLegacyLeadToCanonicalDto({
      id: 'lead-1',
      tenant_id: 'tenant-1',
      franchise_id: 'fr-1',
      lead_name: 'Acme Group',
      primary_email: 'Sales@Acme.com',
      stage_code: 'new',
      source_code: 'web',
      created_at: '2026-03-21T00:00:00.000Z',
      updated_at: '2026-03-21T00:10:00.000Z',
    });
    expect(canonical).toMatchInlineSnapshot(`
      {
        "createdAt": "2026-03-21T00:00:00.000Z",
        "displayName": "Acme Group",
        "email": "sales@acme.com",
        "franchiseId": "fr-1",
        "leadId": "lead-1",
        "source": "web",
        "stage": "new",
        "tenantId": "tenant-1",
        "updatedAt": "2026-03-21T00:10:00.000Z",
      }
    `);
  });

  it('maps canonical crm lead dto to legacy row', () => {
    const legacy = mapCanonicalLeadToLegacyRow({
      leadId: 'lead-2',
      tenantId: 'tenant-2',
      franchiseId: null,
      displayName: 'Blue Logistics',
      email: 'ops@blue-logistics.com',
      stage: 'qualified',
      source: 'referral',
      createdAt: '2026-03-21T01:00:00.000Z',
      updatedAt: '2026-03-21T01:10:00.000Z',
    });
    expect(legacy).toMatchInlineSnapshot(`
      {
        "created_at": "2026-03-21T01:00:00.000Z",
        "franchise_id": null,
        "id": "lead-2",
        "lead_name": "Blue Logistics",
        "primary_email": "ops@blue-logistics.com",
        "source_code": "referral",
        "stage_code": "qualified",
        "tenant_id": "tenant-2",
        "updated_at": "2026-03-21T01:10:00.000Z",
      }
    `);
  });

  it('translates legacy schema through contract snapshot', () => {
    const translated = translateLegacySchemaRecord('crm.lead', 'legacy_to_canonical', {
      id: 'lead-3',
      tenant_id: 'tenant-3',
      franchise_id: 'fr-3',
      lead_name: 'Nexus Freight',
      primary_email: 'contact@nexusfreight.io',
      stage_code: 'proposal',
      source_code: 'partner',
      created_at: '2026-03-21T01:20:00.000Z',
      updated_at: '2026-03-21T01:40:00.000Z',
    });
    expect(translated).toMatchInlineSnapshot(`
      {
        "createdAt": "2026-03-21T01:20:00.000Z",
        "displayName": "Nexus Freight",
        "email": "contact@nexusfreight.io",
        "franchiseId": "fr-3",
        "leadId": "lead-3",
        "source": "partner",
        "stage": "proposal",
        "tenantId": "tenant-3",
        "updatedAt": "2026-03-21T01:40:00.000Z",
      }
    `);
  });
});

describe('vertical extraction acl compatibility and write boundary', () => {
  afterEach(() => {
    resetAclExtractionConfigs();
  });

  it('routes through acl legacy path when rollback is enabled', () => {
    setAclModuleExtractionConfig('module-crm', { rollbackToLegacy: true });
    const adapter = getAclCompatibilityAdapter('module-crm');
    expect(adapter.routePath).toBe('acl-legacy');
    expect(adapter.reason).toBe('rollback_toggle');
  });

  it('proxies cross-module write plans through acl-backed legacy path', () => {
    const plan = resolveAclWritePlan({
      sourceModule: 'module-crm',
      tableName: 'quotations',
      payload: {
        quote_id: 'quote-1',
        tenant_id: 'tenant-1',
      },
    });
    expect(plan.allowed).toBe(true);
    expect(plan.directWrite).toBe(false);
    expect(plan.writePath).toBe('acl-legacy-proxy');
    expect(plan.reason).toBe('cross_module_acl_proxy');
    expect(plan.translatedPayload).toEqual(
      expect.objectContaining({
        acl_forwarded_from_module: 'module-crm',
        acl_target_module: 'module-quotation',
      })
    );
  });

  it('blocks unknown cross-module table writes', () => {
    const plan = resolveAclWritePlan({
      sourceModule: 'module-crm',
      tableName: 'random_unknown_table',
      payload: {},
    });
    expect(plan.allowed).toBe(false);
    expect(plan.writePath).toBe('blocked');
    expect(plan.reason).toBe('unknown_table');
  });
});
