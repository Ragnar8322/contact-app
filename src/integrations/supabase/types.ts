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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          campana_id: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          campana_id?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          campana_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["id"]
          },
        ]
      }
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
          transferido_a_caso_id: number | null
          transferido_desde_caso_id: number | null
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
          transferido_a_caso_id?: number | null
          transferido_desde_caso_id?: number | null
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
          transferido_a_caso_id?: number | null
          transferido_desde_caso_id?: number | null
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
          {
            foreignKeyName: "casos_transferido_a_caso_id_fkey"
            columns: ["transferido_a_caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_transferido_desde_caso_id_fkey"
            columns: ["transferido_desde_caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
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
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          must_change_password?: boolean
          nombre: string
          role_id: number
          telefono?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          must_change_password?: boolean
          nombre?: string
          role_id?: number
          telefono?: string | null
          updated_at?: string | null
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
      schedule_novedades: {
        Row: {
          agente_id: string
          created_at: string | null
          descripcion: string | null
          duracion_minutos: number | null
          es_dia_completo: boolean
          estado: string
          fecha: string
          hora_fin_novedad: string | null
          hora_inicio_novedad: string | null
          id: string
          revisado_por: string | null
          schedule_id: string
          tipo_novedad: string
          updated_at: string | null
        }
        Insert: {
          agente_id: string
          created_at?: string | null
          descripcion?: string | null
          duracion_minutos?: number | null
          es_dia_completo?: boolean
          estado?: string
          fecha: string
          hora_fin_novedad?: string | null
          hora_inicio_novedad?: string | null
          id?: string
          revisado_por?: string | null
          schedule_id: string
          tipo_novedad: string
          updated_at?: string | null
        }
        Update: {
          agente_id?: string
          created_at?: string | null
          descripcion?: string | null
          duracion_minutos?: number | null
          es_dia_completo?: boolean
          estado?: string
          fecha?: string
          hora_fin_novedad?: string | null
          hora_inicio_novedad?: string | null
          id?: string
          revisado_por?: string | null
          schedule_id?: string
          tipo_novedad?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_novedades_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "schedule_novedades_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_shifts: {
        Row: {
          agente_id: string
          created_at: string | null
          duracion_almuerzo: number | null
          fecha: string
          hora_almuerzo: string | null
          hora_fin: string | null
          hora_inicio: string | null
          horas_dia: number | null
          id: string
          observacion: string | null
          schedule_id: string
          shift_type_id: number | null
          tipo_actividad: string | null
          updated_at: string | null
        }
        Insert: {
          agente_id: string
          created_at?: string | null
          duracion_almuerzo?: number | null
          fecha: string
          hora_almuerzo?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          horas_dia?: number | null
          id?: string
          observacion?: string | null
          schedule_id: string
          shift_type_id?: number | null
          tipo_actividad?: string | null
          updated_at?: string | null
        }
        Update: {
          agente_id?: string
          created_at?: string | null
          duracion_almuerzo?: number | null
          fecha?: string
          hora_almuerzo?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          horas_dia?: number | null
          id?: string
          observacion?: string | null
          schedule_id?: string
          shift_type_id?: number | null
          tipo_actividad?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shifts_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "schedule_shifts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_shifts_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          campana_id: string
          creado_por: string | null
          created_at: string | null
          estado: string
          id: string
          semana_fin: string
          semana_inicio: string
          updated_at: string | null
        }
        Insert: {
          campana_id: string
          creado_por?: string | null
          created_at?: string | null
          estado?: string
          id?: string
          semana_fin: string
          semana_inicio: string
          updated_at?: string | null
        }
        Update: {
          campana_id?: string
          creado_por?: string | null
          created_at?: string | null
          estado?: string
          id?: string
          semana_fin?: string
          semana_inicio?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_types: {
        Row: {
          activo: boolean | null
          campana_id: string
          color: string | null
          created_at: string | null
          hora_fin: string
          hora_inicio: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          campana_id: string
          color?: string | null
          created_at?: string | null
          hora_fin: string
          hora_inicio: string
          id?: number
          nombre: string
        }
        Update: {
          activo?: boolean | null
          campana_id?: string
          color?: string | null
          created_at?: string | null
          hora_fin?: string
          hora_inicio?: string
          id?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_types_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
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
          agente_correo: string | null
          agente_nombre: string | null
          cliente_identificacion: string | null
          descripcion_inicial: string | null
          estado: string | null
          fecha_caso: string | null
          fila_excel: number | null
          id: number
          tipo_servicio: string | null
          valor_pagar: string | null
        }
        Insert: {
          agente_correo?: string | null
          agente_nombre?: string | null
          cliente_identificacion?: string | null
          descripcion_inicial?: string | null
          estado?: string | null
          fecha_caso?: string | null
          fila_excel?: number | null
          id?: number
          tipo_servicio?: string | null
          valor_pagar?: string | null
        }
        Update: {
          agente_correo?: string | null
          agente_nombre?: string | null
          cliente_identificacion?: string | null
          descripcion_inicial?: string | null
          estado?: string | null
          fecha_caso?: string | null
          fila_excel?: number | null
          id?: number
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
      _copy_previous_week_shifts_impl: {
        Args: { _dest_schedule_id: string }
        Returns: number
      }
      _generate_schedule_impl:
        | {
            Args: {
              _dia_libre_base?: number
              _duracion_almuerzo?: number
              _hora_fin?: string
              _hora_inicio?: string
              _schedule_id: string
              _skip_existing?: boolean
            }
            Returns: number
          }
        | {
            Args: {
              _dia_libre_base?: number
              _duracion_almuerzo?: number
              _hora_fin?: string
              _hora_inicio?: string
              _schedule_id: string
              _skip_existing?: boolean
              _tipo_actividad?: string
            }
            Returns: number
          }
      assert_schedule_manager: { Args: never; Returns: undefined }
      assign_cases: {
        Args: {
          p_agente_ids: string[]
          p_campana_id: string
          p_caso_ids: number[]
        }
        Returns: Json
      }
      assignment_candidates: {
        Args: { p_campana_id: string }
        Returns: {
          abiertos: number
          nombre: string
          user_id: string
        }[]
      }
      copy_previous_week_shifts: {
        Args: { _dest_schedule_id: string }
        Returns: number
      }
      create_case_with_client: {
        Args: {
          p_campana_id: string
          p_cliente?: Json
          p_cliente_id?: number
          p_descripcion: string
          p_tipo_servicio_id: number
        }
        Returns: Json
      }
      dashboard_agent_stats: {
        Args: { p_campana_ids: string[] }
        Returns: {
          activos: number
          agente_id: string
          vencidos: number
        }[]
      }
      dashboard_stats: {
        Args: { p_campana_ids: string[]; p_tz?: string }
        Returns: {
          abiertos: number
          campana_id: string
          cerrados_hoy: number
          en_riesgo: number
          sin_asignar: number
          vencidos: number
        }[]
      }
      financial_summary: {
        Args: {
          p_campana_id: string
          p_desde: string
          p_hasta: string
          p_periodo: string
          p_tz?: string
        }
        Returns: {
          pendiente: number
          renovado: number
          tramo: number
        }[]
      }
      generate_schedule:
        | {
            Args: {
              _dia_libre_base?: number
              _duracion_almuerzo?: number
              _hora_fin?: string
              _hora_inicio?: string
              _schedule_id: string
              _skip_existing?: boolean
              _tipo_actividad?: string
            }
            Returns: number
          }
        | {
            Args: {
              _dia_libre_base: number
              _duracion_almuerzo: number
              _hora_fin: string
              _hora_inicio: string
              _schedule_id: string
              _skip_existing: boolean
            }
            Returns: number
          }
      get_agentes_by_campana: {
        Args: { _campana_id: string }
        Returns: {
          nombre: string
          user_id: string
        }[]
      }
      get_casos_counts: { Args: { p_campana_id: string }; Returns: Json }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_campana_id?: string
          p_details?: Json
          p_entity: string
          p_entity_id: string
        }
        Returns: undefined
      }
      parse_monto_cop: { Args: { p: string }; Returns: number }
      process_staging_casos: { Args: { p_campana_id?: string }; Returns: Json }
      reset_schedule_shifts: { Args: { _schedule_id: string }; Returns: number }
      rol_prioridad: { Args: { p_nombre: string }; Returns: number }
      set_user_roles: {
        Args: { p_role_ids: number[]; p_user_id: string }
        Returns: undefined
      }
      sla_vigente: {
        Args: { p_campana_ids: string[] }
        Returns: {
          campana_id: string
          horas_riesgo: number
          horas_vencido: number
        }[]
      }
      supervisor_de_campana: {
        Args: { p_campana_id: string }
        Returns: {
          nombre: string
          user_id: string
        }[]
      }
      transfer_case: {
        Args: { p_campana_destino: string; p_caso_id: number }
        Returns: Json
      }
      unpublish_schedule: { Args: { _schedule_id: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
