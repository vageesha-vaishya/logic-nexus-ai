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
    PostgrestVersion: "14.1"
  }
  finance: {
    Tables: {
      tax_jurisdictions: {
        Row: {
          id: string
          code: string
          name: string
          parent_id: string | null
          type: string
          created_at: string | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          parent_id?: string | null
          type: string
          created_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          parent_id?: string | null
          type?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_jurisdictions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tax_jurisdictions"
            referencedColumns: ["id"]
          }
        ]
      }
      tax_codes: {
        Row: {
          id: string
          code: string
          description: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          code: string
          description?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          description?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      tax_rules: {
        Row: {
          id: string
          jurisdiction_id: string | null
          tax_code_id: string | null
          rate: number
          priority: number | null
          effective_from: string
          effective_to: string | null
          rule_type: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          jurisdiction_id?: string | null
          tax_code_id?: string | null
          rate: number
          priority?: number | null
          effective_from: string
          effective_to?: string | null
          rule_type?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          jurisdiction_id?: string | null
          tax_code_id?: string | null
          rate?: number
          priority?: number | null
          effective_from?: string
          effective_to?: string | null
          rule_type?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_rules_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "tax_jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rules_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          tenant_id: string
          customer_id: string
          invoice_number: string
          status: string | null
          issue_date: string
          due_date: string
          currency: string
          subtotal: number
          tax_total: number
          total_amount: number
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          customer_id: string
          invoice_number: string
          status?: string | null
          issue_date: string
          due_date: string
          currency: string
          subtotal: number
          tax_total: number
          total_amount: number
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          customer_id?: string
          invoice_number?: string
          status?: string | null
          issue_date?: string
          due_date?: string
          currency?: string
          subtotal?: number
          tax_total?: number
          total_amount?: number
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string | null
          description: string
          quantity: number
          unit_price: number
          tax_code_id: string | null
          tax_amount: number
          total_amount: number
          created_at: string | null
        }
        Insert: {
          id?: string
          invoice_id?: string | null
          description: string
          quantity: number
          unit_price: number
          tax_code_id?: string | null
          tax_amount: number
          total_amount: number
          created_at?: string | null
        }
        Update: {
          id?: string
          invoice_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          tax_code_id?: string | null
          tax_amount?: number
          total_amount?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          }
        ]
      }
      gl_accounts: {
        Row: {
          id: string
          tenant_id: string
          code: string
          name: string
          type: string
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          code: string
          name: string
          type: string
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          code?: string
          name?: string
          type?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      journal_entries: {
        Row: {
          id: string
          tenant_id: string
          reference_id: string
          reference_type: string
          sync_status: string | null
          external_id: string | null
          error_message: string | null
          retry_count: number | null
          created_at: string | null
          synced_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          reference_id: string
          reference_type: string
          sync_status?: string | null
          external_id?: string | null
          error_message?: string | null
          retry_count?: number | null
          created_at?: string | null
          synced_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          reference_id?: string
          reference_type?: string
          sync_status?: string | null
          external_id?: string | null
          error_message?: string | null
          retry_count?: number | null
          created_at?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      tenant_nexus: {
        Row: {
          id: string
          tenant_id: string
          jurisdiction_id: string
          effective_from: string
          effective_to: string | null
          created_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          jurisdiction_id: string
          effective_from: string
          effective_to?: string | null
          created_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          jurisdiction_id?: string
          effective_from?: string
          effective_to?: string | null
          created_at?: string | null
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_nexus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_nexus_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "tax_jurisdictions"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      platform_domains: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_number: string | null
          account_site: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          active: boolean | null
          annual_revenue: number | null
          billing_address: Json | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_state: string | null
          billing_street: string | null
          created_at: string | null
          created_by: string | null
          customer_priority: string | null
          description: string | null
          duns_number: string | null
          email: string | null
          employee_count: number | null
          fax: string | null
          franchise_id: string | null
          id: string
          industry: string | null
          naics_code: string | null
          name: string
          number_of_locations: number | null
          owner_id: string | null
          ownership: string | null
          parent_account_id: string | null
          phone: string | null
          rating: string | null
          shipping_address: Json | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_state: string | null
          shipping_street: string | null
          sic_code: string | null
          sla: string | null
          sla_expiration_date: string | null
          status: Database["public"]["Enums"]["account_status"] | null
          support_tier: string | null
          tenant_id: string
          ticker_symbol: string | null
          updated_at: string | null
          upsell_opportunity: string | null
          website: string | null
        }
        Insert: {
          account_number?: string | null
          account_site?: string | null
          account_type?: Database["public"]["Enums"]["account_type"] | null
          active?: boolean | null
          annual_revenue?: number | null
          billing_address?: Json | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          billing_street?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_priority?: string | null
          description?: string | null
          duns_number?: string | null
          email?: string | null
          employee_count?: number | null
          fax?: string | null
          franchise_id?: string | null
          id?: string
          industry?: string | null
          naics_code?: string | null
          name: string
          number_of_locations?: number | null
          owner_id?: string | null
          ownership?: string | null
          parent_account_id?: string | null
          phone?: string | null
          rating?: string | null
          shipping_address?: Json | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          sic_code?: string | null
          sla?: string | null
          sla_expiration_date?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          support_tier?: string | null
          tenant_id: string
          ticker_symbol?: string | null
          updated_at?: string | null
          upsell_opportunity?: string | null
          website?: string | null
        }
        Update: {
          account_number?: string | null
          account_site?: string | null
          account_type?: Database["public"]["Enums"]["account_type"] | null
          active?: boolean | null
          annual_revenue?: number | null
          billing_address?: Json | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          billing_street?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_priority?: string | null
          description?: string | null
          duns_number?: string | null
          email?: string | null
          employee_count?: number | null
          fax?: string | null
          franchise_id?: string | null
          id?: string
          industry?: string | null
          naics_code?: string | null
          name?: string
          number_of_locations?: number | null
          owner_id?: string | null
          ownership?: string | null
          parent_account_id?: string | null
          phone?: string | null
          rating?: string | null
          shipping_address?: Json | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          sic_code?: string | null
          sla?: string | null
          sla_expiration_date?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          support_tier?: string | null
          tenant_id?: string
          ticker_symbol?: string | null
          updated_at?: string | null
          upsell_opportunity?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_parent_account"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_quote_requests: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          created_at: string | null
          request_payload: Json
          response_payload: Json
          status: string
          quote_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id: string
          created_at?: string | null
          request_payload: Json
          response_payload: Json
          status?: string
          quote_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string
          created_at?: string | null
          request_payload?: Json
          response_payload?: Json
          status?: string
          quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_quote_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_quote_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
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
          custom_fields: Json | null
          description: string | null
          due_date: string | null
          franchise_id: string | null
          id: string
          lead_id: string | null
          opportunity_id: string | null
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
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
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
          custom_fields?: Json | null
          description?: string | null
          due_date?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
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
            foreignKeyName: "activities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
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
      admin_override_audit: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          franchise_id: string | null
          id: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          franchise_id?: string | null
          id?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          franchise_id?: string | null
          id?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_override_audit_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_override_audit_tenant_id_fkey"
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
          unit_of_measure: string | null
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
          unit_of_measure?: string | null
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
          unit_of_measure?: string | null
          uom1?: string | null
          uom2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          franchise_id: string | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          franchise_id?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          franchise_id?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_permissions: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      auth_role_hierarchy: {
        Row: {
          created_at: string | null
          manager_role_id: string
          target_role_id: string
        }
        Insert: {
          created_at?: string | null
          manager_role_id: string
          target_role_id: string
        }
        Update: {
          created_at?: string | null
          manager_role_id?: string
          target_role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_role_hierarchy_manager_role_id_fkey"
            columns: ["manager_role_id"]
            isOneToOne: false
            referencedRelation: "auth_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_role_hierarchy_target_role_id_fkey"
            columns: ["target_role_id"]
            isOneToOne: false
            referencedRelation: "auth_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_role_permissions: {
        Row: {
          created_at: string | null
          id: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "auth_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "auth_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_roles: {
        Row: {
          can_manage_scopes: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          label: string
          level: number
          updated_at: string | null
        }
        Insert: {
          can_manage_scopes?: string[] | null
          created_at?: string | null
          description?: string | null
          id: string
          is_system?: boolean | null
          label: string
          level?: number
          updated_at?: string | null
        }
        Update: {
          can_manage_scopes?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          label?: string
          level?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      cargo_details: {
        Row: {
          actual_weight_kg: number | null
          cargo_type_id: string | null
          chargeable_weight_kg: number | null
          commodity_description: string | null
          created_at: string | null
          created_by: string | null
          dimensions: Json | null
          dimensions_cm: Json | null
          hazmat: boolean | null
          hazmat_class: string | null
          hazmat_un_number: string | null
          hs_code: string | null
          id: string
          is_active: boolean | null
          is_hazardous: boolean | null
          notes: string | null
          package_count: number | null
          requires_special_handling: boolean | null
          service_id: string
          service_type: string
          special_requirements: string | null
          temperature_controlled: boolean | null
          temperature_range: Json | null
          tenant_id: string
          total_volume_cbm: number | null
          total_weight_kg: number | null
          updated_at: string | null
          value_amount: number | null
          value_currency: string | null
          volume_cbm: number | null
          volumetric_weight_kg: number | null
          weight_kg: number | null
        }
        Insert: {
          actual_weight_kg?: number | null
          cargo_type_id?: string | null
          chargeable_weight_kg?: number | null
          commodity_description?: string | null
          created_at?: string | null
          created_by?: string | null
          dimensions?: Json | null
          dimensions_cm?: Json | null
          hazmat?: boolean | null
          hazmat_class?: string | null
          hazmat_un_number?: string | null
          hs_code?: string | null
          id?: string
          is_active?: boolean | null
          is_hazardous?: boolean | null
          notes?: string | null
          package_count?: number | null
          requires_special_handling?: boolean | null
          service_id: string
          service_type: string
          special_requirements?: string | null
          temperature_controlled?: boolean | null
          temperature_range?: Json | null
          tenant_id: string
          total_volume_cbm?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          value_amount?: number | null
          value_currency?: string | null
          volume_cbm?: number | null
          volumetric_weight_kg?: number | null
          weight_kg?: number | null
        }
        Update: {
          actual_weight_kg?: number | null
          cargo_type_id?: string | null
          chargeable_weight_kg?: number | null
          commodity_description?: string | null
          created_at?: string | null
          created_by?: string | null
          dimensions?: Json | null
          dimensions_cm?: Json | null
          hazmat?: boolean | null
          hazmat_class?: string | null
          hazmat_un_number?: string | null
          hs_code?: string | null
          id?: string
          is_active?: boolean | null
          is_hazardous?: boolean | null
          notes?: string | null
          package_count?: number | null
          requires_special_handling?: boolean | null
          service_id?: string
          service_type?: string
          special_requirements?: string | null
          temperature_controlled?: boolean | null
          temperature_range?: Json | null
          tenant_id?: string
          total_volume_cbm?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          value_amount?: number | null
          value_currency?: string | null
          volume_cbm?: number | null
          volumetric_weight_kg?: number | null
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
          cargo_code: string | null
          cargo_type_name: string
          created_at: string | null
          description: string | null
          hazmat_class: string | null
          id: string
          is_active: boolean | null
          requires_special_handling: boolean | null
          temperature_controlled: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cargo_code?: string | null
          cargo_type_name: string
          created_at?: string | null
          description?: string | null
          hazmat_class?: string | null
          id?: string
          is_active?: boolean | null
          requires_special_handling?: boolean | null
          temperature_controlled?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cargo_code?: string | null
          cargo_type_name?: string
          created_at?: string | null
          description?: string | null
          hazmat_class?: string | null
          id?: string
          is_active?: boolean | null
          requires_special_handling?: boolean | null
          temperature_controlled?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      carrier_rate_attachments: {
        Row: {
          carrier_rate_id: string
          created_at: string | null
          description: string | null
          file_url: string
          id: string
          tenant_id: string
        }
        Insert: {
          carrier_rate_id: string
          created_at?: string | null
          description?: string | null
          file_url: string
          id?: string
          tenant_id: string
        }
        Update: {
          carrier_rate_id?: string
          created_at?: string | null
          description?: string | null
          file_url?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_rate_attachments_carrier_rate_id_fkey"
            columns: ["carrier_rate_id"]
            isOneToOne: false
            referencedRelation: "carrier_rates"
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
        ]
      }
      carrier_rates: {
        Row: {
          accessorial_fees: Json | null
          base_rate: number
          carrier_id: string | null
          carrier_name: string
          charges_subtotal: number | null
          container_category_id: string | null
          container_size_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          account_id: string | null
          cut_off_date: string | null
          demurrage_rate: number | null
          destination_location: string | null
          destination_port_id: string | null
          detention_rate: number | null
          eta: string | null
          etd: string | null
          exchange_rate: number | null
          free_time_days: number | null
          id: string
          is_active: boolean | null
          markup_amount: number | null
          mode: string | null
          notes: string | null
          origin_location: string | null
          origin_port_id: string | null
          payment_terms: string | null
          rate_reference_id: string | null
          rate_type: string
          removed_reason: string | null
          sailing_frequency: string | null
          scac_code: string | null
          service_id: string | null
          service_name: string | null
          status: string | null
          surcharges: Json | null
          tenant_id: string
          tier: string | null
          total_amount: number | null
          updated_at: string | null
          valid_from: string
          valid_to: string | null
          valid_until: string | null
          vessel_flight_no: string | null
          weight_break_max: number | null
          weight_break_min: number | null
        }
        Insert: {
          accessorial_fees?: Json | null
          base_rate: number
          carrier_id?: string | null
          carrier_name: string
          charges_subtotal?: number | null
          container_category_id?: string | null
          container_size_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          account_id?: string | null
          cut_off_date?: string | null
          demurrage_rate?: number | null
          destination_location?: string | null
          destination_port_id?: string | null
          detention_rate?: number | null
          eta?: string | null
          etd?: string | null
          exchange_rate?: number | null
          free_time_days?: number | null
          id?: string
          is_active?: boolean | null
          markup_amount?: number | null
          mode?: string | null
          notes?: string | null
          origin_location?: string | null
          origin_port_id?: string | null
          payment_terms?: string | null
          rate_reference_id?: string | null
          rate_type: string
          removed_reason?: string | null
          sailing_frequency?: string | null
          scac_code?: string | null
          service_id?: string | null
          service_name?: string | null
          status?: string | null
          surcharges?: Json | null
          tenant_id: string
          tier?: string | null
          total_amount?: number | null
          updated_at?: string | null
          valid_from: string
          valid_to?: string | null
          valid_until?: string | null
          vessel_flight_no?: string | null
          weight_break_max?: number | null
          weight_break_min?: number | null
        }
        Update: {
          accessorial_fees?: Json | null
          base_rate?: number
          carrier_id?: string | null
          carrier_name?: string
          charges_subtotal?: number | null
          container_category_id?: string | null
          container_size_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          account_id?: string | null
          cut_off_date?: string | null
          demurrage_rate?: number | null
          destination_location?: string | null
          destination_port_id?: string | null
          detention_rate?: number | null
          eta?: string | null
          etd?: string | null
          exchange_rate?: number | null
          free_time_days?: number | null
          id?: string
          is_active?: boolean | null
          markup_amount?: number | null
          mode?: string | null
          notes?: string | null
          origin_location?: string | null
          origin_port_id?: string | null
          payment_terms?: string | null
          rate_reference_id?: string | null
          rate_type?: string
          removed_reason?: string | null
          sailing_frequency?: string | null
          scac_code?: string | null
          service_id?: string | null
          service_name?: string | null
          status?: string | null
          surcharges?: Json | null
          tenant_id?: string
          tier?: string | null
          total_amount?: number | null
          updated_at?: string | null
          valid_from?: string
          valid_to?: string | null
          valid_until?: string | null
          vessel_flight_no?: string | null
          weight_break_max?: number | null
          weight_break_min?: number | null
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
            foreignKeyName: "carrier_rates_container_category_id_fkey"
            columns: ["container_category_id"]
            isOneToOne: false
            referencedRelation: "package_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rates_container_size_id_fkey"
            columns: ["container_size_id"]
            isOneToOne: false
            referencedRelation: "package_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rates_customer_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_rates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
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
        Relationships: [
          {
            foreignKeyName: "carrier_service_types_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      carriers: {
        Row: {
          address: Json | null
          carrier_code: string | null
          carrier_name: string | null
          carrier_type: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          franchise_id: string | null
          iata: string | null
          id: string
          is_active: boolean | null
          mc_dot: string | null
          mode: Database["public"]["Enums"]["transport_mode"]
          name: string | null
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
          carrier_name?: string | null
          carrier_type?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          franchise_id?: string | null
          iata?: string | null
          id?: string
          is_active?: boolean | null
          mc_dot?: string | null
          mode: Database["public"]["Enums"]["transport_mode"]
          name?: string | null
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
          carrier_name?: string | null
          carrier_type?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          franchise_id?: string | null
          iata?: string | null
          id?: string
          is_active?: boolean | null
          mc_dot?: string | null
          mode?: Database["public"]["Enums"]["transport_mode"]
          name?: string | null
          notes?: string | null
          rating?: number | null
          scac?: string | null
          service_routes?: Json | null
          tenant_id?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      charge_bases: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      charge_categories: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      charge_sides: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      charge_tier_config: {
        Row: {
          basis_id: string | null
          carrier_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          service_type_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          basis_id?: string | null
          carrier_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          service_type_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          basis_id?: string | null
          carrier_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          service_type_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_tier_config_basis_id_fkey"
            columns: ["basis_id"]
            isOneToOne: false
            referencedRelation: "charge_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_tier_config_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_tier_config_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "charge_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_tier_config_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_tier_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_tier_ranges: {
        Row: {
          created_at: string | null
          currency_id: string | null
          id: string
          max_value: number | null
          min_value: number
          rate: number
          sort_order: number | null
          tier_config_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency_id?: string | null
          id?: string
          max_value?: number | null
          min_value: number
          rate: number
          sort_order?: number | null
          tier_config_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency_id?: string | null
          id?: string
          max_value?: number | null
          min_value?: number
          rate?: number
          sort_order?: number | null
          tier_config_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_tier_ranges_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_tier_ranges_tier_config_id_fkey"
            columns: ["tier_config_id"]
            isOneToOne: false
            referencedRelation: "charge_tier_config"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_types: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      charge_weight_breaks: {
        Row: {
          carrier_id: string | null
          created_at: string | null
          currency_id: string | null
          description: string | null
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean | null
          max_weight_kg: number | null
          min_weight_kg: number
          name: string
          rate_per_kg: number
          service_type_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          carrier_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          max_weight_kg?: number | null
          min_weight_kg: number
          name: string
          rate_per_kg: number
          service_type_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          carrier_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          max_weight_kg?: number | null
          min_weight_kg?: number
          name?: string
          rate_per_kg?: number
          service_type_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_weight_breaks_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_weight_breaks_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_weight_breaks_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_weight_breaks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          code_national: string | null
          country_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          state_id: string | null
          tenant_id: string | null
        }
        Insert: {
          code_national?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          state_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          code_national?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          state_id?: string | null
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
            foreignKeyName: "cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
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
        Relationships: [
          {
            foreignKeyName: "compliance_checks_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_checks_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
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
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          code: string | null
          created_at: string | null
          description: string | null
          has_temperature_control: boolean | null
          has_ventilation: boolean | null
          height_ft: number | null
          id: string
          is_active: boolean | null
          is_flat_rack: boolean | null
          is_high_cube: boolean | null
          is_open_top: boolean | null
          iso_code: string | null
          length_ft: number | null
          max_gross_weight_kg: number | null
          max_weight_kg: number | null
          name: string
          tenant_id: string | null
          teu_factor: number | null
          type_id: string | null
          updated_at: string | null
          width_ft: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          has_temperature_control?: boolean | null
          has_ventilation?: boolean | null
          height_ft?: number | null
          id?: string
          is_active?: boolean | null
          is_flat_rack?: boolean | null
          is_high_cube?: boolean | null
          is_open_top?: boolean | null
          iso_code?: string | null
          length_ft?: number | null
          max_gross_weight_kg?: number | null
          max_weight_kg?: number | null
          name: string
          tenant_id?: string | null
          teu_factor?: number | null
          type_id?: string | null
          updated_at?: string | null
          width_ft?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          has_temperature_control?: boolean | null
          has_ventilation?: boolean | null
          height_ft?: number | null
          id?: string
          is_active?: boolean | null
          is_flat_rack?: boolean | null
          is_high_cube?: boolean | null
          is_open_top?: boolean | null
          iso_code?: string | null
          length_ft?: number | null
          max_gross_weight_kg?: number | null
          max_weight_kg?: number | null
          name?: string
          tenant_id?: string | null
          teu_factor?: number | null
          type_id?: string | null
          updated_at?: string | null
          width_ft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "container_sizes_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "container_types"
            referencedColumns: ["id"]
          },
        ]
      }
      container_tracking: {
        Row: {
          created_by: string | null
          id: string
          location_name: string | null
          quantity: number
          recorded_at: string | null
          size_id: string | null
          status: Database["public"]["Enums"]["container_status"]
          tenant_id: string | null
          teu_total: number | null
        }
        Insert: {
          created_by?: string | null
          id?: string
          location_name?: string | null
          quantity: number
          recorded_at?: string | null
          size_id?: string | null
          status?: Database["public"]["Enums"]["container_status"]
          tenant_id?: string | null
          teu_total?: number | null
        }
        Update: {
          created_by?: string | null
          id?: string
          location_name?: string | null
          quantity?: number
          recorded_at?: string | null
          size_id?: string | null
          status?: Database["public"]["Enums"]["container_status"]
          tenant_id?: string | null
          teu_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "container_tracking_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "container_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_tracking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      container_transactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          location_name: string
          notes: string | null
          quantity_change: number
          reference_id: string | null
          size_id: string
          status: string | null
          tenant_id: string
          transaction_date: string | null
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          location_name: string
          notes?: string | null
          quantity_change: number
          reference_id?: string | null
          size_id: string
          status?: string | null
          tenant_id: string
          transaction_date?: string | null
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          location_name?: string
          notes?: string | null
          quantity_change?: number
          reference_id?: string | null
          size_id?: string
          status?: string | null
          tenant_id?: string
          transaction_date?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_transactions_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "container_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      container_type_attributes: {
        Row: {
          attribute_key: string
          attribute_label: string
          created_at: string | null
          data_type: string
          id: string
          type_id: string | null
          validation_rule: Json | null
        }
        Insert: {
          attribute_key: string
          attribute_label: string
          created_at?: string | null
          data_type: string
          id?: string
          type_id?: string | null
          validation_rule?: Json | null
        }
        Update: {
          attribute_key?: string
          attribute_label?: string
          created_at?: string | null
          data_type?: string
          id?: string
          type_id?: string | null
          validation_rule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "container_type_attributes_type_id_fkey"
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
          is_special: boolean | null
          name: string
          ownership_type: string | null
          requires_power: boolean | null
          requires_temperature: boolean | null
          requires_ventilation: boolean | null
          special_type: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_special?: boolean | null
          name: string
          ownership_type?: string | null
          requires_power?: boolean | null
          requires_temperature?: boolean | null
          requires_ventilation?: boolean | null
          special_type?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_special?: boolean | null
          name?: string
          ownership_type?: string | null
          requires_power?: boolean | null
          requires_temperature?: boolean | null
          requires_ventilation?: boolean | null
          special_type?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      continents: {
        Row: {
          code_international: string | null
          code_national: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
        }
        Insert: {
          code_international?: string | null
          code_national?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
        }
        Update: {
          code_international?: string | null
          code_national?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
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
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          symbol?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          symbol?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_role_permissions: {
        Row: {
          access_type: string
          created_at: string | null
          id: string
          permission_key: string
          role_id: string
        }
        Insert: {
          access_type?: string
          created_at?: string | null
          id?: string
          permission_key: string
          role_id: string
        }
        Update: {
          access_type?: string
          created_at?: string | null
          id?: string
          permission_key?: string
          role_id?: string
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
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system_role: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_role?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_role?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "customs_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_preferences: {
        Row: {
          created_at: string
          id: string
          layout: Json | null
          tenant_id: string | null
          theme_overrides: Json | null
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json | null
          tenant_id?: string | null
          theme_overrides?: Json | null
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json | null
          tenant_id?: string | null
          theme_overrides?: Json | null
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      document_versions: {
        Row: {
          change_notes: string | null
          change_type: string | null
          content: string
          created_at: string
          created_by: string | null
          diff_summary: Json | null
          document_id: string
          id: string
          version: string
        }
        Insert: {
          change_notes?: string | null
          change_type?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          diff_summary?: Json | null
          document_id: string
          id?: string
          version: string
        }
        Update: {
          change_notes?: string | null
          change_type?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          diff_summary?: Json | null
          document_id?: string
          id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          current_version: string | null
          id: string
          path: string | null
          quote_id: string | null
          status: string | null
          storage_path: string
          tenant_id: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_version?: string | null
          id?: string
          path?: string | null
          quote_id?: string | null
          status?: string | null
          storage_path: string
          tenant_id: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_version?: string | null
          id?: string
          path?: string | null
          quote_id?: string | null
          status?: string | null
          storage_path?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_account_delegations: {
        Row: {
          account_id: string
          created_at: string | null
          delegate_user_id: string
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          is_active: boolean | null
          permissions: Json
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          delegate_user_id: string
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          delegate_user_id?: string
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_account_delegations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
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
          pop3_delete_policy: string | null
          pop3_host: string | null
          pop3_password: string | null
          pop3_port: number | null
          pop3_use_ssl: boolean | null
          pop3_username: string | null
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
          pop3_delete_policy?: string | null
          pop3_host?: string | null
          pop3_password?: string | null
          pop3_port?: number | null
          pop3_use_ssl?: boolean | null
          pop3_username?: string | null
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
          pop3_delete_policy?: string | null
          pop3_host?: string | null
          pop3_password?: string | null
          pop3_port?: number | null
          pop3_use_ssl?: boolean | null
          pop3_username?: string | null
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
        Relationships: []
      }
      email_audit_log: {
        Row: {
          created_at: string
          email_id: string | null
          event_data: Json | null
          event_type: string
          franchise_id: string | null
          id: string
          ip_address: unknown
          scheduled_email_id: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_id?: string | null
          event_data?: Json | null
          event_type: string
          franchise_id?: string | null
          id?: string
          ip_address?: unknown
          scheduled_email_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_id?: string | null
          event_data?: Json | null
          event_type?: string
          franchise_id?: string | null
          id?: string
          ip_address?: unknown
          scheduled_email_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_audit_log_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_audit_log_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_audit_log_scheduled_email_id_fkey"
            columns: ["scheduled_email_id"]
            isOneToOne: false
            referencedRelation: "scheduled_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_audit_log_tenant_id_fkey"
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
        ]
      }
      email_sync_logs: {
        Row: {
          account_id: string | null
          completed_at: string | null
          created_at: string | null
          details: Json | null
          emails_synced: number | null
          id: string
          started_at: string | null
          status: string
        }
        Insert: {
          account_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          emails_synced?: number | null
          id?: string
          started_at?: string | null
          status: string
        }
        Update: {
          account_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          emails_synced?: number | null
          id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sync_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          franchise_id: string | null
          id: string
          is_active: boolean | null
          is_shared: boolean | null
          name: string
          subject: string
          tenant_id: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean | null
          name: string
          subject: string
          tenant_id: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean | null
          name?: string
          subject?: string
          tenant_id?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      emails: {
        Row: {
          account_id: string
          account_id_crm: string | null
          ai_category: string | null
          ai_processed_at: string | null
          ai_sentiment: string | null
          ai_summary: string | null
          ai_urgency: string | null
          attachments: Json | null
          bcc_emails: Json | null
          body_html: string | null
          body_text: string | null
          category: string | null
          cc_emails: Json | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          direction: string
          email_references: string[] | null
          folder: string | null
          franchise_id: string | null
          from_email: string
          from_name: string | null
          has_attachments: boolean | null
          has_inline_images: boolean | null
          id: string
          importance: string | null
          in_reply_to: string | null
          intent: string | null
          internet_message_id: string | null
          is_archived: boolean | null
          is_deleted: boolean | null
          is_read: boolean | null
          is_spam: boolean | null
          is_starred: boolean | null
          labels: Json | null
          last_sync_attempt: string | null
          lead_id: string | null
          message_id: string
          opportunity_id: string | null
          priority: string | null
          queue: string | null
          raw_headers: Json | null
          received_at: string | null
          reply_to: string | null
          sent_at: string | null
          size_bytes: number | null
          snippet: string | null
          status: string | null
          subject: string
          sync_error: string | null
          tenant_id: string | null
          thread_id: string | null
          to_emails: Json
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id: string
          account_id_crm?: string | null
          ai_category?: string | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          ai_urgency?: string | null
          attachments?: Json | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          cc_emails?: Json | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction: string
          email_references?: string[] | null
          folder?: string | null
          franchise_id?: string | null
          from_email: string
          from_name?: string | null
          has_attachments?: boolean | null
          has_inline_images?: boolean | null
          id?: string
          importance?: string | null
          in_reply_to?: string | null
          intent?: string | null
          internet_message_id?: string | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          is_read?: boolean | null
          is_spam?: boolean | null
          is_starred?: boolean | null
          labels?: Json | null
          last_sync_attempt?: string | null
          lead_id?: string | null
          message_id: string
          opportunity_id?: string | null
          priority?: string | null
          queue?: string | null
          raw_headers?: Json | null
          received_at?: string | null
          reply_to?: string | null
          sent_at?: string | null
          size_bytes?: number | null
          snippet?: string | null
          status?: string | null
          subject: string
          sync_error?: string | null
          tenant_id?: string | null
          thread_id?: string | null
          to_emails?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string
          account_id_crm?: string | null
          ai_category?: string | null
          ai_processed_at?: string | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          ai_urgency?: string | null
          attachments?: Json | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          cc_emails?: Json | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction?: string
          email_references?: string[] | null
          folder?: string | null
          franchise_id?: string | null
          from_email?: string
          from_name?: string | null
          has_attachments?: boolean | null
          has_inline_images?: boolean | null
          id?: string
          importance?: string | null
          in_reply_to?: string | null
          intent?: string | null
          internet_message_id?: string | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          is_read?: boolean | null
          is_spam?: boolean | null
          is_starred?: boolean | null
          labels?: Json | null
          last_sync_attempt?: string | null
          lead_id?: string | null
          message_id?: string
          opportunity_id?: string | null
          priority?: string | null
          queue?: string | null
          raw_headers?: Json | null
          received_at?: string | null
          reply_to?: string | null
          sent_at?: string | null
          size_bytes?: number | null
          snippet?: string | null
          status?: string | null
          subject?: string
          sync_error?: string | null
          tenant_id?: string | null
          thread_id?: string | null
          to_emails?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_account_id_crm_fkey"
            columns: ["account_id_crm"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_transfer_items: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["transfer_entity_type"]
          error_message: string | null
          id: string
          status: Database["public"]["Enums"]["transfer_status"]
          transfer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["transfer_entity_type"]
          error_message?: string | null
          id?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          transfer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["transfer_entity_type"]
          error_message?: string | null
          id?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          transfer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "entity_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_transfers: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          rejection_reason: string | null
          requested_by: string
          source_franchise_id: string | null
          source_tenant_id: string
          status: Database["public"]["Enums"]["transfer_status"]
          target_franchise_id: string | null
          target_tenant_id: string
          transfer_type: Database["public"]["Enums"]["transfer_type"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_by: string
          source_franchise_id?: string | null
          source_tenant_id: string
          status?: Database["public"]["Enums"]["transfer_status"]
          target_franchise_id?: string | null
          target_tenant_id: string
          transfer_type: Database["public"]["Enums"]["transfer_type"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_by?: string
          source_franchise_id?: string | null
          source_tenant_id?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          target_franchise_id?: string | null
          target_tenant_id?: string
          transfer_type?: Database["public"]["Enums"]["transfer_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_transfers_approved_by_fkey_profiles"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_transfers_requested_by_fkey_profiles"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_transfers_source_franchise_id_fkey"
            columns: ["source_franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_transfers_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_transfers_target_franchise_id_fkey"
            columns: ["target_franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_transfers_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
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
        Relationships: [
          {
            foreignKeyName: "fx_rates_from_currency_id_fkey"
            columns: ["from_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_rates_to_currency_id_fkey"
            columns: ["to_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
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
      import_errors: {
        Row: {
          created_at: string
          error_message: string | null
          field: string | null
          id: string
          import_id: string
          raw_data: Json | null
          row_number: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          field?: string | null
          id?: string
          import_id: string
          raw_data?: Json | null
          row_number?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          field?: string | null
          id?: string
          import_id?: string
          raw_data?: Json | null
          row_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          completed_at: string | null
          created_at: string
          entity_name: string
          file_name: string
          franchise_id: string | null
          id: string
          imported_at: string
          imported_by: string | null
          reverted_at: string | null
          reverted_by: string | null
          status: string
          summary: Json | null
          table_name: string
          tenant_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entity_name: string
          file_name: string
          franchise_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          status?: string
          summary?: Json | null
          table_name: string
          tenant_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entity_name?: string
          file_name?: string
          franchise_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          status?: string
          summary?: Json | null
          table_name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_history_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_history_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_history_reverted_by_fkey"
            columns: ["reverted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history_details: {
        Row: {
          created_at: string
          id: string
          import_id: string
          new_data: Json | null
          operation_type: string
          previous_data: Json | null
          record_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          import_id: string
          new_data?: Json | null
          operation_type: string
          previous_data?: Json | null
          record_id: string
        }
        Update: {
          created_at?: string
          id?: string
          import_id?: string
          new_data?: Json | null
          operation_type?: string
          previous_data?: Json | null
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_history_details_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      import_overrides: {
        Row: {
          action: string
          created_at: string | null
          file_name: string
          file_size: number | null
          id: string
          issues: string[] | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          id: string
          issues?: string[] | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          issues?: string[] | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
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
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
          role: Database["public"]["Enums"]["app_role"]
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
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          metadata: Json | null
          tenant_id: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          tenant_id?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_history: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_from: string | null
          assigned_to: string
          assignment_method: string
          franchise_id: string | null
          id: string
          lead_id: string
          reason: string | null
          rule_id: string | null
          tenant_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_from?: string | null
          assigned_to: string
          assignment_method: string
          franchise_id?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          rule_id?: string | null
          tenant_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_from?: string | null
          assigned_to?: string
          assignment_method?: string
          franchise_id?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          rule_id?: string | null
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
            foreignKeyName: "lead_assignment_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "lead_assignment_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          franchise_id: string | null
          id: string
          lead_id: string
          priority: number | null
          processed_at: string | null
          retry_count: number | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          franchise_id?: string | null
          id?: string
          lead_id: string
          priority?: number | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string
          priority?: number | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_rules: {
        Row: {
          assigned_queue_id: string | null
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
          assigned_queue_id?: string | null
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
          assigned_queue_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "lead_assignment_rules_assigned_queue_id_fkey"
            columns: ["assigned_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_rules_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_config: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          tenant_id: string | null
          updated_at: string | null
          weights_json: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
          weights_json?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
          weights_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_logs: {
        Row: {
          change_reason: string | null
          created_at: string | null
          id: string
          lead_id: string
          new_score: number | null
          old_score: number | null
        }
        Insert: {
          change_reason?: string | null
          created_at?: string | null
          id?: string
          lead_id: string
          new_score?: number | null
          old_score?: number | null
        }
        Update: {
          change_reason?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string
          new_score?: number | null
          old_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
          name: string | null
          notes: string | null
          owner_id: string | null
          owner_queue_id: string | null
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
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          owner_queue_id?: string | null
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
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          owner_queue_id?: string | null
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
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_queue_id_fkey"
            columns: ["owner_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
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
        Relationships: [
          {
            foreignKeyName: "oauth_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          account_id: string | null
          amount: number | null
          campaign_id: string | null
          close_date: string | null
          closed_at: string | null
          competitors: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expected_revenue: number | null
          forecast_category: string | null
          franchise_id: string | null
          id: string
          lead_id: string | null
          lead_source: Database["public"]["Enums"]["lead_source"] | null
          name: string
          next_step: string | null
          owner_id: string | null
          primary_quote_id: string | null
          probability: number | null
          salesforce_error: string | null
          salesforce_last_synced: string | null
          salesforce_opportunity_id: string | null
          salesforce_sync_status: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"]
          tenant_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          campaign_id?: string | null
          close_date?: string | null
          closed_at?: string | null
          competitors?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expected_revenue?: number | null
          forecast_category?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          name: string
          next_step?: string | null
          owner_id?: string | null
          primary_quote_id?: string | null
          probability?: number | null
          salesforce_error?: string | null
          salesforce_last_synced?: string | null
          salesforce_opportunity_id?: string | null
          salesforce_sync_status?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          tenant_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          campaign_id?: string | null
          close_date?: string | null
          closed_at?: string | null
          competitors?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expected_revenue?: number | null
          forecast_category?: string | null
          franchise_id?: string | null
          id?: string
          lead_id?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          name?: string
          next_step?: string | null
          owner_id?: string | null
          primary_quote_id?: string | null
          probability?: number | null
          salesforce_error?: string | null
          salesforce_last_synced?: string | null
          salesforce_opportunity_id?: string | null
          salesforce_sync_status?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          tenant_id?: string
          type?: string | null
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
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_primary_quote_id_fkey"
            columns: ["primary_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_items: {
        Row: {
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          line_number: number
          line_total: number
          opportunity_id: string
          product_name: string
          quantity: number
          tax_amount: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          line_number: number
          line_total?: number
          opportunity_id: string
          product_name: string
          quantity?: number
          tax_amount?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          line_number?: number
          line_total?: number
          opportunity_id?: string
          product_name?: string
          quantity?: number
          tax_amount?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_items_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
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
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category_code?: string | null
          category_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category_code?: string | null
          category_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
          updated_at?: string | null
          width_ft?: number | null
        }
        Relationships: []
      }
      portal_tokens: {
        Row: {
          access_count: number | null
          accessed_at: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string
          flagged: boolean | null
          id: string
          last_ip: string | null
          last_user_agent: string | null
          quote_id: string
          tenant_id: string | null
          token: string
        }
        Insert: {
          access_count?: number | null
          accessed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          flagged?: boolean | null
          id?: string
          last_ip?: string | null
          last_user_agent?: string | null
          quote_id: string
          tenant_id?: string | null
          token: string
        }
        Update: {
          access_count?: number | null
          accessed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          flagged?: boolean | null
          id?: string
          last_ip?: string | null
          last_user_agent?: string | null
          quote_id?: string
          tenant_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_tokens_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      ports_locations: {
        Row: {
          city: string | null
          coordinates: Json | null
          country: string | null
          created_at: string | null
          customs_available: boolean | null
          facilities: Json | null
          id: string
          is_active: boolean | null
          location_code: string | null
          location_name: string
          location_type: string | null
          notes: string | null
          operating_hours: string | null
          postal_code: string | null
          state_province: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          coordinates?: Json | null
          country?: string | null
          created_at?: string | null
          customs_available?: boolean | null
          facilities?: Json | null
          id?: string
          is_active?: boolean | null
          location_code?: string | null
          location_name: string
          location_type?: string | null
          notes?: string | null
          operating_hours?: string | null
          postal_code?: string | null
          state_province?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          coordinates?: Json | null
          country?: string | null
          created_at?: string | null
          customs_available?: boolean | null
          facilities?: Json | null
          id?: string
          is_active?: boolean | null
          location_code?: string | null
          location_name?: string
          location_type?: string | null
          notes?: string | null
          operating_hours?: string | null
          postal_code?: string | null
          state_province?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      provider_api_configs: {
        Row: {
          api_provider: string
          api_version: string | null
          auth_config: Json
          auth_type: string
          base_url: string
          carrier_id: string
          created_at: string | null
          custom_headers: Json | null
          health_status: string | null
          id: string
          is_active: boolean | null
          label_endpoint: string | null
          last_health_check: string | null
          rate_endpoint: string | null
          rate_limit_per_day: number | null
          rate_limit_per_minute: number | null
          retry_attempts: number | null
          supports_document_upload: boolean | null
          supports_label_generation: boolean | null
          supports_rate_shopping: boolean | null
          supports_tracking: boolean | null
          tenant_id: string
          timeout_seconds: number | null
          tracking_endpoint: string | null
          updated_at: string | null
        }
        Insert: {
          api_provider: string
          api_version?: string | null
          auth_config?: Json
          auth_type: string
          base_url: string
          carrier_id: string
          created_at?: string | null
          custom_headers?: Json | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          label_endpoint?: string | null
          last_health_check?: string | null
          rate_endpoint?: string | null
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          retry_attempts?: number | null
          supports_document_upload?: boolean | null
          supports_label_generation?: boolean | null
          supports_rate_shopping?: boolean | null
          supports_tracking?: boolean | null
          tenant_id: string
          timeout_seconds?: number | null
          tracking_endpoint?: string | null
          updated_at?: string | null
        }
        Update: {
          api_provider?: string
          api_version?: string | null
          auth_config?: Json
          auth_type?: string
          base_url?: string
          carrier_id?: string
          created_at?: string | null
          custom_headers?: Json | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          label_endpoint?: string | null
          last_health_check?: string | null
          rate_endpoint?: string | null
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          retry_attempts?: number | null
          supports_document_upload?: boolean | null
          supports_label_generation?: boolean | null
          supports_rate_shopping?: boolean | null
          supports_tracking?: boolean | null
          tenant_id?: string
          timeout_seconds?: number | null
          tracking_endpoint?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_api_configs_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_api_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_charge_mappings: {
        Row: {
          applies_to_service_types: string[] | null
          calculation_method: string | null
          carrier_id: string
          charge_basis_id: string | null
          charge_category_id: string | null
          created_at: string | null
          currency_id: string | null
          default_rate: number | null
          id: string
          is_active: boolean | null
          max_shipment_value: number | null
          min_shipment_value: number | null
          provider_charge_code: string
          provider_charge_description: string | null
          provider_charge_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          applies_to_service_types?: string[] | null
          calculation_method?: string | null
          carrier_id: string
          charge_basis_id?: string | null
          charge_category_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          default_rate?: number | null
          id?: string
          is_active?: boolean | null
          max_shipment_value?: number | null
          min_shipment_value?: number | null
          provider_charge_code: string
          provider_charge_description?: string | null
          provider_charge_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          applies_to_service_types?: string[] | null
          calculation_method?: string | null
          carrier_id?: string
          charge_basis_id?: string | null
          charge_category_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          default_rate?: number | null
          id?: string
          is_active?: boolean | null
          max_shipment_value?: number | null
          min_shipment_value?: number | null
          provider_charge_code?: string
          provider_charge_description?: string | null
          provider_charge_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_charge_mappings_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_charge_mappings_charge_basis_id_fkey"
            columns: ["charge_basis_id"]
            isOneToOne: false
            referencedRelation: "charge_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_charge_mappings_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "charge_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_charge_mappings_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_charge_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_rate_rules: {
        Row: {
          actions: Json
          carrier_id: string
          conditions: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          is_blocking: boolean | null
          priority: number | null
          rule_name: string
          rule_type: string
          service_type_id: string | null
          tenant_id: string
          updated_at: string | null
          validation_message: string | null
        }
        Insert: {
          actions?: Json
          carrier_id: string
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_blocking?: boolean | null
          priority?: number | null
          rule_name: string
          rule_type: string
          service_type_id?: string | null
          tenant_id: string
          updated_at?: string | null
          validation_message?: string | null
        }
        Update: {
          actions?: Json
          carrier_id?: string
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_blocking?: boolean | null
          priority?: number | null
          rule_name?: string
          rule_type?: string
          service_type_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          validation_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_rate_rules_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_rate_rules_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_rate_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_rate_templates: {
        Row: {
          carrier_id: string
          created_at: string | null
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean | null
          max_chargeable_weight: number | null
          min_chargeable_weight: number | null
          rate_structure: Json
          requires_dimensional_weight: boolean | null
          requires_origin_destination: boolean | null
          service_type_id: string | null
          template_name: string
          template_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          carrier_id: string
          created_at?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          max_chargeable_weight?: number | null
          min_chargeable_weight?: number | null
          rate_structure?: Json
          requires_dimensional_weight?: boolean | null
          requires_origin_destination?: boolean | null
          service_type_id?: string | null
          template_name: string
          template_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          carrier_id?: string
          created_at?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          max_chargeable_weight?: number | null
          min_chargeable_weight?: number | null
          rate_structure?: Json
          requires_dimensional_weight?: boolean | null
          requires_origin_destination?: boolean | null
          service_type_id?: string | null
          template_name?: string
          template_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_rate_templates_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_rate_templates_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_rate_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_surcharges: {
        Row: {
          applies_to_countries: string[] | null
          applies_to_service_types: string[] | null
          applies_to_weight_range: Json | null
          applies_to_zones: string[] | null
          calculation_type: string
          carrier_id: string
          created_at: string | null
          currency_id: string | null
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean | null
          rate: number | null
          requires_hazmat: boolean | null
          requires_special_handling: boolean | null
          requires_temperature_control: boolean | null
          surcharge_code: string
          surcharge_description: string | null
          surcharge_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          applies_to_countries?: string[] | null
          applies_to_service_types?: string[] | null
          applies_to_weight_range?: Json | null
          applies_to_zones?: string[] | null
          calculation_type: string
          carrier_id: string
          created_at?: string | null
          currency_id?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          rate?: number | null
          requires_hazmat?: boolean | null
          requires_special_handling?: boolean | null
          requires_temperature_control?: boolean | null
          surcharge_code: string
          surcharge_description?: string | null
          surcharge_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          applies_to_countries?: string[] | null
          applies_to_service_types?: string[] | null
          applies_to_weight_range?: Json | null
          applies_to_zones?: string[] | null
          calculation_type?: string
          carrier_id?: string
          created_at?: string | null
          currency_id?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          rate?: number | null
          requires_hazmat?: boolean | null
          requires_special_handling?: boolean | null
          requires_temperature_control?: boolean | null
          surcharge_code?: string
          surcharge_description?: string | null
          surcharge_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_surcharges_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_surcharges_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_surcharges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      queue_members: {
        Row: {
          created_at: string | null
          id: string | null
          queue_id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          queue_id: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string | null
          queue_id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_members_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_rules: {
        Row: {
          created_at: string | null
          criteria: Json
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          target_queue_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria: Json
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          target_queue_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          target_queue_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          created_at: string | null
          description: string | null
          email: string | null
          franchise_id: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          email?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          email?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queues_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      quotation_selection_events: {
        Row: {
          id: string
          quotation_version_id: string
          quote_id: string
          reason: string | null
          selected_at: string | null
          selected_by: string | null
          selected_option_id: string
          tenant_id: string
        }
        Insert: {
          id?: string
          quotation_version_id: string
          quote_id: string
          reason?: string | null
          selected_at?: string | null
          selected_by?: string | null
          selected_option_id: string
          tenant_id: string
        }
        Update: {
          id?: string
          quotation_version_id?: string
          quote_id?: string
          reason?: string | null
          selected_at?: string | null
          selected_by?: string | null
          selected_option_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_selection_events_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_selection_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_selection_events_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "quotation_version_options"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_version_option_legs: {
        Row: {
          created_at: string
          destination_location: string | null
          franchise_id: string | null
          id: string
          leg_type: string | null
          mode: string | null
          mode_id: string | null
          origin_location: string | null
          planned_arrival: string | null
          planned_departure: string | null
          provider_id: string | null
          quotation_version_option_id: string
          service_id: string | null
          service_only_category: string | null
          service_type_id: string | null
          sort_order: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          destination_location?: string | null
          franchise_id?: string | null
          id?: string
          leg_type?: string | null
          mode?: string | null
          mode_id?: string | null
          origin_location?: string | null
          planned_arrival?: string | null
          planned_departure?: string | null
          provider_id?: string | null
          quotation_version_option_id: string
          service_id?: string | null
          service_only_category?: string | null
          service_type_id?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          destination_location?: string | null
          franchise_id?: string | null
          id?: string
          leg_type?: string | null
          mode?: string | null
          mode_id?: string | null
          origin_location?: string | null
          planned_arrival?: string | null
          planned_departure?: string | null
          provider_id?: string | null
          quotation_version_option_id?: string
          service_id?: string | null
          service_only_category?: string | null
          service_type_id?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_version_option_legs_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_option_legs_mode_id_fkey"
            columns: ["mode_id"]
            isOneToOne: false
            referencedRelation: "service_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_option_legs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_option_legs_quotation_version_option_id_fkey"
            columns: ["quotation_version_option_id"]
            isOneToOne: false
            referencedRelation: "quotation_version_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_option_legs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_option_legs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_version_options: {
        Row: {
          auto_margin_enabled: boolean
          buy_subtotal: number
          carrier_rate_id: string | null
          charge_count: number | null
          created_at: string | null
          created_by: string | null
          franchise_id: string | null
          id: string
          last_calculated_at: string | null
          leg_count: number | null
          locked: boolean | null
          margin_amount: number
          margin_method_id: string | null
          margin_percentage: number | null
          margin_value: number | null
          min_margin: number | null
          option_name: string | null
          provider_type_id: string | null
          quotation_version_id: string
          quote_currency_id: string | null
          recommended: boolean | null
          rounding_rule: string | null
          sell_subtotal: number
          status: string | null
          tenant_id: string
          total_amount: number
          total_buy: number | null
          total_sell: number | null
          trade_direction_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_margin_enabled?: boolean
          buy_subtotal?: number
          carrier_rate_id?: string | null
          charge_count?: number | null
          created_at?: string | null
          created_by?: string | null
          franchise_id?: string | null
          id?: string
          last_calculated_at?: string | null
          leg_count?: number | null
          locked?: boolean | null
          margin_amount?: number
          margin_method_id?: string | null
          margin_percentage?: number | null
          margin_value?: number | null
          min_margin?: number | null
          option_name?: string | null
          provider_type_id?: string | null
          quotation_version_id: string
          quote_currency_id?: string | null
          recommended?: boolean | null
          rounding_rule?: string | null
          sell_subtotal?: number
          status?: string | null
          tenant_id: string
          total_amount?: number
          total_buy?: number | null
          total_sell?: number | null
          trade_direction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_margin_enabled?: boolean
          buy_subtotal?: number
          carrier_rate_id?: string | null
          charge_count?: number | null
          created_at?: string | null
          created_by?: string | null
          franchise_id?: string | null
          id?: string
          last_calculated_at?: string | null
          leg_count?: number | null
          locked?: boolean | null
          margin_amount?: number
          margin_method_id?: string | null
          margin_percentage?: number | null
          margin_value?: number | null
          min_margin?: number | null
          option_name?: string | null
          provider_type_id?: string | null
          quotation_version_id?: string
          quote_currency_id?: string | null
          recommended?: boolean | null
          rounding_rule?: string | null
          sell_subtotal?: number
          status?: string | null
          tenant_id?: string
          total_amount?: number
          total_buy?: number | null
          total_sell?: number | null
          trade_direction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_version_options_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_options_margin_method_id_fkey"
            columns: ["margin_method_id"]
            isOneToOne: false
            referencedRelation: "margin_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_options_provider_type_id_fkey"
            columns: ["provider_type_id"]
            isOneToOne: false
            referencedRelation: "provider_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_options_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_options_quote_currency_id_fkey"
            columns: ["quote_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_version_options_trade_direction_id_fkey"
            columns: ["trade_direction_id"]
            isOneToOne: false
            referencedRelation: "trade_directions"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_versions: {
        Row: {
          change_reason: string | null
          created_at: string | null
          created_by: string | null
          franchise_id: string | null
          id: string
          is_active: boolean | null
          is_current: boolean | null
          kind: string | null
          locked_at: string | null
          locked_by: string | null
          major: number
          minor: number
          quote_id: string
          status: string | null
          tenant_id: string
          updated_at: string | null
          valid_until: string | null
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          is_current?: boolean | null
          kind?: string | null
          locked_at?: string | null
          locked_by?: string | null
          major?: number
          minor?: number
          quote_id: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          valid_until?: string | null
          version_number: number
        }
        Update: {
          change_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          is_current?: boolean | null
          kind?: string | null
          locked_at?: string | null
          locked_by?: string | null
          major?: number
          minor?: number
          quote_id?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          valid_until?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_versions_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_acceptances: {
        Row: {
          created_at: string | null
          decided_at: string | null
          decision: string
          email: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          name: string | null
          quote_id: string
          token_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          decision: string
          email?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          name?: string | null
          quote_id: string
          token_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          decision?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          name?: string | null
          quote_id?: string
          token_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_acceptances_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_acceptances_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "portal_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_access_logs: {
        Row: {
          accessed_at: string | null
          action_type: string | null
          id: string
          quote_id: string
          quote_share_id: string | null
          visitor_email: string | null
        }
        Insert: {
          accessed_at?: string | null
          action_type?: string | null
          id?: string
          quote_id: string
          quote_share_id?: string | null
          visitor_email?: string | null
        }
        Update: {
          accessed_at?: string | null
          action_type?: string | null
          id?: string
          quote_id?: string
          quote_share_id?: string | null
          visitor_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_access_logs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_access_logs_quote_share_id_fkey"
            columns: ["quote_share_id"]
            isOneToOne: false
            referencedRelation: "quote_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_charges: {
        Row: {
          amount: number
          basis_id: string
          category_id: string
          charge_side_id: string
          created_at: string
          currency_id: string | null
          franchise_id: string | null
          id: string
          leg_id: string
          max_amount: number | null
          min_amount: number | null
          note: string | null
          quantity: number
          quote_option_id: string
          rate: number
          sort_order: number
          tenant_id: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          basis_id: string
          category_id: string
          charge_side_id: string
          created_at?: string
          currency_id?: string | null
          franchise_id?: string | null
          id?: string
          leg_id: string
          max_amount?: number | null
          min_amount?: number | null
          note?: string | null
          quantity?: number
          quote_option_id: string
          rate?: number
          sort_order?: number
          tenant_id: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          basis_id?: string
          category_id?: string
          charge_side_id?: string
          created_at?: string
          currency_id?: string | null
          franchise_id?: string | null
          id?: string
          leg_id?: string
          max_amount?: number | null
          min_amount?: number | null
          note?: string | null
          quantity?: number
          quote_option_id?: string
          rate?: number
          sort_order?: number
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
            foreignKeyName: "quote_charges_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_charges_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "quote_option_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_charges_quote_option_id_fkey"
            columns: ["quote_option_id"]
            isOneToOne: false
            referencedRelation: "quotation_version_options"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_comments: {
        Row: {
          author_type: string
          author_user_id: string | null
          comment_text: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          quote_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          author_type: string
          author_user_id?: string | null
          comment_text: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          quote_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          author_type?: string
          author_user_id?: string | null
          comment_text?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          quote_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_comments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_documents: {
        Row: {
          document_name: string
          document_type: string
          file_url: string | null
          generated_at: string | null
          id: string
          is_public: boolean | null
          quote_id: string
          tenant_id: string
        }
        Insert: {
          document_name: string
          document_type: string
          file_url?: string | null
          generated_at?: string | null
          id?: string
          is_public?: boolean | null
          quote_id: string
          tenant_id: string
        }
        Update: {
          document_name?: string
          document_type?: string
          file_url?: string | null
          generated_at?: string | null
          id?: string
          is_public?: boolean | null
          quote_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_documents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_email_history: {
        Row: {
          delivery_status: string | null
          email_type: string
          id: string
          quote_id: string
          sent_at: string | null
          subject: string
          tenant_id: string
          to_emails: string[]
        }
        Insert: {
          delivery_status?: string | null
          email_type: string
          id?: string
          quote_id: string
          sent_at?: string | null
          subject: string
          tenant_id: string
          to_emails: string[]
        }
        Update: {
          delivery_status?: string | null
          email_type?: string
          id?: string
          quote_id?: string
          sent_at?: string | null
          subject?: string
          tenant_id?: string
          to_emails?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "quote_email_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_email_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_events: {
        Row: {
          actor_id: string | null
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          quote_id: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          quote_id: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          quote_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          cargo_type_id: string | null
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          hazmat_class: string | null
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
          un_number: string | null
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
          hazmat_class?: string | null
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
          un_number?: string | null
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
          hazmat_class?: string | null
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
          un_number?: string | null
          unit_price?: number
          updated_at?: string | null
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_legs: {
        Row: {
          arrival_date: string | null
          carrier_id: string | null
          created_at: string | null
          departure_date: string | null
          destination_location: string | null
          id: string
          leg_number: number
          mode: string | null
          notes: string | null
          origin_location: string | null
          quote_option_id: string
          service_type_id: string | null
          sort_order: number | null
          tenant_id: string
          transit_days: number | null
          updated_at: string | null
        }
        Insert: {
          arrival_date?: string | null
          carrier_id?: string | null
          created_at?: string | null
          departure_date?: string | null
          destination_location?: string | null
          id?: string
          leg_number?: number
          mode?: string | null
          notes?: string | null
          origin_location?: string | null
          quote_option_id: string
          service_type_id?: string | null
          sort_order?: number | null
          tenant_id: string
          transit_days?: number | null
          updated_at?: string | null
        }
        Update: {
          arrival_date?: string | null
          carrier_id?: string | null
          created_at?: string | null
          departure_date?: string | null
          destination_location?: string | null
          id?: string
          leg_number?: number
          mode?: string | null
          notes?: string | null
          origin_location?: string | null
          quote_option_id?: string
          service_type_id?: string | null
          sort_order?: number | null
          tenant_id?: string
          transit_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quote_legs_option"
            columns: ["quote_option_id"]
            isOneToOne: false
            referencedRelation: "quotation_version_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quote_legs_tenant"
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
      quote_option_legs: {
        Row: {
          container_size_id: string | null
          container_type_id: string | null
          created_at: string
          destination_location: string | null
          id: string
          leg_currency_id: string | null
          leg_order: number
          mode_id: string | null
          origin_location: string | null
          planned_arrival: string | null
          planned_departure: string | null
          provider_id: string | null
          quote_option_id: string
          service_id: string | null
          service_type_id: string | null
          tenant_id: string
          trade_direction_id: string | null
        }
        Insert: {
          container_size_id?: string | null
          container_type_id?: string | null
          created_at?: string
          destination_location?: string | null
          id?: string
          leg_currency_id?: string | null
          leg_order?: number
          mode_id?: string | null
          origin_location?: string | null
          planned_arrival?: string | null
          planned_departure?: string | null
          provider_id?: string | null
          quote_option_id: string
          service_id?: string | null
          service_type_id?: string | null
          tenant_id: string
          trade_direction_id?: string | null
        }
        Update: {
          container_size_id?: string | null
          container_type_id?: string | null
          created_at?: string
          destination_location?: string | null
          id?: string
          leg_currency_id?: string | null
          leg_order?: number
          mode_id?: string | null
          origin_location?: string | null
          planned_arrival?: string | null
          planned_departure?: string | null
          provider_id?: string | null
          quote_option_id?: string
          service_id?: string | null
          service_type_id?: string | null
          tenant_id?: string
          trade_direction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_option_legs_container_size_id_fkey"
            columns: ["container_size_id"]
            isOneToOne: false
            referencedRelation: "container_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_option_legs_container_type_id_fkey"
            columns: ["container_type_id"]
            isOneToOne: false
            referencedRelation: "container_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_option_legs_leg_currency_id_fkey"
            columns: ["leg_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_option_legs_mode_id_fkey"
            columns: ["mode_id"]
            isOneToOne: false
            referencedRelation: "service_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_option_legs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_option_legs_quote_option_id_fkey"
            columns: ["quote_option_id"]
            isOneToOne: false
            referencedRelation: "quote_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_option_legs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_option_legs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_option_legs_trade_direction_id_fkey"
            columns: ["trade_direction_id"]
            isOneToOne: false
            referencedRelation: "trade_directions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_options: {
        Row: {
          auto_margin_enabled: boolean
          buy_subtotal: number
          container_size_id: string | null
          container_type_id: string | null
          created_at: string
          currency_id: string | null
          destination_port_id: string | null
          free_time_days: number | null
          id: string
          margin_amount: number
          margin_method_id: string | null
          margin_value: number | null
          min_margin: number | null
          origin_port_id: string | null
          package_category_id: string | null
          package_size_id: string | null
          provider_id: string | null
          provider_type_id: string | null
          quote_currency_id: string | null
          quote_version_id: string
          rounding_rule: string | null
          sell_subtotal: number
          service_id: string | null
          service_type_id: string | null
          tenant_id: string
          total_amount: number
          trade_direction_id: string | null
          transit_time_days: number | null
          validity_date: string | null
        }
        Insert: {
          auto_margin_enabled?: boolean
          buy_subtotal?: number
          container_size_id?: string | null
          container_type_id?: string | null
          created_at?: string
          currency_id?: string | null
          destination_port_id?: string | null
          free_time_days?: number | null
          id?: string
          margin_amount?: number
          margin_method_id?: string | null
          margin_value?: number | null
          min_margin?: number | null
          origin_port_id?: string | null
          package_category_id?: string | null
          package_size_id?: string | null
          provider_id?: string | null
          provider_type_id?: string | null
          quote_currency_id?: string | null
          quote_version_id: string
          rounding_rule?: string | null
          sell_subtotal?: number
          service_id?: string | null
          service_type_id?: string | null
          tenant_id: string
          total_amount?: number
          trade_direction_id?: string | null
          transit_time_days?: number | null
          validity_date?: string | null
        }
        Update: {
          auto_margin_enabled?: boolean
          buy_subtotal?: number
          container_size_id?: string | null
          container_type_id?: string | null
          created_at?: string
          currency_id?: string | null
          destination_port_id?: string | null
          free_time_days?: number | null
          id?: string
          margin_amount?: number
          margin_method_id?: string | null
          margin_value?: number | null
          min_margin?: number | null
          origin_port_id?: string | null
          package_category_id?: string | null
          package_size_id?: string | null
          provider_id?: string | null
          provider_type_id?: string | null
          quote_currency_id?: string | null
          quote_version_id?: string
          rounding_rule?: string | null
          sell_subtotal?: number
          service_id?: string | null
          service_type_id?: string | null
          tenant_id?: string
          total_amount?: number
          trade_direction_id?: string | null
          transit_time_days?: number | null
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_options_container_size_id_fkey"
            columns: ["container_size_id"]
            isOneToOne: false
            referencedRelation: "container_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_container_type_id_fkey"
            columns: ["container_type_id"]
            isOneToOne: false
            referencedRelation: "container_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_destination_port_id_fkey"
            columns: ["destination_port_id"]
            isOneToOne: false
            referencedRelation: "ports_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_margin_method_id_fkey"
            columns: ["margin_method_id"]
            isOneToOne: false
            referencedRelation: "margin_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_origin_port_id_fkey"
            columns: ["origin_port_id"]
            isOneToOne: false
            referencedRelation: "ports_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_package_category_id_fkey"
            columns: ["package_category_id"]
            isOneToOne: false
            referencedRelation: "package_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_package_size_id_fkey"
            columns: ["package_size_id"]
            isOneToOne: false
            referencedRelation: "package_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_provider_type_id_fkey"
            columns: ["provider_type_id"]
            isOneToOne: false
            referencedRelation: "provider_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_quote_currency_id_fkey"
            columns: ["quote_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_quote_version_id_fkey"
            columns: ["quote_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_options_trade_direction_id_fkey"
            columns: ["trade_direction_id"]
            isOneToOne: false
            referencedRelation: "trade_directions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_presentation_templates: {
        Row: {
          created_at: string | null
          font_family: string | null
          footer_template: string | null
          franchise_id: string | null
          header_template: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          layout_config: Json | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          show_buy_prices: boolean | null
          show_carrier_details: boolean | null
          show_transit_times: boolean | null
          template_name: string
          template_type: string
          tenant_id: string
          terms_conditions_template: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          font_family?: string | null
          footer_template?: string | null
          franchise_id?: string | null
          header_template?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          layout_config?: Json | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_buy_prices?: boolean | null
          show_carrier_details?: boolean | null
          show_transit_times?: boolean | null
          template_name: string
          template_type: string
          tenant_id: string
          terms_conditions_template?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          font_family?: string | null
          footer_template?: string | null
          franchise_id?: string | null
          header_template?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          layout_config?: Json | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_buy_prices?: boolean | null
          show_carrier_details?: boolean | null
          show_transit_times?: boolean | null
          template_name?: string
          template_type?: string
          tenant_id?: string
          terms_conditions_template?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_presentation_templates_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_presentation_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_selection: {
        Row: {
          id: string
          option_id: string
          quote_id: string
          reason: string | null
          selected_at: string
          selected_by: string | null
          tenant_id: string
          version_id: string
        }
        Insert: {
          id?: string
          option_id: string
          quote_id: string
          reason?: string | null
          selected_at?: string
          selected_by?: string | null
          tenant_id: string
          version_id: string
        }
        Update: {
          id?: string
          option_id?: string
          quote_id?: string
          reason?: string | null
          selected_at?: string
          selected_by?: string | null
          tenant_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_selection_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "quote_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_selection_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_selection_selected_by_fkey"
            columns: ["selected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_selection_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_sequences_franchise: {
        Row: {
          franchise_id: string
          last_reset_bucket: string | null
          seq_value: number
          tenant_id: string
        }
        Insert: {
          franchise_id: string
          last_reset_bucket?: string | null
          seq_value?: number
          tenant_id: string
        }
        Update: {
          franchise_id?: string
          last_reset_bucket?: string | null
          seq_value?: number
          tenant_id?: string
        }
        Relationships: []
      }
      quote_sequences_tenant: {
        Row: {
          last_reset_bucket: string | null
          seq_value: number
          tenant_id: string
        }
        Insert: {
          last_reset_bucket?: string | null
          seq_value?: number
          tenant_id: string
        }
        Update: {
          last_reset_bucket?: string | null
          seq_value?: number
          tenant_id?: string
        }
        Relationships: []
      }
      quote_shares: {
        Row: {
          access_type: string | null
          created_at: string | null
          created_by: string | null
          current_views: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          max_views: number | null
          quote_id: string
          share_token: string
          tenant_id: string
        }
        Insert: {
          access_type?: string | null
          created_at?: string | null
          created_by?: string | null
          current_views?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          max_views?: number | null
          quote_id: string
          share_token: string
          tenant_id: string
        }
        Update: {
          access_type?: string | null
          created_at?: string | null
          created_by?: string | null
          current_views?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          max_views?: number | null
          quote_id?: string
          share_token?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_shares_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_shares_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          category: string | null
          content: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          category?: string | null
          content?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          category?: string | null
          content?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          created_at: string | null
          id: string
          quote_id: string
          snapshot: Json
          tenant_id: string
          total: number | null
          version_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          quote_id: string
          snapshot: Json
          tenant_id: string
          total?: number | null
          version_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          quote_id?: string
          snapshot?: Json
          tenant_id?: string
          total?: number | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
          current_version_id: string | null
          description: string | null
          destination_location: Json | null
          destination_port_id: string | null
          discount_amount: number | null
          discount_percent: number | null
          franchise_id: string | null
          id: string
          incoterm_id: string | null
          incoterms: string | null
          is_hazmat: boolean | null
          is_primary: boolean | null
          margin_amount: number | null
          margin_percentage: number | null
          notes: string | null
          opportunity_id: string | null
          origin_location: Json | null
          origin_port_id: string | null
          owner_id: string | null
          payment_terms: string | null
          priority: string | null
          quote_number: string
          ready_date: string | null
          regulatory_data: Json | null
          rejected_at: string | null
          sell_price: number | null
          service_id: string | null
          service_level: string | null
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
          current_version_id?: string | null
          description?: string | null
          destination_location?: Json | null
          destination_port_id?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          franchise_id?: string | null
          id?: string
          incoterm_id?: string | null
          incoterms?: string | null
          is_hazmat?: boolean | null
          is_primary?: boolean | null
          margin_amount?: number | null
          margin_percentage?: number | null
          notes?: string | null
          opportunity_id?: string | null
          origin_location?: Json | null
          origin_port_id?: string | null
          owner_id?: string | null
          payment_terms?: string | null
          priority?: string | null
          quote_number: string
          ready_date?: string | null
          regulatory_data?: Json | null
          rejected_at?: string | null
          sell_price?: number | null
          service_id?: string | null
          service_level?: string | null
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
          current_version_id?: string | null
          description?: string | null
          destination_location?: Json | null
          destination_port_id?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          franchise_id?: string | null
          id?: string
          incoterm_id?: string | null
          incoterms?: string | null
          is_hazmat?: boolean | null
          is_primary?: boolean | null
          margin_amount?: number | null
          margin_percentage?: number | null
          notes?: string | null
          opportunity_id?: string | null
          origin_location?: Json | null
          origin_port_id?: string | null
          owner_id?: string | null
          payment_terms?: string | null
          priority?: string | null
          quote_number?: string
          ready_date?: string | null
          regulatory_data?: Json | null
          rejected_at?: string | null
          sell_price?: number | null
          service_id?: string | null
          service_level?: string | null
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
            foreignKeyName: "quotes_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
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
      rate_components: {
        Row: {
          calc_method: string
          component_type: string
          created_at: string | null
          id: string
          max_amount: number | null
          metadata: Json | null
          min_amount: number | null
          notes: string | null
          rate_id: string
          tenant_id: string
          value: number
        }
        Insert: {
          calc_method: string
          component_type: string
          created_at?: string | null
          id?: string
          max_amount?: number | null
          metadata?: Json | null
          min_amount?: number | null
          notes?: string | null
          rate_id: string
          tenant_id: string
          value: number
        }
        Update: {
          calc_method?: string
          component_type?: string
          created_at?: string | null
          id?: string
          max_amount?: number | null
          metadata?: Json | null
          min_amount?: number | null
          notes?: string | null
          rate_id?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_components_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
        ]
      }
      rates: {
        Row: {
          base_price: number | null
          carrier_id: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string | null
          currency: string | null
          destination: string
          franchise_id: string | null
          id: string
          metadata: Json | null
          mode: Database["public"]["Enums"]["transport_mode"]
          origin: string
          tenant_id: string
          updated_at: string | null
          validity_end: string | null
          validity_start: string | null
        }
        Insert: {
          base_price?: number | null
          carrier_id?: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          currency?: string | null
          destination: string
          franchise_id?: string | null
          id?: string
          metadata?: Json | null
          mode: Database["public"]["Enums"]["transport_mode"]
          origin: string
          tenant_id: string
          updated_at?: string | null
          validity_end?: string | null
          validity_start?: string | null
        }
        Update: {
          base_price?: number | null
          carrier_id?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          currency?: string | null
          destination?: string
          franchise_id?: string | null
          id?: string
          metadata?: Json | null
          mode?: Database["public"]["Enums"]["transport_mode"]
          origin?: string
          tenant_id?: string
          updated_at?: string | null
          validity_end?: string | null
          validity_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rates_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
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
        Relationships: [
          {
            foreignKeyName: "routes_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_origin_warehouse_id_fkey"
            columns: ["origin_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_events: {
        Row: {
          email_id: string
          id: string
          metadata: Json | null
          queue: string
          routed_at: string | null
          sla_minutes: number | null
        }
        Insert: {
          email_id: string
          id?: string
          metadata?: Json | null
          queue: string
          routed_at?: string | null
          sla_minutes?: number | null
        }
        Update: {
          email_id?: string
          id?: string
          metadata?: Json | null
          queue?: string
          routed_at?: string | null
          sla_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "routing_events_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          account_id: string | null
          bcc_emails: Json | null
          body_html: string | null
          body_text: string | null
          cc_emails: Json | null
          created_at: string
          error_message: string | null
          franchise_id: string | null
          id: string
          max_retries: number | null
          metadata: Json | null
          priority: string | null
          retry_count: number | null
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          template_variables: Json | null
          tenant_id: string
          to_emails: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string
          error_message?: string | null
          franchise_id?: string | null
          id?: string
          max_retries?: number | null
          metadata?: Json | null
          priority?: string | null
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          template_variables?: Json | null
          tenant_id: string
          to_emails: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string
          error_message?: string | null
          franchise_id?: string | null
          id?: string
          max_retries?: number | null
          metadata?: Json | null
          priority?: string | null
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          template_variables?: Json | null
          tenant_id?: string
          to_emails?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migration_progress: {
        Row: {
          next_index: number
          total_statements: number | null
          updated_at: string | null
          version: string
        }
        Insert: {
          next_index?: number
          total_statements?: number | null
          updated_at?: string | null
          version: string
        }
        Update: {
          next_index?: number
          total_statements?: number | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      schema_migrations: {
        Row: {
          applied_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          success: boolean | null
          version: string
        }
        Insert: {
          applied_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          success?: boolean | null
          version: string
        }
        Update: {
          applied_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          success?: boolean | null
          version?: string
        }
        Relationships: []
      }
      service_details: {
        Row: {
          attributes: Json
          created_at: string | null
          id: string
          service_id: string
          tenant_id: string
        }
        Insert: {
          attributes: Json
          created_at?: string | null
          id?: string
          service_id: string
          tenant_id: string
        }
        Update: {
          attributes?: Json
          created_at?: string | null
          id?: string
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_details_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_leg_categories: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
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
          conditions: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          priority: number | null
          service_id: string | null
          service_type: string | null
          service_type_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          priority?: number | null
          service_id?: string | null
          service_type?: string | null
          service_type_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          priority?: number | null
          service_id?: string | null
          service_type?: string | null
          service_type_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_type_mappings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          dim_divisor: number | null
          id: string
          is_active: boolean | null
          mode_id: string | null
          name: string
          updated_at: string | null
          use_dimensional_weight: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          dim_divisor?: number | null
          id?: string
          is_active?: boolean | null
          mode_id?: string | null
          name: string
          updated_at?: string | null
          use_dimensional_weight?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          dim_divisor?: number | null
          id?: string
          is_active?: boolean | null
          mode_id?: string | null
          name?: string
          updated_at?: string | null
          use_dimensional_weight?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "service_types_mode_id_fkey"
            columns: ["mode_id"]
            isOneToOne: false
            referencedRelation: "transport_modes"
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
          shipment_type: Database["public"]["Enums"]["shipment_type"] | null
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
          shipment_type?: Database["public"]["Enums"]["shipment_type"] | null
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
          shipment_type?: Database["public"]["Enums"]["shipment_type"] | null
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
      shipment_attachments: {
        Row: {
          content_type: string | null
          created_by: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          franchise_id: string | null
          id: string
          name: string
          path: string
          public_url: string | null
          shipment_id: string
          size: number | null
          tenant_id: string | null
          uploaded_at: string
        }
        Insert: {
          content_type?: string | null
          created_by?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          franchise_id?: string | null
          id?: string
          name: string
          path: string
          public_url?: string | null
          shipment_id: string
          size?: number | null
          tenant_id?: string | null
          uploaded_at?: string
        }
        Update: {
          content_type?: string | null
          created_by?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          franchise_id?: string | null
          id?: string
          name?: string
          path?: string
          public_url?: string | null
          shipment_id?: string
          size?: number | null
          tenant_id?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_attachments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
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
        Relationships: [
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          account_id: string | null
          actual_delivery_date: string | null
          assigned_to: string | null
          contact_id: string | null
          container_number: string | null
          container_type: Database["public"]["Enums"]["container_type"] | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          current_location: Json | null
          current_status_description: string | null
          customs_charges: number | null
          customs_required: boolean | null
          declared_value: number | null
          destination_address: Json
          destination_warehouse_id: string | null
          driver_id: string | null
          estimated_delivery_date: string | null
          franchise_id: string | null
          freight_charges: number | null
          id: string
          insurance_charges: number | null
          insurance_required: boolean | null
          invoice_number: string | null
          origin_address: Json
          origin_warehouse_id: string | null
          other_charges: number | null
          pickup_date: string | null
          pod_documents: Json | null
          pod_notes: string | null
          pod_received: boolean
          pod_received_at: string | null
          pod_received_by: string | null
          pod_signature_url: string | null
          pod_status: string | null
          priority_level: string | null
          purchase_order_number: string | null
          reference_number: string | null
          service_level: string | null
          shipment_number: string
          shipment_type: Database["public"]["Enums"]["shipment_type"]
          special_instructions: string | null
          status: Database["public"]["Enums"]["shipment_status"] | null
          tenant_id: string
          total_charges: number | null
          total_packages: number | null
          total_volume_cbm: number | null
          total_weight_kg: number | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          account_id?: string | null
          actual_delivery_date?: string | null
          assigned_to?: string | null
          contact_id?: string | null
          container_number?: string | null
          container_type?: Database["public"]["Enums"]["container_type"] | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          current_location?: Json | null
          current_status_description?: string | null
          customs_charges?: number | null
          customs_required?: boolean | null
          declared_value?: number | null
          destination_address?: Json
          destination_warehouse_id?: string | null
          driver_id?: string | null
          estimated_delivery_date?: string | null
          franchise_id?: string | null
          freight_charges?: number | null
          id?: string
          insurance_charges?: number | null
          insurance_required?: boolean | null
          invoice_number?: string | null
          origin_address?: Json
          origin_warehouse_id?: string | null
          other_charges?: number | null
          pickup_date?: string | null
          pod_documents?: Json | null
          pod_notes?: string | null
          pod_received?: boolean
          pod_received_at?: string | null
          pod_received_by?: string | null
          pod_signature_url?: string | null
          pod_status?: string | null
          priority_level?: string | null
          purchase_order_number?: string | null
          reference_number?: string | null
          service_level?: string | null
          shipment_number: string
          shipment_type: Database["public"]["Enums"]["shipment_type"]
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["shipment_status"] | null
          tenant_id: string
          total_charges?: number | null
          total_packages?: number | null
          total_volume_cbm?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          account_id?: string | null
          actual_delivery_date?: string | null
          assigned_to?: string | null
          contact_id?: string | null
          container_number?: string | null
          container_type?: Database["public"]["Enums"]["container_type"] | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          current_location?: Json | null
          current_status_description?: string | null
          customs_charges?: number | null
          customs_required?: boolean | null
          declared_value?: number | null
          destination_address?: Json
          destination_warehouse_id?: string | null
          driver_id?: string | null
          estimated_delivery_date?: string | null
          franchise_id?: string | null
          freight_charges?: number | null
          id?: string
          insurance_charges?: number | null
          insurance_required?: boolean | null
          invoice_number?: string | null
          origin_address?: Json
          origin_warehouse_id?: string | null
          other_charges?: number | null
          pickup_date?: string | null
          pod_documents?: Json | null
          pod_notes?: string | null
          pod_received?: boolean
          pod_received_at?: string | null
          pod_received_by?: string | null
          pod_signature_url?: string | null
          pod_status?: string | null
          priority_level?: string | null
          purchase_order_number?: string | null
          reference_number?: string | null
          service_level?: string | null
          shipment_number?: string
          shipment_type?: Database["public"]["Enums"]["shipment_type"]
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["shipment_status"] | null
          tenant_id?: string
          total_charges?: number | null
          total_packages?: number | null
          total_volume_cbm?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
        Relationships: [
          {
            foreignKeyName: "states_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
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
          billing_period: Database["public"]["Enums"]["billing_period"]
          created_at: string | null
          currency: string
          deployment_model: string | null
          description: string | null
          features: Json
          id: string
          is_active: boolean
          limits: Json
          max_users: number | null
          metadata: Json | null
          min_users: number | null
          name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          price_annual: number | null
          price_monthly: number
          price_quarterly: number | null
          slug: string
          sort_order: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          supported_currencies: string[] | null
          supported_languages: string[] | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          trial_period_days: number | null
          updated_at: string | null
          user_scaling_factor: number | null
        }
        Insert: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string | null
          currency?: string
          deployment_model?: string | null
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          max_users?: number | null
          metadata?: Json | null
          min_users?: number | null
          name: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          price_annual?: number | null
          price_monthly: number
          price_quarterly?: number | null
          slug: string
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          supported_currencies?: string[] | null
          supported_languages?: string[] | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          trial_period_days?: number | null
          updated_at?: string | null
          user_scaling_factor?: number | null
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string | null
          currency?: string
          deployment_model?: string | null
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          max_users?: number | null
          metadata?: Json | null
          min_users?: number | null
          name?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          price_annual?: number | null
          price_monthly?: number
          price_quarterly?: number | null
          slug?: string
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          supported_currencies?: string[] | null
          supported_languages?: string[] | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          trial_period_days?: number | null
          updated_at?: string | null
          user_scaling_factor?: number | null
        }
        Relationships: []
      }
      tenant_subscriptions: {
        Row: {
          auto_renew: boolean
          canceled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          ended_at: string | null
          id: string
          metadata: Json | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          trial_end: string | null
          updated_at: string | null
        }
        Insert: {
          auto_renew?: boolean
          canceled_at?: string | null
          created_at?: string | null
          current_period_end: string
          current_period_start?: string
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_renew?: boolean
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          trial_end?: string | null
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
          billing_address: Json | null
          billing_email: string | null
          created_at: string | null
          domain: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          payment_method: Json | null
          settings: Json | null
          slug: string
          stripe_customer_id: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          billing_address?: Json | null
          billing_email?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          payment_method?: Json | null
          settings?: Json | null
          slug: string
          stripe_customer_id?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_address?: Json | null
          billing_email?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          payment_method?: Json | null
          settings?: Json | null
          slug?: string
          stripe_customer_id?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      territories: {
        Row: {
          created_at: string | null
          criteria: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      territory_assignments: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          territory_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          territory_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          territory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_assignments_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_geographies: {
        Row: {
          city_id: string | null
          continent_id: string | null
          country_id: string | null
          created_at: string | null
          id: string
          state_id: string | null
          territory_id: string
        }
        Insert: {
          city_id?: string | null
          continent_id?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          state_id?: string | null
          territory_id: string
        }
        Update: {
          city_id?: string | null
          continent_id?: string | null
          country_id?: string | null
          created_at?: string | null
          id?: string
          state_id?: string | null
          territory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_geographies_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_geographies_continent_id_fkey"
            columns: ["continent_id"]
            isOneToOne: false
            referencedRelation: "continents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_geographies_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_geographies_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_geographies_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          borders: Json | null
          colors: Json | null
          created_at: string | null
          created_by: string | null
          custom_css: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          shadows: Json | null
          spacing: Json | null
          tenant_id: string | null
          typography: Json | null
          updated_at: string | null
        }
        Insert: {
          borders?: Json | null
          colors?: Json | null
          created_at?: string | null
          created_by?: string | null
          custom_css?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          shadows?: Json | null
          spacing?: Json | null
          tenant_id?: string | null
          typography?: Json | null
          updated_at?: string | null
        }
        Update: {
          borders?: Json | null
          colors?: Json | null
          created_at?: string | null
          created_by?: string | null
          custom_css?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          shadows?: Json | null
          spacing?: Json | null
          tenant_id?: string | null
          typography?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "themes_tenant_id_fkey"
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
          created_by: string | null
          description: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["tracking_event_type"]
          id: string
          is_milestone: boolean | null
          location: Json | null
          location_name: string | null
          notes: string | null
          shipment_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_type: Database["public"]["Enums"]["tracking_event_type"]
          id?: string
          is_milestone?: boolean | null
          location?: Json | null
          location_name?: string | null
          notes?: string | null
          shipment_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["tracking_event_type"]
          id?: string
          is_milestone?: boolean | null
          location?: Json | null
          location_name?: string | null
          notes?: string | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_directions: {
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
      transport_modes: {
        Row: {
          code: string
          color: string
          created_at: string | null
          display_order: number
          icon_name: string
          id: string
          is_active: boolean | null
          name: string
          supported_units: Json | null
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          code: string
          color: string
          created_at?: string | null
          display_order?: number
          icon_name: string
          id?: string
          is_active?: boolean | null
          name: string
          supported_units?: Json | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          code?: string
          color?: string
          created_at?: string | null
          display_order?: number
          icon_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          supported_units?: Json | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: []
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
          metadata: Json | null
          period_end: string
          period_start: string
          subscription_id: string | null
          tenant_id: string
          updated_at: string | null
          usage_count: number
        }
        Insert: {
          created_at?: string | null
          feature_key: string
          id?: string
          limit_count?: number | null
          metadata?: Json | null
          period_end: string
          period_start: string
          subscription_id?: string | null
          tenant_id: string
          updated_at?: string | null
          usage_count?: number
        }
        Update: {
          created_at?: string | null
          feature_key?: string
          id?: string
          limit_count?: number | null
          metadata?: Json | null
          period_end?: string
          period_start?: string
          subscription_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
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
        Relationships: []
      }
      user_custom_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          franchise_id: string | null
          id: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          franchise_id?: string | null
          id?: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          franchise_id?: string | null
          id?: string
          role_id?: string
          tenant_id?: string
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
      user_preferences: {
        Row: {
          admin_override_enabled: boolean
          created_at: string
          franchise_id: string | null
          id: string
          language: string | null
          notifications_enabled: boolean | null
          tenant_id: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_override_enabled?: boolean
          created_at?: string
          franchise_id?: string | null
          id?: string
          language?: string | null
          notifications_enabled?: boolean | null
          tenant_id?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_override_enabled?: boolean
          created_at?: string
          franchise_id?: string | null
          id?: string
          language?: string | null
          notifications_enabled?: boolean | null
          tenant_id?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          franchise_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          franchise_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          franchise_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity_cbm: number | null
          capacity_kg: number | null
          created_at: string | null
          current_location: Json | null
          driver_id: string | null
          franchise_id: string | null
          id: string
          insurance_expiry: string | null
          is_active: boolean | null
          last_maintenance_date: string | null
          make: string | null
          model: string | null
          next_maintenance_date: string | null
          registration_expiry: string | null
          status: Database["public"]["Enums"]["vehicle_status"] | null
          tenant_id: string
          updated_at: string | null
          vehicle_number: string
          vehicle_type: string
          year: number | null
        }
        Insert: {
          capacity_cbm?: number | null
          capacity_kg?: number | null
          created_at?: string | null
          current_location?: Json | null
          driver_id?: string | null
          franchise_id?: string | null
          id?: string
          insurance_expiry?: string | null
          is_active?: boolean | null
          last_maintenance_date?: string | null
          make?: string | null
          model?: string | null
          next_maintenance_date?: string | null
          registration_expiry?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"] | null
          tenant_id: string
          updated_at?: string | null
          vehicle_number: string
          vehicle_type: string
          year?: number | null
        }
        Update: {
          capacity_cbm?: number | null
          capacity_kg?: number | null
          created_at?: string | null
          current_location?: Json | null
          driver_id?: string | null
          franchise_id?: string | null
          id?: string
          insurance_expiry?: string | null
          is_active?: boolean | null
          last_maintenance_date?: string | null
          make?: string | null
          model?: string | null
          next_maintenance_date?: string | null
          registration_expiry?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"] | null
          tenant_id?: string
          updated_at?: string | null
          vehicle_number?: string
          vehicle_type?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vessel_classes: {
        Row: {
          beam_limit_meters: number | null
          draft_limit_meters: number | null
          id: string
          max_teu: number | null
          min_teu: number | null
          name: string
          type_id: string | null
        }
        Insert: {
          beam_limit_meters?: number | null
          draft_limit_meters?: number | null
          id?: string
          max_teu?: number | null
          min_teu?: number | null
          name: string
          type_id?: string | null
        }
        Update: {
          beam_limit_meters?: number | null
          draft_limit_meters?: number | null
          id?: string
          max_teu?: number | null
          min_teu?: number | null
          name?: string
          type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vessel_classes_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "vessel_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vessel_class_capacities: {
        Row: {
          class_id: string | null
          container_size_id: string | null
          created_at: string | null
          id: string
          max_slots: number | null
          tenant_id: string | null
          weight_limit_per_slot_kg: number | null
        }
        Insert: {
          class_id?: string | null
          container_size_id?: string | null
          created_at?: string | null
          id?: string
          max_slots?: number | null
          tenant_id?: string | null
          weight_limit_per_slot_kg?: number | null
        }
        Update: {
          class_id?: string | null
          container_size_id?: string | null
          created_at?: string | null
          id?: string
          max_slots?: number | null
          tenant_id?: string | null
          weight_limit_per_slot_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vessel_class_capacities_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vessel_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vessel_class_capacities_container_size_id_fkey"
            columns: ["container_size_id"]
            isOneToOne: false
            referencedRelation: "container_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vessel_class_capacities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      vessel_operational_metrics: {
        Row: {
          average_speed_knots: number | null
          fuel_efficiency_index: number | null
          id: string
          port_calls_count: number | null
          recorded_at: string | null
          transit_time_hours: number | null
          vessel_id: string | null
        }
        Insert: {
          average_speed_knots?: number | null
          fuel_efficiency_index?: number | null
          id?: string
          port_calls_count?: number | null
          recorded_at?: string | null
          transit_time_hours?: number | null
          vessel_id?: string | null
        }
        Update: {
          average_speed_knots?: number | null
          fuel_efficiency_index?: number | null
          id?: string
          port_calls_count?: number | null
          recorded_at?: string | null
          transit_time_hours?: number | null
          vessel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vessel_operational_metrics_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      vessel_types: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      vessels: {
        Row: {
          built_year: number | null
          capacity_teu: number | null
          carrier_id: string | null
          class_id: string | null
          current_status: string | null
          flag_country: string | null
          id: string
          imo_number: string | null
          metadata: Json | null
          name: string
          tenant_id: string | null
        }
        Insert: {
          built_year?: number | null
          capacity_teu?: number | null
          carrier_id?: string | null
          class_id?: string | null
          current_status?: string | null
          flag_country?: string | null
          id?: string
          imo_number?: string | null
          metadata?: Json | null
          name: string
          tenant_id?: string | null
        }
        Update: {
          built_year?: number | null
          capacity_teu?: number | null
          carrier_id?: string | null
          class_id?: string | null
          current_status?: string | null
          flag_country?: string | null
          id?: string
          imo_number?: string | null
          metadata?: Json | null
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vessels_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vessels_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vessel_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vessels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_inventory: {
        Row: {
          created_at: string | null
          expected_dispatch_date: string | null
          id: string
          item_description: string
          location_in_warehouse: string | null
          quantity: number
          received_date: string | null
          shipment_id: string | null
          status: string | null
          updated_at: string | null
          volume_cbm: number | null
          warehouse_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          expected_dispatch_date?: string | null
          id?: string
          item_description: string
          location_in_warehouse?: string | null
          quantity?: number
          received_date?: string | null
          shipment_id?: string | null
          status?: string | null
          updated_at?: string | null
          volume_cbm?: number | null
          warehouse_id: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          expected_dispatch_date?: string | null
          id?: string
          item_description?: string
          location_in_warehouse?: string | null
          quantity?: number
          received_date?: string | null
          shipment_id?: string | null
          status?: string | null
          updated_at?: string | null
          volume_cbm?: number | null
          warehouse_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_inventory_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: Json | null
          capacity_sqft: number | null
          code: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          current_utilization: number | null
          facilities: Json | null
          franchise_id: string | null
          id: string
          is_active: boolean | null
          name: string
          operating_hours: Json | null
          tenant_id: string
          updated_at: string | null
          warehouse_type: string | null
        }
        Insert: {
          address?: Json | null
          capacity_sqft?: number | null
          code: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          current_utilization?: number | null
          facilities?: Json | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          operating_hours?: Json | null
          tenant_id: string
          updated_at?: string | null
          warehouse_type?: string | null
        }
        Update: {
          address?: Json | null
          capacity_sqft?: number | null
          code?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          current_utilization?: number | null
          facilities?: Json | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          operating_hours?: Json | null
          tenant_id?: string
          updated_at?: string | null
          warehouse_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
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
      view_container_inventory_summary: {
        Row: {
          category: string | null
          id: string | null
          iso_code: string | null
          location_name: string | null
          size: string | null
          size_id: string | null
          status: Database["public"]["Enums"]["container_status"] | null
          tenant_id: string | null
          total_quantity: number | null
          total_teu: number | null
        }
        Relationships: [
          {
            foreignKeyName: "container_tracking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _current_reset_bucket: { Args: { p_policy: string }; Returns: string }
      accept_quote_by_token: {
        Args: {
          p_decision: string
          p_email: string
          p_ip: string
          p_name: string
          p_token: string
          p_user_agent: string
        }
        Returns: Json
      }
      assign_franchisee_account_contact: {
        Args: {
          p_account_data: Json
          p_contact_data: Json
          p_franchise_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      assign_lead_with_transaction: {
        Args: {
          p_assigned_to: string
          p_assignment_method: string
          p_franchise_id: string
          p_lead_id: string
          p_rule_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      calculate_dimensional_weight: {
        Args: {
          p_divisor?: number
          p_height_cm: number
          p_length_cm: number
          p_width_cm: number
        }
        Returns: number
      }
      calculate_lead_score: { Args: { lead_id: string }; Returns: number }
      calculate_next_version_number: {
        Args: { p_quote_id: string }
        Returns: number
      }
      calculate_option_margins: {
        Args: { p_option_id: string }
        Returns: {
          charge_count: number
          margin_amount: number
          margin_percentage: number
          total_buy: number
          total_sell: number
        }[]
      }
      calculate_option_totals: {
        Args: { p_option_id: string }
        Returns: {
          charge_count: number
          leg_count: number
          total_buy: number
          total_sell: number
        }[]
      }
      check_usage_limit: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: boolean
      }
      cleanup_old_logs: { Args: { days_to_keep?: number }; Returns: undefined }
      compare_versions: {
        Args: { p_version_id_1: string; p_version_id_2: string }
        Returns: Json
      }
      create_quote_share: {
        Args: {
          p_expires_in_days?: number
          p_quote_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      decrement_user_lead_count: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      drop_policy_if_exists: {
        Args: { policy_name: string; table_name: string }
        Returns: undefined
      }
      evaluate_provider_rate_rules: {
        Args: {
          p_carrier_id: string
          p_quote_data: Json
          p_service_type_id: string
        }
        Returns: {
          actions: Json
          rule_id: string
          rule_name: string
          rule_type: string
          validation_message: string
        }[]
      }
      execute_insert_batch: { Args: { statements: string[] }; Returns: Json }
      execute_sql_query: { Args: { query_text: string }; Returns: Json }
      execute_transfer: {
        Args: { p_approver_id: string; p_transfer_id: string }
        Returns: Json
      }
      generate_next_option_name: {
        Args: { p_version_id: string }
        Returns: string
      }
      generate_quote_number: {
        Args: { p_franchise_id?: string; p_tenant_id: string }
        Returns: string
      }
      generate_share_token: { Args: never; Returns: string }
      get_all_database_schema: {
        Args: never
        Returns: {
          character_maximum_length: number
          column_default: string
          column_name: string
          data_type: string
          is_foreign_key: boolean
          is_nullable: boolean
          is_primary_key: boolean
          references_column: string
          references_schema: string
          references_table: string
          schema_name: string
          table_name: string
          udt_name: string
          udt_schema: string
        }[]
      }
      get_all_database_tables:
        | {
            Args: never
            Returns: {
              column_count: number
              index_count: number
              policy_count: number
              rls_enabled: boolean
              row_estimate: number
              schema_name: string
              table_name: string
              table_type: string
            }[]
          }
        | {
            Args: { schemas?: string[] }
            Returns: {
              row_estimate: number
              schema_name: string
              table_name: string
              table_type: string
            }[]
          }
      get_all_rls_policies: {
        Args: never
        Returns: {
          command: string
          policy_name: string
          roles: string[]
          schema_name: string
          table_name: string
          using_expression: string
          with_check_expression: string
        }[]
      }
      get_applicable_provider_surcharges: {
        Args: {
          p_carrier_id: string
          p_country_code?: string
          p_is_hazmat?: boolean
          p_is_temperature_controlled?: boolean
          p_service_type: string
          p_weight_kg: number
        }
        Returns: {
          calculation_type: string
          currency_code: string
          rate: number
          surcharge_code: string
          surcharge_id: string
          surcharge_name: string
        }[]
      }
      get_auth_users_export: {
        Args: never
        Returns: {
          app_metadata: Json
          banned_until: string
          confirmation_token: string
          created_at: string
          deleted_at: string
          email: string
          email_change: string
          email_change_token_new: string
          email_confirmed_at: string
          encrypted_password: string
          id: string
          invited_at: string
          is_sso_user: boolean
          phone: string
          phone_change: string
          phone_change_token: string
          phone_confirmed_at: string
          recovery_token: string
          updated_at: string
          user_metadata: Json
        }[]
      }
      get_chargeable_weight: {
        Args: { p_actual_weight_kg: number; p_volumetric_weight_kg: number }
        Returns: number
      }
      get_database_enums: {
        Args: never
        Returns: {
          enum_type: string
          labels: string
        }[]
      }
      get_database_functions: {
        Args: never
        Returns: {
          argument_types: string
          description: string
          kind: string
          language: string
          name: string
          return_type: string
          schema: string
          security_definer: boolean
          volatility: string
        }[]
      }
      get_database_functions_with_body: {
        Args: never
        Returns: {
          argument_types: string
          description: string
          function_definition: string
          kind: string
          language: string
          name: string
          return_type: string
          schema: string
          security_definer: boolean
          volatility: string
        }[]
      }
      get_database_schema: {
        Args: never
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          is_foreign_key: boolean
          is_nullable: boolean
          is_primary_key: boolean
          references_column: string
          references_table: string
          table_name: string
        }[]
      }
      get_database_tables: {
        Args: never
        Returns: {
          column_count: number
          index_count: number
          policy_count: number
          rls_enabled: boolean
          row_estimate: number
          table_name: string
          table_type: string
        }[]
      }
      get_delegated_email_account_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_fk_orphans: {
        Args: never
        Returns: {
          child_column: string
          constraint_name: string
          constraint_schema: string
          orphan_count: number
          parent_column: string
          parent_schema: string
          parent_table: string
          table_name: string
        }[]
      }
      get_franchise_user_ids: {
        Args: { _franchise_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_platform_admins: {
        Args: never
        Returns: {
          assigned_at: string
          email: string
          first_name: string
          is_active: boolean
          last_name: string
          user_id: string
        }[]
      }
      get_queue_counts: { Args: never; Returns: Json }
      get_queue_tenant_id_secure: {
        Args: { p_queue_id: string }
        Returns: string
      }
      get_quote_by_token: { Args: { p_token: string }; Returns: Json }
      get_rls_policies: {
        Args: never
        Returns: {
          command: string
          policy_name: string
          roles: string
          table_name: string
          using_expression: string
        }[]
      }
      get_rls_status: {
        Args: never
        Returns: {
          policy_count: number
          rls_enabled: boolean
          table_name: string
        }[]
      }
      get_sales_manager_team_user_ids: {
        Args: { _manager_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_storage_objects_export: {
        Args: never
        Returns: {
          bucket_id: string
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          owner: string
          updated_at: string
        }[]
      }
      get_table_constraints: {
        Args: never
        Returns: {
          constraint_details: string
          constraint_name: string
          constraint_type: string
          schema_name: string
          table_name: string
        }[]
      }
      get_table_count: {
        Args: { target_schema: string; target_table: string }
        Returns: number
      }
      get_table_data_dynamic: {
        Args: {
          limit_val?: number
          offset_val?: number
          target_schema: string
          target_table: string
        }
        Returns: Json
      }
      get_table_data_incremental: {
        Args: {
          limit_val?: number
          min_timestamp: string
          offset_val?: number
          target_schema: string
          target_table: string
        }
        Returns: Json
      }
      get_table_indexes: {
        Args: never
        Returns: {
          index_definition: string
          index_name: string
          schema_name: string
          table_name: string
        }[]
      }
      get_tenant_plan_tier: {
        Args: { _tenant_id: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
      get_tier_rate: {
        Args: { p_tier_config_id: string; p_value: number }
        Returns: {
          currency_id: string
          max_value: number
          min_value: number
          range_id: string
          rate: number
        }[]
      }
      get_user_custom_permissions: {
        Args: { check_user_id: string }
        Returns: {
          access_type: string
          permission_key: string
        }[]
      }
      get_user_email_account_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_franchise_id: {
        Args: { check_user_id: string }
        Returns: string
      }
      get_user_queues: {
        Args: never
        Returns: {
          description: string
          email_count: number
          queue_id: string
          queue_name: string
          queue_type: string
          unread_count: number
        }[]
      }
      get_user_tenant_id: { Args: { check_user_id: string }; Returns: string }
      get_weight_break_rate: {
        Args: {
          p_carrier_id: string
          p_effective_date?: string
          p_service_type_id: string
          p_tenant_id: string
          p_weight_kg: number
        }
        Returns: {
          currency_id: string
          id: string
          max_weight_kg: number
          min_weight_kg: number
          rate_per_kg: number
        }[]
      }
      has_role: {
        Args: {
          check_role: Database["public"]["Enums"]["app_role"]
          check_user_id: string
        }
        Returns: boolean
      }
      increment_feature_usage: {
        Args: { _feature_key: string; _increment?: number; _tenant_id: string }
        Returns: undefined
      }
      increment_user_lead_count: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      is_actual_platform_admin: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      is_current_user_platform_admin: { Args: never; Returns: boolean }
      is_franchise_admin: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_queue_member_secure: {
        Args: { p_queue_id: string; p_user_id: string }
        Returns: boolean
      }
      is_sales_manager: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: { Args: { _user_id: string }; Returns: boolean }
      is_viewer: { Args: { _user_id: string }; Returns: boolean }
      logic_nexus_import_dry_run: {
        Args: { p_schema?: string; p_tables: Json }
        Returns: Json
      }
      preview_next_quote_number: {
        Args: { p_franchise_id?: string; p_tenant_id: string }
        Returns: string
      }
      record_customer_selection: {
        Args: {
          p_option_id: string
          p_quote_id: string
          p_reason: string
          p_tenant_id: string
          p_user_id: string
          p_version_id: string
        }
        Returns: undefined
      }
      reload_postgrest_schema: { Args: never; Returns: undefined }
      restore_table_data:
        | {
            Args: {
              data: Json
              mode?: string
              target_schema: string
              target_table: string
            }
            Returns: Json
          }
        | {
            Args: {
              conflict_target?: string[]
              data: Json
              mode?: string
              target_schema: string
              target_table: string
            }
            Returns: Json
          }
      set_admin_override: {
        Args: {
          p_enabled: boolean
          p_franchise_id?: string
          p_tenant_id?: string
        }
        Returns: undefined
      }
      set_current_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      set_user_scope_preference: {
        Args: {
          p_admin_override: boolean
          p_franchise_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      sync_opportunity_items_from_quote: {
        Args: { p_quote_id: string }
        Returns: undefined
      }
      tenant_has_feature: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "active" | "inactive" | "pending"
      account_type: "prospect" | "customer" | "partner" | "vendor"
      activity_status: "planned" | "in_progress" | "completed" | "cancelled"
      activity_type: "call" | "email" | "meeting" | "task" | "note"
      app_role:
        | "platform_admin"
        | "tenant_admin"
        | "franchise_admin"
        | "user"
        | "sales_manager"
        | "viewer"
      billing_period: "monthly" | "annual"
      compliance_status: "pass" | "warn" | "fail"
      container_status:
        | "empty"
        | "loaded"
        | "maintenance"
        | "reserved"
        | "in_transit"
      container_type:
        | "20ft_standard"
        | "40ft_standard"
        | "40ft_high_cube"
        | "45ft_high_cube"
        | "reefer"
        | "open_top"
        | "flat_rack"
        | "tank"
      contract_type: "spot" | "contracted"
      document_type:
        | "commercial_invoice"
        | "bill_of_lading"
        | "air_waybill"
        | "packing_list"
        | "customs_form"
        | "quote_pdf"
        | "proof_of_delivery"
      lead_source:
        | "website"
        | "referral"
        | "email"
        | "phone"
        | "social"
        | "event"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
        | "converted"
      opportunity_stage:
        | "prospecting"
        | "qualification"
        | "needs_analysis"
        | "value_proposition"
        | "proposal"
        | "negotiation"
        | "closed_won"
        | "closed_lost"
      plan_type: "crm_base" | "service_addon" | "bundle"
      priority_level: "low" | "medium" | "high" | "urgent"
      quote_reset_policy: "none" | "daily" | "monthly" | "yearly"
      quote_status: "draft" | "sent" | "accepted" | "expired" | "cancelled"
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
        | "ocean_freight"
        | "air_freight"
        | "inland_trucking"
        | "railway_transport"
        | "courier"
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
        | "starter"
        | "business"
        | "professional"
        | "enterprise"
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
      transfer_entity_type:
        | "lead"
        | "opportunity"
        | "quote"
        | "shipment"
        | "account"
        | "contact"
        | "activity"
      transfer_status:
        | "pending"
        | "approved"
        | "rejected"
        | "completed"
        | "failed"
      transfer_type:
        | "tenant_to_tenant"
        | "tenant_to_franchise"
        | "franchise_to_franchise"
      transport_mode:
        | "ocean"
        | "air"
        | "inland_trucking"
        | "courier"
        | "movers_packers"
      undefined: "active" | "inactive" | "pending"
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
      account_status: ["active", "inactive", "pending"],
      account_type: ["prospect", "customer", "partner", "vendor"],
      activity_status: ["planned", "in_progress", "completed", "cancelled"],
      activity_type: ["call", "email", "meeting", "task", "note"],
      app_role: [
        "platform_admin",
        "tenant_admin",
        "franchise_admin",
        "user",
        "sales_manager",
        "viewer",
      ],
      billing_period: ["monthly", "annual"],
      compliance_status: ["pass", "warn", "fail"],
      container_status: [
        "empty",
        "loaded",
        "maintenance",
        "reserved",
        "in_transit",
      ],
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
      contract_type: ["spot", "contracted"],
      document_type: [
        "commercial_invoice",
        "bill_of_lading",
        "air_waybill",
        "packing_list",
        "customs_form",
        "quote_pdf",
        "proof_of_delivery",
      ],
      lead_source: [
        "website",
        "referral",
        "email",
        "phone",
        "social",
        "event",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
        "converted",
      ],
      opportunity_stage: [
        "prospecting",
        "qualification",
        "needs_analysis",
        "value_proposition",
        "proposal",
        "negotiation",
        "closed_won",
        "closed_lost",
      ],
      plan_type: ["crm_base", "service_addon", "bundle"],
      priority_level: ["low", "medium", "high", "urgent"],
      quote_reset_policy: ["none", "daily", "monthly", "yearly"],
      quote_status: ["draft", "sent", "accepted", "expired", "cancelled"],
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
        "ocean_freight",
        "air_freight",
        "inland_trucking",
        "railway_transport",
        "courier",
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
        "starter",
        "business",
        "professional",
        "enterprise",
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
      transfer_entity_type: [
        "lead",
        "opportunity",
        "quote",
        "shipment",
        "account",
        "contact",
        "activity",
      ],
      transfer_status: [
        "pending",
        "approved",
        "rejected",
        "completed",
        "failed",
      ],
      transfer_type: [
        "tenant_to_tenant",
        "tenant_to_franchise",
        "franchise_to_franchise",
      ],
      transport_mode: [
        "ocean",
        "air",
        "inland_trucking",
        "courier",
        "movers_packers",
      ],
      undefined: ["active", "inactive", "pending"],
      vehicle_status: ["available", "in_use", "maintenance", "out_of_service"],
    },
  },
} as const
