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
  public: {
    Tables: {
      campanas: {
        Row: {
          activa: boolean | null
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      caso_historial: {
        Row: {
          agente_id: string | null
          agente_nombre: string | null
          cambiado_en: string
          cambiado_por: string
          caso_id: number
          comentario: string | null
          estado_id: number
          estado_nuevo: string | null
          fecha_cambio: string | null
          id: number
          observacion: string | null
        }
        Insert: {
          agente_id?: string | null
          agente_nombre?: string | null
          cambiado_en?: string
          cambiado_por: string
          caso_id: number
          comentario?: string | null
          estado_id: number
          estado_nuevo?: string | null
          fecha_cambio?: string | null
          id?: number
          observacion?: string | null
        }
        Update: {
          agente_id?: string | null
          agente_nombre?: string | null
          cambiado_en?: string
          cambiado_por?: string
          caso_id?: number
          comentario?: string | null
          estado_id?: number
          estado_nuevo?: string | null
          fecha_cambio?: string | null
          id?: number
          observacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caso_historial_cambiado_por_fkey"
            columns: ["cambiado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "caso_historial_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_historial_estado_id_fkey"
            columns: ["estado_id"]
            isOneToOne: false
            referencedRelation: "cat_estados"
            referencedColumns: ["id"]
          },
        ]
      }
      casos: {
        Row: {
          agente_id: string
          campana_id: string | null
          cliente_id: number
          created_at: string | null
          created_by: string
          descripcion_inicial: string
          estado_id: number
          fecha_caso: string
          fecha_cierre: string | null
          id: number
          observacion_cierre: string | null
          tipo_servicio_id: number
          updated_at: string | null
          updated_by: string | null
          valor_pagar: number | null
        }
        Insert: {
          agente_id: string
          campana_id?: string | null
          cliente_id: number
          created_at?: string | null
          created_by: string
          descripcion_inicial: string
          estado_id: number
          fecha_caso?: string
          fecha_cierre?: string | null
          id?: number
          observacion_cierre?: string | null
          tipo_servicio_id: number
          updated_at?: string | null
          updated_by?: string | null
          valor_pagar?: number | null
        }
        Update: {
          agente_id?: string
          campana_id?: string | null
          cliente_id?: number
          created_at?: string | null
          created_by?: string
          descripcion_inicial?: string
          estado_id?: number
          fecha_caso?: string
          fecha_cierre?: string | null
          id?: number
          observacion_cierre?: string | null
          tipo_servicio_id?: number
          updated_at?: string | null
          updated_by?: string | null
          valor_pagar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "casos_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "cat_agentes"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "casos_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_estado_id_fkey"
            columns: ["estado_id"]
            isOneToOne: false
            referencedRelation: "cat_estados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_tipo_servicio_id_fkey"
            columns: ["tipo_servicio_id"]
            isOneToOne: false
            referencedRelation: "cat_tipo_servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_agentes: {
        Row: {
          activo: boolean
          nombre: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          nombre: string
          user_id: string
        }
        Update: {
          activo?: boolean
          nombre?: string
          user_id?: string
        }
        Relationships: []
      }
      cat_estados: {
        Row: {
          es_final: boolean
          id: number
          nombre: string
        }
        Insert: {
          es_final?: boolean
          id?: number
          nombre: string
        }
        Update: {
          es_final?: boolean
          id?: number
          nombre?: string
        }
        Relationships: []
      }
      cat_tipo_servicio: {
        Row: {
          id: number
          nombre: string
        }
        Insert: {
          id?: number
          nombre: string
        }
        Update: {
          id?: number
          nombre?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          celular: string | null
          correo: string | null
          created_at: string | null
          id: number
          identificacion: string
          nombre_contacto: string
          razon_social: string | null
          telefono: string | null
          tipo_cliente: string
        }
        Insert: {
          celular?: string | null
          correo?: string | null
          created_at?: string | null
          id?: number
          identificacion: string
          nombre_contacto: string
          razon_social?: string | null
          telefono?: string | null
          tipo_cliente: string
        }
        Update: {
          celular?: string | null
          correo?: string | null
          created_at?: string | null
          id?: number
          identificacion?: string
          nombre_contacto?: string
          razon_social?: string | null
          telefono?: string | null
          tipo_cliente?: string
        }
        Relationships: []
      }
      perfil_campanas: {
        Row: {
          campana_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          campana_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          campana_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfil_campanas_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          must_change_password: boolean
          nombre: string
          role_id: number
          telefono: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          must_change_password?: boolean
          nombre: string
          role_id: number
          telefono?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          must_change_password?: boolean
          nombre?: string
          role_id?: number
          telefono?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_config: {
        Row: {
          activo: boolean | null
          campana_id: string | null
          created_at: string | null
          horas_riesgo: number
          horas_vencido: number
          id: number
        }
        Insert: {
          activo?: boolean | null
          campana_id?: string | null
          created_at?: string | null
          horas_riesgo?: number
          horas_vencido?: number
          id?: number
        }
        Update: {
          activo?: boolean | null
          campana_id?: string | null
          created_at?: string | null
          horas_riesgo?: number
          horas_vencido?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_config_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_casos: {
        Row: {
          agente_nombre: string | null
          cliente_identificacion: string | null
          descripcion_inicial: string | null
          estado: string | null
          fecha_caso: string | null
          tipo_servicio: string | null
          valor_pagar: string | null
        }
        Insert: {
          agente_nombre?: string | null
          cliente_identificacion?: string | null
          descripcion_inicial?: string | null
          estado?: string | null
          fecha_caso?: string | null
          tipo_servicio?: string | null
          valor_pagar?: string | null
        }
        Update: {
          agente_nombre?: string | null
          cliente_identificacion?: string | null
          descripcion_inicial?: string | null
          estado?: string | null
          fecha_caso?: string | null
          tipo_servicio?: string | null
          valor_pagar?: string | null
        }
        Relationships: []
      }
      user_role_assignments: {
        Row: {
          assigned_at: string | null
          id: number
          role_id: number
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: number
          role_id: number
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: number
          role_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_casos_counts: { Args: { p_campana_id: string }; Returns: Json }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
