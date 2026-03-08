import { useState, useEffect, useMemo, useReducer, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { quoteComposerSchema, QuoteComposerValues } from './schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Plane, Ship, Truck, Train, Timer, Sparkles, ChevronDown, Save, Settings2, Building2, User, FileText, Loader2, AlertCircle, History, ExternalLink, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplateSelector } from "@/components/sales/quotation-versions/TemplateSelector";
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { QuotationNumberService } from '@/services/quotation/QuotationNumberService';
import { useToast } from '@/hooks/use-toast';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { useRateFetching, ContainerResolver } from '@/hooks/useRateFetching';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { PricingService } from '@/services/pricing.service';
import { QuoteOptionService } from '@/services/QuoteOptionService';
import { PortsService } from '@/services/PortsService';
import { RateOption } from '@/types/quote-breakdown';
import { invokeFunction } from '@/lib/supabase-functions';
import { logger } from '@/lib/logger';
import { sanitizePayload } from '@/lib/utils/sanitizer';
import { supabase } from '@/integrations/supabase/client';

import { QuoteStoreProvider, useQuoteStore } from '@/components/sales/composer/store/QuoteStore';
import { useQuoteRepositoryContext } from '@/components/sales/quote-form/useQuoteRepository';
import { FormZone, FormZoneValues, ExtendedFormData } from './FormZone';
import { ResultsZone } from './ResultsZone';
import { FinalizeSection } from './FinalizeSection';

import { QuotationConfigurationService } from '@/services/quotation/QuotationConfigurationService';
import { QuotationOptionCrudService } from '@/services/quotation/QuotationOptionCrudService';
import { QuotationRankingService } from '@/services/quotation/QuotationRankingService';
import { showQuotationSuccessToast } from '@/components/notifications/QuotationSuccessToast';
import { EnterpriseFormLayout } from '@/components/ui/enterprise';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UnifiedQuoteComposerProps {
  quoteId?: string;
  versionId?: string;
  initialData?: any; // Pre-population from QuickQuoteHistory / navigation state
}

type ValidationIssue = {
  path: string;
  label: string;
  message: string;
};

// ---------------------------------------------------------------------------
// Wrapped export (provides QuoteStoreProvider)
// ---------------------------------------------------------------------------

export function UnifiedQuoteComposer(props: UnifiedQuoteComposerProps) {
  // console.log('[UnifiedComposer] Rendering with props:', props);
  return (
    <QuoteStoreProvider>
      <UnifiedQuoteComposerContent {...props} />
    </QuoteStoreProvider>
  );
}

// ---------------------------------------------------------------------------
// Inner content component
// ---------------------------------------------------------------------------

function UnifiedQuoteComposerContent({ quoteId, versionId, initialData }: UnifiedQuoteComposerProps) {
  logger.debug('[UnifiedComposer] Render Content', { quoteId, versionId });
  const { scopedDb, context, supabase } = useCRM();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { containerTypes, containerSizes } = useContainerRefs();
  const { state: storeState, dispatch } = useQuoteStore();
  const { invokeAiAdvisor } = useAiAdvisor();
  const repoData = useQuoteRepositoryContext();

  const form = useForm<QuoteComposerValues>({
    resolver: zodResolver(quoteComposerSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      mode: 'ocean',
      origin: '',
      destination: '',
      originId: '',
      destinationId: '',
      commodity: '',
      marginPercent: 15,
      autoMargin: true,
      accountId: '',
      contactId: '',
      opportunityId: '',
      quoteTitle: '',
    },
  });

  // Local state
  const [selectedOption, setSelectedOption] = useState<RateOption | null>(null);
  const [quoteTenantId, setQuoteTenantId] = useState<string | null>(null);
  const [visibleRateIds, setVisibleRateIds] = useState<string[]>([]);
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [complianceCheck, setComplianceCheck] = useState<{ compliant: boolean; issues: any[] } | null>(null);
  const [lastFormData, setLastFormData] = useState<{ values: FormZoneValues; extended: ExtendedFormData } | null>(null);
  const [manualOptions, setManualOptions] = useState<RateOption[]>([]);
  const [deletedOptionIds, setDeletedOptionIds] = useState<string[]>([]);
  const [optionDrafts, setOptionDrafts] = useState<Record<string, any>>({});
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'checking'>('online');
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);
  const [showValidationSummary, setShowValidationSummary] = useState(false);

  // PDF Generation State
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Rate fetching hook
  const rateFetching = useRateFetching();
  
  // Clear deleted options when new search starts
  useEffect(() => {
    if (rateFetching.loading) {
      setDeletedOptionIds([]);
      setVisibleRateIds([]);
    }
  }, [rateFetching.loading]);

  // Initialize visible rates with a single default option when results arrive
  useEffect(() => {
    if (rateFetching.results && rateFetching.results.length > 0) {
      // Only set default visible option if NOT in Smart Mode
      // In Smart Mode, we start with no selected options (only AI Analysis + Available Rates)
      if (!isSmartMode) {
        // Select the first one (highest rank/priority from fetch) as default
        setVisibleRateIds([rateFetching.results[0].id]);
      } else {
        // In Smart Mode, ensure no options are pre-selected
        setVisibleRateIds([]);
      }
    }
  }, [rateFetching.results, isSmartMode]);
  
  // CRM Data
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [isCrmLoading, setIsCrmLoading] = useState(false);

  // Load CRM Data and Ports
  useEffect(() => {
    // Retry helper with exponential backoff
    const retryFetch = async <T,>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        if (retries <= 0) throw err;
        await new Promise(res => setTimeout(res, delay));
        return retryFetch(fn, retries - 1, delay * 2);
      }
    };

    const loadCrmData = async () => {
      logger.debug('loadCrmData started');
      setIsCrmLoading(true);
      try {
        const portsService = new PortsService(scopedDb);
        logger.debug('Fetching CRM data and ports');
        
        // Execute parallel fetch with retry mechanism
        const [accRes, conRes, oppRes, ports] = await retryFetch(() => Promise.all([
          scopedDb.from('accounts').select('id, name').order('name'),
          scopedDb.from('contacts').select('id, first_name, last_name, account_id').order('last_name'),
          scopedDb.from('opportunities').select('id, name, account_id, contact_id').order('created_at', { ascending: false }),
          portsService.getAllPorts()
        ]));

        logger.debug('CRM data and ports loaded successfully', { 
            portsLength: ports?.length,
            accountsLength: accRes.data?.length 
        });

        if (accRes.data) setAccounts(accRes.data);
        if (conRes.data) setContacts(conRes.data);
        if (oppRes.data) setOpportunities(oppRes.data);

        // Populate store reference data
        dispatch({
          type: 'SET_REFERENCE_DATA',
          payload: {
            accounts: accRes.data || [],
            contacts: conRes.data || [],
            ports: ports || []
          }
        });
      } catch (err) {
        logger.error('Failed to load CRM data after retries', { error: err });
        // Optional: Show toast error here
      } finally {
        setIsCrmLoading(false);
      }
    };

    loadCrmData();
  }, [scopedDb, dispatch]);
   const { profile } = useAuth();
   // Temporary override: Allow all users to override quote numbers during development
   const canOverrideQuoteNumber = true; 
   // Original permission check:
   // const canOverrideQuoteNumber = ['platform_admin', 'tenant_admin', 'sales_manager'].includes((profile as any)?.role || '');

  // Edit mode state
  const [isEditMode] = useState(() => !!quoteId);
  const [editLoading, setEditLoading] = useState(() => !!quoteId);
  const [initialFormValues, setInitialFormValues] = useState<Partial<FormZoneValues> | undefined>(undefined);
  const [initialExtended, setInitialExtended] = useState<Partial<ExtendedFormData> | undefined>(undefined);
  const [config, setConfig] = useState<any>(null);

  // Load configuration
  useEffect(() => {
    if (context.tenantId) {
      new QuotationConfigurationService(supabase).getConfiguration(context.tenantId).then(setConfig);
    }
  }, [context.tenantId]);

  // Container resolver for rate fetching
  const containerResolver: ContainerResolver = useMemo(() => ({
    resolveContainerInfo: (typeId: string, sizeId: string) => {
      const typeObj = containerTypes.find(t => t.id === typeId);
      const sizeObj = containerSizes.find(s => s.id === sizeId);
      return {
        type: typeObj?.code || typeObj?.name || typeId,
        size: sizeObj?.name || sizeId,
        iso_code: sizeObj?.iso_code,
      };
    },
  }), [containerTypes, containerSizes]);

  // ---------------------------------------------------------------------------
  // Audit Helper
  // ---------------------------------------------------------------------------

  const logAudit = useCallback(async (action: string, details: any, status: 'success' | 'failure' = 'success') => {
    try {
      // Use fire-and-forget for audit logs to not block UI
      scopedDb.from('audit_logs').insert({
        user_id: user?.id,
        action,
        resource_type: 'quotation',
        resource_id: quoteId,
        details: {
          ...details,
          status,
          component: 'UnifiedQuoteComposer',
          timestamp: new Date().toISOString()
        },
        // Rely on DB triggers/RLS for tenant_id/franchise_id if possible, or context
        tenant_id: context?.tenantId,
        franchise_id: context?.franchiseId
      }).then(({ error }) => {
        if (error) logger.warn('[UnifiedComposer] Audit log failed:', error);
      });
    } catch (e) {
      logger.warn('[UnifiedComposer] Audit log exception:', e);
    }
  }, [user?.id, quoteId, context?.tenantId, context?.franchiseId, scopedDb]);

  const normalizeFieldLabel = useCallback((path: string): string => {
    const customLabels: Record<string, string> = {
      origin: 'Origin',
      originId: 'Origin',
      destination: 'Destination',
      destinationId: 'Destination',
      commodity: 'Commodity',
      quoteTitle: 'Quote Reference',
      accountId: 'Account',
      contactId: 'Contact',
      opportunityId: 'Opportunity',
      guestCompany: 'Company Name',
      guestName: 'Full Name',
      guestEmail: 'Email Address',
      containerType: 'Container Type',
      containerSize: 'Container Size',
      containerQty: 'Container Quantity',
      weight: 'Weight',
      volume: 'Volume',
    };
    if (customLabels[path]) return customLabels[path];
    const token = path.split('.').pop() || path;
    return token
      .replace(/\[(\d+)\]/g, ' $1 ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (s) => s.toUpperCase());
  }, []);

  const normalizeIssuePath = useCallback((path: string): string => {
    const normalized = String(path || '').replace(/^root\./, '');
    const aliasMap: Record<string, string> = {
      originId: 'origin',
      destinationId: 'destination',
    };
    return aliasMap[normalized] || normalized;
  }, []);

  const flattenValidationErrors = useCallback((errors: any, parentPath = ''): ValidationIssue[] => {
    if (!errors || typeof errors !== 'object') return [];
    const issues: ValidationIssue[] = [];
    Object.entries(errors).forEach(([key, value]: [string, any]) => {
      if (!value) return;
      const path = parentPath ? `${parentPath}.${key}` : key;
      if (typeof value?.message === 'string' && value.message.trim()) {
        const normalizedPath = normalizeIssuePath(path);
        issues.push({
          path: normalizedPath,
          label: normalizeFieldLabel(normalizedPath),
          message: value.message.trim(),
        });
      }
      if (typeof value === 'object') {
        issues.push(...flattenValidationErrors(value, path));
      }
    });
    return issues;
  }, [normalizeFieldLabel, normalizeIssuePath]);

  const validationIssues = useMemo(() => {
    const unique = new Map<string, ValidationIssue>();
    flattenValidationErrors(form.formState.errors).forEach((issue) => {
      if (!unique.has(issue.path)) unique.set(issue.path, issue);
    });
    return Array.from(unique.values());
  }, [form.formState.errors, flattenValidationErrors]);

  const scrollToField = useCallback((path: string) => {
    if (typeof document === 'undefined') return;
    const normalized = normalizeIssuePath(path);
    const pathCandidates = [normalized, normalized.split('.')[0]].filter(Boolean);
    const allNamed = Array.from(document.querySelectorAll<HTMLElement>('[name]'));
    const targetByName = pathCandidates
      .map((candidate) => allNamed.find((node) => node.getAttribute('name') === candidate))
      .find(Boolean) as HTMLElement | undefined;
    const targetByAnchor = pathCandidates
      .map((candidate) => document.querySelector<HTMLElement>(`[data-field-name="${candidate}"]`))
      .find(Boolean) as HTMLElement | undefined;
    const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target = targetByName || targetByAnchor || firstInvalid;
    if (!target) return;
    const container = target.closest('[data-field-name]') as HTMLElement | null;
    const scrollTarget = container || target;
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof (target as any).focus === 'function') {
      (target as any).focus({ preventScroll: true });
    } else if (typeof (scrollTarget as any).focus === 'function') {
      (scrollTarget as any).focus({ preventScroll: true });
    }
  }, [normalizeIssuePath]);

  const handleValidationFailed = useCallback(() => {
    setShowValidationSummary(true);
    // Wait for render then scroll to first error
    setTimeout(() => {
      // Re-calculate issues or use current state
      if (validationIssues.length > 0) {
        scrollToField(validationIssues[0].path);
      }
    }, 100);
  }, [validationIssues, scrollToField]);

  useEffect(() => {
    if (validationIssues.length === 0 && showValidationSummary) {
      setShowValidationSummary(false);
    }
  }, [validationIssues.length, showValidationSummary]);

  // ---------------------------------------------------------------------------
  // Network Connectivity Check
  // ---------------------------------------------------------------------------

  const checkNetworkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      // Simple check: try to access Supabase REST API health endpoint
      // We don't care about the status code (401/404 is fine), just that we got a response
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
          method: 'HEAD',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
      
      return true;
    } catch (err: any) {
      // Only consider it offline if it's a genuine network error
      if (
        err?.name === 'AbortError' ||
        err?.message?.includes('signal is aborted') ||
        err?.message?.includes('aborted') ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('NetworkError')
      ) {
        logger.warn('[UnifiedComposer] Genuine network connectivity issue detected', err);
        return false;
      }
      
      // For other errors (permissions, etc.), assume we're online
      return true;
    }
  }, []);

  const saveWithRetry = useCallback(async (
    operation: () => Promise<any>, 
    maxRetries = 2,
    delay = 1000
  ): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (err: any) {
        const isNetworkError = (
          err?.name === 'AbortError' ||
          err?.message?.includes('signal is aborted') ||
          err?.message?.includes('aborted') ||
          err?.message?.includes('Network connection unavailable') ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('NetworkError') ||
          err.message?.includes('fetch') ||
          err.code === 'NETWORK_ERROR' ||
          err.status === 0
        );
        
        if (attempt === maxRetries + 1 || !isNetworkError) {
          throw err;
        }
        
        logger.warn(`[UnifiedComposer] Save attempt ${attempt} failed, retrying...`, err);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Network Status Monitoring
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const checkConnection = async () => {
      setNetworkStatus('checking');
      const isOnline = await checkNetworkConnectivity();
      setNetworkStatus(isOnline ? 'online' : 'offline');
      // Don't show warning automatically - only on actual save failures
    };

    // Check on initial load
    checkConnection();

    // Set up less frequent checks (every 2 minutes instead of 30 seconds)
    const interval = setInterval(checkConnection, 120000);

    // Listen for browser online/offline events
    const handleOnline = () => {
      setNetworkStatus('online');
      setShowNetworkWarning(false); // Hide warning when back online
    };
    const handleOffline = () => setNetworkStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkNetworkConnectivity]);

  // ---------------------------------------------------------------------------
  // Validation Summary Panel
  // ---------------------------------------------------------------------------

  const renderValidationSummary = () => {
    if (!showValidationSummary || validationIssues.length === 0) return null;

    return (
      <Alert
        variant="destructive"
        className="mb-6 animate-in fade-in slide-in-from-top-2"
        role="alert"
        aria-live="assertive"
        aria-label="Validation summary"
        data-testid="validation-summary"
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="ml-2 flex items-center justify-between">
          <span>Please fix the following errors before proceeding:</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 hover:bg-destructive/20 text-destructive-foreground"
            onClick={() => setShowValidationSummary(false)}
            aria-label="Close validation summary"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription className="mt-2 ml-2">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {validationIssues.map((issue) => (
              <li key={issue.path} className="text-destructive-foreground/90">
                <button 
                  type="button" 
                  onClick={() => scrollToField(issue.path)}
                  className="hover:underline text-left font-medium"
                  aria-label={`Go to ${issue.label} field error`}
                >
                  {issue.label}: {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  };

  // ---------------------------------------------------------------------------
  // Handle Manual Option Creation
  // ---------------------------------------------------------------------------

  const handleAddManualOption = useCallback(() => {
    const newOption: RateOption = {
      id: `manual-${Date.now()}`,
      carrier: '',
      name: '',
      price: 0,
      currency: 'USD',
      transitTime: 'TBD',
      tier: 'custom',
      is_manual: true,
      source_attribution: 'Manual Quote',
      legs: [],
      charges: [],
    };
    setManualOptions(prev => [...prev, newOption]);
    
    // Initialize draft
    setOptionDrafts(prev => ({
        ...prev,
        [newOption.id]: {
            legs: [],
            charges: [],
            marginPercent: 15
        }
    }));
    
    setSelectedOption(newOption);
  }, []);

  // Combine results
  const combinedResults = useMemo(() => {
    const fetched = rateFetching.results || [];
    // Only include fetched rates that are explicitly visible
    const visibleFetched = fetched.filter(opt => visibleRateIds.includes(opt.id));
    const all = [...visibleFetched, ...manualOptions];
    return all.filter(opt => !deletedOptionIds.includes(opt.id));
  }, [rateFetching.results, manualOptions, deletedOptionIds, visibleRateIds]);

  // Available options (fetched but not yet added/visible)
  const availableOptions = useMemo(() => {
    const fetched = rateFetching.results || [];
    return fetched.filter(opt => !visibleRateIds.includes(opt.id) && !deletedOptionIds.includes(opt.id));
  }, [rateFetching.results, visibleRateIds, deletedOptionIds]);

  const handleAddRateOption = useCallback((optionId: string) => {
    setVisibleRateIds(prev => [...prev, optionId]);
  }, []);

  const getTransitDays = (val?: string | null) => {
    if (!val) return null;
    const m = String(val).match(/(\d+)/);
    return m ? Number(m[1]) : null;
  };

  const isLegacyCargoSchemaError = useCallback((error: any): boolean => {
    const message = String(error?.message || '');
    if (!/column\s+"?[\w]+"?\s+does not exist/i.test(message)) return false;
    return /column\s+"?(name|iso_code)"?\s+does not exist/i.test(message);
  }, []);

  const displayResults = useMemo(() => {
    if (!combinedResults || combinedResults.length === 0) return [];
    const criteria = config?.auto_ranking_criteria || { cost: 0.4, transit_time: 0.3, reliability: 0.3 };

    const ranked = QuotationRankingService.rankOptions(
      combinedResults.map((o) => ({
        id: o.id,
        total_amount: o.price ?? o.total_amount ?? 0,
        transit_time_days: getTransitDays(o.transitTime),
        reliability_score: (o.reliability?.score ?? 5) / 10,
      })),
      criteria
    );

    const metaById = new Map(ranked.map((r) => [r.id, r]));
    const merged = combinedResults.map((o) => ({
      ...o,
      ...(metaById.get(o.id) || {}),
    })) as RateOption[];

    return merged.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
  }, [combinedResults, config?.auto_ranking_criteria]);

  const handleRemoveOption = useCallback(async (optionId: string) => {
    if (displayResults.length <= 1) {
      toast({ title: 'Cannot delete', description: 'At least one option is required.', variant: 'destructive' });
      return;
    }

    // Check if it's a visible market rate
    const isMarketRate = rateFetching.results?.some(r => r.id === optionId);
    if (isMarketRate) {
      setVisibleRateIds(prev => prev.filter(id => id !== optionId));
      if (selectedOption?.id === optionId) {
        const next = displayResults.find((o) => o.id !== optionId) || null;
        setSelectedOption(next);
      }
      return;
    }

    const isUUID = (v: any) =>
      typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    // If it's not a UUID (temp/manual), handle locally
          if (!isUUID(optionId)) {
            setDeletedOptionIds((prev) => [...prev, optionId]);
            setManualOptions((prev) => prev.filter((o) => o.id !== optionId));
            setOptionDrafts((prev) => {
              const next = { ...prev };
              delete next[optionId];
              return next;
            });

            if (selectedOption?.id === optionId) {
              const next = displayResults.find((o) => o.id !== optionId) || null;
              setSelectedOption(next);
            }
            return;
          }

    try {
      const svc = new QuotationOptionCrudService(supabase);
      const { reselectedOptionId } = await svc.deleteOption(optionId, 'User removed option from composer');
      
      setManualOptions((prev) => prev.filter((o) => o.id !== optionId));
      setDeletedOptionIds((prev) => [...prev, optionId]); // Ensure it's hidden even if somehow still present in fetched results
      setOptionDrafts((prev) => {
        const next = { ...prev };
        delete next[optionId];
        return next;
      });

      if (selectedOption?.id === optionId) {
        const next = (reselectedOptionId && displayResults.find((o) => o.id === reselectedOptionId)) || displayResults.find((o) => o.id !== optionId) || null;
        setSelectedOption(next);
      }
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || 'Could not delete option', variant: 'destructive' });
    }
  }, [displayResults, rateFetching.results, selectedOption, supabase, toast]);

  const [attachments, setAttachments] = useState<any[]>([]);
  const [loadedAttachments, setLoadedAttachments] = useState<any[]>([]); // Track original attachments for diffing
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);

  const parseJsonObject = useCallback((value: any): Record<string, any> | null => {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, any>;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const normalizeCommodityText = useCallback((commodity: any): string => {
    if (!commodity) return '';
    if (typeof commodity === 'string') return commodity;
    if (typeof commodity === 'object') {
      return String(commodity.description || commodity.name || '').trim();
    }
    return String(commodity).trim();
  }, []);

  const buildCargoSnapshot = useCallback((values: any, extended: any) => {
    const cargoItem = (extended?.cargoItem || values?.cargoItem || null) as any;
    const commodityFromCargoItem = normalizeCommodityText(cargoItem?.commodity);
    const rawCommodity = (normalizeCommodityText(values?.commodity) || commodityFromCargoItem || '').trim();
    const hazmat = cargoItem?.hazmat;
    const dangerousGoods = Boolean(values?.dangerousGoods || extended?.dangerousGoods || hazmat);
    const totalWeightKg = Number(values?.weight ?? cargoItem?.weight?.value ?? 0) || 0;
    const totalVolumeCbm = Number(values?.volume ?? cargoItem?.volume ?? 0) || 0;
    return {
      commodity: rawCommodity || null,
      total_weight_kg: totalWeightKg,
      total_volume_cbm: totalVolumeCbm,
      dangerous_goods: dangerousGoods,
      hts_code: values?.htsCode || extended?.htsCode || cargoItem?.commodity?.hts_code || null,
      cargo_type: cargoItem?.type || null,
      quantity: Number(cargoItem?.quantity) || null,
      weight_unit: cargoItem?.weight?.unit || null,
      dimensions: cargoItem?.dimensions || null,
      stackable: typeof cargoItem?.stackable === 'boolean' ? cargoItem.stackable : null,
      commodity_details: cargoItem?.commodity || null,
      hazmat_details: hazmat || null,
      container_combos: cargoItem?.containerCombos || null,
    };
  }, [normalizeCommodityText]);

  const flattenOptionCharges = useCallback((option: RateOption | null | undefined): any[] => {
    if (!option) return [];
    const globalCharges = Array.isArray(option.charges) ? option.charges : [];
    const legCharges = (Array.isArray(option.legs) ? option.legs : []).flatMap((leg: any) => {
      const charges = Array.isArray(leg?.charges) ? leg.charges : [];
      return charges.map((charge: any) => ({
        ...charge,
        legId: charge?.legId || charge?.leg_id || leg.id || null,
        leg_id: charge?.leg_id || charge?.legId || leg.id || null,
      }));
    });
    const merged = [...globalCharges, ...legCharges];
    const seen = new Set<string>();
    return merged.filter((charge: any) => {
      const legKey = charge?.legId || charge?.leg_id || 'combined';
      const category = String(charge?.category_id || charge?.category || charge?.name || '').toLowerCase().trim();
      const basis = String(charge?.basis_id || charge?.basis || '').toLowerCase().trim();
      const currency = String(charge?.currency_id || charge?.currency || 'usd').toLowerCase().trim();
      const buyQty = Number(charge?.buy?.quantity ?? charge?.quantity ?? 1).toFixed(4);
      const buyRate = Number(charge?.buy?.rate ?? charge?.rate ?? 0).toFixed(4);
      const buyAmount = Number(charge?.buy?.amount ?? charge?.amount ?? 0).toFixed(4);
      const sellQty = Number(charge?.sell?.quantity ?? charge?.quantity ?? 1).toFixed(4);
      const sellRate = Number(charge?.sell?.rate ?? charge?.rate ?? 0).toFixed(4);
      const sellAmount = Number(charge?.sell?.amount ?? charge?.amount ?? 0).toFixed(4);
      const signature = `${legKey}|${category}|${basis}|${currency}|${buyQty}|${buyRate}|${buyAmount}|${sellQty}|${sellRate}|${sellAmount}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }, []);

  const extractContainerCombos = useCallback((values: any, extended: any) => {
    const direct = Array.isArray(values?.containerCombos) ? values.containerCombos : [];
    if (direct.length > 0) return direct;

    const ext = Array.isArray(extended?.containerCombos) ? extended.containerCombos : [];
    if (ext.length > 0) return ext;

    const cargoCombos = Array.isArray(extended?.cargoItem?.containerCombos)
      ? extended.cargoItem.containerCombos
      : (Array.isArray(values?.cargoItem?.containerCombos) ? values.cargoItem.containerCombos : []);

    if (cargoCombos.length > 0) {
      return cargoCombos.map((c: any) => ({
        type: c.type || c.typeId || '',
        size: c.size || c.sizeId || '',
        qty: Number(c.qty ?? c.quantity ?? 1) || 1,
      }));
    }

    return [];
  }, []);

  const syncQuoteCargoDetails = useCallback(async (savedQuoteId: string, cargoSnapshot: Record<string, any>) => {
    try {
      const quoteQuery = scopedDb.from('quotes') as any;
      if (typeof quoteQuery?.update !== 'function') {
        logger.warn('[UnifiedComposer] Post-save cargo_details sync skipped: update() unavailable', { savedQuoteId });
        return;
      }
      const { error } = await quoteQuery
        .update({ cargo_details: cargoSnapshot } as any)
        .eq('id', savedQuoteId);
      if (error) {
        logger.warn('[UnifiedComposer] Post-save cargo_details sync failed', { savedQuoteId, error });
      }
    } catch (error) {
      logger.warn('[UnifiedComposer] Post-save cargo_details sync threw', { savedQuoteId, error });
    }
  }, [scopedDb]);

  // ---------------------------------------------------------------------------
  // Edit mode: load existing quote data
  // ---------------------------------------------------------------------------

  const loadExistingQuote = useCallback(async () => {
    if (!quoteId) return;
    
    // Validate UUID format to prevent Postgres errors
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quoteId);
    if (!isUuid) {
        logger.warn('[UnifiedComposer] Invalid quoteId format (expected UUID)', { quoteId });
        return;
    }

    setEditLoading(true);
    setLoadErrors([]);

    // Audit reload attempt
    // logAudit('reload_attempt', { quoteId });

    try {
      const tenantId = context?.tenantId || null;
      
      /*
      // Helper for retry logic
      const fetchQuoteWithRetry = async (retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          const { data, error } = await scopedDb
            .from('quotes')
            .select('*, origin_location:origin_port_id(location_name, location_code), destination_location:destination_port_id(location_name, location_code)')
            .eq('id', quoteId)
            .maybeSingle();
            
          if (!error && data) return data;
          if (error) logger.warn(`[UnifiedComposer] Quote load attempt ${i + 1} failed:`, error);
          if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
        return null;
      };

      const quoteRow = await fetchQuoteWithRetry();
      */
      
      const { data: quoteRow, error: quoteError } = await scopedDb
        .from('quotes')
        .select('*, origin_port_data:origin_port_id(location_name, location_code), destination_port_data:destination_port_id(location_name, location_code)')
        .eq('id', quoteId)
        .maybeSingle();
     
      /*
      const { data: quoteRow, error: quoteError } = await scopedDb
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .maybeSingle();
      */

      if (quoteError) {
         logger.error('[UnifiedComposer] Failed to load quote:', quoteError);
      }

      if (!quoteRow) {
        logger.error('[UnifiedComposer] Failed to load quote after retries', { quoteId });
        logAudit('reload_failure', { error: 'Failed to load quote after retries', quoteId }, 'failure');
        toast({ title: 'Error', description: 'Failed to load quote data. Please try again.', variant: 'destructive' });
        setEditLoading(false);
        return;
      }
      
      logger.info('[UnifiedComposer] Quote loaded successfully:', { 
        id: quoteRow.id, 
        quoteTenant: (quoteRow as any).tenant_id,
        currentVersion: (quoteRow as any).current_version_id,
        origin: (quoteRow as any).origin_port_data?.location_name,
        destination: (quoteRow as any).destination_port_data?.location_name
      });
      
      const raw = quoteRow as any;
      setQuoteTenantId(raw.tenant_id);

      const cargoDetails = parseJsonObject(raw.cargo_details);

      // Parallel fetch for detailed configurations (Cargo, Items, Documents, Versions)
      // We use allSettled to allow partial failures
      const [cargoConfigResult, quoteItemsResult, docsResult, versionsResult] = await Promise.allSettled([
        scopedDb.from('quote_cargo_configurations').select('*').eq('quote_id', quoteId),
        scopedDb.from('quote_items').select('*').eq('quote_id', quoteId),
        scopedDb.from('quote_documents').select('*').eq('quote_id', quoteId),
        scopedDb.from('quotation_versions').select('*').eq('quote_id', quoteId).order('version_number', { ascending: false })
      ]);
      
      // Handle Cargo Configs
      let containerCombos: any[] = [];
      if (cargoConfigResult.status === 'fulfilled' && !cargoConfigResult.value.error) {
        containerCombos = (cargoConfigResult.value.data || []).map((c: any) => ({
          type: c.container_type_id || c.container_type || '',
          size: c.container_size_id || c.container_size || '',
          qty: c.quantity || 1
        }));
      } else {
        logger.warn('[UnifiedComposer] Failed to load cargo configs', cargoConfigResult);
        // Don't block, just log
      }
      if (containerCombos.length === 0) {
        const snapshotCombos = Array.isArray(cargoDetails?.container_combos) ? cargoDetails.container_combos : [];
        if (snapshotCombos.length > 0) {
          containerCombos = snapshotCombos.map((c: any) => ({
            type: c.type || c.typeId || c.container_type_id || c.container_type || '',
            size: c.size || c.sizeId || c.container_size_id || c.container_size || '',
            qty: Number(c.qty ?? c.quantity ?? 1) || 1,
          }));
          logger.info('[UnifiedComposer] Loaded container combos from cargo_details snapshot fallback', {
            quoteId,
            count: containerCombos.length,
          });
        }
      }

      // Handle Quote Items
      let items: any[] = [];
      if (quoteItemsResult.status === 'fulfilled' && !quoteItemsResult.value.error) {
        items = quoteItemsResult.value.data || [];
      } else {
        // Try fallback to quote_items_core if quote_items fails (e.g. view missing)
        logger.warn('[UnifiedComposer] Failed to load quote items, trying quote_items_core fallback', quoteItemsResult);
        try {
            const { data: coreItems, error: coreError } = await scopedDb
                .from('quote_items_core')
                .select('*')
                .eq('quote_id', quoteId);
                
            if (!coreError && coreItems) {
                items = coreItems;
                logger.info(`[UnifiedComposer] Loaded ${items.length} items from quote_items_core fallback`);
            } else {
                logger.warn('[UnifiedComposer] Failed to load quote items from core fallback', coreError);
            }
        } catch (e) {
            logger.error('[UnifiedComposer] Error loading quote items fallback', e);
        }
        // Do NOT add to loadErrors to avoid alarming the user for non-critical missing data
      }

      // Handle Documents
      let docs: any[] = [];
      if (docsResult.status === 'fulfilled' && !docsResult.value.error) {
        docs = docsResult.value.data || [];
        setAttachments(docs);
        setLoadedAttachments(docs);
      } else {
        logger.warn('[UnifiedComposer] Failed to load documents', docsResult);
        // Non-critical
      }

      // Handle Versions
      if (versionsResult.status === 'fulfilled' && !versionsResult.value.error) {
        setVersionHistory(versionsResult.value.data || []);
      } else {
        logger.warn('[UnifiedComposer] Failed to load version history', versionsResult);
        // Non-critical
      }

      // Initialize store
      dispatch({
        type: 'INITIALIZE',
        payload: {
          quoteId,
          versionId: versionId || raw.current_version_id || null, // Use current_version_id if available
          tenantId: raw.tenant_id || tenantId,
          franchiseId: raw.franchise_id || context?.franchiseId || null,
          quoteData: raw,
        },
      });

      // Pre-populate form values for edit mode
      
      // Calculate totals from quote_items if available AND they have weight/volume data
      // otherwise fallback to quote header/cargo details.
      // Note: quote_items_core fallback does not have weight/volume, so we must check for presence.
      const totalWeight = items.length > 0 && items.some((i: any) => Number(i.weight_kg) > 0)
        ? items.reduce((sum: number, item: any) => sum + (Number(item.weight_kg) || 0), 0)
        : (cargoDetails?.total_weight_kg || raw.total_weight || '');
        
      const totalVolume = items.length > 0 && items.some((i: any) => Number(i.volume_cbm) > 0)
        ? items.reduce((sum: number, item: any) => sum + (Number(item.volume_cbm) || 0), 0)
        : (cargoDetails?.total_volume_cbm || raw.total_volume || '');
        
      const itemCommodity = items.find((i: any) => i?.product_name || i?.description);
      const primaryCommodity = (
        itemCommodity?.product_name ||
        itemCommodity?.description ||
        normalizeCommodityText(cargoDetails?.commodity) ||
        normalizeCommodityText(cargoDetails?.commodity_details) ||
        raw.commodity ||
        ''
      );
      const cargoHazmat = cargoDetails?.hazmat_details && typeof cargoDetails.hazmat_details === 'object'
        ? cargoDetails.hazmat_details
        : ((cargoDetails?.dangerous_goods || raw.dangerous_goods) ? {
            class: cargoDetails?.hazmat_class || '',
            unNumber: cargoDetails?.hazmat_un_number || '',
            packingGroup: 'II',
          } : undefined);
      const cargoItemFromSnapshot = {
        id: 'main',
        type: (cargoDetails?.cargo_type || ((raw.transport_mode === 'ocean' || raw.transport_mode === 'rail') ? 'container' : 'loose')) as any,
        quantity: Number(cargoDetails?.quantity || containerCombos.reduce((sum: number, c: any) => sum + (Number(c.qty) || 0), 0) || 1),
        weight: {
          value: Number(totalWeight) || 0,
          unit: cargoDetails?.weight_unit === 'lb' ? 'lb' : 'kg',
        },
        volume: Number(totalVolume) || 0,
        dimensions: {
          l: Number(cargoDetails?.dimensions?.l) || 0,
          w: Number(cargoDetails?.dimensions?.w) || 0,
          h: Number(cargoDetails?.dimensions?.h) || 0,
          unit: cargoDetails?.dimensions?.unit === 'in' ? 'in' : 'cm',
        },
        stackable: !!cargoDetails?.stackable,
        commodity: (cargoDetails?.commodity_details && typeof cargoDetails.commodity_details === 'object')
          ? cargoDetails.commodity_details
          : (primaryCommodity ? { description: primaryCommodity, hts_code: cargoDetails?.hts_code || '' } : undefined),
        hazmat: cargoHazmat,
        containerCombos: containerCombos.map((c: any) => ({
          typeId: c.type,
          sizeId: c.size,
          quantity: c.qty,
        })),
        containerDetails: containerCombos[0]
          ? { typeId: containerCombos[0].type, sizeId: containerCombos[0].size }
          : undefined,
      };

      setInitialFormValues({
        accountId: raw.account_id || '',
        opportunityId: raw.opportunity_id || '',
        contactId: raw.contact_id || '',
        quoteTitle: raw.title || '',
        mode: (raw.transport_mode || 'ocean') as any,
        origin: raw.origin_port_data?.location_name || raw.origin || '',
        destination: raw.destination_port_data?.location_name || raw.destination || '',
        originId: raw.origin_port_id || '',
        destinationId: raw.destination_port_id || '',
        commodity: primaryCommodity,
        weight: String(totalWeight),
        volume: String(totalVolume),
      });
      
      // Sync to form directly
      if (form) {
        form.reset({
            ...form.getValues(),
            accountId: raw.account_id || '',
            opportunityId: raw.opportunity_id || '',
            contactId: raw.contact_id || '',
            quoteTitle: raw.title || '',
            mode: (raw.transport_mode || 'ocean') as any,
            origin: raw.origin_port_data?.location_name || raw.origin || '',
            destination: raw.destination_port_data?.location_name || raw.destination || '',
            originId: raw.origin_port_id || '',
            destinationId: raw.destination_port_id || '',
            commodity: primaryCommodity,
            weight: String(totalWeight),
            volume: String(totalVolume),
        });
      }

      setInitialExtended({
        incoterms: raw.incoterms || '',
        pickupDate: raw.pickup_date ? new Date(raw.pickup_date).toISOString().split('T')[0] : '',
        deliveryDeadline: raw.delivery_deadline ? new Date(raw.delivery_deadline).toISOString().split('T')[0] : '',
        htsCode: cargoDetails?.hts_code || '',
        dangerousGoods: !!(raw.dangerous_goods || cargoDetails?.dangerous_goods || cargoHazmat),
        vehicleType: raw.vehicle_type || 'van',
        containerCombos: containerCombos,
        attachments: docs,
        cargoItem: cargoItemFromSnapshot as any,
      });

      if (!primaryCommodity) {
        logger.warn('[UnifiedComposer] Commodity missing during reload', { quoteId, source: 'quotes.cargo_details/items' });
      }
      
      // Load existing option if present
      // Determine which version to load: explicit prop OR current_version_id
      let targetVersionId = versionId || raw.current_version_id;
      
      // Fallback: if no target version determined, try to use the latest version from history
      if (!targetVersionId) {
         // We can't rely on versionsResult being ready here since we are in the same scope,
         // but we can query it quickly or check if we already fetched it?
         // Actually we fetched it in parallel above. We can access the result.
         if (versionsResult.status === 'fulfilled' && versionsResult.value.data && versionsResult.value.data.length > 0) {
            // versions are ordered by version_number desc (see query above)
            targetVersionId = versionsResult.value.data[0].id;
            logger.info('[UnifiedComposer] No current_version_id, falling back to latest version', { targetVersionId });
         }
      }

      const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (targetVersionId && isValidUUID(targetVersionId)) {
        logger.info('[UnifiedComposer] Loading version', { targetVersionId });
        // Fetch options with enriched data
        // We fetch carrier_rates and carriers separately to avoid join failures if FK is missing/broken
        const { data: optionRows, error: optError } = await scopedDb
          .from('quotation_version_options')
          .select('*')
          .eq('quotation_version_id', targetVersionId)
          .order('created_at', { ascending: false });

        if (optError) {
          logger.error('[UnifiedComposer] Failed to load options', optError);
          setLoadErrors(prev => [...prev, 'Failed to load options']);
          // We don't throw here to allow the rest of the form to show up
        } else if (optionRows && optionRows.length > 0) {

          logger.info(`[UnifiedComposer] Found ${optionRows.length} options`);
          const optionIds = optionRows.map((o: any) => o.id);

          // Fetch legs for these options (without joins first)
          const { data: legRows, error: legError } = await scopedDb
            .from('quotation_version_option_legs')
            .select(`
                *,
                origin_loc:origin_location_id(location_name),
                dest_loc:destination_location_id(location_name)
            `)
            .in('quotation_version_option_id', optionIds)
            .order('sort_order');

          if (legError) {
            logger.error('[UnifiedComposer] Failed to load legs', legError);
            throw legError;
          }
          logger.info(`[UnifiedComposer] Found ${legRows?.length || 0} legs`);

          // Collect all related IDs for manual hydration
          const carrierRateIds = optionRows
            .map((o: any) => o.carrier_rate_id)
            .filter((id: any) => id && isValidUUID(id));
          
          const carrierIds = new Set<string>();
          optionRows.forEach((o: any) => {
             if (o.carrier_id && isValidUUID(o.carrier_id)) carrierIds.add(o.carrier_id);
          });
          legRows?.forEach((l: any) => {
             if (l.carrier_id && isValidUUID(l.carrier_id)) carrierIds.add(l.carrier_id);
          });

          // Fetch Carrier Rates
          const carrierRatesMap: Record<string, any> = {};
          if (carrierRateIds.length > 0) {
             const { data: rates, error: ratesError } = await scopedDb
               .from('carrier_rates')
               .select(`
                  id,
                  currency,
                  carrier_id
               `)
               .in('id', carrierRateIds);
               
             if (!ratesError && rates) {
                rates.forEach((r: any) => {
                   carrierRatesMap[r.id] = r;
                   if (r.carrier_id && isValidUUID(r.carrier_id)) carrierIds.add(r.carrier_id);
                });
             } else {
                logger.warn('[UnifiedComposer] Failed to load carrier rates details', ratesError);
             }
          }

          // Fetch Carriers
          const carriersMap: Record<string, any> = {};
          if (carrierIds.size > 0) {
             const { data: carriers, error: carriersError } = await scopedDb
                .from('carriers')
                .select('id, carrier_name')
                .in('id', Array.from(carrierIds));
                
             if (!carriersError && carriers) {
                carriers.forEach((c: any) => {
                   carriersMap[c.id] = c;
                });
             } else {
                logger.warn('[UnifiedComposer] Failed to load carriers', carriersError);
             }
          }

          // Fetch charges for these options
          const { data: chargeRows, error: chargeError } = await scopedDb
            .from('quote_charges')
            .select(`
              *,
              category:category_id(name, code),
              basis:basis_id(name, code),
              currency:currency_id(code),
              side:charge_side_id(name, code)
            `)
            .in('quote_option_id', optionIds);
            
          if (chargeError) {
            logger.error('[UnifiedComposer] Failed to load charges', chargeError);
            throw chargeError;
          }
          logger.info(`[UnifiedComposer] Found ${chargeRows?.length || 0} charges`);

          // Helper to group charges into buy/sell pairs
          const groupCharges = (charges: any[]) => {
             const pairs: any[] = [];
             const pendingBuys: any[] = [];
             const pendingSells: any[] = [];
             const pairKey = (row: any) => {
               const category = row?.category_id || '';
               const basis = row?.basis_id || '';
               const leg = row?.leg_id || '';
               const currency = row?.currency_id || '';
               const quantity = Number(row?.quantity ?? 1).toFixed(4);
               const unit = row?.unit || '';
               const note = String(row?.note || '').trim().toLowerCase();
               return `${category}|${basis}|${leg}|${currency}|${quantity}|${unit}|${note}`;
             };
             
             charges.forEach(c => {
                 const sideCode = c.side?.code?.toLowerCase() || 'buy';
                 if (sideCode === 'buy') pendingBuys.push(c);
                 else pendingSells.push(c);
             });
             
             // Match sells to buys
             pendingSells.forEach(sell => {
                 const targetKey = pairKey(sell);
                 const matchIndex = pendingBuys.findIndex((buy) => pairKey(buy) === targetKey);
                 
                 if (matchIndex >= 0) {
                     const buy = pendingBuys[matchIndex];
                     pendingBuys.splice(matchIndex, 1);
                     pairs.push({
                         id: buy.id, 
                         leg_id: buy.leg_id,
                         legId: buy.leg_id,
                         category_id: buy.category_id,
                         basis_id: buy.basis_id,
                         currency_id: buy.currency_id,
                         unit: buy.unit,
                         // Display fields
                         category: buy.category?.name || buy.category?.code || 'Charge',
                         name: buy.category?.name || buy.category?.code || 'Charge',
                         basis: buy.basis?.name || buy.basis?.code || 'Flat',
                         currency: buy.currency?.code || 'USD',
                         // Pair data
                         buy: {
                             quantity: buy.quantity,
                             rate: buy.rate,
                             amount: buy.amount,
                             dbChargeId: buy.id
                         },
                         sell: {
                             quantity: sell.quantity,
                             rate: sell.rate,
                             amount: sell.amount,
                             dbChargeId: sell.id
                         },
                         note: buy.note || sell.note
                     });
                 } else {
                     pairs.push({
                         id: sell.id,
                         leg_id: sell.leg_id,
                         legId: sell.leg_id,
                         category_id: sell.category_id,
                         basis_id: sell.basis_id,
                         currency_id: sell.currency_id,
                         unit: sell.unit,
                         category: sell.category?.name || sell.category?.code || 'Charge',
                         name: sell.category?.name || sell.category?.code || 'Charge',
                         basis: sell.basis?.name || sell.basis?.code || 'Flat',
                         currency: sell.currency?.code || 'USD',
                         sell: {
                             quantity: sell.quantity,
                             rate: sell.rate,
                             amount: sell.amount,
                             dbChargeId: sell.id
                         },
                         note: sell.note
                     });
                 }
             });
             
             pendingBuys.forEach(buy => {
                 pairs.push({
                     id: buy.id,
                     leg_id: buy.leg_id,
                     legId: buy.leg_id,
                     category_id: buy.category_id,
                     basis_id: buy.basis_id,
                     currency_id: buy.currency_id,
                     unit: buy.unit,
                     category: buy.category?.name || buy.category?.code || 'Charge',
                     name: buy.category?.name || buy.category?.code || 'Charge',
                     basis: buy.basis?.name || buy.basis?.code || 'Flat',
                     currency: buy.currency?.code || 'USD',
                     buy: {
                         quantity: buy.quantity,
                         rate: buy.rate,
                         amount: buy.amount,
                         dbChargeId: buy.id
                     },
                     note: buy.note
                 });
             });

             // Deduplicate paired rows (guards against malformed/duplicated quote_charges records)
             const seen = new Set<string>();
             return pairs.filter((p) => {
               const leg = p.legId || p.leg_id || 'combined';
               const category = p.category_id || '';
               const basis = p.basis_id || '';
               const currency = p.currency_id || '';
               const buyQty = Number(p.buy?.quantity ?? 0).toFixed(4);
               const buyRate = Number(p.buy?.rate ?? 0).toFixed(4);
               const sellQty = Number(p.sell?.quantity ?? 0).toFixed(4);
               const sellRate = Number(p.sell?.rate ?? 0).toFixed(4);
               const sig = `${leg}|${category}|${basis}|${currency}|${buyQty}|${buyRate}|${sellQty}|${sellRate}`;
               if (seen.has(sig)) return false;
               seen.add(sig);
               return true;
             });
          };

          // Reconstruct RateOption objects
          const reconstructedOptions: RateOption[] = optionRows.map((opt: any) => {
            // Filter legs for this option
            const myLegs = (legRows || [])
              .filter((l: any) => l.quotation_version_option_id === opt.id)
              .map((l: any) => {
                // Get charges for this leg
                const legChargesRaw = (chargeRows || []).filter((c: any) => c.leg_id === l.id);
                const legCharges = groupCharges(legChargesRaw);
                
                // Resolve carrier name
                const carrierName = carriersMap[l.carrier_id]?.carrier_name || l.carrier_name || 'Unknown Carrier';

                return {
                    id: l.id,
                    mode: l.transport_mode || 'ocean',
                    leg_type: 'transport',
                    carrier: carrierName,
                    carrier_id: l.carrier_id,
                    origin: l.origin_loc?.location_name || l.origin_location || '',
                    destination: l.dest_loc?.location_name || l.destination_location || '',
                    transit_time: l.transit_time_hours ? `${Math.ceil(l.transit_time_hours / 24)} days` : 'TBD',
                    departure_date: l.departure_date,
                    arrival_date: l.arrival_date,
                    sequence: l.sort_order,
                    origin_location_id: l.origin_location_id,
                    destination_location_id: l.destination_location_id,
                    charges: legCharges
                };
              });

            // Filter global charges (no leg_id)
            const globalChargesRaw = (chargeRows || []).filter((c: any) => c.quote_option_id === opt.id && !c.leg_id);
            const globalCharges = groupCharges(globalChargesRaw);
            
            // Calculate total price from all charges (legs + global)
            const legChargesTotal = myLegs.reduce((sum: number, leg: any) => {
                return sum + (leg.charges || []).reduce((s: number, c: any) => s + (Number(c.sell?.amount) || 0), 0);
            }, 0);
            
            const globalChargesTotal = globalCharges.reduce((sum: number, c: any) => {
                return sum + (Number(c.sell?.amount) || 0);
            }, 0);
            
            const totalPrice = legChargesTotal + globalChargesTotal;
            
            // Resolve carrier rate from map
            const carrierRate = opt.carrier_rate_id ? carrierRatesMap[opt.carrier_rate_id] : null;

            // Resolve carrier name from option or related carrier rate
            let resolvedCarrierName = carriersMap[opt.carrier_id]?.carrier_name;
            
            if (!resolvedCarrierName && carrierRate?.carrier_id) {
               resolvedCarrierName = carriersMap[carrierRate.carrier_id]?.carrier_name;
            }
            
            if (!resolvedCarrierName) {
               resolvedCarrierName = opt.option_name || 'Saved Option';
            }
            
            // Resolve currency
            const resolvedCurrency = opt.currency || carrierRate?.currency || 'USD';
            // Resolve transit time
            const resolvedTransitTime = opt.transit_time || 
                (opt.transit_time_days ? `${opt.transit_time_days} days` : 'TBD');

            return {
               id: opt.id,
               carrier: resolvedCarrierName,
               name: resolvedCarrierName,
               price: totalPrice || opt.total_amount || 0,
               currency: resolvedCurrency,
               transitTime: resolvedTransitTime,
               tier: 'custom',
               is_manual: true, // Treat loaded options as manual so they are editable
               source_attribution: 'Saved Quote',
               legs: myLegs,
               charges: globalCharges,
               // Other fields
               is_selected: opt.is_selected,
               total_amount: totalPrice || opt.total_amount || 0,
               marginPercent: opt.margin_percentage,
               rank_score: opt.rank_score, // Preserve rank score
               rank_details: opt.rank_details // Preserve rank details
             } as RateOption;
           });
 
           setManualOptions(reconstructedOptions);
           
           // Find selected option
           // Priority: 1. optionId from URL, 2. is_selected flag, 3. first available
           const paramOptionId = searchParams.get('optionId');
           const selected = reconstructedOptions.find(o => o.id === paramOptionId) 
             || reconstructedOptions.find(o => (o as any).is_selected) 
             || reconstructedOptions[0];

           if (selected) {
             setSelectedOption(selected);
             dispatch({ type: 'INITIALIZE', payload: { optionId: selected.id } });
           }

           // Seed drafts for every loaded option so each option has independent, complete charge state.
           setOptionDrafts((prev) => {
             const next = { ...prev };
             reconstructedOptions.forEach((opt) => {
               next[opt.id] = {
                 ...(next[opt.id] || {}),
                 legs: Array.isArray(opt.legs) ? opt.legs : [],
                 charges: flattenOptionCharges(opt),
                 marginPercent: (opt as any).marginPercent || form.getValues('marginPercent') || 15,
               };
             });
             return next;
           });
           
           // Log success
           logAudit('reload_success', { quoteId, versionId: targetVersionId || 'current' });
        }
      }
    } catch (err: any) {
      logger.error('[UnifiedComposer] Failed to load quote:', err);
      logAudit('reload_failure', { error: err?.message || 'Unknown error', quoteId }, 'failure');
      toast({ title: 'Error', description: 'Failed to load existing quote data', variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  }, [quoteId, versionId, normalizeCommodityText, flattenOptionCharges]);

  useEffect(() => {
    if (!quoteId) return;
    loadExistingQuote();
  }, [loadExistingQuote, quoteId]);



  // ---------------------------------------------------------------------------
  // Handle pre-population from navigation state (QuickQuoteHistory)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!initialData) return;
    setInitialFormValues({
      accountId: initialData.accountId || '',
      contactId: initialData.contactId || '',
      opportunityId: initialData.opportunityId || '',
      quoteTitle: initialData.quoteTitle || '',
      mode: (initialData.mode || 'ocean') as any,
      origin: initialData.origin || '',
      destination: initialData.destination || '',
      commodity: initialData.commodity || initialData.commodity_description || '',
      weight: initialData.weight ? String(initialData.weight) : undefined,
      volume: initialData.volume ? String(initialData.volume) : undefined,
      preferredCarriers: initialData.preferredCarriers,
    });
    // Sync to form directly
    if (form) {
      form.reset({
          ...form.getValues(),
          accountId: initialData.accountId || '',
          contactId: initialData.contactId || '',
          opportunityId: initialData.opportunityId || '',
          quoteTitle: initialData.quoteTitle || '',
          mode: (initialData.mode || 'ocean') as any,
          origin: initialData.origin || '',
          originId: initialData.originId || '',
          destination: initialData.destination || '',
          destinationId: initialData.destinationId || '',
          commodity: initialData.commodity || initialData.commodity_description || '',
          weight: initialData.weight ? String(initialData.weight) : undefined,
          volume: initialData.volume ? String(initialData.volume) : undefined,
          preferredCarriers: initialData.preferredCarriers,
          containerType: initialData.containerType || '',
          containerSize: initialData.containerSize || '',
          containerQty: initialData.containerQty ? String(initialData.containerQty) : '1',
      });
    }

    if (initialData.containerType || initialData.incoterms || initialData.htsCode) {
      setInitialExtended({
        containerType: initialData.containerType || '',
        containerSize: initialData.containerSize || '',
        containerQty: initialData.containerQty || '1',
        incoterms: initialData.incoterms || '',
        htsCode: initialData.htsCode || '',
        dangerousGoods: !!initialData.dangerousGoods,
        vehicleType: initialData.vehicleType || 'van',
        originDetails: initialData.originDetails || null,
        destinationDetails: initialData.destinationDetails || null,
      });
    }
  }, [initialData, form]);

  // ---------------------------------------------------------------------------
  // Compliance check
  // ---------------------------------------------------------------------------

  const runComplianceCheck = useCallback(async (params: FormZoneValues & ExtendedFormData) => {
    try {
      const { data, error } = await invokeAiAdvisor({
        action: 'validate_compliance',
        payload: {
          origin: params.origin,
          destination: params.destination,
          commodity: params.commodity,
          mode: params.mode,
          dangerous_goods: params.dangerousGoods,
        },
      });
      if (!error && data) {
        setComplianceCheck(data);
        if (data.compliant === false) {
          toast({ title: 'Compliance Warning', description: 'Please review compliance issues.', variant: 'destructive' });
        }
      }
    } catch {
      // Non-blocking
    }
  }, [invokeAiAdvisor, toast]);

  // ---------------------------------------------------------------------------
  // Handle Composer Mode (Manual Only)
  // ---------------------------------------------------------------------------

  const handleComposerMode = useCallback(() => {
    const newOption: RateOption = {
        id: `manual-${Date.now()}`,
        carrier: '',
        name: '',
        price: 0,
        currency: 'USD',
        transitTime: 'TBD',
        tier: 'custom',
        is_manual: true,
        source_attribution: 'Manual Quote',
        legs: [],
        charges: [],
    };
    
    setManualOptions([newOption]);
    setVisibleRateIds([newOption.id]);
    setSelectedOption(newOption);
    setIsSmartMode(false);
    setDeletedOptionIds([]);
    
    // Initialize draft
    setOptionDrafts({
        [newOption.id]: {
            legs: [],
            charges: [],
            marginPercent: 15
        }
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Handle "Get Rates"
  // ---------------------------------------------------------------------------

  const handleGetRates = useCallback(async (formValues: FormZoneValues, extendedData: ExtendedFormData, smart: boolean) => {
    setComplianceCheck(null);
    setLastFormData({ values: formValues, extended: extendedData });
    setIsSmartMode(smart);

    // Note: smart param is passed from FormZone but we might ignore it or use it if needed.
    // In rollback, we trust the FormZone to decide or we default to a standard behavior.
    // For now, we will pass it through to fetchRates.

    setSelectedOption(null);

    // Fire compliance in parallel (non-blocking)
    runComplianceCheck({ ...formValues, ...extendedData } as any);

    // Determine behavior based on Smart Mode and tenant configuration
    const smartEnabled = config?.smart_mode_enabled ?? true;

    if (smart) {
      // Smart Mode requested
      if (smartEnabled) {
        await rateFetching.fetchRates(
          {
            ...formValues,
            ...extendedData,
            mode: (formValues.mode || 'ocean') as any,
            smartMode: true,
            account_id: storeState.quoteData?.account_id,
          } as any,
          containerResolver
        );
      } else {
        // Tenant has Smart Mode disabled: fallback to Manual Composer
        handleComposerMode();
      }
    } else {
      // Standard Mode: fetch market rates and show highest-ranked by default
      await rateFetching.fetchRates(
        {
          ...formValues,
          ...extendedData,
          mode: (formValues.mode || 'ocean') as any,
          smartMode: false,
          account_id: storeState.quoteData?.account_id,
        } as any,
        containerResolver
      );
    }
  }, [
    runComplianceCheck, 
    config, 
    rateFetching, 
    storeState.quoteData, 
    containerResolver, 
    handleComposerMode
  ]);

  // ---------------------------------------------------------------------------
  // Handle option selection
  // ---------------------------------------------------------------------------

  const handleSelectOption = useCallback((option: RateOption) => {
    setSelectedOption(option);
  }, []);

  const handleRenameOption = useCallback((optionId: string, newName: string) => {
    setManualOptions(prev => prev.map(opt => {
        if (opt.id === optionId) {
            return { ...opt, carrier: newName, name: newName };
        }
        return opt;
    }));
    
    setSelectedOption(prev => {
        if (prev?.id === optionId) {
            return { ...prev, carrier: newName, name: newName };
        }
        return prev;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Handle Attachment Sync
  // ---------------------------------------------------------------------------
  
  const handleSaveAttachments = useCallback(async (quoteId: string, currentAttachments: any[]) => {
    try {
        // 1. Identify deleted attachments
        // IDs in loadedAttachments that are NOT in currentAttachments
        const currentIds = new Set(currentAttachments.filter(a => a.id).map(a => a.id));
        const toDelete = loadedAttachments.filter(a => !currentIds.has(a.id));
        
        if (toDelete.length > 0) {
            const deleteIds = toDelete.map(a => a.id);
            const { error: delError } = await scopedDb.from('quote_documents').delete().in('id', deleteIds);
            if (delError) {
                logger.error('Failed to delete attachments', delError);
                toast({ title: 'Warning', description: 'Failed to delete some removed attachments.', variant: 'destructive' });
            } else {
                // Also try to delete from storage if path exists
                // This is optional but good for cleanup
                // We'll skip complex storage cleanup for now to avoid accidental data loss
            }
        }

        // 2. Identify new attachments (File objects)
        const newFiles = currentAttachments.filter(a => a instanceof File);
        
        if (newFiles.length > 0) {
            for (const file of newFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${quoteId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                
                // Upload to storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('commodity-docs')
                    .upload(fileName, file);

                if (uploadError) {
                    logger.error('Failed to upload file', { fileName, error: uploadError });
                    toast({ title: 'Upload Failed', description: `Failed to upload ${file.name}`, variant: 'destructive' });
                    continue;
                }

                // Insert into quote_documents
                const { error: insertError } = await scopedDb.from('quote_documents').insert({
                    quote_id: quoteId,
                    file_name: file.name,
                    file_path: uploadData.path,
                    file_type: file.type,
                    file_size: file.size,
                    uploaded_by: user?.id
                });

                if (insertError) {
                     logger.error('Failed to link file to quote', insertError);
                     toast({ title: 'Link Failed', description: `Failed to link ${file.name} to quote`, variant: 'destructive' });
                }
            }
        }
        
        // 3. Update loadedAttachments for next save
        // We re-fetch to be sure, or just update local state if we trust it
        // Re-fetching is safer
        const { data: refreshedDocs } = await scopedDb.from('quote_documents').select('*').eq('quote_id', quoteId);
        if (refreshedDocs) {
            setLoadedAttachments(refreshedDocs);
            // Also update form if needed, but form state might have File objects replaced by DB records?
            // Actually, we should probably replace File objects in form with the new records so subsequent saves don't re-upload
            // But modifying form state here might be tricky.
            // For now, let's just update loadedAttachments.
            // Ideally we should reload the attachments into the form.
        }

    } catch (error) {
        logger.error('Error syncing attachments', error);
        toast({ title: 'Attachment Error', description: 'Failed to sync attachments.', variant: 'destructive' });
    }
  }, [loadedAttachments, scopedDb, supabase.storage, user?.id, toast]);

  // ---------------------------------------------------------------------------
  // Handle save quote
  // ---------------------------------------------------------------------------

  const isUUID = useCallback((v: any) =>
    typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v), []);

  const handleSaveQuote = useCallback(async (charges: any[], marginPercent: number, notes: string) => {
    setSaving(true);
    logAudit('save_quote_attempt', { quoteId: quoteId || 'new' });

    try {
      const tenantId = storeState.tenantId || context?.tenantId;
      if (!tenantId) {
        toast({ title: 'Error', description: 'Tenant context not found', variant: 'destructive' });
        return;
      }

      // Ensure version exists
      const currentVersionId = storeState.versionId || versionId;
      const currentQuoteId = storeState.quoteId || quoteId;

      // Validate form before saving
      const isValid = await form.trigger();
      
      if (!isValid) {
        setShowValidationSummary(true);
        logger.error('[UnifiedComposer] Validation failed', { 
          errors: sanitizePayload(form.formState.errors),
        });
        const firstIssue = validationIssues[0];
        if (firstIssue) {
          setTimeout(() => scrollToField(firstIssue.path), 0);
        }
        toast({
          title: 'Validation Error',
          description: firstIssue
            ? `${firstIssue.label}: ${firstIssue.message}`
            : 'Please check the highlighted fields.',
          variant: 'destructive'
        });
        setSaving(false);
        return;
      }
      setShowValidationSummary(false);

      // Build RPC payload using current form values
      const currentFormValues = form.getValues();
      const formData = {
          values: currentFormValues,
          extended: {
             containerType: currentFormValues.containerType,
             containerSize: currentFormValues.containerSize,
             containerQty: currentFormValues.containerQty,
             containerCombos: currentFormValues.containerCombos,
             htsCode: currentFormValues.htsCode,
             dangerousGoods: currentFormValues.dangerousGoods,
             pickupDate: currentFormValues.pickupDate,
             deliveryDeadline: currentFormValues.deliveryDeadline,
             incoterms: currentFormValues.incoterms,
             vehicleType: currentFormValues.vehicleType,
             attachments: currentFormValues.attachments,
             cargoItem: (currentFormValues as any).cargoItem || null,
          }
      };

      if (!formData) {
          toast({ title: 'Error', description: 'Form data not ready. Please try again.', variant: 'destructive' });
          setSaving(false);
          return;
      }
      const isStandalone = !!formData?.values.standalone;
      
      // Determine quote number
      let finalQuoteNumber = formData?.values.quoteNumber?.trim();
      if (finalQuoteNumber) {
        // Manual override
        if (!canOverrideQuoteNumber) {
          toast({ title: 'Not allowed', description: 'You do not have permission to override quote numbers.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        // Check uniqueness
        const unique = await QuotationNumberService.isUnique(supabase, tenantId, finalQuoteNumber);
        if (!unique && !currentQuoteId) {
             toast({ title: 'Duplicate Number', description: 'This quote number is already taken.', variant: 'destructive' });
             setSaving(false);
             return;
        }
      } else if (!currentQuoteId) {
        // Auto-generate only for new quotes
        const config = await QuotationNumberService.getConfig(supabase, tenantId);
        finalQuoteNumber = await QuotationNumberService.generateNext(supabase, tenantId, config);
      }

      // Auto-create/link opportunity (CRM-linked mode only)
      let effectiveOpportunityId = formData?.values.opportunityId || null;
      if (!isStandalone && (formData?.values.accountId) && !effectiveOpportunityId) {
        try {
          let { data: createdOpp, error: oppErr } = await scopedDb
            .from('opportunities')
            .insert({
              name: formData?.values.quoteTitle || 'New Quotation',
              account_id: formData?.values.accountId,
              tenant_id: tenantId,
              status: 'open'
            })
            .select('id')
            .single();

          // Some deployments use legacy opportunity schemas (e.g., title/opportunity_name + stage).
          if (oppErr && /column\s+"?name"?\s+does not exist/i.test(String(oppErr.message || ''))) {
            const fallbackTitle = formData?.values.quoteTitle || 'New Quotation';
            const fallbackPayloads = [
              { title: fallbackTitle, account_id: formData?.values.accountId, tenant_id: tenantId, stage: 'prospecting' },
              { opportunity_name: fallbackTitle, account_id: formData?.values.accountId, tenant_id: tenantId, stage: 'prospecting' },
            ];
            for (const payload of fallbackPayloads) {
              const fallbackRes = await (scopedDb as any)
                .from('opportunities')
                .insert(payload)
                .select('id')
                .single();
              if (!fallbackRes.error && fallbackRes.data?.id) {
                createdOpp = fallbackRes.data;
                oppErr = null;
                break;
              }
            }
          }

          if (oppErr) {
            logger.warn('[UnifiedComposer] Auto-opportunity create skipped', { error: oppErr.message });
          }
          if (!oppErr && createdOpp?.id) {
            effectiveOpportunityId = createdOpp.id;
          }
        } catch (error) {
          logger.warn('[UnifiedComposer] Auto-opportunity create threw', { error });
        }
      }

      // Log start of save operation
      // logger.info('[UnifiedComposer] Starting saveQuote...', { tenantId, quoteId: currentQuoteId });

      // Build guest billing details in standalone mode
      const billingForStandalone = isStandalone ? {
        company: formData?.values.guestCompany || null,
        name: formData?.values.guestName || null,
        email: formData?.values.guestEmail || null,
        phone: formData?.values.guestPhone || null,
        job_title: formData?.values.guestJobTitle || null,
        department: formData?.values.guestDepartment || null,
        billing_address: formData?.values.billingAddress || null,
        shipping_address: formData?.values.shippingAddress || null,
        tax_id: formData?.values.taxId || null,
        customer_po: formData?.values.customerPo || null,
        vendor_ref: formData?.values.vendorRef || null,
        project_code: formData?.values.projectCode || null,
      } : null;

      // Duplicate detection
      if (isStandalone && formData?.values.guestCompany) {
        try {
          const { data: dups } = await scopedDb
            .from('quotes')
            .select('id, quote_number, billing_address')
            .eq('tenant_id', tenantId)
            .neq('id', currentQuoteId || '00000000-0000-0000-0000-000000000000')
            .ilike('billing_address->>company', `%${formData.values.guestCompany}%`)
            .limit(1);

          if (dups && dups.length > 0) {
             const companyName = (dups[0] as any).billing_address?.company || 'Unknown';
             if (!window.confirm(`Potential duplicate found: Quote ${dups[0].quote_number} for company "${companyName}". Continue saving?`)) {
               setSaving(false);
               return;
             }
          }
        } catch (err) {
          logger.warn('Duplicate check failed', err);
        }
      }

      // Resolve additional required IDs
      const selectedCurrencyCode = selectedOption?.currency || 'USD';
      const currencyId = repoData.currencies?.find((c: any) => c.code === selectedCurrencyCode)?.id 
        || repoData.currencies?.find((c: any) => c.code === 'USD')?.id;

      // Determine Service (based on mode)
      const currentMode = formData?.values.mode || 'ocean';
      let serviceName = 'Ocean Freight';
      if (currentMode === 'air') serviceName = 'Air Freight';
      else if (currentMode === 'road') serviceName = 'Road Freight';
      else if (currentMode === 'rail') serviceName = 'Rail Freight';
      
      const serviceId = repoData.services?.find((s: any) => s.name === serviceName || s.code === currentMode.toUpperCase())?.id;
      
      // Determine Service Type (default to Export)
      const serviceTypeId = repoData.serviceTypes?.find((s: any) => s.name === 'Export' || s.code === 'EXP')?.id;

      const cargoSnapshot = buildCargoSnapshot(formData?.values, formData?.extended);
      const quotePayload: any = {
        id: isUUID(currentQuoteId) ? currentQuoteId : undefined,
        quote_number: finalQuoteNumber,
        title: (formData?.values.quoteTitle || storeState.quoteData?.title) || `Quote - ${formData?.values.origin || ''} to ${formData?.values.destination || ''}`,
        transport_mode: formData?.values.mode || 'ocean',
        origin: formData?.values.origin || '',
        destination: formData?.values.destination || '',
        origin_port_id: isUUID(formData?.values.originId) ? formData?.values.originId : null,
        destination_port_id: isUUID(formData?.values.destinationId) ? formData?.values.destinationId : null,
        status: 'draft',
        tenant_id: tenantId,
          currency_id: currencyId || null,
          service_id: serviceId || null,
          service_type_id: serviceTypeId || null,
          franchise_id: storeState.franchiseId ?? context?.franchiseId ?? null,
          notes: [notes, formData?.values.internalNotes, formData?.values.specialInstructions, formData?.values.notesText].filter(Boolean).join('\n\n') || null,
        terms_conditions: formData?.values.termsConditions || null,
        billing_address: billingForStandalone,
        pickup_date: formData?.extended.pickupDate || null,
        delivery_deadline: formData?.extended.deliveryDeadline || null,
        incoterms: formData?.extended.incoterms || null,
        vehicle_type: formData?.extended.vehicleType || null,
        account_id: isStandalone ? null : (formData?.values.accountId || storeState.quoteData?.account_id || null),
        contact_id: isStandalone ? null : (formData?.values.contactId || storeState.quoteData?.contact_id || null),
        opportunity_id: isStandalone ? null : (effectiveOpportunityId || null),
        owner_id: user?.id || null,
        created_by: user?.id || null,
        cargo_details: cargoSnapshot
      };

      const options: any[] = [];

      if (!selectedOption) {
        toast({ title: 'Select an option', description: 'Pick a quote option before saving.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      // Map container combos
      const combos = extractContainerCombos(formData?.values, formData?.extended);
      const cargoConfigs = combos.map((c: any) => {
          const typeObj = containerTypes.find(t => t.id === c.type);
          const sizeObj = containerSizes.find(s => s.id === c.size);
          
          return {
              container_type: typeObj?.name || c.type,
              container_size: sizeObj?.name || c.size,
              container_type_id: isUUID(c.type) ? c.type : null,
              container_size_id: isUUID(c.size) ? c.size : null,
              quantity: c.qty,
              temperature_control: null
          };
      });

      // console.log('[UnifiedComposer] quotePayload cargo_details:', JSON.stringify(quotePayload.cargo_details, null, 2));

      const findBasisCodeById = (id: string) =>
        repoData?.chargeBases?.find((b: any) => b.id === id)?.code || '';
      const findCurrencyCodeById = (id: string) =>
        repoData?.currencies?.find((c: any) => c.id === id)?.code || 'USD';

      const buildChargePayload = (c: any, side: 'buy' | 'sell') => {
        if (!c) return {
          charge_code: null,
          basis_id: null,
          currency_id: null,
          basis: '',
          currency: 'USD',
          unit: '',
          quantity: 1,
          unit_price: 0,
          amount: 0,
          side,
          note: null
        };

        const quantity = side === 'buy' ? c.buy?.quantity : c.sell?.quantity;
        const unitPrice = side === 'buy' ? c.buy?.rate : c.sell?.rate;
        const amount = side === 'buy' ? c.buy?.amount : c.sell?.amount;
        return {
          charge_code: c.category_id || null,
          basis_id: c.basis_id || null,
          currency_id: c.currency_id || null,
          basis: findBasisCodeById(c.basis_id) || '',
          currency: findCurrencyCodeById(c.currency_id) || 'USD',
          unit: c.unit || '',
          quantity: quantity ?? 1,
          unit_price: unitPrice ?? 0,
          amount: amount ?? 0,
          side,
          note: c.note || null,
        };
      };

      const selectedId = selectedOption.id;
      
      const optionsSource = displayResults.some((o) => o.id === selectedOption.id)
        ? displayResults
        : [...displayResults, selectedOption];

      for (const opt of optionsSource) {
        const isSelected = opt.id === selectedId;
        const draft = optionDrafts[opt.id];
        const draftLegsSource = draft?.legs || opt.legs;
        const draftLegs = (Array.isArray(draftLegsSource) ? draftLegsSource : []) as any[];
        
        // Keep charges scoped per option and include leg-level charges for unselected options.
        const optionChargesSource = flattenOptionCharges(opt);
        const draftChargesSource = isSelected
          ? charges
          : (Array.isArray(draft?.charges) ? draft.charges : optionChargesSource);
        const draftCharges = (Array.isArray(draftChargesSource) ? draftChargesSource : []) as any[];
        const mp = draft?.marginPercent ?? marginPercent;

        const chargesByLegId: Record<string, any[]> = {};
        const combinedCharges: any[] = [];
        
        if (Array.isArray(draftCharges)) {
          for (const c of draftCharges) {
            const legKey = c.legId || c.leg_id || 'combined';
            if (legKey === 'combined' || (!c.legId && !c.leg_id)) {
              combinedCharges.push(c);
            } else {
              if (!chargesByLegId[legKey]) chargesByLegId[legKey] = [];
              chargesByLegId[legKey].push(c);
            }
          }
        } else {
             console.warn('[UnifiedComposer] draftCharges is not iterable for option', opt.id);
        }

        const legsPayload = draftLegs.map((leg: any) => ({
          id: isUUID(leg.id) ? leg.id : undefined,
          transport_mode: leg.mode || formData?.values.mode || 'ocean',
          leg_type: leg.leg_type || 'transport',
          origin_location_name: leg.origin || '',
          destination_location_name: leg.destination || '',
          origin_location_id: isUUID(leg.origin_location_id) ? leg.origin_location_id : (isUUID(leg.originId) ? leg.originId : null),
          destination_location_id: isUUID(leg.destination_location_id) ? leg.destination_location_id : (isUUID(leg.destinationId) ? leg.destinationId : null),
          carrier_id: leg.carrier_id || null,
          carrier_name: leg.carrier || leg.carrier_name || null,
          charges: (chargesByLegId[leg.id] || []).flatMap((c: any) => [
            buildChargePayload(c, 'buy'),
            buildChargePayload(c, 'sell'),
          ]),
        }));

        const combinedPayload = combinedCharges.flatMap((c: any) => [
          buildChargePayload(c, 'buy'),
          buildChargePayload(c, 'sell'),
        ]);

        options.push({
          id: isUUID(opt.id) ? opt.id : undefined,
          option_name: opt.carrier || opt.name || 'Option',
          is_selected: isSelected,
          source: 'unified_composer',
          source_attribution: opt.source_attribution || 'manual',
          ai_generated: opt.ai_generated || false,
          margin_percent: mp,
          currency: opt.currency || 'USD',
          transit_time_days: getTransitDays(opt.transitTime),
          legs: legsPayload,
          combined_charges: combinedPayload,
          rank_score: opt.rank_score,
          rank_details: opt.rank_details,
          is_recommended: opt.is_recommended,
          recommendation_reason: opt.recommendation_reason,
        });
      }

      const rpcPayload = {
        quote: quotePayload,
        items: [], // Use cargo_details for now, items can be added later if granular items are needed
        cargo_configurations: cargoConfigs,
        options: options
      };

      // logger.info('[UnifiedComposer] Sending save_quote_atomic payload', { payload: rpcPayload });

      // Sanitize payload to remove circular references and DOM nodes
      const safePayload = sanitizePayload(rpcPayload);

      let { data: savedId, error: rpcError } = await saveWithRetry(async () => {
        return scopedDb.rpc('save_quote_atomic', {
          p_payload: safePayload
        });
      });

      if (rpcError && isLegacyCargoSchemaError(rpcError)) {
        logger.warn('[UnifiedComposer] save fallback: retrying without cargo_configurations due to legacy DB schema', {
          error: rpcError.message,
        });
        const fallbackPayload = sanitizePayload({
          ...rpcPayload,
          cargo_configurations: [],
        });
        const fallback = await saveWithRetry(async () => {
          return scopedDb.rpc('save_quote_atomic', {
            p_payload: fallbackPayload
          });
        });
        savedId = fallback.data;
        rpcError = fallback.error;
      }

      if (rpcError) {
        logger.error('[UnifiedComposer] save_quote_atomic RPC Error', { error: rpcError });
        throw new Error(rpcError.message || 'Failed to save quotation');
      }

      // logger.info('[UnifiedComposer] save_quote_atomic success', { savedId });

      // Update store
      if (savedId) {
        dispatch({ type: 'INITIALIZE', payload: { quoteId: savedId } });
        await syncQuoteCargoDetails(savedId, cargoSnapshot);

        // Apply manual quote number override with audit if provided
        const manualNo = formData?.values.quoteNumber?.trim();
        if (manualNo) {
          if (!canOverrideQuoteNumber) {
            toast({ title: 'Not allowed', description: 'You do not have permission to override quote numbers.', variant: 'destructive' });
            return;
          }
          try {
            // Fetch existing to compare
            const { data: existing } = await scopedDb.from('quotes').select('quote_number, notes').eq('id', savedId).single();
            const prevNo = existing?.quote_number || null;
            // Uniqueness enforcement (best-effort)
            const tenantIdStr = storeState.tenantId || context?.tenantId;
            if (tenantIdStr) {
              const unique = await QuotationNumberService.isUnique(supabase, tenantIdStr, manualNo);
              if (!unique) {
                toast({ title: 'Duplicate number', description: 'This quote number already exists. Please choose another.', variant: 'destructive' });
                return;
              }
            }
            if (prevNo !== manualNo) {
              const auditLine = `[${new Date().toISOString()}] Quote number changed ${prevNo ? `from ${prevNo} ` : ''}to ${manualNo}`;
              const newNotes = existing?.notes ? `${existing.notes}\n${auditLine}` : auditLine;
              await scopedDb.from('quotes').update({ quote_number: manualNo, notes: newNotes }).eq('id', savedId);
            }
          } catch (e) {
            console.error('Quote number override failed', e);
          }
        }
      }

      // Sync attachments
      if (savedId && formData?.extended?.attachments) {
        await handleSaveAttachments(savedId, formData.extended.attachments);
      }

      // Fetch the final quote number for the toast
      let displayQuoteNumber = finalQuoteNumber;
      if (savedId) {
        try {
          // If we didn't have a manual number or just want to be sure
          const { data: q } = await scopedDb.from('quotes').select('quote_number').eq('id', savedId).single();
          if (q?.quote_number) {
            displayQuoteNumber = q.quote_number;
          }
        } catch (e) {
          console.warn('Failed to fetch quote number for toast', e);
        }
      }

      // Log success
      logAudit('save_quote_success', {
        quoteId: savedId,
        quoteNumber: displayQuoteNumber,
        timestamp: new Date().toISOString()
      }, 'success');

      if (displayQuoteNumber) {
        showQuotationSuccessToast(displayQuoteNumber);
      } else {
        toast({ title: 'Success', description: 'Quote saved successfully' });
      }
    } catch (err: any) {
      logger.error('[UnifiedComposer] Save failed:', err);
      
      let errorMessage = err.message || 'An error occurred while saving the quotation.';
      
      // More specific network error detection
      const isNetworkError = (
        err?.name === 'AbortError' ||
        err?.message?.includes('signal is aborted') ||
        err?.message?.includes('aborted') ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError') ||
        err.message?.includes('fetch') ||
        err.code === 'NETWORK_ERROR' ||
        err.status === 0 ||
        (err instanceof TypeError && err.message?.includes('fetch'))
      );
      
      // Check for Supabase specific errors
      const isSupabaseError = (
        err.code?.startsWith('PGRST') ||
        err.message?.includes('supabase') ||
        err.message?.includes('JWT') ||
        err.message?.includes('permission')
      );
      
      if (isNetworkError) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
        logger.warn('[UnifiedComposer] Network error detected', { error: err, message: err.message });
        setShowNetworkWarning(true); // Show network warning only on actual network errors
      } else if (
        err.message?.includes('relation "quotation_legs" does not exist') ||
        err.message?.includes('relation "quotation_charges" does not exist')
      ) {
        errorMessage = 'Database migration missing. Please apply latest Supabase migrations for save_quote_atomic and try again.';
        logger.error('[UnifiedComposer] Outdated save_quote_atomic function detected', { error: err.message });
      } else if (isSupabaseError) {
        errorMessage = 'Database connection error. Please try again or contact support if the issue persists.';
        logger.warn('[UnifiedComposer] Supabase error detected', { error: err, code: err.code });
      } else if (err.code === 'PGRST116') {
        errorMessage = 'Database error: The quotation could not be verified after saving.';
      } else if (err.message?.includes('permission') || err.message?.includes('unauthorized')) {
        errorMessage = 'Permission denied. You may not have the required permissions to save quotes.';
      } else if (err.message?.includes('timeout')) {
        errorMessage = 'Request timeout. The save operation took too long. Please try again.';
      }

      logAudit('save_quote_failure', {
        quoteId: quoteId || 'new',
        error: errorMessage,
        originalError: err.message,
        errorType: isNetworkError ? 'network' : isSupabaseError ? 'database' : 'application',
        stack: err.stack
      }, 'failure');

      toast({ 
        title: 'Save Failed', 
        description: errorMessage, 
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  }, [
    quoteId,
    storeState,
    context,
    versionId,
    form,
    canOverrideQuoteNumber,
    supabase,
    scopedDb,
    user,
    selectedOption,
    repoData,
    isUUID,
    displayResults,
    optionDrafts,
    containerTypes,
    containerSizes,
    validationIssues,
    scrollToField,
    saveWithRetry,
    dispatch,
    handleSaveAttachments,
    showQuotationSuccessToast,
    toast,
    setShowNetworkWarning,
    logAudit,
    buildCargoSnapshot,
    syncQuoteCargoDetails,
    flattenOptionCharges,
    isLegacyCargoSchemaError
  ]);

  // ---------------------------------------------------------------------------
  // Rerun rates
  // ---------------------------------------------------------------------------

  const handleRerunRates = useCallback(() => {
    if (lastFormData) {
      // Pass false for smart mode as rollback default
      handleGetRates(lastFormData.values, lastFormData.extended, false);
    }
  }, [lastFormData, handleGetRates]);

  // ---------------------------------------------------------------------------
  // Draft save (manual)
  // ---------------------------------------------------------------------------

  const handleSaveDraft = useCallback(async () => {
    if (!lastFormData) {
      toast({ title: 'Nothing to save', description: 'Please fill out the form first.' });
      return;
    }

    const tenantId = storeState.tenantId || context?.tenantId;
    if (!tenantId) {
      toast({ title: 'Error', description: 'Tenant context not found', variant: 'destructive' });
      return;
    }

    logAudit('save_draft_attempt', { quoteId: quoteId || 'new' });

    try {
      setSaving(true);
      const formData = lastFormData;
      const cargoSnapshot = buildCargoSnapshot(formData.values, formData.extended);
      const quotePayload: any = {
        id: isUUID(storeState.quoteId) ? storeState.quoteId : (isUUID(quoteId) ? quoteId : undefined),
        title: (formData.values.quoteTitle || storeState.quoteData?.title) || `Draft - ${formData.values.origin || ''} to ${formData.values.destination || ''}`,
        transport_mode: formData.values.mode || 'ocean',
        origin: formData.values.origin || '',
        destination: formData.values.destination || '',
        status: 'draft',
        tenant_id: tenantId,
        franchise_id: storeState.franchiseId || context?.franchiseId || null,
        pickup_date: formData.extended.pickupDate || null,
        delivery_deadline: formData.extended.deliveryDeadline || null,
        incoterms: formData.extended.incoterms || null,
        account_id: formData.values.accountId || storeState.quoteData?.account_id || null,
        contact_id: formData.values.contactId || storeState.quoteData?.contact_id || null,
        opportunity_id: formData.values.opportunityId || null,
        owner_id: user?.id || null,
        created_by: user?.id || null,
        cargo_details: cargoSnapshot
      };

      // Map container combos for draft
      const combos = extractContainerCombos(formData.values, formData.extended);
      const cargoConfigs = combos.map((c: any) => {
          const typeObj = containerTypes.find(t => t.id === c.type);
          const sizeObj = containerSizes.find(s => s.id === c.size);
          
          return {
              container_type: typeObj?.name || c.type,
              container_size: sizeObj?.name || c.size,
              container_type_id: isUUID(c.type) ? c.type : null,
              container_size_id: isUUID(c.size) ? c.size : null,
              quantity: c.qty,
              temperature_control: null
          };
      });

      const rpcPayload = {
        quote: quotePayload,
        items: [],
        cargo_configurations: cargoConfigs,
        options: [],
      };

      const safePayload = sanitizePayload(rpcPayload);

      let { data: savedId, error: rpcError } = await saveWithRetry(async () => {
        return scopedDb.rpc('save_quote_atomic', {
          p_payload: safePayload,
        });
      });

      if (rpcError && isLegacyCargoSchemaError(rpcError)) {
        logger.warn('[UnifiedComposer] draft-save fallback: retrying without cargo_configurations due to legacy DB schema', {
          error: rpcError.message,
        });
        const fallbackPayload = sanitizePayload({
          ...rpcPayload,
          cargo_configurations: [],
        });
        const fallback = await saveWithRetry(async () => {
          return scopedDb.rpc('save_quote_atomic', {
            p_payload: fallbackPayload,
          });
        });
        savedId = fallback.data;
        rpcError = fallback.error;
      }

      if (rpcError) throw new Error(rpcError.message || 'Failed to save draft');

      if (savedId) {
           // Simplified success handling (removed versionId fetching for auto-save)
           dispatch({ type: 'INITIALIZE', payload: { quoteId: savedId } });
           await syncQuoteCargoDetails(savedId, cargoSnapshot);
           
           // Update URL without reloading if it's a new quote
           if (!quoteId) {
             setSearchParams((prev) => {
                const newParams = new URLSearchParams(prev);
                newParams.set('id', savedId);
                return newParams;
             });
           }
      }

      logAudit('save_draft_success', { quoteId: savedId }, 'success');
      toast({ title: 'Draft saved', description: 'Your quote draft has been saved.' });
    } catch (err: any) {
      logger.error('[UnifiedComposer] Draft save failed:', err);
      logAudit('save_draft_failure', { quoteId: quoteId || 'new', error: err.message, stack: err.stack }, 'failure');
      toast({ title: 'Save Failed', description: err.message || 'Could not save draft', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [lastFormData, storeState, context, quoteId, user, scopedDb, toast, dispatch, setSearchParams, logAudit, buildCargoSnapshot, syncQuoteCargoDetails, extractContainerCombos, isLegacyCargoSchemaError]);

  // ---------------------------------------------------------------------------
  // PDF Generation
  // ---------------------------------------------------------------------------

  const handleConfirmGeneratePdf = useCallback(async () => {
    const currentQuoteId = storeState.quoteId || quoteId;
    const currentVersionId = storeState.versionId || versionId;
    if (!currentQuoteId) {
      toast({ title: 'Save First', description: 'Please save the quote before generating a PDF.', variant: 'destructive' });
      return;
    }
    
    setIsGeneratingPdf(true);
    logAudit('generate_pdf_attempt', { quoteId: currentQuoteId, templateId: selectedTemplateId });

    try {
      const payload = { 
        quoteId: currentQuoteId, 
        versionId: currentVersionId, 
        engine_v2: true, 
        source: 'unified_composer', 
        action: 'generate-pdf',
        templateId: selectedTemplateId || undefined
      };
      
      const { data: response, error: pdfError } = await invokeFunction('generate-quote-pdf', {
        body: payload,
      });
      if (pdfError) {
        const msg = String(pdfError?.message || pdfError || '');
        const correlationId = String((pdfError as any)?.correlation_id || '');
        const issues = Array.isArray((pdfError as any)?.issues) ? (pdfError as any).issues : null;
        if (/jwt|unauthorized|401/i.test(msg)) {
          const suffix = correlationId ? ` (Ref: ${correlationId})` : '';
          throw new Error(`Unauthorized. Your session expired or is invalid, or PDF service auth is misconfigured.${suffix}`);
        }
        if (issues && issues.length > 0) {
          throw new Error(`${msg || 'PDF pre-render validation failed'}: ${issues.join('; ')}`);
        }
        throw new Error(`${msg || 'Failed to generate PDF'}${correlationId ? ` (Ref: ${correlationId})` : ''}`);
      }
      if (!response?.content) {
        const issues = Array.isArray(response?.issues) ? response.issues.join('; ') : null;
        throw new Error(issues || 'Received empty content from PDF service');
      }
      const binaryString = window.atob(response.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quote-${currentQuoteId.slice(0, 8)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      
      const warnings = Array.isArray(response?.issues) ? response.issues : [];
      if (warnings.length > 0) {
        logger.warn('[UnifiedComposer] PDF generated with warnings', { quoteId: currentQuoteId, warningsCount: warnings.length });
        logAudit('generate_pdf_warning', { quoteId: currentQuoteId, warningsCount: warnings.length, warnings: warnings.slice(0, 10) }, 'success');
        toast({ title: 'PDF Generated (Warnings)', description: warnings.slice(0, 3).join('; ') });
      } else {
        logAudit('generate_pdf_success', { quoteId: currentQuoteId }, 'success');
        toast({ title: 'PDF Generated', description: 'PDF has been downloaded.' });
      }
      
      // Close modal on success
      setShowPdfModal(false);
    } catch (err: any) {
      logger.error('[UnifiedComposer] PDF generation failed:', err);
      logAudit('generate_pdf_failure', { quoteId: currentQuoteId, error: err.message, stack: err.stack }, 'failure');
      toast({ title: 'PDF Failed', description: err.message || 'Could not generate PDF', variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [storeState.quoteId, storeState.versionId, quoteId, versionId, toast, logAudit, selectedTemplateId]);

  const handleGeneratePdf = useCallback(() => {
    setShowPdfModal(true);
  }, []);

  const handleFormChange = useCallback((values: any) => {
    setLastFormData((prev) => ({
      values: values as FormZoneValues,
      extended: (prev?.extended || (initialExtended as ExtendedFormData) || ({} as ExtendedFormData)),
    }));
  }, [initialExtended]);

  // ---------------------------------------------------------------------------
  // Reference Data Memoization & Handlers
  // ---------------------------------------------------------------------------

  const referenceData = useMemo(() => ({
    chargeCategories: repoData.chargeCategories || [],
    chargeBases: repoData.chargeBases || [],
    currencies: repoData.currencies || [],
    chargeSides: repoData.chargeSides || [],
  }), [repoData.chargeCategories, repoData.chargeBases, repoData.currencies, repoData.chargeSides]);

  const handleDraftChange = useCallback((draft: any) => {
    if (selectedOption?.id) {
      setOptionDrafts((prev) => ({ ...prev, [selectedOption.id]: draft }));
    }
  }, [selectedOption?.id]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const breadcrumbs = [
    { label: 'Sales', href: '/sales' },
    { label: 'Quotations', href: '/sales/quotations' },
    { label: isEditMode ? 'Edit Quotation' : 'New Quotation', active: true }
  ];

  const pageTitle = isEditMode 
    ? `Edit Quotation ${storeState.quoteData?.quote_number ? `- ${storeState.quoteData.quote_number}` : ''}`
    : 'New Quotation';

  if (editLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading quote...</span>
      </div>
    );
  }

  const actions = (
    <div className="flex items-center gap-2">
       {versionHistory.length > 0 && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <History className="h-4 w-4" />
              Version History
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[1.25rem]">{versionHistory.length}</Badge>
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Version History</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {versionHistory.map((ver) => (
                <div key={ver.id} className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Version {ver.version_number}</span>
                    <span className="text-xs text-muted-foreground">{new Date(ver.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {ver.change_summary || 'No summary available'}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        {ver.created_by_email || 'System'}
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                        setSearchParams(prev => {
                            const newParams = new URLSearchParams(prev);
                            newParams.set('versionId', ver.id);
                            return newParams;
                        });
                    }}>
                      Load <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
       )}
    </div>
  );

  return (
    <EnterpriseFormLayout
      breadcrumbs={breadcrumbs}
      title={pageTitle}
      actions={actions}
    >
      <FormProvider {...form}>
        <div className="space-y-6 w-full max-w-full">
          
          {loadErrors.length > 0 && (
            <div className="rounded-md bg-destructive/15 p-4 text-destructive">
              <div className="flex items-center gap-2 font-medium">
                 <AlertCircle className="h-4 w-4" />
                 <span>Some data failed to load:</span>
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {loadErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Network Status Indicator */}
          {showNetworkWarning && networkStatus === 'offline' && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Network Offline</span>
              </div>
              <p className="mt-1 text-sm text-amber-700">
                You appear to be offline. Save functionality may be limited until your connection is restored.
              </p>
            </div>
          )}

          {networkStatus === 'checking' && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center gap-2 text-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">Checking Connection</span>
              </div>
              <p className="mt-1 text-sm text-blue-700">
                Verifying network connectivity...
              </p>
            </div>
          )}

          {renderValidationSummary()}

          {/* Form Zone */}
          <FormZone
              onGetRates={handleGetRates}
              onSaveDraft={handleSaveDraft}
              onValidationFailed={handleValidationFailed}
              loading={rateFetching.loading}
              crmLoading={isCrmLoading}
              initialValues={initialFormValues}
              initialExtended={initialExtended}
              accounts={accounts}
              contacts={contacts}
              opportunities={opportunities}
              onChange={handleFormChange}
          />

          <Separator />

          {/* Results Zone */}
          <ResultsZone
              results={(!lastFormData && displayResults.length === 0 && !rateFetching.loading && !editLoading && !isSmartMode && !quoteId) ? null : displayResults}
              loading={rateFetching.loading || editLoading}
              smartMode={isSmartMode}
              marketAnalysis={rateFetching.marketAnalysis}
              confidenceScore={rateFetching.confidenceScore}
              anomalies={rateFetching.anomalies}
              complianceCheck={complianceCheck}
              onSelect={handleSelectOption}
              selectedOptionId={selectedOption?.id}
              onRerunRates={lastFormData ? handleRerunRates : undefined}
              onAddManualOption={handleAddManualOption}
              onRemoveOption={handleRemoveOption}
              availableOptions={availableOptions}
              onAddRateOption={handleAddRateOption}
              onRenameOption={handleRenameOption}
          />

          {/* Finalize Section — shown when option selected */}
          {selectedOption && (
            <>
              <Separator />
              <FinalizeSection
                selectedOption={selectedOption}
                onSaveQuote={handleSaveQuote}
                onGeneratePdf={handleGeneratePdf}
                saving={saving}
                draft={optionDrafts[selectedOption.id]}
                onDraftChange={handleDraftChange}
                onRenameOption={handleRenameOption}
                referenceData={referenceData}
              />
            </>
          )}

          {/* PDF Generation Modal */}
          <Dialog open={showPdfModal} onOpenChange={setShowPdfModal}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Generate PDF</DialogTitle>
                <DialogDescription>
                  Select a template to generate the quotation PDF.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="template" className="text-sm font-medium">
                    Template
                  </label>
                  <TemplateSelector 
                    value={selectedTemplateId} 
                    onChange={setSelectedTemplateId} 
                    disabled={isGeneratingPdf}
                    tenantId={quoteTenantId || context.tenantId}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPdfModal(false)} disabled={isGeneratingPdf}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmGeneratePdf} disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate PDF'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </FormProvider>
    </EnterpriseFormLayout>
  );
}
