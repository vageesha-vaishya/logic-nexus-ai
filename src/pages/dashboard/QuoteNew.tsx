import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteForm } from '@/components/sales/QuoteForm';
import { MultiModalQuoteComposer } from '@/components/sales/MultiModalQuoteComposer';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';
import { useCRM } from '@/hooks/useCRM';

export default function QuoteNew() {
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const [createdQuoteId, setCreatedQuoteId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const handleSuccess = (quoteId: string) => {
    // Instead of navigating immediately, create initial version and show composer inline
    setCreatedQuoteId(quoteId);
    // Fetch tenant_id for the created quote to ensure version insert works
    (async () => {
      const { data } = await supabase
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
        const { data: existing, error: queryError } = await supabase
          .from('quotation_versions')
          .select('id, version_number')
          .eq('quote_id', createdQuoteId)
          .order('version_number', { ascending: false })
          .limit(1);
        
        if (queryError) {
          console.error('[QuoteNew] Error querying versions:', queryError);
          return;
        }
        
        if (Array.isArray(existing) && existing.length && existing[0]?.id) {
          console.log('[QuoteNew] Found existing version:', existing[0].id);
          setVersionId(String(existing[0].id));
          return;
        }
        
        // Create initial version only if none exists
        console.log('[QuoteNew] No version found, creating version 1');
        const finalTenantId = tenantId ?? ((await supabase.auth.getUser()).data?.user as any)?.user_metadata?.tenant_id;
        
        if (!finalTenantId) {
          console.error('[QuoteNew] Cannot create version: no tenant_id available');
          return;
        }
        
        const { data: v, error: insertError } = await supabase
          .from('quotation_versions')
          .insert({ quote_id: createdQuoteId, tenant_id: finalTenantId, version_number: 1 })
          .select('id')
          .maybeSingle();
        
        if (insertError) {
          console.error('[QuoteNew] Error creating version:', insertError);
          // Check if version was created by another process
          const { data: retry } = await supabase
            .from('quotation_versions')
            .select('id')
            .eq('quote_id', createdQuoteId)
            .limit(1)
            .maybeSingle();
          
          if (retry?.id) {
            console.log('[QuoteNew] Version found on retry:', retry.id);
            setVersionId(String(retry.id));
          }
          return;
        }
        
        if (v?.id) {
          console.log('[QuoteNew] Created version:', v.id);
          setVersionId(String(v.id));
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
          </div>
        </div>
        <QuoteForm onSuccess={handleSuccess} />
        
        {createdQuoteId && versionId && (
          <div className="mt-6">
            <MultiModalQuoteComposer quoteId={createdQuoteId} versionId={versionId} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
