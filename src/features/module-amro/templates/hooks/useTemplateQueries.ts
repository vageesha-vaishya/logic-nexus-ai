/**
 * React Query Hooks for Work Package Templates
 * 
 * Provides type-safe data fetching with:
 * - Automatic caching and refetching
 * - Optimistic updates
 * - Error handling
 * - Loading states
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  bulkDeleteTemplates,
  bulkUpdateTemplateStatus,
  fetchAircraftModels,
  FetchTemplatesParams,
} from '../services/templateService';
import { useTemplateGridStore, useFilterQueryParams, useSortQueryString } from '../store/useTemplateGridStore';
import { WorkOrderTemplate } from '../AmroWorkOrderTemplatesPage';

// ── Query Keys ─────────────────────────────────────────────────────────────────

export const templateQueryKeys = {
  all: ['amro', 'work-order-templates'] as const,
  lists: () => [...templateQueryKeys.all, 'list'] as const,
  list: (params: FetchTemplatesParams) => [...templateQueryKeys.lists(), params] as const,
  details: () => [...templateQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateQueryKeys.details(), id] as const,
  models: () => [...templateQueryKeys.all, 'aircraft-models'] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * Hook to fetch templates list with pagination, filtering, and sorting
 */
export function useTemplateList(accessToken: string, enabled = true) {
  const {
    pageIndex,
    pageSize,
    totalCount,
    setTotalCount,
  } = useTemplateGridStore();

  const filterParams = useFilterQueryParams();
  const sortQueryString = useSortQueryString();

  const params: FetchTemplatesParams = {
    page: pageIndex + 1, // API uses 1-based indexing
    pageSize,
    sort: sortQueryString || undefined,
    ...filterParams,
  };

  return useQuery({
    queryKey: templateQueryKeys.list(params),
    queryFn: () => fetchTemplates(accessToken, params),
    enabled: enabled && !!accessToken,
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
    onSuccess: (data) => {
      setTotalCount(data.total);
    },
    onError: (error: Error) => {
      toast.error('Failed to load templates', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to fetch aircraft model options
 */
export function useAircraftModels(accessToken: string, tenantId?: string, enabled = true) {
  return useQuery({
    queryKey: [...templateQueryKeys.models(), tenantId],
    queryFn: () => fetchAircraftModels(accessToken, tenantId),
    enabled: enabled && !!accessToken,
    staleTime: 300000, // 5 minutes
    cacheTime: 600000, // 10 minutes
  });
}

/**
 * Hook to create a new template
 */
export function useCreateTemplate(accessToken: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateData: Partial<WorkOrderTemplate>) =>
      createTemplate(accessToken, templateData),
    onSuccess: (newTemplate) => {
      // Invalidate and refetch templates list
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.lists() });
      
      toast.success('Template created successfully', {
        description: `${newTemplate.template_name} has been created.`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create template', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to update an existing template
 */
export function useUpdateTemplate(accessToken: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      templateData,
      expectedUpdatedAt,
    }: {
      templateId: string;
      templateData: Partial<WorkOrderTemplate>;
      expectedUpdatedAt?: string;
    }) => updateTemplate(accessToken, templateId, templateData, expectedUpdatedAt),
    onMutate: async ({ templateId, templateData }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: templateQueryKeys.lists() });

      const previousTemplates = queryClient.getQueryData(templateQueryKeys.lists());

      queryClient.setQueryData(templateQueryKeys.lists(), (old: any) => {
        if (!old?.templates) return old;
        
        return {
          ...old,
          templates: old.templates.map((t: WorkOrderTemplate) =>
            t.id === templateId ? { ...t, ...templateData } : t
          ),
        };
      });

      return { previousTemplates };
    },
    onError: (error: Error, _variables, context: any) => {
      // Rollback on error
      if (context?.previousTemplates) {
        queryClient.setQueryData(templateQueryKeys.lists(), context.previousTemplates);
      }
      
      if (error.message.includes('CONFLICT')) {
        toast.error('Conflict detected', {
          description: 'Template was modified by another user. Please reload.',
        });
      } else {
        toast.error('Failed to update template', {
          description: error.message,
        });
      }
    },
    onSuccess: (updatedTemplate) => {
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.detail(updatedTemplate.id) });
      
      toast.success('Template updated successfully', {
        description: `${updatedTemplate.template_name} has been updated.`,
      });
    },
  });
}

