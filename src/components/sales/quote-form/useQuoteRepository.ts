import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { QuoteFormValues } from './types';
import { useQuoteContext } from './QuoteContext';

export function useQuoteRepository() {
  const { scopedDb, context } = useCRM();
  const { roles } = useAuth();
  const { resolvedTenantId } = useQuoteContext();

  const saveQuote = async (params: {
    quoteId?: string;
    data: QuoteFormValues;
  }): Promise<string> => {
    const { quoteId, data } = params;

    const finalTenantId = resolvedTenantId || context.tenantId || roles?.[0]?.tenant_id || null;

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

    // Save Line Items
    if (data.items && data.items.length > 0) {
      // First, delete existing items to ensure clean state (simple strategy)
      // Ideally we would diff, but full replace is safer for consistency here
      const { error: deleteError } = await scopedDb
        .from('quote_items')
        .delete()
        .eq('quote_id', savedId);
      
      if (deleteError) {
        console.error('[QuoteRepository] Error deleting old items:', deleteError);
        // Continue to try inserting? Or throw?
        // Throwing might be safer to avoid duplicate/inconsistent state
        throw deleteError;
      }

      const itemsPayload = data.items.map((item, index) => ({
        quote_id: savedId,
        line_number: index + 1,
        type: item.type || 'loose',
        container_type_id: item.container_type_id || null,
        container_size_id: item.container_size_id || null,
        product_name: item.product_name,
        commodity_id: item.commodity_id || null,
        aes_hts_id: item.aes_hts_id || null,
        description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        package_category_id: item.package_category_id || null,
        package_size_id: item.package_size_id || null,
        // Extension fields
        weight_kg: item.attributes?.weight || 0,
        volume_cbm: item.attributes?.volume || 0,
        attributes: item.attributes || {},
      }));

      const { error: itemsError } = await scopedDb
        .from('quote_items')
        .insert(itemsPayload);
      
      if (itemsError) {
        console.error('[QuoteRepository] Error saving items:', itemsError);
        throw itemsError;
      }
    } else {
        // If items is empty array, we should probably clear existing items too
        await scopedDb.from('quote_items').delete().eq('quote_id', savedId);
    }

    // Save Cargo Configurations
    if (data.cargo_configurations && data.cargo_configurations.length > 0) {
      // Clear existing configurations
      const { error: deleteCargoError } = await scopedDb
        .from('quote_cargo_configurations')
        .delete()
        .eq('quote_id', savedId);

      if (deleteCargoError) {
        console.error('[QuoteRepository] Error deleting old cargo configs:', deleteCargoError);
        throw deleteCargoError;
      }

      const cargoPayload = data.cargo_configurations.map(config => ({
        quote_id: savedId,
        tenant_id: finalTenantId,
        transport_mode: config.transport_mode,
        cargo_type: config.cargo_type,
        container_type: config.container_type || null,
        container_size: config.container_size || null,
        container_type_id: config.container_type_id || null,
        container_size_id: config.container_size_id || null,
        quantity: config.quantity,
        unit_weight_kg: config.unit_weight_kg || null,
        unit_volume_cbm: config.unit_volume_cbm || null,
        length_cm: config.length_cm || null,
        width_cm: config.width_cm || null,
        height_cm: config.height_cm || null,
        is_hazardous: config.is_hazardous || false,
        hazardous_class: config.hazardous_class || null,
        un_number: config.un_number || null,
        is_temperature_controlled: config.is_temperature_controlled || false,
        temperature_min: config.temperature_min || null,
        temperature_max: config.temperature_max || null,
        temperature_unit: config.temperature_unit || 'C',
        package_category_id: config.package_category_id || null,
        package_size_id: config.package_size_id || null,
        remarks: config.remarks || null,
      }));

      const { error: cargoError } = await scopedDb
        .from('quote_cargo_configurations')
        .insert(cargoPayload);

      if (cargoError) {
        console.error('[QuoteRepository] Error saving cargo configurations:', cargoError);
        throw cargoError;
      }
    } else {
       await scopedDb.from('quote_cargo_configurations').delete().eq('quote_id', savedId);
    }

    return savedId;
  };

  return { saveQuote };
}

