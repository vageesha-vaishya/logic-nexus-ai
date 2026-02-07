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