/**
 * Hook to delete a template
 */
export function useDeleteTemplate(accessToken: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => deleteTemplate(accessToken, templateId),
    onSuccess: (_, templateId) => {
      // Remove from cache
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.lists() });
      queryClient.removeQueries({ queryKey: templateQueryKeys.detail(templateId) });
      
      toast.success('Template deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete template', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to clone a template
 */
export function useCloneTemplate(accessToken: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      newName,
      newCode,
    }: {
      templateId: string;
      newName: string;
      newCode: string;
    }) => cloneTemplate(accessToken, templateId, newName, newCode),
    onSuccess: (clonedTemplate) => {
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.lists() });
      
      toast.success('Template cloned successfully', {
        description: `${clonedTemplate.template_name} has been created.`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to clone template', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to bulk delete templates
 */
export function useBulkDeleteTemplates(accessToken: string) {
  const queryClient = useQueryClient();
  const { setBulkOperation, deselectAll } = useTemplateGridStore();

  return useMutation({
    mutationFn: (templateIds: string[]) => bulkDeleteTemplates(accessToken, templateIds),
    onMutate: (templateIds) => {
      setBulkOperation({
        type: 'delete',
        progress: 0,
        total: templateIds.length,
        status: 'in-progress',
        error: null,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.lists() });
      deselectAll();
      
      setBulkOperation({
        type: 'delete',
        progress: result.total,
        total: result.total,
        status: result.failed === 0 ? 'completed' : 'failed',
        error: result.failed > 0 ? `${result.failed} deletions failed` : null,
      });

      toast.success('Bulk delete completed', {
        description: `${result.success} templates deleted, ${result.failed} failed.`,
      });

      // Clear bulk operation state after delay
      setTimeout(() => setBulkOperation(null), 3000);
    },
    onError: (error: Error) => {
      setBulkOperation({
        type: 'delete',
        progress: 0,
        total: 0,
        status: 'failed',
        error: error.message,
      });

      toast.error('Bulk delete failed', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to bulk update template status
 */
export function useBulkUpdateTemplateStatus(accessToken: string) {
  const queryClient = useQueryClient();
  const { setBulkOperation, deselectAll } = useTemplateGridStore();

  return useMutation({
    mutationFn: ({
      templateIds,
      status,
      reason,
    }: {
      templateIds: string[];
      status: string;
      reason?: string;
    }) => bulkUpdateTemplateStatus(accessToken, templateIds, status, reason),
    onMutate: ({ templateIds }) => {
      setBulkOperation({
        type: 'status-change',
        progress: 0,
        total: templateIds.length,
        status: 'in-progress',
        error: null,
      });
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.lists() });
      deselectAll();
      
      setBulkOperation({
        type: 'status-change',
        progress: result.total,
        total: result.total,
        status: result.failed === 0 ? 'completed' : 'failed',
        error: result.failed > 0 ? `${result.failed} updates failed` : null,
      });

      toast.success('Bulk status update completed', {
        description: `${result.success} templates updated, ${result.failed} failed.`,
      });

      // Clear bulk operation state after delay
      setTimeout(() => setBulkOperation(null), 3000);
    },
    onError: (error: Error) => {
      setBulkOperation({
        type: 'status-change',
        progress: 0,
        total: 0,
        status: 'failed',
        error: error.message,
      });

      toast.error('Bulk status update failed', {
        description: error.message,
      });
    },
  });
}
