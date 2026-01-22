import { useCRM } from '@/hooks/useCRM';
import { QuoteFormValues } from './types';
import { useQuoteContext } from './QuoteContext';

export function useQuoteRepository() {
  const { scopedDb } = useCRM();
  const { resolvedTenantId } = useQuoteContext();

  const saveQuote = async (params: {
    quoteId?: string;
    data: QuoteFormValues;
  }): Promise<string> => {
    const { quoteId, data } = params;

    const finalTenantId = resolvedTenantId || null;

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
      billing_address: data.billing_address || {},
      shipping_address: data.shipping_address || {},
      tenant_id: finalTenantId,
      regulatory_data: {
        trade_direction: data.trade_direction || null,
      },
    };

    const { error: connectivityError } = await scopedDb
      .from('quotes')
      .select('id')
      .limit(1);
    if (connectivityError) {
      throw connectivityError;
    }

    let savedId = quoteId || '';

    // Check for existing draft if creating new
    if (!savedId) {
       try {
         // Look for a recent draft (last 1 hour) with same key details
         let query = scopedDb
            .from('quotes')
            .select('id')
            .eq('tenant_id', finalTenantId)
            .eq('status', 'draft')
            .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

         if (payload.title) query = query.eq('title', payload.title);
         
         // Match key fields to ensure it's the "same" quote
         if (payload.account_id) query = query.eq('account_id', payload.account_id);
         else query = query.is('account_id', null);

         if (payload.origin_port_id) query = query.eq('origin_port_id', payload.origin_port_id);
         else query = query.is('origin_port_id', null);

         if (payload.destination_port_id) query = query.eq('destination_port_id', payload.destination_port_id);
         else query = query.is('destination_port_id', null);

         const { data: existing } = await query;
         
         if (existing && existing.length > 0) {
            savedId = existing[0].id;
            console.log(`[QuoteRepository] Found existing draft ${savedId}, updating instead of creating new.`);
         }
       } catch (checkError) {
         console.warn('[QuoteRepository] Error checking for existing drafts:', checkError);
         // Proceed to insert if check fails, better to duplicate than fail
       }
    }

    if (savedId) {
      console.log(`[QuoteRepository] Updating quote ${savedId}`);
      const { error: updateError } = await scopedDb
        .from('quotes')
        .update({
            ...payload,
            updated_at: new Date().toISOString() // Ensure timestamp update
        })
        .eq('id', savedId);
      if (updateError) throw updateError;
    } else {
      console.log(`[QuoteRepository] Creating new quote`);
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

    return savedId;
  };

  return { saveQuote };
}

