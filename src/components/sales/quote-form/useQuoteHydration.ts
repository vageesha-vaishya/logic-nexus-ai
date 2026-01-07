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
    setResolvedServiceLabels,
    setAccounts,
    setContacts,
    setOpportunities,
    accounts,
    contacts,
    opportunities
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

        // Inject selected CRM entities into dropdowns if missing
        const accId = quote.account_id ? String(quote.account_id) : '';
        const conId = quote.contact_id ? String(quote.contact_id) : '';
        const oppId = quote.opportunity_id ? String(quote.opportunity_id) : '';

        if (accId && !accounts.some((a: any) => String(a.id) === accId)) {
          const { data: acc } = await supabase
            .from('accounts')
            .select('id, name')
            .eq('id', accId)
            .maybeSingle();
          if (acc) {
            setAccounts((prev) => {
              const exists = prev.some((a: any) => String(a.id) === String(acc.id));
              return exists ? prev : [{ id: String(acc.id), name: acc.name || 'Account' }, ...prev];
            });
          }
        }

        if (conId && !contacts.some((c: any) => String(c.id) === conId)) {
          const { data: con } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, account_id')
            .eq('id', conId)
            .maybeSingle();
          if (con) {
            setContacts((prev) => {
              const exists = prev.some((c: any) => String(c.id) === String(con.id));
              return exists ? prev : [{
                id: String(con.id),
                first_name: con.first_name || '',
                last_name: con.last_name || '',
                account_id: con.account_id ? String(con.account_id) : null
              }, ...prev];
            });
          }
        }

        if (oppId && !opportunities.some((o: any) => String(o.id) === oppId)) {
          const { data: opp } = await supabase
            .from('opportunities')
            .select('id, name, account_id, contact_id')
            .eq('id', oppId)
            .maybeSingle();
          if (opp) {
            setOpportunities((prev) => {
              const exists = prev.some((o: any) => String(o.id) === String(opp.id));
              return exists ? prev : [{
                id: String(opp.id),
                name: opp.name || 'Opportunity',
                account_id: opp.account_id ? String(opp.account_id) : null,
                contact_id: opp.contact_id ? String(opp.contact_id) : null
              }, ...prev];
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
