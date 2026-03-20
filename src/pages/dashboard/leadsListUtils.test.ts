import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildLeadsFilterPlan,
  LEADS_FILTER_MIGRATION_KEY,
  deserializeLeadsListUrlState,
  groupLeadsForWorkspaceDetails,
  migrateLegacyLeadsFilterPayload,
  normalizeLeadsStatusFilterValue,
  resolveCrmFallbackBannerCopy,
  resolveLeadsFallbackBannerCopy,
  runOneTimeLeadsFilterMigration,
  serializeLeadsListUrlState,
} from './leadsListUtils';

const enTranslation = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'public/locales/en/translation.json'), 'utf-8'),
);
const esTranslation = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'public/locales/es/translation.json'), 'utf-8'),
);

function getTranslationValue(
  language: 'en' | 'es',
  key: string,
): string {
  const dictionary = language === 'en' ? enTranslation : esTranslation;
  return key.split('.').reduce((acc, part) => acc?.[part], dictionary) as string;
}

function renderFallbackBanner(
  language: 'en' | 'es',
  module: 'accounts' | 'contacts' | 'activities',
) {
  const key = resolveCrmFallbackBannerCopy(module, 'relations_query_failed').key;
  const text = getTranslationValue(language, key);
  render(
    React.createElement('span', null, text),
  );
}

