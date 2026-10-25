import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { LayoutDashboard, Users, FolderOpen, LogOut, Menu, Settings, ChevronDown, BarChart2, CalendarDays, Clock, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { getHighestRole, roleLabel } from "@/lib/roleUtils";
import { APP_MONOGRAM, APP_NAME } from "@/lib/constants";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, isAdmin, hasRole, signOut, profileLoading } = useAuth();
  const highestRole = getHighestRole(roles);
  const { campanaActiva, campanas, setCampanaActiva } = useCampana();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Por debajo de lg el menú es un panel deslizable; cerrado, sale del orden de tabulación
  const isDrawer = useMediaQuery("(max-width: 1023px)");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isDrawer) setMobileOpen(false);
  }, [isDrawer]);

  useEffect(() => {
    if (!mobileOpen) return;
    sidebarRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const canSwitch = campanas.length > 1 || isAdmin;

  // Esperar a que los roles estén cargados antes de construir el menú
  const navItems: { to: string; icon: LucideIcon; label: string }[] = [];

  if (!profileLoading) {
    navItems.push({ to: "/", icon: LayoutDashboard, label: "Dashboard" });
    navItems.push({ to: "/clientes", icon: Users, label: "Clientes" });

    if (hasRole(["agent", "supervisor", "admin"])) {
      navItems.push({ to: "/casos", icon: FolderOpen, label: "Casos" });
    }

    if (hasRole(["admin", "gerente", "supervisor"])) {
      navItems.push({ to: "/analitica", icon: BarChart2, label: "Analítica" });
    }

    // --- Módulo Horarios ---
    if (hasRole(["admin", "supervisor", "gerente"])) {
      navItems.push({ to: "/horarios", icon: CalendarDays, label: "Horarios" });
    }

    if (hasRole(["agent"])) {
      navItems.push({ to: "/mi-horario", icon: Clock, label: "Mi Horario" });
    }
  }

  const currentLabel =
    navItems.find((n) => n.to === location.pathname)?.label ??
    (location.pathname === "/ajustes" ? "Administración" : "");
  const sidebarHidden = isDrawer && !mobileOpen;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        aria-label="Menú principal"
        aria-hidden={sidebarHidden || undefined}
        // inert saca el panel cerrado del foco y de los lectores de pantalla
        {...(sidebarHidden ? { inert: "" } : {})}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-out motion-reduce:transition-none lg:relative lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col border-b border-sidebar-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
              {APP_MONOGRAM}
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight font-display">{APP_NAME}</p>
              <p className="text-xs text-sidebar-foreground/75">Panel de gestión</p>
            </div>
          </div>

          {/* Campaign badge */}
          {campanaActiva && (
            <div className="mt-3">
              {canSwitch ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center gap-2 rounded-md bg-sidebar-accent px-3 py-1.5 text-xs font-medium text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent/80">
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                      <span className="truncate flex-1 text-left">{campanaActiva.nombre}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {campanas.map(c => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => setCampanaActiva(c)}
                        className={cn(c.id === campanaActiva.id && "bg-accent")}
                      >
                        <FolderOpen className="h-4 w-4 opacity-60" aria-hidden="true" />
                        {c.nombre}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-sidebar-accent px-3 py-1.5 text-xs font-medium text-sidebar-accent-foreground">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  <span className="truncate">{campanaActiva.nombre}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {/* Mientras cargan los roles, esqueletos en vez de un menú parcial que luego cambia */}
          {profileLoading && [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg bg-sidebar-accent" />
          ))}
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              aria-current={location.pathname === to ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                location.pathname === to
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {!profileLoading && isAdmin && (
            <Link
              to="/ajustes"
              aria-current={location.pathname === "/ajustes" ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                location.pathname === "/ajustes"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Administración
            </Link>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 px-1">
            <p className="text-sm font-medium truncate">{profile?.nombre}</p>
            <p className="text-xs text-sidebar-foreground/85">{roleLabel(highestRole)}</p>
          </div>
          <div className="mb-2 px-1">
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* En escritorio el menú lateral ya orienta; la barra solo existe en móvil */}
        <header className="flex h-14 items-center gap-3 border-b px-4 bg-card lg:hidden">
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="truncate text-sm font-semibold">{currentLabel}</span>
          {campanaActiva && (
            <span className="ml-auto truncate text-xs text-muted-foreground">{campanaActiva.nombre}</span>
          )}
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
