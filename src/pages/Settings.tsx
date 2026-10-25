import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminProfiles from "@/components/admin/AdminProfiles";
import AdminCatalogs from "@/components/admin/AdminCatalogs";
import AdminCampanas from "@/components/admin/AdminCampanas";
import AdminActivityLog from "@/components/admin/AdminActivityLog";
import AdminImportCasos from "@/components/admin/AdminImportCasos";

// Casos y Clientes se gestionan en sus pantallas principales (con acciones extra para el admin)
const TABS = ["profiles", "catalogs", "campanas", "auditoria", "importar"] as const;
type Tab = typeof TABS[number];

// Solo admin: la ruta va dentro de RoleRoute, que espera a que carguen los roles
export default function Settings() {
  // La pestaña vive en la URL: sobrevive a recargas y se puede enlazar (/ajustes?tab=campanas)
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "profiles";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administración</h1>
        <p className="text-muted-foreground">Gestión de usuarios, catálogos, campañas, auditoría e importación</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })} className="space-y-4">
        {/* En pantallas angostas las pestañas se desplazan en lugar de aplastarse */}
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto lg:grid lg:grid-cols-5">
          <TabsTrigger value="profiles">Perfiles</TabsTrigger>
          <TabsTrigger value="catalogs">Catálogos</TabsTrigger>
          <TabsTrigger value="campanas">Campañas</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles"><AdminProfiles /></TabsContent>
        <TabsContent value="catalogs"><AdminCatalogs /></TabsContent>
        <TabsContent value="campanas"><AdminCampanas /></TabsContent>
        <TabsContent value="auditoria"><AdminActivityLog /></TabsContent>
        <TabsContent value="importar"><AdminImportCasos /></TabsContent>
      </Tabs>
    </div>
  );
}
