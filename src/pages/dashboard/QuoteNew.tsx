import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteFormRefactored as QuoteForm } from '@/components/sales/quote-form/QuoteFormRefactored';
import { MultiModalQuoteComposer } from '@/components/sales/MultiModalQuoteComposer';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuoteTemplateList } from '@/components/sales/templates/QuoteTemplateList';
import { QuoteTemplate } from '@/components/sales/templates/types';
import { FileText } from 'lucide-react';
import { QuoteFormValues } from '@/components/sales/quote-form/types';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

export default function QuoteNew() {
  const { supabase, context, scopedDb } = useCRM();
  const location = useLocation();
  const [createdQuoteId, setCreatedQuoteId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateData, setTemplateData] = useState<Partial<QuoteFormValues> | undefined>(undefined);

  useEffect(() => {
    if (location.state) {
      const state = location.state as any;
      setTemplateData(prev => ({
        ...prev,
        total_weight: state.weight?.toString(),
        commodity: state.commodity,
        // Map loose text fields to notes since form expects IDs for ports
        notes: `Quick Quote Conversion:\nOrigin: ${state.origin}\nDestination: ${state.destination}\nMode: ${state.mode}\nSelected Rate: ${state.selectedRate?.name} ($${state.selectedRate?.price})`,
        title: `Quote for ${state.commodity} (${state.origin} -> ${state.destination})`,
      }));
    }
  }, [location.state]);

  const handleTemplateSelect = (template: QuoteTemplate) => {
    try {
      // Parse content if string, or use as is if object
      const content = typeof template.content === 'string' 
        ? JSON.parse(template.content) 
        : template.content;
      
      // Map template content to form values
      // We explicitly exclude system fields
      const { id, created_at, updated_at, tenant_id, quote_number, ...rest } = content as any;
      
      setTemplateData(rest);
      setTemplateDialogOpen(false);
      toast.success(`Template "${template.name}" applied`);
    } catch (e) {
      console.error('Error applying template', e);
      toast.error('Failed to apply template');
    }
  };

  const handleSuccess = (quoteId: string) => {
    // Instead of navigating immediately, create initial version and show composer inline
    setCreatedQuoteId(quoteId);
    // Fetch tenant_id for the created quote to ensure version insert works
    (async () => {
      const { data } = await scopedDb
        .from('quotes')
        .select('tenant_id')
        .eq('id', quoteId)
        .single();
      setTenantId((data as any)?.tenant_id ?? null);
    })();
  };

  useEffect(() => {
    const ensureVersion = async () => {
      if (!createdQuoteId) return;
      
      console.log('[QuoteNew] Ensuring version exists for quote:', createdQuoteId);
      
      try {
        // Check if version already exists
        const { data: existing, error: queryError } = await (scopedDb
          .from('quotation_versions')
          .select('id, version_number') as any)
          .eq('quote_id', createdQuoteId)
          .order('version_number', { ascending: false })
          .limit(1);
        
        if (queryError) {
          console.error('[QuoteNew] Error querying versions:', queryError);
          return;
        }
        
        if (Array.isArray(existing) && existing.length && (existing[0] as any)?.id) {
          console.log('[QuoteNew] Found existing version:', (existing[0] as any).id);
          setVersionId(String((existing[0] as any).id));
          return;
        }
        
        // Create initial version only if none exists
        console.log('[QuoteNew] No version found, creating version 1');
        const finalTenantId = tenantId ?? ((await supabase.auth.getUser()).data?.user as any)?.user_metadata?.tenant_id;
        
        if (!finalTenantId) {
          console.error('[QuoteNew] Cannot create version: no tenant_id available');
          return;
        }
        
        const { data: v, error: insertError } = await scopedDb
          .from('quotation_versions')
          .insert({ quote_id: createdQuoteId, tenant_id: finalTenantId, version_number: 1 })
          .select('id')
          .maybeSingle();
        
        if (insertError) {
          console.error('[QuoteNew] Error creating version:', insertError);
          // Check if version was created by another process
          const { data: retry } = await (scopedDb
            .from('quotation_versions')
            .select('id') as any)
            .eq('quote_id', createdQuoteId)
            .limit(1)
            .maybeSingle();
          
          if ((retry as any)?.id) {
            console.log('[QuoteNew] Version found on retry:', (retry as any).id);
            setVersionId(String((retry as any).id));
          }
          return;
        }
        
        if ((v as any)?.id) {
          console.log('[QuoteNew] Created version:', (v as any).id);
          setVersionId(String((v as any).id));
        }
      } catch (error) {
        console.error('[QuoteNew] Unexpected error in ensureVersion:', error);
      }
    };
    
    ensureVersion();
  }, [createdQuoteId]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/quotes">Quotes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/quotes/new">New</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold">New Quote</h1>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Use Template
            </Button>
          </div>
        </div>
        <QuoteForm onSuccess={handleSuccess} initialData={templateData} />
        
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select a Quote Template</DialogTitle>
            </DialogHeader>
            <QuoteTemplateList onSelect={handleTemplateSelect} />
          </DialogContent>
        </Dialog>
        
        {createdQuoteId && versionId && (
          <div className="mt-6">
            <MultiModalQuoteComposer quoteId={createdQuoteId} versionId={versionId} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
