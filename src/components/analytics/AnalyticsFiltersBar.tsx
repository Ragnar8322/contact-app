import { format } from "date-fns";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsFilters, FilterOption } from "@/hooks/useAnalyticsFilters";

interface Props {
  filters: AnalyticsFilters;
  onChange: <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => void;
  onApply: () => void;
  onClear: () => void;
  activeFilterCount: number;
  campanaOptions: FilterOption[];
  agenteOptions: FilterOption[];
  estadoOptions: FilterOption[];
}

function DateButton({ value, onSelect }: { value: Date; onSelect: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[130px] justify-start text-left text-sm">{format(value, "dd/MM/yyyy")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={(d) => d && onSelect(d)} initialFocus className="pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

function OptionSelect({ value, onChange, all, options, width }: {
  value: string; onChange: (v: string) => void; all: string; options: FilterOption[]; width: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={width}><SelectValue placeholder={all} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {options.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function AnalyticsFiltersBar({
  filters, onChange, onApply, onClear, activeFilterCount, campanaOptions, agenteOptions, estadoOptions,
}: Props) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-3">
          <DateButton value={filters.dateFrom} onSelect={(d) => onChange("dateFrom", d)} />
          <span className="text-muted-foreground text-sm">a</span>
          <DateButton value={filters.dateTo} onSelect={(d) => onChange("dateTo", d)} />
          <OptionSelect
            value={filters.campanaId || "all"} onChange={(v) => onChange("campanaId", v === "all" ? null : v)}
            all="Todas las campañas" options={campanaOptions} width="w-[180px]"
          />
          <OptionSelect
            value={filters.agenteId || "all"} onChange={(v) => onChange("agenteId", v === "all" ? null : v)}
            all="Todos los agentes" options={agenteOptions} width="w-[180px]"
          />
          <OptionSelect
            value={filters.estadoId ? String(filters.estadoId) : "all"} onChange={(v) => onChange("estadoId", v === "all" ? null : Number(v))}
            all="Todos los estados" options={estadoOptions} width="w-[160px]"
          />
          <Button onClick={onApply}><Filter className="h-4 w-4 mr-1" />Aplicar</Button>
          <Button variant="ghost" onClick={onClear}><X className="h-4 w-4 mr-1" />Limpiar filtros</Button>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} activo{activeFilterCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
