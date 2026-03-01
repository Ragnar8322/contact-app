import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CasesFilters } from "@/hooks/useCases";

interface FilterOption {
  id: number;
  nombre: string;
}

interface AgenteOption {
  user_id: string;
  nombre: string;
}

interface CasesFilterBarProps {
  filters: CasesFilters;
  searchText: string;
  onSearchTextChange: (val: string) => void;
  onFiltersChange: (filters: CasesFilters) => void;
  estados: FilterOption[];
  tiposServicio: FilterOption[];
  agentes: AgenteOption[];
  showAgenteFilter: boolean;
}

export default function CasesFilterBar({
  filters,
  searchText,
  onSearchTextChange,
  onFiltersChange,
  estados,
  tiposServicio,
  agentes,
  showAgenteFilter,
}: CasesFilterBarProps) {
  const [estadosOpen, setEstadosOpen] = useState(false);

  const hasActiveFilters =
    searchText.trim() !== "" ||
    (filters.estadoIds && filters.estadoIds.length > 0) ||
    !!filters.tipoServicioId ||
    !!filters.agenteId ||
    !!filters.fechaDesde ||
    !!filters.fechaHasta;

  const clearFilters = () => {
    onSearchTextChange("");
    onFiltersChange({});
  };

  const toggleEstado = (id: number) => {
    const current = filters.estadoIds || [];
    const next = current.includes(id)
      ? current.filter((e) => e !== id)
      : [...current, id];
    onFiltersChange({ ...filters, estadoIds: next.length > 0 ? next : undefined });
  };

  const selectedEstadoLabel = filters.estadoIds && filters.estadoIds.length > 0
    ? `${filters.estadoIds.length} estado${filters.estadoIds.length > 1 ? "s" : ""}`
    : "Todos los estados";

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Clear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, NIT o ID..."
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            className="pl-9"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
            <X className="mr-1 h-4 w-4" /> Limpiar filtros
          </Button>
        )}
      </div>

      {/* Row 2: Dropdown filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Estado - Multi-select via popover */}
        <Popover open={estadosOpen} onOpenChange={setEstadosOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="justify-between min-w-[160px] font-normal">
              {selectedEstadoLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1 max-h-60 overflow-auto">
              {estados.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={filters.estadoIds?.includes(e.id) || false}
                    onCheckedChange={() => toggleEstado(e.id)}
                  />
                  {e.nombre}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Tipo de Servicio */}
        <Select
          value={filters.tipoServicioId ? String(filters.tipoServicioId) : "all"}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, tipoServicioId: v === "all" ? null : Number(v) })
          }
        >
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {tiposServicio.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Agente - only for admins */}
        {showAgenteFilter && (
          <Select
            value={filters.agenteId || "all"}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, agenteId: v === "all" ? null : v })
            }
          >
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
              <SelectValue placeholder="Todos los agentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los agentes</SelectItem>
              {agentes.map((a) => (
                <SelectItem key={a.user_id} value={a.user_id}>
                  {a.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Date range: Desde */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "min-w-[140px] justify-start font-normal",
                !filters.fechaDesde && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {filters.fechaDesde
                ? format(new Date(filters.fechaDesde), "dd/MM/yyyy")
                : "Desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.fechaDesde ? new Date(filters.fechaDesde) : undefined}
              onSelect={(d) =>
                onFiltersChange({
                  ...filters,
                  fechaDesde: d ? format(d, "yyyy-MM-dd") : null,
                })
              }
              locale={es}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {/* Date range: Hasta */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "min-w-[140px] justify-start font-normal",
                !filters.fechaHasta && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {filters.fechaHasta
                ? format(new Date(filters.fechaHasta), "dd/MM/yyyy")
                : "Hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.fechaHasta ? new Date(filters.fechaHasta) : undefined}
              onSelect={(d) =>
                onFiltersChange({
                  ...filters,
                  fechaHasta: d ? format(d, "yyyy-MM-dd") : null,
                })
              }
              locale={es}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
