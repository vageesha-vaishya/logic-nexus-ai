import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import type { OpportunityHistory } from '@/pages/dashboard/opportunities-data';
import Papa from 'papaparse';
import posthog from 'posthog-js';
import * as XLSX from 'xlsx';
 
vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn() },
}));
 
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      functions: { invoke: vi.fn() },
    },
    context: {
      userId: 'test-user',
      tenantId: null,
      isPlatformAdmin: false,
      isTenantAdmin: false,
      isFranchiseAdmin: false,
      isUser: true,
    },
  }),
}));
 
vi.mock('xlsx', () => {
  return {
    utils: {
      json_to_sheet: vi.fn(() => ({})),
      book_new: vi.fn(() => ({})),
      book_append_sheet: vi.fn(),
    },
    writeFile: vi.fn(),
  };
});
 
import { OpportunityHistoryTab } from './OpportunityHistoryTab';

const sample: OpportunityHistory[] = [
  {
    id: '1',
    opportunity_id: 'opp1',
    old_probability: 10,
    new_probability: 20,
    old_stage: 'prospecting',
    new_stage: 'qualification',
    changed_by: 'user1',
    changed_at: new Date('2025-12-30T10:00:00Z').toISOString(),
    changer: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
  },
  {
    id: '2',
    opportunity_id: 'opp1',
    old_probability: 20,
    new_probability: 20,
    old_stage: 'qualification',
    new_stage: 'qualification',
    changed_by: 'user2',
    changed_at: new Date('2025-12-31T10:00:00Z').toISOString(),
    changer: { first_name: 'John', last_name: 'Smith', email: 'john@example.com' },
  },
];

describe('OpportunityHistoryTab', () => {
  it('renders and applies filters', () => {
    render(<OpportunityHistoryTab history={sample} onRefresh={() => {}} />);
    const search = screen.getByPlaceholderText('User, stage, probability…');
    fireEvent.change(search, { target: { value: 'john' } });
    expect(screen.getByText('Query: john')).toBeInTheDocument();
    const reset = screen.getByText('Reset filters');
    fireEvent.click(reset);
    expect(screen.queryByText('Query: john')).not.toBeInTheDocument();
  });

  it.skip('exports CSV with selected fields', async () => {});

  it('shows and toggles export format selector', async () => {
    render(<OpportunityHistoryTab history={sample} onRefresh={() => {}} />);
    const openBtn = screen.getByText('Export CSV');
    fireEvent.click(openBtn);
    const downloadBtnCsv = screen.getByText('Download CSV');
    expect(downloadBtnCsv).toBeInTheDocument();
    const formatTrigger = screen.getByText('CSV');
    fireEvent.click(formatTrigger);
    const xlsxItem = await screen.findByText('XLSX');
    fireEvent.click(xlsxItem);
    const downloadBtnXlsx = await screen.findByText('Download XLSX');
    expect(downloadBtnXlsx).toBeInTheDocument();
  });

  it('invokes CSV export path', async () => {
    const unparseSpy = vi.spyOn(Papa, 'unparse').mockReturnValue('a,b\n1,2');
    vi.clearAllMocks();
    render(<OpportunityHistoryTab history={sample} onRefresh={() => {}} />);
    fireEvent.click(screen.getByText('Export CSV'));
    const btn = screen.getByText('Download CSV');
    fireEvent.click(btn);
    expect(unparseSpy).toHaveBeenCalled();
    expect(posthog.capture).toHaveBeenCalledWith(
      'crm.opportunity_history.export_start',
      expect.objectContaining({ format: 'csv' })
    );
    expect(posthog.capture).toHaveBeenCalledWith(
      'crm.opportunity_history.export_success',
      expect.objectContaining({ format: 'csv' })
    );
  });

  it('invokes XLSX export path', async () => {
    vi.clearAllMocks();
    render(<OpportunityHistoryTab history={sample} onRefresh={() => {}} />);
    fireEvent.click(screen.getByText('Export CSV'));
    const formatTrigger = screen.getByText('CSV');
    fireEvent.click(formatTrigger);
    fireEvent.click(await screen.findByText('XLSX'));
    const btn = await screen.findByText('Download XLSX');
    fireEvent.click(btn);
    expect(XLSX.writeFile).toHaveBeenCalled();
    expect(posthog.capture).toHaveBeenCalledWith(
      'crm.opportunity_history.export_start',
      expect.objectContaining({ format: 'xlsx' })
    );
    expect(posthog.capture).toHaveBeenCalledWith(
      'crm.opportunity_history.export_success',
      expect.objectContaining({ format: 'xlsx' })
    );
  });
});
