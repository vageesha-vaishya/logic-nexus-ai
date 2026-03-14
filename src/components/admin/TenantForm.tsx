import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { CrudFormLayout } from '@/components/system/CrudFormLayout';
import { FormSection } from '@/components/system/FormSection';
import { FormStepper } from '@/components/system/FormStepper';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DomainService, PlatformDomain } from '@/services/DomainService';
import { useCRM } from '@/hooks/useCRM';
import { invokeFunction } from '@/lib/supabase-functions';
import { calculateScaledPrice } from '@/utils/subscriptionScaling';

const tenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  domain_id: z.string().min(1, 'Business Domain is required'),
  domain: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  settings: z.string().optional(),
  demographics_age_group: z.string().optional(),
  demographics_gender: z.string().optional(),
  demographics_location_country: z.string().optional(),
  demographics_location_state: z.string().optional(),
  demographics_location_city: z.string().optional(),
  contact_primary_name: z.string().optional(),
  contact_primary_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_primary_phone: z.string().optional(),
  contact_secondary_name: z.string().optional(),
  contact_secondary_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_secondary_phone: z.string().optional(),
  contact_emergency_name: z.string().optional(),
  contact_emergency_phone: z.string().optional(),
  channels_email: z.string().optional(),
  channels_phone: z.string().optional(),
  channels_twitter: z.string().optional(),
  channels_linkedin: z.string().optional(),
  channels_facebook: z.string().optional(),
  legal_name: z.string().optional(),
  registered_address: z.string().optional(),
  tax_id: z.string().optional(),
  default_payment_terms: z.string().optional(),
  tax_jurisdiction: z.string().optional(),
  tax_registration_type: z.string().optional(),
  gstin: z.string().optional(),
  vat_number: z.string().optional(),
  cin_or_registration_number: z.string().optional(),
  kyc_status: z.string().optional(),
  legal_emergency_contact_name: z.string().optional(),
  legal_emergency_contact_phone: z.string().optional(),
  data_residency_region: z.string().optional(),
  data_residency_legal_basis: z.string().optional(),
  data_residency_retention_policy: z.string().optional(),
  data_residency_encryption_required: z.boolean().default(true),
  support_preferred_channel: z.string().optional(),
  support_escalation_level: z.string().optional(),
  selected_plan_id: z.string().optional(),
  selected_billing_period: z.string().optional(),
  requested_user_count: z.string().optional(),
  requested_franchise_count: z.string().optional(),
  payment_provider: z.string().optional(),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

interface TenantFormProps {
  tenant?: any;
  onSuccess?: () => void;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  tier: string | null;
  price_monthly: number;
  price_annual: number | null;
  currency: string;
  billing_period: string;
  is_active: boolean;
  user_scaling_factor?: number | null;
  min_users?: number | null;
  max_users?: number | null;
}

interface ActiveSubscription {
  id: string;
  plan_id: string;
  status: string;
  metadata: any;
}

