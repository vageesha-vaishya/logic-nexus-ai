/**
 * React Query Hooks for AMRO Enterprise Features
 * 
 * Provides hooks for:
 * - Materials management (search, stock, reserve, purchase orders)
 * - Tooling management (search, availability, calibration, reservations)
 * - Compliance management (AD/SB feed, sign-off, fleet status, analytics)
 * 
 * @module features/module-amro/components/work-orders/useEnterpriseAMRO
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type {
  MaterialLineItem,
  ToolingLineItem,
  ComplianceRequirement,
  MaterialSearchRequest,
  MaterialSearchResponse,
  ToolAvailabilityResponse,
  FleetComplianceStatus,
  MaterialAnalytics,
  ToolingAnalytics,
  ComplianceAnalytics,
} from '@/../services/amro-api/src/types/amro.enterprise.types';

// ============================================================================
// AUTHENTICATION HELP
// ============================================================================

function useAuthHeaders(): HeadersInit | null {
  const { session } = useAuth();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// MATERIALS MANAGEMENT HOOKS
// ============================================================================

export function useMaterialsSearch(searchParams: MaterialSearchRequest, enabled = true) {
  const headers = useAuthHeaders();
  const queryKey = ['amro', 'materials', 'search', searchParams];

  const query = useQuery<MaterialSearchResponse>({
    queryKey,
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch('/api/v2/amro/materials/search', {
        method: 'POST',
        headers,
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        throw new Error(`Failed to search materials: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return query;
}

export function useMaterialStock(materialId: string, enabled = true) {
  const headers = useAuthHeaders();
  const queryKey = ['amro', 'materials', 'stock', materialId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch(`/api/v2/amro/materials/${materialId}/stock`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get stock: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers && !!materialId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return query;
}

export function useReserveMaterial() {
  const queryClient = useQueryClient();
  const headers = useAuthHeaders();

  const mutation = useMutation({
    mutationFn: async (data: {
      materialId: string;
      quantity: number;
      work_package_template_id?: string;
      work_package_id?: string;
      expected_issue_date?: string;
      notes?: string;
    }) => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch(`/api/v2/amro/materials/${data.materialId}/reserve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          quantity: data.quantity,
          work_package_template_id: data.work_package_template_id,
          work_package_id: data.work_package_id,
          expected_issue_date: data.expected_issue_date,
          notes: data.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to reserve material: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate material queries
      queryClient.invalidateQueries({ queryKey: ['amro', 'materials'] });
    },
  });

  return mutation;
}

export function usePurchaseOrder() {
  const queryClient = useQueryClient();
  const headers = useAuthHeaders();

  const mutation = useMutation({
    mutationFn: async (data: {
      materials: Array<{
        part_number: string;
        quantity: number;
        supplier_id?: string;
      }>;
      work_package_template_id?: string;
      work_package_id?: string;
      priority?: 'standard' | 'urgent' | 'aog';
      notes?: string;
    }) => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch('/api/v2/amro/materials/purchase-order', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to create PO: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amro', 'materials'] });
    },
  });

  return mutation;
}

export function useMaterialShortages(enabled = true) {
  const headers = useAuthHeaders();

  const query = useQuery({
    queryKey: ['amro', 'materials', 'shortages'],
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch('/api/v2/amro/materials/shortages', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get shortages: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return query;
}

export function useMaterialAnalytics(enabled = true) {
  const headers = useAuthHeaders();

  const query = useQuery<MaterialAnalytics>({
    queryKey: ['amro', 'materials', 'analytics'],
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch('/api/v2/amro/materials/analytics', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get analytics: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  return query;
}

// ============================================================================
// TOOLING MANAGEMENT HOOKS
// ============================================================================

export function useToolingSearch(searchParams: {
  query?: string;
  tool_category?: string;
  tool_type?: string;
  calibration_required?: boolean;
  limit?: number;
  offset?: number;
}, enabled = true) {
  const headers = useAuthHeaders();
  const queryKey = ['amro', 'tooling', 'search', searchParams];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch('/api/v2/amro/tooling/search', {
        method: 'POST',
        headers,
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        throw new Error(`Failed to search tooling: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers,
    staleTime: 5 * 60 * 1000,
  });

  return query;
}

export function useToolAvailability(toolId: string, enabled = true) {
  const headers = useAuthHeaders();
  const queryKey = ['amro', 'tooling', 'availability', toolId];

  const query = useQuery<ToolAvailabilityResponse>({
    queryKey,
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch(`/api/v2/amro/tooling/${toolId}/availability`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get availability: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers && !!toolId,
    staleTime: 2 * 60 * 1000,
  });

  return query;
}

export function useReserveTool() {
  const queryClient = useQueryClient();
  const headers = useAuthHeaders();

  const mutation = useMutation({
    mutationFn: async (data: {
      toolId: string;
      tool_instance_id?: string;
      quantity?: number;
      work_package_template_id?: string;
      work_package_id?: string;
      reservation_date: string;
      return_date: string;
      notes?: string;
    }) => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch(`/api/v2/amro/tooling/${data.toolId}/reserve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tool_instance_id: data.tool_instance_id,
          quantity: data.quantity,
          work_package_template_id: data.work_package_template_id,
          work_package_id: data.work_package_id,
          reservation_date: data.reservation_date,
          return_date: data.return_date,
          notes: data.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to reserve tool: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amro', 'tooling'] });
    },
  });

  return mutation;
}

export function useCalibrationDue(enabled = true) {
  const headers = useAuthHeaders();

  const query = useQuery({
    queryKey: ['amro', 'tooling', 'calibration-due'],
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch('/api/v2/amro/tooling/calibration-due', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get calibration due: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers,
    staleTime: 5 * 60 * 1000,
  });

  return query;
}

export function useLogCalibration() {
  const queryClient = useQueryClient();
  const headers = useAuthHeaders();

  const mutation = useMutation({
    mutationFn: async (data: {
      toolId: string;
      tool_instance_id: string;
      calibration_date: string;
      next_calibration_due: string;
      calibration_standard: string;
      calibration_result: 'pass' | 'fail' | 'adjusted';
      as_found_data?: any;
      as_left_data?: any;
      out_of_tolerance?: boolean;
      oot_investigation?: string;
      certificate_number: string;
      calibration_certificate_url?: string;
      calibration_organization?: string;
      notes?: string;
    }) => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch(`/api/v2/amro/tooling/${data.toolId}/calibration-log`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to log calibration: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amro', 'tooling'] });
    },
  });

  return mutation;
}

export function useToolingAnalytics(enabled = true) {
  const headers = useAuthHeaders();

  const query = useQuery<ToolingAnalytics>({
    queryKey: ['amro', 'tooling', 'analytics'],
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch('/api/v2/amro/tooling/analytics', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get analytics: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers,
    staleTime: 15 * 60 * 1000,
  });

  return query;
}

// ============================================================================
// COMPLIANCE MANAGEMENT HOOKS
// ============================================================================

export function useADSBFeed(params?: {
  directive_type?: string;
  regulatory_authority?: string;
  applicable_only?: boolean;
}, enabled = true) {
  const headers = useAuthHeaders();
  const queryString = new URLSearchParams();
  
  if (params?.directive_type) queryString.set('directive_type', params.directive_type);
  if (params?.regulatory_authority) queryString.set('regulatory_authority', params.regulatory_authority);
  if (params?.applicable_only) queryString.set('applicable_only', String(params.applicable_only));

  const queryKey = ['amro', 'compliance', 'ad-sb-feed', params];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch(`/api/v2/amro/compliance-enterprise/ad-sb-feed?${queryString.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get AD/SB feed: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers,
    staleTime: 10 * 60 * 1000,
  });

  return query;
}

export function useCheckApplicability() {
  const headers = useAuthHeaders();

  const mutation = useMutation({
    mutationFn: async (data: {
      requirementId: string;
      aircraft_model: string;
      engine_model?: string;
      component_ata?: string;
    }) => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch(`/api/v2/amro/compliance-enterprise/${data.requirementId}/applicability`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          aircraft_model: data.aircraft_model,
          engine_model: data.engine_model,
          component_ata: data.component_ata,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to check applicability: ${response.status}`);
      }

      return response.json();
    },
  });

  return mutation;
}

export function useComplianceSignOff() {
  const queryClient = useQueryClient();
  const headers = useAuthHeaders();

  const mutation = useMutation({
    mutationFn: async (data: {
      requirementId: string;
      compliance_date: string;
      complied_method: string;
      compliance_reference: string;
      digital_signature: {
        certifying_staff_id: string;
        license_number: string;
        license_type: string;
        license_expiry: string;
        organization: string;
      };
      notes?: string;
    }) => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch(`/api/v2/amro/compliance-enterprise/${data.requirementId}/sign-off`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to sign off: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amro', 'compliance'] });
    },
  });

  return mutation;
}

export function useFleetComplianceStatus(params?: {
  regulatory_authority?: string;
  aircraft_model?: string;
}, enabled = true) {
  const headers = useAuthHeaders();
  const queryString = new URLSearchParams();
  
  if (params?.regulatory_authority) queryString.set('regulatory_authority', params.regulatory_authority);
  if (params?.aircraft_model) queryString.set('aircraft_model', params.aircraft_model);

  const queryKey = ['amro', 'compliance', 'fleet-status', params];

  const query = useQuery<FleetComplianceStatus>({
    queryKey,
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch(`/api/v2/amro/compliance-enterprise/fleet-status?${queryString.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get fleet status: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers,
    staleTime: 5 * 60 * 1000,
  });

  return query;
}

export function useComplianceExport() {
  const headers = useAuthHeaders();

  const mutation = useMutation({
    mutationFn: async (data: {
      report_type: 'fleet_status' | 'ad_sb_summary' | 'overdue_items' | 'audit_trail' | 'exemptions';
      date_range?: { start: string; end: string };
      format?: 'json' | 'pdf' | 'csv' | 'xml';
      authority?: string;
      aircraft_model?: string;
    }) => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch('/api/v2/amro/compliance-enterprise/export-report', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to export: ${response.status}`);
      }

      return response.json();
    },
  });

  return mutation;
}

export function useComplianceAnalytics(enabled = true) {
  const headers = useAuthHeaders();

  const query = useQuery<ComplianceAnalytics>({
    queryKey: ['amro', 'compliance', 'analytics'],
    queryFn: async () => {
      if (!headers) throw new Error('Authentication required');
      
      const response = await fetch('/api/v2/amro/compliance-enterprise/analytics', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get analytics: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!headers,
    staleTime: 15 * 60 * 1000,
  });

  return query;
}

// ============================================================================
// CONVENIENCE COMPOSITION HOOKS
// ============================================================================

/**
 * Hook to get all enterprise dashboard data
 * Combines materials, tooling, and compliance analytics
 */
export function useEnterpriseDashboard(enabled = true) {
  const materialsAnalytics = useMaterialAnalytics(enabled);
  const toolingAnalytics = useToolingAnalytics(enabled);
  const complianceAnalytics = useComplianceAnalytics(enabled);
  const materialShortages = useMaterialShortages(enabled);
  const calibrationDue = useCalibrationDue(enabled);
  const fleetStatus = useFleetComplianceStatus(undefined, enabled);

  return {
    materials: {
      analytics: materialsAnalytics,
      shortages: materialShortages,
    },
    tooling: {
      analytics: toolingAnalytics,
      calibrationDue,
    },
    compliance: {
      analytics: complianceAnalytics,
      fleetStatus,
    },
    isLoading: materialsAnalytics.isLoading || toolingAnalytics.isLoading || complianceAnalytics.isLoading,
    isError: materialsAnalytics.isError || toolingAnalytics.isError || complianceAnalytics.isError,
    error: materialsAnalytics.error || toolingAnalytics.error || complianceAnalytics.error,
  };
}
