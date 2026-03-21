import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { PluginRegistry } from '@/services/plugins/PluginRegistry';
import type { PluginFormConfig } from '@/services/plugins/IPlugin';
import {
  canFinalizeAcceptance,
  nextAsyncJobProgress,
  type PluginFieldValue,
  type QuotationAsyncJob,
  type QuotationPolicyGateState,
  type QuotationPricingIntent,
  type QuotationVersionSnapshot,
  validatePluginFormBlocks,
} from '../workspace/quotationWorkspaceModel';

type QuoteRecord = {
  id: string;
  quoteNumber: string;
  status: string;
  currentVersionId: string | null;
  updatedAt: string;
};

type QuoteOption = {
  id: string;
  label: string;
  total: number;
  currency: string;
  transitDays: number;
};

const initialVersions: QuotationVersionSnapshot[] = [
  {
    id: 'version-draft',
    versionLabel: 'Draft Working Copy',
    snapshotType: 'draft',
    createdAt: new Date().toISOString(),
    author: 'Current Operator',
  },
  {
    id: 'version-4',
    versionLabel: 'v4.0 Snapshot',
    snapshotType: 'immutable_snapshot',
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    author: 'Pricing Manager',
  },
  {
    id: 'version-3',
    versionLabel: 'v3.2 Snapshot',
    snapshotType: 'immutable_snapshot',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    author: 'Ops Supervisor',
  },
];

const initialOptions: QuoteOption[] = [
  { id: 'opt-economy', label: 'Economy Consolidated', total: 2780, currency: 'USD', transitDays: 14 },
  { id: 'opt-balance', label: 'Balanced Hybrid', total: 3320, currency: 'USD', transitDays: 9 },
  { id: 'opt-priority', label: 'Priority Direct', total: 4290, currency: 'USD', transitDays: 5 },
];

const initialJobs: QuotationAsyncJob[] = [
  { id: 'job-import', type: 'import', status: 'queued', progress: 0, retryCount: 0 },
  { id: 'job-export', type: 'export', status: 'queued', progress: 0, retryCount: 0 },
];

export function useQuotationWorkspaceState() {
  const { scopedDb } = useCRM();
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [pricingIntent, setPricingIntent] = useState<QuotationPricingIntent>('market_competitive');
  const [options] = useState<QuoteOption[]>(initialOptions);
  const [versions] = useState<QuotationVersionSnapshot[]>(initialVersions);
  const [asyncJobs, setAsyncJobs] = useState<QuotationAsyncJob[]>(initialJobs);
  const [policyGateState, setPolicyGateState] = useState<QuotationPolicyGateState>({
    policyPassed: true,
    validationPassed: true,
    complianceReady: false,
  });
  const [pluginFormValues, setPluginFormValues] = useState<PluginFieldValue>({});
  const [saveState, setSaveState] = useState<'idle' | 'blocked' | 'saved'>('idle');
  const [acceptanceState, setAcceptanceState] = useState<'idle' | 'blocked' | 'accepted'>('idle');

  useEffect(() => {
    let active = true;
    const run = async () => {
      setQuotesLoading(true);
      const { data, error } = await scopedDb
        .from('quotes')
        .select('id, quote_number, status, current_version_id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(40);
      if (!active) return;
      if (error) {
        setQuotes([]);
        setQuotesLoading(false);
        return;
      }
      const normalized: QuoteRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        quoteNumber: row.quote_number || row.id,
        status: row.status || 'draft',
        currentVersionId: row.current_version_id ?? null,
        updatedAt: row.updated_at || new Date().toISOString(),
      }));
      setQuotes(normalized);
      if (normalized.length) {
        setSelectedQuoteId((previous) => previous || normalized[0].id);
      }
      setQuotesLoading(false);
    };
    run();
    return () => {
      active = false;
    };
  }, [scopedDb]);

  const activeQuote = useMemo(
    () => quotes.find((item) => item.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId]
  );

  const pluginConfig = useMemo<PluginFormConfig | null>(() => {
    const logisticsConfig = PluginRegistry.getFormConfigByDomain('LOGISTICS');
    if (logisticsConfig) return logisticsConfig;
    const plugins = PluginRegistry.getAllPlugins();
    return plugins[0]?.getFormConfig() ?? null;
  }, []);

  const pluginValidation = useMemo(
    () => validatePluginFormBlocks(pluginConfig, pluginFormValues),
    [pluginConfig, pluginFormValues]
  );

  const canAccept = useMemo(() => canFinalizeAcceptance(policyGateState), [policyGateState]);

  const updatePluginField = useCallback((fieldId: string, value: string) => {
    setPluginFormValues((previous) => ({ ...previous, [fieldId]: value }));
  }, []);

  const saveQuoteDraft = useCallback(async () => {
    if (!pluginValidation.isValid) {
      setSaveState('blocked');
      return false;
    }
    setSaveState('saved');
    return true;
  }, [pluginValidation.isValid]);

  const startAsyncJob = useCallback((jobId: string) => {
    setAsyncJobs((previous) =>
      previous.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: 'running',
              progress: 10,
            }
          : job
      )
    );
  }, []);

  const tickAsyncJob = useCallback((jobId: string) => {
    setAsyncJobs((previous) => previous.map((job) => (job.id === jobId ? nextAsyncJobProgress(job) : job)));
  }, []);

  const retryAsyncJob = useCallback((jobId: string) => {
    setAsyncJobs((previous) =>
      previous.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: 'running',
              retryCount: job.retryCount + 1,
              progress: Math.max(15, job.progress),
            }
          : job
      )
    );
  }, []);

  const updatePolicyGate = useCallback((key: keyof QuotationPolicyGateState, value: boolean) => {
    setPolicyGateState((previous) => ({ ...previous, [key]: value }));
  }, []);

  const finalizeAcceptance = useCallback(() => {
    if (!canAccept) {
      setAcceptanceState('blocked');
      return false;
    }
    setAcceptanceState('accepted');
    return true;
  }, [canAccept]);

  return {
    quotes,
    quotesLoading,
    selectedQuoteId,
    setSelectedQuoteId,
    activeQuote,
    pricingIntent,
    setPricingIntent,
    options,
    versions,
    pluginConfig,
    pluginFormValues,
    updatePluginField,
    pluginValidation,
    saveQuoteDraft,
    saveState,
    asyncJobs,
    startAsyncJob,
    tickAsyncJob,
    retryAsyncJob,
    policyGateState,
    updatePolicyGate,
    canAccept,
    finalizeAcceptance,
    acceptanceState,
  };
}
