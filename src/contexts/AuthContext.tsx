import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  user_id: string;
  nombre: string;
  role_id: number;
  telefono: string | null;
  role_name?: string;
  must_change_password?: boolean;
}

export type RoleName = "admin" | "agent" | "supervisor" | "gerente";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: RoleName[];
  isAdmin: boolean;
  isAgente: boolean;
  isSupervisor: boolean;
  isGerente: boolean;
  hasRole: (roles: RoleName[]) => boolean;
  mustChangePassword: boolean;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("*, user_roles(name)")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("user_role_assignments")
          .select("role_id, user_roles(name)")
          .eq("user_id", userId),
      ]);

      if (profileResult.error) {
        console.error("Error loading profile:", profileResult.error.message);
        return;
      }

      const profileData = profileResult.data;
      const assignments = rolesResult.data ?? [];

      if (profileData) {
        const fallbackRole = (profileData.user_roles as any)?.name as RoleName || "agent";

        setProfile({
          ...profileData,
          role_name: fallbackRole,
          must_change_password: (profileData as any).must_change_password ?? false,
        });

        if (assignments.length > 0) {
          const roleNames = assignments
            .map(a => (a.user_roles as any)?.name as RoleName)
            .filter(Boolean);
          setRoles(roleNames.length > 0 ? roleNames : [fallbackRole]);
        } else {
          setRoles([fallbackRole]);
        }
      }
    } catch (err) {
      console.error("fetchProfile error:", err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let lastUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (newSession?.user) {
          // Solo cargar perfil si cambió el usuario (evita doble carga INITIAL_SESSION + SIGNED_IN)
          if (newSession.user.id !== lastUserId) {
            lastUserId = newSession.user.id;
            fetchProfile(newSession.user.id);
          }
        } else {
          lastUserId = null;
          setProfile(null);
          setRoles([]);
          setProfileLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    window.dispatchEvent(new CustomEvent("auth:signout"));
  };

  const isAdmin = roles.includes("admin");
  const isAgente = roles.includes("agent");
  const isSupervisor = roles.includes("supervisor");
  const isGerente = roles.includes("gerente");

  const hasRole = (checkRoles: RoleName[]) => checkRoles.some(r => roles.includes(r));

  const mustChangePassword = profile?.must_change_password === true;

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      roles,
      isAdmin,
      isAgente,
      isSupervisor,
      isGerente,
      hasRole,
      mustChangePassword,
      loading,
      profileLoading,
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
