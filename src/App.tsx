import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { reportError } from "@/lib/monitoring";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { CampanaProvider } from "@/contexts/CampanaContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthRoute, CampaignRoute, ChangePasswordRoute, LoadingScreen, ProtectedRoute, RoleRoute } from "@/components/routes/RouteGuards";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

const Dashboard  = lazy(() => import("@/pages/Dashboard"));
const Clients    = lazy(() => import("@/pages/Clients"));
const Cases      = lazy(() => import("@/pages/Cases"));
const Analytics  = lazy(() => import("@/pages/Analytics"));
const Settings   = lazy(() => import("@/pages/Settings"));
// --- Módulo Horarios ---
const Horarios   = lazy(() => import("@/pages/Horarios"));
const MiHorario  = lazy(() => import("@/pages/MiHorario"));

// Los fallos de guardado (mutaciones) y de consulta se reportan al monitoreo
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportError(error, { operacion: "consulta", consulta: String(query.queryKey[0]) }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) =>
      reportError(error, { operacion: "guardado", mutacion: String(mutation.options.mutationKey?.[0] ?? "sin clave") }),
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});


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

                  {/* Rutas existentes — sin cambios */}
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
                  <Route path="/ajustes" element={<ProtectedRoute><RoleRoute roles={["admin"]}><Settings /></RoleRoute></ProtectedRoute>} />

                  {/* Módulo Horarios — admin / supervisor / gerente */}
                  <Route path="/horarios" element={
                    <ProtectedRoute>
                      <RoleRoute roles={["admin", "supervisor", "gerente"]}>
                        <Horarios />
                      </RoleRoute>
                    </ProtectedRoute>
                  } />

                  {/* Mi Horario — agente: solo lectura de su turno */}
                  <Route path="/mi-horario" element={
                    <ProtectedRoute>
                      <RoleRoute roles={["agent"]}>
                        <MiHorario />
                      </RoleRoute>
                    </ProtectedRoute>
                  } />

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