describe('leadsListUtils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes legacy all statuses value', () => {
    expect(normalizeLeadsStatusFilterValue('allStatuses')).toBe('all');
    expect(normalizeLeadsStatusFilterValue('all')).toBe('all');
  });

  it('serializes URL state and omits default filters', () => {
    const params = serializeLeadsListUrlState({
      searchQuery: 'acme',
      statusFilter: 'allStatuses',
      ownerFilter: 'any',
      page: 1,
    });

    expect(params.get('q')).toBe('acme');
    expect(params.get('status')).toBeNull();
    expect(params.get('owner')).toBeNull();
    expect(params.get('page')).toBeNull();
  });

  it('deserializes URL state and normalizes status', () => {
    const params = new URLSearchParams('q=abc&status=allStatuses&owner=me&page=3');
    const result = deserializeLeadsListUrlState(params);

    expect(result).toEqual({
      searchQuery: 'abc',
      statusFilter: 'all',
      ownerFilter: 'me',
      page: 3,
    });
  });

  it('migrates legacy payload status fields', () => {
    const payload = {
      status: 'allStatuses',
      statusFilter: 'allStatuses',
      workspace: {
        statusFilter: 'allStatuses',
      },
    };

    const migrated = migrateLegacyLeadsFilterPayload(payload);
    expect(migrated.migrated).toBe(true);
    expect(migrated.value).toEqual({
      status: 'all',
      statusFilter: 'all',
      workspace: {
        statusFilter: 'all',
      },
    });
  });

  it('runs one-time migration for lead-related localStorage keys', () => {
    const backing = new Map<string, string>([
      ['lead.filters.state', JSON.stringify({ statusFilter: 'allStatuses' })],
      ['unrelated.key', JSON.stringify({ statusFilter: 'allStatuses' })],
    ]);
    const storage: Storage = {
      get length() {
        return backing.size;
      },
      clear: () => backing.clear(),
      getItem: (key) => backing.get(key) ?? null,
      key: (index) => Array.from(backing.keys())[index] ?? null,
      removeItem: (key) => {
        backing.delete(key);
      },
      setItem: (key, value) => {
        backing.set(key, value);
      },
    };

    const rewrites = runOneTimeLeadsFilterMigration(storage);
    expect(rewrites).toBe(1);
    expect(storage.getItem(LEADS_FILTER_MIGRATION_KEY)).toBe('done');

    const raw = storage.getItem('lead.filters.state');
    expect(raw).toContain('"statusFilter":"all"');
    expect(storage.getItem('unrelated.key')).toContain('"allStatuses"');
  });

  it('groups workspace leads by owner with counts', () => {
    const groups = groupLeadsForWorkspaceDetails(
      [
        { id: '1', owner_id: 'u1' },
        { id: '2', owner_id: 'u1' },
        { id: '3', owner_id: null },
      ],
      'owner',
    );

    expect(groups[0]).toMatchObject({ label: 'u1', count: 2 });
    expect(groups[1]).toMatchObject({ label: 'Unassigned', count: 1 });
  });

  it('builds comprehensive filter plan with combined filters', () => {
    const plan = buildLeadsFilterPlan({
      statusFilter: 'qualified',
      ownerFilter: 'me',
      searchQuery: 'Acme',
      nameQuery: 'John',
      nameOp: 'contains',
      companyQuery: 'Logistics',
      companyOp: 'startsWith',
      emailQuery: '@acme.com',
      emailOp: 'endsWith',
      phoneQuery: '+1',
      phoneOp: 'contains',
      sourceQuery: 'website',
      sourceOp: 'equals',
      qualificationQuery: 'hot',
      qualificationOp: 'equals',
      scoreFilter: 'medium',
      scoreMin: '35',
      scoreMax: '90',
      valueMin: '1000',
      valueMax: '50000',
      createdStart: '2026-01-01',
      createdEnd: '2026-01-31',
      userId: 'user-1',
    });

    expect(plan.eq).toEqual(expect.arrayContaining([
      { column: 'status', value: 'qualified' },
      { column: 'owner_id', value: 'user-1' },
      { column: 'source', value: 'website' },
      { column: 'qualification_status', value: 'hot' },
    ]));
    expect(plan.ilike).toEqual(expect.arrayContaining([
      { column: 'company', value: 'Logistics%' },
      { column: 'email', value: '%@acme.com' },
      { column: 'phone', value: '%+1%' },
    ]));
    expect(plan.gte).toEqual(expect.arrayContaining([
      { column: 'lead_score', value: 40 },
      { column: 'lead_score', value: 35 },
      { column: 'estimated_value', value: 1000 },
      { column: 'created_at', value: '2026-01-01T00:00:00.000Z' },
    ]));
    expect(plan.lte).toEqual(expect.arrayContaining([
      { column: 'lead_score', value: 69 },
      { column: 'lead_score', value: 90 },
      { column: 'estimated_value', value: 50000 },
      { column: 'created_at', value: '2026-01-31T23:59:59.999Z' },
    ]));
    expect(plan.or).toHaveLength(2);
  });

  it('handles special characters in search values without breaking clauses', () => {
    const plan = buildLeadsFilterPlan({
      statusFilter: 'all',
      ownerFilter: 'any',
      searchQuery: 'Acme, Inc. (West)',
      nameQuery: 'A(B), C',
      nameOp: 'contains',
      companyQuery: '',
      companyOp: 'contains',
      emailQuery: '',
      emailOp: 'contains',
      phoneQuery: '',
      phoneOp: 'contains',
      sourceQuery: '',
      sourceOp: 'contains',
      qualificationQuery: '',
      qualificationOp: 'contains',
      scoreFilter: 'all',
      scoreMin: '',
      scoreMax: '',
      valueMin: '',
      valueMax: '',
      createdStart: '',
      createdEnd: '',
      userId: null,
    });

    expect(plan.or[0]).toContain('Acme\\, Inc. \\(West\\)');
    expect(plan.or[1]).toContain('A\\(B\\)\\, C');
  });

  it('supports empty-result filter combinations via strict range constraints', () => {
    const plan = buildLeadsFilterPlan({
      statusFilter: 'lost',
      ownerFilter: 'unassigned',
      searchQuery: '',
      nameQuery: '',
      nameOp: 'contains',
      companyQuery: '',
      companyOp: 'contains',
      emailQuery: '',
      emailOp: 'contains',
      phoneQuery: '',
      phoneOp: 'contains',
      sourceQuery: '',
      sourceOp: 'contains',
      qualificationQuery: '',
      qualificationOp: 'contains',
      scoreFilter: 'all',
      scoreMin: '95',
      scoreMax: '5',
      valueMin: '1000000',
      valueMax: '10',
      createdStart: '2026-12-31',
      createdEnd: '2026-01-01',
      userId: null,
    });

    expect(plan.eq).toContainEqual({ column: 'status', value: 'lost' });
    expect(plan.isNull).toContain('owner_id');
    expect(plan.gte).toEqual(expect.arrayContaining([
      { column: 'lead_score', value: 95 },
      { column: 'estimated_value', value: 1000000 },
      { column: 'created_at', value: '2026-12-31T00:00:00.000Z' },
    ]));
    expect(plan.lte).toEqual(expect.arrayContaining([
      { column: 'lead_score', value: 5 },
      { column: 'estimated_value', value: 10 },
      { column: 'created_at', value: '2026-01-01T23:59:59.999Z' },
    ]));
  });

  it('returns standardized default fallback banner copy', () => {
    expect(resolveLeadsFallbackBannerCopy(null)).toEqual({
      key: 'leads.messages.apiUnavailableFallback',
    });
  });

  it('returns standardized forbidden scope fallback banner copy', () => {
    expect(resolveLeadsFallbackBannerCopy('forbidden_scope')).toEqual({
      key: 'leads.messages.apiForbiddenScopeFallback',
    });
  });

  it('returns module-scoped relation fallback key for quotes', () => {
    expect(resolveCrmFallbackBannerCopy('quotes', 'relations_query_failed')).toEqual({
      key: 'quotes.messages.relationsFallback',
    });
  });

  it('returns module-scoped compatibility fallback key for opportunities', () => {
    expect(resolveCrmFallbackBannerCopy('opportunities', 'compatibility_mode')).toEqual({
      key: 'opportunities.messages.compatibilityModeFallback',
    });
  });

  it('returns module-scoped relation fallback key for accounts', () => {
    expect(resolveCrmFallbackBannerCopy('accounts', 'relations_query_failed')).toEqual({
      key: 'accounts.messages.relationsFallback',
    });
  });

  it('returns module-scoped relation fallback key for contacts', () => {
    expect(resolveCrmFallbackBannerCopy('contacts', 'relations_query_failed')).toEqual({
      key: 'contacts.messages.relationsFallback',
    });
  });

  it('returns module-scoped relation fallback key for activities', () => {
    expect(resolveCrmFallbackBannerCopy('activities', 'relations_query_failed')).toEqual({
      key: 'activities.messages.relationsFallback',
    });
  });

  it('renders localized EN fallback banner text for accounts', async () => {
    renderFallbackBanner('en', 'accounts');
    expect(screen.getByText('Account relation data unavailable, showing base records')).toBeInTheDocument();
  });

  it('renders localized EN fallback banner text for contacts', async () => {
    renderFallbackBanner('en', 'contacts');
    expect(screen.getByText('Contact relation data unavailable, showing base records')).toBeInTheDocument();
  });

  it('renders localized EN fallback banner text for activities', async () => {
    renderFallbackBanner('en', 'activities');
    expect(screen.getByText('Activity relation data unavailable, showing base records')).toBeInTheDocument();
  });

  it('renders localized ES fallback banner text for accounts', async () => {
    renderFallbackBanner('es', 'accounts');
    expect(screen.getByText('Datos de relación de cuentas no disponibles, mostrando registros base')).toBeInTheDocument();
  });

  it('renders localized ES fallback banner text for contacts', async () => {
    renderFallbackBanner('es', 'contacts');
    expect(screen.getByText('Datos de relación de contactos no disponibles, mostrando registros base')).toBeInTheDocument();
  });

  it('renders localized ES fallback banner text for activities', async () => {
    renderFallbackBanner('es', 'activities');
    expect(screen.getByText('Datos de relación de actividades no disponibles, mostrando registros base')).toBeInTheDocument();
  });
});
