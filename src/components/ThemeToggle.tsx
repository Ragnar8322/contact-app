import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPCIONES: { valor: string; etiqueta: string; Icono: LucideIcon }[] = [
  { valor: "light", etiqueta: "Claro", Icono: Sun },
  { valor: "dark", etiqueta: "Oscuro", Icono: Moon },
  { valor: "system", etiqueta: "Sistema", Icono: Monitor },
];

/** Selector de tema: claro, oscuro o el del sistema operativo. */
export function ThemeToggle() {
  const { theme = "system", setTheme } = useTheme();
  return (
    <div role="group" aria-label="Tema" className="flex rounded-md border border-sidebar-border p-0.5">
      {OPCIONES.map(({ valor, etiqueta, Icono }) => (
        <button
          key={valor}
          type="button"
          aria-pressed={theme === valor}
          aria-label={`Tema ${etiqueta.toLowerCase()}`}
          title={etiqueta}
          onClick={() => setTheme(valor)}
          className={cn(
            "flex flex-1 items-center justify-center rounded py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            theme === valor
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/75 hover:text-sidebar-foreground",
          )}
        >
          <Icono className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
