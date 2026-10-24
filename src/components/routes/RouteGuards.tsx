import { Navigate } from "react-router-dom";
import { useAuth, type RoleName } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import AppLayout from "@/components/AppLayout";
import SelectCampaign from "@/pages/SelectCampaign";
import ChangePassword from "@/pages/ChangePassword";

export function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground" role="status" aria-live="polite">
      Cargando...
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, mustChangePassword } = useAuth();
  const { loading: campLoading, needsSelection, noCampaigns } = useCampana();

  if (loading || campLoading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/cambiar-contrasena" replace />;
  if (noCampaigns || needsSelection) return <Navigate to="/seleccionar-campana" replace />;
  return <AppLayout>{children}</AppLayout>;
}

// Espera profileLoading para no redirigir mientras los roles aún se están cargando
export function RoleRoute({ children, roles }: { children: React.ReactNode; roles: RoleName[] }) {
  const { hasRole, loading, profileLoading } = useAuth();
  if (loading || profileLoading) return <LoadingScreen />;
  if (!hasRole(roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function CampaignRoute() {
  const { session, loading, mustChangePassword } = useAuth();
  const { loading: campLoading, needsSelection, noCampaigns, campanaActiva } = useCampana();

  if (loading || campLoading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/cambiar-contrasena" replace />;
  if (!noCampaigns && !needsSelection && campanaActiva) return <Navigate to="/" replace />;
  return <SelectCampaign />;
}

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function ChangePasswordRoute() {
  const { session, loading, mustChangePassword } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to="/" replace />;
  return <ChangePassword />;
}
