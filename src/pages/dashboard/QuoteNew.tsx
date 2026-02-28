import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { useBenchmark } from '@/lib/benchmark';
import { UnifiedQuoteComposer } from '@/components/sales/unified-composer/UnifiedQuoteComposer';
import { QuotationConfigurationService } from '@/services/quotation/QuotationConfigurationService';

function QuoteNewInner() {
  useBenchmark('QuoteNew');
  const { supabase, context, scopedDb } = useCRM();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [createdQuoteId, setCreatedQuoteId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [, setTenantId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const initializedRef = useRef(false);

  // Check default module configuration
  useEffect(() => {
    const checkConfig = async () => {
        if (!context.tenantId) return;
        try {
            const config = await new QuotationConfigurationService(scopedDb).getConfiguration(context.tenantId);
            if (config.default_module === 'legacy') {
                // Redirect to legacy composer if configured
                navigate('/dashboard/quotes/new-legacy', { replace: true });
            }
        } catch (e) {
            console.error('Failed to check quote config', e);
        }
    };
    checkConfig();
  }, [context.tenantId]);

  // Create quote + version shell on mount so UnifiedQuoteComposer has IDs to save against
  useEffect(() => {
    if (!authLoading && !initializedRef.current) {
        initializedRef.current = true;
        createQuoteShell();
    }
  }, [authLoading]);

  const createQuoteShell = async () => {
    try {
      // Resolve tenant
      let resolvedTenantId = context?.tenantId || null;
      let currentUser = user;

      if (!resolvedTenantId) {
        const { data } = await supabase.auth.getUser();
        currentUser = data.user as any;
        resolvedTenantId = currentUser?.user_metadata?.tenant_id || null;
      }
      setTenantId(resolvedTenantId);

      if (!resolvedTenantId) {
        logger.error('[QuoteNew] No tenant context available');
        setInitializing(false);
        return;
      }

      if (!currentUser?.id) {
        logger.error('[QuoteNew] No user context available');
        setInitializing(false);
        return;
      }

      // Check location state for pre-populated data
      const state = location.state as any;
      const originLabel = state?.origin || '';
      const destLabel = state?.destination || '';
      const mode = state?.mode || 'ocean';

      // Create quote record
      const { data: quote, error: quoteError } = await scopedDb
        .from('quotes')
        .insert({
          tenant_id: resolvedTenantId,
          owner_id: currentUser?.id,
          created_by: currentUser?.id,
          status: 'draft',
          transport_mode: mode,
          origin: originLabel,
          destination: destLabel,
          account_id: state?.accountId || null,
          contact_id: state?.contactId || null,
          opportunity_id: state?.opportunityId || null,
        })
        .select('id')
        .single();

      if (quoteError || !quote) {
        logger.error('[QuoteNew] Failed to create quote shell:', quoteError);
        setInitializing(false);
        return;
      }

      const quoteId = (quote as any).id;
      setCreatedQuoteId(quoteId);

      // Create version
      const { data: version, error: versionError } = await scopedDb
        .from('quotation_versions')
        .insert({
          quote_id: quoteId,
          tenant_id: resolvedTenantId,
          version_number: 1,
        })
        .select('id')
        .single();

      if (versionError || !version) {
        logger.error('[QuoteNew] Failed to create version:', versionError);
        setInitializing(false);
        return;
      }

      setVersionId((version as any).id);
    } catch (err) {
      logger.error('[QuoteNew] Shell creation failed:', err);
    } finally {
      setInitializing(false);
    }
  };

  // Build initialData from location.state (QuickQuoteHistory pre-population)
  const initialData = location.state
    ? {
        ...(location.state as any),
        accountId: (location.state as any)?.accountId,
        contactId: (location.state as any)?.contactId,
      }
    : undefined;

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
                <BreadcrumbLink>New Quote</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold">Create Quote</h1>
        </div>

        {initializing ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Initializing...</span>
          </div>
        ) : (
          <UnifiedQuoteComposer
            quoteId={createdQuoteId || undefined}
            versionId={versionId || undefined}
            initialData={initialData}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

export default function QuoteNew() {
  return <QuoteNewInner />;
}

export async function getLatestVersionIdWithRetry(scopedDb: any, quoteId: string, maxAttempts = 3): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await (scopedDb
      .from('quotation_versions', true)
      .select('id')
      .eq('quote_id', quoteId)
      .order('version_number', { ascending: false })
      .limit(1) as any)
      .single();
    if (!error && data) return data.id as string;
    if (attempt < maxAttempts - 1) {
      const delay = Math.min(800 * Math.pow(2, attempt), 3000);
      await new Promise(res => setTimeout(res, delay));
      continue;
    }
    return null;
  }
  return null;
}
