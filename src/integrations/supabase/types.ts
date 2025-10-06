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
            foreignKeyName: "activities_tenant_id_fkey"
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
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_rates: {
        Row: {
          accessorial_fees: Json | null
          base_rate: number
          carrier_name: string
          created_at: string | null
          currency: string | null
          destination_location: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          origin_location: string | null
          rate_type: string
          service_id: string | null
          surcharges: Json | null
          tenant_id: string
          updated_at: string | null
          valid_from: string
          valid_until: string | null
          weight_break_max: number | null
          weight_break_min: number | null
        }
        Insert: {
          accessorial_fees?: Json | null
          base_rate: number
          carrier_name: string
          created_at?: string | null
          currency?: string | null
          destination_location?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          origin_location?: string | null
          rate_type: string
          service_id?: string | null
          surcharges?: Json | null
          tenant_id: string
          updated_at?: string | null
          valid_from: string
          valid_until?: string | null
          weight_break_max?: number | null
          weight_break_min?: number | null
        }
        Update: {
          accessorial_fees?: Json | null
          base_rate?: number
          carrier_name?: string
          created_at?: string | null
          currency?: string | null
          destination_location?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          origin_location?: string | null
          rate_type?: string
          service_id?: string | null
          surcharges?: Json | null
          tenant_id?: string
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
          weight_break_max?: number | null
          weight_break_min?: number | null
        }
        Relationships: [
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
          id: string
          is_active: boolean | null
          notes: string | null
          rating: number | null
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
          id?: string
          is_active?: boolean | null
          notes?: string | null
          rating?: number | null
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
          id?: string
          is_active?: boolean | null
          notes?: string | null
          rating?: number | null
          service_routes?: Json | null
          tenant_id?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
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
        Relationships: []
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
        }
        Insert: {
          account_id: string
          account_id_crm?: string | null
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
        }
        Update: {
          account_id?: string
          account_id_crm?: string | null
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
        Relationships: [
          {
            foreignKeyName: "lead_assignment_rules_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
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
            foreignKeyName: "leads_tenant_id_fkey"
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
          probability: number | null
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
          probability?: number | null
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
          probability?: number | null
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
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
        Relationships: [
          {
            foreignKeyName: "quote_documents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          line_number: number
          line_total: number
          product_name: string
          quantity: number
          quote_id: string
          tax_amount: number | null
          tax_percent: number | null
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
          product_name: string
          quantity?: number
          quote_id: string
          tax_amount?: number | null
          tax_percent?: number | null
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
          product_name?: string
          quantity?: number
          quote_id?: string
          tax_amount?: number | null
          tax_percent?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
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
          billing_address: Json | null
          cargo_details: Json | null
          carrier_id: string | null
          compliance_status: string | null
          consignee_id: string | null
          contact_id: string | null
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
          incoterms: string | null
          notes: string | null
          opportunity_id: string | null
          origin_location: Json | null
          origin_port_id: string | null
          owner_id: string | null
          quote_number: string
          regulatory_data: Json | null
          rejected_at: string | null
          service_id: string | null
          service_type: string | null
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
          billing_address?: Json | null
          cargo_details?: Json | null
          carrier_id?: string | null
          compliance_status?: string | null
          consignee_id?: string | null
          contact_id?: string | null
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
          incoterms?: string | null
          notes?: string | null
          opportunity_id?: string | null
          origin_location?: Json | null
          origin_port_id?: string | null
          owner_id?: string | null
          quote_number: string
          regulatory_data?: Json | null
          rejected_at?: string | null
          service_id?: string | null
          service_type?: string | null
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
          billing_address?: Json | null
          cargo_details?: Json | null
          carrier_id?: string | null
          compliance_status?: string | null
          consignee_id?: string | null
          contact_id?: string | null
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
          incoterms?: string | null
          notes?: string | null
          opportunity_id?: string | null
          origin_location?: Json | null
          origin_port_id?: string | null
          owner_id?: string | null
          quote_number?: string
          regulatory_data?: Json | null
          rejected_at?: string | null
          service_id?: string | null
          service_type?: string | null
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
            foreignKeyName: "quotes_consignee_id_fkey"
            columns: ["consignee_id"]
            isOneToOne: false
            referencedRelation: "consignees"
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
          tenant_id?: string
          transit_time_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
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
          description: string | null
          features: Json
          id: string
          is_active: boolean
          limits: Json
          name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          price_annual: number | null
          price_monthly: number
          slug: string
          sort_order: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          updated_at: string | null
        }
        Insert: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          price_annual?: number | null
          price_monthly: number
          slug: string
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          updated_at?: string | null
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          price_annual?: number | null
          price_monthly?: number
          slug?: string
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          updated_at?: string | null
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
      [_ in never]: never
    }
    Functions: {
      calculate_lead_score: {
        Args: { lead_id: string }
        Returns: number
      }
      check_usage_limit: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: boolean
      }
      decrement_user_lead_count: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      get_tenant_plan_tier: {
        Args: { _tenant_id: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
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
      get_user_tenant_id: {
        Args: { check_user_id: string }
        Returns: string
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
      is_platform_admin: {
        Args: { check_user_id: string }
        Returns: boolean
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
      subscription_tier: "starter" | "professional" | "business" | "enterprise"
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
      account_status: ["active", "inactive", "pending"],
      account_type: ["prospect", "customer", "partner", "vendor"],
      activity_status: ["planned", "in_progress", "completed", "cancelled"],
      activity_type: ["call", "email", "meeting", "task", "note"],
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
      subscription_tier: ["starter", "professional", "business", "enterprise"],
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
