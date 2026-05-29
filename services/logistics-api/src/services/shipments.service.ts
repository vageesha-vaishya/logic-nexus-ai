// Phase 5 logistics-api — shipments CRUD against public.shipments
// (canonical write target until Phase 9-style drops; the
// logistics.shipments mirror stays current via the dual-write trigger
// from Phase 5 Logistics Step 1). status=delivered transitions still
// fire the core.emit_shipment_delivered() outbox trigger; this service
// doesn't need to emit logistics.shipment.delivered redundantly.

import { createClient } from '@supabase/supabase-js';
import { CreateShipmentRequest, ShipmentRecord, UpdateShipmentRequest } from '../types/logistics.types.js';

export class ShipmentsService {
  private getClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw this.toServiceError(
        500,
        'MISSING_ENV',
        'Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY',
      );
    }
    return createClient(supabaseUrl, supabaseServiceKey);
  }

  async listShipments(tenantId: string, franchiseId?: string | null): Promise<ShipmentRecord[]> {
    const supabase = this.getClient();
    let query = supabase.from('shipments').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (franchiseId) query = query.eq('franchise_id', franchiseId);
    const { data, error } = await query;
    if (error) throw this.toServiceError(500, 'SHIPMENTS_FETCH_FAILED', error.message);
    return (data as ShipmentRecord[]) || [];
  }

  async getShipment(tenantId: string, id: string, franchiseId?: string | null): Promise<ShipmentRecord> {
    const supabase = this.getClient();
    let query = supabase.from('shipments').select('*').eq('tenant_id', tenantId).eq('id', id);
    if (franchiseId) query = query.eq('franchise_id', franchiseId);
    const { data, error } = await query.maybeSingle();
    if (error) throw this.toServiceError(500, 'SHIPMENT_FETCH_FAILED', error.message);
    if (!data) throw this.toServiceError(404, 'SHIPMENT_NOT_FOUND', `Shipment ${id} not found`);
    return data as ShipmentRecord;
  }

  async createShipment(
    tenantId: string,
    userId: string,
    payload: CreateShipmentRequest,
    franchiseId?: string | null,
  ): Promise<ShipmentRecord> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('shipments')
      .insert({
        ...payload,
        tenant_id: tenantId,
        franchise_id: franchiseId ?? payload.metadata?.['franchise_id'] ?? null,
        created_by: userId,
        // shipment_number is NOT NULL on public.shipments; generate one
        // if the caller didn't supply.
        shipment_number: payload.shipment_number || `SHP-${Date.now()}`,
        status: payload.status ?? 'draft',
      })
      .select('*')
      .single();
    if (error) throw this.toServiceError(500, 'SHIPMENT_CREATE_FAILED', error.message);
    return data as ShipmentRecord;
  }

  async updateShipment(
    tenantId: string,
    id: string,
    payload: UpdateShipmentRequest,
    franchiseId?: string | null,
  ): Promise<ShipmentRecord> {
    const supabase = this.getClient();
    let query = supabase.from('shipments').update(payload).eq('tenant_id', tenantId).eq('id', id);
    if (franchiseId) query = query.eq('franchise_id', franchiseId);
    const { data, error } = await query.select('*').maybeSingle();
    if (error) throw this.toServiceError(500, 'SHIPMENT_UPDATE_FAILED', error.message);
    if (!data) throw this.toServiceError(404, 'SHIPMENT_NOT_FOUND', `Shipment ${id} not found`);
    return data as ShipmentRecord;
  }

  async deleteShipment(tenantId: string, id: string, franchiseId?: string | null): Promise<boolean> {
    const supabase = this.getClient();
    let query = supabase.from('shipments').delete().eq('tenant_id', tenantId).eq('id', id);
    if (franchiseId) query = query.eq('franchise_id', franchiseId);
    const { error, data } = await query.select('id');
    if (error) throw this.toServiceError(500, 'SHIPMENT_DELETE_FAILED', error.message);
    return Array.isArray(data) && data.length > 0;
  }

  private toServiceError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
    const err = new Error(message) as Error & { statusCode: number; code: string };
    err.statusCode = statusCode;
    err.code = code;
    return err;
  }
}
