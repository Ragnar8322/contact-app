import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CampanaProvider, useCampana } from "@/contexts/CampanaContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import ChangePassword from "@/pages/ChangePassword";
import SelectCampaign from "@/pages/SelectCampaign";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Cases from "@/pages/Cases";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, mustChangePassword } = useAuth();
  const { loading: campLoading, needsSelection, noCampaigns } = useCampana();

  if (loading || campLoading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/cambiar-contrasena" replace />;
  if (noCampaigns || needsSelection) return <Navigate to="/seleccionar-campana" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function CampaignRoute() {
  const { session, loading, mustChangePassword } = useAuth();
  const { loading: campLoading, needsSelection, noCampaigns, campanaActiva } = useCampana();

  if (loading || campLoading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/cambiar-contrasena" replace />;
  if (!noCampaigns && !needsSelection && campanaActiva) return <Navigate to="/" replace />;
  return <SelectCampaign />;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ChangePasswordRoute() {
  const { session, loading, mustChangePassword } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to="/" replace />;
  return <ChangePassword />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CampanaProvider>
            <Routes>
              <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
              <Route path="/cambiar-contrasena" element={<ChangePasswordRoute />} />
              <Route path="/seleccionar-campana" element={<CampaignRoute />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
              <Route path="/casos" element={<ProtectedRoute><Cases /></ProtectedRoute>} />
              <Route path="/ajustes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CampanaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
