
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "accounts": {
                  Row: {
                    "archived": boolean,"color": string | null,"created_at": string,"deleted_at": string | null,"icon": string | null,"id": string,"initial_balance": number,"name": string,"server_seq": number | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "archived"?: boolean,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"icon"?: string | null,"id"?: string,"initial_balance"?: number,"name": string,"server_seq"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived"?: boolean,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"icon"?: string | null,"id"?: string,"initial_balance"?: number,"name"?: string,"server_seq"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"budgets": {
                  Row: {
                    "amount": number,"category_id": string | null,"created_at": string,"deleted_at": string | null,"id": string,"month": string,"server_seq": number | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount": number,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"month": string,"server_seq"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"month"?: string,"server_seq"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budgets_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "archived": boolean,"color": string | null,"created_at": string,"deleted_at": string | null,"icon": string | null,"id": string,"name": string,"server_seq": number | null,"sort_order": number,"type": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "archived"?: boolean,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"icon"?: string | null,"id"?: string,"name": string,"server_seq"?: number | null,"sort_order"?: number,"type": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived"?: boolean,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"icon"?: string | null,"id"?: string,"name"?: string,"server_seq"?: number | null,"sort_order"?: number,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"display_name": string | null,"id": string,"month_start_day": number,"server_seq": number | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"display_name"?: string | null,"id": string,"month_start_day"?: number,"server_seq"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"display_name"?: string | null,"id"?: string,"month_start_day"?: number,"server_seq"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recurring_rules": {
                  Row: {
                    "active": boolean,"created_at": string,"deleted_at": string | null,"frequency": string | null,"id": string,"next_run": string,"server_seq": number | null,"template": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"deleted_at"?: string | null,"frequency"?: string | null,"id"?: string,"next_run": string,"server_seq"?: number | null,"template": NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"deleted_at"?: string | null,"frequency"?: string | null,"id"?: string,"next_run"?: string,"server_seq"?: number | null,"template"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string | null,"amount": number,"category_id": string | null,"created_at": string,"deleted_at": string | null,"id": string,"note": string | null,"occurred_on": string,"recurring_id": string | null,"server_seq": number | null,"to_account_id": string | null,"type": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "account_id"?: string | null,"amount": number,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"note"?: string | null,"occurred_on"?: string,"recurring_id"?: string | null,"server_seq"?: number | null,"to_account_id"?: string | null,"type": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"amount"?: number,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"note"?: string | null,"occurred_on"?: string,"recurring_id"?: string | null,"server_seq"?: number | null,"to_account_id"?: string | null,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_recurring_id_fkey"
      columns: ["recurring_id"]
isOneToOne: false
      referencedRelation: "recurring_rules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_to_account_id_fkey"
      columns: ["to_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "default_row_id":
{ Args: { "p_key": string,"p_user_id": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
