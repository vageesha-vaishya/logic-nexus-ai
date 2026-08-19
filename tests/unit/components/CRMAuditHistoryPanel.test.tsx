import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CRMAuditHistoryPanel } from '@/components/crm/audit/CRMAuditHistoryPanel';

vi.mock('@/hooks/useCRMAuditTrail', () => ({
  useCRMAuditTrail: () => ({
    data: [
      {
        id: '1',
        action: 'create',
        entity_type: 'lead',
        entity_id: 'lead-123',
        user_email: 'user@example.com',
        user_name: 'Test User',
        changed_fields: ['name', 'email'],
        created_at: '2026-08-19T10:00:00Z'
      }
    ],
    loading: false,
    error: null,
    refetch: vi.fn()
  })
}));

describe('CRMAuditHistoryPanel', () => {
  it('should display audit history', async () => {
    render(
      <CRMAuditHistoryPanel
        entityType="lead"
        entityId="lead-123"
        tenantId="tenant-123"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/created/i)).toBeInTheDocument();
      expect(screen.getByText(/test user/i)).toBeInTheDocument();
    });
  });
});
