import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth, RoleName } from "@/contexts/AuthContext";
import { CampanaProvider, useCampana } from "@/contexts/CampanaContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import ChangePassword from "@/pages/ChangePassword";
import SelectCampaign from "@/pages/SelectCampaign";
import NotFound from "@/pages/NotFound";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Clients = lazy(() => import("@/pages/Clients"));
const Cases = lazy(() => import("@/pages/Cases"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Settings = lazy(() => import("@/pages/Settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      Cargando...
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, mustChangePassword } = useAuth();
  const { loading: campLoading, needsSelection, noCampaigns } = useCampana();

  if (loading || campLoading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/cambiar-contrasena" replace />;
  if (noCampaigns || needsSelection) return <Navigate to="/seleccionar-campana" replace />;
  return <AppLayout>{children}</AppLayout>;
}

// Espera profileLoading para no redirigir mientras los roles aún se están cargando
function RoleRoute({ children, roles }: { children: React.ReactNode; roles: RoleName[] }) {
  const { hasRole, loading, profileLoading } = useAuth();
  if (loading || profileLoading) return <LoadingScreen />;
  if (!hasRole(roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CampaignRoute() {
  const { session, loading, mustChangePassword } = useAuth();
  const { loading: campLoading, needsSelection, noCampaigns, campanaActiva } = useCampana();

  if (loading || campLoading) return <LoadingScreen />;
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
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to="/" replace />;
  return <ChangePassword />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CampanaProvider>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
                  <Route path="/cambiar-contrasena" element={<ChangePasswordRoute />} />
                  <Route path="/seleccionar-campana" element={<CampaignRoute />} />
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/clientes" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
                  <Route path="/casos" element={
                    <ProtectedRoute>
                      <RoleRoute roles={["admin", "supervisor", "agent"]}>
                        <Cases />
                      </RoleRoute>
                    </ProtectedRoute>
                  } />
                  <Route path="/analitica" element={
                    <ProtectedRoute>
                      <RoleRoute roles={["admin", "gerente", "supervisor"]}>
                        <Analytics />
                      </RoleRoute>
                    </ProtectedRoute>
                  } />
                  <Route path="/ajustes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </CampanaProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
