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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          balance: number
          created_at: string
          email: string | null
          id: string
          name: string
          owner_id: string
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          email?: string | null
          id?: string
          name: string
          owner_id: string
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          id: string
          name: string
          owner_id: string
          unit: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          name: string
          owner_id: string
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          name?: string
          owner_id?: string
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          batch_number: string | null
          bonus_quantity: number
          discount_amount: number
          expiry_date: string | null
          id: string
          inventory_item_id: string | null
          invoice_id: string
          item_name: string
          line_total: number
          sold_quantity: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          batch_number?: string | null
          bonus_quantity?: number
          discount_amount?: number
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string | null
          invoice_id: string
          item_name: string
          line_total?: number
          sold_quantity?: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          batch_number?: string | null
          bonus_quantity?: number
          discount_amount?: number
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string | null
          invoice_id?: string
          item_name?: string
          line_total?: number
          sold_quantity?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_audit: {
        Row: {
          action: string
          actor_id: string | null
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          owner_id: string
          payment_date: string | null
          payment_id: string | null
          reference: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          owner_id: string
          payment_date?: string | null
          payment_id?: string | null
          reference?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          owner_id?: string
          payment_date?: string | null
          payment_id?: string | null
          reference?: string | null
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          owner_id: string
          payment_date: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          owner_id: string
          payment_date?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          owner_id?: string
          payment_date?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string
          discount_total: number
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          notes: string | null
          owner_id: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          owner_id: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          subtotal?: number
          total?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          owner_id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_invoice_delta: {
        Args: {
          p_customer: string
          p_sign: number
          p_total: number
          p_type: Database["public"]["Enums"]["invoice_type"]
        }
        Returns: undefined
      }
      generate_invoice_number: {
        Args: { p_type: Database["public"]["Enums"]["invoice_type"] }
        Returns: string
      }
      invoice_paid_total: { Args: { p_invoice: string }; Returns: number }
      recalc_invoice_totals: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
    }
    Enums: {
      invoice_type: "sales" | "credit_note" | "quotation"
      payment_type: "cash" | "deferred_cash" | "credit"
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
      invoice_type: ["sales", "credit_note", "quotation"],
      payment_type: ["cash", "deferred_cash", "credit"],
    },
  },
} as const
