import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { QuoteDataProvider, useQuoteContext } from './QuoteContext';
import { QuoteHeader } from './QuoteHeader';
import { QuoteLogistics } from './QuoteLogistics';
import { QuoteFinancials } from './QuoteFinancials';
import { quoteSchema, QuoteFormValues } from './types';
import { useQuoteHydration } from './useQuoteHydration';
import { QuoteErrorBoundary } from './QuoteErrorBoundary';
import { MultiModalQuoteComposer } from '@/components/sales/MultiModalQuoteComposer';
import { Loader2, Save, X, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { useCRM } from '@/hooks/useCRM';

interface QuoteFormProps {
  quoteId?: string;
  onSuccess?: (quoteId: string) => void;
  initialData?: Partial<QuoteFormValues>;
}

function QuoteFormContent({ quoteId, onSuccess, initialData }: QuoteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // We can access context data here if needed for submission logic
  const { resolvedTenantId } = useQuoteContext();
  const [composerVersionId, setComposerVersionId] = useState<string>(''); // Placeholder for logic
  const { scopedDb } = useCRM();
  
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      status: 'draft',
      tax_percent: '0',
      shipping_amount: '0',
      ...initialData,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        status: 'draft',
        tax_percent: '0',
        shipping_amount: '0',
        ...initialData,
      });
    }
  }, [initialData, form]);

  const { isHydrating } = useQuoteHydration(form, quoteId);

  const onSubmit = async (data: QuoteFormValues) => {
    setIsSubmitting(true);
    try {
      const finalTenantId = resolvedTenantId || null;

      // Pre-save augmentation: ensure account/contact from opportunity if missing
      let accountId = data.account_id || '';
      let contactId = data.contact_id || '';
      const opportunityId = data.opportunity_id || '';

      if (opportunityId && (!accountId || !contactId)) {
        const { data: opp, error: oppError } = await scopedDb
          .from('opportunities')
          .select('id, account_id, contact_id')
          .eq('id', opportunityId)
          .maybeSingle();
        if (!oppError && opp) {
          if (!accountId && opp.account_id) accountId = String(opp.account_id);
          if (!contactId && opp.contact_id) contactId = String(opp.contact_id);
        }
      }

      const payload: any = {
        title: data.title,
        description: data.description || null,
        service_type_id: data.service_type_id || null,
        service_id: data.service_id || null,
        incoterms: data.incoterms || null,
        carrier_id: data.carrier_id || null,
        consignee_id: data.consignee_id || null,
        origin_port_id: data.origin_port_id || null,
        destination_port_id: data.destination_port_id || null,
        account_id: accountId || null,
        contact_id: contactId || null,
        opportunity_id: opportunityId || null,
        status: data.status || 'draft',
        valid_until: data.valid_until || null,
        tax_percent: data.tax_percent ? Number(data.tax_percent) : 0,
        shipping_amount: data.shipping_amount ? Number(data.shipping_amount) : 0,
        terms_conditions: data.terms_conditions || null,
        notes: data.notes || null,
        tenant_id: finalTenantId,
        regulatory_data: {
          trade_direction: data.trade_direction || null,
        },
      };

      // Basic DB connectivity check
      const { error: connectivityError } = await scopedDb.from('quotes').select('id').limit(1);
      if (connectivityError) {
        throw connectivityError;
      }

      let savedId = quoteId || '';
      if (quoteId) {
        const { error: updateError } = await scopedDb
          .from('quotes')
          .update(payload)
          .eq('id', quoteId);
        if (updateError) throw updateError;
        savedId = quoteId;
      } else {
        const { data: inserted, error: insertError } = await scopedDb
          .from('quotes')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (insertError) throw insertError;
        savedId = String((inserted as any)?.id);
      }

      if (!savedId) {
        throw new Error('Quote save did not return an id');
      }

      toast.success('Quote saved successfully');
      if (onSuccess) onSuccess(savedId);
    } catch (error: any) {
      console.error('Submission error:', error);
      const description = error?.message || 'Unexpected error during save';
      toast.error('Failed to save quote', { description });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isHydrating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading quote details...</p>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20">
        
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-2 -mx-4 px-4 md:-mx-8 md:px-8 mb-6 flex justify-between items-center transition-all duration-200">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary rounded-lg shadow-sm">
                    <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        {quoteId ? 'Edit Quote' : 'New Quote'}
                    </h2>
                    <p className="text-sm text-muted-foreground hidden md:block">
                        {quoteId ? `Ref: ${quoteId.slice(0, 8)}...` : 'Create a new logistics quotation'}
                    </p>
                </div>
            </div>
            <div className="flex gap-3">
                 <Button type="button" variant="outline" onClick={() => window.history.back()} className="gap-2">
                    <X className="h-4 w-4" />
                    Cancel
                 </Button>
                 <Button type="submit" disabled={isSubmitting} className="gap-2 shadow-sm">
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Save Quote
                 </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary/80 font-medium px-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs">1</span>
                    <h3>General Information</h3>
                </div>
                <QuoteHeader />
            </section>
            
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary/80 font-medium px-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs">2</span>
                    <h3>Logistics & Routing</h3>
                </div>
                <QuoteLogistics />
            </section>
            
            {/* Keeping MultiModalQuoteComposer as a bridge until Phase 2 */}
            {quoteId && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary/80 font-medium px-1">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs">3</span>
                        <h3>Route Composer (Advanced)</h3>
                    </div>
                    <div className="border rounded-xl p-6 bg-gradient-to-br from-muted/20 to-muted/5 shadow-inner">
                        <MultiModalQuoteComposer 
                            quoteId={quoteId}
                            versionId={composerVersionId}
                        />
                    </div>
                </section>
            )}

            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary/80 font-medium px-1">
                     <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-xs">{quoteId ? 4 : 3}</span>
                    <h3>Financials</h3>
                </div>
                <QuoteFinancials />
            </section>
        </div>

      </form>
    </FormProvider>
  );
}

export function QuoteFormRefactored(props: QuoteFormProps) {
  return (
    <QuoteErrorBoundary>
      <QuoteDataProvider>
        <QuoteFormContent {...props} />
      </QuoteDataProvider>
    </QuoteErrorBoundary>
  );
}
