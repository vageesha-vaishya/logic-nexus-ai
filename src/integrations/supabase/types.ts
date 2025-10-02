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
          subscription_tier: string | null
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
          subscription_tier?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_lead_score: {
        Args: { lead_id: string }
        Returns: number
      }
      decrement_user_lead_count: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
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
      increment_user_lead_count: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      is_platform_admin: {
        Args: { check_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "active" | "inactive" | "pending"
      account_type: "prospect" | "customer" | "partner" | "vendor"
      activity_status: "planned" | "in_progress" | "completed" | "cancelled"
      activity_type: "call" | "email" | "meeting" | "task" | "note"
      app_role: "platform_admin" | "tenant_admin" | "franchise_admin" | "user"
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
      priority_level: "low" | "medium" | "high" | "urgent"
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
      priority_level: ["low", "medium", "high", "urgent"],
    },
  },
} as const
