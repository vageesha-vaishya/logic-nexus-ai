import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuotationVersionHistory } from '@/components/sales/QuotationVersionHistory';
import { UnifiedQuoteComposer } from '@/components/sales/unified-composer/UnifiedQuoteComposer';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';
import { ShareQuoteDialog } from '@/components/sales/portal/ShareQuoteDialog';
import { SendQuoteDialog } from '@/components/sales/SendQuoteDialog';
import { QuotePreviewModal } from '@/components/sales/QuotePreviewModal';
import { useDebug } from '@/hooks/useDebug';
import { Button } from "@/components/ui/button";
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, context, scopedDb } = useCRM();
  const debug = useDebug('Sales', 'QuoteDetail');
  const [loading, setLoading] = useState(true);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const versionAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const checkQuote = async () => {
      try {
        if (!id) throw new Error('Missing quote identifier');
        debug.info('Resolving quote', { id });
        
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

        debug.log('Quote resolved', data);
        setResolvedId((data as any)?.id ?? null);
        setTenantId((data as any)?.tenant_id ?? null);
        setQuoteNumber((data as any)?.quote_number ?? null);
        setLoading(false);
      } catch (err: any) {
        debug.error('Failed to load quote', { error: err.message });
        toast.error('Failed to load quote', { description: err.message });
        navigate('/dashboard/quotes');
      }
    };
    checkQuote();
  }, [id]);

  useEffect(() => {
    const loadLatestVersion = async () => {
      if (!resolvedId) return;
      
      debug.info('Loading latest version', { quoteId: resolvedId });
      
      try {
        if (versionAbortRef.current) versionAbortRef.current.abort();
        versionAbortRef.current = new AbortController();
        const signal = versionAbortRef.current.signal;
        const { data, error } = await (scopedDb
          .from('quotation_versions')
          .select('id, version_number, tenant_id') as any)
          .eq('quote_id', resolvedId)
          .order('version_number', { ascending: false })
          .limit(1)
          .abortSignal(signal);
        
        if (error) {
          debug.error('Error querying versions', error);
          return;
        }
        
        if (Array.isArray(data) && data.length && (data[0] as any)?.id) {
          const v = data[0] as any;
          debug.log('Found existing version', { versionId: v.id });
          setVersionId(String(v.id));
          if (!tenantId && v.tenant_id) {
             debug.log('Resolved tenant from version', v.tenant_id);
             setTenantId(v.tenant_id);
          }
          return;
        }
        
        // Create initial version only if none exists
        debug.log('No version found, creating version 1');
        
        let finalTenantId = tenantId;
        if (!finalTenantId) {
          // Fallback: fetch tenant from quote if not already set
          const { data: qRow, error: qError } = await scopedDb
            .from('quotes')
            .select('tenant_id')
            .eq('id', resolvedId)
            .maybeSingle()
            .abortSignal(signal);
          
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
          .maybeSingle()
          .abortSignal(signal);
        
        if (insertError) {
          console.error('[QuoteDetail] Error creating version:', insertError);
          // Check if version was created by another process
          const { data: retry } = await (scopedDb
            .from('quotation_versions')
            .select('id') as any)
            .eq('quote_id', resolvedId)
            .limit(1)
            .maybeSingle()
            .abortSignal(signal);
          
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
      } catch (error: any) {
        const msg = error?.message ? String(error.message).toLowerCase() : '';
        if (error?.name === 'AbortError' || msg.includes('aborted')) return;
        console.error('[QuoteDetail] Unexpected error in loadLatestVersion:', error);
      }
    };
    
    loadLatestVersion();
    return () => {
      if (versionAbortRef.current) versionAbortRef.current.abort();
    };
  }, [resolvedId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DetailScreenTemplate
        title={`Edit Quote: ${quoteNumber ?? id}`}
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Quotes', to: '/dashboard/quotes' },
          { label: quoteNumber ?? (id || 'Detail') },
        ]}
        actions={
          resolvedId && (
            <>
              <Button 
                  variant="outline" 
                  onClick={() => navigate(`/dashboard/bookings/new?quoteId=${resolvedId}`)}
                  data-testid="convert-booking-btn"
              >
                  Convert to Booking
              </Button>
              <QuotePreviewModal 
                quoteId={resolvedId} 
                quoteNumber={quoteNumber ?? (resolvedId ?? '')} 
                versionId={versionId || undefined}
              />
              <ShareQuoteDialog quoteId={resolvedId} quoteNumber={quoteNumber ?? (resolvedId ?? '')} />
              <SendQuoteDialog 
                  quoteId={resolvedId} 
                  quoteNumber={quoteNumber ?? (resolvedId ?? '')} 
                  versionId={versionId || ''}
              />
            </>
          )
        }
      >
        <div className="space-y-6">
          <UnifiedQuoteComposer
              quoteId={resolvedId ?? id}
              versionId={versionId || undefined}
          />
          <QuotationVersionHistory 
              quoteId={resolvedId ?? (id as string)} 
              key={versionId} // Force reload when version is resolved/created
          />
        </div>
      </DetailScreenTemplate>
    </DashboardLayout>
  );
}
