// src/types/database.ts
// Alias legibles de los tipos generados por Supabase.
// Usar estos tipos en hooks, componentes y contextos en lugar de `any`.
// Generados a partir de: src/integrations/supabase/types.ts

import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

// --- Tablas principales ---
export type Campana = Tables["campanas"]["Row"];
export type CampanaInsert = Tables["campanas"]["Insert"];
export type CampanaUpdate = Tables["campanas"]["Update"];

export type Caso = Tables["casos"]["Row"];
export type CasoInsert = Tables["casos"]["Insert"];
export type CasoUpdate = Tables["casos"]["Update"];

export type Cliente = Tables["clientes"]["Row"];
export type ClienteInsert = Tables["clientes"]["Insert"];
export type ClienteUpdate = Tables["clientes"]["Update"];

export type Profile = Tables["profiles"]["Row"];
export type ProfileInsert = Tables["profiles"]["Insert"];
export type ProfileUpdate = Tables["profiles"]["Update"];

export type CatEstado = Tables["cat_estados"]["Row"];
export type CatTipoServicio = Tables["cat_tipo_servicio"]["Row"];
export type CatAgente = Tables["cat_agentes"]["Row"];
export type SlaConfig = Tables["sla_config"]["Row"];
export type UserRole = Tables["user_roles"]["Row"];
export type CasoHistorial = Tables["caso_historial"]["Row"];

// --- Tipos compuestos con joins ---
// Usado en listados de casos con datos relacionados
export type CasoConRelaciones = Caso & {
  clientes?: Cliente | null;
  cat_estados?: CatEstado | null;
  cat_tipo_servicio?: CatTipoServicio | null;
  cat_agentes?: CatAgente | null;
};

// Perfil con rol incluido (join profiles + user_roles)
export type ProfileConRol = Profile & {
  user_roles?: UserRole | null;
};

// --- Tipos de utilidad ---
export type RoleName = "admin" | "supervisor" | "agent";

export type PeriodoAnalitica = "dia" | "semana" | "mes" | "año";
