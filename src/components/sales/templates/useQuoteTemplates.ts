import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { QuoteTemplate, CreateQuoteTemplateDTO, UpdateQuoteTemplateDTO } from './types';

export const templateKeys = {
  all: ['quote-templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (tenantId: string | undefined) => [...templateKeys.lists(), { tenantId }] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

export function useQuoteTemplates() {
  const { context, supabase } = useCRM();
  const { roles } = useAuth();
  const queryClient = useQueryClient();

  const tenantId = context.tenantId || roles?.[0]?.tenant_id;

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: templateKeys.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as QuoteTemplate[];
    },
    enabled: !!tenantId,
  });

  const createTemplate = useMutation({
    mutationFn: async (newTemplate: CreateQuoteTemplateDTO) => {
      if (!tenantId) throw new Error('No tenant ID found');
      const { data, error } = await supabase
        .from('quote_templates')
        .insert([{ ...newTemplate, tenant_id: tenantId }])
        .select()
        .single();

      if (error) throw error;
      return data as QuoteTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success('Template created successfully');
    },
    onError: (error: any) => {
      toast.error(`Error creating template: ${error.message}`);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateQuoteTemplateDTO }) => {
      const { data, error } = await supabase
        .from('quote_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as QuoteTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success('Template updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Error updating template: ${error.message}`);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quote_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success('Template deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Error deleting template: ${error.message}`);
    },
  });

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
