import { useEffect, useMemo, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { useBenchmark } from '@/lib/benchmark';
import { UnifiedQuoteComposer } from '@/components/quotation/unified-composer/UnifiedQuoteComposer';
import { QuotationConfigurationService } from '@/services/quotation/QuotationConfigurationService';
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';
import { CRM_HEADER_PRIMARY_CONTROL_SEQUENCE, CRMModuleHeaderNavigation } from '@/components/crm/CRMModuleHeaderNavigation';
import { useCRMModuleNavigationState } from '@/hooks/useCRMModuleNavigationState';
import { QuoteActionIcon } from '@/components/quotation/QuoteActionIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DynamicFormRenderer } from '@/components/common/DynamicFormRenderer';
import { PluginRegistry } from '@/services/plugins/PluginRegistry';

function QuoteNewInner() {
  useBenchmark('QuoteNew');
  const { supabase, context, scopedDb } = useCRM();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createdQuoteId, setCreatedQuoteId] = useState<string | null>(null);
  const [createdQuoteNumber, setCreatedQuoteNumber] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [, setTenantId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  // Snapshot the arrival navigation state ONCE, on mount.
  //
  // createQuoteShell() below calls setSearchParams() to put ?id=<quoteId> in the URL. React Router
  // v6's setSearchParams navigates with `state: null` when no second argument is given, which wipes
  // location.state — and it does so before setInitializing(false), i.e. before UnifiedQuoteComposer
  // ever mounts. Reading location.state directly for initialData therefore always yielded null/
  // undefined by the time the composer could consume it, silently killing the Smart Quote and
  // QuickQuoteHistory hand-offs.
  //
  // The lazy useState initializer captures the state at first render and never recomputes, so the
  // hand-off payload survives the setSearchParams navigation.
  const [arrivalState] = useState<any>(() => location.state as any);
  const [domainFormValues, setDomainFormValues] = useState<Record<string, unknown>>({});
  const initializedRef = useRef(false);
  const { viewMode, theme, setTheme } = useCRMModuleNavigationState('quotes', { viewMode: 'pipeline' });
  const domainCode = String(arrivalState?.domainCode || 'LOGISTICS').toUpperCase();
  const domainFormConfig = PluginRegistry.getFormConfigByDomain(domainCode);

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
            logger.error('Failed to check quote config', e);
        }
    };
    checkConfig();
  }, [context.tenantId]);

  // Create quote + version shell on mount so UnifiedQuoteComposer has IDs to save against
  useEffect(() => {
    if (!authLoading && !initializedRef.current) {
        initializedRef.current = true;
        const urlId = searchParams.get('id');
        if (urlId) {
            setCreatedQuoteId(urlId);
            setInitializing(false);
            void fetchQuoteNumber(urlId);
        } else {
            createQuoteShell();
        }
    }
  }, [authLoading, scopedDb, searchParams]);

  const fetchQuoteNumber = async (quoteId: string) => {
    try {
      const { data } = await scopedDb
        .from('quotes')
        .select('quote_number')
        .eq('id', quoteId)
        .maybeSingle();
      setCreatedQuoteNumber((data as any)?.quote_number || null);
    } catch (error) {
      logger.warn('[QuoteNew] Failed to fetch quote number', error);
    }
  };

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

      // Check the mount-time navigation-state snapshot for pre-populated data
      const state = arrivalState;
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
        .select('id, quote_number')
        .single();

      if (quoteError || !quote) {
        logger.error('[QuoteNew] Failed to create quote shell:', quoteError);
        setInitializing(false);
        return;
      }

      const quoteId = (quote as any).id;
      const quoteNumber = (quote as any).quote_number || null;
      setCreatedQuoteId(quoteId);
      setCreatedQuoteNumber(quoteNumber);
      
      // Update URL so refresh works
      setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.set('id', quoteId);
          return next;
      });

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

  const handleRefresh = () => {
    window.location.reload();
  };

  // Build initialData from the mount-time snapshot of location.state (Smart Quote hand-off /
  // QuickQuoteHistory pre-population). useMemo keeps the object referentially stable across
  // re-renders so UnifiedQuoteComposer's pre-population effect (deps: [initialData, form]) doesn't
  // re-fire — re-firing would call form.reset() and revert the user's in-progress edits.
  const initialData = useMemo(
    () =>
      arrivalState
        ? {
            ...arrivalState,
            accountId: arrivalState.accountId,
            contactId: arrivalState.contactId,
          }
        : undefined,
    [arrivalState]
  );

  return (
    <DashboardLayout>
      <DetailScreenTemplate
        className="max-w-6xl mx-auto"
        title={createdQuoteNumber ? `Create Quote ${createdQuoteNumber}` : 'Create Quote'}
        headerRowClassName="sm:items-baseline"
        actionContainerClassName="sm:items-baseline"
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Quotes', to: '/dashboard/quotes' },
          { label: createdQuoteNumber || 'New Quote' },
        ]}
        actions={
          <div className="flex w-full flex-wrap items-baseline justify-end gap-4">
            <CRMModuleHeaderNavigation
              moduleLabel="Quotes"
              viewMode={viewMode}
              theme={theme}
              onViewModeChange={() => undefined}
              onThemeChange={setTheme}
              onCreate={() => navigate('/dashboard/quotes/new')}
              createLabel="New Quote"
              onRefresh={handleRefresh}
              onImportExport={() => navigate('/dashboard/quotes/import-export')}
              controlSequence={CRM_HEADER_PRIMARY_CONTROL_SEQUENCE}
              iconOnly
              layout="compact"
              className="!ml-0 !flex-none"
              iconOverrides={{
                create: <QuoteActionIcon name="newQuote" label="New Quote" />,
                refresh: <QuoteActionIcon name="refresh" label="Refresh" />,
                importExport: <QuoteActionIcon name="importExport" label="Import/Export" />,
                theme: <QuoteActionIcon name="defaultSimple" label="Default Simple" />,
              }}
            />
            <Button
              variant="outline"
              className="h-11 gap-2 transition-colors hover:bg-foreground/10 active:bg-foreground/20"
              onClick={() => navigate('/dashboard/quotes')}
              title="Cancel"
            >
              <QuoteActionIcon name="cancel" label="Cancel" />
              Cancel
            </Button>
          </div>
        }
      >

        {initializing ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Initializing...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <UnifiedQuoteComposer
              quoteId={createdQuoteId || undefined}
              versionId={versionId || undefined}
              initialData={initialData}
            />
            {domainFormConfig ? (
              <Card>
                <CardHeader>
                  <CardTitle>Domain Fields ({domainCode})</CardTitle>
                </CardHeader>
                <CardContent>
                  <DynamicFormRenderer
                    config={domainFormConfig}
                    values={domainFormValues}
                    onChange={(fieldId, value) => {
                      setDomainFormValues((prev) => ({ ...prev, [fieldId]: value }));
                    }}
                  />
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </DetailScreenTemplate>
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
