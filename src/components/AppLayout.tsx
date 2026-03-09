import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { LayoutDashboard, Users, FolderOpen, LogOut, Menu, X, Settings, ChevronDown, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getHighestRole } from "@/lib/roleUtils";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, isAdmin, hasRole, signOut } = useAuth();
  const highestRole = getHighestRole(roles);
  const { campanaActiva, campanas, setCampanaActiva } = useCampana();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const canSwitch = campanas.length > 1 || isAdmin;

  // Build nav items based on role
  const navItems: { to: string; icon: any; label: string }[] = [];

  // Dashboard: supervisor, admin, gerente see full; agent sees limited but still has access
  navItems.push({ to: "/", icon: LayoutDashboard, label: "Dashboard" });

  // Clientes: everyone
  navItems.push({ to: "/clientes", icon: Users, label: "Clientes" });

  // Casos: agent, supervisor, admin (not gerente — gerente is read-only via dashboard)
  if (hasRole(["agent", "supervisor", "admin"])) {
    navItems.push({ to: "/casos", icon: FolderOpen, label: "Casos" });
  }

  // Analítica: admin, gerente, supervisor
  if (hasRole(["admin", "gerente", "supervisor"])) {
    navItems.push({ to: "/analitica", icon: BarChart2, label: "Analítica" });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col border-b border-sidebar-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
              CC
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight font-display">Contact Center</h1>
              <p className="text-xs text-sidebar-foreground/60">Panel de gestión</p>
            </div>
          </div>

          {/* Campaign badge */}
          {campanaActiva && (
            <div className="mt-3">
              {canSwitch ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center gap-2 rounded-md bg-sidebar-accent px-3 py-1.5 text-xs font-medium text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent/80">
                      <span>📁</span>
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
                        📁 {c.nombre}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-sidebar-accent px-3 py-1.5 text-xs font-medium text-sidebar-accent-foreground">
                  <span>📁</span>
                  <span className="truncate">{campanaActiva.nombre}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                location.pathname === to
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/ajustes"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                location.pathname === "/ajustes"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Ajustes
            </Link>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 px-1">
            <p className="text-sm font-medium truncate">{profile?.nombre}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{profile?.role_name}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b px-4 lg:px-6 bg-card">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex-1" />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
