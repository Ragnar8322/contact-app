import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminProfiles from "@/components/admin/AdminProfiles";
import AdminCases from "@/components/admin/AdminCases";
import AdminClients from "@/components/admin/AdminClients";
import AdminCatalogs from "@/components/admin/AdminCatalogs";
import AdminCampanas from "@/components/admin/AdminCampanas";
import AdminActivityLog from "@/components/admin/AdminActivityLog";
import AdminImportCasos from "@/components/admin/AdminImportCasos";

export default function Settings() {
  const { isAdmin, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administración</h1>
        <p className="text-muted-foreground">Gestión de usuarios, casos, clientes, catálogos, campañas, auditoría e importación</p>
      </div>

      <Tabs defaultValue="profiles" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="profiles">Perfiles</TabsTrigger>
          <TabsTrigger value="cases">Casos</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="catalogs">Catálogos</TabsTrigger>
          <TabsTrigger value="campanas">Campañas</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles"><AdminProfiles /></TabsContent>
        <TabsContent value="cases"><AdminCases /></TabsContent>
        <TabsContent value="clients"><AdminClients /></TabsContent>
        <TabsContent value="catalogs"><AdminCatalogs /></TabsContent>
        <TabsContent value="campanas"><AdminCampanas /></TabsContent>
        <TabsContent value="auditoria"><AdminActivityLog /></TabsContent>
        <TabsContent value="importar"><AdminImportCasos /></TabsContent>
      </Tabs>
    </div>
  );
}
