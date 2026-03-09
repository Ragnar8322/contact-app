import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Campana {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean | null;
}

interface CampanaContextType {
  campanaActiva: Campana | null;
  campanas: Campana[];
  setCampanaActiva: (c: Campana) => void;
  loading: boolean;
  needsSelection: boolean;
  noCampaigns: boolean;
}

const CampanaContext = createContext<CampanaContextType | undefined>(undefined);

const STORAGE_KEY = "campana_activa_id";

export function CampanaProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [campanaActiva, setCampanaActivaState] = useState<Campana | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSelection, setNeedsSelection] = useState(false);
  const [noCampaigns, setNoCampaigns] = useState(false);

  const setCampanaActiva = useCallback((c: Campana) => {
    setCampanaActivaState(c);
    localStorage.setItem(STORAGE_KEY, c.id);
    setNeedsSelection(false);
  }, []);

  // Listen for signout event to clear campaign state
  useEffect(() => {
    const handleSignOut = () => {
      setCampanaActivaState(null);
      setCampanas([]);
      setNeedsSelection(false);
      setNoCampaigns(false);
      localStorage.removeItem(STORAGE_KEY);
    };
    window.addEventListener("auth:signout", handleSignOut);
    return () => window.removeEventListener("auth:signout", handleSignOut);
  }, []);

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    const fetchCampanas = async () => {
      setLoading(true);
      try {
        const { data: allCampanas } = await supabase
          .from("campanas")
          .select("*")
          .eq("activa", true);

        const { data: perfilCampanas } = await supabase
          .from("perfil_campanas")
          .select("campana_id")
          .eq("user_id", user.id);

        const assignedIds = new Set((perfilCampanas || []).map(pc => pc.campana_id));
        
        let userCampanas: Campana[];
        if (isAdmin) {
          userCampanas = allCampanas || [];
        } else {
          userCampanas = (allCampanas || []).filter(c => assignedIds.has(c.id));
        }

        setCampanas(userCampanas);

        if (userCampanas.length === 0) {
          setNoCampaigns(true);
          setLoading(false);
          return;
        }

        setNoCampaigns(false);

        const savedId = localStorage.getItem(STORAGE_KEY);
        const savedCampana = savedId ? userCampanas.find(c => c.id === savedId) : null;

        if (savedCampana) {
          setCampanaActivaState(savedCampana);
          setNeedsSelection(false);
        } else if (userCampanas.length === 1) {
          setCampanaActiva(userCampanas[0]);
        } else {
          setNeedsSelection(true);
        }
      } catch (err) {
        console.error("Error fetching campaigns:", err);
      }
      setLoading(false);
    };

    fetchCampanas();
  }, [user, isAdmin, authLoading, setCampanaActiva]);

  return (
    <CampanaContext.Provider value={{ campanaActiva, campanas, setCampanaActiva, loading, needsSelection, noCampaigns }}>
      {children}
    </CampanaContext.Provider>
  );
}

export function useCampana() {
  const context = useContext(CampanaContext);
  if (!context) throw new Error("useCampana must be used within CampanaProvider");
  return context;
}
