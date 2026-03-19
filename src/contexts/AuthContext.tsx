import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type RoleName = "admin" | "agent" | "supervisor" | "gerente";

export interface Profile extends Tables<"profiles"> {
  role_name?: string;
}

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
  
  // 1. Condicion de carrera mitigada usando useRef para persistir el lastUserId
  const lastUserId = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    // 3. Manejo de Errores: robust try-catch
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
        setProfile(null);
        setRoles([]);
        return;
      }

      if (rolesResult.error) {
        console.error("Error loading role assignments:", rolesResult.error.message);
      }

      const profileData = profileResult.data;
      const assignments = rolesResult.data ?? [];

      if (profileData) {
        let fallbackRole: RoleName = "agent";

        // 2. Seguridad de Tipos: eliminación de casteos a "any"
        // Aseguramos qué tipo retorna Supabase para user_roles
        const roleDataObj = profileData.user_roles;
        if (roleDataObj && !Array.isArray(roleDataObj) && typeof roleDataObj === 'object' && 'name' in roleDataObj) {
          fallbackRole = (roleDataObj.name as RoleName) || "agent";
        }

        setProfile({
          ...profileData,
          role_name: fallbackRole,
          must_change_password: profileData.must_change_password ?? false,
        });

        if (assignments.length > 0) {
          const roleNames = assignments
            .map(a => {
              const r = a.user_roles;
              if (r && !Array.isArray(r) && typeof r === 'object' && 'name' in r) {
                return r.name as RoleName;
              }
              return undefined;
            })
            .filter((role): role is RoleName => Boolean(role));

          setRoles(roleNames.length > 0 ? roleNames : [fallbackRole]);
        } else {
          setRoles([fallbackRole]);
        }
      } else {
        setProfile(null);
        setRoles([]);
      }
    } catch (err) {
      console.error("fetchProfile error inside AuthContext:", err);
      setProfile(null);
      setRoles([]);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (newSession?.user) {
          // Usamos persistencia a traves del ref
          if (newSession.user.id !== lastUserId.current) {
            lastUserId.current = newSession.user.id;
            fetchProfile(newSession.user.id);
          }
        } else {
          lastUserId.current = null;
          setProfile(null);
          setRoles([]);
          setProfileLoading(false);
        }
      }
    );

    // 4. Memory Leaks: limpieza con unsubscribe
    return () => {
      subscription.unsubscribe();
    };
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
