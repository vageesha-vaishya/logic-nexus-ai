import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteFormRefactored as QuoteForm } from '@/components/sales/quote-form/QuoteFormRefactored';
import { QuotationVersionHistory } from '@/components/sales/QuotationVersionHistory';
import { MultiModalQuoteComposer } from '@/components/sales/MultiModalQuoteComposer';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';
import { ShareQuoteDialog } from '@/components/sales/portal/ShareQuoteDialog';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, context, scopedDb } = useCRM();
  const [loading, setLoading] = useState(true);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);

  useEffect(() => {
    const checkQuote = async () => {
      try {
        if (!id) throw new Error('Missing quote identifier');
        
        // Validate UUID format to prevent "invalid input syntax" DB errors
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        
        let query = scopedDb
          .from('quotes')
          .select('id, tenant_id, quote_number');

        if (isUuid) {
           // If it looks like a UUID, check both ID and Quote Number (safe)
           query = query.or(`id.eq.${id},quote_number.eq.${id}`);
        } else {
           // If NOT a UUID, only check Quote Number (avoids UUID syntax error)
           query = query.eq('quote_number', id);
        }

        const { data, error } = await query
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Quote not found');

        setResolvedId((data as any)?.id ?? null);
        setTenantId((data as any)?.tenant_id ?? null);
        setQuoteNumber((data as any)?.quote_number ?? null);
        setLoading(false);
      } catch (err: any) {
        toast.error('Failed to load quote', { description: err.message });
        navigate('/dashboard/quotes');
      }
    };
    checkQuote();
  }, [id]);

  useEffect(() => {
    const loadLatestVersion = async () => {
      if (!resolvedId) return;
      
      console.log('[QuoteDetail] Loading latest version for quote:', resolvedId);
      
      try {
        const { data, error } = await (scopedDb
          .from('quotation_versions')
          .select('id, version_number, tenant_id') as any)
          .eq('quote_id', resolvedId)
          .order('version_number', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('[QuoteDetail] Error querying versions:', error);
          return;
        }
        
        if (Array.isArray(data) && data.length && (data[0] as any)?.id) {
          const v = data[0] as any;
          console.log('[QuoteDetail] Found existing version:', v.id);
          setVersionId(String(v.id));
          if (!tenantId && v.tenant_id) {
             console.log('[QuoteDetail] Resolved tenant from version:', v.tenant_id);
             setTenantId(v.tenant_id);
          }
          return;
        }
        
        // Create initial version only if none exists
        console.log('[QuoteDetail] No version found, creating version 1');
        
        let finalTenantId = tenantId;
        if (!finalTenantId) {
          // Fallback: fetch tenant from quote if not already set
          const { data: qRow, error: qError } = await scopedDb
            .from('quotes')
            .select('tenant_id')
            .eq('id', resolvedId)
            .maybeSingle();
          
          if (qError) {
            console.error('[QuoteDetail] Error fetching quote tenant:', qError);
          }
          
          finalTenantId = (qRow as any)?.tenant_id ?? null;
          if (finalTenantId) {
            setTenantId(finalTenantId);
          }
        }
        
        if (!finalTenantId) {
          finalTenantId = context.tenantId;
        }

        if (!finalTenantId) {
          const { data: { user } } = await supabase.auth.getUser();
          finalTenantId = user?.user_metadata?.tenant_id;
        }
        
        if (!finalTenantId) {
          console.error('[QuoteDetail] Cannot create version: no tenant_id available');
          return;
        }
        
        const { data: v, error: insertError } = await scopedDb
          .from('quotation_versions')
          .insert({ quote_id: resolvedId, tenant_id: finalTenantId, version_number: 1 })
          .select('id')
          .maybeSingle();
        
        if (insertError) {
          console.error('[QuoteDetail] Error creating version:', insertError);
          // Check if version was created by another process
          const { data: retry } = await (scopedDb
            .from('quotation_versions')
            .select('id') as any)
            .eq('quote_id', resolvedId)
            .limit(1)
            .maybeSingle();
          
          if ((retry as any)?.id) {
            console.log('[QuoteDetail] Version found on retry:', (retry as any).id);
            setVersionId(String((retry as any).id));
          }
          return;
        }
        
        if ((v as any)?.id) {
          console.log('[QuoteDetail] Created version:', (v as any).id);
          setVersionId(String((v as any).id));
        }
      } catch (error) {
        console.error('[QuoteDetail] Unexpected error in loadLatestVersion:', error);
      }
    };
    
    loadLatestVersion();
  }, [resolvedId]);

  const handleSuccess = () => {
    toast.success('Quote updated successfully');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

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
                <BreadcrumbLink href={`/dashboard/quotes/${resolvedId ?? id}`}>Edit</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold">Edit Quote</h1>
            {resolvedId && (
              <ShareQuoteDialog quoteId={resolvedId} quoteNumber={quoteNumber ?? (resolvedId ?? '')} />
            )}
          </div>
        </div>
        <QuoteForm 
            quoteId={resolvedId ?? id} 
            versionId={versionId || undefined}
            onSuccess={handleSuccess} 
        />
        <QuotationVersionHistory quoteId={resolvedId ?? id as string} />
        
      </div>
    </DashboardLayout>
  );
}
