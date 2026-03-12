import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw, Loader2, Filter, X, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActivityLog } from "@/hooks/useActivityLog";

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  INSERT: { label: "Creación",    variant: "default" },
  UPDATE: { label: "Edición",     variant: "secondary" },
  DELETE: { label: "Eliminación", variant: "destructive" },
  LOGIN:  { label: "Sesión",      variant: "outline" },
  EXPORT: { label: "Exportación", variant: "outline" },
};

const ENTITY_LABELS: Record<string, string> = {
  caso:    "Caso",
  cliente: "Cliente",
  usuario: "Usuario",
  sesion:  "Sesión",
  reporte: "Reporte",
};

const PAGE_SIZE = 50;

export default function AdminActivityLog() {
  const [entity, setEntity] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [page, setPage]   = useState(0);

  const { data, isLoading, refetch, isRefetching } = useActivityLog({
    entity,
    action,
    page,
    pageSize: PAGE_SIZE,
  });

  const entries  = data?.entries ?? [];
  const total    = data?.total   ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleClear = () => {
    setEntity(null);
    setAction(null);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {total.toLocaleString("es-CO")} registros en total
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Actualizar</span>
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={entity ?? "all"}
              onValueChange={(v) => { setEntity(v === "all" ? null : v); setPage(0); }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entidades</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={action ?? "all"}
              onValueChange={(v) => { setAction(v === "all" ? null : v); setPage(0); }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(entity || action) && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-4 w-4 mr-1" />Limpiar
              </Button>
            )}

            <Badge variant="secondary" className="ml-auto">
              <Filter className="h-3 w-3 mr-1" />
              Mostrando {Math.min(PAGE_SIZE, entries.length)} de {total.toLocaleString("es-CO")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registro de Actividad</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Sin registros para los filtros seleccionados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Fecha / Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>ID Registro</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{entry.user_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{entry.user_email ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_LABELS[entry.action]?.variant ?? "outline"}>
                          {ACTION_LABELS[entry.action]?.label ?? entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {ENTITY_LABELS[entry.entity] ?? entry.entity}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {entry.entity_id ? entry.entity_id.substring(0, 8) + "…" : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {Object.keys(entry.details ?? {}).length > 0
                          ? JSON.stringify(entry.details)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >Anterior</Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}