export function TenantForm({ tenant, onSuccess }: TenantFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { scopedDb, supabase } = useCRM();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<TenantFormValues | null>(null);
  const [domains, setDomains] = useState<PlatformDomain[]>([]);
  const [tenantProfile, setTenantProfile] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);

  const parseRequestedCount = (value?: string) => {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const mergeStepPayloads = (existing: any, next: any) => {
    return {
      ...(existing || {}),
      ...(next || {}),
      phase1: {
        ...((existing || {}).phase1 || {}),
        ...((next || {}).phase1 || {}),
      },
      phase2: {
        ...((existing || {}).phase2 || {}),
        ...((next || {}).phase2 || {}),
      },
    };
  };

  const upsertOnboardingSession = async (
    tenantId: string,
    userId: string | null,
    sessionPatch: {
      status: string;
      current_step: string;
      completed_at?: string | null;
      failure_reason?: string | null;
      step_payloads?: any;
    }
  ) => {
    const { data: existingSession } = await scopedDb
      .from('tenant_onboarding_sessions')
      .select('step_payloads')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const mergedPayloads = mergeStepPayloads(existingSession?.step_payloads || {}, sessionPatch.step_payloads || {});

    const { error } = await scopedDb
      .from('tenant_onboarding_sessions')
      .upsert(
        {
          tenant_id: tenantId,
          status: sessionPatch.status,
          current_step: sessionPatch.current_step,
          started_by: userId,
          step_payloads: mergedPayloads,
          failure_reason: sessionPatch.failure_reason || null,
          completed_at: sessionPatch.completed_at === undefined ? null : sessionPatch.completed_at,
        },
        { onConflict: 'tenant_id' }
      );

    if (error) throw error;
  };

  const applyPhase2PlanAndPayment = async ({
    tenantId,
    tenantName,
    values,
    userId,
  }: {
    tenantId: string;
    tenantName: string;
    values: TenantFormValues;
    userId: string | null;
  }) => {
    const selectedPlanId = (values.selected_plan_id || '').trim();
    if (!selectedPlanId) {
      return { integrated: false, message: null as string | null };
    }

    const selectedPlan = availablePlans.find((p) => p.id === selectedPlanId);
    if (!selectedPlan) {
      throw new Error('Selected subscription plan is unavailable');
    }

    const billingPeriod = values.selected_billing_period === 'annual' ? 'annual' : 'monthly';
    const paymentProvider = (values.payment_provider || 'mock').trim() || 'mock';
    const requestedUserCount = parseRequestedCount(values.requested_user_count);
    const requestedFranchiseCount = parseRequestedCount(values.requested_franchise_count);
    const baseMonthly = Number(selectedPlan.price_monthly || 0);
    const scalingResult = calculateScaledPrice(
      {
        price_monthly: baseMonthly,
        user_scaling_factor: Number(selectedPlan.user_scaling_factor ?? 0),
        min_users: Number(selectedPlan.min_users ?? 0),
        max_users: selectedPlan.max_users ?? null,
      },
      requestedUserCount
    );
    const amountDue = Number((billingPeriod === 'annual' ? scalingResult.annual_price : scalingResult.monthly_price).toFixed(2));
    const currency = (selectedPlan.currency || 'USD').toUpperCase();
    const isFreePlan = (selectedPlan.tier || '').toLowerCase() === 'free' || amountDue <= 0;
    const nowIso = new Date().toISOString();
    const periodMs = billingPeriod === 'annual' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const periodEndIso = new Date(Date.now() + periodMs).toISOString();
    const dueDateIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await scopedDb
      .from('tenant_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: nowIso,
      })
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    const { data: createdSubscription, error: subscriptionError } = await scopedDb
      .from('tenant_subscriptions')
      .insert({
        tenant_id: tenantId,
        plan_id: selectedPlan.id,
        status: isFreePlan ? 'active' : 'trial',
        current_period_start: nowIso,
        current_period_end: periodEndIso,
        metadata: {
          source: 'tenant_onboarding_phase2',
          billing_period: billingPeriod,
          payment_provider: paymentProvider,
          payment_status: isFreePlan ? 'not_required' : 'pending',
          requested_user_count: requestedUserCount,
          requested_franchise_count: requestedFranchiseCount,
          plan_slug: selectedPlan.slug,
          plan_tier: selectedPlan.tier,
        },
      })
      .select('id')
      .single();

    if (subscriptionError) throw subscriptionError;

    const { error: invoiceError } = await scopedDb
      .from('subscription_invoices')
      .insert({
        tenant_id: tenantId,
        subscription_id: createdSubscription.id,
        invoice_number: `ONB-${Date.now()}`,
        amount_due: amountDue,
        amount_paid: isFreePlan ? amountDue : 0,
        currency,
        status: isFreePlan ? 'paid' : 'open',
        due_date: isFreePlan ? null : dueDateIso,
        paid_at: isFreePlan ? nowIso : null,
        billing_reason: 'onboarding_plan_selection',
        metadata: {
          onboarding_phase: 'phase2',
          plan_id: selectedPlan.id,
          plan_name: selectedPlan.name,
          billing_period: billingPeriod,
          requested_user_count: requestedUserCount,
          requested_franchise_count: requestedFranchiseCount,
          payment_provider: paymentProvider,
        },
      });
    if (invoiceError) throw invoiceError;

    const allowedTiers = ['free', 'basic', 'starter', 'business', 'professional', 'enterprise'];
    const normalizedTier = (selectedPlan.tier || '').toLowerCase();
    const derivedTier = allowedTiers.includes(normalizedTier) ? normalizedTier : null;
    if (derivedTier) {
      await scopedDb
        .from('tenants')
        .update({ subscription_tier: derivedTier })
        .eq('id', tenantId);
    }

    if (isFreePlan) {
      await upsertOnboardingSession(tenantId, userId, {
        status: 'provisioning',
        current_step: 'domain_provisioning',
        step_payloads: {
          phase2: {
            plan_selected: true,
            payment_required: false,
            payment_verified: true,
            subscription_id: createdSubscription.id,
            plan_id: selectedPlan.id,
            amount_due: amountDue,
            currency,
          },
        },
      });
      return {
        integrated: true,
        message: 'Free plan activated. Onboarding moved to provisioning.',
      };
    }

    const { data: orchestratorData, error: orchestratorError } = await invokeFunction<{
      success: boolean;
      payment_session_id?: string;
      payment_url?: string;
      provider_metadata?: any;
      message?: string;
    }>('tenant-onboarding-orchestrator', {
      body: {
        action: 'create_payment_session',
        tenant_id: tenantId,
        subscription_id: createdSubscription.id,
        plan_id: selectedPlan.id,
        amount_due: amountDue,
        currency,
        billing_period: billingPeriod,
        payment_provider: paymentProvider,
        requested_user_count: requestedUserCount,
        requested_franchise_count: requestedFranchiseCount,
      },
    });

    if (orchestratorError || !orchestratorData?.success) {
      const reason = orchestratorError?.message || orchestratorData?.message || 'Payment session creation failed';
      await upsertOnboardingSession(tenantId, userId, {
        status: 'support_assisted',
        current_step: 'payment',
        failure_reason: reason,
        step_payloads: {
          phase2: {
            plan_selected: true,
            payment_required: true,
            payment_verified: false,
            payment_session_creation_failed: true,
            subscription_id: createdSubscription.id,
            plan_id: selectedPlan.id,
            amount_due: amountDue,
            currency,
          },
        },
      });
      await scopedDb
        .from('activities')
        .insert({
          activity_type: 'task',
          status: 'open',
          priority: 'high',
          subject: 'Payment support required during tenant onboarding',
          description: `Payment session creation failed for tenant ${tenantName}. Reason: ${reason}`,
          tenant_id: tenantId,
          franchise_id: null,
          account_id: null,
          contact_id: null,
          lead_id: null,
          created_by: userId,
        } as any);
      return {
        integrated: true,
        message: 'Plan saved but payment setup needs support assistance.',
      };
    }

    const paymentSessionId = orchestratorData.payment_session_id || null;
    const paymentUrl = orchestratorData.payment_url || null;
    const providerMetadata = orchestratorData.provider_metadata || null;

    await scopedDb
      .from('tenant_subscriptions')
      .update({
        metadata: {
          source: 'tenant_onboarding_phase2',
          billing_period: billingPeriod,
          payment_provider: paymentProvider,
          payment_status: 'pending',
          requested_user_count: requestedUserCount,
          requested_franchise_count: requestedFranchiseCount,
          payment_session_id: paymentSessionId,
          payment_url: paymentUrl,
          provider_metadata: providerMetadata,
          plan_slug: selectedPlan.slug,
          plan_tier: selectedPlan.tier,
        },
      })
      .eq('id', createdSubscription.id);

    await upsertOnboardingSession(tenantId, userId, {
      status: 'payment_pending',
      current_step: 'payment',
      step_payloads: {
        phase2: {
          plan_selected: true,
          payment_required: true,
          payment_verified: false,
          subscription_id: createdSubscription.id,
          plan_id: selectedPlan.id,
          amount_due: amountDue,
          currency,
          payment_session_id: paymentSessionId,
          payment_url: paymentUrl,
        },
      },
    });

    return {
      integrated: true,
      message: paymentUrl
        ? `Payment session created. Complete payment using: ${paymentUrl}`
        : 'Payment session created and awaiting completion.',
    };
  };

  useEffect(() => {
    if (!DomainService) {
      console.error('DomainService is undefined');
      return;
    }
    
    DomainService.getAllDomains()
      .then((data) => {
        // Sort domains alphabetically by name
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
        setDomains(sorted);
      })
      .catch((err) => {
        console.error('Failed to load domains', err);
        const message = err?.message || (err instanceof Error ? err.message : 'Unknown error loading domains');
        toast({ 
          title: 'Error Loading Domains', 
          description: message, 
          variant: 'destructive' 
        });
      });
  }, [toast]);

  useEffect(() => {
    const loadTenantProfile = async () => {
      if (!tenant?.id) return;

      try {
        const { data, error } = await scopedDb
          .from('tenant_profile')
          .select('*')
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (error) throw error;
        if (data) setTenantProfile(data);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to load tenant profile',
          variant: 'destructive',
        });
      }
    };

    loadTenantProfile();
  }, [tenant?.id, scopedDb, toast]);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const { data, error } = await scopedDb
          .from('subscription_plans', true)
          .select('id, name, slug, description, tier, price_monthly, price_annual, currency, billing_period, is_active, user_scaling_factor, min_users, max_users')
          .eq('is_active', true)
          .eq('plan_type', 'crm_base')
          .order('price_monthly');
        if (error) throw error;
        setAvailablePlans((data || []) as SubscriptionPlan[]);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to load subscription plans',
          variant: 'destructive',
        });
      }
    };
    loadPlans();
  }, [scopedDb, toast]);

  useEffect(() => {
    const loadActiveSubscription = async () => {
      if (!tenant?.id) return;
      try {
        const { data, error } = await scopedDb
          .from('tenant_subscriptions')
          .select('id, plan_id, status, metadata')
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const normalized = data as ActiveSubscription;
          setActiveSubscription(normalized);
          form.setValue('selected_plan_id', normalized.plan_id || '');
          form.setValue('selected_billing_period', String((normalized.metadata as any)?.billing_period || 'monthly'));
          form.setValue('payment_provider', String((normalized.metadata as any)?.payment_provider || 'mock'));
          form.setValue('requested_user_count', String((normalized.metadata as any)?.requested_user_count || ''));
          form.setValue('requested_franchise_count', String((normalized.metadata as any)?.requested_franchise_count || ''));
        }
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to load active subscription',
          variant: 'destructive',
        });
      }
    };
    loadActiveSubscription();
  }, [tenant?.id, scopedDb, toast]);

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      name: tenant?.name || '',
      slug: tenant?.slug || '',
      domain_id: tenant?.domain_id || '',
      domain: tenant?.domain || '',
      logo_url: tenant?.logo_url || '',
      is_active: tenant?.is_active ?? true,
      settings: tenant?.settings ? JSON.stringify(tenant.settings, null, 2) : '',
      demographics_age_group: tenant?.settings?.demographics?.age_group || '',
      demographics_gender: tenant?.settings?.demographics?.gender || '',
      demographics_location_country: tenant?.settings?.demographics?.location?.country || '',
      demographics_location_state: tenant?.settings?.demographics?.location?.state || '',
      demographics_location_city: tenant?.settings?.demographics?.location?.city || '',
      contact_primary_name: tenant?.settings?.contacts?.primary?.name || '',
      contact_primary_email: tenant?.settings?.contacts?.primary?.email || '',
      contact_primary_phone: tenant?.settings?.contacts?.primary?.phone || '',
      contact_secondary_name: tenant?.settings?.contacts?.secondary?.name || '',
      contact_secondary_email: tenant?.settings?.contacts?.secondary?.email || '',
      contact_secondary_phone: tenant?.settings?.contacts?.secondary?.phone || '',
      contact_emergency_name: tenant?.settings?.contacts?.emergency?.name || '',
      contact_emergency_phone: tenant?.settings?.contacts?.emergency?.phone || '',
      channels_email: tenant?.settings?.channels?.email || '',
      channels_phone: tenant?.settings?.channels?.phone || '',
      channels_twitter: tenant?.settings?.channels?.social?.twitter || '',
      channels_linkedin: tenant?.settings?.channels?.social?.linkedin || '',
      channels_facebook: tenant?.settings?.channels?.social?.facebook || '',
      legal_name: '',
      registered_address: '',
      tax_id: '',
      default_payment_terms: '',
      tax_jurisdiction: '',
      tax_registration_type: '',
      gstin: '',
      vat_number: '',
      cin_or_registration_number: '',
      kyc_status: '',
      legal_emergency_contact_name: '',
      legal_emergency_contact_phone: '',
      data_residency_region: tenant?.settings?.data_residency?.region || '',
      data_residency_legal_basis: tenant?.settings?.data_residency?.legal_basis || '',
      data_residency_retention_policy: tenant?.settings?.data_residency?.retention_policy || '',
      data_residency_encryption_required: tenant?.settings?.data_residency?.encryption_required ?? true,
      support_preferred_channel: tenant?.settings?.support?.preferred_channel || '',
      support_escalation_level: tenant?.settings?.support?.escalation_level || '',
      selected_plan_id: '',
      selected_billing_period: 'monthly',
      requested_user_count: '',
      requested_franchise_count: '',
      payment_provider: 'mock',
    },
  });

  const selectedPlanId = form.watch('selected_plan_id');
  const selectedBillingPeriod = form.watch('selected_billing_period') || 'monthly';
  const requestedUserCount = parseRequestedCount(form.watch('requested_user_count'));
  const selectedPlanForPreview = availablePlans.find((p) => p.id === selectedPlanId);
  const planPricingPreview = selectedPlanForPreview
    ? (() => {
        const scaled = calculateScaledPrice(
          {
            price_monthly: Number(selectedPlanForPreview.price_monthly || 0),
            user_scaling_factor: Number(selectedPlanForPreview.user_scaling_factor ?? 0),
            min_users: Number(selectedPlanForPreview.min_users ?? 0),
            max_users: selectedPlanForPreview.max_users ?? null,
          },
          requestedUserCount
        );
        return selectedBillingPeriod === 'annual' ? scaled.annual_price : scaled.monthly_price;
      })()
    : null;

  useEffect(() => {
    if (!tenantProfile) return;

    form.reset({
      ...form.getValues(),
      legal_name: tenantProfile.legal_name || '',
      registered_address: tenantProfile.registered_address || '',
      tax_id: tenantProfile.tax_id || '',
      default_payment_terms: tenantProfile.default_payment_terms || '',
      tax_jurisdiction: tenantProfile.tax_jurisdiction || '',
      tax_registration_type: tenantProfile.tax_registration_type || '',
      gstin: tenantProfile.gstin || '',
      vat_number: tenantProfile.vat_number || '',
      cin_or_registration_number: tenantProfile.cin_or_registration_number || '',
      kyc_status: tenantProfile.kyc_status || '',
      legal_emergency_contact_name: tenantProfile.emergency_contact_info?.name || '',
      legal_emergency_contact_phone: tenantProfile.emergency_contact_info?.phone || '',
    });
  }, [tenantProfile, form]);

  const handleFormSubmit = (values: TenantFormValues) => {
    setPendingData(values);
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setShowConfirmDialog(false);
    
    await onSubmit(pendingData);
    setPendingData(null);
  };

  const onSubmit = async (values: TenantFormValues) => {
    try {
      const userResponse = await supabase.auth.getUser();
      const userId = userResponse?.data?.user?.id || null;
      const existingSettings = (() => {
        try {
          return values.settings ? JSON.parse(values.settings) : (tenant?.settings || {});
        } catch {
          return tenant?.settings || {};
        }
      })();
      const nextSettings = {
        ...existingSettings,
        demographics: {
          age_group: values.demographics_age_group || existingSettings?.demographics?.age_group || '',
          gender: values.demographics_gender || existingSettings?.demographics?.gender || '',
          location: {
            country: values.demographics_location_country || existingSettings?.demographics?.location?.country || '',
            state: values.demographics_location_state || existingSettings?.demographics?.location?.state || '',
            city: values.demographics_location_city || existingSettings?.demographics?.location?.city || '',
          },
        },
        contacts: {
          primary: {
            name: values.contact_primary_name || existingSettings?.contacts?.primary?.name || '',
            email: values.contact_primary_email || existingSettings?.contacts?.primary?.email || '',
            phone: values.contact_primary_phone || existingSettings?.contacts?.primary?.phone || '',
          },
          secondary: {
            name: values.contact_secondary_name || existingSettings?.contacts?.secondary?.name || '',
            email: values.contact_secondary_email || existingSettings?.contacts?.secondary?.email || '',
            phone: values.contact_secondary_phone || existingSettings?.contacts?.secondary?.phone || '',
          },
          emergency: {
            name: values.contact_emergency_name || existingSettings?.contacts?.emergency?.name || '',
            phone: values.contact_emergency_phone || existingSettings?.contacts?.emergency?.phone || '',
          },
        },
        channels: {
          email: values.channels_email || existingSettings?.channels?.email || '',
          phone: values.channels_phone || existingSettings?.channels?.phone || '',
          social: {
            twitter: values.channels_twitter || existingSettings?.channels?.social?.twitter || '',
            linkedin: values.channels_linkedin || existingSettings?.channels?.social?.linkedin || '',
            facebook: values.channels_facebook || existingSettings?.channels?.social?.facebook || '',
          },
        },
        data_residency: {
          region: values.data_residency_region || existingSettings?.data_residency?.region || '',
          legal_basis: values.data_residency_legal_basis || existingSettings?.data_residency?.legal_basis || '',
          retention_policy: values.data_residency_retention_policy || existingSettings?.data_residency?.retention_policy || '',
          encryption_required: values.data_residency_encryption_required ?? existingSettings?.data_residency?.encryption_required ?? true,
        },
        support: {
          preferred_channel: values.support_preferred_channel || existingSettings?.support?.preferred_channel || '',
          escalation_level: values.support_escalation_level || existingSettings?.support?.escalation_level || '',
        },
      };

      const legalProfileComplete = Boolean(
        (values.legal_name || '').trim() &&
        (values.registered_address || '').trim() &&
        (values.default_payment_terms || '').trim()
      );
      const dataResidencyComplete = Boolean((values.data_residency_region || '').trim());
      const phase1Complete = legalProfileComplete && dataResidencyComplete;

      const onboardingStatus = phase1Complete ? 'submitted' : 'draft';
      const onboardingStep = phase1Complete ? 'plan_selection' : 'identity_legal';

      const onboardingFlags = {
        ...(nextSettings?.onboarding_flags || {}),
        identity_profile_completed: legalProfileComplete,
        data_residency_completed: dataResidencyComplete,
        phase1_completed: phase1Complete,
      };

      const dataResidencySettings = nextSettings?.data_residency || {};
      const supportSettings = nextSettings?.support || {};

      const data = {
        name: values.name,
        slug: values.slug,
        domain_id: values.domain_id,
        domain: values.domain || null,
        logo_url: values.logo_url || null,
        is_active: values.is_active,
        settings: {
          ...nextSettings,
          data_residency: dataResidencySettings,
          support: supportSettings,
          onboarding_flags: onboardingFlags,
        },
      };

      const profileData = {
        legal_name: values.legal_name || null,
        registered_address: values.registered_address || null,
        tax_id: values.tax_id || null,
        default_payment_terms: values.default_payment_terms || null,
        emergency_contact_info: {
          name: values.legal_emergency_contact_name || '',
          phone: values.legal_emergency_contact_phone || '',
        },
        tax_jurisdiction: values.tax_jurisdiction || null,
        tax_registration_type: values.tax_registration_type || null,
        gstin: values.gstin || null,
        vat_number: values.vat_number || null,
        cin_or_registration_number: values.cin_or_registration_number || null,
        kyc_status: values.kyc_status || null,
      };

      if (tenant) {
        const { error } = await scopedDb
          .from('tenants')
          .update(data)
          .eq('id', tenant.id);

        if (error) throw error;

        const { error: profileError } = await scopedDb
          .from('tenant_profile')
          .upsert(
            {
              tenant_id: tenant.id,
              ...profileData,
            },
            { onConflict: 'tenant_id' }
          );
        if (profileError) throw profileError;

        const { error: sessionError } = await scopedDb
          .from('tenant_onboarding_sessions')
          .upsert(
            {
              tenant_id: tenant.id,
              status: onboardingStatus,
              current_step: onboardingStep,
              started_by: userId,
              step_payloads: {
                phase1: {
                  legal_profile_completed: legalProfileComplete,
                  data_residency_completed: dataResidencyComplete,
                },
              },
              completed_at: phase1Complete ? new Date().toISOString() : null,
            },
            { onConflict: 'tenant_id' }
          );
        if (sessionError) throw sessionError;

        const phase2Result = await applyPhase2PlanAndPayment({
          tenantId: tenant.id,
          tenantName: data.name,
          values,
          userId,
        });

        const { error: actErr } = await scopedDb
          .from('activities')
          .insert({
            activity_type: 'note',
            status: 'completed',
            priority: 'low',
            subject: 'Tenant onboarding phase 1 updated',
            description: `Core onboarding data updated for tenant ${data.name}`,
            tenant_id: tenant.id,
            franchise_id: null,
            account_id: null,
            contact_id: null,
            lead_id: null,
            created_by: userId,
          } as any);
        if (actErr) {
          console.warn('Activity logging failed:', actErr.message);
        }

        toast({
          title: 'Success',
          description: phase2Result.message || 'Tenant updated successfully',
        });
        onSuccess?.();
      } else {
        const { data: createdTenant, error } = await scopedDb
          .from('tenants')
          .insert(data)
          .select('id, name')
          .single();

        if (error) throw error;
        if (!createdTenant?.id) throw new Error('Tenant creation succeeded but tenant id is missing');

        const { error: profileError } = await scopedDb
          .from('tenant_profile')
          .upsert(
            {
              tenant_id: createdTenant.id,
              ...profileData,
            },
            { onConflict: 'tenant_id' }
          );
        if (profileError) throw profileError;

        const { error: sessionError } = await scopedDb
          .from('tenant_onboarding_sessions')
          .upsert(
            {
              tenant_id: createdTenant.id,
              status: onboardingStatus,
              current_step: onboardingStep,
              started_by: userId,
              step_payloads: {
                phase1: {
                  legal_profile_completed: legalProfileComplete,
                  data_residency_completed: dataResidencyComplete,
                },
              },
              completed_at: phase1Complete ? new Date().toISOString() : null,
            },
            { onConflict: 'tenant_id' }
          );
        if (sessionError) throw sessionError;

        const phase2Result = await applyPhase2PlanAndPayment({
          tenantId: createdTenant.id,
          tenantName: createdTenant.name,
          values,
          userId,
        });

        const { error: actErr } = await scopedDb
          .from('activities')
          .insert({
            activity_type: 'note',
            status: 'completed',
            priority: 'low',
            subject: 'Tenant onboarding phase 1 created',
            description: `Core onboarding data created for tenant ${createdTenant.name}`,
            tenant_id: createdTenant.id,
            franchise_id: null,
            account_id: null,
            contact_id: null,
            lead_id: null,
            created_by: userId,
          } as any);
        if (actErr) {
          console.warn('Activity logging failed:', actErr.message);
        }

        toast({
          title: 'Success',
          description: phase2Result.message || 'Tenant created successfully',
        });
        navigate('/dashboard/tenants');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Form {...form}>
        <CrudFormLayout
          title={tenant ? 'Edit Tenant' : 'New Tenant'}
          description="Organization profile, legal identity, residency controls, contacts, channels, and settings"
          onCancel={() => navigate('/dashboard/tenants')}
          onSave={() => form.handleSubmit(handleFormSubmit)()}
        >
          <FormStepper
            steps={[
              { id: 'details', label: 'Details' },
              { id: 'legal-tax', label: 'Legal & Tax' },
              { id: 'residency', label: 'Data Residency' },
              { id: 'plan-payment', label: 'Plan & Payment' },
              { id: 'demographics', label: 'Demographics' },
              { id: 'contacts', label: 'Contacts' },
              { id: 'channels', label: 'Channels' },
              { id: 'status', label: 'Status' },
            ]}
            activeId="details"
          />

          <div className="space-y-6">
            <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corporation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domain_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Domain *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug *</FormLabel>
              <FormControl>
                <Input placeholder="acme-corp" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <FormControl>
                <Input placeholder="acme.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="logo_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/logo.png" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormSection title="Legal & Tax Identity">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="legal_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Legal Name</FormLabel>
                <FormControl><Input placeholder="Acme Corporation Private Limited" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="default_payment_terms" render={({ field }) => (
              <FormItem>
                <FormLabel>Default Payment Terms</FormLabel>
                <FormControl><Input placeholder="Net 30" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="tax_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID</FormLabel>
                <FormControl><Input placeholder="Tax registration identifier" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="tax_jurisdiction" render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Jurisdiction</FormLabel>
                <FormControl><Input placeholder="India / EU / US / Other" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="tax_registration_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Registration Type</FormLabel>
                <FormControl><Input placeholder="GST / VAT / EIN" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="kyc_status" render={({ field }) => (
              <FormItem>
                <FormLabel>KYC Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select KYC status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="gstin" render={({ field }) => (
              <FormItem>
                <FormLabel>GSTIN</FormLabel>
                <FormControl><Input placeholder="India GSTIN" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="vat_number" render={({ field }) => (
              <FormItem>
                <FormLabel>VAT Number</FormLabel>
                <FormControl><Input placeholder="EU / International VAT Number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cin_or_registration_number" render={({ field }) => (
              <FormItem>
                <FormLabel>CIN / Registration Number</FormLabel>
                <FormControl><Input placeholder="Company registration number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="registered_address" render={({ field }) => (
            <FormItem>
              <FormLabel>Registered Address</FormLabel>
              <FormControl>
                <Textarea placeholder="Registered legal address" rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="legal_emergency_contact_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Compliance Emergency Contact Name</FormLabel>
                <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="legal_emergency_contact_phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Compliance Emergency Contact Phone</FormLabel>
                <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </FormSection>
        <Separator />
        <FormSection title="Data Residency and Support">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="data_residency_region" render={({ field }) => (
              <FormItem>
                <FormLabel>Data Residency Region</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="india">India</SelectItem>
                    <SelectItem value="eu">EU</SelectItem>
                    <SelectItem value="us">US</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="data_residency_legal_basis" render={({ field }) => (
              <FormItem>
                <FormLabel>Legal Basis</FormLabel>
                <FormControl><Input placeholder="Contract / Consent / Legitimate interest" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="data_residency_retention_policy" render={({ field }) => (
              <FormItem>
                <FormLabel>Retention Policy</FormLabel>
                <FormControl><Input placeholder="e.g., 7 years" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="support_preferred_channel" render={({ field }) => (
              <FormItem>
                <FormLabel>Support Preferred Channel</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select support channel" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="support_escalation_level" render={({ field }) => (
              <FormItem>
                <FormLabel>Support Escalation Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select escalation level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField
            control={form.control}
            name="data_residency_encryption_required"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Encryption Required</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Require encrypted storage for tenant data
                  </div>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </FormSection>
        <Separator />
        <FormSection title="Plan and Payment">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="selected_plan_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription Plan</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availablePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} ({(plan.currency || 'USD').toUpperCase()} {plan.price_monthly}/month)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Required to continue onboarding beyond Phase 1</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="selected_billing_period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Period</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || 'monthly'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select billing period" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="requested_user_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requested Users</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="e.g. 25" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requested_franchise_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requested Franchises</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="e.g. 5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Provider</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || 'mock'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mock">Mock Gateway</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="razorpay">Razorpay</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {selectedPlanForPreview && (
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium">{selectedPlanForPreview.name}</div>
              <div className="text-muted-foreground">
                {(selectedPlanForPreview.currency || 'USD').toUpperCase()} {Number(planPricingPreview || 0).toFixed(2)} /{selectedBillingPeriod === 'annual' ? 'year' : 'month'}
              </div>
              {selectedPlanForPreview.description && (
                <div className="mt-2 text-muted-foreground">{selectedPlanForPreview.description}</div>
              )}
            </div>
          )}
          {activeSubscription && (
            <div className="text-xs text-muted-foreground">
              Existing active subscription detected and will be replaced after confirmation.
            </div>
          )}
        </FormSection>
        <Separator />
        <FormSection title="Demographics">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="demographics_age_group" render={({ field }) => (
                <FormItem>
                  <FormLabel>Age Group</FormLabel>
                  <FormControl><Input placeholder="e.g., 25-34" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="demographics_gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <FormControl><Input placeholder="e.g., Mixed" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="demographics_location_country" render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl><Input placeholder="e.g., USA" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="demographics_location_state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl><Input placeholder="e.g., California" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="demographics_location_city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input placeholder="e.g., San Francisco" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
        </FormSection>
        <Separator />
        <FormSection title="Primary Contacts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="contact_primary_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Contact Name</FormLabel>
                  <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_primary_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Contact Email</FormLabel>
                  <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_primary_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Contact Phone</FormLabel>
                  <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
        </FormSection>
        <FormSection title="Secondary & Emergency Contacts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="contact_secondary_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Contact Name</FormLabel>
                  <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_secondary_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Contact Email</FormLabel>
                  <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_secondary_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Contact Phone</FormLabel>
                  <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="contact_emergency_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Name</FormLabel>
                  <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_emergency_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Phone</FormLabel>
                  <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
        </FormSection>
        <Separator />
        <FormSection title="Communication Channels">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="channels_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Email Channel</FormLabel>
                  <FormControl><Input placeholder="support@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="channels_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Phone Channel</FormLabel>
                  <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="channels_twitter" render={({ field }) => (
                <FormItem>
                  <FormLabel>Twitter</FormLabel>
                  <FormControl><Input placeholder="@handle" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="channels_linkedin" render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn</FormLabel>
                  <FormControl><Input placeholder="linkedin.com/company/..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="channels_facebook" render={({ field }) => (
                <FormItem>
                  <FormLabel>Facebook</FormLabel>
                  <FormControl><Input placeholder="facebook.com/..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
        </FormSection>

        <FormField
          control={form.control}
          name="settings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Settings (JSON)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder='{"key": "value"}' 
                  className="font-mono"
                  rows={4}
                  {...field} 
                />
              </FormControl>
              <FormDescription>Advanced: Raw JSON for additional custom settings</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormSection title="Status">
          <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Active Status</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable or disable this tenant
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        </FormSection>
          </div>
        </CrudFormLayout>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {tenant ? 'Update' : 'Create'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {tenant ? 'update' : 'create'} this tenant?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
