export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string
          tenant_id: string
          franchise_id: string | null
          quote_id: string | null
          carrier_id: string | null
          booking_number: string | null
          carrier_booking_status: string | null
          status: string | null
          source: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          franchise_id?: string | null
          quote_id?: string | null
          carrier_id?: string | null
          booking_number?: string | null
          carrier_booking_status?: string | null
          status?: string | null
          source?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          franchise_id?: string | null
          quote_id?: string | null
          carrier_id?: string | null
          booking_number?: string | null
          carrier_booking_status?: string | null
          status?: string | null
          source?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_carrier_id_fkey"
            columns: ["carrier_id"]
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quote_id_fkey"
            columns: ["quote_id"]
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
           {
            foreignKeyName: "bookings_franchise_id_fkey"
            columns: ["franchise_id"]
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          }
        ]
      }
      quotes: {
        Row: {
          id: string
          // Add other fields as needed
          [key: string]: any
        }
        Insert: { [key: string]: any }
        Update: { [key: string]: any }
      }
      shipments: {
        Row: {
          id: string
           // Add other fields as needed
          [key: string]: any
        }
        Insert: { [key: string]: any }
        Update: { [key: string]: any }
      }
      leads: { Row: any; Insert: any; Update: any }
      accounts: { Row: any; Insert: any; Update: any }
      contacts: { Row: any; Insert: any; Update: any }
      opportunities: { Row: any; Insert: any; Update: any }
      tenants: { Row: { id: string; name: string }; Insert: any; Update: any }
      franchises: { Row: { id: string; name: string }; Insert: any; Update: any }
      profiles: { Row: any; Insert: any; Update: any }
      user_roles: { Row: any; Insert: any; Update: any }
      ports_locations: { Row: any; Insert: any; Update: any }
      carriers: { Row: { id: string; name: string }; Insert: any; Update: any }
      email_account_delegations: {
        Row: {
          id: string
          email_account_id: string
          delegate_user_id: string
          permissions: string[]
          requires_mfa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email_account_id: string
          delegate_user_id: string
          permissions?: string[]
          requires_mfa?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email_account_id?: string
          delegate_user_id?: string
          permissions?: string[]
          requires_mfa?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      tenant_domains: {
        Row: {
          id: string
          tenant_id: string
          domain_name: string
          provider_metadata: any
          is_verified: boolean
          spf_verified: boolean
          dkim_verified: boolean
          dmarc_verified: boolean
          spf_record: string | null
          dmarc_record: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          domain_name: string
          provider_metadata?: any
          is_verified?: boolean
          spf_verified?: boolean
          dkim_verified?: boolean
          dmarc_verified?: boolean
          spf_record?: string | null
          dmarc_record?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          domain_name?: string
          provider_metadata?: any
          is_verified?: boolean
          spf_verified?: boolean
          dkim_verified?: boolean
          dmarc_verified?: boolean
          spf_record?: string | null
          dmarc_record?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Add other tables to satisfy keyof Database['public']['Tables']
      [key: string]: {
        Row: any
        Insert: any
        Update: any
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, Json>
      }
    }
    Functions: {
      [key: string]: {
        Args: Record<string, Json>
        Returns: Json
      }
    }
    Enums: {
      [key: string]: string[]
    }
  }
  finance: {
    Tables: {
        gl_accounts: { Row: any; Insert: any; Update: any }
        journal_entries: { Row: any; Insert: any; Update: any }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
