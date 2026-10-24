import { useCampana } from "@/contexts/CampanaContext";
import { APP_MONOGRAM } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Headphones, LogOut } from "lucide-react";

const CAMPAIGN_ICONS: Record<string, React.ReactNode> = {
  "renovación web": <FolderOpen className="h-10 w-10" />,
  "asesoría especializada": <Headphones className="h-10 w-10" />,
};

function getIcon(nombre: string) {
  return CAMPAIGN_ICONS[nombre.toLowerCase()] || <FolderOpen className="h-10 w-10" />;
}

export default function SelectCampaign() {
  const { campanas, setCampanaActiva, noCampaigns } = useCampana();
  const { signOut, profile } = useAuth();

  const headerBar = (
    <div className="absolute top-4 right-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        className="text-muted-foreground hover:text-foreground gap-2"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </Button>
    </div>
  );

  if (noCampaigns) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        {headerBar}
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight font-display">Sin campañas asignadas</h2>
            <p className="text-muted-foreground text-sm">
              No tienes campañas asignadas. Contacta a un administrador.
            </p>
            {profile && (
              <p className="text-xs text-muted-foreground">Sesión iniciada como <strong>{profile.nombre}</strong></p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {headerBar}
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xl" aria-hidden="true">
            {APP_MONOGRAM}
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-display">Selecciona una campaña</h1>
          <p className="text-muted-foreground">Elige el espacio de trabajo en el que deseas operar</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {campanas.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCampanaActiva(c)}
              className="group rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="flex h-full flex-col items-center space-y-3 rounded-lg bg-card p-6 text-center text-card-foreground shadow-md transition-[box-shadow,transform] duration-150 group-hover:shadow-lg group-hover:ring-2 group-hover:ring-primary/30 group-active:scale-[0.98] motion-reduce:transition-none motion-reduce:group-active:scale-100">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
                    {getIcon(c.nombre)}
                  </span>
                  <span className="block text-lg font-semibold font-display">{c.nombre}</span>
                  {c.descripcion && (
                    <span className="block text-sm text-muted-foreground">{c.descripcion}</span>
                  )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
