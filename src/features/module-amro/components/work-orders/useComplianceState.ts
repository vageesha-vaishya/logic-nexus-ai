/**
 * React Query Hooks for AMRO Compliance Records
 * 
 * Follows the pattern established in useWorkOrderState.ts
 * Provides hooks for:
 * - Listing compliance records for a work package
 * - Creating compliance records
 * - Generating Certificates of Release to Service (CRS)
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

function useAuthHeaders(): HeadersInit | null {
  const { session } = useAuth();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export type ComplianceType = 'AD' | 'SB' | 'inspection' | 'certification' | 'routine';
export type ComplianceStatus = 'pending' | 'in_progress' | 'completed' | 'deferred' | 'exempted';

export interface ComplianceRecord {
  id: string;
  tenant_id: string;
  work_order_id: string;
  task_id: string | null;
  directive_id: string | null;
  compliance_type: ComplianceType;
  compliance_reference: string;
  compliance_method: string | null;
  compliance_status: ComplianceStatus;
  
  // Certification
  certified_by: string | null;
  certified_at: string | null;
  certificate_number: string | null;
  license_number: string | null;
  license_expiry: string | null;
  
  // Evidence
  evidence_attachments: any[];
  evidence_captured: boolean;
  inspection_result: string | null;
  findings: string | null;
  
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  
  // Joined data
  directive?: {
    id: string;
    directive_type: string;
    directive_number: string;
    issuing_authority: string;
    title: string;
  };
}

export interface ComplianceRecordListResponse {
  work_order_id: string;
  records: ComplianceRecord[];
  total: number;
}

const COMPLIANCE_KEY = ['amro', 'compliance-records'] as const;

// ── List compliance records ─────────────────────────────────────────────────

interface UseListComplianceRecordsParams {
  workOrderId: string;
  complianceType?: ComplianceType;
  status?: ComplianceStatus;
  enabled?: boolean;
}

async function fetchComplianceRecords(
  params: {
    work_order_id: string;
    compliance_type?: string;
    status?: string;
  },
  headers: HeadersInit,
): Promise<ComplianceRecordListResponse> {
  const qs = new URLSearchParams({
    ...(params.compliance_type ? { compliance_type: params.compliance_type } : {}),
    ...(params.status ? { status: params.status } : {}),
  });

  const url = `/api/v2/amro/work-orders/${params.work_order_id}/compliance-records?${qs.toString()}`;
  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) throw new Error(`Failed to list compliance records: ${response.status}`);
  const json = await response.json();
  
  const records = json.output?.records || json.data || [];
  return {
    work_order_id: json.output?.work_order_id || params.work_order_id,
    records: Array.isArray(records) ? records : [],
    total: json.output?.total || records.length,
  };
}

export function useListComplianceRecords(params: UseListComplianceRecordsParams) {
  const authHeaders = useAuthHeaders();
  const { workOrderId, complianceType, status, enabled = true } = params;

  return useQuery({
    queryKey: [
      ...COMPLIANCE_KEY,
      'list',
      workOrderId,
      complianceType || 'all',
      status || 'all',
    ] as const,
    queryFn: () =>
      authHeaders
        ? fetchComplianceRecords(
            { work_order_id: workOrderId, compliance_type: complianceType, status },
            authHeaders,
          )
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders && !!workOrderId,
    staleTime: 30_000,
    retry: 2,
  });
}

// ── Create compliance record ────────────────────────────────────────────────

interface CreateComplianceRecordInput {
  work_order_id: string;
  compliance_type: ComplianceType;
  compliance_reference: string;
  task_id?: string;
  directive_id?: string;
  compliance_method?: string;
  compliance_status?: ComplianceStatus;
  certified_by?: string;
  certificate_number?: string;
  license_number?: string;
  license_expiry?: string;
  evidence_attachments?: any[];
  evidence_captured?: boolean;
  inspection_result?: string;
  findings?: string;
}

async function mutateCreateComplianceRecord(input: CreateComplianceRecordInput, headers: HeadersInit): Promise<ComplianceRecord> {
  const { work_order_id, ...createData } = input;
  const response = await fetch(`/api/v2/amro/work-orders/${work_order_id}/compliance-records`, {
    method: 'POST',
    headers,
    body: JSON.stringify(createData),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create compliance record failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreateComplianceRecord() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateComplianceRecordInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateCreateComplianceRecord(input, authHeaders);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...COMPLIANCE_KEY, 'list', data.work_order_id] });
    },
  });
}

// ── Generate Certificate of Release to Service ──────────────────────────────

interface CreateCertificateInput {
  work_order_id: string;
  certifying_staff_id: string;
  staff_license_number: string;
  staff_license_type: string;
  staff_license_expiry: string;
  work_description: string;
  regulations_complied: string[];
  maintenance_organization_approval?: string;
  limitations?: string;
  remarks?: string;
  digital_signature_hash?: string;
}

interface CertificateOutput {
  certificate_id: string;
  certificate_number: string;
  issue_date: string;
  work_order_id: string;
  aircraft_id: string;
  certifying_staff_id: string;
  staff_license_type: string;
  regulations_complied: string[];
  message: string;
}

async function mutateCreateCertificate(input: CreateCertificateInput, headers: HeadersInit): Promise<CertificateOutput> {
  const { work_order_id, ...certData } = input;
  const response = await fetch(`/api/v2/amro/work-orders/${work_order_id}/certificates`, {
    method: 'POST',
    headers,
    body: JSON.stringify(certData),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create certificate failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreateCertificate() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCertificateInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateCreateCertificate(input, authHeaders);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...COMPLIANCE_KEY, 'list', data.work_order_id] });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function useComplianceActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: COMPLIANCE_KEY });
  }, [queryClient]);
  return { invalidate };
}
