import type { RoleName } from "@/contexts/AuthContext";

const ROLE_PRIORITY: Record<RoleName, number> = {
  admin: 4,
  gerente: 3,
  supervisor: 2,
  agent: 1,
};

export function getHighestRole(roles: RoleName[]): RoleName {
  if (roles.length === 0) return "agent";
  return roles.reduce((highest, current) =>
    ROLE_PRIORITY[current] > ROLE_PRIORITY[highest] ? current : highest
  );
}

export function hasMinRole(roles: RoleName[], minRole: RoleName): boolean {
  const highest = getHighestRole(roles);
  return ROLE_PRIORITY[highest] >= ROLE_PRIORITY[minRole];
}

/** Nombre visible de cada rol (los valores en BD están en inglés/minúsculas). */
export const ROLE_LABELS: Record<RoleName, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  supervisor: "Supervisor",
  agent: "Agente",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role.toLowerCase() as RoleName] ?? role;
}
