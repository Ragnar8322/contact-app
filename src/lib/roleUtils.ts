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
