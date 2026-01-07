import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { QuoteFormValues } from './types';
import { useQuoteContext } from './QuoteContext';

export function useQuoteHydration(
  form: UseFormReturn<QuoteFormValues>,
  quoteId?: string
) {
  const { supabase } = useCRM();
  const { 
    setResolvedTenantId, 
    setServices, 
    setResolvedServiceLabels 
  } = useQuoteContext();
  const [isHydrating, setIsHydrating] = useState(false);

  useEffect(() => {
    if (!quoteId) return;

    const loadQuote = async () => {
      setIsHydrating(true);
      try {
        const { data: quote, error } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', quoteId)
          .maybeSingle();

        if (error) throw error;
        if (!quote) return;

        // Set Tenant Context
        if (quote.tenant_id) {
          setResolvedTenantId(String(quote.tenant_id));
        }

        // Basic Form Reset
        form.reset({
          title: quote.title,
          description: quote.description || '',
          status: quote.status,
          service_type_id: quote.service_type_id ? String(quote.service_type_id) : '',
          service_id: quote.service_id ? String(quote.service_id) : '',
          incoterms: quote.incoterms || '',
          trade_direction: (quote.regulatory_data as any)?.trade_direction,
          carrier_id: quote.carrier_id ? String(quote.carrier_id) : '',
          origin_port_id: quote.origin_port_id ? String(quote.origin_port_id) : '',
          destination_port_id: quote.destination_port_id ? String(quote.destination_port_id) : '',
          account_id: quote.account_id ? String(quote.account_id) : '',
          contact_id: quote.contact_id ? String(quote.contact_id) : '',
          opportunity_id: quote.opportunity_id ? String(quote.opportunity_id) : '',
          valid_until: quote.valid_until || '',
          tax_percent: quote.tax_percent ? String(quote.tax_percent) : '0',
          shipping_amount: quote.shipping_amount ? String(quote.shipping_amount) : '0',
          terms_conditions: quote.terms_conditions || '',
          notes: quote.notes || '',
        });

        // Handle Service Label Injection if missing (Simplified)
        if (quote.service_id) {
             const { data: svc } = await supabase
                .from('services')
                .select('id, service_name')
                .eq('id', quote.service_id)
                .maybeSingle();
             if (svc) {
                 setServices(prev => {
                     if (prev.find(s => s.id === svc.id)) return prev;
                     return [...prev, { ...svc, id: String(svc.id) }];
                 });
             }
        }

      } catch (error) {
        console.error('Error hydrating quote:', error);
        toast.error('Failed to load quote details');
      } finally {
        setIsHydrating(false);
      }
    };

    loadQuote();
  }, [quoteId, supabase, form, setResolvedTenantId, setServices]);

  return { isHydrating };
}
