import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useDebug } from '@/hooks/useDebug';
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
  const debug = useDebug('Sales', 'QuoteTemplates');

  const tenantId = context.tenantId || roles?.[0]?.tenant_id;

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: templateKeys.list(tenantId),
    queryFn: async () => {
      const startTime = performance.now();
      debug.info('Fetching quote templates', { tenantId });
      
      if (!tenantId) {
        debug.warn('No tenant ID found, skipping fetch');
        return [];
      }
      
      const { data, error } = await (supabase as any)
        .from('quote_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        debug.error('Error fetching templates', error);
        throw error;
      }
      
      const duration = performance.now() - startTime;
      debug.log('Templates loaded successfully', { 
        count: data?.length || 0,
        duration: `${duration.toFixed(2)}ms`
      });
      
      return data as QuoteTemplate[];
    },
    enabled: !!tenantId,
  });

  const createTemplate = useMutation({
    mutationFn: async (newTemplate: CreateQuoteTemplateDTO) => {
      const startTime = performance.now();
      debug.info('Creating new template', { name: newTemplate.name });
      
      if (!tenantId) throw new Error('No tenant ID found');
      const { data, error } = await (supabase as any)
        .from('quote_templates')
        .insert([{ ...newTemplate, tenant_id: tenantId }])
        .select()
        .single();

      if (error) {
        debug.error('Error creating template', error);
        throw error;
      }
      
      const duration = performance.now() - startTime;
      debug.log('Template created successfully', { 
        id: data.id, 
        name: data.name,
        duration: `${duration.toFixed(2)}ms`
      });
      
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
      const startTime = performance.now();
      debug.info('Updating template', { id, updates });
      
      const { data, error } = await (supabase as any)
        .from('quote_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        debug.error('Error updating template', error);
        throw error;
      }
      
      const duration = performance.now() - startTime;
      debug.log('Template updated successfully', { 
        id, 
        duration: `${duration.toFixed(2)}ms`
      });
      
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
      const startTime = performance.now();
      debug.info('Deleting template', { id });
      
      const { error } = await (supabase as any)
        .from('quote_templates')
        .delete()
        .eq('id', id);

      if (error) {
        debug.error('Error deleting template', error);
        throw error;
      }
      
      const duration = performance.now() - startTime;
      debug.log('Template deleted successfully', { 
        id, 
        duration: `${duration.toFixed(2)}ms`
      });
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
