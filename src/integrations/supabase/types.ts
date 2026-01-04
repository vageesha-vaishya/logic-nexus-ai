export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          annual_revenue: number | null
          billing_address: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          email: string | null
          employee_count: number | null
          franchise_id: string | null
          id: string
          industry: string | null
          name: string
          owner_id: string | null
          parent_account_id: string | null
          phone: string | null
          shipping_address: Json | null
          status: Database["public"]["Enums"]["account_status"] | null
          tenant_id: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          annual_revenue?: number | null
          billing_address?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          employee_count?: number | null
          franchise_id?: string | null
          id?: string
          industry?: string | null
          name: string
          owner_id?: string | null
          parent_account_id?: string | null
          phone?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["account_status"] | null
          tenant_id: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          annual_revenue?: number | null
          billing_address?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          employee_count?: number | null
          franchise_id?: string | null
          id?: string
          industry?: string | null
          name?: string
          owner_id?: string | null
          parent_account_id?: string | null
          phone?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["account_status"] | null
          tenant_id?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          account_id: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          franchise_id: string | null
          id: string
          lead_id: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          status: Database["public"]["Enums"]["activity_status"] | null
          subject: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          status?: Database["public"]["Enums"]["activity_status"] | null
          subject: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          activity_type?: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          status?: Database["public"]["Enums"]["activity_status"] | null
          subject?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aes_hts_codes: {
        Row: {
          category: string
          created_at: string
          description: string
          duty_rate: string | null
          hts_code: string
          id: string
          schedule_b: string | null
          special_provisions: string | null
          sub_category: string | null
          sub_sub_category: string | null
          uom1: string | null
          uom2: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          duty_rate?: string | null
          hts_code: string
          id?: string
          schedule_b?: string | null
          special_provisions?: string | null
          sub_category?: string | null
          sub_sub_category?: string | null
          uom1?: string | null
          uom2?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          duty_rate?: string | null
          hts_code?: string
          id?: string
          schedule_b?: string | null
          special_provisions?: string | null
          sub_category?: string | null
          sub_sub_category?: string | null
          uom1?: string | null
          uom2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      assignment_rules: {
        Row: {
          assignment_method: string
          conditions: Json
          created_at: string | null
          franchise_id: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          rule_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_method: string
          conditions?: Json
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_method?: string
          conditions?: Json
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rules_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_members: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          responded: boolean | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          responded?: boolean | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          responded?: boolean | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          actual_cost: number | null
          budget: number | null
          campaign_type: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          expected_response: number | null
          expected_revenue: number | null
          franchise_id: string | null
          id: string
          name: string
          owner_id: string | null
          start_date: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          budget?: number | null
          campaign_type?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          expected_response?: number | null
          expected_revenue?: number | null
          franchise_id?: string | null
          id?: string
          name: string
          owner_id?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          budget?: number | null
          campaign_type?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          expected_response?: number | null
          expected_revenue?: number | null
          franchise_id?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_details: {
        Row: {
          cargo_type_id: string | null
          commodity_description: string | null
          created_at: string | null
          created_by: string | null
          dimensions_cm: Json | null
          hazmat_class: string | null
          hazmat_un_number: string | null
          hs_code: string | null
          id: string
          is_hazardous: boolean | null
          notes: string | null
          service_id: string | null
          service_type: string | null
          special_requirements: string | null
          temperature_controlled: boolean | null
          temperature_range: Json | null
          tenant_id: string
          updated_at: string | null
          value_amount: number | null
          value_currency: string | null
          volume_cbm: number | null
          weight_kg: number | null
        }
        Insert: {
          cargo_type_id?: string | null
          commodity_description?: string | null
          created_at?: string | null
          created_by?: string | null
          dimensions_cm?: Json | null
          hazmat_class?: string | null
          hazmat_un_number?: string | null
          hs_code?: string | null
          id?: string
          is_hazardous?: boolean | null
          notes?: string | null
          service_id?: string | null
          service_type?: string | null
          special_requirements?: string | null
          temperature_controlled?: boolean | null
          temperature_range?: Json | null
          tenant_id: string
          updated_at?: string | null
          value_amount?: number | null
          value_currency?: string | null
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Update: {
          cargo_type_id?: string | null
          commodity_description?: string | null
          created_at?: string | null
          created_by?: string | null
          dimensions_cm?: Json | null
          hazmat_class?: string | null
          hazmat_un_number?: string | null
          hs_code?: string | null
          id?: string
          is_hazardous?: boolean | null
          notes?: string | null
          service_id?: string | null
          service_type?: string | null
          special_requirements?: string | null
          temperature_controlled?: boolean | null
          temperature_range?: Json | null
          tenant_id?: string
          updated_at?: string | null
          value_amount?: number | null
          value_currency?: string | null
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_details_cargo_type_id_fkey"
            columns: ["cargo_type_id"]
            isOneToOne: false
            referencedRelation: "cargo_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_details_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_details_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_types: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_hazardous: boolean | null
          name: string
          requires_temperature_control: boolean | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_hazardous?: boolean | null
          name: string
          requires_temperature_control?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_hazardous?: boolean | null
          name?: string
          requires_temperature_control?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_rate_charges: {
        Row: {
          amount: number
          basis: string | null
          carrier_rate_id: string
          charge_type: string
          created_at: string | null
          currency: string | null
          id: string
          notes: string | null
          quantity: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          basis?: string | null
          carrier_rate_id: string
          charge_type: string
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          quantity?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          basis?: string | null
          carrier_rate_id?: string
          charge_type?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          quantity?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carrier_rate_charges_carrier_rate_id_fkey"
            columns: ["carrier_rate_id"]
            isOneToOne: false
            referencedRelation: "carrier_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rate_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_rates: {
        Row: {
          base_rate: number
          carrier_id: string | null
          container_size_id: string | null
          container_type_id: string | null
          created_at: string | null
          currency: string | null
          destination_port_id: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          origin_port_id: string | null
          rate_type: string | null
          service_type_id: string | null
          tenant_id: string
          transit_time_days: number | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          base_rate: number
          carrier_id?: string | null
          container_size_id?: string | null
          container_type_id?: string | null
          created_at?: string | null
          currency?: string | null
          destination_port_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          origin_port_id?: string | null
          rate_type?: string | null
          service_type_id?: string | null
          tenant_id: string
          transit_time_days?: number | null
          updated_at?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          base_rate?: number
          carrier_id?: string | null
          container_size_id?: string | null
          container_type_id?: string | null
          created_at?: string | null
          currency?: string | null
          destination_port_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          origin_port_id?: string | null
          rate_type?: string | null
          service_type_id?: string | null
          tenant_id?: string
          transit_time_days?: number | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carrier_rates_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rates_container_size_id_fkey"
            columns: ["container_size_id"]
            isOneToOne: false
            referencedRelation: "container_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rates_container_type_id_fkey"
            columns: ["container_type_id"]
            isOneToOne: false
            referencedRelation: "container_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rates_destination_port_id_fkey"
            columns: ["destination_port_id"]
            isOneToOne: false
            referencedRelation: "ports_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rates_origin_port_id_fkey"
            columns: ["origin_port_id"]
            isOneToOne: false
            referencedRelation: "ports_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rates_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_service_types: {
        Row: {
          carrier_id: string
          code_type: string | null
          code_value: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          service_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          carrier_id: string
          code_type?: string | null
          code_value?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          service_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          carrier_id?: string
          code_type?: string | null
          code_value?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          service_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      carriers: {
        Row: {
          address: Json | null
          carrier_code: string | null
          carrier_name: string
          carrier_type: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          iata: string | null
          id: string
          is_active: boolean | null
          mc_dot: string | null
          mode: string | null
          notes: string | null
          rating: number | null
          scac: string | null
          service_routes: Json | null
          tenant_id: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: Json | null
          carrier_code?: string | null
          carrier_name: string
          carrier_type?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          iata?: string | null
          id?: string
          is_active?: boolean | null
          mc_dot?: string | null
          mode?: string | null
          notes?: string | null
          rating?: number | null
          scac?: string | null
          service_routes?: Json | null
          tenant_id: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: Json | null
          carrier_code?: string | null
          carrier_name?: string
          carrier_type?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          iata?: string | null
          id?: string
          is_active?: boolean | null
          mc_dot?: string | null
          mode?: string | null
          notes?: string | null
          rating?: number | null
          scac?: string | null
          service_routes?: Json | null
          tenant_id?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carriers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_bases: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_bases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_categories: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_sides: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_sides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          code: string | null
          country_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          tenant_id: string | null
        }
        Insert: {
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          tenant_id?: string | null
        }
        Update: {
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_checks: {
        Row: {
          check_details: Json | null
          check_status: string
          checked_at: string | null
          checked_by: string | null
          id: string
          quote_id: string
          rule_id: string | null
        }
        Insert: {
          check_details?: Json | null
          check_status: string
          checked_at?: string | null
          checked_by?: string | null
          id?: string
          quote_id: string
          rule_id?: string | null
        }
        Update: {
          check_details?: Json | null
          check_status?: string
          checked_at?: string | null
          checked_by?: string | null
          id?: string
          quote_id?: string
          rule_id?: string | null
        }
        Relationships: []
      }
      compliance_rules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          regulation_agency: string | null
          required_documents: Json | null
          rule_description: string | null
          rule_name: string
          service_type: string | null
          tenant_id: string
          updated_at: string | null
          validation_criteria: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          regulation_agency?: string | null
          required_documents?: Json | null
          rule_description?: string | null
          rule_name: string
          service_type?: string | null
          tenant_id: string
          updated_at?: string | null
          validation_criteria: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          regulation_agency?: string | null
          required_documents?: Json | null
          rule_description?: string | null
          rule_name?: string
          service_type?: string | null
          tenant_id?: string
          updated_at?: string | null
          validation_criteria?: Json
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consignees: {
        Row: {
          address: Json | null
          company_name: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          customs_id: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          tax_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          company_name: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customs_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          tax_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          company_name?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customs_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          tax_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consignees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string | null
          address: Json | null
          created_at: string | null
          created_by: string | null
          email: string | null
          first_name: string
          franchise_id: string | null
          id: string
          is_primary: boolean | null
          last_name: string
          linkedin_url: string | null
          mobile: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          tenant_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          address?: Json | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name: string
          franchise_id?: string | null
          id?: string
          is_primary?: boolean | null
          last_name: string
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          address?: Json | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name?: string
          franchise_id?: string | null
          id?: string
          is_primary?: boolean | null
          last_name?: string
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      container_sizes: {
        Row: {
          created_at: string | null
          dimensions_cm: Json | null
          id: string
          is_active: boolean | null
          max_volume_cbm: number | null
          max_weight_kg: number | null
          size_feet: string
          tare_weight_kg: number | null
          tenant_id: string | null
          type_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dimensions_cm?: Json | null
          id?: string
          is_active?: boolean | null
          max_volume_cbm?: number | null
          max_weight_kg?: number | null
          size_feet: string
          tare_weight_kg?: number | null
          tenant_id?: string | null
          type_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dimensions_cm?: Json | null
          id?: string
          is_active?: boolean | null
          max_volume_cbm?: number | null
          max_weight_kg?: number | null
          size_feet?: string
          tare_weight_kg?: number | null
          tenant_id?: string | null
          type_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_sizes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_sizes_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "container_types"
            referencedColumns: ["id"]
          },
        ]
      }
      container_types: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      continents: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code_iso2: string | null
          code_iso3: string | null
          code_national: string | null
          continent_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          phone_code: string | null
          tenant_id: string | null
        }
        Insert: {
          code_iso2?: string | null
          code_iso3?: string | null
          code_national?: string | null
          continent_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone_code?: string | null
          tenant_id?: string | null
        }
        Update: {
          code_iso2?: string | null
          code_iso3?: string | null
          code_national?: string | null
          continent_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone_code?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "countries_continent_id_fkey"
            columns: ["continent_id"]
            isOneToOne: false
            referencedRelation: "continents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "countries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          symbol: string | null
          tenant_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          symbol?: string | null
          tenant_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          symbol?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "currencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_role_permissions: {
        Row: {
          access_type: string
          created_at: string | null
          id: string
          permission_key: string
          role_id: string
          updated_at: string | null
        }
        Insert: {
          access_type: string
          created_at?: string | null
          id?: string
          permission_key: string
          role_id: string
          updated_at?: string | null
        }
        Update: {
          access_type?: string
          created_at?: string | null
          id?: string
          permission_key?: string
          role_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          role_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          role_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          role_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_selections: {
        Row: {
          id: string
          quotation_version_id: string
          quotation_version_option_id: string
          quote_id: string
          reason: string | null
          selected_at: string | null
          selected_by: string | null
          tenant_id: string
        }
        Insert: {
          id?: string
          quotation_version_id: string
          quotation_version_option_id: string
          quote_id: string
          reason?: string | null
          selected_at?: string | null
          selected_by?: string | null
          tenant_id: string
        }
        Update: {
          id?: string
          quotation_version_id?: string
          quotation_version_option_id?: string
          quote_id?: string
          reason?: string | null
          selected_at?: string | null
          selected_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_selections_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_selections_quotation_version_option_id_fkey"
            columns: ["quotation_version_option_id"]
            isOneToOne: false
            referencedRelation: "quotation_version_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_selections_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_selections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customs_documents: {
        Row: {
          created_at: string | null
          created_by: string | null
          document_number: string | null
          document_type: string
          document_url: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_authority: string | null
          notes: string | null
          shipment_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          document_number?: string | null
          document_type: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          notes?: string | null
          shipment_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          document_number?: string | null
          document_type?: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          notes?: string | null
          shipment_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          created_at: string | null
          document_type: string
          id: string
          is_active: boolean | null
          required_fields: Json | null
          service_type: string | null
          template_content: string
          template_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          id?: string
          is_active?: boolean | null
          required_fields?: Json | null
          service_type?: string | null
          template_content: string
          template_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          id?: string
          is_active?: boolean | null
          required_fields?: Json | null
          service_type?: string | null
          template_content?: string
          template_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string | null
          auto_sync_enabled: boolean | null
          created_at: string | null
          display_name: string | null
          email_address: string
          franchise_id: string | null
          id: string
          imap_host: string | null
          imap_password: string | null
          imap_port: number | null
          imap_use_ssl: boolean | null
          imap_username: string | null
          is_active: boolean | null
          is_primary: boolean | null
          last_sync_at: string | null
          provider: string
          refresh_token: string | null
          settings: Json | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_use_tls: boolean | null
          smtp_username: string | null
          sync_frequency: number | null
          tenant_id: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          auto_sync_enabled?: boolean | null
          created_at?: string | null
          display_name?: string | null
          email_address: string
          franchise_id?: string | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_use_ssl?: boolean | null
          imap_username?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          last_sync_at?: string | null
          provider: string
          refresh_token?: string | null
          settings?: Json | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_use_tls?: boolean | null
          smtp_username?: string | null
          sync_frequency?: number | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          auto_sync_enabled?: boolean | null
          created_at?: string | null
          display_name?: string | null
          email_address?: string
          franchise_id?: string | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_use_ssl?: boolean | null
          imap_username?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          last_sync_at?: string | null
          provider?: string
          refresh_token?: string | null
          settings?: Json | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_use_tls?: boolean | null
          smtp_username?: string | null
          sync_frequency?: number | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_filters: {
        Row: {
          account_id: string | null
          actions: Json
          conditions: Json
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          actions?: Json
          conditions?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          actions?: Json
          conditions?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_filters_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_filters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_active: boolean | null
          subject: string
          template_name: string
          template_type: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          subject: string
          template_name: string
          template_type?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          subject?: string
          template_name?: string
          template_type?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          account_id: string | null
          attachments: Json | null
          bcc_addresses: Json | null
          body_html: string | null
          body_text: string | null
          cc_addresses: Json | null
          created_at: string | null
          folder: string | null
          franchise_id: string | null
          from_address: string
          id: string
          is_archived: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          labels: Json | null
          message_id: string | null
          metadata: Json | null
          received_at: string | null
          sent_at: string | null
          subject: string | null
          tenant_id: string
          thread_id: string | null
          to_addresses: Json | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          attachments?: Json | null
          bcc_addresses?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: Json | null
          created_at?: string | null
          folder?: string | null
          franchise_id?: string | null
          from_address: string
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          labels?: Json | null
          message_id?: string | null
          metadata?: Json | null
          received_at?: string | null
          sent_at?: string | null
          subject?: string | null
          tenant_id: string
          thread_id?: string | null
          to_addresses?: Json | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          attachments?: Json | null
          bcc_addresses?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: Json | null
          created_at?: string | null
          folder?: string | null
          franchise_id?: string | null
          from_address?: string
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          labels?: Json | null
          message_id?: string | null
          metadata?: Json | null
          received_at?: string | null
          sent_at?: string | null
          subject?: string | null
          tenant_id?: string
          thread_id?: string | null
          to_addresses?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      franchises: {
        Row: {
          address: Json | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "franchises_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          created_at: string
          effective_date: string
          from_currency_id: string
          id: string
          rate: number
          source: string | null
          tenant_id: string
          to_currency_id: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          from_currency_id: string
          id?: string
          rate: number
          source?: string | null
          tenant_id: string
          to_currency_id: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          from_currency_id?: string
          id?: string
          rate?: number
          source?: string | null
          tenant_id?: string
          to_currency_id?: string
        }
        Relationships: []
      }
      history_filter_presets: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          name: string
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json
          id?: string
          name: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "history_filter_presets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      incoterms: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          incoterm_code: string
          incoterm_name: string
          is_active: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          incoterm_code: string
          incoterm_name: string
          is_active?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          incoterm_code?: string
          incoterm_name?: string
          is_active?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incoterms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          franchise_id: string | null
          id: string
          invited_by: string
          role: string
          tenant_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          franchise_id?: string | null
          id?: string
          invited_by: string
          role: string
          tenant_id?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          franchise_id?: string | null
          id?: string
          invited_by?: string
          role?: string
          tenant_id?: string | null
          token?: string
        }
        Relationships: []
      }
      lead_assignment_history: {
        Row: {
          assigned_from: string | null
          assigned_to: string | null
          assignment_method: string
          created_at: string | null
          id: string
          lead_id: string
          reason: string | null
          tenant_id: string
        }
        Insert: {
          assigned_from?: string | null
          assigned_to?: string | null
          assignment_method: string
          created_at?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          tenant_id: string
        }
        Update: {
          assigned_from?: string | null
          assigned_to?: string | null
          assignment_method?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_queue: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          assignment_method: string | null
          created_at: string | null
          error_message: string | null
          franchise_id: string | null
          id: string
          lead_id: string
          retry_count: number | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          assignment_method?: string | null
          created_at?: string | null
          error_message?: string | null
          franchise_id?: string | null
          id?: string
          lead_id: string
          retry_count?: number | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          assignment_method?: string | null
          created_at?: string | null
          error_message?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string
          retry_count?: number | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_queue_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_rules: {
        Row: {
          assigned_to: string | null
          assignment_type: string | null
          created_at: string | null
          criteria: Json
          id: string
          is_active: boolean | null
          max_leads_per_user: number | null
          priority: number | null
          rule_name: string
          tenant_id: string
          territory_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          assignment_type?: string | null
          created_at?: string | null
          criteria: Json
          id?: string
          is_active?: boolean | null
          max_leads_per_user?: number | null
          priority?: number | null
          rule_name: string
          tenant_id: string
          territory_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          assignment_type?: string | null
          created_at?: string | null
          criteria?: Json
          id?: string
          is_active?: boolean | null
          max_leads_per_user?: number | null
          priority?: number | null
          rule_name?: string
          tenant_id?: string
          territory_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_scoring_rules: {
        Row: {
          created_at: string | null
          criteria_type: string
          criteria_value: string
          id: string
          is_active: boolean | null
          score_points: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria_type: string
          criteria_value: string
          id?: string
          is_active?: boolean | null
          score_points: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria_type?: string
          criteria_value?: string
          id?: string
          is_active?: boolean | null
          score_points?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          company: string | null
          conversion_probability: number | null
          converted_account_id: string | null
          converted_at: string | null
          converted_contact_id: string | null
          created_at: string | null
          created_by: string | null
          custom_fields: Json | null
          description: string | null
          email: string | null
          estimated_value: number | null
          expected_close_date: string | null
          first_name: string
          franchise_id: string | null
          id: string
          last_activity_date: string | null
          last_name: string
          lead_score: number | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          qualification_status: string | null
          source: Database["public"]["Enums"]["lead_source"] | null
          status: Database["public"]["Enums"]["lead_status"] | null
          tenant_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          conversion_probability?: number | null
          converted_account_id?: string | null
          converted_at?: string | null
          converted_contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          email?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          first_name: string
          franchise_id?: string | null
          id?: string
          last_activity_date?: string | null
          last_name: string
          lead_score?: number | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          qualification_status?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          conversion_probability?: number | null
          converted_account_id?: string | null
          converted_at?: string | null
          converted_contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          email?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          first_name?: string
          franchise_id?: string | null
          id?: string
          last_activity_date?: string | null
          last_name?: string
          lead_score?: number | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          qualification_status?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_account_id_fkey"
            columns: ["converted_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_contact_id_fkey"
            columns: ["converted_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_methods: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      margin_profiles: {
        Row: {
          created_at: string
          default_method_id: string
          default_value: number
          id: string
          is_active: boolean
          min_margin: number | null
          rounding_rule: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          default_method_id: string
          default_value: number
          id?: string
          is_active?: boolean
          min_margin?: number | null
          rounding_rule?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          default_method_id?: string
          default_value?: number
          id?: string
          is_active?: boolean
          min_margin?: number | null
          rounding_rule?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "margin_profiles_default_method_id_fkey"
            columns: ["default_method_id"]
            isOneToOne: false
            referencedRelation: "margin_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          tenant_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          tenant_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          tenant_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_configurations: {
        Row: {
          client_id: string
          client_secret: string
          created_at: string | null
          id: string
          is_active: boolean | null
          provider: string
          redirect_uri: string
          scopes: Json | null
          tenant_id: string | null
          tenant_id_provider: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          client_secret: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider: string
          redirect_uri: string
          scopes?: Json | null
          tenant_id?: string | null
          tenant_id_provider?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider?: string
          redirect_uri?: string
          scopes?: Json | null
          tenant_id?: string | null
          tenant_id_provider?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          account_id: string | null
          amount: number | null
          close_date: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          franchise_id: string | null
          id: string
          lead_id: string | null
          loss_reason: string | null
          name: string
          next_step: string | null
          notes: string | null
          owner_id: string | null
          probability: number | null
          stage: Database["public"]["Enums"]["opportunity_stage"]
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          close_date?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string | null
          loss_reason?: string | null
          name: string
          next_step?: string | null
          notes?: string | null
          owner_id?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          close_date?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string | null
          loss_reason?: string | null
          name?: string
          next_step?: string | null
          notes?: string | null
          owner_id?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_line_items: {
        Row: {
          created_at: string | null
          description: string | null
          discount_percent: number | null
          id: string
          line_total: number | null
          opportunity_id: string
          product_code: string | null
          product_name: string | null
          quantity: number | null
          service_id: string | null
          sort_order: number | null
          tax_percent: number | null
          tenant_id: string
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string
          line_total?: number | null
          opportunity_id: string
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          service_id?: string | null
          sort_order?: number | null
          tax_percent?: number | null
          tenant_id: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string
          line_total?: number | null
          opportunity_id?: string
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          service_id?: string | null
          sort_order?: number | null
          tax_percent?: number | null
          tenant_id?: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_line_items_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_line_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_line_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_probability_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_probability: number | null
          new_stage: Database["public"]["Enums"]["opportunity_stage"] | null
          old_probability: number | null
          old_stage: Database["public"]["Enums"]["opportunity_stage"] | null
          opportunity_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_probability?: number | null
          new_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          old_probability?: number | null
          old_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          opportunity_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_probability?: number | null
          new_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          old_probability?: number | null
          old_stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_probability_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      package_categories: {
        Row: {
          category_code: string | null
          category_name: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          category_code?: string | null
          category_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category_code?: string | null
          category_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      package_sizes: {
        Row: {
          created_at: string | null
          description: string | null
          height_ft: number | null
          id: string
          is_active: boolean | null
          length_ft: number | null
          max_weight_kg: number | null
          size_code: string | null
          size_name: string
          tenant_id: string | null
          updated_at: string | null
          width_ft: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          height_ft?: number | null
          id?: string
          is_active?: boolean | null
          length_ft?: number | null
          max_weight_kg?: number | null
          size_code?: string | null
          size_name: string
          tenant_id?: string | null
          updated_at?: string | null
          width_ft?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          height_ft?: number | null
          id?: string
          is_active?: boolean | null
          length_ft?: number | null
          max_weight_kg?: number | null
          size_code?: string | null
          size_name?: string
          tenant_id?: string | null
          updated_at?: string | null
          width_ft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "package_sizes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ports_locations: {
        Row: {
          city_id: string | null
          code: string | null
          country_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          port_type: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          city_id?: string | null
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          port_type?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          city_id?: string | null
          code?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          port_type?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ports_locations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ports_locations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ports_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          must_change_password: boolean | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_name?: string | null
          must_change_password?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          must_change_password?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      provider_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      quotation_audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          quotation_version_id: string | null
          quotation_version_option_id: string | null
          quote_id: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          quotation_version_id?: string | null
          quotation_version_option_id?: string | null
          quote_id?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          quotation_version_id?: string | null
          quotation_version_option_id?: string | null
          quote_id?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_audit_log_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_audit_log_quotation_version_option_id_fkey"
            columns: ["quotation_version_option_id"]
            isOneToOne: false
            referencedRelation: "quotation_version_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_audit_log_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_packages: {
        Row: {
          created_at: string | null
          description: string | null
          height_cm: number | null
          id: string
          length_cm: number | null
          package_type: string
          quantity: number
          quote_id: string
          tenant_id: string
          updated_at: string | null
          volume_cbm: number | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          package_type: string
          quantity?: number
          quote_id: string
          tenant_id: string
          updated_at?: string | null
          volume_cbm?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          package_type?: string
          quantity?: number
          quote_id?: string
          tenant_id?: string
          updated_at?: string | null
          volume_cbm?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      quotation_version_option_legs: {
        Row: {
          created_at: string
          destination_location: string | null
          id: string
          leg_order: number
          mode_id: string | null
          origin_location: string | null
          planned_arrival: string | null
          planned_departure: string | null
          provider_id: string | null
          quotation_version_option_id: string
          service_id: string | null
          service_type_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          destination_location?: string | null
          id?: string
          leg_order?: number
          mode_id?: string | null
          origin_location?: string | null
          planned_arrival?: string | null
          planned_departure?: string | null
          provider_id?: string | null
          quotation_version_option_id: string
          service_id?: string | null
          service_type_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          destination_location?: string | null
          id?: string
          leg_order?: number
          mode_id?: string | null
          origin_location?: string | null
          planned_arrival?: string | null
          planned_departure?: string | null
          provider_id?: string | null
          quotation_version_option_id?: string
          service_id?: string | null
          service_type_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      quotation_version_options: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_recommended: boolean | null
          option_name: string
          option_number: number
          quotation_version_id: string
          tenant_id: string
          total_amount: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_recommended?: boolean | null
          option_name: string
          option_number: number
          quotation_version_id: string
          tenant_id: string
          total_amount?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_recommended?: boolean | null
          option_name?: string
          option_number?: number
          quotation_version_id?: string
          tenant_id?: string
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_version_options_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          quote_id: string
          tenant_id: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          quote_id: string
          tenant_id: string
          version_number: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          quote_id?: string
          tenant_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_charges: {
        Row: {
          amount: number | null
          basis_id: string | null
          category_id: string | null
          charge_side_id: string | null
          created_at: string | null
          currency_id: string | null
          id: string
          leg_id: string | null
          note: string | null
          quantity: number | null
          quote_option_id: string
          rate: number | null
          sort_order: number | null
          tenant_id: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          basis_id?: string | null
          category_id?: string | null
          charge_side_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          id?: string
          leg_id?: string | null
          note?: string | null
          quantity?: number | null
          quote_option_id: string
          rate?: number | null
          sort_order?: number | null
          tenant_id: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          basis_id?: string | null
          category_id?: string | null
          charge_side_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          id?: string
          leg_id?: string | null
          note?: string | null
          quantity?: number | null
          quote_option_id?: string
          rate?: number | null
          sort_order?: number | null
          tenant_id?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_charges_basis_id_fkey"
            columns: ["basis_id"]
            isOneToOne: false
            referencedRelation: "charge_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_charges_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "charge_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_charges_charge_side_id_fkey"
            columns: ["charge_side_id"]
            isOneToOne: false
            referencedRelation: "charge_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_charges_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_charges_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "quote_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_charges_quote_option_id_fkey"
            columns: ["quote_option_id"]
            isOneToOne: false
            referencedRelation: "quotation_version_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_documents: {
        Row: {
          document_data: Json | null
          document_type: string
          document_url: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          quote_id: string
        }
        Insert: {
          document_data?: Json | null
          document_type: string
          document_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          quote_id: string
        }
        Update: {
          document_data?: Json | null
          document_type?: string
          document_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          quote_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          cargo_type_id: string | null
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          line_number: number
          line_total: number
          package_category_id: string | null
          package_size_id: string | null
          product_name: string
          quantity: number
          quote_id: string
          service_type_id: string | null
          special_instructions: string | null
          tax_amount: number | null
          tax_percent: number | null
          unit_price: number
          updated_at: string | null
          volume_cbm: number | null
          weight_kg: number | null
        }
        Insert: {
          cargo_type_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          line_number: number
          line_total?: number
          package_category_id?: string | null
          package_size_id?: string | null
          product_name: string
          quantity?: number
          quote_id: string
          service_type_id?: string | null
          special_instructions?: string | null
          tax_amount?: number | null
          tax_percent?: number | null
          unit_price?: number
          updated_at?: string | null
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Update: {
          cargo_type_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          line_number?: number
          line_total?: number
          package_category_id?: string | null
          package_size_id?: string | null
          product_name?: string
          quantity?: number
          quote_id?: string
          service_type_id?: string | null
          special_instructions?: string | null
          tax_amount?: number | null
          tax_percent?: number | null
          unit_price?: number
          updated_at?: string | null
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      quote_legs: {
        Row: {
          carrier_id: string | null
          created_at: string | null
          destination_location_id: string | null
          estimated_duration_days: number | null
          id: string
          leg_number: number
          notes: string | null
          origin_location_id: string | null
          quote_option_id: string
          service_type: string | null
          tenant_id: string
        }
        Insert: {
          carrier_id?: string | null
          created_at?: string | null
          destination_location_id?: string | null
          estimated_duration_days?: number | null
          id?: string
          leg_number: number
          notes?: string | null
          origin_location_id?: string | null
          quote_option_id: string
          service_type?: string | null
          tenant_id: string
        }
        Update: {
          carrier_id?: string | null
          created_at?: string | null
          destination_location_id?: string | null
          estimated_duration_days?: number | null
          id?: string
          leg_number?: number
          notes?: string | null
          origin_location_id?: string | null
          quote_option_id?: string
          service_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_legs_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_legs_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "ports_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_legs_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "ports_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_legs_quote_option_id_fkey"
            columns: ["quote_option_id"]
            isOneToOne: false
            referencedRelation: "quotation_version_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_legs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_number_config_franchise: {
        Row: {
          created_at: string | null
          franchise_id: string
          id: string
          prefix: string
          reset_policy: Database["public"]["Enums"]["quote_reset_policy"]
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          franchise_id: string
          id?: string
          prefix?: string
          reset_policy?: Database["public"]["Enums"]["quote_reset_policy"]
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          franchise_id?: string
          id?: string
          prefix?: string
          reset_policy?: Database["public"]["Enums"]["quote_reset_policy"]
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_number_config_franchise_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_number_config_franchise_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_number_config_tenant: {
        Row: {
          created_at: string | null
          id: string
          prefix: string
          reset_policy: Database["public"]["Enums"]["quote_reset_policy"]
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prefix?: string
          reset_policy?: Database["public"]["Enums"]["quote_reset_policy"]
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          prefix?: string
          reset_policy?: Database["public"]["Enums"]["quote_reset_policy"]
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_number_config_tenant_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_number_sequences: {
        Row: {
          created_at: string | null
          franchise_id: string | null
          id: string
          last_sequence: number
          period_key: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          last_sequence?: number
          period_key: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          last_sequence?: number
          period_key?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_number_sequences_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_number_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_packages: {
        Row: {
          created_at: string | null
          description: string | null
          dimensions_cm: Json | null
          id: string
          package_type_id: string | null
          quantity: number | null
          quote_id: string
          tenant_id: string
          volume_cbm: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          dimensions_cm?: Json | null
          id?: string
          package_type_id?: string | null
          quantity?: number | null
          quote_id: string
          tenant_id: string
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          dimensions_cm?: Json | null
          id?: string
          package_type_id?: string | null
          quantity?: number | null
          quote_id?: string
          tenant_id?: string
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_packages_package_type_id_fkey"
            columns: ["package_type_id"]
            isOneToOne: false
            referencedRelation: "package_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_packages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          account_id: string | null
          additional_costs: Json | null
          billing_address: Json | null
          cargo_details: Json | null
          carrier_id: string | null
          compliance_status: string | null
          consignee_id: string | null
          contact_id: string | null
          cost_price: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          destination_location: Json | null
          destination_port_id: string | null
          discount_amount: number | null
          discount_percent: number | null
          franchise_id: string | null
          id: string
          incoterm_id: string | null
          incoterms: string | null
          margin_amount: number | null
          margin_percentage: number | null
          notes: string | null
          opportunity_id: string | null
          origin_location: Json | null
          origin_port_id: string | null
          owner_id: string | null
          payment_terms: string | null
          quote_number: string
          regulatory_data: Json | null
          rejected_at: string | null
          sell_price: number | null
          service_id: string | null
          service_type_id: string | null
          shipping_address: Json | null
          shipping_amount: number | null
          special_handling: Json | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          tax_percent: number | null
          tenant_id: string
          terms_conditions: string | null
          title: string
          total_amount: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          account_id?: string | null
          additional_costs?: Json | null
          billing_address?: Json | null
          cargo_details?: Json | null
          carrier_id?: string | null
          compliance_status?: string | null
          consignee_id?: string | null
          contact_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          destination_location?: Json | null
          destination_port_id?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          franchise_id?: string | null
          id?: string
          incoterm_id?: string | null
          incoterms?: string | null
          margin_amount?: number | null
          margin_percentage?: number | null
          notes?: string | null
          opportunity_id?: string | null
          origin_location?: Json | null
          origin_port_id?: string | null
          owner_id?: string | null
          payment_terms?: string | null
          quote_number: string
          regulatory_data?: Json | null
          rejected_at?: string | null
          sell_price?: number | null
          service_id?: string | null
          service_type_id?: string | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          special_handling?: Json | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          tenant_id: string
          terms_conditions?: string | null
          title: string
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          account_id?: string | null
          additional_costs?: Json | null
          billing_address?: Json | null
          cargo_details?: Json | null
          carrier_id?: string | null
          compliance_status?: string | null
          consignee_id?: string | null
          contact_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          destination_location?: Json | null
          destination_port_id?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          franchise_id?: string | null
          id?: string
          incoterm_id?: string | null
          incoterms?: string | null
          margin_amount?: number | null
          margin_percentage?: number | null
          notes?: string | null
          opportunity_id?: string | null
          origin_location?: Json | null
          origin_port_id?: string | null
          owner_id?: string | null
          payment_terms?: string | null
          quote_number?: string
          regulatory_data?: Json | null
          rejected_at?: string | null
          sell_price?: number | null
          service_id?: string | null
          service_type_id?: string | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          special_handling?: Json | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          tenant_id?: string
          terms_conditions?: string | null
          title?: string
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_consignee_id_fkey"
            columns: ["consignee_id"]
            isOneToOne: false
            referencedRelation: "consignees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_destination_port_id_fkey"
            columns: ["destination_port_id"]
            isOneToOne: false
            referencedRelation: "ports_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_incoterm_id_fkey"
            columns: ["incoterm_id"]
            isOneToOne: false
            referencedRelation: "incoterms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_origin_port_id_fkey"
            columns: ["origin_port_id"]
            isOneToOne: false
            referencedRelation: "ports_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_calculations: {
        Row: {
          applied_discounts: Json | null
          applied_surcharges: Json | null
          calculated_at: string | null
          calculated_by: string | null
          calculation_breakdown: Json
          carrier_rate_id: string | null
          final_rate: number
          id: string
          quote_id: string
          service_id: string | null
        }
        Insert: {
          applied_discounts?: Json | null
          applied_surcharges?: Json | null
          calculated_at?: string | null
          calculated_by?: string | null
          calculation_breakdown: Json
          carrier_rate_id?: string | null
          final_rate: number
          id?: string
          quote_id: string
          service_id?: string | null
        }
        Update: {
          applied_discounts?: Json | null
          applied_surcharges?: Json | null
          calculated_at?: string | null
          calculated_by?: string | null
          calculation_breakdown?: Json
          carrier_rate_id?: string | null
          final_rate?: number
          id?: string
          quote_id?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_calculations_carrier_rate_id_fkey"
            columns: ["carrier_rate_id"]
            isOneToOne: false
            referencedRelation: "carrier_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_calculations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_calculations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string | null
          destination_warehouse_id: string | null
          distance_km: number | null
          estimated_duration_hours: number | null
          franchise_id: string | null
          id: string
          is_active: boolean | null
          origin_warehouse_id: string | null
          route_code: string
          route_name: string
          tenant_id: string
          updated_at: string | null
          waypoints: Json | null
        }
        Insert: {
          created_at?: string | null
          destination_warehouse_id?: string | null
          distance_km?: number | null
          estimated_duration_hours?: number | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          origin_warehouse_id?: string | null
          route_code: string
          route_name: string
          tenant_id: string
          updated_at?: string | null
          waypoints?: Json | null
        }
        Update: {
          created_at?: string | null
          destination_warehouse_id?: string | null
          distance_km?: number | null
          estimated_duration_hours?: number | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          origin_warehouse_id?: string | null
          route_code?: string
          route_name?: string
          tenant_id?: string
          updated_at?: string | null
          waypoints?: Json | null
        }
        Relationships: []
      }
      service_modes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      service_type_mappings: {
        Row: {
          created_at: string | null
          external_code: string
          external_system: string
          id: string
          is_active: boolean | null
          service_type_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_code: string
          external_system: string
          id?: string
          is_active?: boolean | null
          service_type_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_code?: string
          external_system?: string
          id?: string
          is_active?: boolean | null
          service_type_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_type_mappings_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_type_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          category: string | null
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          pricing_unit: string | null
          service_code: string
          service_name: string
          service_type: string
          service_type_id: string | null
          tenant_id: string
          transit_time_days: number | null
          updated_at: string | null
        }
        Insert: {
          base_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          pricing_unit?: string | null
          service_code: string
          service_name: string
          service_type: string
          service_type_id?: string | null
          tenant_id: string
          transit_time_days?: number | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          pricing_unit?: string | null
          service_code?: string
          service_name?: string
          service_type?: string
          service_type_id?: string | null
          tenant_id?: string
          transit_time_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string
          dimensions: Json | null
          hazard_class: string | null
          hs_code: string | null
          id: string
          is_hazardous: boolean | null
          item_number: number
          package_type: string | null
          quantity: number
          shipment_id: string
          special_handling: string | null
          updated_at: string | null
          value: number | null
          volume_cbm: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description: string
          dimensions?: Json | null
          hazard_class?: string | null
          hs_code?: string | null
          id?: string
          is_hazardous?: boolean | null
          item_number: number
          package_type?: string | null
          quantity?: number
          shipment_id: string
          special_handling?: string | null
          updated_at?: string | null
          value?: number | null
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string
          dimensions?: Json | null
          hazard_class?: string | null
          hs_code?: string | null
          id?: string
          is_hazardous?: boolean | null
          item_number?: number
          package_type?: string | null
          quantity?: number
          shipment_id?: string
          special_handling?: string | null
          updated_at?: string | null
          value?: number | null
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          actual_delivery: string | null
          carrier_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          delivery_date: string | null
          destination_location: Json | null
          destination_warehouse_id: string | null
          estimated_delivery: string | null
          franchise_id: string | null
          id: string
          notes: string | null
          origin_location: Json | null
          origin_warehouse_id: string | null
          owner_id: string | null
          pickup_date: string | null
          quote_id: string | null
          shipment_number: string
          shipment_type: Database["public"]["Enums"]["shipment_type"]
          status: string | null
          tenant_id: string
          total_cost: number | null
          total_volume_cbm: number | null
          total_weight_kg: number | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          actual_delivery?: string | null
          carrier_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_date?: string | null
          destination_location?: Json | null
          destination_warehouse_id?: string | null
          estimated_delivery?: string | null
          franchise_id?: string | null
          id?: string
          notes?: string | null
          origin_location?: Json | null
          origin_warehouse_id?: string | null
          owner_id?: string | null
          pickup_date?: string | null
          quote_id?: string | null
          shipment_number: string
          shipment_type: Database["public"]["Enums"]["shipment_type"]
          status?: string | null
          tenant_id: string
          total_cost?: number | null
          total_volume_cbm?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          actual_delivery?: string | null
          carrier_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_date?: string | null
          destination_location?: Json | null
          destination_warehouse_id?: string | null
          estimated_delivery?: string | null
          franchise_id?: string | null
          id?: string
          notes?: string | null
          origin_location?: Json | null
          origin_warehouse_id?: string | null
          owner_id?: string | null
          pickup_date?: string | null
          quote_id?: string | null
          shipment_number?: string
          shipment_type?: Database["public"]["Enums"]["shipment_type"]
          status?: string | null
          tenant_id?: string
          total_cost?: number | null
          total_volume_cbm?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_origin_warehouse_id_fkey"
            columns: ["origin_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          base_rate: number | null
          created_at: string | null
          currency: string | null
          destination_country: string | null
          destination_zone: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          max_weight_kg: number | null
          min_weight_kg: number | null
          origin_country: string | null
          origin_zone: string | null
          rate_per_kg: number | null
          service_level: string | null
          shipment_type: Database["public"]["Enums"]["shipment_type"]
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          base_rate?: number | null
          created_at?: string | null
          currency?: string | null
          destination_country?: string | null
          destination_zone?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          max_weight_kg?: number | null
          min_weight_kg?: number | null
          origin_country?: string | null
          origin_zone?: string | null
          rate_per_kg?: number | null
          service_level?: string | null
          shipment_type: Database["public"]["Enums"]["shipment_type"]
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          base_rate?: number | null
          created_at?: string | null
          currency?: string | null
          destination_country?: string | null
          destination_zone?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          max_weight_kg?: number | null
          min_weight_kg?: number | null
          origin_country?: string | null
          origin_zone?: string | null
          rate_per_kg?: number | null
          service_level?: string | null
          shipment_type?: Database["public"]["Enums"]["shipment_type"]
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          code_iso: string | null
          code_national: string | null
          country_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
        }
        Insert: {
          code_iso?: string | null
          code_national?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
        }
        Update: {
          code_iso?: string | null
          code_national?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      subscription_features: {
        Row: {
          created_at: string | null
          description: string | null
          feature_category: string
          feature_key: string
          feature_name: string
          id: string
          is_usage_based: boolean
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feature_category: string
          feature_key: string
          feature_name: string
          id?: string
          is_usage_based?: boolean
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feature_category?: string
          feature_key?: string
          feature_name?: string
          id?: string
          is_usage_based?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_invoices: {
        Row: {
          amount_due: number
          amount_paid: number | null
          billing_reason: string | null
          created_at: string | null
          currency: string
          due_date: string | null
          id: string
          invoice_number: string | null
          invoice_pdf_url: string | null
          metadata: Json | null
          paid_at: string | null
          status: string
          stripe_invoice_id: string | null
          subscription_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          billing_reason?: string | null
          created_at?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          metadata?: Json | null
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          billing_reason?: string | null
          created_at?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          metadata?: Json | null
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          limits: Json | null
          plan_name: string
          plan_type: string
          price_monthly: number | null
          price_yearly: number | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          plan_name: string
          plan_type: string
          price_monthly?: number | null
          price_yearly?: number | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          plan_name?: string
          plan_type?: string
          price_monthly?: number | null
          price_yearly?: number | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          setting_key: string
          setting_type: string | null
          setting_value: Json
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          setting_key: string
          setting_type?: string | null
          setting_value: Json
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          setting_key?: string
          setting_type?: string | null
          setting_value?: Json
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          cancel_at: string | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          plan_id: string
          status: string
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cancel_at?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          plan_id: string
          status?: string
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cancel_at?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string
          status?: string
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          domain: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      territory_assignments: {
        Row: {
          created_at: string | null
          franchise_id: string | null
          id: string
          is_active: boolean | null
          tenant_id: string
          territory_data: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id: string
          territory_data?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string
          territory_data?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_assignments_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_status: string
          event_timestamp: string
          event_type: string
          id: string
          location: Json | null
          notes: string | null
          shipment_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_status: string
          event_timestamp: string
          event_type: string
          id?: string
          location?: Json | null
          notes?: string | null
          shipment_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_status?: string
          event_timestamp?: string
          event_type?: string
          id?: string
          location?: Json | null
          notes?: string | null
          shipment_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ui_themes: {
        Row: {
          created_at: string
          franchise_id: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          scope: string
          tenant_id: string | null
          tokens: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          franchise_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          scope: string
          tenant_id?: string | null
          tokens: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          franchise_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          scope?: string
          tenant_id?: string | null
          tokens?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ui_themes_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ui_themes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          created_at: string | null
          feature_key: string
          id: string
          limit_count: number | null
          period_end: string
          period_start: string
          tenant_id: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          feature_key: string
          id?: string
          limit_count?: number | null
          period_end: string
          period_start: string
          tenant_id: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          feature_key?: string
          id?: string
          limit_count?: number | null
          period_end?: string
          period_start?: string
          tenant_id?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_capacity: {
        Row: {
          created_at: string | null
          current_leads: number | null
          franchise_id: string | null
          id: string
          is_available: boolean | null
          last_assigned_at: string | null
          max_leads: number | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_leads?: number | null
          franchise_id?: string | null
          id?: string
          is_available?: boolean | null
          last_assigned_at?: string | null
          max_leads?: number | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_leads?: number | null
          franchise_id?: string | null
          id?: string
          is_available?: boolean | null
          last_assigned_at?: string | null
          max_leads?: number | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_capacity_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_capacity_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          franchise_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity_cbm: number | null
          capacity_kg: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          make: string | null
          model: string | null
          tenant_id: string
          updated_at: string | null
          vehicle_number: string
          vehicle_type: string | null
          year: number | null
        }
        Insert: {
          capacity_cbm?: number | null
          capacity_kg?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          make?: string | null
          model?: string | null
          tenant_id: string
          updated_at?: string | null
          vehicle_number: string
          vehicle_type?: string | null
          year?: number | null
        }
        Update: {
          capacity_cbm?: number | null
          capacity_kg?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          make?: string | null
          model?: string | null
          tenant_id?: string
          updated_at?: string | null
          vehicle_number?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: Json | null
          capacity_cbm: number | null
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          manager_email: string | null
          manager_name: string | null
          manager_phone: string | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          capacity_cbm?: number | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          capacity_cbm?: number | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_lead_score: { Args: { lead_id: string }; Returns: number }
      cleanup_old_logs: { Args: { days_to_keep?: number }; Returns: undefined }
      decrement_user_lead_count: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      generate_quote_number: {
        Args: { p_franchise_id?: string; p_tenant_id: string }
        Returns: string
      }
      get_user_custom_permissions: {
        Args: { check_user_id: string }
        Returns: {
          access_type: string
          permission_key: string
        }[]
      }
      get_user_franchise_id: {
        Args: { check_user_id: string }
        Returns: string
      }
      get_user_tenant_id: { Args: { check_user_id: string }; Returns: string }
      has_role: {
        Args: {
          check_role: Database["public"]["Enums"]["app_role"]
          check_user_id: string
        }
        Returns: boolean
      }
      increment_user_lead_count: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      is_platform_admin: { Args: { check_user_id: string }; Returns: boolean }
      tenant_has_feature: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "active" | "inactive" | "suspended" | "pending"
      account_type:
        | "prospect"
        | "customer"
        | "partner"
        | "competitor"
        | "other"
        | "vendor"
      activity_status: "planned" | "in_progress" | "completed" | "cancelled"
      activity_type: "call" | "meeting" | "email" | "task" | "other" | "note"
      app_role: "platform_admin" | "tenant_admin" | "franchise_admin" | "user"
      billing_period: "monthly" | "annual"
      container_type:
        | "20ft_standard"
        | "40ft_standard"
        | "40ft_high_cube"
        | "45ft_high_cube"
        | "reefer"
        | "open_top"
        | "flat_rack"
        | "tank"
      lead_source:
        | "website"
        | "referral"
        | "campaign"
        | "event"
        | "cold_call"
        | "partner"
        | "other"
        | "email"
        | "phone"
        | "social"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "converted"
        | "lost"
        | "won"
      opportunity_stage:
        | "prospecting"
        | "qualification"
        | "proposal"
        | "negotiation"
        | "closed_won"
        | "closed_lost"
        | "needs_analysis"
        | "value_proposition"
      plan_type: "crm_base" | "service_addon" | "bundle"
      priority_level: "low" | "medium" | "high" | "urgent"
      quote_reset_policy: "none" | "daily" | "monthly" | "yearly"
      shipment_status:
        | "draft"
        | "confirmed"
        | "in_transit"
        | "customs"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "on_hold"
        | "returned"
      shipment_type:
        | "air"
        | "ocean"
        | "ground"
        | "rail"
        | "courier"
        | "ocean_freight"
        | "air_freight"
        | "inland_trucking"
        | "railway_transport"
        | "movers_packers"
      subscription_status:
        | "active"
        | "trial"
        | "past_due"
        | "canceled"
        | "expired"
      subscription_tier:
        | "free"
        | "basic"
        | "professional"
        | "enterprise"
        | "starter"
        | "business"
      tracking_event_type:
        | "created"
        | "confirmed"
        | "picked_up"
        | "in_transit"
        | "customs_clearance"
        | "customs_released"
        | "arrived_at_hub"
        | "out_for_delivery"
        | "delivered"
        | "delayed"
        | "exception"
        | "returned"
      vehicle_status: "available" | "in_use" | "maintenance" | "out_of_service"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "inactive", "suspended", "pending"],
      account_type: [
        "prospect",
        "customer",
        "partner",
        "competitor",
        "other",
        "vendor",
      ],
      activity_status: ["planned", "in_progress", "completed", "cancelled"],
      activity_type: ["call", "meeting", "email", "task", "other", "note"],
      app_role: ["platform_admin", "tenant_admin", "franchise_admin", "user"],
      billing_period: ["monthly", "annual"],
      container_type: [
        "20ft_standard",
        "40ft_standard",
        "40ft_high_cube",
        "45ft_high_cube",
        "reefer",
        "open_top",
        "flat_rack",
        "tank",
      ],
      lead_source: [
        "website",
        "referral",
        "campaign",
        "event",
        "cold_call",
        "partner",
        "other",
        "email",
        "phone",
        "social",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "negotiation",
        "converted",
        "lost",
        "won",
      ],
      opportunity_stage: [
        "prospecting",
        "qualification",
        "proposal",
        "negotiation",
        "closed_won",
        "closed_lost",
        "needs_analysis",
        "value_proposition",
      ],
      plan_type: ["crm_base", "service_addon", "bundle"],
      priority_level: ["low", "medium", "high", "urgent"],
      quote_reset_policy: ["none", "daily", "monthly", "yearly"],
      shipment_status: [
        "draft",
        "confirmed",
        "in_transit",
        "customs",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "on_hold",
        "returned",
      ],
      shipment_type: [
        "air",
        "ocean",
        "ground",
        "rail",
        "courier",
        "ocean_freight",
        "air_freight",
        "inland_trucking",
        "railway_transport",
        "movers_packers",
      ],
      subscription_status: [
        "active",
        "trial",
        "past_due",
        "canceled",
        "expired",
      ],
      subscription_tier: [
        "free",
        "basic",
        "professional",
        "enterprise",
        "starter",
        "business",
      ],
      tracking_event_type: [
        "created",
        "confirmed",
        "picked_up",
        "in_transit",
        "customs_clearance",
        "customs_released",
        "arrived_at_hub",
        "out_for_delivery",
        "delivered",
        "delayed",
        "exception",
        "returned",
      ],
      vehicle_status: ["available", "in_use", "maintenance", "out_of_service"],
    },
  },
} as const
