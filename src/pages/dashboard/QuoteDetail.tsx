import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { VersionHistoryPanel } from '@/components/sales/quotation-versions/VersionHistoryPanel';
import { SaveVersionDialog } from '@/components/sales/quotation-versions/SaveVersionDialog';
import { QuotationComparisonDashboard } from '@/components/sales/quotation-versions/QuotationComparisonDashboard';
import { QuotationVersionHistory } from '@/components/sales/QuotationVersionHistory';
import { UnifiedQuoteComposer } from '@/components/sales/unified-composer/UnifiedQuoteComposer';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { ShareQuoteDialog } from '@/components/sales/portal/ShareQuoteDialog';
import { SendQuoteDialog } from '@/components/sales/SendQuoteDialog';
import { QuotePreviewModal } from '@/components/sales/QuotePreviewModal';
import { useDebug } from '@/hooks/useDebug';
import { Button } from "@/components/ui/button";
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';
import { QuotationConfigurationService } from '@/services/quotation/QuotationConfigurationService';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, context, scopedDb } = useCRM();
  const debug = useDebug('Sales', 'QuoteDetail');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const [showSaveVersion, setShowSaveVersion] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [comparisonOptions, setComparisonOptions] = useState<any[]>([]);
  const versionAbortRef = useRef<AbortController | null>(null);

  // Load configuration
  useEffect(() => {
    if (context.tenantId) {
      new QuotationConfigurationService(scopedDb).getConfiguration(context.tenantId).then(setConfig);
    }
  }, [context.tenantId]);

  // Load comparison options if multi-option enabled
  useEffect(() => {
    if (config?.multi_option_enabled && versionId) {
        scopedDb.from('quotation_version_options')
            .select('*')
            .eq('quotation_version_id', versionId)
            .then(({ data }) => setComparisonOptions(data || []));
    }
  }, [config, versionId]);

  useEffect(() => {
    const checkQuote = async () => {
      try {
        setError(null);
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
        // Don't set loading to false here, wait for version
      } catch (err: any) {
        debug.error('Failed to load quote', { error: err.message });
        setError(err.message || 'Failed to load quote');
        setLoading(false);
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
          throw error;
        }
        
        if (Array.isArray(data) && data.length && (data[0] as any)?.id) {
          const v = data[0] as any;
          debug.log('Found existing version', { versionId: v.id });
          setVersionId(String(v.id));
          if (!tenantId && v.tenant_id) {
             debug.log('Resolved tenant from version', v.tenant_id);
             setTenantId(v.tenant_id);
          }
          setLoading(false);
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
          throw new Error('Cannot create version: no tenant_id available');
        }
        
        // Use upsert with ignoreDuplicates to handle race conditions safely
        // This prevents "duplicate key value violates unique constraint" errors
        const { data: v, error: upsertError } = await scopedDb
          .from('quotation_versions')
          .upsert({ 
            quote_id: resolvedId, 
            tenant_id: finalTenantId, 
            version_number: 1,
            major: 1, 
            minor: 0,
            status: 'draft',
            kind: 'major' 
          }, { 
            onConflict: 'quote_id, version_number', 
            ignoreDuplicates: true 
          })
          .select('id')
          .maybeSingle()
          .abortSignal(signal);
        
        if (upsertError) {
          debug.error('Error creating version:', upsertError);
          throw upsertError;
        }
        
        if ((v as any)?.id) {
          debug.log('Created version:', (v as any).id);
          setVersionId(String((v as any).id));
        } else {
          // If v is null, it means the row already exists (ignoreDuplicates triggered)
          // So we fetch the existing version
          debug.log('Version already exists, fetching...');
          const { data: existing } = await supabase
            .from('quotation_versions')
            .select('id')
            .eq('quote_id', resolvedId)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle()
            .abortSignal(signal);
            
          if ((existing as any)?.id) {
             setVersionId(String((existing as any).id));
          } else {
             throw new Error('Failed to retrieve existing version after conflict');
          }
        }
        setLoading(false);
      } catch (error: any) {
        const msg = error?.message ? String(error.message).toLowerCase() : '';
        if (error?.name === 'AbortError' || msg.includes('aborted')) return;
        console.error('[QuoteDetail] Unexpected error in loadLatestVersion:', error);
        setError(error.message || 'Failed to load quotation version');
        setLoading(false);
      }
    };
    
    loadLatestVersion();
    return () => {
      if (versionAbortRef.current) versionAbortRef.current.abort();
    };
  }, [resolvedId]);

  const handleSaveVersion = async (type: 'minor' | 'major', reason: string) => {
    if (!resolvedId) return;
    
    // Client-side integrity check: Ensure session exists
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        toast.error('No active session. Please sign in again.');
        return;
    }

    try {
      const { error } = await supabase.functions.invoke('save-quotation-version', {
        body: {
          quoteId: resolvedId,
          type,
          reason
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (error) throw error;
      toast.success('Version saved successfully');
      setVersionId(prev => prev + '_new'); // Force refresh
    } catch (err: any) {
      console.error('Failed to save version:', err);
      toast.error('Failed to save version');
    }
  };

  const handleRestoreVersion = async (vId: string) => {
    if (!confirm('Are you sure you want to restore this version? This will overwrite the current quote data.')) {
        return;
    }

    try {
        const { error } = await supabase.functions.invoke('restore-quotation-version', {
            body: { versionId: vId }
        });

        if (error) throw error;
        toast.success('Version restored successfully');
        
        // Reload page or force refresh context to show restored data
        // For now, simple reload to ensure clean state
        window.location.reload();
    } catch (err: any) {
        console.error('Failed to restore version:', err);
        toast.error('Failed to restore version');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="text-muted-foreground">Loading quotation details...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-2xl mx-auto">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-destructive/20 p-2 rounded-full">
                        <CloudOff className="w-6 h-6 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold text-destructive">Failed to Load Quotation</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                    {error}
                </p>
                <div className="flex space-x-4">
                    <Button onClick={() => window.location.reload()}>
                        Retry
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/dashboard/quotes')}>
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        </div>
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
                  onClick={() => setShowSaveVersion(true)}
              >
                  Save Version
              </Button>
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
          {config?.multi_option_enabled && comparisonOptions.length > 0 && (
            <QuotationComparisonDashboard 
              options={comparisonOptions}
              onSelect={(optId) => {
                // Handle option selection logic (e.g. mark as selected)
                toast.success('Option selected');
              }}
            />
          )}
          
          <UnifiedQuoteComposer
              quoteId={resolvedId ?? id}
              versionId={versionId || undefined}
          />
          <QuotationVersionHistory 
              quoteId={resolvedId ?? (id as string)} 
              key={versionId} // Force reload when version is resolved/created
          />
          <VersionHistoryPanel
            quoteId={resolvedId ?? (id as string)}
            onRestore={handleRestoreVersion}
          />
        </div>
        
        <SaveVersionDialog
          open={showSaveVersion}
          onOpenChange={setShowSaveVersion}
          onSave={handleSaveVersion}
        />
      </DetailScreenTemplate>
    </DashboardLayout>
  );
}
